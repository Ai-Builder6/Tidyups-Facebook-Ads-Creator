import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Phone,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import bookingHeroImg from '../assets/images/booking_hero_edmonton_home_1794995428831.jpg';
import {
  createBookingRequest,
  deleteBookingRequest,
  downloadBookingCalendarInvite,
  updateBookingRequestStatus,
} from '../services/customerPortalStore';
import {
  AppPage,
  ArrivalWindow,
  BLUEPRINT_LIMITS,
  BookingFrequency,
  BookingRequestRecord,
  ServiceKey,
  SqftTier,
} from '../types';
import { SERVICE_DATA, triggerBrowserDownload } from '../utils/adGenerator';
import {
  OFFICIAL_BOOKING_URL,
  OFFICIAL_FACEBOOK_URL,
  PAGE_PATHS,
} from '../utils/routing';

interface BookingPageProps {
  user: User | null;
  bookings: BookingRequestRecord[];
  onBookingsRefresh: () => void;
  onSignIn: () => Promise<string | null>;
  onNavigate: (page: AppPage) => void;
  onUseBookingUrlInAds: (url: string) => void;
  onStatus: (msg: string) => void;
}

interface AddOnOption {
  id: string;
  label: string;
  priceCad: number;
}

const ADD_ON_OPTIONS: AddOnOption[] = [
  { id: 'oven', label: 'Inside Oven Detailing', priceCad: 45 },
  { id: 'fridge', label: 'Inside Refrigerator Clean', priceCad: 45 },
  { id: 'windows', label: 'Interior Window Glass & Tracks', priceCad: 55 },
  { id: 'cabinets', label: 'Empty Cabinet Interiors', priceCad: 50 },
  { id: 'baseboards', label: 'Hand-Wiped Baseboards & Doors', priceCad: 40 },
  { id: 'pets', label: 'Pet Hair & Upholstery Detail', priceCad: 35 },
];

const BASE_SERVICE_RATES: Record<ServiceKey, number> = {
  standard: 155,
  recurring: 145,
  deep: 225,
  movein: 255,
  moveout: 275,
  airbnb: 165,
  commercial: 210,
};

const SQFT_SURCHARGE: Record<SqftTier, { label: string; addCad: number; addHours: number }> = {
  under1000: { label: 'Under 1,000 sq. ft.', addCad: 0, addHours: 0 },
  '1000to1800': { label: '1,000 – 1,800 sq. ft.', addCad: 35, addHours: 0.75 },
  '1800to2600': { label: '1,800 – 2,600 sq. ft.', addCad: 75, addHours: 1.5 },
  over2600: { label: '2,600+ sq. ft.', addCad: 125, addHours: 2.5 },
};

const FREQUENCY_META: Record<BookingFrequency, { label: string; discountRate: number }> = {
  once: { label: 'One-Time Clean', discountRate: 0 },
  weekly: { label: 'Weekly (Save 15%)', discountRate: 0.15 },
  biweekly: { label: 'Bi-Weekly (Save 10%)', discountRate: 0.1 },
  monthly: { label: 'Monthly (Save 5%)', discountRate: 0.05 },
};

const ARRIVAL_LABELS: Record<ArrivalWindow, string> = {
  morning: 'Morning (8:30 AM – 11:30 AM)',
  midday: 'Midday (12:00 PM – 3:00 PM)',
  afternoon: 'Afternoon (3:00 PM – 6:00 PM)',
};

function getDefaultBookingDate(): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + 3);
  return dt.toISOString().split('T')[0];
}

