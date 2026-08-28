const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const DEFAULT_ALLOWED_ORIGIN = "https://september-survey.vercel.app";
const MAX_BODY_BYTES = 24_000;

const STUDENT_DAYS = [
  { id: "mon", label: "月曜日" },
  { id: "tue", label: "火曜日" },
  { id: "wed", label: "水曜日" },
  { id: "thu", label: "木曜日" },
  { id: "fri", label: "金曜日" },
];

const STUDENT_SLOTS = [
  { id: "19", time: "19:00-19:50" },
  { id: "20", time: "20:00-20:50" },
  { id: "21", time: "21:00-21:50" },
];

const TEACHER_DAYS = [
  { id: "mon", label: "月曜日", time: "19:00-22:00" },
  { id: "tue", label: "火曜日", time: "19:00-22:00" },
  { id: "wed", label: "水曜日", time: "19:00-22:00" },
  { id: "thu", label: "木曜日", time: "19:00-22:00" },
  { id: "fri", label: "金曜日", time: "19:00-22:00" },
  { id: "sat", label: "土曜日", time: "17:00-22:00" },
];

function envValue(env, name) {
  const value = env(name);
  return typeof value === "string" ? value.trim() : "";
}

function secretKey(env) {
  const rawKeys = envValue(env, "SUPABASE_SECRET_KEYS");
  if (rawKeys) {
    try {
      const keys = JSON.parse(rawKeys);
      if (typeof keys.default === "string" && keys.default) return keys.default;
    } catch {
      return "";
    }
  }
  return envValue(env, "SUPABASE_SERVICE_ROLE_KEY");
}

