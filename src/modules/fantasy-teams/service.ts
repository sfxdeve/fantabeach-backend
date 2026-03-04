import {
  FantasyTeam,
  Roster,
  Lineup,
  LineupSlot,
  League,
  LeagueMembership,
} from "../../models/Fantasy.js";
import { Athlete, Championship, Tournament } from "../../models/RealWorld.js";
import { AppError } from "../../lib/errors.js";
import { withMongoTransaction } from "../../lib/tx.js";
import { LineupRole, TournamentStatus } from "../../models/enums.js";
import type {
  SubmitRosterBodyType,
  UpdateRosterBodyType,
  SubmitLineupBodyType,
} from "./schema.js";

async function getTeamOrThrow(leagueId: string, userId: string) {
  const team = await FantasyTeam.findOne({ leagueId, userId }).lean();

  if (!team) {
    throw new AppError(
      "NOT_FOUND",
      "Fantasy team not found. Join the league first.",
    );
  }

  return team;
}

export async function getTeam(leagueId: string, userId: string) {
  const team = await getTeamOrThrow(leagueId, userId);

  const roster = await Roster.find({ fantasyTeamId: team._id })
    .populate(
      "athleteId",
      "firstName lastName gender fantacoinCost averageFantasyScore pictureUrl",
    )
    .lean();

  return { team, roster };
}

export async function submitRoster(
  leagueId: string,
  userId: string,
  body: SubmitRosterBodyType,
) {
  const league = await League.findById(leagueId).lean();

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const team = await getTeamOrThrow(leagueId, userId);

  const existingCount = await Roster.countDocuments({
    fantasyTeamId: team._id,
  });

  if (existingCount > 0) {
    throw new AppError(
      "CONFLICT",
      "Roster already submitted. Use market window to change athletes.",
    );
  }

  if (body.athleteIds.length !== league.rosterSize) {
    throw new AppError(
      "UNPROCESSABLE",
      `Roster must have exactly ${league.rosterSize} athletes`,
    );
  }

  const unique = new Set(body.athleteIds);

  if (unique.size !== body.athleteIds.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in roster");
  }

  const athletes = await Athlete.find({ _id: { $in: body.athleteIds } }).lean();

  if (athletes.length !== body.athleteIds.length) {
    throw new AppError("NOT_FOUND", "One or more athletes not found");
  }

  for (const athlete of athletes) {
    if (String(athlete.championshipId) !== String(league.championshipId)) {
      throw new AppError(
        "UNPROCESSABLE",
        `Athlete ${athlete.firstName} ${athlete.lastName} does not belong to this league's championship`,
      );
    }
  }

  const championship = await Championship.findById(
    league.championshipId,
  ).lean();

  if (championship) {
    for (const athlete of athletes) {
      if (athlete.gender !== championship.gender) {
        throw new AppError(
          "UNPROCESSABLE",
          `Athlete ${athlete.firstName} ${athlete.lastName} gender does not match this league's championship gender`,
        );
      }
    }
  }

  const totalCost = athletes.reduce((sum, a) => sum + a.fantacoinCost, 0);

  if (totalCost > team.fantacoinsRemaining) {
    throw new AppError(
      "UNPROCESSABLE",
      `Total cost ${totalCost} exceeds budget ${team.fantacoinsRemaining}. Overspend: ${totalCost - team.fantacoinsRemaining}`,
    );
  }

  await withMongoTransaction(async (session) => {
    await FantasyTeam.updateOne(
      { _id: team._id },
      { $inc: { fantacoinsRemaining: -totalCost } },
      { session },
    );

    await Roster.insertMany(
      athletes.map((a) => ({
        fantasyTeamId: team._id,
        athleteId: a._id,
        purchasePrice: a.fantacoinCost,
        currentValue: a.fantacoinCost,
        acquiredAt: new Date(),
      })),
      { session },
    );
  });

  return { message: "Roster submitted successfully" };
}

