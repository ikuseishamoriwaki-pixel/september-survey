const SUPABASE = {
  url: "https://dlymqxjxandoxponairu.supabase.co",
  key: "sb_publishable_EJKOxEgtTCaQdzlcTpffAw_68oyJFQ9",
  submissionsTable: "september_survey_submissions",
  peopleTable: "september_survey_people",
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
const gradeOrder = ["小4", "小5", "小6", "中1", "中2", "中3", "高1", "高2", "高3"];

const pageLabels = {
  student: "生徒用",
  teacher: "講師用",
};

const pageLeads = {
  student: "最初はすべて〇にしています。来れない日時に×をして提出してください。よろしくお願いします。",
  teacher: "9月からの勤務日時を決めるため、来れる日時をタップして提出をお願いします。期限は8/16（日）までです。もし期限内の提出が厳しければお知らせください。",
};

const state = {
  page: new URLSearchParams(location.search).get("page") || "student",
  student: new Set(),
  teacher: new Set(),
  people: [],
};

const elements = {
  pageLead: document.querySelector("#pageLead"),
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  status: document.querySelector("#statusMessage"),
  studentForm: document.querySelector("#studentForm"),
  teacherForm: document.querySelector("#teacherForm"),
  studentName: document.querySelector("#studentName"),
  studentGrade: document.querySelector("#studentGrade"),
  teacherName: document.querySelector("#teacherName"),
  studentGrid: document.querySelector("#studentGrid"),
  teacherGrid: document.querySelector("#teacherGrid"),
  studentReview: document.querySelector("#studentReview"),
  teacherReview: document.querySelector("#teacherReview"),
};

function apiUrl(table, query = "") {
  return `${SUPABASE.url}/rest/v1/${table}${query}`;
}

function apiHeaders(extra = {}) {
  return {
    apikey: SUPABASE.key,
    Authorization: `Bearer ${SUPABASE.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function showStatus(message, type = "ok") {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
}

function showPage(page) {
  state.page = pageLabels[page] ? page : "student";
  document.body.dataset.page = state.page;
  elements.views.forEach((panel) => panel.classList.toggle("active", panel.id === `${state.page}View`));
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.pageLink === state.page));
  elements.pageLead.textContent = pageLeads[state.page];
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

function gradeRank(grade) {
  const index = gradeOrder.indexOf(grade);
  return index === -1 ? 999 : index;
}

function sortStudents(students) {
  return [...students].sort((a, b) =>
    gradeRank(a.grade) - gradeRank(b.grade)
    || String(a.name ?? a.respondent_name).localeCompare(String(b.name ?? b.respondent_name), "ja")
  );
}

function sortTeachers(teachers) {
  return [...teachers].sort((a, b) =>
    String(a.name ?? a.respondent_name).localeCompare(String(b.name ?? b.respondent_name), "ja")
  );
}

function renderStudentNameOptions(students = sortStudents(state.people.filter((person) => person.role === "student"))) {
  const grade = elements.studentGrade.value;
  const filtered = grade ? students.filter((person) => person.grade === grade) : [];
  elements.studentName.disabled = !grade;
  elements.studentName.innerHTML = !grade
    ? '<option value="">未選択</option>'
    : '<option value="">未選択</option>' + filtered.map((person) =>
      `<option value="${escapeHtml(person.name)}">${escapeHtml(person.name)}</option>`
    ).join("");
}

function renderPeople() {
  const students = sortStudents(state.people.filter((person) => person.role === "student"));
  const teachers = sortTeachers(state.people.filter((person) => person.role === "teacher"));
  const selectedGrade = elements.studentGrade.value;
  const availableGrades = [...new Set(students.map((person) => person.grade).filter(Boolean))]
    .sort((a, b) => gradeRank(a) - gradeRank(b));

  elements.studentGrade.innerHTML = '<option value="">未選択</option>' + availableGrades.map((grade) =>
    `<option value="${escapeHtml(grade)}">${escapeHtml(grade)}</option>`
  ).join("");
  if (availableGrades.includes(selectedGrade)) elements.studentGrade.value = selectedGrade;
  else elements.studentGrade.value = "";
  renderStudentNameOptions(students);

  elements.teacherName.innerHTML = '<option value="">未選択</option>' + teachers.map((person) =>
    `<option value="${escapeHtml(person.name)}">${escapeHtml(person.name)}</option>`
  ).join("");
}

async function fetchPeople() {
  const response = await fetch(apiUrl(SUPABASE.peopleTable, "?select=*&active=eq.true&order=role.asc,name.asc"), {
    headers: apiHeaders(),
  });
  if (!response.ok) throw new Error(await response.text() || "名簿の読み込みに失敗しました。");
  state.people = await response.json();
  renderPeople();
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

async function insertSubmission(payload) {
  const submission = { ...payload, created_at: new Date().toISOString() };
  const response = await fetch(apiUrl(SUPABASE.submissionsTable), {
    method: "POST",
    headers: apiHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(submission),
  });
  if (response.status === 409) {
    throw new Error("回答済みです。変更が必要な場合は管理者へ連絡してください。");
  }
  if (!response.ok) throw new Error(await response.text() || "送信に失敗しました。");
  return submission;
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

function localSubmissionKey(role, name) {
  return `${localSubmissionPrefix}:${role}:${name}`;
}

function saveLocalSubmission(submission) {
  try {
    localStorage.setItem(localSubmissionKey(submission.role, submission.respondent_name), JSON.stringify(submission));
  } catch {
    // Local answer review is a convenience; submission itself has already succeeded.
  }
}

function readLocalSubmission(role, name) {
  if (!name) return null;
  try {
    const value = localStorage.getItem(localSubmissionKey(role, name));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function renderOwnAnswer(role, submission) {
  const element = role === "student" ? elements.studentReview : elements.teacherReview;
  if (!element) return;
  if (!submission) {
    element.innerHTML = "";
    return;
  }
  element.innerHTML = `
    <div class="own-answer-title">前回送信した内容</div>
    <table>
      <tbody>
        <tr>
          <th>回答日時</th>
          <td>${formatDate(submission.created_at)}</td>
        </tr>
        <tr>
          <th>可能日時</th>
          <td>${escapeHtml(formatAvailability(submission) || "なし")}</td>
        </tr>
        <tr>
          <th>補足</th>
          <td>${escapeHtml(submission.memo ?? "")}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function applyStudentSubmission(submission) {
  state.student = new Set(
    (submission.availability ?? []).flatMap((day) =>
      (day.slots ?? [])
        .filter((slot) => slot.available)
        .map((slot) => `${day.day}_${slot.slot}`)
    )
  );
  document.querySelector("#studentMemo").value = submission.memo ?? "";
  renderStudentGrid();
}

function applyTeacherSubmission(submission) {
  state.teacher = new Set(
    (submission.availability ?? [])
      .filter((day) => day.available)
      .map((day) => day.day)
  );
  document.querySelector("#teacherMemo").value = submission.memo ?? "";
  renderTeacherGrid();
}

function loadOwnStudentAnswer() {
  const submission = readLocalSubmission("student", elements.studentName.value);
  if (submission) {
    applyStudentSubmission(submission);
  } else {
    selectAllStudentSlots();
    document.querySelector("#studentMemo").value = "";
    renderStudentGrid();
  }
  renderOwnAnswer("student", submission);
}

function loadOwnTeacherAnswer() {
  const submission = readLocalSubmission("teacher", elements.teacherName.value);
  if (submission) applyTeacherSubmission(submission);
  renderOwnAnswer("teacher", submission);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.studentGrade.addEventListener("change", () => {
  renderStudentNameOptions();
  selectAllStudentSlots();
  renderStudentGrid();
  renderOwnAnswer("student", null);
});

elements.studentName.addEventListener("change", loadOwnStudentAnswer);
elements.teacherName.addEventListener("change", loadOwnTeacherAnswer);

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
  const name = elements.studentName.value;
  const grade = elements.studentGrade.value;
  const memo = document.querySelector("#studentMemo").value.trim();
  if (!state.student.size) {
    showStatus("通塾できる日時を1つ以上〇のまま残してください。", "error");
    return;
  }
  showStatus("送信中です...");
  try {
    const submission = await insertSubmission({ role: "student", respondent_name: name, grade, availability: buildStudentAvailability(), memo });
    saveLocalSubmission(submission);
    elements.studentForm.reset();
    renderStudentNameOptions();
    selectAllStudentSlots();
    renderStudentGrid();
    renderOwnAnswer("student", submission);
    showStatus("送信しました。");
  } catch (error) {
    showStatus(`送信できませんでした。${error.message}`, "error");
  }
});

elements.teacherForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.teacherName.value;
  const memo = document.querySelector("#teacherMemo").value.trim();
  if (!state.teacher.size) {
    showStatus("勤務できる曜日を1つ以上選択してください。", "error");
    return;
  }
  showStatus("送信中です...");
  try {
    const submission = await insertSubmission({ role: "teacher", respondent_name: name, grade: null, availability: buildTeacherAvailability(), memo });
    saveLocalSubmission(submission);
    elements.teacherForm.reset();
    state.teacher.clear();
    renderTeacherGrid();
    renderOwnAnswer("teacher", submission);
    showStatus("送信しました。");
  } catch (error) {
    showStatus(`送信できませんでした。${error.message}`, "error");
  }
});

if (state.page === "student") selectAllStudentSlots();
renderStudentGrid();
renderTeacherGrid();
showPage(state.page);
fetchPeople().catch((error) => showStatus(`名簿を読み込めませんでした。${error.message}`, "error"));
