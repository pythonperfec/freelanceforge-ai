/**
 * FreelanceForge — Application Controller
 * Handles workbench tools, paper sheet rendering, streaming typewriter simulation,
 * input-type detection, keyboard shortcuts, and telemetry.
 */

// Tool definitions and sample scenarios
const TOOLS = {
  proposal: {
    index: '01',
    title: 'Proposal Draft',
    subtitle: 'Turn raw meeting bullets or voice notes into a structured, client-ready proposal.',
    docType: 'PROJECT PROPOSAL',
    inputLabel: 'Raw Meeting Notes or Client Brief',
    placeholder: 'Paste your messy meeting bullets, audio transcript, or client goals here...',
    defaultClient: 'Nexus Interactive',
    samples: [
      {
        name: 'E-commerce migration',
        client: 'Velvet & Vine Boutique',
        notes: `Met with Sarah (Founder). Current WooCommerce store is sluggish, losing mobile checkouts.
Needs:
- Migration to modern Shopify Plus or Next.js headless storefront
- Sync with Klaviyo email marketing and inventory ERP
- High-converting mobile drawer cart and 1-click Apple Pay
- Speed audit: wants sub-second Lighthouse scores
- Timeline: Needs launch before Black Friday / Cyber Monday (6 weeks)
- Budget discussed: Around $8,500 - $12,000`
      },
      {
        name: 'SaaS design sprint',
        client: 'CloudTrace Analytics',
        notes: `Founders need complete redesign of analytics dashboard before Series A pitch.
- Current UI is cluttered table view with poor information hierarchy
- Need: Modern executive summary view, custom chart filters, responsive tablet layout
- Deliverable: Figma design system, clickable prototype, and handover developer specs
- Timeline: 3 weeks firm. Budget: $7,000`
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
    defaultClient: 'HyperScale Tech',
    samples: [
      {
        name: 'Backend query refactor',
        client: 'HyperScale Logistics',
        notes: `Two-week development sprint completed:
- Refactored PostgreSQL driver queries causing deadlock timeouts during peak driver shifts (saved ~3.2s per request)
- Built live Webhook dispatcher for real-time delivery GPS tracking
- Migrated legacy Docker container to production Kubernetes cluster with zero downtime
- Debugged and patched memory leak in real-time notification microservice
- Total tracked hours: 38 hours at $110/hr
- Payment terms: Net 15`
      },
      {
        name: 'Mobile bugfix sprint',
        client: 'PayPulse Fintech',
        notes: `Emergency maintenance and payment gateway hardening:
- Resolved Stripe webhook race conditions failing 4% of checkout transactions
- Fixed biometric login crash affecting iOS 17 users
- Added automated unit test suite for card tokenization
- Logged hours: 22 hours at $125/hr`
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
    defaultClient: 'OmniHealth Inc',
    samples: [
      {
        name: 'Unpaid extra features',
        client: 'OmniHealth SaaS',
        notes: `Client sent late night Slack message:
"Hey! While building the patient intake form, can you also quickly hook up two-way SMS messaging with Twilio, build an automated Spanish/English translation toggle, and create a custom analytics PDF export for clinic directors? We need this for the launch next Tuesday!"
Current agreement only covers the English web intake form and basic CSV export.`
      },
      {
        name: 'Unlimited revisions request',
        client: 'Apex Creative Co',
        notes: `Client completed 4th round of feedback on landing page:
"Can we try testing 3 completely different visual styles and typography combinations? Also change the mascot illustration. We'll decide which one we like best."
Agreement specifies 2 revision cycles and explicitly states brand direction changes are separate work.`
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
    defaultClient: 'Horizon Studio',
    samples: [
      {
        name: 'Late invoice follow-up',
        client: 'Horizon Media Group',
        notes: `Invoice #1042 for $3,400 is now 21 days overdue (Net 14 agreement).
Client CFO hasn't responded to the automated billing reminders.
Next scheduled feature release is ready on staging, but policy is to pause deployments when payments are delinquent. Need to enforce this professionally without ruining a potentially good relationship.`
      },
      {
        name: 'Pushy deadline pushback',
        client: 'MetricFlow Systems',
        notes: `Client delayed sending necessary API keys and design assets by 12 business days, but still expects the original hard launch date next Monday.
Need to calmly clarify that the launch date shifts day-for-day based on when client prerequisites are received.`
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
  }

  cacheDom() {
    // Header
    this.themeToggleBtn = document.getElementById('theme-toggle');
    this.themeText = document.getElementById('theme-text');
    this.btnShortcuts = document.getElementById('btn-shortcuts');
    this.engineDot = document.getElementById('engine-dot');
    this.engineLabel = document.getElementById('engine-label');

    // Rail
    this.railButtons = document.querySelectorAll('.rail-item');

    // Input Pane
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
    this.privacyStatusText = document.getElementById('privacy-status-text');

    // Output Pane
    this.tabPreview = document.getElementById('tab-preview');
    this.tabMarkdown = document.getElementById('tab-markdown');
    this.btnCopy = document.getElementById('btn-copy');
    this.btnExportMd = document.getElementById('btn-export-md');
    this.btnPrint = document.getElementById('btn-print');

    // Output States
    this.sheetEmpty = document.getElementById('sheet-empty');
    this.sheetLoading = document.getElementById('sheet-loading');
    this.sheetError = document.getElementById('sheet-error');
    this.errorMessageText = document.getElementById('error-message-text');
    this.btnRetry = document.getElementById('btn-retry');

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
  }

  bindEvents() {
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

    // Shortcuts modal
    this.btnShortcuts.addEventListener('click', () => this.shortcutsModal.showModal());
    this.btnCloseModal.addEventListener('click', () => this.shortcutsModal.close());
    this.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === this.shortcutsModal) this.shortcutsModal.close();
    });

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

    // Set default client if blank
    if (!this.clientNameInput.value.trim()) {
      this.clientNameInput.value = tool.defaultClient;
    }

    // Toggle tone control (for scope and reply)
    this.toneGroup.hidden = !['scope', 'reply'].includes(toolKey);

    // Populate scenario chips
    this.scenarioChips.innerHTML = '';
    tool.samples.forEach(sample => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip-btn';
      chip.textContent = sample.name;
      chip.addEventListener('click', () => {
        this.clientNameInput.value = sample.client;
        this.rawInput.value = sample.notes;
        this.analyzeInput();
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

  async pollSystemStatus() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const isOllama = data.ai?.ollama?.available;
        const isCloud = data.ai?.cloudFallback?.configured;

        if (isOllama) {
          this.engineDot.style.backgroundColor = 'var(--status-green)';
          this.engineLabel.textContent = 'local (Llama 3.1)';
          this.statusModel.textContent = data.ai.ollama.model || 'llama3.1:8b';
          this.statusSource.textContent = 'local (on device)';
          this.privacyStatusText.textContent = 'Local-first: text remains on your hardware';
          this.statusNote.textContent = '100% on-device • zero third-party telemetry';
        } else if (isCloud) {
          this.engineDot.style.backgroundColor = 'var(--accent-ember)';
          this.engineLabel.textContent = 'hosted fallback';
          this.statusModel.textContent = data.ai.cloudFallback.model || 'llama-3.1-8b';
          this.statusSource.textContent = 'hosted fallback (Render)';
          this.privacyStatusText.textContent = 'Hosted demo: queries open-weight Llama 3.1';
          this.statusNote.textContent = 'Hosted demo endpoint • identical open weights';
        } else {
          this.engineDot.style.backgroundColor = 'var(--status-green)';
          this.engineLabel.textContent = 'local ready';
          this.statusModel.textContent = 'llama3.1:8b';
          this.statusSource.textContent = 'local synthesis';
          this.privacyStatusText.textContent = 'Local simulation: data stays on machine';
        }

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

  async handleForge() {
    const input = this.rawInput.value.trim();
    const clientName = this.clientNameInput.value.trim() || 'Client';

    if (!input) {
      alert('Please enter or select some project notes first.');
      this.rawInput.focus();
      return;
    }

    // Set UI to loading state
    this.setLoadingState(true);

    try {
      const startTime = performance.now();
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: this.currentTool,
          input,
          clientName
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Server returned an error.');
      }

      const data = await response.json();
      const elapsed = Math.round(performance.now() - startTime);

      // Render document with progressive typewriter simulation
      await this.streamToPaper(data, elapsed, clientName);
    } catch (err) {
      console.error(err);
      this.showErrorState(err.message);
    } finally {
      this.setLoadingState(false);
    }
  }

  setLoadingState(isLoading) {
    this.btnForge.disabled = isLoading;
    if (isLoading) {
      this.btnForgeLabel.textContent = 'Forging...';
      this.sheetEmpty.hidden = true;
      this.sheetError.hidden = true;
      this.paperSheet.hidden = true;
      this.rawMarkdownEditor.hidden = true;
      this.sheetLoading.hidden = false;

      // Reset loading terminal steps
      const s1 = document.getElementById('load-step-1');
      const s2 = document.getElementById('load-step-2');
      const s3 = document.getElementById('load-step-3');
      s1.classList.remove('pending');
      s2.classList.add('pending');
      s3.classList.add('pending');

      setTimeout(() => s2.classList.remove('pending'), 400);
      setTimeout(() => s3.classList.remove('pending'), 800);
    } else {
      this.btnForgeLabel.textContent = 'Forge Deliverable';
      this.sheetLoading.hidden = true;
    }
  }

  showErrorState(msg) {
    this.sheetLoading.hidden = true;
    this.paperSheet.hidden = true;
    this.rawMarkdownEditor.hidden = true;
    this.sheetEmpty.hidden = true;
    this.sheetError.hidden = false;
    this.errorMessageText.textContent = msg;
  }

  async streamToPaper(data, elapsedMs, clientName) {
    this.currentOutputMarkdown = data.content || '';
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
    this.statusModel.textContent = data.modelUsed || 'llama3.1:8b';
    this.statusSource.textContent = data.isLocal ? 'local (on device)' : 'hosted fallback (Render)';
    this.statusLatency.textContent = `${data.durationMs || elapsedMs} ms`;
    this.statusMemory.textContent = data.backboardActive ? 'backboard cloud' : 'local memory';

    // Show paper sheet
    this.sheetEmpty.hidden = true;
    this.sheetLoading.hidden = true;
    this.sheetError.hidden = true;
    this.paperSheet.hidden = false;
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
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  new WorkspaceController();
});
