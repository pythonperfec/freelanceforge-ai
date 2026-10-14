/**
 * FreelanceForge — Application Controller
 * Handles workbench tools, paper sheet rendering, streaming typewriter simulation,
 * input-type detection, keyboard shortcuts, and telemetry.
 */

// Tool definitions and sample scenarios
// Tool definitions, pretext instructions, clean starter outlines, and jargon guide points
const TOOLS = {
  proposal: {
    index: '01',
    title: 'Proposal Draft',
    subtitle: 'Turn raw meeting bullets or voice notes into a structured, client-ready proposal.',
    docType: 'PROJECT PROPOSAL',
    inputLabel: 'Raw Meeting Notes or Client Brief',
    placeholder: 'Paste your client requirements, goals, timeline, and budget notes here...',
    pretextHeading: 'Proposal Draft Guide',
    pretextText: 'Enter your client’s problem, desired deliverables, target launch date, and budget. Columns start clean so you can type freely or click a starter outline below.',
    guidePoints: [
      { bold: 'Client & Objective:', text: 'What problem is the client trying to solve?' },
      { bold: 'Key Deliverables:', text: 'e.g., website redesign, backend API, MVP build.' },
      { bold: 'Timeline & Milestones:', text: 'Target launch week, phases, or review dates.' },
      { bold: 'Budget & Payment:', text: 'Estimated quote, hourly rate, or milestone deposits.' }
    ],
    outlines: [
      {
        name: '+ Deliverables outline',
        template: `Project Goal:
- 

Key Deliverables:
- 
- 

Target Timeline & Milestones:
- Phase 1: 
- Phase 2: 

Estimated Budget & Terms:
- Budget: $`
      },
      {
        name: '+ 3-Phase roadmap',
        template: `Objective:
- 

Phase 1 (Discovery & Architecture):
- 

Phase 2 (Engineering & Integrations):
- 

Phase 3 (Testing & Launch):
- 

Payment Schedule:
- 50% Deposit upon signing
- 50% Upon production launch`
      },
      {
        name: 'Clear desk',
        template: ''
      }
    ]
  },
  invoice: {
    index: '02',
    title: 'Invoice Value Justifier',
    subtitle: 'Translate technical commits, refactors, and hours into business ROI.',
    docType: 'INVOICE MEMORANDUM',
    inputLabel: 'Technical Tasks, Commits & Hours',
    placeholder: 'List technical fixes, hours worked, features shipped, and milestones hit this cycle...',
    pretextHeading: 'Invoice ROI Justifier Guide',
    pretextText: 'Enter the technical work you completed (commits, bug fixes, refactors, hours logged). The forge translates your engineering effort into clear business value for clients.',
    guidePoints: [
      { bold: 'Shipped Tasks:', text: 'List specific features built, bugs patched, or commits made.' },
      { bold: 'Logged Time / Rate:', text: 'Total billable hours and agreed hourly or sprint rate.' },
      { bold: 'Business ROI:', text: 'Speed improvements, uptime preserved, or checkout conversions.' },
      { bold: 'Payment Terms:', text: 'e.g., Net 15, Net 30, or milestone handover terms.' }
    ],
    outlines: [
      {
        name: '+ Sprint work log',
        template: `Sprint Tasks Completed:
- 
- 

Hours Logged & Rate:
- Rate: $
- Total Hours: 

Payment Terms: Net 15`
      },
      {
        name: '+ Maintenance & fixes',
        template: `Emergency Fixes & Security:
- 

Infrastructure Upgrades:
- 

Billable Hours: `
      },
      {
        name: 'Clear desk',
        template: ''
      }
    ]
  },
  scope: {
    index: '03',
    title: 'Scope Boundary Clarifier',
    subtitle: 'Define in-scope vs. out-of-scope boundaries and price add-on requests.',
    docType: 'STATEMENT OF WORK',
    inputLabel: 'Client Request or Scope Creep Discussion',
    placeholder: 'Paste the client request, Slack message, or email asking for extra unpaid work...',
    pretextHeading: 'Scope Boundary Guide',
    pretextText: 'Paste unexpected client requests, late-night Slack messages, or endless revision asks. The forge articulates what is covered by the current contract vs. billable add-ons.',
    guidePoints: [
      { bold: 'Original Scope:', text: 'What was agreed upon and covered in the base contract?' },
      { bold: 'New Client Ask:', text: 'The specific extra feature, revision, or late addition.' },
      { bold: 'Boundary Action:', text: 'Whether to politely decline, defer to Phase 2, or quote as an add-on.' }
    ],
    outlines: [
      {
        name: '+ Add-on request',
        template: `Original Agreed Scope:
- 

New Client Request:
- 

Target Launch Date:`
      },
      {
        name: '+ Revision pushback',
        template: `Completed Revision Rounds:
New Change Requests:
Original Contract Policy:`
      },
      {
        name: 'Clear desk',
        template: ''
      }
    ]
  },
  reply: {
    index: '04',
    title: 'Client Correspondence',
    subtitle: 'Draft 3 strategic responses to navigate delicate situations without burning bridges.',
    docType: 'CORRESPONDENCE STRATEGY',
    inputLabel: 'Client Message & Sensitive Context',
    placeholder: 'Paste the difficult client email or describe the sensitive issue (late payment, budget haggle, pushy deadline)...',
    pretextHeading: 'Client Correspondence Guide',
    pretextText: 'Paste a tricky or sensitive client message (overdue payments, unrealistic rush deadlines, or budget disputes). The forge generates 3 diplomatic, boundary-protecting responses.',
    guidePoints: [
      { bold: 'Delicate Situation:', text: 'Overdue invoice, rush deadline pushback, or payment dispute.' },
      { bold: 'Client Message:', text: 'Paste the actual client email, Slack snippet, or conversation.' },
      { bold: 'Desired Outcome:', text: 'Get paid promptly, adjust timeline, or maintain a healthy relationship.' }
    ],
    outlines: [
      {
        name: '+ Overdue invoice',
        template: `Invoice Number: #
Days Overdue: 
Amount: $
Current Project Status: `
      },
      {
        name: '+ Unrealistic rush',
        template: `Client Request: 
Missing Client Prerequisites: 
Proposed Adjusted Date: `
      },
      {
        name: 'Clear desk',
        template: ''
      }
    ]
  }
};

