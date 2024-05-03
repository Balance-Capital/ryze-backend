import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { BinanceOhlcService } from './binance.ohlc.service';
import { OhlcDto } from '../../ohlc/dto/ohlc.dto';

@Injectable()
export class BinanceService implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    private readonly binanceOhlcService: BinanceOhlcService,
  ) {}

  onModuleInit() {}

  async getOhlcData(time: number, symbol: string): Promise<OhlcDto> {
    return this.binanceOhlcService.getOhlcPrice(time, symbol);
  }
}
