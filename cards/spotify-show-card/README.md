# Spotify Show Card

Eine hochwertige, bildschirmfüllende Touch-Player-Karte für Home Assistant Lovelace Dashboards. Perfekt optimiert für Wand-Tablets, Echo Show Displays (z. B. via Fully Kiosk Browser / Silk) und Touchscreens.

---

## Features

- **Ambient Background**: 
  - Die dominanten und harmonischen Farben werden **automatisch und direkt im Browser aus dem Album-Cover berechnet**.
  - Weicher, eleganter CSS-Überblendungseffekt beim Track- und Farbwechsel.
- **Touch-optimierte Seekbar**: Interaktiver Fortschrittsbalken mit Drag- & Tap-Unterstützung und Live-Zeitanzeige.
- **Vollständige Wiedergabesteuerung**:
  - Play / Pause (mit optimistic UI-Update)
  - Vorheriger / Nächster Titel
  - Shuffle (Zufallswiedergabe)
  - Repeat (Aus, Alle, Einzelsong)
- **Lautstärkeregelung**: Interaktiver Lautstärkeregler inklusive Stummschalt-Button (Mute).
- **Header-Leiste**:
  - Zurück-Button mit frei definierbarem Dashboard-Pfad (`back_path`) und Label (`back_label`) – wird automatisch ausgeblendet, falls kein Pfad angegeben ist.
  - Integrierte Live-Uhrzeitanzeige (`show_clock`).
- **Responsive & Fullscreen**: Passt sich flexibel an Touch-Displays und Desktops an.

---

## Installation in Home Assistant

### 1. Datei ablegen
Kopiere `spotify-show-card.js` in das `www/`-Verzeichnis deiner Home Assistant Installation (z. B. `/config/www/spotify-show-card.js`).

### 2. Lovelace-Ressource registrieren
Gehe in Home Assistant zu:
**Einstellungen** → **Dashboards** → **Drei Punkte oben rechts** → **Ressourcen** → **Ressource hinzufügen**:
- **URL**: `/local/spotify-show-card.js?v=1.0.0`
- **Ressourcentyp**: `JavaScript-Modul`

---

## Konfiguration

### Minimales Beispiel (Lovelace YAML)

```yaml
type: custom:spotify-show-card
entity: media_player.spotify
```

### Vollständiges Beispiel

```yaml
type: custom:spotify-show-card
entity: media_player.spotify
back_path: /lovelace/home
back_label: Zurück
show_clock: true
show_volume: true
```

### Konfigurationsparameter

| Parameter | Typ | Standardwert | Beschreibung |
| :--- | :--- | :--- | :--- |
| `entity` | `string` | `media_player.spotify` | Die `media_player`-Entität (funktioniert mit Spotify, Sonos, Chromecast, Apple Music etc.). |
| `back_path` | `string` | `''` *(leer)* | Zielpfad des Zurück-Buttons (z. B. `/lovelace/0`). Bleibt der Pfad leer, wird der Button ausgeblendet. |
| `back_label` | `string` | `Zurück` | Beschriftung des Zurück-Buttons. |
| `show_clock` | `boolean` | `true` | Zeigt eine digitale Uhrzeit oben rechts an. |
| `show_volume` | `boolean` | `true` | Blendet Lautstärkeregler und Mute-Button ein/aus. |
| `albumcolor_1_entity` | `string` | `null` | *(Optional)* Überschreibt die automatische Farberkennung mit einem manuellen Farb-Helper für Farbe 1. |
| `albumcolor_2_entity` | `string` | `null` | *(Optional)* Überschreibt die automatische Farberkennung mit einem manuellen Farb-Helper für Farbe 2. |
