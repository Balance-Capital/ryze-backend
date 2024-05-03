import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FetchNotificationsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  readonly skipExpiration?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly sortQuery?: string;
}
