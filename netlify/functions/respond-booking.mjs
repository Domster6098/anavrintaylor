// Táto funkcia sa spustí, keď Anavrin klikne na "Potvrdiť" alebo "Zamietnuť"
// priamo v emaile. Podľa toho buď potvrdí termín a pošle zákazníkovi email,
// alebo termín zruší a uvoľní ho späť pre ostatných.

import { getStore } from '@netlify/blobs';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.BOOKING_FROM_EMAIL;

async function sendEmail(to, subject, html) {
  if (!BREVO_API_KEY || !FROM_EMAIL) return;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: 'Anavrin Taylor' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
}

function page(title, message, color) {
  return new Response(
    `<!DOCTYPE html><html lang="sk"><head><meta charset="utf-8"><title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body{font-family:sans-serif;background:#100819;color:#ecdffa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem;}
      .box{max-width:440px;} h1{font-size:1.5rem;color:${color || '#ecdffa'};} p{color:#c9b6dd;line-height:1.6;}
    </style></head>
    <body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');

  if (!token || !action) {
    return page('Chyba', 'Chýba token alebo akcia v odkaze.', '#e08a8a');
  }

  try {
    const store = getStore('bookings');
    const booking = await store.get(`token:${token}`, { type: 'json' });

    if (!booking) {
      return page('Nenájdené', 'Táto rezervácia už neexistuje alebo už bola spracovaná.', '#e08a8a');
    }

    const slotKey = `slot:${booking.datumIso}_${booking.cas}`;

    if (action === 'confirm') {
      booking.status = 'confirmed';
      await store.setJSON(`token:${token}`, booking);
      await store.setJSON(slotKey, booking);

      await sendEmail(
        booking.email,
        'Tvoj termín je potvrdený 🔮',
        `<div style="font-family:sans-serif;">
          <p>Ahoj ${booking.meno},</p>
          <p>Tvoj termín <strong>${booking.datum} o ${booking.cas}</strong> (${booking.typ}, ${booking.sposob}) je potvrdený.</p>
          <p>Teším sa na stretnutie!<br>— Anavrin</p>
        </div>`
      );

      return page(
        'Termín potvrdený ✅',
        `Zákazníkovi (${booking.email}) bol odoslaný email s potvrdením termínu ${booking.datum} o ${booking.cas}.`,
        '#7ed957'
      );
    }

    if (action === 'cancel') {
      await store.delete(`token:${token}`);
      await store.delete(slotKey);

      await sendEmail(
        booking.email,
        'Tvoj termín sa bohužiaľ nedá potvrdiť',
        `<div style="font-family:sans-serif;">
          <p>Ahoj ${booking.meno},</p>
          <p>Ľutujem, termín <strong>${booking.datum} o ${booking.cas}</strong> sa bohužiaľ nedá potvrdiť. Napíš mi prosím, dohodneme iný termín.</p>
          <p>— Anavrin</p>
        </div>`
      );

      return page(
        'Termín zamietnutý',
        `Zákazníkovi (${booking.email}) bol odoslaný email, že termín sa nepodarilo potvrdiť. Termín je teraz znova voľný pre ostatných.`,
        '#e08a8a'
      );
    }

    return page('Neznáma akcia', 'Odkaz obsahuje neplatnú akciu.', '#e08a8a');
  } catch (err) {
    return page('Chyba', err.message, '#e08a8a');
  }
};
