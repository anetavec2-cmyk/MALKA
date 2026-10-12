import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Alert } from 'react-native';
import type { CameraView } from 'expo-camera';
import type { Frame, ReferenceTransform } from './reference-geometry';
import { discardCoachCapture, makeCoachImage } from './coach-images';

type Options = {
  camera: RefObject<CameraView | null>;
  captureLock: { current: boolean };
  canAnalyze: boolean;
  reference: string | null;
  frame: Frame;
  transform: ReferenceTransform;
  facing: string;
};
const url = process.env.EXPO_PUBLIC_COACH_URL;
const token = process.env.EXPO_PUBLIC_COACH_TOKEN;
const messages: Record<string, string> = {
  SETUP_REQUIRED: 'Connect the AI service on your Mac first.',
  PAIRING_REQUIRED: 'The coach connection needs updating. Reopen Malka after the server setup.',
  API_KEY_REJECTED: 'The AI key was rejected. Check the connection on your Mac.',
  PROVIDER_LIMIT: 'The AI account reached a usage limit. Coaching has paused.',
  HOURLY_LIMIT: 'Coaching reached its hourly limit. Try again later.',
  TIMEOUT: 'The AI service took too long. Try starting the coach again.',
};
export function useCompositionCoach(options: Options) {
  const [enabled, setEnabled] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [status, setStatus] = useState('AI coach is off');
  const [checking, setChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const connectLock = useRef(false);
  const connectController = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const count = useRef(0);
  const startedAt = useRef(0);
  const identity = `${options.reference}|${options.facing}`;

  useEffect(() => {
    // Revoke a live external-data session when its reference/camera identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(false);
    connectController.current?.abort();
    return () => { connectController.current?.abort(); };
  }, [identity]);

  async function start() {
    if (connectLock.current) return;
    if (!url || !token) { Alert.alert('Connect the coach first', 'The AI connection needs to be set up on your Mac. Your camera and photos still work normally.'); return; }
    connectLock.current = true; setConnecting(true);
    const controller = new AbortController(); connectController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`${url}/health`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const result = await response.json();
      if (!response.ok || !result.ready) throw new Error(messages[result.error] || messages.SETUP_REQUIRED);
      if (controller.signal.aborted) return;
      count.current = 0; startedAt.current = Date.now(); setEnabled(true); setStatus('Hold your framing steady…');
    } catch (error) {
      if (!controller.signal.aborted) Alert.alert('Coach unavailable', error instanceof Error && error.message.startsWith('Connect') ? error.message : 'Check that the coach server is running on your Mac and both devices share Wi-Fi.');
      else setStatus('Connection cancelled or timed out. Try again.');
    } finally { clearTimeout(timeout); connectController.current = null; connectLock.current = false; setConnecting(false); }
  }
  function toggle() {
    if (enabled) { setEnabled(false); setStatus('AI coach is off'); return; }
    Alert.alert('Start live AI coaching?', 'While on, Malka sends a small copy of your placed reference and a camera image to OpenAI about every few seconds. API charges apply. Images are not added to your gallery. Stop anytime. Each session stops after 24 checks or 5 minutes.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Start coach', onPress: start },
    ]);
  }

  useEffect(() => {
    if (!enabled || !options.canAnalyze || !options.reference || options.frame.width < 1 || options.frame.height < 1) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    let previousAction = '';
    let previousCount = 0;
    let failures = 0;
    let referenceImage: string | undefined;
    const schedule = (delay: number) => { if (!cancelled) timer = setTimeout(tick, delay); };
    async function tick() {
      if (cancelled) return;
      if (count.current >= 24 || Date.now() - startedAt.current > 300000) { setEnabled(false); setStatus('Session finished. Start again when you’re ready.'); return; }
      if (busy.current || options.captureLock.current || !options.camera.current) { schedule(700); return; }
      busy.current = true;
      let sampleUri: string | undefined;
      let sampleAt = 0;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        if (expiry) clearTimeout(expiry);
        setChecking(true); setStatus('Checking your framing…');
        referenceImage ??= await makeCoachImage(options.reference!, options.frame, options.transform);
        if (cancelled) return;
        if (options.captureLock.current || !options.camera.current) return;
        options.captureLock.current = true; setSampling(true);
        try {
          const sample = await options.camera.current!.takePictureAsync({ quality: .25, skipProcessing: false, shutterSound: false });
          sampleUri = sample?.uri; sampleAt = Date.now();
        } finally { options.captureLock.current = false; setSampling(false); }
        if (cancelled) return;
        if (!sampleUri) throw new Error('CAPTURE_FAILED');
        const current = await makeCoachImage(sampleUri, options.frame);
        discardCoachCapture(sampleUri); sampleUri = undefined;
        if (cancelled) return;
        request = new AbortController(); timeout = setTimeout(() => request?.abort(), 20000);
        count.current++;
        const response = await fetch(`${url}/compare`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: referenceImage, current }), signal: request.signal });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          if (result.error === 'SLOW_DOWN') { setStatus('Waiting for the next check…'); return; }
          throw new Error(result.error || 'AI_UNAVAILABLE');
        }
        failures = 0;
        if (Date.now() - sampleAt > 10000) { setStatus('Feedback arrived late. Hold steady for a fresh check.'); previousCount = 0; return; }
        if (typeof result.action !== 'string' || typeof result.message !== 'string' || result.message.length > 180) throw new Error('INVALID_RESPONSE');
        if (result.action === 'uncertain') { previousCount = 0; previousAction = ''; setStatus(result.message); }
        else {
          previousCount = result.action === previousAction ? previousCount + 1 : 1; previousAction = result.action;
          setStatus(previousCount >= 2 ? result.message : 'Hold steady while I confirm the framing…');
        }
        expiry = setTimeout(() => { if (!cancelled) setStatus('Hold steady for the next check…'); }, 5500);
      } catch (error) {
        if (!cancelled) {
          failures++; previousAction = ''; previousCount = 0;
          const code = error instanceof Error ? error.message : 'AI_UNAVAILABLE';
          setStatus(messages[code] || 'Could not check the framing. Trying again…');
          if (messages[code] || failures >= 2) { setEnabled(false); setStatus(messages[code] || 'Coaching stopped. Check your connection, then try again.'); }
        }
      } finally {
        clearTimeout(timeout);
        if (sampleUri) discardCoachCapture(sampleUri);
        busy.current = false;
        if (!cancelled) { setChecking(false); schedule(6000); }
      }
    }
    schedule(1200);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(expiry); request?.abort(); };
  }, [enabled, options.canAnalyze, options.reference, options.frame, options.transform, options.facing, options.camera, options.captureLock]);

  return { enabled, sampling, checking: enabled && options.canAnalyze && checking, connecting, status: enabled && !options.canAnalyze ? 'Coach paused—return to the camera with flash off.' : status, toggle };
}
