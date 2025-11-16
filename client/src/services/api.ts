import axios from 'axios';
import { 
  SystemSettings,
  User,
  ActivityLog,
  SystemStatistics
} from '../types/admin';
import { Notification } from '../types/notification';
import { localDB } from './localDatabase';
import { syncService } from './syncService';
// Fetch template text for a document type
export const getTemplateText = (type: string) =>
  axiosInstance.get(`/templates/${type}`).then(res => res.data.text);

// Notification API
const notificationAPI = {
  // Get all notifications for current admin
  getNotifications: async (): Promise<Notification[]> => {
    try {
      const response = await axiosInstance.get('/notifications');
      // Normalize response to array
      const data = Array.isArray(response.data) ? response.data : (response.data && response.data.data) ? response.data.data : [];
      return data;
    } catch (err: any) {
      // If the primary endpoint fails (404 or auth), attempt public fallback which returns [] in server routes
      try {
        const fallback = await axiosInstance.get('/notifications/fallback');
        return Array.isArray(fallback.data) ? fallback.data : (fallback.data && fallback.data.data) ? fallback.data.data : [];
      } catch (err2) {
        // As a last resort, return empty array so UI remains functional
        console.error('notificationAPI.getNotifications failed:', err);
        return [];
      }
    }
  },
  // Approve staff request
  approveStaff: async (userId: string, notificationId: string) => {
    const response = await axiosInstance.post('/notifications/approve', { userId, notificationId });
    return response.data;
  },
  // Reject staff request
  rejectStaff: async (notificationId: string, reason?: string) => {
    const response = await axiosInstance.post('/notifications/reject', { notificationId, reason });
    return response.data;
  },
  // Mark notification as read
  markAsRead: async (notificationId: string) => {
    const response = await axiosInstance.post('/notifications/read', { notificationId });
    return response.data;
  },
};

// Staff registration API
export const staffRegister = async (data: any) => {
  const response = await axiosInstance.post('/auth/register/staff', data);
  return response.data;
};

// Use a relative API base so the dev server proxy and production deployment
// both route requests correctly (avoids hard-coded localhost which can
// cause CORS or incorrect-host issues). The CRA dev server has a proxy
// set to http://localhost:5000 in client/package.json, so using '/api'
// will be forwarded to the backend during development.
// Allow an override via REACT_APP_API_URL for cases where the API is hosted
// on a different origin (useful for staging). Default to the relative `/api`
// so the CRA dev proxy forwards requests to the backend in development.
export const API_URL = process.env.REACT_APP_API_URL || '/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with every request
});


