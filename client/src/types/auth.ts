export interface User {
  _id: string;
  fullName: string;
  role: 'admin' | 'staff' | 'resident';
  username: string;
  email: string;
  barangayID: string;
  address: string;
  contactNumber: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  address: string;
  contactNumber: string;
}
