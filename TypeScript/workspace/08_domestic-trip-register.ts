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

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`❌ element not found: #${id}`);
  return el as T;
}

function textOrEmpty(v: any) {
  return String(v ?? "").trim();
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

  // 요청자 자동
  reqNameInput.value = (userNameEl?.textContent ?? "").trim() || "사용자";

  // 초기 숨김
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

      // ✅ 서버가 어떤 키로 주든 최대한 대응
      const raw =
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json?.rows) ? json.rows :
        Array.isArray(json?.clients) ? json.clients :
        Array.isArray(json) ? json :
        [];

      for (const item of raw) {
        // ✅ 문자열/객체 둘 다 대응
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

      // ✅ 그래도 1개(기본옵션)만 있으면 뭔가 비어온 것
      if (destinationSelect.options.length <= 1) {
        console.warn("[REGISTER] 거래처 목록이 비었습니다. 서버 응답 구조 확인 필요:", json);
      }
    } catch (err) {
      console.warn("[REGISTER] 거래처 목록 로딩 실패:", err);
    }
  }

  // ✅ (중요) 여기서 실제로 실행해야 목록이 뜸!!
  loadClients();

  // 🔹 리셋
  resetBtn.addEventListener("click", () => {
    departPlaceSelect.value = "";
    if (departPlaceOther) {
      departPlaceOther.value = "";
      departPlaceOther.classList.add("hidden");
    }

    destinationSelect.value = "";
    startInput.value = "";
    departTimeInput.value = "";
    arriveTimeInput.value = "";
    purposeInput.value = "";
    resultBox.textContent = "";

    if (continueBtn) continueBtn.classList.add("hidden");
    if (settlementSection) settlementSection.classList.add("hidden");

    // ✅ 리셋 시 거래처 목록도 다시 불러오고 싶으면 아래 줄 유지
    loadClients();
  });

  // 🔹 저장
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

      localStorage.setItem("domesticTripDraft", JSON.stringify(payload));
      resultBox.textContent = "✅ 출장 등록 완료 (서버 저장 완료)";

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

      localStorage.setItem("settleTargetDate", payload.start_date);
      localStorage.setItem("settleTargetReqName", payload.req_name);

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

    if (date) localStorage.setItem("settleTargetDate", date);
    if (name) localStorage.setItem("settleTargetReqName", name);

    if (settlementSection) {
      settlementSection.classList.remove("hidden");
      settlementSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    resultBox.textContent = "✏️ 이 출장건에 대한 정산 정보를 아래에서 이어서 작성하세요.";
  });
}
