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

export type AppPage =
  | 'campaigns'
  | 'images'
  | 'videos'
  | 'brand'
  | 'booking'
  | 'support'
  | 'terms'
  | 'contact'
  | 'privacy';

export type BookingFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly';
export type SqftTier = 'under1000' | '1000to1800' | '1800to2600' | 'over2600';
export type ArrivalWindow = 'morning' | 'midday' | 'afternoon';
export type BookingStatus = 'requested' | 'confirmed' | 'cancelled';

export interface BookingRequestRecord {
  id: string;
  ownerId: string;
  referenceCode: string;
  service: ServiceKey;
  frequency: BookingFrequency;
  bedrooms: number;
  bathrooms: number;
  sqftTier: SqftTier;
  addOnsSummary: string;
  preferredDate: string;
  arrivalWindow: ArrivalWindow;
  estimatedTotalCad: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceAddress: string;
  notes: string;
  status: BookingStatus;
  createdAtMillis: number;
  updatedAtMillis: number;
  syncedToCloud?: boolean;
}

export type InquiryChannel = 'contact' | 'support';
export type InquiryCategory =
  | 'quote'
  | 'commercial'
  | 'reschedule'
  | 'guarantee'
  | 'billing'
  | 'workspace'
  | 'general';
export type InquiryStatus = 'open' | 'resolved';

export interface CustomerInquiryRecord {
  id: string;
  ownerId: string;
  ticketCode: string;
  channel: InquiryChannel;
  category: InquiryCategory;
  name: string;
  email: string;
  phone: string;
  bookingRef: string;
  message: string;
  status: InquiryStatus;
  createdAtMillis: number;
  updatedAtMillis: number;
  syncedToCloud?: boolean;
}

export type ServiceKey =
  | 'moveout'
  | 'deep'
  | 'standard'
  | 'movein'
  | 'recurring'
  | 'commercial'
  | 'airbnb';

export type CreativeServiceTag = ServiceKey | 'brand';

export type ToneKey = 'trust' | 'urgent' | 'relief' | 'premium' | 'local';

export type CreativeFormat = '1:1' | '4:5' | '9:16' | '16:9';

export type CreativeAspectRatio = '1:1' | '3:4' | '4:3' | '4:5' | '9:16' | '16:9';

export type CreativeCategory = 'ad-image' | 'video-ad' | 'brand-logo' | 'brand-icon';

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

export interface CreativeAsset {
  id: string;
  ownerId: string;
  category: CreativeCategory;
  title: string;
  prompt: string;
  service: CreativeServiceTag;
  aspectRatio: CreativeAspectRatio;
  modelUsed: string;
  previewDataUrl: string;
  svgMarkup: string;
  durationLabel: string;
  interactionId: string;
  driveFileId: string;
  driveWebViewLink: string;
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
  assetTitleMax: 140,
  modelUsedMax: 80,
  previewDataUrlMax: 180000,
  svgMarkupMax: 40000,
  durationLabelMax: 24,
  interactionIdMax: 160,
  driveWebViewLinkMax: 400,
  referenceCodeMin: 9,
  referenceCodeMax: 16,
  referenceCodeRegex: /^TU-[A-Z0-9]{6,12}$/,
  ticketCodeMin: 10,
  ticketCodeMax: 16,
  ticketCodeRegex: /^SUP-[A-Z0-9]{6,12}$/,
  customerNameMin: 2,
  customerNameMax: 100,
  customerEmailMin: 5,
  customerEmailMax: 160,
  serviceAddressMin: 5,
  serviceAddressMax: 240,
  addOnsSummaryMax: 240,
  preferredDateMin: 8,
  preferredDateMax: 20,
  bookingRefMax: 32,
  inquiryMessageMin: 5,
  inquiryMessageMax: 1500,
} as const;
