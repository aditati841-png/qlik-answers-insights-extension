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
      $el.css({
        'font-family':   ff || '',
        'font-size':     props.fontSize  ? props.fontSize + 'px' : '13px',
        'color':         colorVal(props.fontColor) || '',
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
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2">' +
      '<rect x="4" y="6" width="24" height="20" rx="2"/>' +
      '<line x1="8" y1="12" x2="24" y2="12"/>' +
      '<line x1="8" y1="16" x2="20" y2="16"/>' +
      '<line x1="8" y1="20" x2="22" y2="20"/>' +
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
    var _csrfToken = null;

    function ensureCsrfToken(root, debug) {
      if (_csrfToken) return Promise.resolve(_csrfToken);
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
          _csrfToken = token;
          if (debug) console.log('[AnswersInsights] CSRF token acquired.');
          return token;
        });
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

    function createThread(root, token, appId, signal, debug) {
      var url  = root + '/cloud-assistants/threads';
      var body = {
        name:    'answers-insights-' + Date.now(),
        context: { type: 'app', id: appId, data: { mode: 'live', route: 'answers', custom: true } },
        messages: []
      };
      if (debug) console.log('[AnswersInsights] createThread →', url, body);
      return fetch(url, {
        method: 'POST', credentials: 'include',
        headers: apiHeaders(token), body: JSON.stringify(body), signal: signal
      })
      .then(function (res) {
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

    function invokeThread(root, token, threadId, appId, promptText, reasoningMode, signal, onChunk, onReasoning, debug) {
      var url  = root + '/cloud-assistants/' + threadId + '/actions/invoke';
      var body = {
        context: { type: 'app', id: appId, data: { mode: 'live', route: 'answers', custom: true, reasoning_mode: reasoningMode || 'fast' } },
        content: [{ text: promptText }]
      };
      if (debug) console.log('[AnswersInsights] invoke →', url, body);
      return fetch(url, {
        method: 'POST', credentials: 'include',
        headers: apiHeaders(token, { 'Accept': 'text/event-stream, application/json' }),
        body: JSON.stringify(body), signal: signal
      })
      .then(function (res) {
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
        if (chunkText.length >= fullText.length && chunkText.indexOf(fullText) === 0) {
          fullText = chunkText;
        } else {
          fullText += chunkText;
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
            if (raw === '[DONE]') return { text: fullText, lastData: lastData };
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

    /* ═══════════════════════════════════════════════════════════════════
     *  CORE — generate insight
     *  Module-scope (not a method) so it never depends on `this`.
     * ═══════════════════════════════════════════════════════════════════ */
    function generateInsight($root, props, app, opts) {
      opts = opts || {};
      var debug = !!props.debugMode;

      if ($root.data('aiState') === 'loading') {
        if (!opts.force) return;
        var prior = $root.data('aiAbort');
        if (prior) { try { prior.abort(); } catch (e) {} }
      }

      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      $root.data('aiAbort', controller);
      $root.data('aiState', 'loading');

      var $body    = $root.find('.answers-insights__body');
      var $refresh = $root.find('.answers-insights__refresh');
      var $ctxBar  = $root.find('.answers-insights__context-bar');

      $body.html(buildLoadingHtml());
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

      $ctxBar.text(selectionState.length
        ? 'Context: ' + selectionState.map(function (s) {
            return s.fieldName + ' = ' +
              s.selectedValues.slice(0, 3).join(', ') +
              (s.selectedValues.length > 3 ? '…' : '');
          }).join(' | ')
        : 'No active selections — showing overall summary'
      );

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
        $refresh.removeClass('is-loading').prop('disabled', false);
      }

      var $textDiv = $('<div class="answers-insights__text"></div>');
      var $reasoning = $root.find('.answers-insights__reasoning');
      var $reasoningContent = $root.find('.answers-insights__reasoning-content');
      var $followups = $root.find('.answers-insights__followups');
      var $copyBtn   = $root.find('.answers-insights__copy');
      var $printBtn  = $root.find('.answers-insights__print');

      $reasoning.hide();
      $reasoningContent.empty().hide();
      $followups.empty();
      $copyBtn.hide();
      $printBtn.hide();
      $root.data('aiReasoning', '');

      applyTextStyles($textDiv, props);
      function showText(html) {
        if (!$textDiv.parent().length) $body.html($textDiv);
        $textDiv.html(html);
      }
      function onChunk(partial) {
        showText(renderMarkdown(partial) + '<span class="answers-insights__cursor"></span>');
      }
      function onReasoning(text) {
        var prev = $root.data('aiReasoning') || '';
        $root.data('aiReasoning', prev + text);
      }

      ensureCsrfToken(root, debug)
        .then(function (token) {
          return createThread(root, token, appId, signal, debug)
            .then(function (threadId) {
              return invokeThread(root, token, threadId, appId, prompt, props.reasoningMode || 'fast', signal, onChunk, onReasoning, debug);
            });
        })
        .then(function (result) {
          var fullText  = (result && result.text)     ? result.text     : (result || '');
          var lastData  = (result && result.lastData) ? result.lastData : null;
          showText(renderMarkdown(fullText));
          $root.data('aiState', 'done');

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

          /* Action buttons */
          $copyBtn.show();
          $printBtn.show();
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') {
            if (!timedOut) return;
            $body.html(
              '<div class="answers-insights__error">' +
              '<strong>Timed out</strong> — Qlik Answers did not respond within ' +
              (TIMEOUT_MS / 1000) + 's. Click Refresh to try again.' +
              '</div>'
            );
            $root.data('aiState', 'error');
            return;
          }
          if (debug) console.error('[AnswersInsights]', err);
          $body.html(
            '<div class="answers-insights__error">' +
            '<strong>Could not generate insight</strong> — ' +
            escapeHtml(err && err.message ? err.message : String(err)) +
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
          autoRefresh:       true,
          autoRunOnLoad:     true,
          showRefreshButton: true,
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
          var titleHtml = props.displayTitle
            ? '<h4 class="answers-insights__title">' + escapeHtml(props.displayTitle) + '</h4>'
            : '<span></span>';
          var refreshHtml = props.showRefreshButton !== false
            ? '<button class="answers-insights__refresh" title="Regenerate insight">' +
                ICON_REFRESH + ' Refresh' +
              '</button>'
            : '';

          $element.html(
            '<div class="answers-insights">' +
              '<div class="answers-insights__header">' + titleHtml + refreshHtml + '</div>' +
              '<div class="answers-insights__body">' +
                '<div class="answers-insights__placeholder">' +
                  ICON_PLACEHOLDER +
                  '<p>Enter a prompt in the properties panel,<br>' +
                  'then click <strong>Refresh</strong> to generate insight.<br>' +
                  '<span style="font-size:11px;color:#999">Dimensions &amp; measures are optional.</span></p>' +
                '</div>' +
              '</div>' +
              '<div class="answers-insights__context-bar"></div>' +
              '<div class="ai-prompt-toggle" style="display:none">' +
                '<button class="ai-prompt-toggle__btn">' + ICON_CHEVRON + '<span>View exact prompt sent</span></button>' +
                '<pre class="ai-prompt-toggle__pre"></pre>' +
              '</div>' +
              '<div class="answers-insights__reasoning" style="display:none">' +
                '<button class="answers-insights__reasoning-btn">' + ICON_CHEVRON + '<span>Show reasoning</span></button>' +
                '<div class="answers-insights__reasoning-content"></div>' +
              '</div>' +
              '<div class="answers-insights__followups"></div>' +
              '<div class="answers-insights__actions">' +
                '<button class="answers-insights__copy" title="Copy to clipboard" style="display:none">' + ICON_COPY + ' Copy</button>' +
                '<button class="answers-insights__print" title="Export as PDF" style="display:none">' + ICON_PRINT + ' Export</button>' +
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

        } else {
          /* Subsequent paints — keep chrome in sync with property changes */
          $element.find('.answers-insights__title').text(props.displayTitle || '');
          $element.find('.answers-insights__refresh').toggle(props.showRefreshButton !== false);
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

        /* Prompt transparency panel — keep visibility + content in sync live */
        var $promptToggle = $element.find('.ai-prompt-toggle');
        if (enrichedProps.showPromptPreview) {
          var previewPrompt = buildPrompt(enrichedProps, getSelectionState(app));
          $promptToggle.find('.ai-prompt-toggle__pre').text(previewPrompt);
          $promptToggle.css('display', 'block');
        } else {
          $promptToggle.hide();
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
              selState.OnData.bind(function () {
                clearTimeout($element.data('selTimer'));
                $element.data('selTimer', setTimeout(function () {
                  if (isEditMode()) return;
                  if ($element.data('aiState') === 'loading') return;
                  var p = $element.data('aiProps');
                  if (!p || p.autoRefresh === false) return;
                  generateInsight($element, p, $element.data('aiApp'), { force: true });
                }, 800));
              });
            }
          } catch (e) {}
        }
      }
    };
  }
);
