import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error: missing env vars' });
    }

    const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { customer_id, customer_email, plan_type } = req.body;

    if (!customer_id || !customer_email || !plan_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const price = PLANS[plan_type] || 4000;
    const orderId = `ORD-${Date.now()}-${customer_id.slice(0, 8)}`;

    // Save purchase request
    const { error: insertError } = await sbAdmin
      .from('purchase_requests')
      .insert({
        customer_id,
        customer_email,
        plan_type,
        price,
        status: 'pending',
      });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save order: ' + insertError.message });
    }

    // Generate real QR code payload representing the payment
    const qrisPayload = `TOKENOBRAL|${orderId}|${plan_type}|${price}|${customer_email}`;
    const qrSvg = await QRCode.toString(qrisPayload, { type: 'svg', margin: 2, width: 200 });
    const qrisBase64 = Buffer.from(qrSvg).toString('base64');

    return res.status(200).json({
      qris_image: `data:image/svg+xml;base64,${qrisBase64}`,
      amount: price,
      order_id: orderId,
    });

  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({ error: err.message });
  }
}