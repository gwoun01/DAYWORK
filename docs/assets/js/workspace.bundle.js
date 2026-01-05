/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./TypeScript/workspace/01_dashboard-trip-status.ts":
/*!**********************************************************!*\
  !*** ./TypeScript/workspace/01_dashboard-trip-status.ts ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDashboardTripStatus: () => (/* binding */ initDashboardTripStatus)
/* harmony export */ });
// TypeScript/workspace/01_dashboard-trip-status.ts
function pad2(n) {
    return String(n).padStart(2, "0");
}
function parseLocdateToYmd(loc) {
    // 20260101 -> 2026-01-01
    const s = String(loc ?? "");
    if (!/^\d{8}$/.test(s))
        return "";
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function getDowKr(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const map = ["일", "월", "화", "수", "목", "금", "토"];
    return map[d.getDay()] ?? "";
}
function isWeekend(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    return day === 0 || day === 6;
}
function ymd(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function getAllDaysOfMonth(base) {
    const y = base.getFullYear();
    const m = base.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= last; i++)
        days.push(new Date(y, m, i));
    return days;
}
function todayYmd() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function vacTypeLabel(t) {
    if (t === "annual")
        return "연차";
    if (t === "half")
        return "반차";
    return "기타";
}
/** YYYY-MM-DD 체크 */
function isYmdStr(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
/**
 * ✅ 휴가 목록을 "월 기준 날짜별 이름 배열"로 변환
 *   { "2026-01-03": ["홍길동","김철수"], ... }
 */
function buildVacationMapForMonth(items, base) {
    const y = base.getFullYear();
    const m = base.getMonth(); // 0~11
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const map = {};
    for (const v of items) {
        if (!v?.user_name)
            continue;
        if (!isYmdStr(v.start_date) || !isYmdStr(v.end_date))
            continue;
        const s = new Date(v.start_date + "T00:00:00");
        const e = new Date(v.end_date + "T00:00:00");
        // 월 범위로 클램프
        const start = s < monthStart ? monthStart : s;
        const end = e > monthEnd ? monthEnd : e;
        if (start > end)
            continue;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = ymd(d);
            map[key] = map[key] ?? [];
            if (!map[key].includes(v.user_name))
                map[key].push(v.user_name);
        }
    }
    return map;
}
/** 휴가 전체 목록 가져오기 */
async function fetchVacations(API_BASE) {
    try {
        const res = await fetch(`${API_BASE}/api/business-master/vacations`, {
            credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok !== true)
            return [];
        return Array.isArray(json.items) ? json.items : [];
    }
    catch {
        return [];
    }
}
/**
 * ✅ 대시보드의 휴일/당직 캘린더 tbody(#dutyHolidayBody) 렌더
 * - ✅ 당직 + 휴가 같이 표시 (한 칸에 여러 줄)
 */
function renderDashboardHolidayDuty(holidays, assignsMap, vacMap) {
    const tbody = document.getElementById("dutyHolidayBody");
    if (!tbody)
        return;
    if (!holidays.length) {
        tbody.innerHTML = `
      <tr>
        <td class="px-2 py-2 text-center text-gray-400" colspan="4">표시할 휴일이 없습니다.</td>
      </tr>
    `;
        return;
    }
    tbody.innerHTML = holidays
        .map((h) => {
        const typeLabel = h.type === "공휴일"
            ? h.holidayName
                ? `공휴일(${h.holidayName})`
                : "공휴일"
            : "주말";
        const dutyName = assignsMap[h.date] || "";
        const vacNames = vacMap[h.date] ?? [];
        const lines = [];
        if (dutyName)
            lines.push(`당직: ${escapeHtml(dutyName)}`);
        if (vacNames.length)
            lines.push(`휴가: ${vacNames.map(escapeHtml).join(", ")}`);
        const cell = lines.length === 0
            ? `<span class="text-gray-400">-</span>`
            : lines.map((t) => `<div class="whitespace-nowrap">${t}</div>`).join("");
        return `
        <tr>
          <td class="border px-2 py-1 text-center">${h.date.slice(5)}</td>
          <td class="border px-2 py-1 text-center">${h.dow}</td>
          <td class="border px-2 py-1 text-center">${typeLabel}</td>
          <td class="border px-2 py-1 text-left">${cell}</td>
        </tr>
      `;
    })
        .join("");
}
/**
 * ✅ 휴일 목록(주말 + 공휴일 API) 가져오기
 * - 공휴일 API 실패해도 주말만으로 진행
 */
async function fetchHolidayItemsForMonth(API_BASE, base) {
    const year = String(base.getFullYear());
    const month = pad2(base.getMonth() + 1);
    // 1) 주말
    const days = getAllDaysOfMonth(base);
    const weekend = days
        .map((d) => ymd(d))
        .filter((ds) => isWeekend(ds))
        .map((ds) => ({
        date: ds,
        dow: getDowKr(ds),
        type: "주말",
    }));
    // 2) 공휴일 API
    let apiHolidays = [];
    try {
        const res = await fetch(`${API_BASE}/api/business-master/holidays?year=${year}&month=${month}`, {
            credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok === true) {
            const list = Array.isArray(json.holidays) ? json.holidays : [];
            apiHolidays = list
                .filter((h) => h && h.date)
                .map((h) => {
                const ds = parseLocdateToYmd(String(h.date));
                if (!ds)
                    return null;
                return {
                    date: ds,
                    dow: getDowKr(ds),
                    type: "공휴일",
                    holidayName: String(h.name ?? "").trim() || undefined,
                };
            })
                .filter(Boolean);
        }
    }
    catch (e) {
        console.warn("[대시보드 당직] 공휴일 API 실패(주말만 표시):", e);
    }
    // 3) 합치기(중복 제거): 공휴일 우선
    const map = new Map();
    weekend.forEach((w) => map.set(w.date, w));
    apiHolidays.forEach((h) => map.set(h.date, h));
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
/**
 * ✅ F5 새로고침 시, 서버 config에서 마지막 생성 결과(lastAssigns)를 읽어
 * 대시보드 캘린더 표(#dutyHolidayBody)를 자동 복원
 * - ✅ 휴가도 같이 합쳐서 표시
 */
async function restoreDashboardDutyFromConfig(API_BASE) {
    const tbody = document.getElementById("dutyHolidayBody");
    if (!tbody)
        return;
    tbody.innerHTML = `
    <tr>
      <td class="px-2 py-2 text-center text-gray-400" colspan="4">당직 일정 불러오는 중...</td>
    </tr>
  `;
    try {
        const res = await fetch(`${API_BASE}/api/business-master/config`, { credentials: "include" });
        if (!res.ok) {
            renderDashboardHolidayDuty([], {}, {});
            return;
        }
        const data = await res.json().catch(() => ({}));
        const raw = String(data?.duty_members_text ?? "");
        let lastYm = "";
        let lastAssigns = [];
        try {
            const parsed = raw ? JSON.parse(raw) : null;
            lastYm = String(parsed?.lastYm ?? "");
            lastAssigns = Array.isArray(parsed?.lastAssigns) ? parsed.lastAssigns : [];
        }
        catch { }
        if (!lastYm || !lastAssigns.length) {
            renderDashboardHolidayDuty([], {}, {});
            return;
        }
        const y = Number(lastYm.slice(0, 4));
        const m = Number(lastYm.slice(5, 7));
        if (!Number.isFinite(y) || !Number.isFinite(m)) {
            renderDashboardHolidayDuty([], {}, {});
            return;
        }
        const base = new Date(y, m - 1, 1);
        const holidays = await fetchHolidayItemsForMonth(API_BASE, base);
        const assignsMap = {};
        for (const a of lastAssigns)
            assignsMap[a.date] = a.name;
        // ✅ 휴가도 같이 가져와서 월 map으로 변환
        const vacations = await fetchVacations(API_BASE);
        const vacMap = buildVacationMapForMonth(vacations, base);
        renderDashboardHolidayDuty(holidays, assignsMap, vacMap);
    }
    catch (e) {
        console.error("[대시보드 당직] 복원 실패:", e);
        renderDashboardHolidayDuty([], {}, {});
    }
}
/* ============================================================
 * ✅ ✅ ✅ 휴가자현황(대시보드)
 * - ✅ 네 HTML 기준으로 id 맞춤!
 *   tbody: #vacationStatusTableBody
 *   KPI:   #kpiVacationToday
 *   검색:  #vacationSearchInput
 *   필터:  #vacationFilterType
 *   버튼:  #btnVacationReload
 *   라벨:  #vacationStatusDateLabel
 *   이벤트: vacation-status-refresh
 * ============================================================ */
function renderDashboardVacation(items, baseDateYmd) {
    const kpiEl = document.getElementById("kpiVacationToday");
    const tbody = document.getElementById("vacationStatusTableBody");
    if (!tbody)
        return;
    const searchInput = document.getElementById("vacationSearchInput");
    const filterSelect = document.getElementById("vacationFilterType");
    // 1) 오늘 포함되는 휴가만
    let todayItems = items.filter((v) => {
        const s = String(v.start_date || "");
        const e = String(v.end_date || "");
        return s && e && s <= baseDateYmd && baseDateYmd <= e;
    });
    // 2) 필터(연차/반차/기타)
    const filter = filterSelect?.value ?? "all";
    if (filter !== "all") {
        todayItems = todayItems.filter((v) => v.vac_type === filter);
    }
    // 3) 검색(이름/메모)
    const kw = (searchInput?.value ?? "").trim().toLowerCase();
    if (kw) {
        todayItems = todayItems.filter((v) => {
            const name = (v.user_name ?? "").toLowerCase();
            const note = (v.note ?? "").toLowerCase();
            return name.includes(kw) || note.includes(kw);
        });
    }
    // KPI
    if (kpiEl)
        kpiEl.textContent = String(todayItems.length);
    if (todayItems.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td class="px-2 py-2 text-center text-gray-400" colspan="5">오늘 휴가자가 없습니다.</td>
      </tr>
    `;
        return;
    }
    tbody.innerHTML = todayItems
        .map((v, idx) => {
        const range = v.start_date === v.end_date ? v.start_date : `${v.start_date} ~ ${v.end_date}`;
        const note = v.note ? escapeHtml(v.note) : "";
        return `
        <tr class="text-xs text-gray-700">
          <td class="border px-2 py-2 text-center">${idx + 1}</td>
          <td class="border px-2 py-2 text-center font-semibold">${escapeHtml(v.user_name)}</td>
          <td class="border px-2 py-2 text-center">${vacTypeLabel(v.vac_type)}</td>
          <td class="border px-2 py-2 text-center">${escapeHtml(range)}</td>
          <td class="border px-2 py-2">${note}</td>
        </tr>
      `;
    })
        .join("");
}
async function loadDashboardVacation(API_BASE, dateYmd) {
    const tbody = document.getElementById("vacationStatusTableBody");
    if (!tbody)
        return; // 휴가자 영역 없는 화면이면 무시
    const dateLabel = document.getElementById("vacationStatusDateLabel");
    if (dateLabel)
        dateLabel.textContent = "오늘";
    tbody.innerHTML = `
    <tr>
      <td class="px-2 py-2 text-center text-gray-400" colspan="5">휴가자 현황 불러오는 중...</td>
    </tr>
  `;
    try {
        const res = await fetch(`${API_BASE}/api/business-master/vacations`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok !== true) {
            tbody.innerHTML = `
        <tr>
          <td class="px-2 py-2 text-center text-red-500" colspan="5">휴가자 현황 조회 실패</td>
        </tr>
      `;
            const kpiEl = document.getElementById("kpiVacationToday");
            if (kpiEl)
                kpiEl.textContent = "0";
            return;
        }
        const items = Array.isArray(json.items) ? json.items : [];
        renderDashboardVacation(items, dateYmd);
    }
    catch (e) {
        console.error("[대시보드 휴가] 로딩 실패:", e);
        tbody.innerHTML = `
      <tr>
        <td class="px-2 py-2 text-center text-red-500" colspan="5">휴가자 현황 로딩 중 오류</td>
      </tr>
    `;
        const kpiEl = document.getElementById("kpiVacationToday");
        if (kpiEl)
            kpiEl.textContent = "0";
    }
}
/**
 * 📌 대시보드 - 출장자 현황 + 오늘 출장 인원
 */
function initDashboardTripStatus(API_BASE) {
    const kpiTripEl = document.getElementById("kpiTripToday");
    const tbody = document.getElementById("tripStatusTbody");
    const dateLabel = document.getElementById("tripStatusDateLabel");
    const searchInput = document.getElementById("tripSearchInput");
    const filterSelect = document.getElementById("tripFilterType");
    const reloadBtn = document.getElementById("btnTripReload");
    // 🔹 필수 DOM 없으면 그냥 종료
    if (!kpiTripEl || !tbody) {
        console.warn("[대시보드] 출장자 현황용 요소를 찾지 못했습니다.");
        return;
    }
    const tbodyEl = tbody;
    let lastItems = [];
    let currentDate; // YYYY-MM-DD (없으면 오늘)
    function renderTable() {
        const keyword = (searchInput?.value ?? "").trim().toLowerCase();
        const filter = filterSelect?.value ?? "all";
        let items = lastItems.slice();
        if (filter === "overseas" || filter === "inhouse") {
            items = [];
        }
        if (keyword) {
            items = items.filter((it) => {
                const name = it.req_name?.toLowerCase() ?? "";
                const dest = it.destination?.toLowerCase() ?? "";
                const place = it.depart_place?.toLowerCase() ?? "";
                return name.includes(keyword) || dest.includes(keyword) || place.includes(keyword);
            });
        }
        if (items.length === 0) {
            tbodyEl.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-3 text-center text-xs text-gray-400">
            등록된 출장 데이터가 없습니다.
          </td>
        </tr>
      `;
            return;
        }
        tbodyEl.innerHTML = "";
        items.forEach((it, idx) => {
            const tr = document.createElement("tr");
            tr.className = "border-t text-xs text-gray-700";
            const customer = it.destination || "-";
            const depart = it.depart_time || "-";
            const arrive = it.arrive_time || "-";
            const statusLabel = it.status === "SETTLED"
                ? `<span class="px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">정산완료</span>`
                : `<span class="px-2 py-[2px] rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">출장중</span>`;
            tr.innerHTML = `
        <td class="border px-2 py-2 text-center">${idx + 1}</td>
        <td class="border px-2 py-2 text-center font-semibold">${it.req_name || "-"}</td>
        <td class="border px-2 py-2 text-center">${customer}</td>
        <td class="border px-2 py-2 text-center">${depart}</td>
        <td class="border px-2 py-2 text-center">${arrive}</td>
        <td class="border px-2 py-2 text-center">${statusLabel}</td>
      `;
            tbodyEl.appendChild(tr);
        });
    }
    async function loadTripStatus(date) {
        currentDate = date;
        if (dateLabel) {
            dateLabel.textContent = date ?? "오늘";
        }
        tbodyEl.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-3 text-center text-xs text-gray-400">
          데이터 로딩 중...
        </td>
      </tr>
    `;
        try {
            const params = new URLSearchParams();
            if (date)
                params.set("date", date);
            const url = params.toString().length > 0
                ? `${API_BASE}/api/business-trip/status?${params.toString()}`
                : `${API_BASE}/api/business-trip/status`;
            const res = await fetch(url);
            if (!res.ok) {
                console.error("[대시보드] /status 응답 오류:", res.status);
                tbodyEl.innerHTML = `
          <tr>
            <td colspan="6" class="border px-2 py-3 text-center text-xs text-red-500">
              서버 오류: HTTP ${res.status}
            </td>
          </tr>
        `;
                return;
            }
            const json = await res.json().catch(() => null);
            const rows = json?.data ?? [];
            lastItems = rows;
            kpiTripEl.textContent = String(rows.length);
            renderTable();
        }
        catch (err) {
            console.error("[대시보드] 출장자 현황 로딩 실패:", err);
            tbodyEl.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-3 text-center text-xs text-red-500">
            데이터 로딩 중 오류가 발생했습니다.
          </td>
        </tr>
      `;
        }
    }
    // -----------------------------
    // 🔹 이벤트 바인딩 (출장)
    // -----------------------------
    searchInput?.addEventListener("input", () => renderTable());
    filterSelect?.addEventListener("change", () => renderTable());
    reloadBtn?.addEventListener("click", () => loadTripStatus(currentDate));
    window.addEventListener("trip-status-refresh", () => {
        loadTripStatus(currentDate);
    });
    // ✅ 최초 한 번 로딩 (오늘 기준)
    loadTripStatus();
    // ✅ 대시보드 캘린더(휴일/당직) + 휴가 함께 표시
    restoreDashboardDutyFromConfig(API_BASE);
    // -----------------------------
    // 🔹 이벤트 바인딩 (휴가)
    // -----------------------------
    const vacationSearchInput = document.getElementById("vacationSearchInput");
    const vacationFilterType = document.getElementById("vacationFilterType");
    const btnVacationReload = document.getElementById("btnVacationReload");
    const reloadVacation = () => loadDashboardVacation(API_BASE, todayYmd());
    vacationSearchInput?.addEventListener("input", reloadVacation);
    vacationFilterType?.addEventListener("change", reloadVacation);
    btnVacationReload?.addEventListener("click", reloadVacation);
    // ✅ 휴가자 새로고침 이벤트(휴가자 설정에서 저장/삭제 후)
    window.addEventListener("vacation-status-refresh", () => {
        reloadVacation();
        // 휴가가 바뀌면 캘린더도 같이 다시 그리기(표 안에 휴가: 이름 반영)
        restoreDashboardDutyFromConfig(API_BASE);
    });
    // ✅ ✅ 휴가자 현황 최초 1회 로딩
    loadDashboardVacation(API_BASE, todayYmd());
}


/***/ }),

