import axios from 'axios';

const API_BASE = '/api/v1';

// Types
export interface User {
  user_id: string;
  username: string;
  email: string | null;
  is_admin: boolean;
  is_disabled: boolean;
  created_at?: string;
  id?: string;
}

export interface PasswordResetRequest {
  id: string;
  user_id: string;
  email: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  token?: string;
}

export interface Model { id: string; name: string; provider: string; is_active: boolean; }
export interface File { id: string; filename: string; knowledge_id?: string; created_at: string; }
export interface Catalog { id: string; name: string; description?: string; }
export interface Library { library_id: string; id?: string; name: string; knowledge_id?: string; }
export interface Provider { id: string; name: string; type: string; }
export interface Group { group_id: string; id?: string; name: string; description?: string; }
export interface Category { id: string; name: string; parent_id?: string; }
export interface Knowledge { id: string; name: string; description?: string; library_ids?: string[]; }
export interface Language { id: number; language_code: string; language_name: string; is_active: boolean; created_by: string; created_at?: string; }

// Generic response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages?: number;
}

// JWT Token tracking
export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function removeToken() {
  localStorage.removeItem('auth_token');
}

// Core fetch function
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const method = options?.method || 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeToken(); // Invalid token
    }
    let errorMsg = response.statusText;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorJson.message || errorMsg;
    } catch (e) {
      const errorText = await response.text();
      errorMsg = errorText || errorMsg;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const apiClient = axios.create({
  baseURL: API_BASE,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (credentials: { username: string; password: string }) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      let errorMsg = 'Login failed';
      try {
        const errorJson = await response.json();
        errorMsg = errorJson.error || errorJson.message || errorMsg;
      } catch (e) {
        const errorText = await response.text();
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.access_token) {
      setToken(data.access_token);
    }

    return data;
  },
  logout: async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore
    } finally {
      removeToken();
    }
  },
  getCurrentUser: async () => {
    try {
      const data: any = await fetchApi('/auth/me');
      // /api/v1/auth/me returns UserResponse directly (user_id, username, email, ...)
      if (data && data.user_id) {
        return { success: true, data: data as User };
      }
      return { success: false, error: 'Not authenticated' };
    } catch (e) {
      return { success: false, error: 'Not authenticated' };
    }
  },
};

// Generic CRUD factory
function createCrudApi<T>(basePath: string) {
  return {
    getAll: async (params?: { page?: number; per_page?: number; search?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>);
      return fetchApi<any>(`${basePath}?${query}`); // keeping it any here to match old type expectations
    },
    getById: async (id: string) => {
      return fetchApi<T>(`${basePath}/${id}`);
    },
    create: async (data: Partial<T>) => {
      return fetchApi<T>(basePath, { method: 'POST', body: JSON.stringify(data) });
    },
    update: async (id: string, data: Partial<T>) => {
      return fetchApi<T>(`${basePath}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete: async (id: string) => {
      return fetchApi<{ success: boolean }>(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
}

// API instances
export const usersApi = createCrudApi<User>('/admin/users');
export const modelsApi = {
  ...createCrudApi<Model>('/admin/models'),
  setDefault: async (id: string) => {
    return fetchApi<{ success: boolean }>(`/admin/models/set-default/${id}`, { method: 'POST' });
  },
};
export const filesApi = createCrudApi<File>('/admin/files');
export const catalogsApi = createCrudApi<Catalog>('/admin/catalogs');
export const librariesApi = createCrudApi<Library>('/admin/libraries');
export const providersApi = createCrudApi<Provider>('/admin/providers');
export const groupsApi = createCrudApi<Group>('/admin/groups');
export const categoriesApi = createCrudApi<Category>('/admin/categories');
export const knowledgesApi = createCrudApi<Knowledge>('/admin/knowledges');
export const languagesApi = createCrudApi<Language>('/admin/languages');

export const resetRequestsApi = {
  getAll: async (params?: { status?: string; page?: number; per_page?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>);
    return fetchApi<any>(`/admin/password-reset-requests?${query}`);
  },
  approve: async (id: string) => {
    return fetchApi<{ success: boolean }>(`/admin/password-reset-requests/${id}/approve`, { method: 'POST' });
  },
  deny: async (id: string) => {
    return fetchApi<{ success: boolean }>(`/admin/password-reset-requests/${id}/deny`, { method: 'POST' });
  },
};

export const aiDescriptionApi = {
  generateDescription: async (data: { context?: string; requirements?: string[] }) => {
    return fetchApi<{ description: string }>('/admin/ai/generate-description', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  generate: async (data: { item_type?: string; context?: string }) => {
    return fetchApi<{ description: string }>('/admin/ai/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export interface GenerateDescriptionRequest {
  context?: string;
  requirements?: string[];
  item_type?: string;
}
