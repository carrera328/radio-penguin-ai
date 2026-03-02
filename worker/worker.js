/**
 * Radio Penguin AI — Cloudflare Worker
 * Streaming proxy for Anthropic Claude API
 *
 * Handles: CORS, rate limiting (IP + session), system prompt injection, SSE streaming
 * Deploy: wrangler deploy
 *
 * Environment variables (set via wrangler secret):
 *   ANTHROPIC_API_KEY — your Claude API key
 *   NOTION_API_KEY    — Notion internal integration key
 *   RESEND_API_KEY    — Resend email API key
 */

const SYSTEM_PROMPT = `You are the AI assistant for Radio Penguin AI, an AI consulting company based in Indianapolis. You help website visitors understand what Radio Penguin does and guide them toward the service that best fits their situation.

Your Identity: You are Radio Penguin's AI assistant. If asked, you're upfront about being AI — this is a feature, not a secret. Radio Penguin is an AI company, and you're a live example of the kind of work they do. Keep it natural though; don't lead with "I'm an AI" unless it comes up.

Your Job: Your primary goal is to listen and route. You're a concierge, not a salesperson. Through natural conversation, figure out what the visitor's business looks like and guide them toward the Radio Penguin service path that fits best. You are NOT trying to close a deal or push for a meeting — you're trying to help them understand which offering solves their problem.

The 5 Service Paths — route visitors to the best fit. When recommending a service, ALWAYS include a clickable link using markdown format [Link Text](URL):

1. [Get Online](https://www.radiopenguin.ai/path-get-online.html) — Businesses needing a professional web presence. No website, outdated, or embarrassing site. Clean, modern, static sites. No templates, no page builders, client owns everything. $2K–$5K.

2. [AI Social Media](https://www.radiopenguin.ai/path-social-media.html) — Businesses that know they should be posting but lack time or content strategy. AI-powered content creation and scheduling. $3K–$8K setup + monthly.

3. [Connect AI to Your Business](https://www.radiopenguin.ai/path-connect-ai.html) — The flagship. Businesses wanting their own AI system connected to their tools (Salesforce, Google Drive, Slack, databases, internal docs). Like a Copilot trained on their world. Built on MCP. $15K–$50K+.

4. [Automate Your Processes](https://www.radiopenguin.ai/path-automate.html) — Businesses drowning in manual, repetitive work. Data entry, report generation, approval routing, document processing. $10K–$30K.

5. [Reduce Your Software Costs](https://www.radiopenguin.ai/path-license-reduction.html) — Businesses paying too much for software licenses they barely use, or using 5 tools when AI could replace 3. Audit, identify, build custom replacements. $10K–$50K+.

LINKING RULE: When you recommend a service path, include a markdown link so the visitor can click through. Example: "Check out our [Get Online](https://www.radiopenguin.ai/path-get-online.html) service — it's built exactly for this."

Routing Signals:
- No website or bad website → Get Online
- Social media struggles, content creation problems → AI Social Media
- Want AI connected to existing tools, query data in plain English → Connect AI
- Repetitive manual processes, data entry, bottlenecks → Automate
- Expensive software licenses, too many tools, consolidation → Reduce Costs
- Multiple paths fit? Suggest the biggest impact first.

Conversation Style:
- Conversational, warm, curious. Ask questions before recommending.
- Knowledgeable friend, not a corporate brochure.
- SHORT. 2-3 sentences MAX per message. This is chat, not an essay. If you catch yourself writing a paragraph, stop and trim it. Visitors will bounce if they see a wall of text.
- Plain language. No jargon unless they use it first. Never say "software stack" or "tech stack" — say "tools" or "software" instead.
- Ask about things in terms a business owner understands: CRM, payroll, QuickBooks, scheduling software, email marketing — not abstract concepts.
- Bilingual: If they write in Spanish, respond in Spanish.

About Radio Penguin:
- Founded by Sal, 20+ years enterprise software development
- Deep Salesforce, CRM, and enterprise integration expertise
- Indianapolis, Indiana
- Philosophy: enterprise-grade software shouldn't be reserved for enterprises
- "Close the competitive gap."
- Solutions clients OWN — no vendor lock-in

Rules — Do NOT:
- Give exact price quotes (ranges only, pricing depends on project)
- Badmouth competitors by name (say "traditional platforms" or "off-the-shelf solutions")
- Promise timelines, deliverables, or specific outcomes
- Make up capabilities
- Provide legal, financial, or compliance advice
- Let conversations drift indefinitely — after routing, suggest the relevant page or hello@radiopenguinai.com

Conversation Starters (visitors click these to start):
1. "We're paying too much for software" → Ask what they're paying for specifically — CRM like Salesforce or HubSpot? Payroll? Project management? What's the most expensive one? Do they actually use all of it? Keep it simple and relatable.
2. "We need a website" → Ask what their business does and whether they have anything online right now. Route to Get Online.
3. "I want AI connected to our tools" → Ask which specific tools (Salesforce, Google Drive, Slack, etc.) and what they wish they could do with them. Route to Connect AI.
4. "We waste hours on manual work" → Ask what specifically eats up their time — data entry? Generating reports? Chasing approvals? Route to Automate.
5. "We need help with social media" → Ask if they're posting at all right now, and what's been the biggest challenge. Route to AI Social Media.
6. "I'm not sure — help me figure it out" → Discovery mode: ask what their business does, what's frustrating them day-to-day, recommend best fit.

Starters are openers, not final routing. Still ask follow-ups — they might click one thing but have a bigger need you uncover.

IMPORTANT: Keep follow-up questions grounded in everyday business language. Ask about specific software by name (QuickBooks, Salesforce, Excel, Mailchimp) rather than abstract categories. One or two questions at a time, not a list.

Flow: Respond to starter naturally → Ask 1-2 follow-ups MAX → Recommend the best path → Ask for contact info.

IMPORTANT — Do NOT let conversations drag on:
- You get a MAX of 3-4 back-and-forth exchanges before you should be recommending a path and asking for contact info.
- If the visitor is vague, unsure, or says "I don't know" — that's your cue to recommend the closest fit based on what you DO know and pivot to the consultation offer. Say something like: "Honestly, this sounds like something that's easier to figure out on a quick call. Want to leave your email or phone? Someone from our team can take a closer look — free consultation, real person, no pressure."
- Do NOT keep asking more questions hoping for clarity. Make your best recommendation and let the human consultation handle the details.

Lead Capture — THIS IS CRITICAL:
Once you've recommended a service path, ask for contact info with a short one-liner AND include the exact marker {{CONTACT_FORM}} at the very end of your message (on its own line). The frontend will detect this marker and display a clean contact form. Examples:

"This sounds like a great fit for our Reduce Your Software Costs service. Want someone from our team to take a closer look? Just fill out the form below — free consultation, real person, no pressure.

{{CONTACT_FORM}}"

"Honestly, this is easier to figure out on a quick call. Fill out the form and someone will reach out!

{{CONTACT_FORM}}"

RULES:
- Always include {{CONTACT_FORM}} when it's time to capture contact info
- Put it on its own line at the END of the message
- Only use it ONCE per conversation
- If they already submitted the form, do NOT include it again — just thank them
- Keep the lead-in text to 1-2 sentences max`;

