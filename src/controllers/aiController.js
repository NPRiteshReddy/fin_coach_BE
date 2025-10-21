const prisma = require('../config/database');
const { body, validationResult } = require('express-validator');

/**
 * Call Groq API for AI responses
 */
const callGroqAPI = async (messages, model = 'llama-3.3-70b-versatile') => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

/**
 * Generate AI feedback for a trade
 * POST /api/ai/feedback
 */
const generateFeedback = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array()
        }
      });
    }

    const userId = req.user.id;
    const { tradeId } = req.body;

    // Get the trade
    const trade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId
      }
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TRADE_NOT_FOUND',
          message: 'Trade not found'
        }
      });
    }

    // Check if feedback already exists
    const existingFeedback = await prisma.aiFeedback.findUnique({
      where: { tradeId }
    });

    if (existingFeedback) {
      return res.json({
        success: true,
        tradeId,
        feedback: {
          overall: existingFeedback.overall,
          strengths: existingFeedback.strengths,
          improvements: existingFeedback.improvements,
          riskLevel: existingFeedback.riskLevel,
          educationalTip: existingFeedback.educationalTip
        },
        generatedAt: existingFeedback.createdAt
      });
    }

    // Get user's portfolio and recent trades for context
    const [portfolio, recentTrades] = await Promise.all([
      prisma.portfolio.findUnique({
        where: { userId },
        include: { holdings: true }
      }),
      prisma.trade.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 5
      })
    ]);

    // Build AI prompt
    const systemPrompt = `You are an educational trading coach for a paper trading simulator.
Your role is to provide constructive, educational feedback on trades.

IMPORTANT:
- This is a SIMULATOR for learning purposes only
- Do NOT provide real financial advice
- Focus on educational insights and trading principles
- Be encouraging but honest about mistakes
- Explain the "why" behind your feedback

Return your response as a valid JSON object with this exact structure:
{
  "overall": "Brief 1-2 sentence assessment",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "riskLevel": "Low|Medium|High",
  "educationalTip": "A learning tip related to this trade"
}`;

    const userPrompt = `Analyze this trade:
- Type: ${trade.type.toUpperCase()}
- Symbol: ${trade.symbol}
- Quantity: ${trade.quantity} shares
- Price: $${trade.price}
- Total: $${trade.total}

Portfolio Context:
- Cash before: $${trade.cashBefore}
- Cash after: $${trade.cashAfter}
- Portfolio value before: $${trade.portfolioValueBefore}
- Portfolio value after: $${trade.portfolioValueAfter}
- Current holdings: ${portfolio.holdings.length} stocks
- Total portfolio value: $${portfolio.totalValue}

Recent trading pattern: ${recentTrades.length} trades in history

Provide educational feedback focusing on position sizing, diversification, and trading discipline.`;

    // Call Groq API
    const aiResponse = await callGroqAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // Clean and parse response
    let cleanedResponse = aiResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let feedback;
    try {
      feedback = JSON.parse(cleanedResponse);
    } catch (parseError) {
      // If parsing fails, return a generic response
      feedback = {
        overall: "Trade executed successfully. Continue monitoring your portfolio performance.",
        strengths: ["Trade executed within your budget"],
        improvements: ["Consider setting stop-loss orders"],
        riskLevel: "Medium",
        educationalTip: "Always have a clear entry and exit strategy before trading."
      };
    }

    // Save feedback to database
    const savedFeedback = await prisma.aiFeedback.create({
      data: {
        tradeId,
        userId,
        overall: feedback.overall,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        riskLevel: feedback.riskLevel,
        educationalTip: feedback.educationalTip
      }
    });

    return res.json({
      success: true,
      tradeId,
      feedback: {
        overall: savedFeedback.overall,
        strengths: savedFeedback.strengths,
        improvements: savedFeedback.improvements,
        riskLevel: savedFeedback.riskLevel,
        educationalTip: savedFeedback.educationalTip
      },
      generatedAt: savedFeedback.createdAt
    });
  } catch (error) {
    console.error('AI Feedback error:', error);
    next(error);
  }
};

