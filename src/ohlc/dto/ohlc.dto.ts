import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

import { DataProvider, ResolutionType } from '../../core/enums/base.enum';
import { PaginationDto } from '../../core/dto/pagination.dto';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class OhlcDto {
  @ApiProperty()
  open: number;

  @ApiProperty()
  close: number;

  @ApiProperty()
  high: number;

  @ApiProperty()
  low: number;

  @ApiProperty()
  volume: number;

  @ApiProperty()
  id?: number;

  @ApiProperty()
  symbol?: string;

  @ApiProperty()
  time?: number;

  @ApiProperty()
  signature?: string;

  @ApiProperty()
  @IsEnum(DataProvider)
  source?: DataProvider;

  @ApiProperty()
  @CreateDateColumn()
  createdAt?: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt?: Date;
}

export class OhlcPaginationDto extends PaginationDto {
  @ApiProperty({ description: 'Token symbol', default: 'ETHUSD' })
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ description: 'Start of the interval to fetch OHLC data' })
  @IsNotEmpty()
  from: number;

  @ApiProperty({ description: 'End of the interval to fetch OHLC data' })
  @IsNotEmpty()
  to: number;
}

export class OhlcParams {
  @ApiProperty({ description: 'Token symbol', default: 'ETHUSD' })
  @IsNotEmpty()
  symbol: string;

  @ApiProperty()
  @IsNotEmpty()
  @ApiProperty({
    description: 'List of all resolution',
    enum: ResolutionType,
    example: ResolutionType.Minute_1,
  })
  resolution: string;

  @ApiProperty({ description: 'Start of the interval to fetch OHLC data' })
  @IsNotEmpty()
  from: number;

  @ApiProperty({ description: 'End of the interval to fetch OHLC data' })
  @IsNotEmpty()
  to: number;
}

export class OhlcResponse {
  @ApiProperty()
  o: Array<number>;

  @ApiProperty()
  h: Array<number>;

  @ApiProperty()
  l: Array<number>;

  @ApiProperty()
  c: Array<number>;

  @ApiProperty()
  t: Array<string>;

  @ApiProperty()
  v: Array<number>;
}

export class LastOhlcParams {
  @ApiProperty({ description: 'Token symbol', default: 'ETHUSD' })
  @IsNotEmpty()
  symbol: string;

  @ApiProperty()
  @IsNotEmpty()
  @ApiProperty({
    description: 'List of all resolution',
    enum: ResolutionType,
    example: ResolutionType.Minute_1,
  })
  resolution: string;
}
