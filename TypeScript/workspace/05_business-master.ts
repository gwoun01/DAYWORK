// 05_business-master.ts
// 🚗 출장업무 관리 (거리 마스터 + 유류/환율/당직자/공지 설정) 프론트 코드
// ✅ 수정본: "당직 자동 생성" = 휴일(주말+공휴일 API)만 배정 + 표 출력 + 대시보드 표도 자동 채움
// ✅ 추가 수정: F5 새로고침해도 당직표 유지(마지막 생성 결과를 duty_members_text에 같이 저장/복원)
// ✅ 추가: 휴가자 설정(등록/삭제) + 대시보드 휴가자현황 갱신 이벤트
// ✅ 추가: 휴가/당직 요약 캘린더 (월 이동 + 자동 표기)
// ✅ 추가: 📌 캘린더 일정(등록 → 캘린더에 표시)

type BusinessConfig = {
  fuel_price_gasoline: number | null;
  fuel_price_diesel: number | null;
  fuel_price_lpg: number | null;

  exchange_rate_usd: number | null;
  exchange_rate_jpy: number | null;
  exchange_rate_cny: number | null;

  duty_members_text: string; // ✅ 여기 안에 JSON 문자열로 저장 (startIndex, lastYm, lastAssigns 등)
  notice: string;
};

type DistanceRow = {
  id: number | null;
  region: string;
  client_name: string;
  distance_km: number | null;
};

type DutyMember = {
  no: number;
  name: string;
};

type DutyAssign = {
  date: string; // YYYY-MM-DD
  name: string;
};

type HolidayItem = {
  date: string; // YYYY-MM-DD
  dow: string; // 요일(일~토)
  type: "주말" | "공휴일";
  holidayName?: string;
};

// ✅ 휴가 타입/아이템
type VacationItem = {
  id: number;
  user_no: number | null;
  user_name: string;
  vac_type: "annual" | "half" | "etc";
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  note?: string;
  created_at: string;
};

// ✅✅✅ 일정(캘린더 이벤트) 타입
type CalendarEventItem = {
  id: number;
  date: string;       // YYYY-MM-DD
  title: string;      // 예: "장비검수"
  created_at: string; // ISO
  created_by?: number | null;
};

// ======================
// 유틸
// ======================

