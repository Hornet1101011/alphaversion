import React from 'react';
import './LandingPage.css';
import './responsive-system-title.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-bg" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #40c9ff 0%, #e81cff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
    }}>
      <div className="floating-box" style={{
        background: 'rgba(255,255,255,0.95)',
        boxShadow: '0 8px 32px 0 rgba(64,201,255,0.15)',
        borderRadius: 24,
        padding: '48px 32px',
        textAlign: 'center',
        maxWidth: 420,
        width: '100%',
        animation: 'float 2s infinite ease-in-out alternate',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
  <img src={`${process.env.PUBLIC_URL}/logo-parian2.png`} alt="Barangay Logo" style={{ width: 80, marginBottom: 24 }} />
        <h1
          className="responsive-system-title"
          style={{
            fontSize: '1.7rem',
            marginBottom: 24,
            fontWeight: 800,
            background: 'linear-gradient(90deg, #40c9ff, #e81cff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: 1,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'pre-line',
            wordBreak: 'break-word',
            textAlign: 'center',
          }}
        >
          Welcome to
          <br />
          Barangay Information Management System
          <br />
          Parian
        </h1>
        <button
          className="get-started-btn"
          style={{
            background: 'linear-gradient(90deg, #e81cff 0%, #40c9ff 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '14px 40px',
            fontSize: '1.15rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px #e81cff44',
            marginTop: 8,
            transition: 'background 0.2s',
          }}
          onClick={() => window.location.href = '/login'}
          onMouseOver={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #40c9ff 0%, #e81cff 100%)')}
          onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #e81cff 0%, #40c9ff 100%)')}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
