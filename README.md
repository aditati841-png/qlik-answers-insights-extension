# Answers Insights — Qlik Sense Extension

Turn any Qlik Sense sheet into a natural-language analyst. **Answers Insights** drops a
configurable AI narrative panel onto the canvas that reads the app's current selections,
dimensions, and measures, then writes a plain-language summary — powered by **Qlik Answers**
(the Qlik Cloud Assistants API), with **no API key or backend to manage**.

![Type](https://img.shields.io/badge/type-visualization-2563eb) ![Qlik Sense](https://img.shields.io/badge/Qlik%20Sense-%E2%89%A53.0.0-009845) ![Auth](https://img.shields.io/badge/auth-session%20cookie-555)

---

## The problem

Dashboards show *what* the numbers are. They rarely explain *what it means* — and the person
reading a chart at 8am often isn't the person who built it. Today that gap is filled manually:
an analyst writes a "key takeaways" text box, it goes stale the moment a filter changes, and it
never reflects the slice the viewer is actually looking at.

Qlik Answers can generate that narrative on demand, but it lives in its own conversational
surface — separate from the dashboard, disconnected from the user's live selection state.

## What this does

Answers Insights closes that gap by embedding the narrative **directly in the sheet**:

- **Selection-aware** — it reads the app's active filters and feeds them to Qlik Answers, so the
  summary always describes the data the user is currently looking at.
- **Auto-refreshing** — change a selection and the insight regenerates automatically (debounced),
  or pin it and refresh manually.
- **Configurable voice** — control the instruction prompt, the specific questions to answer,
  output style (narrative / bullets / headline), and length, all from the properties panel.
- **Zero credentials** — runs on the viewer's existing Qlik Cloud session. Nothing to provision,
  no key to rotate, no proxy to host.

## Use cases

- **Executive summaries** that rewrite themselves as the exec drills into a region or quarter.
- **Embedded "what changed?" commentary** next to a KPI chart for self-service users.
- **Guided analysis** — pre-load a set of questions ("What's the top driver? What looks
  anomalous?") and let every viewer get a consistent, data-grounded answer.
- **Report-ready text** — copy the generated narrative or export it to PDF for a briefing.

---

## Features

| | |
|---|---|
| 🧠 **Qlik Answers powered** | Uses the Cloud Assistants API — grounded in your tenant's data |
| 🔍 **Live selection context** | Active filters are injected into every prompt |
| 🔄 **Auto-refresh** | Regenerates on selection change, with manual refresh + abort |
| 📐 **Multiple dimensions & measures** | Native Qlik pickers feed the model the fields that matter |
| ✍️ **Prompt control** | Instruction prompt, numbered questions, output style, length |
| 🛠️ **Developer view** | In-widget debug console: exact prompt, request payloads, timeline, raw response |
| 👁️ **Prompt transparency** | Lighter panel that shows just the *exact* composed prompt |
| 🎨 **Theme-aware UI** | Skeleton loader, streaming cursor, animated follow-up chips |
| 📋 **Copy & export** | One-click copy, or open a print-ready PDF view |
| 🔐 **No API key** | Authenticates off the user's session cookie + CSRF token |

---

## Installation

1. Download `answers-insights.zip` from this repo (or zip the source folder yourself).
2. Qlik Cloud → **Management Console → Extensions → Add**, and upload the zip.
3. Open any app → **Edit sheet** → drag **Answers Insights** onto the canvas.
4. Configure the prompt and questions in the properties panel, then click **Refresh**.

Requires Qlik Answers to be enabled on the tenant, and the viewer to have access to it.

---

## Configuration

Settings live in the object's properties panel.

### Data
- **Dimensions** and **Measures** — standard Qlik field pickers. Add as many as you need; their
  names are passed to Answers as the fields to analyse.

### Prompt & Narrative
| Field | Purpose |
|-------|---------|
| Instruction prompt | The master instruction — tone, scope, and persona |
| Questions to answer | One per line; numbered and appended to the prompt |
| Output style | Narrative paragraph / Bullet points / Headline + one-liner |
| Approximate length | Short (~50) / Medium (~150) / Long (~300) words |
| Include selection context | Auto-appends the active filter state to the prompt |

### Behaviour
Auto-refresh on selection change, auto-run on load, and toggles for the refresh / copy / export buttons.

### Appearance
Header title, background, font (family, size, colour, weight), border, corner radius, padding, and line height.

### API Settings
| Field | Purpose |
|-------|---------|
| API base URL override | Blank by default — auto-detects from `window.location.origin` |
| Developer view | In-widget debug console (see below) |
| Show exact prompt panel | Lightweight footer panel showing just the composed prompt |
| Reasoning mode | Fast (quick answers) or Thinking (complex reasoning) |
| Show reasoning to user | Surface the model's reasoning (Thinking mode) |
| Debug mode | Logs every request, response, and the prompt to the browser console |

### Developer view

Toggle **Developer view** on for a collapsible console docked at the bottom of the widget. It
captures each generation run and shows, in order:

- **Exact prompt sent to Answers** — the fully composed prompt, highlighted, with a one-click copy.
- **Timeline** — each step (prompt composed → CSRF acquired → thread created → invoke → rendered)
  with elapsed milliseconds, so you can see where time goes.
- **Detected context** — app id, API root, reasoning mode, the dimensions/measures passed, and the
  active selections that fed the prompt.
- **API requests** — the actual `POST` bodies sent to `/threads` and `/actions/invoke`.
- **Raw response** — the unparsed Adaptive Card JSON (with HTTP status), so you can see exactly what
  Answers returned before the extension formatted it.

In edit mode it previews the prompt live as you change properties, even before a run. Auth tokens
are never displayed.

---

## How authentication works (no API key)

A Qlik Sense extension runs in the browser, served from the same origin as the tenant
(e.g. `https://your-tenant.us.qlikcloud.com`). That gives it two things for free:

1. **Session cookie** — the browser automatically attaches the user's Qlik Cloud login cookie to
   every same-origin `fetch`. The existing login *is* the credential — no Bearer token needed.
2. **CSRF token** — Qlik Cloud requires a CSRF token on same-origin POSTs. The cookie isn't readable
   from JavaScript, so the extension follows Qlik's documented flow: it calls `GET /api/v1/csrf-token`,
   reads the token from the `qlik-csrf-token` **response header**, and echoes it back as a request
   header on every POST (cached per object). See <https://qlik.dev/apis/rest/csrf-token/>.

The result: it works for anyone already logged into the tenant, with zero credential setup.

---

## How it works under the hood

### API flow

```
Step 0 — get the CSRF token (cached after first call)
  GET /api/v1/csrf-token
  → response header: qlik-csrf-token: <token>

Step 1 — create a thread (once per refresh)
  POST /api/v1/cloud-assistants/threads
  headers: { qlik-csrf-token: <token> }
  body: { name, context: { type:"app", id:"<appId>", data:{ mode:"live", route:"answers" } }, messages: [] }
  → { id: "<threadId>" }

Step 2 — invoke with the composed prompt
  POST /api/v1/cloud-assistants/<threadId>/actions/invoke
  headers: { qlik-csrf-token: <token>, Accept: "text/event-stream, application/json" }
  body: { context: {...}, content: [{ text: "<composed prompt>" }] }
  → JSON (Adaptive Card)
```

The invoke call is **synchronous** — it returns `application/json` (status 201) after the agent
finishes, which can take up to ~1 minute, so the UI shows a skeleton loader during the wait. An
SSE (`text/event-stream`) branch is kept as a fallback in case a future route streams.

### Parsing the response

The answer arrives as an **Adaptive Card**, not plain text. The extension walks the card, collects
**visible** `TextBlock`s (skipping hidden detail sections and action buttons), bolds headings,
strips `<citation>` tags, and surfaces `Action.Submit` titles as clickable **follow-up chips**.
The top-level `summary` field is internal agent meta-text and is intentionally ignored.

### How the prompt is composed

At runtime the final prompt is assembled in this order:

1. Instruction prompt
2. Output-style hint
3. Word-count guidance
4. Current selection context (field = value pairs)
5. Dimensions to analyse
6. Key measures
7. Numbered questions

The whole string is sent as `content[0].text`. Enable **Show exact prompt panel** to see it verbatim.

---

## Project structure

| File | Purpose |
|------|---------|
| `answers-insights.qext` | Extension metadata (name, version, icon) |
| `answers-insights.js`   | Main extension — paint loop, auth, API calls, SSE parsing, rendering |
| `properties.js`         | Properties panel definition |
| `answers-insights.css`  | Styling — skeleton loader, streaming cursor, chips, states |
| `answers-insights.zip`  | Packaged build, ready to upload to Qlik Cloud |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `Thread creation failed (403)` | User lacks access to Qlik Answers on this tenant, or the CSRF token is missing. Enable Debug mode and check the console. |
| `Thread creation failed (404)` | The `/api/v1/cloud-assistants` path isn't available — confirm Answers is enabled on the tenant. |
| Response text is empty | Enable Debug mode to log the raw JSON. The `content` array may be empty if Answers found no relevant data. |
| CSRF token is blank | Reload the app (a fresh login sets the cookie). Debug mode logs whether the token was found. |

---

## License

ISC © Adithya Pai
