const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getPortfolio,
  refreshPrices
} = require('../controllers/portfolioController');

/**
 * All portfolio routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   GET /api/portfolio
 * @desc    Get user's portfolio with holdings
 * @access  Private
 */
router.get('/', getPortfolio);

/**
 * @route   POST /api/portfolio/refresh-prices
 * @desc    Refresh stock prices for all holdings
 * @access  Private
 */
router.post('/refresh-prices', refreshPrices);

module.exports = router;
