import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateFieldName1693604102428 implements MigrationInterface {
  name = 'UpdateFieldName1693604102428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affiliate" RENAME COLUMN "isQualified" TO "is_qualified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "lastTierUpdatedAt" TO "last_tier_updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "currentTier" TO "current_tier"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_fee_currenttier_enum" RENAME TO "affiliate_fee_current_tier_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "totalReferredVolume" TO "total_referred_volume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" RENAME COLUMN "eligibleVolume" TO "eligible_volume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" RENAME COLUMN "eligibleReferee" TO "eligible_referee"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" RENAME COLUMN "eligible_volume" TO "eligibleVolume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_tier" RENAME COLUMN "eligible_referee" TO "eligibleReferee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "total_referred_volume" TO "totalReferredVolume"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_fee_current_tier_enum" RENAME TO "affiliate_fee_currenttier_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "current_tier" TO "currentTier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_fee" RENAME COLUMN "last_tier_updated_at" TO "lastTierUpdatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate" RENAME COLUMN "is_qualified" TO "isQualified"`,
    );
  }
}
