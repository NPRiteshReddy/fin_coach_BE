const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  generateNewsletter,
  sendNewsletter,
  sendNewsletterValidation
} = require('../controllers/newsletterController');

/**
 * All newsletter routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   POST /api/newsletter/generate
 * @desc    Generate personalized newsletter with RSS news and AI insights
 * @access  Private
 */
router.post('/generate', generateNewsletter);

/**
 * @route   POST /api/newsletter/send
 * @desc    Send newsletter to user's Gmail
 * @access  Private
 */
router.post('/send', sendNewsletterValidation, sendNewsletter);

module.exports = router;
