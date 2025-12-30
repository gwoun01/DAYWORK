// TypeScript/workspace/09_domestic-trip-settlement.ts
import { ModalUtil } from "./utils/ModalUtil";

type SettlementFormPayload = {
    work_end_time: string;    // 업무 종료시간
    return_time: string;      // 복귀시간
    return_place: string;     // 복귀지(회사/자택)
    vehicle: string;          // 차량
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
    const checked = document.querySelector<HTMLInputElement>(
        `input[name="${name}"]:checked`
    );
    return checked?.value ?? "";
}

/**
 * 국내출장 정산 입력 패널 초기화
 * - 00_workspace.ts 에서 initDomesticTripSettlementPanel(API_BASE)로 한 번만 호출
 */
export function initDomesticTripSettlementPanel(API_BASE: string) {
    console.log("[정산] initDomesticTripSettlementPanel 호출");

    const section = document.getElementById("bt_settlement_section");
    if (!section) {
        console.warn("[정산] #bt_settlement_section 요소를 찾을 수 없습니다. HTML 구조를 확인하세요.");
        return;
    }

    const saveBtn = getEl<HTMLButtonElement>("bt_save");
    // 중복 바인딩 방지
    if ((saveBtn as any)._bound) {
        console.log("[정산] 이미 바인딩된 상태이므로 다시 바인딩하지 않음");
        return;
    }
    (saveBtn as any)._bound = true;

    const resetBtn = getEl<HTMLButtonElement>("bt_reset");
    const resultBox = getEl<HTMLDivElement>("bt_result");

    const workEndInput = getEl<HTMLInputElement>("bt_work_end_time");
    const returnTimeInput = getEl<HTMLInputElement>("bt_return_time");
    const returnPlaceInput = getEl<HTMLInputElement>("bt_return_place");

    const mealBreakfastCheck = getEl<HTMLInputElement>("bt_meal_breakfast");
    const mealLunchCheck = getEl<HTMLInputElement>("bt_meal_lunch");
    const mealDinnerCheck = getEl<HTMLInputElement>("bt_meal_dinner");

    const mealBreakfastOwner = getEl<HTMLSelectElement>("bt_meal_breakfast_owner");
    const mealLunchOwner = getEl<HTMLSelectElement>("bt_meal_lunch_owner");
    const mealDinnerOwner = getEl<HTMLSelectElement>("bt_meal_dinner_owner");

    // 🔹 08_domestic-trip-register.ts 에서 저장해 둔 값 사용
    const baseDate = localStorage.getItem("settleTargetDate") ?? "";
    const baseReqName = localStorage.getItem("settleTargetReqName") ?? "";

    console.log("[정산] baseDate =", baseDate, "baseReqName =", baseReqName);

    // 🔹 리셋 버튼
    resetBtn.addEventListener("click", () => {
        workEndInput.value = "";
        returnTimeInput.value = "";
        returnPlaceInput.value = "";

        mealBreakfastCheck.checked = false;
        mealLunchCheck.checked = false;
        mealDinnerCheck.checked = false;

        mealBreakfastOwner.value = "";
        mealLunchOwner.value = "";
        mealDinnerOwner.value = "";

        resultBox.textContent = "정산 입력값이 초기화되었습니다.";
    });

    // 🔹 정산 저장 버튼
    saveBtn.addEventListener("click", async () => {
        console.log("[정산] 저장 버튼 클릭");

        const vehicleValue = getCheckedRadioValue("bt_vehicle");

        // 🚨 출발일/이름이 비어 있으면 어떤 건지 모름
        const trip_date = localStorage.getItem("settleTargetDate") ?? "";
        const req_name = localStorage.getItem("settleTargetReqName") ?? "";

        if (!trip_date || !req_name) {
            await ModalUtil.show({
                type: "alert",
                title: "정산 대상 없음",
                message:
                    "어떤 출장건에 대한 정산인지 정보가 없습니다.\n먼저 [출장등록]에서 저장 후 [이어 정산 작성]으로 들어와 주세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        // 필수값 체크
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
        if (!returnPlaceInput.value.trim()) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀지(회사/자택)를 입력해주세요.",
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

        const settlement: SettlementFormPayload = {
            work_end_time: workEndInput.value,
            return_time: returnTimeInput.value,
            return_place: returnPlaceInput.value.trim(),
            vehicle: vehicleValue,
            meals: {
                breakfast: {
                    checked: mealBreakfastCheck.checked,
                    owner: mealBreakfastOwner.value,
                },
                lunch: {
                    checked: mealLunchCheck.checked,
                    owner: mealLunchOwner.value,
                },
                dinner: {
                    checked: mealDinnerCheck.checked,
                    owner: mealDinnerOwner.value,
                },
            },
        };

        // 🧠 백엔드 /settlement 는 req_name, trip_date, detail_json 전체를 받는다.
        // detail_json 안에 settlement 를 넣어서 보내야 함.
        const detail_json = {
            settlement,
        };

        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산 내용 저장 중...";

            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    req_name,
                    trip_date,
                    detail_json, // ✅ 백엔드가 기대하는 구조
                }),
            });

            console.log("[정산] 응답 status =", res.status);

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

            resultBox.textContent = "✅ 정산 정보가 저장되었습니다.";

            await ModalUtil.show({
                type: "alert",
                title: "정산 완료",
                message: "정산 정보가 성공적으로 저장되었습니다.",
                showOk: true,
                showCancel: false,
            });

            // 필요하면 초기화
            // resetBtn.click();

            // 대시보드/출장 현황 새로고침용
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
