const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  executeTrade,
  getTrades,
  getTrade,
  tradeValidation
} = require('../controllers/tradesController');

/**
 * All trade routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   POST /api/trades
 * @desc    Execute a trade (buy or sell)
 * @access  Private
 */
router.post('/', tradeValidation, executeTrade);

/**
 * @route   GET /api/trades
 * @desc    Get user's trade history with filters
 * @access  Private
 */
router.get('/', getTrades);

/**
 * @route   GET /api/trades/:tradeId
 * @desc    Get single trade details
 * @access  Private
 */
router.get('/:tradeId', getTrade);

module.exports = router;
