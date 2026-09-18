-- AlterTable
ALTER TABLE "AnalyticsConnection" ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "propertyName" TEXT;
