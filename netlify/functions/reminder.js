// Scheduled Function: reemplaza al BackgroundScheduler + APScheduler de
// app.py. El cron de Netlify corre en UTC; Guatemala es UTC-6 fijo (sin
// horario de verano), así que "0 2 * * *" (2:00 AM UTC) equivale siempre a
// las 8:00 PM hora de Guatemala. Si alguna vez cambias la hora del
// recordatorio, recalcula: hora_utc = (hora_guatemala + 6) % 24.
import webpush from "web-push";
import { getAllLogs, getAllSubs, saveAllSubs } from "./lib/store.js";
import { guatemalaTodayISO, computePoints, DAILY_MAX_POINTS } from "./lib/domain.js";

export const config = {
  schedule: "0 2 * * *",
};

export default async () => {
  const today = guatemalaTodayISO();
  const logs = await getAllLogs();
  const todayLog = logs[today];

  if (todayLog && computePoints(todayLog) >= DAILY_MAX_POINTS) {
    console.log("Hoy ya está completo, no se envía recordatorio.");
    return new Response("skip: ya completo", { status: 200 });
  }

  const subs = await getAllSubs();
  if (subs.length === 0) {
    console.log("No hay suscripciones push registradas.");
    return new Response("skip: sin suscripciones", { status: 200 });
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
  const vapidClaimEmail = process.env.VAPID_CLAIM_EMAIL || "mailto:admin@example.com";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configuradas; se omite envío de push.");
    return new Response("skip: faltan claves VAPID", { status: 200 });
  }

  webpush.setVapidDetails(vapidClaimEmail, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: "Registra tus fichas de hoy",
    body: "Aún no has capturado tus puntos de hoy. ¡No rompas la racha!",
    url: "/",
  });

  const stillValid = [];
  let sent = 0;
  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(subscription, payload);
      stillValid.push(sub);
      sent += 1;
    } catch (err) {
      const statusCode = err && err.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        console.warn(`Suscripción expirada, se elimina: ${sub.endpoint.slice(0, 40)}...`);
      } else {
        console.warn(`Push fallido para ${sub.endpoint.slice(0, 40)}...: ${err}`);
        stillValid.push(sub);
      }
    }
  }

  if (stillValid.length !== subs.length) {
    await saveAllSubs(stillValid);
  }

  return new Response(`ok: enviados ${sent}/${subs.length}`, { status: 200 });
};
