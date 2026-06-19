// Metronome Overlay plugin
// Adds audible click and visual flash on beats, synced to the song's tempo.

let _metAudioCtx = null;
const MET_SETTINGS_KEY = 'slopsmithMetronomeSettings';
const DRAW_HOOK_RETRY_DELAY_MS = 1000;
const _metSettings = window[MET_SETTINGS_KEY] || (window[MET_SETTINGS_KEY] = {
    enabled: false,
    volume: 0.4,
    flashEnabled: true,
});
const MET_STATE_KEY = 'slopsmithMetronomeState';
const _metState = window[MET_STATE_KEY] || (window[MET_STATE_KEY] = {
    lastBeatIdx: -1,
    flashAlpha: 0,
});
let _metNextDrawHookRetryAtMs = 0;

function _metClick(high) {
    if (!_metAudioCtx) _metAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_metSettings.volume <= 0) return;
    const osc = _metAudioCtx.createOscillator();
    const gain = _metAudioCtx.createGain();
    osc.connect(gain);
    gain.connect(_metAudioCtx.destination);
    osc.frequency.value = high ? 1500 : 1000;
    osc.type = 'sine';
    gain.gain.setValueAtTime(_metSettings.volume, _metAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _metAudioCtx.currentTime + 0.06);
    osc.start(_metAudioCtx.currentTime);
    osc.stop(_metAudioCtx.currentTime + 0.06);
}

function _metFlash(isMeasure) {
    if (_metSettings.flashEnabled) _metState.flashAlpha = isMeasure ? 0.35 : 0.15;
}

function _metBindVolumeSlider(slider) {
    if (typeof slider.oninput === 'function') {
        // Clear legacy property handler from earlier plugin versions.
        slider.oninput = null;
    }
    if (slider._metVolumeListener) {
        slider.removeEventListener('input', slider._metVolumeListener);
    }
    slider.value = Math.round(_metSettings.volume * 100);
    const volLabel = document.getElementById('met-vol-label');
    if (volLabel) volLabel.textContent = `${slider.value}%`;
    slider._metVolumeListener = function() { _metSetVolume(this.value); };
    slider.addEventListener('input', slider._metVolumeListener);
}

function _metBindFlashCheck(flashCheck) {
    if (typeof flashCheck.onchange === 'function') {
        // Clear legacy property/inline handler from earlier plugin versions.
        flashCheck.onchange = null;
    }
    if (flashCheck._metFlashListener) {
        flashCheck.removeEventListener('change', flashCheck._metFlashListener);
    }
    flashCheck.checked = _metSettings.flashEnabled;
    flashCheck._metFlashListener = function() { _metSettings.flashEnabled = this.checked; };
    flashCheck.addEventListener('change', flashCheck._metFlashListener);
}

