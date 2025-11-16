import './responsive-system-title.css';
import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Space, Dropdown, Avatar } from 'antd';
import {
  LogoutOutlined,
  ClockCircleOutlined,
  UserOutlined,
  NotificationOutlined,
  SettingOutlined,
  HomeOutlined,
  FileTextOutlined,
  MessageOutlined,
  InboxOutlined,
  TeamOutlined,
  BarChartOutlined,
  HistoryOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FileProtectOutlined
  ,MenuFoldOutlined, MenuUnfoldOutlined
} from '@ant-design/icons';
import AvatarImage from './AvatarImage';
import './AppLayoutSidebar.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Date and Time display component (smaller, subtle, top-right)
const DateTimeDisplay: React.FC = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return (
    <span style={{ fontSize: 13, color: '#888', fontWeight: 500, letterSpacing: 0.5, marginRight: 8 }}>
      <ClockCircleOutlined style={{ marginRight: 4 }} />
      {date} {time}
    </span>
  );
};
const { Header, Content, Sider } = Layout;

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const HEADER_HEIGHT = 64;

const navConfig: {
  resident: { key: string; icon: React.ReactNode; label: string }[];
  admin: { key: string; icon: React.ReactNode; label: string }[];
  staff: { key: string; icon: React.ReactNode; label: string }[];
} = {
  resident: [
    {
      key: '/home',
      icon: <HomeOutlined />,
      label: 'Home',
    },
    {
      key: '/request',
      icon: <FileTextOutlined />,
      label: 'Request',
    },
    {
      key: '/inquiries',
      icon: <MessageOutlined />,
      label: 'Inquiries',
    },
    {
      key: '/inbox',
      icon: <InboxOutlined />,
      label: 'Inbox',
    },
  ],
  admin: [
    {
      key: '/admin/dashboard',
      icon: <HomeOutlined />,
      label: 'Admin Dashboard',
    },
    {
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: 'User Management',
    },
    {
      key: '/admin/activity',
      icon: <FileSearchOutlined />,
      label: 'Activity Logs',
    },
    {
      key: '/admin/statistics',
      icon: <BarChartOutlined />,
      label: 'Statistics',
    },
    {
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: 'System Settings',
    },
    {
      key: '/admin/verification-requests',
      icon: <FileProtectOutlined />,
      label: 'Verification Requests',
    },
  ],
  staff: [
    {
      key: '/staff-dashboard',
      icon: <HomeOutlined />,
      label: 'Staff Dashboard',
    },
    {
      key: '/staff/inbox',
      icon: <InboxOutlined />,
      label: 'Staff Inbox',
    },
    {
      key: '/templates-manager',
      icon: <FileProtectOutlined />,
      label: 'Templates Manager',
    },
    {
      key: '/document-processing',
      icon: <FileDoneOutlined />,
      label: 'Document Processing',
    },
    {
      key: '/document-history',
      icon: <HistoryOutlined />,
      label: 'Document History',
    },
  ],
};



