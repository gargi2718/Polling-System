const mongoose = require('mongoose');

const PollHistorySchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: true
  }],
  correctOption: {
    type: Number,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  responses: [{
    studentName: String,
    answer: Number,
    timestamp: Date
  }],
  totalResponses: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Add index on startTime for efficient sorting in history
PollHistorySchema.index({ startTime: -1 });

module.exports = mongoose.model('PollHistory', PollHistorySchema);