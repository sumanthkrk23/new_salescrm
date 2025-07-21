import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import EmployeeList from "./components/EmployeeList";
import AddEmployee from "./components/AddEmployee";
import EditEmployee from "./components/EditEmployee";
import DatabaseManagement from "./components/DatabaseManagement";
import CallManagement from "./components/CallManagement";
import Reports from "./components/Reports";
import Navbar from "./components/Navbar";
import Category from "./components/Category";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.user_role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>
                    <Navbar />
                    <Dashboard />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <div>
                    <Navbar />
                    <EmployeeList />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees/add"
              element={
                <ProtectedRoute allowedRoles={["sales_manager"]}>
                  <div>
                    <Navbar />
                    <AddEmployee />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees/edit/:id"
              element={
                <ProtectedRoute allowedRoles={["sales_manager"]}>
                  <div>
                    <Navbar />
                    <EditEmployee />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/databases"
              element={
                <ProtectedRoute>
                  <div>
                    <Navbar />
                    <DatabaseManagement />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calls"
              element={
                <ProtectedRoute>
                  <div>
                    <Navbar />
                    <CallManagement />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <div>
                    <Navbar />
                    <Reports />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/category"
              element={
                <ProtectedRoute>
                  <div>
                    <Navbar />
                    <Category />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
