import { readFile } from "node:fs/promises";
import path from "node:path";

/** The marketing page is a single self-contained HTML file (GSAP animation,
 * inline CSS/JS — see the `landing` skill) rather than a React page, so it
 * stays visually independent from the app shell used everywhere else.
 * Served at exactly `/landing` per v3/SCOPE.md's decision, reading the
 * static file out of `public/` so it's still just a plain asset on disk. */
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "landing.html");
  const html = await readFile(filePath, "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
