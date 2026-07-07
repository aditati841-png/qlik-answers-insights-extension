/**
 * Answers Insights — Qlik Sense extension
 *
 * Calls the Qlik Cloud Assistants API to generate natural-language insight
 * text directly on the sheet. No API key required — uses the in-browser
 * session cookie + CSRF token.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────
 *   GET  /api/v1/csrf-token              → response header qlik-csrf-token
 *   POST /api/v1/cloud-assistants/threads
 *   POST /api/v1/cloud-assistants/{id}/actions/invoke
 */
define(
  ['qlik', 'jquery', './properties', 'css!./answers-insights.css'],
  function (qlik, $, properties) {

    /* ═══════════════════════════════════════════════════════════════════
     *  CONSTANTS
     * ═══════════════════════════════════════════════════════════════════ */
    var LENGTH_WORDS   = { short: 50, medium: 150, long: 300 };
    var PADDING_VALUES = { none: '0', small: '8px 10px', medium: '10px 14px', large: '16px 22px' };

    var LOADING_MSGS = [
      'Reading your data…',
      'Connecting the dots…',
      'Crunching the numbers…',
      'Finding the story in your data…',
      'Talking to Qlik Answers…',
      'Synthesising insights…',
      'Analysing trends…',
      'Squinting at the spreadsheets…',
      'Doing the maths so you don\'t have to…',
      'Turning data into decisions…',
      'Consulting the data oracle…',
      'Wrangling your metrics…',
      'Asking the right questions…',
      'Pattern detected. Investigating…',
      'Almost ready to impress you…',
      'One more moment of genius…',
      'Your insight is being hand-crafted…',
      'Convincing the numbers to behave…'
    ];

    /* ═══════════════════════════════════════════════════════════════════
     *  STYLE HELPERS
     * ═══════════════════════════════════════════════════════════════════ */

    /** Safely extract a hex color from either a string or a Qlik color-picker object. */
    function colorVal(c) {
      if (!c) return null;
      if (typeof c === 'string' && c !== 'none') return c;
      if (c.color && c.color !== 'none') return c.color;
      return null;
    }

    /** Apply text/font styles to a jQuery element from the props object. */
    function applyTextStyles($el, props) {
      if (!$el || !$el.length) return;
      var ff = props.fontFamily && props.fontFamily !== 'default' ? props.fontFamily : '';
      /* When "match theme" is on (default) we leave color unset so the
       * stylesheet's theme-aware var(--qlik-color-primary, …) applies and the
       * text stays legible on both light and dark Qlik themes. Only a user who
       * turns the toggle off gets a hard-coded color. */
      var color = (props.autoThemeColor === false) ? (colorVal(props.fontColor) || '') : '';
      $el.css({
        'font-family':   ff || '',
        'font-size':     props.fontSize  ? props.fontSize + 'px' : '13px',
        'color':         color,
        'font-weight':   props.fontBold   ? '700' : '400',
        'font-style':    props.fontItalic ? 'italic' : 'normal',
        'text-align':    props.textAlign  || 'left',
        'line-height':   props.lineHeight || '1.65'
      });
    }

    /** Apply container-level styles (background, border, padding) from props. */
    function applyWidgetStyles($widget, props) {
      if (!$widget || !$widget.length) return;

      var bg = props.bgTransparent ? 'transparent' : (colorVal(props.bgColor) || 'transparent');
      var borderVal = props.showBorder
        ? (props.borderWidth || 1) + 'px solid ' + (colorVal(props.borderColor) || '#cccccc')
        : 'none';

      $widget.css({
        'background-color': bg,
        'border':           borderVal,
        'border-radius':    (props.borderRadius !== undefined && props.borderRadius !== null)
                              ? props.borderRadius + 'px' : '0'
      });

      var pad = PADDING_VALUES[props.padding] || '10px 14px';
      $widget.find('.answers-insights__body').css('padding', pad);
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  HTML HELPERS
     * ═══════════════════════════════════════════════════════════════════ */
    var ICON_REFRESH =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"' +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M13.5 8A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 3.9 1.6L14 2"/>' +
      '<path d="M14 2v4h-4"/>' +
      '</svg>';

    var ICON_COPY =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"' +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="5" y="5" width="8" height="10" rx="1.5"/>' +
      '<path d="M3 11V3a1 1 0 0 1 1-1h8"/>' +
      '</svg>';

    var ICON_PRINT =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"' +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="6" width="10" height="7" rx="1"/>' +
      '<path d="M5 6V3h6v3"/>' +
      '<path d="M5 10h6M5 12h4"/>' +
      '</svg>';

    var ICON_CHEVRON =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 6l4 4 4-4"/>' +
      '</svg>';

    var ICON_PLACEHOLDER =
      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4">' +
      '<rect x="7" y="5" width="26" height="33" rx="3"/>' +
      '<line x1="13" y1="15" x2="27" y2="15"/>' +
      '<line x1="13" y1="21" x2="25" y2="21"/>' +
      '<line x1="13" y1="27" x2="22" y2="27"/>' +
      '<path d="M33 8l1.4 3.6 3.6 1.4-3.6 1.4L33 18l-1.4-3.6-3.6-1.4 3.6-1.4z"' +
      ' stroke-linejoin="round" stroke-width="1.2"/>' +
      '</svg>';

    var ICON_WRENCH =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"' +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M13.2 2.8a3 3 0 0 0-4.2 4L2.5 13.3a1.3 1.3 0 1 0 1.8 1.8l6.5-6.5a3 3 0 0 0 2.4-5.8z"/>' +
      '</svg>';

    var ICON_ERROR =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"' +
      ' stroke-linecap="round">' +
      '<circle cx="8" cy="8" r="6.5"/>' +
      '<line x1="8" y1="5" x2="8" y2="9"/>' +
      '<circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none"/>' +
      '</svg>';

    function buildLoadingHtml() {
      return (
        '<div class="ai-loading">' +
          '<div class="ai-loading__eq">' +
            '<span></span><span></span><span></span>' +
            '<span></span><span></span><span></span><span></span>' +
          '</div>' +
          '<div class="ai-loading__msg">' + LOADING_MSGS[0] + '</div>' +
          '<div class="ai-loading__skeleton">' +
            '<span></span><span></span><span></span>' +
          '</div>' +
        '</div>'
      );
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  DEVELOPER VIEW — in-widget debug console
     * ═══════════════════════════════════════════════════════════════════ */
    function devBlock(label, innerHtml, prominent) {
      var hasCopy = innerHtml.indexOf('data-copy') > -1;
      return (
        '<div class="ai-dev__block' + (prominent ? ' is-prominent' : '') + '">' +
          '<div class="ai-dev__label"><span>' + escapeHtmlRaw(label) + '</span>' +
            (hasCopy ? '<button class="ai-dev__copy">Copy</button>' : '') +
          '</div>' + innerHtml +
        '</div>'
      );
    }

    function buildDevView(dbg) {
      if (!dbg) return '<div class="ai-dev__empty">Run the insight to capture request details.</div>';
      var html = '';

      /* 1 — the exact prompt (the headline of this view) */
      html += devBlock('Exact prompt sent to Answers',
        '<pre class="ai-dev__pre" data-copy>' +
          escapeHtmlRaw(dbg.prompt || '(not composed yet)') + '</pre>', true);

      /* 2 — timeline */
      var steps = dbg.steps || [];
      var timeline = steps.length
        ? steps.map(function (s) {
            return '<div class="ai-dev__step"><span class="ai-dev__t">' + s.t +
                   'ms</span><span>' + escapeHtmlRaw(s.label) + '</span></div>';
          }).join('')
        : '<div class="ai-dev__step"><span>—</span></div>';
      html += devBlock('Timeline', '<div class="ai-dev__timeline">' + timeline + '</div>', false);

      /* 3 — detected context */
      var kv = '';
      kv += '<div><b>App id:</b> '          + escapeHtmlRaw(dbg.appId || '—') + '</div>';
      kv += '<div><b>API root:</b> '        + escapeHtmlRaw(dbg.root || '—') + '</div>';
      kv += '<div><b>Reasoning mode:</b> '  + escapeHtmlRaw(dbg.reasoningMode || '—') + '</div>';
      kv += '<div><b>Dimensions:</b> '      + escapeHtmlRaw((dbg.dims || []).join(', ') || '—') + '</div>';
      kv += '<div><b>Measures:</b> '        + escapeHtmlRaw((dbg.measures || []).join(', ') || '—') + '</div>';
      kv += '<div><b>Selections:</b> '      + escapeHtmlRaw(dbg.selectionsText || 'none') + '</div>';
      html += devBlock('Detected context', '<div class="ai-dev__kv">' + kv + '</div>', false);


      /* error */
      if (dbg.error) {
        html += devBlock('Error',
          '<pre class="ai-dev__pre ai-dev__err">' + escapeHtmlRaw(dbg.error) + '</pre>', false);
      }

      return html;
    }

    function renderDevView($root, props) {
      var $dev = $root.find('.answers-insights__dev');
      if (!props || !props.devMode) { $dev.hide(); return; }
      $dev.find('.answers-insights__dev-body').html(buildDevView($root.data('aiDebug')));
      $dev.css('display', 'block');
    }

    /** Build a fresh debug recorder for one generation run. */
    function makeDebug(prompt, root, appId, props, selectionState) {
      var dbg = {
        t0: Date.now(),
        prompt: prompt,
        root: root,
        appId: appId,
        reasoningMode: props.reasoningMode || 'fast',
        dims: props._dims || [],
        measures: props._measures || [],
        selectionsText: (selectionState && selectionState.length)
          ? selectionState.map(function (s) {
              return s.fieldName + ' = ' + (s.selectedValues || []).join(' / ');
            }).join('  |  ')
          : 'none',
        steps: [],
        requests: [],
        responseRaw: null,
        responseStatus: null,
        error: null
      };
      dbg.log = function (label) { this.steps.push({ label: label, t: Date.now() - this.t0 }); };
      return dbg;
    }

    /** escapeHtml that also handles undefined/null without throwing. */
    function escapeHtmlRaw(str) {
      if (str === undefined || str === null) return '';
      return escapeHtml(str);
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * Very lightweight markdown → HTML.
     * SECURITY: each line is HTML-escaped BEFORE markdown markers are applied.
     */
    function renderMarkdown(text) {
      var lines  = String(text).split('\n');
      var html   = '';
      var inList = false;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) {
          if (inList) { html += '</ul>'; inList = false; }
          continue;
        }
        if (/^[-*•]\s/.test(line)) {
          if (!inList) { html += '<ul>'; inList = true; }
          html += '<li>' + applyInline(escapeHtml(line.replace(/^[-*•]\s/, ''))) + '</li>';
        } else {
          if (inList) { html += '</ul>'; inList = false; }
          html += '<p>' + applyInline(escapeHtml(line)) + '</p>';
        }
      }
      if (inList) html += '</ul>';
      return html;
    }

    function applyInline(text) {
      return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  PROMPT BUILDER
     *  dims / measures come from layout.qHyperCube (native Qlik pickers).
     *  questionsText is a plain textarea — one question per line.
     * ═══════════════════════════════════════════════════════════════════ */
    function buildPrompt(props, selectionState) {
      var parts = [];

      var instruction = (props.promptText || '').trim();
      if (instruction) parts.push(instruction);

      if (props.outputStyle === 'bullets') {
        parts.push('Format the response as a concise bullet list.');
      } else if (props.outputStyle === 'headline') {
        parts.push('Start with a bold headline, then one supporting sentence.');
      }

      var words = LENGTH_WORDS[props.responseLength] || 150;
      parts.push('Keep the response to approximately ' + words + ' words.');

      if (props.includeSelections !== false && selectionState && selectionState.length) {
        var selParts = selectionState.map(function (s) {
          return s.fieldName + ': ' + (s.selectedValues || []).join(', ');
        }).filter(Boolean);
        if (selParts.length) {
          parts.push('\nCurrent selections in the app:\n' + selParts.join('\n'));
        }
      }

      var dims = props._dims || [];
      if (dims.length) {
        parts.push('\nDimensions to analyse: ' + dims.join(', '));
      }

      var measures = props._measures || [];
      if (measures.length) {
        parts.push('\nKey measures: ' + measures.join(', '));
      }

      if (props._followupOverride) {
        parts.push('\nPlease answer the following:\n1. ' + props._followupOverride);
      } else {
        var questionsText = (props.questionsText || '').trim();
        if (questionsText) {
          var questions = questionsText.split('\n')
            .map(function (q) { return q.trim(); })
            .filter(Boolean);
          if (questions.length) {
            var qLines = questions.map(function (q, i) { return (i + 1) + '. ' + q; });
            parts.push('\nPlease answer the following:\n' + qLines.join('\n'));
          }
        }
      }

      return parts.join('\n\n');
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  AUTH — session cookie + CSRF token (no API key required)
     * ═══════════════════════════════════════════════════════════════════ */
    var _csrfTokens = {};   /* keyed by API root — supports endpoint overrides */

    function ensureCsrfToken(root, debug) {
      if (_csrfTokens[root]) return Promise.resolve(_csrfTokens[root]);
      var url = root + '/csrf-token';
      if (debug) console.log('[AnswersInsights] GET', url);
      return fetch(url, { method: 'GET', credentials: 'include' })
        .then(function (res) {
          var token = res.headers.get('qlik-csrf-token') ||
                      res.headers.get('Qlik-Csrf-Token') || '';
          if (!token) {
            throw new Error(
              'No qlik-csrf-token header returned by /csrf-token (status ' +
              res.status + '). Are you logged in to this tenant?'
            );
          }
          _csrfTokens[root] = token;
          if (debug) console.log('[AnswersInsights] CSRF token acquired.');
          return token;
        });
    }

    function invalidateCsrfToken(root) {
      delete _csrfTokens[root];
    }

    /** True for HTTP statuses that suggest a stale CSRF token / expired session. */
    function isAuthError(err) {
      return !!(err && err.message && /\((401|403)\)/.test(err.message));
    }

    function apiHeaders(token, extra) {
      var h = { 'Content-Type': 'application/json', 'qlik-csrf-token': token };
      if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
      return h;
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  CLOUD-ASSISTANTS API
     * ═══════════════════════════════════════════════════════════════════ */
    function apiRoot(props) {
      var override = (props.answersEndpoint || '').trim().replace(/\/$/, '');
      return override || '/api/v1';
    }

    function createThread(root, token, appId, signal, debug, dbg) {
      var url  = root + '/cloud-assistants/threads';
      var body = {
        name:    'answers-insights-' + Date.now(),
        context: { type: 'app', id: appId, data: { mode: 'live', route: 'answers', custom: true } },
        messages: []
      };
      if (debug) console.log('[AnswersInsights] createThread →', url, body);
      if (dbg) dbg.requests.push({ method: 'POST', url: url, body: body });
      return fetch(url, {
        method: 'POST', credentials: 'include',
        headers: apiHeaders(token), body: JSON.stringify(body), signal: signal
      })
      .then(function (res) {
        if (dbg) dbg.log('Thread create → HTTP ' + res.status);
        if (!res.ok) return res.text().then(function (t) {
          throw new Error('Thread creation failed (' + res.status + '): ' + t);
        });
        return res.json();
      })
      .then(function (data) {
        var id = data.id || (data.data && data.data.id);
        if (!id) throw new Error('No thread id in response: ' + JSON.stringify(data));
        if (debug) console.log('[AnswersInsights] Thread id:', id);
        return id;
      });
    }

    function invokeThread(root, token, threadId, appId, promptText, reasoningMode, signal, onChunk, onReasoning, debug, dbg) {
      var url  = root + '/cloud-assistants/' + threadId + '/actions/invoke';
      var body = {
        context: { type: 'app', id: appId, data: { mode: 'live', route: 'answers', custom: true, reasoning_mode: reasoningMode || 'fast' } },
        content: [{ text: promptText }]
      };
      if (debug) console.log('[AnswersInsights] invoke →', url, body);
      if (dbg) dbg.requests.push({ method: 'POST', url: url, body: body });
      return fetch(url, {
        method: 'POST', credentials: 'include',
        headers: apiHeaders(token, { 'Accept': 'text/event-stream, application/json' }),
        body: JSON.stringify(body), signal: signal
      })
      .then(function (res) {
        if (dbg) { dbg.log('Invoke → HTTP ' + res.status); dbg.responseStatus = res.status; }
        if (!res.ok) return res.text().then(function (t) {
          throw new Error('Invoke failed (' + res.status + '): ' + t);
        });
        var ct = res.headers.get('Content-Type') || '';
        if (ct.indexOf('event-stream') > -1 && res.body) {
          return readSSEStream(res.body, onChunk, onReasoning, debug);
        }
        return res.json().then(function (data) {
          var text = extractContentText(data) || data.text || data.answer ||
                     data.response || JSON.stringify(data);
          if (debug) console.log('[AnswersInsights] response JSON:', data);
          if (onChunk) onChunk(text);
          return { text: text, lastData: data };
        });
      });
    }

    /**
     * Walks an Adaptive Card response and extracts visible TextBlocks.
     * Verified against live tenant — answer lives in content[0].card.body[].
     */
    function extractContentText(data) {
      if (!data) return '';
      var content = data.content || (data.data && data.data.content) || [];
      if (!Array.isArray(content)) return '';
      var out = [];

      function walk(el) {
        if (!el || typeof el !== 'object') return;
        if (el.isVisible === false) return;
        if (el.type === 'TextBlock' && el.text) {
          var heading = el.weight === 'bolder' || el.size === 'large' || el.size === 'medium';
          out.push(heading ? ('**' + el.text + '**') : el.text);
        }
        if (Array.isArray(el.body))    el.body.forEach(walk);
        if (Array.isArray(el.items))   el.items.forEach(walk);
        if (Array.isArray(el.columns)) el.columns.forEach(walk);
      }

      content.forEach(function (item) {
        if (item && item.text) out.push(item.text);
        if (item && item.card) walk(item.card);
      });

      return out.join('\n\n')
        .replace(/<citation[^>]*>.*?<\/citation>/gi, '')
        .replace(/<\/?[^>]+>/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
    }

    function extractFollowUpQuestions(data) {
      var followUps = [];
      if (!data) return followUps;
      var content = data.content || (data.data && data.data.content) || [];
      if (!Array.isArray(content)) return followUps;
      function walkActions(el) {
        if (!el || typeof el !== 'object') return;
        if ((el.type === 'Action.Submit' || el.type === 'Action.Execute') && el.title) {
          followUps.push(el.title);
        }
        if (Array.isArray(el.actions)) el.actions.forEach(walkActions);
        if (Array.isArray(el.body))    el.body.forEach(walkActions);
        if (Array.isArray(el.items))   el.items.forEach(walkActions);
        if (Array.isArray(el.columns)) el.columns.forEach(walkActions);
        if (el.column) walkActions(el.column);
      }
      content.forEach(function (item) { if (item && item.card) walkActions(item.card); });
      return followUps.filter(function (q) { return q !== 'View source'; });
    }

    var REASONING_EVENT_TYPES = { reasoning: true, thinking: true, agent_step: true };

    function readSSEStream(readableStream, onChunk, onReasoning, debug) {
      var decoder      = new TextDecoder();
      var reader       = readableStream.getReader();
      var buffer       = '';
      var fullText     = '';
      var lastData     = null;
      var currentEvent = '';

      function consume(chunkText) {
        if (!chunkText) return;
        if (chunkText === fullText) return;                       /* exact duplicate — ignore */
        if (chunkText.length >= fullText.length && chunkText.indexOf(fullText) === 0) {
          fullText = chunkText;                                    /* cumulative snapshot */
        } else if (chunkText.length >= 40 && fullText.indexOf(chunkText) === 0) {
          return;   /* long prefix of what we already have = stale snapshot, not a delta */
        } else {
          fullText += chunkText;                                   /* true delta */
        }
        if (onChunk) onChunk(fullText);
      }

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) return { text: fullText, lastData: lastData };
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (!line || line.charAt(0) === ':') continue;
            if (line.indexOf('event: ') === 0) {
              currentEvent = line.slice(7).trim();
              continue;
            }
            if (line.indexOf('data: ') !== 0) continue;
            var raw = line.slice(6).trim();
            if (raw === '[DONE]') {
              try { reader.cancel(); } catch (e2) {}
              return { text: fullText, lastData: lastData };
            }
            try {
              var parsed = JSON.parse(raw);
              lastData = parsed;
              var isReasoning = REASONING_EVENT_TYPES[currentEvent] ||
                                parsed.type === 'reasoning' ||
                                parsed.type === 'thinking' ||
                                parsed.type === 'agent_step';
              currentEvent = '';
              if (isReasoning) {
                var rText = (parsed.delta && parsed.delta.text) || parsed.text || parsed.content || '';
                if (rText && onReasoning) onReasoning(rText);
                continue;
              }
              var chunk =
                extractContentText(parsed) ||
                (parsed.delta && parsed.delta.text) ||
                (parsed.choices && parsed.choices[0] &&
                 parsed.choices[0].delta && parsed.choices[0].delta.content) ||
                parsed.text || parsed.content || parsed.answer || '';
              consume(chunk);
              if (debug && chunk) console.log('[AnswersInsights] SSE chunk:', chunk);
            } catch (e) { consume(raw); }
          }
          return pump();
        });
      }
      return pump();
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  HELPERS
     * ═══════════════════════════════════════════════════════════════════ */
    function getSelectionState(app) {
      try {
        var state = app.selectionState();
        var selections = [];
        if (state && state.selections) {
          state.selections.forEach(function (s) {
            if (s.fieldName && s.selectedCount > 0) {
              var values = [];
              (s.selectedValues || []).forEach(function (v) {
                values.push(v.qName || v.label || String(v));
              });
              selections.push({ fieldName: s.fieldName, selectedValues: values });
            }
          });
        }
        return selections;
      } catch (e) { return []; }
    }

    function isEditMode() {
      try {
        return qlik.navigation && qlik.navigation.getMode &&
               qlik.navigation.getMode() === 'edit';
      } catch (e) { return false; }
    }

    /** Human-friendly relative time, e.g. "just now", "3m ago", "2h ago". */
    function formatAgo(ts) {
      if (!ts) return '';
      var secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
      if (secs < 45)    return 'just now';
      if (secs < 90)    return '1m ago';
      var mins = Math.round(secs / 60);
      if (mins < 60)    return mins + 'm ago';
      var hrs = Math.round(mins / 60);
      if (hrs < 24)     return hrs + 'h ago';
      var days = Math.round(hrs / 24);
      return days + 'd ago';
    }

    /** Refresh the "Updated …" label from the stored completion time. */
    function refreshTimestamp($root) {
      var ts = $root.data('aiDoneAt');
      if (!ts) return;
      var count = $root.data('aiRunCount') || 0;
      $root.find('.answers-insights__timestamp')
        .text('Updated ' + formatAgo(ts))
        .attr('title', count + (count === 1 ? ' insight' : ' insights') + ' generated this session')
        .addClass('is-visible');
    }

    /* ── theme detection ─────────────────────────────────────────────────
     * The CSS uses Qlik theme vars (var(--qlik-color-primary, …)), which flip
     * for dark themes on their own. But when a theme leaves those vars unset,
     * we fall back to sampling the effective background luminance and tag the
     * widget with .is-dark so the stylesheet can supply light-on-dark colors. */
    function parseRgb(str) {
      var m = /rgba?\(([^)]+)\)/.exec(str || '');
      if (!m) return null;
      var p = m[1].split(',').map(function (x) { return parseFloat(x); });
      if (p.length >= 4 && p[3] === 0) return null;   /* fully transparent — keep walking */
      return { r: p[0], g: p[1], b: p[2] };
    }

    function detectDarkBackground(el) {
      try {
        var node = el;
        while (node && node !== document.documentElement) {
          var rgb = parseRgb(window.getComputedStyle(node).backgroundColor);
          if (rgb) {
            var lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
            return lum < 128;
          }
          node = node.parentElement;
        }
      } catch (e) {}
      return false;
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  CORE — generate insight
     *  Module-scope (not a method) so it never depends on `this`.
     * ═══════════════════════════════════════════════════════════════════ */
    function generateInsight($root, props, app, opts) {
      opts = opts || {};
      var debug     = !!props.debugMode;
      var prevState = $root.data('aiState');

      if (prevState === 'loading') {
        if (!opts.force) return;
        var prior = $root.data('aiAbort');
        if (prior) { try { prior.abort(); } catch (e) {} }
      }

      /* Run token — an aborted/superseded run must never touch the UI again. */
      var runId = ($root.data('aiRunId') || 0) + 1;
      $root.data('aiRunId', runId);
      function isCurrent() { return $root.data('aiRunId') === runId; }

      /* Consumption bookkeeping — track when the last run started so the
       * auto-refresh cooldown can collapse rapid selection changes. */
      $root.data('aiLastRunStart', Date.now());
      clearInterval($root.data('aiTsTimer'));   /* stop the "updated Xm ago" ticker */

      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      $root.data('aiAbort', controller);
      $root.data('aiState', 'loading');

      var $widget  = $root.find('.answers-insights');
      var $body    = $root.find('.answers-insights__body');
      var $refresh = $root.find('.answers-insights__refresh');
      var $ctxBar  = $root.find('.answers-insights__context-bar');

      $widget.attr('aria-busy', 'true');   /* a11y: announce work in progress */
      $root.find('.answers-insights__timestamp').text('').removeClass('is-visible');
      if (prevState === 'idle') {
        $body.html(buildLoadingHtml());
      } else {
        $body.stop(true).fadeOut(130, function () {
          $body.html(buildLoadingHtml()).fadeIn(160);
        });
      }
      $refresh.addClass('is-loading').prop('disabled', true);

      var selectionState = getSelectionState(app);
      var prompt         = buildPrompt(props, selectionState);
      var root           = apiRoot(props);
      var appId          = app && app.id;
      var signal         = controller ? controller.signal : undefined;

      if (debug) {
        console.log('[AnswersInsights] appId:', appId);
        console.log('[AnswersInsights] Prompt:\n', prompt);
        console.log('[AnswersInsights] Selections:', selectionState);
      }

      /* Prompt transparency panel — show the exact text being sent */
      var $promptToggle = $root.find('.ai-prompt-toggle');
      $promptToggle.find('.ai-prompt-toggle__pre').text(prompt);
      if (props.showPromptPreview) {
        $promptToggle.css('display', 'block');
      } else {
        $promptToggle.hide();
      }

      /* Developer view — capture this run's request lifecycle */
      var dbg = makeDebug(prompt, root, appId, props, selectionState);
      $root.data('aiDebug', dbg);
      dbg.log('Prompt composed');
      renderDevView($root, props);

      if (selectionState.length) {
        var pillsHtml = '<span class="ai-ctx__label">Context</span>' +
          selectionState.map(function (s) {
            var vals = s.selectedValues.slice(0, 2).join(', ') +
                       (s.selectedValues.length > 2 ? ' +' + (s.selectedValues.length - 2) : '');
            return '<span class="ai-ctx__pill">' +
                   '<span class="ai-ctx__field">' + escapeHtml(s.fieldName) + '</span>' +
                   '<span class="ai-ctx__val">' + escapeHtml(vals) + '</span>' +
                   '</span>';
          }).join('');
        $ctxBar.html(pillsHtml);
      } else {
        $ctxBar.html('<span class="ai-ctx__none">No active selections — showing overall summary</span>');
      }

      /* Rotating messages + elapsed counter */
      var msgIndex = 0;
      var timer = setInterval(function () {
        msgIndex = (msgIndex + 1) % LOADING_MSGS.length;
        $body.find('.ai-loading__msg').text(LOADING_MSGS[msgIndex]);
      }, 3000);

      var TIMEOUT_MS = 180000;
      var timedOut   = false;
      var timeoutId  = setTimeout(function () {
        timedOut = true;
        if (controller) { try { controller.abort(); } catch (e) {} }
      }, TIMEOUT_MS);

      function cleanup() {
        clearInterval(timer);
        clearTimeout(timeoutId);
        /* Only the current run may release the button — a superseded run's
         * cleanup would otherwise re-enable it while the new run is loading. */
        if (isCurrent()) {
          $refresh.removeClass('is-loading').prop('disabled', false);
          $widget.attr('aria-busy', 'false');
        }
      }

      /* a11y: the answer streams into a polite live region so screen readers
       * announce the completed text without narrating every partial chunk. */
      var $textDiv = $('<div class="answers-insights__text" role="status" aria-live="polite"></div>');
      var $reasoning = $root.find('.answers-insights__reasoning');
      var $reasoningContent = $root.find('.answers-insights__reasoning-content');
      var $followups = $root.find('.answers-insights__followups');
      var $copyBtn   = $root.find('.answers-insights__copy');
      var $printBtn  = $root.find('.answers-insights__print');

      $reasoning.hide();
      $reasoningContent.empty().hide();
      $followups.empty();
      $copyBtn.removeClass('is-entering').hide();
      $printBtn.removeClass('is-entering').hide();
      $root.data('aiReasoning', '');

      applyTextStyles($textDiv, props);
      function showText(html) {
        if (!$textDiv.parent().length) $body.html($textDiv);
        $textDiv.html(html);
      }
      function onChunk(partial) {
        if (!isCurrent()) return;
        showText(renderMarkdown(partial) + '<span class="answers-insights__cursor"></span>');
      }
      function onReasoning(text) {
        if (!isCurrent()) return;
        var prev = $root.data('aiReasoning') || '';
        $root.data('aiReasoning', prev + text);
      }

      function runFlow() {
        return ensureCsrfToken(root, debug).then(function (token) {
          dbg.log('CSRF token acquired');
          return createThread(root, token, appId, signal, debug, dbg)
            .then(function (threadId) {
              dbg.log('Thread id: ' + threadId);
              return invokeThread(root, token, threadId, appId, prompt, props.reasoningMode || 'fast', signal, onChunk, onReasoning, debug, dbg);
            });
        });
      }

      runFlow()
        .catch(function (err) {
          /* A 401/403 usually means the cached CSRF token went stale — fetch a
           * fresh one and retry the whole flow once before giving up. */
          if (isAuthError(err) && isCurrent()) {
            invalidateCsrfToken(root);
            dbg.log('Auth error (' + err.message.slice(0, 60) + ') — retrying with fresh CSRF token');
            return runFlow();
          }
          throw err;
        })
        .then(function (result) {
          if (!isCurrent()) return;
          var fullText  = (result && result.text)     ? result.text     : (result || '');
          var lastData  = (result && result.lastData) ? result.lastData : null;
          showText(renderMarkdown(fullText));
          $root.data('aiState', 'done');

          dbg.log('Response rendered');
          dbg.responseRaw = lastData || fullText || null;
          renderDevView($root, props);

          /* Reasoning section — only if dev has enabled it */
          var reasoningText = $root.data('aiReasoning') || '';
          if (reasoningText && props.showReasoning) {
            $reasoningContent.text(reasoningText);
            $reasoning.show();
          }

          /* Follow-up chips */
          if (lastData) {
            var followUps = extractFollowUpQuestions(lastData);
            if (followUps.length) {
              followUps.forEach(function (q) {
                var $chip = $('<button class="answers-insights__followup-chip"></button>').text(q);
                $chip.on('click', function () {
                  var p = $root.data('aiProps') || {};
                  p = Object.assign ? Object.assign({}, p) : $.extend({}, p);
                  p._followupOverride = q;
                  generateInsight($root, p, $root.data('aiApp'), { force: true });
                });
                $followups.append($chip);
              });
            }
          }

          /* Action buttons — slide in with animation */
          [$copyBtn, $printBtn].forEach(function ($btn) {
            $btn.removeClass('is-entering').show();
            if ($btn[0]) { void $btn[0].offsetWidth; }
            $btn.addClass('is-entering');
          });

          /* Completion timestamp — record the time, show it, and tick it
           * forward ("just now" → "3m ago") every 30s until the next run. */
          $root.data('aiDoneAt', Date.now());
          $root.data('aiRunCount', ($root.data('aiRunCount') || 0) + 1);
          refreshTimestamp($root);
          $root.data('aiTsTimer', setInterval(function () { refreshTimestamp($root); }, 30000));
        })
        .catch(function (err) {
          if (!isCurrent()) return;   /* superseded run — the new run owns the UI */
          dbg.error = (err && err.message) ? err.message : String(err);
          dbg.log('Error');
          renderDevView($root, props);
          if (err && err.name === 'AbortError') {
            if (!timedOut) return;
            $body.html(
              '<div class="answers-insights__error">' +
              '<div class="answers-insights__error-icon">' + ICON_ERROR + '</div>' +
              '<div class="answers-insights__error-content">' +
              '<strong>Timed out</strong>' +
              '<span>Qlik Answers did not respond within ' + (TIMEOUT_MS / 1000) + 's.</span>' +
              '</div>' +
              '<button class="answers-insights__error-retry">Try again</button>' +
              '</div>'
            );
            $root.data('aiState', 'error');
            return;
          }
          if (debug) console.error('[AnswersInsights]', err);
          $body.html(
            '<div class="answers-insights__error">' +
            '<div class="answers-insights__error-icon">' + ICON_ERROR + '</div>' +
            '<div class="answers-insights__error-content">' +
            '<strong>Could not generate insight</strong>' +
            '<span>' + escapeHtml(err && err.message ? err.message : String(err)) + '</span>' +
            '</div>' +
            '<button class="answers-insights__error-retry">Try again</button>' +
            '</div>'
          );
          $root.data('aiState', 'error');
        })
        .then(cleanup);
    }

    /* ═══════════════════════════════════════════════════════════════════
     *  EXTENSION DEFINITION
     * ═══════════════════════════════════════════════════════════════════ */
    return {

      definition: properties,

      initialProperties: {
        version: 1,
        qHyperCubeDef: {
          qDimensions: [],
          qMeasures:   [],
          qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 50, qHeight: 1 }]
        },
        props: {
          promptText:
            'You are a data analyst. Using the current selections and data context, ' +
            'generate a concise plain-language summary that answers the questions below. ' +
            'Keep the tone professional.',
          questionsText:     'What are the key trends?\nWhat stands out as unusual?',
          outputStyle:       'narrative',
          responseLength:    'medium',
          includeSelections: true,
          /* behaviour */
          autoRefresh:         true,
          autoRefreshCooldown: 5,
          autoRunOnLoad:       true,
          showRefreshButton:   true,
          showCopyButton:    true,
          showExportButton:  true,
          /* header */
          displayTitle:      'AI Insight',
          /* background */
          bgTransparent:     true,
          bgColor:           { color: '#ffffff', index: -1 },
          /* font */
          fontFamily:        'default',
          fontSize:          13,
          autoThemeColor:    true,
          fontColor:         { color: '#1a1a1a', index: -1 },
          fontBold:          false,
          fontItalic:        false,
          textAlign:         'left',
          lineHeight:        '1.65',
          /* border */
          showBorder:        false,
          borderColor:       { color: '#cccccc', index: -1 },
          borderWidth:       1,
          borderRadius:      4,
          /* spacing */
          padding:           'medium',
          /* api */
          answersEndpoint:   '',
          showPromptPreview: false,
          devMode:           false,
          debugMode:         false,
          reasoningMode:     'fast',
          showReasoning:     false
        }
      },

      support: { snapshot: false, export: false, exportData: false },

      /* ── paint ─────────────────────────────────────────────────────── */
      paint: function ($element, layout) {
        var props = layout.props || {};
        var app   = qlik.currApp(this);

        /* Extract dimension + measure names from the native Qlik hypercube */
        var dimNames = ((layout.qHyperCube && layout.qHyperCube.qDimensionInfo) || [])
          .map(function (d) { return d.qFallbackTitle; }).filter(Boolean);
        var measureNames = ((layout.qHyperCube && layout.qHyperCube.qMeasureInfo) || [])
          .map(function (m) { return m.qFallbackTitle; }).filter(Boolean);

        /* Shallow-copy props so we can attach _dims/_measures without mutating layout */
        var enrichedProps = {};
        var k;
        for (k in props) {
          if (Object.prototype.hasOwnProperty.call(props, k)) enrichedProps[k] = props[k];
        }
        enrichedProps._dims     = dimNames;
        enrichedProps._measures = measureNames;

        $element.data('aiProps', enrichedProps);
        $element.data('aiApp',   app);

        /* First paint — build widget chrome + bind handlers once */
        if (!$element.find('.answers-insights').length) {
          /* Always render the h4 (hidden when blank) so a title added later
           * in the properties panel appears without rebuilding the widget. */
          var titleHtml =
            '<h4 class="answers-insights__title"' +
            (props.displayTitle ? '' : ' style="display:none"') + '>' +
            escapeHtml(props.displayTitle || '') + '</h4>';
          var refreshHtml = props.showRefreshButton !== false
            ? '<button class="answers-insights__refresh" title="Regenerate insight" aria-label="Regenerate insight">' +
                ICON_REFRESH + ' Refresh' +
              '</button>'
            : '';

          $element.html(
            '<div class="answers-insights" role="region" aria-label="' +
                escapeHtml(props.displayTitle || 'AI Insight') + '" aria-busy="false">' +
              '<div class="answers-insights__header">' +
                titleHtml +
                '<div class="answers-insights__header-right">' +
                  '<span class="answers-insights__timestamp"></span>' +
                  refreshHtml +
                '</div>' +
              '</div>' +
              '<div class="answers-insights__body">' +
                '<div class="answers-insights__placeholder">' +
                  ICON_PLACEHOLDER +
                  '<p>Enter a prompt in the properties panel,<br>' +
                  'then click <strong>Refresh</strong> to generate insight.<br>' +
                  '<span style="font-size:11px;color:#999">Dimensions &amp; measures are optional.</span></p>' +
                '</div>' +
              '</div>' +
              '<div class="answers-insights__footer">' +
                '<div class="answers-insights__context-bar"></div>' +
                '<div class="answers-insights__followups"></div>' +
                '<div class="answers-insights__actions">' +
                  '<button class="answers-insights__copy" title="Copy to clipboard" aria-label="Copy insight to clipboard" style="display:none">' + ICON_COPY + ' Copy</button>' +
                  '<button class="answers-insights__print" title="Export as PDF" aria-label="Export insight as PDF" style="display:none">' + ICON_PRINT + ' Export</button>' +
                '</div>' +
                '<div class="ai-prompt-toggle" style="display:none">' +
                  '<button class="ai-prompt-toggle__btn">' + ICON_CHEVRON + '<span>View exact prompt sent</span></button>' +
                  '<pre class="ai-prompt-toggle__pre"></pre>' +
                '</div>' +
                '<div class="answers-insights__reasoning" style="display:none">' +
                  '<button class="answers-insights__reasoning-btn">' + ICON_CHEVRON + '<span>Show reasoning</span></button>' +
                  '<div class="answers-insights__reasoning-content"></div>' +
                '</div>' +
              '</div>' +
              '<div class="answers-insights__dev" style="display:none">' +
                '<button class="answers-insights__dev-header is-open">' + ICON_CHEVRON + ICON_WRENCH + '<span>Developer view</span></button>' +
                '<div class="answers-insights__dev-body"></div>' +
              '</div>' +
            '</div>'
          );
          $element.data('aiState', 'idle');

          $element.on('click', '.answers-insights__refresh', function () {
            var p = $element.data('aiProps') || {};
            generateInsight($element, p, $element.data('aiApp'), { force: true });
          });

          $element.on('click', '.answers-insights__reasoning-btn', function () {
            var $content = $element.find('.answers-insights__reasoning-content');
            var $btn = $(this);
            if ($content.is(':visible')) {
              $content.hide();
              $btn.removeClass('is-open').find('span').text('Show reasoning');
            } else {
              $content.show();
              $btn.addClass('is-open').find('span').text('Hide reasoning');
            }
          });

          $element.on('click', '.ai-prompt-toggle__btn', function () {
            var $pre = $element.find('.ai-prompt-toggle__pre');
            var $btn = $(this);
            if ($pre.is(':visible')) {
              $pre.hide();
              $btn.removeClass('is-open').find('span').text('View exact prompt sent');
            } else {
              $pre.css('display', 'block');
              $btn.addClass('is-open').find('span').text('Hide prompt');
            }
          });

          $element.on('click', '.answers-insights__dev-header', function () {
            var $devBody = $element.find('.answers-insights__dev-body');
            var $btn = $(this);
            if ($devBody.is(':visible')) {
              $devBody.hide();
              $btn.removeClass('is-open');
            } else {
              $devBody.css('display', 'block');
              $btn.addClass('is-open');
            }
          });

          $element.on('click', '.ai-dev__copy', function () {
            var $btn = $(this);
            var $pre = $btn.closest('.ai-dev__block').find('[data-copy]').first();
            var text = $pre.text();
            if (!text) return;
            var done = function (ok) {
              $btn.text(ok ? 'Copied!' : 'Failed');
              setTimeout(function () { $btn.text('Copy'); }, 1200);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
            } else {
              var $ta = $('<textarea style="position:fixed;opacity:0"></textarea>').val(text);
              $('body').append($ta);
              $ta[0].select();
              try { document.execCommand('copy'); done(true); } catch (e) { done(false); }
              $ta.remove();
            }
          });

          $element.on('click', '.answers-insights__copy', function () {
            var $btn  = $(this);
            var text  = $element.find('.answers-insights__text').text();
            if (!text) return;
            var restore = function () {
              setTimeout(function () {
                $btn.removeClass('is-success').html(ICON_COPY + ' Copy');
              }, 1500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(function () {
                $btn.addClass('is-success').html(ICON_COPY + ' Copied!');
                restore();
              }).catch(function () {
                $btn.html(ICON_COPY + ' Failed');
                restore();
              });
            } else {
              var $ta = $('<textarea style="position:fixed;opacity:0"></textarea>').val(text);
              $('body').append($ta);
              $ta[0].select();
              try { document.execCommand('copy'); $btn.addClass('is-success').html(ICON_COPY + ' Copied!'); }
              catch (e) { $btn.html(ICON_COPY + ' Failed'); }
              $ta.remove();
              restore();
            }
          });

          $element.on('click', '.answers-insights__print', function () {
            var title    = $element.find('.answers-insights__title').text() || 'AI Insight';
            var bodyHtml = $element.find('.answers-insights__text').html() || '';
            var ctxText  = $element.find('.answers-insights__context-bar').text() || '';
            var win = window.open('', '_blank', 'width=700,height=600');
            if (!win) return;
            win.document.write(
              '<!DOCTYPE html><html><head><title>' + escapeHtml(title) + '</title>' +
              '<style>' +
              'body{font-family:\'Source Sans Pro\',Arial,sans-serif;margin:40px;color:#1a1a1a;line-height:1.65}' +
              'h1{font-size:16px;font-weight:600;margin:0 0 8px}' +
              '.ctx{font-size:11px;color:#999;margin-bottom:16px}' +
              'p{margin:0 0 0.75em}ul{margin:0 0 0.75em;padding-left:1.4em}li{margin-bottom:0.3em}' +
              '</style></head><body>' +
              '<h1>' + escapeHtml(title) + '</h1>' +
              (ctxText ? '<div class="ctx">' + escapeHtml(ctxText) + '</div>' : '') +
              bodyHtml +
              '</body></html>'
            );
            win.document.close();
            win.focus();
            win.print();
          });

          $element.on('click', '.answers-insights__error-retry', function () {
            var p = $element.data('aiProps') || {};
            generateInsight($element, p, $element.data('aiApp'), { force: true });
          });

        } else {
          /* Subsequent paints — keep chrome in sync with property changes */
          $element.find('.answers-insights__title')
            .text(props.displayTitle || '')
            .toggle(!!props.displayTitle);
          $element.find('.answers-insights')
            .attr('aria-label', props.displayTitle || 'AI Insight');
        }

        /* Sync behaviour-controlled visibility on every paint */
        $element.find('.answers-insights__refresh').toggle(enrichedProps.showRefreshButton !== false);
        var hasDone = $element.data('aiState') === 'done';
        if (hasDone) {
          $element.find('.answers-insights__copy').toggle(enrichedProps.showCopyButton !== false);
          $element.find('.answers-insights__print').toggle(enrichedProps.showExportButton !== false);
        }

        /* Apply container + text styles on every paint so property changes render live */
        applyWidgetStyles($element.find('.answers-insights'), enrichedProps);
        applyTextStyles($element.find('.answers-insights__text'), enrichedProps);
        $element.find('.answers-insights').toggleClass('is-compact', $element.height() < 130);

        /* Theme awareness — tag the widget when it sits on a dark background so
         * the stylesheet can supply legible light-on-dark fallback colors. */
        $element.find('.answers-insights')
          .toggleClass('is-dark', detectDarkBackground($element[0]));

        /* Keep the "Updated Xm ago" label current across repaints */
        if ($element.data('aiState') === 'done') refreshTimestamp($element);

        /* Prompt transparency panel — keep visibility + content in sync live */
        var $promptToggle = $element.find('.ai-prompt-toggle');
        if (enrichedProps.showPromptPreview) {
          var previewPrompt = buildPrompt(enrichedProps, getSelectionState(app));
          $promptToggle.find('.ai-prompt-toggle__pre').text(previewPrompt);
          $promptToggle.css('display', 'block');
        } else {
          $promptToggle.hide();
        }

        /* Developer view — show live preview before/while idle; runs overwrite it */
        if (enrichedProps.devMode) {
          var devState = $element.data('aiState');
          if (devState !== 'loading' && devState !== 'done') {
            var sel = getSelectionState(app);
            var preview = makeDebug(buildPrompt(enrichedProps, sel),
                                    apiRoot(enrichedProps), app && app.id, enrichedProps, sel);
            preview.selectionsText += (sel.length ? '' : '  (no active selections)');
            $element.data('aiDebug', preview);
          }
          renderDevView($element, enrichedProps);
        } else {
          $element.find('.answers-insights__dev').hide();
        }

        /* Auto-run once on first analysis-mode load */
        var state    = $element.data('aiState');
        var hasInput = !!(enrichedProps.promptText || '').trim() ||
                       !!(enrichedProps.questionsText || '').trim() ||
                       dimNames.length > 0 || measureNames.length > 0;

        if (state === 'idle' && hasInput && !isEditMode() && enrichedProps.autoRunOnLoad !== false) {
          generateInsight($element, enrichedProps, app, { force: false });
        }

        /* Bind selection change listener once per element */
        if (!$element.data('selBound') && app && app.selectionState) {
          $element.data('selBound', true);
          try {
            var selState = app.selectionState();
            if (selState && selState.OnData) {
              var selListener = function () {
                clearTimeout($element.data('selTimer'));
                $element.data('selTimer', setTimeout(function () {
                  if (isEditMode()) return;
                  if ($element.data('aiState') === 'loading') return;
                  var p = $element.data('aiProps');
                  if (!p || p.autoRefresh === false) return;
                  /* Consumption guard — collapse auto-refreshes that fire within
                   * the cooldown of the previous run. Each run costs Qlik Answers
                   * consumption, so this prevents rapid selection changes from
                   * spending a request per click. Manual Refresh is never gated. */
                  var cooldown = (p.autoRefreshCooldown != null ? p.autoRefreshCooldown : 5) * 1000;
                  var lastStart = $element.data('aiLastRunStart') || 0;
                  if (cooldown > 0 && (Date.now() - lastStart) < cooldown) {
                    /* Re-arm once so the latest selection still gets an insight
                     * after the cooldown elapses, rather than being dropped. */
                    clearTimeout($element.data('selTimer'));
                    $element.data('selTimer', setTimeout(selListener, cooldown - (Date.now() - lastStart)));
                    return;
                  }
                  generateInsight($element, p, $element.data('aiApp'), { force: true });
                }, 800));
              };
              selState.OnData.bind(selListener);
              /* Keep references so beforeDestroy can unbind */
              $element.data('aiSelState', selState);
              $element.data('aiSelListener', selListener);
            }
          } catch (e) {}
        }
      },

      /* ── teardown — stop timers, abort in-flight requests, unbind listener ── */
      beforeDestroy: function ($element) {
        /* Invalidate any in-flight run so late callbacks can't touch the DOM */
        $element.data('aiRunId', ($element.data('aiRunId') || 0) + 1);
        var controller = $element.data('aiAbort');
        if (controller) { try { controller.abort(); } catch (e) {} }
        clearTimeout($element.data('selTimer'));
        clearInterval($element.data('aiTsTimer'));
        var selState = $element.data('aiSelState');
        var listener = $element.data('aiSelListener');
        if (selState && selState.OnData && listener) {
          try { selState.OnData.unbind(listener); } catch (e) {}
        }
      }
    };
  }
);
