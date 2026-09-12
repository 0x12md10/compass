import { redirect } from "next/navigation";

/** Landing became the app's root (`/`) — kept as a redirect so an old
 * bookmark or link to `/landing` doesn't 404. */
export default function LandingRedirect() {
  redirect("/");
}
