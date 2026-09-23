ALTER TABLE "Lesson" ADD COLUMN "openSlot" TEXT;
CREATE UNIQUE INDEX "Lesson_openSlot_key" ON "Lesson"("openSlot");
