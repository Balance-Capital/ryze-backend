import { Module } from '@nestjs/common';
import { PointService } from './point.service';
import { PointController } from './point.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskProgress } from './entities/task-progress.entity';
import { TaskSeason } from './entities/task-season.entity';
import { TaskTier } from './entities/task-tier.entity';
import { GraphqlModule } from 'src/graphql/graphql.module';
import { Affiliate } from 'src/affiliate/entities/affiliate.entity';
import { BoostNFTService } from './boost-nft.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskProgress,
      TaskSeason,
      TaskTier,
      Affiliate,
    ]),
    GraphqlModule,
  ],
  controllers: [PointController],
  providers: [PointService, BoostNFTService],
})
export class PointModule {}
