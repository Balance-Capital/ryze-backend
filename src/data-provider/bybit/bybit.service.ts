import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { ByBitOhlcService } from './bybit.ohlc.service';
import { OhlcDto } from '../../ohlc/dto/ohlc.dto';

@Injectable()
export class ByBitService implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    private readonly bybitOhlcService: ByBitOhlcService,
  ) {}

  onModuleInit() {}

  async getOhlcData(time: number, symbol: string): Promise<OhlcDto> {
    return this.bybitOhlcService.getOhlcPrice(time, symbol);
  }
}
