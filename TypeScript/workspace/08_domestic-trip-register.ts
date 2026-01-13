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
 * - localStorage 완전 제거: 탭 유지 중에만 값 유지됨
 */
type DomesticTripActive = {
  savedAt: number;
  trip_id?: string;
  payload: DomesticTripRegisterPayload;
};

// ✅ 모듈(탭) 메모리 유지용: 새로고침/로그아웃/브라우저 종료 시 자동 초기화
let ACTIVE: DomesticTripActive | null = null;

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
 * - 일반 URL:   /workspace?req_name=...&trip_date=...
 * - 해시 라우팅: /workspace#something?req_name=...&trip_date=...
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

/** ✅ URL 파라미터 세팅/삭제 (현재 라우팅 방식과 무관하게 최대한 안전하게 처리) */
function setQueryParams(params: Record<string, string>) {
  try {
    const url = new URL(window.location.href);

    // 기본: search에 넣기
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    // hash 라우팅이면 hash의 query도 맞춰주기(있을 때만)
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

  // ✅ 출발지 select (value: company/home/other)
  const departPlaceSelect = getEl<HTMLSelectElement>("bt_place");
  const departPlaceOther = document.getElementById("bt_place_other") as HTMLInputElement | null;

  // ✅ 출장지 select (clients API)
  const destinationSelect = getEl<HTMLSelectElement>("bt_destination");

  const startInput = getEl<HTMLInputElement>("bt_start");
  const departTimeInput = getEl<HTMLInputElement>("bt_depart_time");
  const arriveTimeInput = getEl<HTMLInputElement>("bt_arrive_time");
  const purposeInput = getEl<HTMLTextAreaElement>("bt_purpose");

  function currentUserName(): string {
    return (userNameEl?.textContent ?? "").trim();
  }

  /** ✅ 입력값 싹 비우기 */
  function clearFormUI() {
    // 요청자
    reqNameInput.value = currentUserName() || "사용자";

    // 출발지
    departPlaceSelect.value = "";
    if (departPlaceOther) {
      departPlaceOther.value = "";
      departPlaceOther.classList.add("hidden");
    }

    // 나머지
    destinationSelect.value = "";
    startInput.value = "";
    departTimeInput.value = "";
    arriveTimeInput.value = "";
    purposeInput.value = "";

    resultBox.textContent = "";

    if (continueBtn) continueBtn.classList.add("hidden");
    if (settlementSection) settlementSection.classList.add("hidden");
  }

  /** ✅ 메모리 ACTIVE로 UI 복원 */
  function restoreFromActive(active: DomesticTripActive) {
    const p = active.payload;

    reqNameInput.value = p.req_name || (currentUserName() || "사용자");

    // depart_place: company/home/기타텍스트
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

  /** ✅ 패널 열릴 때 규칙: ACTIVE 있으면 복원 / 없으면 리셋 */
  function applyOpenRule() {
    if (ACTIVE) restoreFromActive(ACTIVE);
    else clearFormUI();

    // ✅ URL 파라미터로 넘어온 정산 타겟이 있으면(그리고 현재 유저와 같으면) 최소한 날짜/이름은 채워줌
    const qpName = getQueryParam("req_name");
    const qpDate = getQueryParam("trip_date");
    const me = currentUserName();

    if (qpName && qpDate && me && qpName === me) {
      reqNameInput.value = qpName;
      startInput.value = qpDate;
      // 여기서는 자동으로 정산 섹션을 열지 않음(사용자가 버튼으로 열도록)
      // 원하면 아래 2줄을 주석 해제하면 "바로 정산"처럼 동작 가능
      // settlementSection?.classList.remove("hidden");
      // settlementSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (qpName || qpDate) {
      // 다른 계정/잘못된 파라미터면 즉시 제거(정보 잔존/오동작 방지)
      clearQueryParams(["req_name", "trip_date"]);
    }
  }

  // ✅ 최초 1회 적용
  applyOpenRule();

  // 초기 숨김(복원 로직에서 필요하면 풀림)
  if (continueBtn) continueBtn.classList.add("hidden");
  if (settlementSection) settlementSection.classList.add("hidden");

  // ✅ 출발지 기타 토글
  departPlaceSelect.addEventListener("change", () => {
    if (!departPlaceOther) return;
    const isOther = departPlaceSelect.value === "other";
    departPlaceOther.classList.toggle("hidden", !isOther);
    if (!isOther) departPlaceOther.value = "";
  });

  // ✅ 거래처 목록 로딩
  async function loadClients() {
    try {
      destinationSelect.innerHTML = `<option value="">거래처(출장지) 선택</option>`;

      const res = await fetch(`${API_BASE}/api/business-trip/clients`);
      if (!res.ok) {
        console.error("[REGISTER] clients API HTTP error:", res.status);
        return;
      }

      const json = await res.json().catch(() => null);
      console.log("[REGISTER] clients API response =", json);

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

      if (destinationSelect.options.length <= 1) {
        console.warn("[REGISTER] 거래처 목록이 비었습니다. 서버 응답 구조 확인 필요:", json);
      }

      // ✅ 목록 로드 후: ACTIVE가 있으면 destination 값 재적용(옵션이 늦게 붙었을 수 있음)
      if (ACTIVE?.payload?.destination) {
        destinationSelect.value = ACTIVE.payload.destination;
      }
    } catch (err) {
      console.warn("[REGISTER] 거래처 목록 로딩 실패:", err);
    }
  }

  loadClients();

  // ✅ 패널 이동 감지(hidden 토글)
  // - 패널을 떠나는 순간: 등록 전/후와 무관하게 "입력 중 캐시"는 남기지 않음
  const mo = new MutationObserver(() => {
    const isHidden = panel.classList.contains("hidden");
    if (isHidden) {
      // ✅ 화면 떠나면: ACTIVE는 메모리로만 유지(원하면 여기서 ACTIVE도 null로 만들어도 됨)
      // 입력중 값은 남기지 않기 위해 UI는 정리
      if (!ACTIVE) clearFormUI();
    } else {
      applyOpenRule();
      loadClients();
    }
  });
  mo.observe(panel, { attributes: true, attributeFilter: ["class"] });

  // 🔹 리셋 버튼: UI 초기화 + ACTIVE 제거 + URL 파라미터 제거
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
    clearQueryParams(["req_name", "trip_date"]);
    clearFormUI();
    loadClients();
  });

  // 🔹 저장(출장등록)
  saveBtn.addEventListener("click", async () => {
    const depart_place =
      departPlaceSelect.value === "other"
        ? textOrEmpty(departPlaceOther?.value)
        : textOrEmpty(departPlaceSelect.value); // company | home

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

    console.log("[REGISTER] payload =", payload);

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
      console.log("출장등록 성공 응답:", data);

      // ✅✅✅ 핵심: localStorage 저장 없음. 탭 메모리(ACTIVE)만 세팅
      const trip_id = pickTripIdFromResponse(data);
      ACTIVE = { savedAt: Date.now(), trip_id, payload };

      // ✅ URL 파라미터도 세팅(이어서 정산 타겟 전달용)
      // - 다른 계정 로그인 시 자동 제거하도록 applyOpenRule에서 검사함
      setQueryParams({
        req_name: payload.req_name,
        trip_date: payload.start_date,
      });

      resultBox.textContent = "✅ 출장 등록 완료 (정산 전까지 탭에서만 유지됩니다.)";

      await ModalUtil.show({
        type: "alert",
        title: "저장 완료",
        message:
          "출장 등록 내용이 서버에 저장되었습니다.\n[이어서 정산] 버튼을 눌러 정산을 작성하세요.",
        showOk: true,
        showCancel: false,
      });

      if (continueBtn) continueBtn.classList.remove("hidden");
      if (settlementSection) settlementSection.classList.add("hidden");

      // 대시보드 갱신
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

      // 실패했으면 ACTIVE 유지 금지
      ACTIVE = null;
      clearQueryParams(["req_name", "trip_date"]);

      window.dispatchEvent(new Event("trip-status-refresh"));

      if (continueBtn) continueBtn.classList.add("hidden");
      if (settlementSection) settlementSection.classList.add("hidden");
    } finally {
      saveBtn.disabled = false;
    }
  });

  // 🔹 이어서 정산 (URL 파라미터 방식)
  continueBtn?.addEventListener("click", () => {
    const me = currentUserName();
    const date = startInput.value;
    const name = reqNameInput.value.trim();

    if (!date || !name) {
      resultBox.textContent = "❌ 정산 대상(요청자/날짜)이 없습니다.";
      return;
    }

    // ✅ 현재 로그인 유저와 다르면 막기(다른 계정 잔존 문제 방지)
    if (me && name !== me) {
      ModalUtil.show({
        type: "alert",
        title: "정산 대상 불일치",
        message: "현재 로그인 사용자와 정산 대상 요청자명이 다릅니다.\n다시 확인해주세요.",
        showOk: true,
        showCancel: false,
      });
      clearQueryParams(["req_name", "trip_date"]);
      return;
    }

    setQueryParams({ req_name: name, trip_date: date });

    if (settlementSection) {
      settlementSection.classList.remove("hidden");
      settlementSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    resultBox.textContent = "✏️ 이 출장건에 대한 정산 정보를 아래에서 이어서 작성하세요.";
  });

  // ✅✅✅ 정산 완료 시: 정산 화면에서 이벤트를 쏴주면(아래 09에서 쏨)
  window.addEventListener("domestic-trip-settled", () => {
    ACTIVE = null;
    clearQueryParams(["req_name", "trip_date"]);
    clearFormUI();
  });

  // (옵션) 혹시 다른 곳에서 이름 다르게 보내면 같이 받기
  window.addEventListener("trip-settled", () => {
    ACTIVE = null;
    clearQueryParams(["req_name", "trip_date"]);
    clearFormUI();
  });
}