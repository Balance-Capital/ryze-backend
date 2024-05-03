import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Affiliate } from './entities/affiliate.entity';
import { AffiliateFee } from './entities/affiliate-fee.entity';

import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { AffiliateExplicityFee } from './entities/affiliate-explicity-fee.entity';
import { AffiliateTier } from './entities/affiliate-tier.entity';
import { AffiliateCSVService } from './csv.service';
import { User } from 'src/user/entities/user.entity';
import { GraphqlModule } from 'src/graphql/graphql.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Affiliate,
      AffiliateFee,
      AffiliateExplicityFee,
      AffiliateTier,
      User,
    ]),
    GraphqlModule,
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService, AffiliateCSVService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
