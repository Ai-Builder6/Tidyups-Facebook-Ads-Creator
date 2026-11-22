import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Grid,
  HardDrive,
  Palette,
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
  downloadResizedPngIcon,
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
  CreativeAspectRatio,
  CreativeAsset,
  CreativeCategory,
  PendingConfirmation,
} from '../types';
import { triggerBrowserDownload } from '../utils/adGenerator';
import {
  buildTidyupsSvgLogo,
  OFFICIAL_MASCOT_REFERENCES,
  OfficialMascotReference,
  ThemeMode,
  TidyupsLogoLockup,
} from './TidyupsLogo';

interface LogoIconStudioPageProps {
  user: User | null;
  accessToken: string | null;
  onSignIn: () => Promise<string | null>;
  portfolioAssets: CreativeAsset[];
  onDeleteAsset: (asset: CreativeAsset) => void;
  onRequestConfirmation: (confirm: PendingConfirmation) => void;
  onStatus: (msg: string) => void;
  status: string;
}

type StudioTab = 'reference' | 'logo-creator' | 'icon-creator';
type BrandWordmarkChoice = 'tidyups' | 'bookmycleaning' | 'custom';

const LOGO_STYLE_PRESETS: Array<{
  label: string;
  aspectRatio: '1:1' | '16:9';
  surface: ThemeMode;
  styleInstruction: string;
}> = [
  {
    label: '3D Glossy Mascot Lockup',
    aspectRatio: '1:1',
    surface: 'light',
    styleInstruction:
      'Keep the cute glossy white Tidyups cartoon bunny mascot with pink inner ears, big purple eyes, cyan rim highlights, holding a purple-pink-cyan feather duster inside a cosmic purple-magenta sparkle circle with a purple house roofline and 4-pane window on the right, bold 3D white-to-hot-pink gradient italic lettering.',
  },
  {
    label: 'Dark Neon Midnight Emblem',
    aspectRatio: '1:1',
    surface: 'dark',
    styleInstruction:
      'Render on a rich dark midnight plum (#120C1E) background with luminous cyan-and-magenta rim lighting around the white Tidyups bunny mascot holding its feather duster, glowing 4-point stars, crisp white-and-pink 3D wordmark.',
  },
  {
    label: 'Wide Van / Cover Banner (16:9)',
    aspectRatio: '16:9',
    surface: 'light',
    styleInstruction:
      'Horizontal wide vehicle-wrap and Facebook cover banner composition: cute white Tidyups bunny mascot with feather duster on the left, clean house roofline accent and bold glossy purple-and-pink brand typography on the right, ultra-clean vector commercial finish.',
  },
  {
    label: 'Uniform Embroidery Crest',
    aspectRatio: '1:1',
    surface: 'dark',
    styleInstruction:
      'Circular stitched uniform patch crest featuring the white Tidyups bunny mascot with pink ears and feather duster inside a royal purple and magenta satin-stitch border, clean readable brand banner underneath.',
  },
  {
    label: 'Edmonton Seasonal Promo Logo',
    aspectRatio: '1:1',
    surface: 'light',
    styleInstruction:
      'Festive seasonal Edmonton home-reset edition of the Tidyups bunny mascot logo with subtle sparkling clean bubbles, fresh spring florals around the purple house roofline, crisp glossy brand typography.',
  },
];

const ICON_PRESETS: Array<{
  label: string;
  surface: ThemeMode;
  useBunnyRef: boolean;
  prompt: string;
}> = [
  {
    label: 'Tidyups Bunny App Avatar',
    surface: 'dark',
    useBunnyRef: true,
    prompt:
      'Square 1:1 app icon and social profile avatar featuring ONLY the cute glossy white Tidyups cartoon bunny mascot head and paws holding a sparkling purple-pink-cyan feather duster inside a vibrant royal-purple and magenta circle, crisp 4-point sparkles, ZERO text, no letters, centered icon design.',
  },
  {
    label: 'Move-Out Sparkling House Key',
    surface: 'light',
    useBunnyRef: false,
    prompt:
      'Crisp 3D glossy vector app icon of a gleaming silver house key and purple house roofline surrounded by bright pink and cyan clean sparkles on a clean white square icon background, Tidyups purple-and-pink brand palette, ZERO text, no words.',
  },
  {
    label: 'Feather Duster & Stars Badge',
    surface: 'dark',
    useBunnyRef: false,
    prompt:
      'Vibrant glossy 1:1 service icon of a royal-purple, hot-pink, and cyan feather duster sweeping across a sparkling star trail inside a deep plum rounded badge, high contrast, ZERO text, no letters.',
  },
  {
    label: 'Eco-Safe Cleaning Shield',
    surface: 'light',
    useBunnyRef: false,
    prompt:
      'Modern 1:1 vector icon of a glossy purple-and-pink protective home shield with a sparkling water droplet and leaf accent on a crisp white background, pet-friendly & family-safe cleaning symbol, ZERO text.',
  },
  {
    label: '5-Star Airbnb Turnover Icon',
    surface: 'dark',
    useBunnyRef: false,
    prompt:
      'Glossy 1:1 badge icon showing a sparkling modern home roofline crowned with five glowing magenta-and-gold stars on a dark violet background, short-term rental turnover excellence symbol, ZERO text.',
  },
];

