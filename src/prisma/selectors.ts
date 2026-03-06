import type {
  AuditLogSelect,
  AthleteMatchPointsSelect,
  AthleteSelect,
  ChampionshipSelect,
  CreditPackSelect,
  CreditTransactionSelect,
  FantasyTeamSelect,
  GameweekStandingSelect,
  LeagueMembershipSelect,
  LeagueSelect,
  LineupSelect,
  LineupSlotSelect,
  MatchSelect,
  OtpSelect,
  RosterEntrySelect,
  SessionSelect,
  TournamentPairSelect,
  TournamentSelect,
  UserSelect,
  WalletSelect,
} from "./generated/models.js";

export const userSelector = {
  id: true,
  email: true,
  name: true,
  role: true,
  isVerified: true,
  isBlocked: true,
  createdAt: true,
  updatedAt: true,
} satisfies UserSelect;

export const userAuthSelector = {
  ...userSelector,
  passHash: true,
} satisfies UserSelect;

export const sessionSelector = {
  id: true,
  userAgent: true,
  isRevoked: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies SessionSelect;

export const otpSelector = {
  id: true,
  purpose: true,
  codeHash: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies OtpSelect;

export const auditLogSelector = {
  id: true,
  action: true,
  entity: true,
  entityId: true,
  before: true,
  after: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
} satisfies AuditLogSelect;

export const championshipSelector = {
  id: true,
  name: true,
  gender: true,
  seasonYear: true,
  createdAt: true,
  updatedAt: true,
} satisfies ChampionshipSelect;

export const athleteSelector = {
  id: true,
  firstName: true,
  lastName: true,
  gender: true,
  createdAt: true,
  updatedAt: true,
} satisfies AthleteSelect;

export const tournamentSelector = {
  id: true,
  status: true,
  lineupLockAt: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies TournamentSelect;

export const tournamentPairSelector = {
  id: true,
  entryStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies TournamentPairSelect;

export const matchSelector = {
  id: true,
  set1A: true,
  set1B: true,
  set2A: true,
  set2B: true,
  set3A: true,
  set3B: true,
  round: true,
  status: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies MatchSelect;

export const leagueSelector = {
  id: true,
  name: true,
  rosterSize: true,
  startersSize: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies LeagueSelect;

export const leagueMembershipSelector = {
  id: true,
  createdAt: true,
  updatedAt: true,
} satisfies LeagueMembershipSelect;

export const fantasyTeamSelector = {
  id: true,
  name: true,
  totalPoints: true,
  createdAt: true,
  updatedAt: true,
} satisfies FantasyTeamSelect;

export const rosterSelector = {
  id: true,
  acquiredAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies RosterEntrySelect;

export const lineupSelector = {
  id: true,
  lockedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies LineupSelect;

export const lineupSlotSelector = {
  id: true,
  role: true,
  benchOrder: true,
  isSubstitutedIn: true,
  pointsScored: true,
  createdAt: true,
  updatedAt: true,
} satisfies LineupSlotSelect;

export const gameweekStandingSelector = {
  id: true,
  gameweekPoints: true,
  cumulativePoints: true,
  rank: true,
  createdAt: true,
  updatedAt: true,
} satisfies GameweekStandingSelect;

export const walletSelector = {
  id: true,
  balance: true,
  createdAt: true,
  updatedAt: true,
} satisfies WalletSelect;

export const creditPackSelector = {
  id: true,
  name: true,
  credits: true,
  stripePriceId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies CreditPackSelect;

export const creditTransactionSelector = {
  id: true,
  type: true,
  source: true,
  amount: true,
  balanceAfter: true,
  meta: true,
  createdAt: true,
  updatedAt: true,
} satisfies CreditTransactionSelect;

export const athleteMatchPointsSelector = {
  id: true,
  basePoints: true,
  bonusPoints: true,
  totalPoints: true,
  createdAt: true,
  updatedAt: true,
} satisfies AthleteMatchPointsSelect;

export const modelSelectors = {
  User: userSelector,
  Session: sessionSelector,
  Otp: otpSelector,
  AdminAuditLog: auditLogSelector,
  Championship: championshipSelector,
  Athlete: athleteSelector,
  Tournament: tournamentSelector,
  TournamentPair: tournamentPairSelector,
  Match: matchSelector,
  League: leagueSelector,
  LeagueMembership: leagueMembershipSelector,
  FantasyTeam: fantasyTeamSelector,
  RosterEntry: rosterSelector,
  Lineup: lineupSelector,
  LineupSlot: lineupSlotSelector,
  GameweekStanding: gameweekStandingSelector,
  Wallet: walletSelector,
  CreditPack: creditPackSelector,
  CreditTransaction: creditTransactionSelector,
  AthleteMatchPoints: athleteMatchPointsSelector,
} as const;
