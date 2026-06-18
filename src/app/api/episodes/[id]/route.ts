import { NextResponse } from "next/server";
import { getEpisode } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const episode = await getEpisode(id);
  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }
  return NextResponse.json({ episode });
}
