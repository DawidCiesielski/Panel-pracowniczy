from flask import Flask
from flask_login import LoginManager
from .models import db, User 

login_manager = LoginManager()

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///crm.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.secret_key = "qWeRASD"

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    from .routes.auth import auth_bp
    from .routes.main import main_bp
    from .routes.tasks_api import tasks_api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp) 
    app.register_blueprint(tasks_api_bp)

    return app

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))