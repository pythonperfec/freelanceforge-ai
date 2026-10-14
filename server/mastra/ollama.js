/**
 * Ollama Local Inference Client
 * 
 * Interacts directly with the local Ollama daemon via standard fetch.
 * Provides model availability checking, non-streaming chat, and streaming SSE chat.
 */

const BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

/**
 * Check if Ollama is running and has the requested model available
 * GET /api/tags with 1.5s timeout
 */
export async function ollamaAvailable() {
  try {
    const res = await fetch(`${BASE}/api/tags`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!res.ok) return false;
    const data = await res.json();
    const targetModelPrefix = MODEL.split(':')[0].toLowerCase();
    return !!data.models?.some(m => m.name?.toLowerCase().startsWith(targetModelPrefix));
  } catch {
    return false;
  }
}

/**
 * Get detailed Ollama health and model list
 */
export async function getOllamaInfo() {
  try {
    const res = await fetch(`${BASE}/api/tags`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!res.ok) return { available: false, models: [] };
    const data = await res.json();
    const hasModel = !!data.models?.some(m => m.name?.toLowerCase().startsWith(MODEL.split(':')[0].toLowerCase()));
    return {
      available: true,
      hasConfiguredModel: hasModel,
      configuredModel: MODEL,
      models: data.models?.map(m => m.name) || []
    };
  } catch {
    return { available: false, hasConfiguredModel: false, configuredModel: MODEL, models: [] };
  }
}

function getEffectiveSignal(signal, timeoutMs = 120000) {
  const timeoutSig = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeoutSig;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeoutSig]);
  }
  return signal;
}

/**
 * Perform non-streaming chat inference with Ollama
 */
export async function ollamaChat(system, user, options = {}) {
  const signal = getEffectiveSignal(options.signal, 120000);
  const response = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      options: {
        temperature: options.temperature ?? 0.4,
        num_ctx: options.num_ctx ?? 4096
      },
      keep_alive: options.keep_alive ?? '10m'
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || data.response || '';
}

/**
 * Perform streaming chat inference with Ollama line-by-line
 */
export async function ollamaStream(system, user, onChunk, options = {}) {
  const signal = getEffectiveSignal(options.signal, 120000);
  const response = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      options: {
        temperature: options.temperature ?? 0.4,
        num_ctx: options.num_ctx ?? 4096
      },
      keep_alive: options.keep_alive ?? '10m'
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Ollama stream error ${response.status}: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        const token = parsed.message?.content || '';
        if (token) {
          accumulated += token;
          if (typeof onChunk === 'function') {
            onChunk(token, accumulated);
          }
        }
      } catch (err) {
        // Skip malformed chunk
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer.trim());
      const token = parsed.message?.content || '';
      if (token) {
        accumulated += token;
        if (typeof onChunk === 'function') {
          onChunk(token, accumulated);
        }
      }
    } catch {}
  }

  return accumulated;
}
