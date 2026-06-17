'use strict';
const crypto = require('crypto');

const TIER_ORDER  = { s: 0, a: 1, b: 2, c: 3 };
const TIER_EMOJI  = { s: '🔴', a: '🟠', b: '🟡', c: '🔵' };
const TIER_COLORS = { s: 0xff4444, a: 0xff8c3a, b: 0xffd166, c: 0x7b93b4 };

const DEV_TEAM_MENTION = '<@&1344027196381204573>';

async function sendDiscordNotification(items, weekKey) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const actionable = items
    .filter(i => i.tier === 's' || i.tier === 'a')
    .sort((a, b) => {
      if (TIER_ORDER[a.tier] !== TIER_ORDER[b.tier]) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      return (b.fit || 0) - (a.fit || 0);
    })
    .slice(0, 3);

  const isActionable = actionable.length > 0;
  const displayItems = isActionable
    ? actionable
    : items.filter(i => i.tier === 'b').sort((a, b) => (b.fit || 0) - (a.fit || 0)).slice(0, 3);

  if (displayItems.length === 0) return;

  const topColor = TIER_COLORS[displayItems[0].tier] || 0xff4444;

  const title = isActionable
    ? `🚨 This Week's Top 3 Action Items — ${weekKey}`
    : `📚 FYI This Week — Worth Knowing — ${weekKey}`;

  const description = isActionable
    ? 'Dev team — these need attention this week.'
    : 'No immediate action items this week. Here\'s what\'s worth being aware of:';

  const fields = displayItems.map((item, idx) => {
    const benefit = item.benefit.length > 200 ? item.benefit.slice(0, 197) + '…' : item.benefit;
    const step = item.steps && item.steps[0]
      ? (item.steps[0].length > 150 ? item.steps[0].slice(0, 147) + '…' : item.steps[0])
      : null;
    return {
      name: `${TIER_EMOJI[item.tier] || ''} ${idx + 1}. ${item.title}`,
      value: [benefit ? `> ${benefit}` : null, step ? `**→** ${step}` : null].filter(Boolean).join('\n'),
      inline: false
    };
  });

  const payload = {
    content: DEV_TEAM_MENTION,
    allowed_mentions: { roles: ['1344027196381204573'] },
    embeds: [{
      title,
      description,
      color: topColor,
      fields,
      footer: { text: `MSP Launchpad Web Dev Intelligence Feed • ${weekKey}` },
      url: 'https://mspl-webdev-intelligence-feed.vercel.app'
    }]
  };

  const discordRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!discordRes.ok) console.error('Discord webhook failed:', discordRes.status, await discordRes.text());
}

const TEAM_ID   = 'team_N9vL7OHq7kxbxNmKkC9LQOx2';
const PROJECT_ID = 'prj_4McMXzRzVVI4WSN1CZ6h3S3yi4eJ';
const PROD_ALIAS = 'mspl-webdev-intelligence-feed.vercel.app';
const BASE_URL   = 'https://mspl-webdev-intelligence-feed.vercel.app';

const PROMPT = (weekKey) => `You are generating a weekly web development intelligence brief for MSP Launchpad, a web agency specialising in Webflow, Figma, n8n automation, and client website delivery.

Generate exactly 8 intelligence items for the week of ${weekKey}. Items should cover real, current trends in web development tools, performance standards, AI tooling, Webflow updates, CSS advances, and agency-relevant SaaS changes.

Respond with ONLY a valid JSON array (no markdown, no explanation) with exactly this structure for each item:
[
  {
    "title": "Short punchy headline",
    "tier": "s",
    "tierLabel": "S Tier",
    "pipeline": "Relevant pipeline stage e.g. QA → Performance",
    "source": "Source name",
    "url": "https://relevant-source-url.com",
    "benefit": "One sentence: what this saves, earns, or protects for the agency — not developer outcomes",
    "roi": "Immediate",
    "fit": 5,
    "why": "2-3 sentences explaining why this matters for MSP Launchpad specifically",
    "steps": ["Concrete step 1", "Concrete step 2", "Concrete step 3"],
    "impl": {"Research": "1h", "Build": "2h", "QA": "1h", "Rollout": "1h", "Total": "5h"},
    "impact": {
      "Build Speed": {"val": "+10%"},
      "QA Pass Rate": {"val": "+5%"},
      "Page Perf": {"val": "—", "neutral": true}
    },
    "compat": {
      "Webflow": "Yes",
      "Figma": "No",
      "n8n": "Partial",
      "Cloudflare": "Yes",
      "Playwright": "Yes",
      "Website QA": "Yes"
    }
  }
]

Use tier: s for immediate action required (1-2 items), a for adopt soon (2-3 items), b for worth knowing (2-3 items), c for watch list (1 item).
roi values: "Immediate", "High", "Medium", "Watch"
fit: 1-5 integer
compat values: "Yes", "Partial", or "No"
For impl, use "—" for stages that don't apply.`;

