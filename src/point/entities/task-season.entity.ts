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
import { CreateTaskSeasonDto } from '../dto/create-task-season.dto';

@Entity('task_season')
export class TaskSeason {
  @ApiProperty()
  @PrimaryGeneratedColumn('rowid')
  id: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  start_time: Date;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  end_time: Date;

  @Column({ nullable: true })
  last_updated_time: Date;

  @Column({ nullable: true, default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  toDto(): CreateTaskSeasonDto {
    return {
      id: this.id,
      start_time: this.start_time,
      end_time: this.end_time,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
