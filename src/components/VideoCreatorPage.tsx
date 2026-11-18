import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Film,
  HardDrive,
  Image as ImageIcon,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import {
  assetUrlToBase64,
  cacheFullMediaInBrowser,
  captureVideoPosterThumbnail,
  generateStudioVideo,
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
  CreativeAsset,
  GeneratedAd,
  PendingConfirmation,
  ServiceKey,
} from '../types';
import { SERVICE_DATA } from '../utils/adGenerator';
import { OFFICIAL_MASCOT_REFERENCES } from './TidyupsLogo';

interface VideoCreatorPageProps {
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

type VideoCreationMode = 'text-to-video' | 'image-to-video';
type ImageSourceType = 'mascot' | 'portfolio' | 'upload';

const VIDEO_PRESETS: Array<{
  label: string;
  service: ServiceKey;
  aspectRatio: '9:16' | '16:9';
  mode: VideoCreationMode;
  prompt: string;
}> = [
  {
    label: 'Tidyups Bunny Mascot Intro',
    service: 'standard',
    aspectRatio: '9:16',
    mode: 'image-to-video',
    prompt:
      'Animate the cute white Tidyups bunny mascot waving its sparkling purple-and-pink feather duster playfully as shimmering violet and cyan clean sparkles swirl around a bright spotless modern Edmonton kitchen, smooth commercial studio motion, crisp lighting.',
  },
  {
    label: 'Move-Out Walkthrough Reveal',
    service: 'moveout',
    aspectRatio: '9:16',
    mode: 'text-to-video',
    prompt:
      'Smooth gimbal walkthrough reveal of an empty modern Edmonton home gleaming after a professional move-out cleaning: sunlit quartz kitchen island, spotless stainless oven interior, polished hardwood floors reflecting warm afternoon light, commercial Meta Reel quality.',
  },
  {
    label: 'Deep Clean Bathroom Shine',
    service: 'deep',
    aspectRatio: '9:16',
    mode: 'text-to-video',
    prompt:
      'Cinematic macro-to-wide commercial video of a luxury spa bathroom freshly deep cleaned, water droplets wiped from crystal-clear glass shower door, gleaming chrome faucet, pristine white tile grout, bright natural daylight.',
  },
  {
    label: '5-Star Airbnb Turnover Reel',
    service: 'airbnb',
    aspectRatio: '9:16',
    mode: 'text-to-video',
    prompt:
      'Inviting vertical Reel panning across a freshly staged Edmonton Airbnb living room and bedroom ready for guest check-in, crisp white duvet, fluffed pillows, spotless glass coffee table, warm golden sunlight.',
  },
  {
    label: 'Commercial Office Polish (16:9)',
    service: 'commercial',
    aspectRatio: '16:9',
    mode: 'text-to-video',
    prompt:
      'Wide architectural tracking shot through a sleek modern Edmonton corporate office lobby and glass boardroom gleaming after evening commercial cleaning service, streak-free glass walls, sanitized desks, polished floors.',
  },
];

export const VideoCreatorPage: React.FC<VideoCreatorPageProps> = ({
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
  const [mode, setMode] = useState<VideoCreationMode>('text-to-video');
  const [title, setTitle] = useState<string>(
    initialTitle || `${SERVICE_DATA[settings.service].name} Video Ad`
  );
  const [serviceTag, setServiceTag] = useState<ServiceKey>(settings.service);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>(
    settings.format === '16:9' ? '16:9' : '9:16'
  );
  const [duration, setDuration] = useState<'5s' | '8s' | '10s'>('8s');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [prompt, setPrompt] = useState<string>(
    initialPrompt || ads[0]?.video_script || VIDEO_PRESETS[1].prompt
  );

  // Image-to-video starting frame controls
  const [imageSourceType, setImageSourceType] = useState<ImageSourceType>('mascot');
  const [selectedMascotId, setSelectedMascotId] = useState<string>('tidyups-light');
  const [selectedPortfolioImageId, setSelectedPortfolioImageId] = useState<string>('');
  const [uploadedFrameDataUrl, setUploadedFrameDataUrl] = useState<string>('');
  const [uploadedFrameName, setUploadedFrameName] = useState<string>('');

  // Multi-turn extension / edit instruction
  const [extendInstruction, setExtendInstruction] = useState<string>('');

  // Active video stage state
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>('');
  const [activePosterUrl, setActivePosterUrl] = useState<string>('');
  const [activeInteractionId, setActiveInteractionId] = useState<string>('');
  const [activeModelUsed, setActiveModelUsed] = useState<string>('gemini-omni-1.2-flash');
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [busyState, setBusyState] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all');

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
    if (initialTitle) {
      setTitle(initialTitle);
    }
  }, [initialPrompt, initialTitle]);

