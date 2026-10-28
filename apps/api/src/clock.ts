/** Time is a dependency: token expiry, grace windows and "overdue" are all tested by moving it. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Today's calendar date in an IANA time zone, as `YYYY-MM-DD`. */
export function todayIn(timeZone: string, clock: Clock): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(clock.now());
}
