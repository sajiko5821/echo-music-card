/**
 * Echo Music Card - Premium Music Display for Home Assistant
 * Designed for Touch Displays (Echo Show, Tablets) and Desktops
 * 
 * Features:
 * - Standalone Cover Color Extraction: Automatically extracts vibrant background glow colors
 *   directly from the album art inside the browser (no external integrations or helper entities needed).
 * - Full-screen responsive touch UI with seekbar, volume control, track metadata, and clock.
 */

class EchoMusicCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isDragging = false;
    this._dragPercent = 0;
    this._timer = null;
    this._lastStateKey = null;
    this._lastPicture = null;
    this._colors = { color1: '#64748b', color2: '#1e293b' };
  }

  // Global cache across renders and card instances
  static _colorCache = new Map();

  setConfig(config) {
    if (!config || !config.entity) {
      console.warn('[EchoMusicCard] No entity specified, defaulting to media_player.spotify');
    }
    this._config = {
      entity: 'media_player.spotify',
      back_path: '',
      back_label: 'Zurück',
      show_clock: true,
      show_volume: true,
      albumcolor_1_entity: null,
      albumcolor_2_entity: null,
      ...config
    };
  }

  connectedCallback() {
    this._startTimer();
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  _startTimer() {
    if (!this._timer) {
      this._timer = setInterval(() => this._tickProgress(), 500);
    }
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  set hass(hass) {
    this._hass = hass;
    const entity = hass.states[this._config.entity];

    // Priority 1: Check if manual color helper entities are configured and valid
    const manualC1 = this._config.albumcolor_1_entity ? hass.states[this._config.albumcolor_1_entity]?.state : null;
    const manualC2 = this._config.albumcolor_2_entity ? hass.states[this._config.albumcolor_2_entity]?.state : null;

    if (manualC1 && manualC2 && manualC1.startsWith('#') && manualC2.startsWith('#')) {
      this._applyColors(manualC1, manualC2);
    } else {
      // Priority 2: Standalone dynamic color extraction from album picture
      const currentPicture = entity?.attributes?.entity_picture;
      if (currentPicture && currentPicture !== this._lastPicture) {
        this._lastPicture = currentPicture;
        this._extractColors(currentPicture).then((colors) => {
          if (this._lastPicture === currentPicture && colors) {
            this._applyColors(colors.color1, colors.color2);
          }
        });
      }
    }

    // Check if re-render is needed (song, playback state, album art, or source changed)
    const stateKey = entity
      ? `${entity.state}_${entity.attributes.media_title}_${entity.attributes.entity_picture}_${entity.attributes.shuffle}_${entity.attributes.repeat}_${entity.attributes.source}`
      : 'no_entity';

    if (this._lastStateKey !== stateKey || !this.shadowRoot.querySelector('.player-wrapper')) {
      this._lastStateKey = stateKey;
      this._render();
    }

    this._updateDynamicValues();
  }

  _applyColors(color1, color2) {
    const brightColor1 = this._ensureContrast(color1, 0.54, 0.65);
    this._colors = { color1: brightColor1, color2 };
    this.style.setProperty('--c1', brightColor1);
    this.style.setProperty('--c2', color2);

    const wrapper = this.shadowRoot?.querySelector('.player-wrapper');
    if (wrapper) {
      wrapper.style.setProperty('--c1', brightColor1);
      wrapper.style.setProperty('--c2', color2);
    }

    // Explicitly update background style for older WebViews (e.g. Echo Show Silk)
    const ambientBg = this.shadowRoot?.querySelector('.ambient-bg');
    if (ambientBg) {
      ambientBg.style.background = `
        radial-gradient(circle at 25% 40%, ${brightColor1} 0%, transparent 45%),
        radial-gradient(circle at 75% 60%, ${color2} 0%, transparent 45%),
        radial-gradient(circle at 50% 10%, rgba(255,255,255,0.06) 0%, transparent 50%),
        #0b0d10
      `;
    }

    const playPauseBtn = this.shadowRoot?.querySelector('.btn-play-pause');
    if (playPauseBtn) {
      playPauseBtn.style.background = `linear-gradient(135deg, ${brightColor1} 0%, ${color2} 100%)`;
      playPauseBtn.style.boxShadow = `0 8px 24px -4px ${brightColor1}, 0 4px 12px rgba(0,0,0,0.5)`;
    }

    const seekbarFill = this.shadowRoot?.querySelector('#progress-bar-fill');
    if (seekbarFill) {
      seekbarFill.style.background = `linear-gradient(90deg, ${brightColor1} 0%, ${color2} 100%)`;
    }

    const coverArt = this.shadowRoot?.querySelector('.cover-art');
    if (coverArt) {
      coverArt.style.boxShadow = `0 16px 40px -10px rgba(0,0,0,0.7), 0 24px 60px -15px ${brightColor1}`;
    }
  }

  _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  }

  _hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  _ensureContrast(hex, minL = 0.54, minS = 0.65) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#1ed760';
    let r = parseInt(hex.slice(1, 3), 16) || 0;
    let g = parseInt(hex.slice(3, 5), 16) || 0;
    let b = parseInt(hex.slice(5, 7), 16) || 0;
    const hsl = this._rgbToHsl(r, g, b);
    if (hsl.s > 0.1) {
      hsl.l = Math.max(minL, Math.min(0.72, hsl.l));
      hsl.s = Math.max(minS, Math.min(0.95, hsl.s));
    } else {
      hsl.l = Math.max(0.75, hsl.l);
    }
    const rgb = this._hslToRgb(hsl.h, hsl.s, hsl.l);
    return '#' + [rgb.r, rgb.g, rgb.b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
  }

  _extractColors(pictureUrl) {
    if (!pictureUrl) {
      return Promise.resolve({ color1: '#64748b', color2: '#1e293b' });
    }
    if (EchoMusicCard._colorCache.has(pictureUrl)) {
      return Promise.resolve(EchoMusicCard._colorCache.get(pictureUrl));
    }

    return new Promise((resolve) => {
      // 1. Check if the image element is already rendered and loaded in DOM
      const domImg = this.shadowRoot?.querySelector('.cover-art');
      if (domImg && domImg.src.includes(pictureUrl) && domImg.complete && domImg.naturalWidth > 0) {
        try {
          const colors = this._extractFromCanvas(domImg);
          if (colors) {
            EchoMusicCard._colorCache.set(pictureUrl, colors);
            return resolve(colors);
          }
        } catch (e) {
          // Fall through to offscreen loader
        }
      }

      // 2. Offscreen Image Loader
      const img = new Image();
      // CRITICAL: NEVER set crossOrigin for relative or same-origin URLs!
      const isExternal = (pictureUrl.startsWith('http://') || pictureUrl.startsWith('https://')) &&
                         !pictureUrl.startsWith(window.location.origin);
      if (isExternal) {
        img.crossOrigin = 'Anonymous';
      }

      const timeout = setTimeout(() => {
        resolve({ color1: '#64748b', color2: '#1e293b' });
      }, 3000);

      const onDone = () => {
        clearTimeout(timeout);
        try {
          const colors = this._extractFromCanvas(img);
          if (colors) {
            EchoMusicCard._colorCache.set(pictureUrl, colors);
            resolve(colors);
          } else {
            resolve({ color1: '#64748b', color2: '#1e293b' });
          }
        } catch (err) {
          console.warn('[EchoMusicCard] Canvas extract error:', err);
          resolve({ color1: '#64748b', color2: '#1e293b' });
        }
      };

      img.onload = onDone;
      img.onerror = (err) => {
        clearTimeout(timeout);
        console.warn('[EchoMusicCard] Failed to load cover image:', pictureUrl, err);
        resolve({ color1: '#64748b', color2: '#1e293b' });
      };

      img.src = pictureUrl;
      if (img.complete && img.naturalWidth > 0) {
        onDone();
      }
    });
  }

  _extractFromCanvas(imageElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const size = 36;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(imageElement, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size).data;
    return this._computePalette(imgData);
  }

  _computePalette(data) {
    const buckets = new Map();
    let count = 0;
    let maxSat = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      count++;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      const lum = (max + min) / 510;

      // Handle numerical instability in HSL: calculate saturation accurately
      let sat = 0;
      if (d >= 8 && lum >= 0.05 && lum <= 0.95) {
        sat = d / (lum > 0.5 ? (510 - max - min) : (max + min));
      }
      if (sat > maxSat) maxSat = sat;

      // Give high preference to saturated, vibrant midtones
      // Heavily penalize achromatic pixels (black, gray, white backgrounds)
      let weight;
      if (sat < 0.15) {
        weight = 0.02; // heavily de-prioritize neutral/dark backgrounds
      } else {
        const lumBell = Math.max(0.1, 1.0 - Math.abs(lum - 0.5) * 1.5);
        weight = Math.pow(sat, 1.8) * 20 * lumBell;
      }

      // Extra suppression for extreme dark (<0.15) and extreme light (>0.85)
      if (lum < 0.15 || lum > 0.85) {
        weight *= 0.1;
      }

      // Quantize to steps of 20
      const qr = Math.min(255, Math.round(r / 20) * 20);
      const qg = Math.min(255, Math.round(g / 20) * 20);
      const qb = Math.min(255, Math.round(b / 20) * 20);
      const key = `${qr},${qg},${qb}`;

      const item = buckets.get(key);
      if (item) {
        item.score += weight;
      } else {
        buckets.set(key, { r: qr, g: qg, b: qb, sat, lum, score: weight });
      }
    }

    if (buckets.size === 0 || count === 0) {
      return { color1: '#1ed760', color2: '#124424' };
    }

    // If the cover is almost completely monochromatic / greyscale (e.g. white/grey/black cover)
    if (maxSat < 0.12) {
      return { color1: '#1ed760', color2: '#124424' };
    }

    // Sort by weighted score
    const sorted = Array.from(buckets.values()).sort((a, b) => b.score - a.score);
    let c1 = sorted[0];

    // Find a second distinct color
    let c2 = null;
    for (let i = 1; i < sorted.length; i++) {
      const cand = sorted[i];
      const dist = Math.hypot(cand.r - c1.r, cand.g - c1.g, cand.b - c1.b);
      if (dist > 45) {
        c2 = cand;
        break;
      }
    }

    // If monochromatic within the cluster, generate a complementary shifted tone
    if (!c2) {
      const h1 = this._rgbToHsl(c1.r, c1.g, c1.b);
      const shifted = this._hslToRgb((h1.h + 0.15) % 1.0, Math.max(0.5, h1.s), Math.max(0.25, h1.l * 0.7));
      c2 = { r: shifted.r, g: shifted.g, b: shifted.b };
    }

    const toHex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
    return { 
      color1: this._ensureContrast(toHex(c1), 0.54, 0.65), 
      color2: toHex(c2) 
    };
  }

  _formatTime(seconds) {
    if (isNaN(seconds) || seconds == null || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  _getCurrentPosition() {
    const entity = this._hass?.states[this._config.entity];
    if (!entity || !entity.attributes) return 0;

    const basePos = entity.attributes.media_position || 0;
    const duration = entity.attributes.media_duration || 0;

    if (entity.state === 'playing' && entity.attributes.media_position_updated_at) {
      const updatedAt = new Date(entity.attributes.media_position_updated_at).getTime();
      const now = Date.now();
      const diffSec = (now - updatedAt) / 1000;
      return Math.min(duration, Math.max(0, basePos + diffSec));
    }
    return basePos;
  }

  _tickProgress() {
    if (this._isDragging) return;
    this._updateSeekbarVisuals();
    this._updateClock();
  }

  _updateClock() {
    const clockEl = this.shadowRoot.querySelector('#clock-text');
    if (clockEl) {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      clockEl.textContent = `${h}:${m}`;
    }
  }

  _updateSeekbarVisuals() {
    const entity = this._hass?.states[this._config.entity];
    const duration = entity?.attributes?.media_duration || 0;
    const current = this._isDragging ? (this._dragPercent * duration) : this._getCurrentPosition();

    const timeCurEl = this.shadowRoot.querySelector('#time-current');
    const timeTotalEl = this.shadowRoot.querySelector('#time-total');
    const progressBar = this.shadowRoot.querySelector('#progress-bar-fill');
    const progressThumb = this.shadowRoot.querySelector('#progress-thumb');

    if (timeCurEl) timeCurEl.textContent = this._formatTime(current);
    if (timeTotalEl) timeTotalEl.textContent = this._formatTime(duration);

    const percent = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressThumb) progressThumb.style.left = `${percent}%`;
  }

  _updateDynamicValues() {
    this._updateSeekbarVisuals();
    this._updateClock();

    const entity = this._hass?.states[this._config.entity];
    if (!entity) return;

    // Volume update
    const vol = entity.attributes.volume_level != null ? Math.round(entity.attributes.volume_level * 100) : 50;
    const volFill = this.shadowRoot.querySelector('#vol-fill');
    const volThumb = this.shadowRoot.querySelector('#vol-thumb');
    const volPercent = this.shadowRoot.querySelector('#vol-percent');
    if (volFill) volFill.style.width = `${vol}%`;
    if (volThumb) volThumb.style.left = `${vol}%`;
    if (volPercent) volPercent.textContent = `${vol}%`;
  }

  _callService(domain, service, data = {}) {
    if (!this._hass) return;
    try {
      this._hass.callService(domain, service, data);
    } catch (err) {
      console.error(`[EchoMusicCard] callService error (${domain}.${service}):`, err);
    }
  }

  _handleAction(actionType, extraData = {}) {
    if (!this._hass) return;
    const entityId = this._config.entity;

    switch (actionType) {
      case 'play_pause': {
        const entity = this._hass.states[entityId];
        const isPlaying = entity?.state === 'playing';

        // Optimistic UI update
        const playIcon = this.shadowRoot.querySelector('#play-icon');
        if (playIcon) {
          playIcon.setAttribute('icon', isPlaying ? 'mdi:play' : 'mdi:pause');
        }

        // Direct native media_player service call
        this._callService('media_player', 'media_play_pause', { entity_id: entityId });
        break;
      }
      case 'next':
        this._callService('media_player', 'media_next_track', { entity_id: entityId });
        break;
      case 'previous':
        this._callService('media_player', 'media_previous_track', { entity_id: entityId });
        break;
      case 'shuffle': {
        const cur = this._hass.states[entityId]?.attributes?.shuffle || false;
        this._callService('media_player', 'shuffle_set', { entity_id: entityId, shuffle: !cur });
        break;
      }
      case 'repeat': {
        const cur = this._hass.states[entityId]?.attributes?.repeat || 'off';
        const nextMode = cur === 'off' ? 'all' : cur === 'all' ? 'one' : 'off';
        this._callService('media_player', 'repeat_set', { entity_id: entityId, repeat: nextMode });
        break;
      }
      case 'seek':
        if (extraData.position != null) {
          this._callService('media_player', 'media_seek', {
            entity_id: entityId,
            seek_position: Math.round(extraData.position)
          });
        }
        break;
      case 'volume':
        if (extraData.volume != null) {
          this._callService('media_player', 'volume_set', {
            entity_id: entityId,
            volume_level: extraData.volume
          });
        }
        break;
      case 'back':
        if (this._config.back_path) {
          window.history.pushState(null, '', this._config.back_path);
          window.dispatchEvent(new CustomEvent('location-changed'));
        }
        break;
    }
  }

  _render() {
    const entity = this._hass?.states[this._config.entity];

    if (!entity) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100vh;
            background: #0d0f12;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .missing-card {
            text-align: center;
            padding: 32px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          code {
            color: #64748b;
            background: rgba(0,0,0,0.3);
            padding: 2px 6px;
            border-radius: 4px;
          }
        </style>
        <div class="missing-card">
          <ha-icon icon="mdi:music-off" style="--mdc-icon-size: 48px; opacity: 0.5; margin-bottom: 12px;"></ha-icon>
          <h2 style="margin: 0 0 8px 0;">Echo Music Card</h2>
          <p style="margin: 0; opacity: 0.7;">Entität <code>${this._config.entity}</code> wurde nicht gefunden.</p>
        </div>
      `;
      return;
    }

    const isPlaying = entity.state === 'playing';
    const title = entity.attributes?.media_title || 'Keine Wiedergabe';
    const artist = entity.attributes?.media_artist || 'Bereit zur Wiedergabe';
    const album = entity.attributes?.media_album_name || '';
    const source = entity.attributes?.source || 'Spotify';
    const picture = entity.attributes?.entity_picture || '';
    const shuffleActive = entity.attributes?.shuffle === true;
    const repeatMode = entity.attributes?.repeat || 'off';
    const repeatActive = repeatMode !== 'off';
    const repeatIcon = repeatMode === 'one' ? 'mdi:repeat-once' : 'mdi:repeat';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100vh;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #ffffff;
          overflow: hidden;
        }

        * {
          box-sizing: border-box;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .player-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px 36px 28px 36px;
          background: #0d0f12;
          overflow: hidden;
          --c1: ${this._colors.color1};
          --c2: ${this._colors.color2};
        }

        /* Ambient Dynamic Background Glow */
        .ambient-bg {
          position: absolute;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 140%;
          background: 
            radial-gradient(circle at 25% 40%, var(--c1) 0%, transparent 45%),
            radial-gradient(circle at 75% 60%, var(--c2) 0%, transparent 45%),
            radial-gradient(circle at 50% 10%, rgba(255,255,255,0.06) 0%, transparent 50%),
            #0b0d10;
          opacity: 0.38;
          filter: blur(80px);
          z-index: 1;
          pointer-events: none;
          transition: background 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .content-layer {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
        }

        /* Top Header Navigation & Clock */
        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 54px;
        }

        .back-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          transition: all 0.2s ease;
        }

        .back-pill:hover, .back-pill:active {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
        }

        .source-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
        }

        .source-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #1db954;
          box-shadow: 0 0 8px #1db954;
        }

        .clock-display {
          font-size: 32px;
          font-weight: 600;
          letter-spacing: -0.5px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.95);
          transition: opacity 0.2s;
        }

        .clock-display:hover {
          opacity: 0.8;
        }

        /* Main Section: Cover Left, Meta Right */
        .main-section {
          display: flex;
          align-items: center;
          gap: 48px;
          flex: 1;
          min-height: 0;
          padding: 10px 0;
        }

        /* Cover Container */
        .cover-container {
          position: relative;
          height: 100%;
          max-height: 380px;
          aspect-ratio: 1 / 1;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cover-art {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 24px;
          box-shadow: 
            0 16px 40px -10px rgba(0,0,0,0.7),
            0 24px 60px -15px var(--c1);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s ease;
        }

        .cover-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Meta Info Container */
        .meta-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          min-width: 0;
          gap: 8px;
        }

        .track-title {
          font-size: 38px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.6px;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #ffffff;
          text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }

        .track-artist {
          font-size: 24px;
          font-weight: 500;
          line-height: 1.25;
          color: rgba(255, 255, 255, 0.85);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .album-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          font-size: 16px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .album-badge ha-icon {
          --mdc-icon-size: 18px;
          opacity: 0.7;
          pointer-events: none;
        }

        /* Volume Bar */
        .volume-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 18px;
          max-width: 320px;
        }

        .volume-icon {
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
        }

        .volume-slider-track {
          position: relative;
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
          cursor: pointer;
        }

        .volume-slider-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.85);
          width: 50%;
          pointer-events: none;
        }

        .volume-slider-thumb {
          position: absolute;
          top: 50%;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          transform: translate(-50%, -50%);
          box-shadow: 0 1px 4px rgba(0,0,0,0.5);
          pointer-events: none;
        }

        .volume-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          min-width: 34px;
          text-align: right;
        }

        /* Bottom Controls & Seekbar Area */
        .bottom-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 8px;
        }

        /* Seekbar */
        .seekbar-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .seekbar-track-area {
          position: relative;
          height: 32px;
          display: flex;
          align-items: center;
          cursor: pointer;
          touch-action: none;
        }

        .seekbar-background {
          position: relative;
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
          overflow: visible;
          transition: height 0.15s ease;
        }

        .seekbar-track-area:hover .seekbar-background {
          height: 8px;
        }

        .seekbar-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--c1) 0%, var(--c2) 100%);
          width: 0%;
          pointer-events: none;
        }

        .seekbar-thumb {
          position: absolute;
          top: 50%;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          transform: translate(-50%, -50%);
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          left: 0%;
          opacity: 0;
          transition: opacity 0.2s, transform 0.1s;
          pointer-events: none;
        }

        .seekbar-track-area:hover .seekbar-thumb,
        .seekbar-track-area:active .seekbar-thumb {
          opacity: 1;
        }

        .time-labels {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
          padding: 0 2px;
        }

        /* Control Buttons */
        .controls-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 36px;
        }

        .btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          position: relative;
        }

        .btn * {
          pointer-events: none;
        }

        .btn:hover {
          color: #ffffff;
          transform: scale(1.1);
        }

        .btn:active {
          transform: scale(0.92);
        }

        .btn-secondary {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.65);
          position: relative;
        }

        .btn-secondary.active {
          color: var(--c1, #1ed760);
          background: rgba(255, 255, 255, 0.12);
          box-shadow: 0 0 16px -2px var(--c1, rgba(30, 215, 96, 0.35));
        }

        .btn-secondary.active::after {
          content: '';
          position: absolute;
          bottom: 5px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--c1, #1ed760);
          box-shadow: 0 0 6px var(--c1, #1ed760);
        }

        .btn-skip {
          width: 56px;
          height: 56px;
          border-radius: 50%;
        }

        .btn-play-pause {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--c1) 0%, var(--c2) 100%);
          color: #ffffff;
          box-shadow: 
            0 8px 24px -4px var(--c1),
            0 4px 12px rgba(0,0,0,0.5);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .btn-play-pause:hover {
          transform: scale(1.08);
          box-shadow: 
            0 12px 30px -2px var(--c1),
            0 6px 16px rgba(0,0,0,0.6);
        }

        .btn-play-pause:active {
          transform: scale(0.92);
        }

        ha-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Responsive for small screens / Echo Show 5 */
        @media (max-height: 480px) {
          .player-wrapper {
            padding: 12px 20px 16px 20px;
          }
          .header-bar {
            height: 38px;
          }
          .clock-display {
            font-size: 24px;
          }
          .cover-container {
            max-height: 220px;
          }
          .track-title {
            font-size: 26px;
          }
          .track-artist {
            font-size: 18px;
          }
          .btn-play-pause {
            width: 60px;
            height: 60px;
          }
          .controls-row {
            gap: 20px;
          }
        }
      </style>

      <div class="player-wrapper">
        <div class="ambient-bg"></div>

        <div class="content-layer">
          <!-- Header -->
          <div class="header-bar">
            ${this._config.back_path ? `
              <div class="back-pill" id="btn-back">
                <ha-icon icon="mdi:arrow-left"></ha-icon>
                <span>${this._config.back_label || 'Zurück'}</span>
              </div>
            ` : '<div style="width: 1px;"></div>'}

            <div class="source-pill">
              <div class="source-dot"></div>
              <span>${source}</span>
            </div>

            ${this._config.show_clock !== false ? `
              <div class="clock-display" id="clock-display">
                <span id="clock-text">--:--</span>
              </div>
            ` : '<div style="width: 1px;"></div>'}
          </div>

          <!-- Main Track Details & Cover -->
          <div class="main-section">
            <div class="cover-container">
              ${picture 
                ? `<img class="cover-art" src="${picture}" alt="Album Cover" />` 
                : `<div class="cover-placeholder"><ha-icon icon="mdi:music" style="--mdc-icon-size: 72px; opacity: 0.3;"></ha-icon></div>`
              }
            </div>

            <div class="meta-container">
              <h1 class="track-title" title="${title}">${title}</h1>
              <h2 class="track-artist" title="${artist}">${artist}</h2>
              ${album ? `
                <div class="album-badge">
                  <ha-icon icon="mdi:album"></ha-icon>
                  <span>${album}</span>
                </div>
              ` : ''}

              <!-- Volume Control -->
              ${this._config.show_volume !== false ? `
                <div class="volume-row">
                  <ha-icon class="volume-icon" id="btn-mute" icon="mdi:volume-high" style="--mdc-icon-size: 20px; cursor: pointer;"></ha-icon>
                  <div class="volume-slider-track" id="vol-track">
                    <div class="volume-slider-fill" id="vol-fill"></div>
                    <div class="volume-slider-thumb" id="vol-thumb"></div>
                  </div>
                  <span class="volume-text" id="vol-percent">50%</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Bottom Seekbar & Controls -->
          <div class="bottom-section">
            <!-- Seekbar -->
            <div class="seekbar-container">
              <div class="seekbar-track-area" id="seek-area">
                <div class="seekbar-background">
                  <div class="seekbar-fill" id="progress-bar-fill"></div>
                  <div class="seekbar-thumb" id="progress-thumb"></div>
                </div>
              </div>
              <div class="time-labels">
                <span id="time-current">0:00</span>
                <span id="time-total">0:00</span>
              </div>
            </div>

            <!-- Playback Controls -->
            <div class="controls-row">
              <button class="btn btn-secondary ${shuffleActive ? 'active' : ''}" id="btn-shuffle" title="Zufallswiedergabe">
                <ha-icon icon="mdi:shuffle" style="--mdc-icon-size: 26px;"></ha-icon>
              </button>

              <button class="btn btn-skip" id="btn-prev" title="Vorheriger Titel">
                <ha-icon icon="mdi:skip-previous" style="--mdc-icon-size: 40px;"></ha-icon>
              </button>

              <button class="btn btn-play-pause" id="btn-play" title="${isPlaying ? 'Pause' : 'Wiedergabe'}">
                <ha-icon id="play-icon" icon="${isPlaying ? 'mdi:pause' : 'mdi:play'}" style="--mdc-icon-size: 44px;"></ha-icon>
              </button>

              <button class="btn btn-skip" id="btn-next" title="Nächster Titel">
                <ha-icon icon="mdi:skip-next" style="--mdc-icon-size: 40px;"></ha-icon>
              </button>

              <button class="btn btn-secondary ${repeatActive ? 'active' : ''}" id="btn-repeat" title="Wiederholung">
                <ha-icon icon="${repeatIcon}" style="--mdc-icon-size: 26px;"></ha-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
    this._updateDynamicValues();
  }

  _bindEvents() {
    const bindTap = (el, callback) => {
      if (!el) return;
      let moved = false;
      let startX = 0, startY = 0;

      el.addEventListener('touchstart', (e) => {
        moved = false;
        if (e.touches && e.touches[0]) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        }
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          const dx = Math.abs(e.touches[0].clientX - startX);
          const dy = Math.abs(e.touches[0].clientY - startY);
          if (dx > 10 || dy > 10) moved = true;
        }
      }, { passive: true });

      el.addEventListener('touchend', (e) => {
        if (!moved) {
          e.preventDefault();
          e.stopPropagation();
          callback();
        }
      });

      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        callback();
      });
    };

    // Navigation
    const btnBack = this.shadowRoot.querySelector('#btn-back');
    if (btnBack) {
      bindTap(btnBack, () => this._handleAction('back'));
    }

    const clockDisplay = this.shadowRoot.querySelector('#clock-display');
    if (clockDisplay && this._config.back_path) {
      bindTap(clockDisplay, () => this._handleAction('back'));
    }

    // Controls
    bindTap(this.shadowRoot.querySelector('#btn-play'), () => this._handleAction('play_pause'));
    bindTap(this.shadowRoot.querySelector('#btn-next'), () => this._handleAction('next'));
    bindTap(this.shadowRoot.querySelector('#btn-prev'), () => this._handleAction('previous'));
    bindTap(this.shadowRoot.querySelector('#btn-shuffle'), () => this._handleAction('shuffle'));
    bindTap(this.shadowRoot.querySelector('#btn-repeat'), () => this._handleAction('repeat'));

    // Auto extract colors when the DOM cover image loads
    const coverImg = this.shadowRoot.querySelector('.cover-art');
    if (coverImg) {
      const handleCoverLoad = () => {
        const manualC1 = this._config.albumcolor_1_entity ? this._hass?.states[this._config.albumcolor_1_entity]?.state : null;
        if (!manualC1 || !manualC1.startsWith('#')) {
          try {
            const colors = this._extractFromCanvas(coverImg);
            if (colors) {
              const currentPic = this._hass?.states[this._config.entity]?.attributes?.entity_picture;
              if (currentPic) EchoMusicCard._colorCache.set(currentPic, colors);
              this._applyColors(colors.color1, colors.color2);
            }
          } catch (e) {
            console.warn('[EchoMusicCard] Could not sample DOM cover:', e);
          }
        }
      };

      if (coverImg.complete && coverImg.naturalWidth > 0) {
        handleCoverLoad();
      } else {
        coverImg.addEventListener('load', handleCoverLoad);
      }
    }

    // Seekbar Interactions
    const seekArea = this.shadowRoot.querySelector('#seek-area');
    if (seekArea) {
      const handleSeek = (e) => {
        const rect = seekArea.getBoundingClientRect();
        const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0]?.clientX);
        if (clientX == null) return;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const percent = x / rect.width;
        this._dragPercent = percent;

        const entity = this._hass?.states[this._config.entity];
        const duration = entity?.attributes?.media_duration || 0;
        const targetPos = Math.round(percent * duration);

        const timeCurEl = this.shadowRoot.querySelector('#time-current');
        const progressBar = this.shadowRoot.querySelector('#progress-bar-fill');
        const progressThumb = this.shadowRoot.querySelector('#progress-thumb');

        if (timeCurEl) timeCurEl.textContent = this._formatTime(targetPos);
        if (progressBar) progressBar.style.width = `${percent * 100}%`;
        if (progressThumb) progressThumb.style.left = `${percent * 100}%`;
      };

      const commitSeek = () => {
        if (!this._isDragging) return;
        this._isDragging = false;
        const entity = this._hass?.states[this._config.entity];
        const duration = entity?.attributes?.media_duration || 0;
        const targetPos = Math.round(this._dragPercent * duration);
        this._handleAction('seek', { position: targetPos });
      };

      seekArea.addEventListener('mousedown', (e) => {
        this._isDragging = true;
        handleSeek(e);
        const onMouseMove = (e) => {
          if (this._isDragging) handleSeek(e);
        };
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          commitSeek();
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      seekArea.addEventListener('touchstart', (e) => {
        this._isDragging = true;
        handleSeek(e);
      }, { passive: true });

      seekArea.addEventListener('touchmove', (e) => {
        if (this._isDragging) handleSeek(e);
      }, { passive: true });

      seekArea.addEventListener('touchend', () => {
        commitSeek();
      });
    }

    // Volume Slider Interactions
    const volTrack = this.shadowRoot.querySelector('#vol-track');
    const btnMute = this.shadowRoot.querySelector('#btn-mute');

    if (volTrack) {
      const handleVol = (e) => {
        const rect = volTrack.getBoundingClientRect();
        const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0]?.clientX);
        if (clientX == null) return;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const volLevel = Math.max(0, Math.min(1, x / rect.width));
        this._handleAction('volume', { volume: Math.round(volLevel * 100) / 100 });
      };

      bindTap(volTrack, (e) => handleVol(e));
    }

    if (btnMute) {
      bindTap(btnMute, () => {
        const entity = this._hass?.states[this._config.entity];
        const curVol = entity?.attributes?.volume_level || 0;
        this._handleAction('volume', { volume: curVol > 0 ? 0 : 0.5 });
      });
    }
  }

  getCardSize() {
    return 6;
  }
}

customElements.define('echo-music-card', EchoMusicCard);

// Backward compatibility alias so existing configs continue to work seamlessly
if (!customElements.get('spotify-show-card')) {
  customElements.define('spotify-show-card', class extends EchoMusicCard {});
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'echo-music-card',
  name: 'Echo Music Card',
  description: 'Full-screen hi-fi music player card with automatic cover color glow'
});
