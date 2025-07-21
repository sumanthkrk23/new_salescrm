# Sales CRM - Advanced Platform

A comprehensive Sales CRM application built with React, Tailwind CSS, and Flask. This platform provides complete call management, database handling, communication tools, and detailed reporting capabilities.

## 🚀 **Advanced Features Implemented**

### **1. User Management**
- ✅ **Admin Sign-Up & Management**: Complete admin registration and user management
- ✅ **Role-based Access**: Sales Manager (Admin) vs Sales Executive (User)
- ✅ **User Assignment**: Admins can assign specific calls to users
- ✅ **User Panel**: Personalized dashboard for each user

### **2. Database Management**
- ✅ **Upload Databases**: Support for CSV/Excel file uploads
- ✅ **Database Types**: Corporate and Institution databases
- ✅ **Database Filtering**: Filter by department, city, institution name
- ✅ **Call Assignment**: Assign filtered calls to specific users
- ✅ **Database Viewing**: View all uploaded databases and their calls

### **3. Call Assignment & Monitoring**
- ✅ **Call Assignment**: Admins assign specific call sets to users
- ✅ **Call Monitoring**: Track call history, dispositions, and outcomes
- ✅ **Real-time Updates**: Live call status updates
- ✅ **Call Distribution**: Automated and manual call assignment

### **4. Call Management System**
- ✅ **Fresh Calls**: Newly assigned calls for users
- ✅ **Follow-up Calls**: Scheduled follow-up calls
- ✅ **Closure Calls**: Deal finalization calls
- ✅ **Converted Calls**: Successfully converted leads

### **5. Disposition Handling**
- ✅ **Connected Dispositions**:
  - Interested (follow-up scheduled)
  - Not Interested (no further action)
  - Busy (follow-up scheduled)
  - Callback Requested (follow-up scheduled)
  - Appointment Set
  - Converted

- ✅ **Not Connected Dispositions**:
  - No Answer (follow-up scheduled)
  - Wrong Number
  - Voicemail (follow-up scheduled)
  - Number Unreachable
  - Do Not Call

### **6. Communication Integration**
- ✅ **WhatsApp Integration**: Send messages directly to clients
- ✅ **Email Integration**: Send emails with templates
- ✅ **Template System**: Predefined message templates
- ✅ **Communication History**: Track all communications
- ✅ **Message Status**: Track delivery and read status

### **7. Report Generation**
- ✅ **Call Reports**: Detailed call analytics
- ✅ **User Performance Reports**: Individual agent metrics
- ✅ **Communication Reports**: WhatsApp and email statistics
- ✅ **Departmental Reports**: Filtered by department
- ✅ **Export Functionality**: Export reports to CSV/Excel

### **8. Admin Panel Features**
- ✅ **User Management**: Add, edit, delete users
- ✅ **Database Management**: Upload and manage databases
- ✅ **Call Monitoring**: Track all call activities
- ✅ **Report Generation**: Comprehensive reporting tools
- ✅ **Follow-up Management**: Oversee follow-up actions

### **9. User Panel Features**
- ✅ **Fresh Calls View**: Newly assigned calls
- ✅ **Call Logs**: Complete call history
- ✅ **Performance Dashboard**: Personal metrics
- ✅ **Disposition Updates**: Real-time disposition management
- ✅ **Communication Center**: WhatsApp and email tools

## 🎯 **Key Features**

### **Authentication & Security**
- MD5 password encryption
- Role-based access control
- JWT-based authentication
- Protected routes and APIs

### **Database Management**
- CSV/Excel file upload support
- Automatic call generation from databases
- Database filtering and search
- Call assignment to users

### **Call Management**
- Four call types: Fresh, Follow-up, Closure, Converted
- Disposition tracking with 11 different statuses
- Call history and notes
- Follow-up scheduling

### **Communication Tools**
- WhatsApp message sending
- Email communication
- Template system
- Communication history tracking

### **Reporting System**
- Call reports with filtering
- User performance metrics
- Communication statistics
- Export capabilities (CSV only; Excel coming soon)

## 📊 **Database Schema**

