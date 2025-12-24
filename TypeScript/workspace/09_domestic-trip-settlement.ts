// TypeScript/workspace/09_domestic-trip-settlement.ts
import { ModalUtil } from "./utils/ModalUtil";

type SettlementPayload = {
    trip_date: string;               // 정산 대상 날짜
    work_end_time: string;           // 업무 종료시간
    home_depart_time: string;        // 자택/회사 출발시간
    home_arrive_time: string;        // 자택/회사 도착시간
    return_place: string;            // ✅ 복귀지(회사/자택)
    vehicle: string;                 // 차량
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
    const panel = document.getElementById("panel-국내출장-정산서등록");
    if (!panel) return;

    const loadBtn = getEl<HTMLButtonElement>("bt_load_trip");
    const saveBtn = getEl<HTMLButtonElement>("bt_save");
    const resetBtn = getEl<HTMLButtonElement>("bt_reset");
    const resultBox = getEl<HTMLDivElement>("bt_result");

    // 중복 바인딩 방지 (패널 열때마다 이벤트 또 붙는거 방지)
    if ((saveBtn as any)._bound) return;
    (saveBtn as any)._bound = true;

    const settleDate = getEl<HTMLInputElement>("bt_settle_date");
    const summaryBox = getEl<HTMLDivElement>("settle_trip_summary");

    const workEndTime = getEl<HTMLInputElement>("bt_work_end_time");
    const homeDepartTime = getEl<HTMLInputElement>("bt_home_depart_time");
    const homeArriveTime = getEl<HTMLInputElement>("bt_home_arrive_time");

    // ✅ 방금 HTML에 추가한 input
    const returnPlace = getEl<HTMLInputElement>("bt_return_place");

    // 식사
    const breakfastChk = getEl<HTMLInputElement>("bt_meal_breakfast");
    const breakfastOwner = getEl<HTMLSelectElement>("bt_meal_breakfast_owner");
    const lunchChk = getEl<HTMLInputElement>("bt_meal_lunch");
    const lunchOwner = getEl<HTMLSelectElement>("bt_meal_lunch_owner");
    const dinnerChk = getEl<HTMLInputElement>("bt_meal_dinner");
    const dinnerOwner = getEl<HTMLSelectElement>("bt_meal_dinner_owner");

    // 초기화
    resetBtn.addEventListener("click", () => {
        settleDate.value = "";
        summaryBox.innerHTML = `<div class="text-gray-500">정산 대상 날짜를 선택하고 <b>출장정보 불러오기</b> 버튼을 누르면, 해당 날짜에 등록된 출장 정보가 여기 표시됩니다.</div>`;

        workEndTime.value = "";
        homeDepartTime.value = "";
        homeArriveTime.value = "";
        returnPlace.value = "";

        // 차량 라디오 해제
        document.querySelectorAll<HTMLInputElement>('input[name="bt_vehicle"]').forEach((r) => (r.checked = false));

        // 식사 초기화
        breakfastChk.checked = false;
        breakfastOwner.value = "";
        lunchChk.checked = false;
        lunchOwner.value = "";
        dinnerChk.checked = false;
        dinnerOwner.value = "";

        resultBox.textContent = "";
    });

    // 1) 출장정보 불러오기
    loadBtn.addEventListener("click", async () => {
        if (!settleDate.value) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "정산 대상 날짜를 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        try {
            loadBtn.disabled = true;
            resultBox.textContent = "출장정보 불러오는 중...";

            // ✅ 여기 URL은 너 서버에 맞게 바꾸면 됨 (임시)
            // 예: /api/innomax-business_trips/domestic?date=YYYY-MM-DD
            const res = await fetch(`${API_BASE}/api/business-trip/by-date?date=${settleDate.value}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

            const data = await res.json();

            // data 예시는 서버에서 맞춰줘야 함
            // 임시로 있는 값들만 표시
            summaryBox.innerHTML = `
        <div><b>출장자:</b> ${data.req_name ?? "-"}</div>
        <div><b>출장지:</b> ${data.destination ?? data.place ?? "-"}</div>
        <div><b>시작일:</b> ${data.start_date ?? "-"}</div>
        <div><b>업무시작:</b> ${data.work_start_time ?? "-"}</div>
        <div><b>출발:</b> ${data.depart_time ?? "-"}</div>
        <div><b>도착:</b> ${data.arrive_time ?? "-"}</div>
      `;

            resultBox.textContent = "✅ 출장정보 불러오기 완료";
        } catch (err: any) {
            resultBox.textContent = `❌ 불러오기 실패: ${err?.message ?? "알 수 없는 오류"}`;
            await ModalUtil.show({
                type: "alert",
                title: "불러오기 실패",
                message: resultBox.textContent,
                showOk: true,
                showCancel: false,
            });
        } finally {
            loadBtn.disabled = false;
        }
    });

    // 2) 정산서 저장
    saveBtn.addEventListener("click", async () => {
        const vehicle = getCheckedRadioValue("bt_vehicle");

        // ✅ 필수값 체크 (초보용: 최소한 이것만 막아도 안정적)
        if (!settleDate.value) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "정산 대상 출장 날짜를 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        if (!workEndTime.value || !homeDepartTime.value || !homeArriveTime.value) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "업무 종료시간 / 자택(회사) 출발시간 / 자택(회사) 도착시간은 필수입니다.",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        if (!returnPlace.value.trim()) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "복귀지를 입력하세요. (예: 자택 또는 회사)",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        if (!vehicle) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "차량(정산용)을 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        // ✅ payload 완성 (타입 에러 해결)
        const payload: SettlementPayload = {
            trip_date: settleDate.value,
            work_end_time: workEndTime.value,
            home_depart_time: homeDepartTime.value,
            home_arrive_time: homeArriveTime.value,
            return_place: returnPlace.value.trim(),
            vehicle,
            meals: {
                breakfast: {
                    checked: breakfastChk.checked,
                    owner: breakfastOwner.value || "",
                },
                lunch: {
                    checked: lunchChk.checked,
                    owner: lunchOwner.value || "",
                },
                dinner: {
                    checked: dinnerChk.checked,
                    owner: dinnerOwner.value || "",
                },
            },
        };

        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산서 저장 중...";

            // ✅ 서버 주소는 너 백엔드 라우터에 맞게 바꾸면 됨
            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            resultBox.textContent = "✅ 정산서 저장 완료";
            await ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "정산서가 저장되었습니다.",
                showOk: true,
                showCancel: false,
            });
        } catch (err: any) {
            console.error("❌ 정산서 저장 실패:", err);
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