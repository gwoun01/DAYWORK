// src/TypeScript/workspace/02_trip-approval.ts
import { placeLabel } from "./utils/DistanceCalc";

type TripRow = {
  trip_id: string;
  req_name: string;
  trip_date: string;
  start_data: any | null;
  end_data: any | null;
  detail_json: {
    register?: any;
    settlement?: any;
  } | null;

  approve_status: "pending" | "approved" | "rejected" | null;
  approve_by?: string | null;
  approve_at?: string | null;
  approve_comment?: string | null;

  submitted_at?: string | null; // ✅ 제출 여부
  company_part?: string | null;
};

type WeeklyGroup = {
  key: string;
  weekStart: string;
  weekEnd: string;
  req_name: string;
  company_part: string;
  rows: TripRow[];

  // ✅ 주간 상태(요약표에 표시)
  weekStatus: "pending" | "approved" | "rejected";
};

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element not found: #${id}`);
  return el as T;
}

/* =========================
   ✅ KST 날짜 유틸 (UTC 밀림 방지)
========================= */

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 어떤 ms(UTC epoch)든 KST 기준 YYYY-MM-DD */
function ymdFromMsKST(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD → "KST 자정"의 epoch(ms) */
function parseYMDToMsKST(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  // Date.UTC(y, mo-1, d) 는 "UTC 자정". KST 자정은 UTC로 -9시간.
  return Date.UTC(y, mo - 1, d) - KST_OFFSET_MS;
}

/** 지금(브라우저 위치가 어디든) KST 기준 오늘 YYYY-MM-DD */
function todayYMDKST(): string {
  return ymdFromMsKST(Date.now());
}

/** ISO 날짜/문자열 → YYYY-MM-DD (KST UX 우선) */
function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "";
  const s = String(value).trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // "2026-01-19T..." 같은 경우도 KST 기준 날짜로
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return ymdFromMsKST(d.getTime());
}

const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"] as const;
function formatDateWithDow(value: string): string {
  const ymd = formatDateLabel(value);
  const ms = parseYMDToMsKST(ymd);
  if (ms == null) return ymd;

  // KST 기준 요일: (ms+9h) 를 UTC로 보고 getUTCDay
  const dow = new Date(ms + KST_OFFSET_MS).getUTCDay();
  return `${ymd}(${DOW_KR[dow]})`;
}

/** 특정 날짜가 속한 주(월~일) - KST 기준 */
function getWeekRange(dateStr: string): { start: string; end: string } {
  const ymd = formatDateLabel(dateStr);
  const ms = parseYMDToMsKST(ymd);

  if (ms == null) return { start: ymd, end: ymd };

  const dow = new Date(ms + KST_OFFSET_MS).getUTCDay(); // 0=일..6=토 (KST 기준)
  const day = (dow + 6) % 7; // 월=0
  const mondayMs = ms - day * DAY_MS;
  const sundayMs = mondayMs + 6 * DAY_MS;

  return {
    start: ymdFromMsKST(mondayMs),
    end: ymdFromMsKST(sundayMs),
  };
}

/** ✅ 주간 상태 계산 */
function calcWeekStatus(rows: TripRow[]): "pending" | "approved" | "rejected" {
  const anyRejected = rows.some((r) => String(r.approve_status ?? "pending") === "rejected");
  if (anyRejected) return "rejected";
  const allApproved = rows.every((r) => String(r.approve_status ?? "pending") === "approved");
  if (allApproved) return "approved";
  return "pending";
}

/** TripRow[] → 직원+주간 묶기 */
function buildWeeklyGroups(rows: TripRow[]): WeeklyGroup[] {
  const map = new Map<string, WeeklyGroup>();

  for (const row of rows) {
    const { start, end } = getWeekRange(row.trip_date);
    const company_part = (row as any).company_part ?? "-";
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
  for (const g of list) g.weekStatus = calcWeekStatus(g.rows);

  return list.sort((a, b) => {
    if (a.weekStart !== b.weekStart) return a.weekStart.localeCompare(b.weekStart);
    if (a.company_part !== b.company_part) return a.company_part.localeCompare(b.company_part);
    if (a.req_name !== b.req_name) return a.req_name.localeCompare(b.req_name);
    return a.weekStatus.localeCompare(b.weekStatus);
  });
}

const API_BASE =
  location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";

let currentGroup: WeeklyGroup | null = null;

/** ✅ 차량 표준화 */
function normalizeVehicle(v: any): "corp" | "personal" | "other" | "public" | "" {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s === "corp" || s === "corporate") return "corp";
  if (s === "personal") return "personal";
  if (s === "other" || s === "other_personal") return "other";
  if (s === "public") return "public";
  return "other";
}

