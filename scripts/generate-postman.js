import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const postmanDir = join(__dirname, "..", "postman");

const ENV_VARS = [
  { key: "baseUrl", value: "http://localhost:5555", type: "default" },
  { key: "apiPrefix", value: "/api/v1", type: "default" },
  { key: "accessToken", value: "", type: "secret" },
  { key: "refreshToken", value: "", type: "secret" },
  { key: "sessionId", value: "", type: "default" },
  { key: "adminAccessToken", value: "", type: "secret" },
  { key: "adminRefreshToken", value: "", type: "secret" },
  { key: "adminSessionId", value: "", type: "default" },
  { key: "userAccessToken", value: "", type: "secret" },
  { key: "userRefreshToken", value: "", type: "secret" },
  { key: "userSessionId", value: "", type: "default" },
  { key: "adminId", value: "", type: "default" },
  { key: "userId", value: "", type: "default" },
  { key: "targetUserId", value: "", type: "default" },
  { key: "adminEmail", value: "admin@fantabeach.io", type: "default" },
  {
    key: "adminPassword",
    value: "CHANGE_ME_IN_PRODUCTION",
    type: "secret",
  },
  { key: "userName", value: "Test User", type: "default" },
  { key: "userEmail", value: "user@example.com", type: "default" },
  { key: "userPassword", value: "password123", type: "secret" },
  { key: "verificationCode", value: "123456", type: "default" },
  { key: "resetPasswordCode", value: "123456", type: "default" },
  { key: "page", value: "1", type: "default" },
  { key: "limit", value: "20", type: "default" },
  { key: "championshipId", value: "", type: "default" },
  {
    key: "championshipName",
    value: "Elite Beach Tour 2026",
    type: "default",
  },
  { key: "championshipGender", value: "MALE", type: "default" },
  { key: "championshipSeasonYear", value: "2026", type: "default" },
  {
    key: "updatedChampionshipName",
    value: "Elite Beach Tour 2026 Updated",
    type: "default",
  },
  { key: "athleteId", value: "", type: "default" },
  { key: "athleteAId", value: "", type: "default" },
  { key: "athleteBId", value: "", type: "default" },
  { key: "athleteCId", value: "", type: "default" },
  { key: "athleteDId", value: "", type: "default" },
  { key: "athleteFirstName", value: "Alex", type: "default" },
  { key: "athleteLastName", value: "Stone", type: "default" },
  { key: "athleteRank", value: "1", type: "default" },
  { key: "updatedAthleteRank", value: "2", type: "default" },
  { key: "tournamentId", value: "", type: "default" },
  {
    key: "tournamentStartDate",
    value: "2026-06-01T09:00:00.000Z",
    type: "default",
  },
  {
    key: "tournamentEndDate",
    value: "2026-06-03T18:00:00.000Z",
    type: "default",
  },
  {
    key: "tournamentLineupLockAt",
    value: "2026-06-01T08:00:00.000Z",
    type: "default",
  },
  { key: "tournamentStatus", value: "REGISTRATION_OPEN", type: "default" },
  {
    key: "overrideLineupLockAt",
    value: "2026-06-01T07:30:00.000Z",
    type: "default",
  },
  { key: "lineupLockReason", value: "Manual override", type: "default" },
  { key: "matchId", value: "", type: "default" },
  { key: "matchRound", value: "POOL", type: "default" },
  {
    key: "matchScheduledAt",
    value: "2026-06-01T10:00:00.000Z",
    type: "default",
  },
  {
    key: "matchUpdatedAt",
    value: "2026-06-01T11:00:00.000Z",
    type: "default",
  },
  { key: "leagueId", value: "", type: "default" },
  { key: "privateLeagueName", value: "Weekend Warriors", type: "default" },
  { key: "publicLeagueName", value: "Fantabeach Open", type: "default" },
  {
    key: "updatedLeagueName",
    value: "Fantabeach Open Updated",
    type: "default",
  },
  { key: "leagueRosterSize", value: "4", type: "default" },
  { key: "leagueStartersSize", value: "2", type: "default" },
  { key: "leagueBudgetPerTeam", value: "300", type: "default" },
  { key: "leagueEntryFeeCredits", value: "0", type: "default" },
  { key: "leagueMaxMembers", value: "8", type: "default" },
  { key: "leagueJoinCode", value: "", type: "default" },
  { key: "fantasyTeamName", value: "Sandy Aces", type: "default" },
  { key: "creditPackId", value: "", type: "default" },
  { key: "creditPackName", value: "Starter Pack", type: "default" },
  { key: "creditPackCredits", value: "100", type: "default" },
  { key: "creditPackPriceCents", value: "999", type: "default" },
  {
    key: "creditPackStripePriceId",
    value: "price_1234567890",
    type: "default",
  },
  { key: "grantAmount", value: "25", type: "default" },
  { key: "grantReason", value: "Manual adjustment", type: "default" },
  { key: "auditEntity", value: "Wallet", type: "default" },
  {
    key: "auditFrom",
    value: "2026-01-01T00:00:00.000Z",
    type: "default",
  },
  {
    key: "auditTo",
    value: "2026-12-31T23:59:59.999Z",
    type: "default",
  },
  { key: "stripeSignature", value: "", type: "secret" },
];

