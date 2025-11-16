import React, { useEffect, useRef, useState } from 'react';
import { Row, Col, Form, Input, Button, Card, Typography, message, Modal } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import getOfficialPhotoSrc, { fetchPublicOfficials, PublicOfficial } from '../utils/officials';
import StatsPanel from './StatsPanel';
import './LoginForm.css';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

const LoginForm: React.FC = () => {
  const { login, isAuthenticated, user, setUser } = useAuth() as any;
  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [guestForm] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [officials, setOfficials] = useState<PublicOfficial[]>([]);
  const [officialsStatus, setOfficialsStatus] = useState<string>('loading');
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') navigate('/admin/dashboard');
      else if (user.role === 'staff') navigate('/staff-dashboard');
      else if ((user as any).role === 'guest') navigate('/guest/dashboard');
      else navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setOfficialsStatus('fetching public');
        const offs = await fetchPublicOfficials();
        if (mounted && Array.isArray(offs) && offs.length > 0) {
          setOfficials(offs);
          setOfficialsStatus(`public:${offs.length}`);
        } else {
          // fallback attempt to admin endpoint (useful during local dev when auth may be present)
          setOfficialsStatus('trying-admin-fallback');
          try {
            const adminOffs: any[] = await adminAPI.getOfficials();
            if (mounted && Array.isArray(adminOffs) && adminOffs.length > 0) {
              // normalize to PublicOfficial shape
              const mapped = adminOffs.map(a => ({ _id: a._id, name: a.name, title: a.title, term: a.term, hasPhoto: !!a.photo || !!a.photoPath }));
              setOfficials(mapped);
              setOfficialsStatus(`admin:${mapped.length}`);
            } else {
              setOfficialsStatus('no-officials');
            }
          } catch (e) {
            console.warn('Admin fallback failed', e);
            setOfficialsStatus('error');
          }
        }
      } catch (e) {
        console.warn('Failed to fetch public officials for login preview', e);
        setOfficialsStatus('error');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: values.username, password: values.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Login response not OK:', { status: res.status, data });
        throw new Error(data.message || 'Login failed');
      }

      if (!data.token) {
        console.error('No token in response:', data);
        throw new Error('Login failed - No token received');
      }

      login(data.token);
      message.success(data.message || 'Login successful!');
      // navigation will occur in the useEffect above after auth state updates
    } catch (err: any) {
      message.error(err.message || 'Error logging in');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="login-page">
      <div className="login-container two-pane">
        <Row gutter={24} align="stretch" justify="center" className="two-pane-row">
          {/* Left combined pane - stats + officials */}
          <Col xs={24} md={12} className="pane left-pane combined-pane">
            <div className="pane-inner left-inner">
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <StatsPanel />
                <Card className="glass-card preview-card invisible" variant="outlined">
                  <Typography.Title level={4} style={{ marginBottom: 8 }}>Barangay Officials</Typography.Title>
                  <div style={{ height: 6, background: 'linear-gradient(90deg, rgba(22,119,255,0.12), rgba(146,84,222,0.12))', borderRadius: 4, marginBottom: 12 }} />

                  <div className="carousel-wrap">
                    <Button className="carousel-arrow left" icon={<LeftOutlined />} onClick={() => {
                      if (!carouselRef.current) return; carouselRef.current.scrollBy({ left: -240, behavior: 'smooth' });
                    }} />
                    <div ref={carouselRef} className="carousel-scroll">
                      {officials.length === 0 ? (
                        <Typography.Text type="secondary">No officials to preview</Typography.Text>
                      ) : (
                        officials.map(off => (
                          <div key={off._id} className="official-card">
                            <div className="official-avatar">
                              <img alt={off.name} src={getOfficialPhotoSrc(off as any)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ fontWeight: 700 }}>{off.name}</div>
                            <div style={{ color: '#666', fontSize: 13 }}>{off.title}</div>
                            <div style={{ color: '#999', fontSize: 12 }}>{off.term}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <Button className="carousel-arrow right" icon={<RightOutlined />} onClick={() => {
                      if (!carouselRef.current) return; carouselRef.current.scrollBy({ left: 240, behavior: 'smooth' });
                    }} />
                  </div>
                </Card>
              </div>
            </div>
          </Col>


          {/* Right pane - login */}
          <Col xs={24} md={12} className="pane center-pane login-pane">
            <div className="pane-inner center-inner">
              <Card className="glass-card login-card" variant="outlined">
               <Typography.Title level={2} className="title-blue" style={{ textAlign: 'center', marginBottom: 6 }}>
                Barangay Information System
              </Typography.Title>
              <Typography.Text style={{ display: 'block', textAlign: 'center', color: '#9254de', fontWeight: 500, marginBottom: 18 }}>
                Sign In
              </Typography.Text>

              <Form name="login" layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
                <Form.Item label="Email or Username" name="username" rules={[{ required: true, message: 'Please input your email or username!' }]}>
                  <Input prefix={<UserOutlined style={{ color: '#40a9ff' }} />} placeholder="Enter your email or username" size="large" />
                </Form.Item>

                <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Please input your password!' }, { min: 6, message: 'Password must be at least 6 characters' }]}>
                  <Input.Password autoComplete="current-password" prefix={<LockOutlined style={{ color: '#40a9ff' }} />} placeholder="Enter your password" size="large" />
                </Form.Item>

                <Form.Item>
                  <Button htmlType="submit" size="large" loading={loading} className="signin-btn">
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </Form.Item>

                <Form.Item>
                  <Button onClick={() => setGuestModalVisible(true)} size="large" className="guest-warm-btn" block>
                    Continue as Guest
                  </Button>
                </Form.Item>

                <div className="links-row">
                  <RouterLink to="/forgot-password"><Typography.Text type="secondary">Forgot Password?</Typography.Text></RouterLink>
                  <RouterLink to="/register"><Typography.Text type="secondary">Sign Up</Typography.Text></RouterLink>
                </div>
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <Button type="link" onClick={() => setEmergencyModalVisible(true)}>
                    <Typography.Text type="danger">Emergency Hotline</Typography.Text>
                  </Button>
                </div>
              </Form>
              </Card>
            </div>
          </Col>
        </Row>
      </div>
  </div>
  <Modal
      title="Continue as Guest"
      open={guestModalVisible}
      onCancel={() => { setGuestModalVisible(false); guestForm.resetFields(); }}
      onOk={async () => {
        try {
          const vals = await guestForm.validateFields();
          // submit to server to persist in Guest collection
          try {
            const res = await fetch('/api/auth/guest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: vals.name, contactNumber: vals.contactNumber, email: vals.email, intent: vals.intent })
            });
            const data = await res.json();
            if (!res.ok) {
              message.error(data.message || 'Failed to create guest');
              return;
            }
            const guestProfile = {
              _id: data._id,
              username: (vals.name || 'guest').toString().toLowerCase().replace(/\s+/g, '_'),
              firstName: vals.name || 'Guest',
              contactNumber: vals.contactNumber || '',
              email: vals.email || '',
              intent: vals.intent || '',
              sessionToken: data.sessionToken,
              expiresAt: data.expiresAt,
              role: 'guest'
            };
            if (typeof setUser === 'function') setUser(guestProfile);
            localStorage.setItem('guestInfo', JSON.stringify(guestProfile));
            // Optionally persist sessionToken separately for server calls
            localStorage.setItem('guestSessionToken', data.sessionToken);
            // If the server returned a JWT token, sign in via auth context so PrivateRoute won't redirect
            if (data.token && typeof login === 'function') {
              try {
                await login(data.token);
              } catch (e) {
                // ignore login failure, but keep guest info available locally
                console.warn('Guest token login failed', e);
              }
            }
            setGuestModalVisible(false);
            guestForm.resetFields();
            navigate('/guest/dashboard');
          } catch (err) {
            console.error('Failed to persist guest', err);
            message.error('Failed to create guest account');
          }
        } catch (err) {
          // validation failed
        }
      }}
    >
      <Form layout="vertical" form={guestForm}>
        <Form.Item name="name" label="Full name" rules={[{ required: true, message: 'Please enter your name' }]}>
          <Input placeholder="Your full name" />
        </Form.Item>
        <Form.Item name="contactNumber" label="Contact number" rules={[{ required: true, message: 'Please enter a contact number' }]}>
          <Input placeholder="0917..." />
        </Form.Item>
        <Form.Item name="email" label="Email (optional)" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
          <Input placeholder="you@example.com" />
        </Form.Item>
        <Form.Item name="intent" label="Purpose / Intent" rules={[{ required: true, message: 'Please tell us your intent' }]}>
          <Input.TextArea placeholder="Why are you visiting (e.g., check documents, request info)" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      title="Emergency Hotlines"
      open={emergencyModalVisible}
      onCancel={() => setEmergencyModalVisible(false)}
      footer={null}
    >
      <div style={{ lineHeight: 1.6 }}>
        <Typography.Paragraph>
          For general emergencies: <strong>911</strong>
        </Typography.Paragraph>
        <Typography.Paragraph>
          National Center for Mental Health (Crisis): <strong>0917-899-8727</strong>
        </Typography.Paragraph>
        <Typography.Paragraph>
          Philippine National Police (Emergency Hotline): <strong>9-1-1</strong> / <strong>8723-0401</strong> / <strong>8537-4500</strong>
        </Typography.Paragraph>
      </div>
    </Modal>
    </>
  );
};

export default LoginForm;
