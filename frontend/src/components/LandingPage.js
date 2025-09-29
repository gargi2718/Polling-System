import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="container">
      <h1 style={{ textAlign: 'center', color: 'var(--dark-purple)' }}>
        Welcome to the Live Polling System
      </h1>
      <p style={{ textAlign: 'center', fontSize: '18px', color: 'var(--dark-grey)' }}>
        Please select the role that best describes you to begin using the live polling system
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '30px' }}>
        <div
          style={{
            backgroundColor: 'var(--light-purple)',
            padding: '20px',
            borderRadius: '10px',
            cursor: 'pointer',
            textAlign: 'center',
            flex: 1,
            margin: '0 10px',
          }}
          onClick={() => navigate('/student')}
        >
          <h3>I'm a Student</h3>
        </div>
        <div
          style={{
            backgroundColor: 'var(--light-purple)',
            padding: '20px',
            borderRadius: '10px',
            cursor: 'pointer',
            textAlign: 'center',
            flex: 1,
            margin: '0 10px',
          }}
          onClick={() => navigate('/teacher')}
        >
          <h3>I'm a Teacher</h3>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
