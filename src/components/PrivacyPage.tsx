import React, { useState } from 'react';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { AppPage } from '../types';
import { triggerBrowserDownload } from '../utils/adGenerator';
import { getFullPageUrl, PAGE_PATHS } from '../utils/routing';

interface PrivacyPageProps {
  onNavigate: (page: AppPage) => void;
  onStatus: (msg: string) => void;
}

interface PrivacySection {
  id: string;
  heading: string;
  paragraphs: string[];
}

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'collection',
    heading: '01. Personal Information We Collect',
    paragraphs: [
      'Tidyups Cleaning Service Inc. ("Tidyups") respects your privacy and complies with Alberta’s Personal Information Protection Act (PIPA) and Canada’s Personal Information Protection and Electronic Documents Act (PIPEDA).',
      'When you request an estimate on /booking, submit an inquiry on /contact or /support, or call/text 587-742-2500, we collect only the information needed to deliver your quote and perform cleaning services: your name, email address, phone number, Edmonton-area service address, property size, preferred appointment dates, and entry or pet instructions.',
    ],
  },
  {
    id: 'meta-lead-ads',
    heading: '02. Meta (Facebook & Instagram) Lead Ads Disclosure',
    paragraphs: [
      'If you submit your contact details through a Tidyups Cleaning Service Inc. Instant Form or Lead Ad on Facebook or Instagram, we use that information solely to prepare your requested cleaning quote, confirm availability in your neighborhood, and follow up regarding your inquiry.',
      'We never sell, rent, or broker Meta Lead Ads contact lists to third-party marketers or lead aggregators. You may opt out of promotional follow-ups at any time by replying STOP to text messages or emailing booking@tidyupscleaning.com.',
    ],
  },
  {
    id: 'workspace-firebase',
    heading: '03. Google Workspace & Firebase Cloud Data',
    paragraphs: [
      'When authorized users sign in with Google to use the Tidyups Ads Creator, Google OAuth access tokens are held strictly in volatile browser memory for the active session and are never persisted in localStorage or shared with unauthorized parties.',
      'Google Sheets spreadsheets and Google Drive "Leads Ads" folders are created or accessed strictly inside the signed-in user’s own Google Drive account upon explicit action. Saved campaigns, creative portfolio thumbnails, booking requests, and support tickets stored in Firebase Firestore enforce strict per-owner access controls so customer PII is isolated to the authenticated account.',
    ],
  },
  {
    id: 'use-of-data',
    heading: '04. How We Use Your Information',
    paragraphs: [
      'We use collected personal information to: (a) calculate accurate cleaning estimates and schedule crews; (b) send booking confirmations, arrival updates, and itemized 5% Alberta GST receipts; (c) honor our 24-Hour Walkthrough Satisfaction Guarantee; and (d) improve service quality across Edmonton and surrounding communities.',
    ],
  },
  {
    id: 'retention-security',
    heading: '05. Data Retention & Security Safeguards',
    paragraphs: [
      'Customer booking and invoicing records are protected using HTTPS/TLS encryption in transit, authenticated cloud security rules, and role-restricted dispatch access. Records are retained only as long as necessary to fulfill scheduled cleaning services, resolve warranty inquiries, and comply with Canadian tax and accounting statutes.',
    ],
  },
  {
    id: 'your-rights',
    heading: '06. Your Alberta PIPA & PIPEDA Privacy Rights',
    paragraphs: [
      'Under Alberta PIPA and federal PIPEDA, you have the right to request access to the personal information Tidyups holds about you, request corrections to inaccurate details, or withdraw consent for marketing communications, subject to legal or contractual obligations.',
    ],
  },
  {
    id: 'data-deletion',
    heading: '07. User Data Deletion Instructions (Meta / Facebook Compliance)',
    paragraphs: [
      'If you interacted with BookMyCleaning-Tidyups (https://facebook.com/tidyupsbooking), submitted a Meta Lead Ad Instant Form, requested a cleaning quote, or signed into our web app, you may request permanent deletion of your personal data at any time by emailing booking@tidyupscleaning.com with the subject "Data Deletion Request", calling or texting 587-742-2500, or submitting a request on /support.',
      'Include your full name and the email address or phone number used in your submission. Our Privacy Coordinator will verify and permanently delete all eligible personal data within 7 business days (subject only to mandatory Canadian tax retention laws) and send written email confirmation. You may also revoke Facebook App access directly in Facebook Settings > Apps and Websites.',
    ],
  },
  {
    id: 'privacy-officer',
    heading: '08. Privacy Officer & Contact Information',
    paragraphs: [
      'To exercise your privacy rights, request data deletion, or ask questions about how Tidyups handles personal information, contact our Privacy Coordinator at Tidyups Cleaning Service Inc., Edmonton, Alberta — Email: booking@tidyupscleaning.com · Phone: 587-742-2500.',
    ],
  },
];

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate, onStatus }) => {
  const [copiedUrl, setCopiedUrl] = useState<'privacy' | 'deletion' | null>(null);

  const copyMetaUrl = async (kind: 'privacy' | 'deletion') => {
    const basePrivacy = getFullPageUrl('privacy');
    const url = kind === 'deletion' ? `${basePrivacy}#data-deletion` : basePrivacy;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(kind);
      onStatus(
        kind === 'deletion'
          ? `Copied Meta Data Deletion URL (${url}) to clipboard.`
          : `Copied Meta Lead Form Privacy URL (${url}) to clipboard.`
      );
      setTimeout(() => setCopiedUrl((prev) => (prev === kind ? null : prev)), 1800);
    } catch {
      onStatus(`URL: ${url}`);
    }
  };

  const downloadPrivacyTxt = () => {
    const text = [
      'TIDYUPS CLEANING SERVICE INC. — PRIVACY POLICY (PIPA & PIPEDA)',
      'Effective Date: November 2026 · Edmonton, Alberta, Canada',
      '==============================================================',
      '',
      ...PRIVACY_SECTIONS.flatMap((sec) => [sec.heading, '', ...sec.paragraphs, '']),
    ].join('\r\n');

    triggerBrowserDownload('tidyups-privacy-policy.txt', text, 'text/plain;charset=utf-8');
    onStatus('Downloaded Privacy Policy (.txt).');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] gap-6 items-start">
      {/* Left Sticky Navigation & Meta Lead Form URL Helper */}
      <aside className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-5 space-y-4 lg:sticky lg:top-6 print:hidden">
        <div className="text-xs font-bold text-[#241436] dark:text-white">
          Policy Sections
        </div>
        <nav className="space-y-1.5">
          {PRIVACY_SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="block text-xs text-[#6c6277] dark:text-slate-400 hover:text-[#56249a] dark:hover:text-white py-1 transition-colors"
            >
              {sec.heading}
            </a>
          ))}
        </nav>

        <div className="pt-4 border-t border-[#e8e1ef] dark:border-[#2d2342] space-y-2">
          <button
            type="button"
            onClick={() => {
              void copyMetaUrl('privacy');
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] text-white text-xs font-bold hover:opacity-95 whitespace-nowrap cursor-pointer"
          >
            {copiedUrl === 'privacy' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy /privacy URL for Meta
          </button>

          <button
            type="button"
            onClick={() => {
              void copyMetaUrl('deletion');
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap cursor-pointer"
          >
            {copiedUrl === 'deletion' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy Data Deletion URL
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadPrivacyTxt}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              .txt
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>
      </aside>

      {/* Main Privacy Policy Document */}
      <article className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 sm:p-10">
        <header className="pb-6 border-b border-[#e8e1ef] dark:border-[#2d2342]">
          <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0 tabular-nums">
            Tidyups Cleaning Service Inc. · Alberta PIPA &amp; PIPEDA Compliant · Updated November 2026
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#241436] dark:text-white mt-2 mb-3 text-balance">
            Privacy Policy
          </h2>
          <p className="text-sm text-[#6c6277] dark:text-slate-300 leading-relaxed max-w-[70ch] m-0">
            How Tidyups Cleaning Service Inc. collects, protects, and uses customer personal information across online bookings, Meta Lead Ads, and cloud campaign tools.
          </p>
        </header>

        <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342]">
          {PRIVACY_SECTIONS.map((sec) => (
            <section key={sec.id} id={sec.id} className="py-6 space-y-3 max-w-[72ch]">
              <h3 className="text-lg font-bold text-[#241436] dark:text-white m-0">
                {sec.heading}
              </h3>
              {sec.paragraphs.map((p, idx) => (
                <p
                  key={idx}
                  className="text-sm sm:text-[15px] text-[#3a2a4d] dark:text-slate-300 leading-relaxed m-0"
                >
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="pt-6 border-t border-[#e8e1ef] dark:border-[#2d2342] flex flex-wrap items-center gap-3 text-xs font-bold print:hidden">
          <a
            href={PAGE_PATHS.booking}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                e.preventDefault();
                onNavigate('booking');
              }
            }}
            className="text-[#56249a] dark:text-[#c084fc] underline"
          >
            Online Booking
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
            className="text-[#56249a] dark:text-[#c084fc] underline"
          >
            Terms &amp; Conditions
          </a>
          <span aria-hidden="true" className="text-[#6c6277]">·</span>
          <a
            href={PAGE_PATHS.support}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                e.preventDefault();
                onNavigate('support');
              }
            }}
            className="text-[#56249a] dark:text-[#c084fc] underline"
          >
            Support Center
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
            className="text-[#56249a] dark:text-[#c084fc] underline"
          >
            Contact Privacy Coordinator
          </a>
        </footer>
      </article>
    </div>
  );
};
