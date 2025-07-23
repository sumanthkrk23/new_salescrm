import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Phone,
  MessageSquare,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Database,
  PhoneCall,
  MapPin,
  Briefcase,
} from "lucide-react";
import axios from "axios";
import { FaWhatsapp } from "react-icons/fa";

const CallManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("fresh");
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [dispositionForm, setDispositionForm] = useState({
    disposition: "",
    notes: "",
    follow_up: false,
    closure: false,
    converted: false,
    follow_up_date: "",
  });
  const [selectedExecutive, setSelectedExecutive] = useState("");
  const [employees, setEmployees] = useState([]);
  const [dispositionCounts, setDispositionCounts] = useState({});

  useEffect(() => {
    fetchCalls();
    if (user?.user_role === "sales_manager") {
      // Fetch all sales executives for filter
      axios.get("/api/employees").then((res) => {
        setEmployees(
          res.data.employees.filter(
            (emp) => emp.user_role === "sales_executive"
          )
        );
      });
    }
  }, [activeTab, selectedExecutive]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      let endpoint = "";
      let params = {};
      if (user?.user_role === "sales_manager") {
        // Sales manager: fetch all calls by status, optionally filter by executive
        switch (activeTab) {
          case "fresh":
            endpoint = "/api/calls/fresh?all=1";
            break;
          case "follow_up":
            endpoint = "/api/calls/follow-up?all=1";
            break;
          case "closure":
            endpoint = "/api/calls/closure?all=1";
            break;
          case "converted":
            endpoint = "/api/calls/converted?all=1";
            break;
          default:
            endpoint = "/api/calls/fresh?all=1";
        }
        if (selectedExecutive) {
          params.assigned_to = selectedExecutive;
        }
      } else {
        // Sales executive: fetch only their assigned calls
        switch (activeTab) {
          case "fresh":
            endpoint = "/api/calls/fresh";
            break;
          case "follow_up":
            endpoint = "/api/calls/follow-up";
            break;
          case "closure":
            endpoint = "/api/calls/closure";
            break;
          case "converted":
            endpoint = "/api/calls/converted";
            break;
          default:
            endpoint = "/api/calls/fresh";
        }
      }
      const response = await axios.get(endpoint, { params });
      setCalls(response.data.calls);
    } catch (error) {
      console.error("Error fetching calls:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDispositionCounts = async (callId) => {
    try {
      const response = await axios.get(
        `/api/calls/${callId}/disposition-count`
      );
      return response.data.counts;
    } catch (error) {
      console.error("Error fetching disposition counts:", error);
      return {};
    }
  };

  const handleDispositionUpdate = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        `/api/calls/${selectedCall.id}/disposition`,
        dispositionForm
      );

      setShowDispositionModal(false);
      setSelectedCall(null);
      setDispositionCounts({});
      setDispositionForm({
        disposition: "",
        notes: "",
        follow_up: false,
        closure: false,
        converted: false,
        follow_up_date: "",
      });

      // Check if call was deleted
      if (response.data.deleted) {
        alert(response.data.message);
      } else {
        // Show count information if available
        let message = response.data.message;
        if (response.data.disposition_count) {
          message += `\n\nDisposition count: ${response.data.disposition_count}/2`;
          if (response.data.will_delete_after > 0) {
            message += `\nCall will be deleted after ${response.data.will_delete_after} more occurrence(s)`;
          }
        }
        alert(message);
      }

      fetchCalls();
    } catch (error) {
      alert("Error updating disposition: " + error.response?.data?.error);
    }
  };

  const getDispositionOptions = () => {
    if (!selectedCall) return [];
    if (selectedCall.status === "fresh") {
      return [
        "Interested",
        "Ringing Number But No Response",
        "SwitchOff",
        "Number Not in Use",
        "Line Busy",
        "Joined / Converted",
        "Not Interested"
      ];
    } else if (selectedCall.status === "follow_up") {
      return [
        "Ringing Number But No Response",
        "SwitchOff",
        "Number Not in Use",
        "Line Busy",
        "Joined / Converted",
        "Not Interested"
      ];
    } else if (selectedCall.status === "closure") {
      return [];
    }
    return [];
  };

  // Helper to format phone number for WhatsApp
  const formatPhoneNumber = (number) => {
    let cleaned = (number || '').replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  };

  const tabs = [
    { id: "fresh", name: "Fresh Calls", icon: Phone },
    { id: "follow_up", name: "Follow Up", icon: Clock },
    { id: "closure", name: "Closure Calls", icon: CheckCircle },
    // { id: "converted", name: "Converted", icon: User },
  ];

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Call Management</h1>
        <p className="text-gray-600 mt-1">Manage your assigned calls</p>
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

      {/* Add filter dropdown for sales manager */}
      {user?.user_role === "sales_manager" && (
        <div className="mb-4 flex items-center space-x-4">
          <label className="block text-sm font-medium text-gray-700">
            Sales Executive:
          </label>
          <select
            value={selectedExecutive}
            onChange={(e) => setSelectedExecutive(e.target.value)}
            className="input-field"
            style={{ minWidth: 120 }}
          >
            <option value="">All</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Calls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {calls.map((call) => (
          <div key={call.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg break-words whitespace-normal">
                    {call.client_name || call.contact_person || "-"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {call.phone_number || "-"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                {/* B2B/B2C badge */}
                <span
                  className={`mb-1 px-2 py-1 rounded-full text-xs font-medium ${
                    call.type === "B2B"
                      ? "bg-blue-100 text-blue-800"
                      : call.type === "B2C"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {call.type === "B2B" ? "B2B" : call.type === "B2C" ? "B2C" : call.type}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                  <Mail className="w-4 h-4 mr-1" /> Email
                </span>
                <span className="truncate text-gray-900">
                  {call.email || "-"}
                </span>
              </div>
              {/* Designation for B2B, Department for B2C */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                  {call.type === "B2B" ? (
                    <>
                      <User className="w-4 h-4 mr-1" /> Designation
                    </>
                  ) : (
                    <>
                      <Briefcase className="w-4 h-4 mr-1" /> Department
                    </>
                  )}
                </span>
                <span className="text-gray-900">
                  {call.type === "B2B"
                    ? call.designation || "-"
                    : call.department || "-"}
                </span>
              </div>
              {/* Location for B2C, Company Name for B2B */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                  {call.type === "B2B" ? (
                    <>
                      <Database className="w-4 h-4 mr-1" /> Company Name
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-1" /> Location
                    </>
                  )}
                </span>
                <span className="text-gray-900">
                  {call.type === "B2B"
                    ? call.company_name || "-"
                    : call.city || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                  <PhoneCall className="w-4 h-4 mr-1" /> Disposition Status
                </span>
                <span className="text-gray-900">
                  {call.disposition || "Not Initiated"}
                </span>
              </div>
              {/* In the call card, make follow up date use the same color as other data */}
              {activeTab === "follow_up" && call.follow_up_date && (
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                    <Clock className="w-4 h-4 mr-1" /> Follow Up Date
                  </span>
                  <span className="text-gray-900">
                    {new Date(call.follow_up_date).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Actions section: only for non-sales_manager */}
            {user?.user_role !== "sales_manager" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    Actions
                  </span>
                  {/* Hide Update Disposition for closure tab */}
                  {activeTab !== "closure" && (
                    <button
                      onClick={async () => {
                        setSelectedCall(call);
                        setShowDispositionModal(true);
                        // Fetch disposition counts for this call
                        const counts = await fetchDispositionCounts(call.id);
                        setDispositionCounts(counts);
                      }}
                      className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Update Disposition
                    </button>
                  )}
                </div>
                <div className="flex space-x-2">
                  <a
                    href={`tel:${call.phone_number}`}
                    className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Call
                  </a>
                  <a
                    href={`mailto:${call.email}`}
                    className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </a>
                  <a
                    href={`https://wa.me/${formatPhoneNumber(call.phone_number)}`}
                    className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaWhatsapp className="w-4 h-4 mr-1" />
                    WhatsApp
                  </a>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {calls.length === 0 && (
        <div className="text-center py-12">
          <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No calls found
          </h3>
          <p className="text-gray-600">
            You don't have any {activeTab.replace("_", " ")} calls assigned to
            you.
          </p>
        </div>
      )}

      {/* Disposition Modal */}
      {showDispositionModal && selectedCall && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Update Disposition - {selectedCall.type === "B2B" ? selectedCall.contact_person : selectedCall.client_name}
              </h3>

              {/* Display current disposition counts */}
              {Object.keys(dispositionCounts).length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    {(() => {
                      const ringingGroup = dispositionCounts['ringing_group'];
                      if (ringingGroup) {
                        const attemptsLeft = 3 - ringingGroup;
                        return `Call will be closed after ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'}:`;
                      }
                      return 'Call will be closed after 3 attempts:';
                    })()}
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(dispositionCounts).map(
                      ([disposition, count]) => (
                        <div
                          key={disposition}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-yellow-700">
                            {disposition === 'ringing_group' ? 'Ringing/No Response' : disposition}
                          </span>
                          <span
                            className={`font-medium ${count >= 3 ? "text-red-600" : "text-yellow-600"}`}
                          >
                            {count}/3
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* In the Update Disposition modal, show follow up date if present (read-only) */}
              {activeTab === "follow_up" && selectedCall?.follow_up_date && (
                <div className="mb-2 text-blue-700 font-semibold flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Follow Up Date: {new Date(selectedCall.follow_up_date).toLocaleString()}
                </div>
              )}

              <form onSubmit={handleDispositionUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={dispositionForm.disposition}
                    onChange={(e) =>
                      setDispositionForm({
                        ...dispositionForm,
                        disposition: e.target.value,
                      })
                    }
                    className="input-field"
                    required
                  >
                    <option value="">Select Status</option>
                    {getDispositionOptions().map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Show follow up date/time picker if 'Interested' is selected in Follow Up Call */}
                {dispositionForm.disposition === "Interested" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Follow Up Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={dispositionForm.follow_up_date}
                      onChange={(e) =>
                        setDispositionForm({
                          ...dispositionForm,
                          follow_up_date: e.target.value,
                        })
                      }
                      className="input-field"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={dispositionForm.notes}
                    onChange={(e) =>
                      setDispositionForm({
                        ...dispositionForm,
                        notes: e.target.value,
                      })
                    }
                    rows="3"
                    className="input-field"
                    placeholder="Enter notes about the call"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDispositionModal(false);
                      setSelectedCall(null);
                      setDispositionCounts({});
                      setDispositionForm({
                        disposition: "",
                        notes: "",
                        follow_up: false,
                        closure: false,
                        converted: false,
                        follow_up_date: "",
                      });
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update Disposition
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallManagement;
