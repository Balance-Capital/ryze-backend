import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiImplicitParam } from '@nestjs/swagger/dist/decorators/api-implicit-param.decorator';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

import { FeeRes, AffiliateService } from './affiliate.service';
import { Affiliate } from './entities/affiliate.entity';
import { AffiliateDto } from './dto/affiliate.dto';
import { AffiliatePaginationDto } from './dto/affiliate-pagination.dto';
import { AffiliateFeeDto } from './dto/affiliate-fee.dto';
import { PaginatorDto } from '../core/dto/paginator.dto';
import { DEFAULT_TAKE_COUNT } from '../core/constants/base.constant';
import { SetExplicityFeeDto, SetTierDto } from './dto/tier.dto';
import { AdminGuard } from 'src/core/guards/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { DBWhitelistParams } from './dto/whitelist.dto';
import { AffiliateCSVService } from './csv.service';
import { checkAdminPassword } from 'src/core/utils/admin.util';

@ApiTags('Affiliate Management')
@Controller('affiliate')
export class AffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly csvService: AffiliateCSVService,
  ) {}

  @Get('data-count')
  async countData(): Promise<{
    count_affiliates: number;
    count_affiliateFees: number;
  }> {
    return await this.affiliateService.countData();
  }

  @Get('all')
  @ApiOkResponse({ type: () => PaginatorDto })
  async affiliates(
    @Query() query: AffiliatePaginationDto,
  ): Promise<PaginatorDto<AffiliateDto>> {
    const [data, count] = await this.affiliateService.findAll(
      query.skip || 0,
      query.take || DEFAULT_TAKE_COUNT,
      query.affiliate || null,
      query.sortQuery,
    );
    return {
      data: data.map((item: Affiliate) => {
        return item.toDto();
      }),
      count,
    };
  }

  @Get('total-payouts')
  async getTotalPayouts(): Promise<number> {
    return await this.affiliateService.getTotalPayouts();
  }

  @Get(':affiliate')
  @ApiImplicitParam({ name: 'affiliate', required: true })
  @ApiOkResponse({ type: () => Array<Affiliate> })
  async get(@Param('affiliate') affilitae: string): Promise<Affiliate[]> {
    const record = await this.affiliateService.findByAffiliate(
      affilitae.toLowerCase(),
    );
    if (!record) {
      throw new BadRequestException('Could not find requested affiliate');
    }
    return record;
  }

  @Get('fee/:address')
  @ApiImplicitParam({ name: 'address', required: true })
  async getFee(
    @Param('address') user: string,
    @Query() query: AffiliateFeeDto,
  ): Promise<FeeRes> {
    const fee = await this.affiliateService.findFeeByUser(
      user.toLowerCase(),
      query.needSignature,
    );
    if (!fee) {
      throw new BadRequestException('Could not find requested user');
    }
    return fee;
  }

  // @Post('/clear')
  // async clear() {
  //   return this.affiliateService.clear();
  // }

  // Admin
  @Post('/set-fee-percent')
  @UseGuards(AdminGuard)
  async setExplicityFeePercent(@Body() data: SetExplicityFeeDto) {
    return await this.affiliateService.setExplicityFeeForAffiliate(
      data.affiliate,
      data.percent,
    );
  }

  @Post('/set-tier-percent')
  @UseGuards(AdminGuard)
  async setTierPercent(@Body() data: SetTierDto) {
    return await this.affiliateService.setTierPercent(data);
  }

  @Get('explicity-fee/all')
  async getExplicityFeeData() {
    return await this.affiliateService.findAllExplicityFeeData();
  }

  // This is for dusky.
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Body() params: DBWhitelistParams,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!(await checkAdminPassword(params.password_encrypted))) {
      throw new UnauthorizedException();
    }

    return await this.csvService.handleCSV(file);
  }
}
