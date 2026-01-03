# User Journey - Social Reward Engine

## Overview

Social Reward Engine 是一個自動化社交獎勵系統，用於獎勵在 X/Twitter 上發布高質量內容的用戶。

## 流程圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                   │
└─────────────────────────────────────────────────────────────────────────┘

  用戶發推文 @mention 項目帳號
         │
         ▼
  ┌─────────────────┐
  │   Fetcher 爬取   │  ← 每 3 分鐘自動執行
  │   存入 MongoDB   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   Scorer 評分    │  ← 每 5 分鐘自動執行
  │   LLM 質量分析   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     達標條件：
  │   質量評估       │  ← • qualityScore ≥ 80
  │   是否達標？     │     • aiLikelihood ≤ 30%
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
    達標        未達標
     │           │
     ▼           ▼
  ┌─────────┐  ┌─────────┐
  │ 可領取   │  │ 不可領取 │
  └────┬────┘  └─────────┘
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │  項目方在 Admin UI 看到達標 Post             │
  │  複製 Claim Link 發送給用戶                  │
  │  Link: https://domain.com/claim/{tweetId}   │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  用戶點擊 Claim Link                         │
  │  → 打開 Claim UI 頁面                        │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  用戶點擊 "Sign in with Twitter"             │
  │  → Crossmint OAuth 驗證                      │
  │  → 自動創建 Smart Wallet                     │
  │  → 錢包地址綁定到 Twitter ID                 │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  用戶點擊 "Claim Reward"                     │
  │  → Backend 簽署 EIP-3009 支付授權            │
  │  → Worker 通過 CDP 結算                      │
  │  → USDC 轉入用戶錢包                         │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────┐
  │  領取成功！                                  │
  │  → 顯示交易 Hash                             │
  │  → 可在 Basescan 查看交易                    │
  └─────────────────────────────────────────────┘
```

## 詳細步驟

### 1. 用戶發布推文

用戶在 X/Twitter 上發布推文並 @mention 項目的官方帳號。

**示例：**
```
@BloomProtocol 這個項目太棒了！Web3 的未來在這裡 #crypto #web3
```

### 2. 系統自動處理

| 階段 | 頻率 | 說明 |
|------|------|------|
| Fetcher | 每 3 分鐘 | 爬取新的 mentions，存入資料庫 |
| Scorer | 每 5 分鐘 | 使用 LLM 評估內容質量 |

**評分指標：**
- `qualityScore`: 內容質量分數 (0-100)
- `aiLikelihood`: AI 生成可能性 (0-100%)
- `spamScore`: 垃圾內容分數 (0-100)

### 3. 達標判定

Post 需要滿足以下條件才能領取獎勵：

| 條件 | 閾值 |
|------|------|
| Quality Score | ≥ 80 |
| AI Likelihood | ≤ 30% |

### 4. 項目方發送 Claim Link

項目方通過 Admin UI 查看達標的 Posts：

1. 登入 Admin UI (http://localhost:7201)
2. 查看 "Eligible Posts" 卡片
3. 點擊 "Copy Link" 複製 Claim Link
4. 通過 DM 或其他方式發送給用戶

**Claim Link 格式：**
```
https://your-domain.com/claim/{tweetId}
```

### 5. 用戶領取獎勵

1. **點擊 Link** - 打開 Claim UI 頁面
2. **查看獎勵** - 顯示推文內容和獎勵金額
3. **Twitter 登入** - 點擊 "Sign in with Twitter"
4. **錢包創建** - Crossmint 自動創建 Smart Wallet
5. **確認領取** - 點擊 "Claim Reward"
6. **完成** - USDC 自動轉入錢包

### 6. 獎勵發放

| 項目 | 說明 |
|------|------|
| 代幣 | USDC |
| 網路 | Base (Mainnet) |
| 金額計算 | `baseAmount * (0.5 + qualityScore/100 * 0.5)` |
| 結算方式 | CDP (Coinbase Developer Platform) |

## 狀態說明

| 狀態 | 說明 |
|------|------|
| `pending` | 達標但尚未領取 |
| `processing` | 領取處理中 |
| `paid` | 已成功領取 |
| `failed` | 領取失敗 |

## 注意事項

1. **每個 Post 只能領取一次** - 領取後狀態變為 `paid`
2. **必須使用發文帳號登入** - 錢包會綁定到登入的 Twitter ID
3. **需要有足夠的 USDC** - 項目方的發款錢包需要有足夠餘額
4. **Gas 費由 CDP 處理** - 用戶不需要支付 Gas 費

## 相關連結

- Claim UI: http://localhost:3100/claim/{tweetId}
- Admin UI: http://localhost:7201
- Basescan: https://basescan.org
