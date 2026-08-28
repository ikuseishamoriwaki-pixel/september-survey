const SUPABASE = {
  url: "https://dlymqxjxandoxponairu.supabase.co",
  functionName: "september-survey-response",
};

const weekdays = [
  { id: "mon", label: "月曜日" },
  { id: "tue", label: "火曜日" },
  { id: "wed", label: "水曜日" },
  { id: "thu", label: "木曜日" },
  { id: "fri", label: "金曜日" },
];

const teacherDays = [
  { id: "mon", label: "月曜日", time: "19:00-22:00" },
  { id: "tue", label: "火曜日", time: "19:00-22:00" },
  { id: "wed", label: "水曜日", time: "19:00-22:00" },
  { id: "thu", label: "木曜日", time: "19:00-22:00" },
  { id: "fri", label: "金曜日", time: "19:00-22:00" },
  { id: "sat", label: "土曜日", time: "17:00-22:00" },
];

const studentSlots = [
  { id: "19", label: "19:00-19:50" },
  { id: "20", label: "20:00-20:50" },
  { id: "21", label: "21:00-21:50" },
];

const localSubmissionPrefix = "septemberSurveySubmission";
const sessionTokenKey = "septemberSurveyAccessToken";
const tokenPattern = /^[a-f0-9]{64}$/i;

const pageLeads = {
  student: "最初はすべて〇にしています。来れない日時に×をして提出してください。よろしくお願いします。",
  teacher: "9月からの勤務日時を決めるため、来れる日時をタップして提出をお願いします。期限は8/16（日）までです。もし期限内の提出が厳しければお知らせください。",
};

const state = {
  page: null,
  profile: null,
  token: "",
  tokenStorageKey: "",
  student: new Set(),
  teacher: new Set(),
};

const elements = {
  pageLead: document.querySelector("#pageLead"),
  accessState: document.querySelector("#accessState"),
  accessTitle: document.querySelector("#accessTitle"),
  accessMessage: document.querySelector("#accessMessage"),
  views: [...document.querySelectorAll(".view")],
  status: document.querySelector("#statusMessage"),
  studentForm: document.querySelector("#studentForm"),
  teacherForm: document.querySelector("#teacherForm"),
  studentIdentityName: document.querySelector("#studentIdentityName"),
  studentIdentityGrade: document.querySelector("#studentIdentityGrade"),
  teacherIdentityName: document.querySelector("#teacherIdentityName"),
  studentGrid: document.querySelector("#studentGrid"),
  teacherGrid: document.querySelector("#teacherGrid"),
  studentReview: document.querySelector("#studentReview"),
  teacherReview: document.querySelector("#teacherReview"),
};

function functionUrl(query = "") {
  return `${SUPABASE.url}/functions/v1/${SUPABASE.functionName}${query}`;
}

function showStatus(message, type = "ok") {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
}

function showAccessState(title, message, type = "") {
  elements.accessState.hidden = false;
  elements.accessState.className = `panel access-state ${type}`.trim();
  elements.accessTitle.textContent = title;
  elements.accessMessage.textContent = message;
  elements.views.forEach((panel) => panel.classList.remove("active"));
  elements.pageLead.textContent = "専用の回答URLを確認しています。";
}

function showPage(page) {
  state.page = page;
  document.body.dataset.page = page;
  elements.accessState.hidden = true;
  elements.views.forEach((panel) => panel.classList.toggle("active", panel.id === `${page}View`));
  elements.pageLead.textContent = pageLeads[page];
  showStatus("");
}

function renderStudentGrid() {
  const cells = [
    '<div class="head">時間</div>',
    ...weekdays.map((day) => `<div class="head">${day.label.replace("曜日", "")}</div>`),
  ];

  for (const slot of studentSlots) {
    cells.push(`<div class="time">${slot.label}</div>`);
    for (const day of weekdays) {
      const key = `${day.id}_${slot.id}`;
      const available = state.student.has(key);
      cells.push(`<button class="slot ${available ? "selected" : "unavailable"}" type="button" data-student-slot="${key}">${available ? "〇" : "×"}</button>`);
    }
  }

  elements.studentGrid.innerHTML = cells.join("");
}

