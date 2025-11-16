
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Badge, Statistic, List, Typography, Space, Avatar, Spin, Button, Drawer, Input, Table, Empty, Modal } from 'antd';
import {
  UserOutlined,
  BellOutlined,
  MailOutlined,
  FileTextOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { adminAPI, notificationAPI, contactAPI, requestsAPI, verificationAPI } from '../../services/api';
import { documentsAPI } from '../../services/api';
import { initNotificationSocket, onNotificationEvent, offNotificationEvent } from '../../services/notificationSocket';
import { Notification } from '../../types/notification';
import { useAuth } from '../../contexts/AuthContext';

// Color palette for SVG pie chart slices
const pieColors = [
  '#6366F1', // Indigo
  '#22C55E', // Green
  '#F59E42', // Orange
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#FBBF24', // Yellow
  '#A21CAF', // Purple
  '#14B8A6', // Teal
];

const { Title, Text } = Typography;

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingRequests: number;
  totalDocuments: number;
  completedRequests: number;
  unreadMessages: number;
}

interface Activity {
  id: string;
  type: 'document' | 'user' | 'system';
  description: string;
  timestamp: string;
  user?: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [documentsModalVisible, setDocumentsModalVisible] = useState(false);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingRequests: 0,
    totalDocuments: 0,
    completedRequests: 0,
    unreadMessages: 0
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [staffAccessNotifs, setStaffAccessNotifs] = useState<Notification[]>([]);
  const [staffRequests, setStaffRequests] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [verifs, setVerifs] = useState<any[]>([]);
  const [verifsLoading, setVerifsLoading] = useState(false);
  const [verifModalVisible, setVerifModalVisible] = useState(false);
  const [selectedVerif, setSelectedVerif] = useState<any | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [inboxInquiries, setInboxInquiries] = useState<any[]>([]);
  // Demo data for mini charts
  const usersTrend = [3, 5, 4, 6, 7, 8, 10]; // last 7 days
  const requestsByType = [
    { type: 'Clearance', value: 12 },
    { type: 'Certificate', value: 8 },
    { type: 'Permit', value: 5 },
    { type: 'Other', value: 3 },
  ];
  const documentCategoryData = [
    { type: 'Clearance', value: 27 },
    { type: 'Certificate', value: 18 },
    { type: 'Permit', value: 12 },
    { type: 'Other', value: 8 },
  ];

