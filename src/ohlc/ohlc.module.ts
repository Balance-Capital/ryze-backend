import { CacheModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Ohlc } from './entities/ohlc.entity';
import { OhlcController } from './ohlc.controller';
import { OhlcService } from './ohlc.service';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule } from '@nestjs/throttler';
import { loadEnvVariable } from 'src/core/utils/base.util';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ohlc]),
    CacheModule.register(),
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'Accept-Encoding': 'gzip,deflate,compress' },
      }),
    }),
    ThrottlerModule.forRoot({
      ttl: parseInt(loadEnvVariable('THROTTLE_TTL', true, '1000')),
      limit: parseInt(loadEnvVariable('THROTTLE_LIMIT', true, '3')),
    }),
  ],
  controllers: [OhlcController],
  providers: [OhlcService],
  exports: [OhlcService],
})
export class OhlcModule {}
