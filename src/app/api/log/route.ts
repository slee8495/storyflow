import { NextRequest, NextResponse } from "next/server";

// Playback diagnostics from the iPhone and Apple Watch apps (ios/Shared/StoryflowAPI.swift `log`).
// Each event is printed as one JSON line so it shows up in `vercel logs --query storyflow-log
// --expand`. Added 2026-11-13 while chasing "after a long pause, play from the watch makes no
// sound": the phone's own system log needs root on the Mac, these don't.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.event !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  const { device, event, detail } = body as { device?: string; event: string; detail?: string };
  console.log(
    JSON.stringify({
      tag: "storyflow-log",
      device: String(device ?? "?").slice(0, 16),
      event: event.slice(0, 64),
      detail: String(detail ?? "").slice(0, 500),
    }),
  );
  return NextResponse.json({ ok: true });
}