export async function updateRoster(
  leagueId: string,
  userId: string,
  body: UpdateRosterBodyType,
) {
  const league = await League.findById(leagueId).lean();

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  if (!league.marketEnabled) {
    throw new AppError(
      "FORBIDDEN",
      "Market windows are not enabled for this league",
    );
  }

  const team = await getTeamOrThrow(leagueId, userId);

  const currentRoster = await Roster.find({ fantasyTeamId: team._id }).lean();
  const ownedAthleteIds = new Set(
    currentRoster.map((r) => String(r.athleteId)),
  );

  const sellSet = new Set(body.sell);
  const buySet = new Set(body.buy);

  if (sellSet.size !== body.sell.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in sell list");
  }

  if (buySet.size !== body.buy.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in buy list");
  }

  for (const athleteId of sellSet) {
    if (buySet.has(athleteId)) {
      throw new AppError(
        "BAD_REQUEST",
        `Athlete ${athleteId} cannot appear in both sell and buy lists`,
      );
    }
  }

  for (const athleteId of body.sell) {
    if (!ownedAthleteIds.has(athleteId)) {
      throw new AppError(
        "UNPROCESSABLE",
        `Cannot sell athlete ${athleteId}: not in roster`,
      );
    }
  }

  let buyCost = 0;

  if (body.buy.length > 0) {
    const championship = await Championship.findById(league.championshipId).lean();

    if (!championship) {
      throw new AppError("NOT_FOUND", "Championship not found");
    }

    for (const athleteId of body.buy) {
      if (ownedAthleteIds.has(athleteId)) {
        throw new AppError(
          "UNPROCESSABLE",
          `Athlete ${athleteId} is already in your roster`,
        );
      }
    }

    const buyAthletes = await Athlete.find({ _id: { $in: body.buy } }).lean();

    if (buyAthletes.length !== body.buy.length) {
      throw new AppError("NOT_FOUND", "One or more athletes to buy not found");
    }

    for (const a of buyAthletes) {
      if (String(a.championshipId) !== String(league.championshipId)) {
        throw new AppError(
          "UNPROCESSABLE",
          `Athlete not in league's championship`,
        );
      }

      if (a.gender !== championship.gender) {
        throw new AppError(
          "UNPROCESSABLE",
          `Athlete ${a.firstName} ${a.lastName} gender does not match this league's championship gender`,
        );
      }
    }

    buyCost = buyAthletes.reduce((sum, a) => sum + a.fantacoinCost, 0);
  }

  const sellProceeds = currentRoster
    .filter((r) => body.sell.includes(String(r.athleteId)))
    .reduce((sum, r) => sum + r.currentValue, 0);

  const netCost = buyCost - sellProceeds;

  if (team.fantacoinsRemaining - netCost < 0) {
    throw new AppError(
      "UNPROCESSABLE",
      `Insufficient budget. Net cost: ${netCost}, available: ${team.fantacoinsRemaining}`,
    );
  }

  const newRosterSize =
    currentRoster.length - body.sell.length + body.buy.length;

  if (newRosterSize !== league.rosterSize) {
    throw new AppError(
      "UNPROCESSABLE",
      `Resulting roster size ${newRosterSize} must equal ${league.rosterSize}`,
    );
  }

  await withMongoTransaction(async (session) => {
    if (body.sell.length > 0) {
      await Roster.deleteMany(
        { fantasyTeamId: team._id, athleteId: { $in: body.sell } },
        { session },
      );
    }

    if (body.buy.length > 0) {
      const buyAthletes = await Athlete.find({ _id: { $in: body.buy } }).lean();

      await Roster.insertMany(
        buyAthletes.map((a) => ({
          fantasyTeamId: team._id,
          athleteId: a._id,
          purchasePrice: a.fantacoinCost,
          currentValue: a.fantacoinCost,
          acquiredAt: new Date(),
        })),
        { session },
      );
    }

    await FantasyTeam.updateOne(
      { _id: team._id },
      { $inc: { fantacoinsRemaining: -netCost } },
      { session },
    );
  });

  return { message: "Roster updated successfully" };
}

