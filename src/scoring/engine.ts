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
  isRetirement: boolean;
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

function computeBase(set1: number, set2: number): number {
  return Math.floor(set1 / 3) + Math.floor(set2 / 3);
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
  const baseA = computeBase(input.set1A, input.set2A);
  const baseB = computeBase(input.set1B, input.set2B);

  const isWinnerA = input.winnerPairId === "A";
  const bonus = winBonus(input.round);

  const retirementPenalty = input.isRetirement ? -2 : 0;

  const pairA: PairScore = {
    basePoints: baseA,
    bonusPoints: isWinnerA ? bonus : retirementPenalty,
    totalPoints: baseA + (isWinnerA ? bonus : retirementPenalty),
  };

  const pairB: PairScore = {
    basePoints: baseB,
    bonusPoints: isWinnerA ? retirementPenalty : bonus,
    totalPoints: baseB + (isWinnerA ? retirementPenalty : bonus),
  };

  return { pairA, pairB };
}