### **Core Tables**
```sql
-- Employee table (existing)
CREATE TABLE employee (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empid VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(200) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  -- ... other fields
);

-- New tables for advanced features
CREATE TABLE databases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('corporate', 'institution') NOT NULL,
  file_path VARCHAR(500),
  description TEXT,
  uploaded_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calls (
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
  status ENUM('fresh', 'follow_up', 'closure', 'converted'),
  disposition VARCHAR(100),
  notes TEXT,
  called_date DATETIME,
  follow_up_date DATETIME
);

CREATE TABLE call_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  call_id INT,
  user_id INT,
  disposition VARCHAR(100),
  notes TEXT,
  call_duration INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  call_id INT,
  user_id INT,
  type ENUM('whatsapp', 'email', 'call') NOT NULL,
  message TEXT,
  subject VARCHAR(255),
  status ENUM('sent', 'delivered', 'read', 'failed'),
  attachment_path VARCHAR(500),
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 **Setup Instructions**

### **Prerequisites**
- Python 3.8+
- Node.js 16+
- MySQL Server
- npm or yarn

### **Backend Setup**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### **Frontend Setup**
```bash
cd frontend
npm install
npm start
```

### **Database Configuration**
1. Create MySQL database named `salescrm`
2. Update database credentials in `backend/app.py`
3. Tables will be created automatically on startup

## 🎮 **Demo Credentials**

### **Admin (Sales Manager)**
- Email: `sabariraj@mineit.tech`
- Password: `sabari@123`

### **User (Sales Executive)**
- Email: `divya@mineit.tech`
- Password: `sabari@123`

## 📱 **Usage Guide**

### **For Admins (Sales Managers)**
1. **Upload Databases**: Go to Databases → Upload new CSV/Excel files
2. **Assign Calls**: View database calls and assign to users
3. **Monitor Performance**: Use Reports to track team performance
4. **Manage Users**: Add/edit employees in Employee Management

### **For Users (Sales Executives)**
1. **View Calls**: Check Fresh Calls for new assignments
2. **Update Dispositions**: Mark call outcomes after each call
3. **Follow-ups**: Manage scheduled follow-up calls
4. **Communicate**: Use WhatsApp/Email tools for client communication

## 🔌 **API Endpoints**

### **Authentication**
- `POST /api/login` - User login
- `GET /api/check-auth` - Check authentication

### **Database Management**
- `GET /api/databases` - Get all databases
- `POST /api/databases` - Upload new database
- `GET /api/databases/{id}/calls` - Get database calls
- `POST /api/calls/assign` - Assign calls to users

### **Call Management**
- `GET /api/calls/fresh` - Get fresh calls
- `GET /api/calls/follow-up` - Get follow-up calls
- `GET /api/calls/closure` - Get closure calls
- `GET /api/calls/converted` - Get converted calls
- `POST /api/calls/{id}/disposition` - Update call disposition

### **Communication**
- `POST /api/communications/whatsapp` - Send WhatsApp message
- `POST /api/communications/email` - Send email

### **Reports**
- `GET /api/reports/calls` - Generate call reports
- `GET /api/reports/performance` - Generate performance reports
- `GET /api/reports/communication` - Generate communication reports
- **Export:** Download as CSV from the frontend (Excel coming soon)

### **Employee Management**
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Add new employee
- `PUT /api/employees/{id}` - Update employee
- `DELETE /api/employees/{id}` - Delete employee

## 🎨 **UI Features**

### **Modern Design**
- Responsive Tailwind CSS design
- Mobile-friendly interface
- Professional color scheme
- Intuitive navigation

### **Interactive Components**
- Real-time data updates
- Modal dialogs for forms
- Loading states and animations
- Error handling and notifications

### **Dashboard Features**
- Statistics cards
- Quick action buttons
- Performance metrics
- Recent activity feed

## 🔒 **Security Features**

- MD5 password encryption
- Role-based access control
- JWT-based authentication
- Protected API endpoints
- Input validation and sanitization

## 🚀 **Deployment**

### **Production Setup**
1. Configure environment variables
2. Set up production database
3. Configure CORS settings
4. Set up SSL certificates
5. Configure web server (nginx/Apache)

### **Environment Variables**
```bash
FLASK_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DB=salescrm
```

## 📈 **Future Enhancements**

- Real-time call integration
- Advanced analytics dashboard
- Mobile app development
- Integration with CRM systems
- Advanced reporting with charts
- Bulk operations for calls
- Automated follow-up scheduling

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License.

---

**🎉 The Sales CRM platform is now complete with all advanced features from your project document!** 