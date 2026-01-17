"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
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
  const checkingRef = useRef(false);
  const lastCheckRef = useRef<number>(0);

  // Check auth on mount and when storage changes
  useEffect(() => {
    checkAuth();
    
    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token") {
        if (e.newValue) {
          // Token was added/updated in another tab
          checkAuth();
        } else {
          // Token was removed in another tab
          setUser(null);
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  /**
   * Decode JWT token to get user info locally.
   * This is used as fallback when server is unreachable.
   */
  function decodeTokenLocally(token: string): User | null {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      
      // Check if token is expired
      const exp = payload.exp * 1000; // Convert to milliseconds
      if (Date.now() >= exp) {
        return null;
      }
      
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role as Role,
        name: payload.name,
        avatarUrl: payload.avatar_url,
      };
    } catch {
      return null;
    }
  }

  async function checkAuth() {
    // Debounce - don't check if checked within last 500ms
    const now = Date.now();
    if (now - lastCheckRef.current < 500) {
      return;
    }
    
    // Prevent duplicate concurrent calls
    if (checkingRef.current) {
      return;
    }
    
    checkingRef.current = true;
    lastCheckRef.current = now;
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setUser(null);
        return;
      }

      // First, try to decode locally to validate token format and expiration
      const localUser = decodeTokenLocally(token);
      if (!localUser) {
        // Token is expired or invalid format
        localStorage.removeItem("token");
        setUser(null);
        return;
      }

      // Set user immediately from local decode for faster UX
      setUser(localUser);

      // Then validate with server in background
      const result = await api.validateToken();
      if (result.valid && result.user) {
        // Update with full user data from server
        setUser({
          ...result.user,
          role: result.user.role as Role,
        });
      } else if (result.serverError) {
        // Server/network error - keep using local JWT data
        console.warn("Server error during auth validation, using local JWT data");
        // localUser is already set above
      } else {
        // Actual auth error (401/403) - token is invalid
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch {
      // Keep local user if already set, otherwise clear
      const token = localStorage.getItem("token");
      if (token) {
        const localUser = decodeTokenLocally(token);
        if (localUser) {
          setUser(localUser);
          return;
        }
      }
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setIsLoading(false);
      checkingRef.current = false;
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
