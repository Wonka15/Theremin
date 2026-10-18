# Theremim

A touch- and motion-controlled virtual theremin and browser synthesizer, inspired by expressive web instruments.

## Features

- Responsive performance surface: horizontal movement controls pitch; vertical movement controls volume.
- Device-orientation controls on compatible phones and tablets, with permission handling and recentering.
- Selectable oscillator waveforms, frequency range, glide, and optional scale quantization.
- Harmony voices (third, fifth, and sub-octave), filter, vibrato, phaser, reverb, echo, distortion, and noise texture.
- Presets, randomized sound palettes, visual themes, and live frequency/note readouts.
- Built with HTML, CSS, and Web Audio API; no framework or build step.
- No audio or motion data is recorded or uploaded.

## Run locally

Open `index.html` in a modern browser. Press **Start Sound** to activate audio; browsers require a user gesture for Web Audio.

## Motion controls and hosting

Device motion works only on compatible devices and browsers. Use HTTPS (for example, GitHub Pages). iOS may ask for motion permission after you tap **Enable Motion**. Touch controls continue to work if sensors are unavailable.

## GitHub Pages

1. Open repository **Settings → Pages**.
2. Choose deploy from the `main` branch and the `/(root)` folder.
3. Save and wait for deployment.
4. Open the published Pages URL.

## Safety

Begin with a low listening volume, especially when using headphones. Theremim is an experimental browser instrument, not a calibrated acoustic theremin.
