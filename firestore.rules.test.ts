import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

function makeValidCampaignPayload(ownerId: string) {
  return {
    ownerId,
    title: 'Spring Move-Out Campaign',
    service: 'moveout',
    tone: 'trust',
    format: '1:1',
    offer: '10% off first clean',
    area: 'Edmonton, Alberta + 20 km',
    bookingUrl: 'https://app.tidyupscleaning.com/booking',
    businessPhone: '780-718-5092',
    notes: 'Highlight kitchen cabinet detailing',
    adCount: 3,
    linkedSheetId: '',
    linkedSheetName: '',
    linkedDriveFileId: '',
    linkedDriveFileName: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function makeValidAdPayload(ownerId: string, campaignId: string) {
  return {
    ownerId,
    campaignId,
    variationNumber: 1,
    serviceName: 'Move-Out Cleaning',
    format: '1:1',
    headline: 'Move-Out Cleaning Edmonton',
    primaryText: 'Moving day is stressful enough. Book Tidyups Cleaning Service.',
    description: 'Edmonton & surrounding areas. Request a cleaning quote.',
    cta: 'Book Now',
    destinationUrl: 'https://app.tidyupscleaning.com/booking',
    imagePrompt: 'Photorealistic modern Canadian kitchen being cleaned.',
    videoScript: '0-3s: Empty kitchen. 3-7s: Detailing cabinets. 7-10s: Sparkling clean.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

describe('Tidyups Hardened Firestore Security Rules — Dirty Dozen TDD', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-tidyups-rules-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('allows verified owner to create and read their own campaign', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertSucceeds(setDoc(doc(db, 'campaigns', 'camp_1'), makeValidCampaignPayload('user_a')));
    await assertSucceeds(getDoc(doc(db, 'campaigns', 'camp_1')));
  });

  it('1. denies Identity Spoofing on Campaign create', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertFails(setDoc(doc(db, 'campaigns', 'camp_1'), makeValidCampaignPayload('user_b')));
  });

  it('2. denies Unverified Email write', async () => {
    const unverified = testEnv.authenticatedContext('user_a', { email_verified: false });
    const db = unverified.firestore();
    await assertFails(setDoc(doc(db, 'campaigns', 'camp_1'), makeValidCampaignPayload('user_a')));
  });

  it('3. denies Shadow / Ghost Field injection on create', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertFails(
      setDoc(doc(db, 'campaigns', 'camp_1'), {
        ...makeValidCampaignPayload('user_a'),
        isAdmin: true,
      })
    );
  });

  it('4. denies Shadow / Ghost Field injection on update', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertSucceeds(setDoc(doc(db, 'campaigns', 'camp_1'), makeValidCampaignPayload('user_a')));
    await assertFails(
      updateDoc(doc(db, 'campaigns', 'camp_1'), {
        isVerified: true,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('5. denies Immutable Owner mutation on update', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertSucceeds(setDoc(doc(db, 'campaigns', 'camp_1'), makeValidCampaignPayload('user_a')));
    await assertFails(
      updateDoc(doc(db, 'campaigns', 'camp_1'), {
        ownerId: 'user_b',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('6. denies Client Timestamp forgery on create', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertFails(
      setDoc(doc(db, 'campaigns', 'camp_1'), {
        ...makeValidCampaignPayload('user_a'),
        createdAt: Timestamp.fromMillis(1700000000000),
      })
    );
  });

  it('7. denies Path Variable / ID Poisoning', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertFails(
      setDoc(doc(db, 'campaigns', 'bad$id!spaces'), makeValidCampaignPayload('user_a'))
    );
  });

  it('8. denies String Size Overflow (Denial of Wallet)', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertFails(
      setDoc(doc(db, 'campaigns', 'camp_1'), {
        ...makeValidCampaignPayload('user_a'),
        title: 'A'.repeat(5000),
      })
    );
  });

  it('9. denies Insecure HTTP Booking URL', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertFails(
      setDoc(doc(db, 'campaigns', 'camp_1'), {
        ...makeValidCampaignPayload('user_a'),
        bookingUrl: 'http://insecure.example.com/booking',
      })
    );
  });

  it('10. denies Orphaned Ad Variation create when parent campaign is missing', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    const db = alice.firestore();
    await assertFails(
      setDoc(
        doc(db, 'campaigns', 'nonexistent_camp', 'ads', 'ad_1'),
        makeValidAdPayload('user_a', 'nonexistent_camp')
      )
    );
  });

  it('11. denies Cross-Tenant Subcollection Hijack', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    await assertSucceeds(
      setDoc(doc(alice.firestore(), 'campaigns', 'camp_1'), makeValidCampaignPayload('user_a'))
    );

    const bob = testEnv.authenticatedContext('user_b', { email_verified: true });
    await assertFails(
      setDoc(doc(bob.firestore(), 'campaigns', 'camp_1', 'ads', 'ad_1'), makeValidAdPayload('user_b', 'camp_1'))
    );
  });

  it('12. denies Unauthorized Blanket List and Cross-Tenant Read', async () => {
    const alice = testEnv.authenticatedContext('user_a', { email_verified: true });
    await assertSucceeds(
      setDoc(doc(alice.firestore(), 'campaigns', 'camp_1'), makeValidCampaignPayload('user_a'))
    );

    const bob = testEnv.authenticatedContext('user_b', { email_verified: true });
    await assertFails(getDoc(doc(bob.firestore(), 'campaigns', 'camp_1')));
    await assertFails(getDocs(collection(bob.firestore(), 'campaigns')));
  });
});
