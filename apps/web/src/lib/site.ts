export const ACUITY_URL =
  process.env.NEXT_PUBLIC_ACUITY_URL ?? "https://blueprintcatalogen.as.me/";

export const site = {
  name: "Ohana Barbershop",
  tagline: "Island vibez. Clean cuts.",
  url: "https://www.ohana-barbershop.com",
  city: "Albany",
  region: "OR",
  phone: "(458) 309-8765",
  phoneHref: "tel:+14583098765",
  smsHref: "sms:+14583098765",
  email: "ohanabarbershop1@gmail.com",
  instagram: "https://instagram.com/ohana_barber541",
  facebook: "https://facebook.com/profile.php?id=61573216836263",
  streetAddress: "820 Pacific Blvd SE Ste F",
  postalCode: "97322",
  address: "820 Pacific Blvd SE Ste F, Albany, OR 97322",
  hours: null as { day: string; time: string }[] | null,
};

export type Service = {
  slug: string;
  name: string;
  hawaiian?: string;
  price: number;
  blurb: string;
  // Acuity appointment type ID — set once types are created in Acuity
  acuityTypeId?: number;
};

export const services: Service[] = [
  { slug: "haircut", name: "Haircut", hawaiian: "ʻOki Lauoho", price: 35, blurb: "Classic cut, your way." },
  { slug: "skin-fade", name: "Skin Fade", price: 40, blurb: "Bald to blended." },
  { slug: "buzz", name: "Buzz / Senior", price: 25, blurb: "Quick and clean." },
  { slug: "keiki", name: "Keiki Kutz", hawaiian: "Keiki", price: 25, blurb: "Kids 10 & under." },
  { slug: "beard", name: "Beard Trim", price: 20, blurb: "Hot towel. Warm lather." },
];

export const bookingUrl = (typeId?: number) =>
  typeId ? `${ACUITY_URL}?appointmentType=${typeId}` : ACUITY_URL;