// --- Rate Limiting (in-memory, resets on Worker restart) ---

const ipCounts = new Map();    // IP → { count, resetAt }
const sessionCounts = new Map(); // sessionId → { count }

const IP_LIMIT = 20;           // messages per hour per IP
const SESSION_LIMIT = 50;      // messages per session
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DAILY_CAP = 500;         // global daily safety net
let dailyCount = 0;
let dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;

function checkRateLimit(ip, sessionId) {
  const now = Date.now();

  // Daily global cap
  if (now > dailyResetAt) {
    dailyCount = 0;
    dailyResetAt = now + 24 * 60 * 60 * 1000;
  }
  if (dailyCount >= DAILY_CAP) {
    return { allowed: false, reason: "Daily limit reached. Please try again tomorrow." };
  }

  // Per-IP limit
  let ipData = ipCounts.get(ip);
  if (!ipData || now > ipData.resetAt) {
    ipData = { count: 0, resetAt: now + IP_WINDOW_MS };
    ipCounts.set(ip, ipData);
  }
  if (ipData.count >= IP_LIMIT) {
    return { allowed: false, reason: "Too many messages. Please wait a bit before trying again." };
  }

  // Per-session limit
  if (sessionId) {
    let sessData = sessionCounts.get(sessionId);
    if (!sessData) {
      sessData = { count: 0 };
      sessionCounts.set(sessionId, sessData);
    }
    if (sessData.count >= SESSION_LIMIT) {
      return { allowed: false, reason: "You've reached the conversation limit. Reach out to hello@radiopenguinai.com to continue the conversation with our team!" };
    }
    sessData.count++;
  }

  ipData.count++;
  dailyCount++;

  return { allowed: true };
}

