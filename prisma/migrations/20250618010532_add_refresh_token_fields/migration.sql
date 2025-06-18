-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refresh_token" VARCHAR(64),
ADD COLUMN     "refresh_token_exp" TIMESTAMPTZ(6);
