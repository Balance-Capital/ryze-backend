import { ApiProperty } from '@nestjs/swagger';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import {
  IsEthereumAddress,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateTaskProgressDto {
  // this is generated in database
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  readonly id?: string;

  @ApiProperty({ required: false })
  user: string;

  @ApiProperty({ required: false })
  task: number;

  @ApiProperty({ required: false })
  tier: number;

  @ApiProperty({ required: false })
  current_data?: string;

  @ApiProperty({ required: false })
  signature?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt?: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt?: Date;
}
