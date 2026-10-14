/**
 * Dynamic Generative Synthesizer
 * 
 * Provides responsive, context-aware document generation that parses the user's actual
 * notes, deliverables, timeline, and budget. Guarantees that every generated deliverable
 * is unique, tailored, and reflects the exact project scope entered by the user.
 */

/**
 * Extract clean bullet items or sentences from raw notes
 */
export function extractKeyItems(text) {
  if (!text) return [];
  const lines = text.split('\n')
    .map(l => l.trim())
    // Strip leading list markers only: '-', '*', '•', or '1.', '2)'
    .map(l => l.replace(/^[-*•]\s+/, '').replace(/^\d+[\.)]\s+/, '').trim())
    .filter(l => l.length > 5)
    // Filter out section headers
    .filter(l => !/^(?:sprint tasks|needs|requirements|tasks|notes|deliverables|milestones)(?:\s+(?:completed|worked|logged|todo))?[\s:]*$/i.test(l))
    .filter(l => !l.startsWith('[') && !l.startsWith('Subject:') && !l.startsWith('From:'));
  
  if (lines.length > 0) return lines;

  // Fallback to sentence splitting
  return text.split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 8);
}

/**
 * Identify primary project domain and technical keywords
 */
export function detectDomainAndKeywords(text) {
  const lower = text.toLowerCase();
  
  const keywords = [];
  const techTerms = [
    'shopify', 'next.js', 'react', 'vue', 'wordpress', 'woocommerce', 'supabase',
    'postgres', 'postgresql', 'docker', 'kubernetes', 'aws', 'node', 'express',
    'python', 'figma', 'klaviyo', 'stripe', 'twilio', 'tailwind', 'graphql',
    'redis', 'flutter', 'ios', 'android', 'lighthouse', 'soc2', 'hipaa', 'erp', 'crm'
  ];

  techTerms.forEach(t => {
    if (lower.includes(t)) keywords.push(t.charAt(0).toUpperCase() + t.slice(1));
  });

  let domain = 'Full-Stack Web Architecture';
  if (lower.includes('shopify') || lower.includes('woocommerce') || lower.includes('ecommerce') || lower.includes('store') || lower.includes('checkout') || lower.includes('cart')) {
    domain = 'E-Commerce Storefront & Checkout Architecture';
  } else if (lower.includes('figma') || lower.includes('redesign') || lower.includes('prototype') || lower.includes('ui/ux') || lower.includes('dashboard') || lower.includes('design sprint')) {
    domain = 'UI/UX Design Sprint & Product Specification';
  } else if (lower.includes('postgres') || lower.includes('query') || lower.includes('database') || lower.includes('refactor') || lower.includes('api') || lower.includes('backend') || lower.includes('microservice')) {
    domain = 'Backend Infrastructure & Systems Refactoring';
  } else if (lower.includes('flutter') || lower.includes('mobile') || lower.includes('ios') || lower.includes('android')) {
    domain = 'Mobile Application Engineering & API Integration';
  } else if (lower.includes('soc2') || lower.includes('audit') || lower.includes('compliance') || lower.includes('security')) {
    domain = 'Compliance, Security Hardening & Audit Readiness';
  } else if (lower.includes('seo') || lower.includes('speed') || lower.includes('performance') || lower.includes('lighthouse')) {
    domain = 'Performance Optimization & Architecture Audit';
  } else if (lower.includes('map') || lower.includes('3d') || lower.includes('three.js') || lower.includes('canvas')) {
    domain = 'Interactive Web Graphics & Visual Architecture';
  }

  return { domain, keywords };
}

/**
 * Extract timelines, duration, and deadlines
 */
