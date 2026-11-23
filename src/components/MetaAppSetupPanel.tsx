import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, FileArchive } from 'lucide-react';
import {
  buildMetaSetupFields,
  generateAndDownloadMetaAppSetupZip,
} from '../services/metaAppSetupKit';

interface MetaAppSetupPanelProps {
  onStatus: (msg: string) => void;
}

const INCLUDED_ZIP_FILES = [
  { name: '00-START-HERE-SETUP-GUIDE.md', desc: 'Step-by-step developers.facebook.com walkthrough' },
  { name: '01-meta-app-basic-settings.txt', desc: 'Copy-paste values for App Settings > Basic' },
  { name: '02-meta-app-config.json', desc: 'Full structured JSON config & webhook fields' },
  { name: '03-facebook-login-oauth-settings.txt', desc: 'OAuth Redirect URIs & JS SDK domains' },
  { name: '04-permissions-and-app-review-guide.md', desc: 'Permissions list, System User shortcut & justifications' },
  { name: '05-business-verification-and-domain-checklist.md', desc: 'Business Portfolio, DNS verification & Lead Ads setup' },
  { name: '06-privacy-policy.txt', desc: 'Alberta PIPA & PIPEDA Privacy Policy' },
  { name: '07-terms-of-service.txt', desc: 'Terms & Conditions document' },
  { name: '08-data-deletion-instructions.txt', desc: 'Meta-compliant User Data Deletion instructions' },
  { name: '09-meta-urls-quick-reference.csv', desc: 'Spreadsheet quick-reference table of every field' },
  { name: 'assets/meta-app-icon-1024x1024.png', desc: 'Exact 1024×1024 PNG App Icon ready for upload' },
  { name: 'assets/bookmycleaning-tidyups-official-logo.png', desc: 'Original high-res BookMyCleaning-Tidyups logo' },
];

export const MetaAppSetupPanel: React.FC<MetaAppSetupPanelProps> = ({ onStatus }) => {
  const [primaryOrigin, setPrimaryOrigin] = useState<string>('https://app.tidyupscleaning.com');
  const [secondaryDomain, setSecondaryDomain] = useState<string>('leadadscreator.com');
  const [appDisplayName, setAppDisplayName] = useState<string>(
    'BookMyCleaning-Tidyups Ad Studio'
  );
  const [isBuildingZip, setIsBuildingZip] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      buildMetaSetupFields({
        primaryOrigin,
        secondaryDomain,
        appDisplayName,
      }),
    [primaryOrigin, secondaryDomain, appDisplayName]
  );

  const handleDownloadZip = async () => {
    setIsBuildingZip(true);
    onStatus('Packaging Meta App Setup Kit (.zip) with 1024×1024 App Icon and all Meta URLs…');
    try {
      const result = await generateAndDownloadMetaAppSetupZip({
        primaryOrigin,
        secondaryDomain,
        appDisplayName,
      });
      onStatus(
        `Downloaded ${result.fileName} (${result.fileCount} files including 1024×1024 App Icon PNG).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStatus(`Could not build Meta App Setup ZIP: ${msg}`);
    } finally {
      setIsBuildingZip(false);
    }
  };

  const handleCopyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      onStatus(`Copied ${key} to clipboard.`);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1600);
    } catch {
      onStatus(value);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-xl border border-[#d8cde3] dark:border-[#392b54] bg-white dark:bg-[#120d1d] text-xs text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0 leading-relaxed">
            Download a complete <b>.zip</b> bundle containing every URL, OAuth redirect, policy document, permission justification, Business Verification checklist, and an exact <b>1024×1024 PNG App Icon</b> for{' '}
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#56249a] dark:text-[#c084fc] underline inline-flex items-center gap-0.5"
            >
              developers.facebook.com
              <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>
        </div>

        <button
          type="button"
          disabled={isBuildingZip}
          onClick={() => {
            void handleDownloadZip();
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-extrabold hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileArchive className="w-4 h-4" />
          {isBuildingZip ? 'Building ZIP…' : 'Download Meta App Setup Kit (.zip)'}
        </button>
      </div>

      {/* Customizable Primary & Secondary Domains */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342]">
        <div>
          <label
            htmlFor="meta-app-name"
            className="block text-[11px] font-bold text-[#241436] dark:text-slate-200 mb-1"
          >
            Meta App Display Name
          </label>
          <input
            id="meta-app-name"
            type="text"
            value={appDisplayName}
            onChange={(e) => setAppDisplayName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="meta-primary-origin"
            className="block text-[11px] font-bold text-[#241436] dark:text-slate-200 mb-1"
          >
            Primary App URL
          </label>
          <input
            id="meta-primary-origin"
            type="url"
            value={primaryOrigin}
            onChange={(e) => setPrimaryOrigin(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="meta-secondary-domain"
            className="block text-[11px] font-bold text-[#241436] dark:text-slate-200 mb-1"
          >
            Secondary App Domain
          </label>
          <input
            id="meta-secondary-domain"
            type="text"
            value={secondaryDomain}
            onChange={(e) => setSecondaryDomain(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Quick Copy-Paste Meta Dashboard Fields */}
      <div className="rounded-xl border border-[#e8e1ef] dark:border-[#2d2342] overflow-hidden">
        <div className="px-3.5 py-2 bg-[#f4effa] dark:bg-[#120d1d] border-b border-[#e8e1ef] dark:border-[#2d2342] text-xs font-bold text-[#241436] dark:text-slate-100">
          Quick Copy-Paste Values for Meta App Settings
        </div>
        <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342] max-h-60 overflow-y-auto">
          {preview.rows.slice(0, 10).map((row) => (
            <div
              key={`${row.section}-${row.field}`}
              className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[#241436] dark:text-slate-100">
                  {row.field}{' '}
                  <span className="font-normal text-[#6c6277] dark:text-slate-400">
                    ({row.section})
                  </span>
                </div>
                <div className="text-[#56249a] dark:text-[#c084fc] font-mono text-[11px] truncate mt-0.5">
                  {row.value}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleCopyValue(row.field, row.value);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-[11px] font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === row.field ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Files Included in ZIP */}
      <div className="pt-2">
        <div className="text-xs font-bold text-[#241436] dark:text-slate-200 mb-2">
          Included in bookmycleaning-tidyups-meta-app-setup-kit.zip ({INCLUDED_ZIP_FILES.length} files)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[#6c6277] dark:text-slate-400">
          {INCLUDED_ZIP_FILES.map((item) => (
            <div key={item.name} className="truncate">
              <span className="font-mono font-semibold text-[#241436] dark:text-slate-200">
                {item.name}
              </span>{' '}
              — {item.desc}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
