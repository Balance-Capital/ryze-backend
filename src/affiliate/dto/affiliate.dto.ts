import { ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';

export class AffiliateDto {
  @IsEthereumAddress()
  @ApiProperty({ type: () => String, required: true })
  user: string;

  /**
   * address
   */
  @IsEthereumAddress()
  @ApiProperty({ type: () => String, required: true })
  affiliate: string;

  @ApiProperty({ type: () => Boolean, required: false })
  is_qualified?: boolean;

  @ApiProperty({ type: () => String, required: true, default: '0' })
  volume?: string;
}
