import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { readers } from "@/db/schema";

// Claims (or creates) a reader identity by name — the entire "login" mechanism for this personal,
// single-user app (see docs/project-context.md: no OAuth, no password). Idempotent: calling again
// with the same name just returns the existing row, which is what lets a reader re-enter their
// name on a different device and resume exactly where they left off.
export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({ name: null }));
  const trimmed = typeof name === "string" ? name.trim().slice(0, 64) : "";
  if (!trimmed) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [existing] = await db.select().from(readers).where(eq(readers.name, trimmed)).limit(1);
  if (existing) {
    return NextResponse.json({ reader: existing });
  }

  const [created] = await db.insert(readers).values({ name: trimmed }).returning();
  return NextResponse.json({ reader: created });
}
