/* eslint-disable @typescript-eslint/no-require-imports -- Native image modules load only when used, so they cannot block startup. */
export const LOOKS = [
  { id: 'original', label: 'Original', detail: 'Your untouched photo' },
  { id: 'portrait', label: 'Portrait Soft', detail: 'Gentle smoothing · defined light and shadow · neutral color' },
  { id: 'g7', label: 'Clean Digital', detail: 'Neutral color · defined contrast · clear whites' },
  { id: 'sunset', label: 'Sunset Flash', detail: 'Defined shadows · luminous skin tones · neutral whites' },
  { id: 'film', label: 'Soft Film', detail: 'Neutral whites · matte shadows · fine grain' },
  { id: 'golden', label: 'Airy Pastel', detail: 'Light mids · pastel color · soft contrast' },
  { id: 'digicam', label: 'Cool Snap', detail: 'Cool color · punchy contrast · fine texture' },
  { id: 'fuji', label: 'Sage Film', detail: 'Muted teal greens · soft highlights · film grain' },
  { id: 'bw', label: 'B&W Soft', detail: 'Silvery highlights · open shadows' },
  { id: 'noir', label: 'B&W Noir', detail: 'Deep contrast · fine grain' },
] as const;
export type Look = typeof LOOKS[number]['id'];
export const LOOK_VERSION = 6;

// Display-referred sRGB creative grades, not camera/manufacturer profiles.
// contrast, saturation, black lift, highlight shoulder, warm mids,
// cool shadows, green muting, grain, monochrome, midtone light, rose tint.
const grades: Record<Exclude<Look, 'original'>, number[]> = {
  portrait: [.38, 1.18, .002, .035, 0, 0, 0, 0, 0, .045, 0],
  film: [.22, .85, .09, .19, 0, .025, .22, .035, 0, .035, 0],
  sunset: [.75, 1.04, .012, .10, 0, .015, .14, .006, 0, .06, .018],
  bw: [.18, 1, .10, .26, 0, 0, 0, .045, 1, 0, 0],
  noir: [1.45, 1, .005, .12, 0, 0, 0, .065, 1, 0, 0],
  golden: [-.15, .78, .075, .12, 0, .018, .16, .012, 0, .14, .012],
  g7: [.95, 1.06, .004, .055, 0, 0, .10, 0, 0, .045, 0],
  digicam: [.80, 1.12, .018, .10, -.025, .065, .05, .024, 0, 0, .006],
  fuji: [.38, .88, .06, .20, 0, .035, .38, .03, 0, .025, 0],
};

