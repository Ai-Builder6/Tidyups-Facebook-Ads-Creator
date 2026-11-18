import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Check, Copy, Download, Edit3, LogOut, Sparkles } from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { WorkspaceHub } from './components/WorkspaceHub';
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

function loadInitialSettings(): CampaignSettings {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CampaignSettings>;
    return {
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : DEFAULT_SETTINGS.title,
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

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5fb] text-[#241436]">
      {/* Brand Header */}
      <header className="bg-gradient-to-r from-[#452088] via-[#8f36ae] to-[#ec5aa8] text-white shadow-[0_8px_20px_#3012471a] print:hidden">
        <div className="max-w-[1200px] mx-auto px-[18px] py-[24px] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="bg-white rounded-2xl w-[52px] h-[52px] grid place-items-center text-[29px] shadow-xs shrink-0"
            >
              🐰
            </div>
            <div>
              <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight leading-tight m-0">
                Tidyups Ads Creator
              </h1>
              <div className="text-sm text-white/90 mt-1">
                Facebook + Instagram campaign builder · Edmonton, Alberta
              </div>
            </div>
          </div>

          {/* Header Auth Bar */}
          <div className="flex items-center gap-2.5">
            {!user ? (
              <GoogleSignInButton
                onClick={() => {
                  void handleSignIn();
                }}
                disabled={isSigningIn}
                label="Sign in with Google"
              />
            ) : (
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xs border border-white/25 rounded-full pl-3 pr-2 py-1.5">
                <div className="text-xs leading-tight">
                  <div className="font-bold truncate max-w-[180px]">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-[11px] text-white/80">
                    {accessToken ? 'Drive, Sheets & Picker ready' : 'Signed in (click Workspace to connect Drive)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleSignOut();
                  }}
                  title="Sign out"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-xs font-semibold cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-[1200px] w-full mx-auto my-7 px-[18px] grid grid-cols-1 lg:grid-cols-[350px_minmax(0,1fr)] gap-[23px] flex-1 print:block">
        {/* Left Column: Campaign Settings */}
        <section
          aria-label="Campaign settings"
          className="bg-white border border-[#e8e1ef] rounded-[18px] p-[23px] shadow-[0_5px_22px_#3318490b] self-start print:hidden"
        >
          <h2 className="text-lg font-bold mb-3">Build your campaign</h2>
          <div className="p-3 bg-[#faf3fc] rounded-xl border border-[#f0dff1] text-[#644475] text-[13px] leading-snug">
            Conversion-focused ad copy, creative prompts, and 10s video scripts synced with Firebase, Google Sheets, and Google Drive.
          </div>

          <label htmlFor="campaign-title" className="block text-[13px] font-bold mt-4 mb-1.5">
            Campaign name
          </label>
          <input
            id="campaign-title"
            value={settings.title}
            maxLength={BLUEPRINT_LIMITS.titleMax}
            onChange={(e) => updateSetting('title', e.target.value)}
            placeholder="e.g., Spring Move-Out Campaign"
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          />

          <label htmlFor="service" className="block text-[13px] font-bold mt-3.5 mb-1.5">
            Cleaning service
          </label>
          <select
            id="service"
            value={settings.service}
            onChange={(e) => updateSetting('service', e.target.value as ServiceKey)}
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          >
            {(Object.keys(SERVICE_DATA) as ServiceKey[]).map((key) => (
              <option key={key} value={key}>
                {SERVICE_DATA[key].name}
              </option>
            ))}
          </select>

          <label htmlFor="tone" className="block text-[13px] font-bold mt-3.5 mb-1.5">
            Advertising angle
          </label>
          <select
            id="tone"
            value={settings.tone}
            onChange={(e) => updateSetting('tone', e.target.value as ToneKey)}
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          >
            {(Object.keys(TONE_LABELS) as ToneKey[]).map((key) => (
              <option key={key} value={key}>
                {TONE_LABELS[key]}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="count" className="block text-[13px] font-bold mt-3.5 mb-1.5">
                Variations
              </label>
              <select
                id="count"
                value={settings.count}
                onChange={(e) => updateSetting('count', Number(e.target.value))}
                className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            <div>
              <label htmlFor="format" className="block text-[13px] font-bold mt-3.5 mb-1.5">
                Creative format
              </label>
              <select
                id="format"
                value={settings.format}
                onChange={(e) => updateSetting('format', e.target.value as CreativeFormat)}
                className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
              >
                {(Object.keys(FORMAT_LABELS) as CreativeFormat[]).map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {FORMAT_LABELS[fmt]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor="offer" className="block text-[13px] font-bold mt-3.5 mb-1.5">
            Special offer (optional)
          </label>
          <input
            id="offer"
            value={settings.offer}
            maxLength={BLUEPRINT_LIMITS.offerMax}
            onChange={(e) => updateSetting('offer', e.target.value)}
            placeholder="e.g., 10% off first deep clean"
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          />

          <label htmlFor="area" className="block text-[13px] font-bold mt-3.5 mb-1.5">
            Target area
          </label>
          <input
            id="area"
            value={settings.area}
            maxLength={BLUEPRINT_LIMITS.areaMax}
            onChange={(e) => updateSetting('area', e.target.value)}
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          />

          <label htmlFor="booking" className="block text-[13px] font-bold mt-3.5 mb-1.5">
            Booking page
          </label>
          <input
            id="booking"
            value={settings.booking}
            maxLength={BLUEPRINT_LIMITS.bookingUrlMax}
            onChange={(e) => updateSetting('booking', e.target.value)}
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          />

          <label htmlFor="phone" className="block text-[13px] font-bold mt-3.5 mb-1.5">
            Phone
          </label>
          <input
            id="phone"
            value={settings.phone}
            maxLength={BLUEPRINT_LIMITS.phoneMax}
            onChange={(e) => updateSetting('phone', e.target.value)}
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          />

          <label htmlFor="notes" className="block text-[13px] font-bold mt-3.5 mb-1.5">
            Additional instructions
          </label>
          <textarea
            id="notes"
            value={settings.notes}
            maxLength={BLUEPRINT_LIMITS.notesMax}
            onChange={(e) => updateSetting('notes', e.target.value)}
            placeholder="Mention pet-friendly homes, move-out deadlines, etc."
            className="w-full p-3 border border-[#d8cde3] rounded-[11px] bg-white text-sm min-h-[76px] resize-y focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2"
          />

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full mt-4 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Generate Facebook Ads
          </button>

          <p className="text-xs text-[#6c6277] mt-3 mb-0 leading-relaxed">
            Settings auto-save locally in this browser, and signed-in users can save campaigns to Firebase or Google Workspace.
          </p>
        </section>

        {/* Right Column: Workspace Hub + Campaign Export + Generated Ads */}
        <section className="min-w-0">
          <WorkspaceHub
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
          <div className="bg-white border border-[#e8e1ef] rounded-[18px] p-[22px] shadow-[0_5px_22px_#3318490b] mb-5 print:hidden">
            <h2 className="text-lg font-bold mb-1.5">Campaign workspace</h2>
            <p className="text-sm text-[#6c6277] m-0">
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
                className="inline-flex items-center gap-1.5 bg-white border border-[#d9c9e5] text-[#56249a] font-bold text-xs px-3.5 py-2.5 rounded-[10px] hover:bg-[#faf3fc] cursor-pointer"
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
                className="inline-flex items-center gap-1.5 bg-white border border-[#d9c9e5] text-[#56249a] font-bold text-xs px-3.5 py-2.5 rounded-[10px] hover:bg-[#faf3fc] cursor-pointer"
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
                className="inline-flex items-center gap-1.5 bg-white border border-[#d9c9e5] text-[#56249a] font-bold text-xs px-3.5 py-2.5 rounded-[10px] hover:bg-[#faf3fc] cursor-pointer"
              >
                {copiedBadge === 'all' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy all ads
              </button>
            </div>

            <p aria-live="polite" className="text-xs font-medium text-[#56249a] m-0">
              {status}
            </p>
          </div>

          {/* Results List */}
          <div>
            {ads.length === 0 ? (
              <div className="py-10 px-6 text-center text-[#6c6277] border-2 border-dashed border-[#e5d6ed] rounded-2xl bg-white/60 text-sm">
                Select your options and click <b>Generate Facebook Ads</b> (or load a saved cloud campaign) to start.
              </div>
            ) : (
              ads.map((ad, idx) => {
                const isEditing = editingAdIndex === idx;
                return (
                  <article
                    key={ad.id || idx}
                    className="bg-white border border-[#e8e1ef] rounded-[18px] p-[22px] shadow-[0_5px_22px_#3318490b] mb-4 break-inside-avoid"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-block rounded-full px-2.5 py-1 text-[#56249a] bg-[#f4e9fa] text-[11px] font-extrabold">
                            Ad {ad.number}
                          </span>
                          <span className="inline-block rounded-full px-2.5 py-1 text-[#56249a] bg-[#f4e9fa] text-[11px] font-extrabold">
                            {ad.format}
                          </span>
                          <span className="inline-block rounded-full px-2.5 py-1 text-[#644475] bg-[#faf3fc] text-[11px] font-semibold">
                            {ad.service}
                          </span>
                        </div>

                        {isEditing ? (
                          <input
                            type="text"
                            value={ad.headline}
                            maxLength={BLUEPRINT_LIMITS.headlineMax}
                            onChange={(e) =>
                              updateSingleAdField(idx, 'headline', e.target.value)
                            }
                            className="mt-2.5 w-full px-3 py-2 rounded-xl border border-[#d8cde3] text-base font-bold text-[#241436]"
                          />
                        ) : (
                          <h3 className="text-lg font-bold mt-2.5 mb-0">{ad.headline}</h3>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingAdIndex(isEditing ? null : idx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] text-xs font-bold text-[#56249a] hover:bg-[#faf3fc] print:hidden cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                    </div>

                    <div className="mt-3.5">
                      <b className="block text-xs tracking-wider uppercase text-[#7f6e8a] mb-1">
                        Primary text
                      </b>
                      {isEditing ? (
                        <textarea
                          value={ad.primary_text}
                          maxLength={BLUEPRINT_LIMITS.primaryTextMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'primary_text', e.target.value)
                          }
                          className="w-full p-2.5 rounded-xl border border-[#d8cde3] text-sm min-h-[110px]"
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
                          {ad.primary_text}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5">
                      <b className="block text-xs tracking-wider uppercase text-[#7f6e8a] mb-1">
                        Description
                      </b>
                      {isEditing ? (
                        <input
                          type="text"
                          value={ad.description}
                          maxLength={BLUEPRINT_LIMITS.descriptionMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'description', e.target.value)
                          }
                          className="w-full p-2.5 rounded-xl border border-[#d8cde3] text-sm"
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
                          {ad.description}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5">
                      <b className="block text-xs tracking-wider uppercase text-[#7f6e8a] mb-1">
                        Destination
                      </b>
                      <div className="whitespace-pre-wrap leading-relaxed text-sm break-all">
                        {ad.destination_url}
                      </div>
                    </div>

                    <div className="mt-3.5">
                      <b className="block text-xs tracking-wider uppercase text-[#7f6e8a] mb-1">
                        Image generation prompt
                      </b>
                      {isEditing ? (
                        <textarea
                          value={ad.image_prompt}
                          maxLength={BLUEPRINT_LIMITS.promptMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'image_prompt', e.target.value)
                          }
                          className="w-full p-2.5 rounded-xl border border-[#d8cde3] text-sm min-h-[90px]"
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
                          {ad.image_prompt}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5">
                      <b className="block text-xs tracking-wider uppercase text-[#7f6e8a] mb-1">
                        10-second video script
                      </b>
                      {isEditing ? (
                        <textarea
                          value={ad.video_script}
                          maxLength={BLUEPRINT_LIMITS.scriptMax}
                          onChange={(e) =>
                            updateSingleAdField(idx, 'video_script', e.target.value)
                          }
                          className="w-full p-2.5 rounded-xl border border-[#d8cde3] text-sm min-h-[100px]"
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
                          {ad.video_script}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 print:hidden">
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            `${ad.headline}\n\n${ad.primary_text}\n\n${ad.description}`,
                            `copy-text-${idx}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 bg-white border border-[#d9c9e5] text-[#56249a] font-bold text-xs px-3 py-2 rounded-[10px] hover:bg-[#faf3fc] cursor-pointer"
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
                        className="inline-flex items-center gap-1.5 bg-white border border-[#d9c9e5] text-[#56249a] font-bold text-xs px-3 py-2 rounded-[10px] hover:bg-[#faf3fc] cursor-pointer"
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
                        className="inline-flex items-center gap-1.5 bg-white border border-[#d9c9e5] text-[#56249a] font-bold text-xs px-3 py-2 rounded-[10px] hover:bg-[#faf3fc] cursor-pointer"
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

      <footer className="max-w-[1200px] w-full mx-auto px-[18px] pt-2.5 pb-7 text-[#766684] text-xs leading-relaxed print:hidden">
        Tidyups Cleaning Service Inc. · Edmonton, AB · 780-718-5092 ·{' '}
        <a
          href="https://tidyupscleaning.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[#56249a]"
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
