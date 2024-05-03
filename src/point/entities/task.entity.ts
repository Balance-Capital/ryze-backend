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
import { CreateTaskDto } from '../dto/create-task.dto';

@Entity('task')
export class Task {
  @ApiProperty()
  @PrimaryColumn('integer')
  id: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true, default: null })
  title: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true, default: null })
  description: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true, default: false })
  disabled: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  toDto(): CreateTaskDto {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
