import { MigrationInterface, QueryRunner } from 'typeorm';

export class initTable1678825622752 implements MigrationInterface {
  name = 'initTable1678825622752';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chat" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user" character varying NOT NULL, "text" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9d0b2ba74336710fd31154738a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_importance_enum" AS ENUM('HIGH', 'MEDIUM', 'LOW')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "importance" "public"."notification_importance_enum" NOT NULL, "message" character varying NOT NULL, "expirationAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ohlc_source_enum" AS ENUM('DEFAULT', 'BINANCE', 'KRAKEN', 'COINBASE', 'CHAINLINK')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ohlc" ("id" SERIAL NOT NULL, "symbol" character varying NOT NULL, "time" bigint NOT NULL, "source" "public"."ohlc_source_enum" NOT NULL, "open" numeric(38,18), "high" numeric(38,18), "low" numeric(38,18), "close" numeric(38,18), "volume" numeric(38,18), "dataProviderStatuses" character varying, "signature" character varying, "isCloned" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_dcc5e797a8716fea0b67a85a2a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1f22a411485a4f15c0e9e91239" ON "ohlc" ("symbol", "time", "source") `,
    );
    await queryRunner.query(
      `CREATE TABLE "system_info" ("id" SERIAL NOT NULL, "setting" character varying NOT NULL, CONSTRAINT "PK_b0c31720cc7fe00ce9116ac7606" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "system_info"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1f22a411485a4f15c0e9e91239"`,
    );
    await queryRunner.query(`DROP TABLE "ohlc"`);
    await queryRunner.query(`DROP TYPE "public"."ohlc_source_enum"`);
    await queryRunner.query(`DROP TABLE "notification"`);
    await queryRunner.query(
      `DROP TYPE "public"."notification_importance_enum"`,
    );
    await queryRunner.query(`DROP TABLE "chat"`);
  }
}
