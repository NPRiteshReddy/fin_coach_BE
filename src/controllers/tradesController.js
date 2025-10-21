const prisma = require('../config/database');
const { body, query, validationResult } = require('express-validator');
const { recalculatePortfolioValue } = require('./portfolioController');

/**
 * Execute a trade (buy or sell)
 * POST /api/trades
 */
const executeTrade = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid trade data',
          details: errors.array()
        }
      });
    }

    const userId = req.user.id;
    const { symbol, quantity, price, type } = req.body;
    const total = parseFloat((quantity * price).toFixed(2));

    // Get user's portfolio
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: {
        holdings: {
          where: { symbol: symbol.toUpperCase() }
        }
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

    const existingHolding = portfolio.holdings[0];

    // Validate trade based on type
    if (type === 'buy') {
      if (parseFloat(portfolio.cash) < total) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: 'Insufficient cash balance for this trade',
            details: {
              required: total,
              available: parseFloat(portfolio.cash)
            }
          }
        });
      }
    } else if (type === 'sell') {
      if (!existingHolding) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'HOLDING_NOT_FOUND',
            message: 'You do not own any shares of this stock'
          }
        });
      }

      if (existingHolding.quantity < quantity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_SHARES',
            message: 'Insufficient shares to sell',
            details: {
              requested: quantity,
              available: existingHolding.quantity
            }
          }
        });
      }
    }

    // Execute trade in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get current portfolio values for snapshot
      const cashBefore = parseFloat(portfolio.cash);
      const totalValueBefore = parseFloat(portfolio.totalValue);

      let newCash, newInvested;

      if (type === 'buy') {
        // BUY: Deduct cash, increase invested
        newCash = cashBefore - total;
        newInvested = parseFloat(portfolio.invested) + total;

        // Create or update holding
        if (existingHolding) {
          // Calculate new average price
          const oldTotal = existingHolding.quantity * parseFloat(existingHolding.avgPrice);
          const newTotal = oldTotal + total;
          const newQuantity = existingHolding.quantity + quantity;
          const newAvgPrice = newTotal / newQuantity;

          await tx.holding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: newQuantity,
              avgPrice: newAvgPrice,
              currentPrice: price // Update current price
            }
          });
        } else {
          // Create new holding
          await tx.holding.create({
            data: {
              portfolioId: portfolio.id,
              symbol: symbol.toUpperCase(),
              quantity,
              avgPrice: price,
              currentPrice: price
            }
          });
        }
      } else {
        // SELL: Add cash, decrease invested
        newCash = cashBefore + total;
        newInvested = parseFloat(portfolio.invested) - total;

        // Update or delete holding
        if (existingHolding.quantity === quantity) {
          // Sell all shares - delete holding
          await tx.holding.delete({
            where: { id: existingHolding.id }
          });
        } else {
          // Partial sell - update quantity
          await tx.holding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: existingHolding.quantity - quantity,
              currentPrice: price // Update current price
            }
          });
        }
      }

      // Update portfolio
      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: {
          cash: newCash,
          invested: newInvested
        }
      });

      // Recalculate total value
      const updatedPortfolio = await tx.portfolio.findUnique({
        where: { id: portfolio.id },
        include: { holdings: true }
      });

      let totalHoldingsValue = 0;
      for (const holding of updatedPortfolio.holdings) {
        const holdingPrice = holding.currentPrice || holding.avgPrice;
        totalHoldingsValue += holding.quantity * parseFloat(holdingPrice);
      }
      const totalValueAfter = newCash + totalHoldingsValue;

      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: { totalValue: totalValueAfter }
      });

      // Create trade record
      const trade = await tx.trade.create({
        data: {
          userId,
          portfolioId: portfolio.id,
          symbol: symbol.toUpperCase(),
          quantity,
          price,
          total,
          type,
          cashBefore,
          cashAfter: newCash,
          portfolioValueBefore: totalValueBefore,
          portfolioValueAfter: totalValueAfter
        }
      });

      return {
        trade,
        portfolio: {
          cash: newCash,
          totalValue: totalValueAfter,
          invested: newInvested
        }
      };
    });

    return res.status(201).json({
      success: true,
      trade: {
        id: result.trade.id,
        userId: result.trade.userId,
        symbol: result.trade.symbol,
        quantity: result.trade.quantity,
        price: parseFloat(result.trade.price),
        total: parseFloat(result.trade.total),
        type: result.trade.type,
        timestamp: result.trade.timestamp
      },
      portfolio: {
        cash: parseFloat(result.portfolio.cash.toFixed(2)),
        totalValue: parseFloat(result.portfolio.totalValue.toFixed(2)),
        invested: parseFloat(result.portfolio.invested.toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's trade history
 * GET /api/trades
 */
const getTrades = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      limit = 50,
      offset = 0,
      symbol,
      type,
      startDate,
      endDate
    } = req.query;

    // Build filter conditions
    const where = { userId };

    if (symbol) {
      where.symbol = symbol.toUpperCase();
    }

    if (type && (type === 'buy' || type === 'sell')) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get trades with pagination
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.trade.count({ where })
    ]);

    // Format trades
    const formattedTrades = trades.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      quantity: trade.quantity,
      price: parseFloat(trade.price),
      total: parseFloat(trade.total),
      type: trade.type,
      timestamp: trade.timestamp
    }));

    return res.json({
      success: true,
      trades: formattedTrades,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + formattedTrades.length) < total
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single trade details
 * GET /api/trades/:tradeId
 */
const getTrade = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tradeId } = req.params;

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

    return res.json({
      success: true,
      trade: {
        id: trade.id,
        symbol: trade.symbol,
        quantity: trade.quantity,
        price: parseFloat(trade.price),
        total: parseFloat(trade.total),
        type: trade.type,
        timestamp: trade.timestamp,
        portfolioSnapshot: {
          cashBefore: trade.cashBefore ? parseFloat(trade.cashBefore) : null,
          cashAfter: trade.cashAfter ? parseFloat(trade.cashAfter) : null,
          totalValueBefore: trade.portfolioValueBefore ? parseFloat(trade.portfolioValueBefore) : null,
          totalValueAfter: trade.portfolioValueAfter ? parseFloat(trade.portfolioValueAfter) : null
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validation rules for trade execution
 */
const tradeValidation = [
  body('symbol')
    .trim()
    .toUpperCase()
    .isLength({ min: 1, max: 10 })
    .matches(/^[A-Z]+$/)
    .withMessage('Symbol must be 1-10 uppercase letters'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
  body('type')
    .isIn(['buy', 'sell'])
    .withMessage('Type must be either "buy" or "sell"')
];

module.exports = {
  executeTrade,
  getTrades,
  getTrade,
  tradeValidation
};
