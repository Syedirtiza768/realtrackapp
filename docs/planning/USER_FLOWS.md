# User Flows

> **Source**: Extracted from `docs/SYSTEM_OVERVIEW.md` (2026-05-29) primary data flows.
> For the architecture-level data flow, see [/docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md).

## Primary User Journeys

### 1. Catalog Import Flow

```
User opens /catalog/import
    → Uploads CSV file
    → POST /api/catalog-import/upload
    → CSV Import Processor (BullMQ queue)
    → Parse → Validate → Transform
    → Create CatalogProduct records
    → AI Enrichment (optional - OpenAI queue)
    → Motors Intelligence (attribute extraction)
    → Review Queue (human approval)
    → Ready for Publishing
```

**Screen flow**: Catalog → Import → Upload → Processing status → Review → Approve

### 2. Listing Creation & Publishing

```
User opens /listings/new
    → AI-assisted editor loads
    → User fills in listing details or uses AI generation
    → Saves as draft
    → Reviews and marks "ready"
    → Navigates to /catalog/products/:id/publish/ebay
    → Selects eBay store(s)
    → Configures listing options (price, quantity, policies)
    → Publishes (POST /api/channels/ebay/publish)
    → eBay Publish Processor (BullMQ)
    → Calls eBay API (AddItem/ReviseItem)
    → Creates ListingRecord + ChannelListing
    → Syncs inventory allocation
    → Notification via WebSocket
```

**Screen flow**: Listings → New/Edit → AI generation → Preview → Publish → Confirmation

### 3. Order Management Flow

```
Scheduled job runs (every N minutes)
    → eBay Order Sync Processor
    → Fetches orders from eBay API
    → Creates Order + OrderItem records
    → Updates inventory ledger
    → Notification to user (WebSocket)
    → Dashboard KPI update (aggregation queue)
    → User views /orders
    → User marks as shipped / processes refund
```

**Screen flow**: Dashboard (notification) → Orders → Order detail → Ship/Refund

### 4. Inventory Management

```
User opens /inventory
    → Views current inventory ledger
    → Inventory allocated when listing published to store
    → Inventory adjusted on order import
    → User can manually adjust quantities
    → Inventory events logged for audit
```

**Screen flow**: Inventory → Ledger view → Adjust quantity → Events log

### 5. eBay Store Setup

```
User opens /settings/integrations/ebay
    → Clicks "Connect eBay Account"
    → OAuth redirect to eBay (or imports from SellerPundit)
    → OAuth callback at /channels/ebay/callback
    → Tokens stored in ConnectedEbayAccount + EbayOauthToken
    → User configures stores, policies, default settings
    → Store ready for publishing
```

**Screen flow**: Settings → eBay Integration → Connect/Import → Configure policies → Done

### 6. AI Motors Intelligence

```
User uploads product data to /motors/upload
    → AI processes via Motors Pipeline (BullMQ)
    → Extracts attributes (brand, MPN, type, condition)
    → Validates against eBay category requirements
    → Generates ProductCandidate records
    → Review queue at /motors/review
    → User approves or corrects extractions
    → Approved products feed into listing creation
```

**Screen flow**: Motors → Upload → Processing → Review queue → Approve/Correct → Listings

### 7. Team Management (Admin)

```
Admin opens /settings/users
    → Views all users in organization
    → Assigns roles to users
    → Configure permissions per role at /settings/permissions
    → New users register via /register (default: staff role)
```

**Screen flow**: Settings → Users → Assign role → Permissions → Configure

---

## Public (Unauthenticated) Flows

### Login / Registration

```
Navigate to /login
    → Enter email + password
    → POST /api/auth/login
    → JWT stored in localStorage (mk_auth_token)
    → User data stored (mk_auth_user)
    → Redirect to dashboard (/)

Registration:
    → /register
    → Fill form
    → POST /api/auth/register
    → Auto-assigned staff role + default org
    → JWT returned, redirect to dashboard
```

### Forgot Password (Partial)

```
Navigate to /forgot-password
    → Enter email
    → Backend reset endpoint unverified (⚠️ Needs verification)
```

### eBay OAuth Callback

```
Redirected from eBay auth
    → /channels/ebay/callback (@Public route)
    → Backend exchanges code for tokens
    → Stores ConnectedEbayAccount + EbayOauthToken
    → Redirects to settings
```

---

## Permission-Based Gating

All protected routes pass through `<ProtectedRoute>` in `src/App.tsx` which checks:
1. User is authenticated (valid JWT)
2. User has required permission(s) from the `permissions` prop

Unprotected routes: `/login`, `/register`, `/forgot-password`, `/channels/ebay/callback`

---

*Created: 2026-06-06.*
