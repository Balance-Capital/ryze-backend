import { ApiProperty } from '@nestjs/swagger';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateTaskTierDto {
  // this is generated in database
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  readonly id?: string;

  @ApiProperty({ required: true })
  task: number;

  @ApiProperty({ required: true })
  tier: number;

  @ApiProperty({ required: false })
  point: number;

  @ApiProperty({ required: false })
  criteria: number;

  @ApiProperty({ required: false })
  signature?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt?: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt?: Date;
}
