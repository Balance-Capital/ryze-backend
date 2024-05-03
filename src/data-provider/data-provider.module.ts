import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OhlcModule } from '../ohlc/ohlc.module';
import { SystemInfoModule } from '../system-info/system-info.module';
import { BinanceService } from './binance/binance.service';
import { BinanceOhlcService } from './binance/binance.ohlc.service';
import { KrakenService } from './kraken/kraken.service';
import { KrakenOhlcService } from './kraken/kraken.ohlc.service';
import { connectionSource } from '../orm.config';
import { OKXService } from './okx/okx.service';
import { OKXOhlcService } from './okx/okx.ohlc.service';
import { ByBitService } from './bybit/bybit.service';
import { ByBitOhlcService } from './bybit/bybit.ohlc.service';

@Module({
  imports: [
    TypeOrmModule.forRoot(connectionSource.options),
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'Accept-Encoding': 'gzip,deflate,compress' },
      }),
    }),
    OhlcModule,
    SystemInfoModule,
  ],
  controllers: [],
  providers: [
    BinanceService,
    BinanceOhlcService,
    KrakenService,
    KrakenOhlcService,
    ByBitService,
    ByBitOhlcService,
    OKXService,
    OKXOhlcService,
  ],
})
export class DataProviderModule {}
