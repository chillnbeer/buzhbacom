import { DEFAULT_STATE } from "../../../v2/admin/data/default-state.js";
import { isAdminRequest } from "../../_auth.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers || {}) }
  });
}

async function authorized(request, env) {
  const token = env.ADMIN_TOKEN;
  const header = request.headers.get("authorization") || "";
  const xToken = request.headers.get("x-admin-token") || "";
  return (token && (header === `Bearer ${token}` || xToken === token)) || await isAdminRequest(request, env);
}

async function ensureDefaultState(db) {
  const row = await db.prepare("SELECT json FROM forum_state WHERE id = ?").bind("main").first();
  if (row?.json) return JSON.parse(row.json);

  await db.prepare("INSERT INTO forum_state (id, json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
    .bind("main", JSON.stringify(DEFAULT_STATE))
    .run();

  return DEFAULT_STATE;
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ ok: true, source: "default", state: DEFAULT_STATE });
  }

  try {
    const state = await ensureDefaultState(env.DB);
    return json({ ok: true, source: "d1", state });
  } catch (error) {
    return json({
      ok: false,
      source: "default",
      error: "D1 is not initialized. Run migrations/0001_forum_cms.sql.",
      details: String(error?.message || error),
      state: DEFAULT_STATE
    }, { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "D1 binding DB is missing" }, { status: 500 });
  if (!await authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const state = body?.state;
  if (!state || typeof state !== "object") {
    return json({ ok: false, error: "Expected JSON body: { state: ... }" }, { status: 400 });
  }

  const serialized = JSON.stringify(state);
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO forum_state (id, json, updated_at)
      VALUES ('main', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = CURRENT_TIMESTAMP
    `).bind(serialized),
    env.DB.prepare("INSERT INTO forum_audit_log (action) VALUES (?)").bind("state.update")
  ]);

  return json({ ok: true, updatedAt: new Date().toISOString() });
}
