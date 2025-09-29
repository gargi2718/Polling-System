import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
const URI='https://polling-system-719a.onrender.com/'
const UR='http://localhost:5000'
const socket = io(URI);

const PollPage = () => {
  const [response, setResponse] = useState('');
  const [pollData, setPollData] = useState(null);
  const [results, setResults] = useState(null);
  const studentName = localStorage.getItem('studentName');

  useEffect(() => {
    socket.on('newPoll', (data) => {
      setPollData(data);  // Set poll data
    });

    socket.on('pollResults', (data) => {
      setResults(data);  // Show results once the poll ends
    });

    return () => {
      socket.off('newPoll');
      socket.off('pollResults');
    };
  }, []);

  const submitResponse = () => {
    if (response && studentName) {
      socket.emit('submitResponse', { name: studentName, response });
    }
  };

  return (
    <div>
      {pollData ? (
        <>
          <h1>{pollData.question}</h1>
          {pollData.options.map((option, index) => (
            <button key={index} onClick={() => setResponse(option)}>
              {option}
            </button>
          ))}
          <button onClick={submitResponse}>Submit</button>
        </>
      ) : (
        <h2>Waiting for the teacher to start the poll...</h2>
      )}

      {results && (
        <div>
          <h3>Poll Results:</h3>
          <p>Correct Answer: <b>{results.options && results.options[0]}</b></p>
          <p>Percentage Correct: <b>{results.percentCorrect}%</b></p>
          <p>Students who answered correctly:</p>
          <ul>
            {results.correctStudents && results.correctStudents.map((name, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>
          <h4>All Responses:</h4>
          <ul>
            {results.responses && results.responses.map((r, idx) => (
              <li key={idx}>{r.name}: {r.response}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PollPage;
