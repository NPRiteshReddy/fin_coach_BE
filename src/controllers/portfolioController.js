const prisma = require('../config/database');
const { Decimal } = require('@prisma/client/runtime/library');

/**
 * Get user's portfolio with current holdings
 * GET /api/portfolio
 */
const getPortfolio = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get portfolio with holdings
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: {
        holdings: {
          orderBy: { symbol: 'asc' }
        }
      }
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PORTFOLIO_NOT_FOUND',
          message: 'Portfolio not found for this user'
        }
      });
    }

    // Calculate real-time values and P&L for each holding
    const holdingsWithCalculations = portfolio.holdings.map(holding => {
      const price = holding.currentPrice || holding.avgPrice;
      const totalValue = parseFloat(holding.quantity) * parseFloat(price);
      const costBasis = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
      const gainLoss = totalValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      return {
        symbol: holding.symbol,
        quantity: holding.quantity,
        avgPrice: parseFloat(holding.avgPrice),
        currentPrice: holding.currentPrice ? parseFloat(holding.currentPrice) : null,
        totalValue: parseFloat(totalValue.toFixed(2)),
        gainLoss: parseFloat(gainLoss.toFixed(2)),
        gainLossPercent: parseFloat(gainLossPercent.toFixed(2))
      };
    });

    return res.json({
      success: true,
      portfolio: {
        userId: portfolio.userId,
        cash: parseFloat(portfolio.cash),
        totalValue: parseFloat(portfolio.totalValue),
        invested: parseFloat(portfolio.invested),
        holdings: holdingsWithCalculations,
        updatedAt: portfolio.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh stock prices for all holdings
 * POST /api/portfolio/refresh-prices
 *
 * Note: This endpoint would normally fetch from Alpha Vantage API
 * For now, it's a placeholder that returns current cached prices
 */
const refreshPrices = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get portfolio with holdings
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: {
        holdings: true
      }
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

    if (portfolio.holdings.length === 0) {
      return res.json({
        success: true,
        message: 'No holdings to refresh',
        holdings: [],
        portfolioValue: parseFloat(portfolio.cash)
      });
    }

    // TODO: In production, fetch real prices from Alpha Vantage API
    // For now, we'll use the current prices if they exist, or average prices
    const updatedHoldings = portfolio.holdings.map(holding => {
      const currentPrice = holding.currentPrice || holding.avgPrice;

      return {
        symbol: holding.symbol,
        previousPrice: holding.currentPrice ? parseFloat(holding.currentPrice) : parseFloat(holding.avgPrice),
        currentPrice: parseFloat(currentPrice),
        change: 0, // Would be calculated from API data
        changePercent: 0 // Would be calculated from API data
      };
    });

    // Calculate total portfolio value
    let totalHoldingsValue = 0;
    for (const holding of portfolio.holdings) {
      const price = holding.currentPrice || holding.avgPrice;
      totalHoldingsValue += parseFloat(holding.quantity) * parseFloat(price);
    }

    const portfolioValue = parseFloat(portfolio.cash) + totalHoldingsValue;

    // Update portfolio total value
    await prisma.portfolio.update({
      where: { userId },
      data: {
        totalValue: portfolioValue
      }
    });

    return res.json({
      success: true,
      message: 'Prices refreshed successfully',
      holdings: updatedHoldings,
      portfolioValue: parseFloat(portfolioValue.toFixed(2))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to recalculate portfolio total value
 */
const recalculatePortfolioValue = async (portfolioId) => {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { holdings: true }
  });

  let totalHoldingsValue = 0;
  for (const holding of portfolio.holdings) {
    const price = holding.currentPrice || holding.avgPrice;
    totalHoldingsValue += parseFloat(holding.quantity) * parseFloat(price);
  }

  const totalValue = parseFloat(portfolio.cash) + totalHoldingsValue;

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { totalValue }
  });

  return totalValue;
};

module.exports = {
  getPortfolio,
  refreshPrices,
  recalculatePortfolioValue
};
