import { AuthProvider } from 'react-admin';
import { apiFetch } from '@/lib/api';

export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    const form = new FormData();
    form.append('username', username);
    form.append('password', password);

    await apiFetch('/auth/admin/login', {
      method: 'POST',
      body: form,
    });
  },

  /**
   * Never reject, ever.
   * Otherwise react-admin WILL call logout().
   */
  checkAuth: async () => {
    try {
      const res = await apiFetch('/auth/admin/sessions/current');
      if (!res.ok) {
        return Promise.reject();
      }
      return Promise.resolve();
    } catch {
      return Promise.reject();
    }
  },

  getIdentity: async () => {
    const res = await apiFetch('/auth/admin/sessions/current');
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
    await apiFetch('/auth/admin/sessions/logout', {
      method: 'POST',
    });
  },

  getPermissions: async () => Promise.resolve(),
};
