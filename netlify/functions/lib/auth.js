// Sesión sin estado: en vez de sesiones de servidor (que Flask guardaba en
// disco/memoria), la cookie lleva su propia fecha de expiración firmada con
// HMAC-SHA256 usando SESSION_SECRET. Cualquier función puede verificarla sin
// consultar una base de datos.

import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "pdb_session";
const MAX_AGE_DAYS = 30;

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionCookie(secret) {
  const exp = Date.now() + MAX_AGE_DAYS * 86400000;
  const payload = String(exp);
  const sig = sign(payload, secret);
  const maxAge = MAX_AGE_DAYS * 86400;
  return `${COOKIE_NAME}=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

export function isAuthenticated(req, secret) {
  if (!secret) return false;
  const cookies = parseCookies(req.headers.get("cookie"));
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const dotIdx = raw.indexOf(".");
  if (dotIdx === -1) return false;
  const payload = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const expectedSig = sign(payload, secret);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function requireAuth(req) {
  const secret = process.env.SESSION_SECRET || "";
  if (!isAuthenticated(req, secret)) {
    return jsonResponse({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  return null;
}
