// TypeScript/workspace/08_domestic-trip-register.ts
import { ModalUtil } from "./utils/ModalUtil";

type DomesticTripRegisterPayload = {
  trip_type: "domestic";
  req_name: string;
  depart_place: string;      // 출발지
  destination: string;       // 출장지
  start_date: string;        // YYYY-MM-DD
  work_start_time: string;   // HH:mm
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
  if ((saveBtn as any)._bound) return;
  (saveBtn as any)._bound = true;

  const resetBtn = getEl<HTMLButtonElement>("reg_reset");
  const resultBox = getEl<HTMLDivElement>("reg_result");

  const userNameEl = document.getElementById("userName");
  const reqNameInput = getEl<HTMLInputElement>("bt_req_name");
  const departPlaceInput = getEl<HTMLInputElement>("bt_place");
  const destinationInput = getEl<HTMLInputElement>("bt_destination");
  const startInput = getEl<HTMLInputElement>("bt_start");
  const workStartTimeInput = getEl<HTMLInputElement>("bt_work_start_time");
  const departTimeInput = getEl<HTMLInputElement>("bt_depart_time");
  const arriveTimeInput = getEl<HTMLInputElement>("bt_arrive_time");
  const purposeInput = getEl<HTMLTextAreaElement>("bt_purpose");

  // 요청자 자동 채우기
  reqNameInput.value = (userNameEl?.textContent ?? "").trim() || "사용자";

  resetBtn.addEventListener("click", () => {
    departPlaceInput.value = "";
    destinationInput.value = "";
    startInput.value = "";
    workStartTimeInput.value = "";
    departTimeInput.value = "";
    arriveTimeInput.value = "";
    purposeInput.value = "";
    resultBox.textContent = "";
  });

  saveBtn.addEventListener("click", async () => {
    const payload: DomesticTripRegisterPayload = {
      trip_type: "domestic",
      req_name: reqNameInput.value.trim(),
      depart_place: departPlaceInput.value.trim(),
      destination: destinationInput.value.trim(),
      start_date: startInput.value,
      work_start_time: workStartTimeInput.value,
      depart_time: departTimeInput.value,
      arrive_time: arriveTimeInput.value,
      purpose: purposeInput.value.trim(),
    };

    // 필수값 체크
    if (
      !payload.req_name ||
      !payload.depart_place ||
      !payload.destination ||
      !payload.start_date ||
      !payload.work_start_time ||
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
      resultBox.textContent = "저장 중...";

      const res = await fetch(`${API_BASE}/api/business-trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      // ✅ 서버에서 id를 돌려준다고 가정 (data.id)
      const json = await res.json();
      const newId = json?.data?.id;

      // ✅ 정산할 때 쓰려고 저장해둠
      if (newId) {
        localStorage.setItem("lastTripId", String(newId));
      }

      resultBox.textContent = "✅ 출장 등록 완료";
      await ModalUtil.show({
        type: "alert",
        title: "저장 완료",
        message: newId
          ? `출장 등록 완료! (trip_id=${newId})\n정산등록에서 이 출장건을 업데이트합니다.`
          : "출장 등록이 완료되었습니다.",
        showOk: true,
        showCancel: false,
      });
    } catch (err: any) {
      resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;
      await ModalUtil.show({
        type: "alert",
        title: "저장 실패",
        message: resultBox.textContent,
        showOk: true,
        showCancel: false,
      });
    } finally {
      saveBtn.disabled = false;
    }
  });
}
