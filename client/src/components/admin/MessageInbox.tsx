import React, { useEffect, useState } from 'react';
import { Card, List, Typography, Avatar, Spin, Button, Space } from 'antd';
import { BellOutlined, TeamOutlined, CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getInbox } from '../../services/api';
import { Notification } from '../../types/notification';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const MessageInbox: React.FC = () => {
  // now use messages (inbox) which includes verification request messages
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    setLoading(true);
    try {
  const resp = await getInbox();
  const data = resp && resp.data ? resp.data : [];
  setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch inbox messages', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (msg: any) => {
    if (!msg._id || msg.status === 'read') return;
    setLoading(true);
    try {
      // mark the message as read via messages endpoint
      await fetch(`/api/messages/${msg._id}/read`, { method: 'PATCH', credentials: 'include' });
      await fetchNotifications();
    } catch (err) {
      // Optionally show error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24, backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
        <Space style={{ marginBottom: 24 }}>
          <Button type="default" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/dashboard')}>
            Back to Dashboard
          </Button>
          <Title level={4} style={{ marginBottom: 0 }}>Message Inbox</Title>
        </Space>
        <Card>
          <List
            dataSource={Array.isArray(messages) ? messages : []}
            renderItem={notification => (
              <List.Item
                actions={[
                  notification.status === 'unread' && (
                    <Button
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleMarkAsRead(notification)}
                    >Mark Read</Button>
                  )
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<BellOutlined />} style={{ backgroundColor: notification.status === 'read' ? '#8c8c8c' : '#1890ff' }} />}
                  title={<Text strong>{notification.subject}</Text>}
                  description={
                    <div>
                      <Text type="secondary">{new Date(notification.createdAt).toLocaleString()}</Text>
                      {/* Show body for verification requests */}
                      {notification.subject === 'New Verification Request' && (
                        <div style={{ marginTop: 8 }}>
                          <Text strong>Verification request submitted.</Text>
                          <div>{notification.body}</div>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: 'No notifications' }}
          />
        </Card>
      </div>
    </Spin>
  );
};

export default MessageInbox;
