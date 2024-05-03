import { ApiProperty } from '@nestjs/swagger';

import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../core/dto/pagination.dto';

export class AffiliatePaginationDto extends PaginationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly affiliate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly sortQuery?: string;
}
