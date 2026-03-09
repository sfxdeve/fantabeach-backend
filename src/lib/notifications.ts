import { sendEmail } from "./mailer.js";
import { logger } from "./logger.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function safeSend(
  email: string,
  subject: string,
  text: string,
): Promise<void> {
  try {
    await sendEmail(email, subject, text);
  } catch (err) {
    logger.error({ err, email, subject }, "notification email failed");
  }
}

// ─── Lineup Reminder ─────────────────────────────────────────────────────────

/**
 * Sent to a user who has not yet submitted a lineup before the lock fires.
 * Flow 4 Step 6.
 */
export async function sendLineupReminder(
  email: string,
  name: string,
  leagueName: string,
  lockAt: Date,
): Promise<void> {
  const subject = `FantaBeach — Set your lineup before ${fmt(lockAt)}`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your lineup for "${leagueName}" has not been set yet.`,
    `The lineup lock fires at ${fmt(lockAt)}.`,
    ``,
    `If you don't set a lineup before then, your most recent valid lineup will be used automatically. If you have no prior lineup, your starters will score zero points this week.`,
    ``,
    `Open the app now to set your lineup.`,
    ``,
    `— FantaBeach`,
  ].join("\n");

  await safeSend(email, subject, text);
}

// ─── Post-Tournament Summary ──────────────────────────────────────────────────

/**
 * Sent to every league member after a tournament completes.
 * Flow 6 Step 3.
 */
export async function sendTournamentSummary(
  email: string,
  name: string,
  leagueName: string,
  tournamentName: string,
  gameweekPts: number,
  rank: number,
): Promise<void> {
  const subject = `FantaBeach — ${tournamentName} results`;
  const text = [
    `Hi ${name},`,
    ``,
    `The ${tournamentName} is over. Here's how you did in "${leagueName}":`,
    ``,
    `  Fantasy points this week: ${gameweekPts}`,
    `  Current league position:  #${rank}`,
    ``,
    `Open the app to see the full standings and per-athlete breakdown.`,
    ``,
    `— FantaBeach`,
  ].join("\n");

  await safeSend(email, subject, text);
}

// ─── Lock Override Alert ──────────────────────────────────────────────────────

/**
 * Sent to all league members when an admin overrides the lineup lock time.
 * Flow 9 — Lineup Lock Override.
 */
export async function sendLockOverrideAlert(
  email: string,
  name: string,
  leagueName: string,
  newLockAt: Date,
): Promise<void> {
  const subject = `FantaBeach — Lineup lock time updated for "${leagueName}"`;
  const text = [
    `Hi ${name},`,
    ``,
    `The lineup lock time for "${leagueName}" has been updated by the admin.`,
    ``,
    `New lineup lock: ${fmt(newLockAt)}`,
    ``,
    `Please review your lineup before the new deadline.`,
    ``,
    `— FantaBeach`,
  ].join("\n");

  await safeSend(email, subject, text);
}
