import { buildTidyupsSvgLogo } from '../components/TidyupsLogo';
import {
  CampaignSettings,
  DriveFileSummary,
  GeneratedAd,
  SheetMetadata,
  SheetTabInfo,
} from '../types';
import { adsToCsv, adsToJson, FORMAT_LABELS, SERVICE_DATA, TONE_LABELS } from '../utils/adGenerator';

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

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export interface LeadsAdsFolderBundleResult {
  folder: DriveFileSummary;
  sheet: SheetMetadata;
  uploadedFiles: DriveFileSummary[];
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
    throw new Error(
      'AUTH_EXPIRED: Your Google Workspace session expired. Please reconnect Google Workspace.'
    );
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
    pageSize: '15',
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

export async function createDriveFolder(
  accessToken: string,
  folderName: string
): Promise<DriveFileSummary> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to create Leads Ads folder in Google Drive.');
  }
  const created = (await res.json()) as DriveFileSummary;
  return {
    ...created,
    webViewLink:
      created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

export async function moveFileIntoDriveFolder(
  accessToken: string,
  fileId: string,
  folderId: string
): Promise<void> {
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  let removeParents = '';
  if (metaRes.ok) {
    const meta = (await metaRes.json()) as { parents?: string[] };
    if (meta.parents && meta.parents.length > 0) {
      removeParents = meta.parents.join(',');
    }
  }

  const params = new URLSearchParams({
    addParents: folderId,
    fields: 'id,parents',
  });
  if (removeParents) {
    params.set('removeParents', removeParents);
  }

  const moveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!moveRes.ok) {
    await parseGoogleApiError(moveRes, 'Failed to place Google Sheet into Leads Ads folder.');
  }
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string,
  parentFolderId?: string
): Promise<DriveFileSummary> {
  const boundary = `tidyups_boundary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: fileName,
    mimeType,
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

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

export async function ensurePortfolioDriveFolder(
  accessToken: string,
  folderName = 'Tidyups Creative Portfolio'
): Promise<DriveFileSummary> {
  const escaped = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${escaped}'`;
  const params = new URLSearchParams({
    pageSize: '1',
    q,
    fields: 'files(id,name,mimeType,webViewLink)',
  });
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (searchRes.ok) {
    const found = (await searchRes.json()) as { files?: DriveFileSummary[] };
    if (found.files && found.files.length > 0) {
      return found.files[0];
    }
  }
  return createDriveFolder(accessToken, folderName);
}

