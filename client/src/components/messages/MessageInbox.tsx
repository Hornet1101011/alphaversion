import React, { useEffect, useState, useContext } from 'react';
import { List, Typography, Button, Badge } from 'antd';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';

const MessageInbox: React.FC<{ onRead?: (id: string) => void }> = ({ onRead }) => {
  const { user } = useContext(AuthContext)!;
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(true);
      axios.get('/api/messages/inbox').then(res => {
        setMessages(res.data);
        setLoading(false);
      });
    }
  }, [user]);

  const markAsRead = async (id: string) => {
    await axios.patch(`/api/messages/${id}/read`);
    setMessages(msgs => msgs.map(m => m._id === id ? { ...m, status: 'read' } : m));
    if (onRead) onRead(id);
  };

  return (
    <List
      loading={loading}
      header={<div>Inbox</div>}
      dataSource={messages}
      renderItem={msg => (
        <List.Item
          actions={msg.status === 'unread' ? [<Button type="link" onClick={() => markAsRead(msg._id)}>Mark as read</Button>] : []}
          onClick={() => { if (msg.status === 'unread') markAsRead(msg._id); }}
          style={{ cursor: 'pointer' }}
        >
          <Badge dot={msg.status === 'unread'} color="#faad14">
            <div>
              <Typography.Text strong={msg.status === 'unread'}>{msg.subject}</Typography.Text> from {msg.senderId}<br />
              <Typography.Text type={msg.status === 'unread' ? 'secondary' : undefined}>{msg.body}</Typography.Text>
            </div>
          </Badge>
        </List.Item>
      )}
    />
  );
};

export default MessageInbox;
