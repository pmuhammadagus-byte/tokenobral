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
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Save purchase request - handle customer_id if it's not a valid UUID
    let validUuid = customer_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(customer_id)) {
      validUuid = '00000000-0000-0000-0000-000000000000';
    }

    const { error: insertError } = await sbAdmin
      .from('purchase_requests')
      .insert({
        customer_id: validUuid,
        customer_email,
        plan_type,
        price,
        status: 'pending',
      });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save order: ' + insertError.message });
    }

    // Generate real QR code representing the payment
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