/***/ "./TypeScript/workspace/02_trip-approval.ts":
/*!**************************************************!*\
  !*** ./TypeScript/workspace/02_trip-approval.ts ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initTripApprovalPanel: () => (/* binding */ initTripApprovalPanel)
/* harmony export */ });
// src/TypeScript/workspace/02_trip-approval.ts
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`element not found: #${id}`);
    return el;
}
/** ISO 날짜 또는 문자열 → YYYY-MM-DD */
function formatDateLabel(value) {
    if (!value)
        return "";
    if (value.length >= 10)
        return value.slice(0, 10);
    const d = new Date(value);
    if (isNaN(d.getTime()))
        return value;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** 특정 날짜가 속한 주(월~일) 구하기 */
function getWeekRange(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return { start: formatDateLabel(dateStr), end: formatDateLabel(dateStr) };
    }
    const day = (d.getDay() + 6) % 7; // 월=0
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
        start: monday.toISOString().slice(0, 10),
        end: sunday.toISOString().slice(0, 10),
    };
}
/** TripRow[] 를 직원+주간 단위로 묶기 */
function buildWeeklyGroups(rows) {
    const map = new Map();
    for (const row of rows) {
        const { start, end } = getWeekRange(row.trip_date);
        const company_part = row.company_part ?? "-";
        const key = `${row.req_name}__${company_part}__${start}`;
        let group = map.get(key);
        if (!group) {
            group = {
                key,
                weekStart: start,
                weekEnd: end,
                req_name: row.req_name,
                company_part,
                rows: [],
            };
            map.set(key, group);
        }
        group.rows.push(row);
    }
    // 보기 좋게 정렬
    return Array.from(map.values()).sort((a, b) => {
        if (a.weekStart !== b.weekStart) {
            return a.weekStart.localeCompare(b.weekStart);
        }
        if (a.company_part !== b.company_part) {
            return a.company_part.localeCompare(b.company_part);
        }
        return a.req_name.localeCompare(b.req_name);
    });
}
const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
let currentGroup = null;
function initTripApprovalPanel(_panelId) {
    const fromInput = getEl("appr_from");
    const toInput = getEl("appr_to");
    const statusSelect = getEl("appr_status");
    const searchBtn = getEl("appr_search");
    const resultMsg = getEl("appr_result_msg");
    const tbody = getEl("approve_result_tbody");
    // 기본 조회 기간: 이번 주
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    fromInput.value = monday.toISOString().slice(0, 10);
    toInput.value = sunday.toISOString().slice(0, 10);
    // 🔍 조회 버튼
    searchBtn.addEventListener("click", async () => {
        const from = fromInput.value;
        const to = toInput.value;
        const status = statusSelect.value;
        if (!from || !to) {
            alert("시작일과 종료일을 모두 선택해주세요.");
            return;
        }
        resultMsg.textContent = "조회 중입니다...";
        tbody.innerHTML = `
      <tr>
        <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
          조회 중...
        </td>
      </tr>`;
        try {
            const url = new URL("/api/business-trip/settlements-range-admin", API_BASE);
            url.searchParams.set("from", from);
            url.searchParams.set("to", to);
            url.searchParams.set("status", status);
            const res = await fetch(url.toString(), { credentials: "include" });
            const json = await res.json();
            if (!json.ok) {
                resultMsg.textContent = json.message ?? "조회 실패";
                tbody.innerHTML = `
          <tr>
            <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
              조회 실패: ${json.message ?? "알 수 없는 오류"}
            </td>
          </tr>`;
                return;
            }
            const rows = json.data ?? [];
            if (rows.length === 0) {
                resultMsg.textContent = "해당 기간에 조회된 출장 내역이 없습니다.";
                tbody.innerHTML = `
          <tr>
            <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
              조회된 출장 내역이 없습니다.
            </td>
          </tr>`;
                return;
            }
            const groups = buildWeeklyGroups(rows);
            resultMsg.textContent = `총 ${groups.length}개 주간 묶음 / ${rows.length}건 조회되었습니다.`;
            tbody.innerHTML = "";
            groups.forEach((g) => {
                const tr = document.createElement("tr");
                // 기간
                const tdPeriod = document.createElement("td");
                tdPeriod.className = "border px-2 py-1 text-center";
                tdPeriod.textContent = `${formatDateLabel(g.weekStart)} ~ ${formatDateLabel(g.weekEnd)}`;
                tr.appendChild(tdPeriod);
                // 소속팀
                const tdTeam = document.createElement("td");
                tdTeam.className = "border px-2 py-1 text-center";
                tdTeam.textContent = g.company_part;
                tr.appendChild(tdTeam);
                // 이름
                const tdName = document.createElement("td");
                tdName.className = "border px-2 py-1 text-center";
                tdName.textContent = g.req_name;
                tr.appendChild(tdName);
                // 건수
                const tdCount = document.createElement("td");
                tdCount.className = "border px-2 py-1 text-center";
                tdCount.textContent = String(g.rows.length);
                tr.appendChild(tdCount);
                // 상세 버튼
                const tdDetail = document.createElement("td");
                tdDetail.className = "border px-2 py-1 text-center";
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = "주간 상세";
                btn.className =
                    "px-2 py-1 rounded-lg bg-indigo-500 text-white text-[11px] hover:bg-indigo-600";
                btn.addEventListener("click", () => openWeeklyDetailModal(g));
                tdDetail.appendChild(btn);
                tr.appendChild(tdDetail);
                tbody.appendChild(tr);
            });
        }
        catch (err) {
            console.error(err);
            resultMsg.textContent = "서버 오류가 발생했습니다.";
            tbody.innerHTML = `
        <tr>
          <td colspan="5" class="border px-2 py-3 text-center text-gray-400">
            서버 오류가 발생했습니다.
          </td>
        </tr>`;
        }
    });
    // 모달 관련 이벤트
    const modal = getEl("appr_modal");
    const modalCloseBtn = getEl("appr_modal_close");
    const btnApprove = getEl("appr_btn_approve");
    const btnReject = getEl("appr_btn_reject");
    modalCloseBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    });
    // ✅ 주간 승인
    btnApprove.addEventListener("click", async () => {
        if (!currentGroup)
            return;
        const comment = getEl("appr_comment").value.trim();
        if (!confirm("이 주간의 모든 출장 건을 승인하시겠습니까?"))
            return;
        try {
            const approver = window.CURRENT_USER_NAME ?? null;
            let failed = 0;
            for (const row of currentGroup.rows) {
                if (row.approve_status === "approved")
                    continue; // 이미 승인된 건은 패스
                const res = await fetch(`${API_BASE}/api/business-trip/${encodeURIComponent(row.trip_id)}/approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ approver, comment }),
                });
                const json = await res.json();
                if (!json.ok) {
                    failed++;
                    console.error("승인 실패", row.trip_id, json);
                }
            }
            if (failed > 0) {
                alert(`일부(${failed}건)는 승인에 실패했습니다. 콘솔을 확인해주세요.`);
            }
            else {
                alert("해당 주간 출장 건이 모두 승인되었습니다.");
            }
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            getEl("appr_search").click();
        }
        catch (e) {
            console.error(e);
            alert("서버 오류로 승인에 실패했습니다.");
        }
    });
    // ✅ 주간 반려
    btnReject.addEventListener("click", async () => {
        if (!currentGroup)
            return;
        const comment = getEl("appr_comment").value.trim();
        if (!comment) {
            if (!confirm("반려 사유가 없습니다. 그래도 반려하시겠습니까?"))
                return;
        }
        try {
            const approver = window.CURRENT_USER_NAME ?? null;
            let failed = 0;
            for (const row of currentGroup.rows) {
                if (row.approve_status === "rejected")
                    continue; // 이미 반려된 건은 패스
                const res = await fetch(`${API_BASE}/api/business-trip/${encodeURIComponent(row.trip_id)}/reject`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ approver, comment }),
                });
                const json = await res.json();
                if (!json.ok) {
                    failed++;
                    console.error("반려 실패", row.trip_id, json);
                }
            }
            if (failed > 0) {
                alert(`일부(${failed}건)는 반려에 실패했습니다. 콘솔을 확인해주세요.`);
            }
            else {
                alert("해당 주간 출장 건이 모두 반려되었습니다.");
            }
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            getEl("appr_search").click();
        }
        catch (e) {
            console.error(e);
            alert("서버 오류로 반려에 실패했습니다.");
        }
    });
}
/** 🔍 주간 상세 모달 */
function openWeeklyDetailModal(group) {
    currentGroup = group;
    const modal = getEl("appr_modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    // 첫 번째 행 기준으로 출장지/차량 상단 요약
    const firstRow = group.rows[0];
    const firstReg = (firstRow.detail_json?.register || firstRow.start_data || {});
    const firstSet = (firstRow.detail_json?.settlement || firstRow.end_data || {});
    getEl("appr_d_name").textContent = group.req_name;
    getEl("appr_d_date").textContent = `${formatDateLabel(group.weekStart)} ~ ${formatDateLabel(group.weekEnd)}`;
    // 본문 테이블: 주간 전체 행
    const tbody = getEl("appr_detail_tbody");
    tbody.innerHTML = "";
    // 일자순 정렬
    const sorted = [...group.rows].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
    function td(text, cls = "border px-2 py-1 text-center") {
        const el = document.createElement("td");
        el.className = cls;
        el.textContent = text || "";
        return el;
    }
    const mealText = (m) => {
        if (!m || !m.checked)
            return "-";
        if (m.owner === "corp")
            return "법인";
        if (m.owner === "personal")
            return "개인";
        return "사용";
    };
    for (const row of sorted) {
        const reg = (row.detail_json?.register || row.start_data || {});
        const set = (row.detail_json?.settlement || row.end_data || {});
        const workTime = reg.depart_time && set.work_end_time ? `${reg.depart_time} ~ ${set.work_end_time}` : "";
        const meals = set.meals || {};
        const tr = document.createElement("tr");
        tr.appendChild(td(formatDateLabel(row.trip_date))); // 일자
        tr.appendChild(td(reg.depart_place ?? "")); // 출발지
        tr.appendChild(td(reg.destination ?? "")); // 출장지
        tr.appendChild(td(reg.depart_time ?? "")); // 출발시간
        tr.appendChild(td(reg.arrive_time ?? "")); // 도착시간
        tr.appendChild(td(workTime)); // 업무시간
        tr.appendChild(td(set.return_place ?? "")); // 복귀지
        tr.appendChild(td(set.vehicle === "corp" ? "법인" : set.vehicle === "personal" ? "개인" : "-")); // 차량
        tr.appendChild(td(mealText(meals.breakfast))); // 조식
        tr.appendChild(td(mealText(meals.lunch))); // 중식
        tr.appendChild(td(mealText(meals.dinner))); // 석식
        tr.appendChild(td(reg.purpose ?? "", "border px-2 py-1 text-left whitespace-pre-wrap")); // 목적
        tbody.appendChild(tr);
    }
    // 💰 금액 요약 (주간 전체 합계)
    let totalMealsAmount = 0;
    let totalFuelAmount = 0;
    for (const row of group.rows) {
        const set = (row.detail_json?.settlement || row.end_data || {});
        const c = set.calc || {};
        totalMealsAmount += c.meals_personal_amount ?? 0;
        totalFuelAmount += c.fuel_amount ?? 0;
    }
    const amountBox = getEl("appr_amount_box"); // HTML에 div 하나 만들어두기
    const sum = totalMealsAmount + totalFuelAmount;
    amountBox.textContent = `식대(개인) ${totalMealsAmount.toLocaleString()}원 / 유류비 ${totalFuelAmount.toLocaleString()}원 / 합계 ${sum.toLocaleString()}원`;
    // 승인/반려 상태 요약
    const total = group.rows.length;
    const pending = group.rows.filter((r) => !r.approve_status || r.approve_status === "pending")
        .length;
    const approved = group.rows.filter((r) => r.approve_status === "approved").length;
    const rejected = group.rows.filter((r) => r.approve_status === "rejected").length;
    const footer = getEl("appr_footer_info");
    footer.textContent = `총 ${total}건 / 대기 ${pending}건 / 승인 ${approved}건 / 반려 ${rejected}건`;
    // 의견 초기화
    getEl("appr_comment").value =
        group.rows[0]?.approve_comment ?? "";
}


/***/ }),

/***/ "./TypeScript/workspace/04_user-manage.ts":
/*!************************************************!*\
  !*** ./TypeScript/workspace/04_user-manage.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initUserManagePanel: () => (/* binding */ initUserManagePanel)
/* harmony export */ });
// 04_user-manage.ts
const PERM_KEYS = ["출장승인", "출장내역관리", "출장등록", "출장내역", "사용자관리"];
/** 문자열 → number | null 공통 함수 */
function parseNumberOrNull(value) {
    if (!value)
        return null;
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}
/** 서버에서 온 row(any 형태)를 InnomaxUser 로 변환 */
function mapRawUser(row) {
    // distance_detail_json 파싱
    let distanceArr = [];
    const rawDistance = row.distance_detail_json ?? null;
    if (rawDistance) {
        let parsed = rawDistance;
        // text로 왔을 수도 있으니 파싱
        if (typeof parsed === "string") {
            try {
                parsed = JSON.parse(parsed);
            }
            catch {
                parsed = [];
            }
        }
        if (Array.isArray(parsed)) {
            distanceArr = parsed.map((r) => ({
                region: String(r.region ?? ""),
                client_name: String(r.client_name ?? ""),
                travel_time_text: String(r.travel_time_text ?? ""),
                // 예전 구조도 최대한 따라와서 km 필드로 변환
                home_distance_km: r.home_distance_km != null
                    ? Number(r.home_distance_km)
                    : r.distance_km != null
                        ? Number(r.distance_km)
                        : r.home_distance_min != null
                            ? Number(r.home_distance_min)
                            : null,
            }));
        }
    }
    // permissions: jsonb / text / null 어떤 형태로 와도 처리
    let perms = null;
    let rawPerms = row.permissions ?? null;
    if (rawPerms) {
        if (typeof rawPerms === "string") {
            try {
                rawPerms = JSON.parse(rawPerms);
            }
            catch {
                rawPerms = null;
            }
        }
        if (rawPerms && typeof rawPerms === "object" && !Array.isArray(rawPerms)) {
            perms = rawPerms;
        }
    }
    return {
        no: Number(row.no ?? row.No ?? 0),
        id: String(row.id ?? row.ID ?? ""),
        name: String(row.name ?? row.Name ?? ""),
        email: row.email ?? null,
        company_part: row.company_part ?? null,
        address: row.address ?? null,
        fuel_type: row.fuel_type ?? null,
        permissions: perms,
        distance_detail: distanceArr,
    };
}
/** 폼의 permission select 값들 → 객체로 모으기 */
function collectPermissionsFromForm() {
    const perms = {};
    PERM_KEYS.forEach((key) => {
        const el = document.getElementById(key);
        if (el)
            perms[key] = el.value;
    });
    return perms;
}
/** 폼 select 들을 주어진 permission 값으로 채우기 */
function fillPermissionSelects(perms) {
    PERM_KEYS.forEach((key) => {
        const el = document.getElementById(key);
        if (!el)
            return;
        const v = perms?.[key];
        el.value = v ? String(v) : "None";
    });
}
/** 👁 버튼용 비밀번호 표시/숨기기 */
function togglePassword() {
    const input = document.getElementById("modalPassword");
    if (!input)
        return;
    input.type = input.type === "password" ? "text" : "password";
}
// HTML에서 onclick="togglePassword()" 쓸 수 있게 전역에 올리기
window.togglePassword = togglePassword;
/**
 * ✅ DOM이 늦게 붙는(탭 전환) 구조에서 자주 null이 떠서,
 *   특정 id가 생길 때까지 몇 번 재시도하는 유틸
 */
async function waitForEl(id, tries = 30, delayMs = 100) {
    for (let i = 0; i < tries; i++) {
        const el = document.getElementById(id);
        if (el)
            return el;
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
}
function initUserManagePanel(API_BASE) {
    console.log("[사용자관리] initUserManagePanel 시작");
    // ✅ 탭 전환 구조에서 DOM이 아직 없을 수 있어서 기다렸다가 잡는다
    (async () => {
        const tbodyEl = await waitForEl("userTableBody", 40, 100);
        const userModal = document.getElementById("userModal");
        const userForm = document.getElementById("userForm");
        const modalTitle = document.getElementById("modalTitle");
        const modalMode = document.getElementById("modalMode"); // add / edit
        const modalNo = document.getElementById("modalNo");
        const inputName = document.getElementById("modalName");
        const inputID = document.getElementById("modalID");
        const inputPassword = document.getElementById("modalPassword");
        const inputEmail = document.getElementById("modalEmail");
        const inputCompany = document.getElementById("modalCompanyPart");
        const inputAddress = document.getElementById("modalAddress");
        // ✅ 유종(사용자 1개) input
        const inputFuelType = document.getElementById("modalFuelType");
        const btnAdd = document.getElementById("userAddBtn");
        const btnModalClose = document.getElementById("userModalCancelBtn");
        // 🔹 거리표 관련 DOM
        const distanceTbodyEl = document.getElementById("userDistanceTbody");
        const btnDistanceAddRow = document.getElementById("btnUserDistanceAddRow");
        // ✅ 여기서도 필수 DOM 검증
        if (!tbodyEl) {
            console.error("[사용자관리] ❌ userTableBody 를 못 찾았습니다. (HTML tbody id 확인!)");
            return;
        }
        if (!userModal || !userForm) {
            console.warn("[사용자관리] userModal 또는 userForm 을 못 찾았습니다. (모달 HTML 확인)");
            return;
        }
        const tbody = tbodyEl;
        const distanceTbody = distanceTbodyEl;
        // 이미 초기화된 경우 또 하지 않기 (사이드바 이동 시 중복 방지)
        if (tbody._bound) {
            console.debug("[사용자관리] 이미 초기화됨. (이벤트만 refresh 로 처리)");
            // ✅ 그래도 refresh 이벤트는 살아있어야 하니 아래에서 이벤트만 등록
        }
        else {
            tbody._bound = true;
        }
        // 🔹 현재 모달에서 편집 중인 거리 배열
        let distanceRows = [];
        let masterClients = [];
        // ================== 거래처 마스터 로딩 ==================
        async function loadMasterClients() {
            try {
                const res = await fetch(`${API_BASE}/api/business-master/client-list`, {
                    credentials: "include",
                });
                if (!res.ok) {
                    console.error("[사용자관리] 거래처 마스터 조회 실패 status =", res.status);
                    return;
                }
                const rows = (await res.json());
                masterClients = rows
                    .map((r) => ({
                    region: String(r.region ?? ""),
                    client_name: String(r.client_name ?? "").trim(),
                    travel_time_text: String(r.travel_time_text ?? ""),
                }))
                    .filter((c) => c.client_name)
                    .sort((a, b) => a.client_name.localeCompare(b.client_name, "ko"));
                console.log("[사용자관리] 거래처 마스터 로딩 완료, 개수 =", masterClients.length);
            }
            catch (err) {
                console.error("[사용자관리] 거래처 마스터 로딩 중 오류:", err);
            }
        }
        // ============= 거리표 렌더링/수집 함수들 =============
        /** 거리표 렌더링 */
        function renderDistanceTable() {
            if (!distanceTbody)
                return;
            distanceTbody.innerHTML = "";
            if (!distanceRows.length) {
                distanceTbody.innerHTML = `
          <tr>
            <td colspan="5" class="border px-2 py-1 text-center text-[11px] text-gray-400">
              등록된 거리 정보가 없습니다. [+ 거리 행 추가] 버튼으로 추가하세요.
            </td>
          </tr>
        `;
                return;
            }
            distanceRows.forEach((row, index) => {
                const tr = document.createElement("tr");
                tr.dataset.index = String(index);
                tr.innerHTML = `
          <td class="border px-1 py-1 text-center text-[11px]">${index + 1}</td>
          <td class="border px-1 py-1">
            <input type="text"
              class="w-full border rounded px-1 py-[2px] text-[11px] region-input"
              value="${row.region ?? ""}"
            />
          </td>
          <td class="border px-1 py-1">
            <input type="text"
              class="w-full border rounded px-1 py-[2px] text-[11px] client-input"
              value="${row.client_name ?? ""}"
            />
          </td>
          <td class="border px-1 py-1">
            <input type="text"
              class="w-full border rounded px-1 py-[2px] text-[11px] travel-time-input"
              placeholder="예: 1시간8분"
              value="${row.travel_time_text ?? ""}"
            />
          </td>
          <td class="border px-1 py-1">
            <input type="number" step="0.1"
              class="w-full border rounded px-1 py-[2px] text-right text-[11px] home-km-input"
              placeholder="자택→출장지 km"
              value="${row.home_distance_km ?? ""}"
            />
          </td>
        `;
                distanceTbody.appendChild(tr);
            });
        }
        /** 테이블 DOM → distanceRows 배열로 반영 */
        function syncDistanceRowsFromTable() {
            if (!distanceTbody)
                return;
            const trs = distanceTbody.querySelectorAll("tr");
            const newRows = [];
            trs.forEach((tr) => {
                const regionInput = tr.querySelector(".region-input");
                const clientInput = tr.querySelector(".client-input");
                const travelTimeInput = tr.querySelector(".travel-time-input");
                const homeKmInput = tr.querySelector(".home-km-input");
                // 안내문 행은 input이 없으니 스킵
                if (!clientInput)
                    return;
                const clientName = clientInput.value.trim();
                const homeKm = parseNumberOrNull(homeKmInput?.value ?? "");
                // 거래처 + 자택거리 둘 다 없으면 완전 빈줄로 보고 스킵
                if (!clientName && homeKm == null)
                    return;
                newRows.push({
                    region: regionInput?.value.trim() ?? "",
                    client_name: clientName,
                    travel_time_text: travelTimeInput?.value.trim() ?? "",
                    home_distance_km: homeKm,
                });
            });
            distanceRows = newRows;
        }
        /** 빈 행 하나 추가 */
        function addDistanceEmptyRow() {
            distanceRows.push({
                region: "",
                client_name: "",
                travel_time_text: "",
                home_distance_km: null,
            });
            renderDistanceTable();
        }
        /** 모달 열기 */
        function openModal(mode, user) {
            if (!userModal || !modalMode || !modalTitle)
                return;
            modalMode.value = mode;
            if (mode === "add") {
                modalTitle.textContent = "사용자 추가";
                if (modalNo)
                    modalNo.value = "";
                if (inputID)
                    inputID.value = "";
                if (inputName)
                    inputName.value = "";
                if (inputPassword)
                    inputPassword.value = "";
                if (inputEmail)
                    inputEmail.value = "";
                if (inputCompany)
                    inputCompany.value = "이노맥스";
                if (inputAddress)
                    inputAddress.value = "";
                if (inputFuelType)
                    inputFuelType.value = "";
                fillPermissionSelects(null);
                distanceRows =
                    masterClients.length > 0
                        ? masterClients.map((c) => ({
                            region: c.region,
                            client_name: c.client_name,
                            travel_time_text: c.travel_time_text,
                            home_distance_km: null,
                        }))
                        : [];
            }
            else {
                modalTitle.textContent = "사용자 수정";
                if (user && modalNo)
                    modalNo.value = String(user.no);
                if (inputID)
                    inputID.value = user?.id ?? "";
                if (inputName)
                    inputName.value = user?.name ?? "";
                if (inputPassword)
                    inputPassword.value = "";
                if (inputEmail)
                    inputEmail.value = user?.email ?? "";
                if (inputCompany)
                    inputCompany.value = user?.company_part ?? "이노맥스";
                if (inputAddress)
                    inputAddress.value = user?.address ?? "";
                if (inputFuelType)
                    inputFuelType.value = user?.fuel_type ?? "";
                fillPermissionSelects(user?.permissions ?? {});
                distanceRows =
                    user?.distance_detail && user.distance_detail.length
                        ? user.distance_detail
                        : masterClients.map((c) => ({
                            region: c.region,
                            client_name: c.client_name,
                            travel_time_text: c.travel_time_text,
                            home_distance_km: null,
                        }));
            }
            renderDistanceTable();
            userModal.classList.remove("hidden");
        }
        /** 모달 닫기 */
        function closeModal() {
            if (!userModal)
                return;
            userModal.classList.add("hidden");
        }
        // 모달 "취소" 버튼
        btnModalClose?.addEventListener("click", closeModal);
        // 상단 "사용자 추가" 버튼
        console.log("[사용자관리] userAddBtn =", btnAdd);
        btnAdd?.addEventListener("click", () => {
            console.log("[사용자관리] 추가 버튼 클릭");
            openModal("add");
        });
        /** 사용자 목록 다시 로딩 */
        async function loadUsers() {
            tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-3 py-2 text-center text-xs text-gray-400">
            사용자 목록 로딩 중...
          </td>
        </tr>
      `;
            try {
                const res = await fetch(`${API_BASE}/api/users`, { credentials: "include" });
                if (!res.ok)
                    throw new Error(`status = ${res.status}`);
                const rows = await res.json();
                console.log("[사용자관리] 서버 응답 =", rows);
                const users = Array.isArray(rows) ? rows.map(mapRawUser) : [];
                if (!users.length) {
                    tbody.innerHTML = `
            <tr>
              <td colspan="8" class="px-3 py-2 text-center text-xs text-gray-400">
                등록된 사용자가 없습니다.
              </td>
            </tr>
          `;
                    return;
                }
                tbody.innerHTML = "";
                users.forEach((u, idx) => {
                    const tr = document.createElement("tr");
                    tr.className = "divide-y divide-gray-200 text-xs";
                    let permText = "권한없음";
                    if (u.permissions) {
                        permText = Object.entries(u.permissions)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(", ");
                    }
                    tr.innerHTML = `
            <td class="px-3 py-2">${idx + 1}</td>
            <td class="px-3 py-2">${u.name}</td>
            <td class="px-3 py-2">${u.id}</td>
            <td class="px-3 py-2">****</td>
            <td class="px-3 py-2">${u.email ?? ""}</td>
            <td class="px-3 py-2">${u.company_part ?? ""}</td>
            <td class="px-3 py-2 text-center">${permText}</td>
            <td class="px-3 py-2 text-center space-x-1">
              <button class="px-2 py-1 rounded bg-indigo-500 text-white text-[11px] btn-edit-user" data-no="${u.no}">
                수정
              </button>
              <button class="px-2 py-1 rounded bg-red-500 text-white text-[11px] btn-del-user" data-no="${u.no}">
                삭제
              </button>
            </td>
          `;
                    tbody.appendChild(tr);
                });
            }
            catch (err) {
                console.error("[사용자관리] 목록 로딩 실패:", err);
                tbody.innerHTML = `
          <tr>
            <td colspan="8" class="px-3 py-2 text-center text-xs text-red-500">
              목록 로딩 중 오류가 발생했습니다.
            </td>
          </tr>
        `;
            }
        }
        /** 테이블에서 수정/삭제 버튼 클릭 처리 (이벤트 위임) */
        tbody.addEventListener("click", async (e) => {
            const target = e.target;
            if (!target)
                return;
            // 수정 버튼
            if (target.classList.contains("btn-edit-user")) {
                const no = target.dataset.no;
                if (!no)
                    return;
                try {
                    const res = await fetch(`${API_BASE}/api/users/${no}`, { credentials: "include" });
                    if (!res.ok) {
                        alert("사용자 정보를 불러올 수 없습니다.");
                        return;
                    }
                    const raw = await res.json();
                    openModal("edit", mapRawUser(raw));
                }
                catch (err) {
                    console.error("[사용자관리] 단일 조회 실패:", err);
                }
            }
            // 삭제 버튼
            if (target.classList.contains("btn-del-user")) {
                const no = target.dataset.no;
                if (!no)
                    return;
                if (!confirm("정말 이 사용자를 삭제하시겠습니까?"))
                    return;
                try {
                    const res = await fetch(`${API_BASE}/api/users/${no}`, {
                        method: "DELETE",
                        credentials: "include",
                    });
                    if (!res.ok) {
                        alert("삭제 실패");
                        return;
                    }
                    await loadUsers();
                }
                catch (err) {
                    console.error("[사용자관리] 삭제 실패:", err);
                    alert("삭제 중 오류가 발생했습니다.");
                }
            }
        });
        /** 모달 안의 form submit → 추가 또는 수정 */
        userForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const mode = modalMode?.value === "edit" ? "edit" : "add";
            const no = modalNo?.value;
            const id = inputID?.value.trim() ?? "";
            const name = inputName?.value.trim() ?? "";
            const password = inputPassword?.value.trim() ?? "";
            const email = inputEmail?.value.trim() || null;
            const company_part = inputCompany?.value.trim() || null;
            const address = inputAddress?.value.trim() || null;
            const fuel_type = inputFuelType?.value.trim() || null;
            const permissions = collectPermissionsFromForm();
            syncDistanceRowsFromTable();
            if (!id || !name || (mode === "add" && !password)) {
                alert("ID, 이름, 비밀번호(추가 시)는 필수입니다.");
                return;
            }
            try {
                if (mode === "add") {
                    const res = await fetch(`${API_BASE}/api/users`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            Name: name,
                            ID: id,
                            password,
                            email,
                            company_part,
                            permissions,
                            address,
                            fuel_type,
                            distance_detail: distanceRows,
                        }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || json.ok === false) {
                        alert(json.error || "사용자 추가 실패");
                        return;
                    }
                }
                else {
                    if (!no) {
                        alert("수정 대상 사용자를 찾을 수 없습니다.");
                        return;
                    }
                    const payload = {
                        Name: name,
                        ID: id,
                        email,
                        company_part,
                        permissions,
                        address,
                        fuel_type,
                        distance_detail: distanceRows,
                    };
                    if (password)
                        payload.password = password;
                    const res = await fetch(`${API_BASE}/api/users/${no}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || json.ok === false) {
                        alert(json.error || "사용자 수정 실패");
                        return;
                    }
                }
                closeModal();
                await loadUsers();
            }
            catch (err) {
                console.error("[사용자관리] 저장 실패:", err);
                alert("저장 중 오류가 발생했습니다.");
            }
        });
        // [+ 거리 행 추가] 버튼
        btnDistanceAddRow?.addEventListener("click", addDistanceEmptyRow);
        // ✅ 다른 곳에서 “사용자관리 다시 새로고침” 이벤트 보내면, 여기서 즉시 재로딩
        window.addEventListener("user-manage-refresh", () => {
            console.log("[사용자관리] refresh 이벤트 수신 → loadUsers()");
            loadUsers();
        });
        // 초기 데이터 로딩
        await loadMasterClients();
        await loadUsers();
    })();
}


/***/ }),

/***/ "./TypeScript/workspace/05_business-master.ts":
/*!****************************************************!*\
  !*** ./TypeScript/workspace/05_business-master.ts ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initBusinessMasterPanel: () => (/* binding */ initBusinessMasterPanel)
/* harmony export */ });
// 05_business-master.ts
// 🚗 출장업무 관리 (거리 마스터 + 유류/환율/당직자/공지 설정) 프론트 코드
// ✅ 수정본: "당직 자동 생성" = 휴일(주말+공휴일 API)만 배정 + 표 출력 + 대시보드 표도 자동 채움
// ✅ 추가 수정: F5 새로고침해도 당직표 유지(마지막 생성 결과를 duty_members_text에 같이 저장/복원)
// ✅ 추가: 휴가자 설정(등록/삭제) + 대시보드 휴가자현황 갱신 이벤트
// ✅ 추가: 휴가/당직 요약 캘린더 (월 이동 + 자동 표기)
// ======================
// 유틸
// ======================
function parseNumberOrNull(value) {
    if (!value)
        return null;
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}
function mapRawDistance(row) {
    return {
        id: row.id != null ? Number(row.id) : null,
        region: String(row.region ?? ""),
        client_name: String(row.client_name ?? ""),
        distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    };
}
function pad2(n) {
    return String(n).padStart(2, "0");
}
function ymd(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function ym(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function parseLocdateToYmd(loc) {
    const s = String(loc ?? "");
    if (!/^\d{8}$/.test(s))
        return "";
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function getDowKr(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    const map = ["일", "월", "화", "수", "목", "금", "토"];
    return map[day] ?? "";
}
function isWeekend(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    return day === 0 || day === 6;
}
function getAllDaysOfMonth(base) {
    const y = base.getFullYear();
    const m = base.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= last; i++)
        days.push(new Date(y, m, i));
    return days;
}
function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function vacTypeLabel(t) {
    if (t === "annual")
        return "연차";
    if (t === "half")
        return "반차";
    return "기타";
}
function datesBetweenInclusive(start, end) {
    const out = [];
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        out.push(ymd(d));
    }
    return out;
}
function buildVacationEvents(items) {
    const map = new Map();
    for (const it of items) {
        if (!it?.start_date || !it?.end_date)
            continue;
        const label = `${it.user_name}(${vacTypeLabel(it.vac_type)})`;
        const days = datesBetweenInclusive(it.start_date, it.end_date);
        for (const ds of days) {
            if (!map.has(ds))
                map.set(ds, []);
            map.get(ds).push({
                date: ds,
                kind: "VACATION",
                text: label,
            });
        }
    }
    return map;
}
function buildDutyEvents(assigns) {
    const map = new Map();
    for (const a of assigns) {
        if (!a?.date || !a?.name)
            continue;
        if (!map.has(a.date))
            map.set(a.date, []);
        map.get(a.date).push({
            date: a.date,
            kind: "DUTY",
            text: a.name,
        });
    }
    return map;
}
// ======================
// ✅ 당직 "표" 렌더 (월일 / 소속 / 근무자만)
// ======================
function renderDutyTable(assigns) {
    const box = document.getElementById("dutyTableBox");
    if (!box)
        return;
    if (!assigns.length) {
        box.innerHTML = `
      <div class="text-xs text-gray-400 text-center py-6">
        생성된 당직 일정이 없습니다.
      </div>
    `;
        return;
    }
    const TEAM_NAME = "S/W팀"; // ✅ 일단 고정값. 나중에 사용자 소속으로 바꿀 수 있음
    const rows = assigns
        .map((a) => {
        const mmdd = a.date.slice(5); // "01-10"
        return `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-2 text-center text-[12px] whitespace-nowrap">${mmdd}</td>
          <td class="px-3 py-2 text-center text-[12px] whitespace-nowrap">${TEAM_NAME}</td>
          <td class="px-3 py-2 text-center text-[12px] font-semibold whitespace-nowrap">${a.name}</td>
        </tr>
      `;
    })
        .join("");
    box.innerHTML = `
    <div class="border rounded-xl overflow-hidden bg-white">
      <div class="px-3 py-2 border-b text-sm font-bold text-gray-800">당직근무 일정</div>
      <div class="overflow-auto">
        <table class="w-full border-collapse text-[12px]">
          <thead class="bg-gray-50 text-gray-600">
            <tr>
              <th class="border-b px-3 py-2 text-center whitespace-nowrap w-24">월일</th>
              <th class="border-b px-3 py-2 text-center whitespace-nowrap w-28">소속</th>
              <th class="border-b px-3 py-2 text-center whitespace-nowrap">근무자</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
// ======================
// ✅ 대시보드 "휴일/당직 캘린더" 표 채우기
// ======================
function renderDashboardHolidayDuty(holidays, assignsMap) {
    const tbody = document.getElementById("dutyHolidayBody");
    if (!tbody)
        return;
    if (!holidays.length) {
        tbody.innerHTML = `
      <tr>
        <td class="px-2 py-2 text-center text-gray-400" colspan="4">표시할 휴일이 없습니다.</td>
      </tr>
    `;
        return;
    }
    tbody.innerHTML = holidays
        .map((h) => {
        const dutyName = assignsMap[h.date] ?? "-";
        const typeLabel = h.type === "공휴일"
            ? h.holidayName
                ? `공휴일(${h.holidayName})`
                : "공휴일"
            : "주말";
        return `
        <tr>
          <td class="border px-2 py-1 text-center">${h.date.slice(5)}</td>
          <td class="border px-2 py-1 text-center">${h.dow}</td>
          <td class="border px-2 py-1 text-center">${typeLabel}</td>
          <td class="border px-2 py-1 text-center font-semibold">${dutyName}</td>
        </tr>
      `;
    })
        .join("");
}
// ======================
// 메인 진입 함수
// ======================
function initBusinessMasterPanel(API_BASE) {
    console.log("[출장업무관리] initBusinessMasterPanel 시작");
    // DOM 수집
    const panel = document.getElementById("panel-출장업무-관리");
    const distanceTbodyEl = document.getElementById("distanceTbody");
    const btnConfigSave = document.getElementById("btnConfigSave");
    const btnDistanceAddRow = document.getElementById("btnDistanceAddRow");
    const btnDistanceSave = document.getElementById("btnDistanceSave");
    const inputFuelGasoline = document.getElementById("cfgFuelGasoline");
    const inputFuelDiesel = document.getElementById("cfgFuelDiesel");
    const inputFuelGas = document.getElementById("cfgFuelGas");
    const inputUsd = document.getElementById("cfgUsd");
    const inputJpy = document.getElementById("cfgJpy");
    const inputCny = document.getElementById("cfgCny");
    const textareaNotice = document.getElementById("cfgNotice");
    const dutyTbody = document.getElementById("dutyTbody");
    const btnDutyGenerateThisMonth = document.getElementById("btnDutyGenerateThisMonth") ||
        document.getElementById("btnDutyGenThisMonth");
    const dutyResultBox = document.getElementById("dutyResultBox");
    // ✅ 휴가자 설정 DOM
    const vacUserSelect = document.getElementById("vacUserSelect");
    const vacTypeSelect = document.getElementById("vacTypeSelect");
    const vacFrom = document.getElementById("vacFrom");
    const vacTo = document.getElementById("vacTo");
    const vacNote = document.getElementById("vacNote");
    const btnVacAdd = document.getElementById("btnVacAdd");
    const vacationAdminTbody = document.getElementById("vacationAdminTbody");
    const vacAdminMsg = document.getElementById("vacAdminMsg");
    // ✅ 요약 캘린더 DOM (없으면 그냥 기능만 스킵됨)
    const sumCalGrid = document.getElementById("sumCalGrid");
    const sumCalLabel = document.getElementById("sumCalLabel");
    const sumCalPrev = document.getElementById("sumCalPrev");
    const sumCalNext = document.getElementById("sumCalNext");
    function setVacMsg(msg) {
        if (vacAdminMsg)
            vacAdminMsg.textContent = msg;
    }
    if (!panel || !distanceTbodyEl) {
        console.warn("[출장업무관리] 필수 DOM(panel-출장업무-관리, distanceTbody) 없음");
        return;
    }
    if (panel._bound) {
        console.debug("[출장업무관리] 이미 초기화됨, 재바인딩 안함");
        return;
    }
    panel._bound = true;
    const distanceTbody = distanceTbodyEl;
    let distanceRows = [];
    let deletedIds = [];
    // =====================================================
    // ✅ 당직 후보/순번/마지막생성 저장 상태
    // =====================================================
    let dutyMembers = [];
    let dutyStartIndex = 0;
    // ✅ F5 복원을 위해 "마지막 생성 결과"도 저장해둠
    let dutyLastYm = ""; // "2026-01"
    let dutyLastAssigns = [];
    // =====================================================
    // ✅ 요약 캘린더 상태
    // =====================================================
    let sumYear = new Date().getFullYear();
    let sumMonth = new Date().getMonth(); // 0~11
    let cachedVacations = [];
    let cachedHolidays = []; // ✅ 추가
    let cachedDutyPreviewYm = ""; // ✅ 추가
    let cachedDutyPreviewAssigns = []; // ✅ 추가
    async function fetchVacationsAll() {
        try {
            const res = await fetch(`${API_BASE}/api/business-master/vacations`, { credentials: "include" });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok !== true)
                return [];
            return Array.isArray(json.items) ? json.items : [];
        }
        catch {
            return [];
        }
    }
    function renderSummaryCalendar() {
        if (!sumCalGrid || !sumCalLabel)
            return; // ✅ HTML 없으면 스킵
        const base = new Date(sumYear, sumMonth, 1);
        const y = base.getFullYear();
        const m = base.getMonth();
        const viewingYm = `${y}-${pad2(m + 1)}`;
        sumCalLabel.textContent = viewingYm;
        sumCalGrid.innerHTML = "";
        const first = new Date(y, m, 1);
        const lastDate = new Date(y, m + 1, 0).getDate();
        const startWeekday = first.getDay(); // 0(일)~6(토)
        // ✅ 날짜별 이벤트 맵 만들기
        const vacMap = buildVacationEvents(cachedVacations);
        // ✅ 당직은 "마지막 생성월"만 표시
        let dutyMap = new Map();
        if (dutyLastYm === viewingYm && Array.isArray(dutyLastAssigns)) {
            dutyMap = buildDutyEvents(dutyLastAssigns);
        }
        // ============================
        // ✅ 표시 제한 설정 (여기 숫자만 바꾸면 됨)
        // ============================
        const MAX_VAC_LINES = 1; // 휴가: 칸에 2명까지만 표시
        const MAX_DUTY_LINES = 1; // 당직: 칸에 1명만 표시
        function openDayDetail(dateStr, vacs, duties) {
            const modal = document.getElementById("sumCalModal");
            const title = document.getElementById("sumCalModalTitle");
            const body = document.getElementById("sumCalModalBody");
            const btnClose = document.getElementById("sumCalModalClose");
            const btnOk = document.getElementById("sumCalModalOk");
            if (!modal || !title || !body) {
                // 모달 HTML 없으면 fallback
                const lines = [];
                lines.push(`[${dateStr}]`);
                if (vacs.length) {
                    lines.push("");
                    lines.push(`휴가 (${vacs.length})`);
                    for (const v of vacs)
                        lines.push(`- ${v.text}`);
                }
                if (duties.length) {
                    lines.push("");
                    lines.push(`당직 (${duties.length})`);
                    for (const d of duties)
                        lines.push(`- ${d.text}`);
                }
                alert(lines.join("\n"));
                return;
            }
            title.textContent = `${dateStr} 상세`;
            const vacHtml = vacs.length
                ? `
      <div class="border rounded-xl overflow-hidden">
        <div class="px-3 py-2 bg-amber-50 text-amber-800 font-bold text-xs border-b">휴가 (${vacs.length})</div>
        <div class="p-3 space-y-2">
          ${vacs
                    .map((v) => `
              <div class="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs">
                휴가 ${escapeHtml(v.text)}
              </div>
            `)
                    .join("")}
        </div>
      </div>
    `
                : "";
            const dutyHtml = duties.length
                ? `
      <div class="border rounded-xl overflow-hidden">
        <div class="px-3 py-2 bg-indigo-50 text-indigo-800 font-bold text-xs border-b">당직 (${duties.length})</div>
        <div class="p-3 space-y-2">
          ${duties
                    .map((d) => `
              <div class="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-xs">
                당직 ${escapeHtml(d.text)}
              </div>
            `)
                    .join("")}
        </div>
      </div>
    `
                : "";
            body.innerHTML =
                vacHtml ||
                    dutyHtml ||
                    `<div class="text-xs text-gray-500 text-center py-6">표시할 내용이 없습니다.</div>`;
            const close = () => {
                modal.classList.add("hidden");
            };
            // ✅ 이벤트 중복방지: 기존 핸들러를 덮어씀
            if (btnClose)
                btnClose.onclick = close;
            if (btnOk)
                btnOk.onclick = close;
            // 바깥 배경 클릭 시 닫기
            modal.onclick = (e) => {
                const t = e.target;
                if (!t)
                    return;
                if (t === modal)
                    close();
                if (t.classList && t.classList.contains("bg-black/40"))
                    close();
            };
            modal.classList.remove("hidden");
        }
        function makeLine(kind, text) {
            const div = document.createElement("div");
            // ✅ truncate 제거: 이재…/권택… 원인
            // ✅ 글자는 줄바꿈 허용(셀 높이는 그대로라 넘치면 아래에서 잘림/스크롤로 제어 가능)
            div.className =
                kind === "VACATION"
                    ? "px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] leading-tight whitespace-normal break-keep"
                    : "px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] leading-tight whitespace-normal break-keep";
            div.textContent = (kind === "VACATION" ? "휴가 " : "당직 ") + text;
            return div;
        }
        function makeMore(kind, moreCount, onClick) {
            const div = document.createElement("div");
            div.className =
                kind === "VACATION"
                    ? "text-[10px] text-amber-700 underline cursor-pointer select-none"
                    : "text-[10px] text-indigo-700 underline cursor-pointer select-none";
            div.textContent = `+${moreCount}명 더보기`;
            div.addEventListener("click", (e) => {
                e.stopPropagation();
                onClick();
            });
            return div;
        }
        // ============================
        // ✅ 앞 빈칸(이전달 여백)
        // ============================
        for (let i = 0; i < startWeekday; i++) {
            const cell = document.createElement("div");
            cell.className = "min-h-[90px] border-r border-b bg-gray-50/60";
            sumCalGrid.appendChild(cell);
        }
        // ============================
        // ✅ 날짜 셀
        // ============================
        for (let day = 1; day <= lastDate; day++) {
            const ds = `${y}-${pad2(m + 1)}-${pad2(day)}`;
            const vacs = vacMap.get(ds) ?? [];
            const duties = dutyMap.get(ds) ?? [];
            const cell = document.createElement("div");
            cell.className = "min-h-[90px] border-r border-b p-1 overflow-hidden";
            cell.dataset.date = ds;
            // 날짜 숫자
            const dateDiv = document.createElement("div");
            dateDiv.className = "text-[11px] font-bold mb-1";
            dateDiv.textContent = String(day);
            // 이벤트 박스
            const evBox = document.createElement("div");
            evBox.className = "flex flex-col gap-1";
            // ✅ 휴가: 일부만 표시 + 더보기
            if (vacs.length) {
                const show = vacs.slice(0, MAX_VAC_LINES);
                for (const v of show)
                    evBox.appendChild(makeLine("VACATION", v.text));
                if (vacs.length > MAX_VAC_LINES) {
                    evBox.appendChild(makeMore("VACATION", vacs.length - MAX_VAC_LINES, () => openDayDetail(ds, vacs, duties)));
                }
            }
            // ✅ 당직: 일부만 표시 + 더보기
            if (duties.length) {
                const show = duties.slice(0, MAX_DUTY_LINES);
                for (const d of show)
                    evBox.appendChild(makeLine("DUTY", d.text));
                if (duties.length > MAX_DUTY_LINES) {
                    evBox.appendChild(makeMore("DUTY", duties.length - MAX_DUTY_LINES, () => openDayDetail(ds, vacs, duties)));
                }
            }
            // ✅ 셀 자체 클릭하면 그 날짜 상세(휴가/당직 전체) 보여주기
            cell.addEventListener("click", () => {
                if (!vacs.length && !duties.length)
                    return;
                openDayDetail(ds, vacs, duties);
            });
            cell.appendChild(dateDiv);
            cell.appendChild(evBox);
            sumCalGrid.appendChild(cell);
        }
        // ✅ 마지막 줄이 7칸이 되도록 뒤 빈칸 채우기(테두리 깨짐 방지)
        const totalCells = startWeekday + lastDate;
        const remain = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remain; i++) {
            const cell = document.createElement("div");
            cell.className = "min-h-[90px] border-r border-b bg-gray-50/30";
            sumCalGrid.appendChild(cell);
        }
    }
    async function refreshSummaryCalendar() {
        if (!sumCalGrid || !sumCalLabel)
            return; // ✅ HTML 없으면 스킵
        cachedVacations = await fetchVacationsAll();
        renderSummaryCalendar();
    }
    function renderDutyMembers() {
        if (!dutyTbody)
            return;
        if (!dutyMembers.length) {
            dutyTbody.innerHTML = `
        <tr>
          <td colspan="3" class="border px-2 py-2 text-center text-gray-400">
            후보 인원이 없습니다. (사용자관리에 먼저 등록하세요)
          </td>
        </tr>
      `;
            return;
        }
        dutyTbody.innerHTML = "";
        dutyMembers.forEach((m, idx) => {
            const tr = document.createElement("tr");
            tr.dataset.idx = String(idx);
            tr.innerHTML = `
        <td class="border-b px-2 py-2 text-center text-[11px]">${idx + 1}</td>
        <td class="border-b px-2 py-2 text-xs">${m.name}</td>
        <td class="border-b px-2 py-2 text-center">
          <button type="button"
            class="px-2 py-1 text-[11px] rounded-lg bg-red-100 text-red-700 hover:bg-red-200 btn-duty-delete">
            삭제
          </button>
        </td>
      `;
            dutyTbody.appendChild(tr);
        });
    }
    async function loadDutyMembersFromUsers() {
        if (!dutyTbody)
            return;
        dutyTbody.innerHTML = `
      <tr>
        <td colspan="3" class="border px-2 py-2 text-center text-gray-400">
          사용자 목록 로딩 중...
        </td>
      </tr>
    `;
        try {
            const res = await fetch(`${API_BASE}/api/users`, { credentials: "include" });
            if (!res.ok) {
                dutyTbody.innerHTML = `
          <tr>
            <td colspan="3" class="border px-2 py-2 text-center text-red-500">
              사용자 목록 조회 실패 (status ${res.status})
            </td>
          </tr>
        `;
                return;
            }
            const rows = await res.json();
            dutyMembers = Array.isArray(rows)
                ? rows
                    .map((u) => ({
                    no: Number(u.no ?? 0),
                    name: String(u.name ?? u.Name ?? "").trim(),
                }))
                    .filter((u) => u.no > 0 && u.name)
                    .sort((a, b) => a.no - b.no)
                : [];
            if (dutyMembers.length === 0)
                dutyStartIndex = 0;
            else
                dutyStartIndex = dutyStartIndex % dutyMembers.length;
            renderDutyMembers();
        }
        catch (err) {
            console.error("[출장업무관리] 사용자 목록 로딩 오류:", err);
            dutyTbody.innerHTML = `
        <tr>
          <td colspan="3" class="border px-2 py-2 text-center text-red-500">
            사용자 목록 로딩 중 오류
          </td>
        </tr>
      `;
        }
    }
    // =====================================================
    // ✅ 휴가자: 사용자 옵션 로딩
    // =====================================================
    async function loadVacUserOptions() {
        if (!vacUserSelect)
            return;
        try {
            const res = await fetch(`${API_BASE}/api/users`, { credentials: "include" });
            const rows = await res.json().catch(() => []);
            const list = Array.isArray(rows) ? rows : [];
            const users = list
                .map((u) => ({
                no: Number(u.no ?? u.No ?? 0),
                name: String(u.name ?? u.Name ?? "").trim(),
            }))
                .filter((u) => u.no > 0 && u.name)
                .sort((a, b) => a.no - b.no);
            vacUserSelect.innerHTML =
                `<option value="">선택</option>` +
                    users
                        .map((u) => `<option value="${u.no}" data-name="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`)
                        .join("");
        }
        catch (e) {
            console.error("[vac] load users err:", e);
            setVacMsg("사용자 목록 로딩 실패");
        }
    }
    // =====================================================
    // ✅ 휴가자: 목록 렌더/로드
    // =====================================================
    async function loadVacationList() {
        if (!vacationAdminTbody)
            return;
        vacationAdminTbody.innerHTML = `
      <tr><td colspan="6" class="border-b px-2 py-3 text-center text-gray-400">로딩 중...</td></tr>
    `;
        try {
            const res = await fetch(`${API_BASE}/api/business-master/vacations`, { credentials: "include" });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok !== true) {
                vacationAdminTbody.innerHTML = `
          <tr><td colspan="6" class="border-b px-2 py-3 text-center text-red-500">휴가 목록 조회 실패</td></tr>
        `;
                return;
            }
            const items = Array.isArray(json.items) ? json.items : [];
            if (!items.length) {
                vacationAdminTbody.innerHTML = `
          <tr><td colspan="6" class="border-b px-2 py-3 text-center text-gray-400">등록된 휴가가 없습니다.</td></tr>
        `;
                return;
            }
            vacationAdminTbody.innerHTML = items
                .map((it, idx) => {
                return `
            <tr class="hover:bg-gray-50">
              <td class="border-b px-2 py-2 text-center">${idx + 1}</td>
              <td class="border-b px-2 py-2 text-center">${escapeHtml(it.user_name)}</td>
              <td class="border-b px-2 py-2 text-center">${vacTypeLabel(it.vac_type)}</td>
              <td class="border-b px-2 py-2 text-center">${escapeHtml(it.start_date)} ~ ${escapeHtml(it.end_date)}</td>
              <td class="border-b px-2 py-2">${escapeHtml(it.note ?? "")}</td>
              <td class="border-b px-2 py-2 text-center">
                <button type="button" data-id="${it.id}"
                  class="px-2 py-1 text-[11px] rounded-lg bg-red-100 text-red-700 hover:bg-red-200 vac-del-btn">
                  삭제
                </button>
              </td>
            </tr>
          `;
            })
                .join("");
        }
        catch (e) {
            console.error("[vac] load list err:", e);
            vacationAdminTbody.innerHTML = `
        <tr><td colspan="6" class="border-b px-2 py-3 text-center text-red-500">휴가 목록 로딩 오류</td></tr>
      `;
        }
    }
    // =====================================================
    // ✅ 휴가자: 등록
    // =====================================================
    async function addVacation() {
        if (!vacUserSelect || !vacTypeSelect || !vacFrom || !vacTo)
            return;
        const user_no = vacUserSelect.value ? Number(vacUserSelect.value) : null;
        const opt = vacUserSelect.options[vacUserSelect.selectedIndex];
        const user_name = opt?.getAttribute("data-name") || opt?.textContent || "";
        const vac_type = String(vacTypeSelect.value || "annual");
        const start_date = String(vacFrom.value || "");
        const end_date = String(vacTo.value || "");
        const note = String(vacNote?.value || "");
        if (!user_no || !user_name)
            return setVacMsg("대상을 선택하세요.");
        if (!start_date || !end_date)
            return setVacMsg("시작일/종료일을 입력하세요.");
        if (start_date > end_date)
            return setVacMsg("시작일이 종료일보다 클 수 없습니다.");
        try {
            const res = await fetch(`${API_BASE}/api/business-master/vacations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_no, user_name, vac_type, start_date, end_date, note }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok !== true) {
                setVacMsg(json?.error || "휴가 등록 실패");
                return;
            }
            setVacMsg("등록 완료");
            if (vacNote)
                vacNote.value = "";
            await loadVacationList();
            // ✅ 대시보드 즉시 갱신 이벤트
            window.dispatchEvent(new CustomEvent("vacation-status-refresh"));
            // ✅ 요약 캘린더도 즉시 갱신
            refreshSummaryCalendar();
        }
        catch (e) {
            console.error("[vac] add err:", e);
            setVacMsg("휴가 등록 중 오류");
        }
    }
    // =====================================================
    // ✅ 공휴일 API + 주말 합쳐서 “휴일 리스트”
    // =====================================================
    async function fetchHolidayItemsForMonth(base) {
        const year = String(base.getFullYear());
        const month = pad2(base.getMonth() + 1);
        const days = getAllDaysOfMonth(base);
        const weekend = days
            .map((d) => ymd(d))
            .filter((ds) => isWeekend(ds))
            .map((ds) => ({
            date: ds,
            dow: getDowKr(ds),
            type: "주말",
        }));
        let apiHolidays = [];
        try {
            const res = await fetch(`${API_BASE}/api/business-master/holidays?year=${year}&month=${month}`, {
                credentials: "include",
            });
            const json = await res.json().catch(() => null);
            if (res.ok && json?.ok === true) {
                const list = Array.isArray(json.holidays) ? json.holidays : [];
                apiHolidays = list
                    .filter((h) => h && h.date)
                    .map((h) => {
                    const ds = parseLocdateToYmd(String(h.date));
                    if (!ds)
                        return null;
                    return {
                        date: ds,
                        dow: getDowKr(ds),
                        type: "공휴일",
                        holidayName: String(h.name ?? "").trim() || undefined,
                    };
                })
                    .filter(Boolean);
            }
        }
        catch (e) {
            console.warn("[휴일] 공휴일 API 실패(주말만으로 진행):", e);
        }
        const map = new Map();
        weekend.forEach((w) => map.set(w.date, w));
        apiHolidays.forEach((h) => map.set(h.date, h));
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
    // =====================================================
    // ✅ “이번달” 당직 자동 생성 (휴일만)
    // =====================================================
    async function generateDutyForCurrentMonth() {
        if (!dutyMembers.length) {
            alert("당직 후보가 없습니다. 사용자관리에서 먼저 등록하세요.");
            return;
        }
        const base = new Date();
        base.setDate(1);
        const holidays = await fetchHolidayItemsForMonth(base);
        if (!holidays.length) {
            alert("이번 달에 휴일(주말/공휴일)이 없습니다. (표시할 데이터 없음)");
            renderDutyTable([]);
            renderDashboardHolidayDuty([], {});
            return;
        }
        const assigns = [];
        const assignsMap = {};
        let idx = dutyStartIndex;
        for (const h of holidays) {
            const name = dutyMembers[idx].name;
            assigns.push({ date: h.date, name });
            assignsMap[h.date] = name;
            idx = (idx + 1) % dutyMembers.length;
        }
        dutyStartIndex = idx;
        // ✅ F5 복원을 위한 "마지막 생성 결과" 저장
        dutyLastYm = ym(base);
        dutyLastAssigns = assigns;
        if (dutyResultBox) {
            const first = assigns[0];
            const last = assigns[assigns.length - 1];
            dutyResultBox.innerHTML = `
        - 생성 월: ${ym(base)}<br/>
        - 휴일 수(주말+공휴일): ${assigns.length}일<br/>
        - 시작: ${first.date} (${first.name})<br/>
        - 마지막: ${last.date} (${last.name})<br/>
        - 다음 시작번호(자동): ${dutyStartIndex + 1}번
      `;
        }
        renderDutyTable(assigns);
        renderDashboardHolidayDuty(holidays, assignsMap);
        // ✅ 생성 후 저장(순번 + 마지막생성결과까지 저장)
        await saveConfig(true);
        // ✅ 요약 캘린더도 즉시 갱신
        refreshSummaryCalendar();
        alert("이번달 휴일(주말+공휴일) 기준으로 당직이 생성되었습니다.");
    }
    // =====================================================
    // ✅ 설정 로딩/저장
    // =====================================================
    async function loadConfig() {
        try {
            const res = await fetch(`${API_BASE}/api/business-master/config`, { credentials: "include" });
            if (!res.ok) {
                console.error("[출장업무관리] 설정 조회 실패 status =", res.status);
                return;
            }
            const data = (await res.json());
            const gasoline = data.fuel_price_gasoline ?? data.fuel_price_per_liter ?? null;
            const diesel = data.fuel_price_diesel ?? null;
            const lpg = data.fuel_price_lpg ?? null;
            if (inputFuelGasoline)
                inputFuelGasoline.value = gasoline?.toString() ?? "";
            if (inputFuelDiesel)
                inputFuelDiesel.value = diesel?.toString() ?? "";
            if (inputFuelGas)
                inputFuelGas.value = lpg?.toString() ?? "";
            if (inputUsd)
                inputUsd.value = data.exchange_rate_usd?.toString() ?? "";
            if (inputJpy)
                inputJpy.value = data.exchange_rate_jpy?.toString() ?? "";
            if (inputCny)
                inputCny.value = data.exchange_rate_cny?.toString() ?? "";
            if (textareaNotice)
                textareaNotice.value = data.notice ?? data.note ?? "";
            // ✅ duty_members_text 복원(startIndex + lastAssigns)
            const rawDutyText = String(data.duty_members_text ?? "");
            if (rawDutyText) {
                try {
                    const parsed = JSON.parse(rawDutyText);
                    if (typeof parsed?.startIndex === "number")
                        dutyStartIndex = parsed.startIndex;
                    if (typeof parsed?.lastYm === "string")
                        dutyLastYm = parsed.lastYm;
                    if (Array.isArray(parsed?.lastAssigns)) {
                        dutyLastAssigns = parsed.lastAssigns
                            .map((a) => ({
                            date: String(a?.date ?? ""),
                            name: String(a?.name ?? ""),
                        }))
                            .filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.date) && !!a.name);
                    }
                }
                catch {
                    // 무시
                }
            }
            if (dutyResultBox) {
                dutyResultBox.textContent = "- '당직 자동 생성'을 누르면 이번달 휴일(주말+공휴일)에만 자동 배정됩니다.";
            }
            // ✅ 저장된 마지막 결과가 있으면 F5 후에도 표 복원
            if (dutyLastAssigns.length) {
                renderDutyTable(dutyLastAssigns);
            }
            else {
                renderDutyTable([]);
            }
            // ✅ 요약 캘린더: config 로드 후에도 그리기(당직 lastYm/lastAssigns 반영)
            renderSummaryCalendar();
        }
        catch (err) {
            console.error("[출장업무관리] 설정 조회 중 오류:", err);
        }
    }
    async function saveConfig(forceSilent = false) {
        // ✅ startIndex + 마지막생성결과까지 같이 저장
        const dutyStore = JSON.stringify({
            startIndex: dutyStartIndex,
            lastYm: dutyLastYm,
            lastAssigns: dutyLastAssigns,
            updatedAt: new Date().toISOString(),
        });
        const body = {
            fuel_price_gasoline: parseNumberOrNull(inputFuelGasoline?.value ?? ""),
            fuel_price_diesel: parseNumberOrNull(inputFuelDiesel?.value ?? ""),
            fuel_price_lpg: parseNumberOrNull(inputFuelGas?.value ?? ""),
            exchange_rate_usd: parseNumberOrNull(inputUsd?.value ?? ""),
            exchange_rate_jpy: parseNumberOrNull(inputJpy?.value ?? ""),
            exchange_rate_cny: parseNumberOrNull(inputCny?.value ?? ""),
            duty_members_text: dutyStore,
            notice: textareaNotice?.value ?? "",
        };
        try {
            const res = await fetch(`${API_BASE}/api/business-master/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json?.ok === false) {
                console.error("[출장업무관리] 설정 저장 실패 status =", res.status, json);
                if (!forceSilent)
                    alert(json?.error || "설정 저장 중 오류가 발생했습니다.");
                return;
            }
            if (!forceSilent)
                alert("설정이 저장되었습니다.");
        }
        catch (err) {
            console.error("[출장업무관리] 설정 저장 중 오류:", err);
            if (!forceSilent)
                alert("설정 저장 중 오류가 발생했습니다.");
        }
    }
    // =====================================================
    // ✅ 거리 마스터 로딩/표시
    // =====================================================
    async function loadDistances() {
        distanceTbody.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-2 text-center text-xs text-gray-400">
          거리 목록 로딩 중...
        </td>
      </tr>
    `;
        try {
            const res = await fetch(`${API_BASE}/api/business-master/distances`, { credentials: "include" });
            if (!res.ok) {
                console.error("[출장업무관리] 거리 목록 조회 실패 status =", res.status);
                return;
            }
            const rows = await res.json();
            distanceRows = Array.isArray(rows) ? rows.map(mapRawDistance) : [];
            deletedIds = [];
            renderDistanceTable();
        }
        catch (err) {
            console.error("[출장업무관리] 거리 목록 조회 중 오류:", err);
        }
    }
    function renderDistanceTable() {
        distanceTbody.innerHTML = "";
        if (!distanceRows.length) {
            distanceTbody.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-2 text-center text-xs text-gray-400">
            등록된 거리 정보가 없습니다. [+ 행 추가] 버튼으로 추가하세요.
          </td>
        </tr>
      `;
            return;
        }
        distanceRows.forEach((row, index) => {
            const tr = document.createElement("tr");
            tr.dataset.index = String(index);
            tr.innerHTML = `
        <td class="border-b px-2 py-2 text-center text-[11px]">${index + 1}</td>
        <td class="border-b px-2 py-2">
          <input type="text"
            class="w-full border rounded-xl px-2 py-2 text-xs region-input bg-white"
            value="${escapeHtml(row.region ?? "")}" />
        </td>
        <td class="border-b px-2 py-2">
          <input type="text"
            class="w-full border rounded-xl px-2 py-2 text-xs client-input bg-white"
            value="${escapeHtml(row.client_name ?? "")}" />
        </td>
        <td class="border-b px-2 py-2">
          <input type="number" step="0.1"
            class="w-full border rounded-xl px-2 py-2 text-right text-xs distance-km-input bg-white"
            placeholder="km"
            value="${row.distance_km ?? ""}" />
        </td>
        <td class="border-b px-2 py-2 text-center">
          <button type="button"
            class="px-2 py-1 text-[11px] rounded-lg bg-red-100 text-red-700 hover:bg-red-200 btn-row-delete">
            삭제
          </button>
        </td>
      `;
            distanceTbody.appendChild(tr);
        });
    }
    function syncDistanceFromTable() {
        const rows = distanceTbody.querySelectorAll("tr");
        rows.forEach((tr) => {
            const idxStr = tr.dataset.index;
            if (idxStr == null)
                return;
            const idx = Number(idxStr);
            const row = distanceRows[idx];
            if (!row)
                return;
            const regionInput = tr.querySelector(".region-input");
            const clientInput = tr.querySelector(".client-input");
            const distanceInput = tr.querySelector(".distance-km-input");
            row.region = regionInput?.value?.trim() ?? "";
            row.client_name = clientInput?.value?.trim() ?? "";
            row.distance_km = parseNumberOrNull(distanceInput?.value ?? "");
        });
    }
    async function saveDistances() {
        syncDistanceFromTable();
        for (const row of distanceRows) {
            if (!row.client_name || row.distance_km == null) {
                alert("거래처와 거리(km)는 반드시 입력해야 합니다.");
                return;
            }
        }
        try {
            for (const id of deletedIds) {
                if (!id)
                    continue;
                const res = await fetch(`${API_BASE}/api/business-master/distances/${id}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                if (!res.ok) {
                    console.error("[출장업무관리] 거리 삭제 실패 id=", id, "status=", res.status);
                }
            }
            deletedIds = [];
            for (const row of distanceRows) {
                const payload = {
                    region: row.region,
                    client_name: row.client_name,
                    distance_km: row.distance_km,
                };
                if (row.id == null) {
                    const res = await fetch(`${API_BASE}/api/business-master/distances`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok)
                        console.error("[출장업무관리] 거리 등록 실패 status=", res.status);
                }
                else {
                    const res = await fetch(`${API_BASE}/api/business-master/distances/${row.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok)
                        console.error("[출장업무관리] 거리 수정 실패 id=", row.id, "status=", res.status);
                }
            }
            alert("거리 마스터가 저장되었습니다.");
            await loadDistances();
        }
        catch (err) {
            console.error("[출장업무관리] 거리 저장 중 오류:", err);
            alert("거리 저장 중 오류가 발생했습니다.");
        }
    }
    function addEmptyRow() {
        distanceRows.push({
            id: null,
            region: "",
            client_name: "",
            distance_km: null,
        });
        renderDistanceTable();
    }
    // =====================================================
    // 이벤트 바인딩
    // =====================================================
    btnConfigSave?.addEventListener("click", () => saveConfig(false));
    btnDistanceAddRow?.addEventListener("click", () => addEmptyRow());
    btnDistanceSave?.addEventListener("click", () => saveDistances());
    // ✅ 휴가 등록 버튼
    btnVacAdd?.addEventListener("click", () => addVacation());
    // ✅ 휴가 삭제(테이블 클릭)
    vacationAdminTbody?.addEventListener("click", async (e) => {
        const target = e.target;
        if (!target?.classList.contains("vac-del-btn"))
            return;
        const id = Number(target.dataset.id);
        if (!Number.isFinite(id))
            return;
        try {
            const res = await fetch(`${API_BASE}/api/business-master/vacations/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok !== true) {
                setVacMsg(json?.error || "삭제 실패");
                return;
            }
            setVacMsg("삭제 완료");
            await loadVacationList();
            window.dispatchEvent(new CustomEvent("vacation-status-refresh"));
            // ✅ 요약 캘린더도 즉시 갱신
            refreshSummaryCalendar();
        }
        catch (err) {
            console.error("[vac] delete err:", err);
            setVacMsg("삭제 중 오류");
        }
    });
    distanceTbody.addEventListener("click", (e) => {
        const target = e.target;
        if (!target?.classList.contains("btn-row-delete"))
            return;
        const tr = target.closest("tr");
        if (!tr)
            return;
        const idxStr = tr.dataset.index;
        if (idxStr == null)
            return;
        const idx = Number(idxStr);
        const row = distanceRows[idx];
        if (!row)
            return;
        if (row.id != null)
            deletedIds.push(row.id);
        distanceRows.splice(idx, 1);
        renderDistanceTable();
    });
    dutyTbody?.addEventListener("click", (e) => {
        const target = e.target;
        if (!target?.classList.contains("btn-duty-delete"))
            return;
        const tr = target.closest("tr");
        if (!tr)
            return;
        const idx = Number(tr.dataset.idx);
        if (!Number.isFinite(idx))
            return;
        dutyMembers.splice(idx, 1);
        if (dutyMembers.length === 0)
            dutyStartIndex = 0;
        else
            dutyStartIndex = dutyStartIndex % dutyMembers.length;
        renderDutyMembers();
    });
    btnDutyGenerateThisMonth?.addEventListener("click", () => {
        generateDutyForCurrentMonth();
    });
    // ✅ 요약 캘린더 월 이동(HTML 있을 때만)
    sumCalPrev?.addEventListener("click", () => {
        sumMonth--;
        if (sumMonth < 0) {
            sumMonth = 11;
            sumYear--;
        }
        renderSummaryCalendar();
    });
    sumCalNext?.addEventListener("click", () => {
        sumMonth++;
        if (sumMonth > 11) {
            sumMonth = 0;
            sumYear++;
        }
        renderSummaryCalendar();
    });
    // =====================================================
    // 초기 로딩
    // =====================================================
    loadConfig().then(() => {
        loadDutyMembersFromUsers();
    });
    loadDistances();
    // ✅ 휴가 초기 로딩
    loadVacUserOptions();
    loadVacationList().then(() => {
        // ✅ 요약 캘린더 첫 표시
        refreshSummaryCalendar();
    });
}


/***/ }),

/***/ "./TypeScript/workspace/08_domestic-trip-register.ts":
/*!***********************************************************!*\
  !*** ./TypeScript/workspace/08_domestic-trip-register.ts ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDomesticTripRegisterPanel: () => (/* binding */ initDomesticTripRegisterPanel)
/* harmony export */ });
/* harmony import */ var _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/ModalUtil */ "./TypeScript/workspace/utils/ModalUtil.ts");
// TypeScript/workspace/08_domestic-trip-register.ts

function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`❌ element not found: #${id}`);
    return el;
}
function initDomesticTripRegisterPanel(API_BASE) {
    const panel = document.getElementById("panel-국내출장-출장등록");
    if (!panel)
        return;
    const saveBtn = getEl("reg_save");
    // 이미 바인딩 되었으면 재바인딩 방지
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    const resetBtn = getEl("reg_reset");
    const resultBox = getEl("reg_result");
    // 🔹 이어작성 버튼
    const continueBtn = document.getElementById("reg_continue");
    // 🔹 같은 패널 안의 정산 작성 섹션 (숨겼다가 펼칠 영역)
    const settlementSection = document.getElementById("bt_settlement_section");
    const userNameEl = document.getElementById("userName");
    const reqNameInput = getEl("bt_req_name");
    const departPlaceInput = getEl("bt_place");
    const destinationInput = getEl("bt_destination");
    const startInput = getEl("bt_start");
    const departTimeInput = getEl("bt_depart_time");
    const arriveTimeInput = getEl("bt_arrive_time");
    const purposeInput = getEl("bt_purpose");
    // 요청자 자동 채우기
    reqNameInput.value = (userNameEl?.textContent ?? "").trim() || "사용자";
    // 초기: 이어작성 버튼/정산섹션 숨김
    if (continueBtn)
        continueBtn.classList.add("hidden");
    if (settlementSection)
        settlementSection.classList.add("hidden");
    // 🔹 폼 리셋
    resetBtn.addEventListener("click", () => {
        departPlaceInput.value = "";
        destinationInput.value = "";
        startInput.value = "";
        departTimeInput.value = "";
        arriveTimeInput.value = "";
        purposeInput.value = "";
        resultBox.textContent = "";
        // 리셋 시 이어작성 버튼/정산영역 숨기기
        if (continueBtn)
            continueBtn.classList.add("hidden");
        if (settlementSection)
            settlementSection.classList.add("hidden");
    });
    // 🔹 출장 등록
    saveBtn.addEventListener("click", async () => {
        const payload = {
            trip_type: "domestic",
            req_name: reqNameInput.value.trim(),
            depart_place: departPlaceInput.value.trim(),
            destination: destinationInput.value.trim(),
            start_date: startInput.value,
            depart_time: departTimeInput.value,
            arrive_time: arriveTimeInput.value,
            purpose: purposeInput.value.trim(),
        };
        console.log("[REGISTER] payload =", payload);
        // 필수값 체크 (이제 work_start_time 없음)
        if (!payload.req_name ||
            !payload.depart_place ||
            !payload.destination ||
            !payload.start_date ||
            !payload.depart_time ||
            !payload.arrive_time ||
            !payload.purpose) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "모든 항목은 필수입니다.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "서버에 저장 중...";
            const res = await fetch(`${API_BASE}/api/business-trip/domestic`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text();
                console.error("출장등록 실패 응답:", res.status, text);
                resultBox.textContent = `❌ 서버 저장 실패: HTTP ${res.status}`;
                await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                    type: "alert",
                    title: "저장 실패",
                    message: `서버 저장에 실패했습니다.\n(HTTP ${res.status})`,
                    showOk: true,
                    showCancel: false,
                });
                if (continueBtn)
                    continueBtn.classList.add("hidden");
                if (settlementSection)
                    settlementSection.classList.add("hidden");
                return;
            }
            const data = await res.json().catch(() => null);
            console.log("출장등록 성공 응답:", data);
            // 정산 화면에서 참고할 초안 저장
            localStorage.setItem("domesticTripDraft", JSON.stringify(payload));
            resultBox.textContent = "✅ 출장 등록 완료 (서버 저장 완료)";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "출장 등록 내용이 서버에 저장되었습니다.\n[이어 정산 작성] 버튼을 눌러 정산을 작성하세요.",
                showOk: true,
                showCancel: false,
            });
            if (continueBtn)
                continueBtn.classList.remove("hidden");
            if (settlementSection) {
                settlementSection.classList.add("hidden");
            }
            localStorage.setItem("settleTargetDate", payload.start_date);
            localStorage.setItem("settleTargetReqName", payload.req_name);
            window.dispatchEvent(new Event("trip-status-refresh"));
        }
        catch (err) {
            console.error("출장등록 중 오류:", err);
            resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 실패",
                message: resultBox.textContent,
                showOk: true,
                showCancel: false,
            });
            window.dispatchEvent(new Event("trip-status-refresh"));
            if (continueBtn)
                continueBtn.classList.add("hidden");
            if (settlementSection)
                settlementSection.classList.add("hidden");
        }
        finally {
            saveBtn.disabled = false;
        }
    });
    // 🔹 이어작성 버튼 클릭 → 정산 섹션 펼치기
    continueBtn?.addEventListener("click", () => {
        const date = startInput.value;
        const name = reqNameInput.value.trim();
        if (date)
            localStorage.setItem("settleTargetDate", date);
        if (name)
            localStorage.setItem("settleTargetReqName", name);
        if (settlementSection) {
            settlementSection.classList.remove("hidden");
            settlementSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        resultBox.textContent = "✏️ 이 출장건에 대한 정산 정보를 아래에서 이어서 작성하세요.";
    });
}


