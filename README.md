# Theremim

A touch- and motion-controlled virtual theremin and browser synthesizer. Built with plain HTML, CSS, and the Web Audio API—no framework or build step required.

## Features

- Touch, pointer, and device-orientation performance controls.
- Musical scale/root selection, optional quantization, adjustable range and glide.
- Four oscillator voices with harmony controls, vibrato, filter, noise, echo, reverb, distortion, and a four-stage all-pass phaser.
- Presets, randomized sound palettes, themes, visual intensity, and live note/frequency readouts.
- Full-screen performance mode for phones and tablets.
- Settings saved locally in the browser; no audio or motion data is recorded or uploaded.

## Project layout

- `index.html` contains the accessible app structure.
- `styles.css` contains responsive styling and performance-mode layout.
- `app.js` contains the audio engine, controls, motion input, and local settings.
- `test/app.test.js` contains dependency-free smoke and regression checks.

## Run locally

Open `index.html` in a modern browser and press **Start Sound**. Web Audio requires a user gesture. Motion permission requires a compatible browser/device and is most reliable over HTTPS.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the root of `main` when changes are pushed. The expected URL is https://wonka15.github.io/Theremin/. Check the repository's **Actions** tab for deployment status.

## Development checks

Requires Node.js 20 or newer. Run:

```sh
npm test
```

The tests validate inline JavaScript syntax, literal DOM ID references, and the key audio-performance safeguards. They do not replace testing audio and motion behavior on actual iOS/Android devices.

## Performance and audio notes

- The waveshaper curve is cached and uses a smaller lookup table; changing unrelated controls no longer rebuilds it.
- The stereo reverb impulse is generated only when reverb is first enabled.
- Phaser modulation uses four all-pass stages.
- The noise layer has its own filter, so its color setting does not alter the main oscillator filter.
- Start at a low listening volume, especially with headphones. Output limiting is a safety aid, not a guarantee against excessive loudness.
