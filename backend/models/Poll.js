const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  question: { 
    type: String, 
    required: true 
  },
  options: [{ 
    type: String, 
    required: true 
  }],
  correctOption: { 
    type: String, 
    required: true 
  },
  time: { 
    type: Number, 
    required: true 
  },
  startTime: { 
    type: Date 
  },
  endTime: { 
    type: Date 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  responses: [{
    studentName: String,
    response: String,
    timestamp: Date
  }]
});

module.exports = mongoose.model('Poll', pollSchema);