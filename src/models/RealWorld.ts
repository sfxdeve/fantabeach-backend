import mongoose, { Document, Schema, Types } from "mongoose";
import {
  Gender,
  TournamentStatus,
  EntryStatus,
  MatchRound,
  MatchStatus,
} from "./enums.js";

export interface IChampionship extends Document {
  name: string;
  gender: Gender;
  seasonYear: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChampionshipSchema = new Schema<IChampionship>(
  {
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: Object.values(Gender), required: true },
    seasonYear: { type: Number, required: true },
  },
  { timestamps: true },
);

ChampionshipSchema.index({ gender: 1, seasonYear: 1 });
ChampionshipSchema.index(
  { name: 1, gender: 1, seasonYear: 1 },
  { unique: true },
);

export const Championship = mongoose.model<IChampionship>(
  "Championship",
  ChampionshipSchema,
);

export interface IAthlete extends Document {
  firstName: string;
  lastName: string;
  gender: Gender;
  championshipId: Types.ObjectId;
  pictureUrl?: string;
  entryPoints: number;
  globalPoints: number;
  averageFantasyScore: number;
  fantacoinCost: number;
  createdAt: Date;
  updatedAt: Date;
}

const AthleteSchema = new Schema<IAthlete>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    gender: { type: String, enum: Object.values(Gender), required: true },
    championshipId: {
      type: Schema.Types.ObjectId,
      ref: "Championship",
      required: true,
    },
    pictureUrl: { type: String },
    entryPoints: { type: Number, default: 0, min: 0 },
    globalPoints: { type: Number, default: 0, min: 0 },
    averageFantasyScore: { type: Number, default: 0 },
    fantacoinCost: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

AthleteSchema.index({ championshipId: 1 });
AthleteSchema.index({ championshipId: 1, gender: 1 });

export const Athlete = mongoose.model<IAthlete>("Athlete", AthleteSchema);

export interface ITournament extends Document {
  championshipId: Types.ObjectId;
  location: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  lineupLockAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TournamentSchema = new Schema<ITournament>(
  {
    championshipId: {
      type: Schema.Types.ObjectId,
      ref: "Championship",
      required: true,
    },
    location: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(TournamentStatus),
      default: TournamentStatus.UPCOMING,
    },
    lineupLockAt: { type: Date },
  },
  { timestamps: true },
);

TournamentSchema.index({ championshipId: 1, status: 1 });
TournamentSchema.index({ startDate: 1 });

export const Tournament = mongoose.model<ITournament>(
  "Tournament",
  TournamentSchema,
);

export interface ITournamentPair extends Document {
  tournamentId: Types.ObjectId;
  athleteAId: Types.ObjectId;
  athleteBId: Types.ObjectId;
  athleteIds: Types.ObjectId[];
  entryStatus: EntryStatus;
  seedRank?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TournamentPairSchema = new Schema<ITournamentPair>(
  {
    tournamentId: {
      type: Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
    },
    athleteAId: {
      type: Schema.Types.ObjectId,
      ref: "Athlete",
      required: true,
    },
    athleteBId: {
      type: Schema.Types.ObjectId,
      ref: "Athlete",
      required: true,
    },
    athleteIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Athlete",
        required: true,
      },
    ],
    entryStatus: {
      type: String,
      enum: Object.values(EntryStatus),
      required: true,
    },
    seedRank: { type: Number },
  },
  { timestamps: true },
);

TournamentPairSchema.index({ tournamentId: 1 });
TournamentPairSchema.index(
  { tournamentId: 1, athleteAId: 1, athleteBId: 1 },
  { unique: true },
);
TournamentPairSchema.index(
  { tournamentId: 1, athleteIds: 1 },
  { unique: true, sparse: true },
);

export const TournamentPair = mongoose.model<ITournamentPair>(
  "TournamentPair",
  TournamentPairSchema,
);

export interface IMatch extends Document {
  tournamentId: Types.ObjectId;
  round: MatchRound;
  pairAId: Types.ObjectId;
  pairBId: Types.ObjectId;
  scheduledAt?: Date;
  set1A?: number;
  set1B?: number;
  set2A?: number;
  set2B?: number;
  set3A?: number;
  set3B?: number;
  winnerPairId?: Types.ObjectId;
  status: MatchStatus;
  isRetirement: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    tournamentId: {
      type: Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
    },
    round: {
      type: String,
      enum: Object.values(MatchRound),
      required: true,
    },
    pairAId: {
      type: Schema.Types.ObjectId,
      ref: "TournamentPair",
      required: true,
    },
    pairBId: {
      type: Schema.Types.ObjectId,
      ref: "TournamentPair",
      required: true,
    },
    scheduledAt: { type: Date },
    set1A: { type: Number },
    set1B: { type: Number },
    set2A: { type: Number },
    set2B: { type: Number },
    set3A: { type: Number },
    set3B: { type: Number },
    winnerPairId: { type: Schema.Types.ObjectId, ref: "TournamentPair" },
    status: {
      type: String,
      enum: Object.values(MatchStatus),
      default: MatchStatus.SCHEDULED,
    },
    isRetirement: { type: Boolean, default: false },
  },
  { timestamps: true },
);

MatchSchema.index({ tournamentId: 1, round: 1 });
MatchSchema.index({ tournamentId: 1, status: 1 });

export const Match = mongoose.model<IMatch>("Match", MatchSchema);
