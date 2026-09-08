// Zoberie orderID od klienta, ale SKUTOČNÝ stav platby si overí priamo
// u PayPal servera (capture). Rezervácia sa zaregistruje (odošle do
// Netlify Forms -> príde email) len ak PayPal potvrdí status "COMPLETED".
// Klient teda nemôže len tak "predstierať", že zaplatil.

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
    const body = await req.json();
    const { orderID, meno, email, telefon, typ, sposob, datum, cas, poznamka } = body;

    if (!orderID || !meno || !email || !datum || !cas) {
      return new Response(JSON.stringify({ error: 'Chýbajú povinné údaje.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const base = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
    const accessToken = await getAccessToken(base);

    const captureRes = await fetch(
      `${base}/v2/checkout/orders/${orderID}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const captureData = await captureRes.json();

    if (captureData.status !== 'COMPLETED') {
      return new Response(
        JSON.stringify({ error: 'Platba sa nepodarila potvrdiť.', status: captureData.status }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Platba je naozaj potvrdená -> teraz zaregistrujeme rezerváciu do Netlify Forms,
    // čo pošle upozornenie/email na adresu spravcu stránky.
    const siteUrl = process.env.URL || `https://${req.headers.get('host')}`;
    const formBody = new URLSearchParams({
      'form-name': 'booking',
      meno,
      email,
      telefon: telefon || '',
      typ: typ || '',
      sposob: sposob || '',
      datum,
      cas,
      poznamka: poznamka || '',
      paypal_order_id: orderID,
    });

    await fetch(`${siteUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    return new Response(JSON.stringify({ success: true }), {
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
