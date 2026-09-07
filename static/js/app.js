// ---------- Registro diario: toggle día de ejercicio / descanso ----------
function fmtPts(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const logForm = document.getElementById('log-form');
if (logForm) {
  const ejercicioRow = document.getElementById('row-ejercicio');
  const weightLabel = document.getElementById('weight-label');
  const dayTypeRadios = logForm.querySelectorAll('input[name="is_exercise_day"]');

  function updateDayType(isExerciseDay) {
    if (ejercicioRow) ejercicioRow.hidden = !isExerciseDay;
    if (weightLabel) weightLabel.textContent = isExerciseDay ? '1 punto' : '1.5 puntos';
  }

  dayTypeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      const checked = logForm.querySelector('input[name="is_exercise_day"]:checked');
      updateDayType(!!checked && checked.value === '1');
    });
  });

  logForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = { date: logForm.dataset.date };

    const isWeekend = logForm.dataset.isWeekend === 'true';
    if (isWeekend) {
      payload.is_exercise_day = false;
    } else {
      const checkedRadio = logForm.querySelector('input[name="is_exercise_day"]:checked');
      payload.is_exercise_day = !!checkedRadio && checkedRadio.value === '1';
    }

    logForm.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      payload[cb.dataset.key] = cb.checked;
    });

    const feedback = document.getElementById('save-feedback');
    feedback.textContent = 'Guardando...';

    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        let msg = `Guardado: ${fmtPts(data.log.points)} pts · Total ${fmtPts(data.total_points)} pts · Racha ${data.streak}`;
        if (data.forced_exercise_day) {
          msg += ' · Ya no tenías días de descanso disponibles esta semana, se marcó como ejercicio.';
        }
        feedback.textContent = msg;
      } else {
        feedback.textContent = 'Ocurrió un error al guardar.';
      }
    } catch (err) {
      feedback.textContent = 'Sin conexión. Intenta de nuevo.';
    }
  });
}

// ---------- Notificaciones push ----------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  return null;
}

async function subscribeToPush() {
  const statusEl = document.getElementById('notif-status');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (statusEl) statusEl.textContent = 'Tu navegador no soporta notificaciones push.';
    return;
  }
  if (!window.VAPID_PUBLIC_KEY) {
    if (statusEl) statusEl.textContent = 'Falta configurar VAPID_PUBLIC_KEY en el servidor.';
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (statusEl) statusEl.textContent = 'Permiso de notificaciones denegado.';
    return;
  }

  const reg = await registerServiceWorker();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
  });

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  if (statusEl) statusEl.textContent = 'Notificaciones activadas ✔ (recordatorio 8:00 PM)';
}

const enableBtn = document.getElementById('enable-notifs');
if (enableBtn) {
  enableBtn.addEventListener('click', subscribeToPush);

  registerServiceWorker().then(() => {
    if (Notification.permission === 'granted') {
      document.getElementById('notif-status').textContent = 'Notificaciones activadas ✔';
    }
  });
}
