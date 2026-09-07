from datetime import date
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class DailyLog(db.Model):
    __tablename__ = "daily_log"

    id = db.Column(db.Integer, primary_key=True)
    log_date = db.Column(db.Date, unique=True, nullable=False, default=date.today)

    is_exercise_day = db.Column(db.Boolean, default=True, nullable=False)

    ejercicio = db.Column(db.Boolean, default=False, nullable=False)
    dos_comidas = db.Column(db.Boolean, default=False, nullable=False)
    plan_nutricional = db.Column(db.Boolean, default=False, nullable=False)

    @property
    def points(self):
        if self.is_exercise_day:
            return float(self.ejercicio) + float(self.dos_comidas) + float(self.plan_nutricional)
        return 1.5 * float(self.dos_comidas) + 1.5 * float(self.plan_nutricional)

    def to_dict(self):
        return {
            "date": self.log_date.isoformat(),
            "is_exercise_day": self.is_exercise_day,
            "ejercicio": self.ejercicio,
            "dos_comidas": self.dos_comidas,
            "plan_nutricional": self.plan_nutricional,
            "points": self.points,
        }


class PushSubscription(db.Model):
    __tablename__ = "push_subscription"

    id = db.Column(db.Integer, primary_key=True)
    endpoint = db.Column(db.String(500), unique=True, nullable=False)
    p256dh = db.Column(db.String(255), nullable=False)
    auth = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_subscription_info(self):
        return {
            "endpoint": self.endpoint,
            "keys": {"p256dh": self.p256dh, "auth": self.auth},
        }
