const dbURI = 'mongodb+srv://gargi2001ee89_db_user:<db_password>@pollingsystem.cm6hgwo.mongodb.net/'

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const Poll = require('./PollModel');
const PollHistory = require('./PollHistoryModel');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Frontend URL
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Global state
let activePoll = null;
let pollHistory = [];
const connectedStudents = new Map(); // socketId -> studentName
const bannedStudents = new Set();
let pollTimer = null;

// Function to end current poll
const endCurrentPoll = async () => {
  if (activePoll) {
    try {
      // Mark poll as inactive and save to history
      activePoll.isActive = false;
      await activePoll.save();
      pollHistory.unshift(activePoll);

      // Notify all clients that poll has ended
      io.emit('pollEnded', {
        message: 'Poll has ended. The next poll will start soon.',
        pollId: activePoll._id
      });

      // Clear active poll
      activePoll = null;

      // Clear timer if it exists
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    } catch (error) {
      console.error('Error ending poll:', error);
      // Still notify clients even if DB save fails
      io.emit('pollEnded', {
        message: 'Poll has ended. The next poll will start soon.'
      });
      activePoll = null;
    }
  }
};

// MongoDB connection with retry logic
const connectWithRetry = async () => {
  const maxRetries = 5;
  const retryDelay = 5000; // 5 seconds
  let currentTry = 1;

  while (currentTry <= maxRetries) {
    try {
      await mongoose.connect(dbURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // 10 seconds
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000, // 45 seconds
      });
      console.log('Connected to MongoDB Atlas');
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${currentTry} failed:`, err.message);
      if (currentTry === maxRetries) {
        console.error('Max retries reached. Running in fallback mode without persistent storage.');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      currentTry++;
    }
  }
};

// Initial connection
connectWithRetry();

// API Routes
app.get('/api/polls/active', async (req, res) => {
  try {
    if (activePoll) {
      res.json(activePoll);
    } else {
      res.status(404).json({ message: 'No active poll' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active poll' });
  }
});

app.get('/api/polls/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get poll history with pagination
    const [history, total] = await Promise.all([
      PollHistory.find({})
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PollHistory.countDocuments({})
    ]);

    res.json({
      history,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching poll history:', error);
    res.status(500).json({ 
      message: 'Error fetching poll history',
      error: error.message 
    });
  }
});

// Socket connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle request for current poll state
  socket.on('getCurrentPoll', () => {
    if (activePoll) {
      const timeRemaining = new Date(activePoll.endTime) - new Date();
      if (timeRemaining > 0) {
        socket.emit('pollUpdate', {
          ...activePoll.toObject(),
          timeRemaining: timeRemaining
        });
      } else {
        socket.emit('pollUpdate', null); // No active poll
      }
    } else {
      socket.emit('pollUpdate', null); // No active poll
    }
  });

  // Teacher creates a new poll
  socket.on('createPoll', async (pollData) => {
    try {
      // Clear any existing poll timer
      if (pollTimer) {
        clearTimeout(pollTimer);
      }

      // Create new poll with precise timing
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + pollData.duration * 1000);
      
      const newPoll = new Poll({
        ...pollData,
        startTime: startTime,
        endTime: endTime,
        isActive: true,
        responses: []
      });

      // Set active poll in-memory immediately
      activePoll = newPoll;

      // Broadcast new poll to all connected clients
      io.emit('pollUpdate', {
        ...newPoll.toObject(),
        timeRemaining: pollData.duration * 1000
      });

      // Set up timer to end poll
      pollTimer = setTimeout(() => {
        endCurrentPoll();
      }, pollData.duration * 1000);

      // Attempt to save to DB but don't block broadcasting if it fails
      newPoll.save().then(() => {
        // optionally update activePoll with any DB-generated fields
        // (e.g., _id) by replacing in-memory object
        // fetch latest from DB
        // Poll.findById(newPoll._id).then(saved => { activePoll = saved; }).catch(()=>{});
      }).catch((err) => {
        console.error('Warning: could not save new poll to DB:', err);
      });

      // Set timer to end poll
      pollTimer = setTimeout(() => {
        (async () => {
          try {
            if (activePoll) {
              activePoll.isActive = false;
              // attempt to save to DB but don't let failures crash the server
              activePoll.save().catch((err) => {
                console.error('Warning: could not save poll end to DB:', err);
              });
              pollHistory.unshift(activePoll);
              activePoll = null;
              io.emit('pollEnded', { message: 'Poll has ended' });
            }
          } catch (err) {
            console.error('Unexpected error during poll timer end:', err);
          }
        })();
      }, pollData.duration * 1000);
    } catch (error) {
      console.error('Error creating poll:', error);
      socket.emit('error', { message: 'Error creating poll' });
    }
  });

  // Student joins
  socket.on('studentJoin', (studentName) => {
    if (bannedStudents.has(studentName)) {
      socket.emit('kickedOut');
      return;
    }

    if (Array.from(connectedStudents.values()).includes(studentName)) {
      socket.emit('error', { message: 'Name already taken' });
      return;
    }

    connectedStudents.set(socket.id, studentName);
    io.emit('studentJoined', Array.from(connectedStudents.values()));
  });

  // Student submits response
  socket.on('submitResponse', async ({ answer }) => {
    try {
      if (!activePoll) {
        socket.emit('error', { message: 'No active poll' });
        return;
      }

      const studentName = connectedStudents.get(socket.id);
      if (!studentName) {
        socket.emit('error', { message: 'Not registered as a student' });
        return;
      }

      if (activePoll.responses.some(r => r.studentName === studentName)) {
        socket.emit('error', { message: 'Already submitted a response' });
        return;
      }

      // Add response to in-memory state first
      activePoll.responses.push({
        studentName,
        answer,
        timestamp: new Date()
      });

      // Confirm response to student immediately
      socket.emit('responseConfirmed');
      
      // Update all clients with new state
      io.emit('pollUpdate', {
        ...activePoll.toObject(),
        timeRemaining: activePoll.endTime - new Date()
      });

      // Try to save to database without blocking client operations
      try {
        const pollToUpdate = await Poll.findById(activePoll._id);
        if (pollToUpdate) {
          pollToUpdate.responses = activePoll.responses;
          await pollToUpdate.save();
        }
      } catch (err) {
        console.warn('Warning: could not save response to DB:', err.message);
        // Continue with in-memory state
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      socket.emit('error', { message: 'Error submitting response' });
    }
  });

  // Teacher ends poll manually
  socket.on('endPoll', async () => {
    try {
      if (!activePoll) {
        socket.emit('error', { message: 'No active poll to end' });
        return;
      }

      await endCurrentPoll();
    } catch (error) {
      console.error('Error ending poll:', error);
      socket.emit('error', { message: 'Error ending poll' });
    }
  });

  // Shared function to end polls (used by manual end and timer)
  const endCurrentPoll = async () => {
    if (!activePoll) return;

    // Clear any existing timer
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }

    // Update in-memory state first
    const endedPoll = activePoll;
    endedPoll.isActive = false;
    endedPoll.endTime = new Date();

    // Clear active poll immediately
    activePoll = null;

    // Notify clients right away that poll has ended
    io.emit('pollEnded', { 
      message: 'Poll has ended',
      pollId: endedPoll._id
    });

    // Save to poll history collection
    try {
      // Create new history entry
      const historyEntry = new PollHistory({
        question: endedPoll.question,
        options: endedPoll.options,
        correctOption: endedPoll.correctOption,
        startTime: endedPoll.startTime,
        endTime: endedPoll.endTime,
        responses: endedPoll.responses,
        totalResponses: endedPoll.responses.length
      });

      // Save history asynchronously
      await historyEntry.save();
      
      // Update the active poll to inactive
      if (endedPoll._id) {
        await Poll.findByIdAndUpdate(endedPoll._id, 
          { isActive: false, endTime: endedPoll.endTime },
          { new: true }
        );
      }

      // Get latest history for broadcast
      const latestHistory = await PollHistory.find({})
        .sort({ startTime: -1 })
        .limit(50)
        .lean();

      // Broadcast updated history to all clients
      io.emit('pollHistory', {
        history: latestHistory,
        total: await PollHistory.countDocuments({}),
        page: 1
      });

    } catch (err) {
      console.warn('Warning: Error saving poll history:', err.message);
      // Even if save fails, continue with in-memory state
    }
  };

  // Handle student removal
  socket.on('kickStudent', (studentName) => {
    const studentSocketId = Array.from(connectedStudents.entries())
      .find(([_, name]) => name === studentName)?.[0];
    
    if (studentSocketId) {
      bannedStudents.add(studentName);
      connectedStudents.delete(studentSocketId);
      io.to(studentSocketId).emit('kickedOut');
      io.emit('studentLeft', Array.from(connectedStudents.values()));
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const studentName = connectedStudents.get(socket.id);
    if (studentName) {
      connectedStudents.delete(socket.id);
      io.emit('studentLeft', Array.from(connectedStudents.values()));
    }
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
