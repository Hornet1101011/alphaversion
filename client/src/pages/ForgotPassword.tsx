import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, notification, Radio } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ForgotPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<'link' | 'otp'>('link');
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: values.email, mode });
      // server returns generic success message
      notification.success({ message: 'Request sent', description: res.data?.message || 'Check your email for instructions.' });
      setSent(true);
      setSubmittedEmail(values.email);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Failed to send reset email';
      notification.error({ message: 'Error', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (d: string) => {
    if (code.length >= 6) return;
    setCode(prev => prev + d);
  };
  const handleBackspace = () => setCode(prev => prev.slice(0, -1));
  const handleClear = () => setCode('');

  const submitOtp = async () => {
    if (code.length !== 6) {
      notification.error({ message: 'Enter code', description: 'Please enter the 6-digit code.' });
      return;
    }
    setVerifying(true);
    try {
      // send token to server; server will email a temporary password if token is valid
      const payload: any = { token: code };
      if (submittedEmail) payload.email = submittedEmail;
      const res = await axios.post('/api/auth/verify-otp', payload);
      notification.success({ message: 'If valid', description: res.data?.message || 'Check your email for the new temporary password.' });
      // clear input and allow user to go back to login
      setCode('');
      setSent(false);
      setSubmittedEmail(null);
      navigate('/login');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Failed to verify code';
      notification.error({ message: 'Error', description: msg });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: 420, borderRadius: 12 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>Forgot Password</Typography.Title>
        {!sent ? (
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Choose how to receive reset instructions">
              <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                <Radio value="link">Send reset link (email)</Radio>
                <Radio value="otp">Send 6-digit code (email)</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, message: 'Please input your email' }, { type: 'email', message: 'Please enter a valid email' }]}
            >
              <Input placeholder="you@example.com" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                {loading ? 'Sending...' : mode === 'otp' ? 'Send code' : 'Send reset link'}
              </Button>
            </Form.Item>
            <Button type="link" block onClick={() => navigate('/login')}>Back to login</Button>
          </Form>
        ) : (
          <div>
            {mode === 'otp' ? (
              <div>
                <Typography.Paragraph>
                  Enter the 6-digit code sent to <strong>{submittedEmail}</strong>
                </Typography.Paragraph>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ width: 40, height: 48, margin: 4, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {code[i] || ''}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 300, margin: '0 auto 12px' }}>
                  {['1','2','3','4','5','6','7','8','9','0'].map(d => (
                    <Button key={d} onClick={() => handleDigit(d)} disabled={verifying}>{d}</Button>
                  ))}
                  <Button onClick={handleBackspace} disabled={verifying}>⌫</Button>
                  <Button onClick={handleClear} disabled={verifying}>Clear</Button>
                  <Button type="primary" onClick={submitOtp} loading={verifying} disabled={verifying}>Verify</Button>
                </div>
                <Button type="link" block onClick={() => { setSent(false); setSubmittedEmail(null); }}>Back</Button>
              </div>
            ) : (
              <div>
                <Typography.Paragraph>
                  Check your email for password reset instructions.
                </Typography.Paragraph>
                <Button type="primary" block onClick={() => navigate('/login')}>Back to login</Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;
