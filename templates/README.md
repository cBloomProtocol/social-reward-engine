# LLM Scoring Templates

This directory contains template documentation for LLM scoring.

## Available Templates

| Template | Purpose |
|----------|---------|
| `scoring/quality-score` | Evaluate post quality, AI likelihood, and spam score |

## How Templates Work

Templates are configured in your external LLM service (e.g., llm-onCloud). This project calls the LLM service with a `templateName` parameter, and the LLM service uses the corresponding template to process the content.

## Template Configuration

### For llm-onCloud

1. Create template file in llm-onCloud:
   ```
   llm-onCloud/templates/scoring/quality-score.txt
   ```

2. Template content should include variable placeholders:
   - `{{CONTENT}}` - Automatically filled with post text
   - `{{AUTHOR_USERNAME}}` - Author's username

3. Configure parser as `json` to get structured output

## Using Custom Templates

To use a different template:

1. Create the template in your LLM service
2. Update the `templateName` in `llm-client.service.ts`:
   ```typescript
   const response = await this.process({
     content: text,
     templateName: 'your-custom-template',  // Change this
     parserName: 'json',
   });
   ```

## Response Format

All scoring templates should return JSON with these fields:

```typescript
interface ScoringResult {
  qualityScore: number;    // 0-100
  aiLikelihood: number;    // 0-100
  spamScore: number;       // 0-100
  reasoning?: string;      // Optional explanation
}
```