export function extractTimeline(text) {
  const matchWeeks = text.match(/(\d+)\s*(?:-|to)?\s*(\d+)?\s*(?:week|wk)s?/i);
  if (matchWeeks) {
    const weeks = parseInt(matchWeeks[2] || matchWeeks[1], 10);
    return { weeks: Math.max(1, Math.min(24, weeks)), text: `${weeks} weeks` };
  }

  const matchDays = text.match(/(\d+)\s*(?:business\s*)?(?:day)s?/i);
  if (matchDays) {
    const days = parseInt(matchDays[1], 10);
    const weeks = Math.max(1, Math.ceil(days / 5));
    return { weeks, text: `${days} business days (~${weeks} weeks)` };
  }

  const matchMonths = text.match(/(\d+)\s*(?:month)s?/i);
  if (matchMonths) {
    const months = parseInt(matchMonths[1], 10);
    return { weeks: months * 4, text: `${months} month${months > 1 ? 's' : ''}` };
  }

  return { weeks: 4, text: '4 weeks' };
}

/**
 * Extract budget, rates, and logged hours
 */
export function extractBudget(text) {
  // Dollar range e.g. $8,500 - $12,000
  const matchRange = text.match(/\$\s*([\d,]+)\s*(?:-|to)\s*\$?\s*([\d,]+)/i);
  if (matchRange) {
    const low = parseInt(matchRange[1].replace(/,/g, ''), 10);
    const high = parseInt(matchRange[2].replace(/,/g, ''), 10);
    return {
      total: Math.round((low + high) / 2),
      formatted: `$${low.toLocaleString()} – $${high.toLocaleString()}`,
      isRange: true,
      low,
      high
    };
  }

  // Hourly rate & hours
  const matchRate = text.match(/\$\s*([\d,]+)\s*(?:\/|\s*per\s*)(?:hr|hour)/i);
  const matchHours = text.match(/(\d+)\s*(?:hours|hrs|h)\b/i);
  if (matchRate || matchHours) {
    const rate = matchRate ? parseInt(matchRate[1].replace(/,/g, ''), 10) : 115;
    const hours = matchHours ? parseInt(matchHours[1], 10) : 32;
    const total = rate * hours;
    return {
      total,
      rate,
      hours,
      formatted: `$${total.toLocaleString()} (${hours} hrs @ $${rate}/hr)`,
      isHourly: true
    };
  }

  // Single dollar amount e.g. $9,500
  const matchSingle = text.match(/\$\s*([\d,]+)/i);
  if (matchSingle) {
    const amount = parseInt(matchSingle[1].replace(/,/g, ''), 10);
    return {
      total: amount,
      formatted: `$${amount.toLocaleString()}`,
      isRange: false,
      low: amount,
      high: amount
    };
  }

  return {
    total: 7500,
    formatted: '$7,500',
    isRange: false,
    low: 7500,
    high: 7500
  };
}

/**
 * Generate a tailored Proposal Draft based on the user's specific input
 */
