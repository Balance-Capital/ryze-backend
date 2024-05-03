import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { RateLimit } from 'async-sema';
import { retryAsync } from 'ts-retry';

import { OhlcService } from '../../ohlc/ohlc.service';
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
import { WebsocketClient } from 'bybit-api';

@Injectable()
export class ByBitService implements OnModuleInit {
  private readonly logger = new Logger(ByBitService.name);
  private readonly lim;
  private messageQueue = [];
  private isProcessingMessage = false;
  private bybitWebSocket: WebsocketClient;

  constructor(
    private readonly httpService: HttpService,
    private readonly ohlcService: OhlcService,
  ) {
    this.lim = RateLimit(DEFAULT_RPS);
  }

  onModuleInit() {
    this.createSocket();
  }

  createSocket() {
    try {
      if (this.bybitWebSocket) {
        this.bybitWebSocket.closeAll();
        this.bybitWebSocket = null;
      }

      this.bybitWebSocket = new WebsocketClient({
        market: 'v5',
      });

      for (
        let i = 0;
        i < DATA_PROVIDERS[DataProvider.ByBit].markets.length;
        i++
      ) {
        this.bybitWebSocket.subscribeV5(
          `publicTrade.${DATA_PROVIDERS[DataProvider.ByBit].markets[i].tick}`,
          'spot',
        );
      }

      // Optional: Listen to connection close event. Unexpected connection closes are automatically reconnected.
      this.bybitWebSocket.on('close', () => {
        Object.values(MarketSymbol).map((symbol: string) => {
          this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol] = {
            volume: 0,
            tradeCountPerMinute: 0,
            syncTrade: null,
            lastTrade: null,
          };
        });

        setTimeout(() => {
          this.createSocket();
        }, generateRetryRandomPeriod(true));
      });

      // Listen to events coming from websockets. This is the primary data source
      this.bybitWebSocket.on('update', async (data) => {
        if (data && data.topic) {
          if (data.topic.startsWith('publicTrade')) {
            for (let i = 0; i < data.data.length; i++) {
              await this.handleTradeEvent(data.data[i]);
            }
          }
        }
      });
    } catch (e) {
      this.logger.warn(`ByBit create socket function failed, ${e.stack}`);
      setTimeout(() => {
        this.createSocket();
      }, generateRetryRandomPeriod(true));
    }
  }

  async getHistoricalTrades(
    symbol,
    start: number,
    end: number,
  ): Promise<number> {
    try {
      await this.lim();
      const { data: res } = await firstValueFrom(
        this.httpService
          .get(
            `${
              DATA_PROVIDERS[DataProvider.ByBit].api
            }/v5/market/kline?category=spot&interval=1&symbol=${symbol}&start=${start}&end=${end}`,
          )
          .pipe(
            catchError((err: AxiosError) => {
              return throwError(
                () =>
                  new Error(
                    `ByBit Api ${symbol} failed to fetch historical trade data, error: ${JSON.stringify(
                      err,
                    )}`,
                  ),
              );
            }),
          ),
      );

      const data = res.result.list;

      if (data.length > 0) {
        const latestData = data[0];
        return Number(latestData[5]) || 0;
      }
    } catch (e) {
      this.logger.warn(
        `ByBit ${symbol} historical trades getting failed ${e.stack}`,
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
      const symbol = DATA_PROVIDERS[DataProvider.ByBit].markets.find(
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
        this.ohlcService.onChainPrice[CHAINLINK_PROVIDER[0].id] || 1;
      if (
        !this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol]
          ?.syncTrade
      ) {
        this.messageQueue = [];
        this.ohlcService.latestPriceRecord[DataProvider.ByBit][
          symbol
        ].syncTrade = {
          price: Number(params.p) * usdtPrice,
          volume: Number(params.v),
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
            `ByBit ${symbol} historical trades getting finally failed ${e.stack}`,
          );
        }
        this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol].volume +=
          volume || 0;
      }
      if (
        !this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol]
          ?.lastTrade?.timestamp ||
        (this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol]
          ?.lastTrade?.timestamp &&
          this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol]
            ?.lastTrade?.timestamp <= params.T)
      ) {
        this.ohlcService.latestPriceRecord[DataProvider.ByBit][
          symbol
        ].lastTrade = {
          price: Number(params.p) * usdtPrice,
          volume: Number(params.v),
          timestamp: params.T,
          createdAt: Date.now(),
        };
        this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol]
          .tradeCountPerMinute++;
        this.ohlcService.latestPriceRecord[DataProvider.ByBit][symbol].volume +=
          Number(params.v);
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
