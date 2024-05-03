import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { RateLimit } from 'async-sema';
import { retryAsync } from 'ts-retry';

import { OhlcService } from '../../ohlc/ohlc.service';
import { OKXWebsocketClient } from './okx-websocket-client';
import { SymbolLatestPriceRecord } from '../../core/types/price.type';
import { DataProvider, MarketSymbol } from '../../core/enums/base.enum';
import { MINUTE, RETRY_COUNT } from '../../core/constants/base.constant';
import {
  DEFAULT_RPS,
  RECORD_COUNT_FOR_AGGREGATE,
  CHAINLINK_PROVIDER,
  DATA_PROVIDERS,
} from '../../core/constants/config.constant';
import {
  generateRetryRandomPeriod,
  getMinuteFromTime,
} from '../../core/utils/base.util';

@Injectable()
export class OKXService implements OnModuleInit {
  latestData: SymbolLatestPriceRecord = {};
  private readonly logger = new Logger(OKXService.name);
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
    const args = DATA_PROVIDERS[DataProvider.OKX].markets.map(({ tick }) => ({
      channel: 'trades',
      instId: tick,
    }));

    const tradePath = JSON.stringify({
      op: 'subscribe',
      args,
    });

    const okxTradeWebSocket = new OKXWebsocketClient(
      DATA_PROVIDERS[DataProvider.OKX].ws,
      tradePath,
      'trade',
    );
    okxTradeWebSocket.setHandler('disconnected', async () => {
      Object.values(MarketSymbol).map((symbol: string) => {
        this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol] = {
          volume: 0,
          tradeCountPerMinute: 0,
          syncTrade: null,
          lastTrade: null,
        };
      });
    });
    okxTradeWebSocket.setHandler('trade', async (params) => {
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
              DATA_PROVIDERS[DataProvider.OKX].api
            }/market/candles?instId=${symbol}&bar=1m&limit=2`,
          )
          .pipe(
            catchError((err: AxiosError) => {
              return throwError(
                () =>
                  new Error(
                    `OKX Api ${symbol} failed to fetch historical trade data, error: ${JSON.stringify(
                      err,
                    )}`,
                  ),
              );
            }),
          ),
      );
      const result = data?.data;
      if (result?.length > 0) {
        const candle = result.find((item) => Number(item[0]) === since);
        if (candle && candle.length > 0) {
          return Number(candle?.[5] || 0);
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    } catch (e) {
      this.logger.warn(`OKX ${symbol} historical trades getting failed ${e}`);
    }
    return 0;
  }

  private async processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const params = this.messageQueue.shift();
      if (!params) {
        continue;
      }
      const symbol = DATA_PROVIDERS[DataProvider.OKX].markets.find(
        (item) => item.tick === params.instId,
      )?.symbol;
      const currentMinute = getMinuteFromTime(Number(params.ts));

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
      const usdtPrice =
        this.ohlcService.onChainPrice[CHAINLINK_PROVIDER[0].id] || 1;

      if (
        !this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol]?.syncTrade
      ) {
        this.messageQueue = [];
        this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol].syncTrade =
          {
            volume: Number(params.sz),
            timestamp: Number(params.ts),
            price: Number(params.px) * usdtPrice,
          };
        const startTime =
          this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol].syncTrade
            .timestamp -
          (this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol]
            .syncTrade.timestamp %
            MINUTE);
        let volume = null;
        try {
          volume = await retryAsync(
            async () => {
              return await this.getHistoricalTrades(params.instId, startTime);
            },
            {
              delay: generateRetryRandomPeriod(true),
              maxTry: RETRY_COUNT,
              until: (lastResult) => lastResult !== null,
            },
          );
        } catch (e) {
          this.logger.warn(
            `OKX ${symbol} historical trades getting finally failed ${e}`,
          );
        }
        this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol].volume +=
          volume || 0;
      }
      this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol][
        'lastTrade'
      ] = {
        volume: Number(params.sz),
        timestamp: Number(params.ts),
        price: Number(params.px) * usdtPrice,
        createdAt: Date.now(),
      };
      this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol]
        .tradeCountPerMinute++;
      this.ohlcService.latestPriceRecord[DataProvider.OKX][symbol].volume +=
        Number(params.sz);
    }
  }

  private async handleTradeEvent(tradeData): Promise<void> {
    tradeData.map((trade) => this.messageQueue.push(trade));
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
