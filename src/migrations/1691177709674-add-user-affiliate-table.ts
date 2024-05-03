import { MigrationInterface, QueryRunner } from 'typeorm';

export class addUserAffiliateTable1691177709674 implements MigrationInterface {
  name = 'addUserAffiliateTable1691177709674';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "affiliate_fee" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "affiliate" character varying NOT NULL, "currency" character varying NOT NULL, "fee" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "signature" character varying, CONSTRAINT "PK_65c3ffb568e7512f0ad539cdb13" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "affiliate" ("user" character varying NOT NULL, "affiliate" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_68e339a2b1409df86bdda55a00b" PRIMARY KEY ("user"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referralId" character varying, "address" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e8bb7f7006e3589b65d1eb6529" ON "user" ("referralId") WHERE "referralId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e8bb7f7006e3589b65d1eb6529"`,
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "affiliate"`);
    await queryRunner.query(`DROP TABLE "affiliate_fee"`);
  }
}
