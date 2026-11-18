export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type ServiceKey =
  | 'moveout'
  | 'deep'
  | 'standard'
  | 'movein'
  | 'recurring'
  | 'commercial'
  | 'airbnb';

export type ToneKey = 'trust' | 'urgent' | 'relief' | 'premium' | 'local';

export type CreativeFormat = '1:1' | '4:5' | '9:16' | '16:9';

export interface CampaignSettings {
  title: string;
  service: ServiceKey;
  tone: ToneKey;
  count: number;
  format: CreativeFormat;
  offer: string;
  area: string;
  booking: string;
  phone: string;
  notes: string;
}

export interface GeneratedAd {
  id?: string;
  number: number;
  service: string;
  format: CreativeFormat;
  headline: string;
  primary_text: string;
  description: string;
  cta: string;
  destination_url: string;
  image_prompt: string;
  video_script: string;
}

export interface SavedCampaign {
  id: string;
  ownerId: string;
  title: string;
  service: ServiceKey;
  tone: ToneKey;
  format: CreativeFormat;
  offer: string;
  area: string;
  bookingUrl: string;
  businessPhone: string;
  notes: string;
  adCount: number;
  linkedSheetId: string;
  linkedSheetName: string;
  linkedDriveFileId: string;
  linkedDriveFileName: string;
  createdAtMillis: number;
  updatedAtMillis: number;
}

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  tabs: SheetTabInfo[];
}

export interface PendingConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'warning' | 'danger';
  onConfirm: () => Promise<void>;
}

// Blueprint validation constants synchronized verbatim with firebase-blueprint.json
export const BLUEPRINT_LIMITS = {
  idMax: 128,
  idRegex: /^[a-zA-Z0-9_-]+$/,
  httpsUrlRegex: /^https:\/\/.+$/,
  titleMax: 120,
  offerMax: 160,
  areaMax: 120,
  bookingUrlMin: 8,
  bookingUrlMax: 300,
  phoneMin: 7,
  phoneMax: 40,
  notesMax: 500,
  adCountMin: 1,
  adCountMax: 10,
  linkedIdMax: 128,
  linkedNameMax: 200,
  serviceNameMax: 80,
  headlineMax: 150,
  primaryTextMax: 2000,
  descriptionMax: 300,
  ctaMax: 40,
  promptMax: 2000,
  scriptMax: 2000,
} as const;
