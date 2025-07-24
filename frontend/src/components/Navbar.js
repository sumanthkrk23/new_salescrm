import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Home,
  Users,
  Plus,
  LogOut,
  User,
  Menu,
  X,
  Database,
  Phone,
  BarChart3,
  ChevronDown,
} from "lucide-react";

const Navbar = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const userMenuRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserDropdown(false);
      }
    }
    if (userDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userDropdown]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleUserDropdown = async () => {
    if (!userDropdown) {
      await refreshUser();
    }
    setUserDropdown((v) => !v);
  };

  const isAdmin = user?.user_role === "sales_manager";

  // Helper to check if a path is active
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Sales CRM</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-3 sm:space-x-4">
            <Link
              to="/dashboard"
              className={`${isActive("/dashboard") ? "text-primary-700" : "text-gray-700 hover:text-primary-600"} px-2 md:px-2 lg:px-3 py-2 rounded-md text-xs sm:text-sm md:text-base font-medium transition-colors`}
            >
              Dashboard
            </Link>
            <Link
              to="/calls"
              className={`${isActive("/calls") ? "text-primary-700" : "text-gray-700 hover:text-primary-600"} px-2 md:px-2 lg:px-3 py-2 rounded-md text-xs sm:text-sm md:text-base font-medium transition-colors`}
            >
              Calls
            </Link>
            <Link
              to="/databases"
              className={`${isActive("/databases") ? "text-primary-700" : "text-gray-700 hover:text-primary-600"} px-2 md:px-2 lg:px-3 py-2 rounded-md text-xs sm:text-sm md:text-base font-medium transition-colors`}
            >
              Databases
            </Link>
            <Link
              to="/employees"
              className={`${isActive("/employees") ? "text-primary-700" : "text-gray-700 hover:text-primary-600"} px-2 md:px-2 lg:px-3 py-2 rounded-md text-xs sm:text-sm md:text-base font-medium transition-colors`}
            >
              Employees
            </Link>
            <Link
              to="/reports"
              className={`${isActive("/reports") ? "text-primary-700" : "text-gray-700 hover:text-primary-600"} px-2 md:px-2 lg:px-3 py-2 rounded-md text-xs sm:text-sm md:text-base font-medium transition-colors`}
            >
              Reports
            </Link>
            {/* Only show Category link for sales managers */}
            {user?.user_role === "sales_manager" && (
              <Link
                to="/category"
                className={`${isActive("/category") ? "text-primary-700" : "text-gray-700 hover:text-primary-600"} px-2 md:px-2 lg:px-3 py-2 rounded-md text-xs sm:text-sm md:text-base font-medium transition-colors`}
              >
                Category
              </Link>
            )}
          </div>

          {/* User Menu Dropdown */}
          <div
            className="hidden lg:flex items-center space-x-4"
            ref={userMenuRef}
          >
            <button
              onClick={handleUserDropdown}
              className="flex items-center space-x-2 focus:outline-none group"
            >
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </span>
              <div className="text-left">
                <div className="font-semibold text-gray-900 group-hover:text-primary-600">
                  {user.full_name}
                </div>
                <div className="text-sm text-gray-500">
                  {user.user_role.replace("_", " ")}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {userDropdown && (
              <div className="absolute right-8 top-16 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
                <div className="mb-4">
                  <div className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <span className="truncate flex-1">{user.full_name}</span>
                    <span className={`text-sm px-2 py-0.5 rounded-full inline-block font-medium flex-shrink-0 ${(user.online_status || '').toLowerCase() === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {(user.online_status || '').toLowerCase() === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 truncate">{user.email}</div>
                  <div className="text-sm text-gray-500 capitalize">{user.user_role.replace("_", " ")}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-[50%] mx-auto flex items-center justify-center gap-2 px-4 py-1 mt-1 text-base font-semibold text-red-500 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm transition-colors duration-150"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-primary-600 p-2 rounded-md"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="lg:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200 flex flex-col">
            <Link
              to="/dashboard"
              className={`${isActive("/dashboard") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:text-primary-600"} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/calls"
              className={`${isActive("/calls") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:text-primary-600"} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              Calls
            </Link>
            <Link
              to="/databases"
              className={`${isActive("/databases") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:text-primary-600"} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              Databases
            </Link>
            <Link
              to="/employees"
              className={`${isActive("/employees") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:text-primary-600"} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              Employees
            </Link>
            <Link
              to="/reports"
              className={`${isActive("/reports") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:text-primary-600"} block px-3 py-2 rounded-md text-base font-medium`}
              onClick={() => setIsMenuOpen(false)}
            >
              Reports
            </Link>
            {user?.user_role === "sales_manager" && (
              <Link
                to="/category"
                className={`${isActive("/category") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:text-primary-600"} block px-3 py-2 rounded-md text-base font-medium`}
                onClick={() => setIsMenuOpen(false)}
              >
                Category
              </Link>
            )}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center space-x-2 px-3 py-2">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">
                    {user?.full_name || user?.email}
                  </p>
                  
                  <p className="text-gray-500 capitalize">
                    {user?.user_role?.replace("_", " ")}
                  </p>
                </div>
                <span className={`text-sm px-2 py-0.5 rounded-full inline-block font-medium flex-shrink-0 ${(user.online_status || '').toLowerCase() === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {(user.online_status || '').toLowerCase() === 'online' ? 'Online' : 'Offline'}
                    </span>
              </div>
              <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 px-4 py-1 mt-1 text-base font-semibold text-red-500 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm transition-colors duration-150"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
