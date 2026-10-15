# Ohana Barbershop — Integrations

## 1. Booking and scheduling — Easy!Appointments (self-hosted, open source)

**Purpose:** Allow customers to book appointments online on infrastructure the business owns.

**Selected provider:** Easy!Appointments — GPL-3.0 open-source appointment scheduler (`github.com/alextselegidis/easyappointments`), self-hosted via the official Docker Compose stack. Replaces Acuity Scheduling per `docs/DECISIONS.md` DEC-001.

**Provider documentation:** https://easyappointments.org/docs.html and `docs/` + `openapi.yml` in the repository.

**Required credentials:**
- Admin account for the Easy!Appointments backend (created during install) — owner manages services, providers, working plan, and customers here. This is the business's scheduling "CMS."
- SMTP credentials for notification emails (transactional provider or Gmail app password) — stored in Easy!Appointments config, **not** in this repository.
- REST API credentials (admin/secret) only if a future task builds a custom booking UI or the mobile app — also never committed to this repository.
- None needed for the website's embed/link integration.

**Environment variables:**
- `NEXT_PUBLIC_BOOKING_URL` — public base URL of the Easy!Appointments instance (e.g., `https://book.ohana-barbershop.com`); falls back to placeholder until the instance is deployed. Replaces the former `NEXT_PUBLIC_ACUITY_URL`.

**Supported features:**
- Public booking wizard embedded via iframe on `/book` (page: `/index.php/booking`).
- Full scheduling back-office for the owner: services, providers, working plans/breaks, customers, appointments, business settings.
- Email confirmations/notifications via SMTP.
- Google Calendar sync (optional, configured in the E!A backend).
- REST API (documented in `openapi.yml`) for future deep integrations and the Phase 2 mobile app.
- Service selection from website (`/book?service=<slug>` maps to `bookingServiceId` — **verify** whether the E!A wizard honors a preselected service; it may always start at service/provider selection).

**Unsupported features:**
- Real-time availability display on the website (possible later via the REST API).
- Server-side booking validation or conflict prevention from the website.
- Custom deposit collection through the website.
- Customer accounts shared with the website.

**Inbound data:** None — the static site only embeds/links out.

**Outbound data:** Customer books inside the Easy!Appointments wizard; appointment and customer data is stored in the self-hosted MySQL database — no data enters the website backend.

**Authentication:** Not required for embed. The E!A backend and REST API use their own credentials, managed outside this repo.

**Webhook requirements:** None for this phase.

**Failure handling:**
- If the booking iframe fails to load, display a fallback message with phone/SMS/email links.
- If `NEXT_PUBLIC_BOOKING_URL` is missing, fall back to the documented placeholder URL.
- If the E!A instance is down, the site remains fully available; only booking degrades to phone/text fallback.

**Retry strategy:** N/A.

**Idempotency:** N/A (booking creation happens inside E!A).

**Rate limits:** N/A.

**Estimated ongoing costs:** One small VPS (~$5–$10/month) running the E!A + MySQL Docker Compose stack, plus an SMTP provider free tier. No per-booking or subscription fees; GPL-3.0 license is free.

**Local testing strategy:** Optionally run the project's `docker compose up` stack locally and point `NEXT_PUBLIC_BOOKING_URL` at it; otherwise use the placeholder URL. Do not create test appointments against the production schedule without permission.

**Production verification:** Visit `/book`, confirm the booking wizard loads and completes a test booking flow; confirm notification email delivery.

**Fallback behavior:** Phone call or text message to the business number.

**Current status:** PENDING MIGRATION — Acuity embed still in code (`apps/web/src/components/acuity-embed.tsx`, `acuityTypeId` in `apps/web/src/lib/site.ts`); replacement is task BKG-001 in `docs/IMPLEMENTATION_PLAN.md`.

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
- `NEXT_PUBLIC_BOOKING_URL` (optional)

**Supported features:** Static hosting, CDN, custom domain.

**Unsupported features:** Server-side runtime, edge functions, serverless API routes (not needed in this phase). The Easy!Appointments booking server is a separate Docker deployment on its own hostname — see section 1 and `docs/DEPLOYMENT.md`.

**Inbound data:** HTTP requests for static assets and pages.

**Outbound data:** None.

**Authentication:** N/A.

**Webhook requirements:** None.

**Failure handling:** 404 page is provided by Next.js.

**Retry strategy:** N/A.

**Rate limits:** Determined by host.

**Estimated ongoing costs:** $0–$20/month for the static site depending on host and bandwidth, plus ~$5–$10/month for the VPS hosting Easy!Appointments.

**Local testing strategy:** Run `pnpm build && pnpm start` or serve the `out/` directory locally.

**Production verification:** Confirm domain resolves, HTTPS works, and all pages load.

**Fallback behavior:** Deploy to a secondary host if the primary fails.

**Current status:** Pending host selection.