function flattenFiles(nodes, prefix) {
  const result = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'directory') {
      result.push(...flattenFiles(node.children || [], path));
    } else {
      // Strip leading 'src/' — Vercel stores files with this prefix internally
      // but deployments must be created without it
      result.push({ file: path.replace(/^src\//, ''), sha: node.uid });
    }
  }
  return result;
}

module.exports = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.VERCEL_DEPLOY_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!token)       return res.status(500).json({ error: 'VERCEL_DEPLOY_TOKEN not set' });
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  try {
    // Compute this week's Monday
    const today = new Date();
    const diff = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    monday.setHours(12, 0, 0, 0);
    const weekKey = monday.toISOString().split('T')[0];

    // Fetch current weeks-data.js from the live site
    const weeksDataRes = await fetch(`${BASE_URL}/weeks-data.js`);
    if (!weeksDataRes.ok) throw new Error('Failed to fetch weeks-data.js');
    const currentWeeksData = await weeksDataRes.text();

    if (currentWeeksData.includes(`'${weekKey}'`)) {
      return res.json({ message: 'Already generated', week: weekKey });
    }

    // Call Claude API
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: PROMPT(weekKey) }]
      })
    });
    if (!aiRes.ok) throw new Error(`Anthropic error: ${await aiRes.text()}`);

    const aiData = await aiRes.json();
    const text = aiData.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse AI response as JSON array');
    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items) || items.length === 0) throw new Error('Invalid items array');

    // Inject new week at top of WEEKS object
    const newEntry = `  '${weekKey}': ${JSON.stringify(items)},\n`;
    const updatedWeeksData = currentWeeksData.replace(/^var WEEKS = \{/m, `var WEEKS = {\n${newEntry}`);

    // Upload updated weeks-data.js to Vercel file store
    const newBuf = Buffer.from(updatedWeeksData, 'utf8');
    const newSha = crypto.createHash('sha1').update(newBuf).digest('hex');
    await fetch('https://api.vercel.com/v2/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'x-vercel-digest': newSha,
        'Content-Length': String(newBuf.length)
      },
      body: newBuf
    });

    // Get current production deployment
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=1&target=production`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { deployments } = await deploymentsRes.json();
    const prodDeploy = deployments[0];

    // Get file tree from current deployment
    const filesRes = await fetch(
      `https://api.vercel.com/v6/deployments/${prodDeploy.uid}/files?teamId=${TEAM_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fileTree = await filesRes.json();
    const allFiles = flattenFiles(Array.isArray(fileTree) ? fileTree : [fileTree]);

    // Replace weeks-data.js with updated version
    const deployFiles = allFiles.map(f =>
      f.file === 'public/weeks-data.js'
        ? { file: 'public/weeks-data.js', sha: newSha, size: newBuf.length }
        : f
    );

    // Create new production deployment
    const deployRes = await fetch(`https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'vault',
        project: PROJECT_ID,
        target: 'production',
        files: deployFiles,
        projectSettings: { framework: null }
      })
    });
    const deployment = await deployRes.json();
    if (!deployment.id) throw new Error(`Deploy failed: ${JSON.stringify(deployment)}`);

    // Wait for READY (max 2 minutes)
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const s = await fetch(
        `https://api.vercel.com/v13/deployments/${deployment.id}?teamId=${TEAM_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const j = await s.json();
      if (j.readyState === 'READY') break;
      if (j.readyState === 'ERROR') throw new Error('Deployment failed');
    }

    // Point alias to new deployment
    await fetch(`https://api.vercel.com/v2/deployments/${deployment.id}/aliases?teamId=${TEAM_ID}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: PROD_ALIAS })
    });

    // Notify Discord — never let this break the deployment response
    try { await sendDiscordNotification(items, weekKey); } catch (e) { console.error('Discord error:', e); }

    return res.json({ success: true, week: weekKey, items: items.length });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message });
  }
};
