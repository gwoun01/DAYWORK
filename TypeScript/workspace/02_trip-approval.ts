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

  submitted_at?: string | null; // ✅ 제출여부
};

type WeeklyGroup = {
  key: string;
  weekStart: string;
  weekEnd: string;
  req_name: string;
  company_part: string;
  rows: TripRow[];
};

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element not found: #${id}`);
  return el as T;
}

/** ISO 날짜 또는 문자열 → YYYY-MM-DD */
function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 요일(월화수목금토일) */
function dowKorFromYMD(ymd: string): string {
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return "";
  const map = ["일", "월", "화", "수", "목", "금", "토"];
  return map[d.getDay()] ?? "";
}

function formatDateWithDow(ymd: string): string {
  const a = formatDateLabel(ymd);
  const w = dowKorFromYMD(a);
  return w ? `${a}(${w})` : a;
}

/** 특정 날짜가 속한 주(월~일) 구하기 */
function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const x = formatDateLabel(dateStr);
    return { start: x, end: x };
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
      };
      map.set(key, group);
    }
    group.rows.push(row);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.weekStart !== b.weekStart) return a.weekStart.localeCompare(b.weekStart);
    if (a.company_part !== b.company_part) return a.company_part.localeCompare(b.company_part);
    return a.req_name.localeCompare(b.req_name);
  });
}

const API_BASE =
  location.hostname === "gwoun01.github.io"
    ? "https://outwork.sel3.cloudtype.app"
    : "http://127.0.0.1:5050";

let currentGroup: WeeklyGroup | null = null;

/** ✅ 차량값이 뭐로 오든 표준화 */
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
   ✅ 시간/근무/잔업/일비 유틸
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

