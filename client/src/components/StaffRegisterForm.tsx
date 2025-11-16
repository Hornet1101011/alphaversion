import React, { useState } from 'react';
import { Form, Input, Button, Select, message, Card } from 'antd';
import { staffRegister } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const StaffRegisterForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
  await staffRegister(values);
      message.success('Staff registered successfully!');
      navigate('/login');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Staff Registration" style={{ maxWidth: 400, margin: '40px auto' }}>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}> <Input /> </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}> <Input /> </Form.Item>
        <Form.Item name="username" label="Username" rules={[{ required: true }]}> <Input /> </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}> <Input.Password /> </Form.Item>
        <Form.Item name="department" label="Department" rules={[{ required: true }]}> <Input /> </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>Register as Staff</Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default StaffRegisterForm;
