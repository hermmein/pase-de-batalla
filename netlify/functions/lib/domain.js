// Puerto directo de config.py + las reglas de negocio de app.py.
// Toda fecha se maneja como string ISO "YYYY-MM-DD" y se calcula con
// aritmética UTC explícita (Date.UTC / "T00:00:00Z") para evitar bugs de
// zona horaria del servidor donde corre la función.

export const CYCLE_START = "2026-09-06";
export const CYCLE_END = "2026-12-12";

// Cuántos días hacia atrás se puede registrar/editar (además de hoy)
export const RETROACTIVE_DAYS = 3;

// Máximo de días entre semana (lun-vie) que se pueden marcar como "descanso"
export const REST_DAYS_MAX_PER_WEEK = 2;

export const DAILY_MAX_POINTS = 3;

export const HABITS_EXERCISE_DAY = [
  { key: "ejercicio", label: "Cumplir meta de ejercicio (20 min)", weight: 1 },
  { key: "dos_comidas", label: "Comer solo 2 veces al día (sin atracones ni refacciones)", weight: 1 },
  { key: "plan_nutricional", label: "Comer/beber solo lo permitido en el plan nutricional", weight: 1 },
];

export const HABITS_REST_DAY = [
  { key: "dos_comidas", label: "Comer solo 2 veces al día (sin atracones ni refacciones)", weight: 1.5 },
  { key: "plan_nutricional", label: "Comer/beber solo lo permitido en el plan nutricional", weight: 1.5 },
];

export const HABITS = HABITS_EXERCISE_DAY;

export const MILESTONES = [
  {
    id: 1,
    points: 40,
    deadline: "2026-09-25",
    title: "Cena con amigos + Premier de SBR",
    description: "Invitar amigos a comer y ver la premier de SBR.",
  },
  {
    id: 2,
    points: 95,
    deadline: null,
    title: "Booster Bundle de Delta Reign",
    description: "Booster Bundle de Delta Reign.",
  },
  {
    id: 3,
    points: 175,
    deadline: null,
    title: "Vacaciones cortas",
    description: "Dos días de vacaciones seguidos en diciembre.",
  },
  {
    id: 4,
    points: 220,
    deadline: null,
    title: "Eneagrama + Entrevista Conductual",
    description: "Curso de Eneagrama y Entrevista Conductual (Dra. Froxán Parga).",
  },
  {
    id: 5,
    points: 260,
    deadline: "2026-12-12",
    title: "Nintendo Switch 2 + OoT Remake",
    description: "Nintendo Switch 2 + Remake de OoT para Navidad.",
  },
];

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_ES_ABR = MESES_ES.map((m) => m.slice(0, 3));

// ---------- Utilidades de fecha (ISO string, aritmética UTC) ----------

export function guatemalaTodayISO() {
  // Guatemala es UTC-6 fijo todo el año (sin horario de verano).
  const now = new Date();
  const shifted = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function isValidISODate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Lunes=0 ... Domingo=6 (igual que Python date.weekday())
export function pyWeekday(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return (d.getUTCDay() + 6) % 7;
}

export function mondayOfISO(iso) {
  return addDaysISO(iso, -pyWeekday(iso));
}

export function fmtFechaLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MESES_ES[m - 1]} ${y}`;
}

export function fmtFechaCorta(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MESES_ES_ABR[m - 1]} ${y}`;
}

export function fmtPoints(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// ---------- Reglas de negocio ----------

export function computePoints(log) {
  if (!log) return 0;
  if (log.is_exercise_day) {
    return (log.ejercicio ? 1 : 0) + (log.dos_comidas ? 1 : 0) + (log.plan_nutricional ? 1 : 0);
  }
  return 1.5 * (log.dos_comidas ? 1 : 0) + 1.5 * (log.plan_nutricional ? 1 : 0);
}

export function getTotalPoints(logs) {
  return Object.values(logs).reduce((sum, log) => sum + computePoints(log), 0);
}

export function totalDaysInCycle() {
  const start = new Date(CYCLE_START + "T00:00:00Z").getTime();
  const end = new Date(CYCLE_END + "T00:00:00Z").getTime();
  return Math.round((end - start) / 86400000) + 1;
}

export function maxPointsInCycle() {
  return totalDaysInCycle() * DAILY_MAX_POINTS;
}

export function getMilestonesProgress(totalPoints) {
  return MILESTONES.map((m) => {
    const pct = m.points ? Math.min(100, Math.round((totalPoints / m.points) * 100)) : 0;
    return {
      ...m,
      current_points: totalPoints,
      pct,
      achieved: totalPoints >= m.points,
      deadline_str: m.deadline ? fmtFechaCorta(m.deadline) : null,
    };
  });
}

export function getCurrentStreak(logs, todayISO) {
  let day = todayISO;
  const todayLog = logs[day];
  if (!todayLog || computePoints(todayLog) < DAILY_MAX_POINTS) {
    day = addDaysISO(day, -1);
  }
  let streak = 0;
  while (logs[day] && computePoints(logs[day]) === DAILY_MAX_POINTS) {
    streak += 1;
    day = addDaysISO(day, -1);
  }
  return streak;
}

export function countRestDaysInWeek(logs, weekMonday, excludeDate) {
  const weekFriday = addDaysISO(weekMonday, 4);
  let count = 0;
  for (const [d, log] of Object.entries(logs)) {
    if (d < weekMonday || d > weekFriday) continue;
    if (excludeDate && d === excludeDate) continue;
    if (log.is_exercise_day === false) count += 1;
  }
  return count;
}

export function resolveIsExerciseDay(logs, targetDate, requestedRest) {
  if (pyWeekday(targetDate) >= 5) return { isExerciseDay: false, forced: false };
  if (!requestedRest) return { isExerciseDay: true, forced: false };
  const monday = mondayOfISO(targetDate);
  const restCount = countRestDaysInWeek(logs, monday, targetDate);
  if (restCount >= REST_DAYS_MAX_PER_WEEK) return { isExerciseDay: true, forced: true };
  return { isExerciseDay: false, forced: false };
}

export function clampLoggableDate(iso, todayISO) {
  const earliest = addDaysISO(todayISO, -RETROACTIVE_DAYS);
  if (!isValidISODate(iso) || iso > todayISO || iso < earliest) return todayISO;
  return iso;
}

const DIAS_LABEL = ["Hoy", "Ayer", "Hace 2 días", "Hace 3 días", "Hace 4 días"];

export function getAvailableDates(todayISO) {
  const dates = [];
  for (let offset = 0; offset <= RETROACTIVE_DAYS; offset += 1) {
    const iso = addDaysISO(todayISO, -offset);
    const label = offset < DIAS_LABEL.length ? DIAS_LABEL[offset] : fmtFechaCorta(iso);
    dates.push({ iso, label });
  }
  return dates;
}

export function getWeeklyHistory(logs, weeks = 12) {
  const byWeek = new Map();
  for (const [d, log] of Object.entries(logs)) {
    if (d < CYCLE_START || d > CYCLE_END) continue;
    const weekStart = mondayOfISO(d);
    byWeek.set(weekStart, (byWeek.get(weekStart) || 0) + computePoints(log));
  }
  const weekStarts = [...byWeek.keys()].sort().slice(-weeks);
  return weekStarts.map((w) => ({
    week_start: fmtFechaCorta(w).split(" ").slice(0, -1).join(" "),
    points: byWeek.get(w),
  }));
}

export function daysRemaining(todayISO) {
  const end = new Date(CYCLE_END + "T00:00:00Z").getTime();
  const today = new Date(todayISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((end - today) / 86400000));
}
