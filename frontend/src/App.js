import logo from './logo.svg';
import './App.css';
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'; // Import Routes instead of Switch
import TeacherPage from './components/TeacherPage';
import StudentPage from './components/StudentPage';
import LandingPage from './components/LandingPage';
import PollPage from './components/PolllPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/student" element={<StudentPage />} />
        <Route path="/poll" element={<PollPage />} />
      </Routes>
    </Router>
  );
}

export default App;

