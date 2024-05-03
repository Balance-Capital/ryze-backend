import { ApiProperty } from '@nestjs/swagger';

export class AdminDto {
  @ApiProperty()
  password_encrypted: string;
}
