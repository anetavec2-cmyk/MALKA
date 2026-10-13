<p align="center">
  <img src="assets/brand/malka-transparent.png" alt="MALKA crown logo" width="220" />
</p>

# MALKA
### Your next favourite photo.

MALKA is a photography prototype that helps you recreate a pose or composition. Choose a reference image, position its transparent overlay over the live camera view, and line up your shot.

## Try it

**[Try MALKA in your browser](https://malka-111.netlify.app/)**

You can run the project locally using the instructions below. The native iPhone version includes flash controls and saving to Photos. The web version uses browser downloads and has more limited camera controls. The native app runs on the creator’s iPhone 14 Pro Max. The web reference gestures were retested on the phone after a fix; photo saving and other device scenarios still need separate acceptance checks.

## Features

- Choose a reference photo from your device.
- Move and resize a transparent overlay over the camera preview.
- Switch between front and rear cameras where supported.
- Capture photos without including the reference overlay.
- Review, select and save photos from the session gallery.

## About this project

I’m developing MALKA as an AI-assisted personal project to explore product design, app development and software testing.

The app uses **React Native, Expo and TypeScript**. AI tools helped with implementation, project recovery and web compatibility.

## Current status and testing

MALKA is a prototype, not a finished production camera app.

- Web and iOS JavaScript bundles export successfully.
- TypeScript and lint checks pass.
- 14 automated tests pass, covering supporting image geometry, composition advice and coach-server behavior.
- Two Playwright tests pass in desktop Chromium, checking empty-gallery navigation and reference movement/resizing without page scrolling or zooming. Initial setup and verification used AI assistance.
- The web home screen and empty-gallery navigation were also checked manually in a browser.
- Manual testing on iPhone identified a web gesture bug: dragging or pinching the reference moved or zoomed the page. After a web-specific fix was deployed, the creator confirmed the gestures worked.
- The creator reports better camera quality in the native app than the web version. No measured comparison against Apple Camera has been completed.
- The existing automated tests do not verify camera capture, saving or touch gestures.

See the [QA portfolio report](docs/QA-REPORT.md), [downloadable HTML report](docs/MALKA-HTML-report.zip), and [testing report](TESTING.md) for test details, dependency advisories and the device-testing checklist.

## Run locally

Install Node.js 24. From the project folder:

```sh
npm ci
npm run web
```

For testing with an Expo Go version compatible with SDK 57:

```sh
npm start
```

For a web build:

```sh
npm run build:web
npm run preview:web
```

See the [setup guide](SETUP.md) for deployment instructions and platform differences.

## Browser test learning

Run `npm run test:e2e -- --headed` to watch the first Playwright gallery test. See [PLAYWRIGHT-GUIDE.md](PLAYWRIGHT-GUIDE.md) for instructions and a beginner exercise. The test runs against a fresh local web build.

## Known limitations

- Session photos are lost when the app closes or reloads unless you save them first.
- Hosted web camera access requires HTTPS; localhost is generally allowed for development.
- Web flash is disabled, and downloads do not automatically save into iPhone Photos.
- Overlay opacity is currently fixed at 40%.
- Photo quality has not been verified against Apple’s Camera app.
- Experimental filters and AI-coaching code are preserved but are not enabled in the current interface.

## Development and QA contributions

The creator supplied the product idea and design direction, tested the app on an iPhone, reported user-visible problems, and confirmed the reference-gesture fix. AI assistance was used to investigate the code, implement fixes, run development checks and prepare deployment. This is a personal learning project, not paid QA employment.

See [TESTING.md](TESTING.md) for test outcomes, bug reproduction steps and remaining checks. Historical filters and coaching modules are retained as inactive experiments.
