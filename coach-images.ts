/* eslint-disable @typescript-eslint/no-require-imports -- Native image modules load only when used, so they cannot block startup. */
import type { Frame, ReferenceTransform } from './reference-geometry';

// Match the screen geometry: camera cover, reference contain + user placement.
export async function makeCoachImage(uri: string, frame: Frame, reference?: ReferenceTransform): Promise<string> {
  const { Skia, ImageFormat } = require('@shopify/react-native-skia') as typeof import('@shopify/react-native-skia');
  const resources: { dispose(): void }[] = [];
  try {
    const data = await Skia.Data.fromURI(uri); resources.push(data);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) throw new Error('Cannot read image');
    resources.push(image);
    const factor = 512 / Math.max(frame.width, frame.height);
    const width = Math.max(1, Math.round(frame.width * factor)), height = Math.max(1, Math.round(frame.height * factor));
    const surface = Skia.Surface.Make(width, height);
    if (!surface) throw new Error('Cannot prepare image');
    resources.push(surface);
    const paint = Skia.Paint(); resources.push(paint);
    const canvas = surface.getCanvas(); canvas.clear(Skia.Color('#242424'));
    const fit = reference ? Math.min(width / image.width(), height / image.height()) : Math.max(width / image.width(), height / image.height());
    const scaledWidth = image.width() * fit * (reference?.scale ?? 1), scaledHeight = image.height() * fit * (reference?.scale ?? 1);
    canvas.drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect((width - scaledWidth) / 2 + (reference?.x ?? 0) * factor, (height - scaledHeight) / 2 + (reference?.y ?? 0) * factor, scaledWidth, scaledHeight), paint);
    surface.flush();
    const result = surface.makeImageSnapshot(); resources.push(result);
    return `data:image/jpeg;base64,${result.encodeToBase64(ImageFormat.JPEG, 65)}`;
  } finally { resources.reverse().forEach(resource => resource.dispose()); }
}
export function discardCoachCapture(uri: string) {
  try {
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const file = new File(uri); if (file.exists) file.delete();
  } catch { /* Cache files can already have been purged by the OS. */ }
}
