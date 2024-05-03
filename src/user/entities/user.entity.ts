import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';

@Entity('user')
export class User {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ nullable: true, default: null })
  @Index({ unique: true, where: '"referralId" IS NOT NULL' })
  referralId: string;

  @ApiProperty()
  @Column()
  address: string;

  @ApiProperty()
  @Column({ nullable: true, default: '0' })
  point: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  toDto(): CreateUserDto {
    return {
      id: this.id,
      referralId: this.referralId,
      address: this.address,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
