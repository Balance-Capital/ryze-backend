import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUpdatedatAffiliate1701030319728 implements MigrationInterface {
  name = 'AddUpdatedatAffiliate1701030319728';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affiliate" ADD "updatedAt" TIMESTAMP DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "affiliate" DROP COLUMN "updatedAt"`);
  }
}
