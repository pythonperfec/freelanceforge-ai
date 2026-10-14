/**
 * FreelanceForge AI — Client Application Controller
 * Handles UI reactivity, tool switching, scenario loading, Markdown rendering,
 * and deliverable exports.
 */

// Pre-built realistic freelancer scenarios for 1-click testing
const SCENARIOS = {
  'proposal-ecommerce': {
    tool: 'proposal',
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
  'invoice-consulting': {
    tool: 'invoice',
    client: 'HyperScale Logistics',
    notes: `Two-week development sprint completed:
- Refactored PostgreSQL driver queries causing deadlock timeouts during peak driver shifts (saved ~3.2s per request)
- Built live Webhook dispatcher for real-time delivery GPS tracking
- Migrated legacy Docker container to production Kubernetes cluster with zero downtime
- Debugged and patched memory leak in real-time notification microservice
- Total tracked hours: 38 hours at $110/hr
- Payment terms: Net 15`
  },
  'scope-extra-features': {
    tool: 'scope',
    client: 'OmniHealth SaaS',
    notes: `Client sent late night Slack message:
"Hey! While building the patient intake form, can you also quickly hook up two-way SMS messaging with Twilio, build an automated Spanish/English translation toggle, and create a custom analytics PDF export for clinic directors? We need this for the launch next Tuesday!"
Current agreement only covers the English web intake form and basic CSV export.`
  },
  'reply-late-payment': {
    tool: 'reply',
    client: 'Horizon Media Group',
    notes: `Invoice #1042 for $3,400 is now 21 days overdue (Net 14 agreement).
Client CFO hasn't responded to the automated billing reminders.
Next scheduled feature release is ready on staging, but policy is to pause deployments when payments are delinquent. Need to enforce this professionally without ruining a potentially good relationship.`
  }
};

const TOOL_CONFIG = {
  proposal: {
    heading: 'Input Project & Client Brief',
    label: 'Raw Notes or Meeting Bullets',
    placeholder: 'Paste messy client conversation notes, audio voice note transcripts, or raw requirements here...',
    defaultClient: 'Apex Digital'
  },
  invoice: {
    heading: 'Input Sprint & Task Details',
    label: 'Technical Hours & Work Completed',
    placeholder: 'List technical fixes, hours worked, features shipped, and milestones hit this cycle...',
    defaultClient: 'HyperScale Tech'
  },
  scope: {
    heading: 'Input Vague or Out-of-Scope Requests',
    label: 'Client Scope Creep Notes',
    placeholder: 'Paste the client request, Slack message, or email asking for extra unpaid work...',
    defaultClient: 'OmniHealth Inc'
  },
  reply: {
    heading: 'Input Difficult Situation Context',
    label: 'Client Message & Desired Boundary',
    placeholder: 'Paste the difficult client email or describe the sensitive issue (late payment, budget haggle, pushy deadline)...',
    defaultClient: 'Horizon Studio'
  }
};

class AppController {
  constructor() {
    this.currentTool = 'proposal';
    this.currentOutputMarkdown = '';
    this.initElements();
    this.attachEventListeners();
    this.checkSystemHealth();
  }

  initElements() {
    // Nav & Status
    this.ollamaPillText = document.getElementById('ollama-status-text');
    this.backboardPill = document.getElementById('backboard-status-pill');

    // Tool Tabs
    this.tabs = document.querySelectorAll('.tool-tab');

    // Input elements
    this.inputHeading = document.getElementById('input-heading');
    this.notesLabel = document.getElementById('notes-label');
    this.clientInput = document.getElementById('client-name-input');
    this.notesTextarea = document.getElementById('notes-textarea');
    this.sampleSelect = document.getElementById('sample-select');
    this.charCount = document.getElementById('char-count');
    this.btnGenerate = document.getElementById('btn-generate');
    this.btnSpinner = document.getElementById('btn-spinner');
    this.btnText = this.btnGenerate.querySelector('.btn-text');

    // Output elements
    this.outputArea = document.getElementById('output-content-area');
    this.emptyState = document.getElementById('empty-state');
    this.renderedView = document.getElementById('rendered-view');
    this.rawMarkdownView = document.getElementById('raw-markdown-view');
    this.metaModel = document.getElementById('meta-model');
    this.metaLatency = document.getElementById('meta-latency');
    this.metaMemory = document.getElementById('meta-memory');

    // Action buttons
    this.btnViewRendered = document.getElementById('btn-view-rendered');
    this.btnViewMarkdown = document.getElementById('btn-view-markdown');
    this.btnCopy = document.getElementById('btn-copy');
    this.btnDownload = document.getElementById('btn-download');
    this.btnPrint = document.getElementById('btn-print');
  }

  attachEventListeners() {
    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tool = tab.getAttribute('data-tool');
        this.switchTool(tool);
      });
    });

    // Sample selection
    this.sampleSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected && SCENARIOS[selected]) {
        const scenario = SCENARIOS[selected];
        this.switchTool(scenario.tool);
        this.clientInput.value = scenario.client;
        this.notesTextarea.value = scenario.notes;
        this.updateWordCount();
      }
    });

    // Word count calculation
    this.notesTextarea.addEventListener('input', () => this.updateWordCount());

    // Generate CTA
    this.btnGenerate.addEventListener('click', () => this.handleGenerate());

    // Output view toggles
    this.btnViewRendered.addEventListener('click', () => this.setViewMode('rendered'));
    this.btnViewMarkdown.addEventListener('click', () => this.setViewMode('markdown'));

    // Actions
    this.btnCopy.addEventListener('click', () => this.handleCopy());
    this.btnDownload.addEventListener('click', () => this.handleDownload());
    this.btnPrint.addEventListener('click', () => window.print());
  }

  switchTool(tool) {
    if (!TOOL_CONFIG[tool]) return;
    this.currentTool = tool;

    // Update active tab UI
    this.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tool') === tool);
    });

    const cfg = TOOL_CONFIG[tool];
    this.inputHeading.textContent = cfg.heading;
    this.notesLabel.textContent = cfg.label;
    this.notesTextarea.placeholder = cfg.placeholder;
    if (!this.clientInput.value.trim()) {
      this.clientInput.value = cfg.defaultClient;
    }
  }

  updateWordCount() {
    const text = this.notesTextarea.value.trim();
    if (!text) {
      this.charCount.textContent = '0 words';
      return;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    this.charCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
  }

  async checkSystemHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.ai?.ollama?.available) {
          this.ollamaPillText.textContent = `Llama 3.1 8B (Local)`;
          this.ollamaPillText.parentElement.querySelector('.status-dot').style.background = '#10b981';
        } else if (data.ai?.cloudFallback?.configured) {
          this.ollamaPillText.textContent = `Llama 3.1 (Groq Cloud)`;
        } else {
          this.ollamaPillText.textContent = `Llama 3.1 (Simulated/Ready)`;
        }

        if (data.ai?.backboardMemory?.active) {
          this.backboardPill.title = 'Backboard Cloud Sync Active';
        } else {
          this.backboardPill.title = 'Backboard Local Memory Active';
        }
      }
    } catch {
      this.ollamaPillText.textContent = 'Local Mode Active';
    }
  }

  async handleGenerate() {
    const input = this.notesTextarea.value.trim();
    const clientName = this.clientInput.value.trim() || 'Valued Client';

    if (!input) {
      alert('Please enter or select some project notes first.');
      this.notesTextarea.focus();
      return;
    }

    // Set Loading state
    this.setLoading(true);

    try {
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
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate deliverable.');
      }

      const data = await response.json();
      this.renderOutput(data);
    } catch (err) {
      console.error(err);
      alert(`Generation Error: ${err.message}`);
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(isLoading) {
    this.btnGenerate.disabled = isLoading;
    this.btnSpinner.hidden = !isLoading;
    this.btnText.textContent = isLoading ? 'Forging Deliverable...' : 'Generate Deliverable';
  }

  renderOutput(data) {
    this.currentOutputMarkdown = data.content || '';

    // Render markdown to HTML using marked
    if (window.marked) {
      this.renderedView.innerHTML = marked.parse(this.currentOutputMarkdown);
    } else {
      this.renderedView.textContent = this.currentOutputMarkdown;
    }

    this.rawMarkdownView.value = this.currentOutputMarkdown;

    // Update metadata pills
    this.metaModel.textContent = data.modelUsed || 'Llama 3.1 8B';
    this.metaLatency.textContent = `${data.durationMs || 450}ms`;
    this.metaMemory.textContent = data.backboardActive ? '🧠 Backboard Cloud' : '🧠 Memory Stored';

    // Show output, hide empty state
    this.emptyState.hidden = true;
    this.setViewMode('rendered');
  }

  setViewMode(mode) {
    if (mode === 'rendered') {
      this.btnViewRendered.classList.add('active');
      this.btnViewMarkdown.classList.remove('active');
      this.renderedView.hidden = false;
      this.rawMarkdownView.hidden = true;
    } else {
      this.btnViewMarkdown.classList.add('active');
      this.btnViewRendered.classList.remove('active');
      this.renderedView.hidden = true;
      this.rawMarkdownView.hidden = false;
    }
  }

  async handleCopy() {
    if (!this.currentOutputMarkdown) return;
    try {
      await navigator.clipboard.writeText(this.currentOutputMarkdown);
      const label = this.btnCopy.querySelector('.btn-label');
      const originalText = label.textContent;
      label.textContent = 'Copied! ✓';
      setTimeout(() => {
        label.textContent = originalText;
      }, 2000);
    } catch {
      alert('Unable to copy automatically. Please copy from the Markdown view.');
    }
  }

  handleDownload() {
    if (!this.currentOutputMarkdown) return;
    const clientSlug = (this.clientInput.value.trim() || 'client')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const filename = `${clientSlug}-${this.currentTool}.md`;

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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
