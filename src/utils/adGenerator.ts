import { CampaignSettings, GeneratedAd, ServiceKey, ToneKey } from '../types';

interface ServiceTemplate {
  name: string;
  topics: string[];
  benefits: string[];
  head: string[];
  scenePrompt: string;
}

export const SERVICE_DATA: Record<ServiceKey, ServiceTemplate> = {
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
    scenePrompt: 'Modern empty Canadian home, cleaner detailing kitchen cabinets',
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
    scenePrompt: 'Modern bathroom with professional cleaner detailing glass shower',
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
    scenePrompt: 'Bright Canadian living room with professional cleaner vacuuming',
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
    scenePrompt: 'Pristine unfurnished kitchen with cleaner wiping counters',
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
    scenePrompt: 'Warm lived-in family home, professional cleaner mopping floors',
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
    scenePrompt: 'Modern office reception with professional cleaner wiping desks',
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
    scenePrompt: 'Beautiful guest bedroom in short-term rental being prepared by cleaner',
  },
};

export const TONE_LABELS: Record<ToneKey, string> = {
  trust: 'Professional & trustworthy',
  urgent: 'Book now / limited time',
  relief: 'Convenience & peace of mind',
  premium: 'Premium results',
  local: 'Edmonton local',
};

function angleCopy(tone: ToneKey): string {
  return {
    trust: 'Professional cleaning that pays attention to the details.',
    urgent: 'Planning a clean soon? Request your quote today.',
    relief: 'Enjoy more time for what matters and leave the mess to us.',
    premium: 'Thoughtful details and a polished finish for your space.',
    local: 'Proudly serving Edmonton and surrounding communities.',
  }[tone];
}

function buildCaption(s: CampaignSettings, index: number): string {
  const d = SERVICE_DATA[s.service];
  const topic = d.topics[index % d.topics.length];
  const benefit = d.benefits[(index * 3 + Math.floor(index / 5)) % d.benefits.length];
  const suffix = s.offer.trim() ? `\n\n${s.offer.trim()}.` : '';
  const targetArea = s.area.trim() || 'the Edmonton area';

  return (
    `${topic}\n\n` +
    `Tidyups Cleaning Service offers professional ${d.name.toLowerCase()} in ${targetArea}, including ${benefit}. ` +
    `${angleCopy(s.tone)}${suffix}\n\n` +
    `Request a quote or book online: ${s.booking.trim()}\n` +
    `Call or text: ${s.phone.trim()}`
  );
}

function buildVoiceover(s: CampaignSettings, index: number): string {
  const topic = SERVICE_DATA[s.service].topics[index % 5];
  return `${topic} Tidyups Cleaning Service helps Edmonton homes and businesses shine. Leave the mess to us. Book your cleaning today!`.replace(
    /\s+/g,
    ' '
  );
}

export function makeAd(s: CampaignSettings, index: number): GeneratedAd {
  const d = SERVICE_DATA[s.service];
  const headline = d.head[index % d.head.length];
  const primary_text = buildCaption(s, index);
  const offerPrefix = s.offer.trim() ? `${s.offer.trim()} • ` : '';
  const description = `${offerPrefix}Edmonton & surrounding areas. Request a cleaning quote.`;
  const extraNotes = s.notes.trim() ? ` ${s.notes.trim()}` : '';

  const image_prompt =
    `Photorealistic premium Facebook/Instagram advertisement for Tidyups Cleaning Service Inc., Edmonton, Alberta. ` +
    `${d.scenePrompt}. Brand style: purple, pink and white; cleaner wearing clean purple polo, natural daylight, ` +
    `premium commercial photography; authentic home, realistic equipment, clean composition. Frame ${s.format}. ` +
    `Do not invent or distort logos, lettering, discounts or company claims. Leave negative space for manually added exact logo and CTA.${extraNotes}`;

  const video_script =
    `0–3s: Show the cleaning need in a realistic Edmonton home or workplace.\n` +
    `3–7s: Smooth close-up shots of professionals performing ${d.name.toLowerCase()}.\n` +
    `7–10s: Reveal a bright, beautifully clean finished space.\n` +
    `Voiceover: '${buildVoiceover(s, index)}'\n` +
    `End card: 'Tidyups Cleaning Service | Edmonton | ${s.phone.trim()} | Book Online'\n` +
    `Format: ${s.format}; add official company bunny logo in editing. Use licensed music only.`;

  return {
    id: `ad_${index + 1}`,
    number: index + 1,
    service: d.name,
    format: s.format,
    headline,
    primary_text,
    description,
    cta: 'Book Now',
    destination_url: s.booking.trim(),
    image_prompt,
    video_script,
  };
}

export function generateAds(settings: CampaignSettings): GeneratedAd[] {
  const count = Math.max(1, Math.min(10, Number(settings.count) || 5));
  return Array.from({ length: count }, (_, idx) => makeAd(settings, idx));
}

function csvQuote(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function serializeAdsToCsv(ads: GeneratedAd[]): string {
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
  const header = keys.join(',');
  const rows = ads.map((ad) => keys.map((k) => csvQuote(ad[k])).join(','));
  return [header, ...rows].join('\r\n');
}

export function serializeAdsToJson(settings: CampaignSettings, ads: GeneratedAd[]): string {
  return JSON.stringify(
    {
      brand: 'Tidyups Cleaning Service Inc.',
      campaign_title: settings.title,
      generated_at: new Date().toISOString(),
      settings,
      ads,
    },
    null,
    2
  );
}
