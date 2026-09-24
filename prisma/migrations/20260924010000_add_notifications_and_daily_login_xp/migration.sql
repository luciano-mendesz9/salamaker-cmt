ALTER TYPE "AuditEvent" ADD VALUE 'NOTIFICATION_CREATED';

CREATE TYPE "NotificationKind" AS ENUM ('POPUP', 'INBOX');

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "linkPath" TEXT,
  "authorId" UUID,
  "activityId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_popup_expiration_check" CHECK ("kind" <> 'POPUP' OR "expiresAt" IS NOT NULL)
);

CREATE TABLE "NotificationReceipt" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "lastPopupShownAt" TIMESTAMP(3),
  CONSTRAINT "NotificationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_kind_expiresAt_createdAt_idx" ON "Notification"("kind", "expiresAt", "createdAt");
CREATE INDEX "Notification_activityId_kind_idx" ON "Notification"("activityId", "kind");
CREATE UNIQUE INDEX "NotificationReceipt_notificationId_studentId_key" ON "NotificationReceipt"("notificationId", "studentId");
CREATE INDEX "NotificationReceipt_studentId_readAt_idx" ON "NotificationReceipt"("studentId", "readAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationReceipt" ADD CONSTRAINT "NotificationReceipt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationReceipt" ADD CONSTRAINT "NotificationReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
