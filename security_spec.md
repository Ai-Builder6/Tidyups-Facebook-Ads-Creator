# Security Specification — Tidyups Facebook Ads Creator

## 1. Data Invariants & Relationship Mapping

- **Master Source of Truth**: `/campaigns/{campaignId}` is the parent resource. Each `Campaign` belongs exclusively to a single verified Firebase Auth user (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`).
- **Subcollection Master Gate**: `/campaigns/{campaignId}/ads/{adId}` stores individual ad variations (`AdVariation`) rather than an unbounded array inside `Campaign`.
  - An `AdVariation` cannot be created unless the parent `/campaigns/{campaignId}` exists (or is created atomically in the same batch via `existsAfter` / `getAfter`) AND its `ownerId` matches `request.auth.uid`, AND `incoming().campaignId == campaignId`.
  - Single-document `get`, `update`, and `delete` operations on `AdVariation` enforce `isValidId(campaignId)`, `isValidId(adId)`, AND verify parent ownership via `get(/databases/$(database)/documents/campaigns/$(campaignId)).data.ownerId == request.auth.uid`.
  - `list` queries on `/campaigns` and `/campaigns/{campaignId}/ads` strictly check `resource.data.ownerId == request.auth.uid` (and `resource.data.campaignId == campaignId` for ads) without performing `get()`/`exists()` inside `allow list`.
- **Immutable & Temporal Fields**:
  - `ownerId`, `campaignId`, and `createdAt` are strictly immutable after creation.
  - `createdAt` on `create` and `updatedAt` on both `create` and `update` must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on Campaign Create**: Authenticated `user_a` writes `/campaigns/camp_1` with `ownerId: "user_b"`. -> `PERMISSION_DENIED`
2. **Unverified Email Write**: Authenticated `user_a` with `email_verified: false` creates `/campaigns/camp_1`. -> `PERMISSION_DENIED`
3. **Shadow / Ghost Field Injection (Create)**: `user_a` creates `/campaigns/camp_1` with all valid fields plus `"isAdmin": true`. -> `PERMISSION_DENIED`
4. **Shadow / Ghost Field Injection (Update)**: `user_a` updates `/campaigns/camp_1` adding `"isVerified": true`. -> `PERMISSION_DENIED`
5. **Immutable Owner Mutation**: `user_a` updates `/campaigns/camp_1` changing `ownerId` from `"user_a"` to `"user_b"`. -> `PERMISSION_DENIED`
6. **Client Timestamp Forgery**: `user_a` creates `/campaigns/camp_1` with a past/future `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`
7. **Path Variable / ID Poisoning**: `user_a` creates `/campaigns/bad$id!spaces` with special characters violating `^[a-zA-Z0-9_\-]+$`. -> `PERMISSION_DENIED`
8. **String Size Overflow (Denial of Wallet)**: `user_a` creates `/campaigns/camp_1` with a 5,000-character `title` (exceeds `maxLength: 120`). -> `PERMISSION_DENIED`
9. **Insecure HTTP Booking URL**: `user_a` creates `/campaigns/camp_1` with `bookingUrl: "http://insecure.example.com"` (violates `^https://.+$`). -> `PERMISSION_DENIED`
10. **Orphaned Ad Variation Create**: `user_a` creates `/campaigns/nonexistent_camp/ads/ad_1` when `/campaigns/nonexistent_camp` does not exist. -> `PERMISSION_DENIED`
11. **Cross-Tenant Subcollection Hijack**: `user_b` creates `/campaigns/user_a_camp/ads/ad_1` under `user_a`'s campaign. -> `PERMISSION_DENIED`
12. **Unauthorized Blanket List / Cross-Tenant Read**: `user_b` attempts to `get` or `list` `/campaigns` without filtering `ownerId == "user_b"` (or reading `user_a`'s campaign). -> `PERMISSION_DENIED`