function parseNumberOrNull(value: string): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapRawDistance(row: any): DistanceRow {
  return {
    id: row.id != null ? Number(row.id) : null,
    region: String(row.region ?? ""),
    client_name: String(row.client_name ?? ""),
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ym(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseLocdateToYmd(loc: string) {
  const s = String(loc ?? "");
  if (!/^\d{8}$/.test(s)) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function getDowKr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const map = ["일", "월", "화", "수", "목", "금", "토"];
  return map[day] ?? "";
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
function openVacNoteModal(name: string, range: string, note: string) {
  alert(`[비고]\n${name}\n${range}\n\n${note}`);
}

// ✅ 월 계산 유틸(로테이션 프리뷰에 필요)
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

// ✅✅✅ YYYY-MM-DD 체크(일정/필터에 사용)
function isYmd(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ======================
// ✅ 요약 캘린더 유틸 (휴가/당직/일정 날짜별 펼치기)
// ======================

type SumCalEvent = {
  date: string; // YYYY-MM-DD
  kind: "VACATION" | "DUTY" | "SCHEDULE";
  text: string;
  id?: number; // ✅ 일정 삭제용 (SCHEDULE만 사용)
};
function datesBetweenInclusive(start: string, end: string) {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(ymd(d));
  }
  return out;
}

function buildVacationEvents(items: VacationItem[]) {
  const map = new Map<string, SumCalEvent[]>();

  for (const it of items) {
    if (!it?.start_date || !it?.end_date) continue;
    const label = `${it.user_name}(${vacTypeLabel(it.vac_type)})`;
    const days = datesBetweenInclusive(it.start_date, it.end_date);

    for (const ds of days) {
      if (!map.has(ds)) map.set(ds, []);
      map.get(ds)!.push({
        date: ds,
        kind: "VACATION",
        text: label,
      });
    }
  }
  return map;
}

function buildDutyEvents(assigns: DutyAssign[]) {
  const map = new Map<string, SumCalEvent[]>();
  for (const a of assigns) {
    if (!a?.date || !a?.name) continue;
    if (!map.has(a.date)) map.set(a.date, []);
    map.get(a.date)!.push({
      date: a.date,
      kind: "DUTY",
      text: a.name,
    });
  }
  return map;
}

// ✅✅✅ 일정(캘린더 이벤트) 펼치기
function buildScheduleEvents(items: CalendarEventItem[]) {
  const map = new Map<string, SumCalEvent[]>();
  for (const it of items) {
    if (!it?.date || !isYmd(it.date)) continue;

    const title = String(it.title ?? "").trim();
    if (!title) continue;

    if (!map.has(it.date)) map.set(it.date, []);
    map.get(it.date)!.push({
      date: it.date,
      kind: "SCHEDULE",
      text: title,
      id: Number(it.id), // ✅ 삭제용 id
    });
  }
  return map;
}

// ======================
// ✅ 대시보드 휴가/당직 캘린더 (당직생성과 무관하게 자동 표시)
// ======================

type DashEvent = { kind: "VACATION" | "DUTY"; text: string };

function buildVacationMapForDash(items: VacationItem[]) {
  const map = new Map<string, DashEvent[]>();
  for (const it of items) {
    if (!it?.start_date || !it?.end_date) continue;
    const label = `${it.user_name}(${vacTypeLabel(it.vac_type)})`;
    const days = datesBetweenInclusive(it.start_date, it.end_date);
    for (const ds of days) {
      if (!map.has(ds)) map.set(ds, []);
      map.get(ds)!.push({ kind: "VACATION", text: label });
    }
  }
  return map;
}

function buildDutyMapForDash(assigns: DutyAssign[]) {
  const map = new Map<string, DashEvent[]>();
  for (const a of assigns) {
    if (!a?.date || !a?.name) continue;
    if (!map.has(a.date)) map.set(a.date, []);
    map.get(a.date)!.push({ kind: "DUTY", text: a.name });
  }
  return map;
}

function renderDashboardCalGrid(
  viewingYm: string,
  holidays: HolidayItem[],
  dutyAssigns: DutyAssign[],
  vacations: VacationItem[]
) {
  const grid = document.getElementById("dutyCalGrid") as HTMLDivElement | null;
  const label = document.getElementById("dutyCalLabel") as HTMLDivElement | null;
  if (!grid || !label) return;

  label.textContent = viewingYm;

  const [y, m] = viewingYm.split("-").map(Number);
  if (!y || !m) return;

  const first = new Date(y, m - 1, 1);
  const lastDate = new Date(y, m, 0).getDate();
  const startDow = first.getDay(); // 0=일

  const holidayMap = new Map<string, HolidayItem>();
  for (const h of holidays) holidayMap.set(h.date, h);

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
function renderDutyTable(assigns: DutyAssign[]) {
  const box = document.getElementById("dutyTableBox") as HTMLDivElement | null;
  if (!box) return;

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
  let label = document.getElementById("dutyCalLabel") as HTMLDivElement | null;

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
function renderDashboardHolidayDuty(holidays: HolidayItem[], assignsMap: Record<string, string>) {
  const tbody = document.getElementById("dutyHolidayBody") as HTMLTableSectionElement | null;
  if (!tbody) return;

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
      const typeLabel =
        h.type === "공휴일"
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
  const grid = document.getElementById("dutyCalGrid") as HTMLDivElement | null;
  const tbody = document.getElementById("dutyHolidayBody") as HTMLTableSectionElement | null;
  if (!grid || !tbody) return;

  ensureDutyCalLabel();
  const label = document.getElementById("dutyCalLabel") as HTMLDivElement | null;
  if (!label) return;

  const ymTxt = (label.textContent || "").trim(); // "YYYY-MM"
  const m = ymTxt.match(/^(\d{4})-(\d{2})$/);
  if (!m) return;

  const y = Number(m[1]);
  const mo = Number(m[2]); // 1~12

  const first = new Date(y, mo - 1, 1);
  const lastDay = new Date(y, mo, 0).getDate();
  const startDow = first.getDay(); // 0=일

  // 표에서 이벤트 읽기: key="YYYY-MM-DD" -> { typeTxt, dutyTxt }
  const eventMap = new Map<string, { typeTxt: string; dutyTxt: string }[]>();
  const rows = Array.from(tbody.querySelectorAll("tr"));

  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (tds.length < 4) continue;

    const mmdd = (tds[0].textContent || "").trim(); // "01-03"
    const typeTxt = (tds[2].textContent || "").trim(); // "주말" / "공휴일(...)"
    const dutyTxt = (tds[3].textContent || "").trim(); // "홍길동" or "-"

    const md = mmdd.match(/^(\d{2})-(\d{2})$/);
    if (!md) continue;

    const key = `${y}-${md[1]}-${md[2]}`;
    if (!eventMap.has(key)) eventMap.set(key, []);
    eventMap.get(key)!.push({ typeTxt, dutyTxt });
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
export function initBusinessMasterPanel(API_BASE: string) {
  console.log("[출장업무관리] initBusinessMasterPanel 시작");

  // DOM 수집
  const panel = document.getElementById("panel-출장업무-관리") as HTMLDivElement | null;
  const distanceTbodyEl = document.getElementById("distanceTbody") as HTMLTableSectionElement | null;

  // ✅✅✅ 유류/환율 통합 저장 버튼(신규)
  const btnFuelFxSave = document.getElementById("btnFuelFxSave") as HTMLButtonElement | null;

  const btnNoticeUpload = document.getElementById("btnNoticeUpload") as HTMLButtonElement | null;
  const noticeUploadMsg = document.getElementById("noticeUploadMsg") as HTMLSpanElement | null;
  const btnDistanceAddRow = document.getElementById("btnDistanceAddRow") as HTMLButtonElement | null;
  const btnDistanceSave = document.getElementById("btnDistanceSave") as HTMLButtonElement | null;

  const inputFuelGasoline = document.getElementById("cfgFuelGasoline") as HTMLInputElement | null;
  const inputFuelDiesel = document.getElementById("cfgFuelDiesel") as HTMLInputElement | null;
  const inputFuelGas = document.getElementById("cfgFuelGas") as HTMLInputElement | null;

  const inputUsd = document.getElementById("cfgUsd") as HTMLInputElement | null;
  const inputJpy = document.getElementById("cfgJpy") as HTMLInputElement | null;
  const inputCny = document.getElementById("cfgCny") as HTMLInputElement | null;

  const textareaNotice = document.getElementById("cfgNotice") as HTMLTextAreaElement | null;

  const dutyTbody = document.getElementById("dutyTbody") as HTMLTableSectionElement | null;

  const btnDutyGenerateThisMonth =
    (document.getElementById("btnDutyGenerateThisMonth") as HTMLButtonElement | null) ||
    (document.getElementById("btnDutyGenThisMonth") as HTMLButtonElement | null);

  const dutyResultBox = document.getElementById("dutyResultBox") as HTMLDivElement | null;

  // ✅ 휴가자 설정 DOM
  const vacUserSelect = document.getElementById("vacUserSelect") as HTMLSelectElement | null;
  const vacTypeSelect = document.getElementById("vacTypeSelect") as HTMLSelectElement | null;
  const vacFrom = document.getElementById("vacFrom") as HTMLInputElement | null;
  const vacTo = document.getElementById("vacTo") as HTMLInputElement | null;
  const vacNote = document.getElementById("vacNote") as HTMLInputElement | null;
  const btnVacAdd = document.getElementById("btnVacAdd") as HTMLButtonElement | null;
  const vacationAdminTbody = document.getElementById("vacationAdminTbody") as HTMLTableSectionElement | null;
  const vacAdminMsg = document.getElementById("vacAdminMsg") as HTMLDivElement | null;

  // ✅ 요약 캘린더 DOM
  const sumCalGrid = document.getElementById("sumCalGrid") as HTMLDivElement | null;
  const sumCalLabel = document.getElementById("sumCalLabel") as HTMLDivElement | null;
  const sumCalPrev = document.getElementById("sumCalPrev") as HTMLButtonElement | null;
  const sumCalNext = document.getElementById("sumCalNext") as HTMLButtonElement | null;

  // ✅✅✅ 일정 추가 DOM (캘린더 아래)
  const calTodoDate = document.getElementById("calTodoDate") as HTMLInputElement | null;
  const calTodoText = document.getElementById("calTodoText") as HTMLInputElement | null;
  const btnCalTodoAdd = document.getElementById("btnCalTodoAdd") as HTMLButtonElement | null;
  const calTodoMsg = document.getElementById("calTodoMsg") as HTMLDivElement | null;

  // ✅ 당직 후보 추가 UI
  const dutyAddSelect = document.getElementById("dutyAddSelect") as HTMLSelectElement | null;
  const btnDutyAddUser = document.getElementById("btnDutyAddUser") as HTMLButtonElement | null;

  function setVacMsg(msg: string) {
    if (vacAdminMsg) vacAdminMsg.textContent = msg;
  }

  function setTodoMsg(msg: string) {
    if (calTodoMsg) calTodoMsg.textContent = msg;
  }
  function setNoticeMsg(msg: string) {
    if (noticeUploadMsg) noticeUploadMsg.textContent = msg;
  }
  if (!panel || !distanceTbodyEl) {
    console.warn("[출장업무관리] 필수 DOM(panel-출장업무-관리, distanceTbody) 없음");
    return;
  }

  if ((panel as any)._bound) {
    console.debug("[출장업무관리] 이미 초기화됨, 재바인딩 안함");
    return;
  }
  (panel as any)._bound = true;


  const distanceTbody = distanceTbodyEl;

  // ✅✅✅ 통합 저장 핸들러 (유류/환율/공지/당직 등 saveConfig에 들어있는 값 저장)
  const onSave = async () => {
    await saveConfig(); // ✅ 기존 설정 저장 함수 그대로 사용
    window.dispatchEvent(new CustomEvent("business-config-changed"));
  };

  let distanceRows: DistanceRow[] = [];
  let deletedIds: number[] = [];

  // =====================================================
  // ✅ 당직 후보/순번/마지막생성 저장 상태
  // =====================================================
  let dutyMembers: DutyMember[] = [];
  let dutyStartIndex = 0;

  // ✅ 사용자관리 전체 목록(삭제해도 남아있어서 다시 추가 가능)
  let allUsers: DutyMember[] = [];

  // ✅ F5 복원을 위해 "마지막 생성 결과"도 저장해둠
  let dutyLastYm = ""; // "2026-01"
  let dutyLastAssigns: DutyAssign[] = [];

  // =====================================================
  // ✅ 요약 캘린더 상태
  // =====================================================
  let sumYear = new Date().getFullYear();
  let sumMonth = new Date().getMonth(); // 0~11

  let cachedVacations: VacationItem[] = [];
  let cachedHolidays: HolidayItem[] = [];
  let cachedDutyPreviewYm = "";
  let cachedDutyPreviewAssigns: DutyAssign[] = [];

  // ✅✅✅ 일정 캐시(현재 달)
  let cachedCalendarEvents: CalendarEventItem[] = [];

  async function fetchVacationsAll(): Promise<VacationItem[]> {
    try {
      const res = await fetch(`${API_BASE}/api/business-master/vacations`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) return [];
      return Array.isArray(json.items) ? (json.items as VacationItem[]) : [];
    } catch {
      return [];
    }
  }

  // ✅✅✅ 일정(현재 월) 가져오기
  async function fetchCalendarEvents(ymStr: string): Promise<CalendarEventItem[]> {
    try {
      const res = await fetch(`${API_BASE}/api/business-master/calendar-events?ym=${ymStr}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) return [];
      return Array.isArray(json.items) ? (json.items as CalendarEventItem[]) : [];
    } catch {
      return [];
    }
  }

  // ✅✅✅ 일정 추가(등록 버튼)
  async function addCalendarTodo() {
    if (!calTodoDate || !calTodoText) return;

    const date = String(calTodoDate.value || "");
    const title = String(calTodoText.value || "").trim();

    if (!date) return setTodoMsg("날짜를 선택하세요.");
    if (!title) return setTodoMsg("내용을 입력하세요.");

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
    } catch (e) {
      console.error("[calendar-events][add] err:", e);
      setTodoMsg("등록 중 오류");
    }
  }
  // ✅✅✅ 일정 삭제
  async function deleteCalendarTodo(id: number) {
    if (!Number.isFinite(id) || id <= 0) return;

    const ok = confirm("이 일정을 삭제할까요?");
    if (!ok) return;

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
    } catch (e) {
      console.error("[calendar-events][delete] err:", e);
      setTodoMsg("삭제 중 오류");
    }
  }
  // =====================================================
  // ✅ 공휴일 API + 주말 합쳐서 “휴일 리스트”
  // =====================================================
  async function fetchHolidayItemsForMonth(base: Date): Promise<HolidayItem[]> {
    const year = String(base.getFullYear());
    const month = pad2(base.getMonth() + 1);

    const days = getAllDaysOfMonth(base);
    const weekend: HolidayItem[] = days
      .map((d) => ymd(d))
      .filter((ds) => isWeekend(ds))
      .map((ds) => ({
        date: ds,
        dow: getDowKr(ds),
        type: "주말" as const,
      }));

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
      console.warn("[휴일] 공휴일 API 실패(주말만으로 진행):", e);
    }

    const map = new Map<string, HolidayItem>();
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
    } catch (e) {
      console.error("[notice][upload] err:", e);
      setNoticeMsg("업로드 중 오류");
      alert("업로드 중 오류");
    }
  }
  // ==========================
  // ✅ 요약 캘린더 렌더 (교체본)
  // ==========================
  function renderSummaryCalendar() {
    if (!sumCalGrid || !sumCalLabel) return;

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
    let dutyMap = new Map<string, SumCalEvent[]>();
    if (cachedDutyPreviewYm === viewingYm && Array.isArray(cachedDutyPreviewAssigns)) {
      dutyMap = buildDutyEvents(cachedDutyPreviewAssigns);
    }

    // ✅ 일정: 현재 달 캐시로 표시
    const schMap = buildScheduleEvents(cachedCalendarEvents);

    const holidayMap = new Map<string, HolidayItem>();
    for (const h of cachedHolidays) holidayMap.set(h.date, h);

    // ✅ 표시 제한
    const MAX_VAC_LINES = 1;
    const MAX_DUTY_LINES = 1;
    const MAX_SCH_LINES = 1;

    // --------------------------
    // 모달 열기 (휴가/당직/일정 상세)
    // --------------------------
    function openDayDetail(dateStr: string, vacs: SumCalEvent[], duties: SumCalEvent[], schs: SumCalEvent[]) {
      const modal = document.getElementById("sumCalModal") as HTMLDivElement | null;
      const title = document.getElementById("sumCalModalTitle") as HTMLDivElement | null;
      const body = document.getElementById("sumCalModalBody") as HTMLDivElement | null;
      const btnClose = document.getElementById("sumCalModalClose") as HTMLButtonElement | null;
      const btnOk = document.getElementById("sumCalModalOk") as HTMLButtonElement | null;

      // ✅ 모달 DOM 없으면 alert fallback
      if (!modal || !title || !body) {
        const lines: string[] = [];
        lines.push(`[${dateStr}]`);

        if (vacs.length) {
          lines.push("");
          lines.push(`휴가 (${vacs.length})`);
          for (const v of vacs) lines.push(`- ${v.text}`);
        }
        if (duties.length) {
          lines.push("");
          lines.push(`당직 (${duties.length})`);
          for (const d of duties) lines.push(`- ${d.text}`);
        }
        if (schs.length) {
          lines.push("");
          lines.push(`일정 (${schs.length})`);
          for (const s of schs) lines.push(`- ${s.text}`);
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
          .map(
            (v) => `
                  <div class="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs">
                    휴가 ${escapeHtml(v.text)}
                  </div>
                `
          )
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
          .map(
            (d) => `
                  <div class="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-xs">
                    당직 ${escapeHtml(d.text)}
                  </div>
                `
          )
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
            const btn =
              idAttr
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
        const t = e.target as HTMLElement | null;
        if (!t) return;

        if (t.classList.contains("sumcal-sch-del")) {
          e.preventDefault();
          e.stopPropagation();
          const id = Number((t as HTMLButtonElement).dataset.id);
          if (Number.isFinite(id) && id > 0) {
            deleteCalendarTodo(id); // ✅ 위에 정의된 함수 호출
          }
        }
      };

      const close = () => modal.classList.add("hidden");
      if (btnClose) btnClose.onclick = close;
      if (btnOk) btnOk.onclick = close;

      modal.onclick = (e) => {
        const t = e.target as HTMLElement | null;
        if (!t) return;
        if (t === modal) close();
        // 오버레이를 class로 닫고 싶으면(네 HTML에 맞춰 유지)
        if (t.classList && t.classList.contains("bg-black/40")) close();
      };

      modal.classList.remove("hidden");
    }

    // --------------------------
    // 셀 내부 라인
    // --------------------------
    function makeLine(kind: "VACATION" | "DUTY" | "SCHEDULE", text: string) {
      const div = document.createElement("div");

      if (kind === "VACATION") {
        div.className =
          "px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] leading-tight whitespace-normal break-keep";
        div.textContent = "휴가 " + text;
      } else if (kind === "DUTY") {
        div.className =
          "px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] leading-tight whitespace-normal break-keep";
        div.textContent = "당직 " + text;
      } else {
        div.className =
          "px-1.5 py-0.5 rounded bg-slate-50 text-slate-800 text-[10px] leading-tight whitespace-normal break-keep";
        div.textContent = "일정 " + text;
      }

      return div;
    }

    // --------------------------
    // ✅ 더보기 (makeMore)
    // --------------------------
    function makeMore(kind: "VACATION" | "DUTY" | "SCHEDULE", moreCount: number, onClick: () => void) {
      const div = document.createElement("div");

      if (kind === "VACATION") div.className = "text-[10px] text-amber-700 underline cursor-pointer select-none";
      else if (kind === "DUTY") div.className = "text-[10px] text-indigo-700 underline cursor-pointer select-none";
      else div.className = "text-[10px] text-slate-700 underline cursor-pointer select-none";

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
        for (const v of show) evBox.appendChild(makeLine("VACATION", v.text));

        if (vacs.length > MAX_VAC_LINES) {
          evBox.appendChild(
            makeMore("VACATION", vacs.length - MAX_VAC_LINES, () => openDayDetail(ds, vacs, duties, schs))
          );
        }
      }

      if (duties.length) {
        const show = duties.slice(0, MAX_DUTY_LINES);
        for (const d of show) evBox.appendChild(makeLine("DUTY", d.text));

        if (duties.length > MAX_DUTY_LINES) {
          evBox.appendChild(
            makeMore("DUTY", duties.length - MAX_DUTY_LINES, () => openDayDetail(ds, vacs, duties, schs))
          );
        }
      }

      if (schs.length) {
        const show = schs.slice(0, MAX_SCH_LINES);
        for (const s of show) evBox.appendChild(makeLine("SCHEDULE", s.text));

        if (schs.length > MAX_SCH_LINES) {
          evBox.appendChild(
            makeMore("SCHEDULE", schs.length - MAX_SCH_LINES, () => openDayDetail(ds, vacs, duties, schs))
          );
        }
      }

      // ✅ 셀 클릭: 하나라도 있으면 상세
      cell.addEventListener("click", () => {
        if (!vacs.length && !duties.length && !schs.length) return;
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
    if (!sumCalGrid || !sumCalLabel) return;

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

    if (!/^\d{4}-\d{2}$/.test(dutyLastYm)) dutyLastYm = viewingYm;

    const len = dutyMembers.length;

    async function getHolidayCount(ymStr: string): Promise<number> {
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
    } else {
      let idxAfter = mod(dutyStartIndex, len);

      for (let cur = dutyLastYm; compareYm(cur, addMonthsToYm(viewingYm, 1)) >= 0; cur = addMonthsToYm(cur, -1)) {
        const cnt = await getHolidayCount(cur);
        idxAfter = mod(idxAfter - cnt, len);
        if (compareYm(cur, addMonthsToYm(viewingYm, 1)) === 0) break;
      }

      const viewingCnt = cachedHolidays.length;
      startIdx = mod(idxAfter - viewingCnt, len);
    }

    const assigns: DutyAssign[] = [];
    let idx = startIdx;
    for (const h of cachedHolidays) {
      const name = dutyMembers[idx]?.name;
      if (name) assigns.push({ date: h.date, name });
      idx = (idx + 1) % len;
    }

    cachedDutyPreviewAssigns = assigns;
    renderSummaryCalendar();
  }

  // =====================================================
  // ✅ 당직 후보 추가 select 채우기(전체 사용자 - 현재 후보)
  // =====================================================
  function fillDutyAddSelect() {
    if (!dutyAddSelect) return;

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
    if (!dutyTbody) return;

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
    if (!dutyTbody) return;

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
          .map((u: any) => ({
            no: Number(u.no ?? 0),
            name: String(u.name ?? u.Name ?? "").trim(),
          }))
          .filter((u: DutyMember) => u.no > 0 && u.name)
          .sort((a: DutyMember, b: DutyMember) => a.no - b.no)
        : [];

      // ✅ 기존 기능 유지: 처음엔 전체 사용자를 당직 후보로 세팅
      dutyMembers = allUsers.map((u) => ({ no: u.no, name: u.name }));

      if (dutyMembers.length === 0) dutyStartIndex = 0;
      else dutyStartIndex = dutyStartIndex % dutyMembers.length;

      renderDutyMembers();
      refreshSummaryCalendar();
    } catch (err) {
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
    if (!vacUserSelect) return;

    try {
      const res = await fetch(`${API_BASE}/api/users`, { credentials: "include" });
      const rows = await res.json().catch(() => []);
      const list = Array.isArray(rows) ? rows : [];

      const users = list
        .map((u: any) => ({
          no: Number(u.no ?? u.No ?? 0),
          name: String(u.name ?? u.Name ?? "").trim(),
        }))
        .filter((u: any) => u.no > 0 && u.name)
        .sort((a: any, b: any) => a.no - b.no);

      vacUserSelect.innerHTML =
        `<option value="">선택</option>` +
        users
          .map((u: any) => `<option value="${u.no}" data-name="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`)
          .join("");
    } catch (e) {
      console.error("[vac] load users err:", e);
      setVacMsg("사용자 목록 로딩 실패");
    }
  }

  // =====================================================
  // ✅ 휴가자: 목록 렌더/로드
  // =====================================================
  async function loadVacationList() {
    if (!vacationAdminTbody) return;

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

      const items: VacationItem[] = Array.isArray(json.items) ? json.items : [];

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
              <td class="border-b px-2 py-2 text-center whitespace-nowrap">
                ${(it.note ?? "").trim()
              ? `<button type="button"
                        class="vac-note-btn px-2 py-1 text-[11px] rounded-lg border bg-white hover:bg-gray-50"
                        data-name="${escapeHtml(it.user_name)}"
                        data-range="${escapeHtml(it.start_date)} ~ ${escapeHtml(it.end_date)}"
                        data-note="${escapeHtml(it.note ?? "")}">
                        + 내용
                      </button>`
              : `<span class="text-[11px] text-gray-400">-</span>`
            }
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
    } catch (e) {
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
    if (!vacUserSelect || !vacTypeSelect || !vacFrom || !vacTo) return;

    const user_no = vacUserSelect.value ? Number(vacUserSelect.value) : null;
    const opt = vacUserSelect.options[vacUserSelect.selectedIndex];
    const user_name = opt?.getAttribute("data-name") || opt?.textContent || "";

    const vac_type = String(vacTypeSelect.value || "annual");
    const start_date = String(vacFrom.value || "");
    const end_date = String(vacTo.value || "");
    const note = String(vacNote?.value || "");

    if (!user_no || !user_name) return setVacMsg("대상을 선택하세요.");
    if (!start_date || !end_date) return setVacMsg("시작일/종료일을 입력하세요.");
    if (start_date > end_date) return setVacMsg("시작일이 종료일보다 클 수 없습니다.");

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
      if (vacNote) vacNote.value = "";
      await loadVacationList();
      window.dispatchEvent(new CustomEvent("vacation-status-refresh"));

      refreshSummaryCalendar();
    } catch (e) {
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

    const dutyLabel = document.getElementById("dutyCalLabel") as HTMLDivElement | null;
    if (dutyLabel) dutyLabel.textContent = ym(base);

    const holidays = await fetchHolidayItemsForMonth(base);

    if (!holidays.length) {
      alert("이번 달에 휴일(주말/공휴일)이 없습니다. (표시할 데이터 없음)");
      renderDutyTable([]);
      renderDashboardHolidayDuty([], {});
      return;
    }

    const assigns: DutyAssign[] = [];
    const assignsMap: Record<string, string> = {};

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
      const data = (await res.json()) as any;

      const gasoline = data.fuel_price_gasoline ?? data.fuel_price_per_liter ?? null;
      const diesel = data.fuel_price_diesel ?? null;
      const lpg = data.fuel_price_lpg ?? null;

      if (inputFuelGasoline) inputFuelGasoline.value = gasoline?.toString() ?? "";
      if (inputFuelDiesel) inputFuelDiesel.value = diesel?.toString() ?? "";
      if (inputFuelGas) inputFuelGas.value = lpg?.toString() ?? "";

      if (inputUsd) inputUsd.value = data.exchange_rate_usd?.toString() ?? "";
      if (inputJpy) inputJpy.value = data.exchange_rate_jpy?.toString() ?? "";
      if (inputCny) inputCny.value = data.exchange_rate_cny?.toString() ?? "";

      if (textareaNotice) textareaNotice.value = data.notice ?? data.note ?? "";

      const rawDutyText = String(data.duty_members_text ?? "");
      if (rawDutyText) {
        try {
          const parsed = JSON.parse(rawDutyText);

          if (typeof parsed?.startIndex === "number") dutyStartIndex = parsed.startIndex;
          if (typeof parsed?.lastYm === "string") dutyLastYm = parsed.lastYm;

          if (Array.isArray(parsed?.lastAssigns)) {
            dutyLastAssigns = parsed.lastAssigns
              .map((a: any) => ({
                date: String(a?.date ?? ""),
                name: String(a?.name ?? ""),
              }))
              .filter((a: DutyAssign) => /^\d{4}-\d{2}-\d{2}$/.test(a.date) && !!a.name);
          }
        } catch {
          // 무시
        }
      }

      if (dutyResultBox) {
        dutyResultBox.textContent = "- '당직 자동 생성'을 누르면 이번달 휴일(주말+공휴일)에만 자동 배정됩니다.";
      }

      if (dutyLastAssigns.length) renderDutyTable(dutyLastAssigns);
      else renderDutyTable([]);

      ensureDutyCalLabel();
      const dutyLabel = document.getElementById("dutyCalLabel") as HTMLDivElement | null;
      if (dutyLabel) {
        const fallback = /^\d{4}-\d{2}$/.test(dutyLastYm) ? dutyLastYm : ym(new Date());
        dutyLabel.textContent = fallback;
      }

      refreshSummaryCalendar();
      renderDashboardDutyCalendarFromTable();
    } catch (err) {
      console.error("[출장업무관리] 설정 조회 중 오류:", err);
    }
  }

  async function saveConfig(forceSilent: boolean = false) {
    const dutyStore = JSON.stringify({
      startIndex: dutyStartIndex,
      lastYm: dutyLastYm,
      lastAssigns: dutyLastAssigns,
      updatedAt: new Date().toISOString(),
    });

    const body: BusinessConfig = {
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
        if (!forceSilent) alert(json?.error || "설정 저장 중 오류가 발생했습니다.");
        return;
      }
      window.dispatchEvent(new CustomEvent("duty-config-changed"));

      if (!forceSilent) alert("설정이 저장되었습니다.");
    } catch (err) {
      console.error("[출장업무관리] 설정 저장 중 오류:", err);
      if (!forceSilent) alert("설정 저장 중 오류가 발생했습니다.");
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
    } catch (err) {
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
    const rows = distanceTbody.querySelectorAll<HTMLTableRowElement>("tr");
    rows.forEach((tr) => {
      const idxStr = tr.dataset.index;
      if (idxStr == null) return;
      const idx = Number(idxStr);
      const row = distanceRows[idx];
      if (!row) return;

      const regionInput = tr.querySelector<HTMLInputElement>(".region-input");
      const clientInput = tr.querySelector<HTMLInputElement>(".client-input");
      const distanceInput = tr.querySelector<HTMLInputElement>(".distance-km-input");

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
        if (!id) continue;
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
          if (!res.ok) console.error("[출장업무관리] 거리 등록 실패 status=", res.status);
        } else {
          const res = await fetch(`${API_BASE}/api/business-master/distances/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) console.error("[출장업무관리] 거리 수정 실패 id=", row.id, "status=", res.status);
        }
      }

      alert("거리 마스터가 저장되었습니다.");
      await loadDistances();
    } catch (err) {
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
    const target = e.target as HTMLElement;
    if (!target) return;

    if (target.classList.contains("vac-note-btn")) {
      const btn = target as HTMLButtonElement;
      const name = btn.dataset.name || "";
      const range = btn.dataset.range || "";
      const note = btn.dataset.note || "";
      openVacNoteModal(name, range, note);
      return;
    }

    if (!target.classList.contains("vac-del-btn")) return;

    const id = Number((target as HTMLButtonElement).dataset.id);
    if (!Number.isFinite(id)) return;

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
    } catch (err) {
      console.error("[vac] delete err:", err);
      setVacMsg("삭제 중 오류");
    }
  });

  distanceTbody.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target?.classList.contains("btn-row-delete")) return;

    const tr = target.closest("tr") as HTMLTableRowElement | null;
    if (!tr) return;

    const idxStr = tr.dataset.index;
    if (idxStr == null) return;

    const idx = Number(idxStr);
    const row = distanceRows[idx];
    if (!row) return;

    if (row.id != null) deletedIds.push(row.id);
    distanceRows.splice(idx, 1);
    renderDistanceTable();
  });

  dutyTbody?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target?.classList.contains("btn-duty-delete")) return;

    const tr = target.closest("tr") as HTMLTableRowElement | null;
    if (!tr) return;

    const idx = Number(tr.dataset.idx);
    if (!Number.isFinite(idx)) return;

    dutyMembers.splice(idx, 1);

    if (dutyMembers.length === 0) dutyStartIndex = 0;
    else dutyStartIndex = dutyStartIndex % dutyMembers.length;

    renderDutyMembers();
    refreshSummaryCalendar();
  });

  // ✅ 삭제한 사용자 다시 넣기 (select -> 추가)
  btnDutyAddUser?.addEventListener("click", () => {
    if (!dutyAddSelect) return;

    const no = Number(dutyAddSelect.value);
    if (!Number.isFinite(no) || no <= 0) return;

    const user = allUsers.find((u) => u.no === no);
    if (!user) return;

    if (dutyMembers.some((m) => m.no === user.no)) return;

    dutyMembers.push({ no: user.no, name: user.name });

    if (dutyMembers.length === 0) dutyStartIndex = 0;
    else dutyStartIndex = dutyStartIndex % dutyMembers.length;

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
    if (textareaNotice) textareaNotice.value = "";

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

    if (sumCalGrid) sumCalGrid.innerHTML = "";
    if (sumCalLabel) sumCalLabel.textContent = "";

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
  async function reloadBusinessMasterFromServer(reason: string = "") {
    if (_reloadInFlight) return;
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
    } catch (e) {
      console.error("[출장업무관리] reloadBusinessMasterFromServer error:", e);
    } finally {
      _reloadInFlight = false;
    }
  }

  // 3) 패널이 "숨김 -> 표시" 될 때 자동 감지 (showPanel 수정 안 해도 됨)
  //    hidden 클래스가 빠지는 순간마다 reload 실행
  if (!(panel as any)._bmObserver) {
    const obs = new MutationObserver(() => {
      // panel이 보이는 상태인지 체크
      const isHidden = panel.classList.contains("hidden");
      if (isHidden) return;

      // 화면에 실제로 표시되는 상태(대충 체크)
      const isVisible = panel.offsetParent !== null;
      if (!isVisible) return;

      // ✅ 다시 보이면 무조건 서버 재조회
      reloadBusinessMasterFromServer("panel-visible");
    });

    obs.observe(panel, { attributes: true, attributeFilter: ["class"] });
    (panel as any)._bmObserver = obs;
  }

  // 4) 최초 진입 1회 로드
  reloadBusinessMasterFromServer("first-load");
}

