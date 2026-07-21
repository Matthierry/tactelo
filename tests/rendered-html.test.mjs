import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("admin access requires a valid password and secure session cookie", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("admin-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    TACTELO_ADMIN_KEY: "test-only-admin-password",
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const denied = await worker.fetch(new Request("http://localhost/api/admin/import", { method: "POST" }), env, ctx);
  assert.equal(denied.status, 401);

  const wrongLogin = await worker.fetch(new Request("http://localhost/api/admin/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "wrong" }),
  }), env, ctx);
  assert.equal(wrongLogin.status, 401);

  const login = await worker.fetch(new Request("http://localhost/api/admin/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: env.TACTELO_ADMIN_KEY }),
  }), env, ctx);
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie ?? "", /tactelo_admin_session=/);
  assert.match(cookie ?? "", /HttpOnly/);
  assert.match(cookie ?? "", /SameSite=Strict/);

  const status = await worker.fetch(new Request("http://localhost/api/admin/auth", { headers: { cookie } }), env, ctx);
  assert.deepEqual(await status.json(), { authenticated: true });

  const authorised = await worker.fetch(new Request("http://localhost/api/admin/import", { method: "POST", headers: { cookie } }), env, ctx);
  assert.equal(authorised.status, 503);
});
