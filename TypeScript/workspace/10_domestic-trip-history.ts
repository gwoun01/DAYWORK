// TypeScript/workspace/10_domestic-trip-history.ts
// ✅ 통째 교체본 (요구사항 반영 + 삭제 기능 추가)
// 1) 다른 화면 갔다가 오면 무조건 "오늘 기준 전주(월~일)"로 초기세팅 + 조회전 UI 리셋
// 2) 제출 버튼은 "조회된 내역이 있으면" 항상 클릭 가능(주간아님/미정산/이미제출은 클릭 후 안내/모달)
// 3) 주간(월~일) 아니면 모달로 주간 자동 변경 + 재조회 후 제출
// 4) 미정산 포함 / 이미 제출 포함은 alert 안내
// 5) ✅ 반려사유 옆에 [삭제] 버튼 추가
//    - ✅ 승인(approved)만 삭제 불가
//    - ✅ 미제출/제출/반려/대기(pending/null) 삭제 가능
//    - 삭제 후 자동 재조회
import { ModalUtil } from "./utils/ModalUtil";

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element not found: #${id}`);
  return el as T;
}

type RegisterBlock = {
  trip_type?: string;
  req_name?: string;
  depart_place?: string;
  destination?: string;
  start_date?: string;
  work_start_time?: string;
  depart_time?: string;
  arrive_time?: string;
  purpose?: string;
};

type SettlementBlock = {
  work_end_time?: string;
  return_time?: string;
  return_place?: string;
  vehicle?: string;
  meals?: {
    breakfast?: { checked?: boolean; owner?: string };
    lunch?: { checked?: boolean; owner?: string };
    dinner?: { checked?: boolean; owner?: string };
  };
};

type BusinessTripRow = {
  trip_id: string;
  req_name: string;
  trip_date: string;
  start_data?: any;
  end_data?: any;
  detail_json: {
    register?: RegisterBlock;
    settlement?: SettlementBlock;
  };
  created_at: string;
  approve_status?: "approved" | "rejected" | "pending" | null;
  approve_comment?: string | null;
  submitted_at?: string | null;
};

const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];

