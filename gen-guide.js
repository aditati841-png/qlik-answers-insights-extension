const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, ExternalHyperlink,
  PageBreak, TableOfContents
} = require('docx');
const fs = require('fs');

// ── Helpers ──────────────────────────────────────────────────────────────────
const BRAND_GREEN  = '009845';
const LIGHT_GREEN  = 'E6F4EC';
const LIGHT_GREY   = 'F5F5F5';
const MID_GREY     = 'CCCCCC';
const DARK         = '1A1A1A';
const PAGE_W       = 12240;
const PAGE_H       = 15840;
const MARGIN       = 1080; // 0.75 inch
const CONTENT_W    = PAGE_W - MARGIN * 2;

function cellBorder(color) {
  const s = { style: BorderStyle.SINGLE, size: 1, color: color || MID_GREY };
  return { top: s, bottom: s, left: s, right: s };
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, font: 'Arial', size: 28, bold: true, color: BRAND_GREEN })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, font: 'Arial', size: 24, bold: true, color: DARK })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 60 },
    children: [new TextRun({ text, font: 'Arial', size: 22, bold: true, color: DARK })]
  });
}

function body(runs) {
  const children = typeof runs === 'string'
    ? [new TextRun({ text: runs, font: 'Arial', size: 22, color: DARK })]
    : runs;
  return new Paragraph({ spacing: { before: 60, after: 100 }, children });
}

function run(text, opts) {
  return new TextRun(Object.assign({ text, font: 'Arial', size: 22, color: DARK }, opts || {}));
}

function bold(text) { return run(text, { bold: true }); }
function italic(text) { return run(text, { italics: true, color: '555555' }); }
function code(text) {
  return new TextRun({ text, font: 'Courier New', size: 20, color: '007A33', highlight: 'lightGray' });
}

function bullet(text, level) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: level || 0 },
    spacing: { before: 40, after: 40 },
    children: typeof text === 'string'
      ? [run(text)]
      : text
  });
}

function numbered(text, level) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: level || 0 },
    spacing: { before: 40, after: 40 },
    children: typeof text === 'string'
      ? [run(text)]
      : text
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_GREY } },
    children: []
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function callout(label, text, color) {
  const bg = color || LIGHT_GREEN;
  const border = { style: BorderStyle.SINGLE, size: 1, color: color ? 'AAAAAA' : BRAND_GREEN };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      width: { size: CONTENT_W, type: WidthType.DXA },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: label + '  ', font: 'Arial', size: 20, bold: true,
            color: color ? '444444' : '006830' }),
          new TextRun({ text, font: 'Arial', size: 20, color: color ? '444444' : '1A3A25' })
        ]
      })]
    })]})],
  });
}

function settingsRow(prop, type, defaultVal, description) {
  const border = cellBorder(MID_GREY);
  const cellPad = { top: 80, bottom: 80, left: 120, right: 120 };
  return new TableRow({ children: [
    new TableCell({ borders: border, margins: cellPad,
      width: { size: 2600, type: WidthType.DXA },
      children: [new Paragraph({ children: [bold(prop)] })] }),
    new TableCell({ borders: border, margins: cellPad,
      width: { size: 1400, type: WidthType.DXA },
      shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [italic(type)] })] }),
    new TableCell({ borders: border, margins: cellPad,
      width: { size: 1600, type: WidthType.DXA },
      shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [italic(defaultVal)] })] }),
    new TableCell({ borders: border, margins: cellPad,
      width: { size: CONTENT_W - 5600, type: WidthType.DXA },
      children: [new Paragraph({ children: [run(description)] })] }),
  ]});
}

function settingsHeader() {
  const border = cellBorder(MID_GREY);
  const cellPad = { top: 80, bottom: 80, left: 120, right: 120 };
  function hCell(text, w) {
    return new TableCell({
      borders: border, margins: cellPad,
      width: { size: w, type: WidthType.DXA },
      shading: { fill: '2E7D32', type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [
        new TextRun({ text, font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })
      ]})]
    });
  }
  return new TableRow({ tableHeader: true, children: [
    hCell('Setting', 2600),
    hCell('Type', 1400),
    hCell('Default', 1600),
    hCell('Description', CONTENT_W - 5600),
  ]});
}

