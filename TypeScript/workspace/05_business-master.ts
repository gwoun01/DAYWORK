// 05_business-master.ts
// 🚗 출장업무 관리 (거리 마스터 + 유류/환율/당직자/공지 설정) 프론트 코드
// ✅ 수정본: "당직 자동 생성" = 휴일(주말+공휴일 API)만 배정 + 표 출력 + 대시보드 표도 자동 채움
// ✅ 추가 수정: F5 새로고침해도 당직표 유지(마지막 생성 결과를 duty_members_text에 같이 저장/복원)
// ✅ 추가: 휴가자 설정(등록/삭제) + 대시보드 휴가자현황 갱신 이벤트
// ✅ 추가: 휴가/당직 요약 캘린더 (월 이동 + 자동 표기)

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

// ======================
// ✅ 요약 캘린더 유틸 (휴가/당직 날짜별 펼치기)
// ======================

type SumCalEvent = {
  date: string; // YYYY-MM-DD
  kind: "VACATION" | "DUTY";
  text: string;
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
function renderDashboardHolidayDuty(holidays: HolidayItem[], assignsMap: Record<string, string>) {
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
}

// ======================
// 메인 진입 함수
// ======================
export function initBusinessMasterPanel(API_BASE: string) {
  console.log("[출장업무관리] initBusinessMasterPanel 시작");

  // DOM 수집
  const panel = document.getElementById("panel-출장업무-관리") as HTMLDivElement | null;
  const distanceTbodyEl = document.getElementById("distanceTbody") as HTMLTableSectionElement | null;

  const btnConfigSave = document.getElementById("btnConfigSave") as HTMLButtonElement | null;
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

  // ✅ 요약 캘린더 DOM (없으면 그냥 기능만 스킵됨)
  const sumCalGrid = document.getElementById("sumCalGrid") as HTMLDivElement | null;
  const sumCalLabel = document.getElementById("sumCalLabel") as HTMLDivElement | null;
  const sumCalPrev = document.getElementById("sumCalPrev") as HTMLButtonElement | null;
  const sumCalNext = document.getElementById("sumCalNext") as HTMLButtonElement | null;

  function setVacMsg(msg: string) {
    if (vacAdminMsg) vacAdminMsg.textContent = msg;
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

  let distanceRows: DistanceRow[] = [];
  let deletedIds: number[] = [];

  // =====================================================
  // ✅ 당직 후보/순번/마지막생성 저장 상태
  // =====================================================
  let dutyMembers: DutyMember[] = [];
  let dutyStartIndex = 0;

  // ✅ F5 복원을 위해 "마지막 생성 결과"도 저장해둠
  let dutyLastYm = ""; // "2026-01"
  let dutyLastAssigns: DutyAssign[] = [];

  // =====================================================
  // ✅ 요약 캘린더 상태
  // =====================================================
  let sumYear = new Date().getFullYear();
  let sumMonth = new Date().getMonth(); // 0~11
  let cachedVacations: VacationItem[] = [];
  let cachedHolidays: HolidayItem[] = [];           // ✅ 추가
  let cachedDutyPreviewYm = "";                     // ✅ 추가
  let cachedDutyPreviewAssigns: DutyAssign[] = [];  // ✅ 추가

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

  function renderSummaryCalendar() {
    if (!sumCalGrid || !sumCalLabel) return; // ✅ HTML 없으면 스킵

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
    let dutyMap = new Map<string, SumCalEvent[]>();
    if (dutyLastYm === viewingYm && Array.isArray(dutyLastAssigns)) {
      dutyMap = buildDutyEvents(dutyLastAssigns);
    }

    // ============================
    // ✅ 표시 제한 설정 (여기 숫자만 바꾸면 됨)
    // ============================
    const MAX_VAC_LINES = 1;  // 휴가: 칸에 2명까지만 표시
    const MAX_DUTY_LINES = 1; // 당직: 칸에 1명만 표시

    function openDayDetail(dateStr: string, vacs: SumCalEvent[], duties: SumCalEvent[]) {
      const modal = document.getElementById("sumCalModal") as HTMLDivElement | null;
      const title = document.getElementById("sumCalModalTitle") as HTMLDivElement | null;
      const body = document.getElementById("sumCalModalBody") as HTMLDivElement | null;
      const btnClose = document.getElementById("sumCalModalClose") as HTMLButtonElement | null;
      const btnOk = document.getElementById("sumCalModalOk") as HTMLButtonElement | null;

      if (!modal || !title || !body) {
        // 모달 HTML 없으면 fallback
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

      body.innerHTML =
        vacHtml ||
        dutyHtml ||
        `<div class="text-xs text-gray-500 text-center py-6">표시할 내용이 없습니다.</div>`;

      const close = () => {
        modal.classList.add("hidden");
      };

      // ✅ 이벤트 중복방지: 기존 핸들러를 덮어씀
      if (btnClose) btnClose.onclick = close;
      if (btnOk) btnOk.onclick = close;

      // 바깥 배경 클릭 시 닫기
      modal.onclick = (e) => {
        const t = e.target as HTMLElement | null;
        if (!t) return;
        if (t === modal) close();
        if (t.classList && t.classList.contains("bg-black/40")) close();
      };

      modal.classList.remove("hidden");
    }
    function makeLine(kind: "VACATION" | "DUTY", text: string) {
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

    function makeMore(kind: "VACATION" | "DUTY", moreCount: number, onClick: () => void) {
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
        for (const v of show) evBox.appendChild(makeLine("VACATION", v.text));

        if (vacs.length > MAX_VAC_LINES) {
          evBox.appendChild(
            makeMore("VACATION", vacs.length - MAX_VAC_LINES, () => openDayDetail(ds, vacs, duties))
          );
        }
      }

      // ✅ 당직: 일부만 표시 + 더보기
      if (duties.length) {
        const show = duties.slice(0, MAX_DUTY_LINES);
        for (const d of show) evBox.appendChild(makeLine("DUTY", d.text));

        if (duties.length > MAX_DUTY_LINES) {
          evBox.appendChild(
            makeMore("DUTY", duties.length - MAX_DUTY_LINES, () => openDayDetail(ds, vacs, duties))
          );
        }
      }

      // ✅ 셀 자체 클릭하면 그 날짜 상세(휴가/당직 전체) 보여주기
      cell.addEventListener("click", () => {
        if (!vacs.length && !duties.length) return;
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
    if (!sumCalGrid || !sumCalLabel) return; // ✅ HTML 없으면 스킵
    cachedVacations = await fetchVacationsAll();
    renderSummaryCalendar();
  }

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
      dutyMembers = Array.isArray(rows)
        ? rows
          .map((u: any) => ({
            no: Number(u.no ?? 0),
            name: String(u.name ?? u.Name ?? "").trim(),
          }))
          .filter((u: DutyMember) => u.no > 0 && u.name)
          .sort((a: DutyMember, b: DutyMember) => a.no - b.no)
        : [];

      if (dutyMembers.length === 0) dutyStartIndex = 0;
      else dutyStartIndex = dutyStartIndex % dutyMembers.length;

      renderDutyMembers();
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
          .map(
            (u: any) =>
              `<option value="${u.no}" data-name="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`
          )
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
              <td class="border-b px-2 py-2 text-center">${escapeHtml(it.start_date)} ~ ${escapeHtml(
            it.end_date
          )}</td>
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

      // ✅ 대시보드 즉시 갱신 이벤트
      window.dispatchEvent(new CustomEvent("vacation-status-refresh"));

      // ✅ 요약 캘린더도 즉시 갱신
      refreshSummaryCalendar();
    } catch (e) {
      console.error("[vac] add err:", e);
      setVacMsg("휴가 등록 중 오류");
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

      // ✅ duty_members_text 복원(startIndex + lastAssigns)
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

      // ✅ 저장된 마지막 결과가 있으면 F5 후에도 표 복원
      if (dutyLastAssigns.length) {
        renderDutyTable(dutyLastAssigns);
      } else {
        renderDutyTable([]);
      }

      // ✅ 요약 캘린더: config 로드 후에도 그리기(당직 lastYm/lastAssigns 반영)
      renderSummaryCalendar();
    } catch (err) {
      console.error("[출장업무관리] 설정 조회 중 오류:", err);
    }
  }

  async function saveConfig(forceSilent: boolean = false) {
    // ✅ startIndex + 마지막생성결과까지 같이 저장
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
  // 이벤트 바인딩
  // =====================================================
  btnConfigSave?.addEventListener("click", () => saveConfig(false));
  btnDistanceAddRow?.addEventListener("click", () => addEmptyRow());
  btnDistanceSave?.addEventListener("click", () => saveDistances());

  // ✅ 휴가 등록 버튼
  btnVacAdd?.addEventListener("click", () => addVacation());

  // ✅ 휴가 삭제(테이블 클릭)
  vacationAdminTbody?.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (!target?.classList.contains("vac-del-btn")) return;

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

      // ✅ 요약 캘린더도 즉시 갱신
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
