# Slopsmith Plugin: Metronome

A plugin for [Slopsmith](https://github.com/got-feedback/feedback) that adds an audible metronome click and visual beat flash to the highway player, synced to the song's tempo.

## Features

- **Audible click** — plays a sine tone on every beat, with a higher pitch on downbeats (measure starts)
- **Visual flash** — subtle amber glow on the highway canvas on each beat (brighter on downbeats)
- **Tempo-synced** — follows the song's actual beat map, including tempo changes
- **Toggle button** — click "Metronome" in the player controls to enable/disable
- **Volume and flash controls**: while the metronome is on, a volume slider and a **Flash** checkbox appear next to the button
- **Zero setup** — no configuration needed, works with any song

## Installation

```bash
cd /path/to/slopsmith/plugins
git clone https://github.com/got-feedback/feedback-plugin-metronome.git metronome
docker compose restart
```

Metronome is also bundled with the feedBack Desktop app.

## Usage

1. Play a song.
2. Click **Metronome**. In the v3 UI it sits in the **Plugin controls** popover on the player rail.
3. Set the click volume with the slider, or untick **Flash** to turn off the visual beat flash.
4. Click **Metronome ✓** again to turn it off.

## How It Works

Arrangements include precise beat timing data with measure markers. The plugin reads this beat data from the highway renderer and triggers a click sound and visual flash at each beat position. Downbeats (first beat of each measure) get a higher-pitched click and a brighter flash.

## License

MIT
