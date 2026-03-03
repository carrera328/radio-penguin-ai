# Radio Penguin AI — Architecture Overview

## Repositories

| Repo | GitHub | Purpose | Hosting |
|------|--------|---------|---------|
| `radio-penguin-ai` | [carrera328/radio-penguin-ai](https://github.com/carrera328/radio-penguin-ai) | Main website + worker backups + docs | GitHub Pages (static HTML) |
| `taqueria-platform` | [carrera328/taqueria-platform](https://github.com/carrera328/taqueria-platform) | Multi-tenant client website platform | Cloudflare Worker |

## Services

### 1. Main Website (radiopenguin.ai)
- **Repo**: `radio-penguin-ai`
- **Hosting**: GitHub Pages, branch `master`
- **Domain**: `www.radiopenguin.ai` (CNAME → `carrera328.github.io`)
- **DNS**: Cloudflare (proxied), with bypass Workers Routes for `radiopenguin.ai/*` and `www.radiopenguin.ai/*`
- **Content**: Static HTML/CSS landing page with 5 service pathway pages
- **Chat widget**: Embedded JS that calls the `radio-penguin-chat` worker

### 2. Multi-Tenant Client Platform (taqueria-platform worker)
- **Repo**: `taqueria-platform`
- **Hosting**: Cloudflare Worker
- **Domains**: `*.onpenguin.com` (primary), `*.radiopenguin.ai` (legacy)
- **Deploy**: `npm run deploy` (uses Wrangler)
- **How it works**:
  1. Request hits `clientname.onpenguin.com`
  2. `resolveSlug()` extracts `clientname` from the hostname
  3. Looks up client config from `CLIENT_CONFIGS` KV namespace
  4. Renders a branded website from built-in templates + config data
  5. Chat widget on each client site calls Claude API for responses
- **KV Bindings**:
  - `CLIENT_CONFIGS` — JSON config per client (keyed by slug)
  - `RESPONSE_CACHE` — Cached chat responses (TTL 30min)
  - `SITE_TEMPLATES` — HTML templates (falls back to built-in)
- **Secrets** (set via `wrangler secret put`):
  - `CLAUDE_API_KEY` — Anthropic API key for client chatbots

### 3. AI Chat Widget (radio-penguin-chat worker)
- **Source backup**: `radio-penguin-ai/workers/radio-penguin-chat/worker.js`
- **Hosting**: Cloudflare Worker
- **URL**: `radio-penguin-chat.carrera-328.workers.dev`
- **Purpose**: Proxies chat requests from the main Radio Penguin website to Claude API
- **How it works**:
  1. Receives POST with user message from the website chat widget
  2. Includes a system prompt describing Radio Penguin's services
  3. Calls Claude API (streaming) and returns response
  4. Also sends lead notifications via Resend email API
  5. Logs leads to Notion database
- **Secrets**:
  - `ANTHROPIC_API_KEY` — Claude API key
  - `RESEND_API_KEY` — Transactional email service
  - `NOTION_API_KEY` — For lead tracking database

### 4. MCP Knowledge Base (radio-penguin-mcp worker)
- **Source backup**: `radio-penguin-ai/workers/radio-penguin-mcp/index.js`
- **Hosting**: Cloudflare Worker
- **URL**: `radio-penguin-mcp.carrera-328.workers.dev/mcp`
- **Purpose**: MCP (Model Context Protocol) server for Claude Code integration
- **How it works**:
  1. Exposes MCP tools: save/search prompts, clients, artifacts, notes
  2. Connected to D1 database for persistent storage
  3. Authenticated via Bearer token in request headers
- **D1 Database**: `radio-penguin-kb` (ID: `5506820f-6711-4b8e-b60a-8332601004e7`)
  - Tables: `prompts`, `clients`, `artifacts`, `notes`
- **Secrets**:
  - `AUTH_TOKEN` — Bearer token for MCP authentication

## How Services Interact

```
                    ┌─────────────────────────┐
                    │    www.radiopenguin.ai   │
                    │    (GitHub Pages)        │
                    │    Main marketing site   │
                    └───────────┬─────────────┘
                                │ Chat widget JS
                                ▼
                    ┌─────────────────────────┐
                    │  radio-penguin-chat      │
                    │  (Cloudflare Worker)     │
                    │  Chat proxy for main     │
                    │  site visitors           │
                    └───────────┬─────────────┘
                                │ Calls Claude API
                                │ Sends leads → Resend email
                                │ Logs leads → Notion
                                ▼
                    ┌─────────────────────────┐
                    │  Claude API (Anthropic)  │
                    └─────────────────────────┘
                                ▲
                                │ Also called by
                    ┌───────────┴─────────────┐
                    │  taqueria-platform       │
                    │  (Cloudflare Worker)     │
                    │  *.onpenguin.com         │
                    │  Multi-tenant client     │
                    │  websites                │
                    └───────────┬─────────────┘
                                │ Reads client config
                                ▼
                    ┌─────────────────────────┐
                    │  Cloudflare KV           │
                    │  CLIENT_CONFIGS          │
                    │  RESPONSE_CACHE          │
                    │  SITE_TEMPLATES          │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │  radio-penguin-mcp       │
                    │  (Cloudflare Worker)     │
                    │  MCP server for Claude   │
                    │  Code integration        │
                    └───────────┬─────────────┘
                                │ Reads/writes
                                ▼
                    ┌─────────────────────────┐
                    │  Cloudflare D1           │
                    │  radio-penguin-kb        │
                    │  (prompts, clients,      │
                    │   artifacts, notes)      │
                    └─────────────────────────┘
```

## Cloudflare Account
- **Email**: Carrera.328@gmail.com
- **Account ID**: `f90d224dfa1dd8b0e5781c37b97163fa`
- **Workers subdomain**: `carrera-328.workers.dev`
- **Plan**: Free

## Domains
- **radiopenguin.ai** — Main brand domain (Cloudflare DNS, full setup)
- **onpenguin.com** — Multi-tenant client platform domain (registered 2026-03-03, $10.46/yr)

## Deployment

| Service | How to deploy |
|---------|--------------|
| Main website | Push to `master` branch of `radio-penguin-ai` repo |
| taqueria-platform | `cd taqueria-platform && npm run deploy` |
| radio-penguin-chat | Cloudflare Dashboard (no local source repo yet) |
| radio-penguin-mcp | Cloudflare Dashboard (no local source repo yet) |

## Future Priorities
1. **Cloudflare for SaaS (Custom Hostnames)** — Allow clients to use their own domains (e.g., `miguelstacos.com`)
2. **Set up proper repos for chat and MCP workers** — Currently only bundled backups exist
3. **CI/CD** — Connect GitHub repos to Cloudflare for automatic deployments
4. **Remove legacy `*.radiopenguin.ai` wildcard route** — Once all clients migrated to onpenguin.com