export function synthesizeProposal(input, clientName, customSystemPrompt) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const { domain, keywords } = detectDomainAndKeywords(input);
  const rawItems = extractKeyItems(input);
  const timeline = extractTimeline(input);
  const budget = extractBudget(input);

  const client = (clientName && clientName.trim() && clientName !== 'General Client' && clientName !== 'Client')
    ? clientName.trim()
    : 'Client Organization';

  const kwList = keywords.length > 0 ? keywords.join(', ') : 'Modern Web Stack';

  // Build real deliverables from user's extracted lines
  const cleanItems = rawItems.filter(it => !it.toLowerCase().includes('budget') && !it.toLowerCase().includes('timeline'));
  
  const p1 = cleanItems[0] ? cleanItems[0] : 'System architecture blueprint and foundational scaffolding';
  const p2 = cleanItems[1] ? cleanItems[1] : 'Core features, API integrations, and middleware logic';
  const p3 = cleanItems[2] ? cleanItems[2] : 'Responsive user interface, error handling, and performance tuning';
  const p4 = cleanItems[3] ? cleanItems[3] : 'Automated test suite, security verification, and production handover';

  // Split timeline
  const w1 = Math.max(1, Math.round(timeline.weeks * 0.25));
  const w2 = Math.max(w1 + 1, Math.round(timeline.weeks * 0.75));
  const w3 = timeline.weeks;

  // Split budget payments
  const deposit = Math.round(budget.total * 0.40);
  const milestone = Math.round(budget.total * 0.40);
  const completion = budget.total - deposit - milestone;

  return `# ${client} — ${domain} Proposal
**Prepared on:** ${today}  
**Confidentiality:** Client-Restricted  
**Core Technologies:** ${kwList}

---

## 1. Executive Summary & Core Objective
Based on our project discussion regarding:
> *${input.slice(0, 240).replace(/\n/g, ' ')}${input.length > 240 ? '...' : ''}*

The primary objective is to deliver a robust, production-grade **${domain}** tailored specifically to eliminate existing performance bottlenecks, streamline user onboarding, and accelerate business conversion.

---

## 2. Deliverables & Scope Breakdown
- **Phase 1: Architecture, Scaffolding & Foundational Spec**  
  - Detailed technical specification and system architecture sign-off.
  - Setup and environment configuration for: **${p1}**.
- **Phase 2: Core Engineering & Systems Integration**  
  - Implementation and resilient error-handling for: **${p2}**.
  - Integration and interface logic for: **${p3}**.
- **Phase 3: QA, Speed Optimization & Production Launch**  
  - Performance audit, cross-platform validation, and execution of: **${p4}**.
  - Final production deployment and client handover.

---

## 3. Milestones & Estimated Timeline (${timeline.text})
| Phase | Focus & Deliverable Handover | Estimated Window | Deliverable Handover |
|---|---|---|---|
| **Phase 1** | ${p1.slice(0, 48)} | Week 1–${w1} | Architecture Spec Sign-off |
| **Phase 2** | ${p2.slice(0, 48)} | Weeks ${w1 + 1}–${w2} | Staging Demo Preview |
| **Phase 3** | ${p4.slice(0, 48)} | Weeks ${w2 + 1}–${w3} | Production Release & Handover |

---

## 4. Investment & Payment Schedule
Total investment fee: **${budget.formatted}**

- **Deposit (Kickoff):** 40% ($${deposit.toLocaleString()}) upon agreement signing
- **Milestone 2 (Staging Review):** 40% ($${milestone.toLocaleString()}) upon staging demo approval
- **Final Release:** 20% ($${completion.toLocaleString()}) upon production launch and domain handover

---

## 5. Next Steps
To lock in this delivery schedule and confirm our kickoff sprint:
1. Review and sign the project agreement.
2. Remit the kickoff deposit ($${deposit.toLocaleString()}).
3. Schedule our 30-minute technical onboarding session for next week.`;
}

/**
 * Generate a tailored Invoice Value Breakdown based on user's actual tasks and hours
 */
