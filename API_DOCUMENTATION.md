# Trading Simulator - Complete API Documentation

## 🚀 Base URL
```
http://localhost:3000
```

## 🔐 Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 📋 Complete API Reference

### ✅ Health Check

#### GET /health
Check if the API is running.

**Auth Required:** No

**Response:**
```json
{
  "success": true,
  "message": "Trading Simulator API is running",
  "timestamp": "2025-10-18T12:00:00.000Z",
  "environment": "development"
}
```

---

## 👤 Authentication Endpoints

### POST /api/auth/register
Register a new user and create initial portfolio with $100,000.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-10-18T12:00:00.000Z"
  },
  "token": "eyJhbGci..."
}
```

---

### POST /api/auth/login
Login and receive JWT token.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    ...
  },
  "token": "eyJhbGci..."
}
```

---

### GET /api/auth/me
Get current user profile with portfolio summary.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-10-18T12:00:00.000Z",
    "portfolio": {
      "cash": "100000",
      "totalValue": "100000",
      "invested": "0"
    }
  }
}
```

---

## 💰 Portfolio Endpoints

### GET /api/portfolio
Get full portfolio with holdings and calculated P&L.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "portfolio": {
    "userId": "uuid",
    "cash": 98500,
    "totalValue": 100000,
    "invested": 1500,
    "holdings": [
      {
        "symbol": "AAPL",
        "quantity": 10,
        "avgPrice": 150,
        "currentPrice": 150,
        "totalValue": 1500,
        "gainLoss": 0,
        "gainLossPercent": 0
      }
    ],
    "updatedAt": "2025-10-18T12:00:00.000Z"
  }
}
```

---

