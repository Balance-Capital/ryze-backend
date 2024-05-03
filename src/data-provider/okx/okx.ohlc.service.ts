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
} from '../../core/constants/config.constant';
import { isUndefinedValue, sleep } from '../../core/utils/base.util';
import {
  MINUTE,
  RETRY_SECOND,
  SLEEP_TIME_FOR_FETCHING_EXCHANGES,
} from 'src/core/constants/base.constant';

@Injectable()
export class OKXOhlcService {
  private readonly logger = new Logger(OKXOhlcService.name);
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
      let ohlcData;
      while (true) {
        const { data } = await firstValueFrom(
          this.httpService
            .get(
              `${
                DATA_PROVIDERS[DataProvider.OKX].api
              }/market/candles?instId=${symbol}&bar=1m&limit=2&after=${time}`,
            )
            .pipe(
              catchError((err: AxiosError) => {
                return throwError(
                  () =>
                    new Error(
                      `OKX Api failed to fetch ohlc data. time = ${time} symbol = ${symbol} error: ${JSON.stringify(
                        err,
                      )}`,
                    ),
                );
              }),
            ),
        );

        //fetch latest 2 candles
        // check if first candle start time equals current minute timestamp and candles length is 2.
        // if so, candles[1] is result
        const result = data?.data;
        if (result?.length > 0 && Number(result[0][0]) === time - MINUTE) {
          ohlcData = result;
          break;
        } else if (new Date().getUTCSeconds() > RETRY_SECOND) {
          break;
        }

        await sleep(SLEEP_TIME_FOR_FETCHING_EXCHANGES);
      }

      if (ohlcData?.length > 1) {
        const latestData = ohlcData[0];
        if (this.checkHasUndefinedResponse(latestData)) {
          throw Error(
            `OKX Api returns invalid data. time = ${time} symbol = ${symbol}`,
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
        `OKX Api failed to get ohlc data. time = ${time} symbol = ${symbol} error: ${JSON.stringify(
          e.stack,
        )}`,
      );
      throw Error(
        `OKX Api failed to get ohlc data. time = ${time} symbol = ${symbol}`,
      );
    }
  }
}
