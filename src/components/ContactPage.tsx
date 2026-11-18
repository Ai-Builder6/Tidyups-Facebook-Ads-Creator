import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Mail,
  MapPin,
  Phone,
  Send,
} from 'lucide-react';
import contactInteriorImg from '../assets/images/support_contact_edmonton_interior_1794995428972.jpg';
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

interface ContactPageProps {
  user: User | null;
  inquiries: CustomerInquiryRecord[];
  onInquiriesRefresh: () => void;
  onNavigate: (page: AppPage) => void;
  onStatus: (msg: string) => void;
}

const CONTACT_TOPIC_LABELS: Record<InquiryCategory, string> = {
  quote: 'Residential Cleaning Quote Question',
  commercial: 'Office & Commercial Walkthrough Request',
  general: 'Airbnb / Property Management Partnership',
  reschedule: 'Existing Booking Schedule Update',
  guarantee: '24-Hour Satisfaction Guarantee',
  billing: 'Billing or GST Invoice Inquiry',
  workspace: 'Marketing & Partnership Inquiry',
};

export const ContactPage: React.FC<ContactPageProps> = ({
  user,
  inquiries,
  onInquiriesRefresh,
  onNavigate,
  onStatus,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [copiedField, setCopiedField] = useState<'phone' | 'email' | null>(null);

  const [category, setCategory] = useState<InquiryCategory>('quote');
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<CustomerInquiryRecord | null>(null);

  const contactMessages = useMemo(
    () => inquiries.filter((item) => item.channel === 'contact'),
    [inquiries]
  );

  const copyContactValue = async (val: string, field: 'phone' | 'email') => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(field);
      onStatus(`Copied ${val} to clipboard.`);
      setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 1800);
    } catch {
      onStatus(val);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < BLUEPRINT_LIMITS.customerNameMin) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < BLUEPRINT_LIMITS.inquiryMessageMin) {
      setError('Please include a brief message or property description.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createCustomerInquiry({
        channel: 'contact',
        category,
        name,
        email,
        phone,
        bookingRef: '',
        message,
      });
      setSubmittedRecord(created);
      setMessage('');
      onInquiriesRefresh();
      onStatus(`Message ${created.ticketCode} sent to Tidyups Cleaning Service Inc.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Could not send message: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full p-3 border border-[#d8cde3] dark:border-[#35294f] rounded-xl bg-white dark:bg-[#120d1d] text-sm text-[#241436] dark:text-slate-100 placeholder:text-[#8b7e99] dark:placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-[#e987cc] focus-visible:outline-offset-2';

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Direct Edmonton Contact Details */}
        <section className="lg:col-span-5 bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="aspect-video w-full bg-[#1e1333]">
              {!imgFailed ? (
                <img
                  src={contactInteriorImg}
                  alt="Bright spotless Edmonton home interior maintained by Tidyups Cleaning Service"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center bg-gradient-to-br from-[#3b1578] to-[#831843] text-white p-6">
                  <MapPin className="w-8 h-8 opacity-90" />
                </div>
              )}
            </div>

            <div className="p-6 sm:p-7 space-y-5">
              <div>
                <p className="text-xs font-semibold text-[#56249a] dark:text-[#c084fc] m-0">
                  Contact Us · Edmonton, Alberta
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#241436] dark:text-white mt-1.5 mb-2 text-balance">
                  Get in Touch With Tidyups Cleaning Service Inc.
                </h2>
                <p className="text-sm text-[#6c6277] dark:text-slate-300 leading-relaxed m-0">
                  Call, text, or message our local Edmonton team for residential deep cleans, move-out walkthroughs, Airbnb turnovers, and custom commercial janitorial quotes.
                </p>
              </div>

              <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342] border-t border-b border-[#e8e1ef] dark:border-[#2d2342] tabular-nums">
                <div className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#6c6277] dark:text-slate-400">Call or Text</div>
                    <a
                      href="tel:7807185092"
                      className="text-sm font-extrabold text-[#241436] dark:text-white hover:underline inline-flex items-center gap-1.5 mt-0.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#56249a] dark:text-[#c084fc]" />
                      780-718-5092
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void copyContactValue('780-718-5092', 'phone');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedField === 'phone' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy
                  </button>
                </div>

                <div className="py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-[#6c6277] dark:text-slate-400">Email</div>
                    <a
                      href="mailto:cleaningserviceyeg@gmail.com"
                      className="text-sm font-extrabold text-[#241436] dark:text-white hover:underline inline-flex items-center gap-1.5 mt-0.5 truncate"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#56249a] dark:text-[#c084fc] shrink-0" />
                      cleaningserviceyeg@gmail.com
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void copyContactValue('cleaningserviceyeg@gmail.com', 'email');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedField === 'email' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy
                  </button>
                </div>

                <div className="py-3.5">
                  <div className="text-xs text-[#6c6277] dark:text-slate-400">Service Coverage</div>
                  <div className="text-xs font-semibold text-[#241436] dark:text-slate-200 mt-1 leading-relaxed">
                    Edmonton · St. Albert · Sherwood Park · Spruce Grove · Leduc · Beaumont · Fort Saskatchewan (+20 km)
                  </div>
                </div>

                <div className="py-3.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#6c6277] dark:text-slate-400">Operating Hours</span>
                  <span className="font-semibold text-[#241436] dark:text-slate-200">
                    Mon–Sat 8:00–19:00 · Sun 9:00–17:00 MST
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-3">
            <a
              href={PAGE_PATHS.booking}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('booking');
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-bold whitespace-nowrap shrink-0"
            >
              <Calendar className="w-3.5 h-3.5" />
              Instant Online Quote
            </a>

            <a
              href={PAGE_PATHS.support}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('support');
                }
              }}
              className="px-4 py-2.5 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0"
            >
              Visit Support FAQs
            </a>
          </div>
        </section>

        {/* Right Column: Interactive Contact Form */}
        <form
          onSubmit={(e) => {
            void handleContactSubmit(e);
          }}
          className="lg:col-span-7 bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-extrabold text-[#241436] dark:text-white m-0">
                Send a Message or Request a Commercial Walkthrough
              </h3>
              <p className="text-xs text-[#6c6277] dark:text-slate-400 mt-1 mb-0">
                Tell us about your home, rental property, or workplace and our Edmonton coordinator will get right back to you.
              </p>
            </div>

            <div>
              <label
                htmlFor="contact-topic"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Inquiry type
              </label>
              <select
                id="contact-topic"
                value={category}
                onChange={(e) => setCategory(e.target.value as InquiryCategory)}
                className={inputClass}
              >
                {(['quote', 'commercial', 'general', 'reschedule', 'billing'] as InquiryCategory[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {CONTACT_TOPIC_LABELS[key]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Full name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.customerNameMax}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="contact-phone"
                  className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
                >
                  Phone number
                </label>
                <input
                  id="contact-phone"
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
                htmlFor="contact-email"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Email address
              </label>
              <input
                id="contact-email"
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
                htmlFor="contact-message"
                className="block text-xs font-bold text-[#241436] dark:text-slate-200 mb-1.5"
              >
                Message &amp; property details
              </label>
              <textarea
                id="contact-message"
                required
                maxLength={BLUEPRINT_LIMITS.inquiryMessageMax}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Include approximate square footage, preferred dates, neighborhood, or commercial cleaning schedule…"
                className={`${inputClass} min-h-[140px] resize-y`}
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

            {submittedRecord && (
              <div
                aria-live="polite"
                className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold tabular-nums">
                    Inquiry {submittedRecord.ticketCode} Received
                  </div>
                  <div className="mt-0.5">
                    Thank you, {submittedRecord.name}. We will reply to {submittedRecord.email} shortly.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white font-extrabold text-sm hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending Message…' : 'Send Message'}
            </button>

            <span className="text-xs text-[#6c6277] dark:text-slate-400">
              Protected under our{' '}
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
            </span>
          </div>

          {contactMessages.length > 0 && (
            <div className="pt-5 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-2.5">
              <div className="text-xs font-bold text-[#241436] dark:text-slate-200">
                Recent Contact Inquiries ({contactMessages.length})
              </div>
              <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342]">
                {contactMessages.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#241436] dark:text-white tabular-nums">
                        {item.ticketCode} · {CONTACT_TOPIC_LABELS[item.category]} ({item.status})
                      </div>
                      <div className="text-xs text-[#6c6277] dark:text-slate-400 truncate max-w-md">
                        {item.message}
                      </div>
                    </div>
                    {item.status === 'open' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveCustomerInquiry(item);
                          onInquiriesRefresh();
                          onStatus(`Marked inquiry ${item.ticketCode} as resolved.`);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap shrink-0 cursor-pointer"
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
