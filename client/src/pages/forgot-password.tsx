import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Steps } from 'antd';
import { useNavigate } from 'react-router-dom';

const ForgotPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'request' | 'otp' | 'reset' | 'done'>('request');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const navigate = useNavigate();

  // Step 1: Request OTP
  const onRequest = async (values: { contact: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: values.contact })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      setContact(values.contact);
      setStep('otp');
      message.success('OTP sent to your email or phone.');
    } catch (error: any) {
      message.error(error.message || 'Error sending OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const onVerifyOtp = async (values: { otp: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, otp: values.otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP');
      setToken(data.token); // token for password reset
      setStep('reset');
      message.success('OTP verified. You may now reset your password.');
    } catch (error: any) {
      message.error(error.message || 'Error verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const onResetPassword = async (values: { password: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      setStep('done');
      message.success('Password reset successful! You may now log in.');
    } catch (error: any) {
      message.error(error.message || 'Error resetting password');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === 'request' ? 0 : step === 'otp' ? 1 : step === 'reset' ? 2 : 3;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #40a9ff 0%, #9254de 50%, #ff85c0 100%)' }}>
      <Card style={{ width: 400, borderRadius: 18, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)' }}>
        <Typography.Title level={3} style={{ textAlign: 'center', color: '#1890ff', marginBottom: 8 }}>Forgot Password</Typography.Title>
        <Steps
          current={stepIndex}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Contact' },
            { title: 'OTP' },
            { title: 'Reset' },
            { title: 'Done' },
          ]}
        />
        {step === 'request' && (
          <Form layout="vertical" onFinish={onRequest} requiredMark={false}>
            <Form.Item label="Email or Phone Number" name="contact" rules={[{ required: true, message: 'Please input your email or phone number!' }]}> 
              <Input placeholder="Enter your email or phone number" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ width: '100%' }}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </Form.Item>
            <Button type="link" onClick={() => navigate('/login')} style={{ width: '100%' }}>Back to Login</Button>
          </Form>
        )}
        {step === 'otp' && (
          <Form layout="vertical" onFinish={onVerifyOtp} requiredMark={false}>
            <Typography.Text style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
              Enter the OTP sent to your email or phone.
            </Typography.Text>
            <Form.Item label="OTP" name="otp" rules={[{ required: true, message: 'Please input the OTP!' }]}> 
              <Input placeholder="Enter OTP" size="large" maxLength={6} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ width: '100%' }}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </Form.Item>
            <Button type="link" onClick={() => setStep('request')} style={{ width: '100%' }}>Back</Button>
          </Form>
        )}
        {step === 'reset' && (
          <Form layout="vertical" onFinish={onResetPassword} requiredMark={false}>
            <Typography.Text style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
              Enter your new password.
            </Typography.Text>
            <Form.Item label="New Password" name="password" rules={[
              { required: true, message: 'Please input your new password!' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}>
              <Input.Password placeholder="Enter new password" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ width: '100%' }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </Form.Item>
          </Form>
        )}
        {step === 'done' && (
          <>
            <Typography.Text type="success" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
              Password reset successful! You may now log in.
            </Typography.Text>
            <Button type="primary" onClick={() => navigate('/login')} style={{ width: '100%' }}>Back to Login</Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;
