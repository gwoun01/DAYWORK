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
 * ✅ 당직표(대시보드) 복원용 타입/함수
 * - F5 새로고침 시에도 대시보드 표가 다시 채워지게 함
 */
type DutyAssign = { date: string; name: string };
type HolidayItem = {
  date: string; // YYYY-MM-DD
  dow: string; // 요일(일~토)
  type: "주말" | "공휴일";
  holidayName?: string;
};

/**
 * ✅ 휴가자(대시보드 표시) 타입
 * - 백엔드 GET /api/business-master/vacations 에서 내려온다고 가정
 */
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
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

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getAllDaysOfMonth(base: Date) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 1; i <= last; i++) days.push(new Date(y, m, i));
  return days;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

/** YYYY-MM-DD 체크 */
function isYmdStr(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * ✅ 휴가 목록을 "월 기준 날짜별 이름 배열"로 변환
 *   { "2026-01-03": ["홍길동","김철수"], ... }
 */
function buildVacationMapForMonth(items: VacationItem[], base: Date) {
  const y = base.getFullYear();
  const m = base.getMonth(); // 0~11
  const monthStart = new Date(y, m, 1);
  const monthEnd = new Date(y, m + 1, 0);

  const map: Record<string, string[]> = {};

  for (const v of items) {
    if (!v?.user_name) continue;
    if (!isYmdStr(v.start_date) || !isYmdStr(v.end_date)) continue;

    const s = new Date(v.start_date + "T00:00:00");
    const e = new Date(v.end_date + "T00:00:00");

    // 월 범위로 클램프
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

/** 휴가 전체 목록 가져오기 */
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

/**
 * ✅ 대시보드의 휴일/당직 캘린더 tbody(#dutyHolidayBody) 렌더
 * - ✅ 당직 + 휴가 같이 표시 (한 칸에 여러 줄)
 */
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

/**
 * ✅ 휴일 목록(주말 + 공휴일 API) 가져오기
 * - 공휴일 API 실패해도 주말만으로 진행
 */
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
    console.warn("[대시보드 당직] 공휴일 API 실패(주말만 표시):", e);
  }

  // 3) 합치기(중복 제거): 공휴일 우선
  const map = new Map<string, HolidayItem>();
  weekend.forEach((w) => map.set(w.date, w));
  apiHolidays.forEach((h) => map.set(h.date, h));

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * ✅ F5 새로고침 시, 서버 config에서 마지막 생성 결과(lastAssigns)를 읽어
 * 대시보드 캘린더 표(#dutyHolidayBody)를 자동 복원
 * - ✅ 휴가도 같이 합쳐서 표시
 */
async function restoreDashboardDutyFromConfig(API_BASE: string) {
  const tbody = document.getElementById("dutyHolidayBody") as HTMLTableSectionElement | null;
  if (!tbody) return;

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

    const data = await res.json().catch(() => ({} as any));
    const raw = String(data?.duty_members_text ?? "");

    let lastYm = "";
    let lastAssigns: DutyAssign[] = [];

    try {
      const parsed = raw ? JSON.parse(raw) : null;
      lastYm = String(parsed?.lastYm ?? "");
      lastAssigns = Array.isArray(parsed?.lastAssigns) ? parsed.lastAssigns : [];
    } catch {}

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

    const assignsMap: Record<string, string> = {};
    for (const a of lastAssigns) assignsMap[a.date] = a.name;

    // ✅ 휴가도 같이 가져와서 월 map으로 변환
    const vacations = await fetchVacations(API_BASE);
    const vacMap = buildVacationMapForMonth(vacations, base);

    renderDashboardHolidayDuty(holidays, assignsMap, vacMap);
  } catch (e) {
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

function renderDashboardVacation(items: VacationItem[], baseDateYmd: string) {
  const kpiEl = document.getElementById("kpiVacationToday") as HTMLElement | null;
  const tbody = document.getElementById("vacationStatusTableBody") as HTMLTableSectionElement | null;
  if (!tbody) return;

  const searchInput = document.getElementById("vacationSearchInput") as HTMLInputElement | null;
  const filterSelect = document.getElementById("vacationFilterType") as HTMLSelectElement | null;

  // 1) 오늘 포함되는 휴가만
  let todayItems = items.filter((v) => {
    const s = String(v.start_date || "");
    const e = String(v.end_date || "");
    return s && e && s <= baseDateYmd && baseDateYmd <= e;
  });

  // 2) 필터(연차/반차/기타)
  const filter = filterSelect?.value ?? "all";
  if (filter !== "all") {
    todayItems = todayItems.filter((v) => v.vac_type === (filter as any));
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
  if (!tbody) return; // 휴가자 영역 없는 화면이면 무시

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

  // 🔹 필수 DOM 없으면 그냥 종료
  if (!kpiTripEl || !tbody) {
    console.warn("[대시보드] 출장자 현황용 요소를 찾지 못했습니다.");
    return;
  }

  const tbodyEl = tbody as HTMLTableSectionElement;

  let lastItems: TripStatusItem[] = [];
  let currentDate: string | undefined; // YYYY-MM-DD (없으면 오늘)

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
  const vacationSearchInput = document.getElementById("vacationSearchInput") as HTMLInputElement | null;
  const vacationFilterType = document.getElementById("vacationFilterType") as HTMLSelectElement | null;
  const btnVacationReload = document.getElementById("btnVacationReload") as HTMLButtonElement | null;

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
