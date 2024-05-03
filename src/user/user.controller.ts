import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiImplicitParam } from '@nestjs/swagger/dist/decorators/api-implicit-param.decorator';

import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { AuthGuard } from '../core/guards/auth.guard';
import { SuccessResponse } from '../core/models/response.model';
import { DEFAULT_TAKE_COUNT } from '../core/constants/base.constant';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationDto } from 'src/core/dto/pagination.dto';

@ApiTags('User Management')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get('count-data')
  async countData(): Promise<number> {
    return await this.userService.countData();
  }

  @Get('all')
  @ApiOkResponse({ type: () => Array<User> })
  async users(@Query() query: PaginationDto): Promise<User[]> {
    return await this.userService.findAll(
      query.skip || 0,
      query.take || DEFAULT_TAKE_COUNT,
    );
  }

  @Get('find-by-referral/:referralId')
  async findUserByReferralId(@Param('referralId') referralId: string) {
    return this.userService.findByReferralId(referralId);
  }

  @Get(':address')
  @ApiImplicitParam({ name: 'address', required: true })
  @ApiOkResponse({ type: () => User })
  async user(@Param('address') address: string): Promise<User> {
    return await this.userService.findByAddress(address);
  }

  @ApiOkResponse({ type: SuccessResponse })
  @Post('register')
  async login(@Body() body: CreateUserDto): Promise<CreateUserDto> {
    return this.userService.create(body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: SuccessResponse })
  @Post('generate-referral')
  async generateReferral(@Request() req) {
    return this.userService.createReferralIdIfNotExistsAndSave(req.user);
  }

  // TODO this should be deleted in prod
  // @Post('/clear')
  // async resetDB() {
  //   return this.userService.clear();
  // }
}
