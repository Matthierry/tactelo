import { getRuntimeEnv } from "../../lib/runtime-env";

type AuthPayload = {
  mode?: "login" | "register";
  email?: string;
  password?: string;
  displayName?: string;
};

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  return new Uint8Array(value.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

async function passwordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: 120_000 }, key, 256);
  return hex(new Uint8Array(bits));
}

function cookie(token: string, maxAge: number, secure: boolean) {
  return `tactelo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function POST(request: Request) {
  let payload: AuthPayload;
  try { payload = await request.json() as AuthPayload; } catch { return Response.json({ error: "Invalid account request" }, { status: 400 }); }
  const mode = payload.mode === "register" ? "register" : "login";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const displayName = payload.displayName?.trim() || email.split("@")[0];
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || (mode === "register" && !displayName)) {
    return Response.json({ error: "Enter valid account details. Passwords need at least six characters." }, { status: 400 });
  }

  const env = getRuntimeEnv();
  const maxAge = 60 * 60 * 24 * 30;
  const secure = new URL(request.url).protocol === "https:";
  if (!env.DB) {
    const demoToken = `demo-${encodeURIComponent(email)}`;
    return Response.json({ email, displayName }, { headers: { "Set-Cookie": cookie(demoToken, maxAge, secure) } });
  }

  try {
    const existing = await env.DB.prepare("SELECT id, email, display_name, password_hash, password_salt FROM users WHERE email = ? LIMIT 1")
      .bind(email).first<{ id: string; email: string; display_name: string; password_hash: string; password_salt: string }>();
    let userId = existing?.id;
    const resolvedName = existing?.display_name ?? displayName;

    if (mode === "register") {
      if (existing) return Response.json({ error: "An account already exists for this email. Log in instead." }, { status: 409 });
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await passwordHash(password, salt);
      userId = `user-${crypto.randomUUID()}`;
      await env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(userId, email, displayName, hash, hex(salt), new Date().toISOString()).run();
    } else {
      if (!existing) return Response.json({ error: "No account was found for this email. Create one to continue." }, { status: 401 });
      const hash = await passwordHash(password, fromHex(existing.password_salt));
      if (hash !== existing.password_hash) return Response.json({ error: "The email or password is incorrect." }, { status: 401 });
    }

    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + maxAge * 1000).toISOString();
    await env.DB.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(token, userId, now.toISOString(), expiresAt).run();
    return Response.json({ email, displayName: resolvedName }, { headers: { "Set-Cookie": cookie(token, maxAge, secure) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    if (message.includes("no such table")) {
      const demoToken = `demo-${encodeURIComponent(email)}`;
      return Response.json({ email, displayName }, { headers: { "Set-Cookie": cookie(demoToken, maxAge, secure) } });
    }
    return Response.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie("", 0, new URL(request.url).protocol === "https:") } });
}
