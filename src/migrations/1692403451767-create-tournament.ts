import { MigrationInterface, QueryRunner } from 'typeorm';

export class createTournament1692403451767 implements MigrationInterface {
  name = 'createTournament1692403451767';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tournament" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "start_time" TIMESTAMP NOT NULL, "duration" integer NOT NULL DEFAULT '1209600', "rewardAmount" integer NOT NULL DEFAULT '0', "winner" character varying(42) NOT NULL DEFAULT '0x0000000000000000000000000000000000000000', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "signature" character varying, CONSTRAINT "PK_449f912ba2b62be003f0c22e767" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament"`);
  }
}
