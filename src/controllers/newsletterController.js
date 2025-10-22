const prisma = require('../config/database');
const { body, validationResult } = require('express-validator');
const { sendNewsletterEmail } = require('../utils/emailService');

/**
 * Call Groq API for newsletter generation
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
      max_tokens: 2000
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
 * Fetch RSS feeds with portfolio filtering
 */
const fetchRSSNews = async (portfolioSymbols) => {
  const feeds = [
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', category: 'General' },
    { name: 'MarketWatch', url: 'https://www.marketwatch.com/rss/topstories', category: 'Market' },
    { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml', category: 'Analysis' },
    { name: 'Bloomberg', url: 'https://www.bloomberg.com/feed/podcast/etf-report.xml', category: 'ETF' },
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'Business' },
    { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best', category: 'Business' },
    { name: 'Financial Times', url: 'https://www.ft.com/?format=rss', category: 'Global' },
    { name: 'The Motley Fool', url: 'https://www.fool.com/feeds/index.aspx', category: 'Investment' }
  ];

  // Default symbols if portfolio is empty
  const symbols = portfolioSymbols.length > 0
    ? portfolioSymbols
    : ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];

  const allArticles = [];
  const fetchPromises = feeds.map(async (feed) => {
    try {
      // Use allorigins.win as CORS proxy
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Failed to fetch ${feed.name}: HTTP ${response.status}`);
        return [];
      }

      const xmlText = await response.text();

      // Simple XML parsing - look for items
      const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
      const articles = [];

      for (const match of itemMatches) {
        const itemXml = match[1];

        // Extract title
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';

        // Extract link
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const link = linkMatch ? linkMatch[1].trim() : '#';

        // Extract description
        const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s);
        let description = descMatch ? (descMatch[1] || descMatch[2] || '').trim() : '';

        // Clean HTML tags from description
        description = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        // Extract pubDate
        const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>/);
        const pubDate = dateMatch ? (dateMatch[1] || dateMatch[2] || new Date().toISOString()) : new Date().toISOString();

        // Check if article mentions any portfolio symbols
        const text = `${title} ${description}`.toUpperCase();
        const mentionedSymbols = symbols.filter(symbol => {
          const patterns = [
            new RegExp(`\\b${symbol}\\b`),
            new RegExp(`${symbol}[\\s,]`),
            new RegExp(`[\\s,]${symbol}\\b`)
          ];
          return patterns.some(pattern => pattern.test(text));
        });

        if (mentionedSymbols.length > 0 && title) {
          articles.push({
            title,
            summary: description.substring(0, 250) + (description.length > 250 ? '...' : ''),
            url: link,
            source: feed.name,
            publishedAt: pubDate,
            sentiment: 'Neutral',
            relevantSymbols: mentionedSymbols,
            category: feed.category
          });
        }
      }

      return articles;
    } catch (error) {
      console.warn(`Error fetching ${feed.name}:`, error.message);
      return [];
    }
  });

  const results = await Promise.all(fetchPromises);
  results.forEach(articles => allArticles.push(...articles));

  // Sort by date and limit
  allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return allArticles.slice(0, 20);
};

/**
 * Generate personalized newsletter
 * POST /api/newsletter/generate
 */
const generateNewsletter = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user's portfolio
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

    // Get recent trades
    const recentTrades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 3
    });

    // Get portfolio symbols
    const portfolioSymbols = portfolio.holdings.map(h => h.symbol.toUpperCase());

    console.log('Fetching RSS news for symbols:', portfolioSymbols);

    // Fetch news articles
    const articles = await fetchRSSNews(portfolioSymbols);

    console.log(`Fetched ${articles.length} articles`);

    // If no articles found, create mock articles for demonstration
    if (articles.length === 0) {
      console.log('No RSS articles found, using mock data');
      const mockSymbols = portfolioSymbols.length > 0 ? portfolioSymbols : ['AAPL', 'GOOGL', 'MSFT'];

      articles.push({
        title: `Market Analysis: Tech Stocks Including ${mockSymbols[0]} Show Strong Performance`,
        summary: 'Recent market trends indicate positive momentum in the technology sector with several key players showing growth.',
        url: 'https://finance.yahoo.com',
        source: 'Market Analysis',
        publishedAt: new Date().toISOString(),
        sentiment: 'Neutral',
        relevantSymbols: [mockSymbols[0]],
        category: 'Market'
      });

      if (mockSymbols.length > 1) {
        articles.push({
          title: `${mockSymbols[1]} Reports Strong Quarterly Earnings`,
          summary: 'Company demonstrates continued growth and market leadership in its sector.',
          url: 'https://finance.yahoo.com',
          source: 'Financial News',
          publishedAt: new Date().toISOString(),
          sentiment: 'Neutral',
          relevantSymbols: [mockSymbols[1]],
          category: 'Earnings'
        });
      }

      if (mockSymbols.length > 2) {
        articles.push({
          title: `Investment Outlook: ${mockSymbols[2]} and Market Trends`,
          summary: 'Analysts discuss market positioning and strategic considerations for long-term investors.',
          url: 'https://finance.yahoo.com',
          source: 'Investment Analysis',
          publishedAt: new Date().toISOString(),
          sentiment: 'Neutral',
          relevantSymbols: [mockSymbols[2]],
          category: 'Analysis'
        });
      }
    }

    // Build portfolio context
    const portfolioContext = `
Current Portfolio:
- Total Value: $${parseFloat(portfolio.totalValue).toLocaleString()}
- Cash: $${parseFloat(portfolio.cash).toLocaleString()}
- Holdings: ${portfolio.holdings.length > 0
  ? portfolio.holdings.map(h => `${h.symbol}: ${h.quantity} shares @ $${parseFloat(h.currentPrice || h.avgPrice).toFixed(2)}`).join(', ')
  : 'None'}
- Recent Trades: ${recentTrades.length > 0
  ? recentTrades.map(t => `${t.type.toUpperCase()} ${t.quantity} ${t.symbol} @ $${parseFloat(t.price).toFixed(2)}`).join(', ')
  : 'No trades yet'}
`;

    const newsContext = articles.slice(0, 5).map((article, idx) =>
      `${idx + 1}. ${article.title}\n   Summary: ${article.summary}\n   Sentiment: ${article.sentiment}\n   Symbols: ${article.relevantSymbols.join(', ')}`
    ).join('\n\n');

    // Generate newsletter content with AI
    const systemPrompt = `You are a financial newsletter writer creating personalized content for paper trading simulator users.

Your job is to:
1. Analyze the user's portfolio holdings
2. Review recent market news
3. Create an engaging, educational newsletter that connects news to their portfolio
4. Provide insights without giving real financial advice

Tone: Professional, informative, educational
Format: Well-structured with sections

IMPORTANT: This is for educational purposes only. Never provide real financial advice.`;

    const userPrompt = `Create a personalized financial newsletter for this user.

${portfolioContext}

Recent Market News:
${newsContext}

Please create a newsletter with:
1. A catchy headline
2. Market overview (2-3 sentences)
3. Portfolio-specific insights (how news relates to their holdings)
4. 3 key takeaways
5. Educational tip

Return ONLY valid JSON in this format:
{
  "headline": "Your headline here",
  "marketOverview": "Overview paragraph",
  "portfolioInsights": "Insights paragraph connecting news to their portfolio",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "educationalTip": "One learning point",
  "featuredArticles": [
    {
      "title": "Article title from the news",
      "summary": "Brief summary",
      "relevance": "Why this matters to the user"
    }
  ]
}`;

    console.log('Generating newsletter content with Groq...');

    const aiResponse = await callGroqAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // Clean and parse response
    let cleanedResponse = aiResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let generatedContent;
    try {
      generatedContent = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return generic content if parsing fails
      generatedContent = {
        headline: "Market Update for Your Portfolio",
        marketOverview: "The market continues to show volatility with mixed signals across different sectors.",
        portfolioInsights: "Your portfolio holdings are positioned across key market segments. Monitor your positions closely.",
        keyTakeaways: [
          "Stay informed about news affecting your holdings",
          "Diversification helps manage risk",
          "Long-term strategy is key for success"
        ],
        educationalTip: "Always do your research before making investment decisions.",
        featuredArticles: []
      };
    }

    // Return complete newsletter
    return res.json({
      success: true,
      newsletter: {
        ...generatedContent,
        articles: articles,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Newsletter generation error:', error);
    next(error);
  }
};

/**
 * Send newsletter to email
 * POST /api/newsletter/send
 */
const sendNewsletter = async (req, res, next) => {
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

    const { email, newsletterData } = req.body;

    console.log(`Sending newsletter to ${email}...`);

    // Send email
    const result = await sendNewsletterEmail(email, newsletterData);

    return res.json({
      success: true,
      message: result.message,
      simulated: result.simulated || false
    });

  } catch (error) {
    console.error('Newsletter send error:', error);

    // Return user-friendly error for Gmail validation
    if (error.message.includes('Gmail')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: error.message
        }
      });
    }

    // Return detailed error for email sending failures
    return res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: error.message || 'Failed to send email. Please check your email configuration.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};

/**
 * Validation rules for send newsletter
 */
const sendNewsletterValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email address is required')
    .trim(),  // Only trim whitespace, don't normalize (keeps email exactly as entered)
  body('newsletterData')
    .exists()
    .withMessage('Newsletter data is required')
];

module.exports = {
  generateNewsletter,
  sendNewsletter,
  sendNewsletterValidation
};
