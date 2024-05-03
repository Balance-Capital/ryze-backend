import { MigrationInterface, QueryRunner } from 'typeorm';

export class addWhitelistTable1691609175303 implements MigrationInterface {
  name = 'addWhitelistTable1691609175303';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "whitelist" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "address" character varying(42) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_0169bfbd49b0511243f7a068cec" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "whitelist"`);
  }
}
