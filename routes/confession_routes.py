from flask import Blueprint, request, jsonify
from datetime import datetime
from config import supabase, ADMIN_KEY
from utils.filter import is_clean

confession_bp = Blueprint("confession_bp", __name__)

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

    try:
        supabase.table("confessions").insert({
            "confession": confession_text,
            "author": author,
            "display_name": display_name,
        }).execute()
        return jsonify({"message": "Confession added"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@confession_bp.route("/get_confessions", methods=["GET"])
def get_confessions():
    try:
        # Fetch confessions with comment count
        # Supabase allows selecting related count: comments(count)
        # Note: 'created_at' is used for reverse sort in UI logic if needed, but we sort by likes here as per original
        # Original: sort("likes", -1)
        response = supabase.table("confessions") \
            .select("*, comments(count)") \
            .order("likes", desc=True) \
            .execute()
        
        data = []
        for c in response.data:
            # Map Supabase response to frontend expected format
            # Using 'id' from Supabase (uuid) instead of '_id' (ObjectId) which frontend uses as str
            # comments(count) returns usually as [{'count': N}] or just count logic depending on query
            
            # The select("*, comments(count)") returns comments field as [{count: N}]
            c_count = c.get("comments", [{"count": 0}])
            if isinstance(c_count, list) and len(c_count) > 0:
                count = c_count[0].get("count", 0)
            else:
                count = 0

            data.append({
                "id": c["id"],
                "confession": c["confession"],
                "display_name": c.get("display_name", "Anonymous"),
                "likes": c["likes"],
                "dislikes": c["dislikes"],
                "comment_count": count
            })
            
        return jsonify(data), 200
    except Exception as e:
        print(e)
        return jsonify([]), 200


@confession_bp.route("/like/<confession_id>", methods=["POST"])
def like_confession(confession_id):
    user_ip = request.remote_addr
    
    try:
        # 1. Fetch current data to check IP
        res = supabase.table("confessions").select("liked_ips, likes").eq("id", confession_id).single().execute()
        if not res.data:
            return jsonify({"error": "Not found"}), 404
        
        row = res.data
        liked_ips = row.get("liked_ips") or []

        if user_ip in liked_ips:
            return jsonify({"error": "Already liked"}), 403

        # 2. Append IP and increment likes
        liked_ips.append(user_ip)
        new_likes = row["likes"] + 1

        supabase.table("confessions").update({
            "likes": new_likes,
            "liked_ips": liked_ips
        }).eq("id", confession_id).execute()

        return jsonify({"message": "Liked"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@confession_bp.route("/dislike/<confession_id>", methods=["POST"])
def dislike_confession(confession_id):
    user_ip = request.remote_addr

    try:
        res = supabase.table("confessions").select("disliked_ips, dislikes").eq("id", confession_id).single().execute()
        if not res.data:
            return jsonify({"error": "Not found"}), 404
        
        row = res.data
        disliked_ips = row.get("disliked_ips") or []

        if user_ip in disliked_ips:
            return jsonify({"error": "Already disliked"}), 403

        disliked_ips.append(user_ip)
        new_dislikes = row["dislikes"] + 1

        supabase.table("confessions").update({
            "dislikes": new_dislikes,
            "disliked_ips": disliked_ips
        }).eq("id", confession_id).execute()

        return jsonify({"message": "Disliked"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@confession_bp.route("/delete/<confession_id>", methods=["DELETE"])
def delete_confession(confession_id):
    key = request.args.get("key")
    if key != ADMIN_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        supabase.table("confessions").delete().eq("id", confession_id).execute()
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@confession_bp.route("/add_comment/<confession_id>", methods=["POST"])
def add_comment(confession_id):
    data = request.json or {}
    comment_text = data.get("comment", "").strip()

    if not comment_text:
        return jsonify({"error": "Empty comment"}), 400

    try:
        supabase.table("comments").insert({
            "confession_id": confession_id,
            "text": comment_text
        }).execute()
        return jsonify({"message": "Comment added"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@confession_bp.route("/get_comments/<confession_id>", methods=["GET"])
def get_comments(confession_id):
    try:
        # Fetch related comments
        res = supabase.table("comments") \
            .select("text, created_at") \
            .eq("confession_id", confession_id) \
            .order("created_at", desc=False) \
            .execute()
        
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify([]), 200
