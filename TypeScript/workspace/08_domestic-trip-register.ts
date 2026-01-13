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
 * ✅ "등록 성공 후(정산 전까지 유지)" 저장 타입
 * - 서버가 준 trip_id가 있으면 반드시 넣어둠(정산/복원에 도움)
 */
type DomesticTripActive = {
  savedAt: number;
  trip_id?: string;
  payload: DomesticTripRegisterPayload;
};

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`❌ element not found: #${id}`);
  return el as T;
}

function textOrEmpty(v: any) {
  return String(v ?? "").trim();
}

// ✅ 로컬스토리지 키
const LS_ACTIVE = "domesticTripActive"; // 등록 성공 후 유지용(정산 전까지)
const LS_SETTLE_DATE = "settleTargetDate";
const LS_SETTLE_NAME = "settleTargetReqName";

/** ✅ 등록 성공(진행중) 데이터 읽기 */
function readActive(): DomesticTripActive | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVE);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.payload) return null;
    return obj as DomesticTripActive;
  } catch {
    return null;
  }
}

/** ✅ 등록 성공(진행중) 데이터 저장 */
function writeActive(active: DomesticTripActive) {
  localStorage.setItem(LS_ACTIVE, JSON.stringify(active));
}

/** ✅ 등록 성공(진행중) 데이터 삭제 = 이제 유지 안 함(정산완료/취소 등) */
function clearActive() {
  localStorage.removeItem(LS_ACTIVE);
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

  /** ✅ 입력값 싹 비우기(등록 안 한 상태면 화면 이동 시 이걸 실행) */
  function clearFormUI() {
    // 요청자
    reqNameInput.value = (userNameEl?.textContent ?? "").trim() || "사용자";

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

  /** ✅ 등록 성공 데이터로 UI 복원(정산 전이면 값 유지) */
  function restoreFromActive(active: DomesticTripActive) {
    const p = active.payload;

    reqNameInput.value = p.req_name || ((userNameEl?.textContent ?? "").trim() || "사용자");

    // depart_place: company/home/기타텍스트
    // select가 company/home/other라면:
    if (p.depart_place === "company" || p.depart_place === "home") {
      departPlaceSelect.value = p.depart_place;
      if (departPlaceOther) {
        departPlaceOther.value = "";
        departPlaceOther.classList.add("hidden");
      }
    } else {
      // 기타
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

    // UI 상태
    resultBox.textContent = "✅ 등록된 출장건(정산 전)입니다. 계속 정산을 진행할 수 있습니다.";
    if (continueBtn) continueBtn.classList.remove("hidden");
    if (settlementSection) settlementSection.classList.add("hidden");

    // 정산 타겟(정산 화면에서 이어서 쓰는 용)
    if (p.start_date) localStorage.setItem(LS_SETTLE_DATE, p.start_date);
    if (p.req_name) localStorage.setItem(LS_SETTLE_NAME, p.req_name);
  }

  /** ✅ 패널이 열릴 때: active 있으면 복원, 없으면 리셋(등록 전 값은 남기지 않음) */
  function applyOpenRule() {
    const active = readActive();
    if (active) restoreFromActive(active);
    else clearFormUI();
  }

  // ✅ 최초 1회: 열릴 때 규칙 적용
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

  // ✅ 거래처 목록 로딩 (강력 방어 + 디버그 로그 포함)
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

      // ✅ 거래처 목록 로드 후: active가 있으면 destination value가 적용되도록 재복원(옵션이 아직 없었을 수 있음)
      const active = readActive();
      if (active?.payload?.destination) {
        destinationSelect.value = active.payload.destination;
      }
    } catch (err) {
      console.warn("[REGISTER] 거래처 목록 로딩 실패:", err);
    }
  }

  // ✅ (중요) 여기서 실제로 실행해야 목록이 뜸!!
  loadClients();

  // ✅ "패널 이동" 감지: hidden 토글을 감시해서
  // - 패널이 닫힐 때(active 없으면) 입력값 즉시 리셋
  // - 패널이 다시 열릴 때 active 있으면 복원 / 없으면 리셋
  const mo = new MutationObserver(() => {
    const isHidden = panel.classList.contains("hidden");
    if (isHidden) {
      // ✅ 화면을 떠나는 순간: 등록 성공(active) 없으면 다 날려야 함
      if (!readActive()) clearFormUI();
    } else {
      // ✅ 다시 돌아오는 순간: active 있으면 복원, 없으면 리셋
      applyOpenRule();
      // 거래처 목록이 늦게 올 수도 있으니 다시 로드(원하면 제거 가능)
      loadClients();
    }
  });
  mo.observe(panel, { attributes: true, attributeFilter: ["class"] });

  // 🔹 리셋 버튼: (등록 전/후) 사용자가 직접 초기화하면
  // - 화면값 초기화 + active도 삭제(=이제 유지하지 않음)
  resetBtn.addEventListener("click", async () => {
    const active = readActive();
    if (active) {
      await ModalUtil.show({
        type: "alert", // ✅ confirm → alert
        title: "초기화",
        message:
          "등록된 출장건(정산 전)이 남아있습니다.\n" +
          "초기화하면 해당 내용은 더 이상 유지되지 않습니다.",
        showOk: true,
        showCancel: false,
      });
    }

    // ✅ 무조건 초기화 진행
    clearActive();
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

      // ✅✅✅ 핵심: "등록 성공"시에만 localStorage에 저장(정산 전까지 유지)
      const trip_id = pickTripIdFromResponse(data);
      writeActive({
        savedAt: Date.now(),
        trip_id,
        payload,
      });

      resultBox.textContent = "✅ 출장 등록 완료 (정산 전까지 유지됩니다.)";

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

      localStorage.setItem(LS_SETTLE_DATE, payload.start_date);
      localStorage.setItem(LS_SETTLE_NAME, payload.req_name);

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

      // 실패했으면 active 저장하면 안 됨(유지 금지)
      clearActive();

      window.dispatchEvent(new Event("trip-status-refresh"));

      if (continueBtn) continueBtn.classList.add("hidden");
      if (settlementSection) settlementSection.classList.add("hidden");
    } finally {
      saveBtn.disabled = false;
    }
  });

  // 🔹 이어서 정산
  continueBtn?.addEventListener("click", () => {
    const date = startInput.value;
    const name = reqNameInput.value.trim();

    if (date) localStorage.setItem(LS_SETTLE_DATE, date);
    if (name) localStorage.setItem(LS_SETTLE_NAME, name);

    if (settlementSection) {
      settlementSection.classList.remove("hidden");
      settlementSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    resultBox.textContent = "✏️ 이 출장건에 대한 정산 정보를 아래에서 이어서 작성하세요.";
  });

  // ✅✅✅ 정산 완료 시: 정산 화면에서 아래 이벤트를 쏴주면
  // window.dispatchEvent(new Event("domestic-trip-settled"));
  window.addEventListener("domestic-trip-settled", () => {
    clearActive();
    clearFormUI();
  });

  // (옵션) 혹시 다른 곳에서 이름 다르게 보내면 같이 받기
  window.addEventListener("trip-settled", () => {
    clearActive();
    clearFormUI();
  });
}