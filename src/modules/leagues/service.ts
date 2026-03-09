import crypto from "node:crypto";
import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import {
  championshipSelector,
  auditLogSelector,
  creditTransactionSelector,
  fantasyTeamSelector,
  leagueMembershipSelector,
  leagueSelector,
  tournamentSelector,
  walletSelector,
} from "../../prisma/selectors.js";
import {
  CreditTransactionType,
  CreditTransactionSource,
} from "../../prisma/generated/enums.js";
import { generateH2HSchedule } from "../../lib/h2h.js";
import type {
  LeagueQueryType,
  LeagueParamsType,
  CreateLeagueBodyType,
  UpdateLeagueBodyType,
  JoinLeagueBodyType,
} from "./schema.js";

function generateJoinCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function listMine({
  userId,
  page,
  limit,
}: { userId: string } & LeagueQueryType) {
  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.league.findMany({
      where: { memberships: { some: { userId } } },
      select: leagueSelector,
      orderBy: { createdAt: "desc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.league.count({ where: { memberships: { some: { userId } } } }),
  ]);

  return {
    message: "My leagues fetched successfully",
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function list({ page, limit }: LeagueQueryType) {
  const options = paginationOptions({ page, limit });

  const [items, total] = await Promise.all([
    prisma.league.findMany({
      where: { type: "PUBLIC", isOpen: true },
      select: leagueSelector,
      orderBy: { createdAt: "desc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.league.count({ where: { type: "PUBLIC", isOpen: true } }),
  ]);

  return {
    message: "Leagues fetched successfully",
    meta: paginationMeta(total, { page, limit }),
    items,
  };
}

export async function getById({
  userId,
  id,
}: { userId: string } & LeagueParamsType) {
  const league = await prisma.league.findUnique({
    where: { id },
    select: leagueSelector,
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  // Private leagues are invisible to non-members
  if (league.type === "PRIVATE") {
    const membership = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId, leagueId: id } },
      select: leagueMembershipSelector,
    });
    if (!membership) {
      throw new AppError("NOT_FOUND", "League not found");
    }
  }

  return { message: "League fetched successfully", league };
}

export async function create({
  userId,
  isAdmin,
  ...data
}: { userId: string; isAdmin: boolean } & CreateLeagueBodyType) {
  // Validate type/role permissions
  if (data.type === "PUBLIC" && !isAdmin) {
    throw new AppError("FORBIDDEN", "Only admins can create public leagues");
  }

  // PUBLIC leagues must use OVERALL
  const rankingMode =
    data.type === "PUBLIC"
      ? "OVERALL"
      : ((data as { rankingMode?: string }).rankingMode ?? "OVERALL");

  // Ensure championship exists
  const championship = await prisma.championship.findUnique({
    where: { id: data.championshipId },
    select: championshipSelector,
  });

  if (!championship) {
    throw new AppError("NOT_FOUND", "Championship not found");
  }

  // Generate joinCode for private leagues; null for public
  let joinCode: string | null = null;
  if (data.type === "PRIVATE") {
    // Generate a unique code (retry on collision)
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateJoinCode();
      const existing = await prisma.league.findUnique({
        where: { joinCode: candidate },
        select: leagueSelector,
      });
      if (!existing) {
        joinCode = candidate;
        break;
      }
      attempts++;
    }
    if (!joinCode) {
      throw new AppError(
        "INTERNAL_SERVER_ERROR",
        "Failed to generate unique join code",
      );
    }
  }

  const { type, ...rest } = data as CreateLeagueBodyType & {
    rankingMode?: string;
  };
  const leagueData = {
    ...rest,
    type,
    rankingMode,
    joinCode,
    isOpen: true,
    createdById: userId,
  };

  const league = await prisma.league.create({
    // @ts-expect-error — dynamic spread; Prisma will validate fields
    data: leagueData,
    select: leagueSelector,
  });

  if (isAdmin) {
    await prisma.auditLog.create({
      data: {
        action: "CREATE_LEAGUE",
        entity: "League",
        entityId: league.id,
        before: {},
        after: league,
        adminId: userId,
      },
      select: auditLogSelector,
    });
  }

  return { message: "League created successfully", league };
}

export async function update({
  adminId,
  id,
  ...data
}: { adminId: string } & LeagueParamsType & UpdateLeagueBodyType) {
  const existing = await prisma.league.findUnique({
    where: { id },
    select: leagueSelector,
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  const league = await prisma.league.update({
    where: { id },
    data,
    select: leagueSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_LEAGUE",
      entity: "League",
      entityId: id,
      before: existing,
      after: league,
      adminId,
    },
    select: auditLogSelector,
  });

  return { message: "League updated successfully", league };
}

export async function join({
  userId,
  id: leagueId,
  joinCode,
  teamName,
}: { userId: string } & LeagueParamsType & JoinLeagueBodyType) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: leagueSelector,
  });

  if (!league) {
    throw new AppError("NOT_FOUND", "League not found");
  }

  if (!league.isOpen) {
    throw new AppError("BAD_REQUEST", "This league is no longer open");
  }

  // H2H leagues cannot be joined once any tournament has reached LOCKED or later.
  // The schedule is generated once at league start and must not be rebuilt mid-season.
  if (league.rankingMode === "HEAD_TO_HEAD") {
    const startedTournament = await prisma.tournament.findFirst({
      where: {
        championship: { leagues: { some: { id: leagueId } } },
        status: { in: ["LOCKED", "ONGOING", "COMPLETED"] },
      },
      select: tournamentSelector,
    });
    if (startedTournament) {
      throw new AppError(
        "BAD_REQUEST",
        "Cannot join a Head-to-Head league after the season has started",
      );
    }
  }

  // Private league requires join code
  if (league.type === "PRIVATE") {
    if (!joinCode || joinCode !== league.joinCode) {
      throw new AppError("FORBIDDEN", "Invalid join code");
    }
  }

  // Check max members
  if (league.maxMembers !== null) {
    const memberCount = await prisma.leagueMembership.count({
      where: { leagueId },
    });
    if (memberCount >= league.maxMembers) {
      throw new AppError("BAD_REQUEST", "League is full");
    }
  }

  // Check already joined
  const existingMembership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
    select: leagueMembershipSelector,
  });

  if (existingMembership) {
    throw new AppError("CONFLICT", "Already a member of this league");
  }

  // Handle entry fee
  const entryFee = league.entryFeeCredits ?? 0;
  let feePaid = entryFee === 0;

  const result = await prisma.$transaction(async (tx) => {
    if (entryFee > 0) {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: walletSelector,
      });

      if (!wallet) {
        throw new AppError("NOT_FOUND", "Wallet not found");
      }

      if (wallet.balance < entryFee) {
        throw new AppError(
          "BAD_REQUEST",
          "Insufficient credits. Please purchase more credits to join this league.",
        );
      }

      const newBalance = wallet.balance - entryFee;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: entryFee } },
        select: walletSelector,
      });

      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          type: CreditTransactionType.SPEND,
          source: CreditTransactionSource.SYSTEM,
          amount: entryFee,
          newBalance,
          meta: { leagueId, purpose: "entry_fee" },
        },
        select: creditTransactionSelector,
      });

      feePaid = true;
    }

    const membership = await tx.leagueMembership.create({
      data: { userId, leagueId, feePaid },
      select: leagueMembershipSelector,
    });

    const fantasyTeam = await tx.fantasyTeam.create({
      data: {
        userId,
        leagueId,
        name: teamName,
        fantacoinsRemaining: league.budgetPerTeam,
      },
      select: fantasyTeamSelector,
    });

    return { membership, fantasyTeam };
  });

  // If H2H league, regenerate schedule now that team count changed
  if (league.rankingMode === "HEAD_TO_HEAD") {
    await generateH2HSchedule(leagueId);
  }

  return {
    message: "Joined league successfully",
    membership: result.membership,
    fantasyTeam: result.fantasyTeam,
  };
}
