import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { agent } from './mastra/agent.js';
import { backboardService } from './middleware/backboard.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Health Check Endpoint (Required by Render & status monitors)
app.get('/api/health', async (req, res) => {
  const ollamaStatus = await agent.checkOllamaStatus();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    ai: {
      ollama: {
        available: ollamaStatus.available,
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
        version: ollamaStatus.version
      },
      cloudFallback: {
        configured: !!process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
      },
      backboardMemory: {
        active: backboardService.isCloudActive()
      }
    }
  });
});

// Generation Endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { tool, input, clientName } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Please provide input notes or details.' });
    }

    const validTools = ['proposal', 'invoice', 'scope', 'reply'];
    const selectedTool = validTools.includes(tool) ? tool : 'proposal';

    const output = await agent.executePipeline({
      tool: selectedTool,
      input,
      clientName: clientName?.trim() || 'General Client'
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

// Remembered Clients List (via Backboard)
app.get('/api/clients', (req, res) => {
  try {
    const clients = backboardService.getRememberedClients();
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route to serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`
=============================================================
🚀 FreelanceForge AI Server Running!
📍 URL: http://localhost:${PORT}
🔒 Local-First Privacy: Active
📦 Open-Weight Model: Llama 3.1 8B
🌐 Render Deploy Ready: Port ${PORT}
🧠 Backboard Memory: ${backboardService.isCloudActive() ? 'Cloud Active' : 'Local Emulation'}
=============================================================
  `);
});
