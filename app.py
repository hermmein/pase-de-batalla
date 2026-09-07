import logging
from functools import wraps
from datetime import date, timedelta, datetime

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for
from werkzeug.security import check_password_hash
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from zoneinfo import ZoneInfo
from pywebpush import webpush, WebPushException

from config import (
    Config, CYCLE_START, CYCLE_END, HABITS, MILESTONES,
    RETROACTIVE_DAYS, REST_DAYS_MAX_PER_WEEK, DAILY_MAX_POINTS,
    HABITS_EXERCISE_DAY, HABITS_REST_DAY,
)
from models import db, DailyLog, PushSubscription

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pase-de-batalla")

MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
MESES_ES_ABR = [m[:3] for m in MESES_ES]


def fmt_fecha_larga(d):
    return f"{d.day:02d} {MESES_ES[d.month - 1]} {d.year}"


def fmt_fecha_corta(d):
    return f"{d.day:02d} {MESES_ES_ABR[d.month - 1]} {d.year}"


def fmt_points(value):
    return str(int(value)) if float(value).is_integer() else f"{value:.1f}"


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.permanent_session_lifetime = timedelta(days=app.config["PERMANENT_SESSION_LIFETIME_DAYS"])
    app.jinja_env.filters["fmt_points"] = fmt_points
    db.init_app(app)

    with app.app_context():
        db.create_all()

    register_routes(app)

    if not app.config.get("SCHEDULER_STARTED"):
        start_scheduler(app)
        app.config["SCHEDULER_STARTED"] = True

    return app


# ---------- Helpers de dominio ----------

def total_days_in_cycle():
    return (CYCLE_END - CYCLE_START).days + 1


def max_points_in_cycle():
    return total_days_in_cycle() * DAILY_MAX_POINTS


def get_total_points():
    logs = DailyLog.query.all()
    return sum(l.points for l in logs)


def get_milestones_progress(total_points):
    result = []
    for m in MILESTONES:
        pct = min(100, round((total_points / m["points"]) * 100)) if m["points"] else 0
        result.append({
            **m,
            "current_points": total_points,
            "pct": pct,
            "achieved": total_points >= m["points"],
            "deadline_str": fmt_fecha_corta(m["deadline"]) if m["deadline"] else None,
        })
    return result


def get_current_streak():
    """Racha de días consecutivos con los 3 puntos completos, terminando hoy o ayer."""
    logs = {
        l.log_date: l
        for l in DailyLog.query.filter(DailyLog.log_date <= date.today()).all()
    }
    streak = 0
    day = date.today()
    # Si hoy aún no se registra, la racha se cuenta desde ayer.
    if day not in logs or logs[day].points < DAILY_MAX_POINTS:
        day = day - timedelta(days=1)
    while day in logs and logs[day].points == DAILY_MAX_POINTS:
        streak += 1
        day -= timedelta(days=1)
    return streak


# ---------- Semana de ejercicio (lun-vie) ----------

def get_week_monday(d):
    return d - timedelta(days=d.weekday())


def count_rest_days_in_week(week_monday, exclude_date=None):
    """Días entre semana (lun-vie) ya marcados como descanso en esa semana."""
    week_friday = week_monday + timedelta(days=4)
    query = DailyLog.query.filter(
        DailyLog.log_date >= week_monday,
        DailyLog.log_date <= week_friday,
        DailyLog.is_exercise_day.is_(False),
    )
    if exclude_date:
        query = query.filter(DailyLog.log_date != exclude_date)
    return query.count()


def resolve_is_exercise_day(target_date, requested_rest):
    """Devuelve (is_exercise_day, forced) aplicando las reglas de la semana."""
    if target_date.weekday() >= 5:  # sábado/domingo
        return False, False
    if not requested_rest:
        return True, False
    monday = get_week_monday(target_date)
    rest_count = count_rest_days_in_week(monday, exclude_date=target_date)
    if rest_count >= REST_DAYS_MAX_PER_WEEK:
        return True, True  # cupo agotado: se fuerza día de ejercicio
    return False, False


def parse_iso_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def clamp_loggable_date(d):
    """Restringe una fecha al rango [hoy - RETROACTIVE_DAYS, hoy]."""
    today = date.today()
    earliest = today - timedelta(days=RETROACTIVE_DAYS)
    if d is None or d > today or d < earliest:
        return today
    return d


