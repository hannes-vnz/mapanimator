# Analyse: Reisevideos – Karten, Schnitt, Format, Ideen

Stand: 26.11.2026. Analysiert wurden zwei Videos aus `~/Downloads`:

- **„7 Days Overlanding Iceland (Part 1)“** – Kara and Nate, 43:24 min, 16:9, 30 fps
- **„Ausgesetzt in Vietnam – THE RACE Staffel 3, Folge 01“** – 65:50 min, 16:9, 25 fps

Methode: Schnitterkennung mit ffmpeg (Szenenwechsel), Kontaktbögen (1 Bild / 10 s, Einstieg 1 Bild / s, Karten 2 Bilder / s), Transkript mit Whisper (large-v3-turbo, lokal), Tonklassen mit PANNs/AudioSet (Sprache, Musik, Geräusche pro Sekunde), Beats mit librosa. Zahlen sind Messwerte, die Einordnung ist Interpretation.

---

## 1. Kurzfassung

1. **Die Karte ist ein Orientierungs-Beat, keine Show.** Beide Videos zeigen Karten kurz (Island ~4–5 s, The Race 5–20 s) und immer mit einem Satz aus dem Off: *„Wir sind auf dem Weg nach Hella.“* / *„Irgendwo im Südchinesischen Meer liegt die winzige Insel Pulau Benan.“*
2. **Die Erzählstimme ist nie im Bild.** The Race erzählt alle Regeln, Karten und Hintergründe mit einer Off-Stimme. Genau das ist dein Einstieg: Du musst nicht vor die Kamera, um ein Reiseformat zu tragen.
3. **Geschnitten wird auf Gespräch, nicht auf Musik.** Median-Einstellung 2,4 s in beiden Videos, ~15–18 Schnitte pro Minute, kaum Schnitte auf dem Beat, keine Whoosh-Effekte. Musik ist Bett, nicht Taktgeber.
4. **Ein starker Einstieg braucht kein Gesicht.** The Race beginnt mit 40 s wortloser Kino-Montage der Stadt, Island mit 20 s Drohnenbildern plus Trailer der ganzen Woche.
5. **Spannung kommt aus einer klaren Prämisse.** The Race: *ohne Geld und Handy, 3.700 km in 7 Tagen zu einer Insel*. Island: *eine Woche im Expeditions-LKW durch das Hochland, 50/50, dass wir steckenbleiben*. Der Ort allein ist noch kein Format.

---

## 2. Die beiden Videos im Vergleich

| | Island (Kara & Nate) | THE RACE |
|---|---|---|
| Länge | 43 min | 66 min |
| Schnitte | 786 (≈ 18/min) | 1015 (≈ 15/min; erste 5 min 32/min) |
| Median-Einstellung | 2,4 s | 2,4 s |
| Sprache im Ton | 86 % der Zeit | 94 % |
| Musik | 25 %, fast nur in Montagen | 34 %, läuft unter Gesprächen weiter |
| Sprechtempo | ~160 Wörter/min | ~162 Wörter/min |
| Erzählweise | Paar spricht in die Kamera + kurze Off-Sätze | Kandidaten filmen sich selbst + neutraler Off-Erzähler |
| Kameras | Cab-Cam (2er-Shot im LKW), Selfie, Drohne, Gimbal | Brustkamera (Weitwinkel), Selfie-Stick, Kino-B-Roll, Drohne |
| Karten | 4 kurze Einblendungen, alle im selben Stil | ~15 Grafiken in 5 Typen, Teil des Spieldesigns |
| Grafik-Ebene | Untertitel gelb/weiß, Screenshot-Karten (alte Videos, Artikel, Google Translate), Uhrzeit-Text, Testbild-Gag, Film-Meme | Untertitel, Info-Boxen, Geld-Zähler, Namenskarten im Sticker-Look, Team-Leiste unten, Rückblenden in Karten, Regel-Icons |
| Werbung | AG1-Integration mitten im Video (Teil der Geschichte: Thermalquelle) | Saily-Spot auf der Zielinsel gedreht |
| Ende | „Thanks for watching“ + Outtakes | Positionskarte aller Teams + Statistik-Karten + Cliffhanger |

**Tonklassen (Auszug):** In beiden Videos dominiert Fahrzeug- und Motorgeräusch nach Sprache. Island hat Wasser, Wind und Wellen als natürliche Atmo. Sound-Effekte wie Whoosh, Impact oder UI-Pieps wurden praktisch nicht erkannt; die Stimmung kommt aus Originalton und Musik.

---

## 3. Kartenanimationen – was, wann, wie

