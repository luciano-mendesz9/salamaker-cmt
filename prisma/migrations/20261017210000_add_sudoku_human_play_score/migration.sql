ALTER TABLE "SudokuGame"
ADD COLUMN "humanPlayScore" INTEGER,
ADD COLUMN "humanPlaySignals" JSONB;

ALTER TABLE "SudokuGame"
ADD CONSTRAINT "SudokuGame_humanPlayScore_range"
CHECK ("humanPlayScore" IS NULL OR ("humanPlayScore" >= 0 AND "humanPlayScore" <= 100));