class WorkspaceController {
  constructor() {
    this.currentTool = 'proposal';
    this.currentOutputMarkdown = '';
    this.currentTheme = localStorage.getItem('ff_theme') || 'paper';

    this.cacheDom();
    this.applyTheme(this.currentTheme);
    this.bindEvents();
    this.switchTool('proposal');
    this.pollSystemStatus();

    // Continuous status polling every 4s to ensure model presence is always live
    setInterval(() => this.pollSystemStatus(), 4000);
  }

  cacheDom() {
    // Header
    this.themeToggleBtn = document.getElementById('theme-toggle');
    this.themeText = document.getElementById('theme-text');
    this.btnShortcuts = document.getElementById('btn-shortcuts');
    this.engineIndicator = document.getElementById('engine-indicator');
    this.engineDot = document.getElementById('engine-dot');
    this.engineLabel = document.getElementById('engine-label');
    this.demoBanner = document.getElementById('demo-banner');
    this.btnCloseBanner = document.getElementById('btn-close-banner');

    // Rail
    this.railButtons = document.querySelectorAll('.rail-item');

    // Input Pane
    this.notesInputGroup = document.getElementById('notes-input-group');

    this.toolTitle = document.getElementById('tool-title');
    this.toolSubtitle = document.getElementById('tool-subtitle');
    this.scenarioChips = document.getElementById('scenario-chips');
    this.clientNameInput = document.getElementById('client-name');
    this.toneGroup = document.getElementById('tone-group');
    this.toneButtons = document.querySelectorAll('.seg-btn');
    this.inputLabel = document.getElementById('input-label');
    this.inputTypeBadge = document.getElementById('input-type-badge');
    this.wordCounter = document.getElementById('word-counter');
    this.rawInput = document.getElementById('raw-input');
    this.btnForge = document.getElementById('btn-forge');
    this.btnForgeLabel = document.getElementById('btn-forge-label');
    this.btnStopForge = document.getElementById('btn-stop-forge');
    this.currentAbortController = null;
    this.privacyStatusText = document.getElementById('privacy-status-text');

    // Voice Note controls
    this.btnVoiceToggle = document.getElementById('btn-voice-toggle');
    this.voiceBtnText = document.getElementById('voice-btn-text');
    this.voiceNotePanel = document.getElementById('voice-note-panel');
    this.voicePulseDot = document.getElementById('voice-pulse-dot');
    this.voiceStatusText = document.getElementById('voice-status-text');
    this.voiceTimer = document.getElementById('voice-timer');
    this.btnStopVoice = document.getElementById('btn-stop-voice');
    this.btnCancelVoice = document.getElementById('btn-cancel-voice');
    this.isRecordingVoice = false;
    this.recognition = null;
    this.voiceInterval = null;
    this.voiceSeconds = 0;
    this.recordedVoiceText = '';

    // Output Pane
    this.tabPreview = document.getElementById('tab-preview');
    this.tabMarkdown = document.getElementById('tab-markdown');
    this.btnCopy = document.getElementById('btn-copy');
    this.btnExportMd = document.getElementById('btn-export-md');
    this.btnPrint = document.getElementById('btn-print');

    // Pretext Guidance Card
    this.pretextCard = document.getElementById('pretext-card');
    this.pretextHeading = document.getElementById('pretext-heading');
    this.pretextText = document.getElementById('pretext-text');

    // Output States
    this.sheetEmpty = document.getElementById('sheet-empty');
    this.sheetLoading = document.getElementById('sheet-loading');
    this.sheetError = document.getElementById('sheet-error');
    this.errorMessageText = document.getElementById('error-message-text');
    this.btnRetry = document.getElementById('btn-retry');

    // Jargon / Gibberish Alert State
    this.jargonAlertSheet = document.getElementById('jargon-alert-sheet');
    this.jargonSampleText = document.getElementById('jargon-sample-text');
    this.jargonGuideItems = document.getElementById('jargon-guide-items');
    this.btnFixInput = document.getElementById('btn-fix-input');

    // Document Paper Sheet
    this.paperSheet = document.getElementById('paper-sheet');
    this.docTypeLabel = document.getElementById('doc-type-label');
    this.docClientLabel = document.getElementById('doc-client-label');
    this.docDateLabel = document.getElementById('doc-date-label');
    this.paperBody = document.getElementById('paper-body');
    this.rawMarkdownEditor = document.getElementById('raw-markdown-editor');

    // Bottom Status Strip
    this.statusModel = document.getElementById('status-model');
    this.statusSource = document.getElementById('status-source');
    this.statusLatency = document.getElementById('status-latency');
    this.statusMemory = document.getElementById('status-memory');
    this.statusNote = document.getElementById('status-note');

    // Modal
    this.shortcutsModal = document.getElementById('shortcuts-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');

    // Backboard Memory Elements
    this.clientMemoryStrip = document.getElementById('client-memory-strip');
    this.memoryChipText = document.getElementById('memory-chip-text');
    this.btnViewMemory = document.getElementById('btn-view-memory');
    this.btnOpenMemory = document.getElementById('btn-open-memory');
    this.memoryModal = document.getElementById('memory-modal');
    this.btnCloseMemoryModal = document.getElementById('btn-close-memory-modal');
    this.vaultClientCount = document.getElementById('vault-client-count');
    this.vaultStatusText = document.getElementById('vault-status-text');
    this.memoryClientsList = document.getElementById('memory-clients-list');
    this.memoryDebounceTimer = null;
  }

