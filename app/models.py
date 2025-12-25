from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, timedelta
from flask import Flask
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "qWeRASD"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_BINDS"] = {
    "tasks": "sqlite:///tasks.db",
}
db = SQLAlchemy()

class User(UserMixin, db.Model):      
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(80), unique=True, nullable=False)
    role = db.Column(db.String(25), default="User", nullable=False)
    name = db.Column(db.String(20), nullable=True)
    surname = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)

    def set_passwd(self, password):
        self.password_hash = generate_password_hash(password)

    def check_passwd(self, password):
        return check_password_hash(self.password_hash, password)


class MyTask(db.Model):
    __tablename__ = "tasks"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) # Relacja!
    content = db.Column(db.String(100), nullable=False)
    complete = db.Column(db.Integer, default=0)
    description = db.Column(db.String(999), nullable=True)
    created = db.Column(db.DateTime, default=datetime.now) 
    end = db.Column(db.DateTime, nullable=True, default=lambda: datetime.now() + timedelta(hours=1))

    def __repr__(self) -> str:
        return f"Task {self.id}"