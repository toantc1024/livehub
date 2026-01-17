"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "@/lib/api";

// Role enum matching backend
export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

interface User {
  id: string;
  email: string;
  role: Role;
  name?: string;
  avatarUrl?: string;
  profileData?: {
    school?: string;
    phone_number?: string;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
  needsProfileSetup: boolean;
  login: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Check if user needs to complete profile setup.
 * Profile is incomplete if missing school or phone_number.
 */
function checkNeedsProfileSetup(user: User | null): boolean {
  if (!user) return false;
  // Admin doesn't need profile setup
  if (user.role === Role.ADMIN) return false;

  const profileData = user.profileData;
  // Check if essential fields are missing
  const hasSchool = profileData?.school && profileData.school.trim() !== "";
  const hasPhone =
    profileData?.phone_number && profileData.phone_number.trim() !== "";

  return !hasSchool || !hasPhone;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setUser(null);
        return;
      }

      const result = await api.validateToken();
      if (result.valid && result.user) {
        setUser({
          ...result.user,
          role: result.user.role as Role,
        });
      } else if (result.serverError) {
        // Server/network error - keep current user state, don't logout
        // User will still be able to use the app with cached state
        console.warn("Server error during auth validation, keeping session");
      } else {
        // Actual auth error (401/403) - token is invalid
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch {
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login() {
    const url = await api.getGoogleLoginUrl();
    window.location.href = url;
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/";
  }

  async function refreshUser() {
    await checkAuth();
  }

  // Role checks using enum
  const isAdmin = user?.role === Role.ADMIN;
  const isUser = user?.role === Role.USER;
  const needsProfileSetup = checkNeedsProfileSetup(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        isUser,
        needsProfileSetup,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