function allStudentSlotKeys() {
  return weekdays.flatMap((day) => studentSlots.map((slot) => `${day.id}_${slot.id}`));
}

function selectAllStudentSlots() {
  state.student = new Set(allStudentSlotKeys());
}

function renderTeacherGrid() {
  elements.teacherGrid.innerHTML = teacherDays.map((day) => `
    <button class="${state.teacher.has(day.id) ? "selected" : ""}" type="button" data-teacher-day="${day.id}">
      <span>${day.label}</span>
      <small>${day.time}</small>
      <strong>${state.teacher.has(day.id) ? "〇" : ""}</strong>
    </button>
  `).join("");
}

function buildStudentAvailability() {
  return weekdays.map((day) => ({
    day: day.id,
    label: day.label,
    slots: studentSlots.map((slot) => ({
      slot: slot.id,
      time: slot.label,
      available: state.student.has(`${day.id}_${slot.id}`),
    })),
  }));
}

function buildTeacherAvailability() {
  return teacherDays.map((day) => ({
    day: day.id,
    label: day.label,
    time: day.time,
    available: state.teacher.has(day.id),
  }));
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchProfile(token) {
  const response = await fetch(functionUrl(`?token=${encodeURIComponent(token)}`), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("この回答URLは無効か、期限が切れています。管理者へ連絡してください。");
  const data = await response.json();
  return data.profile;
}

async function submitSurvey(availability, memo) {
  const response = await fetch(functionUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token: state.token, availability, memo }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 409) {
    throw new Error("回答済みです。変更が必要な場合は管理者へ連絡してください。");
  }
  if (!response.ok) throw new Error(data.message || "時間をおいて、もう一度お試しください。");
  return data;
}

function formatAvailability(row) {
  const availability = row.availability ?? [];
  if (row.role === "teacher") {
    return availability.filter((day) => day.available).map((day) => `${day.label} ${day.time}`).join(" / ");
  }
  return availability.map((day) => {
    const slots = day.slots.filter((slot) => slot.available).map((slot) => slot.time);
    return slots.length ? `${day.label}: ${slots.join(", ")}` : "";
  }).filter(Boolean).join(" / ");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function tokenSubmissionKey() {
  return `${localSubmissionPrefix}:token:${state.tokenStorageKey}`;
}

function legacySubmissionKey() {
  return `${localSubmissionPrefix}:${state.profile.role}:${state.profile.respondentName}`;
}

function saveLocalSubmission(submission) {
  try {
    localStorage.setItem(tokenSubmissionKey(), JSON.stringify(submission));
  } catch {
    // Local answer review is optional; the server submission has already succeeded.
  }
}

function readLocalSubmission() {
  try {
    const current = localStorage.getItem(tokenSubmissionKey());
    if (current) return JSON.parse(current);
    const legacy = localStorage.getItem(legacySubmissionKey());
    return legacy ? JSON.parse(legacy) : null;
  } catch {
    return null;
  }
}

function renderOwnAnswer(role, submission) {
  const element = role === "student" ? elements.studentReview : elements.teacherReview;
  if (!submission) {
    element.innerHTML = "";
    return;
  }
  element.innerHTML = `
    <div class="own-answer-title">前回送信した内容</div>
    <table>
      <tbody>
        <tr><th>回答日時</th><td>${formatDate(submission.created_at)}</td></tr>
        <tr><th>可能日時</th><td>${escapeHtml(formatAvailability(submission) || "なし")}</td></tr>
        <tr><th>補足</th><td>${escapeHtml(submission.memo ?? "")}</td></tr>
      </tbody>
    </table>
  `;
}

function applyStudentSubmission(submission) {
  state.student = new Set(
    (submission.availability ?? []).flatMap((day) =>
      (day.slots ?? []).filter((slot) => slot.available).map((slot) => `${day.day}_${slot.slot}`)
    )
  );
  document.querySelector("#studentMemo").value = submission.memo ?? "";
  renderStudentGrid();
}

function applyTeacherSubmission(submission) {
  state.teacher = new Set(
    (submission.availability ?? []).filter((day) => day.available).map((day) => day.day)
  );
  document.querySelector("#teacherMemo").value = submission.memo ?? "";
  renderTeacherGrid();
}

function renderProfile(profile) {
  if (profile.role === "student") {
    elements.studentIdentityName.textContent = profile.respondentName;
    elements.studentIdentityGrade.textContent = profile.grade || "学年未設定";
  } else {
    elements.teacherIdentityName.textContent = profile.respondentName;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.studentGrid.addEventListener("click", (event) => {
  const key = event.target.dataset.studentSlot;
  if (!key) return;
  if (state.student.has(key)) state.student.delete(key);
  else state.student.add(key);
  renderStudentGrid();
});

elements.teacherGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-teacher-day]");
  if (!button) return;
  const key = button.dataset.teacherDay;
  if (state.teacher.has(key)) state.teacher.delete(key);
  else state.teacher.add(key);
  renderTeacherGrid();
});

elements.studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const availability = buildStudentAvailability();
  const memo = document.querySelector("#studentMemo").value.trim();
  if (!state.student.size) {
    showStatus("通塾できる日時を1つ以上〇のまま残してください。", "error");
    return;
  }
  showStatus("送信中です...");
  try {
    const result = await submitSurvey(availability, memo);
    const submission = {
      role: "student",
      respondent_name: state.profile.respondentName,
      grade: state.profile.grade,
      availability,
      memo,
      created_at: result.createdAt,
    };
    saveLocalSubmission(submission);
    renderOwnAnswer("student", submission);
    showStatus("送信しました。");
  } catch (error) {
    showStatus(`送信できませんでした。${error.message}`, "error");
  }
});