/**
 * AI Chat / Coaching
 * POST /api/ai/chat
 */
const chat = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array()
        }
      });
    }

    const userId = req.user.id;
    const { message, conversationId } = req.body;

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId
        },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
            take: 10 // Last 10 messages for context
          }
        }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found'
          }
        });
      }
    } else {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: { userId },
        include: { messages: true }
      });
    }

    // Get user's portfolio for context
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: { holdings: true }
    });

    // Build conversation history for AI
    const conversationHistory = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // System prompt with portfolio context
    const systemPrompt = `You are an AI trading coach for a paper trading simulator.

Current Portfolio Context:
- Cash: $${portfolio.cash}
- Total Value: $${portfolio.totalValue}
- Invested: $${portfolio.invested}
- Holdings: ${portfolio.holdings.map(h => `${h.symbol} (${h.quantity} shares)`).join(', ') || 'None'}

IMPORTANT RULES:
- This is a SIMULATOR for educational purposes only
- NEVER provide real financial advice
- Focus on teaching trading concepts and principles
- Be encouraging and educational
- If suggesting trades, use this format:

~~~TRADE_SUGGESTIONS~~~
[{"symbol": "AAPL", "quantity": 10, "type": "buy", "price": 150.00, "reason": "Educational rationale here"}]
~~~END_SUGGESTIONS~~~

When user specifies a budget, calculate total cost (quantity × price) to match budget within 1%.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Call Groq API
    const aiResponse = await callGroqAPI(messages);

    // Parse trade suggestions if present
    let tradeSuggestions = null;
    let cleanResponse = aiResponse;

    const suggestionsMatch = aiResponse.match(/~~~TRADE_SUGGESTIONS~~~\n?([\s\S]*?)\n?~~~END_SUGGESTIONS~~~/);
    if (suggestionsMatch) {
      try {
        tradeSuggestions = JSON.parse(suggestionsMatch[1].trim());
        // Remove suggestions from display text
        cleanResponse = aiResponse
          .replace(/~~~TRADE_SUGGESTIONS~~~[\s\S]*?~~~END_SUGGESTIONS~~~/, '')
          .trim();
      } catch (e) {
        console.error('Error parsing trade suggestions:', e);
      }
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message
      }
    });

    // Save AI response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: cleanResponse,
        tradeSuggestions: tradeSuggestions || undefined
      }
    });

    return res.json({
      success: true,
      conversationId: conversation.id,
      response: {
        message: cleanResponse,
        tradeSuggestions
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    next(error);
  }
};

/**
 * Get conversation history
 * GET /api/ai/conversations/:conversationId
 */
const getConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found'
        }
      });
    }

    const formattedMessages = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      tradeSuggestions: msg.tradeSuggestions,
      timestamp: msg.timestamp
    }));

    return res.json({
      success: true,
      conversationId: conversation.id,
      messages: formattedMessages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate AI feedback for entire portfolio
 * POST /api/ai/portfolio-feedback
 */
const generatePortfolioFeedback = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user's portfolio with all holdings
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: { holdings: true }
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PORTFOLIO_NOT_FOUND',
          message: 'Portfolio not found'
        }
      });
    }

    // Get recent trades for pattern analysis
    const recentTrades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    // Calculate portfolio metrics
    const totalHoldingsValue = portfolio.holdings.reduce((sum, holding) => {
      const price = holding.currentPrice || holding.avgPrice;
      return sum + (holding.quantity * parseFloat(price));
    }, 0);

    const profitLoss = parseFloat(portfolio.totalValue) - 100000; // Assuming $100k starting balance
    const profitLossPercent = (profitLoss / 100000) * 100;

    // Calculate diversification metrics
    const sectors = {}; // Would need sector data in real scenario
    const holdingsCount = portfolio.holdings.length;

    // Calculate position sizes
    const positionSizes = portfolio.holdings.map(h => {
      const value = h.quantity * parseFloat(h.currentPrice || h.avgPrice);
      const percent = (value / parseFloat(portfolio.totalValue)) * 100;
      return { symbol: h.symbol, percent: percent.toFixed(2) };
    });

    // Build AI prompt
    const systemPrompt = `You are an educational portfolio advisor for a paper trading simulator.
