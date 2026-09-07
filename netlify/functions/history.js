import { requireAuth, jsonResponse } from "./lib/auth.js";
import { getAllLogs } from "./lib/store.js";
import { guatemalaTodayISO, getWeeklyHistory, getCurrentStreak } from "./lib/domain.js";

export default async (req) => {
  const authError = requireAuth(req);
  if (authError) return authError;

  const logs = await getAllLogs();
  const today = guatemalaTodayISO();

  return jsonResponse({
    ok: true,
    weekly: getWeeklyHistory(logs),
    streak: getCurrentStreak(logs, today),
  });
};
