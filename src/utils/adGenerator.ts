import { CampaignSettings, CreativeFormat, GeneratedAd, ServiceKey, ToneKey } from '../types';

export interface ServiceDefinition {
  name: string;
  topics: string[];
  benefits: string[];
  head: string[];
  scene: string;
}

export const SERVICE_DATA: Record<ServiceKey, ServiceDefinition> = {
  moveout: {
    name: 'Move-Out Cleaning',
    topics: [
      'Moving day is stressful enough.',
      'Handing over your keys soon?',
      'Make your final walkthrough easier.',
      'A clean slate for your next chapter.',
      'Empty home, big cleaning checklist.',
    ],
    benefits: [
      'detailed kitchens, bathrooms and floors',
      'cabinet detailing and high-touch areas',
      'thorough cleaning before handover',
      'attention to those easy-to-miss areas',
      'a fresh, welcoming space',
    ],
    head: [
      'Move-Out Cleaning Edmonton',
      'Leave the Move-Out Mess to Us',
      'Moving? Book a Clean',
      'Edmonton Move-Out Cleaners',
      'Get Your Move-Out Quote',
    ],
    scene: 'Modern empty Canadian home, cleaner detailing kitchen cabinets',
  },
  deep: {
    name: 'Deep Cleaning',
    topics: [
      'Your home deserves a reset.',
      'Some messes need more than a quick wipe.',
      'Bring back that freshly cleaned feeling.',
      'When details matter, go deeper.',
      'Give your home the attention it deserves.',
    ],
    benefits: [
      'baseboards, kitchens and bathrooms',
      'detailed cleaning in hard-to-reach areas',
      'extra attention to buildup and grime',
      'a thorough, top-to-bottom refresh',
      'careful cleaning of high-touch surfaces',
    ],
    head: [
      'Deep Cleaning Edmonton',
      'Time for a Deep Clean?',
      'Detail-Focused Cleaning',
      'Refresh Your Home',
      'Book an Edmonton Deep Clean',
    ],
    scene: 'Modern bathroom with professional cleaner detailing glass shower',
  },
  standard: {
    name: 'House Cleaning',
    topics: [
      'Come home to clean.',
      'Spend more time enjoying your space.',
      'Busy week? We can handle the cleaning.',
      'Make home feel like home again.',
      "The cleaning can wait—your life can't.",
    ],
    benefits: [
      'kitchens, bathrooms and floors',
      'dusting, vacuuming and mopping',
      'dependable everyday home care',
      'the essentials that keep your home fresh',
      'cleaner living spaces',
    ],
    head: [
      'Edmonton House Cleaning',
      'A Cleaner Home Starts Here',
      'Book Home Cleaning',
      'Leave the Mess to Us',
      'House Cleaners Edmonton',
    ],
    scene: 'Bright Canadian living room with professional cleaner vacuuming',
  },
  movein: {
    name: 'Move-In Cleaning',
    topics: [
      'Start fresh in your new home.',
      'New keys deserve a clean beginning.',
      'Before the furniture arrives, clean the space.',
      'Make move-in day feel better.',
      'Your new home, ready for you.',
    ],
    benefits: [
      'kitchen and bathroom detailing',
      'cabinet interiors and floors',
      'a fresh home before unpacking',
      'attention to high-touch areas',
      'a detailed pre-move clean',
    ],
    head: [
      'Move-In Cleaning Edmonton',
      'Move In to a Fresh Home',
      'New Home? Book a Clean',
      'Fresh Start Cleaning',
      'Book Move-In Cleaners',
    ],
    scene: 'Pristine unfurnished kitchen with cleaner wiping counters',
  },
  recurring: {
    name: 'Recurring House Cleaning',
    topics: [
      "A clean home shouldn't be a once-a-year treat.",
      'Make your weekends yours again.',
      'Consistency makes all the difference.',
      'Keep your home guest-ready.',
      'Routine cleaning, less stress.',
    ],
    benefits: [
      'weekly and bi-weekly scheduling',
      'routine kitchen and bathroom cleaning',
      'reliable upkeep between busy weeks',
      'dusting, vacuuming and floor care',
      'a regular cleaning plan',
    ],
    head: [
      'Weekly Cleaning Edmonton',
      'Bi-Weekly Home Cleaning',
      'Stay Ahead of the Mess',
      'Recurring Cleaners Edmonton',
      'Book a Cleaning Routine',
    ],
    scene: 'Warm lived-in family home, professional cleaner mopping floors',
  },
  commercial: {
    name: 'Office & Commercial Cleaning',
    topics: [
      'A clean workplace makes an impression.',
      'Your business deserves dependable cleaning.',
      'Keep your workspace ready for the next day.',
      'Professional spaces need professional care.',
      'Focus on business, not office dust.',
    ],
    benefits: [
      'offices, shared areas and washrooms',
      'customized workplace cleaning plans',
      'high-touch surfaces and common spaces',
      'regular commercial cleaning',
      'after-hours cleaning options',
    ],
    head: [
      'Office Cleaning Edmonton',
      'Commercial Cleaning Quotes',
      'Cleaner Workplace, Better Day',
      'Edmonton Office Cleaners',
      'Book Business Cleaning',
    ],
    scene: 'Modern office reception with professional cleaner wiping desks',
  },
  airbnb: {
    name: 'Airbnb & Turnover Cleaning',
    topics: [
      'Your next guests are on the way.',
      'Turnover day moves fast.',
      'Make every guest arrival feel fresh.',
      'Keep your rental presentation consistent.',
      "Between check-out and check-in? We've got cleaning covered.",
    ],
    benefits: [
      'bathroom and kitchen refreshes',
      'guest-ready turnovers',
      'floors and high-touch surfaces',
      'detail-focused rental cleaning',
      'short-term rental cleaning support',
    ],
    head: [
      'Airbnb Cleaning Edmonton',
      'Guest-Ready Turnover Cleaning',
      'Short-Term Rental Cleaners',
      'Edmonton Airbnb Turnovers',
      'Book Rental Cleaning',
    ],
    scene: 'Beautiful guest bedroom in short-term rental being prepared by cleaner',
  },
};

