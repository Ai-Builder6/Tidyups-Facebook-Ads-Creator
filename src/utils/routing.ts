import { AppPage } from '../types';

export const PAGE_PATHS: Record<AppPage, string> = {
  campaigns: '/',
  images: '/images',
  videos: '/videos',
  brand: '/brand',
  booking: '/booking',
  support: '/support',
  terms: '/t&c',
  contact: '/contact',
  privacy: '/privacy',
};

export const PAGE_TITLES: Record<AppPage, string> = {
  campaigns: 'Tidyups | Facebook Ads Creator',
  images: 'AI Image Ad Creator | Tidyups',
  videos: 'AI Video Ad Creator | Tidyups',
  brand: 'Logo & Icon Studio | Tidyups',
  booking: 'Book Online | Tidyups Cleaning Service Inc.',
  support: 'Support Center | Tidyups Cleaning Service Inc.',
  terms: 'Terms & Conditions | Tidyups Cleaning Service Inc.',
  contact: 'Contact Us | Tidyups Cleaning Service Inc.',
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
  if (clean === '/brand') return 'brand';
  return 'campaigns';
}

export function getFullPageUrl(page: AppPage): string {
  if (typeof window === 'undefined') {
    return `https://app.tidyupscleaning.com${PAGE_PATHS[page]}`;
  }
  return `${window.location.origin}${PAGE_PATHS[page]}`;
}
