-- Rebalance every active collection onto the same versioned global ladder.
-- Existing rewards and XP history stay untouched. Each student's bestRank is
-- moved to the rank matching their current distinct-sticker score, so only a
-- future promotion can issue a reward from version 2.
-- Legacy thresholds are retired (instead of deleting their levels) so the
-- currently deployed rank selector cannot choose a version-1 Super Dev after
-- this data migration but before the application code is published.
UPDATE "PatentLevel"
SET "threshold" = 2000000 + "rank"
WHERE "version" < 2;

WITH levels("rank", "name", "threshold", "xpReward", "devCoinReward", "packReward") AS (
  VALUES
    (1, 'Bronze I', 0, 0, 0, 0),
    (2, 'Bronze II', 40, 10, 15, 0),
    (3, 'Bronze III', 100, 10, 15, 0),
    (4, 'Prata I', 160, 25, 40, 1),
    (5, 'Prata II', 240, 10, 15, 0),
    (6, 'Prata III', 320, 10, 15, 0),
    (7, 'Ouro I', 420, 25, 40, 1),
    (8, 'Ouro II', 520, 10, 15, 0),
    (9, 'Ouro III', 620, 10, 15, 0),
    (10, 'Ouro IV', 720, 10, 15, 0),
    (11, 'Platina I', 840, 25, 40, 1),
    (12, 'Platina II', 960, 10, 15, 0),
    (13, 'Platina III', 1080, 10, 15, 0),
    (14, 'Platina IV', 1200, 10, 15, 0),
    (15, 'Diamante I', 1320, 25, 40, 1),
    (16, 'Diamante II', 1420, 10, 15, 0),
    (17, 'Diamante III', 1520, 10, 15, 0),
    (18, 'Diamante IV', 1620, 10, 15, 0),
    (19, 'Diamante V', 1720, 10, 15, 0),
    (20, 'Mestre I', 1800, 25, 40, 1),
    (21, 'Mestre II', 1860, 10, 15, 0),
    (22, 'Mestre III', 1920, 10, 15, 0),
    (23, 'Super Dev', 2000, 50, 100, 0)
)
INSERT INTO "PatentLevel" (
  "id", "collectionId", "version", "rank", "name", "threshold", "xpReward", "devCoinReward", "packReward"
)
SELECT gen_random_uuid(), collection."id", 2, levels."rank", levels."name", levels."threshold",
       levels."xpReward", levels."devCoinReward", levels."packReward"
FROM "StickerCollection" collection
CROSS JOIN levels
WHERE collection."state" = 'ACTIVE'
ON CONFLICT ("collectionId", "version", "rank") DO NOTHING;

WITH canonical_collection AS (
  SELECT MIN("id"::text)::uuid AS "id"
  FROM "StickerCollection"
  WHERE "state" = 'ACTIVE'
),
student_scores AS (
  SELECT student."id" AS "studentId", COALESCE(SUM(sticker."score"), 0)::integer AS "score"
  FROM "User" student
  LEFT JOIN (
    SELECT DISTINCT copy."ownerId", copy."stickerId"
    FROM "StickerCopy" copy
    WHERE copy."state" IN ('OWNED', 'ESCROW') AND copy."ownerId" IS NOT NULL
  ) owned ON owned."ownerId" = student."id"
  LEFT JOIN "Sticker" sticker ON sticker."id" = owned."stickerId"
  WHERE student."role" = 'STUDENT' AND student."status" = 'ACTIVE'
  GROUP BY student."id"
),
placement AS (
  SELECT scores."studentId", scores."score", level."id" AS "levelId", level."rank"
  FROM student_scores scores
  CROSS JOIN canonical_collection canonical
  JOIN LATERAL (
    SELECT patent."id", patent."rank"
    FROM "PatentLevel" patent
    WHERE patent."collectionId" = canonical."id"
      AND patent."version" = 2
      AND patent."threshold" <= scores."score"
    ORDER BY patent."rank" DESC
    LIMIT 1
  ) level ON TRUE
)
INSERT INTO "StudentPatentProgress" ("id", "studentId", "score", "levelId", "bestRank", "updatedAt")
SELECT gen_random_uuid(), placement."studentId", placement."score", placement."levelId", placement."rank", CURRENT_TIMESTAMP
FROM placement
ON CONFLICT ("studentId") DO UPDATE SET
  "score" = EXCLUDED."score",
  "levelId" = EXCLUDED."levelId",
  "bestRank" = EXCLUDED."bestRank",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AuditLog" ("id", "event", "details")
VALUES (
  gen_random_uuid(),
  'MODERATION_CHANGED',
  jsonb_build_object(
    'operation', 'PATENT_LADDER_REBALANCED',
    'version', 2,
    'superDevThreshold', 2000,
    'historyPreserved', true
  )
);
