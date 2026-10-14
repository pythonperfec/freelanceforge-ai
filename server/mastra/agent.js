import { formatPrompt, SYSTEM_PROMPTS } from './prompts.js';
import { backboardService } from '../middleware/backboard.js';
import { generateIntelligentSynthesis } from './synthesizer.js';
import { ollamaAvailable, ollamaChat, ollamaStream, getOllamaInfo } from './ollama.js';

/**
 * Mastra Agent Harness & Open-Weight Inference Engine
 * 
 * Engine selection order:
 * 1. Local Ollama (if ollamaAvailable() is true on OLLAMA_BASE_URL)
 * 2. Hosted open-weight endpoint (Groq Llama 3.1, if GROQ_API_KEY is configured)
 * 3. Dynamic template synthesizer (offline resilient fallback)
 */
export class FreelanceForgeAgent {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  }

  /**
   * Check Ollama connectivity and installed models
   */
  async checkOllamaStatus() {
    return await getOllamaInfo();
  }

  /**
   * Determine available engines and preferred engine
   */
  async getAvailableEngines() {
    const isOllama = await ollamaAvailable();
    const isGroq = !!this.groqApiKey;

    let preferredEngine = 'synthesizer';
    if (isOllama) {
      preferredEngine = 'ollama';
    } else if (isGroq) {
      preferredEngine = 'groq';
    }

    return {
      engines: {
        ollama: {
          available: isOllama,
          model: this.ollamaModel,
          url: this.ollamaUrl
        },
        groq: {
          available: isGroq,
          model: this.groqModel
        },
        synthesizer: {
          available: true,
          model: `${this.ollamaModel} (Local Synthesizer)`
        }
      },
      preferredEngine
    };
  }

  /**
   * Main non-streaming pipeline execution
   */
  async executePipeline({ tool, input, clientName, customSystemPrompt, signal }) {
    const startTime = Date.now();

    // Step 1: Memory & Context Retrieval via Backboard
    let clientContext = null;
    if (clientName) {
      try {
        clientContext = await backboardService.getClientContext(clientName);
      } catch (err) {
        console.warn(`[Pipeline Step 1] Backboard lookup warning: ${err.message}`);
      }
    }

    // Step 2: Prompt Formatting (supports user-edited system prompt)
    const { system, user } = formatPrompt(tool, input, clientContext, customSystemPrompt);

    // Step 3: Engine Selection
    let result = null;
    let engine = 'synthesizer';
    let model = `${this.ollamaModel} (Local Synthesizer)`;
    let isLocal = true;

    // 3a. Priority 1: Ollama if available
    const hasOllama = await ollamaAvailable();
    if (hasOllama) {
      try {
        console.log(`[Engine] Selecting Priority 1: Local Ollama (${this.ollamaModel})...`);
        result = await ollamaChat(system, user, { signal });
        engine = 'ollama';
        model = this.ollamaModel;
        isLocal = true;
      } catch (err) {
        console.warn(`[Engine] Ollama call failed: ${err.message}. Cascading to next provider.`);
      }
    }

    // 3b. Priority 2: Hosted open-weight endpoint (Groq) if configured
    if (!result && this.groqApiKey) {
      try {
        console.log(`[Engine] Selecting Priority 2: Hosted Groq (${this.groqModel})...`);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.groqApiKey}`
          },
          body: JSON.stringify({
            model: this.groqModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ],
            temperature: 0.4
          }),
          signal: signal || AbortSignal.timeout(60000)
        });

        if (res.ok) {
          const json = await res.json();
          result = json.choices?.[0]?.message?.content;
          engine = 'groq';
          model = `${this.groqModel} (Groq Cloud)`;
          isLocal = false;
        } else {
          console.warn(`[Engine] Groq returned status ${res.status}. Cascading to fallback.`);
        }
      } catch (err) {
        console.warn(`[Engine] Groq call failed: ${err.message}. Cascading to fallback.`);
      }
    }

    // 3c. Priority 3: Dynamic template synthesizer as last-resort fallback
    if (!result) {
      console.log(`[Engine] Selecting Priority 3: Dynamic Template Synthesizer...`);
      result = generateIntelligentSynthesis(tool, input, clientName, customSystemPrompt);
      engine = 'synthesizer';
      model = `${this.ollamaModel} (Local Synthesizer)`;
      isLocal = true;
    }

    const durationMs = Date.now() - startTime;

    // Step 4: Persist Interaction to Backboard
    if (clientName && result) {
      try {
        await backboardService.saveClientInteraction(clientName, tool, input, result);
      } catch (err) {
        console.warn(`[Pipeline Step 4] Backboard persistence warning: ${err.message}`);
      }
    }

    return {
      content: result,
      text: result,
      engine,
      model,
      ms: durationMs,
      durationMs,
      isLocal,
      backboardActive: backboardService.isCloudActive()
    };
  }

  /**
   * Streaming pipeline execution
   */
  async executePipelineStream({ tool, input, clientName, customSystemPrompt, onChunk, signal }) {
    const startTime = Date.now();

    // Step 1: Memory & Context Retrieval
    let clientContext = null;
    if (clientName) {
      try {
        clientContext = await backboardService.getClientContext(clientName);
      } catch (err) {
        console.warn(`[Pipeline Step 1] Backboard lookup warning: ${err.message}`);
      }
    }

    // Step 2: Prompt Formatting
    const { system, user } = formatPrompt(tool, input, clientContext, customSystemPrompt);

    // Step 3: Engine Selection
    let accumulated = '';
    let engine = 'synthesizer';
    let model = `${this.ollamaModel} (Local Synthesizer)`;
    let isLocal = true;

    // 3a. Priority 1: Ollama Streaming
    const hasOllama = await ollamaAvailable();
    if (hasOllama) {
      try {
        console.log(`[Stream] Selecting Priority 1: Local Ollama Stream (${this.ollamaModel})...`);
        accumulated = await ollamaStream(system, user, (chunk) => {
          if (typeof onChunk === 'function') onChunk(chunk);
        }, { signal });

        engine = 'ollama';
        model = this.ollamaModel;
        isLocal = true;
      } catch (err) {
        console.warn(`[Stream] Ollama streaming failed: ${err.message}. Cascading to fallback.`);
        accumulated = '';
      }
    }

    // 3b. Priority 2: Groq Streaming
    if (!accumulated && this.groqApiKey) {
      try {
        console.log(`[Stream] Selecting Priority 2: Groq Streaming (${this.groqModel})...`);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.groqApiKey}`
          },
          body: JSON.stringify({
            model: this.groqModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ],
            temperature: 0.4,
            stream: true
          }),
          signal: signal || AbortSignal.timeout(60000)
        });

        if (res.ok) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    accumulated += delta;
                    if (typeof onChunk === 'function') onChunk(delta);
                  }
                } catch {}
              }
            }
          }
          engine = 'groq';
          model = `${this.groqModel} (Groq Cloud)`;
          isLocal = false;
        }
      } catch (err) {
        console.warn(`[Stream] Groq streaming failed: ${err.message}. Cascading to fallback.`);
        accumulated = '';
      }
    }

    // 3c. Priority 3: Synthesizer Streaming (Progressive chunk emission)
    if (!accumulated) {
      console.log(`[Stream] Selecting Priority 3: Synthesizer Progressive Emission...`);
      accumulated = generateIntelligentSynthesis(tool, input, clientName, customSystemPrompt);
      engine = 'synthesizer';
      model = `${this.ollamaModel} (Local Synthesizer)`;
      isLocal = true;

      // Emit in realistic progressive chunks (lines)
      const lines = accumulated.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (signal?.aborted) break;
        const lineChunk = (i === 0 ? '' : '\n') + lines[i];
        if (typeof onChunk === 'function') onChunk(lineChunk);
        // Micro pause to give real progressive feel
        await new Promise(r => setTimeout(r, 25));
      }
    }

    const durationMs = Date.now() - startTime;

    // Step 4: Persist Interaction to Backboard
    if (clientName && accumulated) {
      try {
        await backboardService.saveClientInteraction(clientName, tool, input, accumulated);
      } catch (err) {
        console.warn(`[Pipeline Step 4] Backboard persistence warning: ${err.message}`);
      }
    }

    return {
      content: accumulated,
      text: accumulated,
      engine,
      model,
      ms: durationMs,
      durationMs,
      isLocal,
      backboardActive: backboardService.isCloudActive()
    };
  }

  generateDemoFallback(tool, input, clientName = 'Acme Corp', customSystemPrompt = null) {
    return generateIntelligentSynthesis(tool, input, clientName, customSystemPrompt);
  }
}

export const agent = new FreelanceForgeAgent();
