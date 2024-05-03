import { MigrationInterface, QueryRunner } from 'typeorm';

export class addTotalreferredVolume1691539495301 implements MigrationInterface {
  name = 'addTotalreferredVolume1691539495301';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "currency" TO "totalReferredVolume"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "totalReferredVolume" TO "currency"`,
    );
  }
}
