import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CreateTaskDto } from '../dto/create-task.dto';
import { CreateTaskTierDto } from '../dto/create-task-tier.dto';

@Entity('task_tier')
export class TaskTier {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: true })
  @Column({ nullable: false, default: 0 })
  task: number;

  @ApiProperty({ required: true })
  @Column({ nullable: false, default: 0 })
  tier: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true, default: 0 })
  point: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true, default: 0 })
  criteria: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true, default: null })
  signature: string;

  toDto(): CreateTaskTierDto {
    return {
      task: this.task,
      tier: this.tier,
      point: this.point,
      criteria: this.criteria,
    };
  }

  toSignatureMessage(): string {
    return `${this.task}-${this.tier}-${this.point}-${this.criteria}`;
  }
}