function settingsTable(rows) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2600, 1400, 1600, CONTENT_W - 5600],
    rows: [settingsHeader(), ...rows]
  });
}

function sp(n) {
  return new Paragraph({ spacing: { before: 0, after: n || 80 }, children: [] });
}

// ── Document ─────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] },
      { reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22, color: DARK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: BRAND_GREEN },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 180, after: 60 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_GREY } },
        spacing: { after: 120 },
        children: [new TextRun({ text: 'AI Insight Panel  |  Qlik Sense Extension', font: 'Arial', size: 18, color: '888888' })]
      })]})
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: MID_GREY } },
        spacing: { before: 120 },
        children: [
          new TextRun({ text: 'Page ', font: 'Arial', size: 18, color: '888888' }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '888888' }),
          new TextRun({ text: ' of ', font: 'Arial', size: 18, color: '888888' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: '888888' }),
        ]
      })]})
    },
    children: [

      // ── Cover ──────────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 200 },
        children: [new TextRun({ text: 'AI Insight Panel', font: 'Arial', size: 64, bold: true, color: BRAND_GREEN })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 100 },
        children: [new TextRun({ text: 'Qlik Sense Extension', font: 'Arial', size: 32, color: '444444' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [new TextRun({ text: 'Setup Guide & User Documentation', font: 'Arial', size: 26, italics: true, color: '666666' })]
      }),
      new Table({
        width: { size: 4000, type: WidthType.DXA },
        columnWidths: [4000],
        rows: [new TableRow({ children: [new TableCell({
          borders: cellBorder(BRAND_GREEN),
          shading: { fill: LIGHT_GREEN, type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          width: { size: 4000, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 },
              children: [run('Version 1.0   |   June 2026', { color: '444444', size: 20 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
              children: [run('Requires Qlik Cloud (SaaS) with Qlik Answers enabled', { color: '666666', size: 18, italics: true })] }),
          ]
        })]})],
      }),
      pageBreak(),

      // ── Table of Contents ──────────────────────────────────────────────────
      new Paragraph({ heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'Contents', font: 'Arial', size: 28, bold: true, color: BRAND_GREEN })] }),
      new TableOfContents('', { hyperlink: true, headingStyleRange: '1-2' }),
      pageBreak(),

      // ── 1. Overview ────────────────────────────────────────────────────────
      h1('1. Overview'),
      body([
        run('AI Insight Panel is a Qlik Sense extension that uses the '),
        bold('Qlik Answers API'),
        run(' to generate natural-language summaries directly inside any Qlik Cloud app. Instead of reading numbers and building your own narrative, the extension does it for you — responding to your app\'s live selections and filters in real time.')
      ]),
      sp(),
      body('You configure what to ask and how to display it. The extension calls Qlik Answers, waits for the response, and renders formatted text on the sheet. No external API keys or additional infrastructure are required.'),
      sp(160),
      h2('What it does'),
      bullet([bold('Generates insight text '), run('from a plain-English prompt you define')]),
      bullet([bold('Responds to selections '), run('— filter the app and click Refresh to re-run with new context')]),
      bullet([bold('Dimensions and measures are optional '), run('— you can ask broad questions like "How is the business doing?" with no data bindings at all')]),
      bullet([bold('Fully configurable appearance '), run('— fonts, colours, borders, padding')]),
      bullet([bold('Show or hide the prompt '), run('from end users via a single toggle')]),
      sp(160),
      callout('Requirements:', 'Qlik Cloud (SaaS) tenant with Qlik Answers enabled, and an active browser session on that tenant. No API key is needed.'),
      sp(160),

      // ── 2. Installation ────────────────────────────────────────────────────
      h1('2. Installation'),
      h2('Step 1 — Upload the extension'),
      numbered('Log in to your Qlik Cloud tenant as a tenant administrator.'),
      numbered([run('Open the '), bold('Management Console'), run(' from the launcher menu (top-right grid icon).')]),
      numbered([run('In the left navigation, go to '), bold('Extensions'), run('.')]),
      numbered([run('Click '), bold('Add'), run(' (top-right).')]),
      numbered([run('Select '), bold('answers-insights.zip'), run(' from your files and click '), bold('Save'), run('.')]),
      numbered('The extension will appear in the list as "answers-insights". It is now available to all users on the tenant.'),
      sp(160),
      callout('Upgrading:', 'To install a newer version, delete the existing extension from the Extensions list first, then re-upload the new zip. Existing objects using the old version will need to be re-added to sheets.'),
      sp(160),
      h2('Step 2 — Add to a sheet'),
      numbered([run('Open a '), bold('Qlik Cloud app'), run(' where you want to display insights.')]),
      numbered([run('Enter '), bold('Edit mode'), run(' (pencil icon, top right).')]),
      numbered([run('In the '), bold('Assets panel'), run(' on the left, find '), bold('Custom objects'), run(' and expand it.')]),
      numbered([run('Drag '), bold('AI Insight Panel'), run(' onto the sheet, or double-click to add it.')]),
      numbered('Resize and position the object as needed.'),
      numbered([run('Open the '), bold('Properties panel'), run(' (right side) to configure it — see Section 3.')]),
      numbered([run('Click '), bold('Done editing'), run(' to return to analysis mode. The extension will run automatically.')]),
      sp(160),

      // ── 3. Configuration ───────────────────────────────────────────────────
      h1('3. Configuration'),
      body('All settings are in the Properties panel on the right side of the screen when the object is selected in Edit mode. Settings are grouped into five sections.'),
      sp(160),

      h2('3.1  Dimensions & Measures (optional)'),
      body([
        bold('Both are fully optional. '),
        run('If you want to ask a broad, data-agnostic question (e.g. "Summarise the overall business performance"), leave these empty. If you add dimensions or measures, their labels are included in the prompt as context, which helps Qlik Answers focus its response on the right data.')
      ]),
      sp(),
      bullet([bold('Add a dimension: '), run('click "Add dimension" and pick from the field list, or type a custom expression.')]),
      bullet([bold('Add a measure: '), run('click "Add measure" and enter an expression or pick an existing master item.')]),
      bullet([bold('Multiple items: '), run('you can add several of each. Their titles are passed to Qlik Answers as context labels.')]),
      sp(160),
      callout('Tip:', 'If you add dimensions/measures, give them clear, descriptive titles in the label field. Qlik Answers uses the title, not the expression, when generating the insight.'),
      sp(160),

      h2('3.2  Prompt & Narrative'),
      body('This is the core section — it controls what question is sent to Qlik Answers and how the answer is formatted.'),
      sp(),
      settingsTable([
        settingsRow('Instruction prompt', 'Text area', 'Data analyst summary prompt', 'The main instruction sent to Qlik Answers. You can write anything here — a single question like "How is the business doing?" or a detailed analyst brief. Supports plain text; keep it concise and specific.'),
        settingsRow('Questions to answer', 'Text area', 'Key trends / Unusual patterns', 'Optional follow-up questions, one per line. These are appended to the prompt and numbered automatically. Leave blank if your instruction prompt is already self-contained.'),
        settingsRow('Output style', 'Dropdown', 'Narrative paragraph', 'Narrative paragraph: flowing prose. Bullet points: a list. Headline + one-liner: bold heading followed by a single sentence.'),
        settingsRow('Approximate length', 'Dropdown', 'Medium (~150 words)', 'Controls the target word count passed to Qlik Answers. Short: ~50 words. Medium: ~150 words. Long: ~300 words.'),
        settingsRow('Include filter context', 'Toggle', 'Yes', 'When on, the current app selections (field name + selected values) are appended to the prompt so Qlik Answers is aware of the filtered state.'),
        settingsRow('Show "View prompt" to user', 'Toggle', 'Show', 'When set to Show, end users can expand the full prompt that was sent to Qlik Answers using the toggle at the bottom of the object. Set to Hide to keep the prompt invisible to end users.'),
      ]),
      sp(160),
      pageBreak(),

      h2('3.3  Appearance'),
      body('Controls the visual style of the object. Changes take effect immediately without needing to re-run the insight.'),
      sp(),
      h3('Header'),
      settingsTable([
        settingsRow('Header title', 'Text', '"AI Insight"', 'Displayed at the top of the object. Leave blank to hide the header entirely.'),
        settingsRow('Show refresh button', 'Toggle', 'Yes', 'Shows or hides the Refresh button. You may want to hide it in view-only dashboards where you control when insight is generated.'),
      ]),
      sp(),
      h3('Background'),
      settingsTable([
        settingsRow('Transparent background', 'Toggle', 'Yes', 'When on, the object background inherits from the sheet. Turn off to set a custom colour.'),
        settingsRow('Background color', 'Color picker', 'White', 'Visible only when Transparent is off.'),
      ]),
      sp(),
      h3('Font'),
      settingsTable([
        settingsRow('Font family', 'Dropdown', 'Source Sans Pro', 'Default uses the Qlik system font. Override with Arial, Helvetica, Georgia, etc.'),
        settingsRow('Font size (px)', 'Number', '13', 'Base font size in pixels for the insight text.'),
        settingsRow('Font color', 'Color picker', 'Near-black (#1A1A1A)', 'Text colour for the rendered insight.'),
        settingsRow('Bold / Italic', 'Toggle', 'Off', 'Apply bold or italic to all insight text.'),
        settingsRow('Text alignment', 'Dropdown', 'Left', 'Left, Centre, Right, or Justify.'),
        settingsRow('Line height', 'Dropdown', 'Relaxed (1.65)', 'Compact (1.2), Normal (1.4), Relaxed (1.65), Loose (2.0).'),
      ]),
      sp(),
      h3('Border & Spacing'),
      settingsTable([
        settingsRow('Show border', 'Toggle', 'No', 'Adds a border around the whole object.'),
        settingsRow('Border color / width', 'Color + number', 'Grey, 1px', 'Visible only when Show border is on.'),
        settingsRow('Corner radius (px)', 'Number', '4', 'Rounds the corners of the border.'),
        settingsRow('Content padding', 'Dropdown', 'Medium (16px)', 'Internal spacing between the border and the text.'),
      ]),
      sp(160),

      h2('3.4  API Settings'),
      body('These are advanced settings you normally do not need to change.'),
      sp(),
      settingsTable([
        settingsRow('API base URL override', 'Text', '(empty)', 'Leave blank. The extension auto-detects the API root from the current browser origin. Only change this if your tenant uses a non-standard path.'),
        settingsRow('Debug mode', 'Toggle', 'Off', 'When on, the full prompt and raw API responses are printed to the browser Developer Console (F12 > Console). Useful for troubleshooting unexpected output.'),
      ]),
      sp(160),

      // ── 4. Using the Extension ─────────────────────────────────────────────
      h1('4. Using the Extension'),
      h2('Auto-run on load'),
      body('When the app is opened in analysis mode and a prompt is configured, the extension runs automatically on first load. You will see the animated loading screen while Qlik Answers processes the request. This typically takes 30–60 seconds.'),
      sp(160),
      h2('Refreshing the insight'),
      body('Click the Refresh button (top-right of the object) at any time to re-run the insight. This is most useful after changing selections:'),
      numbered('Apply a filter or make a selection in the app (e.g. select a region, product, or time period).'),
      numbered('Click Refresh on the insight object.'),
      numbered('The extension re-sends the prompt with the updated selection context and generates a new response.'),
      sp(160),
      h2('Viewing the prompt'),
      body([
        run('If "Show \'View prompt\' to user" is enabled in the properties, a small '),
        bold('▾ View prompt'),
        run(' link appears at the bottom of the object. Clicking it expands the exact text that was sent to Qlik Answers. This is useful for understanding why a particular response was generated, or for sharing with colleagues who want to understand the analysis.')
      ]),
      sp(160),
      h2('Loading screen'),
      body('While waiting for a response, the extension shows:'),
      bullet('An animated green equalizer bar graphic (data is being processed).'),
      bullet('A rotating set of status messages that update every 3 seconds.'),
      bullet('The messages are light-hearted by design — the call to Qlik Answers can take up to a minute and we want the experience to feel active rather than stuck.'),
      sp(160),
      callout('Note:', 'The extension will wait up to 3 minutes before timing out. If it times out, an error message is shown and you can click Refresh to try again.'),
      sp(160),
      pageBreak(),

      // ── 5. Example Prompts ─────────────────────────────────────────────────
      h1('5. Example Prompts'),
      body('Below are ready-to-use prompts for different use cases. Paste them into the "Instruction prompt" field.'),
      sp(160),

      h2('General business summary (no dimensions/measures needed)'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          borders: cellBorder('AAAAAA'),
          shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          width: { size: CONTENT_W, type: WidthType.DXA },
          children: [
            new Paragraph({ spacing: { before: 0, after: 60 }, children: [
              new TextRun({ text: 'You are a business analyst presenting to a senior leadership team. Using the current app data and any active selections, give a concise plain-language summary of business performance. Highlight any key trends, notable variances from expectations, and any areas of concern. Keep the tone professional and factual.', font: 'Courier New', size: 20, color: '1A3A1A' })
            ]}),
            new Paragraph({ spacing: { before: 0, after: 0 }, children: [
              new TextRun({ text: 'Questions: How is the business doing overall? What stands out as unusual or unexpected?', font: 'Courier New', size: 20, color: '555555', italics: true })
            ]})
          ]
        })]})],
      }),
      sp(160),

      h2('Sales performance (with Sales Amount and Region dimensions)'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          borders: cellBorder('AAAAAA'),
          shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          width: { size: CONTENT_W, type: WidthType.DXA },
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [
            new TextRun({ text: 'You are a sales analyst. Analyse the sales data for the selected period and regions. Identify which regions or segments are outperforming or underperforming, and explain possible reasons. Suggest one or two actions the sales team could take based on the data.', font: 'Courier New', size: 20, color: '1A3A1A' })
          ]})]
        })]})],
      }),
      sp(160),

      h2('Executive one-liner (Headline style)'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          borders: cellBorder('AAAAAA'),
          shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          width: { size: CONTENT_W, type: WidthType.DXA },
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [
            new TextRun({ text: 'Write a single bold headline summarising the most important finding from this data, followed by exactly one supporting sentence. Be direct and specific. Avoid filler words.', font: 'Courier New', size: 20, color: '1A3A1A' })
          ]})]
        })]})],
      }),
      sp(),
      body([italic('Set Output style to "Headline + one-liner" when using this prompt.')]),
      sp(160),
      pageBreak(),

      // ── 6. Troubleshooting ─────────────────────────────────────────────────
      h1('6. Troubleshooting'),
      sp(),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [3200, CONTENT_W - 3200],
        rows: [
          new TableRow({ tableHeader: true, children: [
            new TableCell({ borders: cellBorder(MID_GREY), margins: { top: 80, bottom: 80, left: 120, right: 120 },
              width: { size: 3200, type: WidthType.DXA },
              shading: { fill: '2E7D32', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: 'Symptom', font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })] })] }),
            new TableCell({ borders: cellBorder(MID_GREY), margins: { top: 80, bottom: 80, left: 120, right: 120 },
              width: { size: CONTENT_W - 3200, type: WidthType.DXA },
              shading: { fill: '2E7D32', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: 'What to check', font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })] })] }),
          ]}),
          ...[
            ['Extension not visible in Assets panel', 'Confirm it was uploaded correctly in the Management Console. You may need to reload the browser.'],
            ['Nothing happens on load / blank body', 'Make sure there is text in the Instruction prompt field. If empty, the auto-run is skipped.'],
            ['"Could not generate insight" error', 'You may not be logged in to the correct Qlik Cloud tenant, or your session has expired. Reload the page and try again.'],
            ['"No qlik-csrf-token header" error', 'This always means the browser session is not authenticated. Log in to the tenant and reload.'],
            ['"Thread creation failed (403)"', 'Qlik Answers may not be enabled on your tenant, or your user role does not have access. Contact your tenant administrator.'],
            ['Response is garbled or contains citation tags', 'Enable Debug mode in API Settings and check the browser console. Share the raw response with the extension owner for investigation.'],
            ['Insight does not change after making a selection', 'Selections are only sent on refresh. After changing a filter, click the Refresh button on the object.'],
            ['Loading takes more than 2 minutes', 'Qlik Answers processing time depends on data volume and question complexity. The extension times out at 3 minutes. If it consistently times out, simplify the prompt or reduce the target response length.'],
          ].map(([symptom, fix]) => new TableRow({ children: [
            new TableCell({ borders: cellBorder(MID_GREY), margins: { top: 80, bottom: 80, left: 120, right: 120 },
              width: { size: 3200, type: WidthType.DXA },
              shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [run(symptom, { bold: true })] })] }),
            new TableCell({ borders: cellBorder(MID_GREY), margins: { top: 80, bottom: 80, left: 120, right: 120 },
              width: { size: CONTENT_W - 3200, type: WidthType.DXA },
              children: [new Paragraph({ children: [run(fix)] })] }),
          ]}))
        ]
      }),
      sp(160),
      callout('Debug tip:', 'Enable Debug mode in API Settings (Properties panel > API Settings > Debug mode: On). Open the browser Developer Tools (F12) and go to the Console tab. The extension logs the full prompt, API call URLs, and raw response.'),
      sp(160),
      pageBreak(),

      // ── 7. FAQ ─────────────────────────────────────────────────────────────
      h1('7. Frequently Asked Questions'),
      sp(),
      h3('Do I need an API key or special account?'),
      body('No. The extension uses your existing Qlik Cloud browser session. As long as you are logged in to the tenant and Qlik Answers is enabled, no additional credentials are needed.'),
      sp(),
      h3('Does it work offline or in Qlik Sense Client-Managed (on-premise)?'),
      body('No. The extension requires a Qlik Cloud (SaaS) tenant with Qlik Answers enabled. It does not work with on-premise Qlik Sense deployments.'),
      sp(),
      h3('Will it re-run automatically when I change a selection?'),
      body('Not automatically. After making a selection, click the Refresh button on the object. This is intentional — automatic re-runs on every click could trigger many slow API calls.'),
      sp(),
      h3('Can I have multiple AI Insight Panel objects on the same sheet?'),
      body('Yes. Each object has its own prompt, configuration, and independent state. You could, for example, have one asking about sales trends and another about customer satisfaction on the same sheet.'),
      sp(),
      h3('Can I hide the prompt from end users?'),
      body([
        run('Yes. In Properties > Prompt & Narrative, set '),
        bold('"Show \'View prompt\' to user"'),
        run(' to Hide. The prompt is still sent to Qlik Answers, but the expand/collapse toggle is not shown in the widget.')
      ]),
      sp(),
      h3('How do I update the extension?'),
      body('Delete the existing extension in the Management Console, then re-upload the new zip file. Existing objects will need to be removed from sheets and re-added.'),
      sp(160),
      divider(),
      sp(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: 'AI Insight Panel  •  Qlik Sense Extension  •  v1.0  •  June 2026', font: 'Arial', size: 18, color: '888888', italics: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(function(buf) {
  fs.writeFileSync('AI Insight Panel - Setup Guide.docx', buf);
  console.log('Done');
});
