// Vytvorí PayPal objednávku. Cena sa určuje TU na serveri podľa "typ",
// nie z toho, čo pošle prehliadač - takže sa nedá podvodne zmeniť.

const PRICES = {
  vyklad: { value: '25.00', label: 'Súkromný výklad' },
  kyvadlo: { value: '5.00', label: 'Kyvadlo (10 otázok)' },
};

async function getAccessToken(base) {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Nepodarilo sa overiť PayPal účet.');
  return data.access_token;
}

export default async (req) => {
  try {
    const { typ } = await req.json();
    const item = PRICES[typ];

    if (!item) {
      return new Response(JSON.stringify({ error: 'Neplatný typ služby.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const base = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
    const accessToken = await getAccessToken(base);

    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: item.label,
            amount: { currency_code: 'EUR', value: item.value },
          },
        ],
      }),
    });
    const orderData = await orderRes.json();

    if (!orderData.id) {
      return new Response(JSON.stringify({ error: 'Nepodarilo sa vytvoriť platbu.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id: orderData.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
