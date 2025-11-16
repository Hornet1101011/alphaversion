
import React from 'react';
import AppLayout from './AppLayout';
import { Outlet } from 'react-router-dom';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // If children are passed, render them (for legacy usage), otherwise render <Outlet /> for nested routes
  return <AppLayout>{children || <Outlet />}</AppLayout>;
};

export default Layout;