elements.teacherForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const availability = buildTeacherAvailability();
  const memo = document.querySelector("#teacherMemo").value.trim();
  if (!state.teacher.size) {
    showStatus("勤務できる曜日を1つ以上選択してください。", "error");
    return;
  }
  showStatus("送信中です...");
  try {
    const result = await submitSurvey(availability, memo);
    const submission = {
      role: "teacher",
      respondent_name: state.profile.respondentName,
      grade: null,
      availability,
      memo,
      created_at: result.createdAt,
    };
    saveLocalSubmission(submission);
    renderOwnAnswer("teacher", submission);
    showStatus("送信しました。");
  } catch (error) {
    showStatus(`送信できませんでした。${error.message}`, "error");
  }
});

async function initialize() {
  selectAllStudentSlots();
  renderStudentGrid();
  renderTeacherGrid();

  const queryToken = new URLSearchParams(location.search).get("token")?.trim() || "";
  const storedToken = sessionStorage.getItem(sessionTokenKey) || "";
  const token = queryToken || storedToken;
  if (!tokenPattern.test(token)) {
    sessionStorage.removeItem(sessionTokenKey);
    showAccessState("専用URLが必要です", "管理者から案内された回答URLを開いてください。", "error");
    return;
  }

  if (queryToken) {
    sessionStorage.setItem(sessionTokenKey, queryToken);
    history.replaceState(null, "", location.pathname);
  }

  state.token = token;
  state.tokenStorageKey = await sha256Hex(token);
  showAccessState("回答ページを確認しています", "少しお待ちください。");
  try {
    const profile = await fetchProfile(token);
    if (!profile || !["student", "teacher"].includes(profile.role)) throw new Error("invalid profile");
    state.profile = profile;
    renderProfile(profile);
    showPage(profile.role);

    const localSubmission = readLocalSubmission();
    if (localSubmission) {
      if (profile.role === "student") applyStudentSubmission(localSubmission);
      else applyTeacherSubmission(localSubmission);
      renderOwnAnswer(profile.role, localSubmission);
    }
  } catch {
    sessionStorage.removeItem(sessionTokenKey);
    state.token = "";
    showAccessState("回答ページを開けません", "この回答URLは無効か、期限が切れています。管理者へ連絡してください。", "error");
  }
}

initialize();