DIAS_LABEL = ["Hoy", "Ayer", "Hace 2 días", "Hace 3 días", "Hace 4 días"]


def get_available_dates():
    today = date.today()
    dates = []
    for offset in range(RETROACTIVE_DAYS + 1):
        d = today - timedelta(days=offset)
        label = DIAS_LABEL[offset] if offset < len(DIAS_LABEL) else fmt_fecha_corta(d)
        dates.append({"iso": d.isoformat(), "label": label})
    return dates


# ---------- Autenticación ----------

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("authenticated"):
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "error": "No autenticado"}), 401
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return wrapper


def get_weekly_history(weeks=12):
    """Agrega puntos por semana (lunes-domingo) para los últimos N semanas dentro del ciclo."""
    logs = DailyLog.query.filter(
        DailyLog.log_date >= CYCLE_START, DailyLog.log_date <= CYCLE_END
    ).all()
    by_week = {}
    for l in logs:
        week_start = l.log_date - timedelta(days=l.log_date.weekday())
        by_week.setdefault(week_start, 0)
        by_week[week_start] += l.points

    weeks_list = sorted(by_week.keys())[-weeks:]
    return [
        {"week_start": fmt_fecha_corta(w).rsplit(" ", 1)[0], "points": by_week[w]}
        for w in weeks_list
    ]


def days_remaining():
    return max(0, (CYCLE_END - date.today()).days)


# ---------- Rutas ----------