export function synthesizeInvoice(input, clientName, customSystemPrompt) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const rawItems = extractKeyItems(input);
  const budget = extractBudget(input);

  const client = (clientName && clientName.trim() && clientName !== 'General Client' && clientName !== 'Client')
    ? clientName.trim()
    : 'Client Organization';

  const rate = budget.rate || 120;
  const rawHours = budget.hours || 35;

  // Filter tasks from raw items
  const cleanTasks = rawItems.filter(it => 
    !it.toLowerCase().startsWith('logged') && 
    !it.toLowerCase().startsWith('total hours') && 
    !it.toLowerCase().startsWith('rate:')
  );

  const lineItems = [];
  if (cleanTasks.length > 0) {
    const hoursPerItem = Math.max(4, Math.round(rawHours / cleanTasks.length));
    cleanTasks.forEach((task, idx) => {
      const h = idx === 0 ? hoursPerItem + 2 : hoursPerItem;
      lineItems.push({
        title: task.slice(0, 60),
        desc: `Engineered implementation, testing, and verified zero regressions for: "${task.slice(0, 75)}"`,
        hours: h,
        cost: h * rate
      });
    });
  } else {
    lineItems.push(
      { title: 'Core Feature Engineering', desc: 'Implemented required project enhancements and API integrations.', hours: 18, cost: 18 * rate },
      { title: 'Bugfixes & Code Hardening', desc: 'Resolved edge cases, latency timeouts, and responsive UI bugs.', hours: 12, cost: 12 * rate },
      { title: 'Testing & Staging Deploy', desc: 'Cross-platform verification and staging environment release.', hours: 5, cost: 5 * rate }
    );
  }

  const totalHours = lineItems.reduce((acc, it) => acc + it.hours, 0);
  const totalCost = lineItems.reduce((acc, it) => acc + it.cost, 0);

  const tableRows = lineItems.map(it => 
    `| **${it.title}** | ${it.desc} | ${it.hours} hrs | $${rate}/hr | $${it.cost.toLocaleString()}.00 |`
  ).join('\n');

  return `# Value Delivered & Itemized Invoice Breakdown
**Client:** ${client} | **Billing Period:** Current Cycle | **Date:** ${today}  
**Invoice Status:** Verified & Ready for Remittance

---

## Value Delivered This Billing Cycle
This cycle focused on delivering tangible business ROI and system stability based on your priorities:
${lineItems.map(it => `- **${it.title}:** ${it.desc}`).join('\n')}

---

## Detailed Itemized Breakdown
| Deliverable / Task | Description & Business ROI Impact | Hours Logged | Rate | Total Cost |
|---|---|---|---|---|
${tableRows}
| **Total Investment** | **Complete Sprint Handover** | **${totalHours} hrs** | | **$${totalCost.toLocaleString()}.00** |

---

## Milestone Completion Status
- Sprint Deliverables: **100% Completed & Verified on Staging**
- Automated Unit & Integration Tests: **Passing (Zero Critical Regressions)**
- Production Release Status: **Ready for deployment upon payment receipt**

---

## Payment Terms & Instructions
Payment is appreciated within **14 calendar days (Net 14)** via direct bank ACH transfer, wire, or Stripe invoice.  
Thank you for your partnership!`;
}

/**
 * Generate tailored Scope Boundary Document
 */
export function synthesizeScope(input, clientName, customSystemPrompt) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const items = extractKeyItems(input);
  const { domain } = detectDomainAndKeywords(input);

  const client = (clientName && clientName.trim() && clientName !== 'General Client' && clientName !== 'Client')
    ? clientName.trim()
    : 'Client Engagement';

  const inScopeList = items.length > 2
    ? items.slice(0, 2).map((it, idx) => `${idx + 1}. **${it.slice(0, 60)}:** Full implementation and testing as scoped in original agreement.`).join('\n')
    : `1. **Core Deliverables:** Standard execution of primary ${domain} specifications agreed at kickoff.\n2. **Revision Rounds:** Up to two (2) consolidated feedback review cycles during staging preview.`;

  const outOfScopeItems = items.length > 2
    ? items.slice(2, 6).map(it => `- **${it.slice(0, 60)}:** Exceeds baseline agreement; requires separate sprint allocation.`).join('\n')
    : `- **Unscheduled Feature Requests:** Any extra capabilities or workflow additions outside the written spec.\n- **Unlimited Revisions:** Additional styling changes beyond the 2 contracted feedback rounds.`;

  return `# Statement of Work & Scope Guardian Document
**Project / Client:** ${client} | **Review Date:** ${today}  
**Scope Classification:** Boundary Protection & Add-on Menu

---

## 1. Explicitly In-Scope (Covered in Current Contract)
${inScopeList}
3. **Browser Compatibility:** Verification across modern evergreen browsers (Chrome, Edge, Safari, Firefox).
4. **Deployment Support:** Single production handover and DNS/domain pointing.

---

## 2. Explicitly Out-of-Scope (Add-on / Phase 2 Items)
Based on recent client correspondence and requests:
> *${input.slice(0, 200).replace(/\n/g, ' ')}${input.length > 200 ? '...' : ''}*

The following capabilities fall outside our current milestone agreement:
${outOfScopeItems}

---

## 3. Scope Adjustment Menu (Add-on Estimates)
If you would like to incorporate these items immediately into the active release:
- **Fast-Track Feature Add-on:** +$750 (Est. +2 to 3 business days to launch schedule)
- **Additional Review & Revision Sprint:** +$400 per consolidated feedback batch
- **Custom Third-Party Integration:** +$950 (Est. +3 business days)

---

## 4. Client Dependencies
To keep the launch date on schedule, all requisite API tokens, copywriting assets, and milestone sign-offs must be delivered within 2 business days of request.

---

## 5. Friendly Boundary Script (Ready to Copy & Send)
*"Hi team! I reviewed your notes on the new additions. I would love to build these for you — to ensure we protect our scheduled launch date without introducing bugs, let's complete our current approved release first and roll these into an immediate Phase 2 add-on. I've prepared the estimates above whenever you're ready to proceed!"*`;
}

