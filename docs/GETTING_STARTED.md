# Getting Started

This guide will help you set up Social Reward Engine from scratch.

## Prerequisites

1. **Node.js 20+** - [Download](https://nodejs.org/)
2. **Docker** (optional but recommended) - [Download](https://docker.com/)
3. **X/Twitter API Credentials** - [Developer Portal](https://developer.twitter.com/)

## Step 1: Clone the Repository

```bash
git clone https://github.com/cBloomProtocol/social-reward-engine.git
cd social-reward-engine
```

## Step 2: Get X/Twitter API Credentials

1. Go to [developer.twitter.com](https://developer.twitter.com/)
2. Create a project and app
3. Generate a Bearer Token
4. Note your User ID (you can find it at [tweeterid.com](https://tweeterid.com/))

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
MONGODB_URI=mongodb://localhost:27017/social_reward_engine
X_API_BEARER_TOKEN=your_bearer_token_here
X_API_USER_ID=your_user_id_here
```

## Step 4: Run with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

Access:
- **API**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3001

## Step 5: Run Locally (Alternative)

```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:7

# Install dependencies
npm install

# Start backend
npm run start:dev

# In another terminal, start admin UI
cd admin-ui
npm install
npm run dev
```

## Step 6: Verify Installation

1. Open Admin Dashboard at http://localhost:3001
2. You should see the dashboard with Pipeline Status cards
3. Click "Trigger Fetch" to manually fetch mentions

## Optional: Configure LLM Scoring

To enable AI-powered quality scoring:

1. Set up an LLM service (e.g., llm-onCloud)
2. Add to `.env`:
   ```env
   LLM_SERVICE_URL=https://your-llm-service.com
   LLM_API_KEY=your_api_key
   ```
3. Restart the service

## Optional: Configure X402 Payments

To enable blockchain payouts:

1. Get X402 gateway access
2. Add to `.env`:
   ```env
   X402_GATEWAY_URL=https://x402-gateway.example.com
   X402_NETWORK=bsc
   X402_PRIVATE_KEY=your_wallet_private_key
   ```
3. Restart the service

## Troubleshooting

### MongoDB Connection Failed

Make sure MongoDB is running:
```bash
docker ps | grep mongo
```

### X API Rate Limited

The system automatically handles rate limits with a 20-minute cooldown. Check the Fetcher status in the admin dashboard.

### LLM Service Not Responding

Verify your LLM service is accessible:
```bash
curl -X GET http://your-llm-service/llm/health
```

## Next Steps

- Customize reward rules in `.env`
- Set up LLM scoring templates
- Configure payment thresholds
- Deploy to production

See the main [README](../README.md) for full documentation.