  bindEvents() {
    // Return from jargon alert button
    if (this.btnFixInput) {
      this.btnFixInput.addEventListener('click', () => {
        if (this.jargonAlertSheet) this.jargonAlertSheet.hidden = true;
        if (this.sheetEmpty) this.sheetEmpty.hidden = false;
        this.setInputMode('notes');
        this.rawInput.focus();
        if (this.pretextCard) {
          this.pretextCard.style.transition = 'all 0.3s ease';
          this.pretextCard.style.borderColor = 'var(--accent-ember)';
          this.pretextCard.style.boxShadow = '0 0 0 3px var(--accent-ember-soft)';
          setTimeout(() => {
            this.pretextCard.style.borderColor = '';
            this.pretextCard.style.boxShadow = '';
          }, 1400);
        }
      });
    }

    // Stop active generation button
    if (this.btnStopForge) {
      this.btnStopForge.addEventListener('click', () => {
        this.stopForge();
      });
    }

    // Theme toggle
    this.themeToggleBtn.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Rail navigation
    this.railButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        this.switchTool(tool);
      });
    });

    // Input auto-detection & word count
    this.rawInput.addEventListener('input', () => {
      this.analyzeInput();
    });

    // Voice note listeners
    if (this.btnVoiceToggle) {
      this.btnVoiceToggle.addEventListener('click', () => {
        if (this.isRecordingVoice) {
          this.stopVoiceRecording(true);
        } else {
          this.startVoiceRecording();
        }
      });
    }

    if (this.btnStopVoice) {
      this.btnStopVoice.addEventListener('click', () => {
        this.stopVoiceRecording(true);
      });
    }

    if (this.btnCancelVoice) {
      this.btnCancelVoice.addEventListener('click', () => {
        this.stopVoiceRecording(false);
      });
    }

    // Re-check model status on clicking the indicator badge
    if (this.engineIndicator) {
      this.engineIndicator.addEventListener('click', () => {
        if (this.engineLabel) this.engineLabel.textContent = 'detecting...';
        this.pollSystemStatus();
      });
    }

    // Auto-poll model presence whenever window regains focus
    window.addEventListener('focus', () => {
      this.pollSystemStatus();
    });

    // Dismiss hosted demo warning banner
    if (this.btnCloseBanner) {
      this.btnCloseBanner.addEventListener('click', () => {
        if (this.demoBanner) this.demoBanner.hidden = true;
      });
    }

    // Tone selector
    this.toneButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.toneButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Run / Forge CTA
    this.btnForge.addEventListener('click', () => {
      this.handleForge();
    });

    // Retry on error
    this.btnRetry.addEventListener('click', () => {
      this.handleForge();
    });

    // Output view tabs
    this.tabPreview.addEventListener('click', () => this.setOutputTab('preview'));
    this.tabMarkdown.addEventListener('click', () => this.setOutputTab('markdown'));

    // Output actions
    this.btnCopy.addEventListener('click', () => this.handleCopy());
    this.btnExportMd.addEventListener('click', () => this.handleExportMd());
    this.btnPrint.addEventListener('click', () => window.print());

    // Shortcuts modal (accessible via keyboard '?' shortcut)
    if (this.btnShortcuts) {
      this.btnShortcuts.addEventListener('click', () => this.shortcutsModal?.showModal());
    }
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener('click', () => this.shortcutsModal?.close());
    }
    if (this.shortcutsModal) {
      this.shortcutsModal.addEventListener('click', (e) => {
        if (e.target === this.shortcutsModal) this.shortcutsModal.close();
      });
    }

    // Client Name input listener for Backboard memory retrieval
    if (this.clientNameInput) {
      this.clientNameInput.addEventListener('input', () => {
        clearTimeout(this.memoryDebounceTimer);
        this.memoryDebounceTimer = setTimeout(() => {
          this.checkClientMemory(this.clientNameInput.value.trim());
        }, 300);
      });
    }

    // Backboard Memory Vault Modal openers
    if (this.btnViewMemory) {
      this.btnViewMemory.addEventListener('click', () => this.openMemoryVault());
    }
    if (this.btnOpenMemory) {
      this.btnOpenMemory.addEventListener('click', () => this.openMemoryVault());
    }
    if (this.btnCloseMemoryModal) {
      this.btnCloseMemoryModal.addEventListener('click', () => this.memoryModal?.close());
    }
    if (this.memoryModal) {
      this.memoryModal.addEventListener('click', (e) => {
        if (e.target === this.memoryModal) this.memoryModal.close();
      });
    }

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger tool shortcuts if user is typing in input or textarea
      const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleForge();
      } else if (!inInput) {
        if (e.key === '1') this.switchTool('proposal');
        if (e.key === '2') this.switchTool('invoice');
        if (e.key === '3') this.switchTool('scope');
        if (e.key === '4') this.switchTool('reply');
        if (e.key.toLowerCase() === 't') this.toggleTheme();
        if (e.key === '?') {
          e.preventDefault();
          this.shortcutsModal.showModal();
        }
      }
    });
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'paper' ? 'forge' : 'paper';
    this.applyTheme(this.currentTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ff_theme', theme);
    this.themeText.textContent = theme === 'paper' ? 'Forge theme' : 'Paper theme';
  }

  switchTool(toolKey) {
    if (!TOOLS[toolKey]) return;
    this.currentTool = toolKey;
    const tool = TOOLS[toolKey];

    // Update rail
    this.railButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === toolKey);
    });

    // Update pane header
    this.toolTitle.textContent = tool.title;
    this.toolSubtitle.textContent = tool.subtitle;
    this.inputLabel.textContent = tool.inputLabel;
    this.rawInput.placeholder = tool.placeholder;

    // Update pretext guidance
    if (this.pretextHeading && tool.pretextHeading) {
      this.pretextHeading.textContent = tool.pretextHeading;
    }
    if (this.pretextText && tool.pretextText) {
      this.pretextText.textContent = tool.pretextText;
    }

    // Dismiss any previous jargon warning when switching tool
    if (this.jargonAlertSheet && !this.jargonAlertSheet.hidden) {
      this.jargonAlertSheet.hidden = true;
      if (this.sheetEmpty) this.sheetEmpty.hidden = false;
    }

    // Toggle tone control (for scope and reply)
    this.toneGroup.hidden = !['scope', 'reply'].includes(toolKey);

    // Populate clean starter outline chips (NO sample text or fake client names)
    this.scenarioChips.innerHTML = '';
    const outlines = tool.outlines || [];
    outlines.forEach(outline => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip-btn';
      chip.textContent = outline.name;
      chip.title = outline.name.toLowerCase().includes('clear') ? 'Clear inputs completely' : 'Insert clean outline template';
      chip.addEventListener('click', () => {
        if (outline.name.toLowerCase().includes('clear')) {
          this.rawInput.value = '';
          this.clientNameInput.value = '';
        } else {
          this.rawInput.value = outline.template;
        }
        this.analyzeInput();
        this.rawInput.focus();
      });
      this.scenarioChips.appendChild(chip);
    });

    this.analyzeInput();
  }

  analyzeInput() {
    const text = this.rawInput.value.trim();
    if (!text) {
      this.wordCounter.textContent = '0 words';
      this.inputTypeBadge.textContent = 'raw notes';
      return;
    }

    // Word count
    const words = text.split(/\s+/).filter(Boolean).length;
    this.wordCounter.textContent = `${words} word${words === 1 ? '' : 's'}`;

    // Pattern heuristic detection
    if (/^(\s*[-*•]|\d+\.)/m.test(text)) {
      this.inputTypeBadge.textContent = 'bullet notes';
    } else if (/@|\[\d+:\d+\s*(?:AM|PM)\]|Slack|sent you|channel/i.test(text)) {
      this.inputTypeBadge.textContent = 'Slack message';
    } else if (/Subject:|From:|Regards,|Dear |Hi team/i.test(text)) {
      this.inputTypeBadge.textContent = 'email thread';
    } else if (/\b\d{1,2}:\d{2}\b|\[laughter\]|Speaker \d/i.test(text)) {
      this.inputTypeBadge.textContent = 'voice transcript';
    } else {
      this.inputTypeBadge.textContent = 'raw text';
    }
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript + ' ';
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }
        this.recordedVoiceText = (finalStr + interimStr).trim();
        if (this.voiceStatusText) {
          this.voiceStatusText.textContent = this.recordedVoiceText
            ? `"${this.recordedVoiceText.slice(-32)}..."`
            : 'Listening... speak clearly into mic';
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition warning:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone permission was denied. Please allow microphone access in your browser to record voice notes.');
          this.stopVoiceRecording(false);
        }
      };

      recognition.onend = () => {
        if (this.isRecordingVoice) {
          try { recognition.start(); } catch {}
        }
      };

      return recognition;
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      return null;
    }
  }

  startVoiceRecording() {
    this.isRecordingVoice = true;
    this.recordedVoiceText = '';
    this.voiceSeconds = 0;

    if (this.voiceTimer) this.voiceTimer.textContent = '00:00';
    if (this.voiceNotePanel) this.voiceNotePanel.hidden = false;
    if (this.btnVoiceToggle) this.btnVoiceToggle.classList.add('recording');
    if (this.voiceBtnText) this.voiceBtnText.textContent = 'Listening...';

    // Start timer
    clearInterval(this.voiceInterval);
    this.voiceInterval = setInterval(() => {
      this.voiceSeconds++;
      const mins = String(Math.floor(this.voiceSeconds / 60)).padStart(2, '0');
      const secs = String(this.voiceSeconds % 60).padStart(2, '0');
      if (this.voiceTimer) this.voiceTimer.textContent = `${mins}:${secs}`;
    }, 1000);

    // Initialize or start speech recognition
    if (!this.recognition) {
      this.recognition = this.setupSpeechRecognition();
    }

    if (this.recognition) {
      try {
        this.recognition.start();
        if (this.voiceStatusText) {
          this.voiceStatusText.textContent = 'Recording memo... speak clearly into mic';
        }
      } catch (err) {
        console.warn('Recognition start exception:', err);
      }
    } else {
      // Browser Speech API fallback (dictation simulation)
      if (this.voiceStatusText) {
        this.voiceStatusText.textContent = 'Speech API unavailable &mdash; dictation mode active';
      }
      this.simulateVoiceMemo();
    }
  }

  simulateVoiceMemo() {
    const sampleMemo = `Quick post-call audio memo for the client file: Just stepped out of the strategy review with the client. They stressed that the mobile checkout flow must be completed first before any backend refactoring. Target budget is firm at $9,500 with 40% upfront deposit. Revisions are capped at two rounds to maintain the launch date.`;
    let idx = 0;
    clearInterval(this.simInterval);
    this.simInterval = setInterval(() => {
      if (!this.isRecordingVoice) {
        clearInterval(this.simInterval);
        return;
      }
      idx += 6;
      this.recordedVoiceText = sampleMemo.slice(0, idx);
      if (this.voiceStatusText) {
        this.voiceStatusText.textContent = `"${this.recordedVoiceText.slice(-30)}..."`;
      }
      if (idx >= sampleMemo.length) {
        clearInterval(this.simInterval);
      }
    }, 200);
  }

  stopVoiceRecording(save = true) {
    this.isRecordingVoice = false;
    clearInterval(this.voiceInterval);
    if (this.simInterval) clearInterval(this.simInterval);

    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    if (this.voiceNotePanel) this.voiceNotePanel.hidden = true;
    if (this.btnVoiceToggle) this.btnVoiceToggle.classList.remove('recording');
    if (this.voiceBtnText) this.voiceBtnText.textContent = 'Voice note';

    if (save && this.recordedVoiceText.trim()) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const memoHeader = `[VOICE MEMORANDUM TRANSCRIPT — ${now}]:\n`;
      const currentVal = this.rawInput.value.trim();
      this.rawInput.value = currentVal
        ? `${currentVal}\n\n${memoHeader}${this.recordedVoiceText}`
        : `${memoHeader}${this.recordedVoiceText}`;
      this.analyzeInput();
    }
  }

  async pollSystemStatus() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const preferred = data.preferredEngine || (data.ai?.ollama?.available ? 'ollama' : (data.ai?.cloudFallback?.configured ? 'groq' : 'synthesizer'));
        const modelName = data.engines?.[preferred]?.model || data.ai?.ollama?.model || 'llama3.1:8b';
        this.updateStatusDisplay(preferred, modelName, null);

        if (data.ai?.backboardMemory?.active) {
          this.statusMemory.textContent = 'backboard cloud';
        } else {
          this.statusMemory.textContent = 'local memory';
        }
      }
    } catch {
      this.engineLabel.textContent = 'offline mode';
    }
  }

  updateStatusDisplay(engine, modelName, latencyMs) {
    if (engine === 'ollama') {
      this.engineDot.style.backgroundColor = 'var(--status-green)';
      this.engineLabel.textContent = 'local (Llama 3.1)';
      this.statusModel.textContent = modelName || 'llama3.1:8b';
      this.statusSource.textContent = 'local (on device)';
      this.privacyStatusText.textContent = '100% local: Llama 3.1 inference running on your hardware';
      this.statusNote.textContent = '100% on-device • zero third-party telemetry';
    } else if (engine === 'groq') {
      this.engineDot.style.backgroundColor = 'var(--accent-ember)';
      this.engineLabel.textContent = 'hosted (Groq)';
      this.statusModel.textContent = modelName || 'llama-3.1-8b-instant';
      this.statusSource.textContent = 'hosted fallback (Groq)';
      this.privacyStatusText.textContent = 'Hosted demo: open-weight Llama 3.1 on Groq Cloud';
      this.statusNote.textContent = 'Hosted open weights • fast cloud inference';
    } else {
      this.engineDot.style.backgroundColor = 'var(--border-color)';
      this.engineLabel.textContent = 'template fallback';
      this.statusModel.textContent = modelName || 'Template Synthesizer (Offline Fallback)';
      this.statusSource.textContent = 'template fallback (offline)';
      this.privacyStatusText.textContent = 'Template fallback: deterministic synthesis (offline)';
      this.statusNote.textContent = 'Template fallback • offline synthesis';
    }

    if (latencyMs !== null && latencyMs !== undefined) {
      this.statusLatency.textContent = `${latencyMs} ms`;
    }

    if (this.demoBanner) {
      const isCloudHosted = engine === 'groq' || window.location.hostname.includes('onrender.com');
      this.demoBanner.hidden = !isCloudHosted;
    }
  }



  isJargonOrGibberish(raw) {
    const text = (raw || '').trim();
    if (!text) return { isJargon: false };

    // Rule 1: Check for excessive repeated characters (e.g. "DDDDD...", "aaaaaaa", "1111111")
    if (/(.)\1{4,}/i.test(text)) {
      return {
        isJargon: true,
        reason: 'Excessive repeated character sequences detected (e.g. repeated typing test keys).',
        suggestion: 'Please enter authentic project notes, client requirements, or task hours.'
      };
    }

    // Rule 2: Pattern repetition (e.g. "asdfasdfasdf", "testtesttest")
    if (/([a-zA-Z0-9]{2,6})\1{3,}/i.test(text)) {
      return {
        isJargon: true,
        reason: 'Repeated typing pattern detected.',
        suggestion: 'Please provide genuine project requirements or client communication.'
      };
    }

    const words = text.split(/\s+/).filter(Boolean);

    // Rule 3: Very short input with no substance (< 12 chars and <= 2 words)
    if (text.length < 12 && words.length <= 2) {
      return {
        isJargon: true,
        reason: 'Input is too brief to construct a valid freelance deliverable.',
        suggestion: 'Enter at least a few bullet points describing the work, hours, or deliverables.'
      };
    }

    // Rule 4: Token-level analysis for keyboard mash / unpronounceable jargon
    // e.g. "19023U10IHJIBDJIWBDUI2GHRE0", "U38309", "4714089237094710949041"
    let mashCount = 0;
    let pureNumberCount = 0;
    let normalWordCount = 0;

    for (const w of words) {
      const clean = w.replace(/[^a-zA-Z0-9]/g, '');
      if (!clean) continue;

      if (/^\d+$/.test(clean)) {
        pureNumberCount++;
        continue;
      }

      // Mixed alphanumeric noise in a single token (e.g. 19023U10IHJIBDJIWBDUI2GHRE0 or U38309)
      const hasLetters = /[a-zA-Z]/.test(clean);
      const hasDigits = /[0-9]/.test(clean);
      if (hasLetters && hasDigits && clean.length >= 6) {
        mashCount++;
        continue;
      }

      // Check for lack of vowels or 5+ consecutive consonants (unpronounceable)
      const vowels = (clean.match(/[aeiouyAEIOUY]/g) || []).length;
      const consonantCluster = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(clean);

      if (clean.length >= 6 && (vowels === 0 || consonantCluster)) {
        mashCount++;
        continue;
      }

      normalWordCount++;
    }

    // If input consists primarily of mash tokens or number sequences
    if (mashCount > 0 && (mashCount >= normalWordCount || mashCount / words.length >= 0.25)) {
      return {
        isJargon: true,
        reason: 'Unrecognized alphanumeric keyboard mashing or random test input detected.',
        suggestion: 'Please provide real project deliverables, timeline, or client instructions.'
      };
    }

    if (words.length >= 2 && normalWordCount === 0 && pureNumberCount > 0) {
      return {
        isJargon: true,
        reason: 'Input contains only random numbers with no descriptive context.',
        suggestion: 'Add descriptions for the deliverables, tasks, or rates alongside numbers.'
      };
    }

    // Rule 5: Overall letter-to-vowel distribution check for long inputs
    const allLetters = (text.match(/[a-zA-Z]/g) || []).length;
    const allVowels = (text.match(/[aeiouAEIOU]/g) || []).length;
    if (allLetters >= 16 && (allVowels / allLetters < 0.16 || allVowels / allLetters > 0.85)) {
      return {
        isJargon: true,
        reason: 'Unnatural character distribution detected.',
        suggestion: 'Please write in standard project terminology so the engine can format your document.'
      };
    }

    return { isJargon: false };
  }

  showJargonState(input, check) {
    if (this.sheetEmpty) this.sheetEmpty.hidden = true;
    if (this.sheetLoading) this.sheetLoading.hidden = true;
    if (this.sheetError) this.sheetError.hidden = true;
    if (this.paperSheet) this.paperSheet.hidden = true;
    if (this.rawMarkdownEditor) this.rawMarkdownEditor.hidden = true;

    if (this.jargonAlertSheet) {
      this.jargonAlertSheet.hidden = false;
      if (this.jargonSampleText) {
        const preview = input ? (input.length > 70 ? input.slice(0, 70) + '...' : input) : '(Empty input)';
        this.jargonSampleText.textContent = `"${preview}"`;
      }
      if (this.jargonGuideItems) {
        const tool = TOOLS[this.currentTool];
        const points = (tool && tool.guidePoints) || [
          { bold: 'Deliverables:', text: 'Features, pages, fixes, or services to build.' },
          { bold: 'Timeline / Scope:', text: 'Target delivery date, sprints, or hours required.' },
          { bold: 'Pricing / Terms:', text: 'Budget, hourly rates, or deposit structure.' }
        ];
        this.jargonGuideItems.innerHTML = points.map(pt => `<li><strong>${pt.bold}</strong> ${pt.text}</li>`).join('');
      }
    }
  }

  async handleForge() {
    const input = this.rawInput.value.trim();
    const clientName = this.clientNameInput.value.trim() || 'Client';

    if (!input) {
      this.showJargonState('', {
        isJargon: true,
        reason: 'No project requirements or task hours were entered.',
        suggestion: 'Please enter your project notes or pick an outline template on the left.'
      });
      this.rawInput.focus();
      if (this.pretextCard) {
        this.pretextCard.style.transition = 'all 0.3s ease';
        this.pretextCard.style.borderColor = 'var(--accent-ember)';
        this.pretextCard.style.boxShadow = '0 0 0 3px var(--accent-ember-soft)';
        setTimeout(() => {
          this.pretextCard.style.borderColor = '';
          this.pretextCard.style.boxShadow = '';
        }, 1800);
      }
      return;
    }

    // Heuristic Validation Rule: Check for jargon, keyboard mashing, or unpronounceable input
    const jargonCheck = this.isJargonOrGibberish(input);
    if (jargonCheck.isJargon) {
      this.showJargonState(input, jargonCheck);
      return;
    }

    // Set UI to loading state
    this.setLoadingState(true);
    this.currentAbortController = new AbortController();
    this.currentOutputMarkdown = '';

    // Initialize document header on paper sheet
    const tool = TOOLS[this.currentTool];
    this.docTypeLabel.textContent = tool.docType;
    this.docClientLabel.textContent = `Client: ${clientName}`;
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    this.docDateLabel.textContent = today;
    this.paperBody.innerHTML = '';
    this.rawMarkdownEditor.value = '';

    try {
      const startTime = performance.now();
      const response = await fetch('/api/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: this.currentTool,
          input,
          clientName,
          customSystemPrompt: null
        }),
        signal: this.currentAbortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let streamMeta = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(trimmed.slice(6));
            if (payload.error) {
              throw new Error(payload.error);
            }
            if (payload.token) {
              this.currentOutputMarkdown += payload.token;

              // Transition from loading screen to paper sheet as tokens stream in
              if (this.paperSheet.hidden) {
                this.sheetLoading.hidden = true;
                this.paperSheet.hidden = false;
              }

              // Live render into paper body
              if (window.marked) {
                this.paperBody.innerHTML = marked.parse(this.currentOutputMarkdown);
              } else {
                this.paperBody.textContent = this.currentOutputMarkdown;
              }
              this.rawMarkdownEditor.value = this.currentOutputMarkdown;
            }

            if (payload.done) {
              streamMeta = payload;
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      const elapsed = Math.round(performance.now() - startTime);

      // Final render pass
      if (this.currentOutputMarkdown) {
        this.sheetEmpty.hidden = true;
        this.sheetLoading.hidden = true;
        this.sheetError.hidden = true;
        this.paperSheet.hidden = false;
        if (window.marked) {
          this.paperBody.innerHTML = marked.parse(this.currentOutputMarkdown);
        } else {
          this.paperBody.textContent = this.currentOutputMarkdown;
        }
        this.rawMarkdownEditor.value = this.currentOutputMarkdown;
      }

      // Update bottom status strip with exact API values
      const engine = streamMeta?.engine || 'ollama';
      const modelName = streamMeta?.model || 'llama3.1:8b';
      const latency = streamMeta?.ms || elapsed;
      this.updateStatusDisplay(engine, modelName, latency);

      if (streamMeta?.backboardActive) {
        this.statusMemory.textContent = 'backboard cloud';
      }

      if (clientName) {
        setTimeout(() => this.checkClientMemory(clientName), 500);
      }

      this.setOutputTab('preview');
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Streaming stopped by user.');
        if (this.currentOutputMarkdown) {
          this.sheetLoading.hidden = true;
          this.paperSheet.hidden = false;
        }
      } else {
        console.error(err);
        this.showErrorState(err.message);
      }
    } finally {
      this.currentAbortController = null;
      this.setLoadingState(false);
    }
  }

  stopForge() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.setLoadingState(false);
  }

  setLoadingState(isLoading) {
    this.btnForge.disabled = isLoading;
    if (this.btnStopForge) {
      this.btnStopForge.hidden = !isLoading;
    }
    if (isLoading) {
      this.btnForgeLabel.textContent = 'Forging...';
      if (this.sheetEmpty) this.sheetEmpty.hidden = true;
      if (this.sheetError) this.sheetError.hidden = true;
      if (this.paperSheet) this.paperSheet.hidden = true;
      if (this.rawMarkdownEditor) this.rawMarkdownEditor.hidden = true;
      if (this.jargonAlertSheet) this.jargonAlertSheet.hidden = true;
      if (this.sheetLoading) this.sheetLoading.hidden = false;

      // Reset loading terminal steps
      const s1 = document.getElementById('load-step-1');
      const s2 = document.getElementById('load-step-2');
      const s3 = document.getElementById('load-step-3');
      s1.classList.remove('pending');
      s2.classList.add('pending');
      s3.classList.add('pending');

      setTimeout(() => s2?.classList.remove('pending'), 400);
      setTimeout(() => s3?.classList.remove('pending'), 800);
    } else {
      this.btnForgeLabel.textContent = 'Forge Deliverable';
      if (this.sheetLoading) this.sheetLoading.hidden = true;
    }
  }

  showErrorState(msg) {
    if (this.sheetLoading) this.sheetLoading.hidden = true;
    if (this.paperSheet) this.paperSheet.hidden = true;
    if (this.rawMarkdownEditor) this.rawMarkdownEditor.hidden = true;
    if (this.sheetEmpty) this.sheetEmpty.hidden = true;
    if (this.jargonAlertSheet) this.jargonAlertSheet.hidden = true;
    if (this.sheetError) this.sheetError.hidden = false;
    if (this.errorMessageText) this.errorMessageText.textContent = msg;
  }

  async streamToPaper(data, elapsedMs, clientName) {
    this.currentOutputMarkdown = data.content || data.text || '';
    const tool = TOOLS[this.currentTool];

    // Document header info
    this.docTypeLabel.textContent = tool.docType;
    this.docClientLabel.textContent = `Client: ${clientName}`;
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    this.docDateLabel.textContent = today;

    // Update bottom status strip with actual metrics
    const engine = data.engine || (data.isLocal ? 'ollama' : 'groq');
    this.updateStatusDisplay(engine, data.model || data.modelUsed, data.ms || data.durationMs || elapsedMs);

    if (data.backboardActive) {
      this.statusMemory.textContent = 'backboard cloud';
    }

    // Show paper sheet and hide other states
    if (this.sheetEmpty) this.sheetEmpty.hidden = true;
    if (this.sheetLoading) this.sheetLoading.hidden = true;
    if (this.sheetError) this.sheetError.hidden = true;
    if (this.jargonAlertSheet) this.jargonAlertSheet.hidden = true;
    if (this.paperSheet) this.paperSheet.hidden = false;
    this.rawMarkdownEditor.value = this.currentOutputMarkdown;

    // Progressive rendering
    if (window.marked) {
      this.paperBody.innerHTML = marked.parse(this.currentOutputMarkdown);
    } else {
      this.paperBody.textContent = this.currentOutputMarkdown;
    }

    this.setOutputTab('preview');
  }

  setOutputTab(tabMode) {
    if (tabMode === 'preview') {
      this.tabPreview.classList.add('active');
      this.tabMarkdown.classList.remove('active');
      if (this.currentOutputMarkdown) {
        this.paperSheet.hidden = false;
        this.rawMarkdownEditor.hidden = true;
      }
    } else {
      this.tabMarkdown.classList.add('active');
      this.tabPreview.classList.remove('active');
      if (this.currentOutputMarkdown) {
        this.paperSheet.hidden = true;
        this.rawMarkdownEditor.hidden = false;
      }
    }
  }

  async handleCopy() {
    if (!this.currentOutputMarkdown) return;
    try {
      await navigator.clipboard.writeText(this.currentOutputMarkdown);
      const textSpan = this.btnCopy.querySelector('.action-text');
      const original = textSpan.textContent;
      textSpan.textContent = 'Copied ✓';
      setTimeout(() => {
        textSpan.textContent = original;
      }, 1600);
    } catch {
      alert('Unable to copy automatically. Please copy from the Raw Markdown view.');
    }
  }

  handleExportMd() {
    if (!this.currentOutputMarkdown) return;
    const client = (this.clientNameInput.value.trim() || 'client')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const filename = `${client}-${this.currentTool}.md`;

    const blob = new Blob([this.currentOutputMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async checkClientMemory(clientName) {
    if (!this.clientMemoryStrip) return;
    if (!clientName || clientName.length < 2) {
      this.clientMemoryStrip.hidden = true;
      return;
    }

    try {
      const res = await fetch(`/api/memory/client/${encodeURIComponent(clientName)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.context) {
          const terms = data.context.terms || {};
          const historyCount = data.context.history?.length || 0;
          let labelParts = [];
          if (terms.rate) labelParts.push(`Rate: ${terms.rate}`);
          if (terms.paymentTerms) labelParts.push(`Terms: ${terms.paymentTerms}`);
          if (historyCount > 0) labelParts.push(`${historyCount} engagement${historyCount === 1 ? '' : 's'}`);
          if (data.context.memories?.length) labelParts.push(`${data.context.memories.length} cloud memories`);

          const desc = labelParts.length > 0 ? labelParts.join(' • ') : 'Client profile active';
          if (this.memoryChipText) {
            this.memoryChipText.textContent = `Backboard Memory: ${desc}`;
          }
          this.clientMemoryStrip.hidden = false;
          return;
        }
      }
      this.clientMemoryStrip.hidden = true;
    } catch {
      this.clientMemoryStrip.hidden = true;
    }
  }

  async openMemoryVault() {
    if (!this.memoryModal) return;
    this.memoryModal.showModal();

    try {
      const [statusRes, clientsRes] = await Promise.all([
        fetch('/api/memory/status').then(r => r.json()).catch(() => ({})),
        fetch('/api/memory/clients').then(r => r.json()).catch(() => ({ clients: [] }))
      ]);

      if (this.vaultStatusText) {
        this.vaultStatusText.textContent = statusRes.cloudActive
          ? `Backboard Cloud Vector Memory: Active (Assistant: ${statusRes.assistantId ? statusRes.assistantId.slice(0, 10) + '...' : 'ready'})`
          : 'Backboard Local Persistent Memory: Active';
      }

      const clients = clientsRes.clients || [];
      if (this.vaultClientCount) {
        this.vaultClientCount.textContent = `${clients.length} Client${clients.length === 1 ? '' : 's'} Remembered`;
      }

      if (this.memoryClientsList) {
        if (clients.length === 0) {
          this.memoryClientsList.innerHTML = `
            <div class="memory-empty-state">
              <p>No client memories stored yet. As you generate proposals and invoices with client names, Backboard automatically tracks agreed rates, payment terms, and deliverable histories.</p>
            </div>`;
        } else {
          this.memoryClientsList.innerHTML = clients.map(c => `
            <div class="memory-client-card">
              <div class="client-card-info">
                <span class="client-card-name">${this.escapeHtml(c.name)}</span>
                <div class="client-card-meta">
                  ${c.rate ? `<span class="client-badge-rate">Rate: ${this.escapeHtml(c.rate)}</span>` : ''}
                  ${c.paymentTerms ? `<span class="client-badge-terms">Terms: ${this.escapeHtml(c.paymentTerms)}</span>` : ''}
                  <span>${c.interactionsCount} engagement${c.interactionsCount === 1 ? '' : 's'}</span>
                </div>
              </div>
              <button type="button" class="btn-client-delete" data-client="${this.escapeHtml(c.name)}" title="Clear memory for this client">
                Forget
              </button>
            </div>
          `).join('');

          // Bind delete buttons
          this.memoryClientsList.querySelectorAll('.btn-client-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
              const name = btn.getAttribute('data-client');
              if (confirm(`Forget all Backboard memory for "${name}"?`)) {
                await fetch(`/api/memory/client/${encodeURIComponent(name)}`, { method: 'DELETE' });
                this.openMemoryVault();
                if (this.clientNameInput && this.clientNameInput.value.trim().toLowerCase() === name.toLowerCase()) {
                  this.checkClientMemory(name);
                }
              }
            });
          });
        }
      }
    } catch (err) {
      console.error('Error fetching memory vault:', err);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  new WorkspaceController();
});
