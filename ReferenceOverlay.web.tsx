import { useLayoutEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { moveReference } from './reference-geometry';
import type { Point, ReferenceTransform } from './reference-geometry';

type Props = {
  uri: string;
  adjusting: boolean;
  transform: ReferenceTransform;
  onChange: (value: ReferenceTransform) => void;
  onError: () => void;
};

export function ReferenceOverlay({ uri, adjusting, transform, onChange, onError }: Props) {
  const current = useRef(transform);
  const surface = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ points: Point[]; start: ReferenceTransform } | null>(null);
  useLayoutEffect(() => { current.current = transform; }, [transform]);
  useLayoutEffect(() => {
    pointers.current.clear();
    gesture.current = null;
    const element = surface.current;
    if (!adjusting || !element) return;
    // Explicitly prevent Safari page gestures only on the reference editing surface.
    const preventGesture = (event: Event) => { if (event.cancelable) event.preventDefault(); };
    element.addEventListener('touchmove', preventGesture, { passive: false });
    element.addEventListener('gesturestart', preventGesture, { passive: false });
    element.addEventListener('gesturechange', preventGesture, { passive: false });
    return () => {
      element.removeEventListener('touchmove', preventGesture);
      element.removeEventListener('gesturestart', preventGesture);
      element.removeEventListener('gesturechange', preventGesture);
    };
  }, [adjusting, uri]);

  const rebase = () => {
    gesture.current = { points: [...pointers.current.values()].slice(0, 2), start: current.current };
  };
  const point = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    rebase();
  };
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View testID="reference-photo" pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }]}>
      <Image source={{ uri }} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: .4 }]} onError={onError} />
    </View>
    {adjusting && <div ref={surface} aria-label="Drag reference with one finger or pinch with two fingers to resize"
      style={{ position: 'absolute', inset: 0, touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'move' }}
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, point(event));
        rebase();
      }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId) || !gesture.current) return;
        event.preventDefault();
        pointers.current.set(event.pointerId, point(event));
        const rect = event.currentTarget.getBoundingClientRect();
        const next = moveReference(gesture.current.start, gesture.current.points, [...pointers.current.values()].slice(0, 2), rect);
        current.current = next;
        onChange(next);
      }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />}
  </View>;
}
