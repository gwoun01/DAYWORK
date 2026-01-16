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
  approve_status?: "approved" | "rejected" | null;
  approve_comment?: string | null;
  submitted_at?: string | null; // ✅ DB에 추가한 컬럼
};

function formatYmd(isoDate: string | Date): string {
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMon(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0=일..6=토
  const diff = (day === 0 ? -6 : 1 - day); // 월요일로
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
  if (!from || !to) return false;
  const s = new Date(from);
  const e = new Date(to);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;

  const okStart = s.getDay() === 1; // 월
  const okEnd = e.getDay() === 0;   // 일
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return okStart && okEnd && diffDays === 6;
}

function diffHHMM(fromHHMM: string, toHHMM: string): string {
  // "01:25" ~ "04:10" -> "02:45"
  const parse = (t: string) => {
    const [h, m] = String(t ?? "").split(":").map((x) => Number(x));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const a = parse(fromHHMM);
  const b = parse(toHHMM);
  if (a == null || b == null) return "-";
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // 자정 넘어가는 케이스 대응
  const hh = String(Math.floor(diff / 60)).padStart(2, "0");
  const mm = String(diff % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// 🌟 정산 내역 보기/제출 패널 초기화
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

  // 기본 날짜: 오늘
  if (!fromInput.value || !toInput.value) {
    const todayStr = toYMD(new Date());
    fromInput.value = todayStr;
    toInput.value = todayStr;
  }

  // ✅ localStorage.user 에서 로그인한 사람의 name 가져오기
  function getLoginUserName(): string | null {
    try {
      const stored = localStorage.getItem("user");
      if (!stored) return null;
      const user = JSON.parse(stored);
      return user?.name ?? null;
    } catch {
      return null;
    }
  }

  function updateSubmitEnabled() {
    // 제출은 “월~일(7일)” + 조회결과 존재 + (가능하면) 모두 정산(end_data 존재) 상태여야 함
    const okWeek = isMonToSunRange(fromInput.value, toInput.value);
    const hasRows = lastRows.length > 0;

    // 정산(end_data) 없는 건 제출 못하게 (네 시스템상 정산 저장이 끝나야 제출 가능)
    const allSettled = lastRows.every((r) => {
      const s = r.detail_json?.settlement ?? r.end_data ?? {};
      return s && Object.keys(s).length > 0;
    });

    submitBtn.disabled = !(okWeek && hasRows && allSettled);
  }

  function statusText(row: BusinessTripRow) {
    // 제출 전: 미제출
    // 제출 후: 제출
    // 관리자 승인/반려: 승인(O), 반려(X)
    if (!row.submitted_at) return "미제출";
    if (row.approve_status === "approved") return "승인(O)";
    if (row.approve_status === "rejected") return "반려(X)";
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

      const dateStr = formatYmd(row.trip_date);

      const workStart = r.work_start_time || "-";
      const workEnd = s.work_end_time || "-";
      const workDur = (workStart !== "-" && workEnd !== "-") ? diffHHMM(workStart, workEnd) : "-";
      const workTimeText = workDur !== "-" ? workDur : `${workStart}~${workEnd}`;

      const vehicleRaw = String(s.vehicle ?? "").trim();
      const vehicleText =
        vehicleRaw === "personal" ? "개인차" :
        vehicleRaw === "corp" ? "법인차" :
        vehicleRaw === "public" ? "대중교통" :
        vehicleRaw ? vehicleRaw : "-";

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
      const rejectReason = (row.approve_status === "rejected" ? (row.approve_comment ?? "") : "");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border px-2 py-1 text-center whitespace-nowrap">${dateStr}</td>
        <td class="border px-2 py-1 text-center whitespace-nowrap">${workTimeText}</td>
        <td class="border px-2 py-1 text-center whitespace-nowrap">${vehicleText}</td>
        <td class="border px-2 py-1 text-center">${mealsText}</td>
        <td class="border px-2 py-1">${routeText}</td>
        <td class="border px-2 py-1">${mainTask}</td>
        <td class="border px-2 py-1 text-center font-semibold whitespace-nowrap">${st}</td>
        <td class="border px-2 py-1 text-rose-600">${rejectReason}</td>
      `;
      tbody.appendChild(tr);
    });
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
          <td colspan="8" class="border px-2 py-3 text-center text-rose-500">
            로그인 정보가 없어 정산 내역을 조회할 수 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    resultMsg.textContent = "정산 내역을 조회 중입니다...";
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="border px-2 py-3 text-center text-gray-400">
          조회 중...
        </td>
      </tr>
    `;

    const qs = new URLSearchParams();
    qs.set("from", from);
    qs.set("to", to);
    qs.set("req_name", reqNameParam);

    try {
      const res = await fetch(`${API_BASE}/api/business-trip/settlements-range?${qs.toString()}`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status} / ${await res.text()}`);

      const json = await res.json();
      const rows: BusinessTripRow[] = json?.data ?? [];

      if (!rows.length) {
        renderRows([]);
        resultMsg.textContent = "조회된 정산 내역이 없습니다.";
        return;
      }

      renderRows(rows);
      resultMsg.textContent = `총 ${rows.length}건의 정산 내역이 조회되었습니다.`;
    } catch (err: any) {
      console.error(err);
      resultMsg.textContent = `조회 실패: ${err?.message ?? "알 수 없는 오류"}`;
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="border px-2 py-3 text-center text-rose-500">
            조회 실패: ${err?.message ?? "알 수 없는 오류"}
          </td>
        </tr>
      `;
      lastRows = [];
      updateSubmitEnabled();
    }
  }

  async function submitWeek() {
    const from = fromInput.value;
    const to = toInput.value;

    if (!isMonToSunRange(from, to)) {
      alert("제출은 월~일(1주일) 기간만 가능합니다.");
      return;
    }

    const reqNameParam = getLoginUserName();
    if (!reqNameParam) {
      alert("로그인 정보가 없습니다.");
      return;
    }

    if (!lastRows.length) {
      alert("제출할 내역이 없습니다.");
      return;
    }

    const ok = confirm(`정산서를 제출할까요?\n기간: ${from} ~ ${to}`);
    if (!ok) return;

    try {
      submitBtn.disabled = true;
      resultMsg.textContent = "제출 중입니다...";

      const res = await fetch(`${API_BASE}/api/business-trip/settlements-submit-week`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, req_name: reqNameParam }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} / ${await res.text()}`);

      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message ?? "제출 실패");

      resultMsg.textContent = "제출 완료! (관리자 승인 대기)";
      await fetchHistory();
    } catch (e: any) {
      console.error(e);
      alert(`제출 실패: ${e?.message ?? "알 수 없는 오류"}`);
      resultMsg.textContent = `제출 실패: ${e?.message ?? "알 수 없는 오류"}`;
      updateSubmitEnabled();
    }
  }

  // ✅ 기간 버튼 이벤트
  panel.querySelectorAll<HTMLButtonElement>(".settle_period_btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.period;
      const today = new Date();

      if (mode === "1d") {
        fromInput.value = toYMD(today);
        toInput.value = toYMD(today);
      } else if (mode === "1w") {
        const end = new Date(today);
        const start = new Date(today);
        start.setDate(end.getDate() - 6);
        fromInput.value = toYMD(start);
        toInput.value = toYMD(end);
      } else if (mode === "1m") {
        const end = new Date(today);
        const start = new Date(today);
        start.setMonth(end.getMonth() - 1);
        fromInput.value = toYMD(start);
        toInput.value = toYMD(end);
      } else if (mode === "prevMonth") {
        const firstThis = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastPrev = new Date(firstThis);
        lastPrev.setDate(0);
        fromInput.value = toYMD(firstPrev);
        toInput.value = toYMD(lastPrev);
      } else if (mode === "thisMonth") {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        fromInput.value = toYMD(first);
        toInput.value = toYMD(last);
      } else if (mode === "thisWeek") {
        const mon = startOfWeekMon(today);
        const sun = endOfWeekSun(today);
        fromInput.value = toYMD(mon);
        toInput.value = toYMD(sun);
      } else if (mode === "lastWeek") {
        const last = new Date(today);
        last.setDate(last.getDate() - 7);
        const mon = startOfWeekMon(last);
        const sun = endOfWeekSun(last);
        fromInput.value = toYMD(mon);
        toInput.value = toYMD(sun);
      }

      updateSubmitEnabled();
    });
  });

  // 날짜 직접 변경 시 제출버튼 활성화 갱신
  fromInput.addEventListener("change", updateSubmitEnabled);
  toInput.addEventListener("change", updateSubmitEnabled);

  // 버튼 이벤트 연결
  searchBtn.addEventListener("click", () => fetchHistory());
  submitBtn.addEventListener("click", () => submitWeek());

  // 초기 상태 반영
  updateSubmitEnabled();
}
