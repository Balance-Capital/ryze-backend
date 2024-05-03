import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class MarketStatusResponse {
  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNumber()
  oneDayChangeRate: number;

  @ApiProperty()
  @IsNumber()
  oneDayVolume: number;

  @ApiProperty()
  @IsString()
  trendLineSvg: string;
}
