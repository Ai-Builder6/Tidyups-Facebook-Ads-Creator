import React, { useState } from 'react';
import { Download } from 'lucide-react';
import logoDarkJpg from '../assets/images/tidyups_logo_dark_1794990230322.jpg';
import logoLightJpg from '../assets/images/tidyups_logo_light_1794990229434.jpg';
import { triggerBrowserDownload } from '../utils/adGenerator';

export type ThemeMode = 'light' | 'dark';

interface TidyupsLogoMarkProps {
  variant: ThemeMode;
  compact?: boolean;
}

export const TidyupsLogoLockup: React.FC<TidyupsLogoMarkProps> = ({
  variant,
  compact = false,
}) => {
  const isDark = variant === 'dark';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <span
        className={`rounded-xl grid place-items-center shrink-0 border transition-colors ${
          compact ? 'w-9 h-9' : 'w-11 h-11'
        } ${
          isDark
            ? 'bg-[#1a122b] border-[#352752]'
            : 'bg-white border-[#e6dcf2]'
        }`}
      >
        <svg
          viewBox="0 0 48 48"
          className={compact ? 'w-6 h-6 block' : 'w-7 h-7 block'}
          aria-hidden="true"
        >
          {/* Left & Right Bunny Ears */}
          <path
            d="M17.5 8.5c-2.6 0-4.5 2.4-4 5.6l1.7 10.2h6.2l-1-11.2c-.2-2.7-1.3-4.6-2.9-4.6z"
            fill={isDark ? '#a855f7' : '#56249a'}
          />
          <path
            d="M30.5 8.5c2.6 0 4.5 2.4 4 5.6l-1.7 10.2h-6.2l1-11.2c.2-2.7 1.3-4.6 2.9-4.6z"
            fill={isDark ? '#a855f7' : '#56249a'}
          />
          <path
            d="M17.7 12c-1.1 0-1.9 1.3-1.6 3.1l1.1 7.2h2.7l-.6-7.5c-.1-1.6-.8-2.8-1.6-2.8z"
            fill={isDark ? '#f472b6' : '#e746a6'}
          />
          <path
            d="M30.3 12c1.1 0 1.9 1.3 1.6 3.1l-1.1 7.2h-2.7l.6-7.5c.1-1.6.8-2.8 1.6-2.8z"
            fill={isDark ? '#f472b6' : '#e746a6'}
          />
          {/* Clean Geometric Bunny Head */}
          <circle
            cx="24"
            cy="29"
            r="11.5"
            fill={isDark ? '#c084fc' : '#56249a'}
          />
          {/* Inner Cheeks / Muzzle */}
          <ellipse
            cx="24"
            cy="31.5"
            rx="7.5"
            ry="6"
            fill={isDark ? '#1a122b' : '#ffffff'}
          />
          {/* Eyes */}
          <circle
            cx="20.2"
            cy="27.2"
            r="1.6"
            fill={isDark ? '#ffffff' : '#ffffff'}
          />
          <circle
            cx="27.8"
            cy="27.2"
            r="1.6"
            fill={isDark ? '#ffffff' : '#ffffff'}
          />
          {/* Nose */}
          <path
            d="M22.2 30.2h3.6L24 32.4z"
            fill={isDark ? '#f472b6' : '#e746a6'}
          />
          {/* Subtle Sparkle Star */}
          <path
            d="M39.5 11l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z"
            fill={isDark ? '#f472b6' : '#e746a6'}
          />
        </svg>
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

export function buildTidyupsSvgLogo(mode: ThemeMode): string {
  const bg = mode === 'dark' ? '#130D1F' : '#FFFFFF';
  const primary = mode === 'dark' ? '#A855F7' : '#56249A';
  const secondary = mode === 'dark' ? '#F472B6' : '#E746A6';
  const wordmark = mode === 'dark' ? '#FFFFFF' : '#241436';
  const subtext = mode === 'dark' ? '#C4B5FD' : '#6C6277';
  const muzzle = mode === 'dark' ? '#130D1F' : '#FFFFFF';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 140" width="840" height="280">
  <rect width="420" height="140" rx="24" fill="${bg}" />
  <g transform="translate(28, 16)">
    <path d="M36 10c-6 0-10.5 5.6-9.2 13l4 24h14.4l-2.3-26.2C42.4 14.5 39.8 10 36 10z" fill="${primary}" />
    <path d="M68 10c6 0 10.5 5.6 9.2 13l-4 24H58.8l2.3-26.2C61.6 14.5 64.2 10 68 10z" fill="${primary}" />
    <path d="M36.5 18c-2.6 0-4.4 3-3.8 7.2l2.6 16.8h6.3l-1.4-17.5c-.3-3.7-1.9-6.5-3.7-6.5z" fill="${secondary}" />
    <path d="M67.5 18c2.6 0 4.4 3 3.8 7.2l-2.6 16.8h-6.3l1.4-17.5c.3-3.7 1.9-6.5 3.7-6.5z" fill="${secondary}" />
    <circle cx="52" cy="64" r="27" fill="${primary}" />
    <ellipse cx="52" cy="70" rx="17.5" ry="13.5" fill="${muzzle}" />
    <circle cx="43" cy="59.5" r="3.6" fill="#FFFFFF" />
    <circle cx="61" cy="59.5" r="3.6" fill="#FFFFFF" />
    <path d="M47.8 66.5h8.4L52 71.8z" fill="${secondary}" />
    <path d="M89 16l2.6 6.8 6.8 2.6-6.8 2.6-2.6 6.8-2.6-6.8-6.8-2.6 6.8-2.6z" fill="${secondary}" />
  </g>
  <text x="148" y="76" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="46" font-weight="800" fill="${wordmark}">Tidyups</text>
  <text x="150" y="102" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="13" font-weight="600" letter-spacing="1.8" fill="${subtext}">CLEANING SERVICE · EDMONTON</text>
</svg>`;
}

interface BrandLogoKitProps {
  onStatus: (msg: string) => void;
}

export const BrandLogoKit: React.FC<BrandLogoKitProps> = ({ onStatus }) => {
  const [lightImgFailed, setLightImgFailed] = useState(false);
  const [darkImgFailed, setDarkImgFailed] = useState(false);

  const downloadGeneratedJpg = async (url: string, fileName: string) => {
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
      <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0">
        Official Tidyups logos formatted for both light and dark ad backgrounds. Download high-resolution artwork or scalable vector SVG files to place on your Facebook and Instagram creatives.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Light Background Logo Card */}
        <div className="rounded-2xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden bg-white">
          <div className="aspect-square w-full bg-white grid place-items-center p-6 border-b border-[#e8e1ef]">
            {!lightImgFailed ? (
              <img
                src={logoLightJpg}
                alt="Tidyups logo on light background"
                referrerPolicy="no-referrer"
                onError={() => setLightImgFailed(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <TidyupsLogoLockup variant="light" />
            )}
          </div>
          <div className="p-4 bg-white dark:bg-[#181226] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-[#241436] dark:text-slate-100">
                Light Background Logo
              </div>
              <div className="text-xs text-[#6c6277] dark:text-slate-400">
                Crisp white surface · Royal purple &amp; pink
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void downloadGeneratedJpg(logoLightJpg, 'tidyups-logo-light.jpg');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                JPG
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerBrowserDownload(
                    'tidyups-logo-light.svg',
                    buildTidyupsSvgLogo('light'),
                    'image/svg+xml;charset=utf-8'
                  );
                  onStatus('Downloaded tidyups-logo-light.svg.');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                SVG
              </button>
            </div>
          </div>
        </div>

        {/* Dark Background Logo Card */}
        <div className="rounded-2xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden bg-[#130d1f]">
          <div className="aspect-square w-full bg-[#130d1f] grid place-items-center p-6 border-b border-[#2d2342]">
            {!darkImgFailed ? (
              <img
                src={logoDarkJpg}
                alt="Tidyups logo on dark background"
                referrerPolicy="no-referrer"
                onError={() => setDarkImgFailed(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <TidyupsLogoLockup variant="dark" />
            )}
          </div>
          <div className="p-4 bg-white dark:bg-[#181226] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-[#241436] dark:text-slate-100">
                Dark Background Logo
              </div>
              <div className="text-xs text-[#6c6277] dark:text-slate-400">
                Deep obsidian plum · Luminous violet &amp; rose
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void downloadGeneratedJpg(logoDarkJpg, 'tidyups-logo-dark.jpg');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                JPG
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerBrowserDownload(
                    'tidyups-logo-dark.svg',
                    buildTidyupsSvgLogo('dark'),
                    'image/svg+xml;charset=utf-8'
                  );
                  onStatus('Downloaded tidyups-logo-dark.svg.');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-semibold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                SVG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
