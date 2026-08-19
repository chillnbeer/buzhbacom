export async function onRequestGet() {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/v2/",
      "set-cookie": "buzhba_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    }
  });
}
