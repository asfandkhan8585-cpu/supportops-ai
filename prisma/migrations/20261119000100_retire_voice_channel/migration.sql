ALTER TABLE "Settings"
  ALTER COLUMN "businessName" SET DEFAULT 'NovaCart',
  DROP COLUMN "elevenLabsKey",
  DROP COLUMN "elevenLabsVoice";

DELETE FROM "Channel" WHERE "type" = 'phone';
