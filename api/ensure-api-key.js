import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);
const sbAnon = createClient(supabaseUrl, supabaseAnonKey);

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
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.slice(7);
    
    // Verify token with Supabase
    const { data: { user }, error } = await sbAnon.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get or create API key
    const { data: customers } = await sbAdmin
      .from('customers')
      .select('api_key')
      .eq('id', user.id)
      .single();

    let apiKey = customers?.api_key;
    
    if (!apiKey || apiKey.includes('belum') || apiKey === 'sk-belum-dibuat-admin') {
      apiKey = `sk-${crypto.randomUUID().replace(/-/g, '')}`;
      await sbAdmin
        .from('customers')
        .upsert({ id: user.id, api_key: apiKey, updated_at: new Date().toISOString() });
    }

    return res.status(200).json({ api_key: apiKey });

  } catch (err) {
    console.error('ensure-api-key error:', err);
    return res.status(500).json({ error: err.message });
  }
}