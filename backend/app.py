from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
from flask_mysqldb import MySQL
import hashlib
import os
import csv
import io
from datetime import datetime, timedelta
import pandas as pd
import jwt
from functools import wraps
import random
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = 'root@123'
app.config['MYSQL_DB'] = 'salescrm_new'
app.config['UPLOAD_FOLDER'] = 'uploads'

JWT_SECRET = 'your_jwt_secret_key_here'
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 36000

# Enable CORS
CORS(app, supports_credentials=True)

# Initialize MySQL
mysql = MySQL(app)

def md5_hash(text):
    """Generate MD5 hash for password encryption"""
    return hashlib.md5(text.encode()).hexdigest()

def create_tables():
    """Create all necessary tables"""
    cur = mysql.connection.cursor()
    
    # Create databases table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS `databases` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type ENUM('corporate', 'institution') NOT NULL,
            file_path VARCHAR(500),
            description TEXT,
            uploaded_by INT,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create calls table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS calls (
            id INT AUTO_INCREMENT PRIMARY KEY,
            call_id VARCHAR(255) UNIQUE,
            client_name VARCHAR(255) NOT NULL,
            phone_number VARCHAR(20) NOT NULL,
            email VARCHAR(255),
            department VARCHAR(100),
            city VARCHAR(100),
            institution_name VARCHAR(255),
            database_id INT,
            assigned_to INT,
            status ENUM('fresh', 'follow_up', 'demo', 'proposal', 'negotiation', 'closure', 'converted') DEFAULT 'fresh',
            disposition VARCHAR(100),
            notes TEXT,
            called_date DATETIME,
            follow_up_date DATETIME,
            demo_date DATETIME,
            proposal_date DATETIME,
            negotiation_date DATETIME,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create call_history table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS call_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            call_id INT,
            user_id INT,
            disposition VARCHAR(100),
            notes TEXT,
            call_duration INT,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create disposition_counts table to track how many times each disposition is selected
    cur.execute("""
        CREATE TABLE IF NOT EXISTS disposition_counts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            call_id INT,
            disposition VARCHAR(100),
            count INT DEFAULT 1,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_call_disposition (call_id, disposition)
        )
    """)
    
    # Create communication table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS communications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            call_id INT,
            user_id INT,
            type ENUM('whatsapp', 'email', 'call') NOT NULL,
            message TEXT,
            subject VARCHAR(255),
            status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
            attachment_path VARCHAR(500),
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create templates table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type ENUM('whatsapp', 'email') NOT NULL,
            subject VARCHAR(255),
            content TEXT NOT NULL,
            created_by INT,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create files table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category VARCHAR(255) NOT NULL,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create category table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS category (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category VARCHAR(255) NOT NULL,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Add online_status column to employee if not exists
    cur.execute("SHOW COLUMNS FROM employee LIKE 'online_status'")
    result = cur.fetchone()
    if not result:
        cur.execute("ALTER TABLE employee ADD COLUMN online_status ENUM('online','offline') DEFAULT 'offline'")
        mysql.connection.commit()
    
    mysql.connection.commit()
    cur.close()

# Create tables on startup
with app.app_context():
    create_tables()

# Add a table for password reset OTPs
# (You should run this SQL in your DB as a migration or on startup)
def create_password_reset_table():
    cur = mysql.connection.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS password_reset_otps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            otp VARCHAR(10) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    mysql.connection.commit()
    cur.close()

with app.app_context():
    create_password_reset_table()

# Helper: JWT encode
def generate_jwt(user_data):
    payload = user_data.copy()
    payload['exp'] = datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Helper: JWT decode
def decode_jwt(token):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

# Decorator for protected routes
def jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', None)
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        token = auth_header.split(' ')[1]
        try:
            user = decode_jwt(token)
            request.user = user
        except Exception as e:
            return jsonify({'error': 'Invalid or expired token'}), 401
        return f(*args, **kwargs)
    return decorated_function

def get_user_from_request():
    return getattr(request, 'user', None)

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        hashed_password = md5_hash(password)
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT id, empid, full_name, email, user_type, user_role, department, 
                   profile_picture, status, active, Company_id, online_status
            FROM employee 
            WHERE email = %s AND password = %s AND active = 'active'
        """, (email, hashed_password))
        user = cur.fetchone()
        if user:
            # Set online_status to 'online'
            cur.execute("UPDATE employee SET online_status = 'online' WHERE id = %s", (user[0],))
            mysql.connection.commit()
            # Fetch updated user data with online_status
            cur.execute("""
                SELECT id, empid, full_name, email, user_type, user_role, department, 
                       profile_picture, status, active, Company_id, online_status
                FROM employee 
                WHERE id = %s
            """, (user[0],))
            updated_user = cur.fetchone()
        cur.close()
        if user:
            user_data = {
                'id': updated_user[0],
                'empid': updated_user[1],
                'full_name': updated_user[2],
                'email': updated_user[3],
                'user_type': updated_user[4],
                'user_role': updated_user[5],
                'department': updated_user[6],
                'profile_picture': updated_user[7],
                'status': updated_user[8],
                'active': updated_user[9],
                'company_id': updated_user[10],
                'online_status': updated_user[11] or 'online'
            }
            token = generate_jwt(user_data)
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'user': user_data,
                'token': token
            })
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    user = get_user_from_request()
    if user:
        cur = mysql.connection.cursor()
        cur.execute("UPDATE employee SET online_status = 'offline' WHERE id = %s", (user['id'],))
        mysql.connection.commit()
        cur.close()
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/check-auth', methods=['GET'])
@jwt_required
def check_auth():
    user = request.user
    # Fetch latest user data including online_status
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT id, empid, full_name, email, user_type, user_role, department, 
               profile_picture, status, active, Company_id, online_status
        FROM employee 
        WHERE id = %s
    """, (user['id'],))
    updated_user = cur.fetchone()
    cur.close()
    
    if updated_user:
        user_data = {
            'id': updated_user[0],
            'empid': updated_user[1],
            'full_name': updated_user[2],
            'email': updated_user[3],
            'user_type': updated_user[4],
            'user_role': updated_user[5],
            'department': updated_user[6],
            'profile_picture': updated_user[7],
            'status': updated_user[8],
            'active': updated_user[9],
            'company_id': updated_user[10],
            'online_status': updated_user[11] or 'online'
        }
    else:
        user_data = user
    
    return jsonify({
        'authenticated': True,
        'user': user_data
    })

# Database Management APIs
@app.route('/api/databases', methods=['GET'])
@jwt_required
def get_databases():
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager':
            cur.execute("""
                SELECT d.*, e.full_name as uploaded_by_name
                FROM `databases` d
                LEFT JOIN employee e ON d.uploaded_by = e.id
                ORDER BY d.created_date DESC
            """)
        else:
            # Get all databases uploaded by the user OR where the user is assigned to at least one call
            cur.execute("""
                SELECT DISTINCT d.*, e.full_name as uploaded_by_name
                FROM `databases` d
                LEFT JOIN employee e ON d.uploaded_by = e.id
                LEFT JOIN calls c ON c.database_id = d.id
                WHERE d.uploaded_by = %s OR c.assigned_to = %s
                ORDER BY d.created_date DESC
            """, (user['id'], user['id']))
        databases = []
        for row in cur.fetchall():
            databases.append({
                'id': row[0],
                'name': row[1],
                'type': row[2],
                'file_path': row[3],
                'description': row[4],
                'uploaded_by': row[5],
                'created_date': row[6].strftime('%Y-%m-%d %H:%M:%S'),
                'category': row[7],
                'uploaded_by_name': row[8]
            })
        cur.close()
        return jsonify({'databases': databases})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/databases', methods=['POST'])
@jwt_required
def upload_database():
    try:
        user = get_user_from_request()
        if user['user_role'] not in ['sales_manager', 'sales_executive']:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.form
        file = request.files.get('file')
        
        if not file:
            return jsonify({'error': 'No file uploaded'}), 400
        
        db_type = data.get('type')
        if not db_type:
            return jsonify({'error': 'Database type is required'}), 400
        db_name = data.get('name')
        if not db_name:
            return jsonify({'error': 'Database name is required'}), 400
        db_category = data.get('category')
        if db_category is None:
            db_category = ''
        
        # Save file
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        file.save(file_path)
        
        # Insert database record
        cur = mysql.connection.cursor()
        cur.execute("""
            INSERT INTO `databases` (name, type, file_path, description, category, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            db_name,
            db_type,
            file_path,
            data.get('description', ''),
            db_category,
            user['id']
        ))
        
        database_id = cur.lastrowid
        
        # Process CSV/Excel file and insert calls
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
        
        # Normalize columns
        df.columns = df.columns.str.strip().str.lower()
        
        # Define required columns and mapping for each type
        if db_type == 'corporate':  # B2B
            required_columns = ['company name', 'contact person', 'phone number', 'email', 'designation']
        elif db_type == 'institution':  # B2C
            required_columns = ['client name', 'phone number', 'email', 'department', 'company name', 'city']
        else:
            return jsonify({'error': 'Invalid database type'}), 400
        
        # Validate columns
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            return jsonify({'error': f'Missing required columns: {', '.join(missing_cols)}'}), 400
        
        # Insert calls
        for idx, row in df.iterrows():
            call_id = f"CALL_{datetime.now().strftime('%Y%m%d%H%M%S')}_{database_id}_{idx}"
            if db_type == 'corporate':  # B2B
                cur.execute("""
                    INSERT INTO calls (call_id, type, company_name, contact_person, phone_number, email, designation, database_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'fresh')
                """, (
                    call_id,
                    'B2B',
                    row.get('company name', ''),
                    row.get('contact person', ''),
                    row.get('phone number', ''),
                    row.get('email', ''),
                    row.get('designation', ''),
                    database_id
                ))
            elif db_type == 'institution':  # B2C
                cur.execute("""
                    INSERT INTO calls (call_id, type, client_name, phone_number, email, department, company_name, city, database_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'fresh')
                """, (
                    call_id,
                    'B2C',
                    row.get('client name', ''),
                    row.get('phone number', ''),
                    row.get('email', ''),
                    row.get('department', ''),
                    row.get('company name', ''),
                    row.get('city', ''),
                    database_id
                ))
        
        mysql.connection.commit()
        cur.close()
        
        return jsonify({'success': True, 'message': 'Database uploaded successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/databases/<int:db_id>/calls', methods=['GET'])
@jwt_required
def get_database_calls(db_id):
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager':
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.database_id = %s
                ORDER BY c.created_date DESC
            """, (db_id,))
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.database_id = %s AND c.assigned_to = %s
                ORDER BY c.created_date DESC
            """, (db_id, user['id']))
        calls = []
        for row in cur.fetchall():
            # Get column names to map correctly
            column_names = [desc[0] for desc in cur.description]
            
            # Create a dictionary mapping column names to values
            row_dict = dict(zip(column_names, row))
            
            calls.append({
                'id': row_dict['id'],
                'call_id': row_dict['call_id'],
                'client_name': row_dict['client_name'],
                'phone_number': row_dict['phone_number'],
                'email': row_dict['email'],
                'department': row_dict['department'],
                'city': row_dict['city'],
                'institution_name': row_dict['institution_name'],
                'database_id': row_dict['database_id'],
                'assigned_to': row_dict['assigned_to'],
                'status': row_dict['status'],
                'disposition': row_dict['disposition'],
                'notes': row_dict['notes'],
                'called_date': row_dict['called_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['called_date'] else None,
                'follow_up_date': row_dict['follow_up_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['follow_up_date'] else None,
                'demo_date': row_dict['demo_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['demo_date'] else None,
                'proposal_date': row_dict['proposal_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['proposal_date'] else None,
                'negotiation_date': row_dict['negotiation_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['negotiation_date'] else None,
                'created_date': row_dict['created_date'].strftime('%Y-%m-%d %H:%M:%S'),
                'type': row_dict.get('type'),
                'company_name': row_dict.get('company_name'),
                'contact_person': row_dict.get('contact_person'),
                'designation': row_dict.get('designation'),
                'assigned_to_name': row_dict.get('assigned_to_name')
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/assign', methods=['POST'])
@jwt_required
def assign_calls():
    try:
        user = get_user_from_request()
        data = request.get_json()
        call_ids = data.get('call_ids', [])
        user_ids = data.get('user_ids', [])
        
        if not call_ids or not user_ids:
            return jsonify({'error': 'Call IDs and user IDs are required'}), 400
        
        cur = mysql.connection.cursor()
        
        # Check if user is authorized to assign these calls
        if user['user_role'] != 'sales_manager':
            # For sales executives, check if they uploaded the database containing these calls
            if call_ids:
                cur.execute("""
                    SELECT DISTINCT d.uploaded_by 
                    FROM calls c 
                    JOIN `databases` d ON c.database_id = d.id 
                    WHERE c.id IN ({})
                """.format(','.join(['%s'] * len(call_ids))), call_ids)
                
                db_uploaders = [row[0] for row in cur.fetchall()]
                
                # Check if all calls belong to databases uploaded by the current user
                if not db_uploaders or not all(uploader == user['id'] for uploader in db_uploaders):
                    cur.close()
                    return jsonify({'error': 'Unauthorized - You can only assign calls from databases you uploaded'}), 401
        
        # Distribute calls equally among selected employees
        assignments = {uid: [] for uid in user_ids}
        for idx, call_id in enumerate(call_ids):
            uid = user_ids[idx % len(user_ids)]
            assignments[uid].append(call_id)
        
        for uid, cids in assignments.items():
            if cids:
                cur.execute(
                    f"""
                    UPDATE calls SET assigned_to = %s WHERE id IN ({','.join(['%s']*len(cids))})
                    """,
                    [uid] + cids
                )
        
        mysql.connection.commit()
        cur.close()
        summary = {str(uid): len(cids) for uid, cids in assignments.items()}
        return jsonify({'success': True, 'message': f'Calls assigned equally', 'details': summary})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Call Management APIs
@app.route('/api/calls/fresh', methods=['GET'])
@jwt_required
def get_fresh_calls():
    try:
        user = get_user_from_request()
        all_param = request.args.get('all')
        assigned_to = request.args.get('assigned_to')
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager' and all_param == '1':
            if assigned_to:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'fresh' AND c.assigned_to = %s
                    ORDER BY c.created_date DESC
                """, (assigned_to,))
            else:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'fresh'
                    ORDER BY c.created_date DESC
                """)
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s AND c.status = 'fresh'
                ORDER BY c.created_date DESC
            """, (user['id'],))
        calls = []
        for row in cur.fetchall():
            calls.append({
                'id': row[0],
                'call_id': row[1],
                'client_name': row[2],
                'phone_number': row[3],
                'email': row[4],
                'department': row[5],
                'city': row[6],
                'institution_name': row[7],
                'database_id': row[8],
                'assigned_to': row[9],
                'status': row[10],
                'disposition': row[11],
                'notes': row[12],
                'called_date': row[13].strftime('%Y-%m-%d %H:%M:%S') if row[13] else None,
                'follow_up_date': row[14].strftime('%Y-%m-%d %H:%M:%S') if row[14] else None,
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S'),
                'type': row[16],
                'company_name': row[17],
                'contact_person': row[18],
                'designation': row[19],
                'assigned_to_name': row[20]
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/follow-up', methods=['GET'])
@jwt_required
def get_follow_up_calls():
    try:
        user = get_user_from_request()
        all_param = request.args.get('all')
        assigned_to = request.args.get('assigned_to')
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager' and all_param == '1':
            if assigned_to:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'follow_up' AND c.assigned_to = %s
                    ORDER BY c.follow_up_date ASC
                """, (assigned_to,))
            else:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'follow_up'
                    ORDER BY c.follow_up_date ASC
                """)
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s AND c.status = 'follow_up'
                ORDER BY c.follow_up_date ASC
            """, (user['id'],))
        calls = []
        for row in cur.fetchall():
            calls.append({
                'id': row[0],
                'call_id': row[1],
                'client_name': row[2],
                'phone_number': row[3],
                'email': row[4],
                'department': row[5],
                'city': row[6],
                'institution_name': row[7],
                'database_id': row[8],
                'assigned_to': row[9],
                'status': row[10],
                'disposition': row[11],
                'notes': row[12],
                'called_date': row[13].strftime('%Y-%m-%d %H:%M:%S') if row[13] else None,
                'follow_up_date': row[14].strftime('%Y-%m-%d %H:%M:%S') if row[14] else None,
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S'),
                'type': row[16],
                'company_name': row[17],
                'contact_person': row[18],
                'designation': row[19],
                'assigned_to_name': row[20]
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/closure', methods=['GET'])
@jwt_required
def get_closure_calls():
    try:
        user = get_user_from_request()
        all_param = request.args.get('all')
        assigned_to = request.args.get('assigned_to')
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager' and all_param == '1':
            if assigned_to:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'closure' AND c.assigned_to = %s
                    ORDER BY c.created_date DESC
                """, (assigned_to,))
            else:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'closure'
                    ORDER BY c.created_date DESC
                """)
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s AND c.status = 'closure'
                ORDER BY c.created_date DESC
            """, (user['id'],))
        calls = []
        for row in cur.fetchall():
            calls.append({
                'id': row[0],
                'call_id': row[1],
                'client_name': row[2],
                'phone_number': row[3],
                'email': row[4],
                'department': row[5],
                'city': row[6],
                'institution_name': row[7],
                'database_id': row[8],
                'assigned_to': row[9],
                'status': row[10],
                'disposition': row[11],
                'notes': row[12],
                'called_date': row[13].strftime('%Y-%m-%d %H:%M:%S') if row[13] else None,
                'follow_up_date': row[14].strftime('%Y-%m-%d %H:%M:%S') if row[14] else None,
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S'),
                'type': row[16],
                'company_name': row[17],
                'contact_person': row[18],
                'designation': row[19],
                'assigned_to_name': row[20]
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/demo', methods=['GET'])
@jwt_required
def get_demo_calls():
    try:
        user = get_user_from_request()
        all_param = request.args.get('all')
        assigned_to = request.args.get('assigned_to')
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager' and all_param == '1':
            if assigned_to:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'demo' AND c.assigned_to = %s
                    ORDER BY c.demo_date ASC
                """, (assigned_to,))
            else:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'demo'
                    ORDER BY c.demo_date ASC
                """)
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s AND c.status = 'demo'
                ORDER BY c.demo_date ASC
            """, (user['id'],))
        calls = []
        for row in cur.fetchall():
            calls.append({
                'id': row[0],
                'call_id': row[1],
                'client_name': row[2],
                'phone_number': row[3],
                'email': row[4],
                'department': row[5],
                'city': row[6],
                'institution_name': row[7],
                'database_id': row[8],
                'assigned_to': row[9],
                'status': row[10],
                'disposition': row[11],
                'notes': row[12],
                'called_date': row[13].strftime('%Y-%m-%d %H:%M:%S') if row[13] else None,
                'follow_up_date': row[14].strftime('%Y-%m-%d %H:%M:%S') if row[14] else None,
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S') if row[15] else None,
                'type': row[16] if len(row) > 16 else None,
                'company_name': row[17] if len(row) > 17 else None,
                'contact_person': row[18] if len(row) > 18 else None,
                'designation': row[19] if len(row) > 19 else None,
                'demo_date': row[20].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 20 and row[20] else None,
                'proposal_date': row[21].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 21 and row[21] else None,
                'negotiation_date': row[22].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 22 and row[22] else None,
                'assigned_to_name': row[23] if len(row) > 23 else None
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/proposal', methods=['GET'])
@jwt_required
def get_proposal_calls():
    try:
        user = get_user_from_request()
        all_param = request.args.get('all')
        assigned_to = request.args.get('assigned_to')
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager' and all_param == '1':
            if assigned_to:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'proposal' AND c.assigned_to = %s
                    ORDER BY c.proposal_date ASC
                """, (assigned_to,))
            else:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'proposal'
                    ORDER BY c.proposal_date ASC
                """)
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s AND c.status = 'proposal'
                ORDER BY c.proposal_date ASC
            """, (user['id'],))
        calls = []
        for row in cur.fetchall():
            calls.append({
                'id': row[0],
                'call_id': row[1],
                'client_name': row[2],
                'phone_number': row[3],
                'email': row[4],
                'department': row[5],
                'city': row[6],
                'institution_name': row[7],
                'database_id': row[8],
                'assigned_to': row[9],
                'status': row[10],
                'disposition': row[11],
                'notes': row[12],
                'called_date': row[13].strftime('%Y-%m-%d %H:%M:%S') if row[13] else None,
                'follow_up_date': row[14].strftime('%Y-%m-%d %H:%M:%S') if row[14] else None,
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S') if row[15] else None,
                'type': row[16] if len(row) > 16 else None,
                'company_name': row[17] if len(row) > 17 else None,
                'contact_person': row[18] if len(row) > 18 else None,
                'designation': row[19] if len(row) > 19 else None,
                'demo_date': row[20].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 20 and row[20] else None,
                'proposal_date': row[21].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 21 and row[21] else None,
                'negotiation_date': row[22].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 22 and row[22] else None,
                'assigned_to_name': row[23] if len(row) > 23 else None
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/negotiation', methods=['GET'])
@jwt_required
def get_negotiation_calls():
    try:
        user = get_user_from_request()
        all_param = request.args.get('all')
        assigned_to = request.args.get('assigned_to')
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager' and all_param == '1':
            if assigned_to:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'negotiation' AND c.assigned_to = %s
                    ORDER BY c.negotiation_date ASC
                """, (assigned_to,))
            else:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'negotiation'
                    ORDER BY c.negotiation_date ASC
                """)
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s AND c.status = 'negotiation'
                ORDER BY c.negotiation_date ASC
            """, (user['id'],))
        calls = []
        for row in cur.fetchall():
            calls.append({
                'id': row[0],
                'call_id': row[1],
                'client_name': row[2],
                'phone_number': row[3],
                'email': row[4],
                'department': row[5],
                'city': row[6],
                'institution_name': row[7],
                'database_id': row[8],
                'assigned_to': row[9],
                'status': row[10],
                'disposition': row[11],
                'notes': row[12],
                'called_date': row[13].strftime('%Y-%m-%d %H:%M:%S') if row[13] else None,
                'follow_up_date': row[14].strftime('%Y-%m-%d %H:%M:%S') if row[14] else None,
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S') if row[15] else None,
                'type': row[16] if len(row) > 16 else None,
                'company_name': row[17] if len(row) > 17 else None,
                'contact_person': row[18] if len(row) > 18 else None,
                'designation': row[19] if len(row) > 19 else None,
                'demo_date': row[20].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 20 and row[20] else None,
                'proposal_date': row[21].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 21 and row[21] else None,
                'negotiation_date': row[22].strftime('%Y-%m-%d %H:%M:%S') if len(row) > 22 and row[22] else None,
                'assigned_to_name': row[23] if len(row) > 23 else None
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/converted', methods=['GET'])
@jwt_required
def get_converted_calls():
    try:
        user = get_user_from_request()
        all_param = request.args.get('all')
        assigned_to = request.args.get('assigned_to')
        cur = mysql.connection.cursor()
        if user['user_role'] == 'sales_manager' and all_param == '1':
            if assigned_to:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'converted' AND c.assigned_to = %s
                    ORDER BY c.created_date DESC
                """, (assigned_to,))
            else:
                cur.execute("""
                    SELECT c.*, e.full_name as assigned_to_name
                    FROM calls c
                    LEFT JOIN employee e ON c.assigned_to = e.id
                    WHERE c.status = 'converted'
                    ORDER BY c.created_date DESC
                """)
        else:
            cur.execute("""
                SELECT c.*, e.full_name as assigned_to_name
                FROM calls c
                LEFT JOIN employee e ON c.assigned_to = e.id
                WHERE c.assigned_to = %s AND c.status = 'converted'
                ORDER BY c.created_date DESC
            """, (user['id'],))
        calls = []
        for row in cur.fetchall():
            calls.append({
                'id': row[0],
                'call_id': row[1],
                'client_name': row[2],
                'phone_number': row[3],
                'email': row[4],
                'department': row[5],
                'city': row[6],
                'institution_name': row[7],
                'database_id': row[8],
                'assigned_to': row[9],
                'status': row[10],
                'disposition': row[11],
                'notes': row[12],
                'called_date': row[13].strftime('%Y-%m-%d %H:%M:%S') if row[13] else None,
                'follow_up_date': row[14].strftime('%Y-%m-%d %H:%M:%S') if row[14] else None,
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S'),
                'type': row[16],
                'company_name': row[17],
                'contact_person': row[18],
                'designation': row[19],
                'assigned_to_name': row[20]
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/<int:call_id>/disposition', methods=['POST'])
@jwt_required
def update_disposition(call_id):
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        data = request.get_json()
        print(f"Received data: {data}")  # Debug log
        disposition = data.get('disposition')
        notes = data.get('notes', '')
        follow_up_date = data.get('follow_up_date')
        demo_date = data.get('demo_date')
        proposal_date = data.get('proposal_date')
        negotiation_date = data.get('negotiation_date')
        
        print(f"Raw date values:")
        print(f"  follow_up_date: {follow_up_date}")
        print(f"  demo_date: {demo_date}")
        print(f"  proposal_date: {proposal_date}")
        print(f"  negotiation_date: {negotiation_date}")
        
        # Convert datetime strings to datetime objects
        if follow_up_date and follow_up_date != "":
            try:
                print(f"Converting follow_up_date: {follow_up_date}")
                follow_up_date = datetime.fromisoformat(follow_up_date.replace('Z', '+00:00'))
                print(f"Converted follow_up_date: {follow_up_date}")
            except Exception as e:
                print(f"Error converting follow_up_date: {e}")
                follow_up_date = None
        else:
            follow_up_date = None
            
        if demo_date and demo_date != "":
            try:
                print(f"Converting demo_date: {demo_date}")
                demo_date = datetime.fromisoformat(demo_date.replace('Z', '+00:00'))
                print(f"Converted demo_date: {demo_date}")
            except Exception as e:
                print(f"Error converting demo_date: {e}")
                demo_date = None
        else:
            demo_date = None
            
        if proposal_date and proposal_date != "":
            try:
                print(f"Converting proposal_date: {proposal_date}")
                proposal_date = datetime.fromisoformat(proposal_date.replace('Z', '+00:00'))
                print(f"Converted proposal_date: {proposal_date}")
            except Exception as e:
                print(f"Error converting proposal_date: {e}")
                proposal_date = None
        else:
            proposal_date = None
            
        if negotiation_date and negotiation_date != "":
            try:
                print(f"Converting negotiation_date: {negotiation_date}")
                negotiation_date = datetime.fromisoformat(negotiation_date.replace('Z', '+00:00'))
                print(f"Converted negotiation_date: {negotiation_date}")
            except Exception as e:
                print(f"Error converting negotiation_date: {e}")
                negotiation_date = None
        else:
            negotiation_date = None

        ringing_dispositions = [
            'Ringing Number But No Response',
            'SwitchOff',
            'Number Not in Use',
            'Line Busy'
        ]

        cur.execute("SELECT status FROM calls WHERE id = %s", (call_id,))
        row = cur.fetchone()
        current_status = row[0] if row else 'fresh'

        new_status = current_status
        disposition_count = 0
        will_delete_after = 0
        deleted = False

        if current_status == 'fresh':
            if disposition == 'Interested':
                new_status = 'follow_up'
            elif disposition in ['Joined / Converted', 'Not Interested']:
                new_status = 'closure'
            elif disposition in ringing_dispositions:
                # Count all ringing_dispositions as a group for fresh calls (6 attempts)
                cur.execute("""
                    INSERT INTO disposition_counts (call_id, disposition, count)
                    VALUES (%s, 'ringing_group', 1)
                    ON DUPLICATE KEY UPDATE count = count + 1
                """, (call_id,))
                cur.execute("SELECT count FROM disposition_counts WHERE call_id = %s AND disposition = 'ringing_group'", (call_id,))
                count_result = cur.fetchone()
                disposition_count = count_result[0] if count_result else 1
                if disposition_count >= 6:
                    new_status = 'closure'
                    disposition = 'Not Interested'
                    deleted = True
                    cur.execute("DELETE FROM disposition_counts WHERE call_id = %s", (call_id,))
                else:
                    will_delete_after = 6 - disposition_count
        elif current_status == 'follow_up':
            if disposition == 'Interested for Demo':
                new_status = 'demo'
            elif disposition in ['Joined / Converted', 'Not Interested']:
                new_status = 'closure'
            elif disposition in ringing_dispositions:
                # Count all ringing_dispositions as a group for follow up calls (6 attempts)
                cur.execute("""
                    INSERT INTO disposition_counts (call_id, disposition, count)
                    VALUES (%s, 'ringing_group', 1)
                    ON DUPLICATE KEY UPDATE count = count + 1
                """, (call_id,))
                cur.execute("SELECT count FROM disposition_counts WHERE call_id = %s AND disposition = 'ringing_group'", (call_id,))
                count_result = cur.fetchone()
                disposition_count = count_result[0] if count_result else 1
                if disposition_count >= 6:
                    new_status = 'closure'
                    disposition = 'Not Interested'
                    deleted = True
                    cur.execute("DELETE FROM disposition_counts WHERE call_id = %s", (call_id,))
                else:
                    will_delete_after = 6 - disposition_count
        elif current_status == 'demo':
            if disposition == 'Interested for Proposal':
                new_status = 'proposal'
            elif disposition in ['Joined / Converted', 'Not Interested']:
                new_status = 'closure'
            elif disposition in ringing_dispositions:
                # Count all ringing_dispositions as a group for demo calls (6 attempts)
                cur.execute("""
                    INSERT INTO disposition_counts (call_id, disposition, count)
                    VALUES (%s, 'ringing_group', 1)
                    ON DUPLICATE KEY UPDATE count = count + 1
                """, (call_id,))
                cur.execute("SELECT count FROM disposition_counts WHERE call_id = %s AND disposition = 'ringing_group'", (call_id,))
                count_result = cur.fetchone()
                disposition_count = count_result[0] if count_result else 1
                if disposition_count >= 6:
                    new_status = 'closure'
                    disposition = 'Not Interested'
                    deleted = True
                    cur.execute("DELETE FROM disposition_counts WHERE call_id = %s", (call_id,))
                else:
                    will_delete_after = 6 - disposition_count
        elif current_status == 'proposal':
            if disposition == 'Interested for Negotiation':
                new_status = 'negotiation'
            elif disposition in ['Joined / Converted', 'Not Interested']:
                new_status = 'closure'
            elif disposition in ringing_dispositions:
                # Count all ringing_dispositions as a group for proposal calls (6 attempts)
                cur.execute("""
                    INSERT INTO disposition_counts (call_id, disposition, count)
                    VALUES (%s, 'ringing_group', 1)
                    ON DUPLICATE KEY UPDATE count = count + 1
                """, (call_id,))
                cur.execute("SELECT count FROM disposition_counts WHERE call_id = %s AND disposition = 'ringing_group'", (call_id,))
                count_result = cur.fetchone()
                disposition_count = count_result[0] if count_result else 1
                if disposition_count >= 6:
                    new_status = 'closure'
                    disposition = 'Not Interested'
                    deleted = True
                    cur.execute("DELETE FROM disposition_counts WHERE call_id = %s", (call_id,))
                else:
                    will_delete_after = 6 - disposition_count
        elif current_status == 'negotiation':
            if disposition in ['Joined / Converted', 'Not Interested']:
                new_status = 'closure'
            elif disposition in ringing_dispositions:
                # Count all ringing_dispositions as a group for negotiation calls (6 attempts)
                cur.execute("""
                    INSERT INTO disposition_counts (call_id, disposition, count)
                    VALUES (%s, 'ringing_group', 1)
                    ON DUPLICATE KEY UPDATE count = count + 1
                """, (call_id,))
                cur.execute("SELECT count FROM disposition_counts WHERE call_id = %s AND disposition = 'ringing_group'", (call_id,))
                count_result = cur.fetchone()
                disposition_count = count_result[0] if count_result else 1
                if disposition_count >= 6:
                    new_status = 'closure'
                    disposition = 'Not Interested'
                    deleted = True
                    cur.execute("DELETE FROM disposition_counts WHERE call_id = %s", (call_id,))
                else:
                    will_delete_after = 6 - disposition_count
        elif current_status == 'closure':
            # Do not update disposition/status in closure
            cur.close()
            return jsonify({'success': True, 'message': 'No update allowed for closure calls'})

        # Handle date fields based on status
        # Note: demo_date, proposal_date, negotiation_date are already converted from the request data
        # Only set to None if they weren't provided in the request
        
        # For follow-up calls, preserve the existing follow_up_date if not explicitly setting a new one
        if current_status == 'follow_up' and not follow_up_date:
            cur.execute("SELECT follow_up_date FROM calls WHERE id = %s", (call_id,))
            existing_follow_up = cur.fetchone()
            if existing_follow_up and existing_follow_up[0]:
                follow_up_date = existing_follow_up[0]
        
        # Always use user-selected dates when provided, otherwise use current time for new stages
        if new_status == 'demo':
            # For demo stage - use provided demo_date or set current time if moving to demo
            if not demo_date:
                if current_status != 'demo':
                    demo_date = datetime.now()
                else:
                    # Staying in demo stage - preserve existing date
                    cur.execute("SELECT demo_date FROM calls WHERE id = %s", (call_id,))
                    existing_demo = cur.fetchone()
                    if existing_demo and existing_demo[0]:
                        demo_date = existing_demo[0]
        
        if new_status == 'proposal':
            # For proposal stage - use provided proposal_date or set current time if moving to proposal
            if not proposal_date:
                if current_status != 'proposal':
                    proposal_date = datetime.now()
                else:
                    # Staying in proposal stage - preserve existing date
                    cur.execute("SELECT proposal_date FROM calls WHERE id = %s", (call_id,))
                    existing_proposal = cur.fetchone()
                    if existing_proposal and existing_proposal[0]:
                        proposal_date = existing_proposal[0]
        
        if new_status == 'negotiation':
            # For negotiation stage - use provided negotiation_date or set current time if moving to negotiation
            if not negotiation_date:
                if current_status != 'negotiation':
                    negotiation_date = datetime.now()
                else:
                    # Staying in negotiation stage - preserve existing date
                    cur.execute("SELECT negotiation_date FROM calls WHERE id = %s", (call_id,))
                    existing_negotiation = cur.fetchone()
                    if existing_negotiation and existing_negotiation[0]:
                        negotiation_date = existing_negotiation[0]
            # If negotiation_date is provided (not None), use it regardless of stage transition

        print(f"Final values being saved to database:")
        print(f"  follow_up_date: {follow_up_date}")
        print(f"  demo_date: {demo_date}")
        print(f"  proposal_date: {proposal_date}")
        print(f"  negotiation_date: {negotiation_date}")
        
        cur.execute("""
            UPDATE calls 
            SET disposition = %s, notes = %s, status = %s, called_date = NOW(), 
                follow_up_date = %s, demo_date = %s, proposal_date = %s, negotiation_date = %s
            WHERE id = %s
        """, (disposition, notes, new_status, follow_up_date, demo_date, proposal_date, negotiation_date, call_id))

        cur.execute("""
            INSERT INTO call_history (call_id, user_id, disposition, notes)
            VALUES (%s, %s, %s, %s)
        """, (call_id, user['id'], disposition, notes))

        mysql.connection.commit()
        cur.close()
        
        if deleted:
            return jsonify({
                'success': True, 
                'message': f'Call closed after {disposition_count} attempts. Status updated to: {disposition}',
                'deleted': True
            })
        else:
            return jsonify({
                'success': True, 
                'message': 'Disposition updated successfully',
                'disposition_count': disposition_count,
                'will_delete_after': will_delete_after
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/<int:call_id>/disposition-count', methods=['GET'])
@jwt_required
def get_disposition_count(call_id):
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        
        # Get call status to determine count limit
        cur.execute("SELECT status FROM calls WHERE id = %s", (call_id,))
        status_result = cur.fetchone()
        call_status = status_result[0] if status_result else 'fresh'
        
        # Set count limit based on call status
        count_limit = 6  # Both fresh and follow_up calls have 6 attempts
        
        # Get disposition counts for this call
        cur.execute("""
            SELECT disposition, count 
            FROM disposition_counts 
            WHERE call_id = %s
        """, (call_id,))
        
        counts = {}
        for row in cur.fetchall():
            counts[row[0]] = row[1]
        
        cur.close()
        return jsonify({
            'counts': counts,
            'count_limit': count_limit,
            'call_status': call_status
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Communication APIs
@app.route('/api/communications/whatsapp', methods=['POST'])
@jwt_required
def send_whatsapp():
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        
        data = request.get_json()
        call_id = data.get('call_id')
        message = data.get('message')
        template_id = data.get('template_id')
        
        cur.execute("""
            INSERT INTO communications (call_id, user_id, type, message)
            VALUES (%s, %s, 'whatsapp', %s)
        """, (call_id, user['id'], message))
        
        mysql.connection.commit()
        cur.close()
        
        # Here you would integrate with WhatsApp API
        # For now, we'll just log the message
        
        return jsonify({'success': True, 'message': 'WhatsApp message sent successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/communications/email', methods=['POST'])
@jwt_required
def send_email():
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        
        data = request.get_json()
        call_id = data.get('call_id')
        subject = data.get('subject')
        message = data.get('message')
        template_id = data.get('template_id')
        
        cur.execute("""
            INSERT INTO communications (call_id, user_id, type, subject, message)
            VALUES (%s, %s, 'email', %s, %s)
        """, (call_id, user['id'], subject, message))
        
        mysql.connection.commit()
        cur.close()
        
        # Here you would integrate with email service
        # For now, we'll just log the email
        
        return jsonify({'success': True, 'message': 'Email sent successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Report APIs
@app.route('/api/reports/calls', methods=['GET'])
@jwt_required
def get_call_reports():
    try:
        user = get_user_from_request()
        # Get query parameters
        db_name = request.args.get('db_name')
        sales_agent = request.args.get('sales_agent')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        status = request.args.get('status')
        cur = mysql.connection.cursor()
        query = """
            SELECT c.*, e.full_name as agent_name, d.name as database_name, d.type as database_type
            FROM calls c
            LEFT JOIN employee e ON c.assigned_to = e.id
            LEFT JOIN `databases` d ON c.database_id = d.id
            WHERE 1=1
        """
        params = []
        # Only show calls assigned to this user if sales executive
        if user['user_role'] != 'sales_manager':
            query += " AND c.assigned_to = %s"
            params.append(user['id'])
        if db_name:
            query += " AND d.name = %s"
            params.append(db_name)
        if sales_agent:
            query += " AND e.full_name LIKE %s"
            params.append(f"%{sales_agent}%")
        if date_from:
            query += " AND DATE(c.created_date) >= %s"
            params.append(date_from)
        if date_to:
            query += " AND DATE(c.created_date) <= %s"
            params.append(date_to)
        if status:
            query += " AND c.status = %s"
            params.append(status)
        query += " ORDER BY c.created_date DESC"
        cur.execute(query, params)
        calls = []
        for row in cur.fetchall():
            # Get column names to map correctly
            column_names = [desc[0] for desc in cur.description]
            
            # Create a dictionary mapping column names to values
            row_dict = dict(zip(column_names, row))
            
            calls.append({
                'id': row_dict['id'],
                'call_id': row_dict['call_id'],
                'client_name': row_dict['client_name'],
                'phone_number': row_dict['phone_number'],
                'email': row_dict['email'],
                'department': row_dict['department'],
                'city': row_dict['city'],
                'institution_name': row_dict['institution_name'],
                'database_id': row_dict['database_id'],
                'assigned_to': row_dict['assigned_to'],
                'status': row_dict['status'],
                'disposition': row_dict['disposition'],
                'notes': row_dict['notes'],
                'called_date': row_dict['called_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['called_date'] else None,
                'follow_up_date': row_dict['follow_up_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['follow_up_date'] else None,
                'demo_date': row_dict['demo_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['demo_date'] else None,
                'proposal_date': row_dict['proposal_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['proposal_date'] else None,
                'negotiation_date': row_dict['negotiation_date'].strftime('%Y-%m-%d %H:%M:%S') if row_dict['negotiation_date'] else None,
                'created_date': row_dict['created_date'].strftime('%Y-%m-%d %H:%M:%S'),
                'type': row_dict.get('type'),
                'company_name': row_dict.get('company_name'),
                'contact_person': row_dict.get('contact_person'),
                'designation': row_dict.get('designation'),
                'agent_name': row_dict.get('agent_name'),
                'database_name': row_dict.get('database_name'),
                'database_type': row_dict.get('database_type')
            })
        cur.close()
        return jsonify({'calls': calls})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/performance', methods=['GET'])
@jwt_required
def get_performance_report():
    try:
        user = get_user_from_request()
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')

        cur = mysql.connection.cursor()

        # Build WHERE clause for date filter
        where = ""
        params = []
        if date_from:
            where += " AND DATE(c.created_date) >= %s"
            params.append(date_from)
        if date_to:
            where += " AND DATE(c.created_date) <= %s"
            params.append(date_to)

        # Main query: use INNER JOIN for employee
        query = f'''
            SELECT
                e.full_name AS agent_name,
                COUNT(c.id) AS total_calls,
                SUM(CASE WHEN c.status IN ("closure", "converted") THEN 1 ELSE 0 END) AS connected_calls,
                SUM(CASE WHEN c.status = "converted" THEN 1 ELSE 0 END) AS converted_calls,
                AVG(TIMESTAMPDIFF(SECOND, c.created_date, c.called_date)) AS avg_call_duration,
                SUM(CASE WHEN c.status = "follow_up" THEN 1 ELSE 0 END) AS follow_ups_scheduled
            FROM calls c
            INNER JOIN employee e ON c.assigned_to = e.id
            WHERE c.assigned_to IS NOT NULL {where}
            GROUP BY e.full_name
            ORDER BY e.full_name
        '''

        cur.execute(query, params)
        results = []
        for row in cur.fetchall():
            total_calls = row[1] or 0
            connected_calls = row[2] or 0
            converted_calls = row[3] or 0
            avg_call_duration = row[4] or 0
            follow_ups_scheduled = row[5] or 0
            conversion_rate = (converted_calls / connected_calls * 100) if connected_calls else 0

            results.append({
                "agent_name": row[0],
                "total_calls": total_calls,
                "connected_calls": connected_calls,
                "conversion_rate": f"{conversion_rate:.2f}",
                "avg_call_duration": f"{avg_call_duration/60:.2f}",  # convert seconds to minutes
                "follow_ups_scheduled": follow_ups_scheduled
            })

        cur.close()
        return jsonify({"performance": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Employee Management APIs (existing)
@app.route('/api/employees', methods=['GET'])
@jwt_required
def get_employees():
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT id, empid, full_name, dob, phone_number, doj, email, 
                   user_type, user_role, department, profile_picture, 
                   address, salary, status, active, created_date, Company_id, online_status
            FROM employee 
            WHERE active = 'active' AND (user_role = 'sales_manager' OR user_role = 'sales_executive')
            ORDER BY created_date DESC
        """)
        
        employees = []
        for row in cur.fetchall():
            employees.append({
                'id': row[0],
                'empid': row[1],
                'full_name': row[2],
                'dob': row[3].strftime('%Y-%m-%d') if row[3] else None,
                'phone_number': row[4],
                'doj': row[5].strftime('%Y-%m-%d') if row[5] else None,
                'email': row[6],
                'user_type': row[7],
                'user_role': row[8],
                'department': row[9],
                'profile_picture': row[10],
                'address': row[11],
                'salary': row[12],
                'status': row[13],
                'active': row[14],
                'created_date': row[15].strftime('%Y-%m-%d %H:%M:%S') if row[15] else None,
                'company_id': row[16],
                'online_status': row[17] if len(row) > 17 else 'offline'
            })
        
        cur.close()
        return jsonify({'employees': employees})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees', methods=['POST'])
@jwt_required
def add_employee():
    try:
        user = get_user_from_request()
        if user['user_role'] != 'sales_manager':
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        
        # Hash password with MD5
        hashed_password = md5_hash(data['password'])
        
        cur = mysql.connection.cursor()
        cur.execute("""
            INSERT INTO employee (empid, full_name, dob, phone_number, doj, email, 
                                password, user_type, user_role, department, address, salary, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data['empid'], data['full_name'], data['dob'], data['phone_number'],
            data['doj'], data['email'], hashed_password, data['user_type'],
            data['user_role'], data['department'], data['address'], data['salary'], 'active'
        ))
        
        mysql.connection.commit()
        cur.close()
        
        return jsonify({'success': True, 'message': 'Employee added successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/<int:employee_id>', methods=['PUT'])
@jwt_required
def update_employee(employee_id):
    try:
        user = get_user_from_request()
        if user['user_role'] != 'sales_manager':
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        
        cur = mysql.connection.cursor()
        
        # If password is provided, hash it
        if 'password' in data and data['password']:
            hashed_password = md5_hash(data['password'])
            cur.execute("""
                UPDATE employee 
                SET empid = %s, full_name = %s, dob = %s, phone_number = %s, doj = %s,
                    email = %s, password = %s, user_type = %s, user_role = %s, 
                    department = %s, address = %s, salary = %s, status = %s
                WHERE id = %s
            """, (
                data['empid'], data['full_name'], data['dob'], data['phone_number'],
                data['doj'], data['email'], hashed_password, data['user_type'],
                data['user_role'], data['department'], data['address'], data['salary'],
                data['status'], employee_id
            ))
        else:
            cur.execute("""
                UPDATE employee 
                SET empid = %s, full_name = %s, dob = %s, phone_number = %s, doj = %s,
                    email = %s, user_type = %s, user_role = %s, department = %s, 
                    address = %s, salary = %s, status = %s
                WHERE id = %s
            """, (
                data['empid'], data['full_name'], data['dob'], data['phone_number'],
                data['doj'], data['email'], data['user_type'], data['user_role'],
                data['department'], data['address'], data['salary'], data['status'], employee_id
            ))
        
        mysql.connection.commit()
        cur.close()
        
        return jsonify({'success': True, 'message': 'Employee updated successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/<int:employee_id>', methods=['DELETE'])
@jwt_required
def delete_employee(employee_id):
    try:
        user = get_user_from_request()
        if user['user_role'] != 'sales_manager':
            return jsonify({'error': 'Unauthorized'}), 401
        
        cur = mysql.connection.cursor()
        cur.execute("UPDATE employee SET active = 'inactive' WHERE id = %s", (employee_id,))
        mysql.connection.commit()
        cur.close()
        
        return jsonify({'success': True, 'message': 'Employee deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/databases/<int:db_id>', methods=['DELETE'])
@jwt_required
def delete_database(db_id):
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        
        # Check if database exists and get uploaded_by info
        cur.execute('SELECT uploaded_by FROM `databases` WHERE id = %s', (db_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            return jsonify({'error': 'Database not found'}), 404
        
        uploaded_by = row[0]
        
        # Allow deletion if user is sales_manager OR if user uploaded the database themselves
        if user['user_role'] != 'sales_manager' and user['id'] != uploaded_by:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Delete all calls related to this database
        cur.execute('DELETE FROM calls WHERE database_id = %s', (db_id,))
        
        # Get file path to delete file from disk
        cur.execute('SELECT file_path FROM `databases` WHERE id = %s', (db_id,))
        row = cur.fetchone()
        file_path = row[0]
        
        # Delete database record
        cur.execute('DELETE FROM `databases` WHERE id = %s', (db_id,))
        mysql.connection.commit()
        cur.close()
        
        # Optionally delete file from disk
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        
        return jsonify({'success': True, 'message': 'Database and related calls deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Category APIs (new table)
@app.route('/api/category', methods=['POST'])
@jwt_required
def add_category():
    try:
        data = request.get_json()
        category = data.get('category')
        if not category:
            return jsonify({'error': 'Category is required'}), 400
        cur = mysql.connection.cursor()
        cur.execute("INSERT INTO category (category) VALUES (%s)", (category,))
        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'Category added successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/category', methods=['GET'])
@jwt_required
def get_categories():
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT id, category, created_date FROM category ORDER BY created_date DESC")
        categories = [
            {'id': row[0], 'category': row[1], 'created_date': row[2].strftime('%Y-%m-%d %H:%M:%S')}
            for row in cur.fetchall()
        ]
        cur.close()
        return jsonify({'categories': categories})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/category/<int:category_id>', methods=['PUT'])
@jwt_required
def update_category(category_id):
    try:
        data = request.get_json()
        category = data.get('category')
        created_date = data.get('created_date')
        
        if not category:
            return jsonify({'error': 'Category is required'}), 400
        
        cur = mysql.connection.cursor()
        
        if created_date:
            cur.execute("UPDATE category SET category = %s, created_date = %s WHERE id = %s", 
                       (category, created_date, category_id))
        else:
            cur.execute("UPDATE category SET category = %s WHERE id = %s", (category, category_id))
        
        if cur.rowcount == 0:
            cur.close()
            return jsonify({'error': 'Category not found'}), 404
        
        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'Category updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/category/<int:category_id>', methods=['DELETE'])
@jwt_required
def delete_category(category_id):
    try:
        cur = mysql.connection.cursor()
        cur.execute("DELETE FROM category WHERE id = %s", (category_id,))
        
        if cur.rowcount == 0:
            cur.close()
            return jsonify({'error': 'Category not found'}), 404
        
        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'Category deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    cur = mysql.connection.cursor()
    cur.execute('SELECT id FROM employee WHERE email = %s', (email,))
    user = cur.fetchone()
    if not user:
        cur.close()
        return jsonify({'error': 'No user found with this email'}), 404
    # Generate OTP
    otp = str(random.randint(100000, 999999))
    # Store OTP
    cur.execute('INSERT INTO password_reset_otps (email, otp) VALUES (%s, %s)', (email, otp))
    mysql.connection.commit()
    cur.close()
    # Send OTP via email (simple SMTP example, replace with your SMTP config)
    try:
        msg = MIMEText(f'Your OTP for password reset is: {otp}')
        msg['Subject'] = 'Sales CRM Password Reset OTP'
        msg['From'] = 'anand@swifterz.ae'
        msg['To'] = email
        # Use Office365 SMTP
        s = smtplib.SMTP('smtp.office365.com', 587)
        s.starttls()
        s.login('anand@swifterz.ae', 'qgztwmkgfdpnwxhb')
        s.sendmail('anand@swifterz.ae', [email], msg.as_string())
        s.quit()
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500
    return jsonify({'success': True, 'message': 'OTP sent to your email'})

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')
    new_password = data.get('new_password')
    if not (email and otp and new_password):
        return jsonify({'error': 'Email, OTP, and new password are required'}), 400
    cur = mysql.connection.cursor()
    # Check OTP (valid for 10 minutes)
    cur.execute('''
        SELECT id, created_at FROM password_reset_otps WHERE email = %s AND otp = %s ORDER BY created_at DESC LIMIT 1
    ''', (email, otp))
    row = cur.fetchone()
    if not row:
        cur.close()
        return jsonify({'error': 'Invalid OTP'}), 400
    from datetime import datetime, timedelta
    created_at = row[1]
    if (datetime.utcnow() - created_at).total_seconds() > 600:
        cur.close()
        return jsonify({'error': 'OTP expired'}), 400
    # Update password (MD5 hash)
    hashed_password = md5_hash(new_password)
    cur.execute('UPDATE employee SET password = %s WHERE email = %s', (hashed_password, email))
    # Delete used OTP
    cur.execute('DELETE FROM password_reset_otps WHERE id = %s', (row[0],))
    mysql.connection.commit()
    cur.close()
    return jsonify({'success': True, 'message': 'Password reset successful'})

if __name__ == '__main__':
    app.run(debug=True, port=5000) 