/** ✅ 차량 표시 라벨 */
function vehicleLabel(v: any): string {
  const code = normalizeVehicle(v);
  if (code === "corp") return "법인";
  if (code === "personal") return "개인";
  if (code === "public") return "대중교통";
  if (code === "other") return "기타";
  return "-";
}

/* =========================
   시간/근무/잔업/일비 유틸
========================= */

function parseHHMMToMinutes(hhmm: any): number | null {
  const s = String(hhmm ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** 업무시간(분) 계산: start~end (자정 넘어가면 +24h) */
function calcWorkMinutes(startHHMM: string, endHHMM: string): number | null {
  const s = parseHHMMToMinutes(startHHMM);
  const e = parseHHMMToMinutes(endHHMM);
  if (s == null || e == null) return null;

  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** ✅ 직원 화면(10)과 동일 3줄 */
function buildWork3LinesForAdmin(reg: any, set: any) {
  const departStart = reg?.depart_time || "-";
  const arriveTime = reg?.arrive_time || "-";

  const returnStart = set?.work_end_time || "-";
  const returnArrive = set?.return_time || "-";

  const workStart = reg?.work_start_time || arriveTime || "-";
  const workEnd = set?.work_end_time || "-";

  const departLine =
    departStart !== "-" && arriveTime !== "-"
      ? `출발 (출발시간 ${departStart} ~ 도착시간 ${arriveTime})`
      : "출발 (-)";

  const returnLine =
    returnStart !== "-" && returnArrive !== "-"
      ? `복귀 (출발시간 ${returnStart} ~ 도착시간 ${returnArrive})`
      : "복귀 (-)";

  const workMins = workStart !== "-" && workEnd !== "-" ? calcWorkMinutes(workStart, workEnd) : null;

  const workLine =
    workMins != null ? `업무시간 ${workStart} ~ ${workEnd} (총 ${formatDuration(workMins)})` : "업무시간 -";

  return { departLine, returnLine, workLine, workEnd, workMins };
}

/** ✅ 상태 라벨 */
function statusLabel(s: "pending" | "approved" | "rejected") {
  if (s === "approved") return "승인";
  if (s === "rejected") return "반려";
  return "제출(대기)";
}
function statusBadgeClass(s: "pending" | "approved" | "rejected") {
  if (s === "approved") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (s === "rejected") return "text-rose-700 bg-rose-50 border-rose-200";
  return "text-indigo-700 bg-indigo-50 border-indigo-200";
}

/* =========================
   ✅ 조회기간 프리셋 버튼(HTML 수정 없이 JS로 삽입)
   - "조회 기간" 라벨 + pill 버튼 (제출화면처럼)
========================= */

function injectRangeButtons(fromInput: HTMLInputElement, toInput: HTMLInputElement, searchBtn: HTMLButtonElement) {
  const fromWrap = fromInput.parentElement;
  const toWrap = toInput.parentElement;
  if (!fromWrap || !toWrap) return;

  // ✅ 시작/종료일 공통 영역(가장 가까운 공통 부모)을 잡아서 그 아래에 bar를 붙인다
  let host: HTMLElement | null = null;

  if (fromWrap.parentElement && fromWrap.parentElement.contains(toWrap)) host = fromWrap.parentElement as HTMLElement;
  else if (toWrap.parentElement && toWrap.parentElement.contains(fromWrap)) host = toWrap.parentElement as HTMLElement;
  else host = (fromWrap.parentElement?.parentElement as HTMLElement | null) ?? (fromWrap as HTMLElement);

  // ✅ 이미 붙었으면 중복 생성 방지
  if ((host as any)._rangeBarInjected) return;
  (host as any)._rangeBarInjected = true;

  const bar = document.createElement("div");
  bar.className = "mt-2 flex items-center gap-3";

  const title = document.createElement("div");
  title.className = "text-xs font-bold text-gray-700 w-[72px] text-center";
  title.textContent = "조회 기간";

  const btnWrap = document.createElement("div");
  btnWrap.className = "flex flex-wrap gap-2";

  const mkBtn = (label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;

    // ✅ 제출화면 느낌의 pill
    b.className =
      "px-3 py-1.5 rounded-full border text-xs bg-white " +
      "border-[#c7d8ee] text-gray-700 hover:bg-[#f5f9ff] active:scale-[0.99]";

    b.addEventListener("click", () => {
      onClick();
      // ✅ UX: 기간 선택 즉시 조회(원래 동작 유지하고 싶으면 이 줄만 지우면 됨)
      searchBtn.click();
    });
    return b;
  };

  // ====== 프리셋 계산 ======
  const setToday = () => {
    const ymd = todayYMDKST();
    fromInput.value = ymd;
    toInput.value = ymd;
  };

  const set1Day = () => setToday(); // 제출화면의 "1일" = 오늘로 (원하면 "최근 1일"로 바꿀 수 있음)

  const set1Week = () => {
    // ✅ 최근 7일(오늘 포함) : 오늘-6 ~ 오늘
    const end = todayYMDKST();
    const endMs = parseYMDToMsKST(end);
    if (endMs == null) return;
    const startMs = endMs - 6 * DAY_MS;
    fromInput.value = ymdFromMsKST(startMs);
    toInput.value = end;
  };

  const set1Month = () => {
    // ✅ 최근 30일(오늘 포함) : 오늘-29 ~ 오늘
    const end = todayYMDKST();
    const endMs = parseYMDToMsKST(end);
    if (endMs == null) return;
    const startMs = endMs - 29 * DAY_MS;
    fromInput.value = ymdFromMsKST(startMs);
    toInput.value = end;
  };

  const setThisMonth = () => {
    const today = todayYMDKST();
    const ms = parseYMDToMsKST(today);
    if (ms == null) return;

    const k = new Date(ms + KST_OFFSET_MS);
    const y = k.getUTCFullYear();
    const m = k.getUTCMonth() + 1;

    const firstMs = Date.UTC(y, m - 1, 1) - KST_OFFSET_MS;
    const lastMs = Date.UTC(y, m, 0) - KST_OFFSET_MS;

    fromInput.value = ymdFromMsKST(firstMs);
    toInput.value = ymdFromMsKST(lastMs);
  };

  const setPrevMonth = () => {
    const today = todayYMDKST();
    const ms = parseYMDToMsKST(today);
    if (ms == null) return;

    const k = new Date(ms + KST_OFFSET_MS);
    let y = k.getUTCFullYear();
    let m = k.getUTCMonth() + 1; // 1~12
    m -= 1;
    if (m <= 0) {
      m = 12;
      y -= 1;
    }

    const firstMs = Date.UTC(y, m - 1, 1) - KST_OFFSET_MS;
    const lastMs = Date.UTC(y, m, 0) - KST_OFFSET_MS;

    fromInput.value = ymdFromMsKST(firstMs);
    toInput.value = ymdFromMsKST(lastMs);
  };

  const setThisWeek = () => {
    const { start, end } = getWeekRange(todayYMDKST());
    fromInput.value = start;
    toInput.value = end;
  };

  const setLastWeek = () => {
    const { start } = getWeekRange(todayYMDKST()); // 이번주 월
    const startMs = parseYMDToMsKST(start);
    if (startMs == null) return;

    const lastMonMs = startMs - 7 * DAY_MS;
    const lastSunMs = lastMonMs + 6 * DAY_MS;
    fromInput.value = ymdFromMsKST(lastMonMs);
    toInput.value = ymdFromMsKST(lastSunMs);
  };

  // ✅ 제출화면 버튼 구성 그대로
  btnWrap.appendChild(mkBtn("1일", set1Day));
  btnWrap.appendChild(mkBtn("1주일", set1Week));
  btnWrap.appendChild(mkBtn("한달", set1Month));
  btnWrap.appendChild(mkBtn("전월", setPrevMonth));
  btnWrap.appendChild(mkBtn("당월", setThisMonth));
  btnWrap.appendChild(mkBtn("이번주(월~일)", setThisWeek));
  btnWrap.appendChild(mkBtn("지난주(월~일)", setLastWeek));

  bar.appendChild(title);
  bar.appendChild(btnWrap);

  // (선택) 제출화면처럼 안내 문구까지 넣고 싶으면 살려둬도 됨
  const note = document.createElement("div");
  note.className = "mt-1 text-[11px] text-gray-500";
  note.textContent = "* 제출은 월~일(1주일) 기간일 때만 가능합니다.";

  host.appendChild(bar);
  host.appendChild(note);
}

export function initTripApprovalPanel(_panelId: string) {
  const fromInput = getEl<HTMLInputElement>("appr_from");
  const toInput = getEl<HTMLInputElement>("appr_to");
  const statusSelect = getEl<HTMLSelectElement>("appr_status");
  const searchBtn = getEl<HTMLButtonElement>("appr_search");
  const resultMsg = getEl<HTMLDivElement>("appr_result_msg");
  const tbody = getEl<HTMLTableSectionElement>("approve_result_tbody");

  // ✅ 중복 바인딩 방지
  if ((searchBtn as any)._bound) return;
  (searchBtn as any)._bound = true;

  // ✅ 조회기간 버튼 삽입 (HTML 수정 없이)
  injectRangeButtons(fromInput, toInput, searchBtn);

  // 기본 조회 기간: 전주(월~일)  ✅ 제출 기준이 전주라서
  // (KST 기준으로 계산)
  {
    const { start } = getWeekRange(todayYMDKST()); // 이번주 월요일
    const thisMonMs = parseYMDToMsKST(start);
    if (thisMonMs != null) {
      const prevMonMs = thisMonMs - 7 * DAY_MS;
      const prevSunMs = prevMonMs + 6 * DAY_MS;
      fromInput.value = ymdFromMsKST(prevMonMs);
      toInput.value = ymdFromMsKST(prevSunMs);
    }
  }

  // ✅ 제출 이벤트가 오면 관리자 화면 자동 갱신(새로고침 X)
  function triggerAdminRefresh() {
    (document.getElementById("appr_search") as HTMLButtonElement | null)?.click();
  }

  window.addEventListener("trip:submitted", () => triggerAdminRefresh());

  try {
    const bc = new BroadcastChannel("trip-events");
    bc.onmessage = (ev) => {
      if (ev?.data?.type === "trip:submitted") triggerAdminRefresh();
    };
  } catch {}

  window.addEventListener("storage", (e) => {
    if (e.key === "trip:submitted") triggerAdminRefresh();
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
      const rows: TripRow[] = json.data ?? [];

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

        // ✅ 상태 컬럼
        const tdStatus = document.createElement("td");
        tdStatus.className = "border px-2 py-1 text-center";
        tdStatus.innerHTML = `
          <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] border ${statusBadgeClass(
            g.weekStatus
          )}">
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
    } catch (err) {
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
  const modal = getEl<HTMLDivElement>("appr_modal");
  const modalCloseBtn = getEl<HTMLButtonElement>("appr_modal_close");
  const btnApprove = getEl<HTMLButtonElement>("appr_btn_approve");
  const btnReject = getEl<HTMLButtonElement>("appr_btn_reject");

  modalCloseBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  });

  // ✅ 주간 승인
  btnApprove.addEventListener("click", async () => {
    if (!currentGroup) return;
    const comment = getEl<HTMLTextAreaElement>("appr_comment").value.trim();

    if (!confirm("이 주간의 모든 출장 건을 승인하시겠습니까?")) return;

    try {
      const approver = (window as any).CURRENT_USER_NAME ?? null;
      let failed = 0;

      for (const row of currentGroup.rows) {
        if (String(row.approve_status ?? "pending") === "approved") continue;

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

      if (failed > 0) alert(`일부(${failed}건)는 승인에 실패했습니다. 콘솔을 확인해주세요.`);
      else alert("해당 주간 출장 건이 모두 승인되었습니다.");

      modal.classList.add("hidden");
      modal.classList.remove("flex");

      // ✅ 승인 후 바로 목록 갱신
      (document.getElementById("appr_search") as HTMLButtonElement | null)?.click();
    } catch (e) {
      console.error(e);
      alert("서버 오류로 승인에 실패했습니다.");
    }
  });

  // ✅ 주간 반려
  btnReject.addEventListener("click", async () => {
    if (!currentGroup) return;
    const comment = getEl<HTMLTextAreaElement>("appr_comment").value.trim();
    if (!comment) {
      if (!confirm("반려 사유가 없습니다. 그래도 반려하시겠습니까?")) return;
    }

    try {
      const approver = (window as any).CURRENT_USER_NAME ?? null;
      let failed = 0;

      for (const row of currentGroup.rows) {
        if (String(row.approve_status ?? "pending") === "rejected") continue;

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

      if (failed > 0) alert(`일부(${failed}건)는 반려에 실패했습니다. 콘솔을 확인해주세요.`);
      else alert("해당 주간 출장 건이 모두 반려되었습니다.");

      modal.classList.add("hidden");
      modal.classList.remove("flex");

      // ✅ 반려 후 바로 목록 갱신
      (document.getElementById("appr_search") as HTMLButtonElement | null)?.click();
    } catch (e) {
      console.error(e);
      alert("서버 오류로 반려에 실패했습니다.");
    }
  });
}

/** 🔍 주간 상세 모달 */
function openWeeklyDetailModal(group: WeeklyGroup) {
  currentGroup = group;

  const modal = getEl<HTMLDivElement>("appr_modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  getEl<HTMLDivElement>("appr_d_name").textContent = group.req_name;
  getEl<HTMLDivElement>("appr_d_date").textContent = `${formatDateWithDow(group.weekStart)} ~ ${formatDateWithDow(
    group.weekEnd
  )}`;

  const tbody = getEl<HTMLTableSectionElement>("appr_detail_tbody");
  tbody.innerHTML = "";

  const sorted = [...group.rows].sort((a, b) => a.trip_date.localeCompare(b.trip_date));

  function td(text: string, cls = "border px-2 py-1 text-center") {
    const el = document.createElement("td");
    el.className = cls;
    el.textContent = text || "";
    return el;
  }

  function tdHTML(html: string, cls = "border px-2 py-2 text-left whitespace-normal leading-snug") {
    const el = document.createElement("td");
    el.className = cls;
    el.innerHTML = html || "";
    return el;
  }

  const mealText = (m: any) => {
    if (!m || !m.checked) return "-";
    if (m.owner === "corp") return "법인";
    if (m.owner === "personal") return "개인";
    return "사용";
  };

  const overtimeDates: string[] = [];
  let totalDailyAllowance = 0;

  for (const row of sorted) {
    const reg = (row.detail_json?.register || row.start_data || {}) as any;
    const set = (row.detail_json?.settlement || row.end_data || {}) as any;

    const w = buildWork3LinesForAdmin(reg, set);

    // ✅ 일비: 업무 8시간(480분) 이상이면 3,000원
    if (w.workMins != null && w.workMins >= 480) totalDailyAllowance += 3000;

    // ✅ 잔업 알림: 업무 종료시간이 20:30 초과
    const endMin = parseHHMMToMinutes(w.workEnd);

    // 자정 이후 종료(00:00~08:30)도 잔업 처리
    const isAfter2030 = endMin != null && endMin > 20 * 60 + 30;
    const isMidnightTo0830 = endMin != null && endMin >= 0 && endMin <= 8 * 60 + 30;

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
    tr.appendChild(td(placeLabel(reg.depart_place ?? "")));
    tr.appendChild(td(reg.destination ?? ""));
    tr.appendChild(tdHTML(workTimeHtml));
    tr.appendChild(td(placeLabel(set.return_place ?? "")));
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
    const set = (row.detail_json?.settlement || row.end_data || {}) as any;
    const c = set.calc || {};
    totalMealsAmount += c.meals_personal_amount ?? 0;
    totalFuelAmount += c.fuel_amount ?? 0;
  }

  const amountBox = getEl<HTMLDivElement>("appr_amount_box");
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

  const footer = getEl<HTMLDivElement>("appr_footer_info");
  footer.textContent = `총 ${total}건 / 대기 ${pending}건 / 승인 ${approved}건 / 반려 ${rejected}건`;

  // 의견 초기화(첫 행의 comment)
  getEl<HTMLTextAreaElement>("appr_comment").value = group.rows[0]?.approve_comment ?? "";

  // ✅ 잔업 알림
  if (overtimeDates.length > 0) {
    const uniq = Array.from(new Set(overtimeDates));
    alert(`※잔업비 확인하세요\n(업무 종료시간 20:30 초과)\n- ${uniq.join(", ")}`);
  }
}
