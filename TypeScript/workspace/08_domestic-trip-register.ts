// TypeScript/workspace/08_domestic-trip-register.ts
import { ModalUtil } from "./utils/ModalUtil";

type DomesticTripRegisterPayload = {
  trip_type: "domestic";
  req_name: string;
  depart_place: string; // company/home/기타텍스트
  destination: string;  // client_name
  start_date: string;   // YYYY-MM-DD
  depart_time: string;  // HH:mm
  arrive_time: string;  // HH:mm
  purpose: string;
};

/**
 * ✅ "등록 성공 후(정산 전까지 유지)" 저장 타입 (메모리만)
 * - 탭 유지 중에만 값 유지됨
 */
type DomesticTripActive = {
  savedAt: number;
  trip_id?: string;
  payload: DomesticTripRegisterPayload;
};

// ✅ 모듈(탭) 메모리 유지용
let ACTIVE: DomesticTripActive | null = null;

// ✅ 시간 경고 임계값(분)
const WARN_LONG_TRAVEL_MINS = 18 * 60; // 18시간

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`❌ element not found: #${id}`);
  return el as T;
}

function textOrEmpty(v: any) {
  return String(v ?? "").trim();
}

/** ✅ 서버 응답에서 trip_id 최대한 찾아내기(서버 구조 달라도 대응) */
function pickTripIdFromResponse(data: any): string | undefined {
  const cand =
    data?.trip_id ??
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
 */
function getQueryParam(name: string): string {
  try {
    const url = new URL(window.location.href);

    const fromSearch = url.searchParams.get(name);
    if (fromSearch) return fromSearch;

    const hash = String(url.hash ?? "");
    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      const hashQuery = hash.slice(qIdx + 1);
      const sp = new URLSearchParams(hashQuery);
      return sp.get(name) ?? "";
    }
    return "";
  } catch {
    return "";
  }
}

/** ✅ URL 파라미터 세팅/삭제 */
function setQueryParams(params: Record<string, string>) {
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
  } catch {
    // ignore
  }
}

function clearQueryParams(keys: string[]) {
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
  } catch {
    // ignore
  }
}

// ===============================
// ✅ 출장 등록 안전수칙 모달 (필수 동의)
// - "오늘은 다시 보지 않기" 제거
// - ✅ [동의함] 체크 필수
// ===============================
async function showSafetyModalIfNeeded(): Promise<boolean> {
  const messageHtml = `
    <div class="text-left text-sm leading-relaxed space-y-3">
      <div class="font-bold text-rose-600 text-base">
        ⚠️ 출장 안전수칙 안내 (필수 확인/동의)
      </div>

      <div>
        <div class="font-semibold">1. 사내·현장 안전수칙</div>
        <ul class="list-disc pl-5 text-gray-700 space-y-1">
          <li>작업 중 보호장비 의무적 착용 및 설비 점검</li>
          <li>위험요소 사전 확인 필수</li>
          <li>사다리 작업 시 반드시 2인 1조 진행</li>
          <li>고소 작업 시 안전대(BANDO) 착용 필수</li>
        </ul>
      </div>

      <div>
        <div class="font-semibold">2. 고객사 현장 안전수칙</div>
        <ul class="list-disc pl-5 text-gray-700 space-y-1">
          <li>고객사 안전 규정 및 작업 지시 준수</li>
          <li>보호장비 착용 필수</li>
          <li>이상 징후 발견 시 즉시 작업 중단 및 보고</li>
        </ul>
      </div>

      <div>
        <div class="font-semibold">3. 운전 시 안전수칙</div>
        <ul class="list-disc pl-5 text-gray-700 space-y-1">
          <li>정해진 속도 및 교통법규 준수</li>
          <li>운전 중 휴대폰 사용 금지</li>
          <li>장거리 운행 시 충분한 휴식</li>
          <li>음주 또는 약물 복용 후 운전 금지</li>
        </ul>
      </div>

      <div class="text-rose-600 font-semibold text-sm">
        ※ 출장 댓글(목적/내용) 작성 시<br/>
        &nbsp;&nbsp;“안전수칙 준수하겠습니다” 문구를 반드시 기재 바랍니다.
      </div>

      <div class="text-xs text-gray-600">
        예) 자택 07:00 → 온세미 08:00 / 안전수칙 준수하겠습니다.
      </div>

      <label class="flex items-center gap-2 pt-3">
        <input id="safetyAgreeChk" type="checkbox" class="w-4 h-4" />
        <span class="text-sm font-semibold text-gray-800">
          안전수칙을 확인했으며 준수에 동의합니다. (필수)
        </span>
      </label>

      <div class="text-xs text-gray-500 pt-1">
        ※ 동의 후에만 출장 등록이 가능합니다.
      </div>
    </div>
  `;

  const ok = await ModalUtil.show({
    type: "warn",
    title: "출장 안전수칙 확인",
    messageHtml,
    showOk: true,
    showCancel: true,
    okText: "확인",
    cancelText: "취소",
    okClass: "bg-rose-600 hover:bg-rose-700",
    cancelClass: "border border-gray-300 text-gray-700 hover:bg-gray-50",
  });

  if (ok !== true) return false;

  const cb = document.getElementById("safetyAgreeChk") as HTMLInputElement | null;
  if (!cb?.checked) {
    await ModalUtil.show({
      type: "alert",
      title: "동의가 필요합니다",
      message: "출장 등록을 위해서는 안전수칙 동의가 필요합니다.\n체크 후 다시 시도해주세요.",
      showOk: true,
      showCancel: false,
    });
    return false;
  }

  return true;
}

