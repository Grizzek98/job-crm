// Tidies the dates people type on a resume into one consistent, ATS-friendly
// style: "Feb 2022 – Mar 2026", "Jun 2019 – Present", or a single "May 2018".
//
// People can type dates however they like ("2/2022 - now", "February 22 to
// 03/2026", "2022-02"). If any part can't be understood, the text is left as
// it was, so nothing the person typed is ever lost, and the Resume page shows
// a gentle message asking for month and year (isUnreadableDateRange).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRESENT_WORDS = /^(present|current|currently|now|today|ongoing)$/i;

function fullYear(text) {
  if (text.length === 4) return Number(text);
  // Two-digit year: treat anything up to a few years from now as 20xx.
  const yy = Number(text);
  const cutoff = (new Date().getFullYear() % 100) + 5;
  return yy <= cutoff ? 2000 + yy : 1900 + yy;
}

function monthFromName(name) {
  const key = name.slice(0, 3).toLowerCase();
  const index = MONTHS.findIndex((m) => m.toLowerCase() === key);
  // Accept "Feb", "Feb.", "February", "Sept"; reject random words starting "jan…".
  if (index < 0) return -1;
  const full = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ][index];
  const clean = name.toLowerCase().replace(/\.$/, "");
  return full.startsWith(clean) || clean === "sept" ? index : -1;
}

// One date -> "Feb 2022", "2022" or "Present". Returns null if not understood.
export function formatDate(text) {
  const t = text.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  if (PRESENT_WORDS.test(t)) return "Present";

  let m;
  // "Feb 2022", "February 22", "Feb. 2022"
  if ((m = t.match(/^([a-z]+\.?) ?'?(\d{4}|\d{2})$/i))) {
    const month = monthFromName(m[1]);
    return month < 0 ? null : `${MONTHS[month]} ${fullYear(m[2])}`;
  }
  // "2/2022", "02/22", "2-2022", "2.2022"
  if ((m = t.match(/^(\d{1,2}) ?[/.-] ?(\d{4}|\d{2})$/))) {
    const month = Number(m[1]) - 1;
    return month < 0 || month > 11 ? null : `${MONTHS[month]} ${fullYear(m[2])}`;
  }
  // "2022-02", "2022/2"
  if ((m = t.match(/^(\d{4}) ?[/.-] ?(\d{1,2})$/))) {
    const month = Number(m[2]) - 1;
    return month < 0 || month > 11 ? null : `${MONTHS[month]} ${m[1]}`;
  }
  // "2022"
  if (/^\d{4}$/.test(t)) return t;
  return null;
}

// A date or a date range -> the tidy style above, or the original text.
export function formatDateRange(text) {
  return parseDateRange(text) ?? text ?? "";
}

// True when there's text in the dates field that can't be read as dates.
export function isUnreadableDateRange(text) {
  return !!(text ?? "").trim() && parseDateRange(text) === null;
}

// A date or a date range -> the tidy style above, or null if not understood.
export function parseDateRange(text) {
  const original = text ?? "";
  if (!original.trim()) return null;

  // Split on a dash with spaces around it, an en/em dash, "to", "until" or
  // "through". A bare "-" is tried last because "2022-02" uses it too.
  let parts = original.split(/\s+-+\s+|\s*[–—]\s*|\s+(?:to|until|through|thru)\s+/i);
  if (parts.length === 1) {
    const single = formatDate(original);
    if (single) return single;
    parts = original.split("-");
  }
  if (parts.length !== 2) return null;

  const [start, end] = parts.map(formatDate);
  if (!start || !end || start === "Present") return null;
  return `${start} – ${end}`;
}