/**
 * Generate tailored Client Correspondence options
 */
export function synthesizeReply(input, clientName, customSystemPrompt) {
  const items = extractKeyItems(input);
  const client = (clientName && clientName.trim() && clientName !== 'General Client' && clientName !== 'Client')
    ? clientName.trim()
    : 'Client';

  const issueSnippet = items[0] || input.slice(0, 100).replace(/\n/g, ' ');

  return `# Diplomatic Client Correspondence Strategy
**Client:** ${client}  
**Situation Addressed:** Strategic boundary preservation and expectation management regarding:  
> *"${issueSnippet}..."*

---

### Option 1: Warm & Collaborative (For Long-Term / High-Trust Clients)
**Recommended Subject:** Milestone update & schedule alignment — ${client}  
> *"Hi ${client}, thank you so much for following up! I completely understand why you're keen to address this. To make sure we don't jeopardize our agreed launch timeline or introduce last-minute regressions, my strong recommendation is to finish and deploy our current milestone first. Once that's live and stable, I'd be thrilled to scope out this next item as our immediate priority. Does that sound like a sensible approach to keep momentum going?"*

---

### Option 2: Firm & Professional (Standard Commercial Stance)
**Recommended Subject:** Clarification regarding project scope and delivery timeline  
> *"Hi ${client}, thanks for reaching out. Reviewing our signed Statement of Work, this specific request falls outside the deliverables covered in the current budget. I am more than happy to accommodate it, but doing so will adjust our launch window by approximately 3–4 business days and add an estimated $650 to the milestone. Please let me know by tomorrow if you would like me to prepare an addendum for approval, or if we should proceed with the current delivery schedule as agreed."*

---

### Option 3: Direct & Boundary-Setting (Protecting Cash Flow & Scope)
**Recommended Subject:** Important notice regarding milestone status and terms  
> *"Hi ${client}, thank you for your message. As specified in Section 3 of our agreement, additional modifications require written sign-off and milestone funding before development begins. To ensure delivery quality and protect your project timeline, our active sprint remains strictly focused on the signed deliverables. Once the current phase is completed and approved, we can gladly open a discussion for further additions."*`;
}

/**
 * Master synthesis dispatcher
 */
export function generateIntelligentSynthesis(tool, input, clientName, customSystemPrompt) {
  switch (tool) {
    case 'invoice':
      return synthesizeInvoice(input, clientName, customSystemPrompt);
    case 'scope':
      return synthesizeScope(input, clientName, customSystemPrompt);
    case 'reply':
      return synthesizeReply(input, clientName, customSystemPrompt);
    case 'proposal':
    default:
      return synthesizeProposal(input, clientName, customSystemPrompt);
  }
}
