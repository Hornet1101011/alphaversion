import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin, Result, Button } from 'antd';

interface AdminRouteProps {
  children: React.ReactElement;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const auth = useAuth();
  const navigate = useNavigate();

  const currentUser = auth?.user as any;
  const isAdmin = typeof auth?.isAdmin === 'function' ? auth.isAdmin() : currentUser?.role === 'admin' || currentUser?.isAdmin === true;

  // If no user but there is a token in storage, auth restore may be in progress — show a spinner
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!currentUser && token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but not admin — show 403
  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Sorry, you are not authorized to access this page."
        extra={<Button type="primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>}
      />
    );
  }

  return children;
};

export default AdminRoute;
