import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskTables1697639451561 implements MigrationInterface {
  name = 'CreateTaskTables1697639451561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "task_progress" ("id" character varying NOT NULL, "user" character varying NOT NULL, "task" integer, "tier" integer DEFAULT '0', "current_data" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d3a98edef96427df8adb5feb8e4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_season" ("id" SERIAL NOT NULL, "start_time" TIMESTAMP, "end_time" TIMESTAMP, "last_updated_time" TIMESTAMP, "isActive" boolean DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_720b804e2674bee2b0135848ef1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task" ("id" integer NOT NULL, "title" character varying, "description" character varying, "disabled" boolean DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fb213f79ee45060ba925ecd576e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_tier" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "task" integer NOT NULL DEFAULT '0', "tier" integer NOT NULL DEFAULT '0', "point" integer DEFAULT '0', "criteria" integer DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_156b3d2a6d006d85f92b713a7bf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "point" character varying DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "point"`);
    await queryRunner.query(`DROP TABLE "task_tier"`);
    await queryRunner.query(`DROP TABLE "task"`);
    await queryRunner.query(`DROP TABLE "task_season"`);
    await queryRunner.query(`DROP TABLE "task_progress"`);
  }
}
