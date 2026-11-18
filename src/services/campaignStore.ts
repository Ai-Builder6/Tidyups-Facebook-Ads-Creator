import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../firebase';
import {
  BLUEPRINT_LIMITS,
  CampaignSettings,
  CreativeFormat,
  GeneratedAd,
  OperationType,
  SavedCampaign,
  ServiceKey,
  ToneKey,
} from '../types';

function clampString(value: string, maxLength: number, fallback = ''): string {
  const trimmed = (value ?? '').trim();
  const resolved = trimmed.length > 0 ? trimmed : fallback;
  return resolved.slice(0, maxLength);
}

function makeSafeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const raw = `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return raw.slice(0, BLUEPRINT_LIMITS.idMax);
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (val && typeof val === 'object' && 'seconds' in val && typeof (val as { seconds: unknown }).seconds === 'number') {
    return (val as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

export interface LinkedWorkspaceRefs {
  linkedSheetId: string;
  linkedSheetName: string;
  linkedDriveFileId: string;
  linkedDriveFileName: string;
}

export function subscribeToUserCampaigns(
  uid: string,
  onCampaigns: (campaigns: SavedCampaign[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const campaignsPath = 'campaigns';
  const q = query(collection(db, campaignsPath), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedCampaign[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: String(d.ownerId ?? uid),
          title: String(d.title ?? 'Untitled Campaign'),
          service: (d.service as ServiceKey) ?? 'moveout',
          tone: (d.tone as ToneKey) ?? 'trust',
          format: (d.format as CreativeFormat) ?? '1:1',
          offer: String(d.offer ?? ''),
          area: String(d.area ?? 'Edmonton, Alberta + 20 km'),
          bookingUrl: String(d.bookingUrl ?? 'https://app.tidyupscleaning.com/booking'),
          businessPhone: String(d.businessPhone ?? '780-718-5092'),
          notes: String(d.notes ?? ''),
          adCount: Number(d.adCount ?? 5),
          linkedSheetId: String(d.linkedSheetId ?? ''),
          linkedSheetName: String(d.linkedSheetName ?? ''),
          linkedDriveFileId: String(d.linkedDriveFileId ?? ''),
          linkedDriveFileName: String(d.linkedDriveFileName ?? ''),
          createdAtMillis: toMillis(d.createdAt),
          updatedAtMillis: toMillis(d.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMillis - a.updatedAtMillis);
      onCampaigns(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, campaignsPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function loadCampaignAdsFromFirestore(
  campaignId: string,
  uid: string
): Promise<GeneratedAd[]> {
  const adsPath = `campaigns/${campaignId}/ads`;
  try {
    const q = query(
      collection(db, 'campaigns', campaignId, 'ads'),
      where('ownerId', '==', uid),
      where('campaignId', '==', campaignId)
    );
    const snap = await getDocs(q);
    const ads: GeneratedAd[] = snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        number: Number(d.variationNumber ?? 1),
        service: String(d.serviceName ?? ''),
        format: (d.format as CreativeFormat) ?? '1:1',
        headline: String(d.headline ?? ''),
        primary_text: String(d.primaryText ?? ''),
        description: String(d.description ?? ''),
        cta: String(d.cta ?? 'Book Now'),
        destination_url: String(d.destinationUrl ?? ''),
        image_prompt: String(d.imagePrompt ?? ''),
        video_script: String(d.videoScript ?? ''),
      };
    });
    ads.sort((a, b) => a.number - b.number);
    return ads;
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, adsPath);
  }
}

export async function saveCampaignWithAdsToFirestore(params: {
  existingCampaignId: string | null;
  settings: CampaignSettings;
  ads: GeneratedAd[];
  links: LinkedWorkspaceRefs;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Google to save campaigns to Firebase.');
  }
  if (!BLUEPRINT_LIMITS.httpsUrlRegex.test(params.settings.booking.trim())) {
    throw new Error('Booking URL must begin with https://');
  }
  if (params.ads.length === 0) {
    throw new Error('Generate at least 1 ad variation before saving.');
  }

  const campaignId =
    params.existingCampaignId && BLUEPRINT_LIMITS.idRegex.test(params.existingCampaignId)
      ? params.existingCampaignId.slice(0, BLUEPRINT_LIMITS.idMax)
      : makeSafeDocId('camp');

  const safeAds = params.ads.slice(0, BLUEPRINT_LIMITS.adCountMax);
  const safeBookingUrl = clampString(
    params.settings.booking,
    BLUEPRINT_LIMITS.bookingUrlMax,
    'https://app.tidyupscleaning.com/booking'
  );
  const safePhone = clampString(
    params.settings.phone,
    BLUEPRINT_LIMITS.phoneMax,
    '780-718-5092'
  );

  const campaignPath = `campaigns/${campaignId}`;
  const batch = writeBatch(db);
  const campaignRef = doc(db, 'campaigns', campaignId);

  if (params.existingCampaignId) {
    // Delete previous ad subcollection documents before writing updated set
    const existingAdsQuery = query(
      collection(db, 'campaigns', campaignId, 'ads'),
      where('ownerId', '==', user.uid),
      where('campaignId', '==', campaignId)
    );
    try {
      const prevAdsSnap = await getDocs(existingAdsQuery);
      for (const prevDoc of prevAdsSnap.docs) {
        batch.delete(prevDoc.ref);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `${campaignPath}/ads`);
    }

    batch.update(campaignRef, {
      title: clampString(params.settings.title, BLUEPRINT_LIMITS.titleMax, 'Tidyups Campaign'),
      service: params.settings.service,
      tone: params.settings.tone,
      format: params.settings.format,
      offer: (params.settings.offer ?? '').trim().slice(0, BLUEPRINT_LIMITS.offerMax),
      area: clampString(params.settings.area, BLUEPRINT_LIMITS.areaMax, 'Edmonton, Alberta + 20 km'),
      bookingUrl: safeBookingUrl,
      businessPhone: safePhone.length >= BLUEPRINT_LIMITS.phoneMin ? safePhone : '780-718-5092',
      notes: (params.settings.notes ?? '').trim().slice(0, BLUEPRINT_LIMITS.notesMax),
      adCount: safeAds.length,
      linkedSheetId: (params.links.linkedSheetId ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      linkedSheetName: (params.links.linkedSheetName ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedNameMax),
      linkedDriveFileId: (params.links.linkedDriveFileId ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      linkedDriveFileName: (params.links.linkedDriveFileName ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedNameMax),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(campaignRef, {
      ownerId: user.uid,
      title: clampString(params.settings.title, BLUEPRINT_LIMITS.titleMax, 'Tidyups Campaign'),
      service: params.settings.service,
      tone: params.settings.tone,
      format: params.settings.format,
      offer: (params.settings.offer ?? '').trim().slice(0, BLUEPRINT_LIMITS.offerMax),
      area: clampString(params.settings.area, BLUEPRINT_LIMITS.areaMax, 'Edmonton, Alberta + 20 km'),
      bookingUrl: safeBookingUrl,
      businessPhone: safePhone.length >= BLUEPRINT_LIMITS.phoneMin ? safePhone : '780-718-5092',
      notes: (params.settings.notes ?? '').trim().slice(0, BLUEPRINT_LIMITS.notesMax),
      adCount: safeAds.length,
      linkedSheetId: (params.links.linkedSheetId ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      linkedSheetName: (params.links.linkedSheetName ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedNameMax),
      linkedDriveFileId: (params.links.linkedDriveFileId ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      linkedDriveFileName: (params.links.linkedDriveFileName ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedNameMax),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (let i = 0; i < safeAds.length; i += 1) {
    const ad = safeAds[i];
    const adId = `ad_${i + 1}`;
    const adRef = doc(db, 'campaigns', campaignId, 'ads', adId);
    const safeDest = BLUEPRINT_LIMITS.httpsUrlRegex.test((ad.destination_url ?? '').trim())
      ? clampString(ad.destination_url, BLUEPRINT_LIMITS.bookingUrlMax, safeBookingUrl)
      : safeBookingUrl;

    batch.set(adRef, {
      ownerId: user.uid,
      campaignId,
      variationNumber: i + 1,
      serviceName: clampString(ad.service, BLUEPRINT_LIMITS.serviceNameMax, 'Cleaning Service'),
      format: ad.format,
      headline: clampString(ad.headline, BLUEPRINT_LIMITS.headlineMax, 'Tidyups Cleaning Service'),
      primaryText: clampString(ad.primary_text, BLUEPRINT_LIMITS.primaryTextMax, 'Book online today.'),
      description: clampString(ad.description, BLUEPRINT_LIMITS.descriptionMax, 'Edmonton cleaning quote.'),
      cta: clampString(ad.cta, BLUEPRINT_LIMITS.ctaMax, 'Book Now'),
      destinationUrl: safeDest,
      imagePrompt: clampString(ad.image_prompt, BLUEPRINT_LIMITS.promptMax, 'Tidyups advertisement.'),
      videoScript: clampString(ad.video_script, BLUEPRINT_LIMITS.scriptMax, '10-second cleaning video.'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return campaignId;
  } catch (error) {
    return handleFirestoreError(
      error,
      params.existingCampaignId ? OperationType.UPDATE : OperationType.CREATE,
      campaignPath
    );
  }
}

export async function updateCampaignWorkspaceLinks(
  campaignId: string,
  links: LinkedWorkspaceRefs
): Promise<void> {
  const path = `campaigns/${campaignId}`;
  try {
    await updateDoc(doc(db, 'campaigns', campaignId), {
      linkedSheetId: (links.linkedSheetId ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      linkedSheetName: (links.linkedSheetName ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedNameMax),
      linkedDriveFileId: (links.linkedDriveFileId ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedIdMax),
      linkedDriveFileName: (links.linkedDriveFileName ?? '').trim().slice(0, BLUEPRINT_LIMITS.linkedNameMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCampaignFromFirestore(campaignId: string, uid: string): Promise<void> {
  const campaignPath = `campaigns/${campaignId}`;
  try {
    const adsSnap = await getDocs(
      query(
        collection(db, 'campaigns', campaignId, 'ads'),
        where('ownerId', '==', uid),
        where('campaignId', '==', campaignId)
      )
    );
    const batch = writeBatch(db);
    for (const adDoc of adsSnap.docs) {
      batch.delete(adDoc.ref);
    }
    batch.delete(doc(db, 'campaigns', campaignId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, campaignPath);
  }
}
