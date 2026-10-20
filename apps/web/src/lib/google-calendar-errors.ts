import { APIError } from "payload";

export class CalendarBookingUnavailable extends APIError {
  constructor(state: string) {
    super(state === "pending"
      ? "Your schedule is syncing with Google Calendar. Please try again shortly."
      : state === "conflict"
        ? "Booking is paused while the shop resolves a calendar conflict. Please call the shop."
        : "Google Calendar sync is overdue or unavailable. Please try again shortly or call the shop.", 503);
  }
}
