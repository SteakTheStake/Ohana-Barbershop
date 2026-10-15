# Ohana Barbershop — Integrations

## 1. Booking and scheduling — Acuity Scheduling

**Purpose:** Allow customers to book appointments online.

**Selected provider:** Acuity Scheduling (existing Squarespace-integrated account).

**Provider documentation:** https://help.acuityscheduling.com/

**Required credentials:** None for the embed-only integration; business owner manages the Acuity account.

**Environment variables:**
- `NEXT_PUBLIC_ACUITY_URL` — base scheduling URL (optional; falls back to placeholder).

**Supported features:**
- Embedded scheduling iframe.
- Appointment-type-specific deep links via `appointmentType` query parameter.
- Service selection from website (`/book?service=<slug>` maps to `acuityTypeId` when configured).

**Unsupported features:**
- Real-time availability display on the website.
- Server-side booking validation or conflict prevention.
- Custom deposit collection through the website.
- Customer accounts shared with the website.

**Inbound data:** None.

**Outbound data:** Customer is redirected/embedded to Acuity; no booking data enters the website backend.

**Authentication:** Not required for embed.

**Webhook requirements:** None for this phase.

**Failure handling:**
- If the Acuity iframe fails to load, display a fallback message with phone/SMS/email links.
- If `NEXT_PUBLIC_ACUITY_URL` is missing, fall back to the documented placeholder URL.

**Retry strategy:** N/A.

**Idempotency:** N/A.

**Rate limits:** N/A.

**Estimated ongoing costs:** Included with Squarespace/Acuity plan already in use.

**Local testing strategy:** Use the documented fallback URL or owner-provided URL; do not create test appointments against the production schedule without permission.

**Production verification:** Visit `/book`, confirm iframe loads and shows the correct appointment type when a service is preselected.

**Fallback behavior:** Phone call or text message to the business number.

**Current status:** Implemented as iframe embed; `acuityTypeId` values in `apps/web/src/lib/site.ts` are placeholders and must be set once appointment types are configured in Acuity.

---

## 2. Customer messaging — Email / SMS / social links

**Purpose:** Let customers contact the shop.

**Selected provider:** Direct `mailto:`, `tel:`, `sms:` links plus Instagram/Facebook links. Optional form backend to be selected later.

**Provider documentation:** N/A for direct links.

**Required credentials:** None.

**Environment variables:** None.

**Supported features:**
- Click-to-call, click-to-text, click-to-email.
- Links to Instagram and Facebook profiles.

**Unsupported features:**
- Message storage or inbox.
- Automated replies.
- Spam protection.

**Inbound data:** None.

**Outbound data:** Customer's email/SMS client initiates communication.

**Authentication:** N/A.

**Webhook requirements:** None.

**Failure handling:** If a social profile link breaks, users can still call/text/email.

**Retry strategy:** N/A.

**Rate limits:** N/A.

**Estimated ongoing costs:** $0.

**Local testing strategy:** Verify `tel:`, `sms:`, and `mailto:` links resolve correctly on mobile devices.

**Production verification:** Confirm links open the correct apps/numbers.

**Fallback behavior:** Business phone number is always visible.

**Current status:** Implemented as direct links in `/contact`.

---

## 3. Business telephone and missed calls

**Purpose:** Capture missed-call leads.

**Selected provider:** None. The current phone number is a standard mobile/business line.

**Provider documentation:** N/A.

**Required credentials:** N/A.

**Environment variables:** N/A.

**Supported features:** Click-to-call.

**Unsupported features:**
- Missed-call detection.
- Automatic SMS follow-up.
- Call logging.

**Inbound data:** N/A.

**Outbound data:** N/A.

**Authentication:** N/A.

**Webhook requirements:** N/A.

**Failure handling:** N/A.

**Retry strategy:** N/A.

**Rate limits:** N/A.

**Estimated ongoing costs:** $0.

**Local testing strategy:** N/A.

**Production verification:** N/A.

**Fallback behavior:** Customers leave voicemail or send a text.

**Current status:** BLOCKED — no telephone provider exposes missed-call events. Requires owner decision if this capability is needed.

---

## 4. Chatbot

**Purpose:** Answer common business questions.

**Selected provider:** None.

**Current status:** BLOCKED — not in approved Phase 1 scope.

---

## 5. E-commerce and hosted checkout

**Purpose:** Sell merchandise.

**Selected provider:** None. Shop page is a "coming soon" teaser.

**Current status:** BLOCKED — merchandise is not ready. Shop page links to Instagram for updates.

---

## 6. Hosting and deployment

**Purpose:** Serve the public website.

**Selected provider:** TBD — static host supporting Next.js static export (Vercel, Netlify, Cloudflare Pages, GitHub Pages, or existing provider).

**Required credentials:** Host account and DNS access.

**Environment variables:**
- `NEXT_PUBLIC_ACUITY_URL` (optional)

**Supported features:** Static hosting, CDN, custom domain.

**Unsupported features:** Server-side runtime, edge functions, serverless API routes (not needed in this phase).

**Inbound data:** HTTP requests for static assets and pages.

**Outbound data:** None.

**Authentication:** N/A.

**Webhook requirements:** None.

**Failure handling:** 404 page is provided by Next.js.

**Retry strategy:** N/A.

**Rate limits:** Determined by host.

**Estimated ongoing costs:** $0–$20/month depending on host and bandwidth.

**Local testing strategy:** Run `pnpm build && pnpm start` or serve the `out/` directory locally.

**Production verification:** Confirm domain resolves, HTTPS works, and all pages load.

**Fallback behavior:** Deploy to a secondary host if the primary fails.

**Current status:** Pending host selection.