const NO_AUTH = { type: "noauth" };

function bearerAuth(tokenVariable) {
  return {
    type: "bearer",
    bearer: [{ key: "token", value: `{{${tokenVariable}}}`, type: "string" }],
  };
}

function jsonHeader(extraHeaders = []) {
  return [{ key: "Content-Type", value: "application/json" }, ...extraHeaders];
}

function fileUploadBody() {
  return {
    mode: "formdata",
    formdata: [{ key: "file", type: "file", src: "" }],
  };
}

function request({
  name,
  method,
  url,
  auth,
  header,
  body,
  event,
  description,
}) {
  const item = {
    name,
    request: {
      method,
      url,
    },
  };

  if (description) {
    item.request.description = description;
  }

  if (auth) {
    item.request.auth = auth;
  }

  if (header) {
    item.request.header = header;
  }

  if (body) {
    if (typeof body === "string") {
      item.request.body = {
        mode: "raw",
        raw: body,
        options: { raw: { language: "json" } },
      };
    } else {
      item.request.body = body;
    }
  }

  if (event) {
    item.event = event;
  }

  return item;
}

function eventScript(exec) {
  return [
    {
      listen: "test",
      script: {
        type: "text/javascript",
        exec,
      },
    },
  ];
}

const captureSessionEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const accessToken = typeof res.accessToken === 'string' ? res.accessToken : '';",
  "const refreshToken = typeof res.refreshToken === 'string' ? res.refreshToken : '';",
  "if (refreshToken) pm.environment.set('refreshToken', refreshToken);",
  "if (accessToken) {",
  "  pm.environment.set('accessToken', accessToken);",
  "  const payload = decodeJwt(accessToken);",
  "  if (payload.sessionId) pm.environment.set('sessionId', String(payload.sessionId));",
  "  if (payload.role === 'ADMIN') {",
  "    pm.environment.set('adminAccessToken', accessToken);",
  "    if (refreshToken) pm.environment.set('adminRefreshToken', refreshToken);",
  "    if (payload.sessionId) pm.environment.set('adminSessionId', String(payload.sessionId));",
  "    if (payload.sub) pm.environment.set('adminId', String(payload.sub));",
  "  }",
  "  if (payload.role === 'USER') {",
  "    pm.environment.set('userAccessToken', accessToken);",
  "    if (refreshToken) pm.environment.set('userRefreshToken', refreshToken);",
  "    if (payload.sessionId) pm.environment.set('userSessionId', String(payload.sessionId));",
  "    if (payload.sub) pm.environment.set('userId', String(payload.sub));",
  "  }",
  "}",
  "function decodeJwt(token) {",
  "  try {",
  "    const parts = token.split('.');",
  "    if (parts.length < 2) return {};",
  "    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');",
  "    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);",
  "    return JSON.parse(atob(normalized + padding));",
  "  } catch (error) {",
  "    return {};",
  "  }",
  "}",
]);

const captureChampionshipEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const championship = res.championship || (Array.isArray(res.items) ? res.items[0] : null);",
  "if (championship && championship.id) pm.environment.set('championshipId', String(championship.id));",
]);

const captureCreditPackEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const pack = res.pack || (Array.isArray(res.items) ? res.items[0] : null);",
  "if (pack && pack.id) pm.environment.set('creditPackId', String(pack.id));",
]);

const captureLeagueEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const league = res.league || (Array.isArray(res.items) ? res.items[0] : null);",
  "if (league && league.id) pm.environment.set('leagueId', String(league.id));",
  "if (league && league.joinCode) pm.environment.set('leagueJoinCode', String(league.joinCode));",
]);

const captureTournamentEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const tournament = res.tournament || (Array.isArray(res.items) ? res.items[0] : null);",
  "if (tournament && tournament.id) pm.environment.set('tournamentId', String(tournament.id));",
]);

const captureAthleteEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const athlete = res.athlete || null;",
  "if (athlete && athlete.id) pm.environment.set('athleteId', String(athlete.id));",
  "const items = Array.isArray(res.items) ? res.items : [];",
  "if (items[0] && items[0].id) pm.environment.set('athleteAId', String(items[0].id));",
  "if (items[1] && items[1].id) pm.environment.set('athleteBId', String(items[1].id));",
  "if (items[2] && items[2].id) pm.environment.set('athleteCId', String(items[2].id));",
  "if (items[3] && items[3].id) pm.environment.set('athleteDId', String(items[3].id));",
]);

const captureMatchEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const match = res.match || (Array.isArray(res.items) ? res.items[0] : null);",
  "if (match && match.id) pm.environment.set('matchId', String(match.id));",
]);

