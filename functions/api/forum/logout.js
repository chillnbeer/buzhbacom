import { adminCookieName } from "../../_auth.js";

export async function onRequestGet() {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/v2/",
      "set-cookie": `${adminCookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    }
  });
}
