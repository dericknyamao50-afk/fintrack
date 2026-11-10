from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///fintrack.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'fintrack-secret-key-change-this'

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# MODELS
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    type = db.Column(db.String(20), nullable=False) # income / expense
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(200))
    date = db.Column(db.String(20), default=lambda: datetime.now().strftime("%Y-%m-%d"))

with app.app_context():
    db.create_all()

# AUTH
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"msg": "Email already exists"}), 400
    hashed = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    user = User(name=data['name'], email=data['email'], password=hashed)
    db.session.add(user)
    db.session.commit()
    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "name": user.name, "email": user.email}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        token = create_access_token(identity=str(user.id))
        return jsonify({"token": token, "name": user.name, "email": user.email})
    return jsonify({"msg": "Wrong email or password"}), 401

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    return jsonify({"name": user.name, "email": user.email})

# TRANSACTIONS
@app.route('/api/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    uid = int(get_jwt_identity())
    txs = Transaction.query.filter_by(user_id=uid).order_by(Transaction.id.desc()).all()
    return jsonify([{"id": t.id, "type": t.type, "amount": t.amount, "category": t.category, "description": t.description, "date": t.date} for t in txs])

@app.route('/api/transactions', methods=['POST'])
@jwt_required()
def add_transaction():
    uid = int(get_jwt_identity())
    data = request.get_json()
    t = Transaction(user_id=uid, type=data['type'], amount=float(data['amount']), category=data['category'], description=data.get('description',''), date=data.get('date', datetime.now().strftime("%Y-%m-%d")))
    db.session.add(t)
    db.session.commit()
    return jsonify({"msg": "Added", "id": t.id}), 201

@app.route('/api/transactions/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_transaction(id):
    uid = int(get_jwt_identity())
    t = Transaction.query.filter_by(id=id, user_id=uid).first()
    if not t:
        return jsonify({"msg": "Not found"}), 404
    db.session.delete(t)
    db.session.commit()
    return jsonify({"msg": "Deleted"})

@app.route('/api/summary', methods=['GET'])
@jwt_required()
def summary():
    uid = int(get_jwt_identity())
    txs = Transaction.query.filter_by(user_id=uid).all()
    income = sum(t.amount for t in txs if t.type == 'income')
    expense = sum(t.amount for t in txs if t.type == 'expense')
    return jsonify({"income": income, "expense": expense, "balance": income - expense, "count": len(txs)})

# CURRENCY - External API
@app.route('/api/exchange', methods=['GET'])
# CURRENCY - External API (supports KES)
@app.route('/api/exchange', methods=['GET'])
def exchange():
    frm = request.args.get('from', 'KES')
    to = request.args.get('to', 'USD')
    amount = float(request.args.get('amount', 1))
    try:
        # open.er-api.com supports KES, USD, EUR, GBP, UGX, TZS - free, no key
        r = requests.get(f"https://open.er-api.com/v6/latest/{frm}", timeout=8)
        data = r.json()
        rate = data['rates'][to]
        return jsonify({"from": frm, "to": to, "amount": amount, "rate": rate, "converted": amount * rate})
    except Exception as e:
        return jsonify({"msg": "Exchange API failed", "error": str(e)}), 500

@app.route('/')
def home():
    return jsonify({"msg": "Fintrack API is running!"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)