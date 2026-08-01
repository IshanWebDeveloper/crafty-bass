# Crafty Bass AI Service

Python FastAPI application for running LangChain and LangGraph workflows against either the Anthropic Claude API or the OpenAI Platform inside this Nx monorepo.

## What It Includes

- `POST /api/v1/assistant/chat` for local chat completions
- `POST /api/v1/assistant/classify-job` for Crafty Bass job classification
- `GET /api/v1/assistant/info` to inspect the configured LLM provider and model
- `GET /api/v1/health` for a lightweight readiness check

## Local Setup

1. Create a virtual environment in this app folder:

   ```powershell
   cd apps/ai-service
   py -3.11 -m venv .venv
   ```

2. Install the dependencies:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install --upgrade pip
   .\.venv\Scripts\python.exe -m pip install -e .[dev]
   ```

3. Copy the environment file and set credentials for your chosen provider:

   ```powershell
   Copy-Item .env.example .env
   ```

   - `LLM_PROVIDER=anthropic` (default): set `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL` (defaults to `claude-haiku-4-5`).
   - `LLM_PROVIDER=openai`: set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` / `OPENAI_BASE_URL`.

   `LLM_MAX_TOKENS` (default `4096`) caps output on every request. Raise it if long
   chat or translation replies come back truncated.

4. Start the app through Nx from the workspace root:

   ```powershell
   pnpm nx run ai-service:dev
   ```

## Example Requests

Chat with the configured model:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8006/api/v1/assistant/chat `
  -ContentType 'application/json' `
  -Body '{"message":"Summarize why Crafty Bass benefits from a local AI service."}'
```

Classify a job using your marketplace taxonomy:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8006/api/v1/assistant/classify-job `
  -ContentType 'application/json' `
  -Body '{
    "title": "Kitchen sink is leaking",
    "description": "Water keeps dripping under the cabinet and the pipe may be cracked.",
    "language": "EN",
    "categories": [
      { "slug": "plumbing", "name": "Plumbing" },
      { "slug": "electrical", "name": "Electrical" }
    ],
    "skills": [
      { "slug": "pipe-repair", "name": "Pipe Repair", "category_slug": "plumbing" },
      { "slug": "leak-detection", "name": "Leak Detection", "category_slug": "plumbing" }
    ]
  }'
```

## Nx Targets

- `pnpm nx run ai-service:dev`
- `pnpm nx run ai-service:start`
- `pnpm nx run ai-service:build`
- `pnpm nx run ai-service:lint`
- `pnpm nx run ai-service:test`
