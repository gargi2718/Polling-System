import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './TeacherPage.css';
const URI='https://polling-system-719a.onrender.com/'
const UR='http://localhost:5000'
const socket = io(URI);

const TeacherPage = () => {
  const [question, setQuestion] = useState('');  // Define question state
  const [currentView, setCurrentView] = useState('create');
  const [options, setOptions] = useState(['', '']);
  const [correctOption, setCorrectOption] = useState(null);
  const [pollTime, setPollTime] = useState(60);
  const [isPollActive, setIsPollActive] = useState(false);
  const [pollResults, setPollResults] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [pollHistory, setPollHistory] = useState([]);
  const [students, setStudents] = useState([]);
  const [timer, setTimer] = useState(null);
  const [pollEnded, setPollEnded] = useState(false);  // State to track poll end

  useEffect(() => {
    // Fetch initial poll history
    const fetchPollHistory = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/polls/history');
        setPollHistory(response.data.history);
      } catch (error) {
        console.error('Error fetching poll history:', error);
      }
    };
    fetchPollHistory();

    // Handle student updates
    socket.on('studentJoined', (studentList) => {
      console.log('Student joined:', studentList);
      setStudents(studentList);
    });

    socket.on('studentLeft', (studentList) => {
      console.log('Student left:', studentList);
      setStudents(studentList);
    });

    // Handle poll updates
    socket.on('pollUpdate', (data) => {
      console.log('Poll update:', data);
      setPollResults(data.responses ? {
        responses: data.responses,
        total: data.responses.length
      } : {});
    });

    // Handle poll end
    socket.on('pollEnded', ({ message, pollId }) => {
      console.log('Poll ended:', message);
      clearInterval(timer);
      setPollEnded(true);
      setIsPollActive(false);
      setTimeLeft(0);
      
      // Fetch latest poll history
      fetchPollHistory();
      
      // Reset form for next poll
      setQuestion('');
      setOptions(['', '']);
      setCorrectOption(null);
      setPollTime(60);
      
      // After poll ends, go back to create view
      setCurrentView('create');
    });

    // Handle errors
    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      alert(message);
    });

    return () => {
      socket.off('studentJoined');
      socket.off('studentLeft');
      socket.off('pollUpdate');
      socket.off('pollEnded');
      socket.off('error');
      if (timer) clearInterval(timer);
    };
  }, [timer]);

  const startPoll = () => {
    if (!question.trim()) {
      alert('Please enter a question');
      return;
    }

    if (options.some(opt => !opt.trim())) {
      alert('Please fill in all options');
      return;
    }

    if (correctOption === null) {
      alert('Please select the correct answer');
      return;
    }

    const pollData = {
      question: question.trim(),
      options: options.filter(opt => opt.trim()),
      correctOption,
      duration: pollTime // Send duration in seconds
    };

    socket.emit('createPoll', pollData);
    setIsPollActive(true);
    setPollEnded(false);
    setCurrentView('active');
    setTimeLeft(pollTime);
    setPollResults({ responses: [], total: 0 });

    // Start timer
    const newTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(newTimer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimer(newTimer);
  };

  const endPoll = () => {
    socket.emit('endPoll');
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
  };

  const startNewPoll = () => {
    if (isPollActive) {
      if (!window.confirm('A poll is currently active. End it and start a new one?')) {
        return;
      }
      endPoll();
    }

    // Reset all form fields
    setQuestion('');
    setOptions(['', '']);
    setCorrectOption(null);
    setPollResults(null);
    setPollEnded(false);
    setTimeLeft(pollTime);
    
    // Switch to create view
    setCurrentView('create');
  };

  const viewPollHistory = (poll) => {
    setPollResults({
      responses: poll.responses,
      total: poll.responses.length,
      question: poll.question,
      options: poll.options,
      correctOption: poll.correctOption
    });
    setCurrentView('history-detail');
  };

  const addOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      if (correctOption === index) {
        setCorrectOption(null);
      } else if (correctOption > index) {
        setCorrectOption(correctOption - 1);
      }
    }
  };

  const kickStudent = (studentName) => {
    if (window.confirm(`Are you sure you want to remove ${studentName} from the session?`)) {
      socket.emit('kickStudent', studentName);
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const renderCreatePoll = () => (
    <div className="create-poll">
      <h2>Create New Poll</h2>
      <div className="question-input">
        <label>Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question here..."
        />
      </div>

      <div className="time-selector">
        <label>Time Limit</label>
        <select value={pollTime} onChange={(e) => setPollTime(Number(e.target.value))}>
          <option value={30}>30 seconds</option>
          <option value={60}>1 minute</option>
          <option value={90}>1.5 minutes</option>
          <option value={120}>2 minutes</option>
        </select>
      </div>

      <div className="options-container">
        <label>Answer Options</label>
        {options.map((option, index) => (
          <div key={index} className="option-row">
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
            />
            <input
              type="radio"
              name="correctOption"
              checked={correctOption === index}
              onChange={() => setCorrectOption(index)}
              id={`correct-${index}`}
            />
            <label htmlFor={`correct-${index}`}>Correct</label>
            {options.length > 2 && (
              <button 
                className="remove-option"
                onClick={() => removeOption(index)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <button className="add-option" onClick={addOption}>
            Add Option
          </button>
        )}
      </div>

      <button 
        className="start-poll"
        onClick={startPoll}
        disabled={!question.trim() || options.some(opt => !opt.trim()) || correctOption === null}
      >
        Start Poll
      </button>
    </div>
  );

  const renderActivePoll = () => (
    <div className="active-poll">
      <div className="poll-header">
        <h2>Active Poll</h2>
        <div className="timer">Time Remaining: {timeLeft}s</div>
      </div>

      <div className="poll-content">
        <div className="question-section">
          <h3>{question}</h3>
          <div className="options-list">
            {options.map((option, index) => (
              <div 
                key={index} 
                className={`option-item ${index === correctOption ? 'correct' : ''}`}
              >
                <span className="option-text">{option}</span>
                <span className="response-count">
                  {pollResults?.responses?.filter(r => r.answer === index).length || 0} responses
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="students-section">
          <h3>Connected Students</h3>
          <div className="students-list">
            {students.map((student, index) => (
              <div key={index} className="student-item">
                <span>{student}</span>
                <button 
                  className="kick-button"
                  onClick={() => kickStudent(student)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistoryDetail = () => {
    if (!pollResults) return null;
    
    return (
      <div className="poll-history-detail">
        <h2>Poll Results</h2>
        <div className="question-display">
          <h3>{pollResults.question}</h3>
        </div>
        
        <div className="options-results">
          {pollResults.options.map((option, index) => (
            <div 
              key={index} 
              className={`option-result ${index === pollResults.correctOption ? 'correct' : ''}`}
            >
              <span className="option-text">{option}</span>
              <div className="result-bar-container">
                <div 
                  className="result-bar"
                  style={{
                    width: `${(pollResults.responses.filter(r => r.answer === index).length / 
                      (pollResults.total || 1)) * 100}%`
                  }}
                />
              </div>
              <span className="result-count">
                {pollResults.responses.filter(r => r.answer === index).length} votes
              </span>
            </div>
          ))}
        </div>
        
        <button className="back-button" onClick={() => setCurrentView('history')}>
          Back to History
        </button>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="poll-history">
      <h2>Previous Polls</h2>
      {pollHistory.map((poll, index) => (
        <div 
          key={index} 
          className="history-item"
          onClick={() => viewPollHistory(poll)}
          role="button"
          tabIndex={0}
        >
          <h3>{poll.question}</h3>
          <div className="history-details">
            <div className="history-meta">
              <p>Date: {new Date(poll.startTime).toLocaleString()}</p>
              <p>Total Responses: {poll.responses.length}</p>
            </div>
            <div className="history-summary">
              {poll.options.map((option, optIndex) => (
                <div 
                  key={optIndex} 
                  className={`history-option ${optIndex === poll.correctOption ? 'correct' : ''}`}
                >
                  <span className="option-text">{option}</span>
                  <div className="result-bar-container">
                    <div 
                      className="result-bar"
                      style={{
                        width: `${(poll.responses.filter(r => r.answer === optIndex).length / 
                          (poll.responses.length || 1)) * 100}%`
                      }}
                    />
                  </div>
                  <span className="response-count">
                    {poll.responses.filter(r => r.answer === optIndex).length}
                  </span>
                </div>
              ))}
            </div>
            <div className="history-footer">
              <span className="view-details">Click to view full details →</span>
            </div>
          </div>
        </div>
      ))}
      {pollHistory.length === 0 && (
        <div className="no-history">
          <p>No polls have been conducted yet.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="teacher-page">
      <header>
        <h1>Teacher Dashboard</h1>
        <div className="student-count">
          Connected Students: {students.length}
        </div>
      </header>

      <div className="main-content">
        <nav className="poll-controls">
          <button
            className={`nav-button ${currentView === 'create' ? 'active' : ''}`}
            onClick={() => !isPollActive && setCurrentView('create')}
            disabled={isPollActive}
          >
            Create Poll
          </button>
          <button
            className={`nav-button ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentView('history')}
          >
            Poll History
          </button>
          {isPollActive && (
            <button className="end-poll" onClick={endPoll}>
              End Current Poll
            </button>
          )}
        </nav>

        {currentView === 'create' && !isPollActive && renderCreatePoll()}
        {isPollActive && renderActivePoll()}
        {currentView === 'history' && !isPollActive && renderHistory()}
        {currentView === 'history-detail' && renderHistoryDetail()}
      </div>
    </div>
  );
};

export default TeacherPage;
