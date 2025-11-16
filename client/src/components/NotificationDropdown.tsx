

import React, { useState, useEffect, useRef } from 'react';
import socketIOClient from 'socket.io-client';
import { Dropdown, Badge, List, Avatar, Button, Tabs, Typography, Space, Empty } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { notificationService, Notification } from '../services/notificationService';
import { useNavigate } from 'react-router-dom';
const { Text } = Typography;

const tabCategories = [
  { key: 'all', label: 'All' },
  { key: 'documents', label: 'Documents' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'system', label: 'System' },
];

const NotificationDropdown: React.FC = () => {

  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const socketRef = useRef<ReturnType<typeof socketIOClient> | null>(null);


  // Connect to socket.io server once on mount

  // Helper: filtered notifications for active tab
  const filtered = activeTab === 'all' ? notifications : notifications.filter(n => n.category === activeTab);

  // Helper: unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Handler: mark all as read (stub)
  const handleMarkAllRead = () => {
    // TODO: implement mark all as read logic
  };

  const renderItem = (item: Notification) => (
    <List.Item
      style={{
        background: item.read ? undefined : '#f6faff',
        cursor: 'pointer',
        borderRadius: 8,
        marginBottom: 2,
        paddingLeft: 8,
        paddingRight: 8,
        transition: 'background 0.2s',
      }}
      onClick={() => {/* future: navigate(`/notifications/${item.id}`) */}}
    >
      <List.Item.Meta
        avatar={<Avatar icon={<BellOutlined />} style={{ background: item.read ? '#d9d9d9' : '#1890ff' }} />}
        title={
          <Space>
            {!item.read && <Badge status="processing" size="default" style={{ marginRight: 4 }} />}
            <Text strong={!item.read} style={{ fontWeight: item.read ? 400 : 700 }}>{item.title}</Text>
          </Space>
        }
        description={
          <>
            <Text type={item.read ? undefined : 'secondary'}>{item.message}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 10 }}>{new Date(item.createdAt).toLocaleString()}</Text>
          </>
        }
      />
    </List.Item>
  );

  return (
    <Dropdown
      popupRender={() => (
        <div style={{ width: 350, maxHeight: 420, overflow: 'auto', padding: 0, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            tabBarGutter={16}
            style={{ marginBottom: 0 }}
            moreIcon={null}
            items={tabCategories.map(cat => ({
              key: cat.key,
              label: <span style={{
                fontWeight: activeTab === cat.key ? 700 : 500,
                borderBottom: activeTab === cat.key ? '2px solid #1677ff' : '2px solid transparent',
                color: activeTab === cat.key ? '#1677ff' : undefined,
                paddingBottom: 4,
                fontSize: 15,
                transition: 'all 0.2s',
                display: 'inline-block',
              }}>{cat.label}</span>,
              children: (
                <>
                  <List
                    dataSource={filtered}
                    loading={loading}
                    locale={{
                      emptyText: <Empty
                        image={<BellOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                        description={<span style={{ color: '#888' }}>No notifications</span>}
                      />
                    }}
                    renderItem={renderItem}
                    itemLayout="horizontal"
                    style={{ marginTop: 8, minHeight: 120 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '0 4px' }}>
                    <Button size="small" type="default" disabled={unreadCount === 0} onClick={handleMarkAllRead}>
                      Mark all as read
                    </Button>
                    <a style={{ fontSize: 13, color: '#1677ff' }} onClick={() => navigate('/notifications')}>View all</a>
                  </div>
                </>
              )
            }))}
          />
        </div>
      )}
      trigger={["click"]}
      open={visible}
      onOpenChange={setVisible}
      placement="bottomRight"
      arrow
    >
      <Badge count={unreadCount} overflowCount={99}>
        <Button shape="circle" icon={<BellOutlined />} />
      </Badge>
    </Dropdown>
  );
};

export default NotificationDropdown;
