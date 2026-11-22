import React, { useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import bunnyIconJpg from '../assets/images/tidyups_bunny_icon_1794991817403.jpg';
import mascotDarkJpg from '../assets/images/tidyups_mascot_dark_1794991814613.jpg';
import mascotLightJpg from '../assets/images/tidyups_mascot_light_1794991811247.jpg';
import { triggerBrowserDownload } from '../utils/adGenerator';

export const OFFICIAL_BOOKMYCLEANING_LOGO_PATH =
  '/assets/aistudio/Bunny_Tidyups_Cleaning_Service_Logo_15ee01fd.png';

export type ThemeMode = 'light' | 'dark';
export type BrandLockupKind = 'tidyups' | 'bookmycleaning';

export interface OfficialMascotReference {
  id: string;
  title: string;
  subtitle: string;
  surface: ThemeMode;
  lockupKind: BrandLockupKind;
  src: string;
  fileName: string;
}

export const OFFICIAL_MASCOT_REFERENCES: OfficialMascotReference[] = [
  {
    id: 'tidyups-light',
    title: 'Tidyups Cleaning Service Inc. (Light)',
    subtitle: 'White bunny mascot · Feather duster · Cosmic circle & house roofline on white',
    surface: 'light',
    lockupKind: 'tidyups',
    src: mascotLightJpg,
    fileName: 'tidyups-mascot-logo-light.jpg',
  },
  {
    id: 'tidyups-dark',
    title: 'Tidyups Cleaning Service Inc. (Dark)',
    subtitle: 'Luminous cyan-rimmed bunny mascot · Glowing violet emblem on dark plum',
    surface: 'dark',
    lockupKind: 'tidyups',
    src: mascotDarkJpg,
    fileName: 'tidyups-mascot-logo-dark.jpg',
  },
  {
    id: 'bookmycleaning-light',
    title: 'BookMyCleaning · Tidyups Official Logo',
    subtitle: 'Official uploaded BookMyCleaning + Tidyups bunny mascot & feather duster PNG',
    surface: 'light',
    lockupKind: 'bookmycleaning',
    src: OFFICIAL_BOOKMYCLEANING_LOGO_PATH,
    fileName: 'bookmycleaning-tidyups-official-logo.png',
  },
  {
    id: 'tidyups-bunny-icon',
    title: 'Tidyups Bunny Mascot App Icon',
    subtitle: 'Zero-text square mascot avatar · Social profile & favicon mark',
    surface: 'dark',
    lockupKind: 'tidyups',
    src: bunnyIconJpg,
    fileName: 'tidyups-bunny-mascot-icon.jpg',
  },
];

interface TidyupsLogoMarkProps {
  variant: ThemeMode;
  compact?: boolean;
}

export const TidyupsLogoLockup: React.FC<TidyupsLogoMarkProps> = ({
  variant,
  compact = false,
}) => {
  const isDark = variant === 'dark';
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <span
        className={`rounded-xl overflow-hidden grid place-items-center shrink-0 border transition-colors ${
          compact ? 'w-9 h-9' : 'w-10 h-10'
        } ${
          isDark
            ? 'bg-[#1a122b] border-[#3a2a59]'
            : 'bg-white border-[#e6dcf2]'
        }`}
      >
        {!iconFailed ? (
          <img
            src={bunnyIconJpg}
            alt="Tidyups bunny mascot"
            referrerPolicy="no-referrer"
            onError={() => setIconFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            viewBox="0 0 48 48"
            className={compact ? 'w-6 h-6 block' : 'w-7 h-7 block'}
            aria-hidden="true"
          >
            <circle cx="24" cy="26" r="16" fill={isDark ? '#7e22ce' : '#56249a'} />
            <path
              d="M17.5 6.5c-2.6 0-4.4 2.6-3.8 6l1.8 10.5h5.8l-.9-11.6c-.2-2.9-1.3-4.9-2.9-4.9z"
              fill="#ffffff"
            />
            <path
              d="M30.5 6.5c2.6 0 4.4 2.6 3.8 6l-1.8 10.5h-5.8l.9-11.6c.2-2.9 1.3-4.9 2.9-4.9z"
              fill="#ffffff"
            />
            <path
              d="M17.8 10c-1.1 0-1.9 1.4-1.5 3.3l1.1 7.2h2.6l-.6-7.6c-.1-1.7-.8-2.9-1.6-2.9z"
              fill="#f43f9e"
            />
            <path
              d="M30.2 10c1.1 0-1.9 1.4 1.5 3.3l-1.1 7.2h-2.6l.6-7.6c.1-1.7.8-2.9 1.6-2.9z"
              fill="#f43f9e"
            />
            <circle cx="24" cy="29" r="10.5" fill="#ffffff" />
            <circle cx="20.2" cy="27.5" r="2.1" fill="#56249a" />
            <circle cx="27.8" cy="27.5" r="2.1" fill="#56249a" />
            <path d="M22.3 30.8h3.4L24 32.8z" fill="#f43f9e" />
          </svg>
        )}
      </span>
      <span
        className={`font-extrabold tracking-tight ${
          compact ? 'text-lg' : 'text-xl'
        } ${isDark ? 'text-white' : 'text-[#241436]'}`}
      >
        Tidyups
      </span>
    </span>
  );
};

export function buildTidyupsSvgLogo(
  mode: ThemeMode,
  lockupKind: BrandLockupKind = 'tidyups'
): string {
  const bg = mode === 'dark' ? '#120C1E' : '#FFFFFF';
  const circleStart = mode === 'dark' ? '#6D28D9' : '#4C1D95';
  const circleEnd = '#EC4899';
  const wordStroke = mode === 'dark' ? '#2E1065' : '#241046';
  const subBanner = mode === 'dark' ? '#3B147A' : '#260E52';
  const roofColor = mode === 'dark' ? '#A855F7' : '#6B21A8';

  const topKicker =
    lockupKind === 'bookmycleaning'
      ? `<text x="235" y="64" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="25" font-style="italic" font-weight="800" fill="#F472B6" stroke="${wordStroke}" stroke-width="4" paint-order="stroke">BookMyCleaning</text>`
      : '';

  const mainWordY = lockupKind === 'bookmycleaning' ? 112 : 95;
  const subBannerY = lockupKind === 'bookmycleaning' ? 124 : 110;
  const subTextY = lockupKind === 'bookmycleaning' ? 144 : 130;
  const subLabel =
    lockupKind === 'bookmycleaning'
      ? '— Cleaning Service Inc. —'
      : 'Cleaning Service Inc.';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 180" width="1040" height="360">
  <defs>
    <linearGradient id="cosmicCircle" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${circleStart}" />
      <stop offset="100%" stop-color="${circleEnd}" />
    </linearGradient>
    <linearGradient id="wordGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="55%" stop-color="#FCE7F3" />
      <stop offset="100%" stop-color="#F43F9E" />
    </linearGradient>
  </defs>
  <rect width="520" height="180" rx="28" fill="${bg}" />
  <g transform="translate(26, 16)">
    <circle cx="74" cy="76" r="58" fill="url(#cosmicCircle)" />
    <!-- House Roofline Accent -->
    <path d="M104 78 L138 50 L156 65 L156 53 L165 53 L165 73 L174 80 L164 80 L138 58 L112 80 Z" fill="${roofColor}" />
    <rect x="131" y="68" width="6" height="6" fill="${circleEnd}" />
    <rect x="139" y="68" width="6" height="6" fill="${circleEnd}" />
    <rect x="131" y="76" width="6" height="6" fill="${circleEnd}" />
    <rect x="139" y="76" width="6" height="6" fill="${circleEnd}" />
    <!-- Bunny Ears -->
    <path d="M52 10 C42 10 38 24 41 40 L48 68 L64 68 L60 36 C59 20 56 10 52 10 Z" fill="#FFFFFF" stroke="${wordStroke}" stroke-width="3" />
    <path d="M92 10 C102 10 106 24 103 40 L96 68 L80 68 L84 36 C85 20 88 10 92 10 Z" fill="#FFFFFF" stroke="${wordStroke}" stroke-width="3" />
    <path d="M52 18 C47 18 45 28 47 40 L52 62 L60 62 L57 38 C56 26 54 18 52 18 Z" fill="#F43F9E" />
    <path d="M92 18 C97 18 99 28 97 40 L92 62 L84 62 L87 38 C88 26 90 18 92 18 Z" fill="#F43F9E" />
    <!-- Bunny Head -->
    <ellipse cx="72" cy="86" rx="31" ry="27" fill="#FFFFFF" stroke="${wordStroke}" stroke-width="3" />
    <circle cx="60" cy="83" r="6.2" fill="#581C87" />
    <circle cx="84" cy="83" r="6.2" fill="#581C87" />
    <circle cx="58.2" cy="81" r="2.1" fill="#FFFFFF" />
    <circle cx="82.2" cy="81" r="2.1" fill="#FFFFFF" />
    <path d="M68 92 H76 L72 96.5 Z" fill="#F43F9E" />
    <!-- Feather Duster -->
    <line x1="94" y1="108" x2="122" y2="62" stroke="#701A75" stroke-width="4" stroke-linecap="round" />
    <path d="M122 62 C112 52 118 34 134 28 C132 45 142 52 122 62 Z" fill="#F43F9E" stroke="${wordStroke}" stroke-width="2" />
    <path d="M122 62 C126 46 138 38 146 44 C138 56 130 64 122 62 Z" fill="#38BDF8" />
    <!-- Sparkles -->
    <path d="M28 48 L31 56 L39 59 L31 62 L28 70 L25 62 L17 59 L25 56 Z" fill="#FFFFFF" />
    <path d="M114 22 L116 28 L122 30 L116 32 L114 38 L112 32 L106 30 L112 28 Z" fill="#F472B6" />
  </g>
  ${topKicker}
  <text x="208" y="${mainWordY}" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="58" font-style="italic" font-weight="800" fill="url(#wordGrad)" stroke="${wordStroke}" stroke-width="7" paint-order="stroke">Tidyups</text>
  <rect x="206" y="${subBannerY}" width="276" height="28" rx="14" fill="${subBanner}" />
  <text x="344" y="${subTextY}" text-anchor="middle" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="14.5" font-style="italic" font-weight="700" fill="#FFFFFF">${subLabel}</text>
</svg>`;
}

interface BrandLogoKitProps {
  onStatus: (msg: string) => void;
  onOpenFullStudio?: () => void;
}

export const BrandLogoKit: React.FC<BrandLogoKitProps> = ({ onStatus, onOpenFullStudio }) => {
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  const downloadAssetFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
      onStatus(`Downloaded ${fileName}.`);
    } catch {
      onStatus('Could not download logo image.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0">
          Official Tidyups bunny mascot logos (Light, Dark, BookMyCleaning lockup &amp; square mascot icon).
        </p>
        {onOpenFullStudio && (
          <button
            type="button"
            onClick={onOpenFullStudio}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Open AI Logo &amp; Icon Creator
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OFFICIAL_MASCOT_REFERENCES.map((item) => {
          const isDarkSurface = item.surface === 'dark';
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden bg-white dark:bg-[#181226]"
            >
              <div
                className={`aspect-square w-full grid place-items-center p-5 border-b border-[#e8e1ef] dark:border-[#2d2342] ${
                  isDarkSurface ? 'bg-[#120c1e]' : 'bg-white'
                }`}
              >
                {!failedIds[item.id] ? (
                  <img
                    src={item.src}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedIds((prev) => ({ ...prev, [item.id]: true }))
                    }
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <TidyupsLogoLockup variant={item.surface} />
                )}
              </div>
              <div className="p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#241436] dark:text-slate-100 truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-[#6c6277] dark:text-slate-400 truncate">
                    {item.subtitle}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      void downloadAssetFile(item.src, item.fileName);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {item.fileName.toLowerCase().endsWith('.png') ? 'PNG' : 'JPG'}
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
                        onStatus(`Downloaded ${svgName}.`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      SVG
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