type AppLayoutProps = {
  children: React.ReactNode;
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Prefer the context user but fall back to a persisted full profile in localStorage
  let displayUser: any = user;
  if (!displayUser) {
    try {
      const stored = localStorage.getItem('userProfile');
      if (stored) displayUser = JSON.parse(stored);
    } catch (err) {
      // ignore
    }
  }

  // Utility bar quick actions removed: online/status and dark-mode switch removed
  // You can expand these as needed for your system
  const [residentImageSrc, setResidentImageSrc] = useState<string | null>(null);
  // Start collapsed by default so the navigation is compact on initial load.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const api = await import('../services/api');
        try {
          const data = await api.residentPersonalInfoAPI.getPersonalInfo();
          if (data?.profileImage) {
            const url = data.profileImage.startsWith('http') ? data.profileImage : `${window.location.origin}${data.profileImage}`;
            setResidentImageSrc(url);
            return;
          }
          if (data?.profileImageId) {
            setResidentImageSrc(`/api/resident/personal-info/avatar/${data.profileImageId}`);
            return;
          }
        } catch (err) {
          // ignore
        }
        try {
          const resp = await api.default.get('/resident/profile');
          const d = resp.data;
          if (d?.profileImage) {
            const url = d.profileImage.startsWith('http') ? d.profileImage : `${window.location.origin}${d.profileImage}`;
            setResidentImageSrc(url);
          } else if (d?.profileImageId) {
            setResidentImageSrc(`/api/resident/personal-info/avatar/${d.profileImageId}`);
          }
        } catch (err) {
          // ignore
        }
      } catch (err) {
        // ignore
      }
    })();
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent;
        const updated = ce?.detail;
        if (!updated) return;
        if (updated.profileImage) {
          const url = updated.profileImage.startsWith('http') ? updated.profileImage : `${window.location.origin}${updated.profileImage}`;
          setResidentImageSrc(url);
        } else if (updated.profileImageId) {
          setResidentImageSrc(`/api/resident/personal-info/avatar/${updated.profileImageId}`);
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('userProfileUpdated', handler as EventListener);
    return () => window.removeEventListener('userProfileUpdated', handler as EventListener);
  }, []);

  // Close dropdown on outside click
  // Removed notification dropdown logic

  return (
    <Layout style={{ minHeight: '100vh', background: '#000' }}>
      {user && (
        <Sider
          width={SIDEBAR_WIDTH}
          collapsed={collapsed}
          collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
          style={{
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            background: 'linear-gradient(180deg, #40c9ff 0%, #e81cff 100%)', // Original vibrant blue to purple
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            zIndex: 100,
            boxShadow: '2px 0 16px 0 rgba(64,201,255,0.10)',
            borderRight: 'none',
            overflowX: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '24px 0 0 0',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Menu
              theme="light"
              mode="inline"
              selectedKeys={[location.pathname]}
              style={{
                background: 'transparent',
                fontWeight: 600,
                fontSize: 17,
                border: 'none',
              }}
              inlineCollapsed={collapsed}
              items={
                navConfig[
                  user?.role === 'admin'
                    ? 'admin'
                    : user?.role === 'staff'
                    ? 'staff'
                    : 'resident'
                ].map(item => ({
                  ...item,
                  className: location.pathname === item.key ? 'ant-menu-item-active-custom' : undefined
                }))
              }
              onClick={({ key }) => {
                if (location.pathname !== key) {
                  navigate(key);
                }
              }}
            />
          </div>
        </Sider>
      )}
  <Layout style={{ marginLeft: user ? (collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) : 0 }}>
        <Header
          style={{
            height: HEADER_HEIGHT,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            position: 'fixed',
            left: user ? (collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) : 0,
            right: 0,
            top: 0,
            zIndex: 101,
            boxShadow: '0 2px 8px #e3e6f3',
          }}
        >
          <div
            className="responsive-system-title"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user && (
              <Button type="text" onClick={() => setCollapsed(c => !c)} style={{ marginRight: 6 }} icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} />
            )}
            {/* Logo icon (served from public/) */}
            <img src={`${process.env.PUBLIC_URL}/logo-parian2.png`} alt="Logo" style={{ width: 36, height: 36, marginRight: 4 }} />
            <span style={{
              fontSize: 26,
              fontWeight: 400,
              letterSpacing: 1,
              background: 'linear-gradient(90deg, #40c9ff, #e81cff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Barangay Information <span style={{ fontWeight: 800 }}>Management System</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', marginRight: 8 }}>
            <span style={{ marginRight: 8 }}>
              <DateTimeDisplay />
            </span>
            {/* Utility bar: quick actions */}
            <Space size={12}>
              {displayUser && (
                // Route admins to admin management, others to public announcements
                <Button size="small" onClick={() => navigate(displayUser?.role === 'admin' ? '/admin/announcements' : '/announcements')}
                  icon={<NotificationOutlined />}
                />
              )}
            </Space>
            {/* profile avatar (notification bell removed) */}
            <Dropdown
              popupRender={() => (
                <Menu>
                  <Menu.Item key="profile" icon={<UserOutlined />} onClick={() => navigate('/profile')}>
                    Profile
                  </Menu.Item>
                  <Menu.Item key="settings" icon={<SettingOutlined />} onClick={() => navigate('/admin/settings')}>
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={() => navigate('/logout')}>
                    Logout
                  </Menu.Item>
                </Menu>
              )}
              placement="bottomRight"
              trigger={['click']}
            >
                <Avatar size={36} shape="circle">
                  {residentImageSrc ? (
                    <img src={residentImageSrc} alt={displayUser?.fullName || displayUser?.username || 'avatar'} width={36} height={36} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (displayUser && (displayUser.profileImage || displayUser.profilePicture || displayUser.profileImageId) ? (
                    <AvatarImage user={displayUser} size={36} />
                  ) : (
                    <UserOutlined />
                  ))}
                </Avatar>
            </Dropdown>
          </div>
  </Header>
  {/* Divider line below header */}
  <div style={{ height: 1, background: '#f0f0f0', width: '100%', margin: 0, boxShadow: 'none' }} />
        <Content
          style={{
            marginTop: HEADER_HEIGHT,
            padding: 32,
            background: 'linear-gradient(135deg, #e3f6fd 0%, #b3e0ff 60%,  #b3e0ff 100%)',
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
