import { clearSessionCookie, endCurrentSession } from "@/lib/auth";
import { json } from "@/lib/api";

export async function POST() {
  await endCurrentSession();
  await clearSessionCookie();
  return json({ ok: true });
}
