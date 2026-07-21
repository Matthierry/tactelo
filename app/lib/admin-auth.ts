import { getRuntimeEnv } from "./runtime-env";

const COOKIE_NAME = "tactelo_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

async function secretsMatch(supplied: string, expected: string) {
  const [left, right] = await Promise.all([digest(supplied), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function cookieValue(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  return cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) ?? "";
}

export async function createAdminSession(secret: string) {
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_SECONDS}.${crypto.randomUUID()}`;
  return `${payload}.${await signature(payload, secret)}`;
}

export async function validAdminSession(request: Request) {
  const secret = getRuntimeEnv().TACTELO_ADMIN_KEY;
  if (!secret) return false;
  const token = cookieValue(request);
  const split = token.lastIndexOf(".");
  if (split < 1) return false;
  const payload = token.slice(0, split);
  const suppliedSignature = token.slice(split + 1);
  const expires = Number(payload.split(".", 1)[0]);
  if (!Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  return secretsMatch(suppliedSignature, await signature(payload, secret));
}

export async function validAdminPassword(password: string) {
  const expected = getRuntimeEnv().TACTELO_ADMIN_KEY;
  return Boolean(expected && password && await secretsMatch(password, expected));
}

export async function authorisedAdminRequest(request: Request) {
  if (await validAdminSession(request)) return true;
  const expected = getRuntimeEnv().TACTELO_ADMIN_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(expected && bearer && await secretsMatch(bearer, expected));
}

export function adminCookie(token: string, request: Request, maxAge = SESSION_SECONDS) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
