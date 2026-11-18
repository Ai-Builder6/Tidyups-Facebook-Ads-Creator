import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  Image as ImageIcon,
  Layers,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import {
  assetUrlToBase64,
  cacheFullMediaInBrowser,
  compressImageToThumbnail,
  generateStudioImage,
  getCachedFullMediaFromBrowser,
  triggerDataUrlDownload,
} from '../services/creativeApi';
import {
  attachDriveBackupToCreativeAsset,
  saveCreativeAssetToFirestore,
} from '../services/portfolioStore';
import {
  ensurePortfolioDriveFolder,
  uploadBase64MediaToDrive,
} from '../services/workspaceApi';
import {
  BLUEPRINT_LIMITS,
  CampaignSettings,
  CreativeAspectRatio,
  CreativeAsset,
  GeneratedAd,
  PendingConfirmation,
  ServiceKey,
} from '../types';
import { SERVICE_DATA } from '../utils/adGenerator';
import { OFFICIAL_MASCOT_REFERENCES } from './TidyupsLogo';

interface ImageCreatorPageProps {
  user: User | null;
  accessToken: string | null;
  onSignIn: () => Promise<string | null>;
  settings: CampaignSettings;
  ads: GeneratedAd[];
  portfolioAssets: CreativeAsset[];
  initialPrompt?: string;
  initialTitle?: string;
  onDeleteAsset: (asset: CreativeAsset) => void;
  onRequestConfirmation: (confirm: PendingConfirmation) => void;
  onStatus: (msg: string) => void;
  status: string;
}

const SCENE_PRESETS: Array<{ label: string; service: ServiceKey; prompt: string }> = [
  {
    label: 'Move-Out Kitchen Gleam',
    service: 'moveout',
    prompt:
      'Editorial architectural photography of a bright modern Edmonton Canadian kitchen spotless after a professional move-out clean, gleaming white quartz island, stainless steel appliances, polished hardwood floors, warm natural daylight, subtle royal purple and pink fresh floral accent on counter, commercial ad quality, no text.',
  },
  {
    label: 'Spa Bathroom Deep Clean',
    service: 'deep',
    prompt:
      'High-end interior photo of a sparkling luxury bathroom after a deep clean, crystal-clear frameless glass shower, gleaming chrome fixtures, pristine white tile grout, neatly folded plush white towels, sunlit airy atmosphere, photorealistic Meta ad creative, no text.',
  },
  {
    label: 'Airbnb Guest-Ready Living Room',
    service: 'airbnb',
    prompt:
      'Bright inviting short-term rental living room in Edmonton freshly detailed for 5-star guest arrival, fluffed sofa cushions, spotless coffee table, vacuumed rug lines, warm afternoon sunlight streaming through windows, editorial commercial photography, no text.',
  },
  {
    label: 'Tidyups Mascot Featured Promo',
    service: 'standard',
    prompt:
      'Vibrant commercial cleaning advertisement featuring the cute white cartoon Tidyups bunny mascot with pink inner ears holding a sparkling purple-and-pink feather duster standing proudly inside a gleaming sunlit modern Canadian kitchen, crisp sparkle highlights, royal purple and magenta brand accents.',
  },
  {
    label: 'Modern Office Commercial Clean',
    service: 'commercial',
    prompt:
      'Sleek modern Edmonton business office lobby and glass conference room gleaming after evening commercial janitorial service, sanitized desks, streak-free glass partitions, polished floors, crisp architectural lighting, commercial photography, no text.',
  },
];

