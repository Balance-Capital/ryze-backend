import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignaturePoint1697639451661 implements MigrationInterface {
  name = 'AddSignaturePoint1697639451661';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_tier" ADD "signature" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_progress" ADD "signature" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_progress" DROP COLUMN "signature"`,
    );
    await queryRunner.query(`ALTER TABLE "task_tier" DROP COLUMN "signature"`);
  }
}
