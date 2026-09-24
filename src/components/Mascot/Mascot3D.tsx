// @ts-nocheck — @react-three/fiber's JSX intrinsics (ambientLight,
// primitive, etc.) are declared via a `declare global { namespace JSX }`
// augmentation that doesn't merge under @types/react@19's JSX namespace
// location; a known ecosystem gap between r3f and React 19 types, not a
// real bug here. Babel transpiles/runs this file fine regardless — this
// only affects static checking, scoped to this one self-contained file
// rather than relaxing strictness project-wide.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { toByteArray } from 'base64-js';
import { Asset } from 'expo-asset';
// The "legacy" entry keeps readAsStringAsync/EncodingType — the default
// expo-file-system export in this SDK throws (not just warns) telling you
// to migrate to the new File/Directory API, which useLoader-free manual
// GLB reading here doesn't need.
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// GLTFParser does Safari/Firefox detection via navigator.userAgent to work
// around known browser texture-decoding bugs — RN's global `navigator`
// exists but never sets `.userAgent`, so GLTFParser's unguarded
// `userAgent.match(...)` throws "Cannot read property 'match' of
// undefined" on every parse. A generic string here is enough: it fails
// the Safari/Firefox regex tests (correctly — this isn't either), so
// three.js takes its normal fallback texture-loading path.
if (typeof navigator !== 'undefined' && !navigator.userAgent) {
  // @ts-ignore
  navigator.userAgent = 'ReactNative';
}

const modelAsset = Asset.fromModule(require('../../assets/models/spark.glb'));

// Module-level singleton: the corner peek and the full popup each mount
// their own Mascot3D instance, and without this, EACH one independently
// re-downloaded, re-decoded (18MB base64) and re-parsed (14MB GLB) the
// whole model from scratch — several seconds of JS-thread-blocking work
// every single time either one mounted, which is what was actually
// causing the app-wide lag (not just the background-canvas bug fixed
// earlier). Now the expensive decode+parse runs once per app session;
// every mount after that just clones the cached result, which is cheap.
let cachedScenePromise: Promise<THREE.Object3D> | null = null;

function loadSparkModel(): Promise<THREE.Object3D> {
  if (!cachedScenePromise) {
    cachedScenePromise = (async () => {
      await modelAsset.downloadAsync();
      const uri = modelAsset.localUri ?? modelAsset.uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = toByteArray(base64);

      return new Promise<THREE.Object3D>((resolve, reject) => {
        new GLTFLoader().parse(
          bytes.buffer,
          '',
          (gltf) => {
            const root = gltf.scene;
            // Center + normalize scale so the model frames consistently
            // regardless of the source file's native origin/units.
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);
            root.position.sub(center);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            root.scale.setScalar(1.6 / maxDim);
            resolve(root);
          },
          reject
        );
      });
    })();
  }
  return cachedScenePromise;
}

interface Mascot3DProps {
  rotating?: boolean;
}

// Real-time render of the actual mascot model (base_high_shaded.glb — the
// lighter of the two exports, chosen over the 32MB PBR version since this
// renders continuously at a small on-screen size, not as a hero shot).
//
// Deliberately does NOT use @react-three/fiber's useLoader(GLTFLoader, uri)
// — three.js's loaders assume a browser fetch() that can read a local
// file:// URI as binary, which RN's fetch can't do reliably (surfaced as
// "ReferenceError: Property 'ProgressEvent' doesn't exist" and a JSON
// parse error on the raw GLB bytes). Instead: read the file manually via
// expo-file-system as base64, decode to raw bytes, and hand them to
// GLTFLoader.parse() directly — the documented pattern for local GLB
// assets in Expo, since it never touches fetch/XHR at all.
export function Mascot3D({ rotating = true }: Mascot3DProps) {
  const [scene, setScene] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadSparkModel()
      .then((root) => {
        if (cancelled) return;
        // Clone per instance — the peek and the popup can both be
        // mounted at once, and each needs its own Object3D to rotate/
        // transform independently. Cloning is cheap (no re-parsing);
        // geometries/materials are shared under the hood.
        setScene(root.clone(true));
      })
      .catch((err) => {
        console.log('[Mascot3D] Model load failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!scene) return null;

  return (
    <Canvas
      style={styles.canvas}
      camera={{ position: [0, 0, 4], fov: 35 }}
      gl={{ antialias: true }}
      // "demand" when static (the always-on-screen peek) — render once on
      // mount and then stop, instead of driving a continuous per-frame
      // render loop for a model that never changes. "always" only when
      // actually rotating, and only while this Canvas is mounted at all
      // (see the SparkOverlay fix — this used to run forever in the
      // background even when invisible).
      frameloop={rotating ? 'always' : 'demand'}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} color="#C4B5FD" />
      <directionalLight position={[-2, -1.5, -2]} intensity={0.35} color="#6D28D9" />
      <RotatingGroup rotating={rotating}>
        <primitive object={scene} />
      </RotatingGroup>
      {!rotating ? <ForceFirstFrame /> : null}
    </Canvas>
  );
}

// frameloop="demand" is supposed to render once automatically when the
// scene commits, but that didn't reliably happen here — the peek was
// rendering as a blank transparent canvas. An explicit invalidate() on
// mount guarantees at least one real frame gets painted.
function ForceFirstFrame() {
  const { invalidate } = useThree();
  useEffect(() => {
    invalidate();
  }, [invalidate]);
  return null;
}

function RotatingGroup({ rotating, children }: { rotating: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (rotating && ref.current) {
      ref.current.rotation.y += delta * 0.4;
    }
  });
  return <group ref={ref}>{children}</group>;
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});
