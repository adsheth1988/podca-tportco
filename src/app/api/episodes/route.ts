import { NextResponse } from "next/server";
import { listEpisodes } from "@/lib/storage";

export async function GET() {
  try {
    const episodes = await listEpisodes();
    return NextResponse.json({ episodes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
