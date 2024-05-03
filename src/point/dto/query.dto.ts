import { ApiProperty } from '@nestjs/swagger';
import { AdminDto } from 'src/core/dto/admin.dto';

export class SetSeasonDto extends AdminDto {
  @ApiProperty({ required: true })
  start_time: string;

  @ApiProperty({ required: false })
  end_time?: string;

  @ApiProperty({ required: false })
  reset?: boolean;
}
