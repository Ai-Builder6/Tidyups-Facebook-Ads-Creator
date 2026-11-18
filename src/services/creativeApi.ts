import { BLUEPRINT_LIMITS, CreativeAspectRatio } from '../types';

export interface GenerateImageParams {
  prompt: string;
  aspectRatio: CreativeAspectRatio;
  quality: 'fast' | 'hd';
  imageSize?: '1K' | '2K';
  referenceImageBase64?: string;
  referenceMimeType?: string;
}

export interface GenerateImageResult {
  imageDataUrl: string;
  mimeType: string;
  captionText: string;
  modelUsed: string;
}

export interface GenerateVideoParams {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  duration: '5s' | '8s' | '10s';
  resolution: '720p' | '1080p';
  referenceImageBase64?: string;
  referenceMimeType?: string;
  previousInteractionId?: string;
}

export interface GenerateVideoResult {
  videoDataUrl: string;
  mimeType: string;
  interactionId: string;
  modelUsed: string;
}

export async function generateStudioImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const res = await fetch('/api/gemini/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const payload = (await res.json()) as Partial<GenerateImageResult> & { error?: string };
  if (!res.ok || !payload.imageDataUrl) {
    throw new Error(payload.error || `Image generation failed (HTTP ${res.status}).`);
  }
  return {
    imageDataUrl: payload.imageDataUrl,
    mimeType: payload.mimeType || 'image/png',
    captionText: payload.captionText || '',
    modelUsed: payload.modelUsed || 'gemini-3.1-flash-lite-image',
  };
}

export async function generateStudioVideo(
  params: GenerateVideoParams
): Promise<GenerateVideoResult> {
  const res = await fetch('/api/gemini/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const payload = (await res.json()) as Partial<GenerateVideoResult> & { error?: string };
  if (!res.ok || !payload.videoDataUrl) {
    throw new Error(payload.error || `Video generation failed (HTTP ${res.status}).`);
  }
  return {
    videoDataUrl: payload.videoDataUrl,
    mimeType: payload.mimeType || 'video/mp4',
    interactionId: payload.interactionId || '',
    modelUsed: payload.modelUsed || 'gemini-omni-1.2-flash',
  };
}

export async function assetUrlToBase64(
  url: string
): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], base64: match[2], dataUrl: url };
    }
  }
  const response = await fetch(url);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      resolve({
        mimeType,
        base64: commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl,
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read reference image.'));
    reader.readAsDataURL(blob);
  });
}

export async function compressImageToThumbnail(
  imageSrc: string,
  maxDim = 360,
  initialQuality = 0.68
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = initialQuality;
      let result = canvas.toDataURL('image/webp', quality);
      if (!result.startsWith('data:image/webp')) {
        result = canvas.toDataURL('image/jpeg', quality);
      }
      while (result.length > BLUEPRINT_LIMITS.previewDataUrlMax - 8000 && quality > 0.25) {
        quality -= 0.12;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result.length <= BLUEPRINT_LIMITS.previewDataUrlMax ? result : '');
    };
    img.onerror = () => resolve('');
    img.src = imageSrc;
  });
}

export async function captureVideoPosterThumbnail(
  videoSrc: string,
  maxDim = 360
): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    let settled = false;
    const finish = (thumb: string) => {
      if (settled) return;
      settled = true;
      video.src = '';
      resolve(thumb);
    };

    const grabFrame = () => {
      try {
        const vw = video.videoWidth || 360;
        const vh = video.videoHeight || 360;
        const scale = Math.min(1, maxDim / Math.max(vw, vh));
        const width = Math.max(1, Math.round(vw * scale));
        const height = Math.max(1, Math.round(vh * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish('');
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const out = canvas.toDataURL('image/jpeg', 0.68);
        finish(out.length <= BLUEPRINT_LIMITS.previewDataUrlMax ? out : '');
      } catch {
        finish('');
      }
    };

    video.onloadeddata = () => {
      if (video.duration > 0.4) {
        video.currentTime = 0.35;
      } else {
        grabFrame();
      }
    };
    video.onseeked = grabFrame;
    video.onerror = () => finish('');
    setTimeout(() => finish(''), 6000);
    video.src = videoSrc;
  });
}

export function triggerDataUrlDownload(dataUrl: string, fileName: string): void {
  const parts = dataUrl.split(',');
  if (parts.length < 2) return;
  const mimeMatch = parts[0].match(/data:([^;]+);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export async function downloadResizedPngIcon(
  imageSrc: string,
  sizePx: number,
  fileName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sizePx;
      canvas.height = sizePx;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable.'));
        return;
      }
      ctx.drawImage(img, 0, 0, sizePx, sizePx);
      const pngDataUrl = canvas.toDataURL('image/png');
      triggerDataUrlDownload(pngDataUrl, fileName);
      resolve();
    };
    img.onerror = () => reject(new Error('Could not render icon for resize.'));
    img.src = imageSrc;
  });
}

// Local IndexedDB full-resolution media cache keyed by Firestore assetId
const IDB_NAME = 'tidyups_portfolio_media_v1';
const IDB_STORE = 'media';

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheFullMediaInBrowser(assetId: string, dataUrl: string): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(dataUrl, assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // non-fatal local cache failure
  }
}

export async function getCachedFullMediaFromBrowser(assetId: string): Promise<string | null> {
  try {
    const db = await openMediaDb();
    const val = await new Promise<string | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(assetId);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    });
    db.close();
    return val;
  } catch {
    return null;
  }
}

export async function deleteCachedFullMediaFromBrowser(assetId: string): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // ignore
  }
}
