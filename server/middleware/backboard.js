import { BackboardClient } from 'backboard-sdk';

/**
 * Backboard Memory & Client Persistence Service
 * Enables persistent client memory across freelance proposals, invoices, and scope documents.
 * Qualifies for Hacktoberfest "Best Use of Backboard" category.
 */
class BackboardService {
  constructor() {
    this.apiKey = process.env.BACKBOARD_API_KEY || '';
    this.client = null;
    this.localMemoryStore = new Map();
    this.init();
  }

  init() {
    if (this.apiKey && this.apiKey.trim().length > 0) {
      try {
        this.client = new BackboardClient({ apiKey: this.apiKey });
        console.log('✅ [Backboard] Connected to Backboard.io cloud memory service.');
      } catch (err) {
        console.warn('⚠️ [Backboard] Failed to initialize BackboardClient:', err.message);
        this.client = null;
      }
    } else {
      console.log('ℹ️ [Backboard] No BACKBOARD_API_KEY provided. Operating in local-first persistent memory mode.');
    }
  }

  isCloudActive() {
    return !!this.client;
  }

  /**
   * Retrieve stored memories / context for a specific client
   */
  async getClientContext(clientName) {
    if (!clientName) return null;
    const normalizedName = clientName.toLowerCase().trim();

    // Try cloud memory if Backboard client active
    if (this.client) {
      try {
        const memories = await this.client.searchMemories({
          query: `client ${normalizedName} rate preferences terms history`,
          limit: 5
        });
        if (memories && memories.length > 0) {
          return memories;
        }
      } catch (err) {
        console.warn(`[Backboard Cloud Warning] Memory lookup failed: ${err.message}. Falling back to local.`);
      }
    }

    // Local in-memory fallback
    return this.localMemoryStore.get(normalizedName) || null;
  }

  /**
   * Save client interaction and preferences into Backboard memory
   */
  async saveClientInteraction(clientName, tool, inputSnippet, outputSummary) {
    if (!clientName) return;
    const normalizedName = clientName.toLowerCase().trim();
    const timestamp = new Date().toISOString();

    const record = {
      tool,
      timestamp,
      summary: outputSummary.slice(0, 300),
      snippet: inputSnippet.slice(0, 150)
    };

    // If Backboard cloud active
    if (this.client) {
      try {
        await this.client.addMemory({
          content: `Client: ${clientName} | Tool: ${tool} | Date: ${timestamp} | Summary: ${outputSummary.slice(0, 400)}`
        });
      } catch (err) {
        console.warn(`[Backboard Cloud Warning] Failed to add memory: ${err.message}`);
      }
    }

    // Keep in local store as well
    const existing = this.localMemoryStore.get(normalizedName) || { clientName, history: [] };
    existing.history.push(record);
    this.localMemoryStore.set(normalizedName, existing);
  }

  /**
   * List all remembered clients
   */
  getRememberedClients() {
    return Array.from(this.localMemoryStore.keys()).map(name => ({
      name,
      interactionsCount: (this.localMemoryStore.get(name)?.history || []).length
    }));
  }
}

export const backboardService = new BackboardService();
