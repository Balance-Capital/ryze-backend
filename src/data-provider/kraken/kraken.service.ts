import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { KrakenOhlcService } from './kraken.ohlc.service';
import { OhlcDto } from '../../ohlc/dto/ohlc.dto';

@Injectable()
export class KrakenService implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    private readonly krakenOhlcService: KrakenOhlcService,
  ) {}

  onModuleInit() {}

  async getOhlcData(time: number, symbol: string): Promise<OhlcDto> {
    return this.krakenOhlcService.getOhlcPrice(time, symbol);
  }
}
