import { prisma } from "../prisma/index.js";
import {
  championshipSelector,
  fantasyTeamSelector,
  leagueSelector,
  tournamentSelector,
} from "../prisma/selectors.js";

/**
 * Round-robin schedule generation using the "circle method".
 * Returns an array of per-round matchup pairs (indices into the teams array).
 * If teams.length is odd, one team gets a bye each round (represented as null).
 */
function roundRobinPairings(
  count: number,
): Array<Array<[number, number | null]>> {
  const rounds: Array<Array<[number, number | null]>> = [];
  const teams = Array.from({ length: count }, (_, i) => i);

  const hasBye = count % 2 !== 0;
  if (hasBye) teams.push(null as unknown as number); // ghost for bye

  const n = teams.length; // always even
  const numRounds = n - 1;

  for (let r = 0; r < numRounds; r++) {
    const roundPairs: Array<[number, number | null]> = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i]!;
      const away = teams[n - 1 - i]!;
      if (home !== null && away !== null) {
        roundPairs.push([home as number, away as number]);
      } else if (home !== null) {
        roundPairs.push([home as number, null]); // bye
      } else if (away !== null) {
        roundPairs.push([away as number, null]); // bye
      }
    }
    rounds.push(roundPairs);

    // Rotate: keep teams[0] fixed, rotate the rest
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return rounds;
}

/**
 * Generate and persist H2HMatchup records for a league across all its tournaments.
 * Safe to call when the league is full or when the first tournament starts.
 * Existing matchups for the league are cleared and regenerated.
 */
export async function generateH2HSchedule(leagueId: string): Promise<void> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      ...leagueSelector,
      championship: { select: championshipSelector },
    },
  });

  if (!league) return;

  const [teams, tournaments] = await Promise.all([
    prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: fantasyTeamSelector,
      orderBy: { createdAt: "asc" },
    }),
    prisma.tournament.findMany({
      where: { championshipId: league.championship.id },
      select: tournamentSelector,
      orderBy: { startDate: "asc" },
    }),
  ]);

  if (teams.length < 2 || tournaments.length === 0) return;

  const teamIds = teams.map((t) => t.id);
  const rounds = roundRobinPairings(teamIds.length);

  // Delete existing matchups for this league before regenerating
  await prisma.h2HMatchup.deleteMany({ where: { leagueId } });

  const creates: NonNullable<
    Parameters<typeof prisma.h2HMatchup.createMany>[0]
  >["data"] = [];

  for (let t = 0; t < tournaments.length; t++) {
    const tournamentId = tournaments[t]!.id;
    const roundIndex = t % rounds.length;
    const pairs = rounds[roundIndex]!;

    for (const [homeIdx, awayIdx] of pairs) {
      if (awayIdx === null) continue; // bye — no matchup created
      creates.push({
        leagueId,
        tournamentId,
        homeTeamId: teamIds[homeIdx]!,
        awayTeamId: teamIds[awayIdx]!,
      });
    }
  }

  if (creates.length > 0) {
    await prisma.h2HMatchup.createMany({ data: creates });
  }
}
