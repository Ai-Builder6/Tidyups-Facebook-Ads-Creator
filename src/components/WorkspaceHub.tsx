import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  FolderUp,
  HardDrive,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { LinkedWorkspaceRefs } from '../services/campaignStore';
import {
  appendAdsToExistingSheet,
  deleteDriveFileById,
  fetchSpreadsheetMetadata,
  LeadsAdsFolderBundleResult,
  listDriveFiles,
  openGooglePicker,
  overwriteDriveFile,
  overwriteSheetTabWithAds,
  readSpreadsheetTabRows,
  uploadFileToDrive,
} from '../services/workspaceApi';
import {
  CampaignSettings,
  DriveFileSummary,
  GeneratedAd,
  PendingConfirmation,
  SavedCampaign,
  SheetMetadata,
} from '../types';
import { adsToCsv, adsToJson, SERVICE_DATA } from '../utils/adGenerator';
import { GoogleSignInButton } from './GoogleSignInButton';
import { BrandLogoKit } from './TidyupsLogo';

export type HubTab = 'cloud' | 'sheets' | 'drive' | 'logos';

interface WorkspaceHubProps {
  activeTab: HubTab;
  onTabChange: (tab: HubTab) => void;
  user: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  onSignIn: () => Promise<string | null>;
  settings: CampaignSettings;
  ads: GeneratedAd[];
  onEnsureAds: () => GeneratedAd[] | null;
  onSaveStyledSheet: () => Promise<SheetMetadata | null>;
  onUploadLeadsAdsFolder: () => Promise<LeadsAdsFolderBundleResult | null>;
  externalBusyAction: string | null;
  lastLeadsBundle: LeadsAdsFolderBundleResult | null;
  activeCampaignId: string | null;
  savedCampaigns: SavedCampaign[];
  links: LinkedWorkspaceRefs;
  onLinksChange: (next: LinkedWorkspaceRefs) => void;
  onSaveCampaign: (overrideLinks?: LinkedWorkspaceRefs) => Promise<void>;
  onSelectCampaign: (campaign: SavedCampaign) => Promise<void>;
  onNewCampaignDraft: () => void;
  onDeleteCampaign: (campaign: SavedCampaign) => void;
  onRequestConfirmation: (confirmation: PendingConfirmation) => void;
  onStatus: (msg: string) => void;
  onTokenExpired: () => void;
  onOpenLogoStudio?: () => void;
}

function getDriveWebUrl(id: string, name: string, mimeType?: string): string {
  const isFolder =
    mimeType === 'application/vnd.google-apps.folder' || name.startsWith('Leads Ads —');
  return isFolder
    ? `https://drive.google.com/drive/folders/${id}`
    : `https://drive.google.com/file/d/${id}/view`;
}

