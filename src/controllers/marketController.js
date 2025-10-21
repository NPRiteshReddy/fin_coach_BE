const prisma = require('../config/database');

/**
 * Fetch stock quote from Alpha Vantage API
 */
const fetchFromAlphaVantage = async (symbol) => {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data['Error Message']) {
    throw new Error('Invalid stock symbol');
  }

  if (data['Note']) {
    throw new Error('API rate limit exceeded. Please try again later.');
  }

  const quote = data['Global Quote'];
  if (!quote || !quote['05. price']) {
    throw new Error('Stock data not available');
  }

  return {
    symbol: quote['01. symbol'],
    price: parseFloat(quote['05. price']),
    change: parseFloat(quote['09. change']),
    changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
    volume: parseInt(quote['06. volume']),
    timestamp: new Date().toISOString()
  };
};

/**
 * Get stock quote with caching
 * GET /api/market/quote/:symbol
 */
const getQuote = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const symbolUpper = symbol.toUpperCase();

    // Check cache first
    const cachedData = await prisma.marketDataCache.findUnique({
      where: { symbol: symbolUpper }
    });

    const now = new Date();
    if (cachedData && cachedData.expiresAt > now) {
      // Return cached data
      return res.json({
        success: true,
        quote: {
          symbol: cachedData.symbol,
          price: parseFloat(cachedData.price),
          change: cachedData.change ? parseFloat(cachedData.change) : null,
          changePercent: cachedData.changePercent ? parseFloat(cachedData.changePercent) : null,
          volume: cachedData.volume ? Number(cachedData.volume) : null,
          timestamp: cachedData.cachedAt.toISOString(),
          source: 'cache'
        }
      });
    }

    // Fetch from API
    const quoteData = await fetchFromAlphaVantage(symbolUpper);

    // Cache for 1 minute
    const expiresAt = new Date(now.getTime() + 60 * 1000);

    await prisma.marketDataCache.upsert({
      where: { symbol: symbolUpper },
      update: {
        price: quoteData.price,
        change: quoteData.change,
        changePercent: quoteData.changePercent,
        volume: quoteData.volume,
        cachedAt: now,
        expiresAt
      },
      create: {
        symbol: symbolUpper,
        price: quoteData.price,
        change: quoteData.change,
        changePercent: quoteData.changePercent,
        volume: quoteData.volume,
        cachedAt: now,
        expiresAt
      }
    });

    return res.json({
      success: true,
      quote: {
        ...quoteData,
        source: 'api'
      }
    });
  } catch (error) {
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API rate limit exceeded. Please try again in a minute.',
          retryAfter: 60
        }
      });
    }

    if (error.message.includes('Invalid stock symbol')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_SYMBOL',
          message: 'Invalid or unknown stock symbol'
        }
      });
    }

    next(error);
  }
};

/**
 * Search for stocks
 * GET /api/market/search?q=AAPL&limit=10
 */
const searchStocks = async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required'
        }
      });
    }

    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data['Note']) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API rate limit exceeded. Please try again later.',
          retryAfter: 60
        }
      });
    }

    const matches = data.bestMatches || [];
    const results = matches.slice(0, parseInt(limit)).map(match => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: match['3. type'],
      region: match['4. region'],
      currency: match['8. currency']
    }));

    return res.json({
      success: true,
      results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple quotes in batch
 * POST /api/market/quotes/batch
 */
const batchQuotes = async (req, res, next) => {
  try {
    const { symbols } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Symbols array is required and must not be empty'
        }
      });
    }

    if (symbols.length > 20) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Maximum 20 symbols allowed per request'
        }
      });
    }

    const quotes = [];
    const errors = [];

    // Fetch quotes sequentially to avoid overwhelming the API
    for (const symbol of symbols) {
      try {
        const symbolUpper = symbol.toUpperCase();

        // Check cache first
        const cachedData = await prisma.marketDataCache.findUnique({
          where: { symbol: symbolUpper }
        });

        const now = new Date();
        if (cachedData && cachedData.expiresAt > now) {
          quotes.push({
            symbol: cachedData.symbol,
            price: parseFloat(cachedData.price),
            change: cachedData.change ? parseFloat(cachedData.change) : null,
            changePercent: cachedData.changePercent ? parseFloat(cachedData.changePercent) : null
          });
          continue;
        }

        // Fetch from API
        const quoteData = await fetchFromAlphaVantage(symbolUpper);

        // Cache it
        const expiresAt = new Date(now.getTime() + 60 * 1000);
        await prisma.marketDataCache.upsert({
          where: { symbol: symbolUpper },
          update: {
            price: quoteData.price,
            change: quoteData.change,
            changePercent: quoteData.changePercent,
            volume: quoteData.volume,
            cachedAt: now,
            expiresAt
          },
          create: {
            symbol: symbolUpper,
            price: quoteData.price,
            change: quoteData.change,
            changePercent: quoteData.changePercent,
            volume: quoteData.volume,
            cachedAt: now,
            expiresAt
          }
        });

        quotes.push({
          symbol: quoteData.symbol,
          price: quoteData.price,
          change: quoteData.change,
          changePercent: quoteData.changePercent
        });

        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        errors.push({
          symbol: symbol.toUpperCase(),
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      quotes,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuote,
  searchStocks,
  batchQuotes
};