function adminHeaders(key, extra = {}) {
  const headers = {
    apikey: key,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function jsonResponse(origin, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestIp(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip") || "unknown";
}

function parseRows(responseText) {
  try {
    const value = JSON.parse(responseText);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function readJsonBody(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeStudentAvailability(value) {
  if (!Array.isArray(value) || value.length !== STUDENT_DAYS.length) return null;
  const normalized = [];
  for (const day of STUDENT_DAYS) {
    const matches = value.filter((row) => row?.day === day.id);
    if (matches.length !== 1 || !Array.isArray(matches[0].slots) || matches[0].slots.length !== STUDENT_SLOTS.length) return null;
    const slots = [];
    for (const slot of STUDENT_SLOTS) {
      const slotMatches = matches[0].slots.filter((row) => row?.slot === slot.id);
      if (slotMatches.length !== 1 || typeof slotMatches[0].available !== "boolean") return null;
      slots.push({ slot: slot.id, time: slot.time, available: slotMatches[0].available });
    }
    normalized.push({ day: day.id, label: day.label, slots });
  }
  return normalized.some((day) => day.slots.some((slot) => slot.available)) ? normalized : null;
}

function normalizeTeacherAvailability(value) {
  if (!Array.isArray(value) || value.length !== TEACHER_DAYS.length) return null;
  const normalized = [];
  for (const day of TEACHER_DAYS) {
    const matches = value.filter((row) => row?.day === day.id);
    if (matches.length !== 1 || typeof matches[0].available !== "boolean") return null;
    normalized.push({ day: day.id, label: day.label, time: day.time, available: matches[0].available });
  }
  return normalized.some((day) => day.available) ? normalized : null;
}

async function rateLimit(fetchImpl, supabaseUrl, headers, requestKey, maxRequests) {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/check_september_survey_rate_limit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_request_key: requestKey,
      p_max_requests: maxRequests,
      p_window_seconds: 600,
    }),
  });
  if (!response.ok) return null;
  try {
    return (await response.json()) === true;
  } catch {
    return null;
  }
}

async function loadProfile(fetchImpl, supabaseUrl, headers, tokenHash, now) {
  const tokenResponse = await fetchImpl(
    `${supabaseUrl}/rest/v1/september_survey_access_tokens?token_hash=eq.${tokenHash}&select=person_id,active,expires_at&limit=1`,
    { method: "GET", headers },
  );
  if (!tokenResponse.ok) return null;
  const tokenRows = parseRows(await tokenResponse.text());
  const access = tokenRows[0];
  if (!access?.active || !access.person_id) return null;
  const expiresAt = new Date(access.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return null;

  const personResponse = await fetchImpl(
    `${supabaseUrl}/rest/v1/september_survey_people?id=eq.${encodeURIComponent(access.person_id)}&active=eq.true&select=role,name,grade&limit=1`,
    { method: "GET", headers },
  );
  if (!personResponse.ok) return null;
  const personRows = parseRows(await personResponse.text());
  const person = personRows[0];
  if (!person || !["student", "teacher"].includes(person.role) || typeof person.name !== "string") return null;
  return {
    role: person.role,
    respondentName: person.name,
    grade: person.role === "student" ? person.grade ?? null : null,
  };
}

export function createHandler({ fetchImpl = fetch, env, now = () => new Date() }) {
  return async (request) => {
    const allowedOrigin = envValue(env, "SURVEY_ALLOWED_ORIGIN") || DEFAULT_ALLOWED_ORIGIN;
    const origin = request.headers.get("origin") || "";
    if (origin !== allowedOrigin) {
      return new Response(JSON.stringify({ message: "アクセスできません。" }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (!["GET", "POST"].includes(request.method)) return jsonResponse(origin, 405, { message: "アクセスできません。" });

    const supabaseUrl = envValue(env, "SUPABASE_URL");
    const key = secretKey(env);
    const pepper = envValue(env, "SURVEY_RATE_LIMIT_PEPPER");
    if (!supabaseUrl || !key || !pepper) return jsonResponse(origin, 500, { message: "現在利用できません。" });

    let body = null;
    let token = "";
    if (request.method === "GET") {
      token = new URL(request.url).searchParams.get("token")?.trim() || "";
    } else {
      body = await readJsonBody(request);
      token = typeof body?.token === "string" ? body.token.trim() : "";
    }
    if (!TOKEN_PATTERN.test(token)) return jsonResponse(origin, 404, { message: "この回答URLは利用できません。" });

    const tokenHash = await sha256Hex(token);
    const ipHash = await hmacHex(pepper, requestIp(request));
    const headers = adminHeaders(key);
    const ipAllowed = await rateLimit(fetchImpl, supabaseUrl, headers, `ip:${ipHash}`, 60);
    const tokenAllowed = await rateLimit(fetchImpl, supabaseUrl, headers, `token:${tokenHash}`, 15);
    if (ipAllowed === null || tokenAllowed === null) return jsonResponse(origin, 500, { message: "現在利用できません。" });
    if (!ipAllowed || !tokenAllowed) return jsonResponse(origin, 429, { message: "しばらく待ってからお試しください。" });

    const profile = await loadProfile(fetchImpl, supabaseUrl, headers, tokenHash, now());
    if (!profile) return jsonResponse(origin, 404, { message: "この回答URLは利用できません。" });
    if (request.method === "GET") return jsonResponse(origin, 200, { profile });

    const memo = typeof body.memo === "string" ? body.memo.trim() : "";
    if (memo.length > 1000) return jsonResponse(origin, 400, { message: "補足は1000文字以内で入力してください。" });
    const availability = profile.role === "student"
      ? normalizeStudentAvailability(body.availability)
      : normalizeTeacherAvailability(body.availability);
    if (!availability) return jsonResponse(origin, 400, { message: "回答内容を確認してください。" });

    const createdAt = now().toISOString();
    const submissionResponse = await fetchImpl(`${supabaseUrl}/rest/v1/september_survey_submissions`, {
      method: "POST",
      headers: adminHeaders(key, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        created_at: createdAt,
        role: profile.role,
        respondent_name: profile.respondentName,
        grade: profile.grade,
        availability,
        memo,
      }),
    });
    if (submissionResponse.status === 409) {
      return jsonResponse(origin, 409, { message: "回答済みです。変更が必要な場合は管理者へ連絡してください。" });
    }
    if (!submissionResponse.ok) return jsonResponse(origin, 500, { message: "送信できませんでした。" });
    return jsonResponse(origin, 201, { ok: true, createdAt });
  };
}
