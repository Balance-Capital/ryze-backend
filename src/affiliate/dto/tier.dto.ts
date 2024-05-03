import { ApiProperty } from '@nestjs/swagger';
import { TIER } from '../utils';
import { AdminDto } from 'src/core/dto/admin.dto';
import { IsEthereumAddress } from 'class-validator';

export class SetTierDto extends AdminDto {
  @ApiProperty()
  tier: TIER;

  @ApiProperty()
  percent?: string;

  @ApiProperty()
  eligible_referee?: number;

  @ApiProperty()
  eligible_volume?: number;
}

export class SetExplicityFeeDto extends AdminDto {
  @IsEthereumAddress()
  @ApiProperty()
  affiliate: string;

  @ApiProperty()
  percent: number;
}
