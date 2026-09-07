import os
from datetime import date

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "cambia-esta-clave-en-produccion")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'fichas.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
    VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
    VAPID_CLAIM_EMAIL = os.environ.get("VAPID_CLAIM_EMAIL", "mailto:admin@example.com")

    TIMEZONE = os.environ.get("APP_TIMEZONE", "America/Guatemala")
    REMINDER_HOUR = int(os.environ.get("REMINDER_HOUR", 20))
    REMINDER_MINUTE = int(os.environ.get("REMINDER_MINUTE", 0))

    APP_PASSWORD_HASH = os.environ.get("APP_PASSWORD_HASH", "")
    PERMANENT_SESSION_LIFETIME_DAYS = int(os.environ.get("SESSION_LIFETIME_DAYS", 30))


# --- Ciclo del Pase de Batalla ---
CYCLE_START = date(2026, 9, 6)
CYCLE_END = date(2026, 12, 12)

# Cuántos días hacia atrás se puede registrar/editar (además de hoy)
RETROACTIVE_DAYS = 3

# Máximo de días entre semana (lun-vie) que se pueden marcar como "descanso"
# (equivale a exigir al menos 3 días de ejercicio entre semana). Sáb/dom
# nunca son día de ejercicio.
REST_DAYS_MAX_PER_WEEK = 2

DAILY_MAX_POINTS = 3

# Conductas en un día de ejercicio: 1 punto cada una (máx 3 pts/día)
HABITS_EXERCISE_DAY = [
    {"key": "ejercicio", "label": "Cumplir meta de ejercicio (20 min)", "weight": 1},
    {"key": "dos_comidas", "label": "Comer solo 2 veces al día (sin atracones ni refacciones)", "weight": 1},
    {"key": "plan_nutricional", "label": "Comer/beber solo lo permitido en el plan nutricional", "weight": 1},
]

# Conductas en un día de descanso: sin ejercicio, 1.5 puntos cada una (máx 3 pts/día)
HABITS_REST_DAY = [
    {"key": "dos_comidas", "label": "Comer solo 2 veces al día (sin atracones ni refacciones)", "weight": 1.5},
    {"key": "plan_nutricional", "label": "Comer/beber solo lo permitido en el plan nutricional", "weight": 1.5},
]

# Usado solo para iterar sobre todas las claves de conducta posibles
HABITS = HABITS_EXERCISE_DAY

# Hitos del Pase de Batalla (puntos acumulados, no semanales)
MILESTONES = [
    {
        "id": 1,
        "points": 40,
        "deadline": date(2026, 9, 25),
        "title": "Cena con amigos + Premier de SBR",
        "description": "Invitar amigos a comer y ver la premier de SBR.",
    },
    {
        "id": 2,
        "points": 95,
        "deadline": None,
        "title": "Booster Bundle de Delta Reign",
        "description": "Booster Bundle de Delta Reign.",
    },
    {
        "id": 3,
        "points": 175,
        "deadline": None,
        "title": "Vacaciones cortas",
        "description": "Dos días de vacaciones seguidos en diciembre.",
    },
    {
        "id": 4,
        "points": 220,
        "deadline": None,
        "title": "Eneagrama + Entrevista Conductual",
        "description": "Curso de Eneagrama y Entrevista Conductual (Dra. Froxán Parga).",
    },
    {
        "id": 5,
        "points": 260,
        "deadline": date(2026, 12, 12),
        "title": "Nintendo Switch 2 + OoT Remake",
        "description": "Nintendo Switch 2 + Remake de OoT para Navidad.",
    },
]
