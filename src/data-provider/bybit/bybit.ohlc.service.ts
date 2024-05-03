import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { RateLimit } from 'async-sema';

import { OhlcService } from '../../ohlc/ohlc.service';
import { OhlcDto } from '../../ohlc/dto/ohlc.dto';
import { DataProvider } from '../../core/enums/base.enum';
import {
  CHAINLINK_PROVIDER,
  DATA_PROVIDERS,
  DEFAULT_RPS,
  USE_TUSD,
} from '../../core/constants/config.constant';
import { isUndefinedValue, sleep } from '../../core/utils/base.util';
import {
  MINUTE,
  RETRY_SECOND,
  SLEEP_TIME_FOR_FETCHING_EXCHANGES,
} from 'src/core/constants/base.constant';

@Injectable()
export class ByBitOhlcService {
  private readonly logger = new Logger(ByBitOhlcService.name);
  private readonly lim;

  constructor(
    private readonly httpService: HttpService,
    private readonly ohlcService: OhlcService,
  ) {
    this.lim = RateLimit(DEFAULT_RPS);
  }

  checkHasUndefinedResponse(latestData: any[]): boolean {
    let hasUndefinedResponse = false;
    for (let i = 0; i < latestData.length; i++) {
      if (i > 0 && i < 6) {
        if (isUndefinedValue(latestData[i])) {
          hasUndefinedResponse = true;
          break;
        }
      }
    }
    return hasUndefinedResponse;
  }

  async getOhlcPrice(time: number, symbol: string): Promise<OhlcDto> {
    try {
      await this.lim();
      let bybitData;
      while (true) {
        const { data: res } = await firstValueFrom(
          this.httpService
            .get(
              `${
                DATA_PROVIDERS[DataProvider.ByBit].api
              }/v5/market/kline?category=spot&interval=1&limit=2&symbol=${symbol}&end=${
                time - MINUTE
              }`,
            )
            .pipe(
              catchError((err: AxiosError) => {
                return throwError(
                  () =>
                    new Error(
                      `BYBIT Api failed to fetch ohlc data. time = ${time} symbol = ${symbol} error: ${JSON.stringify(
                        err,
                      )}`,
                    ),
                );
              }),
            ),
        );

        const data = res.result.list;

        //fetch latest 2 candles
        // check if last candle start time equals current minute timestamp and candles length is 2.
        // if so, candles[0] is result
        if (data?.length > 0 && Number(data[0][0]) === time - MINUTE) {
          bybitData = data;
          break;
        } else if (new Date().getUTCSeconds() > RETRY_SECOND) {
          break;
        }

        await sleep(SLEEP_TIME_FOR_FETCHING_EXCHANGES);
      }

      if (bybitData?.length > 0) {
        const latestData = bybitData[0];
        if (this.checkHasUndefinedResponse(latestData)) {
          throw Error(
            `BYBIT Api returns invalid data. time = ${time} symbol = ${symbol}`,
          );
        }

        const usdtPrice =
          this.ohlcService.onChainPrice[CHAINLINK_PROVIDER[0].id] || 1;

        return {
          time: Number(latestData[0]),
          open: Number(latestData[1]) * usdtPrice,
          high: Number(latestData[2]) * usdtPrice,
          low: Number(latestData[3]) * usdtPrice,
          close: Number(latestData[4]) * usdtPrice,
          volume: Number(latestData[5]),
        };
      }
      return null;
    } catch (e) {
      this.logger.warn(
        `BYBIT Api failed to get ohlc data. time = ${time} symbol = ${symbol} error: ${JSON.stringify(
          e.stack,
        )}`,
      );
      throw Error(
        `BYBIT Api failed to get ohlc data. time = ${time} symbol = ${symbol}`,
      );
    }
  }
}
