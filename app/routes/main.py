from flask import Blueprint, render_template
from flask_login import login_required, current_user
from ..models import MyTask

main_bp = Blueprint('main', __name__)

@main_bp.route("/dashboard")
@login_required
def dashboard():
    tasks = MyTask.query.filter_by(user_id=current_user.id).all()
    return render_template("dashboard.html", task=tasks, user=current_user)

@main_bp.route("/calendar")
@login_required
def calendar_view():
    return render_template("calendar.html")