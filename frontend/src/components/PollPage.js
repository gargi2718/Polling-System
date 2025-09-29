import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PollPage.css';

const PollPage = () => {
  const navigate = useNavigate();

  return (
    <div className="poll-page">
      <header>
        <h1>Live Poll System</h1>
        <button onClick={() => navigate('/teacher/history')} className="view-history-btn">
          View Poll History
        </button>
      </header>

      <main>
        <section className="options-section">
          <button onClick={() => navigate('/teacher/create')} className="create-poll-btn">
            Create New Poll
          </button>
          
          <button onClick={() => navigate('/teacher/active')} className="view-active-btn">
            View Active Poll
          </button>
        </section>
      </main>
    </div>
  );
};

export default PollPage;