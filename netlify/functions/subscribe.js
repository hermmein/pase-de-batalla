import { requireAuth, jsonResponse } from "./lib/auth.js";
import { getAllSubs, saveAllSubs } from "./lib/store.js";

export default async (req) => {
  const authError = requireAuth(req);
  if (authError) return authError;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método no permitido" }, { status: 405 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    data = {};
  }

  const endpoint = data.endpoint;
  const keys = data.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) {
    return jsonResponse({ ok: false, error: "Suscripción inválida" }, { status: 400 });
  }

  const subs = await getAllSubs();
  if (!subs.some((s) => s.endpoint === endpoint)) {
    subs.push({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
    await saveAllSubs(subs);
  }

  return jsonResponse({ ok: true });
};
