from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_user, logout_user, login_required, current_user
from ..models import User, db

# Definiujemy Blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.calendar_view"))

    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_passwd(password):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page or url_for("main.calendar_view")) 
        
        flash("Zły login lub hasło", "error")
    return render_template("index.html")

@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Zostałeś wylogowany", "success")
    return redirect(url_for("auth.login"))