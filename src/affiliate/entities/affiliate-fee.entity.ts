import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TIER } from '../utils';

@Entity('affiliate_fee')
export class AffiliateFee {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * address of user
   */
  @ApiProperty()
  @Column()
  affiliate: string;

  @ApiProperty()
  @Column()
  fee: string;

  @ApiProperty()
  @Column({ nullable: true, default: '0' })
  total_referred_volume: string;

  @ApiProperty()
  @Column({ enum: TIER, type: 'enum', default: TIER.Bronze })
  current_tier: TIER;

  @ApiProperty()
  @Column({ nullable: true, default: null })
  last_tier_updated_at: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true, default: null })
  signature: string;

  toSignatureMessage(): string {
    // missing id and updated fields
    return `${this.affiliate}_${this.fee}_${this.total_referred_volume}_${this.current_tier}_${this.last_tier_updated_at}`;
  }
}
