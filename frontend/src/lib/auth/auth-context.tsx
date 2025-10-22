"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "@/lib/api/client";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  org_id: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient<{ user: User }>("/auth/sessions/current");
      setUser(response.user);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient("/auth/sessions/logout", { method: "POST" });
    } catch (error) {
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  };

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    checkAuth,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
