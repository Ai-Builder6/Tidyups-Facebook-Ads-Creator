import {
  CampaignSettings,
  DriveFileSummary,
  GeneratedAd,
  SheetMetadata,
  SheetTabInfo,
} from '../types';
import { SERVICE_DATA, TONE_LABELS } from '../utils/adGenerator';

// Minimal ambient types for Google Picker loaded from https://apis.google.com/js/api.js
interface GooglePickerDocument {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
}

interface GooglePickerCallbackData {
  action: string;
  docs?: GooglePickerDocument[];
}

interface GooglePickerView {
  setMimeTypes?: (mimeTypes: string) => GooglePickerView;
}

interface GooglePickerBuilderInstance {
  addView: (view: string | GooglePickerView) => GooglePickerBuilderInstance;
  setOAuthToken: (token: string) => GooglePickerBuilderInstance;
  setCallback: (cb: (data: GooglePickerCallbackData) => void) => GooglePickerBuilderInstance;
  setOrigin: (origin: string) => GooglePickerBuilderInstance;
  setTitle: (title: string) => GooglePickerBuilderInstance;
  build: () => { setVisible: (visible: boolean) => void };
}

interface GooglePickerNamespace {
  PickerBuilder: new () => GooglePickerBuilderInstance;
  ViewId: {
    DOCS: string;
    SPREADSHEETS: string;
    FOLDERS: string;
  };
  DocsUploadView: new () => GooglePickerView;
  Action: {
    PICKED: string;
    CANCEL: string;
  };
}

declare global {
  interface Window {
    gapi?: {
      load: (apiName: string, callback: () => void) => void;
    };
    google?: {
      picker?: GooglePickerNamespace;
    };
  }
}

let pickerScriptPromise: Promise<void> | null = null;

function ensureGooglePickerLoaded(): Promise<void> {
  if (window.google?.picker) {
    return Promise.resolve();
  }
  if (pickerScriptPromise) {
    return pickerScriptPromise;
  }

  pickerScriptPromise = new Promise<void>((resolve, reject) => {
    const onScriptReady = () => {
      if (!window.gapi) {
        pickerScriptPromise = null;
        reject(new Error('Google API loader failed to initialize.'));
        return;
      }
      window.gapi.load('picker', () => {
        if (window.google?.picker) {
          resolve();
        } else {
          pickerScriptPromise = null;
          reject(new Error('Google Picker library failed to load.'));
        }
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://apis.google.com/js/api.js"]'
    );
    if (existing) {
      if (window.gapi) {
        onScriptReady();
      } else {
        existing.addEventListener('load', onScriptReady, { once: true });
        existing.addEventListener(
          'error',
          () => {
            pickerScriptPromise = null;
            reject(new Error('Failed to load Google Picker script.'));
          },
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = onScriptReady;
    script.onerror = () => {
      pickerScriptPromise = null;
      reject(new Error('Failed to load Google Picker script.'));
    };
    document.head.appendChild(script);
  });

  return pickerScriptPromise;
}

export async function openGooglePicker(
  accessToken: string,
  mode: 'spreadsheets' | 'docs'
): Promise<DriveFileSummary | null> {
  await ensureGooglePickerLoaded();
  const pickerApi = window.google?.picker;
  if (!pickerApi) {
    throw new Error('Google Picker is unavailable.');
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  return new Promise<DriveFileSummary | null>((resolve) => {
    const pickerCallback = (data: GooglePickerCallbackData) => {
      if (data.action === pickerApi.Action.PICKED && data.docs && data.docs.length > 0) {
        const file = data.docs[0];
        resolve({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          webViewLink: file.url,
        });
      } else if (data.action === pickerApi.Action.CANCEL) {
        resolve(null);
      }
    };

    const builder = new pickerApi.PickerBuilder()
      .addView(
        mode === 'spreadsheets' ? pickerApi.ViewId.SPREADSHEETS : pickerApi.ViewId.DOCS
      )
      .addView(new pickerApi.DocsUploadView())
      .setOAuthToken(accessToken)
      .setCallback(pickerCallback)
      .setOrigin(pickerOrigin)
      .setTitle(
        mode === 'spreadsheets'
          ? 'Select a Google Sheet for Tidyups Ads'
          : 'Select or upload a Google Drive file'
      );

    const picker = builder.build();
    picker.setVisible(true);
  });
}

async function parseGoogleApiError(res: Response, fallbackMsg: string): Promise<never> {
  let detail = fallbackMsg;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) {
      detail = body.error.message;
    }
  } catch {
    // ignore JSON parse failure
  }
  if (res.status === 401) {
    throw new Error('AUTH_EXPIRED: Your Google Workspace session expired. Please reconnect Google Workspace.');
  }
  throw new Error(detail);
}

// ---------------- Google Drive API ----------------

export async function listDriveFiles(
  accessToken: string,
  searchTerm = ''
): Promise<DriveFileSummary[]> {
  const escaped = searchTerm.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const qParts = ['trashed = false'];
  if (escaped) {
    qParts.push(`name contains '${escaped}'`);
  }
  const params = new URLSearchParams({
    pageSize: '12',
    orderBy: 'modifiedTime desc',
    q: qParts.join(' and '),
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to list Google Drive files.');
  }
  const data = (await res.json()) as { files?: DriveFileSummary[] };
  return data.files ?? [];
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string
): Promise<DriveFileSummary> {
  const boundary = `tidyups_boundary_${Date.now()}`;
  const metadata = {
    name: fileName,
    mimeType,
  };

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to upload file to Google Drive.');
  }
  return (await res.json()) as DriveFileSummary;
}

export async function overwriteDriveFile(
  accessToken: string,
  fileId: string,
  content: string,
  mimeType: string
): Promise<DriveFileSummary> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
      fileId
    )}?uploadType=media&fields=id,name,mimeType,modifiedTime,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: content,
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to update file in Google Drive.');
  }
  return (await res.json()) as DriveFileSummary;
}

