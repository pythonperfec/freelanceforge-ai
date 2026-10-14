import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { agent } from './mastra/agent.js';
import { backboardService } from './middleware/backboard.js';
import { SYSTEM_PROMPTS } from './mastra/prompts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/prompts', (req, res) => {
  res.json({ prompts: SYSTEM_PROMPTS });
});

app.get('/api/health', async (req, res) => {
  await backboardService.initPromise;
  const engineData = await agent.getAvailableEngines();
  const ollamaInfo = await agent.checkOllamaStatus();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    engines: engineData.engines,
    preferredEngine: engineData.preferredEngine,
    ai: {
      ollama: {
        available: engineData.engines.ollama.available,
        model: engineData.engines.ollama.model,
        version: ollamaInfo.available ? '0.40.4' : null,
        models: ollamaInfo.models
      },
      cloudFallback: {
        configured: engineData.engines.groq.available,
        model: engineData.engines.groq.model
      },
      backboardMemory: {
        active: backboardService.isCloudActive(),
        assistantId: backboardService.getAssistantId()
      }
    }
  });
});

app.get('/api/memory/status', async (req, res) => {
  await backboardService.initPromise;
  res.json({
    cloudActive: backboardService.isCloudActive(),
    assistantId: backboardService.getAssistantId(),
    clientCount: backboardService.getRememberedClients().length,
    mode: backboardService.isCloudActive() ? 'backboard-cloud' : 'local-persistent'
  });
});

app.get('/api/memory/clients', (req, res) => {
  res.json({
    clients: backboardService.getRememberedClients(),
    cloudActive: backboardService.isCloudActive()
  });
});

app.get('/api/memory/client/:name', async (req, res) => {
  const clientName = req.params.name;
  const context = await backboardService.getClientContext(clientName);
  res.json({
    clientName,
    found: !!context,
    context: context || null
  });
});

app.delete('/api/memory/client/:name', async (req, res) => {
  const clientName = req.params.name;
  const removed = await backboardService.deleteClientMemory(clientName);
  res.json({ clientName, success: removed });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { tool, input, clientName, customSystemPrompt } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Please provide input notes or details.' });
    }

    const validTools = ['proposal', 'invoice', 'scope', 'reply'];
    const selectedTool = validTools.includes(tool) ? tool : 'proposal';

    const output = await agent.executePipeline({
      tool: selectedTool,
      input,
      clientName: clientName?.trim() || 'General Client',
      customSystemPrompt: customSystemPrompt?.trim() || null
    });

    res.json(output);
  } catch (error) {
    console.error('[API Error /generate]:', error);
    res.status(500).json({
      error: 'An unexpected error occurred during AI processing.',
      details: error.message
    });
  }
});

app.post('/api/generate-stream', async (req, res) => {
  try {
    const { tool, input, clientName, customSystemPrompt } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Please provide input notes or details.' });
    }

    const validTools = ['proposal', 'invoice', 'scope', 'reply'];
    const selectedTool = validTools.includes(tool) ? tool : 'proposal';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const finalOutput = await agent.executePipelineStream({
      tool: selectedTool,
      input,
      clientName: clientName?.trim() || 'General Client',
      customSystemPrompt: customSystemPrompt?.trim() || null,
      signal: abortController.signal,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ token: chunk, done: false })}\n\n`);
      }
    });

    res.write(`data: ${JSON.stringify({
      done: true,
      content: finalOutput.content,
      text: finalOutput.text,
      engine: finalOutput.engine,
      model: finalOutput.model,
      ms: finalOutput.ms,
      durationMs: finalOutput.durationMs,
      isLocal: finalOutput.isLocal,
      backboardActive: finalOutput.backboardActive
    })}\n\n`);

    res.end();
  } catch (err) {
    console.error('[API Error /generate-stream]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
      res.end();
    }
  }
});

app.get('/api/clients', (req, res) => {
  try {
    const clients = backboardService.getRememberedClients();
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`FreelanceForge AI listening on http://localhost:${PORT}`);
});
