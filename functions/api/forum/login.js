const cookieName = "buzhba_admin";

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: { location, ...headers }
  });
}

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const token = String(form.get("token") || "");

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return redirect("/v2/admin/?error=1");
  }

  return redirect("/v2/admin/", {
    "set-cookie": `${cookieName}=${encodeURIComponent(env.ADMIN_TOKEN)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
  });
}
