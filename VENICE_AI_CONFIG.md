# Venice AI Configuration for Lyn AI

## Current Setup

### AI Model
- **Provider**: Venice AI (https://venice.ai)
- **Model**: `llama-3.3-70b` (Venice's most capable model)
- **API Key**: Set in `.env.local` as `VENICE_API_KEY`

### System Prompt
```
I'm Lyn, your AI space agent. I specialize in cybersecurity and protecting users from online threats in the digital space.
```

### Fine-Tuned Model Note
Your custom fine-tuned OpenAI model `ft:gpt-4.1-2025-04-14:tems:lynai:C5Q4XfMn` is not available through Venice AI as Venice only supports routing to standard OpenAI models, not custom fine-tuned ones.

## Options for Using Your Fine-Tuned Model

### Option 1: Direct OpenAI Integration
To use your fine-tuned model directly with OpenAI:
1. Add `OPENAI_API_KEY` to `.env.local`
2. Create a separate service file for OpenAI
3. Use OpenAI for chat responses while using Venice for other features

### Option 2: Hybrid Approach
- Use Venice AI for general responses with Lyn AI personality
- Use OpenAI directly for specialized responses that need the fine-tuned model
- Switch between providers based on the task

### Option 3: Venice AI Only (Current)
- Use Venice AI with `llama-3.3-70b` model
- Apply Lyn AI personality through system prompts
- Benefits: Privacy-focused, uncensored responses, lower cost

## Current Implementation

The system is configured to:
1. Use Venice AI's `llama-3.3-70b` model for all AI responses
2. Apply the Lyn AI space agent personality through system prompts
3. Maintain all security scanning capabilities (URL analysis, file scanning)
4. Provide fallback responses when API is unavailable

## Response Times
- Simple queries: 2-3 seconds
- Complex responses: 10-12 seconds
- URL detection: < 1 second (uses pattern matching)

## API Usage
- Balance visible in response headers: `x-venice-balance-vcu`
- Rate limits: 50 requests per period
- Token limits: 750,000 tokens per period

## Testing
Test the integration with:
```bash
curl -X POST http://localhost:3002/api/security/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Lyn", "sessionId": "test"}'
```