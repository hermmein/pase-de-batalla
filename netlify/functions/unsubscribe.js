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
  const subs = await getAllSubs();
  const filtered = subs.filter((s) => s.endpoint !== endpoint);
  if (filtered.length !== subs.length) {
    await saveAllSubs(filtered);
  }

  return jsonResponse({ ok: true });
};