### Island: „Pastell-Topo mit Avatar“
- **Wann:** direkt nach einem Ortswechsel (Abfahrt, neues Tal, neue Etappe). 4 Stellen: 8:10, 11:00, 21:30, 32:10.
- **Dauer:** 4–5 s, Off-Satz läuft drüber.
- **Look:** helle Topo-Karte mit Relief, beige-graues Land, hellblaues Wasser, Gletscher weiß. Dünne dunkelgraue Linie. Spitze ist ein **rundes Foto mit weißem Ring und Pin**. Orte als **kleine weiße Etiketten** mit dunkler Schrift. Leicht geneigte Kamera, die langsam mitzieht.
- **In Mapanimator:** Look **„Reise-Vlog Pastell“** + Kamera-Preset **„Vlog-Einschub“** (5 s). Foto unter *Look → Foto/Avatar Spitze*.

### THE RACE: fünf Kartentypen
| Typ | Was | Wofür | In Mapanimator |
|---|---|---|---|
| **Nacht-GPS-Tracker** | dunkler Stadtplan, Neon-Spur je Team, runde Avatar-Blasen mit Teamfarbe, Kamera zoomt vom Viertel raus bis alle Teams im Bild sind | „Wo stehen alle gerade?“ – Spannung im Rennen | Look **„Race: Nacht-GPS“**, je Team eine Route mit eigener Farbe, Preset **„Tracker-Reveal“** |
| **Globus-Flug** | Satelliten-Globus, roter Leuchtbogen, Etiketten mit Flagge („HANOI 🇻🇳“), Zielring; Einstieg per Crash-Zoom aus der Stadt | die große Distanz spürbar machen | Look **„Race: Globus-Flug“** (Globus-Ansicht an), Preset **„Globus-Flug“** (mit Crash-Zoom), Stopp-Namen mit Flaggen-Emoji |
| **Grenz-Glühen** | dunkle Länderkarte, Grenze leuchtet rot, Route darüber, kleine graue Großbuchstaben | Probleme erklären („Für Laos braucht ihr ein Visum“) | Look **„Race: Grenz-Glühen“** + Markierung des Landes (*Ebenen → Markierungen*, Glühen an, Füllung fast 0) |
| **Regel-Silhouette** | abstrakte Insel mit Neon-Linien, gestrichelter Weg, Fahrzeug-Icon, rotes Kreuz | Regeln erklären | teils: Look Grenz-Glühen + Verkehrsmittel-Chips; Icons per Schild |
| **Split-Karte** | dunkle Karte als Kachel neben dem Live-Bild, gestrichelte Route, „3.290 KM · 7 Tage“, Teamname + Flagge | Plan eines Teams zeigen, ohne das Gespräch zu unterbrechen | Karte in 4:5 oder 1:1 rendern, im Schnittprogramm neben das Bild setzen; km/Tage über *Ebenen → Zähler* oder Labels |

Dazu: **Mini-Routengrafik** (orange Schlangenlinie auf Schwarz mit Zielflagge) als Intro-Element, und **Zoom aus dem All** auf die Startstadt.

### Was beide gemeinsam haben
- Karte = **ein Satz Information**. Nie Karte ohne Erzählung.
- **Gleicher Stil im ganzen Video** (Wiedererkennung).
- Karten kommen an **Übergängen** (Abfahrt, Ankunft, Regel, Problem), nie mitten in einer Szene.

---

## 4. Schnittstil

**Rhythmus.** Beide schneiden im Mittel alle 2,4 s. The Race legt im Einstieg 32 Schnitte/min vor und beruhigt danach auf ~15/min. Lange Einstellungen gibt es nur in Gesprächen am Tisch oder im Auto.

**Einstellungsarten (Island):**
- Cab-Cam (zwei Personen im Führerhaus, fest montiert) als Rückgrat – sehr viel Sendezeit, null Aufwand.
- Selfie-Weitwinkel für Reaktionen und Einschätzungen.
- Drohne für jede Fahrt durch Landschaft und für Übergänge.
- POV (Hände, Füße, Tür, Supermarkt).

**Einstellungsarten (The Race):**
- Brustkamera im Weitwinkel (Kandidaten filmen sich selbst – Bild wirkt roh und nah).
- Kino-B-Roll (Teleobjektiv, geringe Schärfentiefe) für Atmosphäre und Einstieg.
- Speed-Ramps und Bewegungsunschärfe bei Fahrten.

