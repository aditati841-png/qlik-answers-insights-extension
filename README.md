# Answers Insights — Qlik Sense Extension

Turn any Qlik Sense sheet into a natural-language analyst. **Answers Insights** drops a
configurable AI narrative panel onto the canvas that reads the app's current selections,
dimensions, and measures, then writes a plain-language summary — powered by **Qlik Answers**,
with **no API key or backend to manage**.

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
| 🧠 **Qlik Answers powered** | Grounded in your tenant's data |
| 🔍 **Live selection context** | Active filters are injected into every prompt |
| 🔄 **Auto-refresh** | Regenerates on selection change, with manual refresh + abort |
| 📐 **Multiple dimensions & measures** | Native Qlik pickers feed the model the fields that matter |
| ✍️ **Prompt control** | Instruction prompt, numbered questions, output style, length |
| 👁️ **Prompt transparency** | Optional panel that shows the exact composed prompt |
| 🎨 **Theme-aware UI** | Skeleton loader, streaming cursor, animated follow-up chips |
| 📋 **Copy & export** | One-click copy, or open a print-ready PDF view |
| 🔐 **No API key** | Authenticates off the user's existing Qlik Cloud session |

---

## Installation

1. Download `answers-insights.zip` from the [latest release](../../releases/latest).
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

### Other
| Field | Purpose |
|-------|---------|
| Show exact prompt panel | Footer panel showing the composed prompt verbatim |
| Reasoning mode | Fast (quick answers) or Thinking (complex reasoning) |
| Show reasoning to user | Surface the model's reasoning (Thinking mode) |

---

## Consumption

**This extension consumes Qlik Answers consumption.** Every time it generates an insight — on
load, on a selection change (when auto-refresh is on), or when a user clicks **Refresh** — it
sends a real request to Qlik Answers, and that request draws on your tenant's metered usage,
exactly as if someone had asked Answers the same question in its own interface.

You stay in control of the dials:

- **Auto-refresh is yours to set** — turn it off and insights only generate when a user explicitly
  clicks **Refresh**.
- **Debounced regeneration** — when auto-refresh is on, rapid selection changes collapse into a
  single request instead of one per click.
- **One run = one answer** — generation is on-demand and bounded; the widget doesn't poll or
  silently regenerate in the background.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Insight won't generate | You may not be logged in to the correct Qlik Cloud tenant, or your session has expired. Reload the page and try again. |
| "Could not generate insight" | Qlik Answers may not be enabled on the tenant, or your user role doesn't have access. Contact your tenant administrator. |
| Response text is empty | Answers may have found no relevant data for the current selection. Adjust the prompt or selection and retry. |

---

## License

MIT © Adithya Pai
