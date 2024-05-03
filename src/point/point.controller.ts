import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PointService } from './point.service';
import { ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/core/guards/admin.guard';
import { SetSeasonDto } from './dto/query.dto';

@ApiTags('Incentive Point System Management')
@Controller('point')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get('/tasks')
  async getTasks() {
    return await this.pointService.getTasks();
  }

  @Get('/task-progresses/:address')
  async getTaskProgresses(@Param('address') user: string) {
    console.log('address: ', user);
    return await this.pointService.getTaskProgresses(user);
  }

  @Get('/task-tiers')
  async getTaskTiers() {
    return await this.pointService.getTaskTiers();
  }

  @Get('/current-season')
  async getCurrentSeason() {
    return await this.pointService.getCurrentSeason();
  }

  @Get('/user-point/:address')
  async getUserPoint(@Param('address') user: string) {
    return await this.pointService.getUserPoint(user);
  }

  @Get('leaderboard')
  @ApiQuery({ name: 'address', required: false })
  async getLeaderboard(
    @Query('skip') skip: number,
    @Query('take') take: number,
    @Query('address') address?: string,
  ) {
    return this.pointService.leaderboard(skip, take, address);
  }

  @Post('/set-new-season')
  @UseGuards(AdminGuard)
  async setNewSeason(@Body() data: SetSeasonDto) {
    return await this.pointService.setNewSeason(
      data.start_time,
      data.end_time,
      data.reset,
    );
  }

  // TODO this should be removed in prod mode
  @Post('/clear')
  async clear() {
    return await this.pointService.clear();
  }
}
