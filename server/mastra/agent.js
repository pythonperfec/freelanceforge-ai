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
          model: 'Template Synthesizer (Offline Fallback)'
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

    let clientContext = null;
    if (clientName) {
      try {
        clientContext = await backboardService.getClientContext(clientName);
      } catch (err) {
        console.warn(`[Pipeline] Context lookup warning: ${err.message}`);
      }
    }

    const { system, user } = formatPrompt(tool, input, clientContext, customSystemPrompt);

    let result = null;
    let engine = 'synthesizer';
    let model = 'Template Synthesizer (Offline Fallback)';
    let isLocal = true;

    const hasOllama = await ollamaAvailable();
    if (hasOllama) {
      try {
        console.log(`[Engine] Selecting Local Ollama (${this.ollamaModel})...`);
        result = await ollamaChat(system, user, { signal });
        engine = 'ollama';
        model = this.ollamaModel;
        isLocal = true;
      } catch (err) {
        console.warn(`[Engine] Ollama call failed: ${err.message}. Cascading to next provider.`);
      }
    }

    if (!result && this.groqApiKey) {
      try {
        console.log(`[Engine] Selecting Hosted Groq (${this.groqModel})...`);
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

    if (!result) {
      console.log(`[Engine] Selecting Dynamic Template Synthesizer...`);
      result = generateIntelligentSynthesis(tool, input, clientName, customSystemPrompt);
      engine = 'synthesizer';
      model = 'Template Synthesizer (Offline Fallback)';
      isLocal = false;
    }

    const durationMs = Date.now() - startTime;

    if (clientName && result) {
      try {
        await backboardService.saveClientInteraction(clientName, tool, input, result);
      } catch (err) {
        console.warn(`[Pipeline] Persistence warning: ${err.message}`);
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

    let clientContext = null;
    if (clientName) {
      try {
        clientContext = await backboardService.getClientContext(clientName);
      } catch (err) {
        console.warn(`[Pipeline] Context lookup warning: ${err.message}`);
      }
    }

    const { system, user } = formatPrompt(tool, input, clientContext, customSystemPrompt);

    let accumulated = '';
    let engine = 'synthesizer';
    let model = 'Template Synthesizer (Offline Fallback)';
    let isLocal = true;

    const hasOllama = await ollamaAvailable();
    if (hasOllama) {
      try {
        console.log(`[Stream] Selecting Local Ollama Stream (${this.ollamaModel})...`);
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

    if (!accumulated && this.groqApiKey) {
      try {
        console.log(`[Stream] Selecting Groq Streaming (${this.groqModel})...`);
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

    if (!accumulated) {
      console.log(`[Stream] Selecting Synthesizer Emission...`);
      accumulated = generateIntelligentSynthesis(tool, input, clientName, customSystemPrompt);
      engine = 'synthesizer';
      model = 'Template Synthesizer (Offline Fallback)';
      isLocal = true;

      const lines = accumulated.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (signal?.aborted) break;
        const lineChunk = (i === 0 ? '' : '\n') + lines[i];
        if (typeof onChunk === 'function') onChunk(lineChunk);
        await new Promise(r => setTimeout(r, 25));
      }
    }

    const durationMs = Date.now() - startTime;

    if (clientName && accumulated) {
      try {
        await backboardService.saveClientInteraction(clientName, tool, input, accumulated);
      } catch (err) {
        console.warn(`[Pipeline] Persistence warning: ${err.message}`);
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
