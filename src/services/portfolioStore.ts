import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../firebase';
import {
  BLUEPRINT_LIMITS,
  CreativeAspectRatio,
  CreativeAsset,
  CreativeCategory,
  CreativeServiceTag,
  OperationType,
} from '../types';

function clampText(val: string, maxLen: number, fallback = ''): string {
  const trimmed = (val ?? '').trim();
  const base = trimmed.length > 0 ? trimmed : fallback;
  return base.slice(0, maxLen);
}

function makeAssetId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'seconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number'
  ) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

export function subscribeToPortfolioAssets(
  uid: string,
  onAssets: (assets: CreativeAsset[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'creativeAssets';
  const q = query(collection(db, path), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const items: CreativeAsset[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: String(d.ownerId ?? uid),
          category: (d.category as CreativeCategory) ?? 'ad-image',
          title: String(d.title ?? 'Untitled Creative'),
          prompt: String(d.prompt ?? ''),
          service: (d.service as CreativeServiceTag) ?? 'brand',
          aspectRatio: (d.aspectRatio as CreativeAspectRatio) ?? '1:1',
          modelUsed: String(d.modelUsed ?? 'gemini-3.1-flash-lite-image'),
          previewDataUrl: String(d.previewDataUrl ?? ''),
          svgMarkup: String(d.svgMarkup ?? ''),
          durationLabel: String(d.durationLabel ?? ''),
          interactionId: String(d.interactionId ?? ''),
          driveFileId: String(d.driveFileId ?? ''),
          driveWebViewLink: String(d.driveWebViewLink ?? ''),
          createdAtMillis: toMillis(d.createdAt),
          updatedAtMillis: toMillis(d.updatedAt),
        };
      });
      items.sort((a, b) => b.createdAtMillis - a.createdAtMillis);
      onAssets(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export interface SaveCreativeAssetInput {
  category: CreativeCategory;
  title: string;
  prompt: string;
  service: CreativeServiceTag;
  aspectRatio: CreativeAspectRatio;
  modelUsed: string;
  previewDataUrl: string;
  svgMarkup?: string;
  durationLabel?: string;
  interactionId?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
}

export async function saveCreativeAssetToFirestore(
  input: SaveCreativeAssetInput
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Google to save creatives to your Firestore portfolio.');
  }

  const assetId = makeAssetId(input.category.replace('-', '_'));
  const path = `creativeAssets/${assetId}`;

  const safeDriveLink =
    input.driveWebViewLink && BLUEPRINT_LIMITS.httpsUrlRegex.test(input.driveWebViewLink.trim())
      ? input.driveWebViewLink.trim().slice(0, BLUEPRINT_LIMITS.driveWebViewLinkMax)
      : '';

  const safePreview =
    input.previewDataUrl && input.previewDataUrl.length <= BLUEPRINT_LIMITS.previewDataUrlMax
      ? input.previewDataUrl
      : '';

  const safeSvg =
    input.svgMarkup && input.svgMarkup.length <= BLUEPRINT_LIMITS.svgMarkupMax
      ? input.svgMarkup
      : '';

  try {
    await setDoc(doc(db, 'creativeAssets', assetId), {
      ownerId: user.uid,
      category: input.category,
      title: clampText(input.title, BLUEPRINT_LIMITS.assetTitleMax, 'Tidyups Creative'),
      prompt: clampText(input.prompt, BLUEPRINT_LIMITS.promptMax, 'Tidyups creative prompt'),
      service: input.service,
      aspectRatio: input.aspectRatio,
      modelUsed: clampText(
        input.modelUsed,
        BLUEPRINT_LIMITS.modelUsedMax,
        'gemini-3.1-flash-lite-image'
      ),
      previewDataUrl: safePreview,
      svgMarkup: safeSvg,
      durationLabel: (input.durationLabel ?? '').trim().slice(0, BLUEPRINT_LIMITS.durationLabelMax),
      interactionId: (input.interactionId ?? '')
        .trim()
        .slice(0, BLUEPRINT_LIMITS.interactionIdMax),
      driveFileId: (input.driveFileId ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      driveWebViewLink: safeDriveLink,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return assetId;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function attachDriveBackupToCreativeAsset(
  assetId: string,
  title: string,
  driveFileId: string,
  driveWebViewLink: string
): Promise<void> {
  const path = `creativeAssets/${assetId}`;
  const safeDriveLink =
    driveWebViewLink && BLUEPRINT_LIMITS.httpsUrlRegex.test(driveWebViewLink.trim())
      ? driveWebViewLink.trim().slice(0, BLUEPRINT_LIMITS.driveWebViewLinkMax)
      : `https://drive.google.com/file/d/${driveFileId}/view`;

  try {
    await updateDoc(doc(db, 'creativeAssets', assetId), {
      title: clampText(title, BLUEPRINT_LIMITS.assetTitleMax, 'Tidyups Creative'),
      driveFileId: driveFileId.trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      driveWebViewLink: safeDriveLink,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCreativeAssetFromFirestore(assetId: string): Promise<void> {
  const path = `creativeAssets/${assetId}`;
  try {
    await deleteDoc(doc(db, 'creativeAssets', assetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
