# Návod na spustenie stránky s reálnou PayPal platbou

## Čo tento systém robí
1. Klient vyplní rezervačný formulár a vyberie termín v kalendári.
2. Klikne "Pokračovať k platbe" -> zobrazí sa PayPal tlačidlo (žiadna platba ešte neprebehla).
3. Zaplatí cez PayPal.
4. Serverová funkcia (`capture-order`) si u PayPal **overí**, že platba naozaj prebehla (status `COMPLETED`).
5. Len ak je to potvrdené, rezervácia sa zaregistruje a **tebe/Anavrin príde email** (cez Netlify Forms).

Cenu (25 € / 5 €) určuje server podľa vybraného typu služby — klient ju teda nevie sfalšovať úpravou stránky.

---

## Krok 1 — PayPal Developer účet a API kľúče

1. Choď na https://developer.paypal.com/ a prihlás sa bežným PayPal účtom (Anavrin ho môže mať aj osobný).
2. V hornom menu **Apps & Credentials**.
3. Prepni na **Live** (nie Sandbox) — inak by to prijímalo len testovacie platby.
4. Klikni **Create App**, daj mu ľubovoľný názov (napr. "Anavrin Vestenie").
5. Skopíruj si:
   - **Client ID**
   - **Secret** (klikni "Show")

Tieto dve hodnoty budeš potrebovať nižšie. **Secret nikdy nedávaj do samotného HTML súboru** — ten ide len do Netlify nastavení (viď krok 4).

---

## Krok 2 — Nahratie kódu na GitHub

1. Choď na https://github.com a priahlás sa / zaregistruj (ak ešte nemáš účet).
2. Vytvor nový repozitár, napr. `anavrin-vestenie` (môže byť súkromný aj verejný).
3. Nahraj doň všetky súbory z tohto priečinka **v rovnakej štruktúre**:
   ```
   index.html
   netlify.toml
   netlify/functions/create-order.mjs
   netlify/functions/capture-order.mjs
   ```
   Najjednoduchšie: na stránke repozitára klikni "Add file" -> "Upload files" a celý priečinok tam pretiahni (GitHub zachová priečinkovú štruktúru).

---

## Krok 3 — Prepojenie Netlify s GitHub repozitárom

Tvoja existujúca stránka `anavrin-vestenie.netlify.app` bola nahraná ručne (drag & drop), čo **nepodporuje funkcie**. Treba ju prepojiť s GitHub repozitárom:

1. Choď na https://app.netlify.com/projects/anavrin-vestenie
2. **Site configuration** -> **Build & deploy** -> **Link repository** (alebo ak to tam nie je, najjednoduchšie je založiť **nový** Netlify projekt: "Add new site" -> "Import an existing project" -> vyber GitHub -> vyber repozitár `anavrin-vestenie`)
3. Build nastavenia nechaj prázdne / predvolené (build command prázdny, publish directory `.`)
4. Deploy

Netlify teraz bude automaticky nasadzovať stránku aj s funkciami zakaždým, keď zmeníš niečo na GitHube.

---

## Krok 4 — Nastavenie API kľúčov v Netlify (bezpečne, nie v kóde)

1. V Netlify projekte choď na **Site configuration** -> **Environment variables**
2. Pridaj:
   - `PAYPAL_CLIENT_ID` = (Client ID z kroku 1)
   - `PAYPAL_CLIENT_SECRET` = (Secret z kroku 1)
3. Ulož a spusti nový deploy (Deploys -> Trigger deploy -> Deploy site), nech sa premenné načítajú.

---

## Krok 5 — Vloženie Client ID aj do stránky

Client ID (na rozdiel od Secret) je **verejný** a musí byť aj priamo v `index.html`, aby fungovalo PayPal tlačidlo v prehliadači.

V súbore `index.html` nájdi riadok so `YOUR_PAYPAL_CLIENT_ID` (je v `<head>`) a nahraď ho svojím skutočným Client ID. Ulož a nahraj zmenu na GitHub (Netlify sa znova nasadí automaticky).

---

## Krok 6 — Zapnutie emailových upozornení na rezervácie

1. V Netlify projekte choď na **Site configuration** -> **Forms** -> **Form notifications**
2. Klikni **Add notification** -> **Email notification**
3. Zadaj email, kam majú chodiť upozornenia o nových rezerváciách (napr. Anavrin email)

---

## Overenie, že to funguje

Skús si spraviť skúšobnú rezerváciu sám/sama (malú sumu 5 €) a over si, že:
- PayPal platba prebehla
- Prišiel ti email cez Netlify (Forms -> Submissions to tiež uvidíš)

Ak niečo nesedí, najčastejšie príčiny sú: zlé/chýbajúce API kľúče v Environment variables, alebo zabudnutý redeploy po ich pridaní.
