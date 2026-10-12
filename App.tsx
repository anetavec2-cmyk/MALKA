import { Alert } from './platform-alert';
import { downloadPhoto } from './save-photo';
import { ReferenceOverlay } from './ReferenceOverlay';
import { INITIAL_REFERENCE } from './reference-geometry';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Asset, requestPermissionsAsync } from './photo-library';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.65 }]}>
    <Text style={styles.buttonText}>{title}</Text>
  </Pressable>;
}

type Shot = { uri: string; saved: boolean; width: number; height: number; editedUri?: string };

function Malka() {
  const insets = useSafeAreaInsets();
  const [opening, setOpening] = useState(true);
  const [openingLogoReady, setOpeningLogoReady] = useState(false);
  useEffect(() => {
    if (!openingLogoReady) return;
    // Start the display time after the local artwork has actually loaded.
    const timer = setTimeout(() => setOpening(false), 1800);
    return () => clearTimeout(timer);
  }, [openingLogoReady]);
  const [reference, setReference] = useState<string | null>(null);
  const [referenceTransform, setReferenceTransform] = useState(INITIAL_REFERENCE);
  const [adjustingReference, setAdjustingReference] = useState(false);
  const [busy, setBusy] = useState(false);
  const picking = useRef(false);
  const camera = useRef<CameraView>(null);
  const capturing = useRef(false);
  const [saving, setSaving] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [reviewControls, setReviewControls] = useState(true);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const savingLock = useRef(false);
  const [taking, setTaking] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const openReview = () => {
    if (capturing.current) return;
    setCameraReady(false);
    setPreviewUri(shots[shots.length - 1]?.uri ?? null);
    setReviewControls(true);
    setReviewing(true);
  };
  const closeReview = () => {
    if (savingLock.current) return;
    setCameraReady(false);
    setReviewing(false);
  };
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [cameraError, setCameraError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const switchingCamera = useRef(false);
  const [cameraDetached, setCameraDetached] = useState(false);
  const [flash, setFlash] = useState<'off' | 'auto' | 'on'>('off');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') void refreshPermission().catch(() => {});
      else setCameraReady(false);
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  const reset = () => { if (capturing.current) return; switchingCamera.current = false; setReference(null); setCameraError(false); setCameraReady(false); };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (reviewing) { closeReview(); return true; }
      if (adjustingReference) { setAdjustingReference(false); return true; }
      if (!reference) return false;
      reset();
      return true;
    });
    return () => subscription.remove();
  }, [reference, reviewing, adjustingReference]);

  async function choosePhoto() {
    if (picking.current) return;
    picking.current = true;
    setBusy(true);
    try {
      // The system picker grants access only to the chosen photo; no broad library permission needed.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, quality: 1,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setCameraError(false);
        setCameraReady(false);
        setReferenceTransform(INITIAL_REFERENCE);
        setAdjustingReference(false);
        setReference(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Could not open photos', 'Please try again. If photo access is restricted, check Settings → Expo Go → Photos.');
    } finally {
      picking.current = false;
      setBusy(false);
    }
  }

  // Give the native camera session time to release its input before mounting the other lens.
  useEffect(() => {
    if (!cameraDetached) return;
    const timer = setTimeout(() => setCameraDetached(false), 300);
    return () => clearTimeout(timer);
  }, [cameraDetached]);

  // A missing native ready callback must not leave the camera controls disabled forever.
  useEffect(() => {
    if (!reference || reviewing || !active || !permission?.granted || cameraDetached || cameraReady || cameraError) return;
    const timer = setTimeout(() => {
      switchingCamera.current = false;
      setCameraError(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [reference, reviewing, active, permission?.granted, cameraDetached, cameraReady, cameraError, cameraKey]);

  function flipCamera() {
    if (capturing.current || cameraDetached || !active || !permission?.granted) return;
    switchingCamera.current = true;
    setCameraDetached(true);
    setCameraReady(false);
    setCameraError(false);
    setFacing(previous => previous === 'back' ? 'front' : 'back');
    setCameraKey(previous => previous + 1);
  }

  async function takePhoto() {
    if (capturing.current || switchingCamera.current || !camera.current || !cameraReady || !active) return;
    capturing.current = true;
    setTaking(true);
    try {
      // Camera output excludes the reference overlay. Saving is a separate review action.
      const photo = await camera.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!photo?.uri) throw new Error('No photo returned');
      setShots(previous => [...previous, { uri: photo.uri, width: photo.width, height: photo.height, saved: false }]);
      setSaveMessage('');
    } catch {
      Alert.alert('Could not take photo', 'Please wait for the camera and try again.');
    } finally {
      capturing.current = false;
      setTaking(false);
    }
  }

  function deletePhoto() {
    if (savingLock.current) return;
    const shot = shots.find(item => item.uri === previewUri);
    if (!shot) return;
    Alert.alert('Delete this photo?', shot.saved && Platform.OS !== 'web'
      ? 'Remove it from this session? The copy saved to your iPhone’s photo library will stay there.'
      : Platform.OS === 'web' ? 'Remove this photo from the session? Keep a downloaded copy first if you want to retain it.' : 'This photo has not been saved. Remove it from this session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (savingLock.current) return;
        const index = shots.findIndex(item => item.uri === shot.uri);
        const remaining = shots.filter(item => item.uri !== shot.uri);
        setShots(remaining);
        setSelected(previous => previous.filter(uri => uri !== shot.uri));
        setPreviewUri(remaining[Math.min(index, remaining.length - 1)]?.uri ?? null);
        setSaveMessage(remaining.length ? 'Photo removed from this session.' : 'No photos left. Go back to take a new shot.');
      } },
    ]);
  }

  async function saveSelected() {
    if (savingLock.current) return;
    const toSave = shots.filter(shot => selected.includes(shot.uri) && (Platform.OS === 'web' || !shot.saved));
    if (!toSave.length) return;
    savingLock.current = true;
    setSaving(true);
    setSaveMessage('');
    let completed = 0;
    try {
      const access = Platform.OS === 'web' ? { granted: true } : await requestPermissionsAsync(true, ['photo']);
      if (!access.granted) {
        Alert.alert('Allow saving to Photos', 'Your pictures are still here. Allow photo access, then tap Save selected again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings().catch(() => Alert.alert('Open Settings manually', 'Settings → Expo Go → Photos')); } },
        ]);
        return;
      }
      for (const shot of toSave) {
        if (Platform.OS === 'web') await downloadPhoto(shot.editedUri ?? shot.uri);
        else await Asset.create(shot.editedUri ?? shot.uri);
        completed++;
        // Record each success immediately so retries do not re-save completed photos.
        setShots(previous => previous.map(item => item.uri === shot.uri ? { ...item, saved: Platform.OS !== 'web' } : item));
        setSelected(previous => previous.filter(uri => uri !== shot.uri));
      }
      setSaveMessage(Platform.OS === 'web' ? `${completed} download(s) requested. Check your browser’s downloads.` : `${completed} ${completed === 1 ? 'photo' : 'photos'} saved to Photos ✓`);
    } catch {
      setSaveMessage(`${completed} of ${toSave.length} ${Platform.OS === 'web' ? 'downloads requested' : 'saved'}. Remaining photos are still selected.`);
      Alert.alert('Could not save all photos', Platform.OS === 'web' ? 'Try downloading one photo at a time. Check browser download settings and available storage.' : 'Check photo permissions and available storage, then retry. Photos already saved will not be saved again.');
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  async function allowCamera() {
    try {
      if (Platform.OS === 'web' && permission?.canAskAgain === false) Alert.alert('Allow camera in your browser', 'Use your browser’s site permissions to allow the camera, then reload this page. Open the HTTPS website directly, rather than inside another app.');
      else if (permission?.canAskAgain === false) await Linking.openSettings();
      else await requestPermission();
    } catch {
      Alert.alert('Camera access unavailable', Platform.OS === 'web' ? 'Allow camera access in your browser’s site settings. Use HTTPS or localhost.' : 'Please check Settings → Expo Go → Camera, then return here.');
    }
  }

  if (opening) return <View style={styles.opening}>
    <StatusBar style="dark" />
    <Image source={require('./assets/brand/malka-transparent.png')} style={styles.openingLogo} resizeMode="contain" onLoadEnd={() => setOpeningLogoReady(true)} accessibilityLabel="Malka crown logo" />
  </View>;

  if (reviewing) {
    const current = shots.find(shot => shot.uri === previewUri);
    const isSelected = !!current && selected.includes(current.uri);
    return <View style={styles.reviewScreen}>
      <Pressable accessibilityRole="button" accessibilityLabel={reviewControls ? 'Hide photo controls' : 'Show photo controls'}
        onPress={() => setReviewControls(value => !value)} style={styles.reviewPhoto}>
        {current ? <Image source={{ uri: current.editedUri ?? current.uri }} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityLabel="Full photo preview" /> : <Text style={styles.messageText}>Your photos will appear here.</Text>}
      </Pressable>
      <StatusBar style={reviewControls ? "dark" : "light"} hidden={!reviewControls} />
      {reviewControls && <View style={[styles.header, styles.reviewHeader, { paddingTop: insets.top + 4 }]}>
        <Pressable accessibilityRole="button" onPress={closeReview} disabled={saving} style={styles.back}>
          <Text style={styles.backText}>‹  {reference ? 'Camera' : 'Home'}</Text>
        </Pressable>
        <Text style={styles.badge}>YOUR PHOTOS · {shots.length}</Text>
        {current && <Pressable accessibilityRole="button" accessibilityLabel="Delete current photo from session"
          disabled={saving} onPress={deletePhoto} style={styles.deleteButton}>
          <Text style={[styles.deleteText, (saving) && { opacity: .4 }]}>Delete</Text>
        </Pressable>}
      </View>}
      {reviewControls && <View style={[styles.reviewPanel, { paddingBottom: insets.bottom + 6 }]}>
      <ScrollView horizontal style={styles.filmstrip} contentContainerStyle={styles.thumbnails}>
        {shots.map((shot, index) => <Pressable key={shot.uri} accessibilityRole="button"
          accessibilityLabel={`Preview photo ${index + 1}${shot.saved ? ', saved' : selected.includes(shot.uri) ? ', selected' : ''}`}
          disabled={saving} onPress={() => { setPreviewUri(shot.uri); }} style={[styles.thumbnail, previewUri === shot.uri && styles.currentThumbnail]}>
          <Image source={{ uri: shot.editedUri ?? shot.uri }} style={styles.thumbnailImage} />
          {(shot.saved || selected.includes(shot.uri)) && <Text style={styles.check}>{shot.saved ? 'Saved' : '✓'}</Text>}
        </Pressable>)}
      </ScrollView>
      <View style={styles.reviewActions}>
        {current && <Text style={styles.resolution}>{current.width} × {current.height}</Text>}
        {current && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isSelected, disabled: saving || (Platform.OS !== 'web' && current.saved) }}
          disabled={saving || (Platform.OS !== 'web' && current.saved)} onPress={() => {
            setSaveMessage('');
            setSelected(previous => previous.includes(current.uri) ? previous.filter(uri => uri !== current.uri) : [...previous, current.uri]);
          }} style={styles.selectButton}>
          <Text style={styles.backText}>{current.saved && Platform.OS !== 'web' ? 'Saved to Photos ✓' : isSelected ? '☑ Selected — tap to deselect' : '○ Select this photo'}</Text>
        </Pressable>}
        <Button title={saving ? 'Saving…' : `${Platform.OS === 'web' ? 'Download selected' : 'Save selected'} (${selected.length})`} onPress={saveSelected} disabled={saving || selected.length === 0} />
        <Text accessibilityLiveRegion="polite" style={styles.reviewNote}>{saveMessage || 'Tap photo to hide controls. Save favourites before closing.'}</Text>
      </View>
      </View>}
    </View>;
  }

  if (!reference) return <SafeAreaView style={styles.home}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.homeContent}>
      <Image source={require('./assets/brand/malka-transparent.png')} style={styles.homeLogo} resizeMode="contain" accessibilityLabel="Malka crown logo" />
      <View style={styles.intro}>
        <Text style={styles.subtitle}>Your next{'\n'}favourite photo.</Text>
        <Text style={styles.description}>Choose a reference. Make it yours.</Text>
      </View>
      <View style={styles.homeBottom}>
        <Button title={busy ? 'Opening photos…' : 'Choose reference photo'} onPress={choosePhoto} disabled={busy} />
        <Pressable accessibilityRole="button" onPress={openReview} disabled={busy} style={styles.selectButton}>
          <Text style={styles.homeLink}>My photos{shots.length ? ` (${shots.length})` : ''}</Text>
        </Pressable>
      </View>
      <Text style={styles.privacy}>Made for your moment</Text>
    </ScrollView>
  </SafeAreaView>;

  const blocked = taking || !cameraReady || !active || cameraError || cameraDetached;
  const lastShot = shots[shots.length - 1];
  return <View style={styles.cameraScreen}>
    <StatusBar style="light" />
    <View style={styles.cameraPhotoFrame}>
      {!permission ? <ActivityIndicator color="#ffffff" accessibilityLabel="Checking camera permission" /> :
        !permission.granted ? <View style={styles.message}>
          <Text style={styles.messageTitle}>Let’s open your camera</Text>
          <Text style={styles.messageText}>Camera access lets you line up the live view with your reference photo.</Text>
          <Button title={permission.canAskAgain ? 'Allow camera access' : 'Open Settings'} onPress={allowCamera} />
        </View> : cameraError ? <View style={styles.message}>
          <Text style={styles.messageTitle}>Camera couldn’t start</Text>
          <Text style={styles.messageText}>Close any other app using the camera, then try again. On web, use HTTPS or localhost and allow camera access in your browser.</Text>
          <Button title="Try again" onPress={() => { switchingCamera.current = false; setCameraDetached(true); setCameraError(false); setCameraReady(false); setCameraKey(key => key + 1); }} />
        </View> : cameraDetached ? <ActivityIndicator color="#ffffff" accessibilityLabel="Switching camera" /> : active ? <>
          <CameraView ref={camera} key={cameraKey} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} flash={facing === 'back' ? flash : 'off'}
            mode="picture" animateShutter pictureSize={Platform.OS === 'ios' ? 'Photo' : undefined}
            onCameraReady={() => { switchingCamera.current = false; setCameraReady(true); }} onMountError={() => { switchingCamera.current = false; setCameraError(true); }} />
          {cameraReady ? <ReferenceOverlay uri={reference} adjusting={adjustingReference} transform={referenceTransform} onChange={setReferenceTransform}
            onError={() => { reset(); Alert.alert('Photo could not load', 'Please choose another reference photo.'); }} /> :
            <ActivityIndicator color="#ffffff" accessibilityLabel="Starting camera" />}
        </> : <Text style={styles.messageText}>Camera paused</Text>}
    </View>
    <View pointerEvents="box-none" style={[styles.cameraTop, { paddingTop: insets.top + 8 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back and reset reference" disabled={taking} onPress={reset} style={styles.roundControl}>
        <Text style={styles.cameraIcon}>‹</Text>
      </Pressable>
      <Text pointerEvents="none" style={styles.cameraWordmark}>M A L K A</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={facing === 'front' ? 'Flash unavailable for selfie camera' : `Flash ${flash}. Tap to change.`}
        disabled={taking || facing === 'front' || Platform.OS === 'web'} onPress={() => setFlash(value => value === 'off' ? 'auto' : value === 'auto' ? 'on' : 'off')} style={styles.glassPill}>
        <Text style={styles.cameraText}>ϟ {Platform.OS === 'web' ? 'N/A' : facing === 'front' ? '—' : flash === 'off' ? 'Off' : flash === 'auto' ? 'Auto' : 'On'}</Text>
      </Pressable>
    </View>
    {adjustingReference ? <>
      <View pointerEvents="none" style={styles.dragHint}><Text style={styles.cameraText}>Drag to move · Pinch to resize</Text></View>
      <View style={[styles.referenceSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Reference</Text>
          <Pressable accessibilityRole="button" onPress={() => setAdjustingReference(false)} style={styles.doneButton}><Text style={styles.doneText}>Done</Text></Pressable>
        </View>
        <View style={styles.referenceTools}>
          <Pressable accessibilityRole="button" accessibilityLabel="Make reference smaller" onPress={() => setReferenceTransform(value => ({ ...value, scale: Math.max(.25, value.scale - .1) }))} style={styles.roundControl}><Text style={styles.cameraIcon}>−</Text></Pressable>
          <Text style={styles.cameraText}>Size {Math.round(referenceTransform.scale * 100)}%</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Make reference larger" onPress={() => setReferenceTransform(value => ({ ...value, scale: Math.min(3, value.scale + .1) }))} style={styles.roundControl}><Text style={styles.cameraIcon}>+</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Reset reference size and position" onPress={() => setReferenceTransform(INITIAL_REFERENCE)} style={styles.referenceStep}><Text style={styles.sheetLink}>Reset</Text></Pressable>
        </View>
        <Text style={styles.sheetNote}>Opacity 40%</Text>
      </View>
    </> : <View pointerEvents="box-none" style={[styles.cameraBottom, { paddingBottom: insets.bottom + 12 }]}>
      {cameraReady && <Pressable accessibilityRole="button" disabled={taking} onPress={() => setAdjustingReference(true)} style={styles.glassPill}><Text style={styles.cameraText}>☷  Reference</Text></Pressable>}
      <View style={styles.shutterRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Review ${shots.length} photos`} disabled={taking} onPress={openReview} style={styles.lastShot}>
          {lastShot ? <Image source={{ uri: lastShot.editedUri ?? lastShot.uri }} style={styles.thumbnailImage} /> : <Text style={styles.cameraText}>Photos</Text>}
          {!!shots.length && <Text style={styles.shotCount}>{shots.length}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Take photo" accessibilityState={{ disabled: blocked, busy: taking }} disabled={blocked} onPress={takePhoto}
          style={({ pressed }) => [styles.shutter, (pressed || blocked) && { opacity: .45 }]}>
          {taking ? <ActivityIndicator color="#395775" /> : <View style={styles.shutterInner} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={facing === 'front' ? 'Switch to rear camera' : 'Switch to selfie camera'}
          disabled={taking || cameraDetached || !active || !permission?.granted} onPress={flipCamera} style={styles.flipControl}>
          <Text style={styles.cameraIcon}>↻</Text><Text style={styles.flipLabel}>Flip</Text>
        </Pressable>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.captureStatus}>{taking ? 'Taking photo…' : shots.length ? `${shots.length} ${shots.length === 1 ? 'shot' : 'shots'} · Tap thumbnail to review` : 'Reference stays out of your photo'}</Text>
    </View>}
  </View>;
}

export default function App() {
  return <SafeAreaProvider><Malka /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  home: { flex: 1, backgroundColor: '#E5F0FA' },
  homeContent: { flexGrow: 1, paddingHorizontal: 30, alignItems: 'center', paddingTop: 22, paddingBottom: 24 },
  homeLogo: { width: 130, height: 157, marginTop: 18, marginBottom: 24, tintColor: '#648BB3' },
  opening: { flex: 1, backgroundColor: '#E5F0FA', alignItems: 'center', justifyContent: 'center' },
  openingLogo: { width: '78%', maxWidth: 320, aspectRatio: 1456 / 1088, tintColor: '#648BB3' },
  intro: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, minHeight: 165 },
  subtitle: { fontSize: 37, lineHeight: 44, fontFamily: Platform.OS === 'ios' ? 'Baskerville' : 'serif', color: '#253E59', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 23, color: '#52749A', textAlign: 'center' },
  homeBottom: { width: '100%', gap: 12, marginTop: 26, marginBottom: 36 },
  homeLink: { color: '#395775', fontSize: 16 },
  button: { backgroundColor: '#52749A', borderRadius: 28, paddingVertical: 17, paddingHorizontal: 20, alignItems: 'center', minHeight: 54 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  privacy: { fontSize: 12, letterSpacing: 1.4, textAlign: 'center', color: '#52749A', paddingTop: 16 },
  reviewScreen: { flex: 1, backgroundColor: '#000000' },
  reviewPhoto: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  reviewHeader: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#E5F0FAEB' },
  reviewPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#E5F0FAEB', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  cameraTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, backgroundColor: '#00000025' },
  cameraWordmark: { color: '#FFFFFF', fontFamily: Platform.OS === 'ios' ? 'Baskerville' : 'serif', fontSize: 16, letterSpacing: 3 },
  roundControl: { minWidth: 46, height: 46, paddingHorizontal: 10, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18243199' },
  cameraIcon: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, textAlign: 'center' },
  cameraText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  glassPill: { backgroundColor: '#182431B8', minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 24 },
  cameraBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 14, backgroundColor: '#00000025' },
  shutterRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 18, paddingHorizontal: 14 },
  lastShot: { width: 54, height: 60, borderRadius: 10, overflow: 'hidden', backgroundColor: '#18243199', alignItems: 'center', justifyContent: 'center', borderColor: '#FFFFFF99', borderWidth: 1 },
  shotCount: { position: 'absolute', bottom: 0, right: 0, color: '#FFFFFF', backgroundColor: '#182431CC', paddingHorizontal: 4, fontSize: 11 },
  flipControl: { minWidth: 54, minHeight: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#18243199' },
  flipLabel: { color: '#FFFFFF', fontSize: 11 },
  captureStatus: { color: '#FFFFFF', fontSize: 11, paddingTop: 10, textAlign: 'center' },
  referenceSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#182431F0', paddingHorizontal: 22, paddingTop: 10 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF55', alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '600' },
  doneButton: { minHeight: 44, paddingHorizontal: 22, borderRadius: 24, backgroundColor: '#A9CCF2', justifyContent: 'center' },
  doneText: { color: '#253E59', fontSize: 16, fontWeight: '600' },
  sheetLink: { color: '#A9CCF2', fontSize: 15, fontWeight: '600' },
  sheetNote: { color: '#CDD9E5', fontSize: 12, textAlign: 'center', marginTop: 12 },
  dragHint: { position: 'absolute', top: '48%', alignSelf: 'center', padding: 10, borderRadius: 22, backgroundColor: '#18243199' },
  cameraScreen: { flex: 1, backgroundColor: '#191716', justifyContent: 'center' },
  cameraPhotoFrame: { width: '100%', aspectRatio: 3 / 4, justifyContent: 'center', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  back: { paddingVertical: 14, paddingRight: 10 },
  backText: { color: '#395775', fontSize: 16, fontWeight: '600' },
  badge: { color: '#52749A', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  preview: { flex: 1, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  message: { padding: 28, gap: 20, width: '100%' },
  messageTitle: { fontSize: 25, fontWeight: '700', color: '#FFF7EF', textAlign: 'center' },
  messageText: { fontSize: 16, lineHeight: 24, color: '#CDD9E5', textAlign: 'center' },
  shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF7EF', borderWidth: 3, borderColor: '#A9CCF2', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#191716' },
  referenceTools: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 6 },
  referenceStep: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#FFFFFF14', paddingHorizontal: 12 },
  resolution: { color: '#52749A', fontSize: 12, textAlign: 'center', paddingTop: 4 },
  filmstrip: { flexGrow: 0, height: 100 },
  thumbnails: { gap: 10, padding: 12 },
  thumbnail: { width: 64, height: 76, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  currentThumbnail: { borderColor: '#A9CCF2' },
  thumbnailImage: { width: '100%', height: '100%' },
  check: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#A9CCF2', color: '#292222', fontSize: 12, padding: 3, fontWeight: '700' },
  deleteButton: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  deleteText: { color: '#A13D45', fontSize: 14, fontWeight: '600' },
  reviewActions: { paddingHorizontal: 20 },
  selectButton: { paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  reviewNote: { color: '#52749A', fontSize: 12, lineHeight: 17, textAlign: 'center', paddingVertical: 12 },
});
