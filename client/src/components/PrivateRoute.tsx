import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  // Allow access when a valid JWT-authenticated user exists OR when a guest profile is present
  // Guest users are stored in context.user with role === 'guest' (set by LoginForm). We treat that as allowed.
  if (!isAuthenticated && !(user && (user as any).role === 'guest')) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
