export async function onRequest(context) {
  const hasDb = Boolean(context.env.DB);
  return Response.json({
    ok: true,
    db: hasDb ? "bound" : "missing",
    time: new Date().toISOString()
  });
}