Your role is to provide comprehensive portfolio analysis and educational feedback.

IMPORTANT:
- This is a SIMULATOR for learning purposes only
- Do NOT provide real financial advice
- Focus on portfolio strategy, diversification, and risk management
- Be encouraging but provide actionable insights
- Teach fundamental portfolio management principles

Return your response as a valid JSON object with this exact structure:
{
  "overall": "2-3 sentence portfolio assessment",
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "riskLevel": "Low|Medium|High",
  "diversificationScore": "Poor|Fair|Good|Excellent",
  "educationalTip": "A learning tip about portfolio management"
}`;

    const userPrompt = `Analyze this complete portfolio:

Portfolio Summary:
- Total Value: $${parseFloat(portfolio.totalValue).toFixed(2)}
- Cash: $${parseFloat(portfolio.cash).toFixed(2)}
- Invested: $${parseFloat(portfolio.invested).toFixed(2)}
- Profit/Loss: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%)
- Number of Holdings: ${holdingsCount}
- Total Trades: ${recentTrades.length}

Holdings:
${portfolio.holdings.map(h => {
  const value = h.quantity * parseFloat(h.currentPrice || h.avgPrice);
  const percent = (value / parseFloat(portfolio.totalValue)) * 100;
  return `- ${h.symbol}: ${h.quantity} shares @ $${parseFloat(h.currentPrice || h.avgPrice).toFixed(2)} (${percent.toFixed(1)}% of portfolio)`;
}).join('\n')}

Recent Trading Activity:
${recentTrades.slice(0, 5).map(t =>
  `- ${t.type.toUpperCase()} ${t.quantity} ${t.symbol} @ $${parseFloat(t.price).toFixed(2)}`
).join('\n')}

Analyze:
1. Portfolio diversification (number of holdings, concentration risk)
2. Position sizing (are any positions too large/small?)
3. Trading strategy and discipline
4. Risk management approach
5. Overall portfolio health and balance

Provide educational feedback to help improve portfolio management skills.`;

    // Call Groq API
    const aiResponse = await callGroqAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // Clean and parse response
    let cleanedResponse = aiResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let feedback;
    try {
      feedback = JSON.parse(cleanedResponse);
    } catch (parseError) {
      // If parsing fails, return a generic response
      feedback = {
        overall: "Your portfolio shows good potential. Continue monitoring and adjusting your positions.",
        strengths: ["Actively managing portfolio", "Building investment experience"],
        improvements: ["Consider diversification", "Review position sizes regularly"],
        riskLevel: "Medium",
        diversificationScore: "Fair",
        educationalTip: "A well-diversified portfolio typically holds 10-30 different stocks across various sectors to reduce risk."
      };
    }

    return res.json({
      success: true,
      feedback: {
        overall: feedback.overall,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        riskLevel: feedback.riskLevel,
        diversificationScore: feedback.diversificationScore,
        educationalTip: feedback.educationalTip
      },
      portfolioMetrics: {
        totalValue: parseFloat(portfolio.totalValue),
        profitLoss: parseFloat(profitLoss.toFixed(2)),
        profitLossPercent: parseFloat(profitLossPercent.toFixed(2)),
        holdingsCount,
        positionSizes
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Portfolio Feedback error:', error);
    next(error);
  }
};

/**
 * Validation rules
 */
const feedbackValidation = [
  body('tradeId')
    .isUUID()
    .withMessage('Valid trade ID is required')
];

const chatValidation = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  body('conversationId')
    .optional()
    .isUUID()
    .withMessage('Conversation ID must be a valid UUID')
];

module.exports = {
  generateFeedback,
  generatePortfolioFeedback,
  chat,
  getConversation,
  feedbackValidation,
  chatValidation
};