/***/ }),

/***/ "./TypeScript/workspace/09_domestic-trip-settlement.ts":
/*!*************************************************************!*\
  !*** ./TypeScript/workspace/09_domestic-trip-settlement.ts ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDomesticTripSettlementPanel: () => (/* binding */ initDomesticTripSettlementPanel)
/* harmony export */ });
/* harmony import */ var _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/ModalUtil */ "./TypeScript/workspace/utils/ModalUtil.ts");
// TypeScript/workspace/09_domestic-trip-settlement.ts

function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`❌ element not found: #${id}`);
    return el;
}
function getCheckedRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked?.value ?? "";
}
/**
 * 국내출장 정산 입력 패널 초기화
 * - 00_workspace.ts 에서 initDomesticTripSettlementPanel(API_BASE)로 한 번만 호출
 */
function initDomesticTripSettlementPanel(API_BASE) {
    console.log("[정산] initDomesticTripSettlementPanel 호출");
    const section = document.getElementById("bt_settlement_section");
    if (!section) {
        console.warn("[정산] #bt_settlement_section 요소를 찾을 수 없습니다. HTML 구조를 확인하세요.");
        return;
    }
    const saveBtn = getEl("bt_save");
    // 중복 바인딩 방지
    if (saveBtn._bound) {
        console.log("[정산] 이미 바인딩된 상태이므로 다시 바인딩하지 않음");
        return;
    }
    saveBtn._bound = true;
    const resetBtn = getEl("bt_reset");
    const resultBox = getEl("bt_result");
    const workEndInput = getEl("bt_work_end_time");
    const returnTimeInput = getEl("bt_return_time");
    const returnPlaceInput = getEl("bt_return_place");
    const mealBreakfastCheck = getEl("bt_meal_breakfast");
    const mealLunchCheck = getEl("bt_meal_lunch");
    const mealDinnerCheck = getEl("bt_meal_dinner");
    const mealBreakfastOwner = getEl("bt_meal_breakfast_owner");
    const mealLunchOwner = getEl("bt_meal_lunch_owner");
    const mealDinnerOwner = getEl("bt_meal_dinner_owner");
    // 🔹 08_domestic-trip-register.ts 에서 저장해 둔 값 사용
    const baseDate = localStorage.getItem("settleTargetDate") ?? "";
    const baseReqName = localStorage.getItem("settleTargetReqName") ?? "";
    console.log("[정산] baseDate =", baseDate, "baseReqName =", baseReqName);
    // 🔹 리셋 버튼
    resetBtn.addEventListener("click", () => {
        workEndInput.value = "";
        returnTimeInput.value = "";
        returnPlaceInput.value = "";
        mealBreakfastCheck.checked = false;
        mealLunchCheck.checked = false;
        mealDinnerCheck.checked = false;
        mealBreakfastOwner.value = "";
        mealLunchOwner.value = "";
        mealDinnerOwner.value = "";
        resultBox.textContent = "정산 입력값이 초기화되었습니다.";
    });
    // 🔹 정산 저장 버튼
    saveBtn.addEventListener("click", async () => {
        console.log("[정산] 저장 버튼 클릭");
        const vehicleValue = getCheckedRadioValue("bt_vehicle");
        // 🚨 출발일/이름이 비어 있으면 어떤 건지 모름
        const trip_date = localStorage.getItem("settleTargetDate") ?? "";
        const req_name = localStorage.getItem("settleTargetReqName") ?? "";
        if (!trip_date || !req_name) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 대상 없음",
                message: "어떤 출장건에 대한 정산인지 정보가 없습니다.\n먼저 [출장등록]에서 저장 후 [이어 정산 작성]으로 들어와 주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        // 필수값 체크
        if (!workEndInput.value) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "업무 종료시간을 입력해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!returnTimeInput.value) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀시간을 입력해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!returnPlaceInput.value.trim()) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀지(회사/자택)를 입력해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!vehicleValue) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "차량(정산용)을 선택해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        const settlement = {
            work_end_time: workEndInput.value,
            return_time: returnTimeInput.value,
            return_place: returnPlaceInput.value.trim(),
            vehicle: vehicleValue,
            meals: {
                breakfast: {
                    checked: mealBreakfastCheck.checked,
                    owner: mealBreakfastOwner.value,
                },
                lunch: {
                    checked: mealLunchCheck.checked,
                    owner: mealLunchOwner.value,
                },
                dinner: {
                    checked: mealDinnerCheck.checked,
                    owner: mealDinnerOwner.value,
                },
            },
        };
        // 🧠 백엔드 /settlement 는 req_name, trip_date, detail_json 전체를 받는다.
        // detail_json 안에 settlement 를 넣어서 보내야 함.
        const detail_json = {
            settlement,
        };
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산 내용 저장 중...";
            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    req_name,
                    trip_date,
                    detail_json, // ✅ 백엔드가 기대하는 구조
                }),
            });
            console.log("[정산] 응답 status =", res.status);
            if (!res.ok) {
                const text = await res.text();
                resultBox.textContent = `❌ 정산 저장 실패: HTTP ${res.status} ${text}`;
                await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                    type: "alert",
                    title: "정산 저장 실패",
                    message: resultBox.textContent,
                    showOk: true,
                    showCancel: false,
                });
                return;
            }
            const data = await res.json().catch(() => null);
            console.log("[정산] 응답 data =", data);
            resultBox.textContent = "✅ 정산 정보가 저장되었습니다.";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 완료",
                message: "정산 정보가 성공적으로 저장되었습니다.",
                showOk: true,
                showCancel: false,
            });
            // 필요하면 초기화
            // resetBtn.click();
            // 대시보드/출장 현황 새로고침용
            window.dispatchEvent(new Event("trip-status-refresh"));
        }
        catch (err) {
            console.error("[정산] 저장 중 오류:", err);
            resultBox.textContent = `❌ 정산 저장 중 오류: ${err?.message ?? "알 수 없는 오류"}`;
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 저장 오류",
                message: resultBox.textContent,
                showOk: true,
                showCancel: false,
            });
        }
        finally {
            saveBtn.disabled = false;
        }
    });
}


