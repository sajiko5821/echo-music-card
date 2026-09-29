# 🎵 Spotify Show Card

Eine hochwertige, bildschirmfüllende Touch-Player-Karte für Home Assistant Lovelace Dashboards. Perfekt optimiert für Wand-Tablets, Echo Show Displays (z. B. via Fully Kiosk Browser / Silk) und Touchscreens.

---

## ✨ Features

- **Ambient Background**: Dynamischer Farbverlauf basierend auf den Farben des aktuellen Album-Covers (`albumcolor_1_entity` und `albumcolor_2_entity`).
- **Touch-optimierte Seekbar**: Interaktiver Fortschrittsbalken mit Drag- & Tap-Unterstützung und Zeitanzeige.
- **Vollständige Wiedergabesteuerung**:
  - Play / Pause
  - Vorheriger / Nächster Titel
  - Shuffle (Zufallswiedergabe)
  - Repeat (Aus, Alle, Einzelsong)
- **Lautstärkeregelung**: Interaktiver Lautstärkeregler inklusive Stummschalt-Button (Mute).
- **Header-Leiste**:
  - Zurück-Button mit frei definierbarem Dashboard-Pfad (`back_path`).
  - Integrierte Live-Uhrzeitanzeige (`show_clock`).
- **Responsive & Fullscreen**: Passt sich flexibel an 100vh Displays an.

---

## 📦 Installation in Home Assistant

### 1. Datei ablegen
Kopiere `spotify-show-card.js` in das `www/`-Verzeichnis deiner Home Assistant Installation (z. B. `/config/www/spotify-show-card.js`).

### 2. Lovelace-Ressource registrieren
Gehe in Home Assistant zu:
**Einstellungen** → **Dashboards** → **Drei Punkte oben rechts** → **Ressourcen** → **Ressource hinzufügen**:
- **URL**: `/local/spotify-show-card.js?v=1.0.0`
- **Ressourcentyp**: `JavaScript-Modul`

---

## ⚙️ Konfiguration

### Beispiel (Lovelace YAML)

```yaml
type: custom:spotify-show-card
entity: media_player.spotify_user
albumcolor_1_entity: input_text.spotify_albumcolor_1
albumcolor_2_entity: input_text.spotify_albumcolor_2
back_path: /lovelace/home
back_label: Zurück
show_clock: true
show_volume: true
```

### Konfigurationsparameter

| Parameter | Typ | Standardwert | Beschreibung |
| :--- | :--- | :--- | :--- |
| `entity` | `string` | `media_player.spotify_TODO_ANPASSEN` | Die `media_player`-Entität (z. B. Spotify-Integration). |
| `albumcolor_1_entity` | `string` | `input_text.spotify_albumcolor_1` | Entität mit dem Hex-Farbcode für die Primärfarbe. |
| `albumcolor_2_entity` | `string` | `input_text.spotify_albumcolor_2` | Entität mit dem Hex-Farbcode für die Sekundärfarbe. |
| `back_path` | `string` | `/TODO_ANPASSEN` | Zielpfad des Zurück-Buttons (z. B. zur Dashboard-Hauptseite). |
| `back_label` | `string` | `Zurück` | Beschriftung des Zurück-Buttons. |
| `show_clock` | `boolean` | `true` | Zeigt eine digitale Uhrzeit oben rechts an. |
| `show_volume` | `boolean` | `true` | Blendet Lautstärkeregler und Mute-Button ein/aus. |

---

## 🎨 Album-Farben Extractor (Tipp)

Um dynamische Album-Farben zu erhalten, kann ein Helper (`input_text.spotify_albumcolor_1` und `input_text.spotify_albumcolor_2`) über eine Automatisierung oder ein Python-Skript (z. B. via [Color Extractor](https://github.com/generic-user/color-extractor)) aktualisiert werden, sobald sich das Cover-Bild ändert.
Fallback-Farben sind im Code integriert (`#e05260` und `#6b46c1`).
