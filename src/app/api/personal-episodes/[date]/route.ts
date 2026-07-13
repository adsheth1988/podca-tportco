import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonalEpisode } from "@/lib/db/personalEpisodes";

// Session-scoped mirror of GET /api/episodes/[id] — see
// src/app/api/episodes/[id]/route.ts. Returns the full episode, including
// script, for the signed-in user only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { date } = await params;
  const episode = await getPersonalEpisode(session.user.id, date);
  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }
  return NextResponse.json({ episode });
}
