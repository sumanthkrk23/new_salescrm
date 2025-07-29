import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Upload,
  Database,
  Eye,
  Trash2,
  Plus,
  Filter,
  Users,
  FileText,
} from "lucide-react";
import axios from "axios";
import Category from "./Category";

const DatabaseManagement = () => {
  const { user } = useAuth();
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [databaseCalls, setDatabaseCalls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedCalls, setSelectedCalls] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [filters, setFilters] = useState({
    department: "",
    city: "",
    institution: "",
  });
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const detailsRef = useRef(null);
  const tableWrapperRef1 = useRef(null);
  const tableWrapperRef2 = useRef(null);
  const [showScrollRight1, setShowScrollRight1] = useState(false);
  const [showScrollLeft1, setShowScrollLeft1] = useState(false);
  const [showScrollRight2, setShowScrollRight2] = useState(false);
  const [showScrollLeft2, setShowScrollLeft2] = useState(false);

  // Move filteredCalls here so it is available for useEffect dependencies
  const filteredCalls = databaseCalls.filter((call) => {
    return (
      (!filters.department ||
        call.department?.toLowerCase().includes(filters.department.toLowerCase())) &&
      (!filters.city ||
        call.city?.toLowerCase().includes(filters.city.toLowerCase())) &&
      (!filters.institution ||
        call.institution_name?.toLowerCase().includes(filters.institution.toLowerCase()))
    );
  });

  // Check if any calls are already assigned
  const hasAssignedCalls = filteredCalls.some(call => call.assigned_to !== null && call.assigned_to !== undefined && call.assigned_to !== '');
  const assignedCallsCount = filteredCalls.filter(call => call.assigned_to !== null && call.assigned_to !== undefined && call.assigned_to !== '').length;

  useEffect(() => {
    fetchDatabases();
    fetchEmployees();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!showEmployeeDropdown) return;
    const handleClick = (e) => {
      if (!e.target.closest(".employee-dropdown")) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmployeeDropdown]);

  useEffect(() => {
    const checkScroll1 = () => {
      if (tableWrapperRef1.current) {
        const el = tableWrapperRef1.current;
        setShowScrollRight1(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        setShowScrollLeft1(el.scrollLeft > 0);
      }
    };
    checkScroll1();
    window.addEventListener("resize", checkScroll1);
    if (tableWrapperRef1.current) {
      tableWrapperRef1.current.addEventListener("scroll", checkScroll1);
    }
    return () => {
      window.removeEventListener("resize", checkScroll1);
      if (tableWrapperRef1.current) {
        tableWrapperRef1.current.removeEventListener("scroll", checkScroll1);
      }
    };
  }, [databases]);

  useEffect(() => {
    const checkScroll2 = () => {
      if (tableWrapperRef2.current) {
        const el = tableWrapperRef2.current;
        setShowScrollRight2(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        setShowScrollLeft2(el.scrollLeft > 0);
      }
    };
    checkScroll2();
    window.addEventListener("resize", checkScroll2);
    if (tableWrapperRef2.current) {
      tableWrapperRef2.current.addEventListener("scroll", checkScroll2);
    }
    return () => {
      window.removeEventListener("resize", checkScroll2);
      if (tableWrapperRef2.current) {
        tableWrapperRef2.current.removeEventListener("scroll", checkScroll2);
      }
    };
  }, [filteredCalls]);

  const fetchDatabases = async () => {
    try {
      const response = await axios.get("/api/databases");
      setDatabases(response.data.databases);
    } catch (error) {
      console.error("Error fetching databases:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get("/api/employees");
      setEmployees(
        response.data.employees.filter(
          (emp) => emp.user_role === "sales_executive"
        )
      );
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchDatabaseCalls = async (dbId) => {
    try {
      const response = await axios.get(`/api/databases/${dbId}/calls`);
      setDatabaseCalls(response.data.calls);
      setSelectedDatabase(dbId);
      // Scroll to details after data is set (with a slight delay to ensure render)
      setTimeout(() => {
        if (detailsRef.current) {
          detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } catch (error) {
      console.error("Error fetching database calls:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/category");
      setCategories(res.data.categories || []);
    } catch (err) {
      setCategories([]);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const file = e.target.file.files[0];
    const name = e.target.name.value;
    const type = e.target.type.value;
    const description = e.target.description.value;
    const category = selectedCategory;

    if (!file || !name || !type || !category) {
      alert("Please fill all required fields");
      return;
    }

    formData.append("file", file);
    formData.append("name", name);
    formData.append("type", type);
    formData.append("description", description);
    formData.append("category", category);

    try {
      await axios.post("/api/databases", formData);
      setShowUploadForm(false);
      fetchDatabases();
      alert("Database uploaded successfully!");
    } catch (error) {
      alert("Error uploading database: " + error.response?.data?.error);
    }
  };

  const handleAssignCalls = async () => {
    if (!selectedCalls.length || !selectedEmployees.length) {
      alert("Please select calls and at least one employee");
      return;
    }
    try {
      await axios.post("/api/calls/assign", {
        call_ids: selectedCalls,
        user_ids: selectedEmployees,
      });
      alert("Calls assigned successfully!");
      setSelectedCalls([]);
      setSelectedEmployees([]);
      fetchDatabaseCalls(selectedDatabase);
    } catch (error) {
      alert("Error assigning calls: " + error.response?.data?.error);
    }
  };

  const handleDeleteDatabase = async (dbId) => {
    if (!window.confirm("Are you sure you want to delete this database?"))
      return;
    try {
      await axios.delete(`/api/databases/${dbId}`);
      setDatabases(databases.filter((db) => db.id !== dbId));
      alert("Database deleted successfully!");
    } catch (error) {
      alert(
        "Error deleting database: " +
        (error.response?.data?.error || error.message)
      );
    }
  };

  const isAdmin = user?.user_role === "sales_manager";

  const selectedDbObj = databases.find((db) => db.id === selectedDatabase);
  const selectedDbType =
    selectedDbObj?.type === "corporate"
      ? "B2B"
      : selectedDbObj?.type === "institution"
        ? "B2C"
        : "";

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  const handleEmployeeSelect = (empId) => {
    setSelectedEmployees((prev) => {
      let updated;
      if (prev.includes(empId)) {
        updated = prev.filter((id) => id !== empId);
      } else {
        updated = [...prev, empId];
      }
      // If any employees are selected, select all calls; otherwise, clear selectedCalls
      if (updated.length > 0) {
        setSelectedCalls(filteredCalls.map((call) => call.id));
      } else {
        setSelectedCalls([]);
      }
      return updated;
    });
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Database Management
          </h1>
          <p className="text-gray-600 mt-1">Upload and manage call databases</p>
        </div>
        {/* Remove isAdmin check for upload button and upload form */}
        <button
          onClick={() => setShowUploadForm(true)}
          className="btn-primary mt-4 sm:mt-0 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload Database
        </button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Upload Database
          </h3>
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Database Name
                </label>
                <input
                  type="text"
                  name="name"
                  className="input-field"
                  placeholder="Enter database name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  name="type"
                  className="input-field"
                  required
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="">Select type</option>
                  <option value="corporate">B2B</option>
                  <option value="institution">B2C</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  className="input-field"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.category}>
                      {cat.category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Show required columns and sample download based on type */}
            {selectedType === "corporate" && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-2">
                <p className="text-sm font-semibold mb-1">
                  Required columns for B2B:
                </p>
                <ul className="list-disc list-inside text-sm mb-1">
                  <li>company name</li>
                  <li>contact person</li>
                  <li>phone number</li>
                  <li>email</li>
                  <li>designation</li>
                </ul>
                <a
                  href="/sample-b2b.xlsx"
                  download
                  className="text-blue-700 underline text-sm"
                >
                  Download B2B Sample Excel
                </a>
              </div>
            )}
            {selectedType === "institution" && (
              <div className="bg-green-50 border border-green-200 rounded p-3 mb-2">
                <p className="text-sm font-semibold mb-1">
                  Required columns for B2C:
                </p>
                <ul className="list-disc list-inside text-sm mb-1">
                  <li>client name</li>
                  <li>phone number</li>
                  <li>email</li>
                  <li>department</li>
                  <li>company name</li>
                  <li>city</li>
                </ul>
                <a
                  href="/sample-b2c.xlsx"
                  download
                  className="text-green-700 underline text-sm"
                >
                  Download B2C Sample Excel
                </a>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File (CSV/Excel)
              </label>
              <input
                type="file"
                name="file"
                accept=".csv,.xlsx,.xls"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                rows="3"
                className="input-field"
                placeholder="Enter description"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary flex items-center">
                <Upload className="w-4 h-4 mr-2" />
                Upload Database
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Databases List */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Uploaded Databases
        </h3>
        <div className="overflow-x-auto relative pb-8" ref={tableWrapperRef1}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Database Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {databases.map((db) => (
                <tr key={db.id}>
                  <td className="px-6 py-4 whitespace-normal break-words font-medium text-gray-900 flex items-center">
                    <Database className="w-5 h-5 text-primary-500 mr-2" />
                    {db.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${db.type === "corporate"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                        }`}
                    >
                      {db.type === "corporate"
                        ? "B2B"
                        : db.type === "institution"
                          ? "B2C"
                          : db.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium `}
                    >
                      {db.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {db.uploaded_by_name ||
                      employees.find((emp) => emp.id === db.uploaded_by)
                        ?.full_name ||
                      "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(db.created_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => fetchDatabaseCalls(db.id)}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDeleteDatabase(db.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {showScrollRight1 && (
            <div className="sticky float-right right-0 bottom-2 z-20 text-xs text-gray-700 bg-white bg-opacity-90 px-3 py-1 rounded shadow-lg pointer-events-none" style={{ whiteSpace: 'nowrap' }}>
              Scroll →
            </div>
          )}
          {showScrollLeft1 && !showScrollRight1 && (
            <div className="sticky float-left left-0 bottom-2 z-20 text-xs text-gray-700 bg-white bg-opacity-90 px-3 py-1 rounded shadow-lg pointer-events-none" style={{ whiteSpace: 'nowrap' }}>
              ← Scroll
            </div>
          )}
        </div>
      </div>

      {/* Database Calls */}
      {selectedDatabase && (
        <div className="card" ref={detailsRef}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedDbObj?.name} - Database Calls
          </h3>

          {/* Filters */}
          {isAdmin && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  value={filters.department}
                  onChange={(e) =>
                    setFilters({ ...filters, department: e.target.value })
                  }
                  className="input-field"
                  placeholder="Filter by department"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) =>
                    setFilters({ ...filters, city: e.target.value })
                  }
                  className="input-field"
                  placeholder="Filter by city"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Institution
                </label>
                <input
                  type="text"
                  value={filters.institution}
                  onChange={(e) =>
                    setFilters({ ...filters, institution: e.target.value })
                  }
                  className="input-field"
                  placeholder="Filter by institution"
                />
              </div>
            </div>
          )}

          {/* Assign Calls */}
          {isAdmin && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Calls
              </label>
              {hasAssignedCalls ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Assignment Restricted
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          {assignedCallsCount} out of {filteredCalls.length} calls are already assigned to sales executives.
                          Once calls are assigned, they cannot be reassigned to other sales executives.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="relative employee-dropdown">
                    <button
                      type="button"
                      className="input-field w-48 flex items-center justify-between"
                      onClick={() =>
                        setShowEmployeeDropdown(!showEmployeeDropdown)
                      }
                    >
                      {selectedEmployees.length
                        ? `${selectedEmployees.length} Selected`
                        : "Select Employees"}
                      <Users className="w-4 h-4 ml-2" />
                    </button>
                    {showEmployeeDropdown && (
                      <div className="absolute z-10 bg-white border rounded shadow-md mt-1 w-48 max-h-60 overflow-y-auto">
                        {employees.map((emp) => (
                          <label
                            key={emp.id}
                            className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEmployees.includes(emp.id)}
                              onChange={() => handleEmployeeSelect(emp.id)}
                              className="mr-2"
                            />
                            {emp.full_name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="btn-primary" onClick={handleAssignCalls}>
                    Assign Selected Calls
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Calls Table */}
          <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white relative pb-8" ref={tableWrapperRef2}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {selectedDbType === "B2B" ? (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Company Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Contact Person
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Designation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Assigned To
                      </th>
                    </>
                  ) : selectedDbType === "B2C" ? (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Client Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Phone Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Company Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        City
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                        Assigned To
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {selectedDbType === "B2B" ? (
                      <>
                        <td className="px-6 py-3 align-middle whitespace-nowrap font-medium text-gray-900">
                          {call.company_name}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.contact_person}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.email}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.designation}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${call.status === "fresh"
                              ? "bg-cyan-100 text-cyan-800"
                              : call.status === "follow_up"
                                ? "bg-yellow-100 text-yellow-800"
                                : call.status === "closure"
                                  ? "bg-purple-100 text-purple-800"
                                  : call.status === "converted"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                              }`}
                          >
                            {call.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.assigned_to_name && call.assigned_to_name !== 'None' && call.assigned_to_name !== 'null' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold text-black">
                              {call.assigned_to_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold text-black">
                              Unassigned
                            </span>
                          )}
                        </td>
                      </>
                    ) : selectedDbType === "B2C" ? (
                      <>
                        <td className="px-6 py-3 align-middle whitespace-nowrap font-medium text-gray-900">
                          {call.client_name}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.phone_number}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.email}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.department}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.company_name}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.city}
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${call.status === "fresh"
                              ? "bg-cyan-100 text-cyan-800"
                              : call.status === "follow_up"
                                ? "bg-yellow-100 text-yellow-800"
                                : call.status === "closure"
                                  ? "bg-purple-100 text-purple-800"
                                  : call.status === "converted"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                              }`}
                          >
                            {call.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3 align-middle whitespace-nowrap text-gray-700">
                          {call.assigned_to_name && call.assigned_to_name !== 'None' && call.assigned_to_name !== 'null' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium text-black">
                              {call.assigned_to_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium text-black">
                              Unassigned
                            </span>
                          )}
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {showScrollRight2 && (
              <div className="sticky float-right right-0 bottom-2 z-20 text-xs text-gray-700 bg-white bg-opacity-90 px-3 py-1 rounded shadow-lg pointer-events-none" style={{ whiteSpace: 'nowrap' }}>
                Scroll →
              </div>
            )}
            {showScrollLeft2 && !showScrollRight2 && (
              <div className="sticky float-left left-0 bottom-2 z-20 text-xs text-gray-700 bg-white bg-opacity-90 px-3 py-1 rounded shadow-lg pointer-events-none" style={{ whiteSpace: 'nowrap' }}>
                ← Scroll
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManagement;
