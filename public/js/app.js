// ---------- Utilidades ----------
function fmtPts(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?next=${next}`;
    throw new Error("No autenticado");
  }
  return res;
}

const logoutLink = document.getElementById("logout-link");
if (logoutLink) {
  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
}

// ---------- Página "Hoy" ----------
const appEl = document.getElementById("app");
if (appEl) {
  renderIndexPage();
}

async function renderIndexPage() {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");
  const url = dateParam ? `/api/state?date=${encodeURIComponent(dateParam)}` : "/api/state";

  let state;
  try {
    const res = await apiFetch(url);
    const data = await res.json();
    if (!data.ok) {
      appEl.innerHTML = `<p class="muted">Ocurrió un error al cargar los datos.</p>`;
      return;
    }
    state = data;
  } catch {
    return; // apiFetch ya redirigió a login si hacía falta
  }

  window.VAPID_PUBLIC_KEY = state.vapid_public_key || "";

  const pct = state.max_points ? (state.total_points / state.max_points) * 100 : 0;

  const dateTabs = state.available_dates
    .map(
      (d) => `
      <a href="/?date=${d.iso}" class="date-tab ${d.iso === state.selected_date_iso ? "active" : ""}">${escapeHtml(d.label)}</a>
    `
    )
    .join("");

  let dayTypeSection;
  if (state.is_weekend) {
    dayTypeSection = `<p class="muted small daytype-note">Fin de semana: siempre es día de descanso (sin ejercicio).</p>`;
  } else {
    dayTypeSection = `
      <div class="daytype-toggle">
        <label class="daytype-option">
          <input type="radio" name="is_exercise_day" value="1" ${state.current_is_exercise_day ? "checked" : ""}>
          <span>💪 Día de ejercicio</span>
        </label>
        <label class="daytype-option ${!state.rest_available ? "disabled" : ""}">
          <input type="radio" name="is_exercise_day" value="0"
            ${!state.current_is_exercise_day ? "checked" : ""}
            ${!state.rest_available ? "disabled" : ""}>
          <span>🛌 Día de descanso</span>
        </label>
      </div>
      ${
        !state.rest_available
          ? `<p class="muted small daytype-note">Ya usaste tus ${state.rest_days_max} días de descanso esta semana (lun-vie). Este día cuenta como ejercicio.</p>`
          : ""
      }
    `;
  }

  const log = state.log;
  const milestonesHtml = state.milestones
    .map(
      (m) => `
      <div class="milestone ${m.achieved ? "achieved" : ""}">
        <div class="milestone-head">
          <span class="milestone-title">${escapeHtml(m.title)}</span>
          <span class="milestone-points">${m.points} pts</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${m.pct}%"></div>
        </div>
        <div class="milestone-foot">
          <span>${escapeHtml(m.description)}</span>
          ${m.deadline_str ? `<span class="deadline">Vence: ${escapeHtml(m.deadline_str)}</span>` : ""}
        </div>
        ${m.achieved ? `<div class="achieved-tag">✅ Desbloqueado</div>` : ""}
      </div>
    `
    )
    .join("");

  appEl.innerHTML = `
    <section class="card hero">
      <div class="hero-top">
        <div>
          <div class="eyebrow">${escapeHtml(state.today)}</div>
          <h1>${fmtPts(state.total_points)} <span class="muted">/ ${state.max_points} pts</span></h1>
        </div>
        <div class="streak-badge" title="Racha de días perfectos">🔥 ${state.streak}</div>
      </div>
      <div class="progress-bar big">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
      <div class="hero-meta">
        <span>Ciclo: ${escapeHtml(state.cycle_start)} → ${escapeHtml(state.cycle_end)}</span>
        <span>${state.days_remaining} días restantes</span>
      </div>
    </section>

    <section class="card">
      <div class="date-tabs">${dateTabs}</div>
      <h2>${escapeHtml(state.registro_label)}</h2>
      <form id="log-form" data-date="${state.selected_date_iso}" data-is-weekend="${state.is_weekend ? "true" : "false"}">
        ${dayTypeSection}
        <p class="muted small">Cada conducta suma <span id="weight-label">${state.current_is_exercise_day ? "1 punto" : "1.5 puntos"}</span>. Máximo 3 pts/día.</p>

        <div id="row-ejercicio" class="habit-row" ${!state.current_is_exercise_day ? "hidden" : ""}>
          <label class="habit-toggle">
            <input type="checkbox" name="ejercicio" data-key="ejercicio" ${log && log.ejercicio ? "checked" : ""}>
            <span class="checkmark"></span>
            <span class="habit-label">Cumplir meta de ejercicio (20 min)</span>
          </label>
        </div>

        <label class="habit-toggle">
          <input type="checkbox" name="dos_comidas" data-key="dos_comidas" ${log && log.dos_comidas ? "checked" : ""}>
          <span class="checkmark"></span>
          <span class="habit-label">Comer solo 2 veces al día (sin atracones ni refacciones)</span>
        </label>

        <label class="habit-toggle">
          <input type="checkbox" name="plan_nutricional" data-key="plan_nutricional" ${log && log.plan_nutricional ? "checked" : ""}>
          <span class="checkmark"></span>
          <span class="habit-label">Comer/beber solo lo permitido en el plan nutricional</span>
        </label>

        <button type="submit" class="btn-primary">Guardar registro</button>
        <div id="save-feedback" class="save-feedback"></div>
      </form>
    </section>

    <section class="card">
      <h2>Hitos del Pase de Batalla</h2>
      ${milestonesHtml}
    </section>

    <section class="card notif-card">
      <h2>Recordatorios</h2>
      <p class="muted small">Recibe un aviso a las 8:00 PM si aún no registras tus puntos.</p>
      <button id="enable-notifs" class="btn-secondary">Activar notificaciones</button>
      <p id="notif-status" class="muted small"></p>
    </section>
  `;

  wireLogForm();
  wireNotifications();
}

function wireLogForm() {
  const logForm = document.getElementById("log-form");
  if (!logForm) return;

  const ejercicioRow = document.getElementById("row-ejercicio");
  const weightLabel = document.getElementById("weight-label");
  const dayTypeRadios = logForm.querySelectorAll('input[name="is_exercise_day"]');

  function updateDayType(isExerciseDay) {
    if (ejercicioRow) ejercicioRow.hidden = !isExerciseDay;
    if (weightLabel) weightLabel.textContent = isExerciseDay ? "1 punto" : "1.5 puntos";
  }

  dayTypeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const checked = logForm.querySelector('input[name="is_exercise_day"]:checked');
      updateDayType(!!checked && checked.value === "1");
    });
  });

  logForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = { date: logForm.dataset.date };

    const isWeekend = logForm.dataset.isWeekend === "true";
    if (isWeekend) {
      payload.is_exercise_day = false;
    } else {
      const checkedRadio = logForm.querySelector('input[name="is_exercise_day"]:checked');
      payload.is_exercise_day = !!checkedRadio && checkedRadio.value === "1";
    }

    logForm.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      payload[cb.dataset.key] = cb.checked;
    });

    const feedback = document.getElementById("save-feedback");
    feedback.textContent = "Guardando...";

    try {
      const res = await apiFetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        let msg = `Guardado: ${fmtPts(data.log.points)} pts · Total ${fmtPts(data.total_points)} pts · Racha ${data.streak}`;
        if (data.forced_exercise_day) {
          msg += " · Ya no tenías días de descanso disponibles esta semana, se marcó como ejercicio.";
        }
        feedback.textContent = msg;
      } else {
        feedback.textContent = "Ocurrió un error al guardar.";
      }
    } catch (err) {
      feedback.textContent = "Sin conexión. Intenta de nuevo.";
    }
  });
}

// ---------- Notificaciones push ----------
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    return navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }
  return null;
}

async function subscribeToPush() {
  const statusEl = document.getElementById("notif-status");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    if (statusEl) statusEl.textContent = "Tu navegador no soporta notificaciones push.";
    return;
  }
  if (!window.VAPID_PUBLIC_KEY) {
    if (statusEl) statusEl.textContent = "Falta configurar VAPID_PUBLIC_KEY en el servidor.";
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    if (statusEl) statusEl.textContent = "Permiso de notificaciones denegado.";
    return;
  }

  const reg = await registerServiceWorker();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
  });

  await apiFetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  if (statusEl) statusEl.textContent = "Notificaciones activadas ✔ (recordatorio 8:00 PM)";
}

function wireNotifications() {
  const enableBtn = document.getElementById("enable-notifs");
  if (!enableBtn) return;

  enableBtn.addEventListener("click", subscribeToPush);

  registerServiceWorker().then(() => {
    if (Notification.permission === "granted") {
      document.getElementById("notif-status").textContent = "Notificaciones activadas ✔";
    }
  });
}

// ---------- Página "Historial" ----------
const historyEl = document.getElementById("history-app");
if (historyEl) {
  renderHistoryPage();
}

async function renderHistoryPage() {
  let data;
  try {
    const res = await apiFetch("/api/history");
    data = await res.json();
    if (!data.ok) {
      historyEl.innerHTML = `<p class="muted">Ocurrió un error al cargar el historial.</p>`;
      return;
    }
  } catch {
    return;
  }

  historyEl.innerHTML = `
    <section class="card">
      <h2>Racha actual</h2>
      <div class="streak-badge large">🔥 ${data.streak} días perfectos</div>
    </section>

    <section class="card">
      <h2>Puntos por semana</h2>
      <canvas id="weeklyChart" height="220"></canvas>
    </section>
  `;

  const labels = data.weekly.map((w) => w.week_start);
  const points = data.weekly.map((w) => w.points);

  const ctx = document.getElementById("weeklyChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Puntos por semana (máx 21)",
          data: points,
          backgroundColor: "#7c5cff",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 21, ticks: { color: "#aaa" }, grid: { color: "#333" } },
        x: { ticks: { color: "#aaa" }, grid: { display: false } },
      },
      plugins: { legend: { labels: { color: "#ddd" } } },
    },
  });
}
