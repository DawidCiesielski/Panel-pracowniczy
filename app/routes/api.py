from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..models import MyTask, db
from dateutil import parser
from datetime import timedelta

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route("/tasks/all", methods=["GET"])
@login_required
def get_all_tasks():
    tasks = MyTask.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        "id": task.id,
        "title": task.content,
        "start": task.created.isoformat(),
        "end": task.end.isoformat() if task.end else None,
        "description": task.description,
        "complete": task.complete,
        "content": task.content
    } for task in tasks])

@api_bp.route("/tasks/<int:task_id>/edit", methods=["POST"])
@login_required
def edit_task(task_id):
    data = request.get_json()
    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        task.content = data.get("content")
        task.description = data.get("description", "")
        task.complete = data.get("complete", 0)
        
        if data.get("start"):
            task.created = parser.isoparse(data.get("start"))
        if data.get("end"):
            task.end = parser.isoparse(data.get("end"))

        db.session.commit()
        return jsonify({
            "id": task.id,
            "title": task.content,
            "start": task.created.isoformat(),
            "end": task.end.isoformat() if task.end else None,
            "complete": task.complete
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    
@api_bp.route("/tasks/<int:task_id>/delete", methods=["POST"])
@login_required
def delete_task(task_id):
    # Znajdź zadanie lub zwróć 404
    task = MyTask.query.get_or_404(task_id)

    # Sprawdź, czy zadanie należy do zalogowanego użytkownika
    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"status": "ok", "message": "Zadanie zostało usunięte"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@api_bp.route("/tasks/<int:task_id>/move", methods=["POST"])
@login_required
def move_task(task_id):
    data = request.get_json()
    new_start = data.get("start")
    new_end = data.get("end")

    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        if new_start:
            task.created = parser.isoparse(new_start)
        
        # Fixed: Only update end if it's actually provided in the request
        if new_end:
            task.end = parser.isoparse(new_end)

        db.session.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        db.session.rollback() # Always rollback on error
        return jsonify({"error": str(e)}), 400

@api_bp.route("/tasks/<int:task_id>/resize", methods=["POST"])
@login_required
def resize_task(task_id):
    data = request.get_json()
    new_start = data.get("start")
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
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@api_bp.route("/tasks/create", methods=["POST"])
@login_required
def create_task():
    data = request.get_json()
    content = data.get("content")
    description = data.get("description", "")
    start = data.get("start")
    end = data.get("end")
    complete = data.get("complete", 0)

    if not content or not start:
        return jsonify({"error": "missing content or start"}), 400

    try:
        created_dt = parser.isoparse(start)
        
        if end:
            end_dt = parser.isoparse(end)
        else:
            # Default to 1 hour duration if no end is provided
            end_dt = created_dt + timedelta(hours=1)

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

        return jsonify({
            "id": task.id,
            "title": task.content,
            "start": task.created.isoformat(),
            "end": task.end.isoformat() if task.end else None,
            "complete": task.complete,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@api_bp.route("/tasks/<int:task_id>/duplicate", methods=["POST"])
@login_required
def duplicate_task(task_id):
    task = MyTask.query.get_or_404(task_id)

    if task.user_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    try:
        new_task = MyTask(
            content=f"{task.content} (Copy)", # Added (Copy) for clarity
            description=task.description,
            created=task.created,
            end=task.end,
            user_id=current_user.id,
            complete=task.complete,
        )

        db.session.add(new_task)
        db.session.commit()

        return jsonify({
            "id": new_task.id,
            "title": new_task.content,
            "start": new_task.created.isoformat(),
            "end": new_task.end.isoformat() if new_task.end else None,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500