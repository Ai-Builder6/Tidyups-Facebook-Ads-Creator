import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { LinkedWorkspaceRefs } from '../services/campaignStore';
import {
  appendAdsToExistingSheet,
  createNewCampaignSpreadsheet,
  deleteDriveFileById,
  fetchSpreadsheetMetadata,
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

interface WorkspaceHubProps {
  user: User | null;
  accessToken: string | null;
  isSigningIn: boolean;
  onSignIn: () => Promise<string | null>;
  settings: CampaignSettings;
  ads: GeneratedAd[];
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
}

type HubTab = 'cloud' | 'sheets' | 'drive';

export const WorkspaceHub: React.FC<WorkspaceHubProps> = ({
  user,
  accessToken,
  isSigningIn,
  onSignIn,
  settings,
  ads,
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
}) => {
  const [activeTab, setActiveTab] = useState<HubTab>('cloud');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Google Sheets state
  const [sheetMeta, setSheetMeta] = useState<SheetMetadata | null>(null);
  const [selectedSheetTab, setSelectedSheetTab] = useState<string>('');
  const [sheetPreviewRows, setSheetPreviewRows] = useState<string[][] | null>(null);

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFileSummary[]>([]);
  const [driveSearch, setDriveSearch] = useState<string>('tidyups');
  const [driveLoadedOnce, setDriveLoadedOnce] = useState(false);

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
      onStatus('Google Workspace token expired. Click Reconnect Google Workspace to continue.');
      return;
    }
    onStatus(message);
  };

  // Load metadata whenever linkedSheetId changes and we have a token
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
      onStatus(`Loaded ${files.length} file(s) from Google Drive.`);
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

  const handleCreateNewSheet = async () => {
    if (ads.length === 0) {
      onStatus('Generate Facebook ads first before exporting to Google Sheets.');
      return;
    }
    const token = await ensureToken();
    if (!token) return;

    setBusyAction('create-sheet');
    try {
      const sheetTitle =
        settings.title.trim() ||
        `Tidyups — ${SERVICE_DATA[settings.service].name} (${new Date().toLocaleDateString()})`;
      const created = await createNewCampaignSpreadsheet(token, sheetTitle, settings, ads);
      setSheetMeta(created);
      setSelectedSheetTab(created.tabs[0]?.title ?? 'Tidyups Ads');
      setSheetPreviewRows(null);

      const nextLinks: LinkedWorkspaceRefs = {
        ...links,
        linkedSheetId: created.spreadsheetId,
        linkedSheetName: created.title,
      };
      onLinksChange(nextLinks);
      onStatus(`Created Google Sheet "${created.title}" with ${ads.length} ad variations.`);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setBusyAction(null);
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
    if (ads.length === 0) {
      onStatus('Generate ads first before syncing to Google Sheets.');
      return;
    }
    onRequestConfirmation({
      title: `Append ${ads.length} ad variation(s) to Google Sheet?`,
      description: `This will add ${ads.length} row(s) to the "${selectedSheetTab}" tab in "${sheetMeta.title}".`,
      confirmLabel: `Append ${ads.length} Rows`,
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
            ads
          );
          const rows = await readSpreadsheetTabRows(
            token,
            sheetMeta.spreadsheetId,
            selectedSheetTab
          );
          setSheetPreviewRows(rows);
          onStatus(`Appended ${ads.length} ad variation(s) to "${sheetMeta.title}" (${selectedSheetTab}).`);
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
    if (ads.length === 0) {
      onStatus('Generate ads first before overwriting a sheet tab.');
      return;
    }
    onRequestConfirmation({
      title: `Overwrite "${selectedSheetTab}" in "${sheetMeta.title}"?`,
      description: `All existing cells in the "${selectedSheetTab}" tab will be cleared and replaced with ${ads.length} generated ad variation(s).`,
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
            ads
          );
          const rows = await readSpreadsheetTabRows(
            token,
            sheetMeta.spreadsheetId,
            selectedSheetTab
          );
          setSheetPreviewRows(rows);
          onStatus(`Replaced "${selectedSheetTab}" in "${sheetMeta.title}" with ${ads.length} ad variation(s).`);
        } catch (err) {
          handleApiFailure(err);
        } finally {
          setBusyAction(null);
        }
      },
    });
  };

  const handleUploadExportToDrive = async (format: 'csv' | 'json') => {
    if (ads.length === 0) {
      onStatus('Generate Facebook ads first before saving to Google Drive.');
      return;
    }
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
        format === 'csv' ? adsToCsv(ads) : adsToJson(ads, settings.title.trim());
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
      onStatus(`Attached Google Drive file "${picked.name}" via Google Picker.`);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setBusyAction(null);
    }
  };

  const requestUpdateLinkedDriveJson = () => {
    if (!links.linkedDriveFileId) return;
    if (ads.length === 0) {
      onStatus('Generate ads first before updating the linked Drive file.');
      return;
    }
    const isCsv = links.linkedDriveFileName.toLowerCase().endsWith('.csv');
    onRequestConfirmation({
      title: `Overwrite "${links.linkedDriveFileName}" in Google Drive?`,
      description: `This will replace the contents of "${links.linkedDriveFileName}" in your Google Drive with the ${ads.length} current ad variation(s).`,
      confirmLabel: 'Update Drive File',
      variant: 'warning',
      onConfirm: async () => {
        const token = await ensureToken();
        if (!token) return;
        setBusyAction('overwrite-drive');
        try {
          const content = isCsv
            ? adsToCsv(ads)
            : adsToJson(ads, settings.title.trim());
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
    onRequestConfirmation({
      title: `Delete "${file.name}" from Google Drive?`,
      description: `This permanently deletes "${file.name}" from Google Drive. This action cannot be undone.`,
      confirmLabel: 'Delete File',
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

  return (
    <div className="bg-white border border-[#e8e1ef] rounded-[18px] p-5 shadow-[0_5px_22px_#3318490b] mb-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e8e1ef]">
        <div>
          <h2 className="text-base font-bold text-[#241436]">
            Cloud Campaigns &amp; Google Workspace
          </h2>
          <p className="text-xs text-[#6c6277] mt-0.5">
            Save campaigns to Firebase Firestore, export or sync ad tables with Google Sheets, and manage files in Google Drive &amp; Picker.
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4e9fa] text-[#56249a] px-3 py-1 text-xs font-bold">
            Workspace &amp; Firebase Connected
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mt-4 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('cloud')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'cloud'
              ? 'bg-[#56249a] text-white'
              : 'bg-[#faf3fc] text-[#56249a] hover:bg-[#f4e9fa]'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          Saved Campaigns ({savedCampaigns.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sheets')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'sheets'
              ? 'bg-[#56249a] text-white'
              : 'bg-[#faf3fc] text-[#56249a] hover:bg-[#f4e9fa]'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Google Sheets &amp; Picker
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('drive')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'drive'
              ? 'bg-[#56249a] text-white'
              : 'bg-[#faf3fc] text-[#56249a] hover:bg-[#f4e9fa]'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          Google Drive &amp; Picker
        </button>
      </div>

      {/* TAB 1: Firebase Cloud Campaigns */}
      {activeTab === 'cloud' && (
        <div>
          {!user ? (
            <div className="rounded-xl bg-[#faf3fc] border border-[#f0dff1] p-4 text-sm text-[#644475]">
              Sign in with Google above to save, reload, and manage Tidyups campaigns in Firebase Firestore.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyAction !== null || ads.length === 0}
                  onClick={async () => {
                    setBusyAction('save-firestore');
                    try {
                      await onSaveCampaign();
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] disabled:opacity-50 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {activeCampaignId ? 'Update Saved Campaign' : 'Save Campaign to Cloud'}
                </button>
                {activeCampaignId && (
                  <button
                    type="button"
                    onClick={onNewCampaignDraft}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-[#faf3fc] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Draft
                  </button>
                )}
              </div>

              {savedCampaigns.length === 0 ? (
                <p className="text-xs text-[#6c6277] py-2">
                  No cloud campaigns saved yet. Generate ads and click <b>Save Campaign to Cloud</b>.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {savedCampaigns.map((camp) => {
                    const isSelected = camp.id === activeCampaignId;
                    return (
                      <div
                        key={camp.id}
                        className={`rounded-xl border p-3 flex items-start justify-between gap-2 transition ${
                          isSelected
                            ? 'border-[#56249a] bg-[#faf3fc]'
                            : 'border-[#e8e1ef] bg-white hover:border-[#d9c9e5]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void onSelectCampaign(camp);
                          }}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-sm font-bold text-[#241436] truncate">
                            {camp.title}
                          </div>
                          <div className="text-xs text-[#6c6277] mt-0.5">
                            {SERVICE_DATA[camp.service]?.name ?? camp.service} · {camp.adCount} ads ·{' '}
                            {camp.format}
                          </div>
                          {(camp.linkedSheetName || camp.linkedDriveFileName) && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {camp.linkedSheetName && (
                                <span className="inline-block rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[11px] font-semibold truncate max-w-[160px]">
                                  Sheet: {camp.linkedSheetName}
                                </span>
                              )}
                              {camp.linkedDriveFileName && (
                                <span className="inline-block rounded-md bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[11px] font-semibold truncate max-w-[160px]">
                                  Drive: {camp.linkedDriveFileName}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCampaign(camp)}
                          aria-label={`Delete campaign ${camp.title}`}
                          className="p-1.5 rounded-lg text-[#6c6277] hover:text-red-600 hover:bg-red-50 shrink-0 cursor-pointer"
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

      {/* TAB 2: Google Sheets + Google Picker */}
      {activeTab === 'sheets' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                void handleCreateNewSheet();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {busyAction === 'create-sheet' ? 'Creating Sheet…' : 'Export to New Google Sheet'}
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                void handlePickSpreadsheet();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-[#faf3fc] disabled:opacity-50 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {busyAction === 'pick-sheet' ? 'Opening Picker…' : 'Pick Existing Sheet (Google Picker)'}
            </button>
          </div>

          {links.linkedSheetId && (
            <div className="rounded-xl border border-[#e8e1ef] bg-[#faf3fc] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#7f6e8a]">
                    Linked Google Sheet
                  </div>
                  <div className="text-sm font-bold text-[#241436]">
                    {sheetMeta?.title || links.linkedSheetName || links.linkedSheetId}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={
                      sheetMeta?.spreadsheetUrl ||
                      `https://docs.google.com/spreadsheets/d/${links.linkedSheetId}/edit`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#56249a] underline"
                  >
                    Open in Sheets
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      onLinksChange({ ...links, linkedSheetId: '', linkedSheetName: '' });
                      setSheetMeta(null);
                      setSheetPreviewRows(null);
                    }}
                    className="text-xs text-[#6c6277] hover:text-red-600 cursor-pointer"
                  >
                    Unlink
                  </button>
                </div>
              </div>

              {sheetMeta && sheetMeta.tabs.length > 0 && (
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="min-w-[180px]">
                    <label
                      htmlFor="sheet-tab-select"
                      className="block text-xs font-bold text-[#241436] mb-1"
                    >
                      Sheet tab
                    </label>
                    <select
                      id="sheet-tab-select"
                      value={selectedSheetTab}
                      onChange={(e) => {
                        setSelectedSheetTab(e.target.value);
                        setSheetPreviewRows(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#d8cde3] bg-white text-xs text-[#241436]"
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
                    disabled={busyAction !== null}
                    onClick={() => {
                      void handlePreviewSheetTab();
                    }}
                    className="px-3 py-2 rounded-xl border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-white/80 disabled:opacity-50 cursor-pointer"
                  >
                    {busyAction === 'preview-sheet' ? 'Reading…' : 'Preview Rows'}
                  </button>

                  <button
                    type="button"
                    disabled={busyAction !== null || ads.length === 0}
                    onClick={requestAppendToSheet}
                    className="px-3 py-2 rounded-xl border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-white/80 disabled:opacity-50 cursor-pointer"
                  >
                    Append Ads to Tab
                  </button>

                  <button
                    type="button"
                    disabled={busyAction !== null || ads.length === 0}
                    onClick={requestOverwriteSheetTab}
                    className="px-3 py-2 rounded-xl border border-red-200 bg-white text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                  >
                    Overwrite Tab
                  </button>
                </div>
              )}

              {sheetPreviewRows && (
                <div className="overflow-x-auto bg-white rounded-xl border border-[#e8e1ef] max-h-48">
                  {sheetPreviewRows.length === 0 ? (
                    <p className="text-xs text-[#6c6277] p-3">No rows found in this tab.</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <tbody>
                        {sheetPreviewRows.slice(0, 8).map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? 'bg-[#f4e9fa] font-bold text-[#241436]'
                                : 'border-t border-[#e8e1ef] text-[#241436]'
                            }
                          >
                            {row.slice(0, 6).map((cell, cIdx) => (
                              <td key={cIdx} className="px-2.5 py-1.5 max-w-[180px] truncate">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Google Drive + Google Picker */}
      {activeTab === 'drive' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyAction !== null || ads.length === 0}
              onClick={() => {
                void handleUploadExportToDrive('csv');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] disabled:opacity-50 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {busyAction === 'drive-upload-csv' ? 'Saving CSV…' : 'Save CSV to Google Drive'}
            </button>

            <button
              type="button"
              disabled={busyAction !== null || ads.length === 0}
              onClick={() => {
                void handleUploadExportToDrive('json');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-[#faf3fc] disabled:opacity-50 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {busyAction === 'drive-upload-json' ? 'Saving JSON…' : 'Save JSON to Google Drive'}
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                void handlePickDriveAsset();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-[#faf3fc] disabled:opacity-50 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {busyAction === 'pick-drive' ? 'Opening Picker…' : 'Pick / Upload File (Google Picker)'}
            </button>
          </div>

          {links.linkedDriveFileId && (
            <div className="rounded-xl border border-[#e8e1ef] bg-[#faf3fc] p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7f6e8a]">
                  Attached Google Drive File
                </div>
                <div className="text-sm font-bold text-[#241436] truncate">
                  {links.linkedDriveFileName || links.linkedDriveFileId}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://drive.google.com/file/d/${links.linkedDriveFileId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#56249a] underline"
                >
                  View in Drive
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {(links.linkedDriveFileName.toLowerCase().endsWith('.json') ||
                  links.linkedDriveFileName.toLowerCase().endsWith('.csv')) && (
                  <button
                    type="button"
                    disabled={busyAction !== null || ads.length === 0}
                    onClick={requestUpdateLinkedDriveJson}
                    className="px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-white/80 disabled:opacity-50 cursor-pointer"
                  >
                    Overwrite with Current Ads
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onLinksChange({ ...links, linkedDriveFileId: '', linkedDriveFileName: '' })
                  }
                  className="text-xs text-[#6c6277] hover:text-red-600 cursor-pointer"
                >
                  Detach
                </button>
              </div>
            </div>
          )}

          {/* Drive Search & File Browser */}
          <div className="pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-[#6c6277] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Search Google Drive files by name…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#d8cde3] bg-white text-xs text-[#241436]"
                />
              </div>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => {
                  void handleRefreshDriveList();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#d9c9e5] bg-white text-xs font-bold text-[#56249a] hover:bg-[#faf3fc] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {busyAction === 'drive-list' ? 'Loading…' : 'Browse Drive'}
              </button>
            </div>

            {driveLoadedOnce && (
              <div className="mt-2.5 space-y-1.5 max-h-52 overflow-y-auto">
                {driveFiles.length === 0 ? (
                  <p className="text-xs text-[#6c6277] py-2">
                    No matching files found in Google Drive.
                  </p>
                ) : (
                  driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#e8e1ef] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[#241436] truncate">{file.name}</div>
                        <div className="text-[11px] text-[#6c6277] truncate">{file.mimeType}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                          className="px-2 py-1 rounded-lg bg-[#f4e9fa] text-[#56249a] font-bold cursor-pointer"
                        >
                          Attach
                        </button>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#56249a] hover:underline font-semibold"
                          >
                            Open
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDeleteDriveFile(file)}
                          aria-label={`Delete ${file.name} from Google Drive`}
                          className="p-1 rounded-lg text-[#6c6277] hover:text-red-600 hover:bg-red-50 cursor-pointer"
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
    </div>
  );
};
