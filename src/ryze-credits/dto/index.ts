import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';

export class SignatureRequest {
  @ApiProperty()
  @IsEthereumAddress()
  address: string;
}

export class SignatureResponse {
  @ApiProperty()
  isEligible: boolean;

  @ApiProperty()
  address?: string;

  @ApiProperty()
  tokenId?: string | number;

  @ApiProperty()
  amount?: string;

  @ApiProperty()
  totalClaimedAmount?: string;

  @ApiProperty()
  generatedAt?: number;

  @ApiProperty()
  signature?: string;

  @ApiProperty()
  msg?: string;
}