**Grafik als Erzählmittel statt Sprechen:**
- Untertitel in Farbe (Island: gelb für Pointen, weiß für normalen Text).
- **Screenshot-Karten:** eigener alter Video-Thumbnail („wie damals in der Wüste“), Wikipedia-/Artikel-Ausschnitt („F-Roads sind …“), Google-Translate für unaussprechliche Namen. Erklärt in 2 s, ohne dass jemand reden muss.
- **Info-Box** unten links (The Race: „Thuốc lào ist eine traditionelle Art …“).
- **Zähler** oben rechts (The Race: gesammeltes Geld in € und Landeswährung).
- **Uhrzeit/Tag** als Text (Island: „7:00 A.M.“, „Day 2“).
- **Meme-/Film-Einschübe** für Humor (Titanic-Szene, Testbild).

**Ton.** Sprache trägt alles; Musik läuft in Montagen (Island) bzw. als durchgehendes Bett unter Gesprächen (The Race). Kaum Sound-Design-Effekte – Originalton (Motor, Wind, Wasser) ist die Atmo.

---

## 5. Dramaturgie und Format

**Island (Vlog-Woche, Teil 1):**
1. Cold Open: 20 s Drohne + Polarlicht, Titel dezent eingeblendet.
2. Trailer der Woche mit dem Versprechen: *„eine der besten Wochen unseres Lebens – kommt mit“*.
3. Titelkarte (Glitch-Schrift) → **„24 hours earlier…“** → chronologisch.
4. Ankunft, Fahrzeug-Tour, erster Einkauf (Alltag macht nahbar).
5. Etappen mit Karte → Sehenswürdigkeit → Reaktion → Abend/Essen.
6. Werbung als Teil einer Szene.
7. Wiederkehrende Spannungsfrage: *Bleiben wir stecken? (50/50)*, Wind, Wasserdurchfahrten.
8. Ende: Gute Nacht + Outtakes.

**THE RACE (Spielshow-Doku):**
1. 40 s wortlose Stadt-Montage, Titel „HANOI“ hinter der Skyline.
2. Kandidaten mit Augenbinden, Uhr, Kameras – Countdown, Start.
3. **Off-Erzähler erklärt Prämisse und Regeln** mit Karten und Icons.
4. Parallelmontage mehrerer Teams, Positionskarte als Zwischenstand.
5. Konflikte: Koordinaten falsch übersetzt, Visum-Problem, kein Geld.
6. Ende: Positionen + Statistik + Cliffhanger.

**Was das Format trägt:** Prämisse mit Hindernis (Regeln, Budget, Zeit) + Menschen, die darauf reagieren + klare Orientierung (Karten, Zähler, Uhr).

---

## 6. Ideenfindung – das Muster hinter beiden Videos

> **Ort × Einschränkung × Frage**

- *Ort:* Island-Hochland, Vietnam → Indonesien.
- *Einschränkung:* LKW auf F-Roads, kein Geld/Handy, Grenzregel.
- *Frage, die das Publikum mitnimmt:* „Kommen sie durch?“ – „Wer ist zuerst da?“

Beispiele für deine Reisen (ohne vor der Kamera reden zu müssen):
- **„Mit 20 € durch [Stadt] – nur öffentliche Verkehrsmittel“** – Zähler-Overlay fürs Geld, Karte nach jeder Fahrt.
- **„Ich folge einen Tag lang nur den Empfehlungen von Einheimischen“** – andere Menschen sprechen, du filmst.
- **„Von Küste zu Küste in 48 Stunden“** – Nacht-GPS-Karte als Fortschritt, Uhr als Text.
- **„Die Route, die Google Maps nicht kennt“** – Grenz-Glühen-Karte erklärt Umwege.
- **„1 Ort, 3 Budgets“** – Split-Karte, drei Tage, drei Wege.
- **Serien-Shorts „Tag X“** – jede Folge endet mit der Recap-Karte und dem Zähler (wie Kamelfamilie).

---

## 7. Für dich: Reisevideos ohne vor der Kamera zu sprechen

Beide Videos zeigen, dass die Teile, die ein Format **zusammenhalten**, ohne Gesicht funktionieren: Einstieg, Karten, Regeln, Erklärungen, Atmosphäre.

**Format A – Der Off-Erzähler (wie The Race).**
Du erzählst nachträglich aus dem Off, ruhig und informativ, wie ein Doku-Sprecher. Das ist viel leichter als vor der Kamera: Text vorher schreiben, in Ruhe zu Hause einsprechen, beliebig oft wiederholen. Karten und B-Roll tragen das Bild.
*Bausteine:* Skript pro Etappe (3–5 Sätze), Karte unter jedem Ortswechsel, B-Roll-Montage, Musikbett.

