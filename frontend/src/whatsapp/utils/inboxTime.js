// The backend stores message times as naive UTC ISO strings ("2026-10-12T11:00:00.123456", no "Z").
// `new Date()` reads an offset-less date-time as *local* time, which showed UTC clock times in IST.
const INBOX_TIME_ZONE = "Asia/Kolkata";
const _timeFmt = new Intl.DateTimeFormat([], { timeZone: INBOX_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const _dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: INBOX_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const _dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: INBOX_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });

// Parse a stored timestamp as UTC: naive ISO => UTC, "Z"/offset ISO as given, numbers as epoch s/ms. Invalid => null.
export function parseUtcTimestamp(value) {
    if (value === null || value === undefined || value === "") return null;
    let d;
    if (value instanceof Date) d = value;
    else if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
        const n = Number(value);
        d = new Date(n < 1e11 ? n * 1000 : n);
    } else {
        const str = String(value).trim();
        const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(str);
        d = new Date(!hasZone && /^\d{4}-\d{2}-\d{2}T/.test(str) ? `${str}Z` : str);
    }
    return isNaN(d.getTime()) ? null : d;
}

export const timestampMs = (value) => parseUtcTimestamp(value)?.getTime() || 0;

// Calendar day (YYYY-MM-DD) in the Inbox time zone, used for grouping and "Today"/"Yesterday".
export function inboxDayKey(value) {
    const d = parseUtcTimestamp(value);
    return d ? _dayKeyFmt.format(d) : "";
}

export function formatInboxTime(value) {
    const d = parseUtcTimestamp(value);
    return d ? _timeFmt.format(d) : "";
}

export function formatInboxDate(value, now = new Date()) {
    const d = parseUtcTimestamp(value);
    if (!d) return "";
    const key = _dayKeyFmt.format(d);
    if (key === _dayKeyFmt.format(now)) return "Today";
    if (key === _dayKeyFmt.format(new Date(now.getTime() - 86400000))) return "Yesterday";
    return _dateFmt.format(d);
}

// Conversation list: time for today's messages, otherwise the message date.
export function formatInboxListTime(value, now = new Date()) {
    const d = parseUtcTimestamp(value);
    if (!d) return "";
    return _dayKeyFmt.format(d) === _dayKeyFmt.format(now) ? _timeFmt.format(d) : formatInboxDate(d, now);
}
