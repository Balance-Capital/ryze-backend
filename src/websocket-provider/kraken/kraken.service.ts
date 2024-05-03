import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { RateLimit } from 'async-sema';
import { retryAsync } from 'ts-retry';

import { OhlcService } from '../../ohlc/ohlc.service';
import { KrakenWebsocketClient } from './kraken-websocket-client';
import { SymbolLatestPriceRecord } from '../../core/types/price.type';
import { DataProvider, MarketSymbol } from '../../core/enums/base.enum';
import {
  MINUTE,
  RETRY_COUNT,
  SECOND,
} from '../../core/constants/base.constant';
import {
  DEFAULT_RPS,
  RECORD_COUNT_FOR_AGGREGATE,
  DATA_PROVIDERS,
} from '../../core/constants/config.constant';
import {
  generateRetryRandomPeriod,
  getMinuteFromTime,
} from '../../core/utils/base.util';

@Injectable()
export class KrakenService implements OnModuleInit {
  latestData: SymbolLatestPriceRecord = {};
  private readonly logger = new Logger(KrakenService.name);
  private readonly lim;
  private messageQueue = [];
  private isProcessingMessage = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly ohlcService: OhlcService,
  ) {
    this.lim = RateLimit(DEFAULT_RPS);
  }

  onModuleInit() {
    const tradePath = JSON.stringify({
      event: 'subscribe',
      pair: DATA_PROVIDERS[DataProvider.Kraken].markets.map(({ tick }) => tick),
      subscription: { name: 'trade' },
    });

    const krakenTradeWebSocket = new KrakenWebsocketClient(
      DATA_PROVIDERS[DataProvider.Kraken].ws,
      tradePath,
      'trade',
    );
    krakenTradeWebSocket.setHandler('disconnected', async () => {
      Object.values(MarketSymbol).map((symbol: string) => {
        this.ohlcService.latestPriceRecord[DataProvider.Kraken][symbol] = {
          volume: 0,
          tradeCountPerMinute: 0,
          syncTrade: null,
          lastTrade: null,
        };
      });
    });
    krakenTradeWebSocket.setHandler('trade', async (params) => {
      await this.handleTradeEvent(params);
    });
  }

  async getHistoricalTrades(symbol, since: number): Promise<number> {
    try {
      await this.lim();
      const { data } = await firstValueFrom(
        this.httpService
          .get(
            `${
              DATA_PROVIDERS[DataProvider.Kraken].api
            }/OHLC?interval=1&pair=${symbol}&since=${since / SECOND}`,
          )
          .pipe(
            catchError((err: AxiosError) => {
              return throwError(
                () =>
                  new Error(
                    `Kraken Api ${symbol} failed to fetch historical trade data, error: ${JSON.stringify(
                      err,
                    )}`,
                  ),
              );
            }),
          ),
      );
      if (data.result[symbol]?.length > 0) {
        return Number(data.result[symbol][0][6]) || 0;
      }
    } catch (e) {
      this.logger.warn(
        `Kraken ${symbol} historical trades getting failed ${e}`,
      );
    }
    return null;
  }

  private async processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const params = this.messageQueue.shift();
      if (!params) {
        continue;
      }
      if (!Array.isArray(params[1])) {
        continue;
      }
      const ticker = params[3].replace('XBT', 'BTC');
      const symbol = DATA_PROVIDERS[DataProvider.Kraken].markets.find(
        (item) => item.tick === ticker,
      )?.symbol;

      await Promise.all(
        params[1].map(async (item) => {
          const currentMinute = getMinuteFromTime(
            Math.floor(Number(item[2]) * SECOND),
          );
          if (this.ohlcService.syncedTime < currentMinute) {
            this.ohlcService.syncedTime = currentMinute;
            Object.keys(DATA_PROVIDERS).forEach((provider: string) => {
              Object.values(MarketSymbol).forEach(async (symbol: string) => {
                // Get last 60 trades
                const latestRecords = await this.ohlcService.find({
                  order: { time: 'DESC' },
                  take: RECORD_COUNT_FOR_AGGREGATE,
                  where: {
                    symbol: symbol,
                    source: provider.toUpperCase() as DataProvider,
                  },
                });
                const last60volume = latestRecords.reduce(
                  (accr, cur) => accr + cur.volume,
                  0,
                );

                this.logger.warn(
                  `${provider} ${symbol} time: ${currentMinute}, trade count : ${this.ohlcService.latestPriceRecord[provider][symbol].tradeCountPerMinute}, volume: ${this.ohlcService.latestPriceRecord[provider][symbol].volume}`,
                );
                this.ohlcService.latestPriceRecord[provider][symbol].volume = 0;
                this.ohlcService.latestPriceRecord[provider][
                  symbol
                ].volumeInLast60Minutes = last60volume;
                this.ohlcService.latestPriceRecord[provider][
                  symbol
                ].tradeCountPerMinute = 0;
              });
            });
          } else if (this.ohlcService.syncedTime > currentMinute) {
            return;
          }
          if (
            !this.ohlcService.latestPriceRecord[DataProvider.Kraken][symbol]
          ) {
            return;
          }

          if (
            !this.ohlcService.latestPriceRecord[DataProvider.Kraken][symbol]
              ?.syncTrade
          ) {
            this.messageQueue = [];
            this.ohlcService.latestPriceRecord[DataProvider.Kraken][
              symbol
            ].syncTrade = {
              volume: Number(item[1]),
              timestamp: Math.floor(Number(item[2]) * SECOND),
              price: Number(item[0]),
            };
            const startTime =
              this.ohlcService.latestPriceRecord[DataProvider.Kraken][symbol]
                .syncTrade.timestamp -
              (this.ohlcService.latestPriceRecord[DataProvider.Kraken][symbol]
                .syncTrade.timestamp %
                MINUTE);
            let volume = null;
            try {
              volume = await retryAsync(
                async () => {
                  return await this.getHistoricalTrades(ticker, startTime);
                },
                {
                  delay: generateRetryRandomPeriod(true),
                  maxTry: RETRY_COUNT,
                  until: (lastResult) => lastResult !== null,
                },
              );
            } catch (e) {
              this.logger.warn(
                `Kraken ${symbol} historical trades getting finally failed ${e}`,
              );
            }
            this.ohlcService.latestPriceRecord[DataProvider.Kraken][
              symbol
            ].volume += volume || 0;
          }
          this.ohlcService.latestPriceRecord[DataProvider.Kraken][symbol][
            'lastTrade'
          ] = {
            volume: Number(item[1]),
            timestamp: Math.floor(Number(item[2]) * SECOND),
            price: Number(item[0]),
            createdAt: Date.now(),
          };
          this.ohlcService.latestPriceRecord[DataProvider.Kraken][symbol]
            .tradeCountPerMinute++;
          this.ohlcService.latestPriceRecord[DataProvider.Kraken][
            symbol
          ].volume += Number(item[1]);
        }),
      );
    }
  }

  private async handleTradeEvent(params): Promise<void> {
    this.messageQueue.push(params);
    // Process the message queue if it's not already being processed
    if (!this.isProcessingMessage) {
      try {
        this.isProcessingMessage = true;
        this.processMessageQueue();
      } finally {
        this.isProcessingMessage = false;
      }
    }
  }
}
