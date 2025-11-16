import Inbox from './pages/inbox';
import type { FC } from 'react';
import React from 'react';
import TemplatesManager from './components/TemplatesManager';
import StaffInbox from './pages/staffInbox';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ConfigProvider } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import StaffRoute from './components/StaffRoute';
import AdminRoute from './components/AdminRoute';
import MinimalChart from './components/MinimalChart';

// Pages
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Dashboard from './components/Dashboard';
import GuestDashboard from './components/GuestDashboard';
import StaffDashboard from './components/StaffDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagement from './components/admin/UserManagement';
import ActivityLogs from './components/admin/ActivityLogs';
import Statistics from './components/admin/Statistics';
import SystemSettings from './components/admin/SystemSettings';
import DocumentRequestForm from './components/DocumentRequestForm';
import InquiryForm from './components/InquiryForm';
import Goodbye from './components/Goodbye';
import Logout from './components/Logout';
import InquiryTracker from './pages/InquiryTracker';
import ResidentPortal from './components/ResidentPortal';
import LandingPage from './components/LandingPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MessageInbox from './components/admin/MessageInbox';
import DocumentHistory from './components/DocumentHistory';
import Announcements from './components/admin/Announcements';
import AnnouncementsList from './components/AnnouncementsList';
import VerificationRequests from './components/admin/VerificationRequests';
import theme from './theme';

const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (user.role === 'staff') {
    return <Navigate to="/staff-dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

interface AppProps {}

const App: FC<AppProps> = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfigProvider>
        <Router>
          <AuthProvider>
            <Routes>
              {/* Landing Page as root */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/redirect" element={<RootRedirect />} />
              {/* Public Routes */}
              <Route path="/login" element={<LoginForm />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/register" element={<RegisterForm />} />
              <Route path="/goodbye" element={<Goodbye />} />
              <Route path="/logout" element={<Logout />} />
              {/* Protected Routes (with Layout) */}
              <Route element={<Layout />}>
                {/* Added for sidebar navigation */}
                <Route path="/home" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/request" element={<PrivateRoute><DocumentRequestForm /></PrivateRoute>} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/guest/dashboard" element={<PrivateRoute><GuestDashboard /></PrivateRoute>} />
                <Route path="/request-document" element={<PrivateRoute><DocumentRequestForm /></PrivateRoute>} />
                <Route path="/contact" element={<PrivateRoute><InquiryForm /></PrivateRoute>} />
                <Route path="/inquiries" element={<PrivateRoute><InquiryForm /></PrivateRoute>} />
                <Route path="/inquiry-tracker" element={<StaffRoute><InquiryTracker /></StaffRoute>} />
                {/* Staff Routes */}
                <Route path="/staff-dashboard" element={<StaffRoute><StaffDashboard /></StaffRoute>} />
                <Route path="/document-processing" element={<StaffRoute>{React.createElement(require('./components/DocumentProcessing').default)}</StaffRoute>} />
                <Route path="/templates-manager" element={<StaffRoute><TemplatesManager /></StaffRoute>} />
                <Route path="/staff/inbox" element={<StaffRoute><StaffInbox /></StaffRoute>} />
                {/* Admin Routes */}
                <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/messages" element={<AdminRoute><MessageInbox /></AdminRoute>} />
                <Route path="/admin/verification-requests" element={<AdminRoute><VerificationRequests /></AdminRoute>} />
                {/* Announcements listing for residents/staff */}
                <Route path="/announcements" element={<PrivateRoute><AnnouncementsList /></PrivateRoute>} />
                {/* Admin-only announcement compose page */}
                <Route path="/admin/announcements" element={<AdminRoute><Announcements /></AdminRoute>} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
                <Route path="/admin/activity" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
                <Route path="/admin/statistics" element={<AdminRoute><Statistics /></AdminRoute>} />
                <Route path="/admin/settings" element={<AdminRoute><SystemSettings /></AdminRoute>} />
                {/* Resident Profile Route */}
                <Route path="/profile" element={<PrivateRoute><ResidentPortal /></PrivateRoute>} />
                <Route path="/document-history" element={<PrivateRoute><DocumentHistory /></PrivateRoute>} />
                <Route path="/inbox" element={<PrivateRoute><Inbox /></PrivateRoute>} />
              </Route>
            </Routes>
          </AuthProvider>
        </Router>
      </ConfigProvider>
    </ThemeProvider>
  );
};

export type { AppProps };
export default App;