export const WorkspaceHub: React.FC<WorkspaceHubProps> = ({
  activeTab,
  onTabChange,
  user,
  accessToken,
  isSigningIn,
  onSignIn,
  settings,
  ads,
  onEnsureAds,
  onSaveStyledSheet,
  onUploadLeadsAdsFolder,
  externalBusyAction,
  lastLeadsBundle,
  activeCampaignId,
  savedCampaigns,
  links,
  onLinksChange,
  onSaveCampaign,
  onSelectCampaign,
  onNewCampaignDraft,
  onDeleteCampaign,
  onRequestConfirmation,
  onStatus,
  onTokenExpired,
  onOpenLogoStudio,
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Google Sheets state
  const [sheetMeta, setSheetMeta] = useState<SheetMetadata | null>(null);
  const [selectedSheetTab, setSelectedSheetTab] = useState<string>('');
  const [sheetPreviewRows, setSheetPreviewRows] = useState<string[][] | null>(null);

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFileSummary[]>([]);
  const [driveSearch, setDriveSearch] = useState<string>('Leads Ads');
  const [driveLoadedOnce, setDriveLoadedOnce] = useState(false);

  const isAnyBusy = busyAction !== null || externalBusyAction !== null;

  const ensureToken = async (): Promise<string | null> => {
    if (accessToken) {
      return accessToken;
    }
    return onSignIn();
  };

  const handleApiFailure = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('AUTH_EXPIRED:')) {
      onTokenExpired();
      onStatus('Google Workspace token expired. Click Connect Google Workspace to continue.');
      return;
    }
    onStatus(message);
  };

  useEffect(() => {
    if (lastLeadsBundle) {
      setSheetMeta(lastLeadsBundle.sheet);
      setSelectedSheetTab(lastLeadsBundle.sheet.tabs[0]?.title ?? 'Ad Copy & Variations');
      setSheetPreviewRows(null);
      setDriveFiles((prev) => {
        const incoming = [lastLeadsBundle.folder, ...lastLeadsBundle.uploadedFiles];
        const incomingIds = new Set(incoming.map((f) => f.id));
        return [...incoming, ...prev.filter((f) => !incomingIds.has(f.id))];
      });
    }
  }, [lastLeadsBundle]);

  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      if (!links.linkedSheetId || !accessToken) {
        if (!links.linkedSheetId) {
          setSheetMeta(null);
          setSelectedSheetTab('');
          setSheetPreviewRows(null);
        }
        return;
      }
      try {
        const meta = await fetchSpreadsheetMetadata(accessToken, links.linkedSheetId);
        if (!cancelled) {
          setSheetMeta(meta);
          setSelectedSheetTab((prev) =>
            meta.tabs.some((t) => t.title === prev)
              ? prev
              : meta.tabs[0]?.title ?? ''
          );
        }
      } catch (err) {
        if (!cancelled) {
          handleApiFailure(err);
        }
      }
    };
    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [links.linkedSheetId, accessToken]);

  const handleRefreshDriveList = async (tokenOverride?: string) => {
    const token = tokenOverride ?? (await ensureToken());
    if (!token) return;
    setBusyAction('drive-list');
    try {
      const files = await listDriveFiles(token, driveSearch);
      setDriveFiles(files);
      setDriveLoadedOnce(true);
      onStatus(`Loaded ${files.length} item(s) from Google Drive.`);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePickSpreadsheet = async () => {
    const token = await ensureToken();
    if (!token) return;
    setBusyAction('pick-sheet');
    try {
      const picked = await openGooglePicker(token, 'spreadsheets');
      if (!picked) {
        onStatus('Spreadsheet selection cancelled.');
        return;
      }
      const meta = await fetchSpreadsheetMetadata(token, picked.id);
      setSheetMeta(meta);
      setSelectedSheetTab(meta.tabs[0]?.title ?? '');
      setSheetPreviewRows(null);

      const nextLinks: LinkedWorkspaceRefs = {
        ...links,
        linkedSheetId: meta.spreadsheetId,
        linkedSheetName: meta.title,
      };
      onLinksChange(nextLinks);
      onStatus(`Linked Google Sheet "${meta.title}" via Google Picker.`);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateStyledSheetFromHub = async () => {
    const created = await onSaveStyledSheet();
    if (created) {
      setSheetMeta(created);
      setSelectedSheetTab(created.tabs[0]?.title ?? 'Ad Copy & Variations');
      setSheetPreviewRows(null);
    }
  };

  const handlePreviewSheetTab = async () => {
    if (!sheetMeta || !selectedSheetTab) return;
    const token = await ensureToken();
    if (!token) return;
    setBusyAction('preview-sheet');
    try {
      const rows = await readSpreadsheetTabRows(token, sheetMeta.spreadsheetId, selectedSheetTab);
      setSheetPreviewRows(rows);
      onStatus(
        rows.length > 0
          ? `Previewing ${rows.length} row(s) from "${selectedSheetTab}".`
          : `Tab "${selectedSheetTab}" is currently empty.`
      );
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setBusyAction(null);
    }
  };

  const requestAppendToSheet = () => {
    if (!sheetMeta || !selectedSheetTab) return;
    const readyAds = ads.length > 0 ? ads : onEnsureAds();
    if (!readyAds || readyAds.length === 0) return;

    onRequestConfirmation({
      title: `Append ${readyAds.length} ad variation(s) to Google Sheet?`,
      description: `This will add ${readyAds.length} row(s) to the "${selectedSheetTab}" tab in "${sheetMeta.title}".`,
      confirmLabel: `Append ${readyAds.length} Rows`,
      variant: 'warning',
      onConfirm: async () => {
        const token = await ensureToken();
        if (!token) return;
        setBusyAction('append-sheet');
        try {
          await appendAdsToExistingSheet(
            token,
            sheetMeta.spreadsheetId,
            selectedSheetTab,
            settings,
            readyAds
          );
          const rows = await readSpreadsheetTabRows(
            token,
            sheetMeta.spreadsheetId,
            selectedSheetTab
          );
          setSheetPreviewRows(rows);
          onStatus(
            `Appended ${readyAds.length} ad variation(s) to "${sheetMeta.title}" (${selectedSheetTab}).`
          );
        } catch (err) {
          handleApiFailure(err);
        } finally {
          setBusyAction(null);
        }
      },
    });
  };

  const requestOverwriteSheetTab = () => {
    if (!sheetMeta || !selectedSheetTab) return;
    const readyAds = ads.length > 0 ? ads : onEnsureAds();
    if (!readyAds || readyAds.length === 0) return;

    onRequestConfirmation({
      title: `Overwrite "${selectedSheetTab}" in "${sheetMeta.title}"?`,
      description: `All existing cells in the "${selectedSheetTab}" tab will be cleared and replaced with ${readyAds.length} generated ad variation(s).`,
      confirmLabel: 'Overwrite Tab',
      variant: 'danger',
      onConfirm: async () => {
        const token = await ensureToken();
        if (!token) return;
        setBusyAction('overwrite-sheet');
        try {
          await overwriteSheetTabWithAds(
            token,
            sheetMeta.spreadsheetId,
            selectedSheetTab,
            settings,
            readyAds
          );
          const rows = await readSpreadsheetTabRows(
            token,
            sheetMeta.spreadsheetId,
            selectedSheetTab
          );
          setSheetPreviewRows(rows);
          onStatus(
            `Replaced "${selectedSheetTab}" in "${sheetMeta.title}" with ${readyAds.length} ad variation(s).`
          );
        } catch (err) {
          handleApiFailure(err);
        } finally {
          setBusyAction(null);
        }
      },
    });
  };

  const handleUploadExportToDrive = async (format: 'csv' | 'json') => {
    const readyAds = ads.length > 0 ? ads : onEnsureAds();
    if (!readyAds || readyAds.length === 0) return;

    const token = await ensureToken();
    if (!token) return;

    setBusyAction(`drive-upload-${format}`);
    try {
      const slug = (settings.title || SERVICE_DATA[settings.service].name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
      const fileName = `tidyups-${slug || 'ads'}.${format}`;
      const content =
        format === 'csv' ? adsToCsv(readyAds) : adsToJson(readyAds, settings.title.trim());
      const mimeType =
        format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';

      const uploaded = await uploadFileToDrive(token, fileName, content, mimeType);
      const nextLinks: LinkedWorkspaceRefs = {
        ...links,
        linkedDriveFileId: uploaded.id,
        linkedDriveFileName: uploaded.name,
      };
      onLinksChange(nextLinks);
      setDriveFiles((prev) => [uploaded, ...prev.filter((f) => f.id !== uploaded.id)]);
      onStatus(`Saved "${uploaded.name}" to Google Drive.`);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePickDriveAsset = async () => {
    const token = await ensureToken();
    if (!token) return;
    setBusyAction('pick-drive');
    try {
      const picked = await openGooglePicker(token, 'docs');
      if (!picked) {
        onStatus('Google Drive file selection cancelled.');
        return;
      }
      const nextLinks: LinkedWorkspaceRefs = {
        ...links,
        linkedDriveFileId: picked.id,
        linkedDriveFileName: picked.name,
      };
      onLinksChange(nextLinks);
      setDriveFiles((prev) => [picked, ...prev.filter((f) => f.id !== picked.id)]);
      onStatus(`Attached Google Drive item "${picked.name}" via Google Picker.`);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setBusyAction(null);
    }
  };

  const requestUpdateLinkedDriveJson = () => {
    if (!links.linkedDriveFileId) return;
    const readyAds = ads.length > 0 ? ads : onEnsureAds();
    if (!readyAds || readyAds.length === 0) return;

    const isCsv = links.linkedDriveFileName.toLowerCase().endsWith('.csv');
    onRequestConfirmation({
      title: `Overwrite "${links.linkedDriveFileName}" in Google Drive?`,
      description: `This will replace the contents of "${links.linkedDriveFileName}" in your Google Drive with the ${readyAds.length} current ad variation(s).`,
      confirmLabel: 'Update Drive File',
      variant: 'warning',
      onConfirm: async () => {
        const token = await ensureToken();
        if (!token) return;
        setBusyAction('overwrite-drive');
        try {
          const content = isCsv
            ? adsToCsv(readyAds)
            : adsToJson(readyAds, settings.title.trim());
          const mimeType = isCsv ? 'text/csv;charset=utf-8' : 'application/json';
          const updated = await overwriteDriveFile(
            token,
            links.linkedDriveFileId,
            content,
            mimeType
          );
          onStatus(`Updated "${updated.name}" in Google Drive.`);
        } catch (err) {
          handleApiFailure(err);
        } finally {
          setBusyAction(null);
        }
      },
    });
  };

  const requestDeleteDriveFile = (file: DriveFileSummary) => {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    onRequestConfirmation({
      title: `Delete "${file.name}" from Google Drive?`,
      description: isFolder
        ? `This permanently deletes the folder "${file.name}" and its contents from Google Drive. This action cannot be undone.`
        : `This permanently deletes "${file.name}" from Google Drive. This action cannot be undone.`,
      confirmLabel: isFolder ? 'Delete Folder' : 'Delete File',
      variant: 'danger',
      onConfirm: async () => {
        const token = await ensureToken();
        if (!token) return;
        setBusyAction(`delete-${file.id}`);
        try {
          await deleteDriveFileById(token, file.id);
          setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
          if (links.linkedDriveFileId === file.id) {
            onLinksChange({
              ...links,
              linkedDriveFileId: '',
              linkedDriveFileName: '',
            });
          }
          onStatus(`Deleted "${file.name}" from Google Drive.`);
        } catch (err) {
          handleApiFailure(err);
        } finally {
          setBusyAction(null);
        }
      },
    });
  };

  const linkedItemIsFolder = links.linkedDriveFileName.startsWith('Leads Ads —');

  return (
    <div
      id="workspace-hub"
      className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 mb-6 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#e8e1ef] dark:border-[#2d2342]">
        <div>
          <h2 className="text-base font-bold text-[#241436] dark:text-slate-100">
            Cloud Campaigns, Colored-Tab Sheets &amp; Leads Ads Drive Hub
          </h2>
          <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5">
            Save styled multi-tab Google Sheets, upload a complete Leads Ads folder to Google Drive in one click, or manage cloud drafts.
          </p>
        </div>

        {!user ? (
          <GoogleSignInButton
            onClick={() => {
              void onSignIn();
            }}
            disabled={isSigningIn}
            label="Sign in with Google"
          />
        ) : !accessToken ? (
          <GoogleSignInButton
            onClick={() => {
              void onSignIn();
            }}
            disabled={isSigningIn}
            label="Connect Google Workspace"
          />
        ) : (
          <span className="text-xs font-semibold text-[#56249a] dark:text-[#c084fc] whitespace-nowrap shrink-0">
            Firebase &amp; Workspace Ready
          </span>
        )}
      </div>

      {/* Interactive Segmented Tab Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#f4effa] dark:bg-[#110c1c] my-4">
        <button
          type="button"
          onClick={() => onTabChange('cloud')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
            activeTab === 'cloud'
              ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
              : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          Saved Campaigns ({savedCampaigns.length})
        </button>

        <button
          type="button"
          onClick={() => onTabChange('sheets')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'sheets'
              ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
              : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Google Sheets
        </button>

        <button
          type="button"
          onClick={() => onTabChange('drive')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'drive'
              ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
              : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          Google Drive
        </button>

        <button
          type="button"
          id="brand-logos"
          onClick={() => onTabChange('logos')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'logos'
              ? 'bg-white dark:bg-[#241b38] text-[#241436] dark:text-white shadow-xs'
              : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Brand Logos (Light &amp; Dark)
        </button>
      </div>

      {/* TAB 1: Firebase Cloud Campaigns */}
      {activeTab === 'cloud' && (
        <div>
          {!user ? (
            <p className="text-sm text-[#6c6277] dark:text-slate-400 py-2 m-0">
              Sign in with Google above to save, reload, and manage Tidyups campaigns in Firebase Firestore.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isAnyBusy || ads.length === 0}
                  onClick={async () => {
                    setBusyAction('save-firestore');
                    try {
                      await onSaveCampaign();
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {activeCampaignId ? 'Update Saved Campaign' : 'Save Campaign to Cloud'}
                </button>
                {activeCampaignId && (
                  <button
                    type="button"
                    onClick={onNewCampaignDraft}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Draft
                  </button>
                )}
              </div>

              {savedCampaigns.length === 0 ? (
                <p className="text-xs text-[#6c6277] dark:text-slate-400 py-2 m-0">
                  No cloud campaigns saved yet. Generate ads and click <b>Save Campaign to Cloud</b>.
                </p>
              ) : (
                <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342] max-h-64 overflow-y-auto">
                  {savedCampaigns.map((camp) => {
                    const isSelected = camp.id === activeCampaignId;
                    return (
                      <div
                        key={camp.id}
                        className={`py-3 px-3 rounded-xl flex items-start justify-between gap-3 transition ${
                          isSelected
                            ? 'bg-[#faf3fc] dark:bg-[#221936]'
                            : 'hover:bg-[#faf8fd] dark:hover:bg-[#1e1730]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void onSelectCampaign(camp);
                          }}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-sm font-bold text-[#241436] dark:text-slate-100 truncate">
                            {camp.title}
                          </div>
                          <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 tabular-nums">
                            {SERVICE_DATA[camp.service]?.name ?? camp.service} · {camp.adCount} ads ·{' '}
                            {camp.format}
                            {camp.linkedSheetName ? ` · Sheet: ${camp.linkedSheetName}` : ''}
                            {camp.linkedDriveFileName ? ` · Drive: ${camp.linkedDriveFileName}` : ''}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCampaign(camp)}
                          aria-label={`Delete campaign ${camp.title}`}
                          className="p-1.5 rounded-lg text-[#6c6277] dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Google Sheets (Bright Colored Tabs & Styled Headers) */}
      {activeTab === 'sheets' && (
        <div className="space-y-4">
          <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0 leading-relaxed">
            Exports a formatted Google Sheet with 4 bright colored tabs and frozen banner headers:{' '}
            <span className="font-semibold text-[#56249a] dark:text-[#c084fc]">
              Ad Copy &amp; Variations
            </span>{' '}
            ·{' '}
            <span className="font-semibold text-[#c21878] dark:text-[#f472b6]">
              Creative &amp; Video Scripts
            </span>{' '}
            ·{' '}
            <span className="font-semibold text-[#047857] dark:text-[#34d399]">
              Lead Ads Tracker
            </span>{' '}
            ·{' '}
            <span className="font-semibold text-[#b45309] dark:text-[#fbbf24]">
              Campaign Brief
            </span>
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                void handleCreateStyledSheetFromHub();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {externalBusyAction === 'styled-sheet'
                ? 'Creating Colored-Tab Sheet…'
                : 'Save to Colored-Tab Google Sheet'}
            </button>

            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                void handlePickSpreadsheet();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {busyAction === 'pick-sheet' ? 'Opening Picker…' : 'Pick Existing Sheet'}
            </button>
          </div>

          {links.linkedSheetId && (
            <div className="pt-4 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-[#6c6277] dark:text-slate-400">
                    Linked Google Sheet
                  </div>
                  <div className="text-sm font-bold text-[#241436] dark:text-slate-100">
                    {sheetMeta?.title || links.linkedSheetName || links.linkedSheetId}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={
                      sheetMeta?.spreadsheetUrl ||
                      `https://docs.google.com/spreadsheets/d/${links.linkedSheetId}/edit`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap shrink-0"
                  >
                    Open in Google Sheets
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      onLinksChange({ ...links, linkedSheetId: '', linkedSheetName: '' });
                      setSheetMeta(null);
                      setSheetPreviewRows(null);
                    }}
                    className="text-xs text-[#6c6277] dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Unlink
                  </button>
                </div>
              </div>

              {sheetMeta && sheetMeta.tabs.length > 0 && (
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="min-w-[200px]">
                    <label
                      htmlFor="sheet-tab-select"
                      className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1"
                    >
                      Sheet tab ({sheetMeta.tabs.length})
                    </label>
                    <select
                      id="sheet-tab-select"
                      value={selectedSheetTab}
                      onChange={(e) => {
                        setSelectedSheetTab(e.target.value);
                        setSheetPreviewRows(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#d8cde3] dark:border-[#392b54] bg-white dark:bg-[#120d1d] text-xs text-[#241436] dark:text-slate-100"
                    >
                      {sheetMeta.tabs.map((tab) => (
                        <option key={tab.sheetId} value={tab.title}>
                          {tab.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={isAnyBusy}
                    onClick={() => {
                      void handlePreviewSheetTab();
                    }}
                    className="px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {busyAction === 'preview-sheet' ? 'Reading…' : 'Preview Rows'}
                  </button>

                  <button
                    type="button"
                    disabled={isAnyBusy}
                    onClick={requestAppendToSheet}
                    className="px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Append Ads to Tab
                  </button>

                  <button
                    type="button"
                    disabled={isAnyBusy}
                    onClick={requestOverwriteSheetTab}
                    className="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-red-950/30 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Overwrite Tab
                  </button>
                </div>
              )}

              {sheetPreviewRows && (
                <div className="overflow-x-auto rounded-xl border border-[#e8e1ef] dark:border-[#2d2342] max-h-56">
                  {sheetPreviewRows.length === 0 ? (
                    <p className="text-xs text-[#6c6277] dark:text-slate-400 p-3 m-0">
                      No rows found in this tab.
                    </p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs tabular-nums">
                      <tbody>
                        {sheetPreviewRows.slice(0, 9).map((row, rIdx) => {
                          const isBannerRow = rIdx === 0 && row.length === 1;
                          const isHeaderRow = rIdx === 1 || (rIdx === 0 && row.length > 1);
                          return (
                            <tr
                              key={rIdx}
                              className={
                                isBannerRow
                                  ? 'bg-[#452088] text-white font-bold'
                                  : isHeaderRow
                                  ? 'bg-[#f4e9fa] dark:bg-[#241b38] font-bold text-[#241436] dark:text-slate-100 border-t border-[#e8e1ef] dark:border-[#2d2342]'
                                  : 'border-t border-[#e8e1ef] dark:border-[#2d2342] text-[#241436] dark:text-slate-200'
                              }
                            >
                              {isBannerRow ? (
                                <td colSpan={6} className="px-3 py-2.5 truncate">
                                  {row[0]}
                                </td>
                              ) : (
                                row.slice(0, 6).map((cell, cIdx) => (
                                  <td key={cIdx} className="px-3 py-2 max-w-[180px] truncate">
                                    {cell}
                                  </td>
                                ))
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Google Drive + 1-Click Leads Ads Folder */}
      {activeTab === 'drive' && (
        <div className="space-y-4">
          <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0 leading-relaxed">
            One-click folder upload creates a dedicated <b>Leads Ads</b> folder in Google Drive containing your colored-tab Google Sheet, CSV &amp; JSON exports, Meta Lead Form Launch Kit, and Light &amp; Dark SVG brand logos.
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                void onUploadLeadsAdsFolder();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderUp className="w-3.5 h-3.5" />
              {externalBusyAction === 'leads-folder'
                ? 'Uploading Leads Ads Folder…'
                : '1-Click Upload "Leads Ads" Folder'}
            </button>

            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                void handleUploadExportToDrive('csv');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {busyAction === 'drive-upload-csv' ? 'Saving CSV…' : 'Save CSV'}
            </button>

            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                void handleUploadExportToDrive('json');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {busyAction === 'drive-upload-json' ? 'Saving JSON…' : 'Save JSON'}
            </button>

            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                void handlePickDriveAsset();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {busyAction === 'pick-drive' ? 'Opening Picker…' : 'Pick / Upload File'}
            </button>
          </div>

          {lastLeadsBundle && (
            <div className="pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342] flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#241436] dark:text-slate-100 truncate">
                  {lastLeadsBundle.folder.name}
                </div>
                <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 tabular-nums">
                  4-tab Google Sheet · CSV · JSON · Meta Lead Form Kit · Light &amp; Dark SVG Logos (
                  {lastLeadsBundle.uploadedFiles.length + 1} items)
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <a
                  href={
                    lastLeadsBundle.folder.webViewLink ||
                    `https://drive.google.com/drive/folders/${lastLeadsBundle.folder.id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap shrink-0"
                >
                  Open Leads Ads Folder
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={lastLeadsBundle.sheet.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap shrink-0"
                >
                  Open Colored-Tab Sheet
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {links.linkedDriveFileId && !lastLeadsBundle && (
            <div className="pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342] flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-[#6c6277] dark:text-slate-400">
                  {linkedItemIsFolder
                    ? 'Attached Leads Ads Drive Folder'
                    : 'Attached Google Drive File'}
                </div>
                <div className="text-sm font-bold text-[#241436] dark:text-slate-100 truncate">
                  {links.linkedDriveFileName || links.linkedDriveFileId}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={getDriveWebUrl(links.linkedDriveFileId, links.linkedDriveFileName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap shrink-0"
                >
                  {linkedItemIsFolder ? 'Open Folder in Drive' : 'View in Drive'}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {(links.linkedDriveFileName.toLowerCase().endsWith('.json') ||
                  links.linkedDriveFileName.toLowerCase().endsWith('.csv')) && (
                  <button
                    type="button"
                    disabled={isAnyBusy}
                    onClick={requestUpdateLinkedDriveJson}
                    className="px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Overwrite with Current Ads
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onLinksChange({ ...links, linkedDriveFileId: '', linkedDriveFileName: '' })
                  }
                  className="text-xs text-[#6c6277] dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Detach
                </button>
              </div>
            </div>
          )}

          {/* Drive Search & File Browser */}
          <div className="pt-2 border-t border-[#e8e1ef] dark:border-[#2d2342]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-[#6c6277] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Search Google Drive folders & files…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#d8cde3] dark:border-[#392b54] bg-white dark:bg-[#120d1d] text-xs text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500"
                />
              </div>
              <button
                type="button"
                disabled={isAnyBusy}
                onClick={() => {
                  void handleRefreshDriveList();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {busyAction === 'drive-list' ? 'Loading…' : 'Browse Drive'}
              </button>
            </div>

            {driveLoadedOnce && (
              <div className="mt-3 divide-y divide-[#e8e1ef] dark:divide-[#2d2342] max-h-52 overflow-y-auto">
                {driveFiles.length === 0 ? (
                  <p className="text-xs text-[#6c6277] dark:text-slate-400 py-2 m-0">
                    No matching items found in Google Drive.
                  </p>
                ) : (
                  driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[#241436] dark:text-slate-100 truncate">
                          {file.name}
                        </div>
                        <div className="text-[11px] text-[#6c6277] dark:text-slate-400 truncate">
                          {file.mimeType}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onLinksChange({
                              ...links,
                              linkedDriveFileId: file.id,
                              linkedDriveFileName: file.name,
                            });
                            onStatus(`Attached "${file.name}" to current campaign.`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#f4e9fa] dark:bg-[#241b38] text-[#56249a] dark:text-[#d8b4fe] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Attach
                        </button>
                        <a
                          href={
                            file.webViewLink ||
                            getDriveWebUrl(file.id, file.name, file.mimeType)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#56249a] dark:text-[#c084fc] hover:underline font-semibold whitespace-nowrap shrink-0"
                        >
                          Open
                        </a>
                        <button
                          type="button"
                          onClick={() => requestDeleteDriveFile(file)}
                          aria-label={`Delete ${file.name} from Google Drive`}
                          className="p-1 rounded-lg text-[#6c6277] dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Light & Dark Brand Logo Kit */}
      {activeTab === 'logos' && (
        <BrandLogoKit onStatus={onStatus} onOpenFullStudio={onOpenLogoStudio} />
      )}
    </div>
  );
};