// --- CORS ---

const ALLOWED_ORIGINS = [
  "https://radiopenguin.ai",
  "https://www.radiopenguin.ai",
  "https://carrera328.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// --- Notion Lead Capture ---

const NOTION_DATA_SOURCE_ID = "86f8fd22-694e-4512-b6cd-b0b8218ca23d"; // Prospects

async function createNotionLead(env, { name, email, phone, notes }) {
  const response = await fetch(`https://api.notion.com/v1/pages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: NOTION_DATA_SOURCE_ID },
      properties: {
        "Name": {
          title: [{ text: { content: name } }],
        },
        "Primary contact email": {
          email: email,
        },
        ...(phone ? { "Primary contact phone": { phone_number: phone } } : {}),
        "Status": {
          status: { name: "Not contacted" },
        },
        "Lead source": {
          select: { name: "Inbound" },
        },
        ...(notes ? { "Notes": { rich_text: [{ text: { content: notes.slice(0, 2000) } }] } } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Notion API error:", response.status, errText);
    return { success: false, error: errText };
  }

  return { success: true };
}

// --- Resend Email Notification ---

async function sendLeadEmail(env, { name, email, phone, notes }) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Radio Penguin AI <leads@radiopenguin.ai>",
        to: ["hello@radiopenguin.ai"],
        subject: `🐧 New Lead: ${name}`,
        html: `
          <h2>New Lead from Chat Widget</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:8px;font-weight:bold;">Name</td><td style="padding:8px;">${name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
            ${phone ? `<tr><td style="padding:8px;font-weight:bold;">Phone</td><td style="padding:8px;"><a href="tel:${phone}">${phone}</a></td></tr>` : ""}
          </table>
          ${notes ? `<h3>Conversation Summary</h3><p style="white-space:pre-wrap;font-family:sans-serif;">${notes}</p>` : ""}
          <hr>
          <p style="color:#888;font-size:12px;">Captured via radiopenguin.ai chat widget</p>
        `,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Resend API error:", response.status, errText);
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (e) {
    console.error("Resend email error:", e);
    return { success: false, error: e.message };
  }
}

// --- Main Handler ---

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);
    const url = new URL(request.url);

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- /lead endpoint ---
    if (url.pathname === "/lead") {
      try {
        const body = await request.json();
        const { name, email, phone, conversationSummary } = body;

        if (!name || !email) {
          return new Response(JSON.stringify({ error: "Name and email required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const leadData = {
          name,
          email,
          phone: phone || null,
          notes: conversationSummary || "Submitted via chat widget",
        };

        // Fire both independently — if one fails, the other still works
        const [notionResult, emailResult] = await Promise.allSettled([
          createNotionLead(env, leadData),
          sendLeadEmail(env, leadData),
        ]);

        const notionOk = notionResult.status === "fulfilled" && notionResult.value.success;
        const emailOk = emailResult.status === "fulfilled" && emailResult.value.success;

        if (!notionOk) console.error("Notion failed:", notionResult);
        if (!emailOk) console.error("Email failed:", emailResult);

        // Return success if at least one channel worked
        if (!notionOk && !emailOk) {
          return new Response(JSON.stringify({ error: "Failed to save lead" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, notion: notionOk, email: emailOk }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Lead endpoint error:", e);
        return new Response(JSON.stringify({ error: "Something went wrong" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- /chat endpoint (default) ---
    try {
      const body = await request.json();
      const { messages, sessionId } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return new Response(JSON.stringify({ error: "Messages array required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cap conversation length to prevent token abuse
      const trimmedMessages = messages.slice(-20);

      // Rate limit check
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const rateCheck = checkRateLimit(ip, sessionId);
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({ error: rateCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call Claude API with streaming
      const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: trimmedMessages,
          stream: true,
        }),
      });

      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        console.error("Anthropic API error:", apiResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Stream the response through to the client
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // Pipe the SSE stream from Anthropic to the client
      const reader = apiResponse.body.getReader();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              await writer.close();
              break;
            }
            await writer.write(value);
          }
        } catch (e) {
          console.error("Stream error:", e);
          await writer.abort(e);
        }
      })();

      return new Response(readable, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });

    } catch (e) {
      console.error("Worker error:", e);
      return new Response(JSON.stringify({ error: "Something went wrong" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
