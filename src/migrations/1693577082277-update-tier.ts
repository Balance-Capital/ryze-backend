import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTier1693577082277 implements MigrationInterface {
  name = 'UpdateTier1693577082277';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "affiliate_tier"`);
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" ADD "eligibleReferee" integer DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" ADD "eligibleVolume" integer DEFAULT '0'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_fee_currenttier_enum" AS ENUM('1', '2', '3', '4', '5')`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" ADD "currentTier" "public"."affiliate_fee_currenttier_enum" NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" ADD "lastTierUpdatedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_tier_tier_enum" RENAME TO "affiliate_tier_tier_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_tier_tier_enum" AS ENUM('1', '2', '3', '4', '5')`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" ALTER COLUMN "tier" TYPE "public"."affiliate_tier_tier_enum" USING "tier"::"text"::"public"."affiliate_tier_tier_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."affiliate_tier_tier_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "affiliate_tier"`);
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_tier_tier_enum_old" AS ENUM('1', '2', '3')`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" ALTER COLUMN "tier" TYPE "public"."affiliate_tier_tier_enum_old" USING "tier"::"text"::"public"."affiliate_tier_tier_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."affiliate_tier_tier_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_tier_tier_enum_old" RENAME TO "affiliate_tier_tier_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" DROP COLUMN "lastTierUpdatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" DROP COLUMN "currentTier"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."affiliate_fee_currenttier_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" DROP COLUMN "eligibleVolume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" DROP COLUMN "eligibleReferee"`,
    );
  }
}
