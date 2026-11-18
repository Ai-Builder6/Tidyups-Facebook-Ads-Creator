import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  Phone,
  Search,
  Send,
} from 'lucide-react';
import supportHeroImg from '../assets/images/support_contact_edmonton_interior_1794995428972.jpg';
import {
  createCustomerInquiry,
  resolveCustomerInquiry,
} from '../services/customerPortalStore';
import {
  AppPage,
  BLUEPRINT_LIMITS,
  CustomerInquiryRecord,
  InquiryCategory,
} from '../types';
import { PAGE_PATHS } from '../utils/routing';

interface SupportPageProps {
  user: User | null;
  inquiries: CustomerInquiryRecord[];
  onInquiriesRefresh: () => void;
  onNavigate: (page: AppPage) => void;
  onStatus: (msg: string) => void;
}

type FaqFilter = 'all' | 'cleaning' | 'guarantee' | 'billing' | 'workspace';

interface FaqItem {
  id: string;
  category: Exclude<FaqFilter, 'all'>;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'moveout-vs-deep',
    category: 'cleaning',
    question: 'What is the difference between Move-Out Cleaning and Deep Cleaning?',
    answer:
      'Move-Out Cleaning is designed for completely empty homes prior to a landlord, tenant, or buyer walkthrough and can include empty cabinet/drawer interiors, inside oven, and inside fridge add-ons. Deep Cleaning is tailored for furnished, lived-in Edmonton homes needing thorough buildup removal on baseboards, bathrooms, showers, and kitchens.',
  },
  {
    id: 'guarantee-24h',
    category: 'guarantee',
    question: 'How does the Tidyups 24-Hour Satisfaction Guarantee work?',
    answer:
      'If any item on your booked cleaning checklist was missed, notify Tidyups within 24 hours of service completion via 780-718-5092, cleaningserviceyeg@gmail.com, or the support ticket form on this page. Our Edmonton team will return promptly to re-clean the affected area at no extra charge.',
  },
  {
    id: 'supplies-pets',
    category: 'cleaning',
    question: 'Do cleaners bring their own supplies, and are pet-friendly homes welcome?',
    answer:
      'Yes. Tidyups crews bring commercial-grade vacuums, microfiber cloths, and surface-safe cleaning solutions. We gladly clean pet-friendly homes across Edmonton—simply note friendly dogs/cats or request our Pet Hair Detailing extra when booking.',
  },
  {
    id: 'reschedule-window',
    category: 'billing',
    question: 'What is your rescheduling or cancellation window?',
    answer:
      'You can reschedule or cancel free of charge with at least 24 hours notice prior to your arrival window. Same-day lockouts or cancellations with less than 24 hours notice may incur a $65 dispatch fee to compensate our scheduled crew.',
  },
  {
    id: 'gst-receipts',
    category: 'billing',
    question: 'Are itemized Alberta GST receipts provided for landlords or offices?',
    answer:
      'Yes. Every completed residential, move-out, Airbnb turnover, and commercial clean receives an itemized receipt showing the 5% Alberta GST breakdown—ready for landlord move-out documentation or business expense accounting.',
  },
  {
    id: 'sheets-leads-ads',
    category: 'workspace',
    question: 'How do I export Facebook Ads to colored-tab Google Sheets and Google Drive?',
    answer:
      'Open the Campaigns & Sheets studio page, generate your ad variations, and click "Save Colored-Tab Sheet" or "1-Click Upload Leads Ads Folder". Sign in with Google when prompted to create a formatted 4-tab spreadsheet and complete Meta Lead Ads asset folder directly in your Google Drive.',
  },
  {
    id: 'meta-privacy-link',
    category: 'workspace',
    question: 'Where do I get the Privacy Policy and Booking URLs required by Meta Lead Forms?',
    answer:
      'Meta Instant Forms require an active Privacy Policy link. Visit our /privacy page and click "Copy /privacy Link for Meta Lead Ads", or use /booking as the destination URL in your Facebook and Instagram ad campaigns.',
  },
];

const SUPPORT_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  reschedule: 'Reschedule or Entry Code Update',
  guarantee: '24-Hour Walkthrough Satisfaction Guarantee',
  billing: 'Itemized GST Receipt or Billing Question',
  workspace: 'Facebook Ads, Google Sheets or Drive Help',
  quote: 'Cleaning Scope or Quote Question',
  commercial: 'Commercial / Office Account Support',
  general: 'General Customer Support',
};

