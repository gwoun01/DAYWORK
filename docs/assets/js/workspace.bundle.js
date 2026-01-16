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
// ----------------------
// 유틸
// ----------------------
function pad2(n) {
    return String(n).padStart(2, "0");
}
function ymd(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function ym(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function todayYmd() {
    return ymd(new Date());
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
function ymdText(v) {
    if (!v)
        return "";
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
}
function vacTypeLabel(t) {
    if (t === "annual")
        return "연차";
    if (t === "half")
        return "반차";
    return "기타";
}
function isYmdStr(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
// ✅ 숫자 표시 유틸
function fmtNumber(v, fallback = "0") {
    const n = Number(v);
    if (!Number.isFinite(n))
        return fallback;
    return n.toLocaleString();
}
function setText(id, text) {
    const el = document.getElementById(id);
    if (el)
        el.textContent = text;
}
// ✅ duty 로테이션 계산용
function addMonthsToYm(ymStr, delta) {
    const [y, m] = ymStr.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + delta);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function compareYm(a, b) {
    return a.localeCompare(b);
}
function mod(n, m) {
    return ((n % m) + m) % m;
}
// ----------------------
// ✅ DOM이 늦게 생기는 문제 해결(기존 유지)
// ----------------------
async function waitForElement(id, timeoutMs = 8000) {
    const start = Date.now();
    return new Promise((resolve) => {
        const tick = () => {
            const el = document.getElementById(id);
            if (el)
                return resolve(el);
            if (Date.now() - start > timeoutMs)
                return resolve(null);
            requestAnimationFrame(tick);
        };
        tick();
    });
}
// ----------------------
// ✅ API: 휴일(주말+공휴일)
// ----------------------
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
        console.warn("[대시보드] 공휴일 API 실패(주말만 표시):", e);
    }
    // 3) 합치기(중복 제거): 공휴일 우선
    const map = new Map();
    weekend.forEach((w) => map.set(w.date, w));
    apiHolidays.forEach((h) => map.set(h.date, h));
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
// ----------------------
// ✅ API: 휴가
// ----------------------
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
// ✅ "월 기준 날짜별 휴가자 배열" map
function buildVacationMapForMonth(items, base) {
    const y = base.getFullYear();
    const m = base.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const map = {};
    for (const v of items) {
        if (!v?.user_name)
            continue;
        // ✅ start/end 정규화 (ISO -> YYYY-MM-DD)
        const sStr = ymdText(v.start_date);
        const eStr = ymdText(v.end_date);
        if (!isYmdStr(sStr) || !isYmdStr(eStr))
            continue;
        const s = new Date(sStr + "T00:00:00");
        const e = new Date(eStr + "T00:00:00");
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
            continue;
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
// ----------------------
// ✅ API: 사용자(당직 후보)
// ----------------------
async function fetchDutyMembers(API_BASE) {
    try {
        const res = await fetch(`${API_BASE}/api/users`, { credentials: "include" });
        if (!res.ok)
            return [];
        const rows = await res.json().catch(() => []);
        const list = Array.isArray(rows) ? rows : [];
        return list
            .map((u) => ({
            no: Number(u.no ?? u.No ?? 0),
            name: String(u.name ?? u.Name ?? "").trim(),
        }))
            .filter((u) => u.no > 0 && u.name)
            .sort((a, b) => a.no - b.no);
    }
    catch {
        return [];
    }
}
async function fetchBusinessMasterConfig(API_BASE) {
    try {
        const res = await fetch(`${API_BASE}/api/business-master/config`, { credentials: "include" });
        if (!res.ok)
            return null;
        const data = await res.json().catch(() => null);
        if (!data)
            return null;
        return {
            notice: typeof data.notice === "string" ? data.notice : undefined,
            note: typeof data.note === "string" ? data.note : undefined,
            km_per_liter: (data.km_per_liter ?? null),
            fuel_price_gasoline: (data.fuel_price_gasoline ?? null),
            fuel_price_diesel: (data.fuel_price_diesel ?? null),
            fuel_price_lpg: (data.fuel_price_lpg ?? null),
            exchange_rate_usd: (data.exchange_rate_usd ?? null),
            exchange_rate_jpy: (data.exchange_rate_jpy ?? null),
            exchange_rate_cny: (data.exchange_rate_cny ?? null),
        };
    }
    catch {
        return null;
    }
}
async function fetchDutyConfig(API_BASE) {
    try {
        const res = await fetch(`${API_BASE}/api/business-master/config`, { credentials: "include" });
        if (!res.ok)
            return { startIndex: 0, lastYm: "", lastAssigns: [] };
        const data = await res.json().catch(() => ({}));
        const raw = String(data?.duty_members_text ?? "");
        if (!raw)
            return { startIndex: 0, lastYm: "", lastAssigns: [] };
        try {
            const parsed = JSON.parse(raw);
            const startIndex = Number(parsed?.startIndex ?? 0);
            const lastYm = String(parsed?.lastYm ?? "");
            const lastAssigns = Array.isArray(parsed?.lastAssigns)
                ? parsed.lastAssigns
                    .map((a) => ({
                    date: String(a?.date ?? ""),
                    name: String(a?.name ?? ""),
                }))
                    .filter((a) => isYmdStr(a.date) && !!a.name)
                : [];
            return { startIndex, lastYm, lastAssigns };
        }
        catch {
            return { startIndex: 0, lastYm: "", lastAssigns: [] };
        }
    }
    catch {
        return { startIndex: 0, lastYm: "", lastAssigns: [] };
    }
}
// ✅ 회사 일정(캘린더용) 불러오기
async function fetchDashboardSchedules(API_BASE, ymStr) {
    try {
        const res = await fetch(`${API_BASE}/api/business-master/calendar-events?ym=${encodeURIComponent(ymStr)}`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok !== true)
            return [];
        return Array.isArray(json.items) ? json.items : [];
    }
    catch {
        return [];
    }
}
// ----------------------
// ✅ 대시보드: 공지/유류/환율 렌더 (추가)
// ----------------------
async function refreshDashboardTopNoticeFuelFx(API_BASE) {
    // DOM이 없을 수도 있으니(패널 전환 시) 기다렸다가 세팅
    await waitForElement("fuelUnitGasoline", 8000);
    await waitForElement("fxUsdKrw", 8000);
    const cfg = await fetchBusinessMasterConfig(API_BASE);
    if (!cfg)
        return;
    // 1) 공지(상단 공지판)
    //const noticeCard = document.querySelector("#panel-dashboard .bg-white .font-bold.text-gray-800") as HTMLElement | null;
    const noticeCard = Array.from(document.querySelectorAll("#panel-dashboard .bg-white"))
        .find((el) => (el.textContent || "").includes("공지사항 알림판")) ?? null;
    if (noticeCard) {
        let out = noticeCard.querySelector("#dashNoticeText");
        if (!out) {
            out = document.createElement("div");
            out.id = "dashNoticeText";
            out.className = "mt-3 text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words";
            // 카드 안의 첫 설명문 다음에 꽂아줌
            noticeCard.appendChild(out);
        }
        out.textContent = (cfg.notice ?? cfg.note ?? "").trim() || "-";
    }
    // 2) 유류
    setText("fuelUnitGasoline", fmtNumber(cfg.fuel_price_gasoline, "0"));
    setText("fuelUnitDiesel", fmtNumber(cfg.fuel_price_diesel, "0"));
    setText("fuelUnitGas", fmtNumber(cfg.fuel_price_lpg, "0"));
    // 전기 유류대는 아직 config에 없으니 0 유지
    // (원하면 나중에 config에 fuel_price_electric 같은 필드 추가해서 연동하면 됨)
    // 여기서는 기존 표시값 유지(없으면 0)
    const elElec = document.getElementById("fuelUnitElectric");
    if (elElec && !elElec.textContent)
        elElec.textContent = "0";
    // 기준일 표시는 “설정 저장일”이 따로 없어서 오늘로 표시(원하면 config updatedAt 저장해서 정확히 가능)
    setText("fuelPriceBaseDate", todayYmd());
    // 3) 환율
    setText("fxUsdKrw", fmtNumber(cfg.exchange_rate_usd, "0"));
    setText("fxJpyKrw", fmtNumber(cfg.exchange_rate_jpy, "0"));
    setText("fxCnyKrw", fmtNumber(cfg.exchange_rate_cny, "0"));
    setText("fxBaseDate", todayYmd());
}
// ----------------------
// ✅ 대시보드: 표(#dutyHolidayBody) 렌더 (휴일 + 당직 + 휴가)
// ----------------------
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
// ----------------------
// ✅ 대시보드: 달력 그리드(#dutyCalGrid) 렌더 (휴일/당직/휴가)
// ----------------------
function ensureDutyCalLabel() {
    let label = document.getElementById("dutyCalLabel");
    if (!label) {
        label = document.createElement("div");
        label.id = "dutyCalLabel";
        label.className = "hidden";
        document.body.appendChild(label);
    }
    const txt = (label.textContent || "").trim();
    if (!/^\d{4}-\d{2}$/.test(txt))
        label.textContent = ym(new Date());
}
function renderDashboardCalendarGrid(viewingYm, holidays, assignsMap, vacMap) {
    const grid = document.getElementById("dutyCalGrid");
    if (!grid)
        return;
    ensureDutyCalLabel();
    const label = document.getElementById("dutyCalLabel");
    if (label)
        label.textContent = viewingYm;
    const m = viewingYm.match(/^(\d{4})-(\d{2})$/);
    if (!m)
        return;
    const y = Number(m[1]);
    const mo = Number(m[2]); // 1~12
    const first = new Date(y, mo - 1, 1);
    const lastDay = new Date(y, mo, 0).getDate();
    const startDow = first.getDay(); // 0=일
    const holidayMap = new Map();
    for (const h of holidays)
        holidayMap.set(h.date, h);
    grid.innerHTML = "";
    // 앞 빈칸
    for (let i = 0; i < startDow; i++) {
        const empty = document.createElement("div");
        empty.className = "min-h-[90px] border-b border-r bg-gray-50/50";
        grid.appendChild(empty);
    }
    // 날짜 셀
    for (let d = 1; d <= lastDay; d++) {
        const key = `${y}-${pad2(mo)}-${pad2(d)}`;
        const cell = document.createElement("div");
        cell.className = "min-h-[90px] border-b border-r p-1 overflow-hidden bg-white";
        cell.dataset.date = key;
        const h = holidayMap.get(key);
        const dow = new Date(key + "T00:00:00").getDay();
        const isRed = (h && h.type === "공휴일") || dow === 0;
        const dayEl = document.createElement("div");
        dayEl.className = `text-[11px] font-bold mb-1 ${isRed ? "text-rose-600" : "text-gray-900"}`;
        dayEl.textContent = String(d);
        cell.appendChild(dayEl);
        // 휴일 배지(주말/공휴일)
        if (h) {
            const badge = document.createElement("div");
            const isHoliday = h.type === "공휴일";
            badge.className =
                "px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 " +
                    (isHoliday ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-700");
            badge.textContent = isHoliday ? (h.holidayName ? `공휴일(${h.holidayName})` : "공휴일") : "주말";
            cell.appendChild(badge);
        }
        // 휴가 1줄(+더보기)
        const vacs = vacMap[key] ?? [];
        if (vacs.length) {
            const vLine = document.createElement("div");
            vLine.className =
                "px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 bg-amber-50 text-amber-800 whitespace-normal break-keep";
            vLine.textContent = `휴가 ${vacs[0]}${vacs.length > 1 ? ` 외 ${vacs.length - 1}` : ""}`;
            cell.appendChild(vLine);
        }
        // 당직 1줄
        const dutyName = assignsMap[key] || "";
        if (dutyName) {
            const dLine = document.createElement("div");
            dLine.className =
                "px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 whitespace-normal break-keep";
            dLine.textContent = `당직 ${dutyName}`;
            cell.appendChild(dLine);
        }
        grid.appendChild(cell);
    }
    // 뒤 빈칸
    const totalCells = startDow + lastDay;
    const remain = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remain; i++) {
        const empty = document.createElement("div");
        empty.className = "min-h-[90px] border-b border-r bg-gray-50/30";
        grid.appendChild(empty);
    }
}
// ✅ 대시보드 캘린더 셀에 "일정"만 추가 표시
function appendSchedulesToDashboardCalendar(viewingYm, schedules) {
    const grid = document.getElementById("dutyCalGrid");
    if (!grid)
        return;
    const monthItems = schedules.filter((s) => s.date.startsWith(viewingYm));
    const map = new Map();
    for (const it of monthItems) {
        if (!map.has(it.date))
            map.set(it.date, []);
        map.get(it.date).push(it);
    }
    const cells = grid.querySelectorAll("div[data-date]");
    cells.forEach((cell) => {
        const date = cell.dataset.date;
        const items = map.get(date);
        if (!items?.length)
            return;
        // 🔒 중복 표시 방지
        cell.querySelectorAll(".dash-schedule").forEach((n) => n.remove());
        const first = items[0];
        const line = document.createElement("div");
        line.className =
            "dash-schedule px-1.5 py-0.5 mt-1 rounded bg-slate-50 text-slate-800 text-[10px] font-semibold";
        line.textContent = `일정 ${first.title}`;
        cell.appendChild(line);
        if (items.length > 1) {
            const more = document.createElement("div");
            more.className = "dash-schedule text-[10px] text-slate-600 underline cursor-pointer";
            more.textContent = `+${items.length - 1}건`;
            more.onclick = (e) => {
                e.stopPropagation();
                alert(`[${date}]\n\n일정:\n` + items.map((x) => `- ${x.title}`).join("\n"));
            };
            cell.appendChild(more);
        }
    });
}
// ----------------------
// ✅ 핵심: "당직생성 버튼" 없이도 현재월 당직을 자동으로 계산해서 대시보드에 그리기
// ----------------------
async function computeDutyAssignsForYm(API_BASE, viewingYm, members, cfg) {
    if (!members.length)
        return [];
    const len = members.length;
    const safeStartIndex = mod(Number(cfg.startIndex || 0), len);
    // lastYm가 없으면: 그냥 0부터 현재월 휴일 수만큼 배정(처음 사용)
    if (!/^\d{4}-\d{2}$/.test(cfg.lastYm)) {
        const [yy, mm] = viewingYm.split("-").map(Number);
        const base = new Date(yy, mm - 1, 1);
        const holidays = await fetchHolidayItemsForMonth(API_BASE, base);
        const assigns = [];
        let idx = 0;
        for (const h of holidays) {
            assigns.push({ date: h.date, name: members[idx]?.name ?? "" });
            idx = (idx + 1) % len;
        }
        return assigns.filter((a) => a.date && a.name);
    }
    // viewingYm == lastYm이고 lastAssigns가 있으면 그걸 그대로 사용(정확)
    if (compareYm(viewingYm, cfg.lastYm) === 0 && cfg.lastAssigns.length) {
        return cfg.lastAssigns;
    }
    // helper: 어떤 월의 휴일 수
    async function getHolidayCount(ymStr) {
        const [yy, mm] = ymStr.split("-").map(Number);
        const monthBase = new Date(yy, mm - 1, 1);
        const items = await fetchHolidayItemsForMonth(API_BASE, monthBase);
        return items.length;
    }
    let startIdx = 0;
    if (compareYm(viewingYm, cfg.lastYm) > 0) {
        // 미래 월: lastYm 다음달부터 누적해서 idx 이동
        let idx = safeStartIndex;
        for (let cur = addMonthsToYm(cfg.lastYm, 1); compareYm(cur, viewingYm) < 0; cur = addMonthsToYm(cur, 1)) {
            const cnt = await getHolidayCount(cur);
            idx = mod(idx + cnt, len);
        }
        startIdx = idx;
    }
    else {
        // 과거 월: 뒤로 돌리기
        let idxAfter = safeStartIndex;
        for (let cur = cfg.lastYm; compareYm(cur, addMonthsToYm(viewingYm, 1)) >= 0; cur = addMonthsToYm(cur, -1)) {
            const cnt = await getHolidayCount(cur);
            idxAfter = mod(idxAfter - cnt, len);
            if (compareYm(cur, addMonthsToYm(viewingYm, 1)) === 0)
                break;
        }
        const viewingCnt = await getHolidayCount(viewingYm);
        startIdx = mod(idxAfter - viewingCnt, len);
    }
    const [yy, mm] = viewingYm.split("-").map(Number);
    const base = new Date(yy, mm - 1, 1);
    const holidays = await fetchHolidayItemsForMonth(API_BASE, base);
    const assigns = [];
    let idx = startIdx;
    for (const h of holidays) {
        const name = members[idx]?.name;
        if (name)
            assigns.push({ date: h.date, name });
        idx = (idx + 1) % len;
    }
    return assigns;
}
// ----------------------
// ✅ 대시보드 캘린더(표+그리드) 전체 리프레시
// ----------------------
async function refreshDashboardDutyVacationCalendar(API_BASE) {
    const tbody = await waitForElement("dutyHolidayBody", 8000);
    const grid = await waitForElement("dutyCalGrid", 8000);
    if (!tbody && !grid)
        return;
    const viewingYm = ym(new Date());
    const [yy, mm] = viewingYm.split("-").map(Number);
    const base = new Date(yy, mm - 1, 1);
    // 1) 휴일
    const holidays = await fetchHolidayItemsForMonth(API_BASE, base);
    // 2) 휴가
    const vacations = await fetchVacations(API_BASE);
    const vacMap = buildVacationMapForMonth(vacations, base);
    // 3) 당직 후보 + config 기반 로테이션 계산
    const members = await fetchDutyMembers(API_BASE);
    const cfg = await fetchDutyConfig(API_BASE);
    const assigns = await computeDutyAssignsForYm(API_BASE, viewingYm, members, cfg);
    const assignsMap = {};
    for (const a of assigns)
        assignsMap[a.date] = a.name;
    // 4) 표 렌더
    renderDashboardHolidayDuty(holidays, assignsMap, vacMap);
    // 5) 그리드 렌더
    renderDashboardCalendarGrid(viewingYm, holidays, assignsMap, vacMap);
    // 6) 회사 일정 표시
    const schedules = await fetchDashboardSchedules(API_BASE, viewingYm);
    appendSchedulesToDashboardCalendar(viewingYm, schedules);
}
/* ============================================================
 * ✅ 휴가자 현황(대시보드)
 * ============================================================ */
function renderDashboardVacation(items, baseDateYmd) {
    const kpiEl = document.getElementById("kpiVacationToday");
    const tbody = document.getElementById("vacationStatusTableBody");
    if (!tbody)
        return;
    const searchInput = document.getElementById("vacationSearchInput");
    const filterSelect = document.getElementById("vacationFilterType");
    let todayItems = items.filter((v) => {
        const s = ymdText(v.start_date);
        const e = ymdText(v.end_date);
        if (!isYmdStr(s) || !isYmdStr(e))
            return false;
        return s <= baseDateYmd && baseDateYmd <= e; // YYYY-MM-DD 문자열 비교는 안전
    });
    const filter = filterSelect?.value ?? "all";
    if (filter !== "all") {
        todayItems = todayItems.filter((v) => v.vac_type === filter);
    }
    const kw = (searchInput?.value ?? "").trim().toLowerCase();
    if (kw) {
        todayItems = todayItems.filter((v) => {
            const name = (v.user_name ?? "").toLowerCase();
            const note = (v.note ?? "").toLowerCase();
            return name.includes(kw) || note.includes(kw);
        });
    }
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
        // ✅ ISO든 뭐든 무조건 YYYY-MM-DD로 잘라서 표시
        const s = ymdText(v.start_date);
        const e = ymdText(v.end_date);
        const range = s && e ? (s === e ? s : `${s} ~ ${e}`) : "-";
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
        return;
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
    if (!kpiTripEl || !tbody) {
        console.warn("[대시보드] 출장자 현황용 요소를 찾지 못했습니다.");
        return;
    }
    const tbodyEl = tbody;
    let lastItems = [];
    let currentDate;
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
                ? `<span class="px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold whitespace-nowrap">출장종료</span>`
                : `<span class="px-2 py-[2px] rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold whitespace-nowrap">출장중</span>`;
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
    // 이벤트 바인딩 (출장)
    // -----------------------------
    searchInput?.addEventListener("input", () => renderTable());
    filterSelect?.addEventListener("change", () => renderTable());
    reloadBtn?.addEventListener("click", () => loadTripStatus(currentDate));
    window.addEventListener("trip-status-refresh", () => {
        loadTripStatus(currentDate);
    });
    // ✅ 최초 로딩 (출장)
    loadTripStatus();
    // ✅ ✅ ✅ 대시보드 캘린더(휴일/당직/휴가)
    refreshDashboardDutyVacationCalendar(API_BASE);
    // ✅ ✅ ✅ 공지/유류/환율: 최초 1회 로딩
    refreshDashboardTopNoticeFuelFx(API_BASE);
    // -----------------------------
    // 이벤트 바인딩 (휴가)
    // -----------------------------
    const vacationSearchInput = document.getElementById("vacationSearchInput");
    const vacationFilterType = document.getElementById("vacationFilterType");
    const btnVacationReload = document.getElementById("btnVacationReload");
    const reloadVacation = () => loadDashboardVacation(API_BASE, todayYmd());
    vacationSearchInput?.addEventListener("input", reloadVacation);
    vacationFilterType?.addEventListener("change", reloadVacation);
    btnVacationReload?.addEventListener("click", reloadVacation);
    window.addEventListener("vacation-status-refresh", () => {
        reloadVacation();
        refreshDashboardDutyVacationCalendar(API_BASE);
    });
    // ✅ 설정/당직쪽에서 "저장됨" 이벤트 보내면 대시보드도 즉시 새로고침
    window.addEventListener("duty-config-changed", () => {
        refreshDashboardDutyVacationCalendar(API_BASE);
    });
    // ✅ ✅ ✅ 출장업무관리에서 config 저장했을 때: 공지/유류/환율 즉시 갱신
    window.addEventListener("business-config-changed", () => {
        refreshDashboardTopNoticeFuelFx(API_BASE);
    });
    // ✅ 휴가자 현황 최초 1회 로딩
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
/* harmony import */ var _utils_DistanceCalc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/DistanceCalc */ "./TypeScript/workspace/utils/DistanceCalc.ts");
// src/TypeScript/workspace/02_trip-approval.ts

function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`element not found: #${id}`);
    return el;
}
/** ISO 날짜/문자열 → YYYY-MM-DD */
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
const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
function formatDateWithDow(value) {
    const ymd = formatDateLabel(value);
    const d = new Date(ymd);
    if (Number.isNaN(d.getTime()))
        return ymd;
    return `${ymd}(${DOW_KR[d.getDay()]})`;
}
/** 특정 날짜가 속한 주(월~일) */
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
/** ✅ 주간 상태 계산 */
function calcWeekStatus(rows) {
    const anyRejected = rows.some((r) => String(r.approve_status ?? "pending") === "rejected");
    if (anyRejected)
        return "rejected";
    const allApproved = rows.every((r) => String(r.approve_status ?? "pending") === "approved");
    if (allApproved)
        return "approved";
    return "pending";
}
/** TripRow[] → 직원+주간 묶기 */
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
                weekStatus: "pending",
            };
            map.set(key, group);
        }
        group.rows.push(row);
    }
    const list = Array.from(map.values());
    for (const g of list)
        g.weekStatus = calcWeekStatus(g.rows);
    return list.sort((a, b) => {
        if (a.weekStart !== b.weekStart)
            return a.weekStart.localeCompare(b.weekStart);
        if (a.company_part !== b.company_part)
            return a.company_part.localeCompare(b.company_part);
        if (a.req_name !== b.req_name)
            return a.req_name.localeCompare(b.req_name);
        return a.weekStatus.localeCompare(b.weekStatus);
    });
}
const API_BASE = location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";
let currentGroup = null;
/** ✅ 차량 표준화 */
function normalizeVehicle(v) {
    const s = String(v ?? "").trim();
    if (!s)
        return "";
    if (s === "corp" || s === "corporate")
        return "corp";
    if (s === "personal")
        return "personal";
    if (s === "other" || s === "other_personal")
        return "other";
    if (s === "public")
        return "public";
    return "other";
}
/** ✅ 차량 표시 라벨 */
function vehicleLabel(v) {
    const code = normalizeVehicle(v);
    if (code === "corp")
        return "법인";
    if (code === "personal")
        return "개인";
    if (code === "public")
        return "대중교통";
    if (code === "other")
        return "기타";
    return "-";
}
/* =========================
   시간/근무/잔업/일비 유틸
========================= */
function parseHHMMToMinutes(hhmm) {
    const s = String(hhmm ?? "").trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m)
        return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm))
        return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
        return null;
    return hh * 60 + mm;
}
function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0)
        return `${h}시간`;
    return `${h}시간 ${m}분`;
}
/** 업무시간(분) 계산: start~end (자정 넘어가면 +24h) */
function calcWorkMinutes(startHHMM, endHHMM) {
    const s = parseHHMMToMinutes(startHHMM);
    const e = parseHHMMToMinutes(endHHMM);
    if (s == null || e == null)
        return null;
    let diff = e - s;
    if (diff < 0)
        diff += 24 * 60;
    return diff;
}
/** ✅ 직원 화면(10)과 동일 3줄 */
function buildWork3LinesForAdmin(reg, set) {
    const departStart = reg?.depart_time || "-";
    const arriveTime = reg?.arrive_time || "-";
    const returnStart = set?.work_end_time || "-";
    const returnArrive = set?.return_time || "-";
    const workStart = reg?.work_start_time || arriveTime || "-";
    const workEnd = set?.work_end_time || "-";
    const departLine = (departStart !== "-" && arriveTime !== "-")
        ? `출발 (출발시간 ${departStart} ~ 도착시간 ${arriveTime})`
        : "출발 (-)";
    const returnLine = (returnStart !== "-" && returnArrive !== "-")
        ? `복귀 (출발시간 ${returnStart} ~ 도착시간 ${returnArrive})`
        : "복귀 (-)";
    const workMins = (workStart !== "-" && workEnd !== "-") ? calcWorkMinutes(workStart, workEnd) : null;
    const workLine = (workMins != null)
        ? `업무시간 ${workStart} ~ ${workEnd} (총 ${formatDuration(workMins)})`
        : "업무시간 -";
    return { departLine, returnLine, workLine, workEnd, workMins };
}
/** ✅ 상태 라벨 */
function statusLabel(s) {
    if (s === "approved")
        return "승인";
    if (s === "rejected")
        return "반려";
    return "제출(대기)";
}
function statusBadgeClass(s) {
    if (s === "approved")
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (s === "rejected")
        return "text-rose-700 bg-rose-50 border-rose-200";
    return "text-indigo-700 bg-indigo-50 border-indigo-200";
}
function initTripApprovalPanel(_panelId) {
    const fromInput = getEl("appr_from");
    const toInput = getEl("appr_to");
    const statusSelect = getEl("appr_status");
    const searchBtn = getEl("appr_search");
    const resultMsg = getEl("appr_result_msg");
    const tbody = getEl("approve_result_tbody");
    // ✅ 중복 바인딩 방지
    if (searchBtn._bound)
        return;
    searchBtn._bound = true;
    // 기본 조회기간: 이번 주(월~일)
    const today = new Date();
    const day = (today.getDay() + 6) % 7; // 월=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    fromInput.value = monday.toISOString().slice(0, 10);
    toInput.value = sunday.toISOString().slice(0, 10);
    // ✅ 제출 이벤트가 오면 관리자 화면 자동 갱신(새로고침 X)
    function triggerAdminRefresh() {
        document.getElementById("appr_search")?.click();
    }
    window.addEventListener("trip:submitted", () => triggerAdminRefresh());
    try {
        const bc = new BroadcastChannel("trip-events");
        bc.onmessage = (ev) => {
            if (ev?.data?.type === "trip:submitted")
                triggerAdminRefresh();
        };
    }
    catch { }
    window.addEventListener("storage", (e) => {
        if (e.key === "trip:submitted")
            triggerAdminRefresh();
    });
    // 🔍 조회 버튼
    searchBtn.addEventListener("click", async () => {
        const from = fromInput.value;
        const to = toInput.value;
        const status = statusSelect.value; // all/pending/approved/rejected
        if (!from || !to) {
            alert("시작일과 종료일을 모두 선택해주세요.");
            return;
        }
        resultMsg.textContent = "조회 중입니다...";
        tbody.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-3 text-center text-gray-400">
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
            <td colspan="6" class="border px-2 py-3 text-center text-gray-400">
              조회 실패: ${json.message ?? "알 수 없는 오류"}
            </td>
          </tr>`;
                return;
            }
            // ✅ 서버가 "제출된 것만" 내려주는게 기본(백엔드에서 submitted_at IS NOT NULL)
            const rows = json.data ?? [];
            if (rows.length === 0) {
                resultMsg.textContent = "해당 기간에 제출된 정산 내역이 없습니다.";
                tbody.innerHTML = `
          <tr>
            <td colspan="6" class="border px-2 py-3 text-center text-gray-400">
              제출된 정산 내역이 없습니다.
            </td>
          </tr>`;
                return;
            }
            const groups = buildWeeklyGroups(rows);
            // 메시지: 제출된 주간/총 건
            resultMsg.textContent = `제출된 주간 ${groups.length}개 / 총 ${rows.length}건`;
            tbody.innerHTML = "";
            groups.forEach((g) => {
                const tr = document.createElement("tr");
                const tdPeriod = document.createElement("td");
                tdPeriod.className = "border px-2 py-1 text-center";
                tdPeriod.textContent = `${formatDateWithDow(g.weekStart)} ~ ${formatDateWithDow(g.weekEnd)}`;
                tr.appendChild(tdPeriod);
                const tdTeam = document.createElement("td");
                tdTeam.className = "border px-2 py-1 text-center";
                tdTeam.textContent = g.company_part ?? "-";
                tr.appendChild(tdTeam);
                const tdName = document.createElement("td");
                tdName.className = "border px-2 py-1 text-center";
                tdName.textContent = g.req_name;
                tr.appendChild(tdName);
                const tdCount = document.createElement("td");
                tdCount.className = "border px-2 py-1 text-center";
                tdCount.textContent = String(g.rows.length);
                tr.appendChild(tdCount);
                // ✅ 상태 컬럼 추가
                const tdStatus = document.createElement("td");
                tdStatus.className = "border px-2 py-1 text-center";
                tdStatus.innerHTML = `
          <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] border ${statusBadgeClass(g.weekStatus)}">
            ${statusLabel(g.weekStatus)}
          </span>
        `;
                tr.appendChild(tdStatus);
                const tdDetail = document.createElement("td");
                tdDetail.className = "border px-2 py-1 text-center";
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = "주간 상세";
                btn.className = "px-2 py-1 rounded-lg bg-indigo-500 text-white text-[11px] hover:bg-indigo-600";
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
          <td colspan="6" class="border px-2 py-3 text-center text-gray-400">
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
                if (String(row.approve_status ?? "pending") === "approved")
                    continue;
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
            if (failed > 0)
                alert(`일부(${failed}건)는 승인에 실패했습니다. 콘솔을 확인해주세요.`);
            else
                alert("해당 주간 출장 건이 모두 승인되었습니다.");
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            // ✅ 승인 후 바로 목록 갱신
            document.getElementById("appr_search")?.click();
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
                if (String(row.approve_status ?? "pending") === "rejected")
                    continue;
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
            if (failed > 0)
                alert(`일부(${failed}건)는 반려에 실패했습니다. 콘솔을 확인해주세요.`);
            else
                alert("해당 주간 출장 건이 모두 반려되었습니다.");
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            // ✅ 반려 후 바로 목록 갱신
            document.getElementById("appr_search")?.click();
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
    getEl("appr_d_name").textContent = group.req_name;
    getEl("appr_d_date").textContent =
        `${formatDateWithDow(group.weekStart)} ~ ${formatDateWithDow(group.weekEnd)}`;
    const tbody = getEl("appr_detail_tbody");
    tbody.innerHTML = "";
    const sorted = [...group.rows].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
    function td(text, cls = "border px-2 py-1 text-center") {
        const el = document.createElement("td");
        el.className = cls;
        el.textContent = text || "";
        return el;
    }
    function tdHTML(html, cls = "border px-2 py-2 text-left whitespace-normal leading-snug") {
        const el = document.createElement("td");
        el.className = cls;
        el.innerHTML = html || "";
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
    const overtimeDates = [];
    let totalDailyAllowance = 0;
    for (const row of sorted) {
        const reg = (row.detail_json?.register || row.start_data || {});
        const set = (row.detail_json?.settlement || row.end_data || {});
        const w = buildWork3LinesForAdmin(reg, set);
        // ✅ 일비: 업무 8시간(480분) 이상이면 3,000원
        if (w.workMins != null && w.workMins >= 480)
            totalDailyAllowance += 3000;
        // ✅ 잔업 알림: 업무 종료시간이 20:30 초과
        const endMin = parseHHMMToMinutes(w.workEnd);
        // 자정 이후 종료(00:00~08:30)도 잔업 처리
        const isAfter2030 = endMin != null && endMin > (20 * 60 + 30);
        const isMidnightTo0830 = endMin != null && endMin >= 0 && endMin <= (8 * 60 + 30);
        if (isAfter2030 || isMidnightTo0830) {
            overtimeDates.push(formatDateLabel(row.trip_date));
        }
        const workTimeHtml = `
      <div class="text-gray-700">${w.departLine}</div>
      <div class="text-gray-700">${w.returnLine}</div>
      <div class="font-bold text-indigo-600 mt-1">${w.workLine}</div>
    `;
        const meals = set.meals || {};
        const tr = document.createElement("tr");
        tr.appendChild(td(formatDateWithDow(row.trip_date))); // ✅ 요일 포함
        tr.appendChild(td((0,_utils_DistanceCalc__WEBPACK_IMPORTED_MODULE_0__.placeLabel)(reg.depart_place ?? "")));
        tr.appendChild(td(reg.destination ?? ""));
        tr.appendChild(tdHTML(workTimeHtml));
        tr.appendChild(td((0,_utils_DistanceCalc__WEBPACK_IMPORTED_MODULE_0__.placeLabel)(set.return_place ?? "")));
        tr.appendChild(td(vehicleLabel(set.vehicle)));
        tr.appendChild(td(mealText(meals.breakfast)));
        tr.appendChild(td(mealText(meals.lunch)));
        tr.appendChild(td(mealText(meals.dinner)));
        tr.appendChild(td(reg.purpose ?? "", "border px-2 py-1 text-left whitespace-pre-wrap"));
        tbody.appendChild(tr);
    }
    // 💰 금액 요약
    let totalMealsAmount = 0;
    let totalFuelAmount = 0;
    for (const row of group.rows) {
        const set = (row.detail_json?.settlement || row.end_data || {});
        const c = set.calc || {};
        totalMealsAmount += c.meals_personal_amount ?? 0;
        totalFuelAmount += c.fuel_amount ?? 0;
    }
    const amountBox = getEl("appr_amount_box");
    const sum = totalMealsAmount + totalFuelAmount + totalDailyAllowance;
    amountBox.textContent =
        `식대(개인) ${totalMealsAmount.toLocaleString()}원 / ` +
            `유류비 ${totalFuelAmount.toLocaleString()}원 / ` +
            `일비 ${totalDailyAllowance.toLocaleString()}원 / ` +
            `합계 ${sum.toLocaleString()}원`;
    // 승인/반려 상태 요약
    const total = group.rows.length;
    const pending = group.rows.filter((r) => String(r.approve_status ?? "pending") === "pending").length;
    const approved = group.rows.filter((r) => String(r.approve_status ?? "pending") === "approved").length;
    const rejected = group.rows.filter((r) => String(r.approve_status ?? "pending") === "rejected").length;
    const footer = getEl("appr_footer_info");
    footer.textContent = `총 ${total}건 / 대기 ${pending}건 / 승인 ${approved}건 / 반려 ${rejected}건`;
    // 의견 초기화(첫 행의 comment)
    getEl("appr_comment").value = group.rows[0]?.approve_comment ?? "";
    // ✅ 잔업 알림
    if (overtimeDates.length > 0) {
        const uniq = Array.from(new Set(overtimeDates));
        alert(`※잔업비 확인하세요\n(업무 종료시간 20:30 초과)\n- ${uniq.join(", ")}`);
    }
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
// ✅ 날짜 표시용: "2026-01-07T00:00:00.000Z" → "2026-01-07"
function ymdText(v) {
    if (!v)
        return "";
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
}
function vacTypeLabel(t) {
    if (t === "annual")
        return "연차";
    if (t === "half")
        return "반차";
    return "기타";
}
function openVacNoteModal(name, range, note) {
    alert(`[비고]\n${name}\n${range}\n\n${note}`);
}
// ✅ 월 계산 유틸(로테이션 프리뷰에 필요)
function addMonthsToYm(ymStr, delta) {
    const [y, m] = ymStr.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + delta);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function compareYm(a, b) {
    return a.localeCompare(b);
}
function mod(n, m) {
    return ((n % m) + m) % m;
}
// ✅✅✅ YYYY-MM-DD 체크(일정/필터에 사용)
function isYmd(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function datesBetweenInclusive(start, end) {
    const out = [];
    // ✅ ISO("2026-01-07T00:00:00.000Z")든 뭐든 앞 10글자만 사용
    const s0 = ymdText(start);
    const e0 = ymdText(end);
    // ✅ 유효성 체크
    if (!isYmd(s0) || !isYmd(e0))
        return out;
    if (s0 > e0)
        return out;
    const s = new Date(s0 + "T00:00:00");
    const e = new Date(e0 + "T00:00:00");
    // 혹시라도 Date가 깨지면 방어
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
        return out;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        out.push(ymd(d));
    }
    return out;
}
function buildVacationEvents(items) {
    const map = new Map();
    for (const it of items) {
        // ✅ ISO든 뭐든 앞 10글자 정규화
        const s = ymdText(it?.start_date);
        const e = ymdText(it?.end_date);
        if (!isYmd(s) || !isYmd(e))
            continue;
        const label = `${it.user_name}(${vacTypeLabel(it.vac_type)})`;
        const days = datesBetweenInclusive(s, e);
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
// ✅✅✅ 일정(캘린더 이벤트) 펼치기
function buildScheduleEvents(items) {
    const map = new Map();
    for (const it of items) {
        if (!it?.date || !isYmd(it.date))
            continue;
        const title = String(it.title ?? "").trim();
        if (!title)
            continue;
        if (!map.has(it.date))
            map.set(it.date, []);
        map.get(it.date).push({
            date: it.date,
            kind: "SCHEDULE",
            text: title,
            id: Number(it.id), // ✅ 삭제용 id
        });
    }
    return map;
}
function buildVacationMapForDash(items) {
    const map = new Map();
    for (const it of items) {
        const s = ymdText(it?.start_date);
        const e = ymdText(it?.end_date);
        if (!isYmd(s) || !isYmd(e))
            continue;
        const label = `${it.user_name}(${vacTypeLabel(it.vac_type)})`;
        const days = datesBetweenInclusive(s, e);
        for (const ds of days) {
            if (!map.has(ds))
                map.set(ds, []);
            map.get(ds).push({ kind: "VACATION", text: label });
        }
    }
    return map;
}
function buildDutyMapForDash(assigns) {
    const map = new Map();
    for (const a of assigns) {
        if (!a?.date || !a?.name)
            continue;
        if (!map.has(a.date))
            map.set(a.date, []);
        map.get(a.date).push({ kind: "DUTY", text: a.name });
    }
    return map;
}
function renderDashboardCalGrid(viewingYm, holidays, dutyAssigns, vacations) {
    const grid = document.getElementById("dutyCalGrid");
    const label = document.getElementById("dutyCalLabel");
    if (!grid || !label)
        return;
    label.textContent = viewingYm;
    const [y, m] = viewingYm.split("-").map(Number);
    if (!y || !m)
        return;
    const first = new Date(y, m - 1, 1);
    const lastDate = new Date(y, m, 0).getDate();
    const startDow = first.getDay(); // 0=일
    const holidayMap = new Map();
    for (const h of holidays)
        holidayMap.set(h.date, h);
    const vacMap = buildVacationMapForDash(vacations);
    const dutyMap = buildDutyMapForDash(dutyAssigns);
    grid.innerHTML = "";
    // 앞 빈칸
    for (let i = 0; i < startDow; i++) {
        const empty = document.createElement("div");
        empty.className = "min-h-[90px] border-b border-r bg-gray-50/50";
        grid.appendChild(empty);
    }
    // 날짜 셀
    for (let day = 1; day <= lastDate; day++) {
        const ds = `${y}-${pad2(m)}-${pad2(day)}`;
        const cell = document.createElement("div");
        cell.className = "min-h-[90px] border-b border-r p-1 overflow-hidden bg-white";
        cell.dataset.date = ds;
        const h = holidayMap.get(ds);
        const dow = new Date(ds + "T00:00:00").getDay();
        const isRed = (h && h.type === "공휴일") || dow === 0;
        const dayEl = document.createElement("div");
        dayEl.className = `text-[11px] font-bold mb-1 ${isRed ? "text-rose-600" : "text-gray-900"}`;
        dayEl.textContent = String(day);
        cell.appendChild(dayEl);
        // ✅ 휴일 뱃지(주말/공휴일)
        if (h) {
            const badge = document.createElement("div");
            const isHoliday = h.type === "공휴일";
            badge.className =
                "px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 " +
                    (isHoliday ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-700");
            badge.textContent = isHoliday
                ? h.holidayName
                    ? `공휴일(${h.holidayName})`
                    : "공휴일"
                : "주말";
            cell.appendChild(badge);
        }
        // ✅ 휴가(최대 1줄 + 더보기)
        const vacs = vacMap.get(ds) ?? [];
        if (vacs.length) {
            const v = vacs[0];
            const vLine = document.createElement("div");
            vLine.className =
                "px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 bg-amber-50 text-amber-800 whitespace-normal break-keep";
            vLine.textContent = `휴가 ${v.text}`;
            cell.appendChild(vLine);
            if (vacs.length > 1) {
                const more = document.createElement("div");
                more.className = "text-[10px] text-amber-700 underline cursor-pointer select-none";
                more.textContent = `+${vacs.length - 1}명 더보기`;
                more.onclick = (e) => {
                    e.stopPropagation();
                    alert(`[${ds}]\n\n휴가:\n` + vacs.map((x) => `- ${x.text}`).join("\n"));
                };
                cell.appendChild(more);
            }
        }
        // ✅ 당직(최대 1줄)
        const duties = dutyMap.get(ds) ?? [];
        if (duties.length) {
            const d = duties[0];
            const dLine = document.createElement("div");
            dLine.className =
                "px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 whitespace-normal break-keep";
            dLine.textContent = `당직 ${d.text}`;
            cell.appendChild(dLine);
        }
        grid.appendChild(cell);
    }
    // 뒤 빈칸
    const totalCells = startDow + lastDate;
    const remain = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remain; i++) {
        const empty = document.createElement("div");
        empty.className = "min-h-[90px] border-b border-r bg-gray-50/30";
        grid.appendChild(empty);
    }
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
    const TEAM_NAME = "S/W팀";
    const rows = assigns
        .map((a) => {
        const mmdd = a.date.slice(5);
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
// ✅ (중요) dutyCalLabel 없으면 자동 생성 + 현재월 세팅
// ======================
function ensureDutyCalLabel() {
    let label = document.getElementById("dutyCalLabel");
    // ✅ label이 HTML에 없으면 자동으로 만들어서 숨겨 둠
    if (!label) {
        label = document.createElement("div");
        label.id = "dutyCalLabel";
        label.className = "hidden";
        document.body.appendChild(label);
    }
    const txt = (label.textContent || "").trim();
    if (!/^\d{4}-\d{2}$/.test(txt)) {
        const now = new Date();
        label.textContent = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    }
}
// ======================
// ✅ 대시보드 "휴일/당직 캘린더" 표 채우기
// ✅ (수정) 표를 채운 뒤 → 달력도 자동 갱신
// ======================
function renderDashboardHolidayDuty(holidays, assignsMap) {
    const tbody = document.getElementById("dutyHolidayBody");
    if (!tbody)
        return;
    // ✅ label 없으면 만들고 현재월 세팅
    ensureDutyCalLabel();
    if (!holidays.length) {
        tbody.innerHTML = `
      <tr>
        <td class="px-2 py-2 text-center text-gray-400" colspan="4">표시할 휴일이 없습니다.</td>
      </tr>
    `;
        // ✅ 표 비어도 달력은 비운 상태로 렌더
        renderDashboardDutyCalendarFromTable();
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
    // ✅✅✅ 핵심: 표 채운 직후 달력도 갱신
    renderDashboardDutyCalendarFromTable();
}
// ======================
// ✅ 대시보드 "휴일/당직 캘린더" 달력 렌더 (표(dutyHolidayBody) → grid(dutyCalGrid))
// ✅ (수정) dutyCalLabel이 없어도 ensureDutyCalLabel로 자동 처리
// ======================
function renderDashboardDutyCalendarFromTable() {
    const grid = document.getElementById("dutyCalGrid");
    const tbody = document.getElementById("dutyHolidayBody");
    if (!grid || !tbody)
        return;
    ensureDutyCalLabel();
    const label = document.getElementById("dutyCalLabel");
    if (!label)
        return;
    const ymTxt = (label.textContent || "").trim(); // "YYYY-MM"
    const m = ymTxt.match(/^(\d{4})-(\d{2})$/);
    if (!m)
        return;
    const y = Number(m[1]);
    const mo = Number(m[2]); // 1~12
    const first = new Date(y, mo - 1, 1);
    const lastDay = new Date(y, mo, 0).getDate();
    const startDow = first.getDay(); // 0=일
    // 표에서 이벤트 읽기: key="YYYY-MM-DD" -> { typeTxt, dutyTxt }
    const eventMap = new Map();
    const rows = Array.from(tbody.querySelectorAll("tr"));
    for (const tr of rows) {
        const tds = Array.from(tr.querySelectorAll("td"));
        if (tds.length < 4)
            continue;
        const mmdd = (tds[0].textContent || "").trim(); // "01-03"
        const typeTxt = (tds[2].textContent || "").trim(); // "주말" / "공휴일(...)"
        const dutyTxt = (tds[3].textContent || "").trim(); // "홍길동" or "-"
        const md = mmdd.match(/^(\d{2})-(\d{2})$/);
        if (!md)
            continue;
        const key = `${y}-${md[1]}-${md[2]}`;
        if (!eventMap.has(key))
            eventMap.set(key, []);
        eventMap.get(key).push({ typeTxt, dutyTxt });
    }
    grid.innerHTML = "";
    // 앞 빈칸
    for (let i = 0; i < startDow; i++) {
        const empty = document.createElement("div");
        empty.className = "min-h-[90px] border-b border-r bg-gray-50/50";
        grid.appendChild(empty);
    }
    // 날짜
    for (let d = 1; d <= lastDay; d++) {
        const dd = String(d).padStart(2, "0");
        const mm = String(mo).padStart(2, "0");
        const key = `${y}-${mm}-${dd}`;
        const cell = document.createElement("div");
        cell.className = "min-h-[90px] border-b border-r p-1 overflow-hidden bg-white";
        cell.dataset.date = key;
        const dow = new Date(key + "T00:00:00").getDay();
        const isSun = dow === 0;
        const dayEl = document.createElement("div");
        dayEl.className = `text-[11px] font-bold mb-1 ${isSun ? "text-rose-600" : "text-gray-900"}`;
        dayEl.textContent = String(d);
        cell.appendChild(dayEl);
        const items = eventMap.get(key) || [];
        for (const it of items) {
            const isHoliday = it.typeTxt.includes("공휴일");
            const badge = document.createElement("div");
            badge.className =
                "px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 " +
                    (isHoliday ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-700");
            badge.textContent = it.typeTxt;
            cell.appendChild(badge);
            if (it.dutyTxt && it.dutyTxt !== "-") {
                const duty = document.createElement("div");
                duty.className = "px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700";
                duty.textContent = `당직 ${it.dutyTxt}`;
                cell.appendChild(duty);
            }
        }
        grid.appendChild(cell);
    }
    // 뒤 빈칸(7배수 맞춤)
    const totalCells = startDow + lastDay;
    const remain = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remain; i++) {
        const empty = document.createElement("div");
        empty.className = "min-h-[90px] border-b border-r bg-gray-50/30";
        grid.appendChild(empty);
    }
}
// ======================
// 메인 진입 함수
// ======================
function initBusinessMasterPanel(API_BASE) {
    console.log("[출장업무관리] initBusinessMasterPanel 시작");
    // DOM 수집
    const panel = document.getElementById("panel-출장업무-관리");
    const distanceTbodyEl = document.getElementById("distanceTbody");
    // ✅✅✅ 유류/환율 통합 저장 버튼(신규)
    const btnFuelFxSave = document.getElementById("btnFuelFxSave");
    const btnNoticeUpload = document.getElementById("btnNoticeUpload");
    const noticeUploadMsg = document.getElementById("noticeUploadMsg");
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
    // ✅ 요약 캘린더 DOM
    const sumCalGrid = document.getElementById("sumCalGrid");
    const sumCalLabel = document.getElementById("sumCalLabel");
    const sumCalPrev = document.getElementById("sumCalPrev");
    const sumCalNext = document.getElementById("sumCalNext");
    // ✅✅✅ 일정 추가 DOM (캘린더 아래)
    const calTodoDate = document.getElementById("calTodoDate");
    const calTodoText = document.getElementById("calTodoText");
    const btnCalTodoAdd = document.getElementById("btnCalTodoAdd");
    const calTodoMsg = document.getElementById("calTodoMsg");
    // ✅ 당직 후보 추가 UI
    const dutyAddSelect = document.getElementById("dutyAddSelect");
    const btnDutyAddUser = document.getElementById("btnDutyAddUser");
    function setVacMsg(msg) {
        if (vacAdminMsg)
            vacAdminMsg.textContent = msg;
    }
    function setTodoMsg(msg) {
        if (calTodoMsg)
            calTodoMsg.textContent = msg;
    }
    function setNoticeMsg(msg) {
        if (noticeUploadMsg)
            noticeUploadMsg.textContent = msg;
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
    // ✅✅✅ 통합 저장 핸들러 (유류/환율/공지/당직 등 saveConfig에 들어있는 값 저장)
    const onSave = async () => {
        await saveConfig(); // ✅ 기존 설정 저장 함수 그대로 사용
        window.dispatchEvent(new CustomEvent("business-config-changed"));
    };
    let distanceRows = [];
    let deletedIds = [];
    // =====================================================
    // ✅ 당직 후보/순번/마지막생성 저장 상태
    // =====================================================
    let dutyMembers = [];
    let dutyStartIndex = 0;
    // ✅ 사용자관리 전체 목록(삭제해도 남아있어서 다시 추가 가능)
    let allUsers = [];
    // ✅ F5 복원을 위해 "마지막 생성 결과"도 저장해둠
    let dutyLastYm = ""; // "2026-01"
    let dutyLastAssigns = [];
    // =====================================================
    // ✅ 요약 캘린더 상태
    // =====================================================
    let sumYear = new Date().getFullYear();
    let sumMonth = new Date().getMonth(); // 0~11
    let cachedVacations = [];
    let cachedHolidays = [];
    let cachedDutyPreviewYm = "";
    let cachedDutyPreviewAssigns = [];
    // ✅✅✅ 일정 캐시(현재 달)
    let cachedCalendarEvents = [];
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
    // ✅✅✅ 일정(현재 월) 가져오기
    async function fetchCalendarEvents(ymStr) {
        try {
            const res = await fetch(`${API_BASE}/api/business-master/calendar-events?ym=${ymStr}`, {
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
    // ✅✅✅ 일정 추가(등록 버튼)
    async function addCalendarTodo() {
        if (!calTodoDate || !calTodoText)
            return;
        const date = String(calTodoDate.value || "");
        const title = String(calTodoText.value || "").trim();
        if (!date)
            return setTodoMsg("날짜를 선택하세요.");
        if (!title)
            return setTodoMsg("내용을 입력하세요.");
        setTodoMsg("등록 중...");
        try {
            const res = await fetch(`${API_BASE}/api/business-master/calendar-events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ date, title }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok !== true) {
                setTodoMsg(json?.error || "등록 실패");
                return;
            }
            // 입력 초기화
            calTodoText.value = "";
            setTodoMsg("등록 완료");
            // 현재 보고있는 달 다시 로드 → 캘린더 갱신
            const base = new Date(sumYear, sumMonth, 1);
            const viewingYm = ym(base);
            cachedCalendarEvents = await fetchCalendarEvents(viewingYm);
            renderSummaryCalendar();
        }
        catch (e) {
            console.error("[calendar-events][add] err:", e);
            setTodoMsg("등록 중 오류");
        }
    }
    // ✅✅✅ 일정 삭제
    async function deleteCalendarTodo(id) {
        if (!Number.isFinite(id) || id <= 0)
            return;
        const ok = confirm("이 일정을 삭제할까요?");
        if (!ok)
            return;
        try {
            const res = await fetch(`${API_BASE}/api/business-master/calendar-events/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok !== true) {
                setTodoMsg(json?.error || "삭제 실패");
                return;
            }
            setTodoMsg("삭제 완료");
            // ✅ 현재 보고있는 달 다시 로드 → 캘린더 갱신
            const base = new Date(sumYear, sumMonth, 1);
            const viewingYm = ym(base);
            cachedCalendarEvents = await fetchCalendarEvents(viewingYm);
            renderSummaryCalendar();
        }
        catch (e) {
            console.error("[calendar-events][delete] err:", e);
            setTodoMsg("삭제 중 오류");
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
    async function uploadNoticeOnly() {
        const notice = String(textareaNotice?.value ?? "").trim();
        setNoticeMsg("업로드 중...");
        try {
            const res = await fetch(`${API_BASE}/api/business-master/notice`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ notice }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok !== true) {
                const msg = String(json?.error || "공지 업로드 실패");
                setNoticeMsg(msg);
                alert(msg);
                return;
            }
            const savedNotice = String(json.notice ?? notice);
            // ✅ 화면 메시지
            setNoticeMsg("✅ 공지 업로드 완료");
            // ✅✅✅ 완료 모달(초보용: alert이 가장 확실)
            alert("공지 올리기 완료!");
            // ✅✅✅ 대시보드 즉시 갱신(너 대시보드가 듣는 이벤트로 통일)
            // 공지/유류/환율 갱신
            window.dispatchEvent(new CustomEvent("business-config-changed"));
            // (옵션) 혹시 다른 곳에서 notice-changed 쓰고 있으면 같이 쏴도 됨
            window.dispatchEvent(new CustomEvent("notice-changed", { detail: { notice: savedNotice } }));
        }
        catch (e) {
            console.error("[notice][upload] err:", e);
            setNoticeMsg("업로드 중 오류");
            alert("업로드 중 오류");
        }
    }
    // ==========================
    // ✅ 요약 캘린더 렌더 (교체본)
    // ==========================
    function renderSummaryCalendar() {
        if (!sumCalGrid || !sumCalLabel)
            return;
        const base = new Date(sumYear, sumMonth, 1);
        const y = base.getFullYear();
        const m = base.getMonth();
        const viewingYm = `${y}-${pad2(m + 1)}`;
        sumCalLabel.textContent = viewingYm;
        sumCalGrid.innerHTML = "";
        const first = new Date(y, m, 1);
        const lastDate = new Date(y, m + 1, 0).getDate();
        const startWeekday = first.getDay(); // 0(일)~6(토)
        const vacMap = buildVacationEvents(cachedVacations);
        // ✅ 당직: 현재 보고있는 월 프리뷰(assigns)로 표시
        let dutyMap = new Map();
        if (cachedDutyPreviewYm === viewingYm && Array.isArray(cachedDutyPreviewAssigns)) {
            dutyMap = buildDutyEvents(cachedDutyPreviewAssigns);
        }
        // ✅ 일정: 현재 달 캐시로 표시
        const schMap = buildScheduleEvents(cachedCalendarEvents);
        const holidayMap = new Map();
        for (const h of cachedHolidays)
            holidayMap.set(h.date, h);
        // ✅ 표시 제한
        const MAX_VAC_LINES = 1;
        const MAX_DUTY_LINES = 1;
        const MAX_SCH_LINES = 1;
        // --------------------------
        // 모달 열기 (휴가/당직/일정 상세)
        // --------------------------
        function openDayDetail(dateStr, vacs, duties, schs) {
            const modal = document.getElementById("sumCalModal");
            const title = document.getElementById("sumCalModalTitle");
            const body = document.getElementById("sumCalModalBody");
            const btnClose = document.getElementById("sumCalModalClose");
            const btnOk = document.getElementById("sumCalModalOk");
            // ✅ 모달 DOM 없으면 alert fallback
            if (!modal || !title || !body) {
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
                if (schs.length) {
                    lines.push("");
                    lines.push(`일정 (${schs.length})`);
                    for (const s of schs)
                        lines.push(`- ${s.text}`);
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
            // ✅✅✅ 일정: 삭제 버튼 포함 (id 있을 때만)
            const schHtml = schs.length
                ? `
          <div class="border rounded-xl overflow-hidden">
            <div class="px-3 py-2 bg-slate-50 text-slate-800 font-bold text-xs border-b">일정 (${schs.length})</div>
            <div class="p-3 space-y-2">
              ${schs
                    .map((s) => {
                    const idAttr = Number.isFinite(Number(s.id)) ? `data-id="${Number(s.id)}"` : "";
                    const btn = idAttr
                        ? `<button type="button" ${idAttr}
                           class="sumcal-sch-del ml-2 px-2 py-0.5 rounded-lg bg-red-100 text-red-700 text-[11px] hover:bg-red-200">
                           삭제
                         </button>`
                        : "";
                    return `
                    <div class="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-50 text-slate-800 text-xs">
                      <div class="min-w-0 whitespace-normal break-keep">일정 ${escapeHtml(s.text)}</div>
                      <div class="shrink-0">${btn}</div>
                    </div>
                  `;
                })
                    .join("")}
            </div>
          </div>
        `
                : "";
            body.innerHTML =
                (vacHtml || dutyHtml || schHtml)
                    ? `<div class="space-y-3">${vacHtml}${dutyHtml}${schHtml}</div>`
                    : `<div class="text-xs text-gray-500 text-center py-6">표시할 내용이 없습니다.</div>`;
            // ✅✅✅ 모달 안 "일정 삭제" 이벤트(위임)
            body.onclick = (e) => {
                const t = e.target;
                if (!t)
                    return;
                if (t.classList.contains("sumcal-sch-del")) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = Number(t.dataset.id);
                    if (Number.isFinite(id) && id > 0) {
                        deleteCalendarTodo(id); // ✅ 위에 정의된 함수 호출
                    }
                }
            };
            const close = () => modal.classList.add("hidden");
            if (btnClose)
                btnClose.onclick = close;
            if (btnOk)
                btnOk.onclick = close;
            modal.onclick = (e) => {
                const t = e.target;
                if (!t)
                    return;
                if (t === modal)
                    close();
                // 오버레이를 class로 닫고 싶으면(네 HTML에 맞춰 유지)
                if (t.classList && t.classList.contains("bg-black/40"))
                    close();
            };
            modal.classList.remove("hidden");
        }
        // --------------------------
        // 셀 내부 라인
        // --------------------------
        function makeLine(kind, text) {
            const div = document.createElement("div");
            if (kind === "VACATION") {
                div.className =
                    "px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] leading-tight whitespace-normal break-keep";
                div.textContent = "휴가 " + text;
            }
            else if (kind === "DUTY") {
                div.className =
                    "px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] leading-tight whitespace-normal break-keep";
                div.textContent = "당직 " + text;
            }
            else {
                div.className =
                    "px-1.5 py-0.5 rounded bg-slate-50 text-slate-800 text-[10px] leading-tight whitespace-normal break-keep";
                div.textContent = "일정 " + text;
            }
            return div;
        }
        // --------------------------
        // ✅ 더보기 (makeMore)
        // --------------------------
        function makeMore(kind, moreCount, onClick) {
            const div = document.createElement("div");
            if (kind === "VACATION")
                div.className = "text-[10px] text-amber-700 underline cursor-pointer select-none";
            else if (kind === "DUTY")
                div.className = "text-[10px] text-indigo-700 underline cursor-pointer select-none";
            else
                div.className = "text-[10px] text-slate-700 underline cursor-pointer select-none";
            div.textContent = `+${moreCount}건 더보기`;
            div.addEventListener("click", (e) => {
                e.stopPropagation();
                onClick();
            });
            return div;
        }
        // ✅ 앞 빈칸
        for (let i = 0; i < startWeekday; i++) {
            const cell = document.createElement("div");
            cell.className = "min-h-[90px] border-r border-b bg-gray-50/60";
            sumCalGrid.appendChild(cell);
        }
        // ✅ 날짜 셀
        for (let day = 1; day <= lastDate; day++) {
            const ds = `${y}-${pad2(m + 1)}-${pad2(day)}`;
            const vacs = vacMap.get(ds) ?? [];
            const duties = dutyMap.get(ds) ?? [];
            const schs = schMap.get(ds) ?? [];
            const cell = document.createElement("div");
            cell.className = "min-h-[90px] border-r border-b p-1 overflow-hidden bg-white";
            cell.dataset.date = ds;
            const h = holidayMap.get(ds);
            const dow = new Date(ds + "T00:00:00").getDay();
            const isRed = (h && h.type === "공휴일") || dow === 0;
            const dateDiv = document.createElement("div");
            dateDiv.className = `text-[11px] font-bold mb-1 ${isRed ? "text-rose-600" : ""}`;
            dateDiv.textContent = String(day);
            const evBox = document.createElement("div");
            evBox.className = "flex flex-col gap-1";
            if (vacs.length) {
                const show = vacs.slice(0, MAX_VAC_LINES);
                for (const v of show)
                    evBox.appendChild(makeLine("VACATION", v.text));
                if (vacs.length > MAX_VAC_LINES) {
                    evBox.appendChild(makeMore("VACATION", vacs.length - MAX_VAC_LINES, () => openDayDetail(ds, vacs, duties, schs)));
                }
            }
            if (duties.length) {
                const show = duties.slice(0, MAX_DUTY_LINES);
                for (const d of show)
                    evBox.appendChild(makeLine("DUTY", d.text));
                if (duties.length > MAX_DUTY_LINES) {
                    evBox.appendChild(makeMore("DUTY", duties.length - MAX_DUTY_LINES, () => openDayDetail(ds, vacs, duties, schs)));
                }
            }
            if (schs.length) {
                const show = schs.slice(0, MAX_SCH_LINES);
                for (const s of show)
                    evBox.appendChild(makeLine("SCHEDULE", s.text));
                if (schs.length > MAX_SCH_LINES) {
                    evBox.appendChild(makeMore("SCHEDULE", schs.length - MAX_SCH_LINES, () => openDayDetail(ds, vacs, duties, schs)));
                }
            }
            // ✅ 셀 클릭: 하나라도 있으면 상세
            cell.addEventListener("click", () => {
                if (!vacs.length && !duties.length && !schs.length)
                    return;
                openDayDetail(ds, vacs, duties, schs);
            });
            cell.appendChild(dateDiv);
            cell.appendChild(evBox);
            sumCalGrid.appendChild(cell);
        }
        // ✅ 뒤 빈칸
        const totalCells = startWeekday + lastDate;
        const remain = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remain; i++) {
            const cell = document.createElement("div");
            cell.className = "min-h-[90px] border-r border-b bg-gray-50/30";
            sumCalGrid.appendChild(cell);
        }
    }
    // ✅ 요약 캘린더 리프레시(휴가 + 휴일 + 당직 로테이션 프리뷰 + ✅ 일정)
    async function refreshSummaryCalendar() {
        if (!sumCalGrid || !sumCalLabel)
            return;
        const base = new Date(sumYear, sumMonth, 1);
        const viewingYm = ym(base);
        cachedVacations = await fetchVacationsAll();
        cachedHolidays = await fetchHolidayItemsForMonth(base);
        // ✅✅✅ 일정도 월 기준으로 로드
        cachedCalendarEvents = await fetchCalendarEvents(viewingYm);
        cachedDutyPreviewYm = viewingYm;
        cachedDutyPreviewAssigns = [];
        if (!dutyMembers.length || !cachedHolidays.length) {
            renderSummaryCalendar();
            return;
        }
        if (!/^\d{4}-\d{2}$/.test(dutyLastYm))
            dutyLastYm = viewingYm;
        const len = dutyMembers.length;
        async function getHolidayCount(ymStr) {
            const [yy, mm] = ymStr.split("-").map(Number);
            const monthBase = new Date(yy, mm - 1, 1);
            const items = await fetchHolidayItemsForMonth(monthBase);
            return items.length;
        }
        let startIdx = 0;
        if (compareYm(viewingYm, dutyLastYm) === 0 && dutyLastAssigns.length) {
            cachedDutyPreviewAssigns = dutyLastAssigns;
            renderSummaryCalendar();
            return;
        }
        if (compareYm(viewingYm, dutyLastYm) > 0) {
            let idx = mod(dutyStartIndex, len);
            for (let cur = addMonthsToYm(dutyLastYm, 1); compareYm(cur, viewingYm) < 0; cur = addMonthsToYm(cur, 1)) {
                const cnt = await getHolidayCount(cur);
                idx = mod(idx + cnt, len);
            }
            startIdx = idx;
        }
        else {
            let idxAfter = mod(dutyStartIndex, len);
            for (let cur = dutyLastYm; compareYm(cur, addMonthsToYm(viewingYm, 1)) >= 0; cur = addMonthsToYm(cur, -1)) {
                const cnt = await getHolidayCount(cur);
                idxAfter = mod(idxAfter - cnt, len);
                if (compareYm(cur, addMonthsToYm(viewingYm, 1)) === 0)
                    break;
            }
            const viewingCnt = cachedHolidays.length;
            startIdx = mod(idxAfter - viewingCnt, len);
        }
        const assigns = [];
        let idx = startIdx;
        for (const h of cachedHolidays) {
            const name = dutyMembers[idx]?.name;
            if (name)
                assigns.push({ date: h.date, name });
            idx = (idx + 1) % len;
        }
        cachedDutyPreviewAssigns = assigns;
        renderSummaryCalendar();
    }
    // =====================================================
    // ✅ 당직 후보 추가 select 채우기(전체 사용자 - 현재 후보)
    // =====================================================
    function fillDutyAddSelect() {
        if (!dutyAddSelect)
            return;
        const exists = new Set(dutyMembers.map((m) => m.no));
        const candidates = allUsers.filter((u) => !exists.has(u.no));
        dutyAddSelect.innerHTML =
            `<option value="">추가할 사용자 선택</option>` +
                candidates.map((u) => `<option value="${u.no}">${escapeHtml(u.name)}</option>`).join("");
    }
    // =====================================================
    // ✅ 당직 후보 표 렌더
    // =====================================================
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
            // ✅ 후보가 없어도 select는 갱신
            fillDutyAddSelect();
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
        // ✅ 렌더 후 select 갱신
        fillDutyAddSelect();
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
            // ✅ 전체 사용자 목록(복구용)
            allUsers = Array.isArray(rows)
                ? rows
                    .map((u) => ({
                    no: Number(u.no ?? 0),
                    name: String(u.name ?? u.Name ?? "").trim(),
                }))
                    .filter((u) => u.no > 0 && u.name)
                    .sort((a, b) => a.no - b.no)
                : [];
            // ✅ 기존 기능 유지: 처음엔 전체 사용자를 당직 후보로 세팅
            dutyMembers = allUsers.map((u) => ({ no: u.no, name: u.name }));
            if (dutyMembers.length === 0)
                dutyStartIndex = 0;
            else
                dutyStartIndex = dutyStartIndex % dutyMembers.length;
            renderDutyMembers();
            refreshSummaryCalendar();
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
                const s = ymdText(it.start_date);
                const e = ymdText(it.end_date);
                const range = s && e && s === e ? s : `${s} ~ ${e}`;
                const noteText = String(it.note ?? "").trim();
                return `
          <tr class="hover:bg-gray-50">
            <td class="border-b px-2 py-2 text-center">${idx + 1}</td>
            <td class="border-b px-2 py-2 text-center">${escapeHtml(it.user_name)}</td>
            <td class="border-b px-2 py-2 text-center">${vacTypeLabel(it.vac_type)}</td>
            <td class="border-b px-2 py-2 text-center">${escapeHtml(range)}</td>

            <td class="border-b px-2 py-2 text-center whitespace-nowrap">
              ${noteText
                    ? `<button type="button"
                      class="vac-note-btn px-2 py-1 text-[11px] rounded-lg border bg-white hover:bg-gray-50"
                      data-name="${escapeHtml(it.user_name)}"
                      data-range="${escapeHtml(range)}"
                      data-note="${escapeHtml(noteText)}">
                      + 내용
                    </button>`
                    : `<span class="text-[11px] text-gray-400">-</span>`}
            </td>

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
            setVacMsg("등록 중...");
            const res = await fetch(`${API_BASE}/api/business-master/vacations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
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
            // ✅ 테이블 갱신
            await loadVacationList();
            // ✅✅✅ 핵심: 요약캘린더 캐시를 '즉시' 최신화 후 렌더
            cachedVacations = await fetchVacationsAll();
            renderSummaryCalendar();
            // (옵션) 다른 화면(대시보드)에서 듣고 있으면 유지
            window.dispatchEvent(new CustomEvent("vacation-status-refresh"));
        }
        catch (e) {
            console.error("[vac] add err:", e);
            setVacMsg("휴가 등록 중 오류");
        }
    }
    // =====================================================
    // ✅ “이번달” 당직 자동 생성 (휴일만)  + 저장
    // =====================================================
    async function generateDutyForCurrentMonth() {
        if (!dutyMembers.length) {
            alert("당직 후보가 없습니다. 사용자관리에서 먼저 등록하세요.");
            return;
        }
        ensureDutyCalLabel();
        const base = new Date();
        base.setDate(1);
        const dutyLabel = document.getElementById("dutyCalLabel");
        if (dutyLabel)
            dutyLabel.textContent = ym(base);
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
        dutyLastYm = ym(base);
        dutyLastAssigns = assigns;
        if (dutyResultBox) {
            const firstA = assigns[0];
            const lastA = assigns[assigns.length - 1];
            dutyResultBox.innerHTML = `
        - 생성 월: ${ym(base)}<br/>
        - 휴일 수(주말+공휴일): ${assigns.length}일<br/>
        - 시작: ${firstA.date} (${firstA.name})<br/>
        - 마지막: ${lastA.date} (${lastA.name})<br/>
        - 다음 시작번호(자동): ${dutyStartIndex + 1}번
      `;
        }
        renderDutyTable(assigns);
        renderDashboardHolidayDuty(holidays, assignsMap);
        await saveConfig(true);
        window.dispatchEvent(new CustomEvent("duty-config-changed"));
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
            if (dutyLastAssigns.length)
                renderDutyTable(dutyLastAssigns);
            else
                renderDutyTable([]);
            ensureDutyCalLabel();
            const dutyLabel = document.getElementById("dutyCalLabel");
            if (dutyLabel) {
                const fallback = /^\d{4}-\d{2}$/.test(dutyLastYm) ? dutyLastYm : ym(new Date());
                dutyLabel.textContent = fallback;
            }
            refreshSummaryCalendar();
            renderDashboardDutyCalendarFromTable();
        }
        catch (err) {
            console.error("[출장업무관리] 설정 조회 중 오류:", err);
        }
    }
    async function saveConfig(forceSilent = false) {
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
                loadVacationList;
                console.error("[출장업무관리] 설정 저장 실패 status =", res.status, json);
                if (!forceSilent)
                    alert(json?.error || "설정 저장 중 오류가 발생했습니다.");
                return;
            }
            window.dispatchEvent(new CustomEvent("duty-config-changed"));
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
    // 이벤트 바인딩 (1회만)
    // =====================================================
    btnDistanceAddRow?.addEventListener("click", () => addEmptyRow());
    btnDistanceSave?.addEventListener("click", () => saveDistances());
    btnNoticeUpload?.addEventListener("click", uploadNoticeOnly);
    btnFuelFxSave?.addEventListener("click", onSave);
    btnVacAdd?.addEventListener("click", () => addVacation());
    // ✅✅✅ 일정 등록 버튼
    btnCalTodoAdd?.addEventListener("click", () => addCalendarTodo());
    vacationAdminTbody?.addEventListener("click", async (e) => {
        const target = e.target;
        if (!target)
            return;
        if (target.classList.contains("vac-note-btn")) {
            const btn = target;
            const name = btn.dataset.name || "";
            const range = btn.dataset.range || "";
            const note = btn.dataset.note || "";
            openVacNoteModal(name, range, note);
            return;
        }
        if (!target.classList.contains("vac-del-btn"))
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
        refreshSummaryCalendar();
    });
    // ✅ 삭제한 사용자 다시 넣기 (select -> 추가)
    btnDutyAddUser?.addEventListener("click", () => {
        if (!dutyAddSelect)
            return;
        const no = Number(dutyAddSelect.value);
        if (!Number.isFinite(no) || no <= 0)
            return;
        const user = allUsers.find((u) => u.no === no);
        if (!user)
            return;
        if (dutyMembers.some((m) => m.no === user.no))
            return;
        dutyMembers.push({ no: user.no, name: user.name });
        if (dutyMembers.length === 0)
            dutyStartIndex = 0;
        else
            dutyStartIndex = dutyStartIndex % dutyMembers.length;
        renderDutyMembers();
        refreshSummaryCalendar();
    });
    btnDutyGenerateThisMonth?.addEventListener("click", () => {
        generateDutyForCurrentMonth();
    });
    sumCalPrev?.addEventListener("click", () => {
        sumMonth--;
        if (sumMonth < 0) {
            sumMonth = 11;
            sumYear--;
        }
        refreshSummaryCalendar();
    });
    sumCalNext?.addEventListener("click", () => {
        sumMonth++;
        if (sumMonth > 11) {
            sumMonth = 0;
            sumYear++;
        }
        refreshSummaryCalendar();
    });
    // =====================================================
    // ✅✅✅ 핵심: "패널이 다시 보일 때마다" 리셋 + 서버 재조회
    // =====================================================
    // 1) 리셋(화면+메모리 캐시)
    function resetBusinessMasterState() {
        // 화면 입력값/표 먼저 비우기
        if (textareaNotice)
            textareaNotice.value = "";
        if (distanceTbody) {
            distanceTbody.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-2 text-center text-xs text-gray-400">
            로딩 중...
          </td>
        </tr>
      `;
        }
        if (vacationAdminTbody) {
            vacationAdminTbody.innerHTML = `
        <tr><td colspan="6" class="border-b px-2 py-3 text-center text-gray-400">로딩 중...</td></tr>
      `;
        }
        if (sumCalGrid)
            sumCalGrid.innerHTML = "";
        if (sumCalLabel)
            sumCalLabel.textContent = "";
        // 메모리 캐시도 비우기(이게 핵심)
        distanceRows = [];
        deletedIds = [];
        cachedVacations = [];
        cachedHolidays = [];
        cachedDutyPreviewYm = "";
        cachedDutyPreviewAssigns = [];
        cachedCalendarEvents = [];
        // 당직/유저 캐시도 초기화 (다시 로드)
        dutyMembers = [];
        allUsers = [];
    }
    // 2) 서버에서 다시 가져와서 렌더
    let _reloadInFlight = false;
    async function reloadBusinessMasterFromServer(reason = "") {
        if (_reloadInFlight)
            return;
        _reloadInFlight = true;
        console.log("[출장업무관리] ✅ 리로드 시작:", reason);
        try {
            resetBusinessMasterState();
            // ✅ 순서 중요: 설정 -> 사용자(당직후보) -> 거리 -> 휴가옵션/목록 -> 캘린더
            await loadConfig();
            await loadDutyMembersFromUsers();
            await loadDistances();
            await loadVacUserOptions();
            await loadVacationList();
            await refreshSummaryCalendar();
            renderSummaryCalendar(); // 혹시라도 비어있을 때 한 번 더
        }
        catch (e) {
            console.error("[출장업무관리] reloadBusinessMasterFromServer error:", e);
        }
        finally {
            _reloadInFlight = false;
        }
    }
    // 3) 패널이 "숨김 -> 표시" 될 때 자동 감지 (showPanel 수정 안 해도 됨)
    //    hidden 클래스가 빠지는 순간마다 reload 실행
    if (!panel._bmObserver) {
        const obs = new MutationObserver(() => {
            // panel이 보이는 상태인지 체크
            const isHidden = panel.classList.contains("hidden");
            if (isHidden)
                return;
            // 화면에 실제로 표시되는 상태(대충 체크)
            const isVisible = panel.offsetParent !== null;
            if (!isVisible)
                return;
            // ✅ 다시 보이면 무조건 서버 재조회
            reloadBusinessMasterFromServer("panel-visible");
        });
        obs.observe(panel, { attributes: true, attributeFilter: ["class"] });
        panel._bmObserver = obs;
    }
    // 4) 최초 진입 1회 로드
    reloadBusinessMasterFromServer("first-load");
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

// ✅ 모듈(탭) 메모리 유지용: 새로고침/로그아웃/브라우저 종료 시 자동 초기화
let ACTIVE = null;
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`❌ element not found: #${id}`);
    return el;
}
function textOrEmpty(v) {
    return String(v ?? "").trim();
}
/** ✅ 서버 응답에서 trip_id 최대한 찾아내기(서버 구조 달라도 대응) */
function pickTripIdFromResponse(data) {
    const cand = data?.trip_id ??
        data?.tripId ??
        data?.id ??
        data?.data?.trip_id ??
        data?.data?.tripId ??
        data?.data?.id ??
        data?.result?.trip_id ??
        data?.result?.id;
    const s = textOrEmpty(cand);
    return s ? s : undefined;
}
/**
 * ✅ URL 파라미터 읽기 (search + hash 둘 다 대응)
 * - 일반 URL:    /workspace?req_name=...&trip_date=...
 * - 해시 라우팅: /workspace#something?req_name=...&trip_date=...
 */
