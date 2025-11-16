import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, notification, Progress } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const mode = search.get('mode'); // 'otp' if user is using code flow
  const [loading, setLoading] = useState(false);
  const [strengthScore, setStrengthScore] = useState<number | null>(null);
  const [strengthLabel, setStrengthLabel] = useState<string>('');

  const evaluateStrength = (pwd: string) => {
    if (!pwd) {
      setStrengthScore(null);
      setStrengthLabel('');
      return;
    }
    // simple regex-based scoring
    let score = 0;
    if (pwd.length >= 8) score += 2;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    // map to 0..4
    const mapped = Math.min(4, Math.floor((score / 6) * 5));
    const pct = mapped * 20;
    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
    setStrengthScore(pct);
    setStrengthLabel(labels[mapped] || '');
  };

  const onFinish = async (values: { password: string; confirm: string; code?: string }) => {
    if (values.password !== values.confirm) {
      notification.error({ message: 'Passwords do not match' });
      return;
    }
    // enforce client-side minimal complexity consistent with server
    const strongPwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPwdRegex.test(values.password)) {
      notification.error({ message: 'Password does not meet complexity requirements. Use 8+ chars, mixed case, numbers and symbols.' });
      return;
    }
    setLoading(true);
    try {
      let res;
      // If token is present in URL, use the legacy link endpoint
      if (token) {
        res = await axios.post(`/api/auth/reset-password/${token}`, { password: values.password });
      } else if (mode === 'otp') {
        // OTP flow: code is provided by user in a field; submit token in body
        if (!values.code) {
          notification.error({ message: 'Please enter the 6-digit code sent to your email' });
          setLoading(false);
          return;
        }
        res = await axios.post(`/api/auth/reset-password`, { token: values.code, password: values.password });
      } else {
        // fallback: attempt body token
        res = await axios.post(`/api/auth/reset-password`, { token: values.code || '', password: values.password });
      }
      notification.success({ message: 'Password reset', description: res.data?.message || 'Your password has been reset. Please log in.' });
      navigate('/login');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Failed to reset password';
      notification.error({ message: 'Error', description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: 420, borderRadius: 12 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>Reset Password</Typography.Title>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          {mode === 'otp' && !token && (
            <Form.Item
              label="6-digit code"
              name="code"
              rules={[{ required: true, message: 'Please input the 6-digit code sent to your email' }, { len: 6, message: 'Code must be 6 digits' }]}
            >
              <Input placeholder="123456" size="large" />
            </Form.Item>
          )}
          <Form.Item
              label="New password"
              name="password"
              rules={[{ required: true, message: 'Please input your new password' }, { min: 6, message: 'Password must be at least 6 characters' }]}
            >
              <Input.Password size="large" onChange={(e) => evaluateStrength(e.target.value)} />
            </Form.Item>
          {strengthScore !== null && (
            <div style={{ marginBottom: 12 }}>
              <Progress percent={strengthScore} size="small" status={strengthScore < 40 ? 'exception' : 'normal'} />
              <div style={{ textAlign: 'right', fontSize: 12, color: '#666' }}>{strengthLabel}</div>
            </div>
          )}
          <Form.Item
            label="Confirm password"
            name="confirm"
            rules={[{ required: true, message: 'Please confirm your new password' }]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {loading ? 'Resetting...' : 'Reset password'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword;
