import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const Goodbye: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f4f6fa' }}>
      <h1 style={{ color: '#722ed1', fontWeight: 700, fontSize: 32 }}>You have been logged out</h1>
      <p style={{ fontSize: 18, margin: '16px 0 32px' }}>Thank you for using the Barangay Information System.</p>
      <Button type="primary" size="large" onClick={() => navigate('/login', { replace: true })}>
        Log In Again
      </Button>
    </div>
  );
};

export default Goodbye;