export const ImageCreatorPage: React.FC<ImageCreatorPageProps> = ({
  user,
  accessToken,
  onSignIn,
  settings,
  ads,
  portfolioAssets,
  initialPrompt,
  initialTitle,
  onDeleteAsset,
  onStatus,
  status,
}) => {
  const [title, setTitle] = useState<string>(
    initialTitle || `${SERVICE_DATA[settings.service].name} Ad Visual`
  );
  const [serviceTag, setServiceTag] = useState<ServiceKey>(settings.service);
  const [aspectRatio, setAspectRatio] = useState<CreativeAspectRatio>(settings.format);
  const [quality, setQuality] = useState<'fast' | 'hd'>('hd');
  const [imageSize, setImageSize] = useState<'1K' | '2K'>('1K');
  const [useMascotReference, setUseMascotReference] = useState<boolean>(false);
  const [selectedMascotId, setSelectedMascotId] = useState<string>('tidyups-light');
  const [stampCornerBadge, setStampCornerBadge] = useState<boolean>(false);

  const [prompt, setPrompt] = useState<string>(
    initialPrompt || ads[0]?.image_prompt || SCENE_PRESETS[0].prompt
  );

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
    if (initialTitle) {
      setTitle(initialTitle);
    }
  }, [initialPrompt, initialTitle]);
  const [editInstruction, setEditInstruction] = useState<string>('');

  // Active stage state
  const [activeImageUrl, setActiveImageUrl] = useState<string>('');
  const [activeModelUsed, setActiveModelUsed] = useState<string>('gemini-nano-banana-2.1');
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [busyState, setBusyState] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all');

  const imagePortfolio = portfolioAssets.filter(
    (item) =>
      item.category === 'ad-image' &&
      (portfolioFilter === 'all' || item.service === portfolioFilter)
  );

  const composeWithOptionalBadge = async (sourceDataUrl: string): Promise<string> => {
    if (!stampCornerBadge) return sourceDataUrl;
    const mascotRef =
      OFFICIAL_MASCOT_REFERENCES.find((m) => m.id === selectedMascotId) ||
      OFFICIAL_MASCOT_REFERENCES[0];

    return new Promise((resolve) => {
      const baseImg = new Image();
      baseImg.crossOrigin = 'anonymous';
      baseImg.onload = () => {
        const badgeImg = new Image();
        badgeImg.crossOrigin = 'anonymous';
        badgeImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = baseImg.width;
          canvas.height = baseImg.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(sourceDataUrl);
            return;
          }
          ctx.drawImage(baseImg, 0, 0);
          const badgeSize = Math.round(Math.min(baseImg.width, baseImg.height) * 0.2);
          const pad = Math.round(badgeSize * 0.16);
          const x = baseImg.width - badgeSize - pad;
          const y = baseImg.height - badgeSize - pad;

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x - 6, y - 6, badgeSize + 12, badgeSize + 12, 18);
          ctx.fillStyle = mascotRef.surface === 'dark' ? 'rgba(18, 12, 30, 0.92)' : 'rgba(255, 255, 255, 0.94)';
          ctx.fill();
          ctx.drawImage(badgeImg, x, y, badgeSize, badgeSize);
          ctx.restore();
          resolve(canvas.toDataURL('image/png'));
        };
        badgeImg.onerror = () => resolve(sourceDataUrl);
        badgeImg.src = mascotRef.src;
      };
      baseImg.onerror = () => resolve(sourceDataUrl);
      baseImg.src = sourceDataUrl;
    });
  };

  const handleGenerateImage = async (isIterativeEdit = false) => {
    const effectivePrompt = isIterativeEdit ? editInstruction.trim() : prompt.trim();
    if (!effectivePrompt) {
      onStatus(
        isIterativeEdit
          ? 'Enter an edit instruction to refine the current image.'
          : 'Enter an image description first.'
      );
      return;
    }

    setBusyState(isIterativeEdit ? 'edit' : 'generate');
    onStatus(
      isIterativeEdit
        ? 'Applying AI image edit…'
        : `Generating ${aspectRatio} ad visual with ${
            quality === 'hd' ? 'Gemini Nano Banana 2.1 (HD)' : 'Gemini Flash Lite Image'
          }…`
    );

    try {
      let referenceImageBase64: string | undefined;
      let referenceMimeType: string | undefined;

      if (isIterativeEdit && activeImageUrl) {
        const parsed = await assetUrlToBase64(activeImageUrl);
        referenceImageBase64 = parsed.base64;
        referenceMimeType = parsed.mimeType;
      } else if (useMascotReference) {
        const chosenMascot =
          OFFICIAL_MASCOT_REFERENCES.find((m) => m.id === selectedMascotId) ||
          OFFICIAL_MASCOT_REFERENCES[0];
        const parsed = await assetUrlToBase64(chosenMascot.src);
        referenceImageBase64 = parsed.base64;
        referenceMimeType = parsed.mimeType;
      }

      const generated = await generateStudioImage({
        prompt: effectivePrompt,
        aspectRatio,
        quality,
        imageSize,
        referenceImageBase64,
        referenceMimeType,
      });

      const finalDataUrl = await composeWithOptionalBadge(generated.imageDataUrl);
      setActiveImageUrl(finalDataUrl);
      setActiveModelUsed(generated.modelUsed);
      setActiveSavedId(null);
      if (isIterativeEdit) {
        setEditInstruction('');
      }
      onStatus(`Generated crisp ${aspectRatio} ad creative.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStatus(msg);
    } finally {
      setBusyState(null);
    }
  };

  const handleSaveToPortfolio = async (alsoBackupToDrive = false) => {
    if (!activeImageUrl) {
      onStatus('Generate an ad image first before saving to your portfolio.');
      return;
    }
    let token = accessToken;
    if (!user || (alsoBackupToDrive && !token)) {
      token = await onSignIn();
      if (!token && !user) return;
    }

    setBusyState(alsoBackupToDrive ? 'save-drive' : 'save-portfolio');
    onStatus(
      alsoBackupToDrive
        ? 'Saving creative to Firestore portfolio & uploading full-res PNG to Google Drive…'
        : 'Saving creative to Firestore portfolio…'
    );

    try {
      const previewDataUrl = await compressImageToThumbnail(activeImageUrl, 360, 0.7);
      let driveFileId = '';
      let driveWebViewLink = '';

      if (alsoBackupToDrive && token) {
        const folder = await ensurePortfolioDriveFolder(token, 'Tidyups Creative Portfolio');
        const slug = (title || 'ad-visual')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
        const uploaded = await uploadBase64MediaToDrive(
          token,
          `tidyups-${slug}-${Date.now()}.png`,
          activeImageUrl,
          folder.id
        );
        driveFileId = uploaded.id;
        driveWebViewLink =
          uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      }

      const assetId = await saveCreativeAssetToFirestore({
        category: 'ad-image',
        title: title.trim() || `${SERVICE_DATA[serviceTag].name} Ad Creative`,
        prompt,
        service: serviceTag,
        aspectRatio,
        modelUsed: activeModelUsed,
        previewDataUrl,
        driveFileId,
        driveWebViewLink,
      });

      await cacheFullMediaInBrowser(assetId, activeImageUrl);
      setActiveSavedId(assetId);
      onStatus(
        alsoBackupToDrive && driveFileId
          ? `Saved "${title}" to Firestore portfolio and backed up full-res PNG to Google Drive.`
          : `Saved "${title}" to your Firestore Image Portfolio.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStatus(`Failed to save image creative: ${msg}`);
    } finally {
      setBusyState(null);
    }
  };

  const handleBackupExistingPortfolioItemToDrive = async (item: CreativeAsset) => {
    const token = accessToken ?? (await onSignIn());
    if (!token) return;
    setBusyState(`drive-${item.id}`);
    onStatus(`Uploading "${item.title}" to Google Drive…`);
    try {
      const cachedFull = (await getCachedFullMediaFromBrowser(item.id)) || item.previewDataUrl;
      if (!cachedFull) {
        onStatus('No image data available to upload for this item.');
        return;
      }
      const folder = await ensurePortfolioDriveFolder(token, 'Tidyups Creative Portfolio');
      const slug = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      const uploaded = await uploadBase64MediaToDrive(
        token,
        `tidyups-${slug || 'image'}.png`,
        cachedFull,
        folder.id
      );
      const webLink =
        uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      await attachDriveBackupToCreativeAsset(item.id, item.title, uploaded.id, webLink);
      onStatus(`Backed up "${item.title}" to Google Drive.`);
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyState(null);
    }
  };

  const handleLoadPortfolioItemToStage = async (item: CreativeAsset) => {
    const full = (await getCachedFullMediaFromBrowser(item.id)) || item.previewDataUrl;
    setTitle(item.title);
    if (item.service !== 'brand') {
      setServiceTag(item.service);
    }
    setAspectRatio(item.aspectRatio);
    setPrompt(item.prompt);
    setActiveImageUrl(full);
    setActiveModelUsed(item.modelUsed);
    setActiveSavedId(item.id);
    onStatus(`Loaded "${item.title}" onto the Image Creator stage.`);
  };

  const inputClass =
    'w-full p-3 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-sm text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Controls */}
        <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-[#241436] dark:text-slate-100 mb-1">
            AI Image Ad Creator
          </h2>
          <p className="text-xs text-[#6c6277] dark:text-slate-400 leading-relaxed mb-4">
            Generate scroll-stopping Facebook &amp; Instagram cleaning visuals, composite your Tidyups bunny mascot, and store every creative in your Firestore portfolio.
          </p>

          <label
            htmlFor="img-title"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
          >
            Creative title
          </label>
          <input
            id="img-title"
            value={title}
            maxLength={BLUEPRINT_LIMITS.assetTitleMax}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Move-Out Kitchen Hero"
            className={inputClass}
          />

          <div className="grid grid-cols-2 gap-3 mt-3.5">
            <div>
              <label
                htmlFor="img-service"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Service tag
              </label>
              <select
                id="img-service"
                value={serviceTag}
                onChange={(e) => setServiceTag(e.target.value as ServiceKey)}
                className={inputClass}
              >
                {(Object.keys(SERVICE_DATA) as ServiceKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SERVICE_DATA[key].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="img-ratio"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Aspect ratio
              </label>
              <select
                id="img-ratio"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as CreativeAspectRatio)}
                className={`${inputClass} tabular-nums`}
              >
                <option value="1:1">Square 1:1</option>
                <option value="4:5">Feed 4:5 (3:4)</option>
                <option value="9:16">Story / Reel 9:16</option>
                <option value="16:9">Landscape 16:9</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3.5">
            <div>
              <label
                htmlFor="img-quality"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Model tier
              </label>
              <select
                id="img-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as 'fast' | 'hd')}
                className={inputClass}
              >
                <option value="hd">HD (Nano Banana 2.1)</option>
                <option value="fast">Fast (Flash Lite)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="img-size"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Output resolution
              </label>
              <select
                id="img-size"
                value={imageSize}
                disabled={quality === 'fast'}
                onChange={(e) => setImageSize(e.target.value as '1K' | '2K')}
                className={`${inputClass} tabular-nums disabled:opacity-50`}
              >
                <option value="1K">1K Standard</option>
                <option value="2K">2K High-Res</option>
              </select>
            </div>
          </div>

          {/* Quick Scene Presets or Campaign Ad Prompts */}
          <div className="mt-4">
            <div className="text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5">
              Quick scene templates
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SCENE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setTitle(preset.label);
                    setServiceTag(preset.service);
                    setPrompt(preset.prompt);
                    if (preset.label.includes('Mascot')) {
                      setUseMascotReference(true);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-[#faf8fd] dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#f4e9fa] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {ads.length > 0 && (
            <div className="mt-3.5">
              <label
                htmlFor="campaign-prompt-pick"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Load prompt from current campaign ads
              </label>
              <select
                id="campaign-prompt-pick"
                defaultValue=""
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const chosen = ads[idx];
                  if (chosen) {
                    setTitle(`Ad ${chosen.number} — ${chosen.headline}`);
                    setAspectRatio(chosen.format);
                    setPrompt(chosen.image_prompt);
                  }
                }}
                className={inputClass}
              >
                <option value="" disabled>
                  Select an ad variation prompt…
                </option>
                {ads.map((ad, idx) => (
                  <option key={idx} value={idx}>
                    Ad {ad.number}: {ad.headline}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label
            htmlFor="img-prompt"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Image generation prompt
          </label>
          <textarea
            id="img-prompt"
            value={prompt}
            maxLength={BLUEPRINT_LIMITS.promptMax}
            onChange={(e) => setPrompt(e.target.value)}
            className={`${inputClass} min-h-[110px] resize-y`}
          />

          {/* Mascot Reference & Badge Options */}
          <div className="mt-3.5 pt-3.5 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#241436] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={useMascotReference}
                onChange={(e) => setUseMascotReference(e.target.checked)}
                className="rounded accent-[#5c28a1]"
              />
              Guide AI with official Tidyups Bunny Mascot reference
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#241436] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={stampCornerBadge}
                onChange={(e) => setStampCornerBadge(e.target.checked)}
                className="rounded accent-[#5c28a1]"
              />
              Stamp Tidyups logo badge in bottom-right corner
            </label>

            {(useMascotReference || stampCornerBadge) && (
              <select
                value={selectedMascotId}
                onChange={(e) => setSelectedMascotId(e.target.value)}
                aria-label="Select Tidyups reference logo"
                className={inputClass}
              >
                {OFFICIAL_MASCOT_REFERENCES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            disabled={busyState !== null}
            onClick={() => {
              void handleGenerateImage(false);
            }}
            className="w-full mt-4 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {busyState === 'generate' ? 'Generating Ad Visual…' : 'Generate Ad Image'}
          </button>
        </section>

        {/* Right Stage & Iterative Editor */}
        <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e8e1ef] dark:border-[#2d2342]">
            <div>
              <h3 className="text-base font-bold text-[#241436] dark:text-slate-100 m-0">
                Creative Stage
              </h3>
              <p aria-live="polite" className="text-xs text-[#56249a] dark:text-[#c084fc] mt-0.5 mb-0">
                {status}
              </p>
            </div>

            {activeImageUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    triggerDataUrlDownload(
                      activeImageUrl,
                      `${(title || 'tidyups-ad').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </button>

                <button
                  type="button"
                  disabled={busyState !== null}
                  onClick={() => {
                    void handleSaveToPortfolio(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {busyState === 'save-portfolio'
                    ? 'Saving…'
                    : activeSavedId
                    ? 'Saved in Portfolio'
                    : 'Save to Portfolio'}
                </button>

                <button
                  type="button"
                  disabled={busyState !== null}
                  onClick={() => {
                    void handleSaveToPortfolio(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#047857] dark:bg-[#059669] hover:bg-[#065f46] text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  {busyState === 'save-drive' ? 'Uploading…' : 'Save + Drive PNG'}
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 min-h-[380px] rounded-2xl bg-[#f4effa] dark:bg-[#110c1c] border border-[#e8e1ef] dark:border-[#2d2342] grid place-items-center p-4 overflow-hidden">
            {busyState === 'generate' || busyState === 'edit' ? (
              <div className="text-center py-16 px-4">
                <RefreshCw className="w-8 h-8 text-[#56249a] dark:text-[#c084fc] animate-spin mx-auto mb-3" />
                <div className="text-sm font-bold text-[#241436] dark:text-slate-100">
                  Rendering high-contrast cleaning ad visual…
                </div>
                <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-1">
                  Formatting {aspectRatio} frame with Tidyups studio lighting
                </div>
              </div>
            ) : activeImageUrl ? (
              <img
                src={activeImageUrl}
                alt={title}
                referrerPolicy="no-referrer"
                className="max-h-[520px] w-auto max-w-full rounded-xl object-contain"
              />
            ) : (
              <div className="text-center py-16 px-6 max-w-md">
                <ImageIcon className="w-10 h-10 text-[#8b7e99] dark:text-slate-500 mx-auto mb-3" />
                <div className="text-sm font-bold text-[#241436] dark:text-slate-200">
                  No ad visual generated yet
                </div>
                <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-1 mb-0 leading-relaxed">
                  Pick a cleaning scene template on the left or load one of your campaign prompts, then click <b>Generate Ad Image</b>.
                </p>
              </div>
            )}
          </div>

          {activeImageUrl && (
            <div className="mt-4 pt-4 border-t border-[#e8e1ef] dark:border-[#2d2342] flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="Refine this image with AI (e.g., Add sunlight beams across the island, add fresh purple tulips)…"
                className="flex-1 min-w-[220px] p-2.5 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-xs text-[#241436] dark:text-slate-100"
              />
              <button
                type="button"
                disabled={busyState !== null || !editInstruction.trim()}
                onClick={() => {
                  void handleGenerateImage(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Apply AI Edit
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Firestore Image Portfolio */}
      <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#e8e1ef] dark:border-[#2d2342]">
          <div>
            <h2 className="text-base font-bold text-[#241436] dark:text-slate-100 m-0">
              Firestore Image Ad Portfolio ({imagePortfolio.length})
            </h2>
            <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 mb-0">
              {user
                ? 'Synced across sessions in Firebase Firestore with optional full-resolution PNG backup in Google Drive.'
                : 'Sign in with Google to save and view your persistent Firestore image portfolio.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#f4effa] dark:bg-[#110c1c]">
            <button
              type="button"
              onClick={() => setPortfolioFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                portfolioFilter === 'all'
                  ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                  : 'text-[#6c6277] dark:text-slate-400'
              }`}
            >
              All Services
            </button>
            {(['moveout', 'deep', 'standard', 'airbnb', 'commercial'] as ServiceKey[]).map(
              (srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => setPortfolioFilter(srv)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    portfolioFilter === srv
                      ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                      : 'text-[#6c6277] dark:text-slate-400'
                  }`}
                >
                  {SERVICE_DATA[srv].name.split(' ')[0]}
                </button>
              )
            )}
          </div>
        </div>

        {!user ? (
          <div className="py-8 text-center">
            <button
              type="button"
              onClick={() => {
                void onSignIn();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign in with Google to Enable Firestore Portfolio
            </button>
          </div>
        ) : imagePortfolio.length === 0 ? (
          <p className="text-xs text-[#6c6277] dark:text-slate-400 py-6 text-center m-0">
            No saved ad images in this view yet. Generate an image above and click <b>Save to Portfolio</b>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {imagePortfolio.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden bg-[#faf8fd] dark:bg-[#140e21] flex flex-col"
              >
                <div className="aspect-square w-full bg-[#f0eaf7] dark:bg-[#100b1a] grid place-items-center overflow-hidden border-b border-[#e8e1ef] dark:border-[#2d2342]">
                  {item.previewDataUrl ? (
                    <img
                      src={item.previewDataUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Layers className="w-8 h-8 text-[#8b7e99]" />
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#6c6277] dark:text-slate-400 tabular-nums">
                      {item.aspectRatio} ·{' '}
                      {item.service === 'brand'
                        ? 'Brand'
                        : SERVICE_DATA[item.service]?.name ?? item.service}
                    </div>
                    <h3 className="text-sm font-bold text-[#241436] dark:text-slate-100 mt-0.5 mb-1 truncate">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#6c6277] dark:text-slate-400 line-clamp-2 m-0">
                      {item.prompt}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#e8e1ef] dark:border-[#2d2342]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          void handleLoadPortfolioItemToStage(item);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#f4e9fa] dark:bg-[#241b38] text-[#56249a] dark:text-[#d8b4fe] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Load
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(item.prompt);
                          setCopiedId(item.id);
                          setTimeout(
                            () => setCopiedId((prev) => (prev === item.id ? null : prev)),
                            1500
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Prompt
                      </button>

                      {item.driveWebViewLink ? (
                        <a
                          href={item.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#047857] dark:text-[#34d399] underline whitespace-nowrap shrink-0"
                        >
                          Drive
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={busyState !== null}
                          onClick={() => {
                            void handleBackupExistingPortfolioItemToDrive(item);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-semibold text-[#047857] dark:text-[#34d399] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {busyState === `drive-${item.id}` ? '…' : '+ Drive'}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteAsset(item)}
                      aria-label={`Delete ${item.title}`}
                      className="p-1.5 rounded-lg text-[#6c6277] dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
