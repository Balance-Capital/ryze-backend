import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import { AffiliateDto } from '../dto/affiliate.dto';

@Entity('affiliate')
export class Affiliate {
  @ApiProperty()
  @PrimaryColumn()
  user: string;

  /**
   * address, referred by
   */
  @ApiProperty()
  @Column()
  affiliate: string;

  @Column({
    default: false,
  })
  is_qualified: boolean;

  @Column({
    default: '0',
  })
  volume: string;

  @CreateDateColumn()
  createdAt!: Date;

  @CreateDateColumn({
    nullable: true,
  })
  updatedAt!: Date;

  toDto(): AffiliateDto {
    return {
      user: this.user,
      affiliate: this.affiliate,
      is_qualified: this.is_qualified,
      volume: this.volume,
    };
  }
}