export const LogoIconStudioPage: React.FC<LogoIconStudioPageProps> = ({
  user,
  accessToken,
  onSignIn,
  portfolioAssets,
  onDeleteAsset,
  onStatus,
  status,
}) => {
  const [studioTab, setStudioTab] = useState<StudioTab>('logo-creator');
  const [failedRefIds, setFailedRefIds] = useState<Record<string, boolean>>({});

  // Logo Creator controls
  const [brandChoice, setBrandChoice] = useState<BrandWordmarkChoice>('tidyups');
  const [customBrandText, setCustomBrandText] = useState<string>('Tidyups Cleaning Service Inc.');
  const [logoSurface, setLogoSurface] = useState<ThemeMode>('light');
  const [logoAspect, setLogoAspect] = useState<'1:1' | '16:9'>('1:1');
  const [logoQuality, setLogoQuality] = useState<'hd' | 'fast'>('hd');
  const [logoSize, setLogoSize] = useState<'1K' | '2K'>('1K');
  const [useOfficialMascotRef, setUseOfficialMascotRef] = useState<boolean>(true);
  const [selectedMascotRefId, setSelectedMascotRefId] = useState<string>('tidyups-light');
  const [logoTitle, setLogoTitle] = useState<string>('Tidyups Mascot Brand Logo');
  const [logoStylePrompt, setLogoStylePrompt] = useState<string>(
    LOGO_STYLE_PRESETS[0].styleInstruction
  );

  // Icon & Favicon Creator controls
  const [iconTitle, setIconTitle] = useState<string>('Tidyups Bunny Mascot Icon');
  const [iconSurface, setIconSurface] = useState<ThemeMode>('dark');
  const [useBunnyForIcon, setUseBunnyForIcon] = useState<boolean>(true);
  const [iconPrompt, setIconPrompt] = useState<string>(ICON_PRESETS[0].prompt);

  // Shared Stage & Refinement state
  const [stageCategory, setStageCategory] = useState<'brand-logo' | 'brand-icon'>('brand-logo');
  const [activeImageUrl, setActiveImageUrl] = useState<string>('');
  const [activeModelUsed, setActiveModelUsed] = useState<string>('gemini-nano-banana-2.1');
  const [activeAspect, setActiveAspect] = useState<CreativeAspectRatio>('1:1');
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState<string>('');
  const [busyState, setBusyState] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'brand-logo' | 'brand-icon'>('all');

  const brandPortfolio = portfolioAssets.filter(
    (item) =>
      (item.category === 'brand-logo' || item.category === 'brand-icon') &&
      (portfolioFilter === 'all' || item.category === portfolioFilter)
  );

  const buildFullLogoPrompt = (): string => {
    const wordmarkText =
      brandChoice === 'tidyups'
        ? '"Tidyups" with subtitle banner "Cleaning Service Inc."'
        : brandChoice === 'bookmycleaning'
        ? 'stacked "BookMyCleaning" above "Tidyups" with subtitle banner "— Cleaning Service Inc. —"'
        : `"${customBrandText.trim() || 'Tidyups'}"`;

    const bgClause =
      logoSurface === 'dark'
        ? 'isolated on a solid dark midnight plum (#120C1E) background'
        : 'isolated on a crisp pure white (#FFFFFF) background';

    return `Professional commercial brand logo lockup featuring exact text ${wordmarkText}, ${bgClause}. ${logoStylePrompt}`;
  };

  const handleUseReferenceInCreator = (ref: OfficialMascotReference) => {
    if (ref.id === 'tidyups-bunny-icon') {
      setStudioTab('icon-creator');
      setIconTitle(ref.title);
      setIconSurface(ref.surface);
      setUseBunnyForIcon(true);
      setActiveImageUrl(ref.src);
      setStageCategory('brand-icon');
      setActiveAspect('1:1');
      onStatus(`Loaded "${ref.title}" into the AI Icon & Favicon Creator.`);
      return;
    }
    setStudioTab('logo-creator');
    setSelectedMascotRefId(ref.id);
    setUseOfficialMascotRef(true);
    setLogoSurface(ref.surface);
    setBrandChoice(ref.lockupKind);
    setLogoTitle(`${ref.title} Variation`);
    setActiveImageUrl(ref.src);
    setStageCategory('brand-logo');
    setActiveAspect('1:1');
    onStatus(`Selected "${ref.title}" as your active AI Logo Creator reference.`);
  };

  const handleGenerateLogoOrIcon = async (
    targetKind: 'brand-logo' | 'brand-icon',
    isIterativeEdit = false
  ) => {
    const rawPrompt = isIterativeEdit
      ? editInstruction.trim()
      : targetKind === 'brand-logo'
      ? buildFullLogoPrompt()
      : iconPrompt.trim();

    if (!rawPrompt) {
      onStatus('Enter a design description first.');
      return;
    }

    setBusyState(isIterativeEdit ? 'edit' : 'generate');
    const chosenRatio: CreativeAspectRatio = targetKind === 'brand-icon' ? '1:1' : logoAspect;
    onStatus(
      isIterativeEdit
        ? 'Refining brand mark with Gemini…'
        : targetKind === 'brand-logo'
        ? `Generating ${chosenRatio} Tidyups brand logo…`
        : 'Generating crisp 1:1 brand icon / favicon…'
    );

    try {
      let referenceImageBase64: string | undefined;
      let referenceMimeType: string | undefined;

      if (isIterativeEdit && activeImageUrl) {
        const parsed = await assetUrlToBase64(activeImageUrl);
        referenceImageBase64 = parsed.base64;
        referenceMimeType = parsed.mimeType;
      } else if (targetKind === 'brand-logo' && useOfficialMascotRef) {
        const ref =
          OFFICIAL_MASCOT_REFERENCES.find((m) => m.id === selectedMascotRefId) ||
          OFFICIAL_MASCOT_REFERENCES[0];
        const parsed = await assetUrlToBase64(ref.src);
        referenceImageBase64 = parsed.base64;
        referenceMimeType = parsed.mimeType;
      } else if (targetKind === 'brand-icon' && useBunnyForIcon) {
        const bunnyRef =
          OFFICIAL_MASCOT_REFERENCES.find((m) => m.id === 'tidyups-bunny-icon') ||
          OFFICIAL_MASCOT_REFERENCES[0];
        const parsed = await assetUrlToBase64(bunnyRef.src);
        referenceImageBase64 = parsed.base64;
        referenceMimeType = parsed.mimeType;
      }

      const generated = await generateStudioImage({
        prompt: rawPrompt,
        aspectRatio: chosenRatio,
        quality: targetKind === 'brand-icon' ? 'hd' : logoQuality,
        imageSize: targetKind === 'brand-icon' ? '1K' : logoSize,
        referenceImageBase64,
        referenceMimeType,
      });

      setStageCategory(targetKind);
      setActiveImageUrl(generated.imageDataUrl);
      setActiveModelUsed(generated.modelUsed);
      setActiveAspect(chosenRatio);
      setActiveSavedId(null);
      if (isIterativeEdit) {
        setEditInstruction('');
      }
      onStatus(
        targetKind === 'brand-logo'
          ? 'Generated custom Tidyups logo concept.'
          : 'Generated 1:1 icon — ready for multi-size PNG export or Firestore portfolio save.'
      );
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyState(null);
    }
  };

  const handleSaveBrandAssetToPortfolio = async (alsoBackupToDrive = false) => {
    if (!activeImageUrl) {
      onStatus('Generate or load a logo/icon onto the stage first.');
      return;
    }

    let token = accessToken;
    if (!user || (alsoBackupToDrive && !token)) {
      token = await onSignIn();
      if (!token && !user) return;
    }

    const effectiveCategory: CreativeCategory = stageCategory;
    const effectiveTitle =
      effectiveCategory === 'brand-icon' ? iconTitle.trim() : logoTitle.trim();
    const effectivePrompt =
      effectiveCategory === 'brand-icon' ? iconPrompt.trim() : buildFullLogoPrompt();

    setBusyState(alsoBackupToDrive ? 'save-drive' : 'save-portfolio');
    onStatus(
      alsoBackupToDrive
        ? 'Saving brand asset to Firestore & uploading full-res PNG to Google Drive…'
        : 'Saving brand asset to Firestore portfolio…'
    );

    try {
      const resolvedDataUrl = activeImageUrl.startsWith('data:')
        ? activeImageUrl
        : (await assetUrlToBase64(activeImageUrl)).dataUrl;

      const previewDataUrl = await compressImageToThumbnail(resolvedDataUrl, 360, 0.75);
      let driveFileId = '';
      let driveWebViewLink = '';

      if (alsoBackupToDrive && token) {
        const folder = await ensurePortfolioDriveFolder(token, 'Tidyups Creative Portfolio');
        const slug = (effectiveTitle || effectiveCategory)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
        const uploaded = await uploadBase64MediaToDrive(
          token,
          `tidyups-${slug}-${Date.now()}.png`,
          resolvedDataUrl,
          folder.id
        );
        driveFileId = uploaded.id;
        driveWebViewLink =
          uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      }

      const assetId = await saveCreativeAssetToFirestore({
        category: effectiveCategory,
        title:
          effectiveTitle ||
          (effectiveCategory === 'brand-icon' ? 'Tidyups App Icon' : 'Tidyups Brand Logo'),
        prompt: effectivePrompt,
        service: 'brand',
        aspectRatio: activeAspect,
        modelUsed: activeModelUsed,
        previewDataUrl,
        driveFileId,
        driveWebViewLink,
      });

      await cacheFullMediaInBrowser(assetId, resolvedDataUrl);
      setActiveSavedId(assetId);
      onStatus(
        alsoBackupToDrive && driveFileId
          ? `Saved "${effectiveTitle}" to Firestore and backed up PNG to Google Drive.`
          : `Saved "${effectiveTitle}" to your Firestore Logo & Icon Portfolio.`
      );
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyState(null);
    }
  };

  const handleBackupPortfolioBrandItemToDrive = async (item: CreativeAsset) => {
    const token = accessToken ?? (await onSignIn());
    if (!token) return;
    setBusyState(`drive-${item.id}`);
    onStatus(`Uploading "${item.title}" to Google Drive…`);
    try {
      const fullImg = (await getCachedFullMediaFromBrowser(item.id)) || item.previewDataUrl;
      if (!fullImg) {
        onStatus('No image data found for this asset.');
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
        `tidyups-${slug || 'brand'}.png`,
        fullImg,
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

  const handleExportIconSize = async (src: string, baseName: string, sizePx: number) => {
    try {
      const cleanSlug = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36);
      await downloadResizedPngIcon(src, sizePx, `${cleanSlug || 'tidyups-icon'}-${sizePx}x${sizePx}.png`);
      onStatus(`Exported ${sizePx}×${sizePx}px PNG icon.`);
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLoadBrandItemToStage = async (item: CreativeAsset) => {
    const full = (await getCachedFullMediaFromBrowser(item.id)) || item.previewDataUrl;
    const cat = item.category === 'brand-icon' ? 'brand-icon' : 'brand-logo';
    setStageCategory(cat);
    setStudioTab(cat === 'brand-icon' ? 'icon-creator' : 'logo-creator');
    if (cat === 'brand-icon') {
      setIconTitle(item.title);
      setIconPrompt(item.prompt);
    } else {
      setLogoTitle(item.title);
      setLogoStylePrompt(item.prompt);
    }
    setActiveAspect(item.aspectRatio);
    setActiveImageUrl(full);
    setActiveModelUsed(item.modelUsed);
    setActiveSavedId(item.id);
    onStatus(`Loaded "${item.title}" onto the Logo & Icon stage.`);
  };

  const inputClass =
    'w-full p-3 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-sm text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2';

  const activeStageTitle =
    stageCategory === 'brand-icon' ? iconTitle || 'Tidyups Icon' : logoTitle || 'Tidyups Logo';

  return (
    <div className="space-y-6">
      {/* Top Studio Mode Switcher */}
      <div className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#241436] dark:text-slate-100 m-0">
            Tidyups Logo &amp; Icon Studio
          </h2>
          <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 mb-0">
            Official Tidyups &amp; BookMyCleaning bunny mascot reference kit, AI Logo Creator, and multi-size Favicon / App Icon generator.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#f4effa] dark:bg-[#110c1c]">
          <button
            type="button"
            onClick={() => setStudioTab('reference')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              studioTab === 'reference'
                ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                : 'text-[#6c6277] dark:text-slate-400'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Official Mascot Reference Kit
          </button>

          <button
            type="button"
            onClick={() => {
              setStudioTab('logo-creator');
              setStageCategory('brand-logo');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              studioTab === 'logo-creator'
                ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                : 'text-[#6c6277] dark:text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Logo Creator
          </button>

          <button
            type="button"
            onClick={() => {
              setStudioTab('icon-creator');
              setStageCategory('brand-icon');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              studioTab === 'icon-creator'
                ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                : 'text-[#6c6277] dark:text-slate-400'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            AI Icon &amp; Favicon Creator
          </button>
        </div>
      </div>

      {/* TAB 1: Official Mascot Reference Kit */}
      {studioTab === 'reference' && (
        <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#241436] dark:text-slate-100 m-0">
                Official Tidyups &amp; BookMyCleaning Reference Logos
              </h3>
              <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 mb-0">
                Download production JPG, scalable vector SVG, or multi-size PNG favicons—or send any mascot directly into the AI Logo &amp; Icon Creators.
              </p>
            </div>
            <p aria-live="polite" className="text-xs font-semibold text-[#56249a] dark:text-[#c084fc] m-0">
              {status}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {OFFICIAL_MASCOT_REFERENCES.map((item) => {
              const isDarkSurface = item.surface === 'dark';
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden bg-[#faf8fd] dark:bg-[#140e21]"
                >
                  <div
                    className={`aspect-square max-h-[300px] w-full grid place-items-center p-6 border-b border-[#e8e1ef] dark:border-[#2d2342] ${
                      isDarkSurface ? 'bg-[#120c1e]' : 'bg-white'
                    }`}
                  >
                    {!failedRefIds[item.id] ? (
                      <img
                        src={item.src}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedRefIds((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="max-h-[250px] w-auto object-contain"
                      />
                    ) : (
                      <TidyupsLogoLockup variant={item.surface} />
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <div className="text-sm font-bold text-[#241436] dark:text-slate-100">
                        {item.title}
                      </div>
                      <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUseReferenceInCreator(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Use as AI Reference
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleExportIconSize(item.src, item.id, 512);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 tabular-nums cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        512px PNG
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleExportIconSize(item.src, item.id, 64);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 tabular-nums cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        64px Icon
                      </button>

                      {item.id !== 'tidyups-bunny-icon' && (
                        <button
                          type="button"
                          onClick={() => {
                            const svgName = item.fileName.replace(/\.(jpg|jpeg|png)$/i, '.svg');
                            triggerBrowserDownload(
                              svgName,
                              buildTidyupsSvgLogo(item.surface, item.lockupKind),
                              'image/svg+xml;charset=utf-8'
                            );
                            onStatus(`Downloaded scalable vector ${svgName}.`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Vector SVG
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 2 & TAB 3: AI Logo Creator / AI Icon & Favicon Creator + Shared Live Stage */}
      {(studioTab === 'logo-creator' || studioTab === 'icon-creator') && (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] gap-6 items-start">
          {/* Left Controls */}
          <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
            {studioTab === 'logo-creator' ? (
              <>
                <h3 className="text-base font-bold text-[#241436] dark:text-slate-100 mb-1">
                  AI Brand Logo Creator
                </h3>
                <p className="text-xs text-[#6c6277] dark:text-slate-400 leading-relaxed mb-4">
                  Generate new Tidyups or BookMyCleaning mascot lockups, seasonal badges, uniform crests, and vehicle-wrap banners anchored to your official bunny mascot.
                </p>

                <label
                  htmlFor="logo-title"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Logo asset title
                </label>
                <input
                  id="logo-title"
                  value={logoTitle}
                  maxLength={BLUEPRINT_LIMITS.assetTitleMax}
                  onChange={(e) => setLogoTitle(e.target.value)}
                  className={inputClass}
                />

                <label
                  htmlFor="brand-wordmark"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
                >
                  Brand wordmark lockup
                </label>
                <select
                  id="brand-wordmark"
                  value={brandChoice}
                  onChange={(e) => {
                    const next = e.target.value as BrandWordmarkChoice;
                    setBrandChoice(next);
                    if (next === 'bookmycleaning') {
                      setSelectedMascotRefId('bookmycleaning-light');
                    } else if (next === 'tidyups') {
                      setSelectedMascotRefId(
                        logoSurface === 'dark' ? 'tidyups-dark' : 'tidyups-light'
                      );
                    }
                  }}
                  className={inputClass}
                >
                  <option value="tidyups">Tidyups Cleaning Service Inc.</option>
                  <option value="bookmycleaning">BookMyCleaning · Tidyups</option>
                  <option value="custom">Custom Campaign / Sub-brand Text</option>
                </select>

                {brandChoice === 'custom' && (
                  <input
                    type="text"
                    value={customBrandText}
                    onChange={(e) => setCustomBrandText(e.target.value)}
                    placeholder="e.g., Tidyups Move-Out Pros YEG"
                    className={`${inputClass} mt-2.5`}
                  />
                )}

                <div className="grid grid-cols-2 gap-3 mt-3.5">
                  <div>
                    <label
                      htmlFor="logo-surface"
                      className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                    >
                      Background surface
                    </label>
                    <select
                      id="logo-surface"
                      value={logoSurface}
                      onChange={(e) => {
                        const nextSurf = e.target.value as ThemeMode;
                        setLogoSurface(nextSurf);
                        if (brandChoice === 'tidyups') {
                          setSelectedMascotRefId(
                            nextSurf === 'dark' ? 'tidyups-dark' : 'tidyups-light'
                          );
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="light">Light White (#FFF)</option>
                      <option value="dark">Dark Plum (#120C1E)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="logo-aspect"
                      className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                    >
                      Logo proportion
                    </label>
                    <select
                      id="logo-aspect"
                      value={logoAspect}
                      onChange={(e) => setLogoAspect(e.target.value as '1:1' | '16:9')}
                      className={`${inputClass} tabular-nums`}
                    >
                      <option value="1:1">Square Emblem 1:1</option>
                      <option value="16:9">Wide Banner 16:9</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3.5">
                  <div>
                    <label
                      htmlFor="logo-quality"
                      className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                    >
                      Model quality
                    </label>
                    <select
                      id="logo-quality"
                      value={logoQuality}
                      onChange={(e) => setLogoQuality(e.target.value as 'hd' | 'fast')}
                      className={inputClass}
                    >
                      <option value="hd">HD (Nano Banana 2.1)</option>
                      <option value="fast">Fast Draft</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="logo-res"
                      className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                    >
                      Resolution
                    </label>
                    <select
                      id="logo-res"
                      value={logoSize}
                      disabled={logoQuality === 'fast'}
                      onChange={(e) => setLogoSize(e.target.value as '1K' | '2K')}
                      className={`${inputClass} tabular-nums disabled:opacity-50`}
                    >
                      <option value="1K">1K Crisp</option>
                      <option value="2K">2K Print / Wrap</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5">
                    Logo style presets
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LOGO_STYLE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setLogoTitle(`Tidyups — ${preset.label}`);
                          setLogoAspect(preset.aspectRatio);
                          setLogoSurface(preset.surface);
                          setLogoStylePrompt(preset.styleInstruction);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-[#faf8fd] dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#f4e9fa] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label
                  htmlFor="logo-style-prompt"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
                >
                  Art direction &amp; mascot details
                </label>
                <textarea
                  id="logo-style-prompt"
                  value={logoStylePrompt}
                  maxLength={BLUEPRINT_LIMITS.promptMax}
                  onChange={(e) => setLogoStylePrompt(e.target.value)}
                  className={`${inputClass} min-h-[105px] resize-y`}
                />

                <div className="mt-3.5 pt-3.5 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#241436] dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useOfficialMascotRef}
                      onChange={(e) => setUseOfficialMascotRef(e.target.checked)}
                      className="rounded accent-[#5c28a1]"
                    />
                    Anchor character &amp; typography to official Tidyups mascot logo
                  </label>

                  {useOfficialMascotRef && (
                    <select
                      value={selectedMascotRefId}
                      onChange={(e) => setSelectedMascotRefId(e.target.value)}
                      aria-label="Official reference logo"
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
                    void handleGenerateLogoOrIcon('brand-logo', false);
                  }}
                  className="w-full mt-4 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {busyState === 'generate' ? 'Generating Brand Logo…' : 'Generate Brand Logo'}
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-[#241436] dark:text-slate-100 mb-1">
                  AI Icon &amp; Favicon Creator
                </h3>
                <p className="text-xs text-[#6c6277] dark:text-slate-400 leading-relaxed mb-4">
                  Create crisp zero-text 1:1 app icons, social profile avatars, Meta Lead Form badges, and website favicons with instant 512px–32px PNG export.
                </p>

                <label
                  htmlFor="icon-title"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Icon / avatar title
                </label>
                <input
                  id="icon-title"
                  value={iconTitle}
                  maxLength={BLUEPRINT_LIMITS.assetTitleMax}
                  onChange={(e) => setIconTitle(e.target.value)}
                  className={inputClass}
                />

                <label
                  htmlFor="icon-surface"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
                >
                  Icon background style
                </label>
                <select
                  id="icon-surface"
                  value={iconSurface}
                  onChange={(e) => setIconSurface(e.target.value as ThemeMode)}
                  className={inputClass}
                >
                  <option value="dark">Deep Violet / Cosmic Badge</option>
                  <option value="light">Crisp White App Tile</option>
                </select>

                <div className="mt-4">
                  <div className="text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5">
                    Zero-text icon &amp; badge presets
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ICON_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setIconTitle(preset.label);
                          setIconSurface(preset.surface);
                          setUseBunnyForIcon(preset.useBunnyRef);
                          setIconPrompt(preset.prompt);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-[#faf8fd] dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#f4e9fa] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label
                  htmlFor="icon-prompt"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
                >
                  1:1 Icon prompt
                </label>
                <textarea
                  id="icon-prompt"
                  value={iconPrompt}
                  maxLength={BLUEPRINT_LIMITS.promptMax}
                  onChange={(e) => setIconPrompt(e.target.value)}
                  className={`${inputClass} min-h-[115px] resize-y`}
                />

                <label className="flex items-center gap-2 text-xs font-semibold text-[#241436] dark:text-slate-200 mt-3.5 pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBunnyForIcon}
                    onChange={(e) => setUseBunnyForIcon(e.target.checked)}
                    className="rounded accent-[#5c28a1]"
                  />
                  Match Tidyups Bunny Mascot character style
                </label>

                <button
                  type="button"
                  disabled={busyState !== null}
                  onClick={() => {
                    void handleGenerateLogoOrIcon('brand-icon', false);
                  }}
                  className="w-full mt-4 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {busyState === 'generate' ? 'Generating 1:1 Icon…' : 'Generate Icon / Favicon'}
                </button>
              </>
            )}
          </section>

          {/* Right Brand Stage & Multi-Size Exporter */}
          <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e8e1ef] dark:border-[#2d2342]">
              <div>
                <h3 className="text-base font-bold text-[#241436] dark:text-slate-100 m-0">
                  {stageCategory === 'brand-icon' ? 'Icon & Favicon Stage' : 'Brand Logo Stage'}
                </h3>
                <p
                  aria-live="polite"
                  className="text-xs text-[#56249a] dark:text-[#c084fc] mt-0.5 mb-0"
                >
                  {status}
                </p>
              </div>

              {activeImageUrl && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeImageUrl.startsWith('data:')) {
                        triggerDataUrlDownload(
                          activeImageUrl,
                          `${activeStageTitle
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')}.png`
                        );
                      } else {
                        void handleExportIconSize(activeImageUrl, activeStageTitle, 1024);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Full PNG
                  </button>

                  <button
                    type="button"
                    disabled={busyState !== null}
                    onClick={() => {
                      void handleSaveBrandAssetToPortfolio(false);
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
                      void handleSaveBrandAssetToPortfolio(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#047857] dark:bg-[#059669] hover:bg-[#065f46] text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    {busyState === 'save-drive' ? 'Uploading…' : 'Save + Drive'}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 min-h-[370px] rounded-2xl bg-[#f4effa] dark:bg-[#110c1c] border border-[#e8e1ef] dark:border-[#2d2342] grid place-items-center p-6 overflow-hidden">
              {busyState === 'generate' || busyState === 'edit' ? (
                <div className="text-center py-14 px-4">
                  <RefreshCw className="w-8 h-8 text-[#56249a] dark:text-[#c084fc] animate-spin mx-auto mb-3" />
                  <div className="text-sm font-bold text-[#241436] dark:text-slate-100">
                    Crafting Tidyups brand artwork…
                  </div>
                  <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-1">
                    Preserving purple, hot-pink &amp; cyan mascot brand identity
                  </div>
                </div>
              ) : activeImageUrl ? (
                <img
                  src={activeImageUrl}
                  alt={activeStageTitle}
                  referrerPolicy="no-referrer"
                  className="max-h-[460px] w-auto max-w-full rounded-2xl object-contain"
                />
              ) : (
                <div className="text-center py-14 px-6 max-w-md">
                  <Palette className="w-10 h-10 text-[#8b7e99] dark:text-slate-500 mx-auto mb-3" />
                  <div className="text-sm font-bold text-[#241436] dark:text-slate-200">
                    Ready to design logos &amp; icons
                  </div>
                  <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-1 mb-0 leading-relaxed">
                    Choose a preset on the left and click <b>Generate</b>, or open the <b>Official Mascot Reference Kit</b> tab to inspect your core Tidyups &amp; BookMyCleaning logos.
                  </p>
                </div>
              )}
            </div>

            {/* Multi-Size PNG Icon / Favicon Pack Bar */}
            {activeImageUrl && (
              <div className="mt-4 pt-4 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#241436] dark:text-slate-200">
                    Multi-size PNG icon &amp; favicon export
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                    {[512, 192, 64, 32].map((px) => (
                      <button
                        key={px}
                        type="button"
                        onClick={() => {
                          void handleExportIconSize(activeImageUrl, activeStageTitle, px);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-[#faf8fd] dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#f4e9fa] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        {px}×{px}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                    placeholder="Refine this logo or icon (e.g., Make the feather duster larger, switch background to dark plum)…"
                    className="flex-1 min-w-[220px] p-2.5 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-xs text-[#241436] dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busyState !== null || !editInstruction.trim()}
                    onClick={() => {
                      void handleGenerateLogoOrIcon(stageCategory, true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Apply AI Edit
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Firestore Brand Logo & Icon Portfolio */}
      <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#e8e1ef] dark:border-[#2d2342]">
          <div>
            <h2 className="text-base font-bold text-[#241436] dark:text-slate-100 m-0 tabular-nums">
              Firestore Logo &amp; Icon Portfolio ({brandPortfolio.length})
            </h2>
            <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 mb-0">
              {user
                ? 'All custom AI logos, sub-brand lockups, and 1:1 icons saved to your Firestore account.'
                : 'Sign in with Google to save custom logos and icons to your persistent Firestore portfolio.'}
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
              All Brand Assets
            </button>
            <button
              type="button"
              onClick={() => setPortfolioFilter('brand-logo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                portfolioFilter === 'brand-logo'
                  ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                  : 'text-[#6c6277] dark:text-slate-400'
              }`}
            >
              Logos
            </button>
            <button
              type="button"
              onClick={() => setPortfolioFilter('brand-icon')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                portfolioFilter === 'brand-icon'
                  ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
                  : 'text-[#6c6277] dark:text-slate-400'
              }`}
            >
              Icons &amp; Favicons
            </button>
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
              Sign in with Google to Enable Firestore Brand Portfolio
            </button>
          </div>
        ) : brandPortfolio.length === 0 ? (
          <p className="text-xs text-[#6c6277] dark:text-slate-400 py-6 text-center m-0">
            No custom logos or icons saved yet. Generate a mark in the <b>AI Logo Creator</b> or <b>AI Icon &amp; Favicon Creator</b> tab and click <b>Save to Portfolio</b>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {brandPortfolio.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden bg-[#faf8fd] dark:bg-[#140e21] flex flex-col"
              >
                <div className="aspect-square w-full bg-[#120c1e] grid place-items-center p-4 overflow-hidden border-b border-[#e8e1ef] dark:border-[#2d2342]">
                  {item.previewDataUrl ? (
                    <img
                      src={item.previewDataUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <TidyupsLogoLockup variant="dark" compact />
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#6c6277] dark:text-slate-400 tabular-nums">
                      {item.category === 'brand-icon' ? 'Icon · 1:1' : `Logo · ${item.aspectRatio}`}
                    </div>
                    <h3 className="text-sm font-bold text-[#241436] dark:text-slate-100 mt-0.5 mb-1 truncate">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2.5 border-t border-[#e8e1ef] dark:border-[#2d2342]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          void handleLoadBrandItemToStage(item);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#f4e9fa] dark:bg-[#241b38] text-[#56249a] dark:text-[#d8b4fe] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Load
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleExportIconSize(item.previewDataUrl, item.title, 64);
                        }}
                        className="px-2 py-1 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 tabular-nums cursor-pointer"
                      >
                        64px
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
                        aria-label="Copy prompt"
                        className="p-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>

                      {item.driveWebViewLink ? (
                        <a
                          href={item.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs font-bold text-[#047857] dark:text-[#34d399] underline whitespace-nowrap shrink-0"
                        >
                          Drive
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={busyState !== null}
                          onClick={() => {
                            void handleBackupPortfolioBrandItemToDrive(item);
                          }}
                          className="px-2 py-1 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-semibold text-[#047857] dark:text-[#34d399] whitespace-nowrap shrink-0 cursor-pointer"
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