// Auth service wrapper
export const authService = {
  login: async (email: string, password: string) => {
    const response = await axiosInstance.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (userData: any) => {
    const response = await axiosInstance.post('/auth/register', userData);
    return response.data;
  },
  logout: async () => {
    await axiosInstance.post('/auth/logout');
  },
  // Fetch current authenticated user's full profile
  getCurrentUser: async () => {
    const response = await axiosInstance.get('/auth/me');
    return response.data;
  }
};

// Add auth token to requests
axiosInstance.interceptors.request.use((config) => {
  // Prefer the primary auth token (set at login). Fall back to a guest session
  // token if present so guest users can make authenticated requests that the
  // server accepts (the server issues `sessionToken` for guest flows).
  const token = localStorage.getItem('token') || localStorage.getItem('guestSessionToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response handler: if any request returns 401, clear auth and redirect to login
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const status = error?.response?.status;
      if (status === 401) {
        // Avoid redirect loops: only redirect if we're not already on the login page
        // and the failed request was not the login attempt itself.
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname || '';
          const requestUrl = (error?.config && (error.config.url || '')) || (error?.request && error.request.responseURL) || '';
          const isLoginRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/me');
          const isLoginPage = currentPath === '/login' || currentPath.startsWith('/login');

          if (!isLoginPage && !isLoginRequest) {
            console.warn('API responded 401 Unauthorized — clearing auth and redirecting to login');
            try {
              localStorage.removeItem('token');
              localStorage.removeItem('guestSessionToken');
            } catch (e) {}

            // Debounce multiple simultaneous 401s so we only force one navigation.
            try {
              if (!sessionStorage.getItem('redirectingToLogin')) {
                sessionStorage.setItem('redirectingToLogin', '1');
                // Small timeout so callers can finish their promise chains and avoid
                // racing navigation that could otherwise produce reload storms.
                setTimeout(() => {
                  window.location.href = '/login';
                }, 100);
              } else {
                // Already in the process of redirecting; no-op to avoid loops.
              }
            } catch (e) {
              // sessionStorage may throw in some environments; fallback to immediate redirect
              try {
                window.location.href = '/login';
              } catch (_e) {}
            }
          } else {
            // If we're already on the login page or this was the login request,
            // don't redirect — let the login UI display the error to the user.
            // Also clear tokens in case they're present.
            try { localStorage.removeItem('guestSessionToken'); } catch (e) {}
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return Promise.reject(error);
  }
);

// API interfaces

export const getInbox = async () => {
  return axiosInstance.get('/messages/inbox');
};

// Verification API for admin actions
export const verificationAPI = {
  getRequests: async () => axiosInstance.get('/verification/admin/requests').then(res => res.data),
  verifyUser: async (userId: string, verified: boolean) => axiosInstance.post(`/verification/admin/verify-user/${userId}`, { verified }).then(res => res.data),
  // URL to stream/download a verification file by GridFS id
  getFileUrl: (fileId: string) => `${API_URL.replace(/\/$/, '')}/verification/file/${fileId}`,
  // Approve a verification request by request id (admin)
  approveRequest: async (requestId: string) => axiosInstance.post(`/verification/admin/requests/${requestId}/approve`).then(res => res.data),
  // Reject a verification request by request id (admin)
  rejectRequest: async (requestId: string, reason?: string) => axiosInstance.post(`/verification/admin/requests/${requestId}/reject`, { reason }).then(res => res.data),
};
interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  address: string;
  contactNumber: string;
  barangayID: string;
  fullName?: string;
  username?: string;
}

interface DocumentRequest {
  type: string; // add this for backend compatibility
  documentType: string;
  purpose: string;
  additionalDetails?: Record<string, any>;
  barangayID?: string;
}

interface InquiryRequest {
  type: string;
  subject: string;
  message: string;
  assignedRole?: string;
  assignedTo?: string[];
}

// API implementations
const auth = {
  login: (credentials: LoginCredentials) => 
    axiosInstance.post('/auth/login', credentials).then(response => response.data),
  register: (data: RegisterData) => 
    axiosInstance.post('/auth/register', data).then(response => response.data),
};

export const documentsAPI = {
  getMyDocuments: () => 
    axiosInstance.get('/document-requests/my-requests').then(response => response.data),
  requestDocument: (data: DocumentRequest) => 
    axiosInstance.post('/document-requests', data).then(response => response.data),
  getDocumentById: (id: string) => 
    axiosInstance.get(`/document-requests/${id}`).then(response => response.data),
  getAllDocuments: () =>
    axiosInstance.get('/document-requests/all').then(response => response.data),
  getDocumentRecords: () =>
    axiosInstance.get('/document-requests/all').then(response => response.data),
  updateDocumentStatus: (id: string, data: { status: string; notes?: string }) =>
    axiosInstance.patch(`/document-requests/${id}/process`, data).then(response => response.data),
  processDocument: (id: string) =>
    axiosInstance.patch(`/document-requests/${id}/process`).then(response => response.data),
  listFiles: () =>
    axiosInstance.get('/documents/list').then(response => response.data),
  deleteFile: (id: string) =>
    axiosInstance.delete(`/documents/file/${id}`).then(response => response.data),
  updateFileStatus: (id: string, data: { status: string }) =>
    axiosInstance.patch(`/documents/file/${id}/status`, data).then(response => response.data),
  getFilledDocument: (id: string) =>
    axiosInstance.get(`/document-requests/${id}/filled`).then(response => response.data),
  previewFilledDocument: (data: any) =>
    axiosInstance.post('/document-requests/preview-filled', data).then(response => response.data),
};

const contact = {
  submitInquiry: (data: any) => {
    // Support FormData (multipart) or JSON payloads
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return axiosInstance.post('/inquiries', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(response => response.data);
    }
    return axiosInstance.post('/inquiries', data).then(response => response.data);
  },
  getMyInquiries: (username?: string, barangayID?: string) =>
    axiosInstance.get('/inquiries/my-inquiries', {
      params: username && barangayID ? { username, barangayID } : undefined
    }).then(response => response.data),
  getInquiryById: (id: string) =>
    axiosInstance.get(`/inquiries/${id}`).then(response => response.data),
  // Staff-specific endpoints
  getAllInquiries: () =>
  axiosInstance.get('/inquiries').then(response => response.data),
  respondToInquiry: (id: string, data: { response: string }) =>
    axiosInstance.post(`/inquiries/${id}/responses`, data).then(response => response.data),
  // Mark an inquiry as resolved (admin/staff)
  resolveInquiry: (id: string) =>
    axiosInstance.patch(`/inquiries/${id}`, { status: 'resolved' }).then(response => response.data),
  // Public announcements
  getAnnouncements: () =>
    axiosInstance.get('/announcements').then(response => response.data),
  getAnnouncementById: (id: string) =>
    axiosInstance.get(`/announcements/${id}`).then(response => response.data),
};

// Requests API (generic requests collection)
export const requestsAPI = {
  // Get all requests (admin/staff)
  getAllRequests: async () => axiosInstance.get('/requests').then(response => response.data),
  // Get a single request by id
  getRequestById: async (id: string) => axiosInstance.get(`/requests/${id}`).then(response => response.data),
  // Get staff access requests only (client-side filter)
  getStaffAccessRequests: async () => {
    const all = await axiosInstance.get('/requests').then(response => response.data);
    return Array.isArray(all)
      ? all.filter((r: any) => (r.type || '').toString().toLowerCase() === 'staff_access' && (r.status || '').toString().toLowerCase() === 'pending')
      : [];
  }
  ,
  // Approve a request by id (admin)
  approveRequest: async (id: string) => {
    const response = await axiosInstance.post(`/requests/${id}/approve`);
    return response.data;
  }
};

// Admin API
const admin = {
  createUser: async (userData: any): Promise<void> => {
    try {
      const response = await axiosInstance.post('/admin/users', userData);
      if (response.data) {
        await localDB.saveUser(response.data);
        try {
          // Notify listeners that a user profile was created/updated
          const ev = new CustomEvent('userProfileUpdated', { detail: response.data });
          window.dispatchEvent(ev);
        } catch (err) {
          // ignore
        }
      }
    } catch (error) {
      if (!navigator.onLine) {
        await syncService.performOperation('create', 'users', userData);
      }
      throw error;
    }
  },

  updateUser: async (userId: string, userData: any): Promise<void> => {
    try {
      const response = await axiosInstance.put(`/admin/users/${userId}`, userData);
      if (response.data) {
        await localDB.saveUser(response.data);
        try {
          // Notify any listeners (e.g., AuthContext) that a user profile has updated
          const ev = new CustomEvent('userProfileUpdated', { detail: response.data });
          window.dispatchEvent(ev);
        } catch (err) {
          // ignore
        }
      }
    } catch (error) {
      if (!navigator.onLine) {
        await syncService.performOperation('update', 'users', { ...userData, _id: userId });
      }
      throw error;
    }
  },
  // Demote a staff user back to resident
  demoteUser: async (userId: string) => {
    try {
      const response = await axiosInstance.put(`/admin/users/${userId}`, { role: 'resident' });
      return response.data;
    } catch (error) {
      if (!navigator.onLine) {
        // queue for sync if offline
        await syncService.performOperation('update', 'users', { _id: userId, role: 'resident' });
        return;
      }
      throw error;
    }
  },
  // System Settings
  getSystemSettings: async (): Promise<SystemSettings> => {
    try {
      // Try admin-only settings first
      const response = await axiosInstance.get('/admin/settings');
      return response.data;
    } catch (error) {
      // If offline, return cached settings
      if (!navigator.onLine) {
        const settings = await localDB.getSettings();
        if (settings) return settings;
      }
      // If the dev proxy isn't forwarding (requests hit :3000 and return 404),
      // try fallbacks in order: /settings (non-admin), then absolute backend admin/settings,
      // then absolute backend /settings, and finally /settings/public if enabled on server.
      const backendBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      try {
        // try non-admin path on same base (/api/settings)
        const resp = await axiosInstance.get('/settings');
        return resp.data;
      } catch (e1) {
        try {
          const resp2 = await axios.get(`${backendBase.replace(/\/$/, '')}/admin/settings`, { withCredentials: true });
          return resp2.data;
        } catch (e2) {
          try {
            const resp3 = await axios.get(`${backendBase.replace(/\/$/, '')}/settings`, { withCredentials: true });
            return resp3.data;
          } catch (e3) {
            try {
              // try optional public endpoint if server enabled DEBUG_PUBLIC_SETTINGS
              const resp4 = await axiosInstance.get('/settings/public');
              return resp4.data;
            } catch (e4) {
              // As a last resort, return cached settings or a minimal default so UI does not crash
              try {
                const cached = await localDB.getSettings();
                if (cached) return cached;
              } catch (dbErr) {
                // ignore
              }
              console.warn('getSystemSettings: all fallbacks failed; returning empty defaults. Original error:', error);
              // Return a minimal default settings object to keep UI functional
              const defaults: any = {
                siteName: 'Barangay Information System',
                contactEmail: '',
                smtp: { passwordSet: false },
              };
              return defaults as SystemSettings;
            }
          }
        }
      }
    }
  },

  updateSystemSettings: async (settings: SystemSettings): Promise<void> => {
    try {
      const response = await axiosInstance.put('/admin/settings', settings);
      await localDB.saveSettings(settings);
      return response.data;
    } catch (error) {
      // If offline, queue for sync and return
      if (!navigator.onLine) {
        await syncService.performOperation('update', 'settings', settings);
        return;
      }
      // If the dev proxy isn't forwarding (requests hit :3000 and return 404),
      // try a direct request to the backend API base as a fallback.
      try {
        const backendBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        const url = `${backendBase.replace(/\/$/, '')}/admin/settings`;
        const resp = await axios.put(url, settings, { withCredentials: true });
        // persist locally as well
        try { await localDB.saveSettings(settings); } catch (e) {}
        return resp.data;
      } catch (fall) {
        // rethrow original error so callers receive the initial failure context
        throw error;
      }
    }
  },

  // Send test SMTP email using current system SMTP settings (server-side will decrypt)
  testSmtp: async (to: string) => {
    const response = await axiosInstance.post('/admin/settings/test-smtp', { to });
    return response.data;
  },

  // User Management
  getUsers: async (): Promise<User[]> => {
    try {
  const response = await axiosInstance.get('/auth/users');
      const users = response.data;
      // Cache users locally
      for (const user of users) {
        await localDB.saveUser(user);
      }
      return users;
    } catch (error) {
      if (!navigator.onLine) {
        // Return cached users if offline
        return localDB.getAllUsers();
      }
      throw error;
    }
  },

  updateUserStatus: async (userId: string, status: string): Promise<void> => {
    try {
      const response = await axiosInstance.put(`/admin/users/${userId}/status`, { status });
      const user = await localDB.getUser(userId);
      if (user) {
        user.status = status;
        await localDB.saveUser(user);
        try {
          // Notify listeners that a user's status has changed
          const ev = new CustomEvent('userProfileUpdated', { detail: user });
          window.dispatchEvent(ev);
        } catch (err) {
          // ignore
        }
      }
      return response.data;
    } catch (error) {
      if (!navigator.onLine) {
        // Update locally and queue for sync
        const user = await localDB.getUser(userId);
        if (user) {
          user.status = status;
          await syncService.performOperation('update', 'users', user);
        }
        return;
      }
      throw error;
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    try {
      await axiosInstance.delete(`/admin/users/${userId}`);
      await localDB.deleteUser(userId);
      try {
        // Notify listeners that a user was deleted; include id so listeners can react
        const ev = new CustomEvent('userProfileUpdated', { detail: { _id: userId, deleted: true } });
        window.dispatchEvent(ev);
      } catch (err) {
        // ignore
      }
    } catch (error) {
      if (!navigator.onLine) {
        // Delete locally and queue for sync
        await syncService.performOperation('delete', 'users', { _id: userId });
        return;
      }
      throw error;
    }
  },

  // Activity Logs
  getActivityLogs: (filters: { startDate?: string; endDate?: string; module?: string; userId?: string }): Promise<ActivityLog[]> =>
    axiosInstance.get('/admin/logs', { params: filters }).then(response => response.data),

  // Statistics
  getSystemStatistics: (): Promise<SystemStatistics> =>
    axiosInstance.get('/admin/statistics').then(response => response.data),

  // Staff Applicants
  getStaffApplicants: async (): Promise<{ count: number; applicants: any[] }> => {
    const response = await axiosInstance.get('/admin/staff-applications');
    return response.data;
  },
  // Get user with resident info (admin)
  getUserWithResident: async (userId: string) => {
    const response = await axiosInstance.get(`/admin/users/${userId}/with-resident`);
    return response.data;
  },
  // Admin: lookup resident by barangayID
  getResidentByBarangayID: async (barangayID: string) => {
    const response = await axiosInstance.get(`/admin/resident/${encodeURIComponent(barangayID)}`);
    return response.data;
  },
  // Admin: get resident by id
  getResident: async (residentId: string) => {
    const response = await axiosInstance.get(`/admin/resident/id/${residentId}`);
    return response.data;
  },
  // Admin: update resident record
  updateResident: async (residentId: string, data: any) => {
    const response = await axiosInstance.put(`/admin/resident/${residentId}`, data);
    return response.data;
  },
  // Admin: upload resident avatar (multipart/form-data)
  uploadResidentAvatar: async (residentId: string, file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    const response = await axiosInstance.post(`/admin/resident/${residentId}/avatar`, form, {
      // Let the browser/axios set the Content-Type including the multipart boundary
    });
    return response.data;
  },
  // Barangay Officials endpoints
  getOfficials: async () => {
    try {
      const response = await axiosInstance.get('/admin/officials');
      return response.data;
    } catch (error) {
      // If proxies/backends aren't responding or return 404, try a public backend URL
      // This attempts the absolute API base (REACT_APP_API_URL or localhost fallback)
      // and purposely omits credentials so public endpoints aren't blocked by auth/proxy.
      // If that also fails, return an empty array so UI remains functional.
      console.warn('getOfficials: primary request failed; attempting public backend fallback. Error:', error);
      try {
        const backendBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        const url = `${backendBase.replace(/\/$/, '')}/officials`;
        // Use the plain axios instance (not axiosInstance) and do NOT send credentials.
        const resp2 = await axios.get(url, { withCredentials: false });
        return Array.isArray(resp2.data) ? resp2.data : [];
      } catch (pfall) {
        return [];
      }
    }
  },
  createOfficial: async (data: any) => {
    try {
      const response = await axiosInstance.post('/admin/officials', data);
      return response.data;
    } catch (error) {
      // If the dev proxy isn't forwarding (requests hit :3000 and return 404),
      // attempt a direct request to the backend API base so developers can still work.
      try {
        const backendBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        const url = `${backendBase.replace(/\/$/, '')}/admin/officials`;
        const resp = await axios.post(url, data, { withCredentials: true });
        return resp.data;
      } catch (fall) {
        // rethrow original error to preserve context for callers
        throw error;
      }
    }
  },
  updateOfficial: async (id: string, data: any) => {
    try {
      const response = await axiosInstance.put(`/admin/officials/${id}`, data);
      return response.data;
    } catch (error) {
      // If offline, queue for sync
      if (!navigator.onLine) {
        await syncService.performOperation('update', 'officials', { ...data, _id: id });
        return;
      }
      // Fallback to backend base if proxy not forwarding
      try {
        const backendBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        const url = `${backendBase.replace(/\/$/, '')}/admin/officials/${id}`;
        const resp = await axios.put(url, data, { withCredentials: true });
        return resp.data;
      } catch (fall) {
        throw error;
      }
    }
  },
  deleteOfficial: async (id: string) => {
    const response = await axiosInstance.delete(`/admin/officials/${id}`);
    return response.data;
  },
  // Disable (optionally suspend until a date) a user
  disableUser: async (userId: string, data?: { suspendedUntil?: string }) => {
    const response = await axiosInstance.patch(`/admin/users/${userId}/disable`, data || {});
    return response.data;
  },
  // Enable a previously disabled user
  enableUser: async (userId: string) => {
    const response = await axiosInstance.patch(`/admin/users/${userId}/enable`);
    return response.data;
  },
  uploadOfficialPhoto: async (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    // Try the axios instance first (should let browser set multipart boundary).
    try {
      const response = await axiosInstance.post(`/admin/officials/${id}/photo`, form, { headers: {} });
      return response.data;
    } catch (err: any) {
      // If server returned a 400 possibly due to malformed multipart headers,
      // attempt a raw fetch fallback which uses the browser-native request
      // (ensures proper Content-Type/boundary). Also surface server response
      // where possible to aid debugging.
      try {
        if (err && err.response && err.response.data) {
          console.error('uploadOfficialPhoto axios error response:', err.response.data);
        } else {
          console.error('uploadOfficialPhoto axios error', err);
        }
      } catch (e) {}

      // Fallback to fetch with credentials so cookies/auth are sent
      try {
        const url = `${API_URL}/admin/officials/${id}/photo`;
        const resp = await fetch(url, {
          method: 'POST',
          body: form,
          credentials: 'include'
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = (data && data.message) ? data.message : `Upload failed with status ${resp.status}`;
          const error = new Error(msg) as any;
          error.response = { status: resp.status, data };
          throw error;
        }
        return data;
      } catch (fetchErr) {
        throw fetchErr;
      }
    }
  },
  // Approve a staff applicant (server should expose this endpoint)
  approveStaffApplicant: async (applicantId: string) => {
    const response = await axiosInstance.post(`/admin/staff-applications/${applicantId}/approve`);
    return response.data;
  },
  // Announcements
  createAnnouncement: async (formData: FormData) => {
    const response = await axiosInstance.post('/admin/announcements', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  listAdminAnnouncements: async () => {
    const response = await axiosInstance.get('/admin/announcements/list');
    return response.data;
  },
  deleteAnnouncement: async (id: string) => {
    const response = await axiosInstance.delete(`/admin/announcements/${id}`);
    return response.data;
  },
  updateAnnouncement: async (id: string, formData: FormData) => {
    const response = await axiosInstance.put(`/admin/announcements/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
};

// Resident Personal Info API
const residentPersonalInfoAPI = {
  getPersonalInfo: async () => {
    // Try several common endpoints used across versions of the server
    const candidates = ['/resident/my-info', '/resident/personal-info', '/resident/profile'];
    for (const path of candidates) {
      try {
        const resp = await axiosInstance.get(path);
        if (resp && resp.data) return resp.data;
      } catch (e) {
        // continue to next candidate
      }
    }
    // Last-resort: hit absolute API_URL to avoid using client origin (avoids 3000 -> 404)
    try {
      const resp = await axios.get(`${API_URL}/resident/personal-info`, { withCredentials: true });
      if (resp && resp.data) return resp.data;
    } catch (e) {
      // ignore and throw below
    }
    const err: any = new Error('Resident personal info not found');
    // attach a pseudo-response to aid callers checking err.response?.status
    err.response = { status: 404 };
    throw err;
  },
  updatePersonalInfo: async (data: any) => {
    const response = await axiosInstance.put('/resident/my-info', data);
    return response.data;
  },
};

export const authAPI = {
  ...auth,
  getUsers: async (): Promise<User[]> => {
    try {
      const response = await axiosInstance.get('/auth/users');
      return response.data;
    } catch (error) {
      // keep logging minimal and rethrow so callers can handle errors
      // ...existing error handling might expect a thrown error
      // eslint-disable-next-line no-console
      console.error('authAPI.getUsers failed', error);
      throw error;
    }
  }
};
export { 
  contact as contactAPI, 
  admin as adminAPI,
  notificationAPI,
  residentPersonalInfoAPI,
  axiosInstance as default
};
