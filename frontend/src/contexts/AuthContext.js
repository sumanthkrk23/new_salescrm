import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setAxiosAuthToken = (token) => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setAxiosAuthToken(storedToken);
      setLoading(false);
      checkAuth(true);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post("/api/login", { email, password });
      if (response.data.success) {
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("token", response.data.token);
        setAxiosAuthToken(response.data.token);
        toast.success(`Welcome back, ${response.data.user.full_name}!`);
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Login failed",
      };
    }
  };

  const logout = async () => {
    const userName = user?.full_name || "User";
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setAxiosAuthToken(null);
    toast.success(`Goodbye, ${userName}! You have been logged out successfully.`);
  };

  const checkAuth = async (silent = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      if (!silent) setLoading(false);
      return;
    }
    setAxiosAuthToken(token);
    try {
      const response = await api.get("/api/check-auth");
      if (response.data.authenticated) {
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      } else {
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    } catch (error) {
      if (!silent) {
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const response = await api.get("/api/employees");
      if (response.data && response.data.employees) {
        const updated = response.data.employees.find((emp) => emp.id === user.id);
        if (updated) {
          setUser(updated);
          localStorage.setItem("user", JSON.stringify(updated));
        }
      }
    } catch (error) {
      // ignore
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkAuth,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
