import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './StudentPage.css';
const URI='https://polling-system-719a.onrender.com/'
const UR='http://localhost:5000'
const socket = io(URI);

const StudentPage = () => {
  const [name, setName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);  // To track if student is registered
  const [pollData, setPollData] = useState(null);  // Poll data from teacher
  const [selectedResponse, setSelectedResponse] = useState('');  // Selected answer by the student
  const [waiting, setWaiting] = useState(true);  // Whether student is waiting for the poll
  const [hasSubmitted, setHasSubmitted] = useState(false);  // Whether the student has submitted the answer
  const [pollResults, setPollResults] = useState(null);  // Poll results after the poll ends
  const [timeLeft, setTimeLeft] = useState(0);  // Timer for the poll
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isRegistered) {  // Only listen for events if student is registered
      console.log('Student registered, setting up socket listeners');
      
      // Request current poll state immediately after registration
      socket.emit('getCurrentPoll');
      
      // Set up error handling
      socket.on('error', ({ message }) => {
        console.error('Socket error:', message);
        setMessage(message);
      });

      // Handle being kicked out
      socket.on('kickedOut', () => {
        setIsRegistered(false);
        setPollData(null);
        setWaiting(true);
        setMessage('You have been removed from the session by the teacher');
        // Show kicked out message and redirect after delay
        setTimeout(() => {
          navigate('/');
        }, 3000);
      });

      // Handle poll updates (new polls and changes)
      socket.on('pollUpdate', (data) => {
        console.log('Received poll update:', data);
        if (!data || !data.question) {
          setWaiting(true);
          setMessage('Waiting for teacher to start a poll...');
          setPollData(null);
          return;
        }
        
        // Normalize incoming poll data
        const poll = { ...data };
        setPollData(poll);
        setWaiting(false);
        setMessage('');  // Clear any waiting messages
        
        // Handle timer sync
        if (typeof data.timeRemaining !== 'undefined') {
          const secs = Math.max(0, Math.floor(Number(data.timeRemaining) / 1000));
          setTimeLeft(secs);
        } else if (data.endTime) {
          const remaining = Math.max(0, Math.floor((new Date(data.endTime) - new Date()) / 1000));
          setTimeLeft(remaining);
        }
        setSelectedResponse('');
        setPollResults(null);
        setHasSubmitted(false);  // Reset submission state for new poll
      });

      // Handle poll endings
      socket.on('pollEnded', ({ message }) => {
        console.log('Poll ended:', message);
        // When poll ends, prevent further submissions and show waiting message
        setTimeLeft(0);
        setHasSubmitted(false);
        setMessage(message || 'Poll has ended — wait for next question');
        setPollData(null);
        setWaiting(true);
      });

      // Handle response confirmations
      socket.on('responseConfirmed', () => {
        console.log('Response confirmed');
        setHasSubmitted(true);
        setMessage('Response submitted successfully!');
      });

      // Register with server
      socket.emit('studentJoin', name);
    }

    return () => {
      socket.off('error');
      socket.off('kickedOut');
      socket.off('pollUpdate');
      socket.off('pollEnded');
      socket.off('responseConfirmed');
    };
  }, [isRegistered, name, navigate]);

  useEffect(() => {
    let timer;
    if (pollData && timeLeft > 0 && !hasSubmitted) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = Math.max(0, prev - 1);
          if (newTime === 0) {
            setMessage('Time is up! Waiting for the next question...');
            // Lock submission when time's up
            setHasSubmitted(true);
          }
          return newTime;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [pollData, timeLeft, hasSubmitted]);

  const handleContinue = (e) => {
    e.preventDefault();
    if (name) {
      socket.emit('studentJoin', name);  // Emit the student's name to the server
      setIsRegistered(true);  // Mark the student as registered
    } else {
      alert('Please enter your name!');
    }
  };

  const submitResponse = () => {
    if (timeLeft <= 0) {
      setMessage('Cannot submit — time is up for this poll');
      return;
    }

    if (selectedResponse === '') {
      setMessage('Please select an answer');
      return;
    }

    socket.emit('submitResponse', { answer: selectedResponse });
    setMessage('Submitting your response...');
  };

  if (!isRegistered) {
    return (
      <div className="student-page">
        <div className="join-screen">
          <h1>Let's Get Started</h1>
          <p>If you're a student, you'll be able to submit your answers, participate in live polls, and see how your responses compare with your classmates.</p>
          
          <input
            type="text"
            className="name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your Name"
          />
          
          <button className="continue-button" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="student-page">
      <div className="status-bar">
        {message && (
          <div className={`message ${message.includes('error') ? 'error' : 'info'}`}>
            {message}
          </div>
        )}
        {timeLeft > 0 && (
          <div className="timer">
            Time remaining: {timeLeft} seconds
          </div>
        )}
      </div>

      {waiting && !pollData && (
        <div className="waiting-screen">
          <h2>Waiting for teacher to start a poll...</h2>
          <div className="spinner"></div>
          <p className="waiting-message">The next poll will appear here automatically when the teacher starts it.</p>
        </div>
      )}

      {pollData && (
        <div className="poll-container">
          <div className="question-section">
            <h3>{pollData.question}</h3>
            <p className="instructions">
              {hasSubmitted 
                ? 'Your response has been recorded. Please wait for the next poll.' 
                : timeLeft === 0 
                  ? 'Time is up! The next poll will start soon.'
                  : 'Select your answer and submit before time runs out:'}
            </p>
          </div>

          <div className="options-section">
            {pollData.options.map((option, index) => (
              <button
                key={index}
                className={`option ${selectedResponse === index ? 'selected' : ''} ${hasSubmitted && selectedResponse === index ? 'submitted' : ''}`}
                onClick={() => !hasSubmitted && timeLeft > 0 && setSelectedResponse(index)}
                disabled={hasSubmitted || timeLeft === 0}
              >
                {option}
              </button>
            ))}
          </div>

          {!hasSubmitted && timeLeft > 0 && (
            <button 
              className="submit-button"
              onClick={submitResponse}
              disabled={selectedResponse === '' || timeLeft === 0}
            >
              Submit Answer
            </button>
          )}

          {hasSubmitted && (
            <div className="submission-confirmation">
              <p>Your answer has been submitted successfully!</p>
              <p>The next poll will appear automatically when ready.</p>
            </div>
          )}
        </div>
      )}

      {!waiting && !pollData && (
        <div className="poll-ended">
          <h3>Poll Ended</h3>
          <p>Wait for the teacher to start a new poll.</p>
          {pollResults && pollResults.options && (
            <div className="results-container">
              <h4>Last Poll Results</h4>
              {pollData.options.map((option, index) => (
                <div key={index} className={`result-bar ${index === pollData.correctOption ? 'correct' : ''}`}>
                  <span className="option-text">{option}</span>
                  <div className="progress-container">
                    <div 
                      className="progress"
                      style={{
                        width: `${(pollResults.responses.filter(r => r.answer === index).length / 
                          pollResults.responses.length) * 100}%`
                      }}
                    ></div>
                  </div>
                  <span className="percentage">
                    {Math.round((pollResults.responses.filter(r => r.answer === index).length / 
                      pollResults.responses.length) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentPage;
