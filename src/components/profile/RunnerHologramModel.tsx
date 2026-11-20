import { useEffect, useRef, useState } from 'react';
import RunnerHologram3D from './RunnerHologram3D';
import { poseRunnerGlb } from '../../lib/poseRunnerGlb';

/** CC0 Quaternius Superhero Male, pinned upstream copy. See docs/runner-model.md. */
export const MODEL_VIEWER_SCRIPT = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
// Self-hosted, customized RUNNIT runner. Real skinned 3D mesh with navy kit,
// cyan accents, tan skin, spiked hair, visor and shoes. The model rotates.
export const RUNNER_MODEL_URL = '/assets/runnit-runner-3d.glb';

// Keep the complete head-to-shoes silhouette within the narrow mobile scan panel.
// 130% leaves a little more air above the hair and below the shoes.
const RUNNER_CAMERA_DISTANCE = '130%';
const RUNNER_CAMERA_FOV = '30deg';

type RunnerMaterial = {
  name?: string;
  setAlphaMode?: (mode: 'OPAQUE') => void;
  setDoubleSided?: (enabled: boolean) => void;
  setEmissiveFactor?: (rgb: number[]) => void;
  pbrMetallicRoughness?: {
    setBaseColorFactor?: (rgba: number[]) => void;
    setMetallicFactor?: (value: number) => void;
    setRoughnessFactor?: (value: number) => void;
  };
};
type ModelViewerElement = HTMLElement & {
  model?: { materials?: RunnerMaterial[] };
  getCameraOrbit?: () => { theta: number };
  jumpCameraToGoal?: () => void;
};

let viewerImport: Promise<void> | null = null;
function loadViewerModule(): Promise<void> {
  if (customElements.get('model-viewer')) return Promise.resolve();
  if (viewerImport) return viewerImport;
  viewerImport = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('3D viewer timed out')); }
    }, 15000);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (error) reject(error); else resolve();
    };
    script.type = 'module';
    script.src = MODEL_VIEWER_SCRIPT;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      void customElements.whenDefined('model-viewer').then(() => finish(),
        () => finish(new Error('3D viewer registration failed')));
    };
    script.onerror = () => finish(new Error('3D viewer script unavailable'));
    document.head.appendChild(script);
  }).catch(error => {
    viewerImport = null;
    throw error;
  });
  return viewerImport;
}

function hologramFinish(viewer: ModelViewerElement) {
  // The imported GLB already has per-vertex RUNNIT uniform colors and separate
  // materials for the face, navy kit, hair, cyan visor and sneakers.
  // Never repaint the full model cyan: it would hide the runner's appearance.
  for (const material of viewer.model?.materials || []) {
    try {
      material.setDoubleSided?.(true);
      if (material.name?.includes('electric blue lenses')) {
        material.setAlphaMode?.('OPAQUE');
        material.setEmissiveFactor?.([0.006, 0.12, 0.18]);
      }
    } catch {
      // Keep baked material colors on older iOS WebGL implementations.
    }
  }
}

export default function RunnerHologramModel({ rotating, manualAngle }: {
  rotating: boolean;
  manualAngle: number;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const lastManual = useRef(manualAngle);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    let active = true;
    let viewer: ModelViewerElement | null = null;
    let blobUrl: string | null = null;
    const controller = new AbortController();
    let modelTimeout: number | undefined;
    // Load the self-hosted, CC0-derived RUNNIT 3D avatar and pose its real skeletal joints,
    // then let model-viewer render it. Never modify the user's profile data.
    const abortTimer = window.setTimeout(() => controller.abort(), 16000);
    const prepared = fetch(RUNNER_MODEL_URL, { signal: controller.signal, mode: 'cors' })
      .then(async response => {
        if (!response.ok) throw new Error('3D model download failed');
        return poseRunnerGlb(await response.arrayBuffer());
      });
    void Promise.all([loadViewerModule(), prepared]).then(([, body]) => {
      if (!active || !mountRef.current) return;
      blobUrl = URL.createObjectURL(new Blob([body], {type: 'model/gltf-binary'}));
      viewer = document.createElement('model-viewer') as ModelViewerElement;
      viewerRef.current = viewer;
      viewer.className = 'rp-hologram-real-model';
      viewer.setAttribute('src', blobUrl);
      viewer.setAttribute('alt', 'RUNNIT Runner in dunklem Sportoutfit mit cyanfarbenen Akzenten, braunen Haaren, blauer Sportbrille und weißen Laufschuhen');
      viewer.setAttribute('loading', 'eager');
      viewer.setAttribute('camera-controls', '');
      viewer.setAttribute('disable-pan', '');
      viewer.setAttribute('disable-zoom', '');
      viewer.setAttribute('interaction-prompt', 'none');
      viewer.setAttribute('min-camera-orbit', 'auto auto 115%');
      viewer.setAttribute('max-camera-orbit', 'auto auto 180%');
      viewer.setAttribute('camera-orbit', '0deg 90deg ' + RUNNER_CAMERA_DISTANCE);
      viewer.setAttribute('field-of-view', RUNNER_CAMERA_FOV);
      viewer.setAttribute('shadow-intensity', '0');
      viewer.setAttribute('environment-image', 'neutral');
      viewer.setAttribute('exposure', '1.06');
      viewer.setAttribute('rotation-per-second', '13deg');
      viewer.setAttribute('touch-action', 'none');
      viewer.addEventListener('load', () => {
        if (!active || !viewer) return;
        hologramFinish(viewer);
        if (modelTimeout !== undefined) window.clearTimeout(modelTimeout);
        setStatus('ready');
      }, { once: true });
      viewer.addEventListener('error', () => {
        if (!active) return;
        if (modelTimeout !== undefined) window.clearTimeout(modelTimeout);
        setStatus('failed');
      }, { once: true });
      mountRef.current.appendChild(viewer);
      modelTimeout = window.setTimeout(() => {
        if (active) setStatus(s => s === 'loading' ? 'failed' : s);
      }, 12000);
    }).catch(() => { if (active) setStatus('failed'); }).finally(() => {
      window.clearTimeout(abortTimer);
    });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(abortTimer);
      if (modelTimeout !== undefined) window.clearTimeout(modelTimeout);
      viewer?.remove();
      viewerRef.current = null;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || status !== 'ready') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (rotating && !reduce) {
      viewer.setAttribute('auto-rotate', '');
      lastManual.current = manualAngle;
    } else {
      viewer.removeAttribute('auto-rotate');
      const delta = manualAngle - lastManual.current;
      lastManual.current = manualAngle;
      const angle = (viewer.getCameraOrbit?.().theta ?? 0) * 180 / Math.PI + delta;
      viewer.setAttribute('camera-orbit', String(angle) + 'deg 90deg ' + RUNNER_CAMERA_DISTANCE);
      viewer.jumpCameraToGoal?.();
    }
  }, [rotating, manualAngle, status]);

  return (
    <div className="rp-real-hologram" data-renderer={status}>
      <div ref={mountRef} className="rp-real-hologram-mount" aria-hidden={status !== 'ready'} />
      {status !== 'ready' && (
        <div className="rp-hologram-loading-fallback">
          <RunnerHologram3D rotating={rotating} manualAngle={manualAngle} />
        </div>
      )}
    </div>
  );
}
