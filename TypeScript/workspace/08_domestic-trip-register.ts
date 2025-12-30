// TypeScript/workspace/08_domestic-trip-register.ts
import { ModalUtil } from "./utils/ModalUtil";

type DomesticTripRegisterPayload = {
  trip_type: "domestic";
  req_name: string;
  depart_place: string;      // 출발지
  destination: string;       // 출장지(고객사/지역)
  start_date: string;        // YYYY-MM-DD
  depart_time: string;       // HH:mm
  arrive_time: string;       // HH:mm
  purpose: string;
};

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`❌ element not found: #${id}`);
  return el as T;
}

export function initDomesticTripRegisterPanel(API_BASE: string) {
  const panel = document.getElementById("panel-국내출장-출장등록");
  if (!panel) return;

  const saveBtn = getEl<HTMLButtonElement>("reg_save");
  // 이미 바인딩 되었으면 재바인딩 방지
  if ((saveBtn as any)._bound) return;
  (saveBtn as any)._bound = true;

  const resetBtn = getEl<HTMLButtonElement>("reg_reset");
  const resultBox = getEl<HTMLDivElement>("reg_result");

  // 🔹 이어작성 버튼
  const continueBtn = document.getElementById("reg_continue") as HTMLButtonElement | null;
  // 🔹 같은 패널 안의 정산 작성 섹션 (숨겼다가 펼칠 영역)
  const settlementSection = document.getElementById("bt_settlement_section") as HTMLDivElement | null;

  const userNameEl = document.getElementById("userName");
  const reqNameInput = getEl<HTMLInputElement>("bt_req_name");
  const departPlaceInput = getEl<HTMLInputElement>("bt_place");
  const destinationInput = getEl<HTMLInputElement>("bt_destination");
  const startInput = getEl<HTMLInputElement>("bt_start");
  const departTimeInput = getEl<HTMLInputElement>("bt_depart_time");
  const arriveTimeInput = getEl<HTMLInputElement>("bt_arrive_time");
  const purposeInput = getEl<HTMLTextAreaElement>("bt_purpose");

  // 요청자 자동 채우기
  reqNameInput.value = (userNameEl?.textContent ?? "").trim() || "사용자";

  // 초기: 이어작성 버튼/정산섹션 숨김
  if (continueBtn) continueBtn.classList.add("hidden");
  if (settlementSection) settlementSection.classList.add("hidden");

  // 🔹 폼 리셋
  resetBtn.addEventListener("click", () => {
    departPlaceInput.value = "";
    destinationInput.value = "";
    startInput.value = "";
    departTimeInput.value = "";
    arriveTimeInput.value = "";
    purposeInput.value = "";
    resultBox.textContent = "";

    // 리셋 시 이어작성 버튼/정산영역 숨기기
    if (continueBtn) continueBtn.classList.add("hidden");
    if (settlementSection) settlementSection.classList.add("hidden");
  });

  // 🔹 출장 등록
  saveBtn.addEventListener("click", async () => {
    const payload: DomesticTripRegisterPayload = {
      trip_type: "domestic",
      req_name: reqNameInput.value.trim(),
      depart_place: departPlaceInput.value.trim(),
      destination: destinationInput.value.trim(),
      start_date: startInput.value,
      depart_time: departTimeInput.value,
      arrive_time: arriveTimeInput.value,
      purpose: purposeInput.value.trim(),
    };

    console.log("[REGISTER] payload =", payload);

    // 필수값 체크 (이제 work_start_time 없음)
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

    try {
      saveBtn.disabled = true;
      resultBox.textContent = "서버에 저장 중...";

      const res = await fetch(`${API_BASE}/api/business-trip/domestic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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



      // 정산 화면에서 참고할 초안 저장
      localStorage.setItem("domesticTripDraft", JSON.stringify(payload));

      resultBox.textContent = "✅ 출장 등록 완료 (서버 저장 완료)";

      await ModalUtil.show({
        type: "alert",
        title: "저장 완료",
        message:
          "출장 등록 내용이 서버에 저장되었습니다.\n[이어 정산 작성] 버튼을 눌러 정산을 작성하세요.",
        showOk: true,
        showCancel: false,
      });

      if (continueBtn) continueBtn.classList.remove("hidden");
      if (settlementSection) {
        settlementSection.classList.add("hidden");
      }

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

  // 🔹 이어작성 버튼 클릭 → 정산 섹션 펼치기
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
