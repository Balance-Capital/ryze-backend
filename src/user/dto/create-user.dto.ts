import { ApiProperty } from '@nestjs/swagger';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import {
  IsEthereumAddress,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  // this is generated in database
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  readonly id?: string;

  // this is generated on backend, its user's referralId
  @ApiProperty({ required: false })
  referralId?: string;

  // this is coming from frontend, its referral user's referralId
  @ApiProperty({ required: false })
  referralCode?: string;

  @ApiProperty()
  @IsEthereumAddress()
  address: string;

  @ApiProperty()
  @IsOptional()
  point?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt?: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt?: Date;
}
