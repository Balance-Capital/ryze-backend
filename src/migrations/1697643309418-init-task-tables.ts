import { POINT_PASSWORD_KEY } from 'src/core/constants/config.constant';
import { TASKS } from 'src/point/constants';
import { getSignature } from 'src/point/utils';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitTaskTables1697643309418 implements MigrationInterface {
  name = 'InitTaskTables1697643309418';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Init task table
    for (let i = 0; i < TASKS.length; i++) {
      const task = TASKS[i];
      await queryRunner.query(
        `INSERT INTO "task" ("id", "title") VALUES (${task.id}, '${task.title}')`,
      );
      for (let j = 0; j < task.tiers.length; j++) {
        const signature = getSignature(
          `${task.id}-${task.tiers[j].tier}-${task.tiers[j].point}-${task.tiers[j].criteria}`,
          POINT_PASSWORD_KEY,
        );
        await queryRunner.query(
          `INSERT INTO "task_tier" ("task", "tier", "point", "criteria", "signature") VALUES (${task.id}, ${task.tiers[j].tier}, ${task.tiers[j].point},${task.tiers[j].criteria},'${signature}')`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "task"`);
    await queryRunner.query(`DELETE FROM "task_tier"`);
  }
}