**Format B – POV ohne Gesicht (wie die Brustkameras).**
Kamera vor der Brust oder am Kopf, deine Hände, dein Weg, deine Begegnungen. Sprechen nur kurz und spontan („Okay, da vorne ist der Bus“) – oder gar nicht, dann übernehmen Untertitel/Text.

**Format C – Text statt Stimme (Untertitel-Erzählung).**
Kurze Texttafeln und Untertitel erzählen (wie die Info-Boxen und Screenshot-Karten). Funktioniert besonders in Shorts; mit Zähler-Overlay und Labels direkt aus Mapanimator.

**Format D – Andere Menschen sprechen lassen.**
Du stellst Fragen hinter der Kamera, Einheimische und Mitreisende antworten (The Race lebt von Passanten-Begegnungen). Untertitel übersetzen.

**Format E – KI-Stimme als Brücke.**
Für den Anfang eine KI-Erzählstimme für das Off-Skript; später schrittweise durch deine eigene Stimme ersetzen.

**Schrittweise an die Kamera gewöhnen (optional):**
1. Nur Off-Stimme, zu Hause eingesprochen.
2. Kurze Reaktionen im Moment („Wow.“, „Das ist absurd.“) – ohne Gesicht im Bild.
3. Einzeiler mit Selfie-Stick von hinten/seitlich.
4. Erst dann längere Sätze in die Kamera.

---

## 8. Produktions-Workflow mit Mapanimator

1. **Vor der Reise:** Prämisse festlegen (Ort × Einschränkung × Frage), Karten-Look wählen (Pastell oder Race-Look) – im ganzen Video gleich lassen.
2. **Unterwegs:** jeden Ortswechsel mit 3 Einstellungen festhalten (Abfahrt, unterwegs, Ankunft) + Fotos mit GPS (für Schilder/Avatar).
3. **Skript:** pro Etappe ein Orientierungssatz für die Karte (*„Von hier sind es noch 45 km bis zum Camp“*).
4. **Karten rendern:** pro Etappe eine Szene (*Szenen-Leiste*), Look + Preset „Vlog-Einschub“ oder „Tracker-Reveal“, MP4 framegenau. Für viele Etappen: Plan-JSON + `node tools/render.mjs`.
5. **Schnitt:** Karte an den Übergang, Off-Satz drüber, 4–6 s. Musik als Bett unter Gesprächen, nicht auf den Beat schneiden müssen.
6. **Grafik-Ebene:** Zähler (km, Tag, Geld), Info-Boxen und Screenshot-Karten für Erklärungen statt Sprechen.
7. **Einstieg:** 20–40 s wortlose Montage der stärksten Bilder + ein Satz Prämisse + Titel.
8. **Ende:** Recap-Karte der Route + Frage/Cliffhanger für die nächste Folge.

### Checkliste pro Video
- [ ] Prämisse in einem Satz (Ort × Einschränkung × Frage)
- [ ] Einstieg ohne Sprechen: 20–40 s beste Bilder + Titel
- [ ] Jede Etappe: Karte + ein Off-Satz
- [ ] Wiederkehrende Spannungsfrage (schaffen wir es? reicht das Geld?)
- [ ] Zähler/Uhr/Tag als Orientierung
- [ ] Erklärungen als Info-Box oder Screenshot statt Monolog
- [ ] Ein Stil für alle Karten
- [ ] Ende mit Recap-Karte und Ausblick

---

## 9. Neu in Mapanimator durch diese Analyse

- **Kartenstile:** „Pastell-Topo“ (Island-Look), „Nacht-GPS“ (dunkler Stadtplan mit allen Straßen).
- **Globus-Ansicht** (Look-Tab, Karten-Stil) mit Atmosphäre – für Weltreise- und Flug-Karten.
- **Pin-Stil „Etikett (Ortsname)“** – kleine Chips wie in beiden Videos (hell auf hellen, dunkel auf dunklen Karten). Flaggen-Emoji im Ortsnamen funktioniert.
- **Übergang „Crash-Zoom“** (Kamera → Übergänge) – Hineinstürzen mit Zoom-Unschärfe wie beim Wechsel zum Globus.
- **Looks:** Reise-Vlog Pastell, Race: Nacht-GPS, Race: Globus-Flug, Race: Grenz-Glühen.
- **Kamera-Presets:** Vlog-Einschub, Tracker-Reveal, Globus-Flug.

Grenzen: Die Split-Karte und die Regel-Icons der Race-Grafiken werden im Schnittprogramm zusammengesetzt; Mapanimator liefert die Karte dafür. Musik- und Sound-Erkennung ist eine Schätzung (AudioSet-Modell); Whoosh-Effekte unter lauter Musik werden eventuell nicht erkannt.
