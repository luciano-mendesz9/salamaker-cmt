import { z } from "zod";

const ids = z.array(z.string().uuid()).min(1).max(100);
const reason = z.string().trim().min(3).max(160);
const adminPassword = z.string();

export const studentBulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("XP"),
    ids,
    amount: z.number().int().min(-10_000).max(10_000).refine((amount) => amount !== 0),
    reason,
    adminPassword,
  }),
  z.object({
    action: z.literal("DEV_COINS"),
    ids,
    amount: z.number().int().min(1).max(10_000),
    reason,
    adminPassword,
  }),
  z.object({ action: z.literal("ARCHIVE"), ids, adminPassword }),
]);
