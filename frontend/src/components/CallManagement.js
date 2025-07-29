import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
} from "lucide-react";
import axios from "axios";
import { FaWhatsapp } from "react-icons/fa";

const CallManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("fresh");
  const [calls, setCalls] = useState([]);
  const [allCalls, setAllCalls] = useState([]);
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
    demo_date: "",
    proposal_date: "",
    negotiation_date: "",
  });
  const [selectedExecutive, setSelectedExecutive] = useState("");
  const [employees, setEmployees] = useState([]);
  const [dispositionCounts, setDispositionCounts] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Ref for tabs container
  const tabsContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    fetchCalls();
    // Fetch all calls for search functionality
    fetchAllCalls();
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

  // Reset to first page when tab, executive filter, or search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedExecutive, searchTerm]);

  // Prevent page scroll when tab changes
  useLayoutEffect(() => {
    // Restore scroll position from ref
    if (scrollPositionRef.current > 0) {
      window.scrollTo(0, scrollPositionRef.current);
    }
  }, [activeTab]);



  const fetchAllCalls = async () => {
    try {
      const endpoints = [
        "/api/calls/fresh?all=1",
        "/api/calls/follow-up?all=1",
        "/api/calls/demo?all=1",
        "/api/calls/proposal?all=1",
        "/api/calls/negotiation?all=1",
        "/api/calls/closure?all=1",
        "/api/calls/converted?all=1"
      ];

      const params = selectedExecutive ? { assigned_to: selectedExecutive } : {};

      const responses = await Promise.all(
        endpoints.map(endpoint => axios.get(endpoint, { params }))
      );

      const allCallsData = responses.flatMap(response => response.data.calls);
      setAllCalls(allCallsData);
    } catch (error) {
      console.error("Error fetching all calls:", error);
    }
  };

  const fetchCalls = async () => {
    try {
      // Store current scroll position before loading
      const currentScroll = window.scrollY;

      setCalls([]);
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
          case "demo":
            endpoint = "/api/calls/demo?all=1";
            break;
          case "proposal":
            endpoint = "/api/calls/proposal?all=1";
            break;
          case "negotiation":
            endpoint = "/api/calls/negotiation?all=1";
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
          case "demo":
            endpoint = "/api/calls/demo";
            break;
          case "proposal":
            endpoint = "/api/calls/proposal";
            break;
          case "negotiation":
            endpoint = "/api/calls/negotiation";
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
      console.log(`API Response for ${activeTab}:`, response.data);
      setCalls(response.data.calls);

      // Restore scroll position after data is loaded
      setTimeout(() => {
        window.scrollTo(0, currentScroll);
      }, 0);
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
        demo_date: "",
        proposal_date: "",
        negotiation_date: "",
      });

      // Show simple success message
      alert("Disposition added successfully");

      fetchCalls();
    } catch (error) {
      alert("Error updating disposition: " + error.response?.data?.error);
    }
  };

  const getDispositionOptions = () => {
    if (!selectedCall) return [];

    // Use selectedCall.status to show correct options based on the call's actual status
    const callStatus = selectedCall.status;

    if (callStatus === "fresh") {
      return [
        "Interested",
        "Ringing Number But No Response",
        "SwitchOff",
        "Number Not in Use",
        "Line Busy",
        "Joined / Converted",
        "Not Interested"
      ];
    } else if (callStatus === "follow_up") {
      return [
        "Interested for Demo",
        "Ringing Number But No Response",
        "SwitchOff",
        "Number Not in Use",
        "Line Busy",
        "Joined / Converted",
        "Not Interested"
      ];
    } else if (callStatus === "demo") {
      return [
        "Interested for Proposal",
        "Ringing Number But No Response",
        "SwitchOff",
        "Number Not in Use",
        "Line Busy",
        "Joined / Converted",
        "Not Interested"
      ];
    } else if (callStatus === "proposal") {
      return [
        "Interested for Negotiation",
        "Ringing Number But No Response",
        "SwitchOff",
        "Number Not in Use",
        "Line Busy",
        "Joined / Converted",
        "Not Interested"
      ];
    } else if (callStatus === "negotiation") {
      return [
        "Ringing Number But No Response",
        "SwitchOff",
        "Number Not in Use",
        "Line Busy",
        "Joined / Converted",
        "Not Interested"
      ];
    } else if (callStatus === "closure") {
      return [
        "Joined / Converted",
        "Not Interested"
      ];
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
    { id: "demo", name: "Demo", icon: Calendar },
    { id: "proposal", name: "Proposal", icon: FileText },
    { id: "negotiation", name: "Negotiation", icon: Users },
    { id: "closure", name: "Closure Calls", icon: CheckCircle },
    // { id: "converted", name: "Converted", icon: User },
  ];

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ scrollBehavior: 'auto' }}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  // Search and Pagination Logic
  const callsToSearch = searchTerm ? allCalls : calls;
  const filteredCalls = callsToSearch.filter((call) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    // Search in all fields
    return (
      // Search in client name or contact person
      (call.client_name && call.client_name.toLowerCase().includes(searchLower)) ||
      (call.contact_person && call.contact_person.toLowerCase().includes(searchLower)) ||
      // Search in phone number
      (call.phone_number && call.phone_number.includes(searchTerm)) ||
      // Search in email
      (call.email && call.email.toLowerCase().includes(searchLower)) ||
      // Search in designation
      (call.designation && call.designation.toLowerCase().includes(searchLower)) ||
      // Search in department
      (call.department && call.department.toLowerCase().includes(searchLower)) ||
      // Search in company name
      (call.company_name && call.company_name.toLowerCase().includes(searchLower)) ||
      // Search in city
      (call.city && call.city.toLowerCase().includes(searchLower)) ||
      // Search in disposition
      (call.disposition && call.disposition.toLowerCase().includes(searchLower)) ||
      // Search in type (B2B/B2C)
      (call.type && call.type.toLowerCase().includes(searchLower))
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCalls = filteredCalls.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);

  return (
    <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-8" style={{ scrollBehavior: 'auto' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Call Management</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">Manage your assigned calls</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav ref={tabsContainerRef} className="-mb-px flex overflow-x-auto scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Store current scroll position before changing tab
                  scrollPositionRef.current = window.scrollY;
                  setActiveTab(tab.id);
                }}
                className={`py-2 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm flex items-center whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                <Icon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">{tab.name}</span>
                <span className="xs:hidden">{tab.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Add filter dropdown for sales manager */}
      {user?.user_role === "sales_manager" && (
        <div className="mb-2 flex items-center space-x-4">
          <label className="block text-sm font-medium text-gray-700">
            Sales Executive:
          </label>
          <select
            value={selectedExecutive}
            onChange={(e) => setSelectedExecutive(e.target.value)}
            className="input-field h-6 w-32 text-sm sm:h-8 sm:w-48 md:w-64 lg:w-80 text-base sm:text-lg px-2 sm:px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search calls by name, phone, email, company, designation, department, city, disposition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-400"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Clear Button */}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>



          {/* Clear Button */}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-12 pr-3 flex items-center"
            >
              <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Calls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {currentCalls.map((call) => (
          <div key={call.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-base sm:text-lg break-words whitespace-normal">
                    {call.client_name || call.contact_person || "-"}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {call.phone_number || "-"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                {/* B2B/B2C badge */}
                <span
                  className={`mb-1 px-2 py-1 rounded-full text-xs sm:text-sm font-medium ${call.type === "B2B"
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
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                  <Mail className="w-4 h-4 mr-1" /> Email
                </span>
                <span className="truncate text-gray-900">
                  {call.email || "-"}
                </span>
              </div>
              {/* Designation for B2B, Department for B2C */}
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
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
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
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
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                  <PhoneCall className="w-4 h-4 mr-1" /> Disposition Status
                </span>
                <span className="text-gray-900">
                  {call.disposition || "Not Initiated"}
                </span>
              </div>

              {/* Show appropriate date field based on active tab */}
              {activeTab === "follow_up" && call.follow_up_date && (
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                    <Clock className="w-4 h-4 mr-1" /> Follow Up Date
                  </span>
                  <span className="text-gray-900">
                    {new Date(call.follow_up_date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>
              )}
              {activeTab === "demo" && call.demo_date && (
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                    <Calendar className="w-4 h-4 mr-1" /> Demo Date
                  </span>
                  <span className="text-gray-900">
                    {new Date(call.demo_date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>
              )}
              {activeTab === "proposal" && call.proposal_date && (
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                    <FileText className="w-4 h-4 mr-1" /> Proposal Date
                  </span>
                  <span className="text-gray-900">
                    {new Date(call.proposal_date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>
              )}
              {activeTab === "negotiation" && call.negotiation_date && (
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center text-gray-500 font-semibold uppercase tracking-wide">
                    <Users className="w-4 h-4 mr-1" /> Negotiation Date
                  </span>
                  <span className="text-gray-900">
                    {new Date(call.negotiation_date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Actions section: for all users */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm font-medium text-gray-700">
                Actions
              </span>
              {/* Show Update Disposition button only for non-closure calls */}
              {call.status !== "closure" && (
                <button
                  onClick={async () => {
                    setSelectedCall(call);
                    setShowDispositionModal(true);
                    // Fetch disposition counts for this call
                    const counts = await fetchDispositionCounts(call.id);
                    setDispositionCounts(counts);
                  }}
                  className="text-xs sm:text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  Update Disposition
                </button>
              )}
            </div>
            <div className="flex space-x-2">
              <a
                href={`tel:${call.phone_number}`}
                className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Phone className="w-4 h-4 mr-1" />
                Call
              </a>
              <a
                href={`mailto:${call.email}`}
                className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Mail className="w-4 h-4 mr-1" />
                Email
              </a>
              <a
                href={`https://wa.me/${formatPhoneNumber(call.phone_number)}`}
                className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp className="w-4 h-4 mr-1" />
                WhatsApp
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {calls.length > itemsPerPage && (
        <div className="mt-8 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${currentPage === 1
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
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
                      <span key={`ellipsis-${pageNumber}`} className="px-2 py-1 text-gray-500">
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${currentPage === pageNumber
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${currentPage === totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Results Info */}
      {calls.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-600">
          {searchTerm ? (
            <>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCalls.length)} of {filteredCalls.length} filtered calls
              <span className="text-gray-500"> (from {calls.length} total)</span>
            </>
          ) : (
            `Showing ${indexOfFirstItem + 1} to ${Math.min(indexOfLastItem, filteredCalls.length)} of ${filteredCalls.length} calls`
          )}
        </div>
      )}

      {filteredCalls.length === 0 && (
        <div className="text-center py-12">
          <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? "No calls found" : "No calls found"}
          </h3>
          <p className="text-gray-600">
            {searchTerm
              ? `No calls match your search for "${searchTerm}". Try adjusting your search terms.`
              : `You don't have any ${activeTab.replace("_", " ")} calls assigned to you.`
            }
          </p>
        </div>
      )}

      {/* Disposition Modal */}
      {showDispositionModal && selectedCall && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto bg-white rounded-lg shadow-xl">
            <div className="p-4 sm:p-6 md:p-8">
              <h3 className="text-lg sm:text-xl md:text-2xl font-medium text-gray-900 mb-4 break-words">
                Update Disposition - {selectedCall.type === "B2B" ? selectedCall.contact_person : selectedCall.client_name}
              </h3>

              {/* Display current disposition counts */}
              {Object.keys(dispositionCounts).length > 0 && (
                <div className="mb-4 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <h4 className="text-sm sm:text-base font-medium text-yellow-800 mb-2">
                    {(() => {
                      const ringingGroup = dispositionCounts['ringing_group'];
                      const countLimit = dispositionCounts.count_limit || 6;
                      if (ringingGroup) {
                        const attemptsLeft = countLimit - ringingGroup;
                        return `Call will be closed after ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'}:`;
                      }
                      return `Call will be closed after ${countLimit} attempts:`;
                    })()}
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(dispositionCounts).map(
                      ([disposition, count]) => {
                        // Skip non-disposition entries like count_limit and call_status
                        if (disposition === 'count_limit' || disposition === 'call_status') return null;

                        const countLimit = dispositionCounts.count_limit || 6;
                        return (
                          <div
                            key={disposition}
                            className="flex justify-between text-sm sm:text-base"
                          >
                            <span className="text-yellow-700">
                              {disposition === 'ringing_group' ? 'Calls Remaining' : disposition}
                            </span>
                            <span
                              className={`font-medium ${count >= countLimit ? "text-red-600" : "text-yellow-600"}`}
                            >
                              {count}/{countLimit}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {/* Show appropriate date information in modal based on active tab */}
              {activeTab === "follow_up" && selectedCall?.follow_up_date && (
                <div className="mb-2 text-blue-700 font-semibold flex items-center text-sm sm:text-base">
                  <Clock className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span className="break-words">Follow Up Date: {new Date(selectedCall.follow_up_date).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}</span>
                </div>
              )}
              {activeTab === "demo" && selectedCall?.demo_date && (
                <div className="mb-2 text-blue-700 font-semibold flex items-center text-sm sm:text-base">
                  <Calendar className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span className="break-words">Demo Date: {new Date(selectedCall.demo_date).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}</span>
                </div>
              )}
              {activeTab === "proposal" && selectedCall?.proposal_date && (
                <div className="mb-2 text-blue-700 font-semibold flex items-center text-sm sm:text-base">
                  <FileText className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span className="break-words">Proposal Date: {new Date(selectedCall.proposal_date).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}</span>
                </div>
              )}
              {activeTab === "negotiation" && selectedCall?.negotiation_date && (
                <div className="mb-2 text-blue-700 font-semibold flex items-center text-sm sm:text-base">
                  <Users className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span className="break-words">Negotiation Date: {new Date(selectedCall.negotiation_date).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}</span>
                </div>
              )}

              <form onSubmit={handleDispositionUpdate} className="space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
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
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

                {/* Show date/time picker based on disposition and status */}
                {(dispositionForm.disposition === "Interested" && activeTab === "fresh") && (
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
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
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                )}
                {(dispositionForm.disposition === "Interested for Demo" && activeTab === "follow_up") && (
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                      Demo Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={dispositionForm.demo_date}
                      onChange={(e) =>
                        setDispositionForm({
                          ...dispositionForm,
                          demo_date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                )}
                {(dispositionForm.disposition === "Interested for Proposal" && activeTab === "demo") && (
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                      Proposal Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={dispositionForm.proposal_date}
                      onChange={(e) =>
                        setDispositionForm({
                          ...dispositionForm,
                          proposal_date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                )}
                {(dispositionForm.disposition === "Interested for Negotiation" && activeTab === "proposal") && (
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                      Negotiation Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={dispositionForm.negotiation_date}
                      onChange={(e) =>
                        setDispositionForm({
                          ...dispositionForm,
                          negotiation_date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
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
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                    placeholder="Enter notes about the call"
                    required
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
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
                    className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
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
