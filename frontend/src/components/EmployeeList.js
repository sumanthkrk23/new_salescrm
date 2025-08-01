import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Search,
  Edit,
  Trash2,
  Plus,
  User,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import axios from "axios";
import Modal from "./Modal";
import toast from "react-hot-toast";

const EmployeeList = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get("/api/employees");
      let allEmployees = response.data.employees;
      // Show only sales executives for sales executive user
      if (user?.user_role === "sales_executive") {
        allEmployees = allEmployees.filter(
          (emp) => emp.user_role === "sales_executive"
        );
      }
      setEmployees(allEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleteEmployeeId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteEmployee = async () => {
    try {
      await axios.delete(`/api/employees/${deleteEmployeeId}`);
      toast.success("Employee deleted successfully!");
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error("Error deleting employee: " + (error.response?.data?.error || error.message));
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.empid.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole =
      filterRole === "all" || employee.user_role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Get paginated employees
  const getPaginatedEmployees = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredEmployees.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const isAdmin = user?.user_role === "sales_manager";

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600 mt-1 mb-4 sm:mb-0">Manage your team members</p>
        </div>
        {isAdmin && (
          <Link
            to="/employees/add"
            className="btn-primary flex items-center space-x-2 text-base px-4 py-2 sm:text-base sm:px-6 sm:py-2 w-full sm:w-auto"
            style={{ maxWidth: '220px' }}
          >
            <span>+ Add Employee</span>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          {/* Hide role filter for sales executives */}
          {user?.user_role !== "sales_executive" && (
            <div className="sm:w-48">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="input-field"
              >
                <option value="all">All Roles</option>
                <option value="sales_executive">Sales Executive</option>
                <option value="sales_manager">Sales Manager</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {getPaginatedEmployees().map((employee) => (
          <div
            key={employee.id}
            className="card hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 break-words whitespace-normal">
                    {employee.full_name}
                  </h3>
                  <p className="text-sm text-gray-500 capitalize">
                    {employee.user_role.replace("_", " ")}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                {isAdmin && (
                  <>
                    <Link
                      to={`/employees/edit/${employee.id}`}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="w-4 h-4 mr-2" />
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Phone className="w-4 h-4 mr-2" />
                <span>{employee.phone_number}</span>
              </div>
              {employee.doj && (
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>
                    Joined: {new Date(employee.doj).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${(employee.online_status || '').toLowerCase() === 'online'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}
                >
                  {(employee.online_status || '').toLowerCase() === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {filteredEmployees.length > itemsPerPage ? (
        <div className="mt-8 flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center text-sm text-gray-700">
            <span className="text-left">
              <span className="hidden sm:inline">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of{" "}
                {filteredEmployees.length} employees
              </span>
              <span className="sm:hidden">
                {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length}
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`flex items-center px-2 sm:px-3 py-2 text-sm font-medium rounded-md ${currentPage === 1
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, index) => {
                const pageNumber = index + 1;
                // Show first page, last page, current page, and pages around current
                const shouldShow =
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1);

                if (!shouldShow) {
                  // Show ellipsis if there's a gap
                  if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                    return (
                      <span key={`ellipsis-${pageNumber}`} className="px-1 sm:px-2 py-1 text-gray-500">
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                return (
                  <button
                    key={pageNumber}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-md min-w-[32px] sm:min-w-[40px] ${currentPage === pageNumber
                      ? "bg-primary-600 text-white"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`flex items-center px-2 sm:px-3 py-2 text-sm font-medium rounded-md ${currentPage === totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      ) : filteredEmployees.length > 0 && (
        <div className="mt-8 flex items-center justify-center px-4 sm:px-6 py-4 bg-white border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center text-sm text-gray-700">
            <span className="text-center">
              <span className="hidden sm:inline">
                Showing {filteredEmployees.length} of {filteredEmployees.length} employees
              </span>
              <span className="sm:hidden">
                {filteredEmployees.length} of {filteredEmployees.length}
              </span>
            </span>
          </div>
        </div>
      )}

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No employees found
          </h3>
          <p className="text-gray-600">
            {searchTerm || filterRole !== "all"
              ? "Try adjusting your search or filter criteria."
              : "Get started by adding your first employee."}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Employee"
        message="Are you sure you want to delete this employee? This action cannot be undone."
        type="delete"
        onConfirm={confirmDeleteEmployee}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default EmployeeList;
