/**
 * API configuration and client for LiveHub backend.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const API_PREFIX = "/api/v1";

/**
 * Get full API endpoint URL.
 */
export function apiUrl(path: string): string {
  return `${API_URL}${API_PREFIX}${path}`;
}

/**
 * Get auth header with JWT token.
 */
export function getAuthHeader(): HeadersInit | undefined {
  if (typeof window === "undefined") return undefined;

  const token = localStorage.getItem("token");
  if (!token) return undefined;

  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Fetch wrapper with auth.
 */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...options.headers,
    ...getAuthHeader(),
  };

  return fetch(apiUrl(path), {
    ...options,
    headers,
  });
}

/**
 * API client for common operations.
 */
export const api = {
  /**
   * Get Google OAuth login URL.
   */
  async getGoogleLoginUrl(): Promise<string> {
    const res = await fetch(apiUrl("/auth/google/login"));
    const data = await res.json();
    return data.url;
  },

  /**
   * Validate current token.
   * Returns { valid: true, user } on success
   * Returns { valid: false } on auth error (401/403) - token is invalid
   * Returns { valid: false, serverError: true } on server/network error - don't logout
   */
  async validateToken(): Promise<{
    valid: boolean;
    user?: any;
    serverError?: boolean;
  }> {
    try {
      // Use /validate/full to get profileData for profile setup check
      const res = await fetchWithAuth("/auth/validate/full");
      if (!res.ok) {
        // 401/403 means token is actually invalid - should logout
        if (res.status === 401 || res.status === 403) {
          return { valid: false };
        }
        // Other errors (500, etc) - server issue, don't logout
        return { valid: false, serverError: true };
      }
      const data = await res.json();
      return { valid: true, user: data.user };
    } catch {
      // Network error - don't logout
      return { valid: false, serverError: true };
    }
  },

  /**
   * Upload image.
   */
  async uploadImage(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetchWithAuth("/images/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  /**
   * Get images list (user's uploaded images).
   */
  async getImages(page = 1, pageSize = 20): Promise<any> {
    const res = await fetchWithAuth(
      `/images?page=${page}&page_size=${pageSize}`
    );
    if (!res.ok) throw new Error("Failed to fetch images");
    return res.json();
  },

  /**
   * Get recent images from entire system.
   * Used for "Những khoảnh khắc đáng nhớ" section.
   */
  async getRecentImages(page = 1, pageSize = 6): Promise<any> {
    const res = await fetchWithAuth(
      `/images/recent?page=${page}&page_size=${pageSize}`
    );
    if (!res.ok) throw new Error("Failed to fetch recent images");
    return res.json();
  },

  // ==================
  // Public APIs (No Auth Required)
  // ==================

  /**
   * Get public recent images - NO AUTH REQUIRED.
   * Used for homepage when user is not logged in.
   */
  async getPublicRecentImages(page = 1, pageSize = 20): Promise<any> {
    const res = await fetch(
      apiUrl(`/images/public/recent?page=${page}&page_size=${pageSize}`)
    );
    if (!res.ok) throw new Error("Failed to fetch public images");
    return res.json();
  },

  /**
   * Get public image details - NO AUTH REQUIRED.
   */
  async getPublicImage(imageId: string): Promise<any> {
    const res = await fetch(apiUrl(`/images/public/${imageId}`));
    if (!res.ok) throw new Error("Failed to fetch image");
    return res.json();
  },

  /**
   * Register face.
   */
  async registerFace(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetchWithAuth("/users/register-face", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Face registration failed");
    return res.json();
  },

  /**
   * Search faces.
   */
  async searchFaces(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetchWithAuth("/faces/search", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Search failed");
    return res.json();
  },

  /**
   * Get images with user's face.
   */
  async getMyFaceImages(page = 1, pageSize = 20): Promise<any> {
    const res = await fetchWithAuth(
      `/images/my-faces?page=${page}&page_size=${pageSize}`
    );
    if (!res.ok) throw new Error("Failed to fetch images");
    return res.json();
  },

  /**
   * Update user profile.
   */
  async updateProfile(data: {
    name?: string;
    profileData?: { school?: string; phone_number?: string };
  }): Promise<any> {
    const res = await fetchWithAuth("/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Có lỗi xảy ra khi cập nhật thông tin");
    }
    return res.json();
  },

  /**
   * Get face registration status.
   */
  async getFaceStatus(): Promise<{
    hasRegisteredFace: boolean;
    registeredAt?: string;
  }> {
    const res = await fetchWithAuth("/users/face-status");
    if (!res.ok) throw new Error("Failed to get face status");
    return res.json();
  },

  // ==================
  // Admin APIs
  // ==================

  /**
   * Get admin stats.
   */
  async adminGetStats(): Promise<any> {
    const res = await fetchWithAuth("/admin/stats");
    if (!res.ok) throw new Error("Failed to get stats");
    return res.json();
  },

  /**
   * List all images (admin).
   */
  async adminGetImages(page = 1, pageSize = 20, status?: string): Promise<any> {
    let url = `/admin/images?page=${page}&page_size=${pageSize}`;
    if (status) url += `&status=${status}`;
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error("Failed to fetch images");
    return res.json();
  },

  /**
   * Upload image (admin only - uses /images/upload which requires admin role).
   */
  async adminUploadImage(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetchWithAuth("/images/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  /**
   * Get image details with faces (admin).
   */
  async adminGetImage(imageId: string): Promise<any> {
    const res = await fetchWithAuth(`/admin/images/${imageId}`);
    if (!res.ok) throw new Error("Failed to fetch image");
    return res.json();
  },

  /**
   * Delete image (admin).
   */
  async adminDeleteImage(imageId: string): Promise<void> {
    const res = await fetchWithAuth(`/admin/images/${imageId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete image");
  },

  /**
   * Update face assignment (admin).
   */
  async adminUpdateFace(faceId: string, userId: string | null): Promise<any> {
    const res = await fetchWithAuth(`/admin/faces/${faceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Failed to update face");
    return res.json();
  },

  /**
   * Delete a face (admin). Also removes from Qdrant.
   */
  async adminDeleteFace(faceId: string): Promise<void> {
    const res = await fetchWithAuth(`/admin/faces/${faceId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete face");
  },

  /**
   * List users with pagination (admin).
   */
  async adminListUsers(page = 1, pageSize = 20, search?: string): Promise<any> {
    let url = `/admin/users?page=${page}&page_size=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  /**
   * Get user details (admin).
   */
  async adminGetUser(userId: string): Promise<any> {
    const res = await fetchWithAuth(`/admin/users/${userId}`);
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  /**
   * Update user role (admin).
   */
  async adminUpdateUserRole(userId: string, role: string): Promise<any> {
    const res = await fetchWithAuth(`/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error("Failed to update role");
    return res.json();
  },

  /**
   * Delete user (admin).
   */
  async adminDeleteUser(userId: string): Promise<void> {
    const res = await fetchWithAuth(`/admin/users/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete user");
  },
};
