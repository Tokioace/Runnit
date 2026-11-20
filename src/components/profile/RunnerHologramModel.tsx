import { useEffect, useRef, useState } from 'react';
import RunnerHologram3D from './RunnerHologram3D';

/** CC0 Quaternius Superhero Male, pinned upstream copy. See docs/runner-model.md. */
export const MODEL_VIEWER_SCRIPT = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
export const RUNNER_MODEL_URL = 'https://cdn.jsdelivr.net/gh/programasweights/avatar@a488723e3a93d73d5c562d88f8a85353c37bc721/public/assets/character.glb';

type RunnerMaterial = {
  setAlphaMode?: (mode: 'BLEND') => void;
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
  for (const material of viewer.model?.materials || []) {
    try {
      material.setAlphaMode?.('BLEND');
      material.setDoubleSided?.(true);
      material.pbrMetallicRoughness?.setBaseColorFactor?.([0.04, 0.78, 0.9, 0.48]);
      material.pbrMetallicRoughness?.setMetallicFactor?.(0.22);
      material.pbrMetallicRoughness?.setRoughnessFactor?.(0.36);
      material.setEmissiveFactor?.([0.015, 0.23, 0.30]);
    } catch {
      // Model remains visible with its original material if customization fails.
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
    let timeout: number | undefined;
    void loadViewerModule().then(() => {
      if (!active || !mountRef.current) return;
      viewer = document.createElement('model-viewer') as ModelViewerElement;
      viewerRef.current = viewer;
      viewer.className = 'rp-hologram-real-model';
      viewer.setAttribute('src', RUNNER_MODEL_URL);
      viewer.setAttribute('alt', 'Dreidimensionaler cyanfarbener Läufer');
      viewer.setAttribute('loading', 'eager');
      viewer.setAttribute('camera-controls', '');
      viewer.setAttribute('disable-pan', '');
      viewer.setAttribute('disable-zoom', '');
      viewer.setAttribute('interaction-prompt', 'none');
      viewer.setAttribute('camera-orbit', '0deg 90deg 120%');
      viewer.setAttribute('field-of-view', '30deg');
      viewer.setAttribute('shadow-intensity', '0');
      viewer.setAttribute('environment-image', 'neutral');
      viewer.setAttribute('exposure', '1.3');
      viewer.setAttribute('rotation-per-second', '13deg');
      viewer.setAttribute('touch-action', 'none');
      viewer.addEventListener('load', () => {
        if (!active || !viewer) return;
        hologramFinish(viewer);
        if (timeout !== undefined) window.clearTimeout(timeout);
        setStatus('ready');
      }, { once: true });
      viewer.addEventListener('error', () => {
        if (!active) return;
        if (timeout !== undefined) window.clearTimeout(timeout);
        setStatus('failed');
      }, { once: true });
      mountRef.current.appendChild(viewer);
      timeout = window.setTimeout(() => {
        if (active) setStatus(s => s === 'loading' ? 'failed' : s);
      }, 18000);
    }).catch(() => { if (active) setStatus('failed'); });
    return () => {
      active = false;
      if (timeout !== undefined) window.clearTimeout(timeout);
      viewer?.remove();
      viewerRef.current = null;
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
      viewer.setAttribute('camera-orbit', String(angle) + 'deg 90deg 120%');
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
