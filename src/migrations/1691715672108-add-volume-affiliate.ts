import { MigrationInterface, QueryRunner } from 'typeorm';

export class addVolumeAffiliate1691715672108 implements MigrationInterface {
  name = 'addVolumeAffiliate1691715672108';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affiliate" ADD "isQualified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate" ADD "volume" character varying NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "affiliate" DROP COLUMN "volume"`);
    await queryRunner.query(
      `ALTER TABLE "affiliate" DROP COLUMN "isQualified"`,
    );
  }
}
