import { requireAuth, jsonResponse } from "./lib/auth.js";
import { getAllLogs, saveAllLogs } from "./lib/store.js";
import {
  guatemalaTodayISO,
  clampLoggableDate,
  resolveIsExerciseDay,
  computePoints,
  getTotalPoints,
  getCurrentStreak,
  HABITS,
  HABITS_EXERCISE_DAY,
  HABITS_REST_DAY,
} from "./lib/domain.js";

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

  const today = guatemalaTodayISO();
  const targetDate = clampLoggableDate(data.date, today);
  const requestedRest = !data.is_exercise_day;

  const logs = await getAllLogs();
  const { isExerciseDay, forced } = resolveIsExerciseDay(logs, targetDate, requestedRest);

  const habitKeys = new Set(
    (isExerciseDay ? HABITS_EXERCISE_DAY : HABITS_REST_DAY).map((h) => h.key)
  );

  const newLog = { is_exercise_day: isExerciseDay };
  for (const habit of HABITS) {
    newLog[habit.key] = habitKeys.has(habit.key) ? !!data[habit.key] : false;
  }

  logs[targetDate] = newLog;
  await saveAllLogs(logs);

  const totalPoints = getTotalPoints(logs);

  return jsonResponse({
    ok: true,
    log: { date: targetDate, ...newLog, points: computePoints(newLog) },
    forced_exercise_day: forced,
    total_points: totalPoints,
    streak: getCurrentStreak(logs, today),
  });
};
