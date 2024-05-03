import { ApiProperty } from '@nestjs/swagger';
import { DataProvider } from '../../core/enums/base.enum';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../core/utils/typeorm.util';

@Entity('ohlc')
@Index(['symbol', 'time', 'source'], { unique: true })
export class Ohlc {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id?: number;

  @ApiProperty({ description: 'Token Symbol' })
  @Column()
  symbol: string;

  @ApiProperty()
  @Column({ type: 'bigint' })
  time: number;

  @ApiProperty({ description: 'Data Provider', enum: DataProvider })
  @Column({ enum: DataProvider, type: 'enum' })
  source: DataProvider;

  @ApiProperty()
  @Column('numeric', {
    precision: 38,
    scale: 18,
    transformer: new ColumnNumericTransformer(),
    nullable: true,
    default: null,
  })
  open: number;

  @ApiProperty()
  @Column('numeric', {
    precision: 38,
    scale: 18,
    transformer: new ColumnNumericTransformer(),
    nullable: true,
    default: null,
  })
  high: number;

  @ApiProperty()
  @Column('numeric', {
    precision: 38,
    scale: 18,
    transformer: new ColumnNumericTransformer(),
    nullable: true,
    default: null,
  })
  low: number;

  @ApiProperty()
  @Column('numeric', {
    precision: 38,
    scale: 18,
    transformer: new ColumnNumericTransformer(),
    nullable: true,
    default: null,
  })
  close: number;

  @ApiProperty()
  @Column({ nullable: true, default: null })
  dataProviderStatuses: string;

  @Column({ nullable: true, default: null })
  signature: string;

  @ApiProperty()
  @Column({ default: false })
  isCloned: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
