import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FreelanceForgeAgent } from '../server/mastra/agent.js';

describe('FreelanceForge Engine Selection Priority Logic', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.OLLAMA_MODEL = 'llama3.1:8b';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('Priority 1: Selects Ollama when local daemon is running and has model', async () => {
    // Mock fetch for Ollama /api/tags and /api/chat
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/tags')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            models: [{ name: 'llama3.1:8b' }]
          })
        };
      }
      if (urlStr.includes('/api/chat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: { content: 'Test generated proposal from local Llama 3.1 8B' }
          })
        };
      }
      throw new Error(`Unexpected fetch call to ${urlStr}`);
    };

    const agent = new FreelanceForgeAgent();
    agent.groqApiKey = 'fake-groq-key'; // Even if Groq key exists, Ollama takes priority

    const engineInfo = await agent.getAvailableEngines();
    assert.equal(engineInfo.preferredEngine, 'ollama');
    assert.equal(engineInfo.engines.ollama.available, true);

    const result = await agent.executePipeline({
      tool: 'proposal',
      input: 'Create a proposal for web redesign',
      clientName: 'Test Client'
    });

    assert.equal(result.engine, 'ollama');
    assert.equal(result.isLocal, true);
    assert.equal(result.model, 'llama3.1:8b');
    assert.ok(result.content.includes('Test generated proposal'));
  });

  it('Priority 2: Falls back to hosted Groq when Ollama is offline but GROQ_API_KEY is present', async () => {
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      // Ollama tags check fails
      if (urlStr.includes('/api/tags')) {
        throw new Error('Connection refused: Ollama is offline');
      }
      // Groq chat completions succeeds
      if (urlStr.includes('api.groq.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'Test proposal from hosted Groq Llama 3.1' } }]
          })
        };
      }
      throw new Error(`Unexpected fetch call to ${urlStr}`);
    };

    const agent = new FreelanceForgeAgent();
    agent.groqApiKey = 'mock-groq-test-key';

    const engineInfo = await agent.getAvailableEngines();
    assert.equal(engineInfo.preferredEngine, 'groq');
    assert.equal(engineInfo.engines.ollama.available, false);
    assert.equal(engineInfo.engines.groq.available, true);

    const result = await agent.executePipeline({
      tool: 'proposal',
      input: 'Create a proposal for mobile app MVP',
      clientName: 'Test Client'
    });

    assert.equal(result.engine, 'groq');
    assert.equal(result.isLocal, false);
    assert.ok(result.model.includes('Groq Cloud'));
    assert.ok(result.content.includes('Test proposal from hosted Groq'));
  });

  it('Priority 3: Falls back to dynamic template synthesizer when both Ollama and Groq are unavailable', async () => {
    globalThis.fetch = async (url) => {
      throw new Error('All external network connections disabled');
    };

    const agent = new FreelanceForgeAgent();
    agent.groqApiKey = ''; // No cloud key

    const engineInfo = await agent.getAvailableEngines();
    assert.equal(engineInfo.preferredEngine, 'synthesizer');
    assert.equal(engineInfo.engines.ollama.available, false);
    assert.equal(engineInfo.engines.groq.available, false);

    const result = await agent.executePipeline({
      tool: 'invoice',
      input: 'Frontend development 40 hours at 85/hr',
      clientName: 'Offline Client'
    });

    assert.equal(result.engine, 'synthesizer');
    assert.equal(result.isLocal, true);
    assert.ok(result.model.includes('Template Synthesizer'));
    assert.ok(result.content.length > 50);
  });
});