export async function getLineup(
  leagueId: string,
  userId: string,
  tournamentId: string,
) {
  const team = await getTeamOrThrow(leagueId, userId);

  const lineup = await Lineup.findOne({
    fantasyTeamId: team._id,
    tournamentId,
  }).lean();

  if (!lineup) {
    return { lineup: null, slots: [] };
  }

  const slots = await LineupSlot.find({ lineupId: lineup._id })
    .populate(
      "athleteId",
      "firstName lastName fantacoinCost averageFantasyScore pictureUrl",
    )
    .lean();

  return { lineup, slots };
}

export async function submitLineup(
  leagueId: string,
  userId: string,
  tournamentId: string,
  body: SubmitLineupBodyType,
) {
  const league = await League.findById(leagueId).lean();

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const team = await getTeamOrThrow(leagueId, userId);

  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new AppError("NOT_FOUND", "Tournament not found");
  }

  if (String(league.championshipId) !== String(tournament.championshipId)) {
    throw new AppError(
      "UNPROCESSABLE",
      "Tournament does not belong to this league's championship",
    );
  }

  if (
    tournament.status === TournamentStatus.LOCKED ||
    tournament.status === TournamentStatus.ONGOING ||
    tournament.status === TournamentStatus.COMPLETED
  ) {
    throw new AppError(
      "CONFLICT",
      "Cannot submit lineup — tournament lineup has been locked",
    );
  }

  const existingLineup = await Lineup.findOne({
    fantasyTeamId: team._id,
    tournamentId,
  }).lean();

  if (existingLineup?.isLocked) {
    throw new AppError(
      "CONFLICT",
      "Lineup is locked. No changes allowed after Thursday lock.",
    );
  }

  const starters = body.slots.filter((s) => s.role === LineupRole.STARTER);
  const bench = body.slots.filter((s) => s.role === LineupRole.BENCH);

  const selectedAthleteIds = body.slots.map((s) => s.athleteId);

  if (new Set(selectedAthleteIds).size !== selectedAthleteIds.length) {
    throw new AppError("BAD_REQUEST", "Duplicate athletes in lineup slots");
  }

  if (starters.length !== league.startersPerGameweek) {
    throw new AppError(
      "UNPROCESSABLE",
      `Must have exactly ${league.startersPerGameweek} starters`,
    );
  }

  const expectedBench = league.rosterSize - league.startersPerGameweek;

  if (bench.length !== expectedBench) {
    throw new AppError(
      "UNPROCESSABLE",
      `Must have exactly ${expectedBench} bench athletes`,
    );
  }

  const benchOrderSet = new Set<number>();

  for (const slot of bench) {
    if (slot.benchOrder == null) {
      throw new AppError(
        "UNPROCESSABLE",
        "Each bench athlete must include a benchOrder",
      );
    }

    if (benchOrderSet.has(slot.benchOrder)) {
      throw new AppError(
        "BAD_REQUEST",
        "Duplicate benchOrder values in lineup",
      );
    }
    benchOrderSet.add(slot.benchOrder);
  }

  const roster = await Roster.find({ fantasyTeamId: team._id }).lean();

  const ownedIds = new Set(roster.map((r) => String(r.athleteId)));

  for (const slot of body.slots) {
    if (!ownedIds.has(slot.athleteId)) {
      throw new AppError(
        "UNPROCESSABLE",
        `Athlete ${slot.athleteId} is not in your roster`,
      );
    }
  }

  const lineup = await Lineup.findOneAndUpdate(
    { fantasyTeamId: team._id, tournamentId },
    {
      fantasyTeamId: team._id,
      tournamentId,
      isLocked: false,
      autoGenerated: false,
    },
    { upsert: true, new: true },
  );

  await LineupSlot.deleteMany({ lineupId: lineup._id });

  await LineupSlot.insertMany(
    body.slots.map((s) => ({
      lineupId: lineup._id,
      athleteId: s.athleteId,
      role: s.role,
      benchOrder: s.benchOrder,
      substitutedIn: false,
      pointsScored: 0,
    })),
  );

  return { message: "Lineup submitted successfully" };
}