export const BookingPage: React.FC<BookingPageProps> = ({
  user,
  bookings,
  onBookingsRefresh,
  onSignIn,
  onNavigate,
  onUseBookingUrlInAds,
  onStatus,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Estimator & form state
  const [service, setService] = useState<ServiceKey>('moveout');
  const [frequency, setFrequency] = useState<BookingFrequency>('once');
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [sqftTier, setSqftTier] = useState<SqftTier>('1000to1800');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(['oven', 'cabinets']);
  const [preferredDate, setPreferredDate] = useState<string>(getDefaultBookingDate);
  const [arrivalWindow, setArrivalWindow] = useState<ArrivalWindow>('morning');
  const [customerName, setCustomerName] = useState<string>(user?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState<string>(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [serviceAddress, setServiceAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [latestConfirmation, setLatestConfirmation] = useState<BookingRequestRecord | null>(null);

  const quote = useMemo(() => {
    const base = BASE_SERVICE_RATES[service];
    const roomAdd = Math.max(0, bedrooms - 1) * 24 + Math.max(0, bathrooms - 1) * 28;
    const sqftAdd = SQFT_SURCHARGE[sqftTier].addCad;
    const addOnsTotal = selectedAddOns.reduce((sum, id) => {
      const found = ADD_ON_OPTIONS.find((item) => item.id === id);
      return sum + (found ? found.priceCad : 0);
    }, 0);

    const grossSubtotal = base + roomAdd + sqftAdd + addOnsTotal;
    const discountCad = Math.round(grossSubtotal * FREQUENCY_META[frequency].discountRate);
    const netSubtotal = grossSubtotal - discountCad;
    const gstCad = Math.round(netSubtotal * 0.05);
    const totalCad = netSubtotal + gstCad;
    const estHours =
      Math.round(
        (2.5 + bedrooms * 0.45 + bathrooms * 0.5 + SQFT_SURCHARGE[sqftTier].addHours + selectedAddOns.length * 0.4) *
          2
      ) / 2;

    return {
      base,
      roomAdd,
      sqftAdd,
      addOnsTotal,
      grossSubtotal,
      discountCad,
      netSubtotal,
      gstCad,
      totalCad,
      estHours,
    };
  }, [service, bedrooms, bathrooms, sqftTier, selectedAddOns, frequency]);

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const copyBookingPageUrl = async () => {
    const url = OFFICIAL_BOOKING_URL;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      onStatus(`Copied ${url} to clipboard.`);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      onStatus(`Booking URL: ${url}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = customerName.trim();
    const trimmedEmail = customerEmail.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedAddress = serviceAddress.trim();

    if (trimmedName.length < BLUEPRINT_LIMITS.customerNameMin) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address for your booking confirmation.');
      return;
    }
    if (trimmedPhone.replace(/\D/g, '').length < 10) {
      setFormError('Please enter a 10-digit Edmonton or Canadian phone number.');
      return;
    }
    if (trimmedAddress.length < BLUEPRINT_LIMITS.serviceAddressMin) {
      setFormError('Please enter the street address and city/community for the clean.');
      return;
    }
    if (!preferredDate) {
      setFormError('Please select a preferred cleaning date.');
      return;
    }

    const addOnsSummary = selectedAddOns
      .map((id) => ADD_ON_OPTIONS.find((opt) => opt.id === id)?.label)
      .filter(Boolean)
      .join(', ');

    setIsSubmitting(true);
    try {
      const created = await createBookingRequest({
        service,
        frequency,
        bedrooms,
        bathrooms,
        sqftTier,
        addOnsSummary,
        preferredDate,
        arrivalWindow,
        estimatedTotalCad: quote.totalCad,
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        customerPhone: trimmedPhone,
        serviceAddress: trimmedAddress,
        notes,
      });
      setLatestConfirmation(created);
      onBookingsRefresh();
      onStatus(
        `Booking request ${created.referenceCode} confirmed (${
          created.syncedToCloud ? 'saved to Firebase Cloud' : 'saved in browser'
        }).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`Could not submit booking request: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadReceiptTxt = (record: BookingRequestRecord) => {
    const body = [
      'TIDYUPS CLEANING SERVICE INC. — BOOKING ESTIMATE & CONFIRMATION',
      '===============================================================',
      `Booking Reference : ${record.referenceCode}`,
      `Status            : ${record.status.toUpperCase()}`,
      `Service           : ${SERVICE_DATA[record.service]?.name || record.service}`,
      `Frequency         : ${FREQUENCY_META[record.frequency]?.label || record.frequency}`,
      `Property Size     : ${record.bedrooms} Bed · ${record.bathrooms} Bath · ${SQFT_SURCHARGE[record.sqftTier]?.label}`,
      `Detail Add-Ons    : ${record.addOnsSummary || 'Standard Checklist Only'}`,
      `Preferred Date    : ${record.preferredDate}`,
      `Arrival Window    : ${ARRIVAL_LABELS[record.arrivalWindow]}`,
      `Service Address   : ${record.serviceAddress}`,
      `Customer          : ${record.customerName} (${record.customerPhone} · ${record.customerEmail})`,
      `Estimated Total   : $${record.estimatedTotalCad} CAD (includes 5% Alberta GST)`,
      '',
      'BookMyCleaning-Tidyups (Tidyups Cleaning Service Inc.) · Edmonton, Alberta',
      'Booking Page: https://app.tidyupscleaning.com/booking · Facebook: https://facebook.com/tidyupsbooking',
      'Phone: 587-742-2500 · Email: booking@tidyupscleaning.com',
      'Backed by our 24-Hour Walkthrough Satisfaction Guarantee.',
    ].join('\r\n');

    triggerBrowserDownload(
      `tidyups-quote-${record.referenceCode.toLowerCase()}.txt`,
      body,
      'text/plain;charset=utf-8'
    );
  };

  const inputClass =
    'w-full p-3 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-sm text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2';

  return (
    <div className="space-y-8">
      {/* Split-Column Hero Section */}
      <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#56249a] dark:text-[#c084fc] m-0">
                BookMyCleaning-Tidyups · Edmonton, Alberta + 20 km · 587-742-2500 · booking@tidyupscleaning.com
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#241436] dark:text-white mt-2.5 mb-3 text-balance">
                Book Spotless Home, Move-Out &amp; Office Cleaning in Minutes
              </h2>
              <p className="text-sm sm:text-base text-[#6c6277] dark:text-slate-300 leading-relaxed max-w-[60ch] m-0">
                Customize your room count, square footage, and detail checklist for transparent Edmonton pricing with zero hidden fees—backed by our 24-hour walkthrough re-clean guarantee.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-[#e8e1ef] dark:border-[#2d2342]">
              <a
                href="#booking-estimator"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-bold text-sm hover:opacity-95 whitespace-nowrap shrink-0"
              >
                <Calendar className="w-4 h-4" />
                Start Instant Quote
              </a>

              <button
                type="button"
                onClick={() => {
                  void copyBookingPageUrl();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Booking URL
              </button>

              <button
                type="button"
                onClick={() => {
                  onUseBookingUrlInAds(OFFICIAL_BOOKING_URL);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                Use in Active Ad Campaign
              </button>

              <a
                href={OFFICIAL_FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap shrink-0"
              >
                Facebook Page
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 min-h-[240px] bg-[#1e1333] relative">
            {!heroImgFailed ? (
              <img
                src={bookingHeroImg}
                alt="Sunlit spotless modern Edmonton kitchen and living space after Tidyups cleaning"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full min-h-[240px] grid place-items-center p-8 bg-gradient-to-br from-[#3b1578] to-[#831843] text-white text-center">
                <div>
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-90" />
                  <p className="text-sm font-bold m-0">Tidyups Cleaning Service Inc.</p>
                  <p className="text-xs opacity-80 mt-1 m-0">Edmonton &amp; Surrounding Areas</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full-Width 4-Column Service Proof Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#e8e1ef] dark:divide-[#2d2342] border-t border-[#e8e1ef] dark:border-[#2d2342] bg-[#fcfbfe] dark:bg-[#140e21]">
          <div className="p-4 sm:p-5">
            <div className="text-sm font-extrabold text-[#241436] dark:text-white tabular-nums">
              24-Hour Guarantee
            </div>
            <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5">
              Complimentary touch-up if any checklist item is missed
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-sm font-extrabold text-[#241436] dark:text-white tabular-nums">
              Edmonton + 20 km
            </div>
            <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5">
              St. Albert, Sherwood Park, Spruce Grove, Leduc &amp; Beaumont
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-sm font-extrabold text-[#241436] dark:text-white tabular-nums">
              Up to 15% Savings
            </div>
            <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5">
              Automatic recurring discounts on weekly &amp; bi-weekly plans
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-sm font-extrabold text-[#241436] dark:text-white tabular-nums">
              587-742-2500
            </div>
            <div className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5">
              Direct local Edmonton dispatch &amp; supplies included
            </div>
          </div>
        </div>
      </section>

      {/* Instant Quote & Booking Form */}
      <form
        id="booking-estimator"
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        <div className="lg:col-span-8 bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 sm:p-8 space-y-8">
          {/* Step 01 */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
              01. Select Cleaning Service &amp; Frequency
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="book-service"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Service package
                </label>
                <select
                  id="book-service"
                  value={service}
                  onChange={(e) => setService(e.target.value as ServiceKey)}
                  className={inputClass}
                >
                  {(Object.keys(SERVICE_DATA) as ServiceKey[]).map((key) => (
                    <option key={key} value={key}>
                      {SERVICE_DATA[key].name} (from ${BASE_SERVICE_RATES[key]} CAD)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="book-sqft"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Approximate property size
                </label>
                <select
                  id="book-sqft"
                  value={sqftTier}
                  onChange={(e) => setSqftTier(e.target.value as SqftTier)}
                  className={`${inputClass} tabular-nums`}
                >
                  {(Object.keys(SQFT_SURCHARGE) as SqftTier[]).map((tier) => (
                    <option key={tier} value={tier}>
                      {SQFT_SURCHARGE[tier].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-2">
                Cleaning frequency
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 rounded-xl bg-[#f3eef9] dark:bg-[#120d1d]">
                {(Object.keys(FREQUENCY_META) as BookingFrequency[]).map((freqKey) => {
                  const active = frequency === freqKey;
                  return (
                    <button
                      key={freqKey}
                      type="button"
                      onClick={() => setFrequency(freqKey)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap truncate cursor-pointer tabular-nums ${
                        active
                          ? 'bg-white dark:bg-[#2b1f44] text-[#56249a] dark:text-white shadow-xs'
                          : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
                      }`}
                    >
                      {FREQUENCY_META[freqKey].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 02 */}
          <div className="pt-6 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-4">
            <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
              02. Rooms &amp; Detail Add-Ons
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="book-bedrooms"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Bedrooms / Office Areas
                </label>
                <select
                  id="book-bedrooms"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className={`${inputClass} tabular-nums`}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count === 0 ? 'Studio / Bachelor' : `${count} Bedroom${count > 1 ? 's' : ''}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="book-bathrooms"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Bathrooms / Washrooms
                </label>
                <select
                  id="book-bathrooms"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  className={`${inputClass} tabular-nums`}
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count} Bathroom{count > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-2">
                Optional deep-detail extras
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ADD_ON_OPTIONS.map((addon) => {
                  const checked = selectedAddOns.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddOn(addon.id)}
                      aria-pressed={checked}
                      className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                        checked
                          ? 'border-[#56249a] dark:border-[#a855f7] bg-[#faf5ff] dark:bg-[#231938] text-[#241436] dark:text-white'
                          : 'border-[#e2d8ec] dark:border-[#2d2342] bg-white dark:bg-[#120d1d] text-[#6c6277] dark:text-slate-300 hover:border-[#b79fd4]'
                      }`}
                    >
                      <span className="truncate">{addon.label}</span>
                      <span className="font-bold text-[#56249a] dark:text-[#d8b4fe] tabular-nums whitespace-nowrap shrink-0">
                        +${addon.priceCad}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 03 */}
          <div className="pt-6 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-4">
            <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
              03. Preferred Date, Address &amp; Contact Info
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="book-date"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Preferred service date
                </label>
                <input
                  id="book-date"
                  type="date"
                  required
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </div>

              <div>
                <label
                  htmlFor="book-window"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Arrival window
                </label>
                <select
                  id="book-window"
                  value={arrivalWindow}
                  onChange={(e) => setArrivalWindow(e.target.value as ArrivalWindow)}
                  className={`${inputClass} tabular-nums`}
                >
                  {(Object.keys(ARRIVAL_LABELS) as ArrivalWindow[]).map((win) => (
                    <option key={win} value={win}>
                      {ARRIVAL_LABELS[win]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="book-address"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Edmonton-area street address &amp; community
              </label>
              <input
                id="book-address"
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.serviceAddressMax}
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                placeholder="e.g., 10420 Jasper Ave NW, Edmonton, AB"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="book-name"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Full name
                </label>
                <input
                  id="book-name"
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.customerNameMax}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="book-email"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="book-email"
                  type="email"
                  required
                  maxLength={BLUEPRINT_LIMITS.customerEmailMax}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="book-phone"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Phone number
                </label>
                <input
                  id="book-phone"
                  type="tel"
                  required
                  maxLength={BLUEPRINT_LIMITS.phoneMax}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="780-555-0199"
                  className={`${inputClass} tabular-nums`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="book-notes"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Entry instructions, pets, parking or promo code (optional)
              </label>
              <textarea
                id="book-notes"
                maxLength={BLUEPRINT_LIMITS.notesMax}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mention lockbox/buzz code, friendly pets, move-out walkthrough time, or offer code."
                className={`${inputClass} min-h-[84px] resize-y`}
              />
            </div>

            {formError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-800 dark:text-rose-200"
              >
                {formError}
              </div>
            )}
          </div>
        </div>

        {/* Right Sticky Live Estimate Summary */}
        <aside className="lg:col-span-4 bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 space-y-5 lg:sticky lg:top-6">
          <div>
            <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
              Live Quote Summary
            </h3>
            <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-1 mb-0">
              {SERVICE_DATA[service].name} · {SQFT_SURCHARGE[sqftTier].label}
            </p>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342] text-sm tabular-nums">
            <div className="flex items-center justify-between text-[#6c6277] dark:text-slate-300">
              <span>Base service package</span>
              <span className="font-semibold text-[#241436] dark:text-white">${quote.base} CAD</span>
            </div>
            <div className="flex items-center justify-between text-[#6c6277] dark:text-slate-300">
              <span>
                Rooms ({bedrooms} BR · {bathrooms} BA) &amp; size
              </span>
              <span className="font-semibold text-[#241436] dark:text-white">
                +${quote.roomAdd + quote.sqftAdd} CAD
              </span>
            </div>
            <div className="flex items-center justify-between text-[#6c6277] dark:text-slate-300">
              <span>Detail add-ons ({selectedAddOns.length})</span>
              <span className="font-semibold text-[#241436] dark:text-white">
                +${quote.addOnsTotal} CAD
              </span>
            </div>
            {quote.discountCad > 0 && (
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                <span>{FREQUENCY_META[frequency].label}</span>
                <span>-${quote.discountCad} CAD</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[#6c6277] dark:text-slate-300 pt-2 border-t border-[#f0eaf7] dark:border-[#251c38]">
              <span>Alberta GST (5%)</span>
              <span className="font-semibold text-[#241436] dark:text-white">${quote.gstCad} CAD</span>
            </div>
            <div className="flex items-baseline justify-between pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342]">
              <span className="text-sm font-bold text-[#241436] dark:text-white">
                Estimated Total
              </span>
              <span className="text-2xl font-extrabold text-[#56249a] dark:text-[#e879f9]">
                ${quote.totalCad} CAD
              </span>
            </div>
            <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0">
              Est. crew duration: ~{quote.estHours} hrs · Supplies &amp; equipment included
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSubmitting ? 'Submitting Booking Request…' : 'Confirm Booking Request'}
          </button>

          <p className="text-xs text-[#6c6277] dark:text-slate-400 leading-relaxed m-0">
            No upfront card charge today. Submitting reserves your requested window and agrees to our{' '}
            <a
              href={PAGE_PATHS.terms}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('terms');
                }
              }}
              className="underline font-semibold text-[#56249a] dark:text-[#c084fc]"
            >
              Terms &amp; Conditions
            </a>{' '}
            and{' '}
            <a
              href={PAGE_PATHS.privacy}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('privacy');
                }
              }}
              className="underline font-semibold text-[#56249a] dark:text-[#c084fc]"
            >
              Privacy Policy
            </a>
            .
          </p>

          <div className="pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342] flex items-center justify-between text-xs text-[#6c6277] dark:text-slate-400 tabular-nums">
            <span>Prefer to book by phone?</span>
            <a
              href="tel:5877422500"
              className="inline-flex items-center gap-1 font-bold text-[#56249a] dark:text-[#d8b4fe] underline whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5" />
              587-742-2500
            </a>
          </div>
        </aside>
      </form>

      {/* Immediate Confirmation Banner */}
      {latestConfirmation && (
        <section
          aria-live="polite"
          className="bg-white dark:bg-[#181226] border border-emerald-300 dark:border-emerald-800 rounded-2xl p-6 space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 m-0">
                Booking Request Received · Reference {latestConfirmation.referenceCode}
              </p>
              <h3 className="text-xl font-extrabold text-[#241436] dark:text-white mt-1 mb-1">
                Thank you, {latestConfirmation.customerName} — your Edmonton clean is queued!
              </h3>
              <p className="text-sm text-[#6c6277] dark:text-slate-300 m-0 tabular-nums">
                {SERVICE_DATA[latestConfirmation.service]?.name} · {latestConfirmation.preferredDate} ·{' '}
                {ARRIVAL_LABELS[latestConfirmation.arrivalWindow]} · Est. ${latestConfirmation.estimatedTotalCad} CAD
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadBookingCalendarInvite(latestConfirmation)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                Download .ics Calendar
              </button>

              <button
                type="button"
                onClick={() => downloadReceiptTxt(latestConfirmation)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Quote (.txt)
              </button>

              <a
                href={`mailto:booking@tidyupscleaning.com?subject=${encodeURIComponent(
                  `Tidyups Booking Confirmation ${latestConfirmation.referenceCode}`
                )}&body=${encodeURIComponent(
                  `Hello Tidyups Team,\n\nPlease confirm my ${
                    SERVICE_DATA[latestConfirmation.service]?.name
                  } request (${latestConfirmation.referenceCode}) for ${
                    latestConfirmation.preferredDate
                  } (${ARRIVAL_LABELS[latestConfirmation.arrivalWindow]}) at ${
                    latestConfirmation.serviceAddress
                  }.\nPhone: ${latestConfirmation.customerPhone}\nEstimated Total: $${
                    latestConfirmation.estimatedTotalCad
                  } CAD`
                )}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0"
              >
                Email Dispatch Copy
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {!user && (
            <div className="pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6c6277] dark:text-slate-400">
              <span>
                Want to sync booking requests to your Tidyups Firebase Cloud workspace?
              </span>
              <button
                type="button"
                onClick={() => {
                  void onSignIn();
                }}
                className="font-bold text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap cursor-pointer"
              >
                Sign in with Google
              </button>
            </div>
          )}
        </section>
      )}

      {/* Saved / Recent Booking Requests */}
      {bookings.length > 0 && (
        <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
                Your Recent Booking Requests ({bookings.length})
              </h3>
              <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-0.5 mb-0">
                {user
                  ? 'Synced securely with Firebase Firestore (PII isolated to your account).'
                  : 'Saved locally in this browser session.'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342]">
            {bookings.map((item) => (
              <div
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-bold text-[#241436] dark:text-white tabular-nums">
                    {item.referenceCode} · {SERVICE_DATA[item.service]?.name || item.service} · $
                    {item.estimatedTotalCad} CAD
                  </div>
                  <div className="text-xs text-[#6c6277] dark:text-slate-400 tabular-nums">
                    {item.preferredDate} · {ARRIVAL_LABELS[item.arrivalWindow]} · {item.serviceAddress} · Status:{' '}
                    <span className="font-semibold text-[#241436] dark:text-slate-200 capitalize">
                      {item.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadBookingCalendarInvite(item)}
                    className="px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#221936] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    .ics Invite
                  </button>

                  {item.status === 'requested' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateBookingRequestStatus(item, 'confirmed');
                        onBookingsRefresh();
                        onStatus(`Marked booking ${item.referenceCode} as confirmed.`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#047857] text-white text-xs font-bold hover:bg-[#065f46] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Mark Confirmed
                    </button>
                  )}

                  {item.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateBookingRequestStatus(item, 'cancelled');
                        onBookingsRefresh();
                        onStatus(`Cancelled booking request ${item.referenceCode}.`);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      await deleteBookingRequest(item);
                      onBookingsRefresh();
                      onStatus(`Removed booking ${item.referenceCode}.`);
                    }}
                    title="Delete booking record"
                    className="p-1.5 rounded-lg border border-[#e8e1ef] dark:border-[#2d2342] text-[#6c6277] dark:text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
