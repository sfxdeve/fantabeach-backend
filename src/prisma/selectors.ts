import type {
  UserSelect,
  SessionSelect,
  OtpSelect,
  AuditLogSelect,
  ChampionshipSelect,
  TournamentSelect,
  AthleteSelect,
  MatchSelect,
  AthleteMatchPointsSelect,
  LeagueSelect,
  LeagueMembershipSelect,
  FantasyTeamSelect,
  RosterEntrySelect,
  LineupSelect,
  LineupSlotSelect,
  GameweekStandingSelect,
  H2HMatchupSelect,
  WalletSelect,
  CreditPackSelect,
  CreditTransactionSelect,
} from "./generated/models.js";

// ─── User & Auth ──────────────────────────────────────────────────────────────

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

// ─── Real World ───────────────────────────────────────────────────────────────

export const championshipSelector = {
  id: true,
  name: true,
  gender: true,
  seasonYear: true,
  createdAt: true,
  updatedAt: true,
} satisfies ChampionshipSelect;

export const tournamentSelector = {
  id: true,
  status: true,
  lineupLockAt: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies TournamentSelect;

export const athleteSelector = {
  id: true,
  firstName: true,
  lastName: true,
  gender: true,
  rank: true,
  cost: true,
  createdAt: true,
  updatedAt: true,
} satisfies AthleteSelect;

export const matchSelector = {
  id: true,
  round: true,
  status: true,
  scheduledAt: true,
  set1A: true,
  set1B: true,
  set2A: true,
  set2B: true,
  set3A: true,
  set3B: true,
  winnerSide: true,
  createdAt: true,
  updatedAt: true,
} satisfies MatchSelect;

export const athleteMatchPointsSelector = {
  id: true,
  side: true,
  basePoints: true,
  bonusPoints: true,
  totalPoints: true,
  createdAt: true,
  updatedAt: true,
} satisfies AthleteMatchPointsSelect;

// ─── League & Fantasy ─────────────────────────────────────────────────────────

export const leagueSelector = {
  id: true,
  name: true,
  type: true,
  joinCode: true,
  rankingMode: true,
  isOpen: true,
  rosterSize: true,
  startersSize: true,
  budgetPerTeam: true,
  entryFeeCredits: true,
  prize1st: true,
  prize2nd: true,
  prize3rd: true,
  maxMembers: true,
  isMarketEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies LeagueSelect;

export const leagueMembershipSelector = {
  id: true,
  feePaid: true,
  createdAt: true,
  updatedAt: true,
} satisfies LeagueMembershipSelect;

export const fantasyTeamSelector = {
  id: true,
  name: true,
  fantacoinsRemaining: true,
  totalPoints: true,
  createdAt: true,
  updatedAt: true,
} satisfies FantasyTeamSelect;

export const rosterSelector = {
  id: true,
  purchasePrice: true,
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

export const h2hMatchupSelector = {
  id: true,
  homeOutcome: true,
  awayOutcome: true,
  createdAt: true,
  updatedAt: true,
} satisfies H2HMatchupSelect;

// ─── Wallet & Credits ─────────────────────────────────────────────────────────

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
  priceCents: true,
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
  newBalance: true,
  meta: true,
  createdAt: true,
  updatedAt: true,
} satisfies CreditTransactionSelect;
