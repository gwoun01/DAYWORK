// TypeScript/workspace/09_domestic-trip-settlement.ts
import { ModalUtil } from "./utils/ModalUtil";

type SettlementFormPayload = {
  work_end_time: string;
  return_time: string;
  return_place: string; // ✅ company/home/기타텍스트
  vehicle: string;      // corporate/personal/other_personal/public
  meals: {
    breakfast: { checked: boolean; owner: string };
    lunch: { checked: boolean; owner: string };
    dinner: { checked: boolean; owner: string };
  };
};

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`❌ element not found: #${id}`);
  return el as T;
}

function getCheckedRadioValue(name: string): string {
  const checked = document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return checked?.value ?? "";
}

export function initDomesticTripSettlementPanel(API_BASE: string) {
  console.log("[정산] initDomesticTripSettlementPanel 호출");

  const section = document.getElementById("bt_settlement_section");
  if (!section) {
    console.warn("[정산] #bt_settlement_section 요소를 찾을 수 없습니다. HTML 구조를 확인하세요.");
    return;
  }

  const saveBtn = getEl<HTMLButtonElement>("bt_save");
  if ((saveBtn as any)._bound) return;
  (saveBtn as any)._bound = true;

  const resetBtn = getEl<HTMLButtonElement>("bt_reset");
  const resultBox = getEl<HTMLDivElement>("bt_result");

  const workEndInput = getEl<HTMLInputElement>("bt_work_end_time");
  const returnTimeInput = getEl<HTMLInputElement>("bt_return_time");

  // ✅ 복귀지 select (value: company/home/other)
  const returnPlaceSelect = getEl<HTMLSelectElement>("bt_return_place");
  const returnPlaceOther = document.getElementById("bt_return_place_other") as HTMLInputElement | null;

  const mealBreakfastCheck = getEl<HTMLInputElement>("bt_meal_breakfast");
  const mealLunchCheck = getEl<HTMLInputElement>("bt_meal_lunch");
  const mealDinnerCheck = getEl<HTMLInputElement>("bt_meal_dinner");

  const mealBreakfastOwner = getEl<HTMLSelectElement>("bt_meal_breakfast_owner");
  const mealLunchOwner = getEl<HTMLSelectElement>("bt_meal_lunch_owner");
  const mealDinnerOwner = getEl<HTMLSelectElement>("bt_meal_dinner_owner");

  // ✅ 복귀지 기타 토글
  returnPlaceSelect.addEventListener("change", () => {
    if (!returnPlaceOther) return;
    const isOther = returnPlaceSelect.value === "other";
    returnPlaceOther.classList.toggle("hidden", !isOther);
    if (!isOther) returnPlaceOther.value = "";
  });

  // ✅ 체크 안 한 식사는 owner="none"
  const normalizeMeal = (checked: boolean, owner: string) => {
    if (!checked) return { checked: false, owner: "none" };
    return { checked: true, owner: owner || "personal" };
  };

  resetBtn.addEventListener("click", () => {
    workEndInput.value = "";
    returnTimeInput.value = "";

    returnPlaceSelect.value = "";
    if (returnPlaceOther) {
      returnPlaceOther.value = "";
      returnPlaceOther.classList.add("hidden");
    }

    document.querySelectorAll<HTMLInputElement>(`input[name="bt_vehicle"]`).forEach((r) => (r.checked = false));

    mealBreakfastCheck.checked = false;
    mealLunchCheck.checked = false;
    mealDinnerCheck.checked = false;

    mealBreakfastOwner.value = "";
    mealLunchOwner.value = "";
    mealDinnerOwner.value = "";

    resultBox.textContent = "정산 입력값이 초기화되었습니다.";
  });

  saveBtn.addEventListener("click", async () => {
    const vehicleValue = getCheckedRadioValue("bt_vehicle");

    const trip_date = localStorage.getItem("settleTargetDate") ?? "";
    const req_name = localStorage.getItem("settleTargetReqName") ?? "";

    if (!trip_date || !req_name) {
      await ModalUtil.show({
        type: "alert",
        title: "정산 대상 없음",
        message: "먼저 [출장등록] 저장 후 [이어서 정산]으로 들어와 주세요.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    if (!workEndInput.value) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "업무 종료시간을 입력해주세요.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    if (!returnTimeInput.value) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "복귀시간을 입력해주세요.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    // ✅ 핵심: 회사/자택은 company/home 그대로 보내고, 기타만 텍스트로 보냄
    const return_place =
      returnPlaceSelect.value === "other"
        ? (returnPlaceOther?.value ?? "").trim()
        : returnPlaceSelect.value; // company | home

    if (!return_place) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "복귀지(회사/자택/기타)를 선택해주세요.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    if (returnPlaceSelect.value === "other" && !returnPlaceOther?.value.trim()) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "기타 복귀지를 입력해주세요.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    if (!vehicleValue) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "차량(정산용)을 선택해주세요.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    const b = normalizeMeal(mealBreakfastCheck.checked, mealBreakfastOwner.value);
    const l = normalizeMeal(mealLunchCheck.checked, mealLunchOwner.value);
    const d = normalizeMeal(mealDinnerCheck.checked, mealDinnerOwner.value);

    const settlement: SettlementFormPayload = {
      work_end_time: workEndInput.value,
      return_time: returnTimeInput.value,
      return_place,
      vehicle: vehicleValue,
      meals: { breakfast: b, lunch: l, dinner: d },
    };

    const detail_json = { settlement };

    try {
      saveBtn.disabled = true;
      resultBox.textContent = "정산 내용 저장 중...";

      const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ req_name, trip_date, detail_json }),
      });

      if (!res.ok) {
        const text = await res.text();
        resultBox.textContent = `❌ 정산 저장 실패: HTTP ${res.status} ${text}`;
        await ModalUtil.show({
          type: "alert",
          title: "정산 저장 실패",
          message: resultBox.textContent,
          showOk: true,
          showCancel: false,
        });
        return;
      }

      const data = await res.json().catch(() => null);
      console.log("[정산] 응답 data =", data);

      // (선택) 개인차량인데 km=0이면 안내
      const fuelKm = data?.data?.calc?.fuel_distance_km ?? 0;
      if (vehicleValue === "personal" && Number(fuelKm) === 0) {
        await ModalUtil.show({
          type: "alert",
          title: "유류비 0원 안내",
          message:
            "개인차량으로 선택했지만 거리(km)가 0으로 계산되었습니다.\n거리 마스터(trip_distance_master)에\n[직원명 + 거래처명] 거리 등록이 있는지 확인해주세요.",
          showOk: true,
          showCancel: false,
        });
      }

      resultBox.textContent = "✅ 정산 정보가 저장되었습니다.";

      await ModalUtil.show({
        type: "alert",
        title: "정산 완료",
        message: "정산 정보가 성공적으로 저장되었습니다.",
        showOk: true,
        showCancel: false,
      });

      window.dispatchEvent(new Event("trip-status-refresh"));
    } catch (err: any) {
      console.error("[정산] 저장 중 오류:", err);
      resultBox.textContent = `❌ 정산 저장 중 오류: ${err?.message ?? "알 수 없는 오류"}`;
      await ModalUtil.show({
        type: "alert",
        title: "정산 저장 오류",
        message: resultBox.textContent,
        showOk: true,
        showCancel: false,
      });
    } finally {
      saveBtn.disabled = false;
    }
  });
}