// ===============================
// ✅ 시간 유틸 (자정 넘어감 허용)
// ===============================
function parseHHMMToMinutes(v: any): number | null {
  const s = String(v ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function calcDurationAllowNextDay(startHHMM: string, endHHMM: string): { mins: number; nextDay: boolean } | null {
  const s = parseHHMMToMinutes(startHHMM);
  const e = parseHHMMToMinutes(endHHMM);
  if (s == null || e == null) return null;

  let diff = e - s;
  let nextDay = false;
  if (diff < 0) {
    diff += 24 * 60;
    nextDay = true;
  }
  return { mins: diff, nextDay };
}

export function initDomesticTripRegisterPanel(API_BASE: string) {
  const panel = document.getElementById("panel-국내출장-출장등록");
  if (!panel) return;

  const saveBtn = getEl<HTMLButtonElement>("reg_save");
  if ((saveBtn as any)._bound) return;
  (saveBtn as any)._bound = true;

  const resetBtn = getEl<HTMLButtonElement>("reg_reset");
  const resultBox = getEl<HTMLDivElement>("reg_result");

  const continueBtn = document.getElementById("reg_continue") as HTMLButtonElement | null;
  const settlementSection = document.getElementById("bt_settlement_section") as HTMLDivElement | null;

  const userNameEl = document.getElementById("userName");
  const reqNameInput = getEl<HTMLInputElement>("bt_req_name");

  const departPlaceSelect = getEl<HTMLSelectElement>("bt_place");
  const departPlaceOther = document.getElementById("bt_place_other") as HTMLInputElement | null;

  const destinationSelect = getEl<HTMLSelectElement>("bt_destination");

  const startInput = getEl<HTMLInputElement>("bt_start");
  const departTimeInput = getEl<HTMLInputElement>("bt_depart_time");
  const arriveTimeInput = getEl<HTMLInputElement>("bt_arrive_time");
  const purposeInput = getEl<HTMLTextAreaElement>("bt_purpose");

  function currentUserName(): string {
    return (userNameEl?.textContent ?? "").trim();
  }

  /** ✅ 입력값 싹 비우기 (등록 화면은 항상 빈 폼) */
  function clearFormUI() {
    reqNameInput.value = currentUserName() || "사용자";

    departPlaceSelect.value = "";
    if (departPlaceOther) {
      departPlaceOther.value = "";
      departPlaceOther.classList.add("hidden");
    }

    destinationSelect.value = "";
    startInput.value = ""; // (원하면 오늘 날짜로 넣어줄 수도 있음)
    departTimeInput.value = "";
    arriveTimeInput.value = "";
    purposeInput.value = "";

    resultBox.textContent = "";

    if (continueBtn) continueBtn.classList.add("hidden");
    if (settlementSection) settlementSection.classList.add("hidden");
  }

  /** ✅ ACTIVE 복원(같은 탭에서만 유지) */
  function restoreFromActive(active: DomesticTripActive) {
    const p = active.payload;

    reqNameInput.value = p.req_name || (currentUserName() || "사용자");

    if (p.depart_place === "company" || p.depart_place === "home") {
      departPlaceSelect.value = p.depart_place;
      if (departPlaceOther) {
        departPlaceOther.value = "";
        departPlaceOther.classList.add("hidden");
      }
    } else {
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
    if (continueBtn) continueBtn.classList.remove("hidden");
    if (settlementSection) settlementSection.classList.add("hidden");
  }

  /** ✅ 거래처 목록 로딩 */
  async function loadClients() {
    try {
      destinationSelect.innerHTML = `<option value="">거래처(출장지) 선택</option>`;

      const res = await fetch(`${API_BASE}/api/business-trip/clients`);
      if (!res.ok) return;

      const json = await res.json().catch(() => null);

      const raw =
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json?.rows) ? json.rows :
        Array.isArray(json?.clients) ? json.clients :
        Array.isArray(json) ? json :
        [];

      for (const item of raw) {
        const name =
          typeof item === "string"
            ? item
            : (item?.client_name ?? item?.name ?? item?.destination);

        const clean = textOrEmpty(name);
        if (!clean) continue;

        const opt = document.createElement("option");
        opt.value = clean;
        opt.textContent = clean;
        destinationSelect.appendChild(opt);
      }

      if (ACTIVE?.payload?.destination) {
        destinationSelect.value = ACTIVE.payload.destination;
      }
    } catch {
      // ignore
    }
  }

  /** ✅ 패널 열릴 때: ACTIVE 있으면 복원 / 없으면 빈 폼 */
  async function applyOpenRule() {
    if (ACTIVE) restoreFromActive(ACTIVE);
    else clearFormUI();

    await loadClients();

    // 등록 화면은 URL 파라미터로 폼 덮어쓰기 금지 (정산용)
    const qpName = getQueryParam("req_name");
    const qpDate = getQueryParam("trip_date");
    const me = currentUserName();
    if (qpName || qpDate) {
      if (!me || qpName !== me) clearQueryParams(["req_name", "trip_date", "trip_id"]);
    }
  }

  applyOpenRule();

  if (continueBtn) continueBtn.classList.add("hidden");
  if (settlementSection) settlementSection.classList.add("hidden");

  // ✅ 출발지 기타 토글
  departPlaceSelect.addEventListener("change", () => {
    if (!departPlaceOther) return;
    const isOther = departPlaceSelect.value === "other";
    departPlaceOther.classList.toggle("hidden", !isOther);
    if (!isOther) departPlaceOther.value = "";
  });

  // ✅ 입력 중 “익일 도착” 안내문
  function showNextDayHint_Register() {
    const info = calcDurationAllowNextDay(departTimeInput.value, arriveTimeInput.value);
    if (!info) return;

    const { mins, nextDay } = info;
    if (!nextDay) return;

    const h = Math.floor(mins / 60);
    const m = mins % 60;

    resultBox.textContent =
      `ℹ️ 도착시간이 출발시간보다 빠릅니다 → 익일 도착(자정 넘어감)으로 처리됩니다. ` +
      `(이동 ${h}시간${m ? " " + m + "분" : ""})`;
  }
  departTimeInput.addEventListener("input", showNextDayHint_Register);
  arriveTimeInput.addEventListener("input", showNextDayHint_Register);
  departTimeInput.addEventListener("change", showNextDayHint_Register);
  arriveTimeInput.addEventListener("change", showNextDayHint_Register);

  // ✅ 패널 이동 감지(hidden 토글)
  const mo = new MutationObserver(() => {
    const isHidden = panel.classList.contains("hidden");
    if (isHidden) {
      if (!ACTIVE) clearFormUI();
    } else {
      applyOpenRule();
    }
  });
  mo.observe(panel, { attributes: true, attributeFilter: ["class"] });

  // 🔹 리셋 버튼
  resetBtn.addEventListener("click", async () => {
    if (ACTIVE) {
      await ModalUtil.show({
        type: "alert",
        title: "초기화",
        message:
          "등록된 출장건(정산 전)이 남아있습니다.\n" +
          "초기화하면 해당 내용은 더 이상 유지되지 않습니다.",
        showOk: true,
        showCancel: false,
      });
    }

    ACTIVE = null;
    clearQueryParams(["req_name", "trip_date", "trip_id"]);
    clearFormUI();
    loadClients();
  });

  // 🔹 저장(출장등록)
  saveBtn.addEventListener("click", async () => {
    // ✅ 안전수칙 동의(필수)
    const safetyOk = await showSafetyModalIfNeeded();
    if (!safetyOk) return;

    const depart_place =
      departPlaceSelect.value === "other"
        ? textOrEmpty(departPlaceOther?.value)
        : textOrEmpty(departPlaceSelect.value);

    const payload: DomesticTripRegisterPayload = {
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
    if (
      !payload.req_name ||
      !payload.depart_place ||
      !payload.destination ||
      !payload.start_date ||
      !payload.depart_time ||
      !payload.arrive_time ||
      !payload.purpose
    ) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "모든 항목은 필수입니다.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    if (departPlaceSelect.value === "other" && !payload.depart_place) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "기타 출발지를 입력해주세요.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    // ✅ 자정 넘어감/과도 이동시간 경고 (저장 시점 모달)
    {
      const info = calcDurationAllowNextDay(payload.depart_time, payload.arrive_time);
      if (info) {
        const { mins, nextDay } = info;
        const h = Math.floor(mins / 60);
        const m = mins % 60;

        if (nextDay) {
          const ok = await ModalUtil.show({
            type: "warn",
            title: "시간 확인",
            messageHtml:
              `도착시간이 출발시간보다 빠릅니다.<br/>` +
              `→ <b>익일 도착(자정 넘어감)</b>으로 처리됩니다.<br/>` +
              `<div class="mt-2 text-sm text-gray-600">예상 이동시간: ${h}시간${m ? ` ${m}분` : ""}</div>` +
              `<div class="mt-2 text-sm text-gray-600">이 입력이 맞으면 <b>계속</b>을 누르세요.</div>`,
            showOk: true,
            showCancel: true,
            okText: "계속",
            cancelText: "수정",
            okClass: "bg-indigo-600 hover:bg-indigo-700",
            cancelClass: "border border-gray-300 text-gray-700 hover:bg-gray-50",
          });
          if (ok !== true) return;
        }

        if (mins >= WARN_LONG_TRAVEL_MINS) {
          const ok2 = await ModalUtil.show({
            type: "warn",
            title: "이동시간이 너무 깁니다",
            messageHtml:
              `입력된 이동시간이 <b>${h}시간${m ? ` ${m}분` : ""}</b> 입니다.<br/>` +
              `시간 입력 실수(오전/오후, 0 하나 빠짐)일 수 있어요.<br/>` +
              `<div class="mt-2 text-sm text-gray-600">그래도 맞으면 계속 진행하세요.</div>`,
            showOk: true,
            showCancel: true,
            okText: "그래도 등록",
            cancelText: "수정",
            okClass: "bg-rose-600 hover:bg-rose-700",
            cancelClass: "border border-gray-300 text-gray-700 hover:bg-gray-50",
          });
          if (ok2 !== true) return;
        }
      }
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

        await ModalUtil.show({
          type: "alert",
          title: "저장 실패",
          message: `서버 저장에 실패했습니다.\n(HTTP ${res.status})`,
          showOk: true,
          showCancel: false,
        });

        if (continueBtn) continueBtn.classList.add("hidden");
        if (settlementSection) settlementSection.classList.add("hidden");
        return;
      }

      const data = await res.json().catch(() => null);

      const trip_id = pickTripIdFromResponse(data);
      ACTIVE = { savedAt: Date.now(), trip_id, payload };

      // ✅ 정산 패널이 쓰는 URL 파라미터 세팅 (req_name/trip_date/trip_id)
      const params: Record<string, string> = {
        req_name: payload.req_name,
        trip_date: payload.start_date,
      };
      if (trip_id) params.trip_id = trip_id;

      setQueryParams(params);

      resultBox.textContent = "✅ 출장 등록 완료 (정산 전까지 탭에서만 유지됩니다.)";

      await ModalUtil.show({
        type: "alert",
        title: "저장 완료",
        message: "출장 등록 내용이 서버에 저장되었습니다.\n[이어서 정산] 버튼을 눌러 정산을 작성하세요.",
        showOk: true,
        showCancel: false,
      });

      if (continueBtn) continueBtn.classList.remove("hidden");
      if (settlementSection) settlementSection.classList.add("hidden");

      window.dispatchEvent(new Event("trip-status-refresh"));
    } catch (err: any) {
      console.error("출장등록 중 오류:", err);
      resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;

      await ModalUtil.show({
        type: "alert",
        title: "저장 실패",
        message: resultBox.textContent,
        showOk: true,
        showCancel: false,
      });

      ACTIVE = null;
      clearQueryParams(["req_name", "trip_date", "trip_id"]);
      window.dispatchEvent(new Event("trip-status-refresh"));

      if (continueBtn) continueBtn.classList.add("hidden");
      if (settlementSection) settlementSection.classList.add("hidden");
    } finally {
      saveBtn.disabled = false;
    }
  });

  /**
   * 🔹 이어서 정산
   */
  continueBtn?.addEventListener("click", async () => {
    try {
      const me = currentUserName();
      const date = startInput.value;
      const name = reqNameInput.value.trim();

      // ✅ 정산폼 강제 초기화 이벤트(09에서 듣고 clearForm)
      window.dispatchEvent(new Event("settlement:force-clear"));

      if (!date || !name) {
        resultBox.textContent = "❌ 정산 대상(요청자/날짜)이 없습니다.";
        return;
      }

      if (me && name !== me) {
        await ModalUtil.show({
          type: "alert",
          title: "정산 대상 불일치",
          message: "현재 로그인 사용자와 정산 대상 요청자명이 다릅니다.\n다시 확인해주세요.",
          showOk: true,
          showCancel: false,
        });
        clearQueryParams(["req_name", "trip_date", "trip_id"]);
        return;
      }

      const params: Record<string, string> = { req_name: name, trip_date: date };
      if (ACTIVE?.trip_id) params.trip_id = ACTIVE.trip_id;

      setQueryParams(params);

      if (settlementSection) {
        settlementSection.classList.remove("hidden");
        settlementSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      resultBox.textContent = "✏️ 이 출장건에 대한 정산 정보를 아래에서 이어서 작성하세요.";
    } catch (err: any) {
      console.error("continue settlement error:", err);
      await ModalUtil.show({
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
    clearQueryParams(["req_name", "trip_date", "trip_id"]);
    clearFormUI();
  });

  window.addEventListener("trip-settled", () => {
    ACTIVE = null;
    clearQueryParams(["req_name", "trip_date", "trip_id"]);
    clearFormUI();
  });
}
