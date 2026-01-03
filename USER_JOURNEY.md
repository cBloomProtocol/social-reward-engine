# User Journeys - Social Reward Engine

## End User Journey

### How to Claim Your Reward

```
1. Receive Link  →  2. Connect Twitter  →  3. Claim  →  Done!
```

**Steps:**

1. **Receive Claim Link** - You'll receive a link like `https://domain.com/claim/123456`
2. **Open the Link** - Click the link to open the claim page
3. **Sign in with Twitter** - Click the button to connect your Twitter account
4. **Click "Claim Reward"** - Your USDC will be sent to your wallet automatically

That's it! No gas fees required.

---

## Ops Journey

### How to Process Rewards

```
1. Fetch Posts  →  2. Score Posts  →  3. Copy Link  →  4. Send to User
```

**Steps:**

1. **Open Admin UI** - Go to http://localhost:7201
2. **Click "Trigger Fetch"** - Fetches new posts from Twitter
3. **Click "Trigger Score"** - Scores posts using LLM
4. **Check Eligible Posts** - Look at the "Eligible Posts" card
5. **Copy Claim Link** - Click "Copy Link" for pending posts
6. **Send to User** - DM the link to the user

**Eligibility Criteria:**
- Quality Score ≥ 80
- AI Likelihood ≤ 30%

---

## Claim Status Reference

| Status | Meaning |
|--------|---------|
| pending | Ready to claim |
| processing | Claiming in progress |
| paid | Successfully claimed |
| failed | Claim failed |
