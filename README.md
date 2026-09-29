# 🎵 Echo Music Card for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/default)
[![GitHub Release](https://img.shields.io/github/v/release/sajiko5821/echo-music-card?style=for-the-badge&color=1DB954)](https://github.com/sajiko5821/echo-music-card/releases)
[![HACS Validation](https://img.shields.io/github/actions/workflow/status/sajiko5821/echo-music-card/validate.yml?branch=main&label=HACS%20Validation&style=for-the-badge)](https://github.com/sajiko5821/echo-music-card/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

A high-fidelity, full-screen touch player card for [Home Assistant](https://www.home-assistant.io/) Lovelace dashboards with automatic ambient cover color glow. Perfectly optimized for Echo Show displays (via Fully Kiosk / Silk), wall-mounted tablets, and desktop dashboards.

![Echo Music Card Preview](https://raw.githubusercontent.com/sajiko5821/echo-music-card/main/preview.png)

---

## ✨ Features

- **Standalone Dynamic Ambient Glow**: Extracts vibrant colors directly from the album art inside the browser using HTML5 Canvas (no external integrations or helper entities needed).
- **Smooth Transitions**: Elegant CSS cross-fade transitions when switching tracks and cover colors.
- **Touch-Optimized Seekbar**: Interactive progress bar with real-time drag & tap seeking, live timestamp updates, and duration calculation.
- **Full Playback Controls**: Play/Pause with optimistic UI updates, Next, Previous, Shuffle, and Repeat mode cycling (Off, All, One).
- **Volume & Mute**: Touch slider for volume adjustment and instant mute button.
- **Header Bar**: Back button with configurable target path (`back_path`) and label (`back_label`), automatically hidden if no path is provided.
- **Digital Clock**: Integrated live clock display.
- **Responsive Fullscreen**: Adapts seamlessly to 100vh screens and desktop window sizes.

---

## 📦 Installation via HACS (Recommended)

### 1-Click Install

Click the badge below to directly open this repository in your Home Assistant HACS:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=sajiko5821&repository=echo-music-card&category=plugin)

---

### Manual HACS Steps

1. Open **Home Assistant** and navigate to **HACS** > **Frontend**.
2. Click the **three dots `⋮`** in the top-right corner and choose **Custom repositories**.
3. Enter the repository details:
   - **Repository**: `https://github.com/sajiko5821/echo-music-card`
   - **Type**: `Dashboard` (or `Plugin`)
4. Click **Add**.
5. Find **Echo Music Card** in HACS and click **Download**.

---

## ⚙️ Configuration

### Minimal Example

```yaml
type: custom:echo-music-card
entity: media_player.spotify
```

### Full Example

```yaml
type: custom:echo-music-card
entity: media_player.spotify
back_path: /lovelace/home
back_label: Zurück
show_clock: true
show_volume: true
```

### Options

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `entity` | `string` | `media_player.spotify` | Target `media_player` entity (Spotify, Sonos, Chromecast, Apple Music, etc.). |
| `back_path` | `string` | `''` *(empty)* | URL path for the back button (e.g. `/lovelace/0`). If left empty, the button is hidden. |
| `back_label` | `string` | `Zurück` | Custom label text for the back button. |
| `show_clock` | `boolean` | `true` | Shows/hides the digital clock in the header. |
| `show_volume` | `boolean` | `true` | Shows/hides the volume slider and mute button. |
| `albumcolor_1_entity` | `string` | `null` | *(Optional)* Entity to override automatic color 1. |
| `albumcolor_2_entity` | `string` | `null` | *(Optional)* Entity to override automatic color 2. |

---

## 🛠️ Manual Installation (Without HACS)

If you do not use HACS:

1. Download [`echo-music-card.js`](echo-music-card.js) from this repository.
2. Place it into your Home Assistant configuration directory under `/config/www/echo-music-card.js`.
3. Add the resource under **Settings** > **Dashboards** > **Resources**:
   - **URL**: `/local/echo-music-card.js`
   - **Type**: `JavaScript Module`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
