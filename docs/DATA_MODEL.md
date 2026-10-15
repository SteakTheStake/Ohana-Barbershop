# Ohana Barbershop — Data Model

## Overview

This phase of the project has **no server-side database**. All business content is stored as static TypeScript data in `apps/web/src/lib/site.ts`. Booking data, customer records, and appointments remain inside Acuity Scheduling.

This document defines the static data contracts used by the website and notes future entities if a backend is added later.

## Static data structures

### `site`

Location: `apps/web/src/lib/site.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Business name. |
| `tagline` | `string` | Yes | Short tagline. |
| `url` | `string` | Yes | Canonical site URL. |
| `city` | `string` | Yes | City for schema/address. |
| `region` | `string` | Yes | State code for schema/address. |
| `phone` | `string` | Yes | Formatted phone number. |
| `phoneHref` | `string` | Yes | `tel:` link. |
| `smsHref` | `string` | Yes | `sms:` link. |
| `email` | `string` | Yes | Business email. |
| `instagram` | `string` | Yes | Instagram profile URL. |
| `facebook` | `string` | Yes | Facebook profile URL. |
| `streetAddress` | `string` | Yes | Street address for schema. |
| `postalCode` | `string` | Yes | ZIP code for schema. |
| `address` | `string` | Yes | Full human-readable address. |
| `hours` | `{ day: string; time: string }[] \| null` | No | Weekly hours; `null` until confirmed by owner. |

### `Service`

Location: `apps/web/src/lib/site.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | `string` | Yes | URL-safe identifier. |
| `name` | `string` | Yes | Display name. |
| `hawaiian` | `string \| undefined` | No | Hawaiian name. |
| `price` | `number` | Yes | Price in USD. |
| `blurb` | `string` | Yes | Short description. |
| `acuityTypeId` | `number \| undefined` | No | Acuity appointment type ID for deep linking. |

### `services`

An array of `Service` objects. Order determines display order on Home and Services pages.

Current services:
- Haircut — $35
- Skin Fade — $40
- Buzz / Senior — $25
- Keiki Kutz — $25
- Beard Trim — $20

## Future entities (out of scope)

If a backend is added later, the following entities may be introduced. They are **not implemented** in this phase.

### `Appointment`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Primary key. |
| `serviceId` | `string` | Reference to `Service`. |
| `customerName` | `string` | |
| `customerPhone` | `string` | |
| `customerEmail` | `string \| null` | |
| `startsAt` | `ISO-8601` | America/Los_Angeles. |
| `endsAt` | `ISO-8601` | Computed from service duration. |
| `status` | `enum` | `pending`, `confirmed`, `cancelled`, `completed`, `no_show`. |

### `BusinessHours`

| Field | Type | Notes |
|-------|------|-------|
| `dayOfWeek` | `number` | 0 = Sunday, 6 = Saturday. |
| `opensAt` | `HH:MM` | Local time. |
| `closesAt` | `HH:MM` | Local time. |
| `closed` | `boolean` | |

### `TimeOff`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `startsAt` | `ISO-8601` | |
| `endsAt` | `ISO-8601` | |
| `reason` | `string` | |

### `GalleryItem`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `src` | `string` | Image URL or path. |
| `alt` | `string` | |
| `category` | `string \| null` | e.g., "haircut", "shop". |

### `MerchandiseProduct`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `name` | `string` | |
| `description` | `string` | |
| `priceCents` | `number` | |
| `images` | `string[]` | |
| `active` | `boolean` | |

## Data ownership

| Data | Owner | Storage |
|------|-------|---------|
| Website content | Repository | `apps/web/src/lib/site.ts` |
| Appointment data | Acuity Scheduling | Acuity platform |
| Customer messages | Business / email provider | Business inbox / SMS app |
| Images / assets | Repository / CDN | `public/` and host CDN |

## Validation rules

- All prices must be positive integers.
- All slugs must be URL-safe and unique.
- `site.phoneHref` must use `tel:+1...` format.
- `site.smsHref` must use `sms:+1...` format.
- `site.url` must not have a trailing slash (used to construct sitemap and schema URLs).

## Timestamp and timezone handling

- Static hours are stored as human-readable strings until a backend is added.
- Future timestamps should be stored in UTC and rendered in `America/Los_Angeles`.
