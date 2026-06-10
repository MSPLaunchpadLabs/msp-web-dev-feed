'use strict';
const crypto = require('crypto');

const TEAM_ID = 'team_N9vL7OHq7kxbxNmKkC9LQOx2';
const PROJECT_ID = 'prj_4McMXzRzVVI4WSN1CZ6h3S3yi4eJ';
const PROD_ALIAS = 'mspl-webdev-intelligence-feed.vercel.app';
const BASE_URL = 'https://mspl-webdev-intelligence-feed.vercel.app';

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
    "benefit": "One sentence: what this means for the team right now",
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
compat values for each tool: "Yes", "Partial", or "No"`;

module.exports = async (req, res) => {
  // Verify cron auth
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = process.env.VERCEL_DEPLOY_TOKEN;

    // Compute this week's Monday
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    monday.setHours(12, 0, 0, 0);
    const weekKey = monday.toISOString().split('T')[0];

    // Fetch current weeks-data.js
    const weeksDataRes = await fetch(`${BASE_URL}/weeks-data.js`);
    if (!weeksDataRes.ok) throw new Error('Failed to fetch weeks-data.js');
    const currentWeeksData = await weeksDataRes.text();

    // Skip if already generated
    if (currentWeeksData.includes(`'${weekKey}'`)) {
      return res.json({ message: 'Already generated', week: weekKey });
    }

    // Call Claude API
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: PROMPT(weekKey) }]
      })
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      throw new Error(`Anthropic error: ${err}`);
    }

    const aiData = await aiRes.json();
    const text = aiData.content[0].text.trim();

    // Parse JSON
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse AI response as JSON array');
    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items) || items.length === 0) throw new Error('Invalid items array');

    // Inject new week at top of WEEKS object
    const newEntry = `  '${weekKey}': ${JSON.stringify(items)},\n`;
    const updatedWeeksData = currentWeeksData.replace(/^var WEEKS = \{/m, `var WEEKS = {\n${newEntry}`);

    // Upload new weeks-data.js
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

    // Get all files from current deployment
    const filesRes = await fetch(
      `https://api.vercel.com/v6/deployments/${prodDeploy.uid}/files?teamId=${TEAM_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fileTree = await filesRes.json();

    // Flatten file tree to list of { file, sha }
    function flattenFiles(nodes, prefix = '') {
      const result = [];
      for (const node of nodes) {
        const path = prefix ? `${prefix}/${node.name}` : node.name;
        if (node.type === 'directory') {
          result.push(...flattenFiles(node.children || [], path));
        } else {
          result.push({ file: path, sha: node.uid });
        }
      }
      return result;
    }

    const allFiles = flattenFiles(Array.isArray(fileTree) ? fileTree : [fileTree]);

    // Replace weeks-data.js with updated version
    const deployFiles = allFiles.map(f =>
      f.file === 'public/weeks-data.js'
        ? { file: 'public/weeks-data.js', sha: newSha, size: newBuf.length }
        : f
    );

    // Create new deployment
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

    // Wait for READY
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const s = await fetch(`https://api.vercel.com/v13/deployments/${deployment.id}?teamId=${TEAM_ID}`,
        { headers: { Authorization: `Bearer ${token}` } });
      const j = await s.json();
      if (j.readyState === 'READY') break;
      if (j.readyState === 'ERROR') throw new Error('Deployment failed');
    }

    // Update alias
    await fetch(`https://api.vercel.com/v2/deployments/${deployment.id}/aliases?teamId=${TEAM_ID}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: PROD_ALIAS })
    });

    return res.json({ success: true, week: weekKey, items: items.length });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message });
  }
};
