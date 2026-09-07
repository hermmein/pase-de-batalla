// Verifica un hash con formato "scrypt$N$r$p$saltHex$hashHex", generado por
// scripts/generate_password_hash.py. scrypt es un estándar (RFC 7914)
// implementado igual en el módulo `crypto` de Node y en `hashlib` de Python,
// así que un hash generado en Python se verifica aquí sin problema.

import { scryptSync, timingSafeEqual } from "node:crypto";

export function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  try {
    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