const gradingShader = `
uniform shader source;
uniform float2 dimensions;
uniform float radius;
uniform float softness;
uniform float strength;
uniform float contrast;
uniform float saturation;
uniform float blackLift;
uniform float shoulder;
uniform float warmth;
uniform float coolShadows;
uniform float greenMute;
uniform float grain;
uniform float monochrome;
uniform float midtoneLight;
uniform float roseTint;
uniform float portrait;
float luminance(float3 c) { return dot(c, float3(.2126, .7152, .0722)); }
half4 main(float2 p) {
  half4 original = source.eval(p);
  float3 c = float3(original.rgb);
  if (softness > 0.0) {
    float3 total = c;
    float weights = 1.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        if (x == 0 && y == 0) continue;
        float3 neighbor = float3(source.eval(p + float2(float(x), float(y)) * radius).rgb);
        float3 delta = neighbor - c;
        float weight = exp(-dot(delta, delta) / .0035) * .7;
        total += neighbor * weight;
        weights += weight;
      }
    }
    // A broad chromatic mask, not face detection: similar-colored objects may
    // also soften. Normalize chroma so darker skin colors are not excluded.
    float channelSum = max(c.r + c.g + c.b, .001);
    float redBlue = (c.r - c.b) / channelSum;
    float greenBlue = (c.g - c.b) / channelSum;
    float skinLike = smoothstep(.005, .06, redBlue)
      * smoothstep(-.025, .02, greenBlue)
      * (1.0 - smoothstep(.24, .38, redBlue));
    float mask = mix(1.0, skinLike, portrait);
    c = mix(c, total / weights, softness * mask);
  }
  float l = luminance(c);
  // Smooth endpoint-preserving contrast, then a gentle toe and shoulder.
  float tone = l + contrast * (l - .5) * l * (1.0 - l);
  tone += blackLift * pow(1.0 - l, 3.0);
  tone -= shoulder * smoothstep(.6, 1.0, l) * max(l - .6, 0.0);
  tone += midtoneLight * 4.0 * l * (1.0 - l);
  tone = clamp(tone, 0.0, 1.0);
  // Scale chroma by available headroom to keep bright colors from clipping.
  float3 chroma = c - float3(l);
  float chromaMax = max(max(chroma.r, chroma.g), chroma.b);
  float chromaMin = min(min(chroma.r, chroma.g), chroma.b);
  float headroom = min(1.0, min((1.0 - tone) / max(chromaMax, .0001), tone / max(-chromaMin, .0001)));
  c = float3(tone) + chroma * headroom;
  if (monochrome > .5) {
    c = float3(tone);
  } else {
    // Protect warm colors from strong saturation/warmth changes; no face detection.
    float warmColor = smoothstep(.015, .12, c.r - c.b) * smoothstep(-.015, .06, c.g - c.b);
    float chromaRange = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
    // Preserve neutral whites/grays. Color casts target existing chromatic areas.
    float colorMask = smoothstep(.015, .12, chromaRange);
    float skinProtection = 1.0 - warmColor * .85;
    float greens = smoothstep(.015, .14, c.g - max(c.r, c.b));
    float sat = mix(saturation, 1.0, warmColor * .65) - greens * greenMute;
    // Portrait keeps color as luminance rises instead of diluting it toward white.
    sat = mix(sat, saturation, portrait);
    c = mix(float3(tone), c, sat);
    // Shift foliage toward teal; red-dominant colors gently toward orange.
    // Warm-color protection limits this shift on skin-like colors.
    c += float3(-.10, .025, .18) * greens * greenMute;
    float reds = smoothstep(.08, .35, c.r - max(c.g, c.b));
    c += float3(0.0, .13, -.025) * reds * max(warmth, 0.0) * (1.0 - warmColor * .7);
    float midLight = smoothstep(.08, .45, l) * (1.0 - smoothstep(.8, 1.0, l));
    float shadow = (1.0 - smoothstep(.08, .48, l)) * smoothstep(0.0, .06, l);
    c += float3(.65, .12, -.65) * warmth * midLight * colorMask * skinProtection;
    c += float3(-.35, .10, .55) * coolShadows * shadow * colorMask * skinProtection;
    c += float3(.45, -.30, .38) * roseTint * midLight * colorMask * skinProtection;
    // Reduce bright-area chroma gently rather than crushing individual channels.
    c = mix(c, float3(luminance(c)), smoothstep(.75, 1.0, l) * .12 * (1.0 - portrait));
  }
  // Grain size follows output dimensions so it survives a phone-sized preview.
  float grainSize = max(1.0, min(dimensions.x, dimensions.y) / 850.0);
  float2 cell = floor(p / grainSize);
  float coarse = fract(sin(dot(cell, float2(12.9898, 78.233))) * 43758.5453) - .5;
  float fine = fract(sin(dot(floor(p), float2(39.346, 11.135))) * 24634.6345) - .5;
  float noise = coarse * .8 + fine * .2;
  c += float3(noise * grain * (.35 + .65 * (1.0 - smoothstep(.55, 1.0, l))));
  float3 base = monochrome > .5 ? float3(luminance(float3(original.rgb))) : float3(original.rgb);
  return half4(clamp(mix(base, c, strength), 0.0, 1.0), original.a);
}`;

export async function renderLook(uri: string, look: Look, softness = 0.35, strength = 0.75): Promise<string> {
  const amount = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : .75;
  if (look === 'original' || amount === 0) return uri;
  // Optional native modules remain lazy-loaded so a filter problem cannot block the camera.
  const { ImageFormat, Skia, TileMode, FilterMode, MipmapMode } = require('@shopify/react-native-skia') as typeof import('@shopify/react-native-skia');
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const resources: { dispose(): void }[] = [];
  try {
    const data = await Skia.Data.fromURI(uri);
    resources.push(data);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) throw new Error('Cannot decode photo');
    resources.push(image);
    const surface = Skia.Surface.Make(image.width(), image.height());
    if (!surface) throw new Error('Not enough memory to edit this photo');
    resources.push(surface);
    const paint = Skia.Paint();
    resources.push(paint);
    const effect = Skia.RuntimeEffect.Make(gradingShader);
    if (!effect) throw new Error('Color grading is unavailable');
    resources.push(effect);
    const source = image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None);
    resources.push(source);
    const smoothing = (look === 'sunset' || look === 'portrait') ? Math.min(.65, Math.max(0, Number.isFinite(softness) ? softness : .35)) : 0;
    const shader = effect.makeShaderWithChildren([
      image.width(), image.height(), Math.max(1, Math.min(image.width(), image.height()) / (look === 'portrait' ? 1000 : 1600)),
      smoothing, amount, ...grades[look], look === 'portrait' ? 1 : 0,
    ], [source]);
    resources.push(shader);
    paint.setShader(shader);
    surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, image.width(), image.height()), paint);
    surface.flush();
    const result = surface.makeImageSnapshot();
    resources.push(result);
    const bytes = result.encodeToBytes(ImageFormat.JPEG, 100);
    if (!bytes?.length) throw new Error('Cannot encode photo');
    const output = new File(Paths.cache, `malka-${look}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
    output.write(bytes);
    return output.uri;
  } finally {
    resources.reverse().forEach(resource => resource.dispose());
  }
}
