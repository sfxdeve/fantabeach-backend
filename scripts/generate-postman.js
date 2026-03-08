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
  { key: "creditPackId", value: "", type: "default" },
  { key: "creditPackName", value: "Starter Pack", type: "default" },
  { key: "creditPackCredits", value: "100", type: "default" },
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

function rawJsonBody(raw) {
  return {
    mode: "raw",
    raw,
    options: {
      raw: {
        language: "json",
      },
    },
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
    item.request.body = body;
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
  "const fromEntity = res.championship && res.championship.id;",
  "if (fromEntity) {",
  "  pm.environment.set('championshipId', String(fromEntity));",
  "} else if (Array.isArray(res.items) && res.items.length > 0 && res.items[0].id) {",
  "  pm.environment.set('championshipId', String(res.items[0].id));",
  "}",
]);

const captureCreditPackEvent = eventScript([
  "let res = {};",
  "try { res = pm.response.json(); } catch (error) {}",
  "const fromEntity = res.pack && res.pack.id;",
  "if (fromEntity) {",
  "  pm.environment.set('creditPackId', String(fromEntity));",
  "} else if (Array.isArray(res.items) && res.items.length > 0 && res.items[0].id) {",
  "  pm.environment.set('creditPackId', String(res.items[0].id));",
  "}",
]);

const collection = {
  info: {
    name: "Fantabeach API",
    description:
      "Fantabeach backend API collection for the current Express service. Covers health checks, auth, championships, credits, and admin audit log flows.",
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
          body: rawJsonBody(
            '{\n  "name": "{{userName}}",\n  "email": "{{userEmail}}",\n  "password": "{{userPassword}}"\n}',
          ),
        }),
        request({
          name: "Verify Email",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/verify-email",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: rawJsonBody(
            '{\n  "email": "{{userEmail}}",\n  "code": "{{verificationCode}}"\n}',
          ),
        }),
        request({
          name: "Login (Admin)",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/login",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: rawJsonBody(
            '{\n  "email": "{{adminEmail}}",\n  "password": "{{adminPassword}}"\n}',
          ),
          event: captureSessionEvent,
        }),
        request({
          name: "Login (User)",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/login",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: rawJsonBody(
            '{\n  "email": "{{userEmail}}",\n  "password": "{{userPassword}}"\n}',
          ),
          event: captureSessionEvent,
        }),
        request({
          name: "Refresh Tokens",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/refresh",
          auth: bearerAuth("accessToken"),
          header: jsonHeader(),
          body: rawJsonBody('{\n  "refreshToken": "{{refreshToken}}"\n}'),
          event: captureSessionEvent,
        }),
        request({
          name: "Logout",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/logout",
          auth: bearerAuth("accessToken"),
          header: jsonHeader(),
          body: rawJsonBody('{\n  "sessionId": "{{sessionId}}"\n}'),
        }),
        request({
          name: "Forgot Password",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/forgot-password",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: rawJsonBody('{\n  "email": "{{userEmail}}"\n}'),
        }),
        request({
          name: "Reset Password",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/auth/reset-password",
          auth: NO_AUTH,
          header: jsonHeader(),
          body: rawJsonBody(
            '{\n  "email": "{{userEmail}}",\n  "code": "{{resetPasswordCode}}",\n  "password": "{{userPassword}}"\n}',
          ),
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
          body: rawJsonBody(
            '{\n  "name": "{{championshipName}}",\n  "gender": "{{championshipGender}}",\n  "seasonYear": {{championshipSeasonYear}}\n}',
          ),
          event: captureChampionshipEvent,
        }),
        request({
          name: "Update Championship",
          method: "PATCH",
          url: "{{baseUrl}}{{apiPrefix}}/championships/{{championshipId}}",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: rawJsonBody('{\n  "name": "{{updatedChampionshipName}}"\n}'),
          event: captureChampionshipEvent,
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
          body: rawJsonBody('{\n  "creditPackId": "{{creditPackId}}"\n}'),
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
          body: rawJsonBody(
            '{\n  "type": "checkout.session.completed",\n  "data": {\n    "object": {\n      "id": "cs_test_123",\n      "payment_status": "paid",\n      "metadata": {\n        "transactionRef": "replace-me"\n      }\n    }\n  }\n}',
          ),
          description:
            "Requires a real Stripe signature generated against the raw JSON body.",
        }),
        request({
          name: "Create Credit Pack",
          method: "POST",
          url: "{{baseUrl}}{{apiPrefix}}/credits/admin/packs",
          auth: bearerAuth("adminAccessToken"),
          header: jsonHeader(),
          body: rawJsonBody(
            '{\n  "name": "{{creditPackName}}",\n  "credits": {{creditPackCredits}},\n  "stripePriceId": "{{creditPackStripePriceId}}",\n  "isActive": true\n}',
          ),
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
          body: rawJsonBody(
            '{\n  "userId": "{{userId}}",\n  "amount": {{grantAmount}},\n  "reason": "{{grantReason}}"\n}',
          ),
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