// Inject toggle button into player controls
function _metInjectButton() {
    const controls = document.getElementById('player-controls');
    if (!controls) return;
    const existingBtn = document.getElementById('btn-metronome');
    if (existingBtn) {
        const existingSlider = document.getElementById('met-volume');
        const existingFlashCheck = document.getElementById('met-flash-check');
        existingBtn.onclick = _metToggle;
        if (existingSlider) _metBindVolumeSlider(existingSlider);
        if (existingFlashCheck) _metBindFlashCheck(existingFlashCheck);
        _metSyncUi();
        return;
    }

    const lyricsBtn = document.getElementById('btn-lyrics');
    const insertBefore = lyricsBtn?.nextSibling || controls.querySelector('button:last-child');

    const btn = document.createElement('button');
    btn.id = 'btn-metronome';
    btn.className = 'px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded-lg text-xs text-gray-500 transition';
    btn.textContent = 'Metronome';
    btn.title = 'Toggle metronome click';
    btn.onclick = _metToggle;
    if (insertBefore && insertBefore.parentNode === controls) controls.insertBefore(btn, insertBefore); else controls.appendChild(btn);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'met-volume';
    slider.min = '0';
    slider.max = '100';
    slider.className = 'w-16 accent-amber-400 hidden';
    _metBindVolumeSlider(slider);
    if (insertBefore && insertBefore.parentNode === controls) controls.insertBefore(slider, insertBefore); else controls.appendChild(slider);

    const label = document.createElement('span');
    label.id = 'met-vol-label';
    label.className = 'text-xs text-gray-500 w-8 hidden';
    label.textContent = `${Math.round(_metSettings.volume * 100)}%`;
    if (insertBefore && insertBefore.parentNode === controls) controls.insertBefore(label, insertBefore); else controls.appendChild(label);

    const flashLabel = document.createElement('label');
    flashLabel.id = 'met-flash-label';
    flashLabel.className = 'flex items-center gap-1 text-xs text-gray-500 cursor-pointer hidden';
    const flashCheck = document.createElement('input');
    flashCheck.type = 'checkbox';
    flashCheck.id = 'met-flash-check';
    flashCheck.className = 'accent-amber-400';
    flashLabel.appendChild(flashCheck);
    flashLabel.appendChild(document.createTextNode(' Flash'));
    if (insertBefore && insertBefore.parentNode === controls) controls.insertBefore(flashLabel, insertBefore); else controls.appendChild(flashLabel);
    _metBindFlashCheck(flashCheck);
    _metSyncUi();
}

function _metSyncUi() {
    const enabled = _metSettings.enabled;
    const btn = document.getElementById('btn-metronome');
    const slider = document.getElementById('met-volume');
    const label = document.getElementById('met-vol-label');
    const flashLabel = document.getElementById('met-flash-label');
    if (btn) {
        btn.className = enabled
            ? 'px-3 py-1.5 bg-amber-900/50 rounded-lg text-xs text-amber-300 transition'
            : 'px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded-lg text-xs text-gray-500 transition';
        btn.textContent = enabled ? 'Metronome ✓' : 'Metronome';
    }
    if (slider) slider.classList.toggle('hidden', !enabled);
    if (label) label.classList.toggle('hidden', !enabled);
    if (flashLabel) flashLabel.classList.toggle('hidden', !enabled);
}

function _metToggle() {
    _metSettings.enabled = !_metSettings.enabled;
    _metSyncUi();
    _metState.lastBeatIdx = -1;
}

function _metSetVolume(v) {
    _metSettings.volume = v / 100;
    const volLabel = document.getElementById('met-vol-label');
    if (volLabel) volLabel.textContent = v + '%';
}

const DRAW_HOOK_HIGHWAY_REF_KEY = 'slopsmithMetronomeDrawHookHighwayRef';

function _metGetHighway() {
    return typeof highway !== 'undefined' ? highway : null;
}

