import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('affiliate_explicity_fee')
export class AffiliateExplicityFee {
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
  percent: string;

  @Column({ nullable: true, default: null })
  signature: string;

  toSignatureMessage(): string {
    // missing id and updated fields
    return `${this.affiliate}_${this.percent}`;
  }
}