export async function deleteDriveFileById(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to delete file from Google Drive.');
  }
}

// ---------------- Google Sheets API ----------------

function quoteSheetTabTitle(tabTitle: string): string {
  const escaped = tabTitle.replace(/'/g, "''");
  return `'${escaped}'`;
}

export const SHEET_HEADER_ROW = [
  'Ad #',
  'Service',
  'Format',
  'Headline',
  'Primary Text',
  'Description',
  'CTA',
  'Destination URL',
  'Image Prompt',
  '10s Video Script',
  'Angle',
  'Offer',
  'Target Area',
  'Exported At',
];

function buildSheetRows(settings: CampaignSettings, ads: GeneratedAd[]): string[][] {
  const exportedAt = new Date().toISOString();
  const angleLabel = TONE_LABELS[settings.tone] ?? settings.tone;
  const serviceLabel = SERVICE_DATA[settings.service]?.name ?? settings.service;
  return ads.map((ad) => [
    String(ad.number),
    ad.service || serviceLabel,
    ad.format,
    ad.headline,
    ad.primary_text,
    ad.description,
    ad.cta,
    ad.destination_url,
    ad.image_prompt,
    ad.video_script,
    angleLabel,
    settings.offer.trim(),
    settings.area.trim(),
    exportedAt,
  ]);
}

export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetMetadata> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to fetch Google Sheet metadata.');
  }

  const raw = (await res.json()) as {
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  };

  const tabs: SheetTabInfo[] = (raw.sheets ?? []).map((s, idx) => ({
    sheetId: s.properties?.sheetId ?? idx,
    title: s.properties?.title ?? `Tab ${idx + 1}`,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  }));

  return {
    spreadsheetId: raw.spreadsheetId,
    title: raw.properties?.title ?? 'Untitled Spreadsheet',
    spreadsheetUrl:
      raw.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${raw.spreadsheetId}/edit`,
    tabs,
  };
}

export async function readSpreadsheetTabRows(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string
): Promise<string[][]> {
  const range = `${quoteSheetTabTitle(tabTitle)}!A1:N20`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to read rows from Google Sheet.');
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

export async function createNewCampaignSpreadsheet(
  accessToken: string,
  title: string,
  settings: CampaignSettings,
  ads: GeneratedAd[]
): Promise<SheetMetadata> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: 'Tidyups Ads',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    await parseGoogleApiError(createRes, 'Failed to create Google Sheet.');
  }

  const created = (await createRes.json()) as {
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };

  const firstTabTitle = created.sheets?.[0]?.properties?.title ?? 'Tidyups Ads';
  const values = [SHEET_HEADER_ROW, ...buildSheetRows(settings, ads)];
  const range = `${quoteSheetTabTitle(firstTabTitle)}!A1`;

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      created.spreadsheetId
    )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!writeRes.ok) {
    await parseGoogleApiError(writeRes, 'Created sheet, but failed to write ad rows.');
  }

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title ?? title,
    spreadsheetUrl:
      created.spreadsheetUrl ??
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    tabs: [
      {
        sheetId: created.sheets?.[0]?.properties?.sheetId ?? 0,
        title: firstTabTitle,
      },
    ],
  };
}

export async function appendAdsToExistingSheet(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  settings: CampaignSettings,
  ads: GeneratedAd[]
): Promise<void> {
  // Check if tab is empty first so we include headers if needed
  const existingRows = await readSpreadsheetTabRows(accessToken, spreadsheetId, tabTitle);
  const rowsToAppend =
    existingRows.length === 0
      ? [SHEET_HEADER_ROW, ...buildSheetRows(settings, ads)]
      : buildSheetRows(settings, ads);

  const range = `${quoteSheetTabTitle(tabTitle)}!A1`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rowsToAppend }),
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to append ads to Google Sheet.');
  }
}

export async function overwriteSheetTabWithAds(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  settings: CampaignSettings,
  ads: GeneratedAd[]
): Promise<void> {
  const clearRange = `${quoteSheetTabTitle(tabTitle)}!A:Z`;
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(clearRange)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );
  if (!clearRes.ok) {
    await parseGoogleApiError(clearRes, 'Failed to clear sheet tab before overwrite.');
  }

  const writeRange = `${quoteSheetTabTitle(tabTitle)}!A1`;
  const values = [SHEET_HEADER_ROW, ...buildSheetRows(settings, ads)];
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );
  if (!writeRes.ok) {
    await parseGoogleApiError(writeRes, 'Failed to write ad rows to Google Sheet.');
  }
}
