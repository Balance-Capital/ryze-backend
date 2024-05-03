import { ApiProperty } from '@nestjs/swagger';

export class AffiliateFeeDto {
  @ApiProperty({ type: () => Boolean, default: false })
  needSignature: boolean;
}
