import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

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

  // Helper: set axios auth header
  const setAxiosAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  };

  // On mount, restore user and token from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setAxiosAuthToken(storedToken);
    }
    checkAuth();
    // eslint-disable-next-line
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post("/api/login", { email, password });
      if (response.data.success) {
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("token", response.data.token);
        setAxiosAuthToken(response.data.token);
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
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setAxiosAuthToken(null);
  };

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setAxiosAuthToken(token);
    try {
      const response = await axios.get("/api/check-auth");
      if (response.data.authenticated) {
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      } else {
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    } catch (error) {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest user info from backend
  const refreshUser = async () => {
    if (!user) return;
    try {
      // Use /api/employees/:id to get latest info
      const response = await axios.get(`/api/employees`);
      if (response.data && response.data.employees) {
        const updated = response.data.employees.find(emp => emp.id === user.id);
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
