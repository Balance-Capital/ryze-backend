import { ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { AdminDto } from 'src/core/dto/admin.dto';

export class WhitelistParams {
  @ApiProperty({
    description: 'Account address',
  })
  @IsNotEmpty()
  address: string;
}

export class WhitelistResponse {
  @ApiProperty()
  isWhitelisted: boolean;

  @ApiProperty()
  address: string;
}

export class DBWhitelistParams extends AdminDto {
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  file: Express.Multer.File;
}

export class TextWhitelistParams extends AdminDto {
  @ApiProperty({ type: 'string', required: true })
  addresses: string;
}
