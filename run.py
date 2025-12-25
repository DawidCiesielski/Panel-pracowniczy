from app import create_app, db
from app.models import User

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

        admin_username = "admin"
        admin_password = "admin123"
        existing = User.query.filter_by(username=admin_username).first()
        with app.app_context():
            print(app.url_map)
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