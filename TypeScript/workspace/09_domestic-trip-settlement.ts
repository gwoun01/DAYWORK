// TypeScript/workspace/09_domestic-trip-settlement.ts
import { ModalUtil } from "./utils/ModalUtil";

type DomesticTripDraft = {
    trip_type: "domestic";
    req_name: string;
    depart_place: string;
    destination: string;
    start_date: string;
    work_start_time: string;
    depart_time: string;
    arrive_time: string;
    purpose: string;
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

export function initDomesticTripSettlementPanel(API_BASE: string) {
    const panel = document.getElementById("panel-국내출장-정산서등록");
    if (!panel) return;

    const saveBtn = getEl<HTMLButtonElement>("bt_save");
    const resetBtn = getEl<HTMLButtonElement>("bt_reset");
    const resultBox = getEl<HTMLDivElement>("bt_result");
    const summaryBox = getEl<HTMLDivElement>("settle_trip_summary");

    if ((saveBtn as any)._bound) return;
    (saveBtn as any)._bound = true;

    // =========================
    // 정산 입력 필드
    // =========================
    const workEndTime = getEl<HTMLInputElement>("bt_work_end_time");
    const returnTime = getEl<HTMLInputElement>("bt_return_time");
    const returnPlace = getEl<HTMLInputElement>("bt_return_place");
    const breakfastChk = getEl<HTMLInputElement>("bt_meal_breakfast");
    const breakfastOwner = getEl<HTMLSelectElement>("bt_meal_breakfast_owner");
    const lunchChk = getEl<HTMLInputElement>("bt_meal_lunch");
    const lunchOwner = getEl<HTMLSelectElement>("bt_meal_lunch_owner");
    const dinnerChk = getEl<HTMLInputElement>("bt_meal_dinner");
    const dinnerOwner = getEl<HTMLSelectElement>("bt_meal_dinner_owner");

    // =========================
    // 1️⃣ 08에서 저장한 데이터 불러오기
    // =========================
    const draftStr = localStorage.getItem("domesticTripDraft");
    if (!draftStr) {
        ModalUtil.show({
            type: "alert",
            title: "데이터 없음",
            message: "출장 등록 데이터가 없습니다.\n출장 등록부터 진행하세요.",
            showOk: true,
            showCancel: false,
        });
        return;
    }

    const draft: DomesticTripDraft = JSON.parse(draftStr);

    // 카드 컨테이너
    const card = document.createElement("div");
    card.className =
        "border border-gray-200 rounded-xl p-4 bg-white text-xs text-gray-700 shadow-sm space-y-3";

    // 1️⃣ 출장자 / 출장일
    const row1 = document.createElement("div");
    row1.className = "flex justify-between";
    row1.innerHTML = `
  <div><span class="font-semibold">출장자</span>: ${draft.req_name}</div>
  <div><span class="font-semibold">출장일</span>: ${draft.start_date}</div>
`;
    card.appendChild(row1);

    summaryBox.innerHTML = "";
    summaryBox.appendChild(card);

    // 2️⃣ 출발지 / 출장지
    const row2 = document.createElement("div");
    row2.className = "grid grid-cols-2 gap-4";
    row2.innerHTML = `
  <div><span class="font-semibold">출발지</span>: ${draft.depart_place}</div>
  <div><span class="font-semibold">출장지</span>: ${draft.destination}</div>
`;
    card.appendChild(row2);

    // 3️⃣ 시간 정보
    const row3 = document.createElement("div");
    row3.className = "grid grid-cols-3 gap-3 bg-gray-50 p-2 rounded-lg";
    row3.innerHTML = `
  <div><span class="font-semibold">출발</span><br>${draft.depart_time || "-"}</div>
  <div><span class="font-semibold">업무시작</span><br>${draft.work_start_time || "-"}</div>
  <div><span class="font-semibold">도착</span><br>${draft.arrive_time || "-"}</div>
`;
    card.appendChild(row3);

    // 4️⃣ 목적
    const row4 = document.createElement("div");
    row4.className = "border-t pt-2";
    row4.innerHTML = `
  <span class="font-semibold">출장 목적</span><br>
  <span class="text-gray-600">${draft.purpose}</span>
`;
    card.appendChild(row4);


    // =========================
    // 초기화
    // =========================
    resetBtn.addEventListener("click", () => {
        workEndTime.value = "";
        returnTime.value = "";
        returnPlace.value = "";

        document
            .querySelectorAll<HTMLInputElement>('input[name="bt_vehicle"]')
            .forEach((r) => (r.checked = false));

        breakfastChk.checked = false;
        breakfastOwner.value = "";
        lunchChk.checked = false;
        lunchOwner.value = "";
        dinnerChk.checked = false;
        dinnerOwner.value = "";

        resultBox.textContent = "";
    });

    // =========================
    // 2️⃣ 정산 + DB 저장 (INSERT)
    // =========================
    saveBtn.addEventListener("click", async () => {
        const vehicle = getCheckedRadioValue("bt_vehicle");

        if (!workEndTime.value || !returnTime.value || !returnPlace.value.trim()) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "정산 필수 항목을 모두 입력하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        if (!vehicle) {
            await ModalUtil.show({
                type: "alert",
                title: "입력 확인",
                message: "차량을 선택하세요.",
                showOk: true,
                showCancel: false,
            });
            return;
        }

        const payload = {
            trip_type: "domestic",
            req_name: draft.req_name,
            trip_date: draft.start_date,
            detail_json: {
                register: draft,
                settlement: {
                    work_end_time: workEndTime.value,
                    return_time: returnTime.value,
                    return_place: returnPlace.value.trim(),
                    vehicle,
                    meals: {
                        breakfast: { checked: breakfastChk.checked, owner: breakfastOwner.value },
                        lunch: { checked: lunchChk.checked, owner: lunchOwner.value },
                        dinner: { checked: dinnerChk.checked, owner: dinnerOwner.value },
                    },
                },
            },
        };

        try {
            saveBtn.disabled = true;
            resultBox.textContent = "정산서 저장 중...";

            const res = await fetch(`${API_BASE}/api/business-trip/settlement`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

            localStorage.removeItem("domesticTripDraft");
            window.dispatchEvent(new Event("trip-status-refresh"));

            resultBox.textContent = "✅ 정산서 저장 완료";
            await ModalUtil.show({
                type: "alert",
                title: "저장 완료",
                message: "출장 정산이 완료되었습니다.",
                showOk: true,
                showCancel: false,
            });
        } catch (err: any) {
            console.error(err);
            resultBox.textContent = `❌ 저장 실패: ${err?.message ?? "알 수 없는 오류"}`;
        } finally {
            saveBtn.disabled = false;
        }
    });
}
