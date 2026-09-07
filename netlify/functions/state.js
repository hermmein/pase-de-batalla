import { requireAuth, jsonResponse } from "./lib/auth.js";
import { getAllLogs } from "./lib/store.js";
import {
  guatemalaTodayISO,
  clampLoggableDate,
  pyWeekday,
  mondayOfISO,
  countRestDaysInWeek,
  REST_DAYS_MAX_PER_WEEK,
  HABITS_EXERCISE_DAY,
  HABITS_REST_DAY,
  getTotalPoints,
  maxPointsInCycle,
  getMilestonesProgress,
  getCurrentStreak,
  getAvailableDates,
  daysRemaining,
  fmtFechaLarga,
  fmtFechaCorta,
  addDaysISO,
  CYCLE_START,
  CYCLE_END,
} from "./lib/domain.js";

export default async (req) => {
  const authError = requireAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const today = guatemalaTodayISO();
  const selectedDate = clampLoggableDate(url.searchParams.get("date"), today);
  const isWeekend = pyWeekday(selectedDate) >= 5;

  const logs = await getAllLogs();
  const log = logs[selectedDate] || null;
  const currentIsExerciseDay = log ? log.is_exercise_day : !isWeekend;

  let restAvailable = true;
  if (!isWeekend) {
    const monday = mondayOfISO(selectedDate);
    const restCount = countRestDaysInWeek(logs, monday, selectedDate);
    restAvailable = restCount < REST_DAYS_MAX_PER_WEEK;
  }

  const habitsForDay = currentIsExerciseDay ? HABITS_EXERCISE_DAY : HABITS_REST_DAY;

  let registroLabel;
  if (selectedDate === today) {
    registroLabel = "Registro de hoy";
  } else if (selectedDate === addDaysISO(today, -1)) {
    registroLabel = "Registro de ayer";
  } else {
    registroLabel = `Registro del ${fmtFechaCorta(selectedDate)}`;
  }

  const totalPoints = getTotalPoints(logs);

  return jsonResponse({
    ok: true,
    today: fmtFechaLarga(today),
    selected_date_iso: selectedDate,
    registro_label: registroLabel,
    available_dates: getAvailableDates(today),
    is_weekend: isWeekend,
    rest_available: restAvailable,
    current_is_exercise_day: currentIsExerciseDay,
    habits_exercise_day: HABITS_EXERCISE_DAY,
    habits_rest_day: HABITS_REST_DAY,
    habits_for_day: habitsForDay,
    rest_days_max: REST_DAYS_MAX_PER_WEEK,
    log: log
      ? {
          date: selectedDate,
          is_exercise_day: log.is_exercise_day,
          ejercicio: !!log.ejercicio,
          dos_comidas: !!log.dos_comidas,
          plan_nutricional: !!log.plan_nutricional,
        }
      : null,
    total_points: totalPoints,
    max_points: maxPointsInCycle(),
    milestones: getMilestonesProgress(totalPoints),
    streak: getCurrentStreak(logs, today),
    days_remaining: daysRemaining(today),
    cycle_start: fmtFechaCorta(CYCLE_START),
    cycle_end: fmtFechaCorta(CYCLE_END),
    vapid_public_key: process.env.VAPID_PUBLIC_KEY || "",
  });
};
