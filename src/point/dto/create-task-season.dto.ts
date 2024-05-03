import { ApiProperty } from '@nestjs/swagger';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateTaskSeasonDto {
  // this is generated in database
  @ApiProperty({ required: false })
  @IsOptional()
  readonly id?: string;

  @ApiProperty({ required: false })
  start_time?: Date;

  @ApiProperty({ required: false })
  end_time?: Date;

  @ApiProperty({ required: false })
  isActive?: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt?: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt?: Date;
}
