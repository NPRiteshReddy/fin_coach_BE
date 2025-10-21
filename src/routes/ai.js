const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  generateFeedback,
  generatePortfolioFeedback,
  chat,
  getConversation,
  feedbackValidation,
  chatValidation
} = require('../controllers/aiController');

/**
 * All AI routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   POST /api/ai/feedback
 * @desc    Generate AI feedback for a trade
 * @access  Private
 */
router.post('/feedback', feedbackValidation, generateFeedback);

/**
 * @route   POST /api/ai/portfolio-feedback
 * @desc    Generate AI feedback for entire portfolio
 * @access  Private
 */
router.post('/portfolio-feedback', generatePortfolioFeedback);

/**
 * @route   POST /api/ai/chat
 * @desc    Chat with AI coach
 * @access  Private
 */
router.post('/chat', chatValidation, chat);

/**
 * @route   GET /api/ai/conversations/:conversationId
 * @desc    Get conversation history
 * @access  Private
 */
router.get('/conversations/:conversationId', getConversation);

module.exports = router;
