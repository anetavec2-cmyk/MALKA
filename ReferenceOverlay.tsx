import { useLayoutEffect, useMemo, useRef } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';
import { Frame, moveReference, Point, ReferenceTransform } from './reference-geometry';

type Props = {
  uri: string;
  adjusting: boolean;
  transform: ReferenceTransform;
  onChange: (value: ReferenceTransform) => void;
  onError: () => void;
};
export function ReferenceOverlay({ uri, adjusting, transform, onChange, onError }: Props) {
  const current = useRef(transform);
  useLayoutEffect(() => { current.current = transform; }, [transform]);
  const frame = useRef<Frame>({ width: 1, height: 1 });
  const gesture = useRef<{ points: Point[]; start: ReferenceTransform } | null>(null);
  // PanResponder stores these callbacks; it does not invoke them during render.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      gesture.current = { points: event.nativeEvent.touches.slice(0, 2).map(touch => ({ x: touch.locationX, y: touch.locationY })), start: current.current };
    },
    onPanResponderMove: event => {
      const points = event.nativeEvent.touches.slice(0, 2).map(touch => ({ x: touch.locationX, y: touch.locationY }));
      if (!gesture.current || gesture.current.points.length !== points.length) {
        gesture.current = { points, start: current.current };
        return;
      }
      const next = moveReference(gesture.current.start, gesture.current.points, points, frame.current);
      current.current = next;
      onChange(next);
    },
    onPanResponderRelease: () => { gesture.current = null; },
    onPanResponderTerminate: () => { gesture.current = null; },
    onPanResponderTerminationRequest: () => true,
  }), [onChange]);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={event => { frame.current = event.nativeEvent.layout; }}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }]}>
      <Image source={{ uri }} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: .4 }]} onError={onError} />
    </View>
    {adjusting && <View style={StyleSheet.absoluteFill} {...responder.panHandlers} accessibilityLabel="Drag reference with one finger or pinch with two fingers to resize" />}
  </View>;
}
