# Social Reward Engine

An automated social reward system that fetches social posts from X/Twitter, scores them using LLM, and pays users via X402 protocol.


https://github.com/user-attachments/assets/b1ef1067-9b77-4bce-8baf-6cb0feb59cab


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

**Runtime**
- Node.js 20+
- MongoDB 8+

**API Keys**
- [X Developer Platform](https://developer.x.com/en) - for fetching mentions
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) - for X402 payments
- [Crossmint](https://www.crossmint.com/signin?callbackUrl=/console) - for embedded wallets

LLM scoring is included with a public API key (see `.env.example`). 
Limits: 50 req/min, 1000 req/day. Need more? [Request here](https://github.com/cBloomProtocol/social-reward-engine/issues/new?template=llm-api-key-request.yml).

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
docker run -d -p 27017:27017 mongo:8

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

See `.env.example` files in each directory for configuration options.

| Component | Config File | Required Keys |
|-----------|-------------|---------------|
| Backend | `.env` | `MONGODB_URI`, `X_API_BEARER_TOKEN`, `LLM_API_KEY`, `X402_EVM_PRIVATE_KEY` |
| Worker | `worker/.dev.vars` | `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` |
| Claim UI | `claim-ui/.env.local` | `NEXT_PUBLIC_CROSSMINT_API_KEY` |

Reward settings are managed via Admin Dashboard at `http://localhost:7201`.

## Documentation

- [API Reference](API.md) - Full endpoint documentation
- [User Journey](USER_JOURNEY.md) - User claim flow and ops manual

## Claim Flow

1. User receives a claim link: `https://your-domain.com/claim/{tweetId}`
2. User opens the claim page and clicks "Sign in with Twitter"
3. **Crossmint** authenticates user and creates a smart wallet
4. Wallet address is linked to user's Twitter ID
5. User clicks "Claim Reward"
6. Backend creates EIP-3009 TransferWithAuthorization signature
7. Worker settles payment via **Coinbase hosted x402 facilitator**
8. USDC is transferred to user's wallet on **Base network**

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
