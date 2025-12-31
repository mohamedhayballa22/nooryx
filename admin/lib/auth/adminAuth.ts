import { AuthProvider } from 'react-admin';
import { apiFetch } from '@/lib/api';

export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    const form = new FormData();
    form.append('username', username);
    form.append('password', password);

    await apiFetch('/admin/login', {
      method: 'POST',
      body: form,
    });
  },
  
  checkAuth: async () => {
    try {
      const res = await apiFetch('/admin/sessions/current');
      if (!res.ok) {
        return Promise.reject();
      }
      return Promise.resolve();
    } catch {
      return Promise.reject();
    }
  },

  getIdentity: async () => {
    const res = await apiFetch('/admin/sessions/current');
    const user = await res.json();

    return {
      id: user.id,
      fullName: user.email,
    };
  },

  checkError: async (error) => {
    const status = error?.status;
    if (status === 401 || status === 403) {
      return Promise.reject();
    }
    return Promise.resolve();
  },

  logout: async () => {
    // This will always succeed now
    await apiFetch('/admin/sessions/logout', {
      method: 'POST',
    });
  },

  getPermissions: async () => Promise.resolve(),
};
