export type ReferenceTransform = { x: number; y: number; scale: number };
export type Point = { x: number; y: number };
export type Frame = { width: number; height: number };
export const INITIAL_REFERENCE: ReferenceTransform = { x: 0, y: 0, scale: 1 };
export function constrainReference(value: ReferenceTransform, frame: Frame): ReferenceTransform {
  return {
    x: Math.max(-frame.width / 2, Math.min(frame.width / 2, value.x)),
    y: Math.max(-frame.height / 2, Math.min(frame.height / 2, value.y)),
    scale: Math.max(.25, Math.min(3, value.scale)),
  };
}
export function moveReference(start: ReferenceTransform, from: Point[], to: Point[], frame: Frame): ReferenceTransform {
  if (!from.length || from.length !== to.length) return start;
  const midpoint = (points: Point[]) => points.length < 2 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  const a = midpoint(from), b = midpoint(to);
  const distance = (points: Point[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const scale = from.length > 1 ? Math.max(.25, Math.min(3, start.scale * distance(to) / Math.max(1, distance(from)))) : start.scale;
  const ratio = scale / start.scale;
  // Anchor a pinch to its midpoint, rather than jumping toward the screen center.
  return constrainReference({
    x: b.x - frame.width / 2 - (a.x - frame.width / 2 - start.x) * ratio,
    y: b.y - frame.height / 2 - (a.y - frame.height / 2 - start.y) * ratio,
    scale,
  }, frame);
}
