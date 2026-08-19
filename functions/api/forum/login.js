import { adminCookieName, adminSessionValue, validCredentials } from "../../_auth.js";

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: { location, ...headers }
  });
}

export async function onRequestPost({ request, env }) {
  const form = await request.formData();

  if (!validCredentials(form, env)) {
    return redirect("/v2/admin/?error=1");
  }

  const session = await adminSessionValue(env);
  return redirect("/v2/admin/", {
    "set-cookie": `${adminCookieName}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
  });
}
