import axios from 'axios';

const STORE_KEY = 'SK_6deb55a109a6af6c7cbed72790eb734709adaefb8bde2b61cf626c7a0f';
const BASE_URL = 'https://merchant.nasionalpay.com/api/payment';

export async function createQRIS(amount, username) {
  try {
    const response = await axios.post(`${BASE_URL}/generate`, {
      key: STORE_KEY,
      channel: 'QRIS',
      amount: amount,
      player_username: username
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Gagal generate QRIS');
    }

    return response.data.data;
  } catch (error) {
    console.error('NasionalPay error:', error.response?.data || error.message);
    throw error;
  }
}