import { ApiProperty } from '@nestjs/swagger';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class CreateTaskDto {
  // this is generated in database
  @ApiProperty({ required: true })
  id?: number;

  @ApiProperty({ required: false })
  type?: number;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  description: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt?: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt?: Date;
}
