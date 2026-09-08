// Vráti zoznam všetkých obsadených (čakajúcich aj potvrdených) termínov,
// aby ich kalendár na stránke zobrazil ako nedostupné pre KAŽDÉHO návštevníka.

import { getStore } from '@netlify/blobs';

export default async () => {
  try {
    const store = getStore('bookings');
    const { blobs } = await store.list({ prefix: 'slot:' });

    const slots = [];
    for (const b of blobs) {
      const data = await store.get(b.key, { type: 'json' });
      if (data && (data.status === 'pending' || data.status === 'confirmed')) {
        slots.push({ datumIso: data.datumIso, cas: data.cas });
      }
    }

    return new Response(JSON.stringify({ slots }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    // v prípade chyby radšej nezablokujeme celý kalendár
    return new Response(JSON.stringify({ slots: [], error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
