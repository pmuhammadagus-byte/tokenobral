import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UPSTREAM_URL = process.env.UPSTREAM_AI_URL || 'http://100.78.237.39:20128/v1';
const UPSTREAM_KEY = process.env.UPSTREAM_AI_KEY || 'sk-24453...';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Missing API Key in Authorization header', type: 'invalid_request_error' } });
    }

    const apiKey = authHeader.slice(7);

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: { message: 'Server configuration error', type: 'server_error' } });
    }

    const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify API Key against customers table
    const { data: customer, error: custError } = await sbAdmin
      .from('customers')
      .select('id, quota_total, quota_used, status')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (custError || !customer || customer.status !== 'active') {
      return res.status(401).json({ error: { message: 'Invalid or inactive API Key', type: 'invalid_api_key' } });
    }

    // 2. Check quota
    if (customer.quota_total > 0 && customer.quota_used >= customer.quota_total) {
      return res.status(403).json({ error: { message: 'Quota exceeded. Please top-up your package.', type: 'quota_exceeded' } });
    }

    // 3. Forward request to upstream AI provider
    const upstreamResponse = await fetch(`${UPSTREAM_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NINE_ROUTER_KEY || UPSTREAM_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await upstreamResponse.json();

    // 4. Update quota usage if response contains token usage
    const promptTokens = data.usage?.prompt_tokens || 10;
    const completionTokens = data.usage?.completion_tokens || 10;
    const totalTokens = promptTokens + completionTokens;

    await sbAdmin
      .from('customers')
      .update({ 
        quota_used: (customer.quota_used || 0) + totalTokens,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    return res.status(upstreamResponse.status).json(data);

  } catch (err) {
    console.error('AI Proxy error:', err);
    return res.status(500).json({ error: { message: err.message, type: 'internal_error' } });
  }
}