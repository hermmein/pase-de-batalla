import { clearSessionCookie, jsonResponse } from "./lib/auth.js";

export default async () => {
  return jsonResponse(
    { ok: true },
    { status: 200, headers: { "set-cookie": clearSessionCookie() } }
  );
};