  useEffect(() => {
    if (busyState !== 'generate' && busyState !== 'extend') {
      setElapsedSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busyState]);

  const savedImagesForAnimation = portfolioAssets.filter(
    (item) =>
      (item.category === 'ad-image' ||
        item.category === 'brand-logo' ||
        item.category === 'brand-icon') &&
      Boolean(item.previewDataUrl)
  );

  const videoPortfolio = portfolioAssets.filter(
    (item) =>
      item.category === 'video-ad' &&
      (portfolioFilter === 'all' || item.service === portfolioFilter)
  );

  const handleUploadLocalFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setUploadedFrameDataUrl(reader.result);
        setUploadedFrameName(file.name);
        onStatus(`Loaded starting frame "${file.name}".`);
      }
    };
    reader.readAsDataURL(file);
  };

  const resolveReferenceFrame = async (): Promise<{
    base64?: string;
    mimeType?: string;
  }> => {
    if (mode !== 'image-to-video') {
      return {};
    }
    if (imageSourceType === 'mascot') {
      const chosen =
        OFFICIAL_MASCOT_REFERENCES.find((m) => m.id === selectedMascotId) ||
        OFFICIAL_MASCOT_REFERENCES[0];
      const parsed = await assetUrlToBase64(chosen.src);
      return { base64: parsed.base64, mimeType: parsed.mimeType };
    }
    if (imageSourceType === 'portfolio') {
      const target =
        savedImagesForAnimation.find((img) => img.id === selectedPortfolioImageId) ||
        savedImagesForAnimation[0];
      if (!target) {
        throw new Error('Select a saved image from your portfolio or switch to Mascot reference.');
      }
      const cachedFull =
        (await getCachedFullMediaFromBrowser(target.id)) || target.previewDataUrl;
      const parsed = await assetUrlToBase64(cachedFull);
      return { base64: parsed.base64, mimeType: parsed.mimeType };
    }
    if (!uploadedFrameDataUrl) {
      throw new Error('Choose an image file from your device to animate.');
    }
    const parsed = await assetUrlToBase64(uploadedFrameDataUrl);
    return { base64: parsed.base64, mimeType: parsed.mimeType };
  };

  const handleGenerateVideo = async (isExtensionTurn = false) => {
    const effectivePrompt = isExtensionTurn ? extendInstruction.trim() : prompt.trim();
    if (!effectivePrompt) {
      onStatus(
        isExtensionTurn
          ? 'Describe how the video scene should continue or change.'
          : 'Enter a video commercial prompt or script first.'
      );
      return;
    }

    setBusyState(isExtensionTurn ? 'extend' : 'generate');
    onStatus(
      isExtensionTurn
        ? 'Extending / editing video clip with Gemini Omni 1.2 Flash…'
        : `Rendering ${duration} ${aspectRatio} (${resolution}) video ad with Gemini Omni 1.2 Flash…`
    );

    try {
      const refFrame = isExtensionTurn ? {} : await resolveReferenceFrame();
      const result = await generateStudioVideo({
        prompt: effectivePrompt,
        aspectRatio,
        duration,
        resolution,
        referenceImageBase64: refFrame.base64,
        referenceMimeType: refFrame.mimeType,
        previousInteractionId:
          isExtensionTurn && activeInteractionId ? activeInteractionId : undefined,
      });

      const poster = await captureVideoPosterThumbnail(result.videoDataUrl, 360);
      setActiveVideoUrl(result.videoDataUrl);
      setActivePosterUrl(poster);
      setActiveInteractionId(result.interactionId);
      setActiveModelUsed(result.modelUsed);
      setActiveSavedId(null);
      if (isExtensionTurn) {
        setExtendInstruction('');
      }
      onStatus(`Generated ${duration} ${aspectRatio} MP4 video commercial.`);
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyState(null);
    }
  };

  const handleSaveVideoToPortfolio = async (alsoBackupToDrive = false) => {
    if (!activeVideoUrl) {
      onStatus('Generate a video commercial first before saving to your portfolio.');
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
        ? 'Saving video poster & metadata to Firestore and uploading MP4 to Google Drive…'
        : 'Saving video ad to Firestore portfolio…'
    );

    try {
      const posterThumb =
        activePosterUrl || (await captureVideoPosterThumbnail(activeVideoUrl, 360));
      let driveFileId = '';
      let driveWebViewLink = '';

      if (alsoBackupToDrive && token) {
        const folder = await ensurePortfolioDriveFolder(token, 'Tidyups Creative Portfolio');
        const slug = (title || 'video-ad')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
        const uploaded = await uploadBase64MediaToDrive(
          token,
          `tidyups-${slug}-${Date.now()}.mp4`,
          activeVideoUrl,
          folder.id
        );
        driveFileId = uploaded.id;
        driveWebViewLink =
          uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      }

      const assetId = await saveCreativeAssetToFirestore({
        category: 'video-ad',
        title: title.trim() || `${SERVICE_DATA[serviceTag].name} Video Ad`,
        prompt,
        service: serviceTag,
        aspectRatio,
        modelUsed: activeModelUsed,
        previewDataUrl: posterThumb,
        durationLabel: `${duration} · ${resolution}`,
        interactionId: activeInteractionId,
        driveFileId,
        driveWebViewLink,
      });

      await cacheFullMediaInBrowser(assetId, activeVideoUrl);
      setActiveSavedId(assetId);
      onStatus(
        alsoBackupToDrive && driveFileId
          ? `Saved "${title}" to Firestore portfolio and backed up full MP4 to Google Drive.`
          : `Saved "${title}" to your Firestore Video Ad Portfolio.`
      );
    } catch (err) {
      onStatus(
        `Failed to save video ad: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setBusyState(null);
    }
  };

  const handleBackupPortfolioVideoToDrive = async (item: CreativeAsset) => {
    const cachedMp4 = await getCachedFullMediaFromBrowser(item.id);
    if (!cachedMp4) {
      onStatus(
        'Full MP4 is not cached in this browser session. Generate or open from the device where it was created to upload to Drive.'
      );
      return;
    }

    const token = accessToken ?? (await onSignIn());
    if (!token) return;

    setBusyState(`drive-${item.id}`);
    onStatus(`Uploading MP4 "${item.title}" to Google Drive…`);
    try {
      const folder = await ensurePortfolioDriveFolder(token, 'Tidyups Creative Portfolio');
      const slug = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      const uploaded = await uploadBase64MediaToDrive(
        token,
        `tidyups-${slug || 'video-ad'}.mp4`,
        cachedMp4,
        folder.id
      );
      const webLink =
        uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      await attachDriveBackupToCreativeAsset(item.id, item.title, uploaded.id, webLink);
      onStatus(`Backed up MP4 "${item.title}" to Google Drive.`);
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyState(null);
    }
  };

  const handleLoadPortfolioVideo = async (item: CreativeAsset) => {
    setTitle(item.title);
    if (item.service !== 'brand') {
      setServiceTag(item.service);
    }
    setAspectRatio(item.aspectRatio === '16:9' ? '16:9' : '9:16');
    setPrompt(item.prompt);
    setActivePosterUrl(item.previewDataUrl);
    setActiveInteractionId(item.interactionId);
    setActiveModelUsed(item.modelUsed);
    setActiveSavedId(item.id);

    const cachedMp4 = await getCachedFullMediaFromBrowser(item.id);
    if (cachedMp4) {
      setActiveVideoUrl(cachedMp4);
      onStatus(`Loaded "${item.title}" MP4 onto the Video Ad stage.`);
    } else {
      setActiveVideoUrl('');
      onStatus(
        item.driveWebViewLink
          ? `Loaded "${item.title}" metadata. Click Open Drive MP4 to stream from Google Drive.`
          : `Loaded "${item.title}" prompt & poster. Click Generate Video Ad to re-render MP4.`
      );
    }
  };

  const inputClass =
    'w-full p-3 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-sm text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Controls */}
        <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-[#241436] dark:text-slate-100 mb-1">
            AI Video Ad Creator
          </h2>
          <p className="text-xs text-[#6c6277] dark:text-slate-400 leading-relaxed mb-4">
            Produce vertical Reels, Stories, and landscape Facebook video commercials—or animate your Tidyups bunny mascot—with Firestore portfolio storage and Google Drive MP4 backup.
          </p>

          {/* Segmented Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#f4effa] dark:bg-[#110c1c] mb-4">
            <button
              type="button"
              onClick={() => setMode('text-to-video')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'text-to-video'
                  ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                  : 'text-[#6c6277] dark:text-slate-400'
              }`}
            >
              Text-to-Video Ad
            </button>
            <button
              type="button"
              onClick={() => setMode('image-to-video')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'image-to-video'
                  ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                  : 'text-[#6c6277] dark:text-slate-400'
              }`}
            >
              Animate Mascot / Image
            </button>
          </div>

          <label
            htmlFor="vid-title"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
          >
            Video ad title
          </label>
          <input
            id="vid-title"
            value={title}
            maxLength={BLUEPRINT_LIMITS.assetTitleMax}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Move-Out Reel — Edmonton"
            className={inputClass}
          />

          <div className="grid grid-cols-2 gap-3 mt-3.5">
            <div>
              <label
                htmlFor="vid-service"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Service tag
              </label>
              <select
                id="vid-service"
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
                htmlFor="vid-ratio"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Placement ratio
              </label>
              <select
                id="vid-ratio"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as '9:16' | '16:9')}
                className={`${inputClass} tabular-nums`}
              >
                <option value="9:16">Reel / Story 9:16</option>
                <option value="16:9">Landscape Feed 16:9</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3.5">
            <div>
              <label
                htmlFor="vid-duration"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Clip duration
              </label>
              <select
                id="vid-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value as '5s' | '8s' | '10s')}
                className={`${inputClass} tabular-nums`}
              >
                <option value="5s">5 seconds (Bumper)</option>
                <option value="8s">8 seconds (Reel)</option>
                <option value="10s">10 seconds (Full Ad)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="vid-res"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Resolution
              </label>
              <select
                id="vid-res"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                className={`${inputClass} tabular-nums`}
              >
                <option value="720p">720p HD Fast</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>
          </div>

          {/* Starting Frame Selector for Image-to-Video */}
          {mode === 'image-to-video' && (
            <div className="mt-4 pt-3.5 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-2.5">
              <div className="text-xs font-bold text-[#241436] dark:text-slate-200">
                Starting frame to animate
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setImageSourceType('mascot')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                    imageSourceType === 'mascot'
                      ? 'bg-[#5c28a1] text-white'
                      : 'border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe]'
                  }`}
                >
                  Official Mascot Logo
                </button>
                <button
                  type="button"
                  onClick={() => setImageSourceType('portfolio')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                    imageSourceType === 'portfolio'
                      ? 'bg-[#5c28a1] text-white'
                      : 'border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe]'
                  }`}
                >
                  Saved Portfolio ({savedImagesForAnimation.length})
                </button>
                <button
                  type="button"
                  onClick={() => setImageSourceType('upload')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                    imageSourceType === 'upload'
                      ? 'bg-[#5c28a1] text-white'
                      : 'border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe]'
                  }`}
                >
                  Upload Image
                </button>
              </div>

              {imageSourceType === 'mascot' && (
                <select
                  value={selectedMascotId}
                  onChange={(e) => setSelectedMascotId(e.target.value)}
                  aria-label="Select Tidyups mascot logo to animate"
                  className={inputClass}
                >
                  {OFFICIAL_MASCOT_REFERENCES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              )}

              {imageSourceType === 'portfolio' && (
                <select
                  value={selectedPortfolioImageId}
                  onChange={(e) => setSelectedPortfolioImageId(e.target.value)}
                  aria-label="Select saved portfolio image to animate"
                  className={inputClass}
                >
                  {savedImagesForAnimation.length === 0 ? (
                    <option value="">No saved portfolio images yet</option>
                  ) : (
                    savedImagesForAnimation.map((img) => (
                      <option key={img.id} value={img.id}>
                        {img.title} ({img.aspectRatio})
                      </option>
                    ))
                  )}
                </select>
              )}

              {imageSourceType === 'upload' && (
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#c5b3da] dark:border-[#413261] bg-[#faf8fd] dark:bg-[#120d1d] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="truncate">
                    {uploadedFrameName || 'Choose PNG or JPG photo…'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadLocalFrame}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Video Commercial Presets */}
          <div className="mt-4">
            <div className="text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5">
              Commercial storyboard presets
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VIDEO_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setTitle(preset.label);
                    setServiceTag(preset.service);
                    setAspectRatio(preset.aspectRatio);
                    setMode(preset.mode);
                    setPrompt(preset.prompt);
                    if (preset.mode === 'image-to-video') {
                      setImageSourceType('mascot');
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
                htmlFor="vid-campaign-script"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Load 10s script from campaign ads
              </label>
              <select
                id="vid-campaign-script"
                defaultValue=""
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const chosen = ads[idx];
                  if (chosen) {
                    setTitle(`Video Ad ${chosen.number} — ${chosen.headline}`);
                    setAspectRatio(chosen.format === '16:9' ? '16:9' : '9:16');
                    setDuration('10s');
                    setPrompt(chosen.video_script);
                  }
                }}
                className={inputClass}
              >
                <option value="" disabled>
                  Select a campaign video script…
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
            htmlFor="vid-prompt"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Motion prompt / commercial script
          </label>
          <textarea
            id="vid-prompt"
            value={prompt}
            maxLength={BLUEPRINT_LIMITS.promptMax}
            onChange={(e) => setPrompt(e.target.value)}
            className={`${inputClass} min-h-[115px] resize-y`}
          />

          <button
            type="button"
            disabled={busyState !== null}
            onClick={() => {
              void handleGenerateVideo(false);
            }}
            className="w-full mt-4 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {busyState === 'generate'
              ? `Rendering Video (${elapsedSeconds}s)…`
              : 'Generate Video Ad'}
          </button>
        </section>

        {/* Right Video Stage & Multi-turn Extension */}
        <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e8e1ef] dark:border-[#2d2342]">
            <div>
              <h3 className="text-base font-bold text-[#241436] dark:text-slate-100 m-0">
                Video Commercial Stage
              </h3>
              <p
                aria-live="polite"
                className="text-xs text-[#56249a] dark:text-[#c084fc] mt-0.5 mb-0"
              >
                {status}
              </p>
            </div>

            {activeVideoUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    triggerDataUrlDownload(
                      activeVideoUrl,
                      `${(title || 'tidyups-video-ad')
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')}.mp4`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download MP4
                </button>

                <button
                  type="button"
                  disabled={busyState !== null}
                  onClick={() => {
                    void handleSaveVideoToPortfolio(false);
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
                    void handleSaveVideoToPortfolio(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#047857] dark:bg-[#059669] hover:bg-[#065f46] text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  {busyState === 'save-drive' ? 'Uploading MP4…' : 'Save + Drive MP4'}
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 min-h-[410px] rounded-2xl bg-[#f4effa] dark:bg-[#110c1c] border border-[#e8e1ef] dark:border-[#2d2342] grid place-items-center p-4 overflow-hidden">
            {busyState === 'generate' || busyState === 'extend' ? (
              <div className="text-center py-16 px-6 max-w-md">
                <RefreshCw className="w-8 h-8 text-[#56249a] dark:text-[#c084fc] animate-spin mx-auto mb-3" />
                <div className="text-sm font-bold text-[#241436] dark:text-slate-100 tabular-nums">
                  Synthesizing {duration} {aspectRatio} MP4 video ({elapsedSeconds}s elapsed)…
                </div>
                <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-1.5 mb-0 leading-relaxed">
                  Gemini Omni 1.2 Flash is rendering motion frames at {resolution}. Video generation typically completes in 25–75 seconds.
                </p>
              </div>
            ) : activeVideoUrl ? (
              <video
                key={activeVideoUrl.slice(-36)}
                src={activeVideoUrl}
                poster={activePosterUrl || undefined}
                controls
                loop
                playsInline
                className="max-h-[520px] w-auto max-w-full rounded-xl bg-black"
              />
            ) : activePosterUrl ? (
              <div className="text-center space-y-3">
                <img
                  src={activePosterUrl}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="max-h-[380px] mx-auto rounded-xl object-contain"
                />
                <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0">
                  Poster preview loaded from Firestore. Click <b>Generate Video Ad</b> to render a fresh MP4 or open the linked Google Drive backup below.
                </p>
              </div>
            ) : (
              <div className="text-center py-16 px-6 max-w-md">
                <Film className="w-10 h-10 text-[#8b7e99] dark:text-slate-500 mx-auto mb-3" />
                <div className="text-sm font-bold text-[#241436] dark:text-slate-200">
                  Ready to produce your video commercial
                </div>
                <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-1 mb-0 leading-relaxed">
                  Select a commercial storyboard preset, load a 10-second script from your campaign ads, or switch to <b>Animate Mascot / Image</b> to bring your Tidyups bunny logo to life.
                </p>
              </div>
            )}
          </div>

          {activeInteractionId && (
            <div className="mt-4 pt-4 border-t border-[#e8e1ef] dark:border-[#2d2342] flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                value={extendInstruction}
                onChange={(e) => setExtendInstruction(e.target.value)}
                placeholder="Extend or edit this video clip (e.g., Continue scene panning into the spotless master bathroom)…"
                className="flex-1 min-w-[220px] p-2.5 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-xs text-[#241436] dark:text-slate-100"
              />
              <button
                type="button"
                disabled={busyState !== null || !extendInstruction.trim()}
                onClick={() => {
                  void handleGenerateVideo(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Extend / Edit Video
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Firestore Video Ad Portfolio */}
      <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#e8e1ef] dark:border-[#2d2342]">
          <div>
            <h2 className="text-base font-bold text-[#241436] dark:text-slate-100 m-0 tabular-nums">
              Firestore Video Ad Portfolio ({videoPortfolio.length})
            </h2>
            <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 mb-0">
              {user
                ? 'Stores poster frames, scripts & interaction IDs in Firestore, local MP4 playback cache, and 1-click Google Drive MP4 archiving.'
                : 'Sign in with Google to save and view your persistent Firestore video ad portfolio.'}
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
              All Videos
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
              Sign in with Google to Enable Firestore Video Portfolio
            </button>
          </div>
        ) : videoPortfolio.length === 0 ? (
          <p className="text-xs text-[#6c6277] dark:text-slate-400 py-6 text-center m-0">
            No saved video commercials yet. Generate a clip above and click <b>Save to Portfolio</b>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {videoPortfolio.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden bg-[#faf8fd] dark:bg-[#140e21] flex flex-col"
              >
                <div className="aspect-video w-full bg-[#120c1e] grid place-items-center overflow-hidden border-b border-[#e8e1ef] dark:border-[#2d2342] relative">
                  {item.previewDataUrl ? (
                    <img
                      src={item.previewDataUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end justify-between p-3">
                    <span className="text-xs font-bold text-white tabular-nums">
                      {item.durationLabel || item.aspectRatio}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadPortfolioVideo(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/95 text-[#241436] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      Play / Load
                    </button>
                  </div>
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
                        Script
                      </button>

                      {item.driveWebViewLink ? (
                        <a
                          href={item.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#047857] dark:text-[#34d399] underline whitespace-nowrap shrink-0"
                        >
                          Open Drive MP4
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={busyState !== null}
                          onClick={() => {
                            void handleBackupPortfolioVideoToDrive(item);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-semibold text-[#047857] dark:text-[#34d399] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {busyState === `drive-${item.id}` ? '…' : '+ Drive MP4'}
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
