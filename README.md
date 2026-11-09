# Bargeld-App

Bargeld-Ausgaben schnell eintragen, Kassenbon fotografieren, Statistik und Verlauf ansehen. Läuft als Web-App auf dem iPhone-Homescreen, Daten liegen in Supabase.

## 1. Supabase einrichten
1. Auf https://supabase.com ein Projekt anlegen (falls noch keins da ist).
2. Links **SQL Editor** → **New query** → Inhalt von `supabase.sql` einfügen → **Run**.
3. **Project Settings → Data API**: die *Project URL* kopieren.
4. **Project Settings → API Keys**: den *Publishable key* (`sb_publishable_…`) kopieren. **Nicht** den Secret key.
5. Beide Werte in `config.js` eintragen.

> Hinweis: Der Publishable Key ist sichtbar, sobald die Seite online ist. Mit den Regeln aus `supabase.sql` kann jeder, der die Adresse deiner App kennt, deine Einträge lesen und ändern. Für echten Schutz braucht es einen Login (Supabase Auth).

## 2. Auf GitHub Pages veröffentlichen
1. Auf https://github.com/new ein neues Repository anlegen, z. B. `bargeld-app` (Public; Pages auf privaten Repos braucht ein bezahltes Konto).
2. Im Projektordner (PowerShell):
   ```
   git remote add origin https://github.com/DEIN-NAME/bargeld-app.git
   git push -u origin main
   ```
3. Im Repo: **Settings → Pages** → *Source: Deploy from a branch* → Branch `main`, Ordner `/ (root)` → **Save**.
4. Nach 1–2 Minuten ist die App unter `https://DEIN-NAME.github.io/bargeld-app/` erreichbar.

## 3. Auf dem iPhone-Homescreen speichern
1. Die Adresse in **Safari** öffnen.
2. Unten auf das **Teilen**-Symbol (Quadrat mit Pfeil) tippen.
3. **Zum Home-Bildschirm** wählen, Name „Bargeld“ bestätigen → **Hinzufügen**.
4. Die App über das neue Icon starten: Sie öffnet sich ohne Browser-Leiste.

## Lokal testen
```
python -m http.server 5178 --bind 127.0.0.1
```
Dann http://127.0.0.1:5178 öffnen. Ohne Werte in `config.js` läuft ein Demo-Modus, der nur im Browser speichert.
