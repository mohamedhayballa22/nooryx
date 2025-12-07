import { apiClient } from "./client";

interface LoginCredentials {
  username: string; // email in UI, backend expects 'username'
  password: string;
}

interface LoginResponse {
  email: string;
  first_name: string;
  last_name: string;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  org_id: string;
}

interface CurrentSessionResponse {
  user: User;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const body = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
    });

    return apiClient<LoginResponse>("/auth/jwt/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      requiresAuth: false,
    });
  },

  issueRefresh: async (): Promise<void> => {
    return apiClient("/auth/sessions/issue_refresh", {
      method: "POST",
      requiresAuth: false,
    });
  },

  getCurrentSession: async (): Promise<CurrentSessionResponse> => {
    return apiClient<CurrentSessionResponse>("/auth/sessions/current", {
      requiresAuth: false,
    });
  },

  logout: async (): Promise<void> => {
    return apiClient("/auth/sessions/logout", {
      method: "POST",
      requiresAuth: true,
    });
  },
};
