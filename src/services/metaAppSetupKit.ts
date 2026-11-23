import JSZip from 'jszip';
import { OFFICIAL_BOOKMYCLEANING_LOGO_PATH } from '../components/TidyupsLogo';
import {
  OFFICIAL_BOOKING_URL,
  OFFICIAL_BRAND_NAME,
  OFFICIAL_EMAIL,
  OFFICIAL_FACEBOOK_URL,
  OFFICIAL_PHONE,
} from '../utils/routing';

export interface MetaAppSetupOptions {
  primaryOrigin?: string;
  secondaryDomain?: string;
  appDisplayName?: string;
}

export interface MetaFieldRow {
  section: string;
  field: string;
  value: string;
  notes: string;
}

export interface MetaSetupBundleInfo {
  fileName: string;
  fileCount: number;
  filesIncluded: string[];
}

function normalizeOrigin(raw?: string): string {
  const fallback = 'https://app.tidyupscleaning.com';
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractHostname(urlOrHost: string): string {
  try {
    const withProto = /^https?:\/\//i.test(urlOrHost) ? urlOrHost : `https://${urlOrHost}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return urlOrHost
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();
  }
}

function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildMetaSetupFields(options: MetaAppSetupOptions = {}): {
  primaryOrigin: string;
  primaryHost: string;
  rootDomain: string;
  secondaryHost: string;
  appDomains: string[];
  appDisplayName: string;
  namespace: string;
  privacyUrl: string;
  termsUrl: string;
  dataDeletionUrl: string;
  bookingUrl: string;
  supportUrl: string;
  contactUrl: string;
  oauthRedirects: string[];
  rows: MetaFieldRow[];
} {
  const primaryOrigin = normalizeOrigin(options.primaryOrigin || 'https://app.tidyupscleaning.com');
  const primaryHost = extractHostname(primaryOrigin);
  const rootDomain = extractRootDomain(primaryHost);
  const secondaryHost = extractHostname(options.secondaryDomain || 'leadadscreator.com');

  const appDomains = Array.from(
    new Set([primaryHost, rootDomain, secondaryHost, `www.${secondaryHost}`].filter(Boolean))
  );

  const appDisplayName =
    (options.appDisplayName || '').trim() || 'BookMyCleaning-Tidyups Ad Studio';
  const namespace = 'bookmycleaning_tidyups';

  const privacyUrl = `${primaryOrigin}/privacy`;
  const termsUrl = `${primaryOrigin}/t&c`;
  const dataDeletionUrl = `${primaryOrigin}/privacy#data-deletion`;
  const bookingUrl =
    primaryOrigin === 'https://app.tidyupscleaning.com'
      ? OFFICIAL_BOOKING_URL
      : `${primaryOrigin}/booking`;
  const supportUrl = `${primaryOrigin}/support`;
  const contactUrl = `${primaryOrigin}/contact`;

  const oauthRedirects = Array.from(
    new Set([
      `${primaryOrigin}/`,
      `${primaryOrigin}/auth/facebook/callback`,
      `https://${secondaryHost}/`,
      `https://${secondaryHost}/auth/facebook/callback`,
    ])
  );

  const rows: MetaFieldRow[] = [
    {
      section: 'App Settings > Basic',
      field: 'Display Name',
      value: appDisplayName,
      notes: 'Shown to admins and business users in Meta Business Portfolio',
    },
    {
      section: 'App Settings > Basic',
      field: 'Namespace',
      value: namespace,
      notes: 'Lowercase letters, numbers, underscores only',
    },
    {
      section: 'App Settings > Basic',
      field: 'App Domains',
      value: appDomains.join(', '),
      notes: 'Add each domain individually in Meta Basic Settings',
    },
    {
      section: 'App Settings > Basic',
      field: 'Contact Email',
      value: OFFICIAL_EMAIL,
      notes: 'Monitored email for Meta developer notices & compliance alerts',
    },
    {
      section: 'App Settings > Basic',
      field: 'Privacy Policy URL',
      value: privacyUrl,
      notes: 'Must return HTTP 200 publicly (also used in Meta Lead Ads Instant Forms)',
    },
    {
      section: 'App Settings > Basic',
      field: 'Terms of Service URL',
      value: termsUrl,
      notes: 'Must return HTTP 200 publicly',
    },
    {
      section: 'App Settings > Basic',
      field: 'User Data Deletion Instructions URL',
      value: dataDeletionUrl,
      notes: 'Alternative clean route also supported: /data-deletion',
    },
    {
      section: 'App Settings > Basic',
      field: 'Category',
      value: 'Business and Pages',
      notes: 'Recommended category for Page posting, Lead Ads & Marketing API',
    },
    {
      section: 'App Settings > Basic',
      field: 'App Purpose',
      value: 'Yourself or your own business',
      notes: 'Select this if only Tidyups team manages your own Page & Ad Account',
    },
    {
      section: 'App Settings > Basic',
      field: 'App Icon (1024x1024)',
      value: 'assets/meta-app-icon-1024x1024.png',
      notes: 'Included in this ZIP (exact 1024x1024 PNG)',
    },
    {
      section: 'Add Platform > Website',
      field: 'Site URL',
      value: `${primaryOrigin}/`,
      notes: 'Primary Ad Studio / web application origin',
    },
    {
      section: 'Facebook Login > Settings',
      field: 'Valid OAuth Redirect URIs',
      value: oauthRedirects.join(', '),
      notes: 'Paste each URI on its own line in Facebook Login Settings',
    },
    {
      section: 'Facebook Page & Ad Links',
      field: 'Official Facebook Page',
      value: OFFICIAL_FACEBOOK_URL,
      notes: `${OFFICIAL_BRAND_NAME} Facebook Page`,
    },
    {
      section: 'Facebook Page & Ad Links',
      field: 'Official Booking Page URL',
      value: bookingUrl,
      notes: 'Destination URL for Facebook posts, ads & Lead Form completion CTA',
    },
    {
      section: 'Business Profile',
      field: 'Legal Business Name & Phone',
      value: `Tidyups Cleaning Service Inc. · Edmonton, AB · ${OFFICIAL_PHONE}`,
      notes: 'Must match Alberta incorporation docs for Business Verification',
    },
  ];

  return {
    primaryOrigin,
    primaryHost,
    rootDomain,
    secondaryHost,
    appDomains,
    appDisplayName,
    namespace,
    privacyUrl,
    termsUrl,
    dataDeletionUrl,
    bookingUrl,
    supportUrl,
    contactUrl,
    oauthRedirects,
    rows,
  };
}

async function fetchOfficialLogoBlob(): Promise<Blob | null> {
  try {
    const res = await fetch(OFFICIAL_BOOKMYCLEANING_LOGO_PATH);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

async function build1024SquareIconPng(sourceBlob: Blob): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(sourceBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        // Clean white studio background so Meta circular/rounded icon crops look sharp
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        const pad = 48;
        const maxSide = size - pad * 2;
        const scale = Math.min(maxSide / img.width, maxSide / img.height);
        const drawW = Math.round(img.width * scale);
        const drawH = Math.round(img.height * scale);
        const drawX = Math.round((size - drawW) / 2);
        const drawY = Math.round((size - drawH) / 2);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        canvas.toBlob(
          (pngBlob) => {
            URL.revokeObjectURL(objectUrl);
            resolve(pngBlob);
          },
          'image/png',
          1.0
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

export async function generateAndDownloadMetaAppSetupZip(
  options: MetaAppSetupOptions = {}
): Promise<MetaSetupBundleInfo> {
  const cfg = buildMetaSetupFields(options);
  const generatedDate = new Date().toISOString().slice(0, 10);
  const zip = new JSZip();

  const startHereGuide = `# Meta App Setup Guide — ${OFFICIAL_BRAND_NAME} (Tidyups Cleaning Service Inc.)
Generated: ${generatedDate}

This package contains every URL, field value, policy document, permission justification,
and the exact 1024x1024 PNG App Icon needed to set up your Meta App on
https://developers.facebook.com/ for:

- Brand / Facebook Page: ${OFFICIAL_BRAND_NAME} (${OFFICIAL_FACEBOOK_URL})
- Official Booking Page: ${cfg.bookingUrl}
- Ad Studio Web App:     ${cfg.primaryOrigin} (and https://${cfg.secondaryHost})
- Business Contact:      ${OFFICIAL_PHONE} · ${OFFICIAL_EMAIL}

================================================================================
STEP-BY-STEP SETUP ORDER ON DEVELOPERS.FACEBOOK.COM
================================================================================

STEP 1 — Create Your Meta App
1. Go to https://developers.facebook.com/apps/create/
2. Choose "Other" or select the use cases you need:
   - "Manage everything on your Page" (for posting to facebook.com/tidyupsbooking)
   - "Create & manage ads with Marketing API" (for Facebook/Instagram Ad campaigns)
   - "Measure ad performance data" / "Leads Ads" (for retrieving Instant Form leads)
3. Select App Type: **Business**.
4. Enter:
   - App Name:      ${cfg.appDisplayName}
   - Contact Email: ${OFFICIAL_EMAIL}
   - Business Portfolio: Select **Tidyups Cleaning Service Inc.** (create one in Meta Business Suite if needed).

STEP 2 — Fill Out "App Settings > Basic"
Open **01-meta-app-basic-settings.txt** (or **09-meta-urls-quick-reference.csv**) and copy/paste:
- Display Name:        ${cfg.appDisplayName}
- Namespace:           ${cfg.namespace}
- App Domains:         ${cfg.appDomains.join(', ')}
- Contact Email:       ${OFFICIAL_EMAIL}
- Privacy Policy URL:  ${cfg.privacyUrl}
- Terms of Service:    ${cfg.termsUrl}
- User Data Deletion:  ${cfg.dataDeletionUrl}
  (Alternative short URL that also loads the same page: ${cfg.primaryOrigin}/data-deletion)
- Category:            Business and Pages
- App Icon:            Upload **assets/meta-app-icon-1024x1024.png** from this ZIP.
- Scroll to bottom -> Click **Add Platform** -> **Website** -> Site URL: ${cfg.primaryOrigin}/
- Click **Save Changes**.

STEP 3 — Configure Facebook Login for Business (If using OAuth sign-in)
Open **03-facebook-login-oauth-settings.txt** and paste the Valid OAuth Redirect URIs.
Make sure **Client OAuth Login**, **Web OAuth Login**, and **Enforce HTTPS** are ON.

STEP 4 — Connect Your Business Portfolio, Page & Ad Account
Open **05-business-verification-and-domain-checklist.md** and link:
- Facebook Page: ${OFFICIAL_FACEBOOK_URL}
- Ad Account for Tidyups Cleaning Service Inc.
- Verified Domains: ${cfg.rootDomain}, ${cfg.primaryHost}, ${cfg.secondaryHost}

STEP 5 — Internal Use vs. Public App Review (IMPORTANT TIME SAVER!)
- If ONLY you / Tidyups team members use this app to post and run ads on your own
  Page (${OFFICIAL_FACEBOOK_URL}) and your own Ad Account:
  You can keep permissions at Standard Access and generate a **System User Token** in
  Meta Business Settings -> Users -> System Users. You do NOT need to wait for public
  Meta App Review!
- If external businesses will ever log into your app, open
  **04-permissions-and-app-review-guide.md** for the exact permission justifications.

STEP 6 — Switch App Mode to "Live"
Once Privacy Policy URL, Terms of Service URL, Data Deletion URL, Contact Email,
and App Icon are saved and reachable over HTTPS (HTTP 200), toggle the top-bar switch
from **Development** to **Live**.
`;

  const basicSettingsTxt = `META FOR DEVELOPERS — APP SETTINGS > BASIC (COPY & PASTE)
=========================================================
Generated: ${generatedDate}
Business:  Tidyups Cleaning Service Inc. (Edmonton, Alberta, Canada)
Brand:     ${OFFICIAL_BRAND_NAME}

Display Name:
${cfg.appDisplayName}

Namespace:
${cfg.namespace}

App Domains (enter each domain):
${cfg.appDomains.join('\n')}

Contact Email:
${OFFICIAL_EMAIL}

Privacy Policy URL:
${cfg.privacyUrl}

Terms of Service URL:
${cfg.termsUrl}

User Data Deletion Instructions URL:
${cfg.dataDeletionUrl}
(Alternate clean URL also supported: ${cfg.primaryOrigin}/data-deletion)

App Icon File (included in ZIP):
assets/meta-app-icon-1024x1024.png  (1024 x 1024 px PNG)

Category:
Business and Pages

App Purpose:
Yourself or your own business

Website Platform > Site URL:
${cfg.primaryOrigin}/

Additional Live App Pages:
- Booking Page:  ${cfg.bookingUrl}
- Support Page:  ${cfg.supportUrl}
- Contact Page:  ${cfg.contactUrl}
- Facebook Page: ${OFFICIAL_FACEBOOK_URL}
- Phone / SMS:   ${OFFICIAL_PHONE}
`;

  const configJson = JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      business: {
        legal_name: 'Tidyups Cleaning Service Inc.',
        brand_name: OFFICIAL_BRAND_NAME,
        location: 'Edmonton, Alberta, Canada',
        service_radius: 'Edmonton, Alberta + 20 km',
        phone: OFFICIAL_PHONE,
        email: OFFICIAL_EMAIL,
        facebook_page_url: OFFICIAL_FACEBOOK_URL,
        booking_url: cfg.bookingUrl,
      },
      meta_app_basic_settings: {
        display_name: cfg.appDisplayName,
        namespace: cfg.namespace,
        app_domains: cfg.appDomains,
        contact_email: OFFICIAL_EMAIL,
        privacy_policy_url: cfg.privacyUrl,
        terms_of_service_url: cfg.termsUrl,
        user_data_deletion_url: cfg.dataDeletionUrl,
        user_data_deletion_alt_url: `${cfg.primaryOrigin}/data-deletion`,
        category: 'Business and Pages',
        app_purpose: 'Yourself or your own business',
        website_site_url: `${cfg.primaryOrigin}/`,
        app_icon_asset: 'assets/meta-app-icon-1024x1024.png',
      },
      facebook_login_oauth: {
        valid_oauth_redirect_uris: cfg.oauthRedirects,
        allowed_js_sdk_domains: [cfg.primaryOrigin, `https://${cfg.secondaryHost}`],
        enforce_https: true,
        embedded_browser_oauth_login: true,
      },
      recommended_permissions: [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'pages_manage_ads',
        'leads_retrieval',
        'ads_management',
        'ads_read',
        'business_management',
      ],
      webhook_subscriptions: {
        object: 'page',
        fields: ['leadgen', 'feed'],
      },
      meta_lead_ads_instant_form: {
        privacy_policy_url: cfg.privacyUrl,
        privacy_policy_link_text: 'Tidyups Cleaning Service Inc. Privacy Policy',
        completion_cta_url: cfg.bookingUrl,
        completion_phone: OFFICIAL_PHONE,
      },
    },
    null,
    2
  );

  const oauthSettingsTxt = `META FACEBOOK LOGIN & OAUTH SETTINGS
====================================
Where to configure:
Meta App Dashboard -> Use Cases / Products -> Facebook Login for Business -> Settings

1. Client OAuth Settings
------------------------
- Client OAuth Login:                   Yes
- Web OAuth Login:                      Yes
- Enforce HTTPS:                        Yes
- Force Web OAuth Reauthentication:     No
- Embedded Browser OAuth Login:         Yes
- Use Strict Mode for Redirect URIs:    Yes

2. Valid OAuth Redirect URIs (add each line)
--------------------------------------------
${cfg.oauthRedirects.join('\n')}

3. Allowed Domains for the JavaScript SDK
-----------------------------------------
${cfg.primaryOrigin}
https://${cfg.secondaryHost}

4. Deauthorize & Data Deletion
------------------------------
- User Data Deletion Instructions URL:
  ${cfg.dataDeletionUrl}
- Alternate Data Deletion URL:
  ${cfg.primaryOrigin}/data-deletion

5. Security & Credentials Reminder
----------------------------------
- NEVER put your Meta App Secret or long-lived System User Access Token in browser/frontend code.
- Store META_APP_ID, META_APP_SECRET, and META_SYSTEM_USER_TOKEN only as server-side environment variables.
- For posting to ${OFFICIAL_FACEBOOK_URL} and managing your own ads internally, create a
  System User inside Meta Business Settings (https://business.facebook.com/settings/system-users),
  assign your Page + Ad Account with Full Control, and generate a never-expiring System User token.
`;

  const permissionsGuideMd = `# Meta Permissions & App Review Guide — ${OFFICIAL_BRAND_NAME}

## Do You Need Meta App Review?
- **Internal Use Only (Recommended for Tidyups):**
  If only Tidyups admins/staff use this app to publish posts and ads to **your own Facebook Page**
  (${OFFICIAL_FACEBOOK_URL}) and **your own Ad Account** inside your Business Portfolio,
  **Standard Access + a Business Manager System User Token is sufficient** — you do NOT need
  Advanced Access App Review.
- **Public / Multi-Client Use:**
  Only submit for App Review (Advanced Access) if outside businesses will log in to manage
  *their* own Pages or Ad Accounts through your app.

---

## Recommended Permissions & Copy-Paste App Review Justifications

### 1. \`pages_show_list\`
- **Purpose:** Displays the list of Facebook Pages managed by the authenticated business admin so they can select **BookMyCleaning-Tidyups** (${OFFICIAL_FACEBOOK_URL}) as the publishing target.

### 2. \`pages_read_engagement\`
- **Purpose:** Reads post engagement metrics (reach, reactions, comments) for **BookMyCleaning-Tidyups** posts created in Ad Studio so the team can evaluate which Edmonton cleaning promotions perform best.

### 3. \`pages_manage_posts\`
- **Purpose:** Publishes approved cleaning service posts, seasonal offers, campaign images, and promotional videos created in BookMyCleaning-Tidyups Ad Studio directly to the official Facebook Page (${OFFICIAL_FACEBOOK_URL}).

### 4. \`pages_manage_ads\`
- **Purpose:** Associates generated ad creatives and Instant Forms with the **BookMyCleaning-Tidyups** Facebook Page when launching Facebook and Instagram lead campaigns.

### 5. \`ads_management\` & \`ads_read\`
- **Purpose:** Creates, updates, pauses, and monitors ad sets, ad copy variations, image/video creatives, and conversion performance linked to ${cfg.bookingUrl}.

### 6. \`leads_retrieval\`
- **Purpose:** Retrieves customer cleaning quote leads submitted through BookMyCleaning-Tidyups Meta Instant Forms so our Edmonton dispatch team (${OFFICIAL_PHONE} / ${OFFICIAL_EMAIL}) can respond promptly and sync leads to our Google Sheets Lead Tracker.

### 7. \`business_management\`
- **Purpose:** Verifies ownership and links the Tidyups Cleaning Service Inc. Business Portfolio, Facebook Page, Ad Account, and Lead Access permissions.

---

## Screencast Checklist (If Submitting for App Review)
1. Show logging into ${cfg.primaryOrigin} and selecting the **BookMyCleaning-Tidyups** Page.
2. Show creating a Facebook post / image ad / video ad inside Ad Studio.
3. Show the booking destination (${cfg.bookingUrl}) and Privacy Policy (${cfg.privacyUrl}).
4. Show the resulting post/ad preview on ${OFFICIAL_FACEBOOK_URL}.
5. Keep each permission screencast under 2 minutes with clear English narration or captions.
`;

  const businessVerificationMd = `# Meta Business Portfolio, Verification & Domain Checklist
Business: Tidyups Cleaning Service Inc. (${OFFICIAL_BRAND_NAME})
Location: Edmonton, Alberta, Canada
Contact:  ${OFFICIAL_PHONE} · ${OFFICIAL_EMAIL}

## 1. Meta Business Portfolio Setup (https://business.facebook.com/settings)
- [ ] Confirm Business Portfolio name matches legal entity: **Tidyups Cleaning Service Inc.**
- [ ] Add Official Facebook Page: **${OFFICIAL_FACEBOOK_URL}** (BookMyCleaning-Tidyups)
- [ ] Add / verify Ad Account (Currency: **CAD**, Timezone: **America/Edmonton (MST/MDT)**)
- [ ] Add Instagram Business Account (if linked to the Page)
- [ ] Under **Accounts > Apps**, add your newly created Meta App ID and assign yourself Full Control

## 2. Domain Verification (Brand Safety and Suitability > Domains)
Verify each domain you use for ads and booking links:
- [ ] \`${cfg.rootDomain}\` (covers \`${cfg.primaryHost}\`)
- [ ] \`${cfg.secondaryHost}\`

Verification methods supported by Meta:
1. **DNS TXT Record (Recommended):** Add the \`facebook-domain-verification=...\` TXT record in your DNS provider (Cloudflare / GoDaddy / Namecheap).
2. **HTML Meta Tag:** Add \`<meta name="facebook-domain-verification" content="YOUR_CODE" />\` inside \`<head>\` of \`index.html\`.

## 3. Meta Lead Ads CRM & Privacy Setup
- [ ] In Business Settings -> **Integrations > Leads Access**, grant your App and Page Admins permission to retrieve leads.
- [ ] In Meta Ads Manager -> **Instant Forms**, set:
  - Privacy Policy URL: \`${cfg.privacyUrl}\`
  - Link Text: \`Tidyups Cleaning Service Inc. Privacy Policy\`
  - Completion Button ("Book Online"): \`${cfg.bookingUrl}\`
  - Call Business Number: \`${OFFICIAL_PHONE}\`

## 4. Business Verification Documents (Alberta Corporation)
Prepare 1-2 official documents showing exact legal name (**Tidyups Cleaning Service Inc.**), Edmonton address, and phone (**${OFFICIAL_PHONE}**):
- [ ] Alberta Certificate of Incorporation / Corporate Registry Proof of Filing
- [ ] CRA GST/HST Registration Notice or Recent Business Utility / Bank Statement
- [ ] Confirm domain email \`${OFFICIAL_EMAIL}\` can receive the Meta 6-digit verification code

## 5. System User Token (For Automated Posting / Ads Integration)
- [ ] Business Settings -> **Users > System Users** -> Click **Add**
- [ ] Name: \`Tidyups Ad Studio Bot\` · Role: **Admin**
- [ ] Click **Assign Assets**: assign your **App**, **BookMyCleaning-Tidyups Page**, and **Ad Account**
- [ ] Click **Generate New Token**, select your App, check required permissions, and store securely on your server
`;

  const privacyPolicyTxt = `TIDYUPS CLEANING SERVICE INC. — PRIVACY POLICY (PIPA & PIPEDA)
Effective Date: November 2026 · Edmonton, Alberta, Canada
Live URL: ${cfg.privacyUrl}
================================================================

01. Personal Information We Collect
Tidyups Cleaning Service Inc. ("Tidyups", operating as "${OFFICIAL_BRAND_NAME}") respects your privacy and complies with Alberta's Personal Information Protection Act (PIPA) and Canada's Personal Information Protection and Electronic Documents Act (PIPEDA).

When you request an estimate on ${cfg.bookingUrl}, submit an inquiry on ${cfg.contactUrl} or ${cfg.supportUrl}, or call/text ${OFFICIAL_PHONE}, we collect only the information needed to deliver your quote and perform cleaning services: your name, email address, phone number, Edmonton-area service address, property size, preferred appointment dates, and entry or pet instructions.

02. Meta (Facebook & Instagram) Lead Ads & App Disclosure
If you submit your contact details through a ${OFFICIAL_BRAND_NAME} / Tidyups Cleaning Service Inc. Instant Form, Facebook Page (${OFFICIAL_FACEBOOK_URL}), or Lead Ad on Facebook or Instagram, we use that information solely to prepare your requested cleaning quote, confirm availability in your neighborhood, and follow up regarding your inquiry.

We never sell, rent, or broker Meta Lead Ads contact lists to third-party marketers or lead aggregators. You may opt out of promotional follow-ups at any time by replying STOP to text messages or emailing ${OFFICIAL_EMAIL}.

03. Google Workspace & Firebase Cloud Data
When authorized users sign in to the Ad Studio, OAuth access tokens are used strictly for the requested publishing or export actions. Saved campaigns, booking requests, and support tickets enforce strict per-owner access controls.

04. How We Use Your Information
We use collected personal information to: (a) calculate accurate cleaning estimates and schedule crews; (b) send booking confirmations, arrival updates, and itemized 5% Alberta GST receipts; (c) honor our 24-Hour Walkthrough Satisfaction Guarantee; and (d) improve service quality across Edmonton and surrounding communities.

05. Data Retention & Security Safeguards
Customer booking and invoicing records are protected using HTTPS/TLS encryption in transit, authenticated cloud security rules, and role-restricted dispatch access. Records are retained only as long as necessary to fulfill scheduled cleaning services, resolve warranty inquiries, and comply with Canadian tax and accounting statutes.

06. Your Alberta PIPA & PIPEDA Privacy Rights
Under Alberta PIPA and federal PIPEDA, you have the right to request access to the personal information Tidyups holds about you, request corrections to inaccurate details, or withdraw consent for marketing communications.

07. User Data Deletion Instructions (Meta Platform Compliance)
To request deletion of any personal information submitted via Facebook, Instagram, Meta Lead Ads, or our web application (${cfg.primaryOrigin}):
1. Email ${OFFICIAL_EMAIL} with the subject "Data Deletion Request" and include the name, email address, or phone number used in your submission; OR
2. Call or text ${OFFICIAL_PHONE} during Edmonton business hours; OR
3. Submit a request at ${cfg.supportUrl}.
We verify and permanently delete eligible personal data within 7 business days (subject only to mandatory Canadian tax/accounting invoice retention laws) and send written confirmation to your email address.

08. Privacy Officer & Contact Information
Privacy Coordinator — Tidyups Cleaning Service Inc. (${OFFICIAL_BRAND_NAME})
Edmonton, Alberta, Canada
Email: ${OFFICIAL_EMAIL}
Phone: ${OFFICIAL_PHONE}
Facebook Page: ${OFFICIAL_FACEBOOK_URL}
`;

  const termsOfServiceTxt = `TIDYUPS CLEANING SERVICE INC. — TERMS & CONDITIONS
Effective Date: November 2026 · Edmonton, Alberta, Canada
Live URL: ${cfg.termsUrl}
==========================================================

01. Scope of Cleaning Services
Tidyups Cleaning Service Inc. ("Tidyups", operating as "${OFFICIAL_BRAND_NAME}") provides residential house cleaning, deep cleaning, move-in/move-out detailing, short-term rental (Airbnb) turnovers, and office/commercial janitorial services throughout Edmonton, Alberta and surrounding communities within 20 km.

02. Estimates, Property Condition & Alberta GST
Online quotes generated on ${cfg.bookingUrl} or via Meta Lead Ads are based on accurate bedroom count, bathroom count, square footage, and standard occupancy conditions. All amounts are quoted in Canadian Dollars (CAD) and are subject to 5% Federal Goods and Services Tax (GST) in Alberta.

03. Property Access, Utilities & Crew Safety
Clients agree to provide safe, unobstructed entry at the scheduled arrival window along with active running hot water, electricity, and seasonal heating or cooling.

04. Cancellations, Rescheduling & Lockouts
Appointments may be rescheduled or cancelled without penalty with at least 24 hours notice prior to the start of your arrival window by calling ${OFFICIAL_PHONE}, emailing ${OFFICIAL_EMAIL}, or submitting a request at ${cfg.supportUrl}. Cancellations with less than 24 hours notice or lockouts may incur a $65 CAD dispatch fee.

05. 24-Hour Walkthrough Satisfaction Guarantee
If any item included in your booked service scope was overlooked, contact Tidyups within 24 hours of completion and our crew will return to re-clean the missed area at no additional charge.

06. Insurance, Fragile Items & Pre-Existing Wear
Tidyups Cleaning Service Inc. maintains commercial general liability protection for services performed by our crews. Please secure cash, jewelry, and irreplaceable fragile items prior to service.

07. Promotional Offers & Facebook Ad Studio Tools
Promotional discounts advertised on ${OFFICIAL_FACEBOOK_URL}, Instagram, or web campaigns apply only when approved by Tidyups Cleaning Service Inc. Authorized team members are responsible for reviewing all generated ad copy, images, and videos prior to publishing.

08. Governing Law & Contact
Governed by the laws of the Province of Alberta and Canada, with exclusive venue in Edmonton, Alberta.
Contact: Tidyups Cleaning Service Inc. · ${OFFICIAL_PHONE} · ${OFFICIAL_EMAIL}
`;

  const dataDeletionTxt = `USER DATA DELETION INSTRUCTIONS — ${OFFICIAL_BRAND_NAME}
Live URL: ${cfg.dataDeletionUrl}
Alternate URL: ${cfg.primaryOrigin}/data-deletion
================================================================

Tidyups Cleaning Service Inc. (${OFFICIAL_BRAND_NAME}) respects your privacy and complies
with Meta Platform Data Deletion requirements as well as Alberta PIPA and Canadian PIPEDA.

How to Request Deletion of Your Data:
If you interacted with our Facebook Page (${OFFICIAL_FACEBOOK_URL}), submitted a Meta Lead Ad
Instant Form, booked a clean at ${cfg.bookingUrl}, or signed into our web app, you may
request permanent deletion of your personal data at any time using any of these methods:

Method 1 — Email (Fastest)
- Send an email to: ${OFFICIAL_EMAIL}
- Subject line:     Data Deletion Request
- Include:          Your full name and the email address or phone number used with us.

Method 2 — Phone / SMS
- Call or text:     ${OFFICIAL_PHONE} (Mon–Sat 8:00 AM – 7:00 PM MST)

Method 3 — Support Portal
- Visit:            ${cfg.supportUrl} and submit a Data Deletion request ticket.

What Happens Next:
1. Our Privacy Coordinator acknowledges your request within 2 business days.
2. All eligible customer profile data, Meta Lead Form submissions, booking drafts, and
   associated cloud records are permanently deleted within 7 business days (except records
   required by Canadian tax law).
3. You receive a written confirmation email once deletion is complete.

To revoke Facebook App access directly in your Facebook account:
1. Open Facebook -> Settings & Privacy -> Settings -> Apps and Websites.
2. Locate "${cfg.appDisplayName}" and click "Remove".
`;

  const csvRows = [
    ['Meta Dashboard Section', 'Field Name', 'Exact Value to Paste', 'Notes'],
    ...cfg.rows.map((r) => [r.section, r.field, r.value, r.notes]),
  ]
    .map((line) => line.map(csvCell).join(','))
    .join('\r\n');

  zip.file('00-START-HERE-SETUP-GUIDE.md', startHereGuide);
  zip.file('01-meta-app-basic-settings.txt', basicSettingsTxt);
  zip.file('02-meta-app-config.json', configJson);
  zip.file('03-facebook-login-oauth-settings.txt', oauthSettingsTxt);
  zip.file('04-permissions-and-app-review-guide.md', permissionsGuideMd);
  zip.file('05-business-verification-and-domain-checklist.md', businessVerificationMd);
  zip.file('06-privacy-policy.txt', privacyPolicyTxt);
  zip.file('07-terms-of-service.txt', termsOfServiceTxt);
  zip.file('08-data-deletion-instructions.txt', dataDeletionTxt);
  zip.file('09-meta-urls-quick-reference.csv', csvRows);

  const filesIncluded = [
    '00-START-HERE-SETUP-GUIDE.md',
    '01-meta-app-basic-settings.txt',
    '02-meta-app-config.json',
    '03-facebook-login-oauth-settings.txt',
    '04-permissions-and-app-review-guide.md',
    '05-business-verification-and-domain-checklist.md',
    '06-privacy-policy.txt',
    '07-terms-of-service.txt',
    '08-data-deletion-instructions.txt',
    '09-meta-urls-quick-reference.csv',
  ];

  const officialLogoBlob = await fetchOfficialLogoBlob();
  if (officialLogoBlob) {
    zip.file('assets/bookmycleaning-tidyups-official-logo.png', officialLogoBlob);
    filesIncluded.push('assets/bookmycleaning-tidyups-official-logo.png');

    const icon1024 = await build1024SquareIconPng(officialLogoBlob);
    if (icon1024) {
      zip.file('assets/meta-app-icon-1024x1024.png', icon1024);
      filesIncluded.push('assets/meta-app-icon-1024x1024.png');
    }
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const fileName = 'bookmycleaning-tidyups-meta-app-setup-kit.zip';
  const blobUrl = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

  return {
    fileName,
    fileCount: filesIncluded.length,
    filesIncluded,
  };
}
