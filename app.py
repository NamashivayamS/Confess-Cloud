from flask import Flask, render_template
from config import SECRET_KEY
from routes.confession_routes import confession_bp

app = Flask(__name__)
app.secret_key = SECRET_KEY

# Register API routes
app.register_blueprint(confession_bp)

# Home page (UI)
@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run()
