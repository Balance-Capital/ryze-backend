import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { OKXOhlcService } from './okx.ohlc.service';
import { OhlcDto } from '../../ohlc/dto/ohlc.dto';

@Injectable()
export class OKXService implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    private readonly okxOhlcService: OKXOhlcService,
  ) {}

  onModuleInit() {}

  async getOhlcData(time: number, symbol: string): Promise<OhlcDto> {
    return this.okxOhlcService.getOhlcPrice(time, symbol);
  }
}
