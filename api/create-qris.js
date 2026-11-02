import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);

const PLANS = {
  harian: 4000,
  mingguan: 20000,
  bulanan: 50000,
};

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
    const { customer_id, customer_email, plan_type } = req.body;

    if (!customer_id || !customer_email || !plan_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const price = PLANS[plan_type] || 4000;

    // Save purchase request
    const { error } = await sbAdmin
      .from('purchase_requests')
      .insert({
        customer_id,
        plan_type,
        price,
        status: 'pending',
      });

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save order' });
    }

    // Generate mock QRIS (SVG base64)
    // In production: integrate with Midtrans/Xendit
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="white"/>
        <rect x="10" y="10" width="180" height="180" fill="none" stroke="black" stroke-width="2"/>
        <text x="100" y="80" text-anchor="middle" font-family="monospace" font-size="12" fill="black">QRIS</text>
        <text x="100" y="100" text-anchor="middle" font-family="monospace" font-size="10" fill="black">MOCK</text>
        <text x="100" y="120" text-anchor="middle" font-family="monospace" font-size="9" fill="black">${plan_type}</text>
        <text x="100" y="135" text-anchor="middle" font-family="monospace" font-size="9" fill="black">Rp ${price.toLocaleString('id-ID')}</text>
        <text x="100" y="160" text-anchor="middle" font-family="monospace" font-size="7" fill="gray">${customer_id.slice(0,8)}</text>
      </svg>
    `;
    const qrisBase64 = Buffer.from(svg).toString('base64');

    return res.status(200).json({
      qris_image: `data:image/svg+xml;base64,${qrisBase64}`,
      amount: price,
      order_id: `ORD-${Date.now()}-${customer_id.slice(0, 8)}`,
    });

  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({ error: err.message });
  }
}