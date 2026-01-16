// TypeScript/workspace/10_domestic-trip-history.ts

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
  depart_time?: string; // 출발시간
  arrive_time?: string; // 출장지 도착시간
  purpose?: string;
};

type SettlementBlock = {
  work_end_time?: string; // ✅ 업무 종료시간 (= 복귀 출발시간으로 간주)
  return_time?: string;   // ✅ 복귀 도착시간
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
  trip_date: string; // DB date 또는 ISO 문자열이 올 수 있음
  start_data?: any;
  end_data?: any;
  detail_json: {
    register?: RegisterBlock;
    settlement?: SettlementBlock;
  };
  created_at: string;
  approve_status?: "approved" | "rejected" | null;
  approve_comment?: string | null;
  submitted_at?: string | null;
};

const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];

// ✅ ISO/Date/DB-date 어떤 값이 와도 "YYYY-MM-DD" 로 안전하게
function ymdSafe(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) return "-";
  // "2026-01-16T00:00:00.000Z" 같은 경우 → 앞 10자리만
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
  const d = new Date(ymd); // "YYYY-MM-DD"는 로컬 기준으로 잘 계산됨
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

  // 중복 바인딩 방지
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
  if (!fromInput.value || !toInput.value) setThisWeekRange();

  // =========================
  // ✅ 제출 이벤트: 관리자(02) 자동 갱신용
  // =========================
  function notifyTripSubmitted(payload?: any) {
    window.dispatchEvent(new CustomEvent("trip:submitted", { detail: payload ?? {} }));

    try {
      const bc = new BroadcastChannel("trip-events");
      bc.postMessage({ type: "trip:submitted", payload: payload ?? {}, ts: Date.now() });
      bc.close();
    } catch {}

    try {
      localStorage.setItem("trip:submitted", JSON.stringify({ payload: payload ?? {}, ts: Date.now() }));
    } catch {}
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
    const reasons: string[] = [];
    if (!okWeek) reasons.push("제출은 월~일(1주일) 기간만 가능");
    if (!hasRows) reasons.push("조회된 내역 없음");
    if (hasRows && !allSettled) reasons.push("정산 저장이 안 된 날짜가 있음");
    if (anySubmitted) reasons.push("이미 제출된 내역이 포함됨");

    if (canSubmit) {
      resultMsg.textContent = `총 ${lastRows.length}건 조회 / ✅ 제출 가능합니다.`;
    } else {
      // 기존에 “총 n건 조회”가 보이던 UX는 유지하면서, 제출 이유도 같이
      const base = `총 ${lastRows.length}건 조회`;
      const why = reasons.length ? ` / ⛔ ${reasons.join(" · ")}` : "";
      resultMsg.textContent = base + why;
    }
  }

  function statusText(r: BusinessTripRow) {
    if (!r.submitted_at) return "미제출";
    if (r.approve_status === "approved") return "승인(O)";
    if (r.approve_status === "rejected") return "반려(X)";
    return "제출";
  }

  function renderRows(rows: BusinessTripRow[]) {
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

      const departLine =
        (departStart !== "-" && arriveTime !== "-")
          ? `출발 (출발시간 ${departStart} ~ 도착시간 ${arriveTime})`
          : "출발 (-)";

      const returnLine =
        (returnStart !== "-" && returnArrive !== "-")
          ? `복귀 (출발시간 ${returnStart} ~ 도착시간 ${returnArrive})`
          : "복귀 (-)";

      const workDiff =
        (workStart !== "-" && workEnd !== "-")
          ? calcHourDiff(workStart, workEnd)
          : "-";

      const workLine =
        (workDiff !== "-")
          ? `업무시간 ${workStart} ~ ${workEnd} (총 ${workDiff})`
          : "업무시간 -";

      // 차량 표기
      const vehicleRaw = String(s.vehicle ?? "").trim();
      const vehicleText =
        vehicleRaw === "personal" ? "개인차" :
        vehicleRaw === "corp" ? "법인차" :
        vehicleRaw === "public" ? "대중교통" :
        vehicleRaw === "other" ? "기타" :
        (vehicleRaw || "-");

      // 식사 표기
      const meals = s.meals || {};
      const mealStrs: string[] = [];
      if (meals.breakfast?.checked) mealStrs.push(`조식(${meals.breakfast.owner === "corp" ? "법인" : "개인"})`);
      if (meals.lunch?.checked) mealStrs.push(`중식(${meals.lunch.owner === "corp" ? "법인" : "개인"})`);
      if (meals.dinner?.checked) mealStrs.push(`석식(${meals.dinner.owner === "corp" ? "법인" : "개인"})`);
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
    if (!name) return;

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

    const rows = (json.data ?? []) as BusinessTripRow[];
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
  const btnThisWeek = document.getElementById("settle_btn_thisweek") as HTMLButtonElement | null;
  const btnLastWeek = document.getElementById("settle_btn_lastweek") as HTMLButtonElement | null;

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

      if (!confirm("이 기간(주간)의 정산서를 제출하시겠습니까?")) return;

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
    } catch (e) {
      console.error(e);
      alert("서버 오류로 제출에 실패했습니다.");
    }
  };

  // 초기엔 “이번주 기준”으로 보이게 + 제출버튼 조건 반영
  updateSubmitEnabled();
}