export async function uploadBase64MediaToDrive(
  accessToken: string,
  fileName: string,
  dataUrl: string,
  parentFolderId?: string
): Promise<DriveFileSummary> {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx !== -1 ? dataUrl.slice(0, commaIdx) : '';
  const base64Body = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

  const binary = atob(base64Body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const boundary = `tidyups_bin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: fileName,
    mimeType,
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([preamble, bytes, closing], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );
  if (!res.ok) {
    await parseGoogleApiError(res, 'Failed to upload creative media to Google Drive.');
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

// ---------------- Google Sheets API (Bright Colored Tabs & Styled Headers) ----------------

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

const AD_COPY_HEADERS = [
  'Ad #',
  'Cleaning Service',
  'Format',
  'Headline',
  'Primary Ad Copy',
  'Link Description',
  'CTA Button',
  'Booking URL',
  'Advertising Angle',
  'Special Offer',
  'Target Area',
  'Exported Timestamp',
];

const CREATIVE_STUDIO_HEADERS = [
  'Ad #',
  'Aspect Ratio',
  'Headline Reference',
  'Photorealistic Image Prompt',
  '10-Second Reel / Story Script',
  'Brand Styling Notes',
];

const LEAD_TRACKER_HEADERS = [
  'Lead Date',
  'Customer Name',
  'Phone Number',
  'Email Address',
  'Edmonton Neighborhood / Postal',
  'Requested Cleaning Service',
  'Home / Office Size',
  'Preferred Clean Date',
  'Source Ad Variation',
  'Special Offer',
  'Lead Status',
  'Quote & Follow-Up Notes',
];

const CAMPAIGN_BRIEF_HEADERS = ['Campaign Setting', 'Configured Value', 'Publishing Notes'];

function buildAdCopyRows(settings: CampaignSettings, ads: GeneratedAd[]): string[][] {
  const exportedAt = new Date().toLocaleString();
  const angleLabel = TONE_LABELS[settings.tone] ?? settings.tone;
  const serviceLabel = SERVICE_DATA[settings.service]?.name ?? settings.service;
  return ads.map((ad) => [
    `Ad ${ad.number}`,
    ad.service || serviceLabel,
    ad.format,
    ad.headline,
    ad.primary_text,
    ad.description,
    ad.cta,
    ad.destination_url,
    angleLabel,
    settings.offer.trim() || 'Standard pricing',
    settings.area.trim(),
    exportedAt,
  ]);
}

function buildCreativeRows(ads: GeneratedAd[]): string[][] {
  return ads.map((ad) => [
    `Ad ${ad.number}`,
    ad.format,
    ad.headline,
    ad.image_prompt,
    ad.video_script,
    'Use official Tidyups light or dark logo from Leads Ads folder; royal purple (#56249A) & pink (#E746A6).',
  ]);
}

function buildLeadTrackerSeedRows(settings: CampaignSettings, ads: GeneratedAd[]): string[][] {
  const serviceLabel = SERVICE_DATA[settings.service]?.name ?? settings.service;
  const firstAdLabel = ads[0] ? `Ad 1 — ${ads[0].headline}` : 'Ad 1';
  return [
    [
      new Date().toISOString().slice(0, 10),
      'Sample Lead (Replace with Meta Lead Sync)',
      settings.phone.trim(),
      'booking@tidyupscleaning.com',
      settings.area.trim(),
      serviceLabel,
      '3 Bed / 2.5 Bath',
      'Flexible — Next 7 Days',
      firstAdLabel,
      settings.offer.trim() || 'Standard Quote',
      'New Lead',
      'Instant Form Qualifying Qs: 1) Service Type 2) Approx SqFt/Bedrooms 3) Preferred Date.',
    ],
  ];
}

function buildCampaignBriefRows(settings: CampaignSettings, ads: GeneratedAd[]): string[][] {
  const serviceLabel = SERVICE_DATA[settings.service]?.name ?? settings.service;
  const angleLabel = TONE_LABELS[settings.tone] ?? settings.tone;
  const formatLabel = FORMAT_LABELS[settings.format] ?? settings.format;
  return [
    ['Brand', 'Tidyups Cleaning Service Inc.', 'Edmonton, Alberta'],
    ['Campaign Name', settings.title.trim() || `${serviceLabel} Campaign`, 'Active Campaign Draft'],
    ['Cleaning Service', serviceLabel, 'Target service category'],
    ['Advertising Angle', angleLabel, 'Primary conversion hook'],
    ['Creative Aspect Ratio', formatLabel, 'Recommended Meta placement format'],
    ['Generated Variations', String(ads.length), 'Saved across Ad Copy & Creative tabs'],
    ['Special Offer', settings.offer.trim() || 'None specified', 'Verify promo approval before launch'],
    ['Target Area', settings.area.trim(), 'Geo-targeting radius in Meta Ads Manager'],
    ['Booking Destination URL', settings.booking.trim(), 'HTTPS conversion URL'],
    ['Business Phone', settings.phone.trim(), 'Call / SMS extension number'],
    [
      'Additional Instructions',
      settings.notes.trim() || 'Standard brand guidelines',
      'Applied to creative prompts',
    ],
  ];
}

function buildStyledSheetFormattingRequests(params: {
  sheetId: number;
  columnCount: number;
  columnWidths: number[];
  bannerBg: RgbColor;
  headerBg: RgbColor;
  zebraTint: RgbColor;
  bandedRowEnd: number;
}): Record<string, unknown>[] {
  const {
    sheetId,
    columnCount,
    columnWidths,
    bannerBg,
    headerBg,
    zebraTint,
    bandedRowEnd,
  } = params;

  const white: RgbColor = { red: 1, green: 1, blue: 1 };
  const darkText: RgbColor = { red: 0.14, green: 0.08, blue: 0.21 };
  const borderSubtle: RgbColor = { red: 0.88, green: 0.84, blue: 0.93 };

  const requests: Record<string, unknown>[] = [
    // Merge Row 1 full-width Campaign Banner
    {
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: columnCount,
        },
        mergeType: 'MERGE_ALL',
      },
    },
    // Row 1 Banner visual styling
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: columnCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: bannerBg,
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
            padding: { top: 10, bottom: 10, left: 14, right: 14 },
            textFormat: {
              foregroundColor: white,
              fontFamily: 'Arial',
              fontSize: 13,
              bold: true,
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,verticalAlignment,horizontalAlignment,padding,textFormat)',
      },
    },
    // Row 2 Column Header Bar visual styling
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: columnCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerBg,
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
            wrapStrategy: 'WRAP',
            padding: { top: 8, bottom: 8, left: 10, right: 10 },
            textFormat: {
              foregroundColor: white,
              fontFamily: 'Arial',
              fontSize: 10,
              bold: true,
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,verticalAlignment,horizontalAlignment,wrapStrategy,padding,textFormat)',
      },
    },
    // Data Rows clean typography, top-alignment & text wrap
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 2,
          endRowIndex: bandedRowEnd,
          startColumnIndex: 0,
          endColumnIndex: columnCount,
        },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'TOP',
            wrapStrategy: 'WRAP',
            padding: { top: 8, bottom: 8, left: 10, right: 10 },
            textFormat: {
              foregroundColor: darkText,
              fontFamily: 'Arial',
              fontSize: 10,
              bold: false,
            },
          },
        },
        fields: 'userEnteredFormat(verticalAlignment,wrapStrategy,padding,textFormat)',
      },
    },
    // Alternating row banding for visual scannability
    {
      addBanding: {
        bandedRange: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: bandedRowEnd,
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
          rowProperties: {
            headerColor: headerBg,
            firstBandColor: white,
            secondBandColor: zebraTint,
          },
        },
      },
    },
    // Subtle clean grid borders around populated table
    {
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: bandedRowEnd,
          startColumnIndex: 0,
          endColumnIndex: columnCount,
        },
        top: { style: 'SOLID_MEDIUM', color: headerBg },
        bottom: { style: 'SOLID', color: borderSubtle },
        innerHorizontal: { style: 'SOLID', color: borderSubtle },
        innerVertical: { style: 'SOLID', color: borderSubtle },
      },
    },
    // Banner Row 1 height (46px)
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 46 },
        fields: 'pixelSize',
      },
    },
    // Header Row 2 height (38px)
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: 1,
          endIndex: 2,
        },
        properties: { pixelSize: 38 },
        fields: 'pixelSize',
      },
    },
  ];

  columnWidths.forEach((px, colIdx) => {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: colIdx,
          endIndex: colIdx + 1,
        },
        properties: { pixelSize: px },
        fields: 'pixelSize',
      },
    });
  });

  return requests;
}

function buildLegacySheetRows(settings: CampaignSettings, ads: GeneratedAd[]): string[][] {
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
  const range = `${quoteSheetTabTitle(tabTitle)}!A1:N25`;
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

/**
 * Creates a multi-tab Google Sheet with bright colored tabs and styled banner/column headers:
 *  - Tab 1 (Bright Electric Purple): Ad Copy & Variations
 *  - Tab 2 (Bright Magenta Pink): Creative & Video Scripts
 *  - Tab 3 (Bright Emerald Green): Lead Ads Form & Tracking
 *  - Tab 4 (Bright Amber Gold): Campaign Brief
 */
export async function createNewCampaignSpreadsheet(
  accessToken: string,
  title: string,
  settings: CampaignSettings,
  ads: GeneratedAd[]
): Promise<SheetMetadata> {
  const TAB_ADS = { id: 101, title: 'Ad Copy & Variations' };
  const TAB_CREATIVE = { id: 102, title: 'Creative & Video Scripts' };
  const TAB_LEADS = { id: 103, title: 'Lead Ads Tracker' };
  const TAB_BRIEF = { id: 104, title: 'Campaign Brief' };

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
            sheetId: TAB_ADS.id,
            title: TAB_ADS.title,
            tabColorStyle: {
              rgbColor: { red: 0.55, green: 0.22, blue: 0.96 }, // Bright Electric Purple
            },
            gridProperties: {
              rowCount: Math.max(ads.length + 25, 50),
              columnCount: AD_COPY_HEADERS.length,
              frozenRowCount: 2,
            },
          },
        },
        {
          properties: {
            sheetId: TAB_CREATIVE.id,
            title: TAB_CREATIVE.title,
            tabColorStyle: {
              rgbColor: { red: 0.95, green: 0.24, blue: 0.62 }, // Bright Hot Pink
            },
            gridProperties: {
              rowCount: Math.max(ads.length + 20, 40),
              columnCount: CREATIVE_STUDIO_HEADERS.length,
              frozenRowCount: 2,
            },
          },
        },
        {
          properties: {
            sheetId: TAB_LEADS.id,
            title: TAB_LEADS.title,
            tabColorStyle: {
              rgbColor: { red: 0.06, green: 0.76, blue: 0.52 }, // Bright Emerald Green
            },
            gridProperties: {
              rowCount: 100,
              columnCount: LEAD_TRACKER_HEADERS.length,
              frozenRowCount: 2,
            },
          },
        },
        {
          properties: {
            sheetId: TAB_BRIEF.id,
            title: TAB_BRIEF.title,
            tabColorStyle: {
              rgbColor: { red: 0.98, green: 0.62, blue: 0.05 }, // Bright Amber Gold
            },
            gridProperties: {
              rowCount: 30,
              columnCount: CAMPAIGN_BRIEF_HEADERS.length,
              frozenRowCount: 2,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    await parseGoogleApiError(createRes, 'Failed to create styled Google Sheet.');
  }

  const created = (await createRes.json()) as {
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
  };

  const serviceName = SERVICE_DATA[settings.service]?.name ?? settings.service;
  const campaignBannerTitle = `TIDYUPS CLEANING SERVICE · ${
    settings.title.trim() || serviceName
  } (${ads.length} Ad Variations · Edmonton, AB)`;

  // Populate all 4 tabs in one batchUpdate call
  const valuesBatchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      created.spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${quoteSheetTabTitle(TAB_ADS.title)}!A1`,
            values: [
              [campaignBannerTitle],
              AD_COPY_HEADERS,
              ...buildAdCopyRows(settings, ads),
            ],
          },
          {
            range: `${quoteSheetTabTitle(TAB_CREATIVE.title)}!A1`,
            values: [
              [`TIDYUPS CREATIVE STUDIO · IMAGE PROMPTS & 10-SECOND REEL SCRIPTS (${serviceName})`],
              CREATIVE_STUDIO_HEADERS,
              ...buildCreativeRows(ads),
            ],
          },
          {
            range: `${quoteSheetTabTitle(TAB_LEADS.title)}!A1`,
            values: [
              [`TIDYUPS META LEAD ADS TRACKER · INCOMING QUOTE REQUESTS (${settings.area.trim()})`],
              LEAD_TRACKER_HEADERS,
              ...buildLeadTrackerSeedRows(settings, ads),
            ],
          },
          {
            range: `${quoteSheetTabTitle(TAB_BRIEF.title)}!A1`,
            values: [
              [`TIDYUPS CAMPAIGN CONFIGURATION & PUBLISHING BRIEF`],
              CAMPAIGN_BRIEF_HEADERS,
              ...buildCampaignBriefRows(settings, ads),
            ],
          },
        ],
      }),
    }
  );

  if (!valuesBatchRes.ok) {
    await parseGoogleApiError(valuesBatchRes, 'Created sheet, but failed to write ad values.');
  }

  // Apply rich banner headers, bold white column headers, alternating row banding, and widths
  const styleRequests: Record<string, unknown>[] = [
    ...buildStyledSheetFormattingRequests({
      sheetId: TAB_ADS.id,
      columnCount: AD_COPY_HEADERS.length,
      columnWidths: [75, 165, 85, 220, 390, 230, 105, 240, 185, 165, 180, 165],
      bannerBg: { red: 0.27, green: 0.13, blue: 0.53 }, // Deep Royal Purple
      headerBg: { red: 0.48, green: 0.18, blue: 0.85 }, // Vibrant Violet Header
      zebraTint: { red: 0.98, green: 0.96, blue: 1.0 },
      bandedRowEnd: Math.max(ads.length + 10, 20),
    }),
    ...buildStyledSheetFormattingRequests({
      sheetId: TAB_CREATIVE.id,
      columnCount: CREATIVE_STUDIO_HEADERS.length,
      columnWidths: [75, 100, 220, 420, 420, 260],
      bannerBg: { red: 0.58, green: 0.09, blue: 0.34 }, // Rich Berry Banner
      headerBg: { red: 0.86, green: 0.15, blue: 0.47 }, // Bright Pink Header
      zebraTint: { red: 1.0, green: 0.96, blue: 0.98 },
      bandedRowEnd: Math.max(ads.length + 10, 20),
    }),
    ...buildStyledSheetFormattingRequests({
      sheetId: TAB_LEADS.id,
      columnCount: LEAD_TRACKER_HEADERS.length,
      columnWidths: [115, 180, 135, 210, 190, 185, 145, 155, 210, 155, 125, 290],
      bannerBg: { red: 0.02, green: 0.37, blue: 0.27 }, // Deep Emerald Banner
      headerBg: { red: 0.04, green: 0.58, blue: 0.41 }, // Bright Emerald Header
      zebraTint: { red: 0.95, green: 0.99, blue: 0.97 },
      bandedRowEnd: 40,
    }),
    ...buildStyledSheetFormattingRequests({
      sheetId: TAB_BRIEF.id,
      columnCount: CAMPAIGN_BRIEF_HEADERS.length,
      columnWidths: [210, 320, 320],
      bannerBg: { red: 0.57, green: 0.25, blue: 0.05 }, // Rich Amber Banner
      headerBg: { red: 0.85, green: 0.47, blue: 0.02 }, // Bright Gold-Amber Header
      zebraTint: { red: 1.0, green: 0.98, blue: 0.93 },
      bandedRowEnd: 15,
    }),
  ];

  const formatRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      created.spreadsheetId
    )}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: styleRequests }),
    }
  );

  if (!formatRes.ok) {
    await parseGoogleApiError(
      formatRes,
      'Created sheet values, but failed to apply tab and header formatting.'
    );
  }

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title ?? title,
    spreadsheetUrl:
      created.spreadsheetUrl ??
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    tabs: [
      { sheetId: TAB_ADS.id, title: TAB_ADS.title },
      { sheetId: TAB_CREATIVE.id, title: TAB_CREATIVE.title },
      { sheetId: TAB_LEADS.id, title: TAB_LEADS.title },
      { sheetId: TAB_BRIEF.id, title: TAB_BRIEF.title },
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
  const existingRows = await readSpreadsheetTabRows(accessToken, spreadsheetId, tabTitle);
  const usesStyledTwelveColLayout =
    existingRows.length >= 2 && existingRows[1]?.[0] === 'Ad #' && existingRows[1]?.length === 12;

  const rowsToAppend =
    existingRows.length === 0
      ? [SHEET_HEADER_ROW, ...buildLegacySheetRows(settings, ads)]
      : usesStyledTwelveColLayout
      ? buildAdCopyRows(settings, ads)
      : buildLegacySheetRows(settings, ads);

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

  const serviceName = SERVICE_DATA[settings.service]?.name ?? settings.service;
  const banner = `TIDYUPS CLEANING SERVICE · ${
    settings.title.trim() || serviceName
  } (${ads.length} Ad Variations)`;
  const writeRange = `${quoteSheetTabTitle(tabTitle)}!A1`;
  const values = [banner ? [banner] : [], AD_COPY_HEADERS, ...buildAdCopyRows(settings, ads)];

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

// ---------------- 1-Click Leads Ads Folder Bundle to Google Drive ----------------

function buildLeadAdsInstantFormMarkdown(
  settings: CampaignSettings,
  ads: GeneratedAd[]
): string {
  const serviceName = SERVICE_DATA[settings.service]?.name ?? settings.service;
  const angleName = TONE_LABELS[settings.tone] ?? settings.tone;
  const offerLine = settings.offer.trim()
    ? `Special Offer: ${settings.offer.trim()}`
    : 'Special Offer: Free Personalized Cleaning Quote';

  const adBlocks = ads
    .map(
      (ad) =>
        `### Ad Variation ${ad.number} (${ad.format}) — ${ad.headline}\n` +
        `**Primary Text:**\n${ad.primary_text}\n\n` +
        `**Description:** ${ad.description}\n` +
        `**CTA:** ${ad.cta} | **URL:** ${ad.destination_url}\n\n` +
        `**Image Prompt:**\n${ad.image_prompt}\n\n` +
        `**10s Video Script:**\n${ad.video_script}`
    )
    .join('\n\n---\n\n');

  return [
    `# Tidyups Meta Lead Ads Launch Kit — ${settings.title.trim() || serviceName}`,
    ``,
    `- **Business:** Tidyups Cleaning Service Inc. (Edmonton, AB)`,
    `- **Service Focus:** ${serviceName}`,
    `- **Advertising Angle:** ${angleName}`,
    `- **Target Area:** ${settings.area.trim()}`,
    `- **Phone:** ${settings.phone.trim()}`,
    `- **Booking Page:** ${settings.booking.trim()}`,
    `- **${offerLine}**`,
    ``,
    `## Recommended Facebook / Instagram Lead Form Setup`,
    `- **Form Type:** More Volume (mobile-friendly quick quote)`,
    `- **Intro Headline:** Get Your Fast ${serviceName} Quote in Edmonton`,
    `- **Intro Paragraph:** Tell us a few details about your space and Tidyups Cleaning Service will follow up with your tailored quote.${
      settings.offer.trim() ? ` Includes: ${settings.offer.trim()}.` : ''
    }`,
    `- **Qualifying Question 1 (Multiple Choice):** Which cleaning service do you need? (${serviceName} / Deep Clean / Move-Out / Recurring Home Clean)`,
    `- **Qualifying Question 2 (Multiple Choice):** Approximate size of your space? (1–2 Bedrooms / 3–4 Bedrooms / 5+ Bedrooms / Commercial Office)`,
    `- **Qualifying Question 3 (Short Answer):** Preferred cleaning date or move-out deadline?`,
    `- **Contact Fields:** Full Name, Phone Number, Email, City / Postal Code`,
    `- **Completion Screen CTA:** Book Online Now -> ${settings.booking.trim()} (or call ${settings.phone.trim()})`,
    ``,
    `---`,
    ``,
    `## Generated Ad Variations (${ads.length})`,
    ``,
    adBlocks,
    ``,
  ].join('\n');
}

export async function uploadLeadsAdsFolderBundle(
  accessToken: string,
  settings: CampaignSettings,
  ads: GeneratedAd[]
): Promise<LeadsAdsFolderBundleResult> {
  const serviceName = SERVICE_DATA[settings.service]?.name ?? settings.service;
  const dateStamp = new Date().toISOString().slice(0, 10);
  const baseTitle = settings.title.trim() || `Tidyups ${serviceName}`;
  const folderName = `Leads Ads — ${baseTitle} (${dateStamp})`;
  const slug = baseTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44);

  // 1. Create the dedicated "Leads Ads" folder in Google Drive
  const folder = await createDriveFolder(accessToken, folderName);

  // 2. Create the 4-tab bright-colored Google Sheet and move it into the folder
  const sheetTitle = `${baseTitle} — Styled Ads & Lead Tracker`;
  const sheet = await createNewCampaignSpreadsheet(accessToken, sheetTitle, settings, ads);
  await moveFileIntoDriveFolder(accessToken, sheet.spreadsheetId, folder.id);

  // 3. Upload CSV, JSON, Meta Lead Ads Instant Form Guide, and Light/Dark SVG Brand Logos into the folder
  const uploadedFiles = await Promise.all([
    uploadFileToDrive(
      accessToken,
      `tidyups-${slug || 'leads'}-ads.csv`,
      adsToCsv(ads),
      'text/csv;charset=utf-8',
      folder.id
    ),
    uploadFileToDrive(
      accessToken,
      `tidyups-${slug || 'leads'}-ads.json`,
      adsToJson(ads, baseTitle),
      'application/json',
      folder.id
    ),
    uploadFileToDrive(
      accessToken,
      `tidyups-${slug || 'leads'}-meta-lead-form-kit.md`,
      buildLeadAdsInstantFormMarkdown(settings, ads),
      'text/markdown;charset=utf-8',
      folder.id
    ),
    uploadFileToDrive(
      accessToken,
      'tidyups-logo-light.svg',
      buildTidyupsSvgLogo('light'),
      'image/svg+xml;charset=utf-8',
      folder.id
    ),
    uploadFileToDrive(
      accessToken,
      'tidyups-logo-dark.svg',
      buildTidyupsSvgLogo('dark'),
      'image/svg+xml;charset=utf-8',
      folder.id
    ),
  ]);

  return {
    folder,
    sheet,
    uploadedFiles,
  };
}
