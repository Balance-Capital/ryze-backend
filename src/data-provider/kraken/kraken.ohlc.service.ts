import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { RateLimit } from 'async-sema';

import { OhlcDto } from '../../ohlc/dto/ohlc.dto';
import { DataProvider } from '../../core/enums/base.enum';
import { isUndefinedValue, sleep } from '../../core/utils/base.util';
import {
  DATA_PROVIDERS,
  DEFAULT_RPS,
} from '../../core/constants/config.constant';
import {
  MINUTE,
  RETRY_SECOND,
  SECOND,
  SLEEP_TIME_FOR_FETCHING_EXCHANGES,
} from '../../core/constants/base.constant';

@Injectable()
export class KrakenOhlcService {
  private readonly logger = new Logger(KrakenOhlcService.name);
  private readonly lim;

  constructor(private readonly httpService: HttpService) {
    this.lim = RateLimit(DEFAULT_RPS);
  }

  checkHasUndefinedResponse(latestData: any[]): boolean {
    let hasUndefinedResponse = false;
    for (let i = 0; i < latestData.length; i++) {
      if (i > 0 && i !== 5) {
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
      symbol = symbol.replace('XBT', 'BTC');
      let krakenData;
      while (true) {
        const { data } = await firstValueFrom(
          this.httpService
            .get(
              `${
                DATA_PROVIDERS[DataProvider.Kraken].api
              }/OHLC?interval=1&pair=${symbol}&since=${
                (time - 2 * MINUTE) / SECOND
              }`,
            )
            .pipe(
              catchError((err: AxiosError) => {
                return throwError(
                  () =>
                    new Error(
                      `KRAKEN Api failed to fetch ohlc data. error: ${JSON.stringify(
                        err,
                      )}`,
                    ),
                );
              }),
            ),
        );
        //fetch latest 2 candles
        // check if last candle start time equals current minute timestamp and candles length is 2.
        // if so, candles[0] is result
        const candles = data?.result?.[symbol];
        if (candles?.length > 0 && candles[0][0] === (time - MINUTE) / SECOND) {
          krakenData = candles;
          break;
        } else if (new Date().getUTCSeconds() > RETRY_SECOND) {
          break;
        }

        await sleep(SLEEP_TIME_FOR_FETCHING_EXCHANGES);
      }

      if (krakenData?.length > 0) {
        const latestData = krakenData[0];
        if (this.checkHasUndefinedResponse(latestData)) {
          throw Error(
            `KRAKEN Api returns invalid data. time = ${time} symbol = ${symbol}`,
          );
        }
        return {
          time: Number(latestData[0]) * SECOND,
          open: Number(latestData[1]),
          high: Number(latestData[2]),
          low: Number(latestData[3]),
          close: Number(latestData[4]),
          volume: Number(latestData[6]),
        };
      }
      return null;
    } catch (e) {
      this.logger.warn(
        `KRAKEN Api failed to get ohlc data. time = ${time} symbol = ${symbol} error: ${JSON.stringify(
          e.stack,
        )}`,
      );
      throw Error(
        `KRAKEN Api failed to get ohlc data. time = ${time} symbol = ${symbol}`,
      );
    }
  }
}
