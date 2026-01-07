// TypeScript/workspace/01_dashboard-trip-status.ts

type TripStatusItem = {
  trip_id: string;
  req_name: string;
  trip_date: string;
  depart_place: string;
  destination: string;
  depart_time: string;
  arrive_time: string;
  status: string; // REGISTERED / SETTLED
};

/**
 * ✅ 당직/휴일/휴가 타입 (대시보드 표시)
 */
type DutyAssign = { date: string; name: string };
type HolidayItem = {
  date: string; // YYYY-MM-DD
  dow: string; // 요일(일~토)
  type: "주말" | "공휴일";
  holidayName?: string;
};

type VacationItem = {
  id: number;
  user_no: number | null;
  user_name: string;
  vac_type: "annual" | "half" | "etc";
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  note?: string;
  created_at?: string;
};

type DutyMember = { no: number; name: string };

// ✅ 대시보드 일정 타입 (회사 일정)
type CalendarEventItem = {
  id: number;
  date: string;   // YYYY-MM-DD
  title: string;  // 예: "장비검수"
};

/** ✅ 출장업무관리 config 타입(대시보드에서 필요한 것만) */
type BusinessMasterConfig = {
  notice?: string;
  note?: string;

  km_per_liter?: number | null;

  fuel_price_gasoline?: number | null;
  fuel_price_diesel?: number | null;
  fuel_price_lpg?: number | null;

  exchange_rate_usd?: number | null;
  exchange_rate_jpy?: number | null;
  exchange_rate_cny?: number | null;
};

