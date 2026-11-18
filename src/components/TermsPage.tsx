import React, { useState } from 'react';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { AppPage } from '../types';
import { triggerBrowserDownload } from '../utils/adGenerator';
import { getFullPageUrl, PAGE_PATHS } from '../utils/routing';

interface TermsPageProps {
  onNavigate: (page: AppPage) => void;
  onStatus: (msg: string) => void;
}

interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
}

const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    heading: '01. Scope of Cleaning Services',
    paragraphs: [
      'Tidyups Cleaning Service Inc. ("Tidyups", "we", "us", or "our") provides residential house cleaning, deep cleaning, move-in/move-out detailing, short-term rental (Airbnb) turnovers, and office/commercial janitorial services throughout Edmonton, Alberta and surrounding communities within 20 km.',
      'Services are performed in accordance with the package checklist and optional add-ons selected during booking. For crew safety and insurance compliance, our technicians do not perform exterior high-ladder window washing, biohazard remediation, mold abatement, pest removal, or lifting of appliances/furniture exceeding 15 kg (35 lbs).',
    ],
  },
  {
    id: 'pricing',
    heading: '02. Estimates, Property Condition & Alberta GST',
    paragraphs: [
      'Online quotes generated on /booking or via Meta Lead Ads are based on accurate bedroom count, bathroom count, square footage, and standard residential occupancy conditions. All amounts are quoted in Canadian Dollars (CAD) and are subject to 5% Federal Goods and Services Tax (GST) in the Province of Alberta.',
      'If a property requires substantially heavier restoration than disclosed (such as post-construction drywall dust, heavy grease buildup, or unemptied move-out rooms), our lead technician will notify you prior to commencing additional work to confirm an updated flat-rate adjustment or prioritize rooms within your original budget.',
    ],
  },
  {
    id: 'access',
    heading: '03. Property Access, Utilities & Crew Safety',
    paragraphs: [
      'Clients agree to provide safe, unobstructed entry at the scheduled arrival window (via in-person greeting, keypad code, lockbox, or concierge) along with active running hot water, electricity, and seasonal heating or cooling.',
      'Tidyups is proud to serve pet-friendly Edmonton homes. Please secure pets that may become anxious around vacuums or open doors during equipment load-in and load-out.',
    ],
  },
  {
    id: 'cancellations',
    heading: '04. Cancellations, Rescheduling & Lockouts',
    paragraphs: [
      'Appointments may be rescheduled or cancelled without penalty when Tidyups receives at least 24 hours notice prior to the start of your arrival window by calling 780-718-5092, emailing cleaningserviceyeg@gmail.com, or submitting a request on /support.',
      'Cancellations received with less than 24 hours notice, or crew lockouts where entry, water, or electricity are unavailable after a 20-minute wait and contact attempt, may be subject to a $65 CAD dispatch fee to compensate assigned cleaning technicians.',
    ],
  },
  {
    id: 'guarantee',
    heading: '05. 24-Hour Walkthrough Satisfaction Guarantee',
    paragraphs: [
      'We stand behind every clean. Please inspect your home or workplace promptly after completion. If any item included in your booked service scope was overlooked, contact Tidyups within 24 hours of completion and our crew will return to re-clean the missed area at no additional charge.',
      'Because Tidyups cannot control foot traffic or occupancy after our team departs, requests submitted more than 24 hours after service completion are evaluated at management discretion. Monetary refunds are not issued in lieu of our complimentary re-clean guarantee.',
    ],
  },
  {
    id: 'liability',
    heading: '06. Insurance, Fragile Items & Pre-Existing Wear',
    paragraphs: [
      'Tidyups Cleaning Service Inc. maintains commercial general liability protection for services performed by our crews. Please secure cash, jewelry, irreplaceable heirlooms, and unstable wall-mounted items prior to your appointment.',
      'Tidyups is not responsible for pre-existing scratches, worn grout or caulking, oxidized fixtures, unsealed natural stone discoloration, broken blinds, or loose cabinet hinges.',
    ],
  },
  {
    id: 'promotions',
    heading: '07. Promotional Offers & Campaign Creative Tools',
    paragraphs: [
      'Promotional discounts advertised on Facebook, Instagram, or web campaigns apply only when approved by Tidyups Cleaning Service Inc., cannot be combined with other promotional codes unless stated in writing, and exclude minimum trip charges.',
      'Authorized team members using the Tidyups Facebook & Instagram Ads Creator workspace are responsible for reviewing all generated ad copy, pricing claims, images, and video scripts prior to publishing on Meta platforms.',
    ],
  },
  {
    id: 'governing-law',
    heading: '08. Governing Law & Contact',
    paragraphs: [
      'These Terms & Conditions are governed by and construed in accordance with the laws of the Province of Alberta and the federal laws of Canada applicable therein, with exclusive venue in Edmonton, Alberta.',
      'Questions regarding these Terms may be directed to Tidyups Cleaning Service Inc. at 780-718-5092 or cleaningserviceyeg@gmail.com.',
    ],
  },
];

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate, onStatus }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const copyTermsUrl = async () => {
    const url = getFullPageUrl('terms');
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      onStatus(`Copied ${url} to clipboard.`);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      onStatus(`Terms URL: ${url}`);
    }
  };

  const downloadPlainText = () => {
    const text = [
      'TIDYUPS CLEANING SERVICE INC. — TERMS & CONDITIONS',
      'Effective Date: November 2026 · Edmonton, Alberta, Canada',
      '==========================================================',
      '',
      ...TERMS_SECTIONS.flatMap((sec) => [sec.heading, '', ...sec.paragraphs, '']),
    ].join('\r\n');

    triggerBrowserDownload('tidyups-terms-and-conditions.txt', text, 'text/plain;charset=utf-8');
    onStatus('Downloaded Terms & Conditions (.txt).');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] gap-6 items-start">
      {/* Left Sticky Contents & Document Actions */}
      <aside className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-5 space-y-4 lg:sticky lg:top-6 print:hidden">
        <div className="text-xs font-bold text-[#241436] dark:text-white">
          Contents
        </div>
        <nav className="space-y-1.5">
          {TERMS_SECTIONS.map((sec) => (
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
              void copyTermsUrl();
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-xs font-bold text-[#56249a] dark:text-[#d8b4fe] hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] whitespace-nowrap cursor-pointer"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Copy /t&amp;c Link
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadPlainText}
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

      {/* Main Legal Prose Document */}
      <article className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl p-6 sm:p-10">
        <header className="pb-6 border-b border-[#e8e1ef] dark:border-[#2d2342]">
          <p className="text-xs text-[#6c6277] dark:text-slate-400 m-0 tabular-nums">
            Tidyups Cleaning Service Inc. · Edmonton, Alberta · Updated November 2026
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#241436] dark:text-white mt-2 mb-3 text-balance">
            Terms &amp; Conditions of Service
          </h2>
          <p className="text-sm text-[#6c6277] dark:text-slate-300 leading-relaxed max-w-[70ch] m-0">
            Please review these service terms carefully before scheduling a residential or commercial clean or using the Tidyups digital campaign workspace.
          </p>
        </header>

        <div className="divide-y divide-[#e8e1ef] dark:divide-[#2d2342]">
          {TERMS_SECTIONS.map((sec) => (
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
            Book a Cleaning
          </a>
          <span aria-hidden="true" className="text-[#6c6277]">·</span>
          <a
            href={PAGE_PATHS.privacy}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                e.preventDefault();
                onNavigate('privacy');
              }
            }}
            className="text-[#56249a] dark:text-[#c084fc] underline"
          >
            Privacy Policy
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
            Contact Us
          </a>
        </footer>
      </article>
    </div>
  );
};
