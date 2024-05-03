import { Module } from '@nestjs/common';
import { RyzeCreditsService } from './ryze-credits.service';
import { RyzeCreditsController } from './ryze-credits.controller';
import { AffiliateModule } from 'src/affiliate/affiliate.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { GraphqlModule } from 'src/graphql/graphql.module';
import { loadEnvVariable } from 'src/core/utils/base.util';

@Module({
  imports: [
    AffiliateModule,
    ThrottlerModule.forRoot({
      limit: Number(loadEnvVariable('THROTTLE_LIMIT', true, '3')),
      ttl: Number(loadEnvVariable('THROTTLE_TTL', true, '1000')),
    }),
    GraphqlModule,
  ],
  controllers: [RyzeCreditsController],
  providers: [RyzeCreditsService],
})
export class RyzeCreditsModule {}
