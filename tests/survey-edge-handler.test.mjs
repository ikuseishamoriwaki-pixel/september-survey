import assert from "node:assert/strict";
import test from "node:test";
import { createHandler, sha256Hex } from "../supabase/functions/september-survey-response/handler.js";

const origin = "https://september-survey.vercel.app";
const token = "a".repeat(64);
const now = new Date("2026-08-28T08:00:00.000Z");

function env(name) {
  const values = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_test" }),
    SURVEY_RATE_LIMIT_PEPPER: "test-pepper-not-for-production",
    SURVEY_ALLOWED_ORIGIN: origin,
  };
  return values[name];
}

function studentAvailability() {
  return ["mon", "tue", "wed", "thu", "fri"].map((day) => ({
    day,
    slots: ["19", "20", "21"].map((slot) => ({ slot, available: true })),
  }));
}

function teacherAvailability() {
  return ["mon", "tue", "wed", "thu", "fri", "sat"].map((day) => ({
    day,
    available: day !== "wed",
  }));
}

async function createMock({
  expired = false,
  duplicate = false,
  rateAllowed = true,
  profile = { role: "student", name: "合成テスト", grade: "中1" },
} = {}) {
  const tokenHash = await sha256Hex(token);
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/rpc/check_september_survey_rate_limit")) {
      return Response.json(rateAllowed);
    }
    if (String(url).includes("/september_survey_access_tokens")) {
      assert.match(String(url), new RegExp(tokenHash));
      return Response.json([{
        person_id: 42,
        active: true,
        expires_at: expired ? "2026-08-27T00:00:00.000Z" : "2026-10-01T00:00:00.000Z",
      }]);
    }
    if (String(url).includes("/september_survey_people")) {
      return Response.json([profile]);
    }
    if (String(url).includes("/september_survey_submissions")) {
      return new Response(null, { status: duplicate ? 409 : 201 });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  return { fetchImpl, calls };
}

function request(url, init = {}) {
  return new Request(url, {
    ...init,
    headers: {
      Origin: origin,
      "X-Forwarded-For": "192.0.2.10",
      ...(init.headers || {}),
    },
  });
}

test("valid token returns only the matching profile", async () => {
  const mock = await createMock();
  const handler = createHandler({ fetchImpl: mock.fetchImpl, env, now: () => now });
  const response = await handler(request(`https://function.test/?token=${token}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    profile: { role: "student", respondentName: "合成テスト", grade: "中1" },
  });
});

test("missing and expired tokens do not reveal a profile", async () => {
  const missingMock = await createMock();
  const missingHandler = createHandler({ fetchImpl: missingMock.fetchImpl, env, now: () => now });
  assert.equal((await missingHandler(request("https://function.test/"))).status, 404);

  const expiredMock = await createMock({ expired: true });
  const expiredHandler = createHandler({ fetchImpl: expiredMock.fetchImpl, env, now: () => now });
  assert.equal((await expiredHandler(request(`https://function.test/?token=${token}`))).status, 404);
});

test("submission identity is derived from the token profile", async () => {
  const mock = await createMock();
  const handler = createHandler({ fetchImpl: mock.fetchImpl, env, now: () => now });
  const response = await handler(request("https://function.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      role: "teacher",
      respondent_name: "別人",
      availability: studentAvailability(),
      memo: "合成メモ",
    }),
  }));
  assert.equal(response.status, 201);
  const submissionCall = mock.calls.find((call) => call.url.includes("/september_survey_submissions"));
  const saved = JSON.parse(submissionCall.options.body);
  assert.equal(saved.role, "student");
  assert.equal(saved.respondent_name, "合成テスト");
  assert.equal(saved.grade, "中1");
  assert.equal(saved.memo, "合成メモ");
  assert.equal(saved.token, undefined);
});

test("teacher token accepts only the teacher availability shape", async () => {
  const mock = await createMock({ profile: { role: "teacher", name: "合成講師", grade: null } });
  const handler = createHandler({ fetchImpl: mock.fetchImpl, env, now: () => now });
  const response = await handler(request("https://function.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, availability: teacherAvailability(), memo: "" }),
  }));
  assert.equal(response.status, 201);
  const submissionCall = mock.calls.find((call) => call.url.includes("/september_survey_submissions"));
  const saved = JSON.parse(submissionCall.options.body);
  assert.equal(saved.role, "teacher");
  assert.equal(saved.respondent_name, "合成講師");
  assert.equal(saved.grade, null);
  assert.equal(saved.availability.length, 6);
});

test("duplicate submission preserves the existing answer", async () => {
  const mock = await createMock({ duplicate: true });
  const handler = createHandler({ fetchImpl: mock.fetchImpl, env, now: () => now });
  const response = await handler(request("https://function.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, availability: studentAvailability(), memo: "" }),
  }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /回答済み/);
});

test("invalid origin, malformed answers, and rate limits are rejected", async () => {
  const originMock = await createMock();
  const originHandler = createHandler({ fetchImpl: originMock.fetchImpl, env, now: () => now });
  const originResponse = await originHandler(new Request(`https://function.test/?token=${token}`, {
    headers: { Origin: "https://attacker.example" },
  }));
  assert.equal(originResponse.status, 403);
  assert.equal(originMock.calls.length, 0);

  const answerMock = await createMock();
  const answerHandler = createHandler({ fetchImpl: answerMock.fetchImpl, env, now: () => now });
  const answerResponse = await answerHandler(request("https://function.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, availability: [], memo: "" }),
  }));
  assert.equal(answerResponse.status, 400);
  assert.equal(answerMock.calls.some((call) => call.url.includes("/september_survey_submissions")), false);

  const rateMock = await createMock({ rateAllowed: false });
  const rateHandler = createHandler({ fetchImpl: rateMock.fetchImpl, env, now: () => now });
  const rateResponse = await rateHandler(request(`https://function.test/?token=${token}`));
  assert.equal(rateResponse.status, 429);
});
