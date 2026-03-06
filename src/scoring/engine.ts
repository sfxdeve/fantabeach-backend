import { MatchRound } from "../prisma/generated/enums.js";

export interface MatchScoreInput {
  round: MatchRound;
  set1A: number;
  set1B: number;
  set2A: number;
  set2B: number;
  set3A?: number;
  set3B?: number;
  winnerPairId: string;
}

export interface PairScore {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
}

export interface MatchPointsResult {
  pairA: PairScore;
  pairB: PairScore;
}

function computeBase(...sets: Array<number | undefined>): number {
  return sets.reduce<number>(
    (sum, setScore) => sum + Math.floor((setScore ?? 0) / 3),
    0,
  );
}

function winBonus(round: MatchRound): number {
  const base = 3;
  switch (round) {
    case MatchRound.QF:
      return base + 1;
    case MatchRound.SF:
      return base + 2;
    case MatchRound.FINAL:
      return base + 5;
    case MatchRound.THIRD_PLACE:
      return base + 2;
    default:
      return base;
  }
}

export function computeMatchPoints(input: MatchScoreInput): MatchPointsResult {
  const baseA = computeBase(input.set1A, input.set2A, input.set3A);
  const baseB = computeBase(input.set1B, input.set2B, input.set3B);

  const isWinnerA = input.winnerPairId === "A";
  const bonus = winBonus(input.round);

  const pairA: PairScore = {
    basePoints: baseA,
    bonusPoints: isWinnerA ? bonus : 0,
    totalPoints: baseA + (isWinnerA ? bonus : 0),
  };

  const pairB: PairScore = {
    basePoints: baseB,
    bonusPoints: isWinnerA ? 0 : bonus,
    totalPoints: baseB + (isWinnerA ? 0 : bonus),
  };

  return { pairA, pairB };
}
