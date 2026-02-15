from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import sqlite3
import requests
import json
import os

app = Flask(__name__)
app.secret_key = 'supersecretkey'  # کلید رمزنگاری سشن‌ها

# --- Database Setup ---
def init_db():
    """ایجاد دیتابیس و جدول کاربران در صورت عدم وجود"""
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# اجرای تابع ساخت دیتابیس در لحظه شروع برنامه
init_db()

# --- Authentication Routes ---

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('map_view'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
        user = c.fetchone()
        conn.close()
        
        if user:
            session['username'] = username
            return redirect(url_for('map_view'))
        else:
            flash('نام کاربری یا رمز عبور اشتباه است.', 'danger')
            
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        try:
            conn = sqlite3.connect('users.db')
            c = conn.cursor()
            c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
            conn.commit()
            conn.close()
            flash('حساب کاربری با موفقیت ساخته شد. اکنون وارد شوید.', 'success')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash('این نام کاربری قبلاً ثبت شده است.', 'warning')
        except Exception as e:
            flash(f'خطا در ثبت نام: {e}', 'danger')
            
    return render_template('signup.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

# --- Map & Proxy Routes ---

@app.route('/map')
def map_view():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('map.html', username=session['username'])

@app.route('/proxy_request')
def proxy_request():
    target_url = request.args.get('url')
    if not target_url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        resp = requests.get(target_url, timeout=30)
        # تلاش برای دیکد کردن JSON، اگر نشد متن خام را برمی‌گرداند
        try:
            return jsonify(resp.json())
        except json.JSONDecodeError:
            return resp.content, resp.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
