// Almacenamiento persistente con Netlify Blobs.
// Dado el volumen (un solo usuario, ~100 registros como máximo), se guarda
// todo el historial como un único blob JSON por tipo de dato: evita N+1
// lecturas y es más simple que un registro por fecha.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "pase-de-batalla";
const LOGS_KEY = "logs";
const SUBS_KEY = "push-subscriptions";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getAllLogs() {
  const data = await store().get(LOGS_KEY, { type: "json" });
  return data || {};
}

export async function saveAllLogs(logs) {
  await store().setJSON(LOGS_KEY, logs);
}

export async function getAllSubs() {
  const data = await store().get(SUBS_KEY, { type: "json" });
  return data || [];
}

export async function saveAllSubs(subs) {
  await store().setJSON(SUBS_KEY, subs);
}
