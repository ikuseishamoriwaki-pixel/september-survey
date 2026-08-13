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
  admin: "管理用",
};

const pageLeads = {
  student: "9月からの通常授業日時を決めるため、来れる日時をタップして提出をお願いします。期限は8/16（日）までです。もし期限内の提出が厳しければお知らせください。",
  teacher: "9月からの勤務日時を決めるため、来れる日時をタップして提出をお願いします。期限は8/16（日）までです。もし期限内の提出が厳しければお知らせください。",
  admin: "生徒・講師の名前を登録し、回答結果を確認します。",
};

const state = {
  page: new URLSearchParams(location.search).get("page") || "admin",
  student: new Set(),
  teacher: new Set(),
  people: [],
  results: [],
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
  studentMasterForm: document.querySelector("#studentMasterForm"),
  teacherMasterForm: document.querySelector("#teacherMasterForm"),
  studentMasterName: document.querySelector("#studentMasterName"),
  studentMasterGrade: document.querySelector("#studentMasterGrade"),
  teacherMasterName: document.querySelector("#teacherMasterName"),
  studentMasterList: document.querySelector("#studentMasterList"),
  teacherMasterList: document.querySelector("#teacherMasterList"),
  loadResultsButton: document.querySelector("#loadResultsButton"),
  downloadCsvButton: document.querySelector("#downloadCsvButton"),
  resultsArea: document.querySelector("#resultsArea"),
  studentCount: document.querySelector("#studentCount"),
  teacherCount: document.querySelector("#teacherCount"),
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
  state.page = pageLabels[page] ? page : "admin";
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

function sortBySubmittedAt(rows) {
  return [...rows].sort((a, b) => {
    const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateDiff) return dateDiff;
    return Number(b.id ?? 0) - Number(a.id ?? 0);
  });
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

  elements.studentMasterList.innerHTML = renderMasterList(students, true);
  elements.teacherMasterList.innerHTML = renderMasterList(teachers, false);
}

function renderMasterList(people, showGrade) {
  if (!people.length) return '<p class="empty">まだ登録がありません。</p>';
  return people.map((person) => `
    <div class="master-row">
      <span>${escapeHtml(person.name)}${showGrade ? ` <small>${escapeHtml(person.grade ?? "")}</small>` : ""}</span>
      <button type="button" data-delete-person="${person.id}">削除</button>
    </div>
  `).join("");
}

async function fetchPeople() {
  const response = await fetch(apiUrl(SUPABASE.peopleTable, "?select=*&active=eq.true&order=role.asc,name.asc"), {
    headers: apiHeaders(),
  });
  if (!response.ok) throw new Error(await response.text() || "名簿の読み込みに失敗しました。");
  state.people = await response.json();
  renderPeople();
}

async function addPerson(role, name, grade = null) {
  const response = await fetch(apiUrl(SUPABASE.peopleTable, "?on_conflict=role,name"), {
    method: "POST",
    headers: apiHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ role, name, grade, active: true }),
  });
  if (!response.ok) throw new Error(await response.text() || "名前の追加に失敗しました。");
}

