# Answers Insights — Qlik Sense Extension (POC v0.1)

Generates natural-language insight text on the sheet using the **Qlik Cloud
Assistants API** (`/api/v1/cloud-assistants`). No API key required.

---

## Authentication — how it works without an API key

When a Qlik Sense extension runs in the browser, it is served from the same
origin as the tenant (e.g. `https://your-tenant.us.qlikcloud.com`). That means:

1. **Session cookie** — the browser automatically attaches the user's Qlik Cloud
   login cookie to every same-origin `fetch` call. No Bearer token or API key
   is needed; the user's existing login session is the credential.

2. **CSRF token** — Qlik Cloud requires a CSRF token on same-origin POSTs.
   The CSRF cookie is **not** readable from JavaScript, so the extension
   follows Qlik's documented flow: it calls `GET /api/v1/csrf-token` (which
   authenticates off the interactive session — no API key) and reads the
   token from the `qlik-csrf-token` **response header**, then echoes it back
   as the `qlik-csrf-token` **request header** on every POST. The token is
   cached per object. This is handled automatically — the app builder does
   nothing. Ref: <https://qlik.dev/apis/rest/csrf-token/>

The combination of these two means the extension works for anyone who is already
logged in to the tenant, with zero additional credential setup.

---

## API flow

```
Step 0 — get the CSRF token (cached after first call)
  GET /api/v1/csrf-token
  → response header: qlik-csrf-token: <token>

Step 1 — create a thread (once per refresh)
  POST /api/v1/cloud-assistants/threads
  headers: { qlik-csrf-token: <from cookie> }
  body: {
    name: "answers-insights-<ts>",
    context: { type: "app", id: "<appId>", data: { mode:"live", route:"answers", custom:true } },
    messages: []
  }
  → { id: "<threadId>" }

Step 2 — invoke with the composed prompt
  POST /api/v1/cloud-assistants/<threadId>/actions/invoke
  headers: { qlik-csrf-token: <from cookie>, Accept: "text/event-stream, application/json" }
  body: {
    context: { type:"app", id:"<appId>", data:{ mode:"live", route:"answers", custom:true } },
    content: [{ text: "<composed prompt>" }]
  }
  → JSON (Adaptive Card)
```

**Verified against a live tenant (June 2026):** the invoke call is
**synchronous** — it returns `application/json` (status 201) after the agent
finishes, which can take up to ~1 minute. There is no SSE streaming for the
`answers` route, so the UI shows a skeleton + "Generating…" note during the wait.

The answer arrives as an **Adaptive Card**, not plain text:

```
{ "content": [ { "card": { "body": [
    { "type":"TextBlock", "weight":"bolder", "text":"Conclusion" },
    { "type":"TextBlock", "text":"This app contains ...<citation ...>1</citation>" },
    { "type":"ActionSet", ... },
    { "type":"Container", "id":"detailsSection", "isVisible":false, "items":[...] }
] } } ], "summary": "<internal agent meta-text — not displayed>" }
```

The extension walks the card, collects **visible** TextBlocks (skipping the
hidden `detailsSection` and action buttons), bolds headings, and strips
`<citation>` tags. The top-level `summary` field is internal agent reasoning
and is intentionally ignored. A `text/event-stream` branch is still present as
a fallback in case a future route streams, but the `answers` route does not.

---

## Files

| File | Purpose |
|------|---------|
| `answers-insights.qext` | Extension metadata |
| `answers-insights.js`   | Main extension — paint, auth, API calls, streaming |
| `properties.js`         | Config panel (Prompt, Questions, Data Context, API Settings) |
| `answers-insights.css`  | Shimmer skeleton, streaming cursor, error states |

---

## Installation

1. Zip the entire folder → `answers-insights.zip`
2. Qlik Cloud Management Console → **Extensions** → **Add** → upload the zip
3. Open any app → Edit sheet → drag **Answers Insights** onto the canvas
4. Configure in the properties panel → click **Refresh**

---

## Config panel

### Prompt & Narrative
| Field | Purpose |
|-------|---------|
| System / instruction prompt | The master instruction — describe tone, scope, and format |
| Output style | Narrative / Bullet points / Headline + one-liner |
| Approximate length | ~50 / ~150 / ~300 words |
| Include current selections | Auto-appends active filter context to the prompt |

### Questions to Answer
Add specific questions the extension must answer. Each question can optionally
reference a dimension (e.g. *"focus on: Region"*). Questions are numbered and
appended at the end of the composed prompt.

### Data Context
- **Dimension groups** — give related dimensions a label + note so the model
  understands how they relate (e.g. "Customer segments: CustomerType, Tier, Region").
- **Key measures** — comma-separated measure names.
- **Additional context** — free-text domain knowledge or constraints.

### API Settings
| Field | Default |
|-------|---------|
| API base URL override | *(blank — auto-detects from `window.location.origin`)* |
| Debug mode | Off — enable to log every request + response to the browser console |

---

## How the prompt is composed

At runtime the extension assembles the final question in this order:

1. System / instruction prompt
2. Output-style hint
3. Word-count guidance
4. Current selection context (field = value pairs)
5. Dimension group definitions
6. Focus measures
7. Additional context / constraints
8. Numbered questions

The entire assembled string is sent as `content[0].text` in the invoke call.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `Thread creation failed (403)` | User doesn't have access to Qlik Answers on this tenant, or the `qlik-csrf-token` cookie is missing. Enable Debug mode and check the console. |
| `Thread creation failed (404)` | The `/api/v1/cloud-assistants` path is not available. Check that Answers is enabled on the tenant. |
| Response text is empty | Enable Debug mode — the raw JSON response will be logged. The `content` array might be empty if Answers couldn't find relevant data. |
| CSRF token is blank | Reload the Qlik Cloud app (a fresh login sets the cookie). Debug mode logs whether the token was found. |
