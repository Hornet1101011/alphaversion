// System Settings Interface
export interface SystemSettings {
  siteName: string;
  barangayName: string;
  barangayAddress: string;
  contactEmail: string;
  contactPhone: string;
  maintainanceMode: boolean;
  allowNewRegistrations: boolean;
  requireEmailVerification: boolean;
  maxDocumentRequests: number;
  documentProcessingDays: number;
  systemNotice: string;
}

// User Management Interfaces
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLogin?: string;
}

// Activity Log Interface
export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  action: string;
  description: string;
  timestamp: string;
  ip?: string;
  module: string;
}

// Statistics Interface
export interface SystemStatistics {
  users: {
    total: number;
    active: number;
    pendingVerification: number;
    blocked: number;
  };
  documents: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    rejected: number;
  };
  inquiries: {
    total: number;
    unresolved: number;
    resolved: number;
  };
  dailyStats: {
    date: string;
    newUsers: number;
    newDocuments: number;
    newInquiries: number;
  }[];
  monthlyStats: {
    month: string;
    totalUsers: number;
    totalDocuments: number;
    totalInquiries: number;
  }[];
}
