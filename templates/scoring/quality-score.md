# Quality Score Template

This template is used to evaluate social media posts for reward eligibility.

## Template Name
`scoring/quality-score`

## Input Variables
- `CONTENT` - The post text content (automatically provided)
- `AUTHOR_USERNAME` - The author's username

## Expected Output Format (JSON)
```json
{
  "qualityScore": 85,
  "aiLikelihood": 15,
  "spamScore": 5,
  "reasoning": "Brief explanation of the scores"
}
```

## Scoring Criteria

### Quality Score (0-100)
- **90-100**: Exceptional - Original insights, valuable contribution
- **70-89**: Good - Relevant, well-written, adds value
- **50-69**: Average - Basic engagement, acceptable
- **30-49**: Low - Generic, minimal effort
- **0-29**: Poor - Off-topic, irrelevant, or harmful

### AI Likelihood (0-100)
- **0-20**: Very likely human-written
- **21-40**: Probably human-written
- **41-60**: Uncertain
- **61-80**: Probably AI-generated
- **81-100**: Very likely AI-generated

### Spam Score (0-100)
- **0-20**: Not spam
- **21-40**: Slightly promotional
- **41-60**: Moderately promotional
- **61-80**: Likely spam
- **81-100**: Definite spam

---

## Sample Prompt (for LLM service configuration)

```
You are evaluating a social media post for a reward program.

Analyze the following post and provide scores:

Author: @{{AUTHOR_USERNAME}}
Content: {{CONTENT}}

Evaluate and respond with JSON only:
{
  "qualityScore": <0-100, higher is better quality>,
  "aiLikelihood": <0-100, higher means more likely AI-generated>,
  "spamScore": <0-100, higher means more likely spam>,
  "reasoning": "<brief explanation>"
}

Consider:
1. Quality: Is the content original, insightful, and valuable?
2. AI Detection: Does it show signs of AI generation (generic phrases, perfect grammar without personality)?
3. Spam: Is it promotional, repetitive, or low-effort engagement farming?

Respond with valid JSON only, no markdown.
```
