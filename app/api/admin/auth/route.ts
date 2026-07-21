import { adminCookie, createAdminSession, validAdminPassword, validAdminSession } from "../../../lib/admin-auth";
import { getRuntimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ authenticated: await validAdminSession(request) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!getRuntimeEnv().TACTELO_ADMIN_KEY) {
    return Response.json({ error: "Admin access is not configured" }, { status: 503 });
  }
  let password = "";
  try { password = ((await request.json()) as { password?: string }).password ?? ""; } catch { /* Invalid bodies fail authentication. */ }
  if (!(await validAdminPassword(password))) {
    return Response.json({ error: "The admin password is incorrect" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const token = await createAdminSession(getRuntimeEnv().TACTELO_ADMIN_KEY!);
  return Response.json({ authenticated: true }, { headers: { "Set-Cookie": adminCookie(token, request), "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  return Response.json({ authenticated: false }, { headers: { "Set-Cookie": adminCookie("", request, 0), "Cache-Control": "no-store" } });
}
