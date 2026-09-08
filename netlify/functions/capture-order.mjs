// Zoberie orderID od klienta, ale SKUTOČNÝ stav platby si overí priamo
// u PayPal servera (capture). Termín sa zaregistruje (do Netlify Blobs,
// zobrazí sa ako obsadený pre všetkých + pošle sa email Anavrin s
// tlačidlami Potvrdiť/Zamietnuť) len ak PayPal potvrdí "COMPLETED".
// Klient teda nemôže len tak "predstierať", že zaplatil.

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.BOOKING_FROM_EMAIL;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'anavrintaylor+rezervacie@slovanet.net';

async function sendEmail(to, subject, html) {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) return; // ešte nenastavené -> preskočí sa potichu
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: 'Anavrin Taylor' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
}

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
    const { orderID, meno, email, telefon, typ, sposob, datum, datumIso, cas, poznamka } = body;

    if (!orderID || !meno || !email || !datum || !cas || !datumIso) {
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

    // Platba je naozaj potvrdená. Skontrolujeme, či medzitým termín niekto iný
    // nezobral (napr. dve platby tesne po sebe), a ak nie, zapíšeme ho ako
    // obsadený, nech ho vidí zošednutý aj každý ďalší návštevník.
    const store = getStore('bookings');
    const slotKey = `slot:${datumIso}_${cas}`;
    const existing = await store.get(slotKey, { type: 'json' });

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Tento termín si medzitým zarezervoval niekto iný. Vyber si prosím iný čas.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = crypto.randomUUID();
    const booking = {
      token,
      meno,
      email,
      telefon: telefon || '',
      typ: typ || '',
      sposob: sposob || '',
      datum,
      datumIso,
      cas,
      poznamka: poznamka || '',
      status: 'pending',
      paypalOrderId: orderID,
      createdAt: new Date().toISOString(),
    };

    await store.setJSON(slotKey, booking);
    await store.setJSON(`token:${token}`, booking);

    const siteUrl = process.env.URL || `https://${req.headers.get('host')}`;
    const confirmUrl = `${siteUrl}/.netlify/functions/respond-booking?token=${token}&action=confirm`;
    const cancelUrl = `${siteUrl}/.netlify/functions/respond-booking?token=${token}&action=cancel`;

    await sendEmail(
      OWNER_EMAIL,
      `Nová rezervácia — ${datum} o ${cas}`,
      `<div style="font-family:sans-serif;max-width:480px;">
        <p><strong>${meno}</strong> (${email}${telefon ? ', ' + telefon : ''}) zaplatil/a a chce termín:</p>
        <p style="font-size:1.1rem;"><strong>${datum} o ${cas}</strong><br>${typ} · ${sposob}</p>
        ${poznamka ? `<p>Poznámka: ${poznamka}</p>` : ''}
        <p style="margin-top:1.5rem;">
          <a href="${confirmUrl}" style="background:#1ed760;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-right:10px;">Potvrdiť termín</a>
          <a href="${cancelUrl}" style="background:#c0392b;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Zamietnuť</a>
        </p>
      </div>`
    );

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
