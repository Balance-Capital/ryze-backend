import { MigrationInterface, QueryRunner } from 'typeorm';

export class createTableAdminFeeTiers1691782938326
  implements MigrationInterface
{
  name = 'createTableAdminFeeTiers1691782938326';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "affiliate_explicity_fee" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "affiliate" character varying NOT NULL, "percent" character varying NOT NULL, "signature" character varying, CONSTRAINT "PK_a816df553d24ed2b80c180c9202" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_tier_tier_enum" AS ENUM('1', '2', '3')`,
    );
    await queryRunner.query(
      `CREATE TABLE "affiliate_tier" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tier" "public"."affiliate_tier_tier_enum" NOT NULL, "percent" character varying NOT NULL, "signature" character varying, CONSTRAINT "PK_0c97eb3be6880a2e3d943ee7f2c" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "affiliate_tier"`);
    await queryRunner.query(`DROP TYPE "public"."affiliate_tier_tier_enum"`);
    await queryRunner.query(`DROP TABLE "affiliate_explicity_fee"`);
  }
}
