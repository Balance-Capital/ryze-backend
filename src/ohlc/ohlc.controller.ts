import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { OhlcService } from './ohlc.service';
import { Ohlc } from './entities/ohlc.entity';
import { PriceParams, PriceResponse } from './dto/price.dto';
import {
  LastOhlcParams,
  OhlcPaginationDto,
  OhlcParams,
  OhlcResponse,
} from './dto/ohlc.dto';
import { MarketStatusResponse } from './dto/market-status.dto';
import { PaginatorDto } from '../core/dto/paginator.dto';
import { DEFAULT_TAKE_COUNT, SECOND } from '../core/constants/base.constant';

@ApiTags('Price management')
@Controller('')
export class OhlcController {
  constructor(private readonly ohlcService: OhlcService) {}

  @Get('price')
  @ApiOkResponse({ type: () => PriceResponse })
  async getPrice(@Query() query: PriceParams): Promise<PriceResponse> {
    const price = await this.ohlcService.getPrice(query);
    return { price };
  }

  @Get('ohlc')
  @ApiOkResponse({ type: () => OhlcParams })
  ohlc(@Query() query: OhlcParams): Promise<OhlcResponse> {
    return this.ohlcService.getOhlcData(query);
  }

  /**
   * This endpoint should be used inside ChatGPT, i cannot be saying whats from and to...
   * @param query
   */
  @Get('last-ohlc')
  @ApiOkResponse({ type: () => LastOhlcParams })
  lastOhlc(@Query() query: LastOhlcParams): Promise<OhlcResponse> {
    const to = new Date();
    const from = new Date(to.getTime() - 6 * 60 * 60 * 1000);
    const params = new OhlcParams();
    params.symbol = query.symbol;
    params.resolution = query.resolution;
    params.from = from.getTime();
    params.to = to.getTime();
    return this.ohlcService.getOhlcData(params);
  }

  @Get('current-time')
  @ApiOkResponse({ type: () => Number })
  getCurrentTimestamp(): number {
    return Date.now();
  }

  @Get('history')
  @ApiOkResponse({ type: () => PaginatorDto })
  async history(
    @Query() query: OhlcPaginationDto,
  ): Promise<PaginatorDto<Ohlc>> {
    return await this.ohlcService.findAll(
      query.skip || 0,
      query.take || DEFAULT_TAKE_COUNT,
      query.symbol,
      query.from,
      query.to,
    );
  }

  @Get('market-status')
  @Header('Cache-Control', 'max-age=300')
  @ApiOkResponse({ type: () => [MarketStatusResponse] })
  getMarketStatus(): Promise<MarketStatusResponse[]> {
    const to = Date.now();
    const from = to - 86400 * SECOND;
    return this.ohlcService.getMarketInfo(from, to);
  }
}
