/* eslint-disable @typescript-eslint/no-require-imports -- Load native image modules only when capturing. */
export function cameraCrop(width: number, height: number, frameWidth: number, frameHeight: number) {
  if (![width, height, frameWidth, frameHeight].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid camera dimensions');
  const ratio = frameWidth / frameHeight;
  const cropWidth = Math.min(width, Math.max(1, Math.round(height * ratio)));
  const cropHeight = Math.min(height, Math.max(1, Math.round(width / ratio)));
  return { x: Math.floor((width - cropWidth) / 2), y: Math.floor((height - cropHeight) / 2), width: cropWidth, height: cropHeight };
}

// Match the full-screen camera's centered cover crop at native pixel resolution.
// No scaling, stretching, reference overlay, or extra selfie mirroring.
export async function matchCameraFrame(uri: string, frameWidth: number, frameHeight: number) {
  const { Skia, ImageFormat } = require('@shopify/react-native-skia') as typeof import('@shopify/react-native-skia');
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const resources: { dispose(): void }[] = [];
  try {
    const data = await Skia.Data.fromURI(uri); resources.push(data);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) throw new Error('Cannot read captured image');
    resources.push(image);
    const crop = cameraCrop(image.width(), image.height(), frameWidth, frameHeight);
    if (crop.width === image.width() && crop.height === image.height()) return { uri, width: crop.width, height: crop.height };
    const surface = Skia.Surface.Make(crop.width, crop.height);
    if (!surface) throw new Error('Cannot prepare captured image');
    resources.push(surface);
    const paint = Skia.Paint(); resources.push(paint);
    surface.getCanvas().drawImageRect(image, Skia.XYWHRect(crop.x, crop.y, crop.width, crop.height), Skia.XYWHRect(0, 0, crop.width, crop.height), paint);
    surface.flush();
    const result = surface.makeImageSnapshot(); resources.push(result);
    const bytes = result.encodeToBytes(ImageFormat.JPEG, 100);
    if (!bytes?.length) throw new Error('Cannot encode captured image');
    const file = new File(Paths.cache, `malka-capture-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
    file.write(bytes);
    return { uri: file.uri, width: crop.width, height: crop.height };
  } finally { resources.reverse().forEach(resource => resource.dispose()); }
}
