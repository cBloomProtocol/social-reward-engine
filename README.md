# Social Reward Engine

An automated social reward system that fetches social posts from X/Twitter, scores them using LLM, and pays users via X402 blockchain protocol.

## Features

- **X/Twitter Fetcher**: Built-in mentions crawler using X API v2
- **LLM Scoring**: Quality scoring with AI likelihood detection
- **X402 Payments**: Blockchain payouts via X402 protocol (BSC, Base, Solana)
- **Rules Engine**: Configurable reward eligibility rules
- **Admin Dashboard**: Real-time monitoring UI built with Next.js

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              SOCIAL REWARD ENGINE                           │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │  Fetcher  │→ │  Scorer   │→ │   Rules   │→ │  Payout  │ │
│  │  */3 min  │  │  */5 min  │  │  Engine   │  │ */10 min │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
│       ↓              ↓              ↓              ↓        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    MongoDB                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│  ┌────────────────────────┼────────────────────────┐       │
│  │                        │                        │       │
│  ▼                        ▼                        ▼       │
│  ┌───────────┐      ┌───────────┐      ┌───────────┐      │
│  │ LLM Client│      │X402 Client│      │Admin Panel│      │
│  │ (External)│      │ (External)│      │ (Next.js) │      │
│  └───────────┘      └───────────┘      └───────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB 7+
- X/Twitter API credentials ([Get here](https://developer.twitter.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/cBloomProtocol/social-reward-engine.git
cd social-reward-engine

# Install backend dependencies
npm install

# Install admin UI dependencies
cd admin-ui && npm install && cd ..

# Copy environment file
cp .env.example .env

# Configure your credentials in .env
```

### Running with Docker (Recommended)

```bash
# Start all services (API + Admin + MongoDB)
docker-compose up -d

# View logs
docker-compose logs -f app

# Access:
# - API: http://localhost:3000
# - Admin: http://localhost:3001
```

### Running Locally

```bash
# Start MongoDB (required)
docker run -d -p 27017:27017 mongo:7

# Start backend (development mode)
npm run start:dev

# Start admin UI (in another terminal)
cd admin-ui && npm run dev
```

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `X_API_BEARER_TOKEN` | X/Twitter API bearer token |
| `X_API_USER_ID` | Your X/Twitter user ID to monitor |

### Optional - LLM Scoring

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_SERVICE_URL` | External LLM service URL | - |
| `LLM_API_KEY` | LLM service API key | - |

### Optional - X402 Payments

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_GATEWAY_URL` | X402 payment gateway URL | - |
| `X402_NETWORK` | Blockchain network (bsc, base, solana) | bsc |
| `X402_PRIVATE_KEY` | Wallet private key for payments | - |

### Reward Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `REWARD_BASE_AMOUNT` | Base reward amount | 1.0 |
| `REWARD_TOKEN` | Token symbol | USDT |
| `REWARD_MIN_QUALITY_SCORE` | Minimum quality score for eligibility | 80 |
| `REWARD_MAX_AI_LIKELIHOOD` | Maximum AI likelihood allowed | 30 |

## API Endpoints

### Fetcher

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fetcher/status` | Get crawler status |
| POST | `/fetcher/trigger` | Trigger manual fetch |
| GET | `/fetcher/posts` | Get fetched posts |
| GET | `/fetcher/stats` | Get fetch statistics |

### Scorer

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scorer/status` | Get scorer status |
| POST | `/scorer/trigger` | Trigger manual scoring |
| POST | `/scorer/posts/:id/score` | Score specific post |
| GET | `/scorer/stats` | Get scoring statistics |
| GET | `/scorer/health` | Check LLM service health |

### Payout

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payout/status` | Get payout status |
| POST | `/payout/trigger` | Trigger manual payout |
| GET | `/payout/stats` | Get payout statistics |
| GET | `/payout/history` | Get payout history |
| GET | `/payout/health` | Check X402 service health |

## Pipeline Flow

### 1. Fetch (Every 3 minutes)
- Fetches new mentions from X API v2
- Uses `sinceId` for incremental fetching
- Handles rate limits with 20-minute cooldown

### 2. Score (Every 5 minutes)
- Sends unscored posts to LLM service
- Evaluates: quality score, AI likelihood, spam score
- Stores results in MongoDB

### 3. Payout (Every 10 minutes)
- Checks eligibility based on configured rules
- Queues eligible posts for payment
- Executes payments via X402 protocol

## Eligibility Rules

Posts are eligible for rewards when:
- `qualityScore >= REWARD_MIN_QUALITY_SCORE` (default: 80)
- `aiLikelihood <= REWARD_MAX_AI_LIKELIHOOD` (default: 30)
- Author has a linked wallet address

## Project Structure

```
social-reward-engine/
├── src/
│   ├── modules/
│   │   ├── fetcher/      # X API crawler
│   │   ├── scorer/       # LLM scoring
│   │   └── payout/       # X402 payments
│   ├── storage/          # MongoDB service
│   └── main.ts
├── admin-ui/             # Next.js admin dashboard
├── templates/            # LLM prompt templates
├── docker-compose.yml
└── Dockerfile
```

## External Services

### LLM Service (Optional)
Compatible with any LLM API that accepts:
```json
POST /llm/process
{
  "content": "Post text",
  "templateName": "scoring/quality-score",
  "parserName": "json"
}
```

### X402 Payment (Optional)
Uses the X402 HTTP payment protocol for blockchain transactions.
Supported networks: BSC, Base, Solana

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [X402 Protocol](https://x402.org)
- [X API Documentation](https://developer.twitter.com/en/docs)
- [Bloom Protocol](https://bloomprotocol.ai)
