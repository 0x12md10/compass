import { readFile } from "node:fs/promises";
import path from "node:path";

/** The marketing page is the app's default entry point (root `/`). It's a
 * single self-contained HTML file (GSAP animation, inline CSS/JS — see the
 * `landing` skill) rather than a React page, so it stays visually
 * independent from the app shell used by the dashboard/compass routes.
 * Reads the static file out of `public/` so it's still just a plain asset
 * on disk, not templated. */
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "landing.html");
  const html = await readFile(filePath, "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
