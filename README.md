# Paper Trading Simulator - Backend API

Node.js + Express backend for the Paper Trading Simulator with AI coaching features.

## 🚀 Tech Stack

- **Framework:** Node.js + Express 5
- **Database:** PostgreSQL (Supabase) + Prisma ORM
- **Authentication:** JWT
- **AI:** Groq API (llama-3.3-70b-versatile)
- **Stock Data:** Alpha Vantage API
- **Email:** Nodemailer + Gmail SMTP
- **News:** RSS Feed scraping

## 📋 Features

- User authentication with JWT
- Real-time stock price fetching
- Portfolio management
- Trade execution (buy/sell)
- AI-powered trade feedback
- AI coaching chat with trade suggestions
- Personalized financial newsletter generation
- Newsletter email delivery (Gmail)

## Prerequisites

- Node.js 16+ installed
- Supabase account (free tier works)
- All API keys from frontend project

## Setup Instructions

### 1. Supabase Database Setup

#### Create a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - **Project name**: `fin-coach` (or any name you prefer)
   - **Database password**: Create a strong password (save this!)
   - **Region**: Choose closest to you
4. Click "Create new project" (takes ~2 minutes)

#### Get Your Database Connection String

1. Once your project is created, go to **Settings** > **Database**
2. Scroll down to **Connection String** section
3. Select the **URI** tab (not the Session mode)
4. Copy the connection string (looks like):
   ```
   postgresql://postgres.xxxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your actual database password

### 2. Environment Variables

Edit the `.env` file in the backend directory:

```bash
# Replace this with your Supabase connection string from step 1
DATABASE_URL="postgresql://postgres.xxxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Generate a secure JWT secret (run this in terminal):
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="your-generated-secret-here"

# Keep the rest as is
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5174"

# Add your API keys here
GROQ_API_KEY="your-groq-api-key-here"
ALPHA_VANTAGE_API_KEY="your-alpha-vantage-key-here"
```

### 3. Generate JWT Secret

Run this command to generate a secure random secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET` in `.env`

### 4. Install Dependencies

```bash
npm install
```

### 5. Generate Prisma Client

This generates the type-safe database client:

```bash
npm run prisma:generate
```

### 6. Run Database Migrations

This creates all the tables in your Supabase database:

```bash
npm run prisma:migrate
```

When prompted for a migration name, enter: `init`

### 7. Start the Server

#### Development mode (with auto-reload):
```bash
npm run dev
```

#### Production mode:
```bash
npm start
```

The server will start on http://localhost:3000

## Verify Setup

### Check Health Endpoint

Open http://localhost:3000/health in your browser. You should see:

```json
{
  "success": true,
  "message": "Trading Simulator API is running",
  "timestamp": "2025-10-17T...",
  "environment": "development"
}
```

### View Database in Prisma Studio

Prisma Studio is a GUI to view and edit your database:

```bash
npm run prisma:studio
```

This opens http://localhost:5555 where you can see all your tables and data.

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema (ORM models)
├── src/
│   ├── config/
│   │   └── database.js        # Prisma client instance
│   ├── controllers/           # Business logic (to be added)
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication middleware
│   │   └── errorHandler.js   # Global error handling
│   ├── routes/               # API routes (to be added)
│   ├── utils/                # Helper functions (to be added)
│   └── server.js             # Express server entry point
├── .env                       # Environment variables (DO NOT COMMIT)
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Available NPM Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server in production mode |
| `npm run dev` | Start server with auto-reload (nodemon) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |

## Database Schema

The database includes these tables:

- **users** - User accounts (email/password + OAuth)
- **portfolios** - User portfolios (cash, holdings, totals)
- **holdings** - Stock holdings per portfolio
- **trades** - Trade history with portfolio snapshots
- **ai_feedback** - AI-generated feedback for trades
- **conversations** - AI coach conversation threads
- **messages** - Individual messages in conversations
- **market_data_cache** - Cached stock prices (optional, can use Redis)

## Next Steps

After the server is running, the next tasks are:

1. ✅ Database schema created
2. ✅ Prisma ORM configured
3. ✅ Express server running
4. ⏳ Implement authentication endpoints (register, login)
5. ⏳ Implement portfolio endpoints
6. ⏳ Implement trading endpoints
7. ⏳ Implement AI coaching endpoints
8. ⏳ Connect frontend to backend

## Troubleshooting

### Database Connection Errors

If you see `P1001: Can't reach database server`:
- Check your DATABASE_URL is correct
- Verify your Supabase password is correct
- Ensure your IP is not blocked by Supabase (check Project Settings > Database > Connection Pooling)

### Prisma Generate Errors

If `prisma:generate` fails:
- Delete `node_modules/@prisma/client`
- Run `npm install` again
- Run `npm run prisma:generate` again

### Migration Errors

If migrations fail:
- Check your DATABASE_URL is valid
- Ensure you have internet connection
- Try resetting: Delete the `prisma/migrations` folder and run `prisma:migrate` again

## Support

For issues or questions:
- Check the main PRD: `../backend_prd.md`
- Review Prisma docs: https://www.prisma.io/docs
- Check Supabase docs: https://supabase.com/docs
