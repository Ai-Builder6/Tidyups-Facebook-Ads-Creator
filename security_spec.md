# Security Specification — Tidyups Facebook Ads Creator & Creative Portfolio

## 1. Data Invariants & Relationship Mapping

- **Master Source of Truth (`/campaigns/{campaignId}`)**: Each `Campaign` belongs exclusively to a single verified Firebase Auth user (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`).
- **Subcollection Master Gate (`/campaigns/{campaignId}/ads/{adId}`)**: Stores individual ad variations (`AdVariation`) rather than an unbounded array inside `Campaign`.
  - An `AdVariation` cannot be created unless the parent `/campaigns/{campaignId}` exists (or is created atomically in the same batch via `existsAfter` / `getAfter`) AND its `ownerId` matches `request.auth.uid`, AND `incoming().campaignId == campaignId`.
  - Single-document `get`, `update`, and `delete` operations on `AdVariation` enforce `isValidId(campaignId)`, `isValidId(adId)`, AND verify parent ownership via `get(/databases/$(database)/documents/campaigns/$(campaignId)).data.ownerId == request.auth.uid`.
- **Creative Portfolio Isolation (`/creativeAssets/{assetId}`)**: Stores metadata, prompts, optional Google Drive file references (`driveFileId`, `driveWebViewLink`), and bounded compressed thumbnail previews (`previewDataUrl.size() <= 180000`, `svgMarkup.size() <= 40000`) for generated Ad Images (`ad-image`), Video Ads (`video-ad`), Brand Logos (`brand-logo`), and Brand Icons (`brand-icon`).
  - Strictly isolated per verified owner (`ownerId == request.auth.uid`, `isVerifiedUser()`).
  - `category`, `ownerId`, and `createdAt` are immutable after creation; updates only allow renaming `title` or linking `driveFileId` / `driveWebViewLink` with `updatedAt == request.time`.
- **Secure List Queries**: `list` queries on `/campaigns`, `/campaigns/{campaignId}/ads`, and `/creativeAssets` strictly check `resource.data.ownerId == request.auth.uid` without performing `get()`/`exists()` inside `allow list`.
- **Immutable & Temporal Fields**:
  - `ownerId`, `campaignId`, `category`, and `createdAt` are strictly immutable after creation.
  - `createdAt` on `create` and `updatedAt` on both `create` and `update` must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on Campaign Create**: Authenticated `user_a` writes `/campaigns/camp_1` with `ownerId: "user_b"`. -> `PERMISSION_DENIED`
2. **Unverified Email Write**: Authenticated `user_a` with `email_verified: false` creates `/campaigns/camp_1` or `/creativeAssets/asset_1`. -> `PERMISSION_DENIED`
3. **Shadow / Ghost Field Injection (Create)**: `user_a` creates `/campaigns/camp_1` or `/creativeAssets/asset_1` with all valid fields plus `"isAdmin": true`. -> `PERMISSION_DENIED`
4. **Shadow / Ghost Field Injection (Update)**: `user_a` updates `/campaigns/camp_1` or `/creativeAssets/asset_1` adding `"isVerified": true`. -> `PERMISSION_DENIED`
5. **Immutable Owner / Category Mutation**: `user_a` updates `/creativeAssets/asset_1` changing `ownerId` or `category`. -> `PERMISSION_DENIED`
6. **Client Timestamp Forgery**: `user_a` creates `/campaigns/camp_1` with a past/future `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`
7. **Path Variable / ID Poisoning**: `user_a` creates `/creativeAssets/bad$id!spaces` with special characters violating `^[a-zA-Z0-9_\-]+$`. -> `PERMISSION_DENIED`
8. **String Size / Thumbnail Overflow (Denial of Wallet)**: `user_a` creates `/creativeAssets/asset_1` with a 250,000-char `previewDataUrl` (exceeds `maxLength: 180000`) or 5,000-char `title`. -> `PERMISSION_DENIED`
9. **Insecure HTTP Booking or Drive URL**: `user_a` creates `/campaigns/camp_1` with `bookingUrl: "http://insecure.example.com"` or `/creativeAssets/asset_1` with non-HTTPS `driveWebViewLink`. -> `PERMISSION_DENIED`
10. **Orphaned Ad Variation Create**: `user_a` creates `/campaigns/nonexistent_camp/ads/ad_1` when `/campaigns/nonexistent_camp` does not exist. -> `PERMISSION_DENIED`
11. **Cross-Tenant Subcollection Hijack**: `user_b` creates `/campaigns/user_a_camp/ads/ad_1` under `user_a`'s campaign. -> `PERMISSION_DENIED`
12. **Unauthorized Blanket List / Cross-Tenant Portfolio Read**: `user_b` attempts to `get` or `list` `/campaigns` or `/creativeAssets` belonging to `user_a`. -> `PERMISSION_DENIED`
