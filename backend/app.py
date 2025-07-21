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
            status ENUM('fresh', 'follow_up', 'closure', 'converted') DEFAULT 'fresh',
            disposition VARCHAR(100),
            notes TEXT,
            called_date DATETIME,
            follow_up_date DATETIME,
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
                   profile_picture, status, active, Company_id
            FROM employee 
            WHERE email = %s AND password = %s AND active = 'active'
        """, (email, hashed_password))
        user = cur.fetchone()
        if user:
            # Set online_status to 'online'
            cur.execute("UPDATE employee SET online_status = 'online' WHERE id = %s", (user[0],))
            mysql.connection.commit()
        cur.close()
        if user:
            user_data = {
                'id': user[0],
                'empid': user[1],
                'full_name': user[2],
                'email': user[3],
                'user_type': user[4],
                'user_role': user[5],
                'department': user[6],
                'profile_picture': user[7],
                'status': user[8],
                'active': user[9],
                'company_id': user[10]
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
    return jsonify({
        'authenticated': True,
        'user': user
    })

# Database Management APIs
@app.route('/api/databases', methods=['GET'])
@jwt_required
def get_databases():
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT d.*, e.full_name as uploaded_by_name
            FROM `databases` d
            LEFT JOIN employee e ON d.uploaded_by = e.id
            ORDER BY d.created_date DESC
        """)
        
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
        cur.execute("""
            SELECT c.*, e.full_name as assigned_to_name
            FROM calls c
            LEFT JOIN employee e ON c.assigned_to = e.id
            WHERE c.database_id = %s
            ORDER BY c.created_date DESC
        """, (db_id,))
        
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
        disposition = data.get('disposition')
        notes = data.get('notes', '')
        follow_up = data.get('follow_up', False)
        closure = data.get('closure', False)
        converted = data.get('converted', False)
        follow_up_date = data.get('follow_up_date')
        if follow_up_date == "":
            follow_up_date = None
        
        # Define dispositions that should trigger deletion after 2 occurrences
        deletion_dispositions = [
            'Ringing Number No Response',
            'Switchoff', 
            'Number Not a Use',
            'Line Busy'
        ]
        
        # Check if this disposition should be tracked for deletion
        should_track_deletion = disposition in deletion_dispositions
        
        # Update or insert disposition count
        if should_track_deletion:
            cur.execute("""
                INSERT INTO disposition_counts (call_id, disposition, count)
                VALUES (%s, %s, 1)
                ON DUPLICATE KEY UPDATE count = count + 1
            """, (call_id, disposition))
            
            # Get the updated count
            cur.execute("""
                SELECT count FROM disposition_counts 
                WHERE call_id = %s AND disposition = %s
            """, (call_id, disposition))
            
            count_result = cur.fetchone()
            disposition_count = count_result[0] if count_result else 1
            
            # If count reaches 2, delete the call
            if disposition_count >= 2:
                # Delete from disposition_counts
                cur.execute("DELETE FROM disposition_counts WHERE call_id = %s", (call_id,))
                
                # Delete from call_history
                cur.execute("DELETE FROM call_history WHERE call_id = %s", (call_id,))
                
                # Delete from communications
                cur.execute("DELETE FROM communications WHERE call_id = %s", (call_id,))
                
                # Delete the call itself
                cur.execute("DELETE FROM calls WHERE id = %s", (call_id,))
                
                mysql.connection.commit()
                cur.close()
                
                return jsonify({
                    'success': True, 
                    'message': f'Call deleted after {disposition_count} occurrences of "{disposition}"',
                    'deleted': True
                })
        
        # Determine new status based on disposition and checkboxes
        if converted:
            new_status = 'converted'
        elif closure:
            new_status = 'closure'
        elif follow_up and disposition == 'Interested' and follow_up_date:
            new_status = 'follow_up'
        else:
            new_status = 'fresh'
            follow_up_date = None
        
        # Update call disposition
        cur.execute("""
            UPDATE calls 
            SET disposition = %s, notes = %s, status = %s, called_date = NOW(), follow_up_date = %s
            WHERE id = %s
        """, (disposition, notes, new_status, follow_up_date, call_id))
        
        # Add to call history
        cur.execute("""
            INSERT INTO call_history (call_id, user_id, disposition, notes)
            VALUES (%s, %s, %s, %s)
        """, (call_id, user['id'], disposition, notes))
        
        mysql.connection.commit()
        cur.close()
        
        # Return count information if tracking deletion
        response_data = {
            'success': True, 
            'message': 'Disposition updated successfully'
        }
        
        if should_track_deletion:
            response_data['disposition_count'] = disposition_count
            response_data['will_delete_after'] = 2 - disposition_count
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calls/<int:call_id>/disposition-count', methods=['GET'])
@jwt_required
def get_disposition_count(call_id):
    try:
        user = get_user_from_request()
        cur = mysql.connection.cursor()
        
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
        return jsonify({'counts': counts})
        
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
            SELECT c.*, e.full_name as agent_name, d.name as database_name
            FROM calls c
            LEFT JOIN employee e ON c.assigned_to = e.id
            LEFT JOIN `databases` d ON c.database_id = d.id
            WHERE 1=1
        """
        params = []
        
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
                'agent_name': row[20],
                'database_name': row[21]
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

if __name__ == '__main__':
    app.run(debug=True, port=5000) 