# Social Reward Engine

An automated social reward system that fetches social posts from X/Twitter, scores them using LLM, and pays users via X402 protocol on Base network.

## Features

### Core
- **x402 Payments**: USDC payouts via Coinbase-hosted facilitator service
- **Seamless user onboarding**: Reliable service from the Crossmint - Embedded Wallet to enable X/Twitter OAuth login with wallet creation
- **LLM Scoring**: Quality scoring with AI likelihood detection

### Includes
- **Claim UI**: User-facing claim page with wallet management
- **Admin Dashboard**: Real-time monitoring UI with reward configuration
- **X/Twitter Fetcher**: Built-in mentions crawler using X API v2

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOCIAL REWARD ENGINE                          │
│                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────┐  │
│  │  Fetcher  │→ │  Scorer   │→ │   Rules   │→ │    Payout    │  │
│  │  */3 min  │  │  */5 min  │  │  Engine   │  │   */10 min   │  │
│  └───────────┘  └───────────┘  └───────────┘  └──────────────┘  │
│       ↓              ↓              ↓               ↓           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                       MongoDB                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────┐      │
│  │                           │                           │      │
│  ▼                           ▼                           ▼      │
│  ┌───────────┐      ┌───────────────┐      ┌───────────────┐   │
│  │LLM Client │      │ X402 Worker   │      │  Admin Panel  │   │
│  │ (External)│      │ (Cloudflare)  │      │   (Next.js)   │   │
│  └───────────┘      └───────────────┘      └───────────────┘   │
│                            │                                    │
│                            ▼                                    │
│                     ┌─────────────┐                             │
│                     │  CDP / Base │                             │
│                     │   Network   │                             │
│                     └─────────────┘                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        CLAIM FLOW                                │
│                                                                  │
│  User clicks claim link → Claim UI → Login with Twitter         │
│       → Crossmint creates wallet → Wallet linked to Twitter ID  │
│       → Claim reward → Backend signs EIP-3009 payment           │
│       → Worker settles via CDP → USDC sent to user wallet       │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- MongoDB 7+
- X/Twitter API credentials ([X Developer Platform](https://developer.x.com/en))
- CDP API credentials ([Coinbase Developer Platform](https://portal.cdp.coinbase.com))
- Crossmint API key ([Crossmint Console](https://www.crossmint.com/signin?callbackUrl=/console))

### Installation

```bash
# Clone the repository
git clone https://github.com/cBloomProtocol/social-reward-engine.git
cd social-reward-engine

# Install backend dependencies
npm install

# Install claim UI dependencies
cd claim-ui && npm install && cd ..

# Install admin UI dependencies
cd admin-ui && npm install && cd ..

# Install worker dependencies
cd worker && npm install && cd ..

# Copy environment files
cp .env.example .env
cp claim-ui/.env.example claim-ui/.env.local
```

### Running Locally

```bash
# Terminal 1: Start MongoDB
docker run -d -p 27017:27017 mongo:7

# Terminal 2: Start backend (port 7200)
npm run start:dev

# Terminal 3: Start claim UI (port 3100)
cd claim-ui && npm run dev

# Terminal 4: Start admin UI (port 7201)
cd admin-ui && npm run dev

# Terminal 5: Start X402 worker (port 8787)
cd worker && npm run dev
```

## Configuration

### Backend Environment Variables (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 7200) | No |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `X_API_BEARER_TOKEN` | X/Twitter API bearer token | Yes |
| `X_API_USER_ID` | X/Twitter user ID to monitor | Yes |
| `LLM_SERVICE_URL` | External LLM service URL | Yes |
| `LLM_API_KEY` | LLM API key | Yes |
| `LLM_PROVIDER` | LLM provider: `anthropic`, `openai`, `deepseek`, `gemini` | No |
| `X402_WORKER_URL` | X402 worker URL (e.g., http://localhost:8787) | Yes |
| `X402_NETWORK` | Network: `base` or `base-sepolia` | Yes |
| `X402_EVM_PRIVATE_KEY` | Payer wallet private key | Yes |
| `SCORER_ITEM_DELAY` | Delay between scoring posts in ms (default: 1000) | No |

### Reward Configuration (Admin UI)

Reward settings are managed through the Admin Dashboard and stored in MongoDB.

| Setting | Description | Default |
|---------|-------------|---------|
| Base Amount | Base reward amount in USDC | 1.0 |
| Token | Token type | USDC |
| Min Quality Score | Minimum quality score for eligibility | 80 |
| Max AI Likelihood | Maximum AI likelihood for eligibility | 30 |

**Eligibility Criteria:**
- Quality Score ≥ Min Quality Score
- AI Likelihood ≤ Max AI Likelihood

**Reward Calculation:**
```
amount = baseAmount × (0.5 + qualityScore/100 × 0.5)
```

| Quality Score | Amount (base=1.0) |
|---------------|-------------------|
| 100 | 1.00 USDC |
| 90 | 0.95 USDC |
| 80 | 0.90 USDC |

### Claim UI Environment Variables (claim-ui/.env.local)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_CROSSMINT_API_KEY` | Crossmint API key |
| `NEXT_PUBLIC_NETWORK` | Network: `base` or `base-sepolia` |

### Worker Environment Variables (worker/.dev.vars)

Create `worker/.dev.vars` manually:

| Variable | Description |
|----------|-------------|
| `CDP_API_KEY_ID` | CDP API key ID |
| `CDP_API_KEY_SECRET` | CDP API key secret (Ed25519) |
| `BACKEND_API_URL` | Backend API URL |
| `NETWORK` | Network: `base` or `base-sepolia` |
| `API_KEY` | API key for backend authentication |

## API Endpoints

### Posts & Claims

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts/:tweetId` | Get post info for claim page |
| POST | `/claim/:tweetId` | Claim reward for a post |
| GET | `/claim/:tweetId/status` | Get claim status |

### X402 Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/x402/user/:twitterId/wallet` | Get user's primary wallet |
| POST | `/x402/user/:twitterId/wallet` | Link wallet to Twitter ID |
| GET | `/x402/user/:twitterId/wallets` | Get all wallets for user |

### Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config/reward` | Get reward configuration |
| PUT | `/config/reward` | Update reward configuration |

### Fetcher

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fetcher/status` | Get fetcher status |
| POST | `/fetcher/trigger` | Manually trigger fetch |
| GET | `/fetcher/posts` | Get fetched posts |
| GET | `/fetcher/stats` | Get fetcher statistics |
| GET | `/fetcher/health` | Health check |

### Scorer

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scorer/status` | Get scorer status |
| POST | `/scorer/trigger` | Manually trigger scoring |
| POST | `/scorer/posts/:id/score` | Score specific post |
| GET | `/scorer/stats` | Get scorer statistics |
| GET | `/scorer/health` | Health check |

### Payout

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payout/status` | Get payout status |
| POST | `/payout/trigger` | Manually trigger payout |
| GET | `/payout/stats` | Get payout statistics |
| GET | `/payout/history` | Get payout history |
| GET | `/payout/health` | Health check |

## Claim Flow

1. User receives a claim link: `https://your-domain.com/claim/{tweetId}`
2. User opens the claim page and clicks "Sign in with Twitter"
3. Crossmint authenticates user and creates a smart wallet
4. Wallet address is linked to user's Twitter ID
5. User clicks "Claim Reward"
6. Backend creates EIP-3009 TransferWithAuthorization signature
7. Worker settles payment via CDP
8. USDC is transferred to user's wallet on Base

## Project Structure

```
social-reward-engine/
├── src/
│   ├── modules/
│   │   ├── admin/        # Admin API endpoints
│   │   ├── config/       # Reward configuration
│   │   ├── fetcher/      # X API crawler
│   │   ├── payout/       # X402 payment client
│   │   ├── pipeline/     # Pipeline orchestration
│   │   ├── posts/        # Posts & claims controller
│   │   ├── scorer/       # LLM scoring
│   │   └── x402/         # Wallet linking service
│   ├── storage/          # MongoDB service
│   └── main.ts
├── admin-ui/             # Next.js admin dashboard
├── claim-ui/             # Next.js user claim page
│   ├── app/claim/        # Claim page route
│   ├── app/wallet/       # Wallet management page
│   └── components/       # Crossmint providers
├── worker/               # Cloudflare Worker for X402
│   └── src/index.ts      # CDP payment settlement
├── templates/            # LLM prompt templates
└── docker-compose.yml
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [X402 Protocol](https://x402.org)
- [CDP Documentation](https://docs.cdp.coinbase.com)
- [Crossmint Documentation](https://docs.crossmint.com)
- [Bloom Protocol](https://bloomprotocol.ai)
