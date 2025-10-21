const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getQuote,
  searchStocks,
  batchQuotes
} = require('../controllers/marketController');

/**
 * All market data routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   GET /api/market/quote/:symbol
 * @desc    Get stock quote for a symbol
 * @access  Private
 */
router.get('/quote/:symbol', getQuote);

/**
 * @route   GET /api/market/search
 * @desc    Search for stocks by symbol or name
 * @access  Private
 */
router.get('/search', searchStocks);

/**
 * @route   POST /api/market/quotes/batch
 * @desc    Get multiple stock quotes in one request
 * @access  Private
 */
router.post('/quotes/batch', batchQuotes);

module.exports = router;
