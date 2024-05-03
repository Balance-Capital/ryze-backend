import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('system_info')
export class SystemInfo {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id?: number;

  @ApiProperty({ description: 'Json String for Backend Setting' })
  @Column()
  setting: string;
}
