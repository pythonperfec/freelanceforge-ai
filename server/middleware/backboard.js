import { BackboardClient } from 'backboard-sdk';

/**
 * Backboard Memory & Client Persistence Service
 * Enables persistent client memory across freelance proposals, invoices, and scope documents.
 * Qualifies for Hacktoberfest "Best Use of Backboard" category.
 */
class BackboardService {
  constructor() {
    this.apiKey = process.env.BACKBOARD_API_KEY || '';
    this.assistantId = process.env.BACKBOARD_ASSISTANT_ID || null;
    this.client = null;
    this.localMemoryStore = new Map();
    this.initPromise = this.init();
  }

  async init() {
    if (this.apiKey && this.apiKey.trim().length > 0) {
      try {
        this.client = new BackboardClient({ apiKey: this.apiKey.trim() });
        
        // Find or create the FreelanceForge memory assistant
        if (!this.assistantId) {
          try {
            const assistants = await this.client.listAssistants({ name: 'FreelanceForge Assistant' });
            if (assistants && assistants.length > 0) {
              this.assistantId = assistants[0].id;
            } else {
              const newAssistant = await this.client.createAssistant({
                name: 'FreelanceForge Assistant',
                description: 'Persistent client memory, agreed rates, and scope tracking for FreelanceForge AI.'
              });
              this.assistantId = newAssistant.id;
            }
          } catch (assistErr) {
            console.warn('⚠️ [Backboard] Assistant check failed:', assistErr.message);
          }
        }

        console.log(`✅ [Backboard] Connected to Backboard.io cloud memory (Assistant: ${this.assistantId || 'pending'}).`);
      } catch (err) {
        console.warn('⚠️ [Backboard] Failed to initialize BackboardClient:', err.message);
        this.client = null;
      }
    } else {
      console.log('ℹ️ [Backboard] No BACKBOARD_API_KEY provided. Operating in local-first persistent memory mode.');
    }
  }

  isCloudActive() {
    return !!(this.client && this.assistantId);
  }

  getAssistantId() {
    return this.assistantId;
  }

  /**
   * Extract business parameters (rates, currency, terms) from text
   */
  extractKeyTerms(text) {
    if (!text) return {};
    const terms = {};

    // Detect hourly rate or project budget (e.g. $95/hr, $120 / hour, $4500, €85/hr, £70/hr)
    const rateMatch = text.match(/(?:[$€£]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/|\s+per\s+)?(hr|hour|day|wk|week|project|flat)?)/i);
    if (rateMatch) {
      terms.rate = rateMatch[0].trim();
    }

    // Detect payment terms (e.g. Net 15, Net 30, 50% deposit, upfront)
    const termsMatch = text.match(/\b(Net\s*\d+|deposit|50%|upfront|due on receipt)\b/i);
    if (termsMatch) {
      terms.paymentTerms = termsMatch[0].trim();
    }

    return terms;
  }

  /**
   * Retrieve stored memories / context for a specific client
   */
  async getClientContext(clientName) {
    if (!clientName) return null;
    await this.initPromise;
    const normalizedName = clientName.toLowerCase().trim();

    // Check Backboard cloud memory if active
    if (this.isCloudActive()) {
      try {
        const query = `client ${clientName} agreed hourly rate payment terms deliverables scope`;
        const cloudResults = await this.client.searchMemories(this.assistantId, query, 5);
        if (cloudResults && (Array.isArray(cloudResults) ? cloudResults.length > 0 : cloudResults.memories?.length > 0)) {
          const memoriesList = Array.isArray(cloudResults) ? cloudResults : cloudResults.memories;
          return {
            source: 'backboard-cloud',
            clientName,
            memories: memoriesList.map(m => m.content || m.text || JSON.stringify(m)),
            localData: this.localMemoryStore.get(normalizedName) || null
          };
        }
      } catch (err) {
        console.warn(`[Backboard Cloud Warning] Memory lookup failed: ${err.message}. Falling back to local.`);
      }
    }

    // Local in-memory fallback
    const local = this.localMemoryStore.get(normalizedName);
    if (local) {
      return {
        source: 'local-memory',
        clientName,
        terms: local.terms || {},
        history: local.history || []
      };
    }

    return null;
  }

  /**
   * Save client interaction and preferences into Backboard memory
   */
  async saveClientInteraction(clientName, tool, inputSnippet, outputSummary) {
    if (!clientName) return;
    await this.initPromise;
    const normalizedName = clientName.toLowerCase().trim();
    const timestamp = new Date().toISOString();
    const extractedTerms = this.extractKeyTerms(`${inputSnippet} ${outputSummary}`);

    const record = {
      tool,
      timestamp,
      terms: extractedTerms,
      summary: outputSummary.slice(0, 350),
      snippet: inputSnippet.slice(0, 150)
    };

    // If Backboard cloud active, save vector memory
    if (this.isCloudActive()) {
      try {
        const memoryContent = `[Client: ${clientName}] Deliverable: ${tool} | Rates/Terms: ${JSON.stringify(extractedTerms)} | Summary: ${outputSummary.slice(0, 300)}`;
        await this.client.addMemory(this.assistantId, {
          content: memoryContent,
          metadata: {
            clientName,
            tool,
            timestamp,
            ...extractedTerms
          }
        });
      } catch (err) {
        console.warn(`[Backboard Cloud Warning] Failed to add memory: ${err.message}`);
      }
    }

    // Update local store
    const existing = this.localMemoryStore.get(normalizedName) || {
      clientName,
      terms: {},
      history: []
    };

    if (extractedTerms.rate) existing.terms.rate = extractedTerms.rate;
    if (extractedTerms.paymentTerms) existing.terms.paymentTerms = extractedTerms.paymentTerms;

    existing.history.unshift(record);
    if (existing.history.length > 20) existing.history.pop(); // keep last 20

    this.localMemoryStore.set(normalizedName, existing);
    return existing;
  }

  /**
   * List all remembered clients
   */
  getRememberedClients() {
    return Array.from(this.localMemoryStore.values()).map(c => ({
      name: c.clientName,
      rate: c.terms?.rate || null,
      paymentTerms: c.terms?.paymentTerms || null,
      interactionsCount: c.history?.length || 0,
      lastInteraction: c.history?.[0]?.timestamp || null,
      lastTool: c.history?.[0]?.tool || null
    }));
  }

  /**
   * Delete memory for a client (Privacy compliance / Right to be Forgotten)
   */
  async deleteClientMemory(clientName) {
    if (!clientName) return false;
    const normalizedName = clientName.toLowerCase().trim();
    const had = this.localMemoryStore.delete(normalizedName);
    return had;
  }
}

export const backboardService = new BackboardService();
