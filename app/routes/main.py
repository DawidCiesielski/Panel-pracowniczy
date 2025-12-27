from flask import Blueprint, render_template
from flask_login import login_required, current_user
from flask import redirect, url_for
from ..models import MyTask

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return redirect(url_for('auth.login'))

@main_bp.route("/kalendarz")
@login_required
def calendar_view():
    tasks = MyTask.query.filter_by(user_id=current_user.id).all()
    return render_template("calendar.html", task=tasks, user=current_user)

@main_bp.route("/profile")
@login_required
def profile():
    return render_template("profile.html", user=current_user)