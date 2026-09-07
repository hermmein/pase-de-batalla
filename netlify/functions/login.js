import { verifyPassword } from "./lib/password.js";
import { createSessionCookie, jsonResponse } from "./lib/auth.js";

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método no permitido" }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const password = typeof body.password === "string" ? body.password : "";
  const hash = process.env.APP_PASSWORD_HASH || "";
  const secret = process.env.SESSION_SECRET || "";

  if (!hash || !secret) {
    return jsonResponse(
      { ok: false, error: "Servidor mal configurado: faltan variables de entorno" },
      { status: 500 }
    );
  }

  if (!verifyPassword(password, hash)) {
    return jsonResponse({ ok: false, error: "Contraseña incorrecta" }, { status: 401 });
  }

  return jsonResponse(
    { ok: true },
    { status: 200, headers: { "set-cookie": createSessionCookie(secret) } }
  );
};
