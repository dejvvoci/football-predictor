import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initAdmin } from '../lib/admin';
import { runSync } from '../lib/sync-core';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST and GET allowed
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate secret token — prevents unauthorized calls
  const secret = (req.headers['x-sync-secret'] as string) ?? (req.query['secret'] as string);
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'FOOTBALL_DATA_TOKEN not set' });
  }

  try {
    initAdmin();
    const start = Date.now();
    const result = await runSync(token);
    return res.status(200).json({
      ok: true,
      ...result,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