function ymdSafe(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) return "-";
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatYmdWithDow(v: any): string {
  const ymd = ymdSafe(v);
  if (ymd === "-") return "-";
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${ymd} (${DOW_KR[d.getDay()]})`;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeekMon(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 월요일=1
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekSun(d: Date) {
  const mon = startOfWeekMon(d);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(0, 0, 0, 0);
  return sun;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0); // 다음달 0일 = 이번달 말일
  x.setHours(0, 0, 0, 0);
  return x;
}

function isMonToSunRange(from: string, to: string) {
  const s = new Date(from);
  const e = new Date(to);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return s.getDay() === 1 && e.getDay() === 0 && diff === 6;
}

/** ✅ 근무시간 차액 계산 */
function calcHourDiff(start: string, end: string): string {
  const toMin = (t: string) => {
    const [h, m] = String(t ?? "").split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const s = toMin(start);
  const e = toMin(end);
  if (s == null || e == null) return "-";

  let diff = e - s;
  if (diff < 0) diff += 24 * 60;

  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// 🌟 패널 초기화
export function initDomesticTripHistoryPanel(API_BASE: string) {
  const panel = document.getElementById("panel-국내출장-정산서등록");
  if (!panel) return;

  const searchBtn = getEl<HTMLButtonElement>("settle_search");
  const submitBtn = getEl<HTMLButtonElement>("settle_submit");

  // ✅ 중복 바인딩 방지(이벤트만 중복 막고, "패널 show 초기화"는 MutationObserver가 처리)
  if ((searchBtn as any)._bound) return;
  (searchBtn as any)._bound = true;

  const fromInput = getEl<HTMLInputElement>("settle_from");
  const toInput = getEl<HTMLInputElement>("settle_to");
  const resultMsg = getEl<HTMLDivElement>("settle_result_msg");
  const tbody = getEl<HTMLTableSectionElement>("settle_result_tbody");

  let lastRows: BusinessTripRow[] = [];

  function getLoginUserName(): string | null {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")?.name ?? null;
    } catch {
      return null;
    }
  }

  // ✅ 기본값: 오늘 기준 "전주(월~일)"
  function setLastWeekRange() {
    const mon = startOfWeekMon(new Date());
    mon.setDate(mon.getDate() - 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    fromInput.value = toYMD(mon);
    toInput.value = toYMD(sun);
  }

  function setThisWeekRange() {
    const mon = startOfWeekMon(new Date());
    const sun = endOfWeekSun(new Date());
    fromInput.value = toYMD(mon);
    toInput.value = toYMD(sun);
  }

  // ✅ 조회 버튼들(1일/1주/1달/전월/당월/이번주/지난주) 처리
  function parseBaseDate(): Date {
    const base = String(fromInput.value ?? "").trim();
    const d = base ? new Date(base) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  function setDayRange(base: Date) {
    const y = toYMD(base);
    fromInput.value = y;
    toInput.value = y;
  }

  function setWeekRangeByBase(base: Date) {
    const mon = startOfWeekMon(base);
    const sun = endOfWeekSun(base);
    fromInput.value = toYMD(mon);
    toInput.value = toYMD(sun);
  }

  function setMonthRangeByBase(base: Date) {
    const s = startOfMonth(base);
    const e = endOfMonth(base);
    fromInput.value = toYMD(s);
    toInput.value = toYMD(e);
  }

  function applyPeriod(period: string) {
    const base = parseBaseDate();

    if (period === "1d") return setDayRange(base);
    if (period === "1w") return setWeekRangeByBase(base);
    if (period === "1m") return setMonthRangeByBase(base);

    if (period === "thisWeek") return setThisWeekRange();
    if (period === "lastWeek") return setLastWeekRange();

    if (period === "thisMonth") return setMonthRangeByBase(new Date());
    if (period === "prevMonth") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return setMonthRangeByBase(d);
    }
  }

  // ✅ HTML의 .settle_period_btn 연결
  const periodBtns = Array.from(panel.querySelectorAll<HTMLButtonElement>(".settle_period_btn"));
  periodBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = String(btn.dataset.period ?? "").trim();
      if (!p) return;
      applyPeriod(p);
      updateSubmitEnabled();
    });
  });

  // =========================
  // ✅ "조회 전" 초기 UI 리셋
  // =========================
  function resetResultsUI() {
    lastRows = [];
    resultMsg.textContent = "조회할 기간을 선택한 뒤 [조회하기]를 눌러주세요.";
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="border px-2 py-3 text-center text-gray-400">
          조회된 정산 내역이 없습니다.
        </td>
      </tr>
    `;
    updateSubmitEnabled();
  }
  // =========================
  // ✅ 미제출 주간 안내 모달 (제출 화면에서만!)
  // =========================
  async function checkPendingWeeksModal() {
    const me = getLoginUserName();
    if (!me) return;

    const ymdOnly = (v: any) => {
      const s = String(v ?? "").trim();
      if (!s) return "-";
      // "2026-01-04T00:00:00.000Z" 같은 ISO면 앞 10자리만
      if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return s;
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    };

    try {
      const r = await fetch(
        `${API_BASE}/api/business-trip/settlements-pending-weeks?req_name=${encodeURIComponent(me)}`
      );
      if (!r.ok) return;

      const j = await r.json().catch(() => null);
      const weeks = j?.data?.weeks ?? [];
      const cutoff = ymdOnly(j?.data?.cutoff ?? "");

      if (!Array.isArray(weeks) || weeks.length === 0) return;

      const total = weeks.reduce((a: number, b: any) => a + Number(b?.count ?? 0), 0);
      const first = weeks[0];

      const ws = ymdOnly(first?.week_start);
      const we = ymdOnly(first?.week_end);

      await ModalUtil.show({
        type: "warn",
        title: "미제출 정산이 있습니다",
        messageHtml:
          `${cutoff} 이전 미제출 정산 <b>${total}건</b>이 있습니다.<br/>` +
          `예: <b>${ws} ~ ${we}</b> (${Number(first?.count ?? 0)}건)<br/>` +
          `제출은 <b>지난주까지</b>만 가능합니다.`,
        showOk: true,
        showCancel: false,
        okText: "확인",
        okClass: "bg-amber-600 hover:bg-amber-700",
      });
    } catch {
      // ignore
    }
  }

  // ✅ 패널이 "다시 보일 때마다" 무조건 초기세팅(오늘 기준 전주) + 조회 전 UI 리셋
  function applyDefaultOnPanelShow() {
    setLastWeekRange();
    resetResultsUI();
    checkPendingWeeksModal(); // ✅ 추가
  }

  // ✅ 패널 show 감지 (hidden -> visible)
  const mo = new MutationObserver(() => {
    const isHidden = panel.classList.contains("hidden");
    if (!isHidden) applyDefaultOnPanelShow();
  });
  mo.observe(panel, { attributes: true, attributeFilter: ["class"] });

  // ✅ 첫 진입도 강제
  applyDefaultOnPanelShow();

  // =========================
  // ✅ 제출 이벤트: 관리자(02) 자동 갱신용
  // =========================
  function notifyTripSubmitted(payload?: any) {
    window.dispatchEvent(new CustomEvent("trip:submitted", { detail: payload ?? {} }));

    try {
      const bc = new BroadcastChannel("trip-events");
      bc.postMessage({ type: "trip:submitted", payload: payload ?? {}, ts: Date.now() });
      bc.close();
    } catch { }

    try {
      localStorage.setItem("trip:submitted", JSON.stringify({ payload: payload ?? {}, ts: Date.now() }));
    } catch { }
  }

  // =========================
  // ✅ 모달 helpers
  // =========================
  async function niceAlert(title: string, messageHtml: string, type: "alert" | "warn" = "alert") {
    await ModalUtil.show({
      type,
      title,
      messageHtml,
      showOk: true,
      showCancel: false,
      okText: "확인",
      okClass: type === "warn" ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700",
    });
  }

  async function niceConfirm(title: string, messageHtml: string, okText = "확인", cancelText = "취소") {
    const ok = await ModalUtil.show({
      type: "warn",
      title,
      messageHtml,
      showOk: true,
      showCancel: true,
      okText,
      cancelText,
      okClass: "bg-emerald-600 hover:bg-emerald-700",
      cancelClass: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    });
    return ok === true;
  }

  // =========================
  // ✅ 주간 제출 전용 모달
  // =========================
  async function openWeekSubmitModal(opts: {
    baseFrom: string;
    onConvertAndSubmit: () => void;
  }) {
    const base = opts.baseFrom || "-";
    const baseDate = base && base !== "-" ? new Date(base) : new Date();
    const mon = startOfWeekMon(baseDate);
    const sun = endOfWeekSun(baseDate);
    const monStr = toYMD(mon);
    const sunStr = toYMD(sun);

    const ok = await ModalUtil.show({
      type: "warn",
      title: "제출은 주간(월~일)만 가능합니다",
      messageHtml: `
      현재 선택 기간은 주간(월~일)이 아닙니다.<br/>
      <b class="text-gray-900">${monStr} ~ ${sunStr}</b> (월~일)로 자동 변경 후 제출할까요?
    `,
      showOk: true,
      showCancel: true,
      okText: "주간으로 맞추고 제출",
      cancelText: "취소",
      okClass: "bg-emerald-600 hover:bg-emerald-700",
      cancelClass: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    });

    if (ok !== true) return;

    fromInput.value = monStr;
    toInput.value = sunStr;
    updateSubmitEnabled();
    opts.onConvertAndSubmit();
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

    // ✅ 버튼은 "조회 결과가 있으면" 항상 활성화(모달 띄우기 위해)
    submitBtn.disabled = !hasRows;

    const reasons: string[] = [];
    if (!okWeek) reasons.push("정산은 월~일(1주일) 단위로만 제출 가능");
    if (hasRows && !allSettled) reasons.push("정산 저장이 안 된 날짜가 있음");
    if (hasRows && anySubmitted) reasons.push("이미 제출된 정산이 포함됨");

    const base = `총 ${lastRows.length}건 조회`;
    const why = reasons.length ? ` / ⛔ ${reasons.join(" · ")}` : "";

    if (hasRows && okWeek && allSettled && !anySubmitted) {
      resultMsg.textContent = `${base} / ✅ 제출 가능합니다.`;
    } else {
      resultMsg.textContent = base + why;
    }
  }

  function statusText(r: BusinessTripRow) {
    if (!r.submitted_at) return "미제출";
    if (r.approve_status === "approved") return "승인(O)";
    if (r.approve_status === "rejected") return "반려(X)";
    return "제출";
  }

  function canDeleteRow(r: BusinessTripRow) {
    // ✅ 요구사항: 승인만 삭제 불가, 나머지는 삭제 가능
    return r.approve_status !== "approved";
  }

  async function deleteTripById(tripId: string) {
    const res = await fetch(`${API_BASE}/api/business-trip/${encodeURIComponent(tripId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      const msg = String(json?.message ?? "삭제 실패");
      throw new Error(msg);
    }
    return json;
  }

  function renderRows(rows: BusinessTripRow[]) {
    lastRows = rows;
    updateSubmitEnabled();

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="border px-2 py-3 text-center text-gray-400">
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

      const departStart = r.depart_time || "-";
      const arriveTime = r.arrive_time || "-";

      const returnStart = s.work_end_time || "-";
      const returnArrive = s.return_time || "-";

      const workStart = r.work_start_time || arriveTime || "-";
      const workEnd = s.work_end_time || "-";

      const departLine =
        departStart !== "-" && arriveTime !== "-" ? `출발 (출발시간 ${departStart} ~ 도착시간 ${arriveTime})` : "출발 (-)";

      const returnLine =
        returnStart !== "-" && returnArrive !== "-" ? `복귀 (출발시간 ${returnStart} ~ 도착시간 ${returnArrive})` : "복귀 (-)";

      const workDiff = workStart !== "-" && workEnd !== "-" ? calcHourDiff(workStart, workEnd) : "-";

      const workLine = workDiff !== "-" ? `업무시간 ${workStart} ~ ${workEnd} (총 ${workDiff})` : "업무시간 -";

      const vehicleRaw = String(s.vehicle ?? "").trim();
      const vehicleText =
        vehicleRaw === "personal"
          ? "개인차"
          : vehicleRaw === "corp"
            ? "법인차"
            : vehicleRaw === "public"
              ? "대중교통"
              : vehicleRaw === "other"
                ? "기타"
                : vehicleRaw || "-";

      const meals = s.meals || {};
      const mealStrs: string[] = [];
      if (meals.breakfast?.checked) mealStrs.push(`조식(${meals.breakfast.owner === "corp" ? "법인" : "개인"})`);
      if (meals.lunch?.checked) mealStrs.push(`중식(${meals.lunch.owner === "corp" ? "법인" : "개인"})`);
      if (meals.dinner?.checked) mealStrs.push(`석식(${meals.dinner.owner === "corp" ? "법인" : "개인"})`);
      const mealsText = mealStrs.length ? mealStrs.join(", ") : "-";

      const departPlace = r.depart_place || "";
      const dest = r.destination || "";
      const returnPlace = s.return_place || "";
      const routeText = [departPlace, dest, returnPlace].filter(Boolean).join(" → ") || "-";

      const mainTask = r.purpose || "-";

      const st = statusText(row);
      const rejectReason = row.approve_status === "rejected" ? row.approve_comment ?? "" : "";

      // ✅ 삭제 버튼 (승인이면 disabled)
      const deleteDisabled = !canDeleteRow(row);
      const deleteBtnHtml = `
        <button
          class="trip_del_btn px-2 py-1 rounded-md text-xs font-semibold ${deleteDisabled
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-rose-600 text-white hover:bg-rose-700"
        }"
          data-trip-id="${String(row.trip_id).replace(/"/g, "&quot;")}"
          ${deleteDisabled ? "disabled" : ""}
          title="${deleteDisabled ? "승인된 건은 삭제할 수 없습니다." : "이 출장/정산을 삭제합니다."}"
        >삭제</button>
      `;

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

  <!-- ✅ 반려사유 칸: 반려사유만 -->
  <td class="border px-2 py-1 text-rose-600 whitespace-normal">
    ${rejectReason}
  </td>

  <!-- ✅ 삭제 칸: 삭제 버튼만 (반려사유 옆 공란 칸) -->
  <td class="border px-2 py-1 text-center whitespace-nowrap">
    ${deleteBtnHtml}
  </td>
`;
      tbody.appendChild(tr);

    });

    // ✅ 삭제 버튼 이벤트(렌더 후 한번에 바인딩)
    const delBtns = Array.from(tbody.querySelectorAll<HTMLButtonElement>(".trip_del_btn"));
    delBtns.forEach((btn) => {
      if ((btn as any)._bound) return;
      (btn as any)._bound = true;

      btn.addEventListener("click", async () => {
        const tripId = String(btn.dataset.tripId ?? "").trim();
        if (!tripId) return;

        // 현재 rows에서 상태 확인
        const row = lastRows.find((x) => x.trip_id === tripId);
        if (row?.approve_status === "approved") {
          await niceAlert("삭제 불가", "승인된 건은 삭제할 수 없습니다.", "warn");
          return;
        }

        const yes = await niceConfirm(
          "정산/출장 삭제",
          `정말 삭제하시겠습니까?<br/><b class="text-gray-900">${formatYmdWithDow(row?.trip_date ?? "")}</b>`,
          "삭제",
          "취소"
        );
        if (!yes) return;

        try {
          btn.disabled = true;
          btn.textContent = "삭제중";

          await deleteTripById(tripId);

          await niceAlert("삭제 완료", "삭제되었습니다.");
          await fetchHistory(); // ✅ 삭제 후 재조회
        } catch (e: any) {
          console.error(e);
          await niceAlert("삭제 실패", String(e?.message ?? "삭제 실패"), "warn");
        } finally {
          btn.disabled = false;
          btn.textContent = "삭제";
        }
      });
    });
  }

  async function fetchHistory() {
    const name = getLoginUserName();
    if (!name) return;

    resultMsg.textContent = "조회 중...";
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="border px-2 py-3 text-center text-gray-400">
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

    const rows = (json.data ?? []) as BusinessTripRow[];
    renderRows(rows);
  }

  // ✅ 조회
  searchBtn.onclick = fetchHistory;

  // ✅ 입력 바뀌면 안내 문구 갱신
  fromInput.addEventListener("change", updateSubmitEnabled);
  toInput.addEventListener("change", updateSubmitEnabled);

  // =========================
  // ✅ 제출하기
  // =========================
  async function doSubmitWeek() {
    const name = getLoginUserName();
    if (!name) {
      await niceAlert("로그인 정보 없음", "로그인 정보를 찾을 수 없습니다.", "warn");
      return;
    }

    const yes = await niceConfirm(
      "정산서 제출",
      "이 기간(주간)의 정산서를 제출하시겠습니까?",
      "제출",
      "취소"
    );
    if (!yes) return;

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
      await niceAlert("제출 실패", String(json.message ?? "제출 실패"), "warn");
      return;
    }

    await niceAlert("제출 완료", "제출 완료되었습니다.");
    notifyTripSubmitted({ from: fromInput.value, to: toInput.value, req_name: name });
    await fetchHistory();
  }

  submitBtn.onclick = async () => {
    try {
      // 0) 조회 내역 없음
      if (submitBtn.disabled) {
        await niceAlert("제출할 수 없습니다", "조회된 내역이 없습니다.<br/>먼저 <b>[조회하기]</b>를 눌러주세요.", "warn");
        return;
      }

      // 1) 미정산 포함
      const allSettled = lastRows.every((r) => {
        const s = r.detail_json?.settlement ?? r.end_data ?? {};
        return s && Object.keys(s).length > 0;
      });
      if (!allSettled) {
        await niceAlert(
          "제출할 수 없습니다",
          "미등록 또는 정산저장이 되지 않은 출장입니다.<br/>정산 저장을 완료한 뒤 제출해주세요.",
          "warn"
        );
        return;
      }

      // 2) 이미 제출 포함
      const anySubmitted = lastRows.some((r) => !!r.submitted_at);
      if (anySubmitted) {
        await niceAlert(
          "제출할 수 없습니다",
          "이미 제출된 정산이 포함되어 있습니다.<br/>제출할 주간만 다시 조회해서 제출해주세요.",
          "warn"
        );
        return;
      }

      // 3) 주간 아니면 모달 → 주간으로 맞추고 제출
      const okWeek = isMonToSunRange(fromInput.value, toInput.value);
      if (!okWeek) {
        await openWeekSubmitModal({
          baseFrom: fromInput.value,
          onConvertAndSubmit: async () => {
            await fetchHistory();
            if (!lastRows.length) {
              await niceAlert("제출할 수 없습니다", "해당 주간에 제출할 내역이 없습니다.", "warn");
              return;
            }

            const allSettled2 = lastRows.every((r) => {
              const s = r.detail_json?.settlement ?? r.end_data ?? {};
              return s && Object.keys(s).length > 0;
            });
            if (!allSettled2) {
              await niceAlert(
                "제출할 수 없습니다",
                "미등록 또는 정산저장이 되지 않은 출장입니다.<br/>정산 저장을 완료한 뒤 제출해주세요.",
                "warn"
              );
              return;
            }

            const anySubmitted2 = lastRows.some((r) => !!r.submitted_at);
            if (anySubmitted2) {
              await niceAlert(
                "제출할 수 없습니다",
                "이미 제출된 정산이 포함되어 있습니다.<br/>제출할 주간만 다시 조회해서 제출해주세요.",
                "warn"
              );
              return;
            }

            await doSubmitWeek();
          },
        });
        return;
      }

      // 4) 주간이면 제출
      await doSubmitWeek();
    } catch (e) {
      console.error(e);
      await niceAlert("오류", "서버 오류로 제출에 실패했습니다.", "warn");
    }
  };

  // 초기 반영
  updateSubmitEnabled();
}