### POST /api/portfolio/refresh-prices
Refresh stock prices for all holdings.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "message": "Prices refreshed successfully",
  "holdings": [
    {
      "symbol": "AAPL",
      "previousPrice": 150,
      "currentPrice": 155,
      "change": 5,
      "changePercent": 3.33
    }
  ],
  "portfolioValue": 100050
}
```

---

## 📈 Trading Endpoints

### POST /api/trades
Execute a buy or sell trade.

**Auth Required:** Yes

**Request Body:**
```json
{
  "symbol": "AAPL",
  "quantity": 10,
  "price": 150.00,
  "type": "buy"
}
```

**Response:**
```json
{
  "success": true,
  "trade": {
    "id": "uuid",
    "userId": "uuid",
    "symbol": "AAPL",
    "quantity": 10,
    "price": 150,
    "total": 1500,
    "type": "buy",
    "timestamp": "2025-10-18T12:00:00.000Z"
  },
  "portfolio": {
    "cash": 98500,
    "totalValue": 100000,
    "invested": 1500
  }
}
```

**Validation:**
- BUY: Checks sufficient cash
- SELL: Checks sufficient shares

---

### GET /api/trades
Get trade history with optional filters.

**Auth Required:** Yes

**Query Parameters:**
- `limit` (default: 50, max: 200)
- `offset` (default: 0)
- `symbol` (optional): Filter by stock symbol
- `type` (optional): "buy" or "sell"
- `startDate` (optional): ISO date
- `endDate` (optional): ISO date

**Response:**
```json
{
  "success": true,
  "trades": [
    {
      "id": "uuid",
      "symbol": "AAPL",
      "quantity": 10,
      "price": 150,
      "total": 1500,
      "type": "buy",
      "timestamp": "2025-10-18T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 125,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### GET /api/trades/:tradeId
Get single trade with before/after portfolio snapshot.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "trade": {
    "id": "uuid",
    "symbol": "AAPL",
    "quantity": 10,
    "price": 150,
    "total": 1500,
    "type": "buy",
    "timestamp": "2025-10-18T12:00:00.000Z",
    "portfolioSnapshot": {
      "cashBefore": 100000,
      "cashAfter": 98500,
      "totalValueBefore": 100000,
      "totalValueAfter": 100000
    }
  }
}
```

---

## 🤖 AI Coaching Endpoints

### POST /api/ai/feedback
Generate AI educational feedback for a specific trade.

**Auth Required:** Yes

**Request Body:**
```json
{
  "tradeId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "tradeId": "uuid",
  "feedback": {
    "overall": "Good diversification move into tech sector...",
    "strengths": [
      "Buying during a dip shows market timing awareness",
      "Position sizing is appropriate for your portfolio"
    ],
    "improvements": [
      "Consider setting a stop-loss at 5% below purchase price",
      "Research the company's upcoming earnings date"
    ],
    "riskLevel": "Medium",
    "educationalTip": "Dollar-cost averaging can reduce timing risk..."
  },
  "generatedAt": "2025-10-18T12:00:00.000Z"
}
```

**Note:** Feedback is cached - calling again with the same tradeId returns the same feedback.

---

### POST /api/ai/chat
Chat with AI trading coach.

**Auth Required:** Yes

**Request Body:**
```json
{
  "message": "What stocks should I buy with $5000?",
  "conversationId": "uuid"  // optional, for continuing conversation
}
```

**Response:**
```json
{
  "success": true,
  "conversationId": "uuid",
  "response": {
    "message": "Here are some diversified options...",
    "tradeSuggestions": [
      {
        "symbol": "AAPL",
        "quantity": 20,
        "price": 150.00,
        "type": "buy",
        "reason": "Strong fundamentals and market position"
      }
    ]
  },
  "timestamp": "2025-10-18T12:00:00.000Z"
}
```

**Features:**
- Maintains conversation history
- Provides portfolio-aware suggestions
- Can suggest multiple trades with budget matching
- Educational tone (no real financial advice)

---

### GET /api/ai/conversations/:conversationId
Get full conversation history.

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "conversationId": "uuid",
  "messages": [
    {
      "role": "user",
      "content": "What stocks should I buy?",
      "timestamp": "2025-10-18T12:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Here are some options...",
      "tradeSuggestions": [...],
      "timestamp": "2025-10-18T12:00:05.000Z"
    }
  ]
}
```

---

## 📊 Market Data Endpoints

### GET /api/market/quote/:symbol
Get real-time stock quote from Alpha Vantage (with 1-minute caching).

**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "quote": {
    "symbol": "AAPL",
    "price": 252.29,
    "change": 4.84,
    "changePercent": 1.956,
    "volume": 49146961,
    "timestamp": "2025-10-18T12:00:00.000Z",
    "source": "api"  // "api" or "cache"
  }
}
```

**Rate Limits:**
- Alpha Vantage free tier: 5 requests/minute, 500/day
- Results are cached for 1 minute

---

### GET /api/market/search
Search for stocks by symbol or company name.

**Auth Required:** Yes

**Query Parameters:**
- `q` (required): Search query
- `limit` (default: 10): Max results

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "Common Stock",
      "region": "United States",
      "currency": "USD"
    }
  ]
}
```

---

### POST /api/market/quotes/batch
Get multiple stock quotes in one request (max 20 symbols).

**Auth Required:** Yes

**Request Body:**
```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL"]
}
```

**Response:**
```json
{
  "success": true,
  "quotes": [
    {
      "symbol": "AAPL",
      "price": 252.29,
      "change": 4.84,
      "changePercent": 1.956
    },
    {
      "symbol": "MSFT",
      "price": 412.15,
      "change": 2.30,
      "changePercent": 0.56
    }
  ],
  "errors": [],  // Any failed lookups
  "timestamp": "2025-10-18T12:00:00.000Z"
}
```

**Note:** Requests are throttled (300ms delay between symbols) to respect API rate limits.

---

## ⚠️ Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}  // Optional additional info
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `AUTH_TOKEN_MISSING` | 401 | No auth token provided |
| `AUTH_TOKEN_EXPIRED` | 401 | Token has expired |
| `AUTH_TOKEN_INVALID` | 401 | Invalid token |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `INSUFFICIENT_FUNDS` | 400 | Not enough cash for trade |
| `INSUFFICIENT_SHARES` | 400 | Not enough shares to sell |
| `INVALID_SYMBOL` | 404 | Unknown stock symbol |
| `TRADE_NOT_FOUND` | 404 | Trade doesn't exist |
| `PORTFOLIO_NOT_FOUND` | 404 | Portfolio doesn't exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many API requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 🧪 Testing Examples

### Register and Login
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}'
```

### Execute Trade
```bash
TOKEN="your-jwt-token-here"

# Buy 10 shares of AAPL at $150
curl -X POST http://localhost:3000/api/trades \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","quantity":10,"price":150.00,"type":"buy"}'
```

### Get Portfolio
```bash
curl -X GET http://localhost:3000/api/portfolio \
  -H "Authorization: Bearer $TOKEN"
```

### Get AI Feedback
```bash
curl -X POST http://localhost:3000/api/ai/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tradeId":"your-trade-id"}'
```

### Chat with AI
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What stocks should I buy?"}'
```

### Get Stock Quote
```bash
curl -X GET "http://localhost:3000/api/market/quote/AAPL" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔒 Security Features

- **Password Hashing**: bcrypt with 12 rounds
- **JWT Tokens**: 7-day expiration, secure 128-char secret
- **Input Validation**: express-validator on all inputs
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **CORS**: Configured for frontend origin only
- **Rate Limiting**: Implemented on external API calls

---

## 📚 Tech Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js 5
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma 6
- **Authentication**: JWT + bcrypt
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Market Data**: Alpha Vantage API
- **Validation**: express-validator

---

## 🚀 Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

---

## 📝 Database Schema

See `prisma/schema.prisma` for the complete schema with 7 tables:
- **users** - User accounts
- **portfolios** - User portfolios ($100k starting balance)
- **holdings** - Stock positions
- **trades** - Complete trade history
- **ai_feedback** - AI trade analysis
- **conversations** - AI chat threads
- **messages** - Chat messages
- **market_data_cache** - Stock price cache (1-min TTL)

All tables use UUID primary keys and proper foreign key relationships with cascade deletes.
