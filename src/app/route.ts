import fs from "fs/promises";
import path from "path";

const BUNDLE_PATH = path.join(process.cwd(), "public", "the-portfolio-podcast.html");

export async function GET() {
  const html = await fs.readFile(BUNDLE_PATH, "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
