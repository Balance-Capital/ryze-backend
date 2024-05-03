import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { OhlcModule } from '../ohlc/ohlc.module';
import { BinanceService } from './binance/binance.service';
import { KrakenService } from './kraken/kraken.service';
import { OKXService } from './okx/okx.service';
import { ByBitService } from './bybit/bybit.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'Accept-Encoding': 'gzip,deflate,compress' },
      }),
    }),
    OhlcModule,
  ],
  providers: [BinanceService, KrakenService, OKXService, ByBitService],
})
export class WebsocketProviderModule {}
