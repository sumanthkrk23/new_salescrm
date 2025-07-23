import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  User,
  Shield,
  Database,
  Phone,
  BarChart3,
  MessageSquare,
  XCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import '../dashboard-chart-no-outline.css';
import CircularProgress from "./CircularProgress";

// Custom Tooltip for BarChart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 rounded shadow text-sm font-semibold border border-gray-200">
        {`${label}: ${payload[0].value}`}
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    salesExecutives: 0,
    salesManagers: 0,
    totalCalls: 0,
    freshCalls: 0,
    followUpCalls: 0,
    convertedCalls: 0,
    closureCalls: 0,
    totalDatabases: 0,
    interestedCalls: 0,
    joinedConvertedCalls: 0,
    notInterestedCalls: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [employeesResponse, databasesResponse, allCallsResponse] =
        await Promise.all([
          axios.get("/api/employees"),
          axios.get("/api/databases"),
          axios.get("/api/reports/calls"),
        ]);
      const employees = employeesResponse.data.employees;
      const databases = databasesResponse.data.databases;
      const allCalls = allCallsResponse.data.calls || [];
      let totalCalls = 0,
        freshCalls = 0,
        followUpCalls = 0,
        convertedCalls = 0,
        closureCalls = 0;
      let interestedCalls = 0;
      let joinedConvertedCalls = 0;
      let notInterestedCalls = 0;
      if (user?.user_role === "sales_manager") {
        // Fetch all calls for each status
        const [freshRes, followUpRes, closureRes, convertedRes] =
          await Promise.all([
            axios.get("/api/calls/fresh?all=1"),
            axios.get("/api/calls/follow-up?all=1"),
            axios.get("/api/calls/closure?all=1"),
            axios.get("/api/calls/converted?all=1"),
          ]);
        freshCalls = freshRes.data.calls.length;
        followUpCalls = followUpRes.data.calls.length;
        closureCalls = closureRes.data.calls.length;
        convertedCalls = convertedRes.data.calls.length;
        totalCalls = freshCalls + followUpCalls + closureCalls + convertedCalls;
      } else {
        // Sales executive: fetch all their assigned calls for all statuses
        const [freshRes, followUpRes, closureRes, convertedRes] =
          await Promise.all([
            axios.get("/api/calls/fresh"),
            axios.get("/api/calls/follow-up"),
            axios.get("/api/calls/closure"),
            axios.get("/api/calls/converted"),
          ]);
        freshCalls = freshRes.data.calls.length;
        followUpCalls = followUpRes.data.calls.length;
        closureCalls = closureRes.data.calls.length;
        convertedCalls = convertedRes.data.calls.length;
        totalCalls = freshCalls + followUpCalls + closureCalls + convertedCalls;
      }
      // Count interested and joined/converted calls from allCalls
      interestedCalls = allCalls.filter(
        (call) => call.disposition === "Interested"
      ).length;
      joinedConvertedCalls = allCalls.filter(
        (call) => call.disposition === "Joined / Converted"
      ).length;
      notInterestedCalls = allCalls.filter(
        (call) => call.disposition === "Not Interested"
      ).length;
      setStats({
        totalEmployees: employees.length,
        activeEmployees: employees.filter((emp) => emp.active === "active")
          .length,
        salesExecutives: employees.filter(
          (emp) => emp.user_role === "sales_executive"
        ).length,
        salesManagers: employees.filter(
          (emp) => emp.user_role === "sales_manager"
        ).length,
        totalCalls,
        freshCalls,
        followUpCalls,
        convertedCalls,
        closureCalls,
        totalDatabases: databases.length,
        interestedCalls,
        joinedConvertedCalls,
        notInterestedCalls,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
    setLoading(false);
  };

  // Update StatCard to render icon as a React element and only show value if not null
  const StatCard = ({ title, value, icon, color, link, iconClassName }) => (
    <div className={`card hover:shadow-lg transition-shadow ${link ? "cursor-pointer" : ""}`}>
      <div className="flex items-center">
        <div className={`rounded-lg ${color} flex items-center justify-center ${iconClassName || 'p-3'}`} style={{ minWidth: 56, minHeight: 56 }}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {value !== null && <p className="text-2xl font-bold text-gray-900">{value}</p>}
        </div>
      </div>
    </div>
  );

  const QuickActionCard = ({ title, description, icon: Icon, link, color }) => (
    <Link
      to={link}
      className="card hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </Link>
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  // Calculate percentages for joined/converted and not interested calls
  const joinedConvertedPercent = stats.totalCalls > 0 ? ((stats.joinedConvertedCalls / stats.totalCalls) * 100).toFixed(2) : '0.00';
  const notInterestedPercent = stats.totalCalls > 0 ? ((stats.notInterestedCalls / stats.totalCalls) * 100).toFixed(2) : '0.00';

  return (
    <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.full_name || user?.email}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your Sales CRM today.
        </p>
      </div>

      {/* Combined Stats Grid: 3 columns x 2 rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* <StatCard
          title="Sales Executives"
          value={stats.salesExecutives}
          icon={User}
          color="bg-purple-500"
        /> */}
        <StatCard
          title="Databases"
          value={stats.totalDatabases}
          icon={<Database className="w-6 h-6 text-white" />}
          color="bg-gray-500"
        />
        <StatCard
          title="Total Calls"
          value={stats.totalCalls}
          icon={<Phone className="w-6 h-6 text-white" />}
          color="bg-indigo-500"
        />
        <StatCard
          title="Fresh Calls"
          value={stats.freshCalls}
          icon={<Phone className="w-6 h-6 text-white" />}
          color="bg-blue-500"
        />
        {/* <StatCard
          title="Follow Up Calls"
          value={stats.followUpCalls}
          icon={Phone}
          color="bg-yellow-500"
        /> */}
        <StatCard
          title="Interested Calls"
          value={stats.interestedCalls}
          icon={<ThumbsUp className="w-6 h-6 text-white" />}
          color="bg-pink-500"
        />
        <StatCard
          title="Joined / Converted"
          value={stats.joinedConvertedCalls}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          color="bg-green-500"
        />
        <StatCard
          title="Closure Calls"
          value={stats.closureCalls}
          icon={<Phone className="w-6 h-6 text-white" />}
          color="bg-red-500"
        />
        <StatCard
          title="Not Interested Calls"
          value={stats.notInterestedCalls}
          icon={<ThumbsDown className="w-6 h-6 text-white" />}
          color="bg-gray-400"
        />
        <StatCard
          title="Joined / Converted"
          value={null}
          icon={
            <CircularProgress
              percent={Number(joinedConvertedPercent)}
              size={68}
              color="#22c55e"
              bg="#e5e7eb"
            />
          }
          color="bg-transparent"
          iconClassName="p-0"
        />
        <StatCard
          title="Not Interested"
          value={null}
          icon={
            <CircularProgress
              percent={Number(notInterestedPercent)}
              size={68}
              color="#f87171"
              bg="#e5e7eb"
            />
          }
          color="bg-transparent"
          iconClassName="p-0"
        />
      </div>

      {/* Quick Actions and Chart Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions Card */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="flex flex-col relative">
            {/* Timeline line removed for a cleaner look */}
            {/* Manage Calls */}
            <Link
              to="/calls"
              className="flex items-start space-x-3 mb-6 relative z-10 group hover:bg-gray-50 p-2 rounded-lg transition"
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-100">
                <Phone className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <div className="font-bold text-lg">Manage Calls</div>
                <div className="text-gray-500 text-sm">
                  View and manage your assigned calls
                </div>
              </div>
            </Link>
            {/* Upload Database (admin only) */}
            {user?.user_role === "sales_manager" && (
              <Link
                to="/databases"
                className="flex items-start space-x-3 mb-6 relative z-10 group hover:bg-gray-50 p-2 rounded-lg transition"
              >
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-green-100">
                  <Database className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <div className="font-bold text-lg">Upload Database</div>
                  <div className="text-gray-500 text-sm">
                    Upload new call databases
                  </div>
                </div>
              </Link>
            )}
            {/* View Reports */}
            <Link
              to="/reports"
              className="flex items-start space-x-3 mb-6 relative z-10 group hover:bg-gray-50 p-2 rounded-lg transition"
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-purple-100">
                <BarChart3 className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <div className="font-bold text-lg">View Reports</div>
                <div className="text-gray-500 text-sm">
                  Generate and view detailed reports
                </div>
              </div>
            </Link>
            {/* Manage Employees */}
            <Link
              to="/employees"
              className="flex items-start space-x-3 mb-6 relative z-10 group hover:bg-gray-50 p-2 rounded-lg transition"
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-orange-100">
                <Users className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="font-bold text-lg">Manage Employees</div>
                <div className="text-gray-500 text-sm">
                  View and manage team members
                </div>
              </div>
            </Link>
          </div>
        </div>
        {/* Bar Chart Card */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Call Stats
          </h3>
          <ResponsiveContainer width="100%" height={260} style={{ outline: 'none' }}>
            <BarChart
              data={[
                { name: 'Fresh', value: stats.freshCalls },
                { name: 'Interested', value: stats.interestedCalls },
                { name: 'Converted', value: stats.joinedConvertedCalls },
                { name: 'Closure', value: stats.closureCalls },
              ]}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              barCategoryGap={30}
              activeBar={false}
              style={{ outline: 'none' }}
            >
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/*
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Profile
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{user?.full_name || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Role:</span>
              <span className="font-medium capitalize">
                {user?.user_role?.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium text-green-600">
                {user?.status || "Active"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Databases:</span>
              <span className="font-medium">{stats.totalDatabases}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Your Calls:</span>
              <span className="font-medium">{stats.totalCalls}</span>
            </div>
          </div>
        </div>
        */}
    </div>
  );
};

export default Dashboard;
