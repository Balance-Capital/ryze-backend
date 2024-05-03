import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SystemInfo } from './entities/system-info.entity';
import { SystemInfoService } from './system-info.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemInfo])],
  providers: [SystemInfoService],
  exports: [SystemInfoService],
})
export class SystemInfoModule {}
