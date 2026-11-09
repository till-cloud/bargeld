# Bargeld-App (Supabase-Variante)

Einfache iPhone-PWA zum Tracken von Bargeld-Ausgaben. Reines HTML/CSS/JS ohne Build-Schritt, Daten in Supabase (Tabelle `ausgaben`), Hosting auf GitHub Pages. Nicht verwechseln mit `C:\Users\andre\bargeld` (Vite/TS, IndexedDB, Cloudflare).

## Dateien
- `index.html`, `styles.css`, `app.js` – App (Start, Eintrag, Kassenbon-Foto, Statistik, Verlauf, Einstellungen)
- `config.js` – SUPABASE_URL + Publishable Key (trägt der Nutzer selbst ein; leer = Demo-Modus mit localStorage)
- `supabase.sql` – Tabelle + RLS-Regeln, im Supabase SQL Editor ausführen
- `sw.js`, `manifest.webmanifest`, `icons/` – PWA
- supabase-js per CDN, gepinnt auf 2.118.0

## Starten und testen
- `python -m http.server 5178 --bind 127.0.0.1` im Projektordner, dann http://127.0.0.1:5178
- Ohne config.js-Werte läuft der Demo-Modus (Daten nur im Browser).

## Regeln
- Keine Schlüssel selbst eintragen; nur der Publishable Key gehört in config.js, nie ein Secret/service_role Key.
- Kategorien liegen pro Gerät in localStorage (`bargeld.kategorien`).

## Stand
- Im Browser geprüft (Demo-Modus): Eintragen + Validierung, Statistik-Werte, Verlauf bearbeiten/löschen, Kategorien, Dark/Light, Offline-Start (Chromium).
- Ungetestet: echte Supabase-Verbindung, Kamera/Foto und Homescreen-Start auf dem iPhone.
- Offen: Supabase-Daten sind ohne Login für jeden mit der App-URL lesbar/änderbar → ggf. Supabase Auth ergänzen.
