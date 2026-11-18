import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Check, Copy, Download, Edit3, LogOut, Moon, Sparkles, Sun } from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { ThemeMode, TidyupsLogoLockup } from './components/TidyupsLogo';
import { HubTab, WorkspaceHub } from './components/WorkspaceHub';
import { clearAccessToken, googleSignIn, initAuth, logout } from './firebase';
import {
  deleteCampaignFromFirestore,
  LinkedWorkspaceRefs,
  loadCampaignAdsFromFirestore,
  saveCampaignWithAdsToFirestore,
  subscribeToUserCampaigns,
  updateCampaignWorkspaceLinks,
} from './services/campaignStore';
import {
  BLUEPRINT_LIMITS,
  CampaignSettings,
  CreativeFormat,
  GeneratedAd,
  PendingConfirmation,
  SavedCampaign,
  ServiceKey,
  ToneKey,
} from './types';
import {
  adsToCsv,
  adsToJson,
  DEFAULT_SETTINGS,
  FORMAT_LABELS,
  formatAllAdsPlainText,
  generateAds,
  SERVICE_DATA,
  TONE_LABELS,
  triggerBrowserDownload,
} from './utils/adGenerator';

const LOCAL_SETTINGS_KEY = 'tidyups-settings';
const LOCAL_THEME_KEY = 'tidyups-theme';

function loadInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(LOCAL_THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore storage access errors
  }
  return 'light';
}