/** 업무시간(분) 계산: start~end (자정 넘어가면 +24h 처리) */
function calcWorkMinutes(startHHMM: string, endHHMM: string): number | null {
  const s = parseHHMMToMinutes(startHHMM);
  const e = parseHHMMToMinutes(endHHMM);
  if (s == null || e == null) return null;

  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** ✅ 직원 화면(10_domestic-trip-history.ts)과 동일 규칙 3줄 생성 */
function buildWork3LinesForAdmin(reg: any, set: any) {
  const departStart = reg?.depart_time || "-"; // 출발시간
  const arriveTime = reg?.arrive_time || "-";  // 도착시간(출장지 도착)

  const returnStart = set?.work_end_time || "-"; // 복귀 출발 (=업무 종료)
  const returnArrive = set?.return_time || "-";  // 복귀 도착

  const workStart = reg?.work_start_time || arriveTime || "-";
  const workEnd = set?.work_end_time || "-";

  const departLine =
    (departStart !== "-" && arriveTime !== "-")
      ? `출발 (출발시간 ${departStart} ~ 도착시간 ${arriveTime})`
      : "출발 (-)";

  const returnLine =
    (returnStart !== "-" && returnArrive !== "-")
      ? `복귀 (출발시간 ${returnStart} ~ 도착시간 ${returnArrive})`
      : "복귀 (-)";

  const workMins = (workStart !== "-" && workEnd !== "-") ? calcWorkMinutes(workStart, workEnd) : null;

  const workLine =
    (workMins != null)
      ? `업무시간 ${workStart} ~ ${workEnd} (총 ${formatDuration(workMins)})`
      : "업무시간 -";

  return { departLine, returnLine, workLine, workEnd, workMins };
}

/** ✅ 그룹 상태(주간 리스트에 표시) */
function groupStatusLabel(g: WeeklyGroup): { text: string; cls: string } {
  // 하나라도 rejected면 반려 우선
  const anyRejected = g.rows.some((r) => (r.approve_status as any) === "rejected");
  if (anyRejected) return { text: "반려", cls: "text-rose-600 font-bold" };

  // 전부 approved면 승인
  const allApproved = g.rows.length > 0 && g.rows.every((r) => (r.approve_status as any) === "approved");
  if (allApproved) return { text: "승인", cls: "text-emerald-700 font-bold" };

  // 그 외는 대기(제출됨)
  return { text: "대기", cls: "text-indigo-600 font-bold" };
}

export function initTripApprovalPanel(_panelId: string) {
  const fromInput = getEl<HTMLInputElement>("appr_from");
  const toInput = getEl<HTMLInputElement>("appr_to");
  const statusSelect = getEl<HTMLSelectElement>("appr_status");
  const searchBtn = getEl<HTMLButtonElement>("appr_search");
  const resultMsg = getEl<HTMLDivElement>("appr_result_msg");
  const tbody = getEl<HTMLTableSectionElement>("approve_result_tbody");

  // ✅ 기본 조회 기간: "이번 주(월~일)" 자동 세팅
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  fromInput.value = monday.toISOString().slice(0, 10);
  toInput.value = sunday.toISOString().slice(0, 10);

  // ✅ 관리자 자동갱신 함수
  function triggerAdminRefresh() {
    const btn = document.getElementById("appr_search") as HTMLButtonElement | null;
    if (btn) btn.click();
  }

  // ✅ 제출 이벤트가 오면 관리자 화면 자동 갱신(새로고침 X)
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
    const status = statusSelect.value;

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

      let rows: TripRow[] = json.data ?? [];

      // ✅ 혹시 백엔드 필터를 아직 안 넣었다면, 프론트에서도 방어 (제출된 것만)
      rows = rows.filter((r) => !!(r as any).submitted_at);

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

      // ✅ 카운트(제출된 주간 / 총 건수)
      resultMsg.textContent = `제출된 주간 ${groups.length}개 / 총 ${rows.length}건`;

      tbody.innerHTML = "";

      groups.forEach((g) => {
        const tr = document.createElement("tr");

        // 기간(주간) + 요일 표시
        const tdPeriod = document.createElement("td");
        tdPeriod.className = "border px-2 py-1 text-center whitespace-nowrap";
        tdPeriod.textContent = `${formatDateWithDow(g.weekStart)} ~ ${formatDateWithDow(g.weekEnd)}`;
        tr.appendChild(tdPeriod);

        const tdTeam = document.createElement("td");
        tdTeam.className = "border px-2 py-1 text-center";
        tdTeam.textContent = g.company_part;
        tr.appendChild(tdTeam);

        const tdName = document.createElement("td");
        tdName.className = "border px-2 py-1 text-center";
        tdName.textContent = g.req_name;
        tr.appendChild(tdName);

        const tdCount = document.createElement("td");
        tdCount.className = "border px-2 py-1 text-center";
        tdCount.textContent = String(g.rows.length);
        tr.appendChild(tdCount);

        // ✅ 상태 표시 컬럼(대기/승인/반려)
        const st = groupStatusLabel(g);
        const tdStatus = document.createElement("td");
        tdStatus.className = `border px-2 py-1 text-center ${st.cls}`;
        tdStatus.textContent = st.text;
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
        if ((row.approve_status as any) === "approved") continue;
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
        if ((row.approve_status as any) === "rejected") continue;
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
  getEl<HTMLDivElement>("appr_d_date").textContent =
    `${formatDateWithDow(group.weekStart)} ~ ${formatDateWithDow(group.weekEnd)}`;

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
    if (endMin != null && endMin > (20 * 60 + 30)) overtimeDates.push(formatDateLabel(row.trip_date));

    const workTimeHtml = `
      <div class="text-gray-700">${w.departLine}</div>
      <div class="text-gray-700">${w.returnLine}</div>
      <div class="font-bold text-indigo-600 mt-1">${w.workLine}</div>
    `;

    const meals = set.meals || {};
    const tr = document.createElement("tr");

    tr.appendChild(td(formatDateWithDow(row.trip_date)));      // ✅ 일자+요일
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
  const pending = group.rows.filter((r) => !r.approve_status || (r.approve_status as any) === "pending").length;
  const approved = group.rows.filter((r) => (r.approve_status as any) === "approved").length;
  const rejected = group.rows.filter((r) => (r.approve_status as any) === "rejected").length;

  const footer = getEl<HTMLDivElement>("appr_footer_info");
  footer.textContent = `총 ${total}건 / 대기 ${pending}건 / 승인 ${approved}건 / 반려 ${rejected}건`;

  // 의견 초기화
  getEl<HTMLTextAreaElement>("appr_comment").value = group.rows[0]?.approve_comment ?? "";

  // ✅ 잔업비 알림
  if (overtimeDates.length > 0) {
    const uniq = Array.from(new Set(overtimeDates));
    alert(`※잔업비 확인하세요\n(업무 종료시간 20:30 초과)\n- ${uniq.join(", ")}`);
  }
}