/***/ }),

/***/ "./TypeScript/workspace/10_domestic-trip-history.ts":
/*!**********************************************************!*\
  !*** ./TypeScript/workspace/10_domestic-trip-history.ts ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initDomesticTripHistoryPanel: () => (/* binding */ initDomesticTripHistoryPanel)
/* harmony export */ });
// TypeScript/workspace/10_domestic-trip-history.ts
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`element not found: #${id}`);
    return el;
}
function formatYmd(isoDate) {
    const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
    if (Number.isNaN(d.getTime()))
        return "-";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
// 🌟 정산 내역 보기 패널 초기화
function initDomesticTripHistoryPanel(API_BASE) {
    const panel = document.getElementById("panel-국내출장-정산서등록");
    if (!panel)
        return;
    const searchBtn = getEl("settle_search");
    // 중복 바인딩 방지
    if (searchBtn._bound)
        return;
    searchBtn._bound = true;
    const fromInput = getEl("settle_from");
    const toInput = getEl("settle_to");
    const resultMsg = getEl("settle_result_msg");
    const tbody = getEl("settle_result_tbody");
    // 기본 날짜: 오늘
    if (!fromInput.value || !toInput.value) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        const todayStr = `${y}-${m}-${d}`;
        fromInput.value = todayStr;
        toInput.value = todayStr;
    }
    // ✅ localStorage.user 에서 로그인한 사람의 name 가져오기
    function getLoginUserName() {
        try {
            const stored = localStorage.getItem("user");
            if (!stored)
                return null;
            const user = JSON.parse(stored);
            return user?.name ?? null;
        }
        catch {
            return null;
        }
    }
    async function fetchHistory() {
        const from = fromInput.value;
        const to = toInput.value;
        if (!from || !to) {
            resultMsg.textContent = "시작일과 종료일을 모두 선택하세요.";
            return;
        }
        if (from > to) {
            resultMsg.textContent = "시작일이 종료일보다 늦을 수 없습니다.";
            return;
        }
        // ✅ 항상 로그인한 사람 이름으로만 조회
        const reqNameParam = getLoginUserName();
        if (!reqNameParam) {
            resultMsg.textContent = "로그인 정보에서 사용자 이름을 찾을 수 없습니다.";
            tbody.innerHTML = `
        <tr>
          <td colspan="7" class="border px-2 py-3 text-center text-rose-500">
            로그인 정보가 없어 정산 내역을 조회할 수 없습니다.
          </td>
        </tr>
      `;
            return;
        }
        resultMsg.textContent = "정산 내역을 조회 중입니다...";
        tbody.innerHTML = `
      <tr>
        <td colspan="7" class="border px-2 py-3 text-center text-gray-400">
          조회 중...
        </td>
      </tr>
    `;
        const qs = new URLSearchParams();
        qs.set("from", from);
        qs.set("to", to);
        qs.set("req_name", reqNameParam); // 👈 항상 로그인 사용자 이름
        try {
            const res = await fetch(`${API_BASE}/api/business-trip/settlements-range?${qs.toString()}`, { method: "GET" });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status} / ${text}`);
            }
            const json = await res.json();
            const rows = json?.data ?? [];
            if (!rows.length) {
                tbody.innerHTML = `
          <tr>
            <td colspan="7" class="border px-2 py-3 text-center text-gray-400">
              조회된 정산 내역이 없습니다.
            </td>
          </tr>
        `;
                resultMsg.textContent = "조회된 정산 내역이 없습니다.";
                return;
            }
            // 렌더링
            tbody.innerHTML = "";
            rows.forEach((row) => {
                const r = row.detail_json?.register ?? {};
                const s = row.detail_json?.settlement ?? {};
                const dateStr = formatYmd(row.trip_date);
                const name = row.req_name || "-";
                const dest = r.destination || "-";
                const depart = r.depart_time || "-";
                const arrive = r.arrive_time || "-";
                const workStart = r.work_start_time || "-";
                const workEnd = s.work_end_time || "-";
                const vehicle = s.vehicle || "-";
                const meals = s.meals || {};
                const mealStrs = [];
                if (meals.breakfast?.checked) {
                    mealStrs.push(`조식(${meals.breakfast.owner === "corp" ? "법인" : "개인"})`);
                }
                if (meals.lunch?.checked) {
                    mealStrs.push(`중식(${meals.lunch.owner === "corp" ? "법인" : "개인"})`);
                }
                if (meals.dinner?.checked) {
                    mealStrs.push(`석식(${meals.dinner.owner === "corp" ? "법인" : "개인"})`);
                }
                const mealsText = mealStrs.length ? mealStrs.join(", ") : "-";
                const tr = document.createElement("tr");
                tr.innerHTML = `
          <td class="border px-2 py-1 text-center">${dateStr}</td>
          <td class="border px-2 py-1 text-center">${name}</td>
          <td class="border px-2 py-1 text-center">${dest}</td>
          <td class="border px-2 py-1 text-center">${depart} ~ ${arrive}</td>
          <td class="border px-2 py-1 text-center">${workStart} ~ ${workEnd}</td>
          <td class="border px-2 py-1 text-center">${vehicle}</td>
          <td class="border px-2 py-1 text-center">${mealsText}</td>
        `;
                tbody.appendChild(tr);
            });
            resultMsg.textContent = `총 ${rows.length}건의 정산 내역이 조회되었습니다.`;
        }
        catch (err) {
            console.error(err);
            resultMsg.textContent = `조회 실패: ${err?.message ?? "알 수 없는 오류"}`;
            tbody.innerHTML = `
        <tr>
          <td colspan="7" class="border px-2 py-3 text-center text-rose-500">
            조회 실패: ${err?.message ?? "알 수 없는 오류"}
          </td>
        </tr>
      `;
        }
    }
    // 버튼 이벤트 연결
    searchBtn.addEventListener("click", () => {
        fetchHistory();
    });
}


/***/ }),

/***/ "./TypeScript/workspace/utils/ModalUtil.ts":
/*!*************************************************!*\
  !*** ./TypeScript/workspace/utils/ModalUtil.ts ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ModalUtil: () => (/* binding */ ModalUtil)
/* harmony export */ });
const ModalUtil = {
    el: null,
    ensureElement() {
        if (this.el)
            return this.el;
        const div = document.createElement("div");
        div.id = "globalSimpleModal";
        div.className =
            "hidden fixed inset-0 z-[9999] flex items-center justify-center bg-black/50";
        div.innerHTML = `
      <div id="modalBox" class="bg-white w-[360px] rounded-2xl p-6 shadow-xl text-center">
        <div id="modalIcon" class="text-5xl mb-4 select-none"></div>
        <h2 id="modalTitle" class="text-xl font-bold mb-2"></h2>
        <p id="modalMessage" class="text-sm text-gray-700 mb-6"></p>
        <div id="modalBtns" class="flex justify-center gap-2">
          <button id="modalCancelBtn"
            class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hidden">취소</button>
          <button id="modalOkBtn"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 hidden">확인</button>
        </div>
      </div>
    `;
        document.body.appendChild(div);
        this.el = div;
        return div;
    },
    setStyle(type) {
        const el = this.ensureElement();
        const iconEl = el.querySelector("#modalIcon");
        const titleEl = el.querySelector("#modalTitle");
        if (type === "alert") {
            iconEl.textContent = "ℹ️";
            iconEl.className = "text-5xl text-blue-600 mb-4";
            titleEl.className = "text-xl font-bold mb-2 text-blue-700";
        }
        else {
            iconEl.textContent = "⚠️";
            iconEl.className = "text-5xl text-yellow-500 mb-4";
            titleEl.className = "text-xl font-bold mb-2 text-yellow-700";
        }
    },
    /**
     * ✨ 단일 모달 호출
     * - alert → 아무 값 없음
     * - warn → boolean 반환
     */
    async show({ type = "alert", title = "알림", message = "", showOk = true, showCancel = false, }) {
        const el = this.ensureElement();
        const titleEl = el.querySelector("#modalTitle");
        const msgEl = el.querySelector("#modalMessage");
        const okBtn = el.querySelector("#modalOkBtn");
        const cancelBtn = el.querySelector("#modalCancelBtn");
        // 스타일
        this.setStyle(type);
        // 내용
        titleEl.textContent = title;
        msgEl.textContent = message;
        // 버튼 표시 여부
        okBtn.classList.toggle("hidden", !showOk);
        cancelBtn.classList.toggle("hidden", !showCancel);
        // 표시
        el.classList.remove("hidden");
        // -----------------------
        // alert 모달은 확인만 필요
        // -----------------------
        if (type === "alert") {
            return new Promise((resolve) => {
                const close = () => {
                    this.hide();
                    okBtn.removeEventListener("click", close);
                    resolve();
                };
                okBtn.addEventListener("click", close);
            });
        }
        // -----------------------
        // warn 모달은 확인/취소 필요
        // -----------------------
        return new Promise((resolve) => {
            const onOk = () => {
                cleanup();
                this.hide();
                resolve(true);
            };
            const onCancel = () => {
                cleanup();
                this.hide();
                resolve(false);
            };
            const cleanup = () => {
                okBtn.removeEventListener("click", onOk);
                cancelBtn.removeEventListener("click", onCancel);
            };
            okBtn.addEventListener("click", onOk);
            cancelBtn.addEventListener("click", onCancel);
        });
    },
    hide() {
        const el = this.ensureElement();
        el.classList.add("hidden");
    },
};


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!**********************************************!*\
  !*** ./TypeScript/workspace/00_workspace.ts ***!
  \**********************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _01_dashboard_trip_status__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./01_dashboard-trip-status */ "./TypeScript/workspace/01_dashboard-trip-status.ts");
/* harmony import */ var _02_trip_approval__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./02_trip-approval */ "./TypeScript/workspace/02_trip-approval.ts");
/* harmony import */ var _04_user_manage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./04_user-manage */ "./TypeScript/workspace/04_user-manage.ts");
/* harmony import */ var _05_business_master__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./05_business-master */ "./TypeScript/workspace/05_business-master.ts");
/* harmony import */ var _08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./08_domestic-trip-register */ "./TypeScript/workspace/08_domestic-trip-register.ts");
/* harmony import */ var _09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./09_domestic-trip-settlement */ "./TypeScript/workspace/09_domestic-trip-settlement.ts");
/* harmony import */ var _10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./10_domestic-trip-history */ "./TypeScript/workspace/10_domestic-trip-history.ts");
// TypeScript/workspace/00_workspace.ts







const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
// ✅ 로그인할 때 login.ts에서 넣어둔 값 사용
//   localStorage.setItem("loginUserId", data.id);
function getLoginUserId() {
    const id = localStorage.getItem("loginUserId");
    return id || "사용자"; // 없으면 기본 텍스트
}
/** localStorage.user 에서 전체 로그인 유저 정보 가져오기 */
function getLoginUser() {
    const raw = localStorage.getItem("user");
    if (!raw)
        return null;
    try {
        const obj = JSON.parse(raw);
        return {
            id: obj.id ?? "",
            name: obj.name ?? "",
            permissions: obj.permissions ?? null,
        };
    }
    catch {
        return null;
    }
}
/** permissions 객체에서 해당 키의 권한값 가져오기 (없으면 "NoAccess") */
function getPermValue(perms, key) {
    if (!perms)
        return "NoAccess";
    const v = perms[key];
    if (!v)
        return "NoAccess";
    return v;
}
/**
 * 패널 전환(사이드 메뉴 → 메인 패널, 제목 바꾸기)
 */
function initLocalTabNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const panels = document.querySelectorAll('[id^="panel-"]');
    const titleEl = document.getElementById("wsTitle");
    function showPanel(id) {
        // 모든 패널 숨기고
        panels.forEach((p) => p.classList.add("hidden"));
        // 대상 패널만 보이기
        const target = document.getElementById(id);
        if (target)
            target.classList.remove("hidden");
        // 사이드 버튼 스타일 토글
        navButtons.forEach((btn) => {
            const active = btn.dataset.panel === id;
            btn.classList.toggle("bg-[#7ce92f]", active);
            btn.classList.toggle("text-[#000000]", active);
            btn.classList.toggle("font-bold", active);
        });
        // 상단 제목 변경
        const curBtn = document.querySelector(`.nav-btn[data-panel="${id}"]`);
        if (curBtn && titleEl) {
            titleEl.textContent = curBtn.textContent?.trim() ?? "";
        }
    }
    // 기본은 대시보드
    showPanel("panel-dashboard");
    return showPanel;
}
// ==============================================================
// 🔵 메인 초기화
// ==============================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.debug("[INIT] workspace DOMContentLoaded");
    // 0) 로그인 유저 / 권한 정보 가져오기
    const loginUser = getLoginUser();
    const perms = loginUser?.permissions ?? null;
    const hasPermInfo = !!perms && Object.keys(perms).length > 0;
    // 기본값: 권한 정보가 아예 없으면(옛날 데이터) 일단 전부 허용
    let canAdmin = true;
    let canTripRegister = true;
    let canTripHistory = true;
    if (hasPermInfo) {
        const tripApprove = getPermValue(perms, "출장승인");
        const tripManage = getPermValue(perms, "출장내역관리");
        const tripRegister = getPermValue(perms, "출장등록");
        const tripHistory = getPermValue(perms, "출장내역");
        const userManage = getPermValue(perms, "사용자관리");
        // ✅ 관리자 전용: 출장승인 또는 출장내역관리 중 하나라도 NoAccess 가 아니면 관리자
        canAdmin =
            tripApprove !== "NoAccess" || tripManage !== "NoAccess";
        // ✅ 국내출장 → 출장등록
        canTripRegister = tripRegister !== "NoAccess";
        // ✅ 국내출장 → 출장내역
        canTripHistory = tripHistory !== "NoAccess";
    }
    // 1) 로그인한 아이디 헤더에 표시 + 아바타 텍스트
    const userId = getLoginUserId(); // 예) "권택선"
    const userNameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("avatar");
    const logoutBtn = document.getElementById("logoutBtn");
    if (userNameEl) {
        // 이름이 따로 있으면 이름, 없으면 아이디
        const displayName = loginUser?.name || userId;
        userNameEl.textContent = displayName;
    }
    if (avatarEl) {
        const base = loginUser?.name || userId;
        avatarEl.textContent = base.slice(0, 2); // 앞 2글자 정도만 동그라미 안에
    }
    // 2) 로그아웃 버튼
    logoutBtn?.addEventListener("click", async () => {
        try {
            // 세션 쿠키 정리용 (백엔드에 /api/logout 있으면 사용, 없으면 그냥 넘어감)
            await fetch(`${API_BASE}/api/logout`, {
                method: "POST",
                credentials: "include",
            }).catch(() => { });
        }
        finally {
            // 로컬 저장된 로그인 정보 삭제
            localStorage.removeItem("loginUserId");
            localStorage.removeItem("loginUserName");
            localStorage.removeItem("user");
            sessionStorage.clear();
            // 로그인 페이지로 이동 (파일 이름에 맞게 수정)
            window.location.href = "index.html";
        }
    });
    // 3) 패널 네비게이션 세팅
    const showPanel = initLocalTabNavigation();
    // 4) 대시보드(출장자 현황 + KPI) 초기화 → 서버와 연결
    (0,_01_dashboard_trip_status__WEBPACK_IMPORTED_MODULE_0__.initDashboardTripStatus)(API_BASE);
    // 5) 사이드바에서 패널 이동
    const sidebarButtons = document.querySelectorAll("#sidebar [data-panel]");
    // 🔒 관리자 전용 그룹 자체를 숨기기 (버튼/내용 둘 다)
    if (!canAdmin && hasPermInfo) {
        const adminBtn = document.getElementById("btnAdminGroup");
        const adminContent = document.getElementById("adminGroupContent");
        adminBtn?.classList.add("hidden");
        adminContent?.classList.add("hidden");
    }
    sidebarButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.panel;
            if (!id)
                return;
            // ==========================
            // 🔒 권한 체크
            // ==========================
            if (hasPermInfo) {
                // 1) 관리자 전용 패널들
                if (id === "panel-출장승인" ||
                    id === "panel-출장내역-관리" ||
                    id === "panel-사용자-관리") {
                    if (!canAdmin) {
                        alert("관리자 권한이 필요합니다.");
                        return;
                    }
                }
                // 2) 국내출장 - 출장등록
                if (id === "panel-국내출장-출장등록" && !canTripRegister) {
                    alert("출장등록 권한이 없습니다.");
                    return;
                }
                // 3) 국내출장 - 출장내역(정산 내역)
                if (id === "panel-국내출장-정산서등록" && !canTripHistory) {
                    alert("출장내역 조회 권한이 없습니다.");
                    return;
                }
            }
            // ==========================
            // 🔁 패널 전환 + 초기화
            // ==========================
            showPanel(id);
            // 대시보드 탭 클릭 → 항상 최신 데이터로 새로고침
            if (id === "panel-dashboard") {
                window.dispatchEvent(new Event("trip-status-refresh"));
            }
            // 사용자 관리 탭 (관리자 전용)
            if (id === "panel-사용자-관리") {
                await (0,_04_user_manage__WEBPACK_IMPORTED_MODULE_2__.initUserManagePanel)(API_BASE);
                console.log("[INIT] 사용자-관리 init 완료");
            }
            // 관리자 전용 - 출장 승인
            if (id === "panel-출장승인") {
                await (0,_02_trip_approval__WEBPACK_IMPORTED_MODULE_1__.initTripApprovalPanel)(API_BASE);
                console.log("[INIT] 출장승인 패널 init 완료");
            }
            // 관리자 전용 - 출장업무 관리
            if (id === "panel-출장업무-관리") {
                await (0,_05_business_master__WEBPACK_IMPORTED_MODULE_3__.initBusinessMasterPanel)(API_BASE);
                console.log("[INIT] 출장업무관리 패널 init 완료");
            }
            // 국내출장 - 출장등록 패널 → 등록 + 정산 패널 초기화
            if (id === "panel-국내출장-출장등록") {
                await (0,_08_domestic_trip_register__WEBPACK_IMPORTED_MODULE_4__.initDomesticTripRegisterPanel)(API_BASE);
                await (0,_09_domestic_trip_settlement__WEBPACK_IMPORTED_MODULE_5__.initDomesticTripSettlementPanel)(API_BASE);
                console.log("[INIT] 국내출장-출장등록 & 정산 패널 init 완료");
            }
            // 국내출장 - 출장내역(정산 내역 조회)
            if (id === "panel-국내출장-정산서등록") {
                await (0,_10_domestic_trip_history__WEBPACK_IMPORTED_MODULE_6__.initDomesticTripHistoryPanel)(API_BASE);
                console.log("[INIT] 국내출장-정산 내역 조회 패널 init 완료");
            }
            if (id === "panel-dashboard") {
                window.dispatchEvent(new Event("trip-status-refresh"));
                window.dispatchEvent(new Event("vacation-status-refresh")); // ✅ 추가
            }
        });
    });
    // 6) 처음 진입: 대시보드 패널 + 오늘 데이터 로딩
    showPanel("panel-dashboard");
    window.dispatchEvent(new Event("trip-status-refresh"));
    console.debug("[INIT] workspace 초기화 완료");
});

})();

/******/ })()
;
//# sourceMappingURL=workspace.bundle.js.map