function loadInitialSettings(): CampaignSettings {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CampaignSettings>;
    return {
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title
          : DEFAULT_SETTINGS.title,
      service: (parsed.service as ServiceKey) || DEFAULT_SETTINGS.service,
      tone: (parsed.tone as ToneKey) || DEFAULT_SETTINGS.tone,
      count: Number(parsed.count) || DEFAULT_SETTINGS.count,
      format: (parsed.format as CreativeFormat) || DEFAULT_SETTINGS.format,
      offer: typeof parsed.offer === 'string' ? parsed.offer : DEFAULT_SETTINGS.offer,
      area: typeof parsed.area === 'string' ? parsed.area : DEFAULT_SETTINGS.area,
      booking: typeof parsed.booking === 'string' ? parsed.booking : DEFAULT_SETTINGS.booking,
      phone: typeof parsed.phone === 'string' ? parsed.phone : DEFAULT_SETTINGS.phone,
      notes: typeof parsed.notes === 'string' ? parsed.notes : DEFAULT_SETTINGS.notes,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(loadInitialTheme);
  const [hubTab, setHubTab] = useState<HubTab>('cloud');
  const [settings, setSettings] = useState<CampaignSettings>(loadInitialSettings);
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [editingAdIndex, setEditingAdIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('Ready to generate your campaign.');
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);

  // Auth & Workspace token state
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Firestore campaigns & Workspace links
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkedWorkspaceRefs>({
    linkedSheetId: '',
    linkedSheetName: '',
    linkedDriveFileId: '',
    linkedDriveFileName: '',
  });

  // Confirmation modal state
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  // Sync <html> .dark class and persist theme choice
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(LOCAL_THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const unsub = initAuth((nextUser, nextToken) => {
      setUser(nextUser);
      setAccessToken(nextToken);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setSavedCampaigns([]);
      return;
    }
    const unsub = subscribeToUserCampaigns(
      user.uid,
      (items) => {
        setSavedCampaigns(items);
      },
      (err) => {
        setStatus(`Could not load saved campaigns: ${err.message}`);
      }
    );
    return () => unsub();
  }, [authReady, user]);

  const handleSignIn = async (): Promise<string | null> => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setAccessToken(res.accessToken);
      setStatus(`Signed in as ${res.user.displayName || res.user.email || 'Tidyups User'}.`);
      return res.accessToken;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Google sign-in was not completed: ${msg}`);
      return null;
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setActiveCampaignId(null);
    setSavedCampaigns([]);
    setStatus('Signed out.');
  };

  const updateSetting = <K extends keyof CampaignSettings>(
    key: K,
    value: CampaignSettings[K]
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'service' && (!prev.title || prev.title.endsWith('Campaign'))) {
        next.title = `${SERVICE_DATA[value as ServiceKey].name} Campaign`;
      }
      return next;
    });
  };

  const handleGenerate = () => {
    if (!/^https:\/\//i.test(settings.booking.trim())) {
      setStatus('Please enter a secure booking URL beginning with https://');
      return;
    }
    const nextAds = generateAds(settings);
    setAds(nextAds);
    setEditingAdIndex(null);
    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
    setStatus(
      `Generated ${nextAds.length} ad variations for ${SERVICE_DATA[settings.service].name}.`
    );
  };

  const copyText = async (text: string, badgeId: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopiedBadge(badgeId);
    setStatus('Copied to clipboard.');
    setTimeout(() => {
      setCopiedBadge((prev) => (prev === badgeId ? null : prev));
    }, 1800);
  };

  const handleSaveCampaignToCloud = async (overrideLinks?: LinkedWorkspaceRefs) => {
    if (!user) {
      const token = await handleSignIn();
      if (!token) return;
    }
    try {
      const effectiveLinks = overrideLinks ?? links;
      const savedId = await saveCampaignWithAdsToFirestore({
        existingCampaignId: activeCampaignId,
        settings,
        ads,
        links: effectiveLinks,
      });
      setActiveCampaignId(savedId);
      setStatus(
        activeCampaignId
          ? `Updated campaign "${settings.title}" in Firebase.`
          : `Saved campaign "${settings.title}" to Firebase.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to save campaign: ${msg}`);
    }
  };

  const handleLinksChange = (nextLinks: LinkedWorkspaceRefs) => {
    setLinks(nextLinks);
    if (activeCampaignId && user) {
      void updateCampaignWorkspaceLinks(activeCampaignId, nextLinks).catch((err) => {
        console.error('Failed to update campaign links:', err);
      });
    }
  };

  const handleSelectSavedCampaign = async (camp: SavedCampaign) => {
    if (!user) return;
    setStatus(`Loading "${camp.title}"…`);
    try {
      const loadedAds = await loadCampaignAdsFromFirestore(camp.id, user.uid);
      setActiveCampaignId(camp.id);
      setSettings({
        title: camp.title,
        service: camp.service,
        tone: camp.tone,
        count: [3, 5, 10].includes(camp.adCount) ? camp.adCount : 5,
        format: camp.format,
        offer: camp.offer,
        area: camp.area,
        booking: camp.bookingUrl,
        phone: camp.businessPhone,
        notes: camp.notes,
      });
      setLinks({
        linkedSheetId: camp.linkedSheetId,
        linkedSheetName: camp.linkedSheetName,
        linkedDriveFileId: camp.linkedDriveFileId,
        linkedDriveFileName: camp.linkedDriveFileName,
      });
      setAds(loadedAds);
      setEditingAdIndex(null);
      setStatus(`Loaded saved campaign "${camp.title}" (${loadedAds.length} ads).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load campaign ads: ${msg}`);
    }
  };

  const handleNewCampaignDraft = () => {
    setActiveCampaignId(null);
    setLinks({
      linkedSheetId: '',
      linkedSheetName: '',
      linkedDriveFileId: '',
      linkedDriveFileName: '',
    });
    setStatus('Started a new unsaved campaign draft.');
  };

  const handleRequestDeleteCampaign = (camp: SavedCampaign) => {
    setConfirmation({
      title: `Delete saved campaign "${camp.title}"?`,
      description: `This removes "${camp.title}" and its ${camp.adCount} saved ad variation(s) from Firebase Firestore. Any exported Google Sheets or Drive files will remain in your Google Drive.`,
      confirmLabel: 'Delete Campaign',
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        try {
          await deleteCampaignFromFirestore(camp.id, user.uid);
          if (activeCampaignId === camp.id) {
            handleNewCampaignDraft();
          }
          setStatus(`Deleted saved campaign "${camp.title}".`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setStatus(`Failed to delete campaign: ${msg}`);
        } finally {
          setConfirmation(null);
        }
      },
    });
  };

  const updateSingleAdField = (
    index: number,
    field: keyof Pick<
      GeneratedAd,
      'headline' | 'primary_text' | 'description' | 'image_prompt' | 'video_script'
    >,
    value: string
  ) => {
    setAds((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const inputClass =
    'w-full p-3 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-sm text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2';

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f7fc] dark:bg-[#0f0b18] text-[#241436] dark:text-slate-100 transition-colors duration-150">
      {/* Clean 3-Zone Top Bar */}
      <header className="bg-white dark:bg-[#140e21] border-b border-[#e8e1ef] dark:border-[#2a203f] print:hidden">
        <div className="max-w-[1200px] mx-auto px-5 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Adaptive Light/Dark Brand Lockup */}
          <a
            href="#builder"
            className="focus-visible:outline-3 focus-visible:outline-[#e987cc] rounded-xl shrink-0"
          >
            <TidyupsLogoLockup variant={theme} />
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6c6277] dark:text-slate-300">
            <a
              href="#builder"
              className="hover:text-[#56249a] dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0"
            >
              Builder
            </a>
            <a
              href="#workspace-hub"
              onClick={() => setHubTab('cloud')}
              className="hover:text-[#56249a] dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0"
            >
              Cloud &amp; Sheets
            </a>
            <a
              href="#workspace-hub"
              onClick={() => setHubTab('logos')}
              className="hover:text-[#56249a] dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0"
            >
              Brand Logos
            </a>
            <a
              href="#ad-results"
              className="hover:text-[#56249a] dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0"
            >
              Ad Variations
            </a>
          </nav>

          {/* Zone 3: Single Auth Action */}
          <div className="flex items-center shrink-0">
            {!user ? (
              <GoogleSignInButton
                onClick={() => {
                  void handleSignIn();
                }}
                disabled={isSigningIn}
                label="Sign in with Google"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  void handleSignOut();
                }}
                title={`Signed in as ${user.displayName || user.email || 'User'}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-[#faf3fc] dark:bg-[#211934] hover:bg-[#f4e9fa] dark:hover:bg-[#2a2042] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Workspace Subheader + Light / Dark Theme Switch */}
      <div className="max-w-[1200px] w-full mx-auto px-5 pt-6 pb-1 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#241436] dark:text-white m-0">
            Tidyups Facebook &amp; Instagram Ads Creator
          </h1>
          <p className="text-xs sm:text-sm text-[#6c6277] dark:text-slate-400 mt-1 mb-0">
            Edmonton, Alberta · Campaign copy, creative prompts, video scripts &amp; brand assets
          </p>
        </div>

        {/* Interactive Light / Dark Theme Segmented Control */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHubTab('logos')}
            className="px-3 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#181226] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#221936] whitespace-nowrap shrink-0 cursor-pointer"
          >
            View Light &amp; Dark Logos
          </button>

          <div
            role="group"
            aria-label="Color theme toggle"
            className="inline-flex items-center p-1 rounded-xl bg-[#ede6f6] dark:bg-[#1a1329] border border-[#dfd3ee] dark:border-[#2d2342]"
          >
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'light'
                  ? 'bg-white text-[#241436] shadow-xs'
                  : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#2c2046] text-white shadow-xs'
                  : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <main className="max-w-[1200px] w-full mx-auto my-6 px-5 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6 flex-1 print:block">
        {/* Left Column: Campaign Settings */}
        <section
          id="builder"
          aria-label="Campaign settings"
          className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 self-start print:hidden"
        >
          <h2 className="text-lg font-bold text-[#241436] dark:text-slate-100 mb-2">
            Build your campaign
          </h2>
          <p className="text-xs text-[#6c6277] dark:text-slate-400 leading-relaxed mb-4">
            Configure service type, advertising angle, and offer details to generate Meta-ready ad variations.
          </p>

          <label
            htmlFor="campaign-title"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Campaign name
          </label>
          <input
            id="campaign-title"
            value={settings.title}
            maxLength={BLUEPRINT_LIMITS.titleMax}
            onChange={(e) => updateSetting('title', e.target.value)}
            placeholder="e.g., Spring Move-Out Campaign"
            className={inputClass}
          />

          <label
            htmlFor="service"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Cleaning service
          </label>
          <select
            id="service"
            value={settings.service}
            onChange={(e) => updateSetting('service', e.target.value as ServiceKey)}
            className={inputClass}
          >
            {(Object.keys(SERVICE_DATA) as ServiceKey[]).map((key) => (
              <option key={key} value={key}>
                {SERVICE_DATA[key].name}
              </option>
            ))}
          </select>

          <label
            htmlFor="tone"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Advertising angle
          </label>
          <select
            id="tone"
            value={settings.tone}
            onChange={(e) => updateSetting('tone', e.target.value as ToneKey)}
            className={inputClass}
          >
            {(Object.keys(TONE_LABELS) as ToneKey[]).map((key) => (
              <option key={key} value={key}>
                {TONE_LABELS[key]}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="count"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
              >
                Variations
              </label>
              <select
                id="count"
                value={settings.count}
                onChange={(e) => updateSetting('count', Number(e.target.value))}
                className={`${inputClass} tabular-nums`}
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="format"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
              >
                Creative format
              </label>
              <select
                id="format"
                value={settings.format}
                onChange={(e) => updateSetting('format', e.target.value as CreativeFormat)}
                className={`${inputClass} tabular-nums`}
              >
                {(Object.keys(FORMAT_LABELS) as CreativeFormat[]).map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {FORMAT_LABELS[fmt]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label
            htmlFor="offer"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Special offer (optional)
          </label>
          <input
            id="offer"
            value={settings.offer}
            maxLength={BLUEPRINT_LIMITS.offerMax}
            onChange={(e) => updateSetting('offer', e.target.value)}
            placeholder="e.g., 10% off first deep clean"
            className={inputClass}
          />

          <label
            htmlFor="area"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Target area
          </label>
          <input
            id="area"
            value={settings.area}
            maxLength={BLUEPRINT_LIMITS.areaMax}
            onChange={(e) => updateSetting('area', e.target.value)}
            className={inputClass}
          />

          <label
            htmlFor="booking"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Booking page
          </label>
          <input
            id="booking"
            value={settings.booking}
            maxLength={BLUEPRINT_LIMITS.bookingUrlMax}
            onChange={(e) => updateSetting('booking', e.target.value)}
            className={inputClass}
          />

          <label
            htmlFor="phone"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Phone
          </label>
          <input
            id="phone"
            value={settings.phone}
            maxLength={BLUEPRINT_LIMITS.phoneMax}
            onChange={(e) => updateSetting('phone', e.target.value)}
            className={`${inputClass} tabular-nums`}
          />

          <label
            htmlFor="notes"
            className="block text-xs font-bold text-[#241436] dark:text-slate-200 mt-3.5 mb-1.5"
          >
            Additional instructions
          </label>
          <textarea
            id="notes"
            value={settings.notes}
            maxLength={BLUEPRINT_LIMITS.notesMax}
            onChange={(e) => updateSetting('notes', e.target.value)}
            placeholder="Mention pet-friendly homes, move-out deadlines, etc."
            className={`${inputClass} min-h-[76px] resize-y`}
          />

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full mt-5 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Generate Facebook Ads
          </button>

          <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-3 mb-0 leading-relaxed">
            Settings auto-save locally in this browser, and signed-in users can sync campaigns to Firebase or Google Workspace.
          </p>
        </section>

        {/* Right Column: Workspace Hub + Campaign Export + Generated Ads */}
        <section className="min-w-0">
          <WorkspaceHub
            activeTab={hubTab}
            onTabChange={setHubTab}
            user={user}
            accessToken={accessToken}
            isSigningIn={isSigningIn}
            onSignIn={handleSignIn}
            settings={settings}
            ads={ads}
            activeCampaignId={activeCampaignId}
            savedCampaigns={savedCampaigns}
            links={links}
            onLinksChange={handleLinksChange}
            onSaveCampaign={handleSaveCampaignToCloud}
            onSelectCampaign={handleSelectSavedCampaign}
            onNewCampaignDraft={handleNewCampaignDraft}
            onDeleteCampaign={handleRequestDeleteCampaign}
            onRequestConfirmation={(nextConfirm) =>
              setConfirmation({
                ...nextConfirm,
                onConfirm: async () => {
                  try {
                    await nextConfirm.onConfirm();
                  } finally {
                    setConfirmation(null);
                  }
                },
              })
            }
            onStatus={setStatus}
            onTokenExpired={() => {
              clearAccessToken();
              setAccessToken(null);
            }}
          />

          {/* Local Export & Status Bar */}
          <div className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 mb-6 print:hidden">
            <h2 className="text-lg font-bold text-[#241436] dark:text-slate-100 mb-1.5">
              Campaign workspace
            </h2>
            <p className="text-sm text-[#6c6277] dark:text-slate-300 m-0">
              Generate conversion-focused headlines, primary text, descriptions, image prompts, and short-video scripts. Edit any ad inline, copy a single variation, or export the full set.
            </p>

            <div className="flex flex-wrap gap-2.5 mt-4 mb-3">
              <button
                type="button"
                onClick={() => {
                  if (!ads.length) {
                    setStatus('Generate ads first.');
                    return;
                  }
                  triggerBrowserDownload(
                    'tidyups-facebook-ads.csv',
                    adsToCsv(ads),
                    'text/csv;charset=utf-8'
                  );
                  setStatus('Downloaded CSV file.');
                }}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-[#211934] border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] font-bold text-xs px-3.5 py-2.5 rounded-xl hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!ads.length) {
                    setStatus('Generate ads first.');
                    return;
                  }
                  triggerBrowserDownload(
                    'tidyups-facebook-ads.json',
                    adsToJson(ads, settings.title),
                    'application/json'
                  );
                  setStatus('Downloaded JSON file.');
                }}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-[#211934] border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] font-bold text-xs px-3.5 py-2.5 rounded-xl hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!ads.length) {
                    setStatus('Generate ads first.');
                    return;
                  }
                  void copyText(formatAllAdsPlainText(ads), 'all');
                }}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-[#211934] border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] font-bold text-xs px-3.5 py-2.5 rounded-xl hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedBadge === 'all' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy all ads
              </button>
            </div>

            <p
              aria-live="polite"
              className="text-xs font-semibold text-[#56249a] dark:text-[#c084fc] m-0"
            >
              {status}
            </p>
          </div>

          {/* Results List */}
          <div id="ad-results">
            {ads.length === 0 ? (
              <div className="py-12 px-6 text-center text-[#6c6277] dark:text-slate-400 border border-dashed border-[#d9c9e5] dark:border-[#35294f] rounded-2xl bg-white dark:bg-[#181226] text-sm">
                <p className="m-0 mb-3">
                  Select your campaign options and generate variations, or load a saved cloud campaign.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] hover:opacity-95 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Sample Campaign
                </button>
              </div>
            ) : (
              ads.map((ad, idx) => {
                const isEditing = editingAdIndex === idx;
                return (
                  <article
                    key={ad.id || idx}
                    className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 mb-4 break-inside-avoid"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Unboxed Clean Metadata Line */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6c6277] dark:text-slate-400 tabular-nums">
                          <span className="text-[#56249a] dark:text-[#c084fc] font-bold">
                            0{ad.number}. Variation
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{ad.format}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ad.service}</span>
                        </div>

                        {isEditing ? (
                          <input
                            type="text"
                            value={ad.headline}
                            maxLength={BLUEPRINT_LIMITS.headlineMax}
                            onChange={(e) =>
                              updateSingleAdField(idx, 'headline', e.target.value)
                            }
                            className={`mt-2 ${inputClass} font-bold text-base`}
                          />
                        ) : (
                          <h3 className="text-lg font-bold text-[#241436] dark:text-white mt-1.5 mb-0">
                            {ad.headline}
                          </h3>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingAdIndex(isEditing ? null : idx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] print:hidden whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-[#f0eaf7] dark:border-[#251c38]">
                      <div className="text-xs font-bold text-[#7f6e8a] dark:text-slate-400 mb-1">
                        Primary text
                      </div>
                      {isEditing ? (
                        <textarea
                          value={ad.primary_text}
                          maxLength={BLUEPRINT_LIMITS.primaryTextMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'primary_text', e.target.value)
                          }
                          className={`${inputClass} min-h-[110px]`}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm text-[#241436] dark:text-slate-200">
                          {ad.primary_text}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5">
                      <div className="text-xs font-bold text-[#7f6e8a] dark:text-slate-400 mb-1">
                        Description
                      </div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={ad.description}
                          maxLength={BLUEPRINT_LIMITS.descriptionMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'description', e.target.value)
                          }
                          className={inputClass}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm text-[#241436] dark:text-slate-200">
                          {ad.description}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5">
                      <div className="text-xs font-bold text-[#7f6e8a] dark:text-slate-400 mb-1">
                        Destination
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed text-sm text-[#56249a] dark:text-[#c084fc] break-all">
                        {ad.destination_url}
                      </div>
                    </div>

                    <div className="mt-3.5">
                      <div className="text-xs font-bold text-[#7f6e8a] dark:text-slate-400 mb-1">
                        Image generation prompt
                      </div>
                      {isEditing ? (
                        <textarea
                          value={ad.image_prompt}
                          maxLength={BLUEPRINT_LIMITS.promptMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'image_prompt', e.target.value)
                          }
                          className={`${inputClass} min-h-[90px]`}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm text-[#241436] dark:text-slate-200">
                          {ad.image_prompt}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5">
                      <div className="text-xs font-bold text-[#7f6e8a] dark:text-slate-400 mb-1">
                        10-second video script
                      </div>
                      {isEditing ? (
                        <textarea
                          value={ad.video_script}
                          maxLength={BLUEPRINT_LIMITS.scriptMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'video_script', e.target.value)
                          }
                          className={`${inputClass} min-h-[100px]`}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm text-[#241436] dark:text-slate-200">
                          {ad.video_script}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 pt-3.5 border-t border-[#f0eaf7] dark:border-[#251c38] print:hidden">
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            `${ad.headline}\n\n${ad.primary_text}\n\n${ad.description}`,
                            `copy-text-${idx}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 bg-white dark:bg-[#211934] border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copiedBadge === `copy-text-${idx}` ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        Copy ad copy
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void copyText(ad.image_prompt, `copy-prompt-${idx}`)
                        }
                        className="inline-flex items-center gap-1.5 bg-white dark:bg-[#211934] border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copiedBadge === `copy-prompt-${idx}` ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        Copy image prompt
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void copyText(ad.video_script, `copy-script-${idx}`)
                        }
                        className="inline-flex items-center gap-1.5 bg-white dark:bg-[#211934] border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copiedBadge === `copy-script-${idx}` ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        Copy video script
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-[1200px] w-full mx-auto px-5 pt-3 pb-8 text-[#766684] dark:text-slate-400 text-xs leading-relaxed tabular-nums print:hidden">
        Tidyups Cleaning Service Inc. · Edmonton, AB · 780-718-5092 ·{' '}
        <a
          href="https://tidyupscleaning.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[#56249a] dark:hover:text-[#c084fc]"
        >
          tidyupscleaning.com
        </a>
        <br />
        Campaign drafts require review before publishing. Promotions apply only when approved by Tidyups Cleaning Service Inc.
      </footer>

      <ConfirmModal
        confirmation={confirmation}
        onCancel={() => setConfirmation(null)}
      />
    </div>
  );
};

export default App;
