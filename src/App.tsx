import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  Film,
  FolderUp,
  Image as ImageIcon,
  LogOut,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-react';
import { BookingPage } from './components/BookingPage';
import { ConfirmModal } from './components/ConfirmModal';
import { ContactPage } from './components/ContactPage';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { ImageCreatorPage } from './components/ImageCreatorPage';
import { PrivacyPage } from './components/PrivacyPage';
import { SupportPage } from './components/SupportPage';
import { TermsPage } from './components/TermsPage';
import { ThemeMode, TidyupsLogoLockup } from './components/TidyupsLogo';
import { VideoCreatorPage } from './components/VideoCreatorPage';
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
import { deleteCachedFullMediaFromBrowser } from './services/creativeApi';
import {
  loadLocalBookings,
  loadLocalInquiries,
  subscribeToUserBookings,
  subscribeToUserInquiries,
} from './services/customerPortalStore';
import {
  deleteCreativeAssetFromFirestore,
  subscribeToPortfolioAssets,
} from './services/portfolioStore';
import { generateAndDownloadMetaAppSetupZip } from './services/metaAppSetupKit';
import {
  createNewCampaignSpreadsheet,
  LeadsAdsFolderBundleResult,
  uploadLeadsAdsFolderBundle,
} from './services/workspaceApi';
import {
  AppPage,
  BLUEPRINT_LIMITS,
  BookingRequestRecord,
  CampaignSettings,
  CreativeAsset,
  CreativeFormat,
  CustomerInquiryRecord,
  GeneratedAd,
  PendingConfirmation,
  SavedCampaign,
  SheetMetadata,
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
import {
  OFFICIAL_BOOKING_URL,
  OFFICIAL_BRAND_NAME,
  OFFICIAL_EMAIL,
  OFFICIAL_FACEBOOK_URL,
  OFFICIAL_PHONE,
  OFFICIAL_PHONE_HREF,
  PAGE_PATHS,
  PAGE_TITLES,
  resolvePageFromPath,
} from './utils/routing';

const LOCAL_SETTINGS_KEY = 'tidyups-settings-v2';
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
      phone:
        typeof parsed.phone === 'string' && parsed.phone.trim()
          ? parsed.phone
          : DEFAULT_SETTINGS.phone,
      notes: typeof parsed.notes === 'string' ? parsed.notes : DEFAULT_SETTINGS.notes,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(loadInitialTheme);
  const [activePage, setActivePage] = useState<AppPage>(() =>
    typeof window !== 'undefined' ? resolvePageFromPath(window.location.pathname) : 'campaigns'
  );
  const [hubTab, setHubTab] = useState<HubTab>('cloud');
  const [settings, setSettings] = useState<CampaignSettings>(loadInitialSettings);
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [editingAdIndex, setEditingAdIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('Ready to generate your campaign.');
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);

  // Handoff state from Campaign Ads -> Image / Video Creators
  const [handoffImagePrompt, setHandoffImagePrompt] = useState<string>('');
  const [handoffImageTitle, setHandoffImageTitle] = useState<string>('');
  const [handoffVideoPrompt, setHandoffVideoPrompt] = useState<string>('');
  const [handoffVideoTitle, setHandoffVideoTitle] = useState<string>('');

  // Auth & Workspace token state
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // 1-Click Google Workspace export & Meta Setup ZIP state
  const [workspaceBusyAction, setWorkspaceBusyAction] = useState<string | null>(null);
  const [lastLeadsBundle, setLastLeadsBundle] = useState<LeadsAdsFolderBundleResult | null>(null);

  const handleQuickDownloadMetaSetupZip = async () => {
    setWorkspaceBusyAction('meta-zip');
    setStatus('Building Meta App Setup Kit (.zip) with 1024×1024 App Icon and all Meta URLs…');
    try {
      const result = await generateAndDownloadMetaAppSetupZip();
      setHubTab('meta');
      setStatus(
        `Downloaded ${result.fileName} (${result.fileCount} files ready for developers.facebook.com).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to generate Meta App Setup ZIP: ${msg}`);
    } finally {
      setWorkspaceBusyAction(null);
    }
  };

  // Firestore campaigns, creative portfolio, bookings, inquiries & Workspace links
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [portfolioAssets, setPortfolioAssets] = useState<CreativeAsset[]>([]);
  const [cloudBookings, setCloudBookings] = useState<BookingRequestRecord[]>([]);
  const [localBookings, setLocalBookings] = useState<BookingRequestRecord[]>(loadLocalBookings);
  const [cloudInquiries, setCloudInquiries] = useState<CustomerInquiryRecord[]>([]);
  const [localInquiries, setLocalInquiries] = useState<CustomerInquiryRecord[]>(loadLocalInquiries);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkedWorkspaceRefs>({
    linkedSheetId: '',
    linkedSheetName: '',
    linkedDriveFileId: '',
    linkedDriveFileName: '',
  });

  // Confirmation modal state
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const navigateToPage = (nextPage: AppPage) => {
    setActivePage(nextPage);
    if (typeof window !== 'undefined') {
      const targetPath = PAGE_PATHS[nextPage];
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Sync browser Back/Forward navigation and document title
  useEffect(() => {
    const handlePopState = () => {
      setActivePage(resolvePageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.title = PAGE_TITLES[activePage];
  }, [activePage]);

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
      setPortfolioAssets([]);
      setCloudBookings([]);
      setCloudInquiries([]);
      return;
    }
    const unsubCampaigns = subscribeToUserCampaigns(
      user.uid,
      (items) => {
        setSavedCampaigns(items);
      },
      (err) => {
        setStatus(`Could not load saved campaigns: ${err.message}`);
      }
    );
    const unsubPortfolio = subscribeToPortfolioAssets(
      user.uid,
      (assets) => {
        setPortfolioAssets(assets);
      },
      (err) => {
        setStatus(`Could not load creative portfolio: ${err.message}`);
      }
    );
    const unsubBookings = subscribeToUserBookings(
      user.uid,
      (items) => {
        setCloudBookings(items);
      },
      (err) => {
        setStatus(`Could not load booking requests: ${err.message}`);
      }
    );
    const unsubInquiries = subscribeToUserInquiries(
      user.uid,
      (items) => {
        setCloudInquiries(items);
      },
      (err) => {
        setStatus(`Could not load customer inquiries: ${err.message}`);
      }
    );
    return () => {
      unsubCampaigns();
      unsubPortfolio();
      unsubBookings();
      unsubInquiries();
    };
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
    setPortfolioAssets([]);
    setLastLeadsBundle(null);
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

  const ensureAdsGenerated = (): GeneratedAd[] | null => {
    if (!/^https:\/\//i.test(settings.booking.trim())) {
      setStatus('Please enter a secure booking URL beginning with https://');
      return null;
    }
    if (ads.length > 0) {
      return ads;
    }
    const nextAds = generateAds(settings);
    setAds(nextAds);
    setEditingAdIndex(null);
    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
    return nextAds;
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

  const handleLinksChange = (nextLinks: LinkedWorkspaceRefs) => {
    setLinks(nextLinks);
    if (activeCampaignId && user) {
      void updateCampaignWorkspaceLinks(activeCampaignId, nextLinks).catch((err) => {
        console.error('Failed to update campaign links:', err);
      });
    }
  };

  const handleWorkspaceError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('AUTH_EXPIRED:')) {
      clearAccessToken();
      setAccessToken(null);
      setStatus('Google Workspace session expired. Click again to reconnect Google Workspace.');
      return;
    }
    setStatus(message);
  };

  const handleSaveStyledGoogleSheet = async (): Promise<SheetMetadata | null> => {
    const readyAds = ensureAdsGenerated();
    if (!readyAds || readyAds.length === 0) return null;

    const token = accessToken ?? (await handleSignIn());
    if (!token) return null;

    setWorkspaceBusyAction('styled-sheet');
    setStatus('Creating Google Sheet with 4 bright colored tabs and styled headers…');
    try {
      const sheetTitle =
        settings.title.trim() ||
        `Tidyups — ${SERVICE_DATA[settings.service].name} (${new Date().toLocaleDateString()})`;
      const created = await createNewCampaignSpreadsheet(token, sheetTitle, settings, readyAds);
      const nextLinks: LinkedWorkspaceRefs = {
        ...links,
        linkedSheetId: created.spreadsheetId,
        linkedSheetName: created.title,
      };
      handleLinksChange(nextLinks);
      setHubTab('sheets');
      setStatus(
        `Saved ${readyAds.length} ad variations to colored-tab Google Sheet "${created.title}".`
      );
      return created;
    } catch (err) {
      handleWorkspaceError(err);
      return null;
    } finally {
      setWorkspaceBusyAction(null);
    }
  };

  const handleUploadLeadsAdsFolder = async (): Promise<LeadsAdsFolderBundleResult | null> => {
    const readyAds = ensureAdsGenerated();
    if (!readyAds || readyAds.length === 0) return null;

    const token = accessToken ?? (await handleSignIn());
    if (!token) return null;

    setWorkspaceBusyAction('leads-folder');
    setStatus(
      'Uploading "Leads Ads" folder to Google Drive (colored-tab Sheet, CSV, JSON, Lead Form kit & logos)…'
    );
    try {
      const bundle = await uploadLeadsAdsFolderBundle(token, settings, readyAds);
      setLastLeadsBundle(bundle);
      const nextLinks: LinkedWorkspaceRefs = {
        linkedSheetId: bundle.sheet.spreadsheetId,
        linkedSheetName: bundle.sheet.title,
        linkedDriveFileId: bundle.folder.id,
        linkedDriveFileName: bundle.folder.name,
      };
      handleLinksChange(nextLinks);
      setHubTab('drive');
      setStatus(
        `Uploaded "${bundle.folder.name}" to Google Drive with colored-tab Google Sheet + ${bundle.uploadedFiles.length} campaign files.`
      );
      return bundle;
    } catch (err) {
      handleWorkspaceError(err);
      return null;
    } finally {
      setWorkspaceBusyAction(null);
    }
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
      setLastLeadsBundle(null);
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
    setLastLeadsBundle(null);
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

  const handleRequestDeletePortfolioAsset = (asset: CreativeAsset) => {
    setConfirmation({
      title: `Delete "${asset.title}" from your Firestore Portfolio?`,
      description: `This removes "${asset.title}" from your Firebase Firestore creative portfolio and local media cache. Any backed-up files in Google Drive will remain untouched.`,
      confirmLabel: 'Delete Creative',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCreativeAssetFromFirestore(asset.id);
          await deleteCachedFullMediaFromBrowser(asset.id);
          setStatus(`Deleted "${asset.title}" from your Firestore portfolio.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setStatus(`Failed to delete portfolio creative: ${msg}`);
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

  const activeLeadsFolderUrl = lastLeadsBundle
    ? lastLeadsBundle.folder.webViewLink ||
      `https://drive.google.com/drive/folders/${lastLeadsBundle.folder.id}`
    : links.linkedDriveFileId && links.linkedDriveFileName.startsWith('Leads Ads —')
    ? `https://drive.google.com/drive/folders/${links.linkedDriveFileId}`
    : '';

  const activeStyledSheetUrl = lastLeadsBundle
    ? lastLeadsBundle.sheet.spreadsheetUrl
    : links.linkedSheetId
    ? `https://docs.google.com/spreadsheets/d/${links.linkedSheetId}/edit`
    : '';

  const mergedBookings = [
    ...cloudBookings,
    ...localBookings.filter(
      (local) => !cloudBookings.some((c) => c.id === local.id || c.referenceCode === local.referenceCode)
    ),
  ];

  const mergedInquiries = [
    ...cloudInquiries,
    ...localInquiries.filter(
      (local) => !cloudInquiries.some((c) => c.id === local.id || c.ticketCode === local.ticketCode)
    ),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f7fc] dark:bg-[#0f0b18] text-[#241436] dark:text-slate-100 transition-colors duration-150">
      {/* Clean 3-Zone Top Bar Contract */}
      <header className="bg-white dark:bg-[#140e21] border-b border-[#e8e1ef] dark:border-[#2a203f] print:hidden">
        <div className="max-w-[1200px] mx-auto px-5 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Adaptive Light/Dark Brand Lockup */}
          <a
            href={PAGE_PATHS.campaigns}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                e.preventDefault();
                navigateToPage('campaigns');
              }
            }}
            className="focus-visible:outline-3 focus-visible:outline-[#e987cc] rounded-xl shrink-0 cursor-pointer"
          >
            <TidyupsLogoLockup variant={theme} />
          </a>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6c6277] dark:text-slate-300">
            {(
              [
                { key: 'campaigns', label: 'Campaigns' },
                { key: 'images', label: 'Image Creator' },
                { key: 'videos', label: 'Video Creator' },
                { key: 'booking', label: 'Book Cleaning' },
              ] as Array<{ key: AppPage; label: string }>
            ).map((navItem) => {
              const isActive = activePage === navItem.key;
              return (
                <a
                  key={navItem.key}
                  href={PAGE_PATHS[navItem.key]}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                      e.preventDefault();
                      navigateToPage(navItem.key);
                    }
                  }}
                  className={`underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#56249a] dark:text-white font-bold underline decoration-2 decoration-[#e746a6]'
                      : 'hover:text-[#56249a] dark:hover:text-white hover:underline'
                  }`}
                >
                  {navItem.label}
                </a>
              );
            })}
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

      {/* Workspace Subheader + Site Pages Navigation + Light / Dark Theme Switch */}
      <div className="max-w-[1200px] w-full mx-auto px-5 pt-6 pb-1 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#241436] dark:text-white m-0">
              {OFFICIAL_BRAND_NAME} · Facebook Posts &amp; Ads Creator
            </h1>
            <p className="text-xs sm:text-sm text-[#6c6277] dark:text-slate-400 mt-1 mb-0 tabular-nums">
              Ad Studio for{' '}
              <a
                href={OFFICIAL_FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#56249a] dark:text-[#c084fc] underline"
              >
                facebook.com/tidyupsbooking
              </a>{' '}
              · Campaign Copy, Image Creator &amp; Video Creator ({portfolioAssets.length} saved assets) ·{' '}
              <a
                href={OFFICIAL_PHONE_HREF}
                className="hover:underline"
              >
                {OFFICIAL_PHONE}
              </a>{' '}
              ·{' '}
              <a
                href={`mailto:${OFFICIAL_EMAIL}`}
                className="hover:underline"
              >
                {OFFICIAL_EMAIL}
              </a>
            </p>
          </div>

          {/* Interactive Light / Dark Theme Segmented Control */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={workspaceBusyAction !== null}
              onClick={() => {
                void handleQuickDownloadMetaSetupZip();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-bold hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileArchive className="w-3.5 h-3.5" />
              {workspaceBusyAction === 'meta-zip'
                ? 'Building Meta ZIP…'
                : 'Meta App Setup (.zip)'}
            </button>

            <a
              href={OFFICIAL_BOOKING_URL}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                  e.preventDefault();
                  navigateToPage('booking');
                }
              }}
              className="px-3 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#181226] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#221936] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Booking Page (/booking)
            </a>

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

        {/* Customer, Support & Legal Pages Route Switcher (Desktop + Mobile) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex md:hidden flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#ede6f6] dark:bg-[#181226]">
            {(
              [
                { key: 'campaigns', label: 'Campaigns' },
                { key: 'images', label: 'Image Creator' },
                { key: 'videos', label: 'Video Creator' },
              ] as Array<{ key: AppPage; label: string }>
            ).map((item) => (
              <a
                key={item.key}
                href={PAGE_PATHS[item.key]}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                    e.preventDefault();
                    navigateToPage(item.key);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                  activePage === item.key
                    ? 'bg-white dark:bg-[#2c2046] text-[#241436] dark:text-white shadow-xs'
                    : 'text-[#6c6277] dark:text-slate-400'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>

          <nav
            aria-label="Customer and legal pages"
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#ede6f6]/80 dark:bg-[#181226] border border-[#e3d9f0] dark:border-[#2d2342]"
          >
            {(
              [
                { key: 'booking', label: 'Booking (/booking)' },
                { key: 'support', label: 'Support (/support)' },
                { key: 'contact', label: 'Contact (/contact)' },
                { key: 'terms', label: 'Terms (/t&c)' },
                { key: 'privacy', label: 'Privacy (/privacy)' },
              ] as Array<{ key: AppPage; label: string }>
            ).map((route) => {
              const active = activePage === route.key;
              return (
                <a
                  key={route.key}
                  href={PAGE_PATHS[route.key]}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                      e.preventDefault();
                      navigateToPage(route.key);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#2c2046] text-[#56249a] dark:text-white shadow-xs'
                      : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
                  }`}
                >
                  {route.label}
                </a>
              );
            })}
          </nav>
        </div>
      </div>

      {activePage === 'images' && (
        <main className="max-w-[1200px] w-full mx-auto my-6 px-5 flex-1">
          <ImageCreatorPage
            user={user}
            accessToken={accessToken}
            onSignIn={handleSignIn}
            settings={settings}
            ads={ads}
            portfolioAssets={portfolioAssets}
            initialPrompt={handoffImagePrompt}
            initialTitle={handoffImageTitle}
            onDeleteAsset={handleRequestDeletePortfolioAsset}
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
            status={status}
          />
        </main>
      )}

      {activePage === 'videos' && (
        <main className="max-w-[1200px] w-full mx-auto my-6 px-5 flex-1">
          <VideoCreatorPage
            user={user}
            accessToken={accessToken}
            onSignIn={handleSignIn}
            settings={settings}
            ads={ads}
            portfolioAssets={portfolioAssets}
            initialPrompt={handoffVideoPrompt}
            initialTitle={handoffVideoTitle}
            onDeleteAsset={handleRequestDeletePortfolioAsset}
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
            status={status}
          />
        </main>
      )}

      {activePage === 'booking' && (
        <main className="max-w-[1200px] w-full mx-auto my-6 px-5 flex-1">
          <BookingPage
            user={user}
            bookings={mergedBookings}
            onBookingsRefresh={() => setLocalBookings(loadLocalBookings())}
            onSignIn={handleSignIn}
            onNavigate={navigateToPage}
            onUseBookingUrlInAds={(url) => {
              updateSetting('booking', url);
              navigateToPage('campaigns');
              setStatus(`Updated campaign Booking URL to ${url}`);
            }}
            onStatus={setStatus}
          />
        </main>
      )}

      {activePage === 'support' && (
        <main className="max-w-[1200px] w-full mx-auto my-6 px-5 flex-1">
          <SupportPage
            user={user}
            inquiries={mergedInquiries}
            onInquiriesRefresh={() => setLocalInquiries(loadLocalInquiries())}
            onNavigate={navigateToPage}
            onStatus={setStatus}
          />
        </main>
      )}

      {activePage === 'contact' && (
        <main className="max-w-[1200px] w-full mx-auto my-6 px-5 flex-1">
          <ContactPage
            user={user}
            inquiries={mergedInquiries}
            onInquiriesRefresh={() => setLocalInquiries(loadLocalInquiries())}
            onNavigate={navigateToPage}
            onStatus={setStatus}
          />
        </main>
      )}

      {activePage === 'terms' && (
        <main className="max-w-[1200px] w-full mx-auto my-6 px-5 flex-1">
          <TermsPage onNavigate={navigateToPage} onStatus={setStatus} />
        </main>
      )}

      {activePage === 'privacy' && (
        <main className="max-w-[1200px] w-full mx-auto my-6 px-5 flex-1">
          <PrivacyPage onNavigate={navigateToPage} onStatus={setStatus} />
        </main>
      )}

      {/* Main 2-Column Campaigns & Sheets Workspace */}
      {activePage === 'campaigns' && (
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

          <div className="flex items-center justify-between mt-3.5 mb-1.5">
            <label
              htmlFor="booking"
              className="block text-xs font-bold text-[#241436] dark:text-slate-200 m-0"
            >
              Booking page
            </label>
            <button
              type="button"
              onClick={() => {
                updateSetting('booking', OFFICIAL_BOOKING_URL);
                setStatus(`Set booking destination to ${OFFICIAL_BOOKING_URL}`);
              }}
              className="text-[11px] font-bold text-[#56249a] dark:text-[#c084fc] underline cursor-pointer"
            >
              Use app.tidyupscleaning.com/booking
            </button>
          </div>
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
            onEnsureAds={ensureAdsGenerated}
            onSaveStyledSheet={handleSaveStyledGoogleSheet}
            onUploadLeadsAdsFolder={handleUploadLeadsAdsFolder}
            externalBusyAction={workspaceBusyAction}
            lastLeadsBundle={lastLeadsBundle}
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

          {/* 1-Click Cloud & Local Export Bar */}
          <div className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 mb-6 print:hidden">
            <h2 className="text-lg font-bold text-[#241436] dark:text-slate-100 mb-1.5">
              Campaign workspace
            </h2>
            <p className="text-sm text-[#6c6277] dark:text-slate-300 m-0">
              Export all generated ads into a Google Sheet with bright colored tabs and styled banner headers, or upload a complete Leads Ads folder to Google Drive in one click.
            </p>

            <div className="flex flex-wrap gap-2.5 mt-4 mb-3">
              <button
                type="button"
                disabled={workspaceBusyAction !== null}
                onClick={() => {
                  void handleSaveStyledGoogleSheet();
                }}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {workspaceBusyAction === 'styled-sheet'
                  ? 'Saving Colored-Tab Sheet…'
                  : 'Save Colored-Tab Sheet'}
              </button>

              <button
                type="button"
                disabled={workspaceBusyAction !== null}
                onClick={() => {
                  void handleUploadLeadsAdsFolder();
                }}
                className="inline-flex items-center gap-1.5 bg-[#047857] dark:bg-[#059669] hover:bg-[#065f46] dark:hover:bg-[#047857] text-white font-bold text-xs px-4 py-2.5 rounded-xl disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderUp className="w-3.5 h-3.5" />
                {workspaceBusyAction === 'leads-folder'
                  ? 'Uploading Leads Ads Folder…'
                  : '1-Click Upload Leads Ads Folder'}
              </button>

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
                disabled={workspaceBusyAction !== null}
                onClick={() => {
                  void handleQuickDownloadMetaSetupZip();
                }}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-[#211934] border border-[#d9c9e5] dark:border-[#392b54] text-[#56249a] dark:text-[#d8b4fe] font-bold text-xs px-3.5 py-2.5 rounded-xl hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileArchive className="w-3.5 h-3.5" />
                {workspaceBusyAction === 'meta-zip'
                  ? 'Building Meta ZIP…'
                  : 'Download Meta App Setup (.zip)'}
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

            {(activeStyledSheetUrl || activeLeadsFolderUrl) && (
              <div className="flex flex-wrap items-center gap-4 pt-3 mb-3 border-t border-[#e8e1ef] dark:border-[#2d2342] text-xs">
                {activeStyledSheetUrl && (
                  <a
                    href={activeStyledSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap shrink-0"
                  >
                    Open Colored-Tab Google Sheet
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {activeLeadsFolderUrl && (
                  <a
                    href={activeLeadsFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#047857] dark:text-[#34d399] underline whitespace-nowrap shrink-0"
                  >
                    Open Leads Ads Folder in Drive
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <span className="text-[#6c6277] dark:text-slate-400">
                  Tabs: Ad Copy &amp; Variations · Creative &amp; Video Scripts · Lead Ads Tracker · Campaign Brief
                </span>
              </div>
            )}

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
                  Select your campaign options and generate variations, or click either 1-click Google Sheets / Drive export above to generate and upload automatically.
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

                      <button
                        type="button"
                        onClick={() => {
                          setHandoffImageTitle(`Ad ${ad.number} — ${ad.headline}`);
                          setHandoffImagePrompt(ad.image_prompt);
                          navigateToPage('images');
                          setStatus(`Loaded Ad ${ad.number} prompt into the AI Image Creator.`);
                        }}
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:opacity-95 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Create Image Ad
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setHandoffVideoTitle(`Video Ad ${ad.number} — ${ad.headline}`);
                          setHandoffVideoPrompt(ad.video_script);
                          navigateToPage('videos');
                          setStatus(`Loaded Ad ${ad.number} video script into the AI Video Ad Creator.`);
                        }}
                        className="inline-flex items-center gap-1.5 bg-[#047857] dark:bg-[#059669] hover:bg-[#065f46] text-white font-bold text-xs px-3.5 py-2 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Film className="w-3.5 h-3.5" />
                        Create Video Ad
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
      )}

      <footer className="max-w-[1200px] w-full mx-auto px-5 pt-5 pb-8 border-t border-[#e8e1ef] dark:border-[#221936] text-[#766684] dark:text-slate-400 text-xs leading-relaxed tabular-nums print:hidden space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {OFFICIAL_BRAND_NAME} (Tidyups Cleaning Service Inc.) · Edmonton, AB ·{' '}
            <a
              href={OFFICIAL_PHONE_HREF}
              className="underline hover:text-[#56249a] dark:hover:text-[#c084fc]"
            >
              {OFFICIAL_PHONE}
            </a>{' '}
            ·{' '}
            <a
              href={`mailto:${OFFICIAL_EMAIL}`}
              className="underline hover:text-[#56249a] dark:hover:text-[#c084fc]"
            >
              {OFFICIAL_EMAIL}
            </a>{' '}
            ·{' '}
            <a
              href={OFFICIAL_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#56249a] dark:hover:text-[#c084fc]"
            >
              facebook.com/tidyupsbooking
            </a>
          </div>

          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-3 font-semibold">
            {(
              [
                { key: 'campaigns', label: 'Ad Studio' },
                { key: 'images', label: 'Image Creator' },
                { key: 'videos', label: 'Video Creator' },
                { key: 'booking', label: 'Booking' },
                { key: 'support', label: 'Support' },
                { key: 'contact', label: 'Contact' },
                { key: 'terms', label: 'Terms & Conditions' },
                { key: 'privacy', label: 'Privacy Policy' },
              ] as Array<{ key: AppPage; label: string }>
            ).map((link, idx) => (
              <React.Fragment key={link.key}>
                {idx > 0 && <span aria-hidden="true">·</span>}
                <a
                  href={PAGE_PATHS[link.key]}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                      e.preventDefault();
                      navigateToPage(link.key);
                    }
                  }}
                  className={`underline hover:text-[#56249a] dark:hover:text-white ${
                    activePage === link.key ? 'text-[#56249a] dark:text-white font-bold' : ''
                  }`}
                >
                  {link.label}
                </a>
              </React.Fragment>
            ))}
          </nav>
        </div>
        <p className="m-0">
          Created to build Facebook posts, image ads, and video commercials for{' '}
          <a
            href={OFFICIAL_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#56249a] dark:hover:text-[#c084fc]"
          >
            {OFFICIAL_FACEBOOK_URL}
          </a>{' '}
          ({OFFICIAL_BRAND_NAME}) · Official booking page:{' '}
          <a
            href={OFFICIAL_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#56249a] dark:hover:text-[#c084fc]"
          >
            {OFFICIAL_BOOKING_URL}
          </a>
          . Campaign drafts require review before publishing.
        </p>
      </footer>

      <ConfirmModal
        confirmation={confirmation}
        onCancel={() => setConfirmation(null)}
      />
    </div>
  );
};

export default App;
