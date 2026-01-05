# API Reference

## Posts & Claims

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts/:tweetId` | Get post info for claim page |
| POST | `/claim/:tweetId` | Claim reward for a post |
| GET | `/claim/:tweetId/status` | Get claim status |

## X402 Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/x402/user/:twitterId/wallet` | Get user's primary wallet |
| POST | `/x402/user/:twitterId/wallet` | Link wallet to Twitter ID |
| GET | `/x402/user/:twitterId/wallets` | Get all wallets for user |

## Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config/reward` | Get reward configuration |
| PUT | `/config/reward` | Update reward configuration |

## Fetcher

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fetcher/status` | Get fetcher status |
| POST | `/fetcher/trigger` | Manually trigger fetch |
| GET | `/fetcher/posts` | Get fetched posts |
| GET | `/fetcher/stats` | Get fetcher statistics |
| GET | `/fetcher/health` | Health check |

## Scorer

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scorer/status` | Get scorer status |
| POST | `/scorer/trigger` | Manually trigger scoring |
| POST | `/scorer/posts/:id/score` | Score specific post |
| GET | `/scorer/stats` | Get scorer statistics |
| GET | `/scorer/health` | Health check |

## Payout

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payout/status` | Get payout status |
| POST | `/payout/trigger` | Manually trigger payout |
| GET | `/payout/stats` | Get payout statistics |
| GET | `/payout/history` | Get payout history |
| GET | `/payout/health` | Health check |
