import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CreateTaskProgressDto } from '../dto/create-task-progress.dto';

@Entity('task_progress')
export class TaskProgress {
  @ApiProperty()
  @PrimaryColumn()
  id: string;

  @ApiProperty({ required: false })
  @Column({ nullable: false, default: null })
  user: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true, default: null })
  task: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true, default: 0 })
  tier: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  current_data: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true, default: null })
  signature: string;

  toDto(): CreateTaskProgressDto {
    return {
      id: this.id,
      user: this.user,
      task: this.task,
      tier: this.tier,
      current_data: this.current_data,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toSignatureMessage(): string {
    return `${this.user}-${this.task}-${this.tier}-${this.current_data}`;
  }
}
