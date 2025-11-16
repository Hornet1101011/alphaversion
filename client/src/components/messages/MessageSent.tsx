import React, { useEffect, useState, useContext } from 'react';
import { List, Typography } from 'antd';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';

type Message = {
  subject: string;
  recipientId: string;
  body: string;
};

const MessageSent: React.FC = () => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (user) {
      axios.get('/api/messages/sent').then(res => setMessages(res.data));
    }
  }, [user]);

  return (
    <List
      header={<div>Sent Messages</div>}
      dataSource={messages}
      renderItem={msg => (
        <List.Item>
          <Typography.Text strong>{msg.subject}</Typography.Text> to {msg.recipientId}<br />
          {msg.body}
        </List.Item>
      )}
    />
  );
};

export default MessageSent;