async function deletePerson(id) {
  const response = await fetch(apiUrl(SUPABASE.peopleTable, `?id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: apiHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({ active: false }),
  });
  if (!response.ok) throw new Error(await response.text() || "削除に失敗しました。");
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
  const response = await fetch(apiUrl(SUPABASE.submissionsTable, "?on_conflict=role,respondent_name"), {
    method: "POST",
    headers: apiHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(submission),
  });
  if (!response.ok) throw new Error(await response.text() || "送信に失敗しました。");
  const saved = await response.json();
  return saved[0] ?? submission;
}

async function fetchResults() {
  const response = await fetch(apiUrl(SUPABASE.submissionsTable, "?select=*&order=created_at.desc"), {
    headers: apiHeaders(),
  });
  if (!response.ok) throw new Error(await response.text() || "読み込みに失敗しました。");
  return response.json();
}

async function deleteSubmission(id) {
  const response = await fetch(apiUrl(SUPABASE.submissionsTable, `?id=eq.${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: apiHeaders({ Prefer: "return=minimal" }),
  });
  if (!response.ok) throw new Error(await response.text() || "回答の削除に失敗しました。");
}

function matrixSlotLabel(day, slot) {
  return `
    <span>${day.label.replace("曜日", "")}</span>
    <span>${slot.label.replace("-", "<br>")}</span>
  `;
}

function renderResults() {
  const students = sortBySubmittedAt(state.results.filter((row) => row.role === "student"));
  const teachers = sortBySubmittedAt(state.results.filter((row) => row.role === "teacher"));
  elements.studentCount.textContent = `生徒 ${students.length}件`;
  elements.teacherCount.textContent = `講師 ${teachers.length}件`;

  if (!state.results.length) {
    elements.resultsArea.innerHTML = '<p class="empty">回答はまだありません。</p>';
    return;
  }

  elements.resultsArea.innerHTML = `
    ${renderStudentMatrix(students)}
    ${renderTeacherMatrix(teachers)}
  `;
}

function renderStudentMatrix(rows) {
  if (!rows.length) return "";
  return `
    <section>
      <h3>生徒 通塾可能表</h3>
      <div class="result-table-wrap">
        <table class="matrix-table student-matrix">
          <thead>
            <tr>
              <th>回答日時</th>
              <th>名前</th>
              <th>学年</th>
              ${weekdays.flatMap((day) => studentSlots.map((slot) => `<th>${matrixSlotLabel(day, slot)}</th>`)).join("")}
              <th>補足</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${formatDate(row.created_at)}</td>
                <td>${escapeHtml(row.respondent_name)}</td>
                <td>${escapeHtml(row.grade ?? "")}</td>
                ${weekdays.flatMap((day) => studentSlots.map((slot) => `<td class="mark">${hasStudentSlot(row, day.id, slot.id) ? "〇" : ""}</td>`)).join("")}
                <td>${escapeHtml(row.memo ?? "")}</td>
                <td class="matrix-action">${deleteSubmissionButton(row.id)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTeacherMatrix(rows) {
  if (!rows.length) return "";
  return `
    <section>
      <h3>講師 勤務可能表</h3>
      <div class="result-table-wrap">
        <table class="matrix-table teacher-matrix">
          <thead>
            <tr>
              <th>回答日時</th>
              <th>名前</th>
              ${teacherDays.map((day) => `<th>${day.label}<br>${day.time}</th>`).join("")}
              <th>補足</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${formatDate(row.created_at)}</td>
                <td>${escapeHtml(row.respondent_name)}</td>
                ${teacherDays.map((day) => `<td class="mark">${hasTeacherDay(row, day.id) ? "〇" : ""}</td>`).join("")}
                <td>${escapeHtml(row.memo ?? "")}</td>
                <td class="matrix-action">${deleteSubmissionButton(row.id)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function deleteSubmissionButton(id) {
  return `<button class="danger-small" type="button" data-delete-submission="${escapeHtml(id)}">削除</button>`;
}

function hasStudentSlot(row, dayId, slotId) {
  const day = (row.availability ?? []).find((item) => item.day === dayId);
  return Boolean(day?.slots?.some((slot) => slot.slot === slotId && slot.available));
}

function hasTeacherDay(row, dayId) {
  return Boolean((row.availability ?? []).find((day) => day.day === dayId && day.available));
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

function makeCsv() {
  const headers = ["種別", "回答日時", "名前", "学年", "可能日時", "補足"];
  const rows = state.results.map((row) => [
    row.role === "student" ? "生徒" : "講師",
    row.created_at ?? "",
    row.respondent_name ?? "",
    row.grade ?? "",
    formatAvailability(row),
    row.memo ?? "",
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv() {
  if (!state.results.length) {
    showStatus("先に結果を読み込んでください。", "error");
    return;
  }
  const blob = new Blob([`\uFEFF${makeCsv()}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "9月通常授業アンケート結果.csv";
  link.click();
  URL.revokeObjectURL(url);
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
    showStatus("来られる日時を1つ以上選択してください。", "error");
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
    showStatus("送信しました。前回の回答がある場合は上書きしました。");
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
    showStatus("送信しました。前回の回答がある場合は上書きしました。");
  } catch (error) {
    showStatus(`送信できませんでした。${error.message}`, "error");
  }
});

elements.studentMasterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.studentMasterName.value.trim();
  const grade = elements.studentMasterGrade.value;
  if (!name || !grade) {
    showStatus("生徒名と学年を入力してください。", "error");
    return;
  }
  try {
    await addPerson("student", name, grade);
    elements.studentMasterForm.reset();
    await fetchPeople();
    showStatus("生徒名を追加しました。");
  } catch (error) {
    showStatus(`追加できませんでした。${error.message}`, "error");
  }
});

elements.teacherMasterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.teacherMasterName.value.trim();
  if (!name) {
    showStatus("講師名を入力してください。", "error");
    return;
  }
  try {
    await addPerson("teacher", name);
    elements.teacherMasterForm.reset();
    await fetchPeople();
    showStatus("講師名を追加しました。");
  } catch (error) {
    showStatus(`追加できませんでした。${error.message}`, "error");
  }
});

document.addEventListener("click", async (event) => {
  const deletePersonButton = event.target.closest("[data-delete-person]");
  const personId = deletePersonButton?.dataset.deletePerson;
  if (personId) {
    try {
      await deletePerson(personId);
      await fetchPeople();
      showStatus("名簿から外しました。");
    } catch (error) {
      showStatus(`削除できませんでした。${error.message}`, "error");
    }
    return;
  }

  const deleteSubmissionTarget = event.target.closest("[data-delete-submission]");
  const submissionId = deleteSubmissionTarget?.dataset.deleteSubmission;
  if (!submissionId) return;
  if (!confirm("この回答を削除しますか？")) return;
  try {
    await deleteSubmission(submissionId);
    state.results = await fetchResults();
    renderResults();
    showStatus("回答を削除しました。");
  } catch (error) {
    showStatus(`削除できませんでした。${error.message}`, "error");
  }
});

elements.loadResultsButton.addEventListener("click", async () => {
  await loadResults();
});

async function loadResults({ silent = false } = {}) {
  if (!silent) {
    showStatus("結果を読み込んでいます...");
  }
  elements.loadResultsButton.disabled = true;
  try {
    state.results = await fetchResults();
    renderResults();
    showStatus("結果を読み込みました。");
  } catch (error) {
    showStatus(`読み込めませんでした。${error.message}`, "error");
  } finally {
    elements.loadResultsButton.disabled = false;
  }
}

elements.downloadCsvButton.addEventListener("click", downloadCsv);

if (state.page === "student") selectAllStudentSlots();
renderStudentGrid();
renderTeacherGrid();
showPage(state.page);
fetchPeople().catch((error) => showStatus(`名簿を読み込めませんでした。${error.message}`, "error"));
if (state.page === "admin") {
  loadResults({ silent: true });
}
