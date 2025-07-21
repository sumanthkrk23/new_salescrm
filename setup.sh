#!/bin/bash

echo "🚀 Setting up Sales CRM Application..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL is not installed. Please install MySQL Server first."
    echo "   You can continue with the setup, but make sure to install MySQL before running the application."
fi

echo "✅ Prerequisites check completed"

# Backend Setup
echo "📦 Setting up Backend..."

cd backend

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Backend setup completed"
cd ..

# Frontend Setup
echo "📦 Setting up Frontend..."

cd frontend

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

echo "✅ Frontend setup completed"
cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your MySQL database:"
echo "   - Create a database named 'salescrm'"
echo "   - Update database credentials in backend/app.py"
echo ""
echo "2. Start the backend server:"
echo "   cd backend"
echo "   source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
echo "   python app.py"
echo ""
echo "3. Start the frontend server (in a new terminal):"
echo "   cd frontend"
echo "   npm start"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo ""
echo "🔑 Demo Credentials:"
echo "   Admin: sabariraj@mineit.tech | sabari@123"
echo "   User: divya@mineit.tech | sabari@123"
echo "" 