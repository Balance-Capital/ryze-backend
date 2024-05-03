import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TIER } from '../utils';

@Entity('affiliate_tier')
export class AffiliateTier {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * address of user
   */
  @ApiProperty()
  @Column({ enum: TIER, type: 'enum' })
  tier: TIER;

  @ApiProperty()
  @Column()
  percent: string;

  @ApiProperty()
  @Column({ nullable: true, default: 0 })
  eligible_referee: number;

  @ApiProperty()
  @Column({ nullable: true, default: 0 })
  eligible_volume: number;

  @Column({ nullable: true, default: null })
  signature: string;

  toSignatureMessage(): string {
    // missing id and updated fields
    return `${this.tier}_${this.percent}_${this.eligible_referee}_${this.eligible_volume}`;
  }
}
