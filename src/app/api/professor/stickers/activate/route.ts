import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { STICKER_CATALOG } from "@/content/sticker-catalog.generated";
import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { PATENT_LADDER_VERSION, suggestedPatentLevels, SUPER_DEV_SCORE } from "@/lib/stickers";
import { assertSameOrigin, consumeRateLimit } from "@/lib/request-security";
import { requireCollectiblesSchema } from "@/lib/feature-readiness";

const input = z.object({
  slug: z.string(),
  teacherPassword: z.string().min(1),
  expectedTotalCopies: z.number().int(),
  expectedRarity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  expectedScore: z.number().int(),
  confirmed: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    await requireCollectiblesSchema();
    assertSameOrigin(request);
    await consumeRateLimit(`stickers:activate:${teacher.id}`, 20, 10 * 60_000);
    const body = input.parse(await request.json());
    if (!(await compare(body.teacherPassword, teacher.passwordHash))) {
      return NextResponse.json({ message: "Senha do professor incorreta." }, { status: 403 });
    }
    const manifest = STICKER_CATALOG.find(item => item.slug === body.slug);
    if (!manifest) return NextResponse.json({ message: "Figurinha não encontrada no manifesto publicado." }, { status: 404 });
    if (manifest.totalCopies !== body.expectedTotalCopies || manifest.rarity !== body.expectedRarity || manifest.score !== body.expectedScore) {
      return NextResponse.json({ message: "O manifesto mudou. Revise os valores e confirme novamente." }, { status: 409 });
    }
    const asset = new URL(manifest.imagePath, new URL(request.url).origin);
    const assetResponse = await fetch(asset, { method: "HEAD", cache: "no-store" });
    if (!assetResponse.ok) return NextResponse.json({ message: "O asset ainda não está acessível neste deploy." }, { status: 409 });
    const manifestHash = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.sticker.findUnique({ where: { slug: manifest.slug } });
      if (existing) {
        if (existing.manifestHash !== manifestHash) throw new Error("STICKER_CONFLICT");
        return { sticker: existing, created: false };
      }
      const collection = await tx.stickerCollection.upsert({
        where: { slug: manifest.collectionSlug },
        create: { slug: manifest.collectionSlug, name: manifest.collectionName, state: "ACTIVE", activatedAt: new Date() },
        update: {},
      });
      const sticker = await tx.sticker.create({
        data: {
          collectionId: collection.id, number: manifest.number, slug: manifest.slug,
          name: manifest.name, description: manifest.description, alt: manifest.alt,
          imagePath: manifest.imagePath, manifestHash, totalCopies: manifest.totalCopies,
          rarity: manifest.rarity, score: manifest.score, state: "PUBLISHED", publishedAt: new Date(),
        },
      });
      await tx.stickerCopy.createMany({ data: Array.from({ length: manifest.totalCopies }, (_, index) => ({ stickerId: sticker.id, serial: index + 1 })) });
      if ((await tx.patentLevel.count({ where: { collectionId: collection.id, version: PATENT_LADDER_VERSION } })) === 0) {
        await tx.patentLevel.createMany({ data: suggestedPatentLevels(SUPER_DEV_SCORE).map(level => ({ ...level, collectionId: collection.id, version: PATENT_LADDER_VERSION })) });
      }
      await tx.auditLog.create({ data: { actorId: teacher.id, event: "STICKER_ACTIVATED", details: { stickerId: sticker.id, slug: manifest.slug, totalCopies: manifest.totalCopies, rarity: manifest.rarity, score: manifest.score, manifestHash, assetHash: manifest.sha256 } } });
      return { sticker, created: true };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Revise os valores e a confirmação." }, { status: 400 });
    if (error instanceof Error && error.message === "STICKER_CONFLICT") return NextResponse.json({ message: "O slug já existe com outro manifesto." }, { status: 409 });
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
