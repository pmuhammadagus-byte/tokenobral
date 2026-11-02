import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error: missing env vars' });
    }

    const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const sbAnon = createClient(supabaseUrl, supabaseAnonKey);

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.slice(7);
    
    // Verify token with Supabase
    const { data: { user }, error: authError } = await sbAnon.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token: ' + (authError?.message || 'no user') });
    }

    // Get or create API key
    const { data: customer, error: fetchError } = await sbAdmin
      .from('customers')
      .select('api_key')
      .eq('id', user.id)
      .maybeSingle();

    let apiKey = customer?.api_key;
    
    if (!apiKey || apiKey.includes('belum') || apiKey === 'sk-belum-dibuat-admin') {
      apiKey = 'sk-tob-' + Math.random().toString(36).substring(2, 12);
      
      const { error: upsertError } = await sbAdmin
        .from('customers')
        .upsert({ 
          id: user.id, 
          email: user.email,
          display_name: user.email.split('@')[0],
          api_key: apiKey, 
          quota_total: 0,
          quota_used: 0,
          status: 'active',
          updated_at: new Date().toISOString() 
        });

      if (upsertError) {
        return res.status(500).json({ error: 'Failed to register customer: ' + upsertError.message });
      }
    }

    return res.status(200).json({ api_key: apiKey });

  } catch (err) {
    console.error('ensure-api-key error:', err);
    return res.status(500).json({ error: err.message });
  }
}