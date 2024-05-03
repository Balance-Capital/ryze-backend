import { MigrationInterface, QueryRunner } from 'typeorm';

export class addOkxToOhlc1691417640620 implements MigrationInterface {
  name = 'addOkxToOhlc1691417640620';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1f22a411485a4f15c0e9e91239"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ohlc_source_enum" RENAME TO "ohlc_source_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ohlc_source_enum" AS ENUM('DEFAULT', 'BINANCE', 'KRAKEN', 'COINBASE', 'OKX', 'CHAINLINK')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ohlc" ALTER COLUMN "source" TYPE "public"."ohlc_source_enum" USING "source"::"text"::"public"."ohlc_source_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ohlc_source_enum_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1f22a411485a4f15c0e9e91239" ON "ohlc" ("symbol", "time", "source") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1f22a411485a4f15c0e9e91239"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ohlc_source_enum_old" AS ENUM('DEFAULT', 'BINANCE', 'KRAKEN', 'COINBASE', 'CHAINLINK')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ohlc" ALTER COLUMN "source" TYPE "public"."ohlc_source_enum_old" USING "source"::"text"::"public"."ohlc_source_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ohlc_source_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."ohlc_source_enum_old" RENAME TO "ohlc_source_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1f22a411485a4f15c0e9e91239" ON "ohlc" ("symbol", "time", "source") `,
    );
  }
}
