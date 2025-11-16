import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { AuthState, User } from '../types/auth';
import { jwtDecode } from 'jwt-decode';

interface AuthContextType extends AuthState {
  login: (token: string) => void;
  logout: () => void;
  isStaff: () => boolean;
  isAdmin: () => boolean;
  isResident: () => boolean;
  mode: 'resident' | 'staff';
  switchMode: (mode: 'resident' | 'staff') => void;
  setUser?: (user: User | null) => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
};

const AuthContext = createContext<AuthContextType>({
  ...initialState,
  login: () => {},
  logout: () => {},
  isStaff: () => false,
  isAdmin: () => false,
  isResident: () => false,
  mode: 'resident',
  switchMode: () => {},
});

export const useAuth = () => useContext(AuthContext);

type AuthAction =
  | { type: 'LOGIN'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'RESTORE_TOKEN'; payload: string };

// Safely decode JWT payload to a User object. Returns null on invalid token.
function safeDecodeJwt(token?: string | null): User | null {
  if (!token || typeof token !== 'string') return null;
  // JWT should have three parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.warn('safeDecodeJwt: token does not have 3 parts, skipping decode');
    return null;
  }
  try {
    // jwtDecode will throw if token part is invalid
    return jwtDecode<User>(token);
  } catch (err) {
    console.warn('safeDecodeJwt: failed to decode token', err);
    return null;
  }
}

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN':
    case 'RESTORE_TOKEN': {
      let user: User | null = null;
      // Only attempt decode when payload looks like a JWT
      user = safeDecodeJwt(action.payload);
      return {
        isAuthenticated: !!user,
        token: user ? action.payload : null,
        user,
      };
    }
    case 'LOGOUT':
      return initialState;
    default:
      return state;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  // If we have a cached full profile from previous session, hydrate it
  useEffect(() => {
    try {
      const stored = localStorage.getItem('userProfile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.username) {
          const token = localStorage.getItem('token') || null;
          // Only dispatch LOGIN if we have a valid-looking token
          const decoded = safeDecodeJwt(token);
          if (token && decoded) dispatch({ type: 'LOGIN', payload: token });
          // Overwrite the decoded token user with the full profile
          // Direct state mutation isn't exposed; we rely on components reading localStorage.userProfile when available.
        }
      }
    } catch (err) {
      // ignore
    }
  }, []);
  const [mode, setMode] = React.useState<'resident' | 'staff'>('resident');
  const navigate = useNavigate();

  // Helper to check if JWT is expired
  function isTokenValid(token: string): boolean {
    try {
      const decoded: any = safeDecodeJwt(token);
      if (!decoded) return false;
      if (!decoded.exp) return false;
      const now = Date.now() / 1000;
      return decoded.exp > now;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && isTokenValid(token)) {
      // Restore token and fetch the full user profile from server to populate barangayID and other fields
      dispatch({ type: 'RESTORE_TOKEN', payload: token });
      // Fetch full profile asynchronously and update state
      (async () => {
        try {
          // Import here to avoid circular import at module load
          const { authService } = await import('../services/api');
          const profile = await authService.getCurrentUser();
          if (profile) {
            // Replace token-decoded user with full profile
            dispatch({ type: 'LOGIN', payload: token });
            // Directly replace stored token user via local storage (AuthContext uses token->user decode),
            // but we also want the richer profile available on context.user; we'll patch state by dispatching RESTORE_TOKEN again with the same token
            // and rely on components reading from localStorage or triggering a reload. For now, we set user in localStorage for consumers.
            localStorage.setItem('userProfile', JSON.stringify(profile));
          }
        } catch (err) {
          // ignore profile fetch errors; UI will fallback to token-decoded values
        }
      })();
    } else {
      localStorage.removeItem('token');
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  // Listen for cross-component user updates dispatched as a CustomEvent
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent;
        let updatedUser = ce?.detail;
        if (!updatedUser) return;
        // Support nested shapes: { user: {...} } or { data: { user: {...} } }
        if (updatedUser.user) updatedUser = updatedUser.user;
        if (updatedUser.data && updatedUser.data.user) updatedUser = updatedUser.data.user;
        // If it's a deletion notification, and it affects current user, log out
        const current = state.user as any;
        if (!current) return;
        if (updatedUser.deleted && updatedUser._id && current._id && updatedUser._id === current._id) {
          // If the current user was deleted by admin, force logout
          setUser(null);
          return;
        }
        // Only update if the updated user matches the current user's id or username
        if (updatedUser._id && current._id && updatedUser._id === current._id) {
          setUser(updatedUser as User);
        } else if (updatedUser.username && current.username && updatedUser.username === current.username) {
          setUser(updatedUser as User);
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('userProfileUpdated', handler as EventListener);
    return () => window.removeEventListener('userProfileUpdated', handler as EventListener);
  }, [state.user]);

  const login = (token: string) => {
    localStorage.setItem('token', token);
    // Set cookie for backend authentication (expires in 1 day)
    document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
    dispatch({ type: 'LOGIN', payload: token });
    // Fetch and persist full profile after login
    (async () => {
      try {
        const { authService } = await import('../services/api');
        const profile = await authService.getCurrentUser();
        if (profile) {
          localStorage.setItem('userProfile', JSON.stringify(profile));
          // update state by re-dispatching login (so token will decode) -- components should read latest profile from localStorage when available
          dispatch({ type: 'LOGIN', payload: token });
        }
      } catch (err) {
        // ignore
      }
    })();
  };

  const setUser = (user: User | null) => {
    if (user) {
      // persist richer profile
      localStorage.setItem('userProfile', JSON.stringify(user));
      // also re-dispatch LOGIN with existing token to keep state consistent
      const token = localStorage.getItem('token');
      if (token) dispatch({ type: 'LOGIN', payload: token });
    } else {
      localStorage.removeItem('userProfile');
      dispatch({ type: 'LOGOUT' });
    }
  };

  const logout = () => {
    // Try to notify backend, but don't block logout on failure
    authService.logout().catch(() => {});
    localStorage.removeItem('token');
    // Remove the token cookie
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    dispatch({ type: 'LOGOUT' });
    navigate('/login', { replace: true });
  };

  const isStaff = () => state.user?.role === 'staff';
  const isAdmin = () => state.user?.role === 'admin';
  const isResident = () => state.user?.role === 'resident';

  const switchMode = (newMode: 'resident' | 'staff') => {
    setMode(newMode);
  };

  return (
    <AuthContext.Provider value={{ 
      ...state, 
      login, 
      logout,
      isStaff,
      isAdmin,
      isResident,
      mode,
      switchMode,
      setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
