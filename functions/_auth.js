export const adminCookieName = "buzhba_admin";

export async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hasLoginPassword(env) {
  return Boolean(env.ADMIN_LOGIN && env.ADMIN_PASSWORD);
}

export async function adminSessionValue(env) {
  const login = env.ADMIN_LOGIN || "admin";
  const password = env.ADMIN_PASSWORD || env.ADMIN_TOKEN || "";
  const secret = env.ADMIN_TOKEN || password;
  return sha256(`${login}:${password}:${secret}`);
}

export async function isAdminRequest(request, env) {
  const cookie = request.headers.get("cookie") || "";
  const session = await adminSessionValue(env);
  return Boolean(session && cookie.includes(`${adminCookieName}=${session}`));
}

export function validCredentials(form, env) {
  const login = String(form.get("login") || "");
  const password = String(form.get("password") || "");
  const token = String(form.get("token") || "");

  if (hasLoginPassword(env)) {
    return login === env.ADMIN_LOGIN && password === env.ADMIN_PASSWORD;
  }

  return Boolean(env.ADMIN_TOKEN && token === env.ADMIN_TOKEN);
}
