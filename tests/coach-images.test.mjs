import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
test('analysis images preserve the placed reference and camera-cover geometry at reduced size', async () => {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb');
  await LoadSkiaWeb();
  const { JsiSkApi } = require('@shopify/react-native-skia/lib/commonjs/skia/web');
  const Skia = JsiSkApi(globalThis.CanvasKit);
  const { PNG } = require('pngjs');
  const source = Skia.Surface.Make(100, 100); source.getCanvas().clear(Skia.Color('#ff0000')); source.flush();
  const original = source.makeImageSnapshot(); const bytes = original.encodeToBytes(3, 100);
  Skia.Data.fromURI = async () => Skia.Data.fromBytes(bytes);
  const exports = {};
  const code = require('typescript').transpileModule(readFileSync(new URL('../coach-images.ts', import.meta.url), 'utf8'), { compilerOptions: { module: 1, target: 9 } }).outputText;
  new Function('require', 'exports', code)(() => ({ Skia, ImageFormat: { JPEG: 3 } }), exports);
  async function pixels(reference) {
    const uri = await exports.makeCoachImage('local-fixture', { width: 400, height: 600 }, reference);
    assert.ok(uri.startsWith('data:image/jpeg;base64,'));
    const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(Buffer.from(uri.split(',')[1], 'base64')));
    const png = PNG.sync.read(Buffer.from(image.encodeToBytes(4, 100))); image.dispose();
    assert.equal(png.width, 341); assert.equal(png.height, 512);
    return (x, y) => png.data[(y * png.width + x) * 4];
  }
  const camera = await pixels(); assert.ok(camera(170, 20) > 240); assert.ok(camera(170, 256) > 240);
  const reference = await pixels({ x: 0, y: 0, scale: 1 }); assert.ok(reference(170, 20) < 50); assert.ok(reference(170, 256) > 240);
  const positioned = await pixels({ x: 100, y: 0, scale: .5 }); assert.ok(positioned(100, 256) < 50); assert.ok(positioned(260, 256) > 240);
  original.dispose(); source.dispose();
});
