# MALKA — recovered Expo project

Recovered on 11 October 2026 from the original `pose-please` project on this Mac. The original folder was left unchanged. This package preserves its latest pale-blue design, crown artwork, camera reference overlay and photo review flow.

## Run it

Install Node.js 24 LTS. Open a terminal in the extracted MALKA folder:

```sh
npm ci
npm run web
```

Open the local address shown. For iPhone testing with an Expo Go version supporting SDK 57:

```sh
npm start
```

Scan the QR code with your iPhone, with the phone and Mac on the same network. Keep the development server running. Expo Go testing and a browser website do not require an Apple Developer subscription. App Store/TestFlight distribution is a separate workflow.

## Make a shareable website

```sh
npm run build:web
npm run preview:web
```

`dist/` is the deployable website. Upload the **contents of dist**, not the source project, to a static HTTPS host. The supplied `MALKA-web.zip` already contains a built export. For Netlify, extract that ZIP and drag the extracted folder containing `index.html` into its manual deployment interface. For Git-based hosting, use `npm run build:web` as the build command and `dist` as the publish directory; `netlify.toml` supplies these settings. No Apple account is involved. Hosting accounts and their pricing are separate.

Open the final HTTPS link directly in Safari/Chrome to test camera permissions. This delivery does not publish a public site or create a hosting account.

## What works in the current app

- Original crown splash and pale-blue home screen.
- Choose your own reference image through the photo/file picker.
- Front/back camera selection where supported.
- Reference overlay at the original fixed 40% opacity; drag and pinch to position it, or use size buttons and Reset.
- Capture without baking the reference overlay into the photo.
- Session gallery, select photos, full-photo review and session deletion.
- Native photo-library saving; browser JPEG downloads with retry available.

## Web and camera limitations

- Camera access needs HTTPS on a hosted site (localhost is normally allowed). A plain HTTP address on your Mac’s Wi-Fi IP may not work on your phone. In-app browsers/iframes may restrict camera access; open the site directly.
- Browser permission denial is handled in the browser’s site settings, not Expo Go settings. The app cannot override a denied permission.
- Flash is disabled on web. Lens choice depends on cameras exposed by the browser; desktop computers commonly have only one.
- Native Photos access is not available on web. Downloads go to the browser’s download destination, not directly to iPhone Photos. On iPhone, open the downloaded image and use Share → Save Image if offered. Download success cannot be confirmed by JavaScript; the message says “requested.” Multiple downloads may be blocked; select one photo at a time and retry.
- Gallery photos are kept only in memory during this session. Reloading/closing loses unsaved images. Download or save favourites first. Large photos and long sessions can use substantial memory.
- Browser image selection must be started by tapping the button. Pinch behavior varies by browser; the +/- controls remain available.
- Preview cropping, output resolution, orientation and selfie mirroring can differ by device. The preserved `capture-frame.ts` crop helper is not connected to the latest app. A capture may include more than the visible preview; it is not stretched to fit.
- The latest design has fixed opacity, not an opacity slider. The earlier looks/AI coach are preserved but are not enabled in the current app. There is no generated pose catalogue.

## Source and recovery details

See `TESTING.md` for tested behavior and remaining device checks. This portfolio repository includes the current application and optional experimental modules.

Optional historical AI coach code is preserved under `server/`, `useCompositionCoach.ts`, and `coach-images.ts`. The current app does not import it or transmit images to it. Private configuration, environment files and tokens were excluded. Do not publish the historical coach as-is: it needs a separate secured server, private provider credentials, per-user authentication and a deliberate consent flow. `EXPO_PUBLIC_*` values are visible in client builds and cannot hold secrets. 

## Development checks

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
```

The project stays on its recovered Expo SDK 57 dependency family and includes a lockfile. Browser dependencies were installed using Expo’s compatibility resolver. There is no need to create `ios/` or `android/` directories for these workflows.

Documentation: [Expo SDK 57 camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [image picker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [web deployment](https://docs.expo.dev/guides/publishing-websites/).
