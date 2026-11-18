import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../firebase';
import {
  ArrivalWindow,
  BLUEPRINT_LIMITS,
  BookingFrequency,
  BookingRequestRecord,
  BookingStatus,
  CustomerInquiryRecord,
  InquiryCategory,
  InquiryChannel,
  InquiryStatus,
  OperationType,
  ServiceKey,
  SqftTier,
} from '../types';
import { SERVICE_DATA, triggerBrowserDownload } from '../utils/adGenerator';

const LOCAL_BOOKINGS_KEY = 'tidyups-local-bookings';
const LOCAL_INQUIRIES_KEY = 'tidyups-local-inquiries';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, BLUEPRINT_LIMITS.idMax);
  return cleaned || `id_${Date.now()}`;
}

export function generateBookingReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `TU-${suffix}`;
}

export function generateInquiryTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SUP-${suffix}`;
}

export function loadLocalBookings(): BookingRequestRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BookingRequestRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalBookings(items: BookingRequestRecord[]): void {
  try {
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(items.slice(0, 25)));
  } catch {
    // ignore storage quota errors
  }
}

export function loadLocalInquiries(): CustomerInquiryRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_INQUIRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomerInquiryRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalInquiries(items: CustomerInquiryRecord[]): void {
  try {
    localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    // ignore storage quota errors
  }
}

export interface CreateBookingInput {
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
}

export async function createBookingRequest(
  input: CreateBookingInput
): Promise<BookingRequestRecord> {
  const id = sanitizeId(`book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const referenceCode = generateBookingReferenceCode();
  const nowMillis = Date.now();

  const safePayload = {
    referenceCode,
    service: input.service,
    frequency: input.frequency,
    bedrooms: Math.min(Math.max(Math.round(input.bedrooms), 0), 10),
    bathrooms: Math.min(Math.max(Math.round(input.bathrooms), 1), 8),
    sqftTier: input.sqftTier,
    addOnsSummary: input.addOnsSummary.trim().slice(0, BLUEPRINT_LIMITS.addOnsSummaryMax),
    preferredDate: input.preferredDate.trim().slice(0, BLUEPRINT_LIMITS.preferredDateMax),
    arrivalWindow: input.arrivalWindow,
    estimatedTotalCad: Math.min(Math.max(Math.round(input.estimatedTotalCad), 50), 25000),
    customerName: input.customerName.trim().slice(0, BLUEPRINT_LIMITS.customerNameMax),
    customerEmail: input.customerEmail.trim().slice(0, BLUEPRINT_LIMITS.customerEmailMax),
    customerPhone: input.customerPhone.trim().slice(0, BLUEPRINT_LIMITS.phoneMax),
    serviceAddress: input.serviceAddress.trim().slice(0, BLUEPRINT_LIMITS.serviceAddressMax),
    notes: input.notes.trim().slice(0, BLUEPRINT_LIMITS.notesMax),
    status: 'requested' as BookingStatus,
  };

  const currentUser = auth.currentUser;
  const canSyncCloud = Boolean(currentUser && currentUser.emailVerified);

  if (canSyncCloud && currentUser) {
    const path = `bookingRequests/${id}`;
    try {
      await setDoc(doc(db, 'bookingRequests', id), {
        ownerId: currentUser.uid,
        ...safePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const record: BookingRequestRecord = {
    id,
    ownerId: currentUser?.uid || 'local_visitor',
    ...safePayload,
    createdAtMillis: nowMillis,
    updatedAtMillis: nowMillis,
    syncedToCloud: canSyncCloud,
  };

  const existingLocal = loadLocalBookings().filter((b) => b.id !== record.id);
  saveLocalBookings([record, ...existingLocal]);
  return record;
}

export async function updateBookingRequestStatus(
  record: BookingRequestRecord,
  nextStatus: BookingStatus
): Promise<BookingRequestRecord> {
  const currentUser = auth.currentUser;
  if (record.syncedToCloud && currentUser && currentUser.uid === record.ownerId) {
    const path = `bookingRequests/${record.id}`;
    try {
      await updateDoc(doc(db, 'bookingRequests', record.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  const updated: BookingRequestRecord = {
    ...record,
    status: nextStatus,
    updatedAtMillis: Date.now(),
  };
  const nextLocal = loadLocalBookings().map((item) =>
    item.id === record.id ? updated : item
  );
  saveLocalBookings(nextLocal);
  return updated;
}

export async function deleteBookingRequest(record: BookingRequestRecord): Promise<void> {
  const currentUser = auth.currentUser;
  if (record.syncedToCloud && currentUser && currentUser.uid === record.ownerId) {
    const path = `bookingRequests/${record.id}`;
    try {
      await deleteDoc(doc(db, 'bookingRequests', record.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
  saveLocalBookings(loadLocalBookings().filter((b) => b.id !== record.id));
}

export function subscribeToUserBookings(
  ownerId: string,
  onBookings: (items: BookingRequestRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'bookingRequests'),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: BookingRequestRecord[] = snapshot.docs.map((snap) => {
        const d = snap.data();
        const createdTs = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
        const updatedTs = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : createdTs;
        return {
          id: snap.id,
          ownerId: String(d.ownerId ?? ''),
          referenceCode: String(d.referenceCode ?? ''),
          service: (d.service as ServiceKey) || 'standard',
          frequency: (d.frequency as BookingFrequency) || 'once',
          bedrooms: Number(d.bedrooms ?? 2),
          bathrooms: Number(d.bathrooms ?? 1),
          sqftTier: (d.sqftTier as SqftTier) || '1000to1800',
          addOnsSummary: String(d.addOnsSummary ?? ''),
          preferredDate: String(d.preferredDate ?? ''),
          arrivalWindow: (d.arrivalWindow as ArrivalWindow) || 'morning',
          estimatedTotalCad: Number(d.estimatedTotalCad ?? 0),
          customerName: String(d.customerName ?? ''),
          customerEmail: String(d.customerEmail ?? ''),
          customerPhone: String(d.customerPhone ?? ''),
          serviceAddress: String(d.serviceAddress ?? ''),
          notes: String(d.notes ?? ''),
          status: (d.status as BookingStatus) || 'requested',
          createdAtMillis: createdTs,
          updatedAtMillis: updatedTs,
          syncedToCloud: true,
        };
      });
      onBookings(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'bookingRequests');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export interface CreateInquiryInput {
  channel: InquiryChannel;
  category: InquiryCategory;
  name: string;
  email: string;
  phone: string;
  bookingRef: string;
  message: string;
}

export async function createCustomerInquiry(
  input: CreateInquiryInput
): Promise<CustomerInquiryRecord> {
  const id = sanitizeId(`inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const ticketCode = generateInquiryTicketCode();
  const nowMillis = Date.now();

  const safePayload = {
    ticketCode,
    channel: input.channel,
    category: input.category,
    name: input.name.trim().slice(0, BLUEPRINT_LIMITS.customerNameMax),
    email: input.email.trim().slice(0, BLUEPRINT_LIMITS.customerEmailMax),
    phone: input.phone.trim().slice(0, BLUEPRINT_LIMITS.phoneMax),
    bookingRef: input.bookingRef.trim().slice(0, BLUEPRINT_LIMITS.bookingRefMax),
    message: input.message.trim().slice(0, BLUEPRINT_LIMITS.inquiryMessageMax),
    status: 'open' as InquiryStatus,
  };

  const currentUser = auth.currentUser;
  const canSyncCloud = Boolean(currentUser && currentUser.emailVerified);

  if (canSyncCloud && currentUser) {
    const path = `inquiries/${id}`;
    try {
      await setDoc(doc(db, 'inquiries', id), {
        ownerId: currentUser.uid,
        ...safePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const record: CustomerInquiryRecord = {
    id,
    ownerId: currentUser?.uid || 'local_visitor',
    ...safePayload,
    createdAtMillis: nowMillis,
    updatedAtMillis: nowMillis,
    syncedToCloud: canSyncCloud,
  };

  const existingLocal = loadLocalInquiries().filter((item) => item.id !== record.id);
  saveLocalInquiries([record, ...existingLocal]);
  return record;
}

export async function resolveCustomerInquiry(
  record: CustomerInquiryRecord
): Promise<CustomerInquiryRecord> {
  const currentUser = auth.currentUser;
  if (record.syncedToCloud && currentUser && currentUser.uid === record.ownerId) {
    const path = `inquiries/${record.id}`;
    try {
      await updateDoc(doc(db, 'inquiries', record.id), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  const updated: CustomerInquiryRecord = {
    ...record,
    status: 'resolved',
    updatedAtMillis: Date.now(),
  };
  saveLocalInquiries(
    loadLocalInquiries().map((item) => (item.id === record.id ? updated : item))
  );
  return updated;
}

export function subscribeToUserInquiries(
  ownerId: string,
  onInquiries: (items: CustomerInquiryRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'inquiries'),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CustomerInquiryRecord[] = snapshot.docs.map((snap) => {
        const d = snap.data();
        const createdTs = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
        const updatedTs = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : createdTs;
        return {
          id: snap.id,
          ownerId: String(d.ownerId ?? ''),
          ticketCode: String(d.ticketCode ?? ''),
          channel: (d.channel as InquiryChannel) || 'contact',
          category: (d.category as InquiryCategory) || 'general',
          name: String(d.name ?? ''),
          email: String(d.email ?? ''),
          phone: String(d.phone ?? ''),
          bookingRef: String(d.bookingRef ?? ''),
          message: String(d.message ?? ''),
          status: (d.status as InquiryStatus) || 'open',
          createdAtMillis: createdTs,
          updatedAtMillis: updatedTs,
          syncedToCloud: true,
        };
      });
      onInquiries(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'inquiries');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function downloadBookingCalendarInvite(booking: BookingRequestRecord): void {
  const dateClean = booking.preferredDate.replace(/-/g, '');
  const startHour =
    booking.arrivalWindow === 'morning'
      ? '083000'
      : booking.arrivalWindow === 'midday'
      ? '120000'
      : '150000';
  const endHour =
    booking.arrivalWindow === 'morning'
      ? '113000'
      : booking.arrivalWindow === 'midday'
      ? '150000'
      : '180000';

  const serviceLabel = SERVICE_DATA[booking.service]?.name || 'Cleaning Service';
  const icsBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tidyups Cleaning Service Inc.//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.referenceCode}@tidyupscleaning.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${dateClean}T${startHour}`,
    `DTEND:${dateClean}T${endHour}`,
    `SUMMARY:Tidyups ${serviceLabel} (${booking.referenceCode})`,
    `LOCATION:${booking.serviceAddress.replace(/,/g, '\\,')}`,
    `DESCRIPTION:Reference: ${booking.referenceCode}\\nEstimated Total: $${booking.estimatedTotalCad} CAD (incl. GST)\\nTidyups Support: 780-718-5092 | cleaningserviceyeg@gmail.com`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  triggerBrowserDownload(
    `tidyups-booking-${booking.referenceCode.toLowerCase()}.ics`,
    icsBody,
    'text/calendar;charset=utf-8'
  );
}