export const TONE_LABELS: Record<ToneKey, string> = {
  trust: 'Professional & trustworthy',
  urgent: 'Book now / limited time',
  relief: 'Convenience & peace of mind',
  premium: 'Premium results',
  local: 'Edmonton local',
};

export const FORMAT_LABELS: Record<CreativeFormat, string> = {
  '1:1': 'Square 1:1',
  '4:5': 'Feed 4:5',
  '9:16': 'Reel / Story 9:16',
  '16:9': 'Landscape 16:9',
};

export const DEFAULT_SETTINGS: CampaignSettings = {
  title: 'Move-Out Cleaning Campaign',
  service: 'moveout',
  tone: 'trust',
  count: 5,
  format: '1:1',
  offer: '',
  area: 'Edmonton, Alberta + 20 km',
  booking: 'https://app.tidyupscleaning.com/booking',
  phone: '780-718-5092',
  notes: '',
};

function angleCopy(tone: ToneKey): string {
  const map: Record<ToneKey, string> = {
    trust: 'Professional cleaning that pays attention to the details.',
    urgent: 'Planning a clean soon? Request your quote today.',
    relief: 'Enjoy more time for what matters and leave the mess to us.',
    premium: 'Thoughtful details and a polished finish for your space.',
    local: 'Proudly serving Edmonton and surrounding communities.',
  };
  return map[tone];
}

function voiceover(service: ServiceKey, index: number): string {
  return (
    SERVICE_DATA[service].topics[index % 5] +
    ' Tidyups Cleaning Service helps Edmonton homes and businesses shine. Leave the mess to us. Book your cleaning today!'
  ).replace(/\s+/g, ' ');
}