const collection = {
  info: {
    name: "Fantabeach API",
    description:
      "Fantabeach backend API collection for the current Express service. Covers health, auth, championships, athletes, tournaments, matches, leagues, fantasy team flows, credits, and admin audit logs.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: bearerAuth("accessToken"),
  item: [
    {
      name: "Health",
      item: [
        request({
          name: "Health",
          method: "GET",
          url: "{{baseUrl}}/health",
          auth: NO_AUTH,
        }),
        request({
          name: "Ready",
          method: "GET",
          url: "{{baseUrl}}/ready",
          auth: NO_AUTH,
        }),
      ],
    },
    {
      name: "Auth",
      item: [
        request({
          name: "Register",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/register",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: '{\n  "name": "{{userName}}",\n  "email": "{{userEmail}}",\n  "password": "{{userPassword}}"\n}',
        }),
        request({
          name: "Verify Email",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/verify-email",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: '{\n  "email": "{{userEmail}}",\n  "code": "{{verificationCode}}"\n}',
        }),
        request({
          name: "Login (Admin)",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/login",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: '{\n  "email": "{{adminEmail}}",\n  "password": "{{adminPassword}}"\n}',
          event: captureSessionEvent,
        }),
        request({
          name: "Login (User)",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/login",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: '{\n  "email": "{{userEmail}}",\n  "password": "{{userPassword}}"\n}',
          event: captureSessionEvent,
        }),
        request({
          name: "Refresh Tokens",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/refresh",
          auth: bearerAuth("accessToken"),
          header: jsonHeader(),
          body: '{\n  "refreshToken": "{{refreshToken}}"\n}',
          event: captureSessionEvent,
        }),
        request({
          name: "Logout",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/logout",
          auth: bearerAuth("accessToken"),
          header: jsonHeader(),
          body: '{\n  "sessionId": "{{sessionId}}"\n}',
        }),
        request({
          name: "Forgot Password",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/forgot-password",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: '{\n  "email": "{{userEmail}}"\n}',
        }),
        request({
          name: "Reset Password",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/reset-password",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: '{\n  "email": "{{userEmail}}",\n  "code": "{{resetPasswordCode}}",\n  "password": "{{userPassword}}"\n}',
        }),
        request({
          name: "Get Me",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/auth/me",
          auth: bearerAuth("accessToken"),
        }),
      ],
    },
    {
      name: "Championships",
      item: [
        request({
          name: "List Championships",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/championships?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
          event: captureChampionshipEvent,
        }),
        request({
          name: "Get Championship",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/championships/{{championshipId}}",
          auth: bearerAuth("accessToken"),
          event: captureChampionshipEvent,
        }),
        request({
          name: "Create Championship",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/championships",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "name": "{{championshipName}}",\n  "gender": "{{championshipGender}}",\n  "seasonYear": {{championshipSeasonYear}}\n}',
          event: captureChampionshipEvent,
        }),
        request({
          name: "Update Championship",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/championships/{{championshipId}}",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "name": "{{updatedChampionshipName}}"\n}',
          event: captureChampionshipEvent,
        }),
        request({
          name: "Import Championships",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/championships/import",
          auth: bearerAuth("adminAccessToken"),
          body: fileUploadBody(),
          description:
            "Upload a .csv or .xlsx file. Upserts by name (case-insensitive) + gender + seasonYear.",
          event: captureChampionshipEvent,
        }),
      ],
    },
    {
      name: "Athletes",
      item: [
        request({
          name: "List Athletes By Championship",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/championships/{{championshipId}}/athletes?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
          event: captureAthleteEvent,
        }),
        request({
          name: "Create Athlete",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/athletes",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "firstName": "{{athleteFirstName}}",\n  "lastName": "{{athleteLastName}}",\n  "gender": "{{championshipGender}}",\n  "rank": {{athleteRank}},\n  "championshipId": "{{championshipId}}"\n}',
          event: captureAthleteEvent,
        }),
        request({
          name: "Update Athlete",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/athletes/{{athleteId}}",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "rank": {{updatedAthleteRank}}\n}',
          event: captureAthleteEvent,
        }),
        request({
          name: "Delete Athlete",
          method: "DELETE",
          url: "{{baseUrl}}{{apiPrefix}}/athletes/{{athleteId}}",
          auth: bearerAuth("adminAccessToken"),
        }),
        request({
          name: "Import Athletes",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/athletes/import",
          auth: bearerAuth("adminAccessToken"),
          body: fileUploadBody(),
          description:
            "Upload a .csv or .xlsx file. Upserts by championshipId + firstName + lastName (case-insensitive). Requires a championshipId column.",
          event: captureAthleteEvent,
        }),
      ],
    },
    {
      name: "Tournaments",
      item: [
        request({
          name: "List Tournaments By Championship",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/championships/{{championshipId}}/tournaments?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
          event: captureTournamentEvent,
        }),
        request({
          name: "Get Tournament",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/tournaments/{{tournamentId}}",
          auth: bearerAuth("accessToken"),
          event: captureTournamentEvent,
        }),
        request({
          name: "Create Tournament",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/tournaments",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "championshipId": "{{championshipId}}",\n  "startDate": "{{tournamentStartDate}}",\n  "endDate": "{{tournamentEndDate}}",\n  "lineupLockAt": "{{tournamentLineupLockAt}}"\n}',
          event: captureTournamentEvent,
        }),
        request({
          name: "Update Tournament",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/tournaments/{{tournamentId}}",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "status": "{{tournamentStatus}}"\n}',
          event: captureTournamentEvent,
        }),
        request({
          name: "Override Lineup Lock",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/tournaments/{{tournamentId}}/lineup-lock",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "lineupLockAt": "{{overrideLineupLockAt}}",\n  "reason": "{{lineupLockReason}}"\n}',
          event: captureTournamentEvent,
        }),
        request({
          name: "Import Tournaments",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/tournaments/import",
          auth: bearerAuth("adminAccessToken"),
          body: fileUploadBody(),
          description:
            "Upload a .csv or .xlsx file. Upserts by championshipId + startDate. Status is preserved on update if already live.",
          event: captureTournamentEvent,
        }),
      ],
    },
    {
      name: "Matches",
      item: [
        request({
          name: "List Matches By Tournament",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/tournaments/{{tournamentId}}/matches?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
          event: captureMatchEvent,
        }),
        request({
          name: "Get Match",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/matches/{{matchId}}",
          auth: bearerAuth("accessToken"),
          event: captureMatchEvent,
        }),
        request({
          name: "Create Match",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/matches",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "tournamentId": "{{tournamentId}}",\n  "round": "{{matchRound}}",\n  "scheduledAt": "{{matchScheduledAt}}",\n  "sideAAthlete1Id": "{{athleteAId}}",\n  "sideAAthlete2Id": "{{athleteBId}}",\n  "sideBAthlete1Id": "{{athleteCId}}",\n  "sideBAthlete2Id": "{{athleteDId}}"\n}',
          event: captureMatchEvent,
        }),
        request({
          name: "Update Match",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/matches/{{matchId}}",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "scheduledAt": "{{matchUpdatedAt}}"\n}',
          event: captureMatchEvent,
        }),
        request({
          name: "Enter Match Result",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/matches/{{matchId}}/result",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "set1A": 21,\n  "set1B": 18,\n  "set2A": 18,\n  "set2B": 21,\n  "set3A": 15,\n  "set3B": 13,\n  "winnerSide": "A"\n}',
          event: captureMatchEvent,
        }),
        request({
          name: "Import Matches",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/matches/import",
          auth: bearerAuth("adminAccessToken"),
          body: fileUploadBody(),
          description:
            "Upload a .csv or .xlsx file. Upserts by tournamentId + round + 4 athlete IDs. Include result columns (set1A, set1B, set2A, set2B, set3A, set3B, winnerSide) to trigger scoring automatically.",
          event: captureMatchEvent,
        }),
      ],
    },
    {
      name: "Leagues",
      item: [
        request({
          name: "List Leagues",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
          event: captureLeagueEvent,
        }),
        request({
          name: "My Leagues",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/mine?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
          event: captureLeagueEvent,
        }),
        request({
          name: "Get League",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}",
          auth: bearerAuth("accessToken"),
          event: captureLeagueEvent,
        }),
        request({
          name: "Create Private League",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/leagues",
          auth: bearerAuth("userAccessToken"),
          header: jsonHeader(),
          body: '{\n  "name": "{{privateLeagueName}}",\n  "championshipId": "{{championshipId}}",\n  "rosterSize": {{leagueRosterSize}},\n  "startersSize": {{leagueStartersSize}},\n  "budgetPerTeam": {{leagueBudgetPerTeam}},\n  "entryFeeCredits": {{leagueEntryFeeCredits}},\n  "maxMembers": {{leagueMaxMembers}},\n  "isMarketEnabled": false,\n  "type": "PRIVATE",\n  "rankingMode": "OVERALL"\n}',
          event: captureLeagueEvent,
        }),
        request({
          name: "Create Public League",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/leagues",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "name": "{{publicLeagueName}}",\n  "championshipId": "{{championshipId}}",\n  "rosterSize": {{leagueRosterSize}},\n  "startersSize": {{leagueStartersSize}},\n  "budgetPerTeam": {{leagueBudgetPerTeam}},\n  "entryFeeCredits": {{leagueEntryFeeCredits}},\n  "maxMembers": {{leagueMaxMembers}},\n  "isMarketEnabled": false,\n  "type": "PUBLIC"\n}',
          event: captureLeagueEvent,
        }),
        request({
          name: "Join League",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/join",
          auth: bearerAuth("userAccessToken"),
          header: jsonHeader(),
          body: '{\n  "joinCode": "{{leagueJoinCode}}",\n  "teamName": "{{fantasyTeamName}}"\n}',
        }),
        request({
          name: "Update League",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "name": "{{updatedLeagueName}}",\n  "isOpen": true\n}',
          event: captureLeagueEvent,
        }),
      ],
    },
    {
      name: "Fantasy Teams",
      item: [
        request({
          name: "Get My Team",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/my-team",
          auth: bearerAuth("userAccessToken"),
        }),
        request({
          name: "Save Roster",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/my-team/roster",
          auth: bearerAuth("userAccessToken"),
          header: jsonHeader(),
          body: '{\n  "athleteIds": [\n    "{{athleteAId}}",\n    "{{athleteBId}}",\n    "{{athleteCId}}",\n    "{{athleteDId}}"\n  ]\n}',
        }),
        request({
          name: "Get My Lineup",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/my-team/lineup/{{tournamentId}}",
          auth: bearerAuth("userAccessToken"),
        }),
        request({
          name: "Save Lineup",
          method: "PUT",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/my-team/lineup/{{tournamentId}}",
          auth: bearerAuth("userAccessToken"),
          header: jsonHeader(),
          body: '{\n  "slots": [\n    {\n      "athleteId": "{{athleteAId}}",\n      "role": "STARTER"\n    },\n    {\n      "athleteId": "{{athleteBId}}",\n      "role": "STARTER"\n    },\n    {\n      "athleteId": "{{athleteCId}}",\n      "role": "BENCH",\n      "benchOrder": 1\n    },\n    {\n      "athleteId": "{{athleteDId}}",\n      "role": "BENCH",\n      "benchOrder": 2\n    }\n  ]\n}',
        }),
      ],
    },
    {
      name: "Standings",
      item: [
        request({
          name: "Season Standings",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/standings?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
        }),
        request({
          name: "Gameweek Standings",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/standings/{{tournamentId}}?page={{page}}&limit={{limit}}",
          auth: bearerAuth("accessToken"),
        }),
        request({
          name: "H2H Schedule",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/leagues/{{leagueId}}/h2h-schedule",
          auth: bearerAuth("accessToken"),
        }),
      ],
    },
    {
      name: "Credits",
      item: [
        request({
          name: "List Credit Packs",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/credits/packs",
          auth: bearerAuth("accessToken"),
          event: captureCreditPackEvent,
        }),
        request({
          name: "Create Checkout Session",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/credits/checkout",
          auth: bearerAuth("userAccessToken"),
          header: jsonHeader(),
          body: '{\n  "creditPackId": "{{creditPackId}}"\n}',
        }),
        request({
          name: "Wallet",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/credits/wallet?page={{page}}&limit={{limit}}",
          auth: bearerAuth("userAccessToken"),
        }),
        request({
          name: "Stripe Webhook",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/credits/webhook",
          auth: NO_AUTH,
          header: jsonHeader([
            { key: "Stripe-Signature", value: "{{stripeSignature}}" },
          ]),
          body: '{\n  "type": "checkout.session.completed",\n  "data": {\n    "object": {\n      "id": "cs_test_123",\n      "payment_status": "paid",\n      "metadata": {\n        "transactionRef": "replace-me"\n      }\n    }\n  }\n}',
          description:
            "Requires a real Stripe signature generated against the raw JSON body.",
        }),
        request({
          name: "Create Credit Pack",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/credits/admin/packs",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "name": "{{creditPackName}}",\n  "credits": {{creditPackCredits}},\n  "priceCents": {{creditPackPriceCents}},\n  "stripePriceId": "{{creditPackStripePriceId}}",\n  "isActive": true\n}',
          event: captureCreditPackEvent,
        }),
        request({
          name: "Toggle Credit Pack",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/credits/admin/packs/{{creditPackId}}/toggle",
          auth: bearerAuth("adminAccessToken"),
          event: captureCreditPackEvent,
        }),
        request({
          name: "Grant Credits",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/credits/admin/grant",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "userId": "{{userId}}",\n  "amount": {{grantAmount}},\n  "reason": "{{grantReason}}"\n}',
        }),
      ],
    },
    {
      name: "Admin",
      item: [
        request({
          name: "Audit Logs",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/admin?entity={{auditEntity}}&from={{auditFrom}}&to={{auditTo}}&page={{page}}&limit={{limit}}",
          auth: bearerAuth("adminAccessToken"),
        }),
        request({
          name: "List Users",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/admin/users?page={{page}}&limit={{limit}}",
          auth: bearerAuth("adminAccessToken"),
          event: eventScript([
            "let res = {};",
            "try { res = pm.response.json(); } catch (error) {}",
            "const user = Array.isArray(res.items) ? res.items[0] : null;",
            "if (user && user.id) pm.environment.set('targetUserId', String(user.id));",
          ]),
        }),
        request({
          name: "Get User",
          method: "GET",
          url: "{{baseUrl}}{{apiPrefix}}/admin/users/{{targetUserId}}",
          auth: bearerAuth("adminAccessToken"),
        }),
        request({
          name: "Update User",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/admin/users/{{targetUserId}}",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: '{\n  "isBlocked": false\n}',
        }),
      ],
    },
  ],
};

const environment = {
  id: "fantabeach-local-env",
  name: "Fantabeach Local",
  values: ENV_VARS.map((entry) => ({
    key: entry.key,
    value: entry.value,
    type: entry.type,
    enabled: true,
  })),
  _postman_variable_scope: "environment",
};

mkdirSync(postmanDir, { recursive: true });

writeFileSync(
  join(postmanDir, "Fantabeach API.postman_collection.json"),
  `${JSON.stringify(collection, null, 2)}\n`,
);

writeFileSync(
  join(postmanDir, "Fantabeach Local.postman_environment.json"),
  `${JSON.stringify(environment, null, 2)}\n`,
);