export const SupportPage: React.FC<SupportPageProps> = ({
  user,
  inquiries,
  onInquiriesRefresh,
  onNavigate,
  onStatus,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [faqFilter, setFaqFilter] = useState<FaqFilter>('all');
  const [openFaqId, setOpenFaqId] = useState<string>('moveout-vs-deep');

  // Support ticket state
  const [category, setCategory] = useState<InquiryCategory>('reschedule');
  const [bookingRef, setBookingRef] = useState('');
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<CustomerInquiryRecord | null>(null);

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      const matchesCat = faqFilter === 'all' || item.category === faqFilter;
      const matchesText =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);
      return matchesCat && matchesText;
    });
  }, [searchQuery, faqFilter]);

  const supportTickets = useMemo(
    () => inquiries.filter((item) => item.channel === 'support'),
    [inquiries]
  );

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < BLUEPRINT_LIMITS.customerNameMin) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address so our support team can reply.');
      return;
    }
    if (message.trim().length < BLUEPRINT_LIMITS.inquiryMessageMin) {
      setError('Please describe how our Edmonton support team can help.');
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await createCustomerInquiry({
        channel: 'support',
        category,
        name,
        email,
        phone,
        bookingRef,
        message,
      });
      setCreatedTicket(ticket);
      setMessage('');
      onInquiriesRefresh();
      onStatus(`Support ticket ${ticket.ticketCode} created.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Could not submit support ticket: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full p-3 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-sm text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2';

  return (
    <div className="space-y-8">
      {/* Editorial Support Header & Search */}
      <section className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold text-[#56249a] dark:text-[#c084fc] m-0">
            Support Center · Tidyups Cleaning Service Inc. · Edmonton, AB
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#241436] dark:text-white mt-2 mb-2.5 text-balance">
            How Can Our Edmonton Team Help You Today?
          </h2>
          <p className="text-sm text-[#6c6277] dark:text-slate-300 leading-relaxed m-0">
            Find answers on cleaning checklists, move-out walkthrough guarantees, GST receipts, and Facebook Ads / Google Workspace exports—or open a direct support ticket below.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pt-2">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-[#7f6e8a] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search checklists, 24-hour guarantee, rescheduling, Google Sheets…"
              aria-label="Search support articles"
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#f3eef9] dark:bg-[#120d1d]">
            {(
              [
                { key: 'all', label: 'All Topics' },
                { key: 'cleaning', label: 'Checklists' },
                { key: 'guarantee', label: '24h Guarantee' },
                { key: 'billing', label: 'Billing & GST' },
                { key: 'workspace', label: 'Ads & Sheets' },
              ] as Array<{ key: FaqFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFaqFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  faqFilter === tab.key
                    ? 'bg-white dark:bg-[#2b1f44] text-[#56249a] dark:text-white shadow-xs'
                    : 'text-[#6c6277] dark:text-slate-400 hover:text-[#241436] dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hairline-Divided FAQ Accordion */}
        <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342] border-t border-[#e8e1ef] dark:border-[#2d2342] pt-1">
          {filteredFaqs.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6c6277] dark:text-slate-400">
              No matching articles for &ldquo;{searchQuery}&rdquo;. Submit a support request below and we will reply promptly.
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? '' : faq.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-bold text-[#241436] dark:text-slate-100">
                      {faq.question}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#56249a] dark:text-[#c084fc] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6c6277] dark:text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-2.5 mb-0 text-sm text-[#6c6277] dark:text-slate-300 leading-relaxed max-w-[72ch]">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 2-Column Direct Support Channels + Ticket Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl overflow-hidden">
          <div className="aspect-video w-full bg-[#1e1333]">
            {!imgFailed ? (
              <img
                src={supportHeroImg}
                alt="Spotless welcoming Canadian living space cared for by Tidyups"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-[#3b1578] to-[#831843] text-white p-6">
                <HelpCircle className="w-8 h-8 opacity-90" />
              </div>
            )}
          </div>

          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
              Direct Edmonton Help Desk
            </h3>
            <p className="text-xs text-[#6c6277] dark:text-slate-400 leading-relaxed m-0">
              Need immediate assistance with an upcoming arrival window or move-out inspection? Reach dispatch directly.
            </p>

            <div className="space-y-3 pt-2 border-t border-[#e8e1ef] dark:border-[#2d2342] text-sm tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#6c6277] dark:text-slate-400">Phone &amp; SMS</span>
                <a
                  href="tel:7807185092"
                  className="inline-flex items-center gap-1.5 font-bold text-[#56249a] dark:text-[#d8b4fe] underline"
                >
                  <Phone className="w-3.5 h-3.5" />
                  780-718-5092
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#6c6277] dark:text-slate-400">Support Email</span>
                <a
                  href="mailto:cleaningserviceyeg@gmail.com"
                  className="inline-flex items-center gap-1.5 font-bold text-[#56249a] dark:text-[#d8b4fe] underline truncate"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  cleaningserviceyeg@gmail.com
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#6c6277] dark:text-slate-400">Dispatch Hours</span>
                <span className="text-xs font-semibold text-[#241436] dark:text-slate-200">
                  Mon–Sat 8:00 AM – 7:00 PM MST
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#e8e1ef] dark:border-[#2d2342] flex flex-wrap gap-3 text-xs font-bold">
              <a
                href={PAGE_PATHS.booking}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('booking');
                  }
                }}
                className="text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap"
              >
                Book a Clean
              </a>
              <span aria-hidden="true" className="text-[#6c6277]">·</span>
              <a
                href={PAGE_PATHS.contact}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('contact');
                  }
                }}
                className="text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap"
              >
                Contact Office
              </a>
              <span aria-hidden="true" className="text-[#6c6277]">·</span>
              <a
                href={PAGE_PATHS.terms}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('terms');
                  }
                }}
                className="text-[#56249a] dark:text-[#c084fc] underline whitespace-nowrap"
              >
                Terms &amp; Conditions
              </a>
            </div>
          </div>
        </div>

        {/* Submit Support Ticket Form */}
        <form
          onSubmit={(e) => {
            void handleTicketSubmit(e);
          }}
          className="lg:col-span-7 bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <div>
            <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
              Submit a Support Ticket
            </h3>
            <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-1 mb-0">
              Typical response time under 2 business hours during Edmonton dispatch hours.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sup-category"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Support topic
              </label>
              <select
                id="sup-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as InquiryCategory)}
                className={inputClass}
              >
                {(Object.keys(SUPPORT_CATEGORY_LABELS) as InquiryCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {SUPPORT_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sup-ref"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Booking reference (optional)
              </label>
              <input
                id="sup-ref"
                type="text"
                maxLength={BLUEPRINT_LIMITS.bookingRefMax}
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="e.g., TU-849201"
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="sup-name"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Your name
              </label>
              <input
                id="sup-name"
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.customerNameMax}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="sup-email"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Email
              </label>
              <input
                id="sup-email"
                type="email"
                required
                maxLength={BLUEPRINT_LIMITS.customerEmailMax}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="sup-phone"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Phone (optional)
              </label>
              <input
                id="sup-phone"
                type="tel"
                maxLength={BLUEPRINT_LIMITS.phoneMax}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="780-555-0199"
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="sup-message"
              className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
            >
              How can we help?
            </label>
            <textarea
              id="sup-message"
              required
              maxLength={BLUEPRINT_LIMITS.inquiryMessageMax}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share details about your cleaning schedule, entry instructions, or campaign export question…"
              className={`${inputClass} min-h-[110px] resize-y`}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-800 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          {createdTicket && (
            <div
              aria-live="polite"
              className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold tabular-nums">
                  Support Ticket {createdTicket.ticketCode} Logged
                </div>
                <div className="mt-0.5">
                  We have recorded your request for {createdTicket.email}. For urgent same-day schedule updates, call 780-718-5092.
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting Ticket…' : 'Submit Support Request'}
          </button>

          {supportTickets.length > 0 && (
            <div className="pt-5 mt-4 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-3">
              <div className="text-xs font-bold text-[#241436] dark:text-slate-200">
                Your Support Tickets ({supportTickets.length})
              </div>
              <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342]">
                {supportTickets.map((t) => (
                  <div
                    key={t.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#241436] dark:text-white tabular-nums">
                        {t.ticketCode} · {SUPPORT_CATEGORY_LABELS[t.category]} ·{' '}
                        <span className="capitalize">{t.status}</span>
                      </div>
                      <div className="text-xs text-[#6c6277] dark:text-slate-400 truncate max-w-lg">
                        {t.message}
                      </div>
                    </div>
                    {t.status === 'open' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveCustomerInquiry(t);
                          onInquiriesRefresh();
                          onStatus(`Marked support ticket ${t.ticketCode} as resolved.`);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