function buildCaption(s: CampaignSettings, index: number): string {
  const d = SERVICE_DATA[s.service];
  const topic = d.topics[index % d.topics.length];
  const benefit = d.benefits[(index * 3 + Math.floor(index / 5)) % d.benefits.length];
  const offerLine = s.offer.trim() ? `\n\n${s.offer.trim()}.` : '';
  return (
    `${topic}\n\n` +
    `Tidyups Cleaning Service offers professional ${d.name.toLowerCase()} in the ${s.area.trim() || 'Edmonton'} area, including ${benefit}. ${angleCopy(s.tone)}${offerLine}\n\n` +
    `Request a quote or book online: ${s.booking.trim()}\n` +
    `Call or text: ${s.phone.trim()}`
  );
}

export function makeAd(s: CampaignSettings, index: number): GeneratedAd {
  const d = SERVICE_DATA[s.service];
  const headline = d.head[index % d.head.length];
  const primary = buildCaption(s, index);
  const areaLabel = s.area.trim() || 'Edmonton & surrounding areas';
  const description = `${s.offer.trim() ? `${s.offer.trim()} • ` : ''}${areaLabel}. Request a cleaning quote.`;
  const notesSuffix = s.notes.trim() ? ` ${s.notes.trim()}` : '';
  const prompt =
    `Photorealistic premium Facebook/Instagram advertisement for Tidyups Cleaning Service Inc., Edmonton, Alberta. ${d.scene}. ` +
    `Brand style: purple, pink and white; cleaner wearing clean purple polo, natural daylight, premium commercial photography; authentic home, realistic equipment, clean composition. ` +
    `Frame ${s.format}. Do not invent or distort logos, lettering, discounts or company claims. Leave negative space for manually added exact logo and CTA.${notesSuffix}`;
  const script =
    `0–3s: Show the cleaning need in a realistic Edmonton home or workplace.\n` +
    `3–7s: Smooth close-up shots of professionals performing ${d.name.toLowerCase()}.\n` +
    `7–10s: Reveal a bright, beautifully clean finished space.\n` +
    `Voiceover: '${voiceover(s.service, index)}'\n` +
    `End card: 'Tidyups Cleaning Service | Edmonton | ${s.phone.trim()} | Book Online'\n` +
    `Format: ${s.format}; add official company bunny logo in editing. Use licensed music only.`;

  return {
    id: `ad_${index + 1}`,
    number: index + 1,
    service: d.name,
    format: s.format,
    headline,
    primary_text: primary,
    description,
    cta: 'Book Now',
    destination_url: s.booking.trim(),
    image_prompt: prompt,
    video_script: script,
  };
}

export function generateAds(settings: CampaignSettings): GeneratedAd[] {
  const safeCount = Math.min(Math.max(Number(settings.count) || 5, 1), 10);
  return Array.from({ length: safeCount }, (_, i) => makeAd(settings, i));
}

function csvQuote(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function adsToCsv(ads: GeneratedAd[]): string {
  const keys: (keyof GeneratedAd)[] = [
    'number',
    'service',
    'format',
    'headline',
    'primary_text',
    'description',
    'cta',
    'destination_url',
    'image_prompt',
    'video_script',
  ];
  return [
    keys.join(','),
    ...ads.map((ad) => keys.map((k) => csvQuote(ad[k])).join(',')),
  ].join('\r\n');
}

export function adsToJson(ads: GeneratedAd[], campaignTitle?: string): string {
  return JSON.stringify(
    {
      brand: 'Tidyups Cleaning Service Inc.',
      campaign: campaignTitle || 'Tidyups Campaign',
      generated_at: new Date().toISOString(),
      ads,
    },
    null,
    2
  );
}

export function formatAllAdsPlainText(ads: GeneratedAd[]): string {
  return ads
    .map((a) =>
      [
        `AD ${a.number}`,
        a.headline,
        a.primary_text,
        a.description,
        a.image_prompt,
        a.video_script,
      ].join('\n\n')
    )
    .join('\n\n---\n\n');
}

export function triggerBrowserDownload(fileName: string, body: string, mimeType: string): void {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