// ----------------------
// 유틸
// ----------------------
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ym(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function todayYmd() {
  return ymd(new Date());
}

function parseLocdateToYmd(loc: string) {
  // 20260101 -> 2026-01-01
  const s = String(loc ?? "");
  if (!/^\d{8}$/.test(s)) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function getDowKr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const map = ["일", "월", "화", "수", "목", "금", "토"];
  return map[d.getDay()] ?? "";
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

function getAllDaysOfMonth(base: Date) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 1; i <= last; i++) days.push(new Date(y, m, i));
  return days;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function vacTypeLabel(t: string) {
  if (t === "annual") return "연차";
  if (t === "half") return "반차";
  return "기타";
}

function isYmdStr(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ✅ 숫자 표시 유틸
function fmtNumber(v: any, fallback = "0") {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString();
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ✅ duty 로테이션 계산용
function addMonthsToYm(ymStr: string, delta: number) {
  const [y, m] = ymStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function compareYm(a: string, b: string) {
  return a.localeCompare(b);
}
function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

// ----------------------
// ✅ DOM이 늦게 생기는 문제 해결(기존 유지)
// ----------------------
async function waitForElement<T extends HTMLElement>(id: string, timeoutMs = 8000): Promise<T | null> {
  const start = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      const el = document.getElementById(id) as T | null;
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// ----------------------
// ✅ API: 휴일(주말+공휴일)
// ----------------------
async function fetchHolidayItemsForMonth(API_BASE: string, base: Date): Promise<HolidayItem[]> {
  const year = String(base.getFullYear());
  const month = pad2(base.getMonth() + 1);

  // 1) 주말
  const days = getAllDaysOfMonth(base);
  const weekend: HolidayItem[] = days
    .map((d) => ymd(d))
    .filter((ds) => isWeekend(ds))
    .map((ds) => ({
      date: ds,
      dow: getDowKr(ds),
      type: "주말" as const,
    }));

  // 2) 공휴일 API
  let apiHolidays: HolidayItem[] = [];
  try {
    const res = await fetch(`${API_BASE}/api/business-master/holidays?year=${year}&month=${month}`, {
      credentials: "include",
    });
    const json = await res.json().catch(() => null);

    if (res.ok && json?.ok === true) {
      const list = Array.isArray(json.holidays) ? json.holidays : [];
      apiHolidays = list
        .filter((h: any) => h && h.date)
        .map((h: any) => {
          const ds = parseLocdateToYmd(String(h.date));
          if (!ds) return null;
          return {
            date: ds,
            dow: getDowKr(ds),
            type: "공휴일" as const,
            holidayName: String(h.name ?? "").trim() || undefined,
          };
        })
        .filter(Boolean) as HolidayItem[];
    }
  } catch (e) {
    console.warn("[대시보드] 공휴일 API 실패(주말만 표시):", e);
  }

  // 3) 합치기(중복 제거): 공휴일 우선
  const map = new Map<string, HolidayItem>();
  weekend.forEach((w) => map.set(w.date, w));
  apiHolidays.forEach((h) => map.set(h.date, h));

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ----------------------
// ✅ API: 휴가
// ----------------------
async function fetchVacations(API_BASE: string): Promise<VacationItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/business-master/vacations`, {
      credentials: "include",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok !== true) return [];
    return Array.isArray(json.items) ? (json.items as VacationItem[]) : [];
  } catch {
    return [];
  }
}

// ✅ "월 기준 날짜별 휴가자 배열" map
function buildVacationMapForMonth(items: VacationItem[], base: Date) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const monthStart = new Date(y, m, 1);
  const monthEnd = new Date(y, m + 1, 0);

  const map: Record<string, string[]> = {};

  for (const v of items) {
    if (!v?.user_name) continue;
    if (!isYmdStr(v.start_date) || !isYmdStr(v.end_date)) continue;

    const s = new Date(v.start_date + "T00:00:00");
    const e = new Date(v.end_date + "T00:00:00");

    const start = s < monthStart ? monthStart : s;
    const end = e > monthEnd ? monthEnd : e;
    if (start > end) continue;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = ymd(d);
      map[key] = map[key] ?? [];
      if (!map[key].includes(v.user_name)) map[key].push(v.user_name);
    }
  }
  return map;
}

// ----------------------
// ✅ API: 사용자(당직 후보)
// ----------------------
async function fetchDutyMembers(API_BASE: string): Promise<DutyMember[]> {
  try {
    const res = await fetch(`${API_BASE}/api/users`, { credentials: "include" });
    if (!res.ok) return [];
    const rows = await res.json().catch(() => []);
    const list = Array.isArray(rows) ? rows : [];

    return list
      .map((u: any) => ({
        no: Number(u.no ?? u.No ?? 0),
        name: String(u.name ?? u.Name ?? "").trim(),
      }))
      .filter((u: DutyMember) => u.no > 0 && u.name)
      .sort((a: DutyMember, b: DutyMember) => a.no - b.no);
  } catch {
    return [];
  }
}

// ----------------------
// ✅ API: config(duty_members_text + notice + fuel + fx)
// ----------------------
type DutyConfigParsed = {
  startIndex: number; // 다음 시작 인덱스
  lastYm: string; // "YYYY-MM"
  lastAssigns: DutyAssign[];
};

async function fetchBusinessMasterConfig(API_BASE: string): Promise<BusinessMasterConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/business-master/config`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;

    return {
      notice: typeof data.notice === "string" ? data.notice : undefined,
      note: typeof data.note === "string" ? data.note : undefined,
      km_per_liter: (data.km_per_liter ?? null) as any,

      fuel_price_gasoline: (data.fuel_price_gasoline ?? null) as any,
      fuel_price_diesel: (data.fuel_price_diesel ?? null) as any,
      fuel_price_lpg: (data.fuel_price_lpg ?? null) as any,

      exchange_rate_usd: (data.exchange_rate_usd ?? null) as any,
      exchange_rate_jpy: (data.exchange_rate_jpy ?? null) as any,
      exchange_rate_cny: (data.exchange_rate_cny ?? null) as any,
    };
  } catch {
    return null;
  }
}

async function fetchDutyConfig(API_BASE: string): Promise<DutyConfigParsed> {
  try {
    const res = await fetch(`${API_BASE}/api/business-master/config`, { credentials: "include" });
    if (!res.ok) return { startIndex: 0, lastYm: "", lastAssigns: [] };
    const data = await res.json().catch(() => ({} as any));

    const raw = String(data?.duty_members_text ?? "");
    if (!raw) return { startIndex: 0, lastYm: "", lastAssigns: [] };

    try {
      const parsed = JSON.parse(raw);
      const startIndex = Number(parsed?.startIndex ?? 0);
      const lastYm = String(parsed?.lastYm ?? "");
      const lastAssigns = Array.isArray(parsed?.lastAssigns)
        ? parsed.lastAssigns
          .map((a: any) => ({
            date: String(a?.date ?? ""),
            name: String(a?.name ?? ""),
          }))
          .filter((a: DutyAssign) => isYmdStr(a.date) && !!a.name)
        : [];
      return { startIndex, lastYm, lastAssigns };
    } catch {
      return { startIndex: 0, lastYm: "", lastAssigns: [] };
    }
  } catch {
    return { startIndex: 0, lastYm: "", lastAssigns: [] };
  }
}

// ✅ 회사 일정(캘린더용) 불러오기
async function fetchDashboardSchedules(API_BASE: string, ymStr: string): Promise<CalendarEventItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/business-master/calendar-events?ym=${encodeURIComponent(ymStr)}`,
      { credentials: "include" }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok !== true) return [];
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

// ----------------------
// ✅ 대시보드: 공지/유류/환율 렌더 (추가)
// ----------------------
async function refreshDashboardTopNoticeFuelFx(API_BASE: string) {
  // DOM이 없을 수도 있으니(패널 전환 시) 기다렸다가 세팅
  await waitForElement<HTMLElement>("fuelUnitGasoline", 8000);
  await waitForElement<HTMLElement>("fxUsdKrw", 8000);

  const cfg = await fetchBusinessMasterConfig(API_BASE);
  if (!cfg) return;

  // 1) 공지(상단 공지판)
 
  //const noticeCard = document.querySelector("#panel-dashboard .bg-white .font-bold.text-gray-800") as HTMLElement | null;
 
  const noticeCard = Array.from(document.querySelectorAll<HTMLElement>("#panel-dashboard .bg-white"))
    .find((el) => (el.textContent || "").includes("공지사항 알림판")) ?? null;

  if (noticeCard) {
    let out = noticeCard.querySelector<HTMLElement>("#dashNoticeText");
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
  if (elElec && !elElec.textContent) elElec.textContent = "0";

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
function renderDashboardHolidayDuty(
  holidays: HolidayItem[],
  assignsMap: Record<string, string>,
  vacMap: Record<string, string[]>
) {
  const tbody = document.getElementById("dutyHolidayBody") as HTMLTableSectionElement | null;
  if (!tbody) return;

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
      const typeLabel =
        h.type === "공휴일"
          ? h.holidayName
            ? `공휴일(${h.holidayName})`
            : "공휴일"
          : "주말";

      const dutyName = assignsMap[h.date] || "";
      const vacNames = vacMap[h.date] ?? [];

      const lines: string[] = [];
      if (dutyName) lines.push(`당직: ${escapeHtml(dutyName)}`);
      if (vacNames.length) lines.push(`휴가: ${vacNames.map(escapeHtml).join(", ")}`);

      const cell =
        lines.length === 0
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
  let label = document.getElementById("dutyCalLabel") as HTMLDivElement | null;
  if (!label) {
    label = document.createElement("div");
    label.id = "dutyCalLabel";
    label.className = "hidden";
    document.body.appendChild(label);
  }
  const txt = (label.textContent || "").trim();
  if (!/^\d{4}-\d{2}$/.test(txt)) label.textContent = ym(new Date());
}

function renderDashboardCalendarGrid(
  viewingYm: string,
  holidays: HolidayItem[],
  assignsMap: Record<string, string>,
  vacMap: Record<string, string[]>
) {
  const grid = document.getElementById("dutyCalGrid") as HTMLDivElement | null;
  if (!grid) return;

  ensureDutyCalLabel();
  const label = document.getElementById("dutyCalLabel") as HTMLDivElement | null;
  if (label) label.textContent = viewingYm;

  const m = viewingYm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return;

  const y = Number(m[1]);
  const mo = Number(m[2]); // 1~12

  const first = new Date(y, mo - 1, 1);
  const lastDay = new Date(y, mo, 0).getDate();
  const startDow = first.getDay(); // 0=일

  const holidayMap = new Map<string, HolidayItem>();
  for (const h of holidays) holidayMap.set(h.date, h);

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
function appendSchedulesToDashboardCalendar(viewingYm: string, schedules: CalendarEventItem[]) {
  const grid = document.getElementById("dutyCalGrid") as HTMLDivElement | null;
  if (!grid) return;

  const monthItems = schedules.filter((s) => s.date.startsWith(viewingYm));

  const map = new Map<string, CalendarEventItem[]>();
  for (const it of monthItems) {
    if (!map.has(it.date)) map.set(it.date, []);
    map.get(it.date)!.push(it);
  }

  const cells = grid.querySelectorAll<HTMLDivElement>("div[data-date]");
  cells.forEach((cell) => {
    const date = cell.dataset.date!;
    const items = map.get(date);
    if (!items?.length) return;

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
async function computeDutyAssignsForYm(
  API_BASE: string,
  viewingYm: string,
  members: DutyMember[],
  cfg: DutyConfigParsed
): Promise<DutyAssign[]> {
  if (!members.length) return [];

  const len = members.length;
  const safeStartIndex = mod(Number(cfg.startIndex || 0), len);

  // lastYm가 없으면: 그냥 0부터 현재월 휴일 수만큼 배정(처음 사용)
  if (!/^\d{4}-\d{2}$/.test(cfg.lastYm)) {
    const [yy, mm] = viewingYm.split("-").map(Number);
    const base = new Date(yy, mm - 1, 1);
    const holidays = await fetchHolidayItemsForMonth(API_BASE, base);

    const assigns: DutyAssign[] = [];
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
  async function getHolidayCount(ymStr: string): Promise<number> {
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
  } else {
    // 과거 월: 뒤로 돌리기
    let idxAfter = safeStartIndex;

    for (let cur = cfg.lastYm; compareYm(cur, addMonthsToYm(viewingYm, 1)) >= 0; cur = addMonthsToYm(cur, -1)) {
      const cnt = await getHolidayCount(cur);
      idxAfter = mod(idxAfter - cnt, len);
      if (compareYm(cur, addMonthsToYm(viewingYm, 1)) === 0) break;
    }

    const viewingCnt = await getHolidayCount(viewingYm);
    startIdx = mod(idxAfter - viewingCnt, len);
  }

  const [yy, mm] = viewingYm.split("-").map(Number);
  const base = new Date(yy, mm - 1, 1);
  const holidays = await fetchHolidayItemsForMonth(API_BASE, base);

  const assigns: DutyAssign[] = [];
  let idx = startIdx;

  for (const h of holidays) {
    const name = members[idx]?.name;
    if (name) assigns.push({ date: h.date, name });
    idx = (idx + 1) % len;
  }

  return assigns;
}

// ----------------------
// ✅ 대시보드 캘린더(표+그리드) 전체 리프레시
// ----------------------
async function refreshDashboardDutyVacationCalendar(API_BASE: string) {
  const tbody = await waitForElement<HTMLTableSectionElement>("dutyHolidayBody", 8000);
  const grid = await waitForElement<HTMLDivElement>("dutyCalGrid", 8000);

  if (!tbody && !grid) return;

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

  const assignsMap: Record<string, string> = {};
  for (const a of assigns) assignsMap[a.date] = a.name;

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
function renderDashboardVacation(items: VacationItem[], baseDateYmd: string) {
  const kpiEl = document.getElementById("kpiVacationToday") as HTMLElement | null;
  const tbody = document.getElementById("vacationStatusTableBody") as HTMLTableSectionElement | null;
  if (!tbody) return;

  const searchInput = document.getElementById("vacationSearchInput") as HTMLInputElement | null;
  const filterSelect = document.getElementById("vacationFilterType") as HTMLSelectElement | null;

  let todayItems = items.filter((v) => {
    const s = String(v.start_date || "");
    const e = String(v.end_date || "");
    return s && e && s <= baseDateYmd && baseDateYmd <= e;
  });

  const filter = filterSelect?.value ?? "all";
  if (filter !== "all") {
    todayItems = todayItems.filter((v) => v.vac_type === (filter as any));
  }

  const kw = (searchInput?.value ?? "").trim().toLowerCase();
  if (kw) {
    todayItems = todayItems.filter((v) => {
      const name = (v.user_name ?? "").toLowerCase();
      const note = (v.note ?? "").toLowerCase();
      return name.includes(kw) || note.includes(kw);
    });
  }

  if (kpiEl) kpiEl.textContent = String(todayItems.length);

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

async function loadDashboardVacation(API_BASE: string, dateYmd: string) {
  const tbody = document.getElementById("vacationStatusTableBody") as HTMLTableSectionElement | null;
  if (!tbody) return;

  const dateLabel = document.getElementById("vacationStatusDateLabel") as HTMLElement | null;
  if (dateLabel) dateLabel.textContent = "오늘";

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
      const kpiEl = document.getElementById("kpiVacationToday") as HTMLElement | null;
      if (kpiEl) kpiEl.textContent = "0";
      return;
    }

    const items: VacationItem[] = Array.isArray(json.items) ? json.items : [];
    renderDashboardVacation(items, dateYmd);
  } catch (e) {
    console.error("[대시보드 휴가] 로딩 실패:", e);
    tbody.innerHTML = `
      <tr>
        <td class="px-2 py-2 text-center text-red-500" colspan="5">휴가자 현황 로딩 중 오류</td>
      </tr>
    `;
    const kpiEl = document.getElementById("kpiVacationToday") as HTMLElement | null;
    if (kpiEl) kpiEl.textContent = "0";
  }
}

/**
 * 📌 대시보드 - 출장자 현황 + 오늘 출장 인원
 */
export function initDashboardTripStatus(API_BASE: string) {
  const kpiTripEl = document.getElementById("kpiTripToday");
  const tbody = document.getElementById("tripStatusTbody") as HTMLTableSectionElement | null;
  const dateLabel = document.getElementById("tripStatusDateLabel");
  const searchInput = document.getElementById("tripSearchInput") as HTMLInputElement | null;
  const filterSelect = document.getElementById("tripFilterType") as HTMLSelectElement | null;
  const reloadBtn = document.getElementById("btnTripReload") as HTMLButtonElement | null;

  if (!kpiTripEl || !tbody) {
    console.warn("[대시보드] 출장자 현황용 요소를 찾지 못했습니다.");
    return;
  }

  const tbodyEl = tbody as HTMLTableSectionElement;

  let lastItems: TripStatusItem[] = [];
  let currentDate: string | undefined;

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

      const statusLabel =
        it.status === "SETTLED"
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

  async function loadTripStatus(date?: string) {
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
      if (date) params.set("date", date);

      const url =
        params.toString().length > 0
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
      const rows: TripStatusItem[] = json?.data ?? [];

      lastItems = rows;

      (kpiTripEl as HTMLElement).textContent = String(rows.length);

      renderTable();
    } catch (err: any) {
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
  const vacationSearchInput = document.getElementById("vacationSearchInput") as HTMLInputElement | null;
  const vacationFilterType = document.getElementById("vacationFilterType") as HTMLSelectElement | null;
  const btnVacationReload = document.getElementById("btnVacationReload") as HTMLButtonElement | null;

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
