import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

import { getCurrentMinute } from '../../core/utils/base.util';
import { MarketSymbol } from '../../core/enums/base.enum';

export class PriceParams {
  @ApiProperty({
    description: `Token symbol. One of <b>[${Object.values(MarketSymbol).join(
      ', ',
    )}]</b>`,
    default: 'ETHUSD',
  })
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: `Timestamp in milliseconds e.g. ${getCurrentMinute()}`,
  })
  @IsNotEmpty()
  time: number;
}

export class PriceResponse {
  @ApiProperty()
  price: number;
}
