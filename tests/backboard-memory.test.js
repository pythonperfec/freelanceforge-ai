import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { backboardService } from '../server/middleware/backboard.js';
import { formatPrompt } from '../server/mastra/prompts.js';

describe('Backboard.io Client Memory & Rate RAG Integration', () => {
  it('extractKeyTerms extracts hourly rates, fixed fees, and payment terms correctly', () => {
    const text1 = 'Client agreed to $95/hr for frontend engineering, invoice on Net 15 terms.';
    const terms1 = backboardService.extractKeyTerms(text1);
    assert.equal(terms1.rate, '$95/hr');
    assert.equal(terms1.paymentTerms, 'Net 15');

    const text2 = 'Design sprint budget is $4,500 with a 50% deposit upfront.';
    const terms2 = backboardService.extractKeyTerms(text2);
    assert.equal(terms2.rate, '$4,500');
    assert.equal(terms2.paymentTerms, 'deposit');
  });

  it('saveClientInteraction records interaction and updates client rate profile', async () => {
    const clientName = 'Acme Test Corp';
    await backboardService.saveClientInteraction(
      clientName,
      'proposal',
      'Full store redesign at $110/hr on Net 30 terms',
      'Proposal created with milestone breakdown and deliverables'
    );

    const context = await backboardService.getClientContext(clientName);
    assert.ok(context, 'Context should be retrieved for saved client');
    assert.equal(context.clientName, clientName);
    assert.equal(context.terms.rate, '$110/hr');
    assert.equal(context.terms.paymentTerms, 'Net 30');
    assert.equal(context.history.length, 1);
  });

  it('formatPrompt injects Backboard memory block with pricing continuity instructions', () => {
    const clientContext = {
      clientName: 'Acme Test Corp',
      terms: { rate: '$110/hr', paymentTerms: 'Net 30' },
      history: [{ tool: 'proposal', summary: 'Store redesign milestone 1 completed' }]
    };

    const { system, user } = formatPrompt('invoice', 'Billing for 25 hours frontend work', clientContext);
    assert.ok(user.includes('CLIENT HISTORICAL MEMORY (Retrieved via Backboard)'));
    assert.ok(user.includes('$110/hr'));
    assert.ok(user.includes('Net 30'));
    assert.ok(user.includes('Maintain commercial continuity'));
  });

  it('deleteClientMemory cleanly removes remembered client (Right to be Forgotten)', async () => {
    const clientName = 'Temporary Client';
    await backboardService.saveClientInteraction(clientName, 'reply', 'Brief checkin', 'Response sent');

    const before = await backboardService.getClientContext(clientName);
    assert.ok(before);

    const deleted = await backboardService.deleteClientMemory(clientName);
    assert.equal(deleted, true);

    const after = await backboardService.getClientContext(clientName);
    assert.equal(after, null);
  });
});
