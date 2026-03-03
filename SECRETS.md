# Radio Penguin — Secrets & Credentials Reference

> **WARNING**: This file documents WHERE secrets are used. Actual values should be stored in a vault.
> Do NOT commit actual secret values to this file.

## Cloudflare Account
- **Email**: Carrera.328@gmail.com
- **Account ID**: `f90d224dfa1dd8b0e5781c37b97163fa`
- **Workers subdomain**: `carrera-328.workers.dev`
- **Wrangler OAuth**: Stored at `~/Library/Preferences/.wrangler/config/default.toml`

## API Keys

### Anthropic (Claude API)
- **Used by**: `taqueria-platform` worker (as `CLAUDE_API_KEY`), `radio-penguin-chat` worker (as `ANTHROPIC_API_KEY`)
- **Set via**: `wrangler secret put CLAUDE_API_KEY` / Cloudflare Dashboard
- **Dashboard**: https://console.anthropic.com/
- **Value**: `[STORE IN VAULT]`

### Resend (Transactional Email)
- **Used by**: `radio-penguin-chat` worker (as `RESEND_API_KEY`)
- **Purpose**: Sends lead notification emails to hello@radiopenguin.ai
- **Dashboard**: https://resend.com/
- **Value**: `[STORE IN VAULT]`

### Notion
- **Used by**: `radio-penguin-chat` worker (as `NOTION_API_KEY`)
- **Purpose**: Logs leads to Notion database
- **Dashboard**: https://www.notion.so/my-integrations
- **Value**: `[STORE IN VAULT]`

## MCP Server Auth
- **Used by**: `radio-penguin-mcp` worker
- **Token**: `[STORE IN VAULT]`
- **Referenced in**: `.mcp.json` (Authorization Bearer header)
- **Note**: This token is currently in `.mcp.json` in the repo — move to vault

## KV Namespace IDs

| Namespace | ID | Used by |
|-----------|----|---------|
| CLIENT_CONFIGS | `edd960f0f13242308a6752c1b6d42352` | taqueria-platform |
| CLIENT_CONFIGS (preview) | `f660aa7384444c0ea54a0abff247d66c` | taqueria-platform |
| RESPONSE_CACHE | `c5794239a40c4320882a7a90246b1f96` | taqueria-platform |
| RESPONSE_CACHE (preview) | `2780501eb6114a1b8a7e5b31748f5439` | taqueria-platform |
| SITE_TEMPLATES | `214a02d6c527443390f574733779d272` | taqueria-platform |
| SITE_TEMPLATES (preview) | `b154d14b550f4fc585f7bd7de82e7ca0` | taqueria-platform |

## D1 Database
- **Name**: `radio-penguin-kb`
- **ID**: `5506820f-6711-4b8e-b60a-8332601004e7`
- **Used by**: `radio-penguin-mcp` worker

## Domain Registrar
- **radiopenguin.ai**: Registered via Cloudflare
- **onpenguin.com**: Registered via Cloudflare ($10.46/yr, expires 2027-03-03)

## Email
- **Provider**: Spacemail (for MX/receiving)
- **Transactional**: Resend (for sending lead notifications)
- **Address**: hello@radiopenguin.ai

## GitHub
- **Account**: carrera328
- **Repos**: radio-penguin-ai, taqueria-platform

## Checklist — Move to Vault
- [ ] Anthropic API Key (used in 2 workers)
- [ ] Resend API Key
- [ ] Notion API Key
- [ ] MCP Auth Token (currently hardcoded in `.mcp.json`)
- [ ] Wrangler OAuth tokens (in `~/Library/Preferences/.wrangler/config/default.toml`)
