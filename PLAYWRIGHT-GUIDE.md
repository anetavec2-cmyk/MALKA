# Your first Playwright test

Playwright opens a browser, performs actions and checks the result. This project has a beginner gallery test in `e2e/gallery.spec.ts` and a reference movement regression test in `e2e/reference.spec.ts`.

## Run it yourself

Open Terminal in this project folder. Dependencies and Chromium have already been installed on this Mac.

```sh
npm run test:e2e -- --headed
```

You will see Chromium open MALKA, enter the empty gallery and return home. The browser closes when the test finishes. Look for **2 passed** in Terminal. The command builds and starts the local website automatically; you do not need to start Expo separately. Port 8091 must be available.

For an interactive window where you can select the test and inspect each step:

```sh
npm run test:e2e:ui
```

Click the run triangle next to the gallery test. To view the report after a completed run:

```sh
npm run test:e2e:report
```

## Read the test

- `page` is the browser tab.
- `page.goto('/')` opens the local MALKA home page.
- `getByRole('button', { name: 'My photos' })` finds the button by its accessible name.
- `.click()` clicks it.
- `expect(...).toBeVisible()` checks that the user can see something.
- `.toBeDisabled()` checks that an empty selection cannot be downloaded.
- `test.step(...)` groups actions in the report.

Playwright waits for the button and expected states automatically. There are no fixed sleep timers in this test.

## A small exercise

After your first successful run, change the expected empty-gallery message to `No photos yet`, then run the test again. It should fail because that is not MALKA's actual message. Inspect the failure in the report, restore `Your photos will appear here.` and rerun. This teaches you how an assertion catches an unexpected result.

Record your own run date and result in TESTING.md once you have run it. The initial setup and passing run were performed with AI assistance; they do not mean you have independently completed the exercise yet.

## Scope

This checks a fresh gallery, disabled download and returning home in desktop Chromium. It does not use a real camera or prove iPhone/Safari, photo saving or reference gesture compatibility. It tests a fresh local build, not the deployed Netlify site.

## Setup on another Mac

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

Official guides: https://playwright.dev/docs/intro and https://playwright.dev/docs/test-webserver.

## Run only the reference movement test

```sh
npm run test:e2e -- e2e/reference.spec.ts --headed
```

This selects a generated image, uses a fake camera, drags the reference, simulates a two-finger pinch, checks the size control and Reset. It verifies that the page stays stationary. Expect **1 passed** when running only this file. To open the HTML report afterwards, run `npm run test:e2e:report`.
