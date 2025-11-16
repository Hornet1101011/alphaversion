import React, { useState, useContext } from 'react';
import { Form, Input, Button, message } from 'antd';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';

const MessageCompose: React.FC = () => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (!user) {
        message.error('User not authenticated');
        setLoading(false);
        return;
      }
      await axios.post('/api/messages', {
        senderId: user._id,
        recipientId: values.recipientId,
        subject: values.subject,
        body: values.body,
      });
      message.success('Message sent!');
    } catch (err) {
      message.error('Failed to send message');
    }
    setLoading(false);
  };

  return (
    <Form layout="vertical" onFinish={onFinish}>
      <Form.Item name="recipientId" label="Recipient ID" rules={[{ required: true }]}> <Input /> </Form.Item>
      <Form.Item name="subject" label="Subject" rules={[{ required: true }]}> <Input /> </Form.Item>
      <Form.Item name="body" label="Message" rules={[{ required: true }]}> <Input.TextArea rows={4} /> </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}>Send</Button>
    </Form>
  );
};

export default MessageCompose;