def register_routes(app):

    @app.route("/login", methods=["GET", "POST"])
    def login():
        error = None
        if request.method == "POST":
            password = request.form.get("password", "")
            password_hash = app.config["APP_PASSWORD_HASH"]
            if password_hash and check_password_hash(password_hash, password):
                session.permanent = True
                session["authenticated"] = True
                next_url = request.args.get("next") or url_for("index")
                return redirect(next_url)
            error = "Contraseña incorrecta"
        return render_template("login.html", error=error)

    @app.route("/logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))

    @app.route("/")
    @login_required
    def index():
        today = date.today()
        selected_date = clamp_loggable_date(parse_iso_date(request.args.get("date")))
        is_weekend = selected_date.weekday() >= 5

        log = DailyLog.query.filter_by(log_date=selected_date).first()
        if log:
            current_is_exercise_day = log.is_exercise_day
        else:
            current_is_exercise_day = not is_weekend

        rest_available = True
        if not is_weekend:
            monday = get_week_monday(selected_date)
            rest_count = count_rest_days_in_week(monday, exclude_date=selected_date)
            rest_available = rest_count < REST_DAYS_MAX_PER_WEEK

        habits_for_day = HABITS_EXERCISE_DAY if current_is_exercise_day else HABITS_REST_DAY

        if selected_date == today:
            registro_label = "Registro de hoy"
        elif selected_date == today - timedelta(days=1):
            registro_label = "Registro de ayer"
        else:
            registro_label = f"Registro del {fmt_fecha_corta(selected_date)}"

        total_points = get_total_points()

        context = {
            "today": fmt_fecha_larga(today),
            "selected_date_iso": selected_date.isoformat(),
            "registro_label": registro_label,
            "available_dates": get_available_dates(),
            "is_weekend": is_weekend,
            "rest_available": rest_available,
            "current_is_exercise_day": current_is_exercise_day,
            "habits_exercise_day": HABITS_EXERCISE_DAY,
            "habits_rest_day": HABITS_REST_DAY,
            "habits_for_day": habits_for_day,
            "rest_days_max": REST_DAYS_MAX_PER_WEEK,
            "log": log.to_dict() if log else None,
            "total_points": total_points,
            "max_points": max_points_in_cycle(),
            "milestones": get_milestones_progress(total_points),
            "streak": get_current_streak(),
            "days_remaining": days_remaining(),
            "cycle_start": fmt_fecha_corta(CYCLE_START),
            "cycle_end": fmt_fecha_corta(CYCLE_END),
            "vapid_public_key": app.config["VAPID_PUBLIC_KEY"],
        }
        return render_template("index.html", **context)

    @app.route("/historial")
    @login_required
    def historial():
        return render_template(
            "history.html",
            weekly=get_weekly_history(),
            streak=get_current_streak(),
        )

    @app.route("/api/log", methods=["POST"])
    @login_required
    def api_log():
        data = request.get_json(force=True)

        target_date = clamp_loggable_date(parse_iso_date(data.get("date")))
        requested_rest = not bool(data.get("is_exercise_day", True))
        is_exercise_day, forced = resolve_is_exercise_day(target_date, requested_rest)

        log = DailyLog.query.filter_by(log_date=target_date).first()
        if not log:
            log = DailyLog(log_date=target_date)
            db.session.add(log)

        log.is_exercise_day = is_exercise_day
        habit_keys = [h["key"] for h in (HABITS_EXERCISE_DAY if is_exercise_day else HABITS_REST_DAY)]
        for habit in HABITS:
            key = habit["key"]
            log_value = bool(data.get(key)) if key in habit_keys else False
            setattr(log, key, log_value)

        db.session.commit()
        return jsonify({
            "ok": True,
            "log": log.to_dict(),
            "forced_exercise_day": forced,
            "total_points": get_total_points(),
            "streak": get_current_streak(),
        })

    @app.route("/api/subscribe", methods=["POST"])
    @login_required
    def api_subscribe():
        data = request.get_json(force=True)
        endpoint = data.get("endpoint")
        keys = data.get("keys", {})
        if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
            return jsonify({"ok": False, "error": "Suscripción inválida"}), 400

        existing = PushSubscription.query.filter_by(endpoint=endpoint).first()
        if not existing:
            sub = PushSubscription(
                endpoint=endpoint, p256dh=keys["p256dh"], auth=keys["auth"]
            )
            db.session.add(sub)
            db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/unsubscribe", methods=["POST"])
    @login_required
    def api_unsubscribe():
        data = request.get_json(force=True)
        endpoint = data.get("endpoint")
        PushSubscription.query.filter_by(endpoint=endpoint).delete()
        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/manifest.json")
    def manifest():
        return app.send_static_file("manifest.json")

    @app.route("/sw.js")
    def service_worker():
        # Servido en la raíz para que el scope del Service Worker cubra toda la app.
        response = send_from_directory(app.static_folder + "/js", "sw.js")
        response.headers["Service-Worker-Allowed"] = "/"
        return response


# ---------- Notificaciones push ----------

def send_reminder_if_needed(app):
    with app.app_context():
        today = date.today()
        log = DailyLog.query.filter_by(log_date=today).first()
        if log and log.points >= DAILY_MAX_POINTS:
            logger.info("Hoy ya está completo, no se envía recordatorio.")
            return

        subs = PushSubscription.query.all()
        if not subs:
            logger.info("No hay suscripciones push registradas.")
            return

        payload = {
            "title": "Registra tus fichas de hoy",
            "body": "Aún no has capturado tus puntos de hoy. ¡No rompas la racha!",
            "url": "/",
        }

        vapid_private_key = app.config["VAPID_PRIVATE_KEY"]
        vapid_claims = {"sub": app.config["VAPID_CLAIM_EMAIL"]}

        if not vapid_private_key:
            logger.warning("VAPID_PRIVATE_KEY no configurada; se omite envío de push.")
            return

        for sub in subs:
            try:
                webpush(
                    subscription_info=sub.to_subscription_info(),
                    data=str(payload).replace("'", '"'),
                    vapid_private_key=vapid_private_key,
                    vapid_claims=vapid_claims,
                )
            except WebPushException as ex:
                logger.warning(f"Push fallido para {sub.endpoint[:40]}...: {ex}")
                if ex.response is not None and ex.response.status_code in (404, 410):
                    db.session.delete(sub)
        db.session.commit()


def start_scheduler(app):
    tz = ZoneInfo(app.config["TIMEZONE"])
    scheduler = BackgroundScheduler(timezone=tz)
    scheduler.add_job(
        func=lambda: send_reminder_if_needed(app),
        trigger=CronTrigger(
            hour=app.config["REMINDER_HOUR"],
            minute=app.config["REMINDER_MINUTE"],
            timezone=tz,
        ),
        id="daily_reminder",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"Scheduler iniciado: recordatorio diario a las "
        f"{app.config['REMINDER_HOUR']:02d}:{app.config['REMINDER_MINUTE']:02d} ({tz})"
    )


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
