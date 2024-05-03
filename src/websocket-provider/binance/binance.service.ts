import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { RateLimit } from 'async-sema';
import { retryAsync } from 'ts-retry';

import { OhlcService } from '../../ohlc/ohlc.service';
import { BinanceWebsocketClient } from './binance-websocket-client';
import {
  generateRetryRandomPeriod,
  getMinuteFromTime,
} from '../../core/utils/base.util';
import { DataProvider, MarketSymbol } from '../../core/enums/base.enum';
import {
  DEFAULT_RPS,
  RECORD_COUNT_FOR_AGGREGATE,
  USE_TUSD,
  CHAINLINK_PROVIDER,
  DATA_PROVIDERS,
} from '../../core/constants/config.constant';
import { MINUTE, RETRY_COUNT } from '../../core/constants/base.constant';

@Injectable()
export class BinanceService implements OnModuleInit {
  private readonly logger = new Logger(BinanceService.name);
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
    const symbolTradeTags = DATA_PROVIDERS[DataProvider.Binance].markets.map(
      ({ tick }) => `${tick.toLowerCase()}@trade`,
    );
    const binanceTradeWebSocket = new BinanceWebsocketClient(
      DATA_PROVIDERS[DataProvider.Binance].ws,
      `ws/${symbolTradeTags.join('/')}`,
      'trade',
    );
    binanceTradeWebSocket.setHandler('disconnected', async () => {
      Object.values(MarketSymbol).map((symbol: string) => {
        this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol] = {
          volume: 0,
          tradeCountPerMinute: 0,
          syncTrade: null,
          lastTrade: null,
          hasBinanceError: false,
        };
      });
    });
    binanceTradeWebSocket.setHandler('trade', async (params) => {
      await this.handleTradeEvent(params);
    });
  }

  async getHistoricalTrades(
    symbol,
    start: number,
    end: number,
  ): Promise<number> {
    try {
      await this.lim();
      const { data } = await firstValueFrom(
        this.httpService
          .get(
            `${
              DATA_PROVIDERS[DataProvider.Binance].api
            }/klines?interval=1m&symbol=${symbol}&startTime=${start}&endTime=${end}`,
          )
          .pipe(
            catchError((err: AxiosError) => {
              return throwError(
                () =>
                  new Error(
                    `Binance Api ${symbol} failed to fetch historical trade data, error: ${JSON.stringify(
                      err,
                    )}`,
                  ),
              );
            }),
          ),
      );
      if (data.length > 0) {
        const latestData = data[0];
        return Number(latestData[5]) || 0;
      }
    } catch (e) {
      this.logger.warn(
        `Binance ${symbol} historical trades getting failed ${e}`,
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
      const symbol = DATA_PROVIDERS[DataProvider.Binance].markets.find(
        (item) => item.tick === params.s,
      )?.symbol;
      const currentMinute = getMinuteFromTime(params.T);
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
        break;
      }
      const usdtPrice =
        USE_TUSD && symbol.includes('BTC')
          ? this.ohlcService.onChainPrice[CHAINLINK_PROVIDER[3].id] || 1
          : this.ohlcService.onChainPrice[CHAINLINK_PROVIDER[0].id] || 1;
      if (
        !this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol]
          ?.syncTrade
      ) {
        this.messageQueue = [];
        this.ohlcService.latestPriceRecord[DataProvider.Binance][
          symbol
        ].syncTrade = {
          price: Number(params.p) * usdtPrice,
          volume: Number(params.q),
          timestamp: params.T,
        };
        const startTime = params.T - (params.T % MINUTE);
        let volume = null;
        try {
          volume = await retryAsync(
            async () => {
              return await this.getHistoricalTrades(
                params.s,
                startTime,
                params.T,
              );
            },
            {
              delay: generateRetryRandomPeriod(true),
              maxTry: RETRY_COUNT,
            },
          );
        } catch (e) {
          this.logger.warn(
            `Binance ${symbol} historical trades getting finally failed ${e}`,
          );
        }
        this.ohlcService.latestPriceRecord[DataProvider.Binance][
          symbol
        ].volume += volume || 0;
      }
      if (
        !this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol]
          ?.lastTrade?.timestamp ||
        (this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol]
          ?.lastTrade?.timestamp &&
          this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol]
            ?.lastTrade?.timestamp <= params.T)
      ) {
        this.ohlcService.latestPriceRecord[DataProvider.Binance][
          symbol
        ].lastTrade = {
          price: Number(params.p) * usdtPrice,
          volume: Number(params.q),
          timestamp: params.T,
          createdAt: Date.now(),
        };
        this.ohlcService.latestPriceRecord[DataProvider.Binance][
          symbol
        ].hasBinanceError = false;
        this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol]
          .tradeCountPerMinute++;
        this.ohlcService.latestPriceRecord[DataProvider.Binance][
          symbol
        ].volume += Number(params.q);
      }
      if (
        this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol]
          ?.lastTrade?.timestamp &&
        this.ohlcService.latestPriceRecord[DataProvider.Binance][symbol]
          ?.lastTrade?.timestamp > params.T
      ) {
        this.ohlcService.latestPriceRecord[DataProvider.Binance][
          symbol
        ].hasBinanceError = true;
      }
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
