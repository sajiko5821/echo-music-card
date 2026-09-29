/**
 * Spotify Show Card - Premium Music Display for Home Assistant
 * Designed for Touch Displays (Echo Show, Tablets) and Desktops
 */

class SpotifyShowCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isDragging = false;
    this._dragPercent = 0;
    this._timer = null;
    this._lastStateKey = null;
  }

  setConfig(config) {
    this._config = {
      entity: 'media_player.spotify_TODO_ANPASSEN',
      albumcolor_1_entity: 'input_text.spotify_albumcolor_1',
      albumcolor_2_entity: 'input_text.spotify_albumcolor_2',
      back_path: '/TODO_ANPASSEN',
      back_label: 'Zurück',
      show_clock: true,
      show_volume: true,
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
    const color1 = hass.states[this._config.albumcolor_1_entity]?.state || '#e05260';
    const color2 = hass.states[this._config.albumcolor_2_entity]?.state || '#6b46c1';

    // Check if re-render is needed (only when song, state or cover actually changes)
    const stateKey = entity
      ? `${entity.state}_${entity.attributes.media_title}_${entity.attributes.entity_picture}_${entity.attributes.shuffle}_${entity.attributes.repeat}_${color1}_${color2}`
      : 'no_entity';

    if (this._lastStateKey !== stateKey || !this.shadowRoot.querySelector('.player-wrapper')) {
      this._lastStateKey = stateKey;
      this._render();
    }

    this._updateDynamicValues();
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
      console.error(`[SpotifyShowCard] callService error (${domain}.${service}):`, err);
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
    const color1 = this._hass?.states[this._config.albumcolor_1_entity]?.state || '#e05260';
    const color2 = this._hass?.states[this._config.albumcolor_2_entity]?.state || '#6b46c1';

    const isPlaying = entity?.state === 'playing';
    const title = entity?.attributes?.media_title || 'Keine Wiedergabe';
    const artist = entity?.attributes?.media_artist || 'Spotify bereit';
    const album = entity?.attributes?.media_album_name || '';
    const source = entity?.attributes?.source || 'Spotify';
    const picture = entity?.attributes?.entity_picture || '';
    const shuffleActive = entity?.attributes?.shuffle === true;
    const repeatMode = entity?.attributes?.repeat || 'off';
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
          --c1: ${color1};
          --c2: ${color2};
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
        }

        .btn-secondary.active {
          color: var(--c1);
          background: rgba(255, 255, 255, 0.08);
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
            <div class="back-pill" id="btn-back">
              <ha-icon icon="mdi:arrow-left"></ha-icon>
              <span>${this._config.back_label || 'Zurück'}</span>
            </div>

            <div class="source-pill">
              <div class="source-dot"></div>
              <span>${source}</span>
            </div>

            <div class="clock-display" id="clock-display">
              <span id="clock-text">--:--</span>
            </div>
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
              <div class="volume-row">
                <ha-icon class="volume-icon" id="btn-mute" icon="mdi:volume-high" style="--mdc-icon-size: 20px; cursor: pointer;"></ha-icon>
                <div class="volume-slider-track" id="vol-track">
                  <div class="volume-slider-fill" id="vol-fill"></div>
                  <div class="volume-slider-thumb" id="vol-thumb"></div>
                </div>
                <span class="volume-text" id="vol-percent">50%</span>
              </div>
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
    bindTap(this.shadowRoot.querySelector('#btn-back'), () => this._handleAction('back'));
    bindTap(this.shadowRoot.querySelector('#clock-display'), () => this._handleAction('back'));

    // Controls
    bindTap(this.shadowRoot.querySelector('#btn-play'), () => this._handleAction('play_pause'));
    bindTap(this.shadowRoot.querySelector('#btn-next'), () => this._handleAction('next'));
    bindTap(this.shadowRoot.querySelector('#btn-prev'), () => this._handleAction('previous'));
    bindTap(this.shadowRoot.querySelector('#btn-shuffle'), () => this._handleAction('shuffle'));
    bindTap(this.shadowRoot.querySelector('#btn-repeat'), () => this._handleAction('repeat'));

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
        const onMouseMove = (ev) => {
          if (this._isDragging) handleSeek(ev);
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

customElements.define('spotify-show-card', SpotifyShowCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'spotify-show-card',
  name: 'Spotify Show Card',
  description: 'Full-screen hi-fi Spotify player card for tablets and Echo Show displays'
});