  // Pure SVG pie chart for Documents
  function PieChartSVG({ data, size = 32 }: { data: { type: string; value: number }[]; size?: number }) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let startAngle = 0;
    const colors = ['#52c41a', '#73d13d', '#b7eb8f', '#d9f7be'];
    const center = size / 2;
    const radius = center - 2;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}> 
        {data.map((slice, i) => {
          const angle = (slice.value / total) * Math.PI * 2;
          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(startAngle + angle);
          const y2 = center + radius * Math.sin(startAngle + angle);
          const largeArc = angle > Math.PI ? 1 : 0;
          const pathData = [
            `M ${center} ${center}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z',
          ].join(' ');
          const el = (
            <path key={i} d={pathData} fill={colors[i % colors.length]} stroke="#fff" strokeWidth="1" />
          );
          startAngle += angle;
          return el;
        })}
      </svg>
    );
  }



  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const statsRes = await adminAPI.getSystemStatistics();
      // Fetch document requests for modal
  // Fetch document requests for modal
      try {
  const docs = await documentsAPI.getDocumentRecords();
        setDocumentRequests(docs);
      } catch (err) {
        setDocumentRequests([]);
      }

  const notificationsRes = await notificationAPI.getNotifications();

  // Only show unread notifications in the dashboard
  const unreadNotifs = notificationsRes.filter((n: Notification) => !n.read);
  setNotifications(unreadNotifs.slice(0, 10)); // show up to 10 unread notifications

  // Define staff access notifications for pendingRequests calculation (accept both types used in DB)
  const staffApprovalNotifs = unreadNotifs.filter((n: Notification) => (n.type || '').toString().toLowerCase().includes('staff'));
  setStaffAccessNotifs(staffApprovalNotifs);

  // Fetch staff access Requests from the requests collection
  try {
    const sreqs = await requestsAPI.getStaffAccessRequests();
    setStaffRequests(sreqs || []);
  } catch (err) {
    setStaffRequests([]);
  }

  // Transform system statistics
  const systemPending = (statsRes.documents?.pending || 0) + staffApprovalNotifs.length;
      const systemTotalDocs = statsRes.documents?.total || 0;

      // Try to fetch document requests directly and derive pending count to ensure accuracy
      let directPending = 0;
      try {
        const allReqs = await documentsAPI.getDocumentRecords();
        const arr: any[] = Array.isArray(allReqs) ? allReqs : (allReqs && allReqs.data) ? allReqs.data : [];
        directPending = (arr || []).filter(r => (r.status || '').toString().toLowerCase() === 'pending').length;
      } catch (e) {
        directPending = systemPending;
      }

      const totalPending = directPending + (staffApprovalNotifs ? staffApprovalNotifs.length : 0);
      setStats({
        totalUsers: statsRes.users?.total || 0,
        activeUsers: statsRes.users?.active || 0,
        // Combine pending document requests with unread staff access notifications
        pendingRequests: totalPending,
        totalDocuments: systemTotalDocs,
        completedRequests: statsRes.documents?.completed || 0,
        unreadMessages: 0 // Set to 0 or fetch from a valid source if available
      });

      // Fetch all resident inquiries for admin inbox
      const inquiriesRes = await contactAPI.getAllInquiries();
      setInquiries(inquiriesRes);
      // Filter for inbox: assignedRole matches user.role or assignedTo includes user._id
      const filtered = inquiriesRes.filter((inq: any) =>
        (inq.assignedRole && user && inq.assignedRole === user.role) ||
        (inq.assignedTo && Array.isArray(inq.assignedTo) && user && inq.assignedTo.includes(user._id))
      );
      setInboxInquiries(filtered);

      // Fetch real recent activity logs
      const activityRes = await adminAPI.getActivityLogs({});
      // Map backend ActivityLog[] to local Activity[]
      setRecentActivity(activityRes.map((log: any) => ({
        id: log.id,
        type: log.module || 'system',
        description: log.description || log.action,
        timestamp: log.timestamp,
        user: log.userName || log.userId
      })));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    // initial fetch
    fetchDashboardData();

    // Initialize socket and listen for document-related events to refresh dashboard
    try {
      initNotificationSocket();
      const handler = (payload: any) => {
        console.log('Received document socket event, refreshing dashboard', payload);
        fetchDashboardData();
      };
      onNotificationEvent('documentStatusUpdate', handler);
      onNotificationEvent('documentCreated', handler);
      onNotificationEvent('documentDeleted', handler);
      onNotificationEvent('documents-updated', handler);

      // Poll as a fallback for environments without sockets
      const pollInterval = setInterval(() => {
        fetchDashboardData();
      }, 30000);

      return () => {
        offNotificationEvent('documentStatusUpdate', handler);
        offNotificationEvent('documentCreated', handler);
        offNotificationEvent('documentDeleted', handler);
        offNotificationEvent('documents-updated', handler);
        clearInterval(pollInterval);
      };
    } catch (err) {
      // If sockets fail, still keep polling
      const pollInterval = setInterval(() => {
        fetchDashboardData();
      }, 30000);
      return () => clearInterval(pollInterval);
    }
  }, []);

  // Load verification requests (separate from main fetch to keep concerns isolated)
  const loadVerifs = async () => {
    setVerifsLoading(true);
    try {
      const res = await verificationAPI.getRequests();
      setVerifs(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load verification requests', err);
      setVerifs([]);
    } finally {
      setVerifsLoading(false);
    }
  };

  useEffect(() => { loadVerifs(); }, []);

  // Fetch users count explicitly from User Management and keep it refreshed
  const fetchUsersCount = async () => {
    try {
      const users = await adminAPI.getUsers();
      const usersAny: any = users;
      const count = Array.isArray(usersAny) ? usersAny.length : (usersAny && typeof usersAny.length === 'number' ? usersAny.length : 0);
      setStats(prev => ({ ...prev, totalUsers: count }));
    } catch (err) {
      console.error('Failed to fetch users list for count:', err);
    }
  };

  useEffect(() => {
    // initial fetch
    fetchUsersCount();
    // poll every 30 seconds to keep the count up-to-date
    const interval = setInterval(fetchUsersCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Mark notification as read
  const handleMarkAsRead = async (notif: Notification) => {
    if (!notif._id) return;
    try {
      setLoading(true);
      await notificationAPI.markAsRead(notif._id);
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    } finally {
      setLoading(false);
    }
  };

  // Approve staff request
  const handleApproveStaff = async (notif: Notification) => {
    if (!notif.data?.userId || !notif._id) return;
    try {
      setLoading(true);
      await notificationAPI.approveStaff(notif.data.userId, notif._id);
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to approve staff:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reject staff request
  const handleRejectStaff = async (notif: Notification) => {
    if (!notif._id) return;
    const reason = window.prompt('Enter a brief reason for rejection (optional):');
    try {
      setLoading(true);
      await notificationAPI.rejectStaff(notif._id, reason || undefined);
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to reject staff request:', err);
    } finally {
      setLoading(false);
    }
  };

  // Simple UnreadBadge component for displaying a red dot
  const UnreadBadge: React.FC = () => (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#ff4d4f',
        marginLeft: 6,
        verticalAlign: 'middle',
      }}
      aria-label="Unread"
    />
  );

  const kpiCards = [
    {
      label: 'Users',
      value: stats.totalUsers,
      icon: '👤',
      bg: 'linear-gradient(90deg, #1890ff 0%, #40a9ff 100%)',
      color: '#1890ff',
      labelColor: '#e6f7ff',
      onClick: undefined,
      chart: (
                <div style={{ width: '100%', marginTop: 8, height: 32 }}>
                  {/* Pure SVG sparkline for Users */}
                  <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#4F46E5"
                      strokeWidth="2"
                      points={usersTrend.map((d, i) => `${i * (100 / (usersTrend.length - 1))},${40 - (d / Math.max(...usersTrend)) * 35}`).join(' ')}
                    />
                  </svg>
                </div>
      ),
    },
    {
      label: 'Pending Requests',
      value: stats.pendingRequests,
      icon: '⏳',
      bg: 'linear-gradient(90deg, #faad14 0%, #ffe58f 100%)',
      color: '#faad14',
      labelColor: '#fffbe6',
      onClick: undefined,
      chart: (
                <div style={{ width: '100%', marginTop: 8, height: 32 }}>
                  {/* Pure SVG bar chart for Requests */}
                  <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
                    {requestsByType.map((d, i) => {
                      const barWidth = 100 / requestsByType.length - 2;
                      const barHeight = (d.value / Math.max(...requestsByType.map(r => r.value))) * 35;
                      return (
                        <rect
                          key={i}
                          x={i * (100 / requestsByType.length) + 1}
                          y={40 - barHeight}
                          width={barWidth}
                          height={barHeight}
                          fill="#22C55E"
                          rx="2"
                        />
                      );
                    })}
                  </svg>
                </div>
      ),
    },
    {
      label: 'Documents',
      value: stats.totalDocuments,
      icon: '📄',
      bg: 'linear-gradient(90deg, #52c41a 0%, #b7eb8f 100%)',
      color: '#52c41a',
      labelColor: '#f6ffed',
      onClick: undefined,
      chart: (
                <div style={{ width: '100%', marginTop: 8, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {/* Pure SVG pie chart for Documents */}
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    {(() => {
                      const total = documentCategoryData.reduce((sum, d) => sum + d.value, 0);
                      let startAngle = 0;
                      return documentCategoryData.map((d, i) => {
                        const angle = (d.value / total) * 360;
                        const endAngle = startAngle + angle;
                        const largeArc = angle > 180 ? 1 : 0;
                        const x1 = 20 + 18 * Math.cos((Math.PI * (startAngle - 90)) / 180);
                        const y1 = 20 + 18 * Math.sin((Math.PI * (startAngle - 90)) / 180);
                        const x2 = 20 + 18 * Math.cos((Math.PI * (endAngle - 90)) / 180);
                        const y2 = 20 + 18 * Math.sin((Math.PI * (endAngle - 90)) / 180);
                        const path = `M20,20 L${x1},${y1} A18,18 0 ${largeArc} 1 ${x2},${y2} Z`;
                        const el = (
                          <path
                            key={i}
                            d={path}
                            fill={pieColors[i % pieColors.length]}
                          />
                        );
                        startAngle += angle;
                        return el;
                      });
                    })()}
                  </svg>
                </div>
      ),
    },
    {
      label: <span>Messages <UnreadBadge /></span>,
      value: stats.unreadMessages,
      icon: '✉️',
      bg: 'linear-gradient(90deg, #722ed1 0%, #b37feb 100%)',
      color: '#722ed1',
      labelColor: '#f9f0ff',
      onClick: () => navigate('/admin/messages'),
      chart: null,
    },
  ];

  const statCardSubtitles = [
    'Total Users',
    'Pending Requests',
    'Total Documents',
    'Unread Messages',
  ];

  const renderStatCards = () => (
    <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
      {kpiCards.map((card, idx) => (
        <Col xs={24} sm={12} md={6} key={typeof card.label === 'string' ? card.label : String(idx)}>
          <Card
            hoverable
            onClick={card.onClick}
            style={{
              background: card.bg,
              color: '#fff',
              borderRadius: 20,
              minHeight: 170,
              boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: card.onClick ? 'pointer' : 'default',
              transition: 'box-shadow 0.2s, transform 0.2s',
              position: 'relative',
              marginBottom: 8,
              padding: 24,
            }}
            styles={{
              body: {
                width: '100%',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
              }
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0,0,0,0.18)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 2px 8px 0 rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span style={{ fontSize: 40, marginBottom: 8, opacity: 0.92 }}>{card.icon}</span>
            <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1 }}>{card.value}</span>
            <span style={{ fontSize: 15, color: card.labelColor, fontWeight: 500, marginTop: 2, letterSpacing: 0.5 }}>{card.label}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: 400 }}>{statCardSubtitles[idx]}</span>
            {card.chart}
          </Card>
        </Col>
      ))}
    </Row>
  );

  // Table columns for document requests
  const documentColumns = [
    {
      title: 'Name',
      dataIndex: 'requestedByName',
      key: 'requestedByName',
      render: (text: string) => <span style={{ fontWeight: 600 }}>{text}</span>,
    },
    {
      title: 'Document Type',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <span>{text.replace(/_/g, ' ')}</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <span style={{ color: '#888' }}>{text}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => <span style={{ color: text === 'Completed' ? '#52c41a' : '#faad14' }}>{text || 'Pending'}</span>,
    },
    {
      title: 'Time Requested',
      dataIndex: 'dateRequested',
      key: 'dateRequested',
      render: (text: string) => <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(text).toLocaleString()}</span>,
    },
  ];

  const renderNotifications = () => (
    <Card
      title={<Space><BellOutlined /> Staff Access Approval</Space>}
      style={{ marginTop: 0, background: '#fafbfc', borderRadius: 12, boxShadow: '0 2px 8px #d9d9d933', border: '1px solid #f0f0f0', position: 'relative' }}
  styles={{ body: { padding: 16 } }}
      size="small"
      hoverable={false}
    >
  {/* Render a dedicated table for unread staff access approval requests */}
      {staffRequests && staffRequests.length > 0 ? (
        <Table
          size="small"
          pagination={{ pageSize: 5 }}
          dataSource={staffRequests}
          rowKey={r => r._id || String(r.createdAt)}
          columns={[
            {
              title: 'Name',
              dataIndex: 'requestedBy',
              key: 'requestedBy',
              render: (text: any, record: any) => {
                // requestedBy may be a string id, an object, or missing. Prefer data.fullName, requestedByName, then requestedBy.fullName/username, then fallback to string or 'Unknown'
                const nameFromData = record?.data?.fullName;
                const nameFromRequestedByName = record?.requestedByName;
                let nameFromRequestedBy: any = null;
                if (record?.requestedBy) {
                  if (typeof record.requestedBy === 'string') nameFromRequestedBy = record.requestedBy;
                  else if (typeof record.requestedBy === 'object') nameFromRequestedBy = record.requestedBy.fullName || record.requestedBy.username || record.requestedBy._id;
                }
                const displayName = nameFromData || nameFromRequestedByName || nameFromRequestedBy || 'Unknown';
                return <span style={{ fontWeight: 600 }}>{displayName}</span>;
              }
            },
            
            {
              title: 'Requested At',
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (val: any) => <span style={{ fontSize: 12, color: '#888' }}>{new Date(val).toLocaleString()}</span>
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_: any, record: any) => (
                <Space>
                  {/* If the row is a Request (has _id and type), call requestsAPI.approveRequest */}
                  <Button
                    type="primary"
                    size="small"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        if (record && record.type === 'staff_access' && record._id) {
                          await requestsAPI.approveRequest(record._id);
                        } else {
                          // fallback to notification-based approve
                          await handleApproveStaff(record as Notification);
                        }
                        await fetchDashboardData();
                      } catch (err) {
                        console.error('Approve action failed', err);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    icon={<CheckOutlined />}
                  >
                    Approve
                  </Button>
                  <Button danger size="small" onClick={() => handleRejectStaff(record)} icon={<ExclamationCircleOutlined />}>Reject</Button>
                </Space>
              )
            }
          ]}
        />
      ) : (
        // Fallback: show recent notifications list for other notification types
        (notifications.length === 0) ? (
          <Empty
            image={<BellOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description={<span style={{ color: '#888' }}>No notifications</span>}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                actions={[
                  (notification.type || '').toString().toLowerCase().includes('staff') && !notification.read && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleApproveStaff(notification)}
                    >
                      Approve
                    </Button>
                  ),
                  // removed Mark Read action per design
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={(notification.type || '').toString().toLowerCase().includes('staff') ? <TeamOutlined /> : <BellOutlined />} style={{ backgroundColor: notification.read ? '#8c8c8c' : ((notification.type || '').toString().toLowerCase().includes('staff') ? '#faad14' : '#1890ff') }} />}
                  title={<Text strong={(notification.type || '').toString().toLowerCase().includes('staff')}>{notification.message}</Text>}
                  description={
                    <div>
                      <Text type="secondary">{new Date(notification.createdAt).toLocaleString()}</Text>
                      {((notification.type || '').toString().toLowerCase().includes('staff') && notification.data) && (
                        <div style={{ marginTop: 8 }}>
                          <Text strong>Full Name:</Text> {notification.data.fullName || 'N/A'}<br />
                          <Text strong>Email:</Text> {notification.data.email || 'N/A'}<br />
                          <Text strong>Username:</Text> {notification.data.username || 'N/A'}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
            size="small"
          />
        )
      )}
  <Button type="link" style={{ position: 'absolute', right: 16, bottom: 8, fontSize: 13, color: '#1890ff' }} onClick={() => navigate('/admin/notifications')}>View all</Button>
    </Card>
  );

  // Verification widget for admin dashboard
  const handleApproveVerif = async (arg: any) => {
    // arg may be a userId string or the verification request object
    try {
      setVerifsLoading(true);
      if (arg && typeof arg === 'object') {
        const reqId = arg._id;
        const userId = arg.userId?._id || arg.userId;
        // mark request approved on server (if endpoint exists)
        try { await verificationAPI.approveRequest(reqId); } catch (e) { /* best-effort */ }
        // set the user verified
        if (userId) await verificationAPI.verifyUser(userId, true);
      } else if (typeof arg === 'string') {
        await verificationAPI.verifyUser(arg, true);
      }
      await loadVerifs();
    } catch (err) {
      console.error('Failed to verify user', err);
    } finally {
      setVerifsLoading(false);
    }
  };

  const handleRejectVerif = async (arg: any) => {
    try {
      setVerifsLoading(true);
      if (arg && typeof arg === 'object') {
        const reqId = arg._id;
        const userId = arg.userId?._id || arg.userId;
        try { await verificationAPI.rejectRequest(reqId); } catch (e) { /* best-effort */ }
        if (userId) await verificationAPI.verifyUser(userId, false);
      } else if (typeof arg === 'string') {
        // no request id available; just flip user verified to false
        await verificationAPI.verifyUser(arg, false);
      }
      await loadVerifs();
    } catch (err) {
      console.error('Failed to reject verification', err);
    } finally {
      setVerifsLoading(false);
    }
  };

  const openCheckId = (req: any) => {
    setSelectedVerif(req);
    setVerifModalVisible(true);
  };

  const renderVerificationWidget = () => (
    <Card
      title={<Space><UserOutlined /> Verification Requests</Space>}
      style={{ marginTop: 0, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #d9d9d933', border: '1px solid #f0f0f0' }}
      size="small"
      hoverable={false}
    >
      {verifsLoading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : (!verifs || verifs.length === 0) ? (
        <Empty description="No verification requests" />
      ) : (
        <List
          dataSource={verifs.slice(0, 6)}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button key="view" size="small" onClick={() => openCheckId(item)}>Check ID</Button>,
                <Button key="verify" type="primary" size="small" onClick={() => handleApproveVerif(item.userId?._id || item.userId)}>Verify</Button>,
                <Button key="reject" danger size="small" onClick={() => handleRejectVerif(item.userId?._id || item.userId)}>Reject</Button>
              ]}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: 600 }}>{(item.userId && (item.userId.fullName || item.userId.username)) || 'Unknown Resident'}</span>}
                description={<span style={{ color: '#888' }}>{item.status || 'pending'} · {new Date(item.createdAt).toLocaleString()}</span>}
              />
            </List.Item>
          )}
          size="small"
        />
      )}

      <Button type="link" style={{ marginTop: 12 }} onClick={() => navigate('/admin/verification-requests')}>View all</Button>

      <Modal
        title="Verification Files"
        open={verifModalVisible}
        onCancel={() => setVerifModalVisible(false)}
        footer={null}
        width={720}
      >
        {selectedVerif ? (
          <div>
            <p><strong>Resident:</strong> {(selectedVerif.userId && (selectedVerif.userId.fullName || selectedVerif.userId.username)) || 'Unknown'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(selectedVerif.gridFileIds || []).map((id: string) => (
                <div key={id} style={{ border: '1px solid #f0f0f0', padding: 8, borderRadius: 6 }}>
                  <div style={{ marginBottom: 8 }}>
                    <a href={`${(process.env.REACT_APP_API_URL || '/api')}/verification/file/${id}`} target="_blank" rel="noreferrer">Open file in new tab</a>
                  </div>
                  {/* inline preview for images if possible */}
                  <div>
                    <img src={`${(process.env.REACT_APP_API_URL || '/api')}/verification/file/${id}`} alt="id" style={{ maxWidth: '100%', maxHeight: 400 }} onError={() => { /* ignore errors for non-images */ }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty description="No files" />
        )}
      </Modal>
    </Card>
  );

  // Mini announcements viewer to replace Recent Activity
  const [miniAnns, setMiniAnns] = useState<any[]>([]);
  const [miniLoading, setMiniLoading] = useState(false);
  const [miniSelected, setMiniSelected] = useState<any | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const fetchMiniAnnouncements = async () => {
    setMiniLoading(true);
    try {
      const data = await contactAPI.getAnnouncements();
      setMiniAnns(Array.isArray(data) ? data.slice(0, 6) : []); // show up to 6
    } catch (err) {
      console.error('Failed to load mini announcements', err);
      setMiniAnns([]);
    } finally {
      setMiniLoading(false);
    }
  };

  useEffect(() => { fetchMiniAnnouncements(); }, []);

  // helper: simple time-ago
  const timeAgo = (iso?: string) => {
    if (!iso) return ''; 
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  };

  const renderRecentActivity = () => (
    <Card
      title={<Space><FileTextOutlined /> Announcements</Space>}
      style={{ marginTop: 0, background: '#fafbfc', borderRadius: 12, boxShadow: '0 2px 8px #d9d9d933', border: '1px solid #f0f0f0', position: 'relative' }}
      styles={{ body: { padding: 12 } }}
      size="small"
      hoverable={false}
    >
      {miniAnns.length === 0 ? (
        <Empty
          image={<FileTextOutlined style={{ fontSize: 42, color: '#d9d9d9' }} />}
          description={<span style={{ color: '#888' }}>No announcements</span>}
        />
      ) : (
  <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 6, paddingBottom: 48 }}>
          <List
            loading={miniLoading}
            dataSource={miniAnns}
            renderItem={(item) => (
              <List.Item style={{ cursor: 'pointer', padding: '10px 8px', alignItems: 'center' }} onClick={() => { setMiniSelected(item); setDrawerVisible(true); }}>
                <List.Item.Meta
                  title={<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2em' }}>{item.text || 'Untitled'}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{timeAgo(item.createdAt)}</div>
                    </div>
                  </div>}
                  description={null}
                />
                {item.imagePath && (
                  <div style={{ marginLeft: 12, width: 92, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <img loading="lazy" className="rounded-img" src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${item._id}/image`} alt="ann" style={{ width: 92, height: 60, objectFit: 'cover', borderRadius: 6, background: '#f0f0f0' }} />
                  </div>
                )}
              </List.Item>
            )}
            size="small"
          />
        </div>
      )}

      {/* Footer area to host Manage link and avoid overlapping the scrollable list */}
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="link" style={{ fontSize: 13, color: '#1890ff' }} onClick={() => navigate('/admin/announcements')}>Manage</Button>
      </div>

      <Drawer open={drawerVisible} onClose={() => { setDrawerVisible(false); setMiniSelected(null); }} title="Announcement" width={720} placement="right">
        {miniSelected && (
          <div>
            <Text style={{ display: 'block', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{miniSelected.text}</Text>
            {miniSelected.imagePath && (
              <img loading="lazy" className="rounded-img rounded-img-lg" src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${miniSelected._id}/image`} alt="announcement" style={{ width: '100%', height: 'auto', borderRadius: 8, background: '#f6f6f6' }} />
            )}
            <div style={{ marginTop: 8, color: '#888' }}>{timeAgo(miniSelected.createdAt)}</div>
          </div>
        )}
      </Drawer>
    </Card>
  );

  function renderInbox(): React.ReactNode {
    return (
      <Card
        title={<Space><MailOutlined /> Inquiries Inbox (Assigned to You)</Space>}
        style={{ marginTop: 0, background: '#fafbfc', borderRadius: 12, boxShadow: '0 2px 8px #d9d9d933', border: '1px solid #f0f0f0', position: 'relative' }}
  styles={{ body: { padding: 16 } }}
        size="small"
        hoverable={false}
      >
        {inboxInquiries.length === 0 ? (
          <Empty
            image={<MailOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description={<span style={{ color: '#888' }}>No assigned inquiries</span>}
          />
        ) : (
          <List
            dataSource={inboxInquiries}
            renderItem={(inquiry: any) => (
              <List.Item
                actions={[
                  <Button key="view" type="link" onClick={() => setSelectedInquiry(inquiry)}>
                    View / Respond
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={<Text strong>{inquiry.subject}</Text>}
                  description={
                    <>
                      <Text type="secondary">{inquiry.type}</Text><br />
                      <Text>{inquiry.message}</Text><br />
                      <Text type="secondary">
                        Submitted by: {inquiry.createdBy?.fullName || inquiry.createdBy?.username || 'Resident'} on {new Date(inquiry.createdAt).toLocaleString()}
                      </Text>
                    </>
                  }
                />
              </List.Item>
            )}
            size="small"
          />
        )}
    <Button type="link" style={{ position: 'absolute', right: 16, bottom: 8, fontSize: 13, color: '#1890ff' }} onClick={() => navigate('/admin/inquiries')}>View all</Button>
        <Modal
          title="Document Requests"
          open={documentsModalVisible}
          onCancel={() => setDocumentsModalVisible(false)}
          footer={null}
          width={1200}
        >
          {/* Modal content here */}
          <Table
            columns={documentColumns}
            dataSource={documentRequests}
            rowKey={record => record._id || record.dateRequested + record.requestedByName}
            pagination={{ pageSize: 10 }}
          />
        </Modal>
      </Card>
    );
  }

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24, backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
        <Title level={4} style={{ marginBottom: 24 }}>Admin Dashboard</Title>
        {renderStatCards()}
        <Row gutter={[24, 24]} style={{ marginTop: 0 }}>
          <Col xs={24} lg={12}>
            {renderNotifications()}
          </Col>
          <Col xs={24} lg={12}>
            {renderRecentActivity()}
          </Col>
        </Row>
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24}>
            {renderVerificationWidget()}
          </Col>
        </Row>
        {/* Modal is rendered inside renderInbox above */}
      </div>
    </Spin>
  );
};

export default AdminDashboard;
