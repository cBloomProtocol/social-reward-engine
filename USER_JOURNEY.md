# User Journey - Social Reward Engine

## Overview

Social Reward Engine is an automated social reward system that incentivizes users who post high-quality content on X/Twitter.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                   │
└─────────────────────────────────────────────────────────────────────────┘

  User posts tweet @mentioning project account
         │
         ▼
  ┌─────────────────┐
  │   Fetcher       │  ← Runs every 3 minutes
  │   Crawl & Store │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   Scorer        │  ← Runs every 5 minutes
  │   LLM Analysis  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     Eligibility:
  │   Quality Check │  ← • qualityScore ≥ 80
  │   Eligible?     │     • aiLikelihood ≤ 30%
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
  Eligible    Not Eligible
     │           │
     ▼           ▼
  ┌─────────┐  ┌─────────┐
  │Claimable│  │   N/A   │
  └────┬────┘  └─────────┘
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │  Admin sees eligible post in Admin UI       │
  │  Copies Claim Link and sends to user        │
  │  Link: https://domain.com/claim/{tweetId}   │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  User clicks Claim Link                     │
  │  → Opens Claim UI page                      │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  User clicks "Sign in with Twitter"         │
  │  → Crossmint OAuth authentication           │
  │  → Smart Wallet auto-created                │
  │  → Wallet linked to Twitter ID              │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  User clicks "Claim Reward"                 │
  │  → Backend signs EIP-3009 authorization     │
  │  → Worker settles via CDP                   │
  │  → USDC transferred to user wallet          │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  Success!                                   │
  │  → Transaction hash displayed               │
  │  → Viewable on Basescan                     │
  └─────────────────────────────────────────────┘
```

## Detailed Steps

### 1. User Posts Tweet

User posts a tweet on X/Twitter mentioning the project's official account.

**Example:**
```
@BloomProtocol This project is amazing! The future of Web3 is here #crypto #web3
```

### 2. Automated Processing

| Stage | Frequency | Description |
|-------|-----------|-------------|
| Fetcher | Every 3 min | Crawls new mentions, stores in database |
| Scorer | Every 5 min | Evaluates content quality using LLM |

**Scoring Metrics:**
- `qualityScore`: Content quality score (0-100)
- `aiLikelihood`: AI-generated likelihood (0-100%)
- `spamScore`: Spam content score (0-100)

### 3. Eligibility Check

Posts must meet the following criteria to be eligible for rewards:

| Criteria | Threshold |
|----------|-----------|
| Quality Score | ≥ 80 |
| AI Likelihood | ≤ 30% |

### 4. Admin Sends Claim Link

Admin uses the Admin UI to view eligible posts:

1. Login to Admin UI (http://localhost:7201)
2. View "Eligible Posts" card
3. Click "Copy Link" to copy the Claim Link
4. Send to user via DM or other channels

**Claim Link Format:**
```
https://your-domain.com/claim/{tweetId}
```

### 5. User Claims Reward

1. **Click Link** - Opens Claim UI page
2. **View Reward** - Shows tweet content and reward amount
3. **Twitter Login** - Click "Sign in with Twitter"
4. **Wallet Creation** - Crossmint auto-creates Smart Wallet
5. **Confirm Claim** - Click "Claim Reward"
6. **Done** - USDC automatically transferred to wallet

### 6. Reward Distribution

| Item | Description |
|------|-------------|
| Token | USDC |
| Network | Base (Mainnet) |
| Amount Calculation | `baseAmount * (0.5 + qualityScore/100 * 0.5)` |
| Settlement | CDP (Coinbase Developer Platform) |

## Status Reference

| Status | Description |
|--------|-------------|
| `pending` | Eligible but not yet claimed |
| `processing` | Claim in progress |
| `paid` | Successfully claimed |
| `failed` | Claim failed |

## Important Notes

1. **Each post can only be claimed once** - Status changes to `paid` after claiming
2. **Must login with the posting account** - Wallet is linked to the logged-in Twitter ID
3. **Sufficient USDC required** - Project's payout wallet must have enough balance
4. **Gas fees handled by CDP** - Users don't need to pay gas fees

## Related Links

- Claim UI: http://localhost:3100/claim/{tweetId}
- Admin UI: http://localhost:7201
- Basescan: https://basescan.org
