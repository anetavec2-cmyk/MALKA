# MALKA — testing and bug reports

Testing record prepared on 12 October 2026. This document separates creator-reported manual results from checks performed with AI assistance. “Pass” applies only to the stated scenario, not the whole app.

## Environment

- Manual device: iPhone 14 Pro Max.
- Native app: locally built Expo/React Native iPhone application; creator reports it runs on the device.
- Web: https://malka-111.netlify.app/.
- Browser testing used the iPhone web version; exact browser version was not recorded.
- Stack: Expo SDK 57, React Native, TypeScript; static web export hosted on Netlify.

## Confirmed results

| Check | Expected | Actual | Result / evidence |
| --- | --- | --- | --- |
| Open native application | MALKA opens on the iPhone | Creator reported that it works on the phone | Pass — creator report; individual camera/save cases not separately recorded |
| Open hosted web demo | Home and branding render | Home rendered after deployment | Pass — browser inspection with AI assistance |
| Empty gallery and return Home | Empty state; disabled Download selected (0); return works | Observed these states | Pass — browser inspection with AI assistance |
| Move/resize reference on web | Gestures transform reference only | Page moved/zoomed before fix; creator confirmed reference gestures work after deployment | Initially fail; retest pass — creator report |
| Compare native and web camera appearance | Record any visible difference | Creator reports native camera is better | Observation — not a quantified quality test |
| TypeScript and lint | No errors | Checks passed after gesture fix | Pass — tooling run with AI assistance |
| Export web build | Produce deployable HTML, JS and assets | Build exported and updated on Netlify | Pass — tooling and deployment inspection |
| Existing supporting-code tests | All checks pass | 14 tests passed during project recovery | Pass at recovery baseline; not a UI test suite |

## BUG-001 — reference gesture moves or zooms the webpage

**Severity:** Major: the core pose-alignment interaction was difficult to use on web.

**Environment:** iPhone web demo; reported 12 October 2026. Exact Safari/iOS version was not recorded in the bug report.

**Steps to reproduce before the fix:**
1. Open MALKA’s web demo.
2. Choose a reference photo and open the camera.
3. Enter Reference adjustment mode.
4. Drag with one finger to move the reference.
5. Pinch with two fingers to change its size.

**Expected:** Only the reference photo moves/resizes. The camera viewport and page remain stationary.

**Actual:** The webpage scrolled or zoomed instead of the reference photo.

**Investigation and fix:** The browser’s default touch behavior was competing with the app’s gesture handling. The web version now uses a dedicated pointer-event editing surface with `touch-action: none`. Local touch/gesture listeners prevent Safari’s page gestures on this surface. Pointer capture keeps a drag attached to the editing surface; gesture baselines are reset when the number of fingers changes. The native overlay remains a separate implementation.

**Retest:** After the updated build was deployed to the same link, the creator reported: “super funguje” (“great, it works”). This confirms the reported gesture scenario on the creator’s phone. Pointer cancellation, three fingers, rotation and other browsers still need explicit checks.

**Status:** Fixed; creator-confirmed retest.

## BUG-002 — web starts with a blank page

**Found during:** Recovery browser testing with AI assistance.

**Steps:** Export the original app for web and open it in a browser.

**Expected:** Crown splash followed by the home screen.

**Actual:** Blank page; console error `Cannot find native module 'ExpoMediaLibraryNext'`.

**Fix:** Split native photo-library imports from the web implementation using platform-specific files. Web saving uses downloads instead of the native Photos module.

**Retest:** Home screen and empty-gallery navigation rendered successfully in the browser. The exported demo was subsequently hosted on Netlify.

**Status:** Fixed — browser-inspected, not independently reproduced by the creator.

## Known limitation — browser camera quality

The creator reports that the native app has better camera quality than the website. The report does not yet distinguish preview quality from downloaded output, and no controlled comparison, pixel measurements or low-light test has been recorded. Do not claim identical results to Apple Camera.

**Next test:** Photograph the same scene using the rear camera in the native app, web app and Apple Camera. Keep lighting/distance similar, save the output files, record dimensions and compare detail, focus, exposure and colour. Record daylight and low-light results separately.

## Remaining manual checks

These are planned, not passed:

- Cancel reference selection, choose again and verify recovery.
- Deny camera permission and confirm helpful instructions.
- Switch front/back lenses and check orientation/mirroring.
- Capture multiple photos; verify the reference is absent from saved output.
- Save to iPhone Photos in native app; download and reopen a web photo.
- Delete a session photo and verify a saved copy remains.
- Background/resume the app and retry capture.
- Test drag/pinch interruptions and different phone browsers.
- Verify standalone startup with the Mac disconnected and phone offline.

## Automated test scope

`npm test` runs 14 existing tests covering composition advice, reduced analysis-image geometry and optional coach-server authentication/input/error handling. These modules are supporting or experimental code. Passing them does not prove live camera, saving, gesture or offline behavior. Type checking, lint and a successful export are also insufficient to establish full device compatibility — BUG-002 is an example.

## Dependency review

The recovery audit reported 28 affected packages (20 high, 8 moderate) in the recovered SDK dependency tree, including transitive braces, node-forge and uuid advisories. The suggested automated fix involved an incompatible Expo downgrade and was not applied. This prototype has not undergone a comprehensive security audit.
