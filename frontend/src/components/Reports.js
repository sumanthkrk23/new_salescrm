import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  BarChart3,
  Users,
  Phone,
  MessageSquare,
  Mail,
  Download,
  Filter,
  Calendar,
  TrendingUp,
} from "lucide-react";
import axios from "axios";

function exportToCSV(data, filename = "report.csv", activeTab = "calls") {
  if (!data || data.length === 0) return;
  let headers = [];
  let rows = [];
  if (activeTab === "calls") {
    headers = [
      "Database Name",
      "Sales Agent",
      "Type",
      "Company Name",
      "Client Name",
      "Phone Number",
      "Email",
      "Last Called On",
      "Status",
      "Notes",
    ];
    rows = data.map((row) => [
      row.database_name || "",
      row.agent_name || "",
      row.type || "",
      row.company_name || "",
      row.type === "B2B" ? row.contact_person || "" : row.client_name || "",
      row.phone_number || "",
      row.email || "",
      row.called_date ? new Date(row.called_date).toLocaleDateString() : "",
      row.status ? row.status.replace("_", " ") : "",
      row.notes || "",
    ]);
  } else {
    // fallback: export all fields
    headers = Object.keys(data[0]);
    rows = data.map((row) => headers.map((h) => row[h]));
  }
  const csvRows = [];
  csvRows.push(headers.join(","));
  for (const row of rows) {
    const values = row.map(
      (val) =>
        `"${(val !== null && val !== undefined ? val : "")
          .toString()
          .replace(/"/g, '""')}"`
    );
    csvRows.push(values.join(","));
  }
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("calls");
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({
    db_name: "",
    sales_agent: "",
    date_from: "",
    date_to: "",
    status: "",
    client_name: "",
    communication_type: "all",
  });
  const [employees, setEmployees] = useState([]);
  const [databases, setDatabases] = useState([]);

  useEffect(() => {
    fetchEmployees();
    fetchDatabases();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get("/api/employees");
      setEmployees(response.data.employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchDatabases = async () => {
    try {
      const response = await axios.get("/api/databases");
      setDatabases(response.data.databases);
    } catch (error) {
      console.error("Error fetching databases:", error);
    }
  };

  const generateReport = async (customFilters) => {
    try {
      setLoading(true);
      let endpoint = "";

      switch (activeTab) {
        case "calls":
          endpoint = "/api/reports/calls";
          break;
        case "performance":
          endpoint = "/api/reports/performance";
          break;
        case "communication":
          endpoint = "/api/reports/communication";
          break;
        default:
          endpoint = "/api/reports/calls";
      }

      const params = new URLSearchParams();
      const useFilters = customFilters || filters;
      Object.keys(useFilters).forEach((key) => {
        if (useFilters[key]) {
          params.append(key, useFilters[key]);
        }
      });

      const response = await axios.get(`${endpoint}?${params}`);
      setReports(response.data.calls || response.data.reports || []);
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate report when filters change (for calls tab)
  useEffect(() => {
    if (activeTab === "calls") {
      generateReport();
    }
    // eslint-disable-next-line
  }, [
    filters.db_name,
    filters.sales_agent,
    filters.status,
    filters.date_from,
    filters.date_to,
    filters.client_name,
    activeTab,
  ]);

  const handleExport = () => {
    if (!reports || reports.length === 0) {
      alert("No data to export!");
      return;
    }
    exportToCSV(reports, "report.csv", activeTab);
  };

  const tabs = [
    { id: "calls", name: "Call Reports", icon: Phone },
    // { id: "performance", name: "Performance Reports", icon: TrendingUp },
    // { id: "communication", name: "Communication Reports", icon: MessageSquare },
  ];

  const getReportColumns = () => {
    switch (activeTab) {
      case "calls":
        return [
          "Database Name",
          "Sales Executive",
          "Type",
          "Company Name",
          "Client Name",
          "Phone Number",
          "Email",
          "Last Called On",
          "Status",
          "Notes",
        ];
      case "performance":
        return [
          "Agent Name",
          "Total Calls",
          "Connected Calls",
          "Conversion Rate",
          "Average Call Duration",
          "Follow-ups Scheduled",
        ];
      case "communication":
        return [
          "Agent Name",
          "Communication Type",
          "Messages Sent",
          "Delivered",
          "Read",
          "Response Rate",
        ];
      default:
        return [];
    }
  };

  const sortedEmployees = [...employees].sort((a, b) =>
    a.full_name.localeCompare(b.full_name)
  );

  // Deduplicate agent names for performance tab
  const getDedupedReports = () => {
    if (activeTab !== "performance") return reports;
    const seen = new Set();
    return reports.filter((report) => {
      if (!report.agent_name) return false;
      const key = report.agent_name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
            Generate and view detailed reports
          </p>
        </div>
        <button
          onClick={handleExport}
          className="btn-secondary mt-4 sm:mt-0 flex items-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Report Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === "calls" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Database Name
                </label>
                <select
                  value={filters.db_name}
                  onChange={(e) =>
                    setFilters({ ...filters, db_name: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">All Databases</option>
                  {databases.map((db) => (
                    <option key={db.id} value={db.name}>
                      {db.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sales Executive
                </label>
                <select
                  value={filters.sales_agent}
                  onChange={(e) =>
                    setFilters({ ...filters, sales_agent: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">All Executives</option>
                  {(user?.user_role === "sales_manager"
                    ? employees.filter(
                        (emp) => emp.user_role === "sales_executive"
                      )
                    : employees
                  ).map((emp) => (
                    <option key={emp.id} value={emp.full_name}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">All Status</option>
                  <option value="fresh">Fresh</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="closure">Closure</option>
                  <option value="converted">Converted</option>
                </select>
              </div>
            </>
          )}

          {activeTab === "communication" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Communication Type
              </label>
              <select
                value={filters.communication_type}
                onChange={(e) =>
                  setFilters({ ...filters, communication_type: e.target.value })
                }
                className="input-field"
              >
                <option value="all">All Types</option>
                <option value="call">Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date From
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) =>
                setFilters({ ...filters, date_from: e.target.value })
              }
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date To
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) =>
                setFilters({ ...filters, date_to: e.target.value })
              }
              className="input-field"
            />
          </div>
          {activeTab === "calls" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Name
              </label>
              <input
                type="text"
                value={filters.client_name}
                onChange={(e) =>
                  setFilters({ ...filters, client_name: e.target.value })
                }
                className="input-field"
                placeholder="Search by client name"
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          {/*
          <button
            onClick={generateReport}
            disabled={loading}
            className="btn-primary flex items-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <Filter className="w-5 h-5 mr-2" />
            )}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          */}
        </div>
      </div>

      {/* Report Results */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {activeTab === "calls"
              ? "Call Report Results"
              : activeTab === "performance"
              ? "Performance Report Results"
              : "Communication Report Results"}
          </h3>
          <span className="text-sm text-gray-500">
            {reports.length} records found
          </span>
        </div>

        {getDedupedReports().length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {getReportColumns().map((column, index) => (
                    <th
                      key={index}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getDedupedReports().map((report, index) => (
                  <tr key={index}>
                    {activeTab === "calls" ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.database_name || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.agent_name || "N/A"}
                        </td>
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        >
                          <span
                          className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
                            report.type === "B2B"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                            }`}
                          >
                            {report.type === "B2B" ? "B2B" : "B2C"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.company_name || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.type === "B2B"
                            ? report.contact_person || "-"
                            : report.client_name || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.phone_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.email || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.called_date
                            ? new Date(report.called_date).toLocaleDateString()
                            : "Not called"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              report.status === "fresh"
                                ? "bg-cyan-100 text-cyan-800"
                                : report.status === "follow_up"
                                ? "bg-yellow-100 text-yellow-800"
                                : report.status === "closure"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {report.status?.replace("_", " ") || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.notes || "N/A"}
                        </td>
                      </>
                    ) : activeTab === "performance" ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.agent_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.total_calls}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.connected_calls}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.conversion_rate}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.avg_call_duration} min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.follow_ups_scheduled}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.agent_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.communication_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.messages_sent}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.delivered}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.read}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.response_rate}%
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No report data
            </h3>
            <p className="text-gray-600">
              Generate a report using the filters above to see results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
