from flask import Blueprint, request, jsonify
from datetime import datetime
from config import db, ADMIN_KEY
from utils.filter import is_clean
from bson import ObjectId


confession_bp = Blueprint("confession_bp", __name__)
confessions = db.confessions


@confession_bp.route("/add_confession", methods=["POST"])
def add_confession():
    data = request.json or {}

    confession_text = data.get("confession", "").strip()
    author = data.get("author", "").strip()          # hidden
    display_name = data.get("display_name", "").strip()  # visible

    if not confession_text or not author or not display_name:
        return jsonify({"error": "Missing fields"}), 400

    # filter bad words in confession & name
    if not is_clean(confession_text) or not is_clean(display_name):
        return jsonify({"error": "Inappropriate content detected"}), 400

    confessions.insert_one({
        "confession": confession_text,
        "author": author,               # hidden
        "display_name": display_name,   # public
        "likes": 0,
        "dislikes": 0,
        "liked_ips": [],
        "disliked_ips": [],
        "comments": [],
        "created_at": datetime.utcnow()
    })

    return jsonify({"message": "Confession added"}), 201



@confession_bp.route("/get_confessions", methods=["GET"])
def get_confessions():
    data = []

    for c in confessions.find().sort("likes", -1):
        comments = c.get("comments", [])
        data.append({
            "id": str(c["_id"]),
            "confession": c["confession"],
            "display_name": c.get("display_name", "Anonymous"),
            "likes": c["likes"],
            "dislikes": c["dislikes"],
            "comment_count": len(comments)
        })

    return jsonify(data), 200



@confession_bp.route("/like/<confession_id>", methods=["POST"])
def like_confession(confession_id):

    if not ObjectId.is_valid(confession_id):
        return jsonify({"error": "Invalid ID"}), 400

    user_ip = request.remote_addr
    confession = confessions.find_one({"_id": ObjectId(confession_id)})

    if not confession:
        return jsonify({"error": "Not found"}), 404

    if user_ip in confession.get("liked_ips", []):
        return jsonify({"error": "Already liked"}), 403

    confessions.update_one(
        {"_id": ObjectId(confession_id)},
        {
            "$inc": {"likes": 1},
            "$push": {"liked_ips": user_ip}
        }
    )

    return jsonify({"message": "Liked"}), 200


@confession_bp.route("/dislike/<confession_id>", methods=["POST"])
def dislike_confession(confession_id):

    if not ObjectId.is_valid(confession_id):
        return jsonify({"error": "Invalid ID"}), 400

    user_ip = request.remote_addr
    confession = confessions.find_one({"_id": ObjectId(confession_id)})

    if not confession:
        return jsonify({"error": "Not found"}), 404

    if user_ip in confession.get("disliked_ips", []):
        return jsonify({"error": "Already disliked"}), 403

    confessions.update_one(
        {"_id": ObjectId(confession_id)},
        {
            "$inc": {"dislikes": 1},
            "$push": {"disliked_ips": user_ip}
        }
    )

    return jsonify({"message": "Disliked"}), 200


@confession_bp.route("/delete/<confession_id>", methods=["DELETE"])
def delete_confession(confession_id):

    if not ObjectId.is_valid(confession_id):
        return jsonify({"error": "Invalid ID"}), 400

    key = request.args.get("key")

    if key != ADMIN_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    confessions.delete_one({"_id": ObjectId(confession_id)})
    return jsonify({"message": "Deleted"}), 200

@confession_bp.route("/add_comment/<confession_id>", methods=["POST"])
def add_comment(confession_id):

    if not ObjectId.is_valid(confession_id):
        return jsonify({"error": "Invalid ID"}), 400

    data = request.json or {}
    comment = data.get("comment", "").strip()

    if not comment:
        return jsonify({"error": "Empty comment"}), 400

    confessions.update_one(
        {"_id": ObjectId(confession_id)},
        {"$push": {"comments": {
            "text": comment,
            "created_at": datetime.utcnow()
        }}}
    )

    return jsonify({"message": "Comment added"}), 201


@confession_bp.route("/get_comments/<confession_id>", methods=["GET"])
def get_comments(confession_id):

    if not ObjectId.is_valid(confession_id):
        return jsonify({"error": "Invalid ID"}), 400

    confession = confessions.find_one(
        {"_id": ObjectId(confession_id)},
        {"comments": 1}
    )

    return jsonify(confession.get("comments", [])), 200
