import { AppPage } from '../types';

export const OFFICIAL_BRAND_NAME = 'BookMyCleaning-Tidyups';
export const OFFICIAL_BOOKING_URL = 'https://app.tidyupscleaning.com/booking';
export const OFFICIAL_FACEBOOK_URL = 'https://facebook.com/tidyupsbooking';
export const OFFICIAL_PHONE = '587-742-2500';
export const OFFICIAL_PHONE_HREF = 'tel:5877422500';
export const OFFICIAL_EMAIL = 'booking@tidyupscleaning.com';

export const PAGE_PATHS: Record<AppPage, string> = {
  campaigns: '/',
  images: '/images',
  videos: '/videos',
  booking: '/booking',
  support: '/support',
  terms: '/t&c',
  contact: '/contact',
  privacy: '/privacy',
};

export const PAGE_TITLES: Record<AppPage, string> = {
  campaigns: 'BookMyCleaning-Tidyups | Facebook Posts & Ads Creator',
  images: 'Campaign Image Creator | BookMyCleaning-Tidyups',
  videos: 'Campaign Video Creator | BookMyCleaning-Tidyups',
  booking: 'Book Online | BookMyCleaning-Tidyups',
  support: 'Support Center | BookMyCleaning-Tidyups',
  terms: 'Terms & Conditions | Tidyups Cleaning Service Inc.',
  contact: 'Contact Us | BookMyCleaning-Tidyups',
  privacy: 'Privacy Policy | Tidyups Cleaning Service Inc.',
};

export function resolvePageFromPath(rawPathname: string): AppPage {
  let decoded = rawPathname;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    decoded = rawPathname;
  }
  const clean = decoded.toLowerCase().replace(/\/+$/, '') || '/';

  if (clean === '/booking' || clean === '/book') return 'booking';
  if (clean === '/support' || clean === '/help') return 'support';
  if (
    clean === '/t&c' ||
    clean === '/terms' ||
    clean === '/t-and-c' ||
    clean === '/tc' ||
    clean === '/terms-and-conditions'
  ) {
    return 'terms';
  }
  if (clean === '/contact' || clean === '/contact-us') return 'contact';
  if (clean === '/privacy' || clean === '/privacy-policy') return 'privacy';
  if (clean === '/images') return 'images';
  if (clean === '/videos') return 'videos';
  if (clean === '/adstudio') return 'campaigns';
  return 'campaigns';
}

export function getFullPageUrl(page: AppPage): string {
  if (page === 'booking') {
    return OFFICIAL_BOOKING_URL;
  }
  if (typeof window === 'undefined') {
    return `https://app.tidyupscleaning.com${PAGE_PATHS[page]}`;
  }
  return `${window.location.origin}${PAGE_PATHS[page]}`;
}
