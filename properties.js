define([], function () {

  /* ─── Prompt & Narrative ─────────────────────────────────────────────── */
  var promptSection = {
    type: 'items',
    label: 'Prompt & Narrative',
    items: {
      promptText: {
        ref: 'props.promptText',
        label: 'Instruction prompt',
        type: 'string',
        component: 'textarea',
        rows: 5,
        defaultValue:
          'You are a data analyst. Using the current selections and data context, ' +
          'generate a concise plain-language summary that answers the questions below. ' +
          'Keep the tone professional.',
        expression: 'none'
      },
      questionsText: {
        ref: 'props.questionsText',
        label: 'Questions to answer (one per line)',
        type: 'string',
        component: 'textarea',
        rows: 4,
        defaultValue: 'What are the key trends?\nWhat stands out as unusual?',
        expression: 'none'
      },
      outputStyle: {
        ref: 'props.outputStyle',
        label: 'Output style',
        type: 'string',
        component: 'dropdown',
        defaultValue: 'narrative',
        options: [
          { value: 'narrative', label: 'Narrative paragraph'  },
          { value: 'bullets',   label: 'Bullet points'        },
          { value: 'headline',  label: 'Headline + one-liner' }
        ]
      },
      responseLength: {
        ref: 'props.responseLength',
        label: 'Approximate length',
        type: 'string',
        component: 'dropdown',
        defaultValue: 'medium',
        options: [
          { value: 'short',  label: 'Short  (~50 words)'  },
          { value: 'medium', label: 'Medium (~150 words)' },
          { value: 'long',   label: 'Long   (~300 words)' }
        ]
      },
      includeSelections: {
        ref: 'props.includeSelections',
        label: 'Include current filter / selection context',
        type: 'boolean',
        component: 'switch',
        options: [
          { value: true,  label: 'Yes' },
          { value: false, label: 'No'  }
        ],
        defaultValue: true
      },
    }
  };

  /* ─── Appearance ─────────────────────────────────────────────────────── */
  var appearanceSection = {
    type: 'items',
    label: 'Appearance',
    items: {

      /* Header controls */
      displayTitle: {
        ref: 'props.displayTitle',
        label: 'Header title (leave blank to hide)',
        type: 'string',
        defaultValue: 'AI Insight',
        expression: 'none'
      },

      /* Background */
      bgHeader: {
        label: 'Background',
        component: 'text'
      },
      bgTransparent: {
        ref: 'props.bgTransparent',
        label: 'Transparent background',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }],
        defaultValue: true
      },
      bgColor: {
        ref: 'props.bgColor',
        label: 'Background color',
        type: 'object',
        component: 'color-picker',
        defaultValue: { color: '#ffffff', index: -1 },
        show: function (data) {
          return data && data.props && !data.props.bgTransparent;
        }
      },

      /* Font */
      fontHeader: {
        label: 'Font',
        component: 'text'
      },
      fontFamily: {
        ref: 'props.fontFamily',
        label: 'Font family',
        type: 'string',
        component: 'dropdown',
        defaultValue: 'default',
        options: [
          { value: 'default',                          label: 'Default (Source Sans Pro)' },
          { value: 'Arial, sans-serif',                label: 'Arial'                     },
          { value: 'Helvetica Neue, Helvetica, Arial, sans-serif', label: 'Helvetica Neue' },
          { value: 'Georgia, serif',                   label: 'Georgia'                   },
          { value: 'Times New Roman, serif',           label: 'Times New Roman'           },
          { value: 'Trebuchet MS, sans-serif',         label: 'Trebuchet MS'              },
          { value: 'Courier New, monospace',           label: 'Courier New'               }
        ]
      },
      fontSize: {
        ref: 'props.fontSize',
        label: 'Font size (px)',
        type: 'number',
        defaultValue: 13
      },
      fontColor: {
        ref: 'props.fontColor',
        label: 'Font color',
        type: 'object',
        component: 'color-picker',
        defaultValue: { color: '#1a1a1a', index: -1 }
      },
      fontBold: {
        ref: 'props.fontBold',
        label: 'Bold',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }],
        defaultValue: false
      },
      fontItalic: {
        ref: 'props.fontItalic',
        label: 'Italic',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }],
        defaultValue: false
      },
      textAlign: {
        ref: 'props.textAlign',
        label: 'Text alignment',
        type: 'string',
        component: 'dropdown',
        defaultValue: 'left',
        options: [
          { value: 'left',    label: 'Left'    },
          { value: 'center',  label: 'Center'  },
          { value: 'right',   label: 'Right'   },
          { value: 'justify', label: 'Justify' }
        ]
      },

      /* Border */
      borderHeader: {
        label: 'Border',
        component: 'text'
      },
      showBorder: {
        ref: 'props.showBorder',
        label: 'Show border',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }],
        defaultValue: false
      },
      borderColor: {
        ref: 'props.borderColor',
        label: 'Border color',
        type: 'object',
        component: 'color-picker',
        defaultValue: { color: '#cccccc', index: -1 },
        show: function (data) {
          return data && data.props && data.props.showBorder;
        }
      },
      borderWidth: {
        ref: 'props.borderWidth',
        label: 'Border width (px)',
        type: 'number',
        defaultValue: 1,
        show: function (data) {
          return data && data.props && data.props.showBorder;
        }
      },
      borderRadius: {
        ref: 'props.borderRadius',
        label: 'Corner radius (px)',
        type: 'number',
        defaultValue: 4
      },

      /* Spacing */
      spacingHeader: {
        label: 'Spacing',
        component: 'text'
      },
      padding: {
        ref: 'props.padding',
        label: 'Content padding',
        type: 'string',
        component: 'dropdown',
        defaultValue: 'medium',
        options: [
          { value: 'none',   label: 'None'         },
          { value: 'small',  label: 'Small  (8px)' },
          { value: 'medium', label: 'Medium (16px)'},
          { value: 'large',  label: 'Large  (24px)'}
        ]
      },
      lineHeight: {
        ref: 'props.lineHeight',
        label: 'Line height',
        type: 'string',
        component: 'dropdown',
        defaultValue: '1.65',
        options: [
          { value: '1.2',  label: 'Compact (1.2)'  },
          { value: '1.4',  label: 'Normal  (1.4)'  },
          { value: '1.65', label: 'Relaxed (1.65)' },
          { value: '2',    label: 'Loose   (2.0)'  }
        ]
      }
    }
  };

  /* ─── API Settings ───────────────────────────────────────────────────── */
  var apiSection = {
    type: 'items',
    label: 'API Settings',
    items: {
      apiHelp: {
        label: 'No API key needed — uses your active Qlik Cloud session. ' +
               'Turn on "Developer view" for an in-widget console showing the exact prompt, request payloads, timeline, and raw response. ' +
               '"Show exact prompt panel" is a lighter option that shows only the composed prompt. ' +
               'Debug mode logs everything to the browser console as well.',
        component: 'text'
      },
      answersEndpoint: {
        ref: 'props.answersEndpoint',
        label: 'API base URL override (leave blank — auto-detects from current origin)',
        type: 'string',
        defaultValue: '',
        expression: 'none'
      },
      showPromptPreview: {
        ref: 'props.showPromptPreview',
        label: 'Show "View exact prompt" panel (lightweight transparency)',
        type: 'boolean',
        component: 'switch',
        options: [
          { value: true,  label: 'Show' },
          { value: false, label: 'Hide' }
        ],
        defaultValue: false
      },
      devMode: {
        ref: 'props.devMode',
        label: 'Developer view (in-widget debug console)',
        type: 'boolean',
        component: 'switch',
        options: [
          { value: true,  label: 'On' },
          { value: false, label: 'Off' }
        ],
        defaultValue: false
      },
      showReasoning: {
        ref: 'props.showReasoning',
        label: 'Show reasoning to user (Thinking mode only)',
        type: 'boolean',
        component: 'switch',
        options: [
          { value: true,  label: 'Show' },
          { value: false, label: 'Hide' }
        ],
        defaultValue: false
      },
      reasoningMode: {
        ref: 'props.reasoningMode',
        label: 'Reasoning mode',
        type: 'string',
        component: 'dropdown',
        defaultValue: 'fast',
        options: [
          { value: 'fast',     label: 'Fast mode — quick answers'         },
          { value: 'thinking', label: 'Thinking mode — complex reasoning' }
        ]
      },
      debugMode: {
        ref: 'props.debugMode',
        label: 'Debug mode (log API calls + prompt to browser console)',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }],
        defaultValue: false
      }
    }
  };

  /* ─── Behaviour ─────────────────────────────────────────────────────── */
  var behaviourSection = {
    type: 'items',
    label: 'Behaviour',
    items: {
      autoRefresh: {
        ref: 'props.autoRefresh',
        label: 'Auto-refresh when selections change',
        type: 'boolean',
        component: 'switch',
        options: [
          { value: true,  label: 'On — insight updates with every selection' },
          { value: false, label: 'Off — insight stays fixed until manually refreshed' }
        ],
        defaultValue: true
      },
      autoRunOnLoad: {
        ref: 'props.autoRunOnLoad',
        label: 'Auto-run on load',
        type: 'boolean',
        component: 'switch',
        options: [
          { value: true,  label: 'On — generates insight when sheet opens' },
          { value: false, label: 'Off — waits for manual refresh' }
        ],
        defaultValue: true
      },
      showRefreshButton: {
        ref: 'props.showRefreshButton',
        label: 'Show refresh button',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'Show' }, { value: false, label: 'Hide' }],
        defaultValue: true
      },
      showCopyButton: {
        ref: 'props.showCopyButton',
        label: 'Show copy button',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'Show' }, { value: false, label: 'Hide' }],
        defaultValue: true
      },
      showExportButton: {
        ref: 'props.showExportButton',
        label: 'Show export / print button',
        type: 'boolean',
        component: 'switch',
        options: [{ value: true, label: 'Show' }, { value: false, label: 'Hide' }],
        defaultValue: true
      }
    }
  };

  /* ─── Assembly ───────────────────────────────────────────────────────── */
  return {
    type: 'items',
    component: 'accordion',
    items: {
      dimensions:  { uses: 'dimensions', min: 0, max: 50 },
      measures:    { uses: 'measures',   min: 0, max: 50 },
      prompt:      promptSection,
      behaviour:   behaviourSection,
      appearance:  appearanceSection,
      apiSettings: apiSection
    }
  };
});