function _metEnsureDrawHookInstalled() {
    const currentHighway = _metGetHighway();
    if (
        !currentHighway ||
        typeof currentHighway.addDrawHook !== 'function' ||
        window[DRAW_HOOK_HIGHWAY_REF_KEY] === currentHighway
    ) {
        return;
    }

    currentHighway.addDrawHook(function(ctx, W, H) {
        if (_metState.flashAlpha < 0.005) return;

        // Flash across the play line area
        const y = H * 0.72;
        const h = H * 0.18;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, `rgba(255, 200, 60, 0)`);
        grad.addColorStop(0.5, `rgba(255, 200, 60, ${_metState.flashAlpha})`);
        grad.addColorStop(1, `rgba(255, 200, 60, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, W, h);

        // Fade
        _metState.flashAlpha *= 0.88;
    });
    window[DRAW_HOOK_HIGHWAY_REF_KEY] = currentHighway;
}

// Main tick — called from a polling loop
function _metTick() {
    const currentHighway = _metGetHighway();
    if (
        !currentHighway ||
        typeof currentHighway.getBeats !== 'function' ||
        typeof currentHighway.getTime !== 'function'
    ) {
        return;
    }
    if (!_metSettings.enabled) {
        _metState.flashAlpha = 0;
        return;
    }
    const beats = currentHighway.getBeats();
    const t = currentHighway.getTime();
    if (!beats || beats.length === 0) return;

    // Find the current beat (the most recent beat <= current time)
    let lo = 0, hi = beats.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (beats[mid].time <= t) lo = mid + 1;
        else hi = mid;
    }
    const idx = lo - 1;
    if (idx < 0 || idx === _metState.lastBeatIdx) {
        // Fade out flash
        _metState.flashAlpha *= 0.85;
        return;
    }

    // Only trigger if we're close to the beat (within 50ms) to avoid catching up on seeks
    const beatTime = beats[idx].time;
    if (Math.abs(t - beatTime) > 0.05) {
        _metState.lastBeatIdx = idx;
        _metState.flashAlpha *= 0.85;
        return;
    }

    _metState.lastBeatIdx = idx;
    const isMeasure = beats[idx].measure >= 0;
    _metClick(isMeasure);
    _metFlash(isMeasure);
}

// Register draw hook on the highway renderer for the visual flash
_metEnsureDrawHookInstalled();

// Poll at 60fps for beat detection
const TICK_INTERVAL_ID_KEY = 'slopsmithMetronomeTickIntervalId';
if (window[TICK_INTERVAL_ID_KEY]) {
    clearInterval(window[TICK_INTERVAL_ID_KEY]);
}
window[TICK_INTERVAL_ID_KEY] = setInterval(function() {
    const currentHighway = _metGetHighway();
    const now = Date.now();
    if (
        window[DRAW_HOOK_HIGHWAY_REF_KEY] !== currentHighway &&
        now >= _metNextDrawHookRetryAtMs
    ) {
        _metEnsureDrawHookInstalled();
        _metNextDrawHookRetryAtMs = now + DRAW_HOOK_RETRY_DELAY_MS;
    }
    _metTick();
}, 1000 / 60);

// Hook into playSong to inject button and reset state
(function() {
    const METRONOME_HOOKS_INSTALLED_KEY = '__slopsmithMetronomeHooksInstalled';
    const INSTALLED_PLAY_SONG_WRAPPER_REF_KEY = '__slopsmithMetronomeInstalledPlaySongWrapperRef';
    const PLAY_SONG_WRAPPED_TAG = 'slopsmithMetronomePlaySongWrapped';
    const PLAY_SONG_ORIGINAL_REF_TAG = 'slopsmithMetronomePlaySongOriginalRef';
    const currentPlaySong = window.playSong;
    if (typeof currentPlaySong !== 'function') return;
    const installedPlaySongRef = window[INSTALLED_PLAY_SONG_WRAPPER_REF_KEY];
    if (
        window[METRONOME_HOOKS_INSTALLED_KEY] === true &&
        installedPlaySongRef === currentPlaySong &&
        currentPlaySong[PLAY_SONG_WRAPPED_TAG] === true
    ) {
        return;
    }
    const playSongBaseFn = (
        currentPlaySong[PLAY_SONG_WRAPPED_TAG] === true &&
        typeof currentPlaySong[PLAY_SONG_ORIGINAL_REF_TAG] === 'function'
    )
        ? currentPlaySong[PLAY_SONG_ORIGINAL_REF_TAG]
        : currentPlaySong;

    const wrappedPlaySong = async function(filename, arrangement) {
        _metState.lastBeatIdx = -1;
        await playSongBaseFn(filename, arrangement);
        _metInjectButton();
    };
    wrappedPlaySong[PLAY_SONG_WRAPPED_TAG] = true;
    wrappedPlaySong[PLAY_SONG_ORIGINAL_REF_TAG] = playSongBaseFn;
    window.playSong = wrappedPlaySong;
    window[INSTALLED_PLAY_SONG_WRAPPER_REF_KEY] = wrappedPlaySong;
    window[METRONOME_HOOKS_INSTALLED_KEY] = true;
})();

// Rebind existing controls immediately on script initialization/re-evaluation.
_metInjectButton();