function getQueryParam(name) {
    try {
        const url = new URL(window.location.href);
        const fromSearch = url.searchParams.get(name);
        if (fromSearch)
            return fromSearch;
        const hash = String(url.hash ?? "");
        const qIdx = hash.indexOf("?");
        if (qIdx >= 0) {
            const hashQuery = hash.slice(qIdx + 1);
            const sp = new URLSearchParams(hashQuery);
            return sp.get(name) ?? "";
        }
        return "";
    }
    catch {
        return "";
    }
}
/** ✅ URL 파라미터 세팅/삭제 (현재 라우팅 방식과 무관하게 최대한 안전하게 처리) */
function setQueryParams(params) {
    try {
        const url = new URL(window.location.href);
        // 기본: search에 넣기
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        // hash 라우팅이면 hash의 query도 맞춰주기(있을 때만)
        const hash = String(url.hash ?? "");
        const qIdx = hash.indexOf("?");
        if (qIdx >= 0) {
            const base = hash.slice(0, qIdx);
            const sp = new URLSearchParams(hash.slice(qIdx + 1));
            Object.entries(params).forEach(([k, v]) => sp.set(k, v));
            url.hash = `${base}?${sp.toString()}`;
        }
        window.history.replaceState(null, "", url.toString());
    }
    catch {
        // ignore
    }
}
function clearQueryParams(keys) {
    try {
        const url = new URL(window.location.href);
        keys.forEach((k) => url.searchParams.delete(k));
        const hash = String(url.hash ?? "");
        const qIdx = hash.indexOf("?");
        if (qIdx >= 0) {
            const base = hash.slice(0, qIdx);
            const sp = new URLSearchParams(hash.slice(qIdx + 1));
            keys.forEach((k) => sp.delete(k));
            const qs = sp.toString();
            url.hash = qs ? `${base}?${qs}` : base;
        }
        window.history.replaceState(null, "", url.toString());
    }
    catch {
        // ignore
    }
}
function initDomesticTripRegisterPanel(API_BASE) {
    const panel = document.getElementById("panel-국내출장-출장등록");
    if (!panel)
        return;
    const saveBtn = getEl("reg_save");
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    const resetBtn = getEl("reg_reset");
    const resultBox = getEl("reg_result");
    const continueBtn = document.getElementById("reg_continue");
    const settlementSection = document.getElementById("bt_settlement_section");
    const userNameEl = document.getElementById("userName");
    const reqNameInput = getEl("bt_req_name");
    // ✅ 출발지 select (value: company/home/other)
    const departPlaceSelect = getEl("bt_place");
    const departPlaceOther = document.getElementById("bt_place_other");
    // ✅ 출장지 select (clients API)
    const destinationSelect = getEl("bt_destination");
    const startInput = getEl("bt_start");
    const departTimeInput = getEl("bt_depart_time");
    const arriveTimeInput = getEl("bt_arrive_time");
    const purposeInput = getEl("bt_purpose");
    function currentUserName() {
        return (userNameEl?.textContent ?? "").trim();
    }
    /** ✅ 입력값 싹 비우기 */
    function clearFormUI() {
        reqNameInput.value = currentUserName() || "사용자";
        departPlaceSelect.value = "";
        if (departPlaceOther) {
            departPlaceOther.value = "";
            departPlaceOther.classList.add("hidden");
        }
        destinationSelect.value = "";
        startInput.value = "";
        departTimeInput.value = "";
        arriveTimeInput.value = "";
        purposeInput.value = "";
        resultBox.textContent = "";
        if (continueBtn)
            continueBtn.classList.add("hidden");
        if (settlementSection)
            settlementSection.classList.add("hidden");
    }
    /** ✅ 메모리 ACTIVE로 UI 복원(탭 유지용) */
    function restoreFromActive(active) {
        const p = active.payload;
        reqNameInput.value = p.req_name || (currentUserName() || "사용자");
        if (p.depart_place === "company" || p.depart_place === "home") {
            departPlaceSelect.value = p.depart_place;
            if (departPlaceOther) {
                departPlaceOther.value = "";
                departPlaceOther.classList.add("hidden");
            }
        }
        else {
            departPlaceSelect.value = "other";
            if (departPlaceOther) {
                departPlaceOther.classList.remove("hidden");
                departPlaceOther.value = p.depart_place;
            }
        }
        destinationSelect.value = p.destination || "";
        startInput.value = p.start_date || "";
        departTimeInput.value = p.depart_time || "";
        arriveTimeInput.value = p.arrive_time || "";
        purposeInput.value = p.purpose || "";
        resultBox.textContent = "✅ 등록된 출장건(정산 전)입니다. 계속 정산을 진행할 수 있습니다.";
        if (continueBtn)
            continueBtn.classList.remove("hidden");
        if (settlementSection)
            settlementSection.classList.add("hidden");
    }
    /** ✅ 거래처 목록 로딩 */
    async function loadClients() {
        try {
            destinationSelect.innerHTML = `<option value="">거래처(출장지) 선택</option>`;
            const res = await fetch(`${API_BASE}/api/business-trip/clients`);
            if (!res.ok) {
                console.error("[REGISTER] clients API HTTP error:", res.status);
                return;
            }
            const json = await res.json().catch(() => null);
            const raw = Array.isArray(json?.data) ? json.data :
                Array.isArray(json?.rows) ? json.rows :
                    Array.isArray(json?.clients) ? json.clients :
                        Array.isArray(json) ? json :
                            [];
            for (const item of raw) {
                const name = typeof item === "string"
                    ? item
                    : (item?.client_name ?? item?.name ?? item?.destination);
                const clean = textOrEmpty(name);
                if (!clean)
                    continue;
                const opt = document.createElement("option");
                opt.value = clean;
                opt.textContent = clean;
                destinationSelect.appendChild(opt);
            }
            // ✅ 목록 로드 후: ACTIVE가 있으면 destination 값 재적용
            if (ACTIVE?.payload?.destination) {
                destinationSelect.value = ACTIVE.payload.destination;
            }
        }
        catch (err) {
            console.warn("[REGISTER] 거래처 목록 로딩 실패:", err);
        }
    }
    /**
     * ✅✅✅ 핵심: 로그아웃/재로그인 복원
     * - end_data가 비어있는(정산 미완료) 최신 1건의 start_data를 불러와 폼에 채움
     * - API: GET /api/business-trip/domestic/incomplete?req_name=...
     */
    async function restoreIncompleteFromServer() {
        const me = currentUserName();
        if (!me)
            return;
        try {
            const url = `${API_BASE}/api/business-trip/domestic/incomplete?req_name=${encodeURIComponent(me)}`;
            const res = await fetch(url);
            if (!res.ok)
                return;
            const j = await res.json().catch(() => null);
            const data = j?.data;
            if (!data?.start_data)
                return;
            const p = data.start_data;
            // 요청자
            reqNameInput.value = p.req_name ?? me;
            // 출발지(company/home/기타텍스트)
            const dp = String(p.depart_place ?? "");
            if (dp === "company" || dp === "home") {
                departPlaceSelect.value = dp;
                if (departPlaceOther) {
                    departPlaceOther.value = "";
                    departPlaceOther.classList.add("hidden");
                }
            }
            else if (dp) {
                departPlaceSelect.value = "other";
                if (departPlaceOther) {
                    departPlaceOther.classList.remove("hidden");
                    departPlaceOther.value = dp;
                }
            }
            // 출장지/일자/시간/목적
            destinationSelect.value = String(p.destination ?? "");
            startInput.value = String(p.start_date ?? p.trip_date ?? "");
            departTimeInput.value = String(p.depart_time ?? "");
            arriveTimeInput.value = String(p.arrive_time ?? "");
            purposeInput.value = String(p.purpose ?? "");
            // URL 파라미터도 맞춰줌(09가 이걸 쓰는 구조라서)
            const tripDate = String(p.start_date ?? p.trip_date ?? "");
            if (tripDate) {
                setQueryParams({ req_name: me, trip_date: tripDate });
            }
            // UI: 이어서 정산 버튼은 보여주되, 정산 섹션은 버튼 누를 때만 열림
            if (continueBtn)
                continueBtn.classList.remove("hidden");
            if (settlementSection)
                settlementSection.classList.add("hidden");
            resultBox.textContent = "✅ 정산 미완료 출장건을 불러왔습니다. [이어서 정산]을 눌러 진행하세요.";
        }
        catch (e) {
            console.warn("[REGISTER] restoreIncompleteFromServer error:", e);
        }
    }
    /** ✅ 패널 열릴 때 규칙: ACTIVE 있으면 복원 / 없으면 리셋 */
    async function applyOpenRule() {
        if (ACTIVE)
            restoreFromActive(ACTIVE);
        else
            clearFormUI();
        await loadClients();
        // ✅ URL 파라미터가 현재 유저와 동일하면 날짜/이름 정도는 채움
        const qpName = getQueryParam("req_name");
        const qpDate = getQueryParam("trip_date");
        const me = currentUserName();
        if (qpName && qpDate && me && qpName === me) {
            reqNameInput.value = qpName;
            startInput.value = qpDate;
        }
        else if (qpName || qpDate) {
            clearQueryParams(["req_name", "trip_date"]);
        }
        // ✅✅✅ 마지막: 서버에서 "정산 미완료 start_data" 자동 복원
        await restoreIncompleteFromServer();
    }
    // ✅ 최초 1회 적용
    applyOpenRule();
    // 초기 숨김(복원 로직에서 필요하면 풀림)
    if (continueBtn)
        continueBtn.classList.add("hidden");
    if (settlementSection)
        settlementSection.classList.add("hidden");
    // ✅ 출발지 기타 토글
    departPlaceSelect.addEventListener("change", () => {
        if (!departPlaceOther)
            return;
        const isOther = departPlaceSelect.value === "other";
        departPlaceOther.classList.toggle("hidden", !isOther);
        if (!isOther)
            departPlaceOther.value = "";
    });
    // ✅ 패널 이동 감지(hidden 토글)
    const mo = new MutationObserver(() => {
        const isHidden = panel.classList.contains("hidden");
        if (isHidden) {
            if (!ACTIVE)
                clearFormUI();
        }
        else {
            applyOpenRule();
        }
    });
    mo.observe(panel, { attributes: true, attributeFilter: ["class"] });
    // 🔹 리셋 버튼: UI 초기화 + ACTIVE 제거 + URL 파라미터 제거
    resetBtn.addEventListener("click", async () => {
        if (ACTIVE) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "초기화",
                message: "등록된 출장건(정산 전)이 남아있습니다.\n" +
                    "초기화하면 해당 내용은 더 이상 유지되지 않습니다.",
                showOk: true,
                showCancel: false,
            });
        }
        ACTIVE = null;
        clearQueryParams(["req_name", "trip_date"]);
        clearFormUI();
        loadClients();
    });
    // 🔹 저장(출장등록)
    saveBtn.addEventListener("click", async () => {
        const depart_place = departPlaceSelect.value === "other"
            ? textOrEmpty(departPlaceOther?.value)
            : textOrEmpty(departPlaceSelect.value); // company | home
        const payload = {
            trip_type: "domestic",
            req_name: reqNameInput.value.trim(),
            depart_place,
            destination: textOrEmpty(destinationSelect.value),
            start_date: startInput.value,
            depart_time: departTimeInput.value,
            arrive_time: arriveTimeInput.value,
            purpose: purposeInput.value.trim(),
        };
        // 필수 체크
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
        if (departPlaceSelect.value === "other" && !payload.depart_place) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "기타 출발지를 입력해주세요.",
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
                headers: { "Content-Type": "application/json" },
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
            // ✅ 탭 메모리(ACTIVE)만 세팅
            const trip_id = pickTripIdFromResponse(data);
            ACTIVE = { savedAt: Date.now(), trip_id, payload };
            // ✅ 09 정산이 req_name/trip_date를 쓰는 구조라 URL도 맞춰줌
            setQueryParams({
                req_name: payload.req_name,
                trip_date: payload.start_date,
            });
            resultBox.textContent = "✅ 출장 등록 완료 (정산 전까지 탭에서만 유지됩니다.)";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "출장 등록 내용이 서버에 저장되었습니다.\n[이어서 정산] 버튼을 눌러 정산을 작성하세요.",
                showOk: true,
                showCancel: false,
            });
            if (continueBtn)
                continueBtn.classList.remove("hidden");
            if (settlementSection)
                settlementSection.classList.add("hidden");
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
            ACTIVE = null;
            clearQueryParams(["req_name", "trip_date"]);
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
    /**
     * 🔹 이어서 정산
     * ✅ in-progress 플래그/백엔드 호출 없음
     * - 그냥 정산 섹션을 열고 URL 파라미터만 맞춰준다.
     */
    continueBtn?.addEventListener("click", async () => {
        try {
            const me = currentUserName();
            const date = startInput.value;
            const name = reqNameInput.value.trim();
            if (!date || !name) {
                resultBox.textContent = "❌ 정산 대상(요청자/날짜)이 없습니다.";
                return;
            }
            // ✅ 현재 로그인 유저와 다르면 막기(다른 계정 잔존 문제 방지)
            if (me && name !== me) {
                await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                    type: "alert",
                    title: "정산 대상 불일치",
                    message: "현재 로그인 사용자와 정산 대상 요청자명이 다릅니다.\n다시 확인해주세요.",
                    showOk: true,
                    showCancel: false,
                });
                clearQueryParams(["req_name", "trip_date"]);
                return;
            }
            setQueryParams({ req_name: name, trip_date: date });
            if (settlementSection) {
                settlementSection.classList.remove("hidden");
                settlementSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            resultBox.textContent = "✏️ 이 출장건에 대한 정산 정보를 아래에서 이어서 작성하세요.";
        }
        catch (err) {
            console.error("continue settlement error:", err);
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "오류",
                message: `정산 열기 중 오류가 발생했습니다.\n${err?.message ?? ""}`,
                showOk: true,
                showCancel: false,
            });
        }
    });
    // ✅ 정산 완료 이벤트(09에서 발사)
    window.addEventListener("domestic-trip-settled", () => {
        ACTIVE = null;
        clearQueryParams(["req_name", "trip_date"]);
        clearFormUI();
    });
    window.addEventListener("trip-settled", () => {
        ACTIVE = null;
        clearQueryParams(["req_name", "trip_date"]);
        clearFormUI();
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
/** ✅ 차량 라디오 value가 뭐로 오든, 서버/계산용 표준 코드로 변환 */
function toVehicleCode(v) {
    const s = String(v ?? "").trim();
    if (s === "corp" || s === "corporate")
        return "corp";
    if (s === "personal")
        return "personal";
    if (s === "other" || s === "other_personal")
        return "other";
    if (s === "public")
        return "public";
    return "other";
}
function textOrEmpty(v) {
    return String(v ?? "").trim();
}
/**
 * ✅ URL 파라미터 읽기 (search + hash 둘 다 대응)
 */
function getQueryParam(name) {
    try {
        const url = new URL(window.location.href);
        const fromSearch = url.searchParams.get(name);
        if (fromSearch)
            return fromSearch;
        const hash = String(url.hash ?? "");
        const qIdx = hash.indexOf("?");
        if (qIdx >= 0) {
            const hashQuery = hash.slice(qIdx + 1);
            const sp = new URLSearchParams(hashQuery);
            return sp.get(name) ?? "";
        }
        return "";
    }
    catch {
        return "";
    }
}
/** ✅ (추가) URL 파라미터 세팅 (08과 동일하게 방어적으로) */
function setQueryParams(params) {
    try {
        const url = new URL(window.location.href);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        const hash = String(url.hash ?? "");
        const qIdx = hash.indexOf("?");
        if (qIdx >= 0) {
            const base = hash.slice(0, qIdx);
            const sp = new URLSearchParams(hash.slice(qIdx + 1));
            Object.entries(params).forEach(([k, v]) => sp.set(k, v));
            url.hash = `${base}?${sp.toString()}`;
        }
        window.history.replaceState(null, "", url.toString());
    }
    catch {
        // ignore
    }
}
function clearQueryParams(keys) {
    try {
        const url = new URL(window.location.href);
        keys.forEach((k) => url.searchParams.delete(k));
        const hash = String(url.hash ?? "");
        const qIdx = hash.indexOf("?");
        if (qIdx >= 0) {
            const base = hash.slice(0, qIdx);
            const sp = new URLSearchParams(hash.slice(qIdx + 1));
            keys.forEach((k) => sp.delete(k));
            const qs = sp.toString();
            url.hash = qs ? `${base}?${qs}` : base;
        }
        window.history.replaceState(null, "", url.toString());
    }
    catch {
        // ignore
    }
}
function initDomesticTripSettlementPanel(API_BASE) {
    console.log("[정산] initDomesticTripSettlementPanel 호출");
    const section = document.getElementById("bt_settlement_section");
    if (!section) {
        console.warn("[정산] #bt_settlement_section 요소를 찾을 수 없습니다. HTML 구조를 확인하세요.");
        return;
    }
    const saveBtn = getEl("bt_save");
    if (saveBtn._bound)
        return;
    saveBtn._bound = true;
    const resetBtn = getEl("bt_reset");
    const resultBox = getEl("bt_result");
    const workEndInput = getEl("bt_work_end_time");
    const returnTimeInput = getEl("bt_return_time");
    // ✅ 복귀지 select (value: company/home/other)
    const returnPlaceSelect = getEl("bt_return_place");
    const returnPlaceOther = document.getElementById("bt_return_place_other");
    const mealBreakfastCheck = getEl("bt_meal_breakfast");
    const mealLunchCheck = getEl("bt_meal_lunch");
    const mealDinnerCheck = getEl("bt_meal_dinner");
    const mealBreakfastOwner = getEl("bt_meal_breakfast_owner");
    const mealLunchOwner = getEl("bt_meal_lunch_owner");
    const mealDinnerOwner = getEl("bt_meal_dinner_owner");
    // (있으면) 현재 로그인 사용자명 검사에 사용
    const userNameEl = document.getElementById("userName");
    function currentUserName() {
        return (userNameEl?.textContent ?? "").trim();
    }
    // ✅ 복귀지 기타 토글
    returnPlaceSelect.addEventListener("change", () => {
        if (!returnPlaceOther)
            return;
        const isOther = returnPlaceSelect.value === "other";
        returnPlaceOther.classList.toggle("hidden", !isOther);
        if (!isOther)
            returnPlaceOther.value = "";
    });
    // ✅ 체크 안 한 식사는 owner="none"
    const normalizeMeal = (checked, owner) => {
        if (!checked)
            return { checked: false, owner: "none" };
        return { checked: true, owner: owner || "personal" };
    };
    // ✅ 정산 대상(요청자/날짜) 읽기: URL 파라미터에서만
    function readSettleTarget() {
        const req_name = textOrEmpty(getQueryParam("req_name"));
        const trip_date = textOrEmpty(getQueryParam("trip_date"));
        return { req_name, trip_date };
    }
    // ✅ 다른 계정 로그인 상태에서 URL 파라미터가 남아있으면 즉시 제거(정보 잔존 방지)
    function validateTargetOrClear() {
        const { req_name, trip_date } = readSettleTarget();
        const me = currentUserName();
        if (!req_name || !trip_date)
            return { ok: false, req_name, trip_date };
        if (me && req_name !== me) {
            clearQueryParams(["req_name", "trip_date"]);
            return { ok: false, req_name: "", trip_date: "" };
        }
        return { ok: true, req_name, trip_date };
    }
    /**
     * ✅✅✅ (추가) URL 파라미터가 없을 때 "진행중 정산" 1건을 서버에서 다시 찾아 자동 세팅
     * - 08에서 이미 해주지만, 09에서 한번 더 안전장치로 보강
     * - 조건: settlement_in_progress=true 인 건만 복원됨
     */
    async function restoreTargetIfMissing() {
        const me = currentUserName();
        if (!me)
            return;
        const now = readSettleTarget();
        if (now.req_name && now.trip_date)
            return; // 이미 있으면 끝
        try {
            const r = await fetch(`${API_BASE}/api/business-trip/settlement/in-progress?req_name=${encodeURIComponent(me)}`);
            if (!r.ok)
                return;
            const j = await r.json().catch(() => null);
            const data = j?.data;
            if (!data?.trip_date)
                return;
            if (String(data.req_name ?? "") !== me)
                return;
            setQueryParams({ req_name: me, trip_date: data.trip_date });
            resultBox.textContent = "✅ 진행중 정산 건을 자동으로 불러왔습니다. 이어서 작성하세요.";
        }
        catch {
            // ignore
        }
    }
    // ✅ 초기 1회: 혹시 URL이 비어있으면 진행중 복원 시도
    restoreTargetIfMissing().then(() => {
        // 복원 이후에도 계정 불일치면 바로 제거
        validateTargetOrClear();
    });
    resetBtn.addEventListener("click", () => {
        workEndInput.value = "";
        returnTimeInput.value = "";
        returnPlaceSelect.value = "";
        if (returnPlaceOther) {
            returnPlaceOther.value = "";
            returnPlaceOther.classList.add("hidden");
        }
        document.querySelectorAll(`input[name="bt_vehicle"]`).forEach((r) => (r.checked = false));
        mealBreakfastCheck.checked = false;
        mealLunchCheck.checked = false;
        mealDinnerCheck.checked = false;
        mealBreakfastOwner.value = "";
        mealLunchOwner.value = "";
        mealDinnerOwner.value = "";
        resultBox.textContent = "정산 입력값이 초기화되었습니다.";
    });
    saveBtn.addEventListener("click", async () => {
        const vehicleValueRaw = getCheckedRadioValue("bt_vehicle");
        const vehicleValue = toVehicleCode(vehicleValueRaw);
        // ✅ 혹시 저장 순간에도 URL이 비어있으면 한번 더 복원 시도 후 검증
        await restoreTargetIfMissing();
        const t = validateTargetOrClear();
        const trip_date = t.trip_date;
        const req_name = t.req_name;
        if (!trip_date || !req_name) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 대상 없음",
                message: "먼저 [출장등록] 저장 후 [이어서 정산]으로 들어와 주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
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
        // ✅ 회사/자택은 company/home 그대로 보내고, 기타만 텍스트로 보냄
        const return_place = returnPlaceSelect.value === "other"
            ? (returnPlaceOther?.value ?? "").trim()
            : returnPlaceSelect.value; // company | home
        if (!return_place) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀지(회사/자택/기타)를 선택해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (returnPlaceSelect.value === "other" && !returnPlaceOther?.value.trim()) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "기타 복귀지를 입력해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        if (!vehicleValueRaw) {
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "차량(정산용)을 선택해주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }
        const b = normalizeMeal(mealBreakfastCheck.checked, mealBreakfastOwner.value);
        const l = normalizeMeal(mealLunchCheck.checked, mealLunchOwner.value);
        const d = normalizeMeal(mealDinnerCheck.checked, mealDinnerOwner.value);
        const settlement = {
            work_end_time: workEndInput.value,
            return_time: returnTimeInput.value,
            return_place,
            vehicle: vehicleValue,
            meals: { breakfast: b, lunch: l, dinner: d },
        };
        const detail_json = { settlement };
        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산 내용 저장 중...";
            // ✅ 정산 저장(서버 계산/검증은 여기서 1회 더 수행됨)
            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ req_name, trip_date, detail_json }),
            });
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
            // (선택) 개인차량인데 km=0이면 안내
            const fuelKm = data?.data?.calc?.fuel_distance_km ?? 0;
            if (vehicleValue === "personal" && Number(fuelKm) === 0) {
                await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                    type: "alert",
                    title: "유류비 0원 안내",
                    message: "개인차량으로 선택했지만 거리(km)가 0으로 계산되었습니다.\n거리 마스터(trip_distance_master)에\n[직원명 + 거래처명] 거리 등록이 있는지 확인해주세요.",
                    showOk: true,
                    showCancel: false,
                });
            }
            resultBox.textContent = "✅ 정산 정보가 저장되었습니다.";
            await _utils_ModalUtil__WEBPACK_IMPORTED_MODULE_0__.ModalUtil.show({
                type: "alert",
                title: "정산 완료",
                message: "정산 정보가 성공적으로 저장되었습니다.",
                showOk: true,
                showCancel: false,
            });
            // ✅✅✅ 정산 완료 후: URL 파라미터 제거 + 등록 화면에 '정산완료' 신호
            clearQueryParams(["req_name", "trip_date"]);
            window.dispatchEvent(new Event("domestic-trip-settled"));
            // 대시보드 갱신
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
    // ✅ 섹션이 열려있는 상태에서 다른 계정으로 로그인하거나 URL 파라미터가 꼬이면 즉시 제거
    validateTargetOrClear();
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
const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
// ✅ ISO/Date/DB-date 어떤 값이 와도 "YYYY-MM-DD" 로 안전하게
function ymdSafe(v) {
    const s = String(v ?? "").trim();
    if (!s)
        return "-";
    // "2026-01-16T00:00:00.000Z" 같은 경우 → 앞 10자리만
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s))
        return s.slice(0, 10);
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        return s;
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}
function formatYmdWithDow(v) {
    const ymd = ymdSafe(v);
    if (ymd === "-")
        return "-";
    const d = new Date(ymd); // "YYYY-MM-DD"는 로컬 기준으로 잘 계산됨
    if (Number.isNaN(d.getTime()))
        return ymd;
    return `${ymd} (${DOW_KR[d.getDay()]})`;
}
function toYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfWeekMon(d) {
    const x = new Date(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 월요일=1
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfWeekSun(d) {
    const mon = startOfWeekMon(d);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(0, 0, 0, 0);
    return sun;
}
function isMonToSunRange(from, to) {
    const s = new Date(from);
    const e = new Date(to);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
        return false;
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return s.getDay() === 1 && e.getDay() === 0 && diff === 6;
}
/** ✅ 근무시간 차액 계산 */
function calcHourDiff(start, end) {
    const toMin = (t) => {
        const [h, m] = String(t ?? "").split(":").map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m))
            return null;
        return h * 60 + m;
    };
    const s = toMin(start);
    const e = toMin(end);
    if (s == null || e == null)
        return "-";
    let diff = e - s;
    if (diff < 0)
        diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
// 🌟 패널 초기화
function initDomesticTripHistoryPanel(API_BASE) {
    const panel = document.getElementById("panel-국내출장-정산서등록");
    if (!panel)
        return;
    const searchBtn = getEl("settle_search");
    const submitBtn = getEl("settle_submit");
    // 중복 바인딩 방지
    if (searchBtn._bound)
        return;
    searchBtn._bound = true;
    const fromInput = getEl("settle_from");
    const toInput = getEl("settle_to");
    const resultMsg = getEl("settle_result_msg");
    const tbody = getEl("settle_result_tbody");
    let lastRows = [];
    function getLoginUserName() {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}")?.name ?? null;
        }
        catch {
            return null;
        }
    }
    // ✅ (1) 기본값: 오늘 기준 이번주 월~일 자동 세팅
    function setThisWeekRange() {
        const mon = startOfWeekMon(new Date());
        const sun = endOfWeekSun(new Date());
        fromInput.value = toYMD(mon);
        toInput.value = toYMD(sun);
    }
    function setLastWeekRange() {
        const mon = startOfWeekMon(new Date());
        mon.setDate(mon.getDate() - 7);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        fromInput.value = toYMD(mon);
        toInput.value = toYMD(sun);
    }
    // 입력값이 비었으면 자동으로 이번주 세팅
    if (!fromInput.value || !toInput.value)
        setThisWeekRange();
    // =========================
    // ✅ 제출 이벤트: 관리자(02) 자동 갱신용
    // =========================
    function notifyTripSubmitted(payload) {
        window.dispatchEvent(new CustomEvent("trip:submitted", { detail: payload ?? {} }));
        try {
            const bc = new BroadcastChannel("trip-events");
            bc.postMessage({ type: "trip:submitted", payload: payload ?? {}, ts: Date.now() });
            bc.close();
        }
        catch { }
        try {
            localStorage.setItem("trip:submitted", JSON.stringify({ payload: payload ?? {}, ts: Date.now() }));
        }
        catch { }
    }
    // =========================
    // ✅ 제출 가능/불가 안내 + 버튼 활성화
    // =========================
    function updateSubmitEnabled() {
        const okWeek = isMonToSunRange(fromInput.value, toInput.value);
        const hasRows = lastRows.length > 0;
        const allSettled = lastRows.every((r) => {
            const s = r.detail_json?.settlement ?? r.end_data ?? {};
            return s && Object.keys(s).length > 0;
        });
        const anySubmitted = lastRows.some((r) => !!r.submitted_at);
        const canSubmit = okWeek && hasRows && allSettled && !anySubmitted;
        submitBtn.disabled = !canSubmit;
        // ✅ 유저가 실수 안 하게 이유를 resultMsg에 같이 보여줌
        const reasons = [];
        if (!okWeek)
            reasons.push("제출은 월~일(1주일) 기간만 가능");
        if (!hasRows)
            reasons.push("조회된 내역 없음");
        if (hasRows && !allSettled)
            reasons.push("정산 저장이 안 된 날짜가 있음");
        if (anySubmitted)
            reasons.push("이미 제출된 내역이 포함됨");
        if (canSubmit) {
            resultMsg.textContent = `총 ${lastRows.length}건 조회 / ✅ 제출 가능합니다.`;
        }
        else {
            // 기존에 “총 n건 조회”가 보이던 UX는 유지하면서, 제출 이유도 같이
            const base = `총 ${lastRows.length}건 조회`;
            const why = reasons.length ? ` / ⛔ ${reasons.join(" · ")}` : "";
            resultMsg.textContent = base + why;
        }
    }
    function statusText(r) {
        if (!r.submitted_at)
            return "미제출";
        if (r.approve_status === "approved")
            return "승인(O)";
        if (r.approve_status === "rejected")
            return "반려(X)";
        return "제출";
    }
    function renderRows(rows) {
        lastRows = rows;
        updateSubmitEnabled();
        if (!rows.length) {
            tbody.innerHTML = `
        <tr>
          <td colspan="8" class="border px-2 py-3 text-center text-gray-400">
            조회된 정산 내역이 없습니다.
          </td>
        </tr>
      `;
            return;
        }
        tbody.innerHTML = "";
        rows.forEach((row) => {
            const r = row.detail_json?.register ?? row.start_data ?? {};
            const s = row.detail_json?.settlement ?? row.end_data ?? {};
            // ✅ 근무시간 3줄 표시 (항상 이 형식으로 고정)
            const departStart = r.depart_time || "-";
            const arriveTime = r.arrive_time || "-";
            const returnStart = s.work_end_time || "-";
            const returnArrive = s.return_time || "-";
            const workStart = r.work_start_time || arriveTime || "-";
            const workEnd = s.work_end_time || "-";
            const departLine = (departStart !== "-" && arriveTime !== "-")
                ? `출발 (출발시간 ${departStart} ~ 도착시간 ${arriveTime})`
                : "출발 (-)";
            const returnLine = (returnStart !== "-" && returnArrive !== "-")
                ? `복귀 (출발시간 ${returnStart} ~ 도착시간 ${returnArrive})`
                : "복귀 (-)";
            const workDiff = (workStart !== "-" && workEnd !== "-")
                ? calcHourDiff(workStart, workEnd)
                : "-";
            const workLine = (workDiff !== "-")
                ? `업무시간 ${workStart} ~ ${workEnd} (총 ${workDiff})`
                : "업무시간 -";
            // 차량 표기
            const vehicleRaw = String(s.vehicle ?? "").trim();
            const vehicleText = vehicleRaw === "personal" ? "개인차" :
                vehicleRaw === "corp" ? "법인차" :
                    vehicleRaw === "public" ? "대중교통" :
                        vehicleRaw === "other" ? "기타" :
                            (vehicleRaw || "-");
            // 식사 표기
            const meals = s.meals || {};
            const mealStrs = [];
            if (meals.breakfast?.checked)
                mealStrs.push(`조식(${meals.breakfast.owner === "corp" ? "법인" : "개인"})`);
            if (meals.lunch?.checked)
                mealStrs.push(`중식(${meals.lunch.owner === "corp" ? "법인" : "개인"})`);
            if (meals.dinner?.checked)
                mealStrs.push(`석식(${meals.dinner.owner === "corp" ? "법인" : "개인"})`);
            const mealsText = mealStrs.length ? mealStrs.join(", ") : "-";
            // 이동경로 표기
            const departPlace = r.depart_place || "";
            const dest = r.destination || "";
            const returnPlace = s.return_place || "";
            const routeText = [departPlace, dest, returnPlace].filter(Boolean).join(" → ") || "-";
            const mainTask = r.purpose || "-";
            const st = statusText(row);
            const rejectReason = row.approve_status === "rejected" ? (row.approve_comment ?? "") : "";
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td class="border px-2 py-1 text-center whitespace-nowrap">
          ${formatYmdWithDow(row.trip_date)}
        </td>

        <td class="border px-2 py-2 text-left whitespace-normal leading-snug">
          <div class="text-gray-700">${departLine}</div>
          <div class="text-gray-700">${returnLine}</div>
          <div class="font-bold text-indigo-600 mt-1">${workLine}</div>
        </td>

        <td class="border px-2 py-1 text-center whitespace-nowrap">
          ${vehicleText}
        </td>

        <td class="border px-2 py-1 text-center whitespace-nowrap">
          ${mealsText}
        </td>

        <td class="border px-2 py-1 truncate">
          ${routeText}
        </td>

        <td class="border px-2 py-1 whitespace-normal">
          ${mainTask}
        </td>

        <td class="border px-2 py-1 text-center font-semibold whitespace-nowrap">
          ${st}
        </td>

        <td class="border px-2 py-1 text-rose-600 whitespace-normal">
          ${rejectReason}
        </td>
      `;
            tbody.appendChild(tr);
        });
    }
    async function fetchHistory() {
        const name = getLoginUserName();
        if (!name)
            return;
        // 조회중 표시
        resultMsg.textContent = "조회 중...";
        tbody.innerHTML = `
      <tr>
        <td colspan="8" class="border px-2 py-3 text-center text-gray-400">
          조회 중...
        </td>
      </tr>
    `;
        const qs = new URLSearchParams({
            from: fromInput.value,
            to: toInput.value,
            req_name: name,
        });
        const res = await fetch(`${API_BASE}/api/business-trip/settlements-range?${qs}`);
        const json = await res.json();
        const rows = (json.data ?? []);
        renderRows(rows);
    }
    // ✅ 조회
    searchBtn.onclick = fetchHistory;
    // ✅ (3) 입력 바뀌면 제출 가능 여부 즉시 반영 (유저 실수 방지)
    fromInput.addEventListener("change", updateSubmitEnabled);
    toInput.addEventListener("change", updateSubmitEnabled);
    // ✅ (3-추가) "이번주/지난주" 버튼이 HTML에 있으면 자동 연결(있어도 되고 없어도 됨)
    // - 버튼 id를 아래처럼 쓰면 자동으로 먹음:
    //   thisweek: settle_btn_thisweek
    //   lastweek: settle_btn_lastweek
    const btnThisWeek = document.getElementById("settle_btn_thisweek");
    const btnLastWeek = document.getElementById("settle_btn_lastweek");
    if (btnThisWeek) {
        btnThisWeek.addEventListener("click", async () => {
            setThisWeekRange();
            await fetchHistory();
        });
    }
    if (btnLastWeek) {
        btnLastWeek.addEventListener("click", async () => {
            setLastWeekRange();
            await fetchHistory();
        });
    }
    // =========================
    // ✅ 제출하기
    // =========================
    submitBtn.onclick = async () => {
        try {
            if (submitBtn.disabled) {
                // disabled인데 누르려는 경우: 왜 안되는지 한번 더 알림(실수 방지)
                const okWeek = isMonToSunRange(fromInput.value, toInput.value);
                if (!okWeek) {
                    alert("제출은 월~일(1주일) 기간만 가능합니다.\n'이번주(월~일)' 버튼을 눌러주세요.");
                }
                return;
            }
            const name = getLoginUserName();
            if (!name) {
                alert("로그인 정보를 찾을 수 없습니다.");
                return;
            }
            if (!confirm("이 기간(주간)의 정산서를 제출하시겠습니까?"))
                return;
            const res = await fetch(`${API_BASE}/api/business-trip/settlements-submit-week`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    from: fromInput.value,
                    to: toInput.value,
                    req_name: name,
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                alert(json.message ?? "제출 실패");
                return;
            }
            alert("제출 완료");
            // ✅ 관리자(02) 자동갱신 트리거
            notifyTripSubmitted({ from: fromInput.value, to: toInput.value, req_name: name });
            // ✅ 직원 화면도 최신화
            await fetchHistory();
        }
        catch (e) {
            console.error(e);
            alert("서버 오류로 제출에 실패했습니다.");
        }
    };
    // 초기엔 “이번주 기준”으로 보이게 + 제출버튼 조건 반영
    updateSubmitEnabled();
}


/***/ }),

/***/ "./TypeScript/workspace/utils/DistanceCalc.ts":
/*!****************************************************!*\
  !*** ./TypeScript/workspace/utils/DistanceCalc.ts ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_FUEL_PRICE_PER_KM: () => (/* binding */ DEFAULT_FUEL_PRICE_PER_KM),
/* harmony export */   calcFuelAmount: () => (/* binding */ calcFuelAmount),
/* harmony export */   calcFuelAmountByCaseWithLiter: () => (/* binding */ calcFuelAmountByCaseWithLiter),
/* harmony export */   calcFuelAmountByLiter: () => (/* binding */ calcFuelAmountByLiter),
/* harmony export */   calcFuelKmByCase: () => (/* binding */ calcFuelKmByCase),
/* harmony export */   findKmCompany: () => (/* binding */ findKmCompany),
/* harmony export */   findKmHome: () => (/* binding */ findKmHome),
/* harmony export */   normalizePlace: () => (/* binding */ normalizePlace),
/* harmony export */   pickFuelPricePerLiterByType: () => (/* binding */ pickFuelPricePerLiterByType),
/* harmony export */   placeLabel: () => (/* binding */ placeLabel)
/* harmony export */ });
// TypeScript/workspace/utils/DistanceCalc.ts
// ✅ 교체본: 유류비 = (총km / 연비(km/L)) * 유종단가(원/L)
// - 디버그 로그 포함(원인 추적용)
// - 기존 거리 계산(calcFuelKmByCase)은 유지
// - 기존 calcFuelAmount(totalKm, pricePerKm) 호출도 안깨지게 호환 유지(구식 방식은 그대로 동작)
// ✅ (구식) km당 단가 방식 호환용 (예전 코드 깨지지 않게 유지)
const DEFAULT_FUEL_PRICE_PER_KM = 200;
function norm(v) {
    return String(v ?? "").trim().toLowerCase();
}
function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
/** ✅ "회사/자택/company/home" 혼용값을 계산용 표준값으로 정리 */
function normalizePlace(v) {
    const s = norm(v);
    if (!s)
        return null;
    if (s === "company" || s === "회사")
        return "company";
    if (s === "home" || s === "자택")
        return "home";
    return null;
}
/** ✅ 화면 표시용 */
function placeLabel(v) {
    const p = normalizePlace(v);
    if (p === "company")
        return "회사";
    if (p === "home")
        return "자택";
    return String(v ?? "").trim();
}
/** ✅ 거래처명으로 row 찾기 (대소문자/공백 무시) */
function findRow(list, clientName) {
    const key = norm(clientName);
    return list.find((x) => norm(x.client_name) === key);
}
/** ✅ 사용자(자택) 거리 읽기: home_distance_km 우선 */
function findKmHome(list, clientName) {
    const row = findRow(list, clientName);
    return toNum(row?.home_distance_km ?? row?.distance_km ?? row?.km);
}
/** ✅ 회사 거리 읽기: distance_km 우선 */
function findKmCompany(list, clientName) {
    const row = findRow(list, clientName);
    return toNum(row?.distance_km ?? row?.home_distance_km ?? row?.km);
}
/**
 * ✅ 개인차량일 때만 유류비 거리(km) 계산
 * - 출발/복귀가 회사/자택이면 케이스별 합산
 * - 기타 텍스트 출발지/복귀지는 계산 불가 -> 0
 */
function calcFuelKmByCase(opts) {
    const { depart_place, return_place, destination, vehicle, companyDistances, userDistances } = opts;
    if (vehicle !== "personal")
        return 0;
    const depart = normalizePlace(depart_place);
    const ret = normalizePlace(return_place);
    if (!depart || !ret)
        return 0;
    const companyKm = findKmCompany(companyDistances, destination);
    const homeKm = findKmHome(userDistances, destination);
    if (depart === "home" && ret === "home")
        return homeKm * 2;
    if (depart === "company" && ret === "company")
        return companyKm * 2;
    if (depart === "company" && ret === "home")
        return companyKm + homeKm;
    if (depart === "home" && ret === "company")
        return homeKm + companyKm;
    return 0;
}
/** ✅ 숫자 방어 (0/NaN 방지) */
function safePositive(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
        return fallback;
    return n;
}
/**
 * ✅ 너 공식대로 계산
 * @param totalKm 총 주행거리(km)
 * @param kmPerLiter 연비(km/L) - 예: 7
 * @param pricePerLiter 유종단가(원/L) - 예: 1000
 */
function calcFuelAmountByLiter(totalKm, kmPerLiter, pricePerLiter) {
    const km = safePositive(totalKm, 0);
    const eff = safePositive(kmPerLiter, 7); // 기본 7
    const ppl = safePositive(pricePerLiter, 0);
    if (km <= 0 || ppl <= 0)
        return 0;
    const liters = km / eff;
    const amount = Math.round(liters * ppl);
    console.log("[FUEL DEBUG][LITER]", {
        totalKm: km,
        kmPerLiter: eff,
        pricePerLiter: ppl,
        liters,
        amount,
    });
    return amount;
}
/**
 * ✅ 설정(유종별 단가)에서 유저 유종(fuel_type)으로 가격 선택
 * - cfgFuel: { gasoline, diesel, lpg } 형태면 그대로 넣으면 됨
 */
function pickFuelPricePerLiterByType(fuelTypeRaw, cfgFuel) {
    const t = String(fuelTypeRaw ?? "").trim().toLowerCase();
    // 한글/영문 혼용 방어
    const isGasoline = t === "휘발유" || t === "gasoline" || t === "gas" || t === "petrol";
    const isDiesel = t === "경유" || t === "diesel";
    const isLpg = t === "lpg" || t === "가스" || t === "엘피지" || t === "lpg(가스)";
    const g = cfgFuel.gasoline ?? null;
    const d = cfgFuel.diesel ?? null;
    const l = cfgFuel.lpg ?? null;
    let picked = null;
    if (isGasoline)
        picked = g;
    else if (isDiesel)
        picked = d;
    else if (isLpg)
        picked = l;
    else
        picked = g ?? d ?? l ?? null; // 모르겠으면 있는 값 중 하나
    const price = Number(picked);
    const out = Number.isFinite(price) && price > 0 ? price : 0;
    console.log("[FUEL DEBUG][PICK]", { fuelTypeRaw, picked: out, cfgFuel });
    return out;
}
/**
 * ✅ NEW: (거리계산 + 너 공식)까지 한번에
 * - totalKm은 calcFuelKmByCase로 먼저 구하고,
 * - fuel_type + 설정단가 + 연비로 유류비를 계산한다.
 */
function calcFuelAmountByCaseWithLiter(opts) {
    const totalKm = calcFuelKmByCase({
        depart_place: opts.depart_place,
        return_place: opts.return_place,
        destination: opts.destination,
        vehicle: opts.vehicle,
        companyDistances: opts.companyDistances,
        userDistances: opts.userDistances,
    });
    const pricePerLiter = pickFuelPricePerLiterByType(opts.fuel_type, {
        gasoline: opts.fuel_price_gasoline,
        diesel: opts.fuel_price_diesel,
        lpg: opts.fuel_price_lpg,
    });
    const amount = calcFuelAmountByLiter(totalKm, opts.km_per_liter, pricePerLiter);
    console.log("[FUEL DEBUG][CASE+LITER]", {
        destination: opts.destination,
        depart_place: opts.depart_place,
        return_place: opts.return_place,
        vehicle: opts.vehicle,
        fuel_type: opts.fuel_type,
        totalKm,
        km_per_liter: opts.km_per_liter,
        pricePerLiter,
        amount,
    });
    return { totalKm, amount, pricePerLiter };
}
// =====================================================
// ✅ 호환 유지: 예전 코드가 calcFuelAmount(km, pricePerKm) 쓰면 그대로 동작
// =====================================================
function calcFuelAmount(totalKm, pricePerKm = DEFAULT_FUEL_PRICE_PER_KM) {
    console.log("[FUEL DEBUG][PER_KM]", { totalKm, pricePerKm });
    return Math.round(safePositive(totalKm, 0) * safePositive(pricePerKm, DEFAULT_FUEL_PRICE_PER_KM));
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