# Imports
from flask import (
    Flask, render_template, redirect,
    request, url_for, flash, jsonify, abort
)
from flask_sqlalchemy import SQLAlchemy
from flask_login import (
    LoginManager, UserMixin, login_user,
    login_required, logout_user, current_user
)
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dateutil import parser  # pip install python-dateutil
from functools import wraps

# App
app = Flask(__name__)
app.secret_key = "qWeRASD"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_BINDS"] = {
    "tasks": "sqlite:///tasks.db",
}

db = SQLAlchemy(app)

# Flask-Login
login_manager = LoginManager(app)
login_manager.login_view = "home"  


# MODELE
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
    __bind_key__ = "tasks"
    __tablename__ = "tasks"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.ForeignKey('users.id')
    content = db.Column(db.String(100), nullable=False)
    complete = db.Column(db.Integer, default=0)
    description = db.Column(db.String(999), nullable=True)
    created = db.Column(db.DateTime, default=datetime.now )   # start
    end = db.Column(db.DateTime, nullable=True, default=datetime.now + timedelta(hours=1))  # end

    def __repr__(self) -> str:
        return f"Task {self.id}"

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def role_required(role_name):
    """
    Użycie:
    @login_required
    @role_required('Admin')
    def admin_panel(): ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(*args, **kwargs):
            if not current_user.is_authenticated:
                return login_manager.unauthorized()

            if current_user.role != role_name:
                abort(403)  # brak uprawnień
            return view_func(*args, **kwargs)
        return wrapped_view
    return decorator

# ROUTES

# index / logowanie
@app.route("/", methods=["GET", "POST"])
def home():
    if current_user.is_authenticated:
        return redirect(url_for("calendar_view"))

    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        user = User.query.filter_by(username=username).first()
        if user and user.check_passwd(password):
            login_user(user)  # <--- Flask-Login ogarnia sesję
            flash("Zalogowano pomyślnie", "success")
            return redirect(url_for("dashboard"))
        else:
            flash("Zły login lub hasło", "error")
            return redirect(url_for("home"))

    # GET
    return render_template("index.html")

#API TASKS
@app.route("/api/tasks")
@login_required
def api_tasks():
    user_id = current_user.id
    tasks = MyTask.query.filter_by(user_id=user_id).all()

    events = []
    for t in tasks:
        events.append({
            "id": t.id,
            "title": t.content,
            "start": t.created.isoformat(),
            "end": t.end.isoformat(),
            "complete": t.complete,
            "extendedProps": {
                "description": t.description or ""
            }
        })
    return jsonify(events)

# DASHBOARD – wymaga logowania
@app.route("/dashboard", methods=["GET", "POST"])
@login_required
def dashboard():
    user_id = current_user.id

    if request.method == "POST":
        current_task = request.form["content"]
        description = request.form["description"]

        new_task = MyTask(
            content=current_task,
            description=description,
            user_id=user_id,

        )

        try:
            db.session.add(new_task)
            db.session.commit()
            return redirect(url_for("dashboard"))
        except Exception as e:
            return f"Error: {e}"

    tasks = MyTask.query.filter_by(user_id=user_id).order_by(MyTask.created).all()
    return render_template("dashboard.html", task=tasks, user=current_user)


# USUWANIE TASKA
@app.route("/dashboard/delete/<int:id>")
@login_required
def delete(id: int):
    delete_task = MyTask.query.get_or_404(id)
    if delete_task.user_id != current_user.id:
        flash("Brak uprawnień do tego zadania", "error")
        return redirect(url_for("dashboard"))

    try:
        db.session.delete(delete_task)
        db.session.commit()
        return redirect(url_for("dashboard"))
    except Exception as e:
        return f"Error: {e}"

@app.route("/api/tasks/<int:task_id>/edit", methods=["POST"])
@login_required
def edit_task_api(task_id):
    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json()

    content = data.get("content", task.content)
    description = data.get("description", task.description or "")
    start = data.get("start")
    end = data.get("end")
    complete = data.get("complete", task.complete)  # 👈 klucz complete

    try:
        task.content = content
        task.description = description
        task.complete = complete

        if start:
            task.created = parser.isoparse(start)
        if end:
            task.end = parser.isoparse(end)

        db.session.commit()

        return jsonify({
            "id": task.id,
            "title": task.content,
            "content": task.content,
            "description": task.description,
            "start": task.created.isoformat(),
            "end": task.end.isoformat() if task.end else None,
            "complete": task.complete,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# EDYCJA TASKA
@app.route("/dashboard/edit/<int:id>", methods=["GET", "POST"])
@login_required
def edit(id: int):
    edit_task = MyTask.query.get_or_404(id)

    if edit_task.user_id != current_user.id:
        flash("Brak uprawnień do tego zadania", "error")
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        edit_task.content = request.form["content"]
        edit_task.description = request.form["description"]
        try:
            db.session.commit()
            return redirect(url_for("dashboard"))
        except Exception as e:
            return f"Error: {e}"

    # GET
    return render_template("edit.html", task=edit_task)


# REJESTRACJA
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        name = request.form["name"]
        surname = request.form["surname"]
        email = request.form["email"]

        # sprawdź, czy user istnieje
        user = User.query.filter_by(username=username).first()
        if user:
            flash("Użytkownik o takiej nazwie już istnieje", "error")
            return redirect(url_for("home"))

        new_user = User(
            username=username,
            email=email,
            name=name,
            surname=surname,
        )
        new_user.set_passwd(password)

        try:
            db.session.add(new_user)
            db.session.commit()
            flash("Konto utworzone, możesz się zalogować", "success")
            return redirect(url_for("home"))
        except Exception as e:
            return f"Error: {e}"

    return redirect(url_for("home"))

#WIDOK KALENDARZA
@app.route("/calendar")
@login_required
def calendar_view():
    return render_template("calendar.html")

#UPDATE TASKA
@app.route("/api/tasks/<int:task_id>/move", methods=["POST"])
@login_required
def move_task(task_id):
    data = request.get_json()
    new_start = data.get("start")
    new_end = data.get("end")  # możesz przysłać z frontu lub policzyć

    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        start_dt = parser.isoparse(new_start)

        if new_end:
            end_dt = parser.isoparse(new_end)

        task.created = start_dt
        task.end = end_dt

        db.session.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/tasks/<int:task_id>/resize", methods=["POST"])
@login_required
def resize_task(task_id):
    data = request.get_json()
    new_start = data.get("start")  # zwykle taki sam jak był
    new_end = data.get("end")

    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        if new_start:
            task.created = parser.isoparse(new_start)
        if new_end:
            task.end = parser.isoparse(new_end)

        db.session.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/tasks/create", methods=["POST"])
@login_required
def create_task():
    data = request.get_json()

    content = data.get("content")
    description = data.get("description") or ""
    start = data.get("start")   # ISO string z FullCalendar (info.dateStr)
    end = data.get("end")
    complete = data.get("complete", 0)

    if not content or not start:
        return jsonify({"error": "missing content or start"}), 400

    try:
        created_dt = parser.isoparse(start)   
                # to będzie pole created
        if end:
            end_dt = parser.isoparse(end)
        else:
            end_dt = created_dt + timedelta(hours=1)      # end = start + 1h

        task = MyTask(
            content=content,
            description=description,
            created=created_dt,
            end=end_dt,
            user_id=current_user.id,
            complete=complete,
        )

        db.session.add(task)
        db.session.commit()

        # API pod FullCalendar – tytuł = content, start = created
        return jsonify({
            "id": task.id,
            "title": task.content,   # ważne dla FC
            "content": task.content,
            "description": task.description,
            "start": task.created.isoformat(),
            "end": task.end.isoformat() if task.end else None,
            "complete": task.complete,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route("/api/tasks/<int:task_id>/duplicate", methods=["POST"])
@login_required
def duplicate_task(task_id):
    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        # jeśli chcesz identyczne godziny:
        new_created = task.created
        new_end = task.end

        # jeśli wolisz przesunięcie, np. +1h:
        # new_created = task.created + timedelta(hours=1)
        # new_end = task.end + timedelta(hours=1) if task.end else None

        new_task = MyTask(
            content=task.content,
            description=task.description,
            created=new_created,
            end=new_end,
            user_id=current_user.id,
            complete=task.complete,
        )

        db.session.add(new_task)
        db.session.commit()

        return jsonify({
            "id": new_task.id,
            "title": new_task.content,   # FullCalendar używa title
            "content": new_task.content,
            "description": new_task.description,
            "start": new_task.created.isoformat(),
            "end": new_task.end.isoformat() if new_task.end else None,
            "complete": new_task.complete,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route("/admin")
@login_required
@role_required('Admin')
def admin_panel():
    return render_template("admin.html")
@app.route("/api/tasks/<int:task_id>/delete", methods=["POST"])
@login_required
def delete_task(task_id):
    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# WYLOGOWANIE
@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Zostałeś wylogowany", "success")
    return redirect(url_for("home"))


# MAIN
if __name__ == "__main__":
    with app.app_context():
        db.create_all()

        admin_username = "admin"
        admin_password = "admin123"
        existing = User.query.filter_by(username=admin_username).first()

        if not existing:
            admin = User(
                username=admin_username,
                role="Admin",
                email="dawidciesielski21@gmail.com",
                name="Dawid",
                surname="Ciesielski",
            )
            admin.set_passwd(admin_password)
            db.session.add(admin)
            db.session.commit()

    app.run(debug=True)
