# MALKA — QA portfolio report

**Prepared:** 13 October 2026  
**Creator:** Aneta Večerková  
**Project:** Personal photography prototype built with AI assistance  
**Demo:** https://malka-111.netlify.app/  
**Repository:** https://github.com/anetavec2-cmyk/MALKA

## Product and purpose

MALKA helps users recreate a pose or composition by placing a transparent reference photograph over a live camera preview. This project provides practical examples of identifying a user-facing problem, explaining expected behavior, retesting a fix and beginning browser-test automation. It is a learning project, not professional QA employment.

## My contribution and use of AI

I supplied the idea and design direction, tried the app on my iPhone 14 Pro Max, identified a reference-photo interaction bug and confirmed that the deployed fix worked. I also observed that the native camera looked better than the web camera.

AI assistance was used for implementation, debugging, deployment preparation, writing documentation and writing/running automated tests. I am beginning to learn Playwright and how test actions and assertions work. Independent completion of the Playwright learning exercise has not yet been recorded.

## BUG-001: moving the reference moves or zooms the webpage

**Impact / severity:** Major — the reference could not be positioned reliably, interrupting the app's main task.  
**Environment:** MALKA web demo on the creator's iPhone 14 Pro Max. Exact browser and OS versions were not recorded.  
**Reported:** 12 October 2026.

### Reproduction steps before the fix

1. Open the MALKA web demo.
2. Choose a reference photograph and open the camera.
3. Enter Reference adjustment mode.
4. Drag the reference with one finger.
5. Pinch with two fingers to resize it.

**Expected:** The reference moves or changes size while the webpage and camera viewport stay stationary.  
**Actual:** The webpage moved or zoomed instead of the reference.

**Fix:** With AI assistance, the web overlay received dedicated pointer handling and prevention of default browser gestures on its editing surface.

**Retest:** After deployment, the creator confirmed the reference gestures worked on her phone.  
**Status:** Fixed for the reported scenario; further device/browser coverage remains pending.

## Recorded checks

| Scenario | Result | Evidence / scope |
| --- | --- | --- |
| Native app opens on iPhone | Pass | Creator report; does not independently confirm every camera/save feature |
| Reference drag/pinch on phone web demo | Fail before fix; pass after fix | Creator found the problem and confirmed retest |
| Empty-gallery navigation | Pass | Playwright, desktop Chromium, local production build; AI-assisted run |
| Reference drag/pinch, resize control and Reset | Pass | Playwright with a generated image, fake camera and simulated touch input; AI-assisted run |
| Page stays stationary during reference interaction | Pass | Automated checks of window scroll, viewport scale and editing-surface bounds |
| Existing supporting-code tests | 14 passed | AI-assisted run; composition, image geometry and optional coach-server checks |
| TypeScript, lint and web export | Pass | AI-assisted tooling checks |
| Native versus web camera appearance | Difference reported | Native looked better to creator; no measured comparison |

The two Playwright tests passed together. A final individual reference-test run also passed after adjusting its fixture path. These runs do not establish mobile Safari or real camera compatibility.

## Automation and reproducibility

Files: `e2e/gallery.spec.ts`, `e2e/reference.spec.ts`, `e2e/fixtures/reference.png`, `playwright.config.ts`.

```sh
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

The suite exports the project for web and starts a local server on port 8091. Reference tests use a fake camera so no private photographs or actual camera input are needed. The HTML report provided with this application package is from the latest individual reference-test run; it contains one passing test, not the full two-test run.

**Source and evidence:** The Playwright tests are in this repository. Download the latest individual reference-test HTML report from [MALKA-HTML-report.zip](MALKA-HTML-report.zip), extract it, then open playwright-report/index.html. See [TESTING.md](../TESTING.md) for the full record.

## Limitations and next tests

- Verify real touch gestures in Safari and additional phone browsers, including interrupted gestures.
- Test camera permission denial, reference-selection cancellation and recovery.
- Verify capture, native saving to Photos and web downloads separately.
- Compare saved output under controlled lighting; distinguish preview quality from output quality.
- Verify background/resume and standalone offline startup.
- Web flash is unavailable in the current interface; web downloads do not automatically save to iPhone Photos.
- Session photographs disappear after closing/reloading unless saved.
- The recovery dependency audit reported advisories; this prototype has not had a full security audit.

## What this demonstrates

A concrete bug report, expected-versus-actual reasoning, user retesting, awareness of platform differences and early experience with AI-assisted Playwright automation. It does not claim advanced programming, independent automation expertise or completed testing of every feature.
