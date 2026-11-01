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
    ids: ids.refine((value) => new Set(value).size === value.length),
    amount: z.number().int().min(-10_000).max(10_000).refine((amount) => amount !== 0),
    reason,
    adminPassword,
    requestId: z.string().uuid(),
  }),
  z.object({ action: z.literal("ARCHIVE"), ids, adminPassword }),
]);
