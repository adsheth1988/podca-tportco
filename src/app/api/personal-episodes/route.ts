import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPersonalEpisodes } from "@/lib/db/personalEpisodes";

// Session-scoped mirror of GET /api/episodes (the public QQQ show) — see
// src/app/api/episodes/route.ts. Strips the script field to keep the list
// payload small, same as the public list endpoint.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const episodes = await listPersonalEpisodes(session.user.id);
  return NextResponse.json({
    episodes: episodes.map((ep) => ({ ...ep, script: null })),
  });
}
