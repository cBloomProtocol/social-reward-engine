# User Journeys - Social Reward Engine

## User Journey

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

## Ops Manual

### How to Process Rewards

```
1. Check Eligible Posts  →  2. Click "Send"  →  3. Reply with Link
```

**Automatic:** Posts are fetched and scored automatically every 5 minutes.

**Steps:**

1. **Open Admin UI** - Go to http://localhost:7201
2. **Check Eligible Posts** - View posts that meet reward criteria
3. **Click "Send reward claim link to author"** - Copies link + opens user's X post
4. **Reply** - Paste the claim link as a reply

**Actions in Eligible Posts:**
- **Copy claim link** - Just copy the link
- **Send reward claim link to author** - Copy link + auto-open X post to reply

---

## Claim Status Reference

| Status | Meaning |
|--------|---------|
| pending | Ready to claim |
| processing | Claiming in progress |
| paid | Successfully claimed |
| failed | Claim failed |
