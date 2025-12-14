// TypeScript/workspace/08_domestic-trip-request.ts
import { ModalUtil } from "./utils/ModalUtil";

type DomesticTripCreatePayload = {
  trip_type: "domestic";
  requester_name: string;   // userName에서 가져옴
  place: string;            // 고객사/지역
  start_date: string;       // YYYY-MM-DD
  end_date: string;         // YYYY-MM-DD
  purpose: string;          // 출장 목적
};

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`❌ element not found: #${id}`);
  return el as T;
}

function isValidDateRange(start: string, end: string) {
  return !!start && !!end && end >= start;
}

export async function initDomesticTripRequestPanel(API_BASE: string) {
  // 패널 열 때마다 이벤트가 중복 등록되는 거 방지
  const saveBtn = getEl<HTMLButtonElement>("bt_save");
  if ((saveBtn as any)._bound) return;
  (saveBtn as any)._bound = true;

  const userNameEl = document.getElementById("userName");

  const reqNameInput = getEl<HTMLInputElement>("bt_req_name");
  const placeInput = getEl<HTMLInputElement>("bt_place");
  const startInput = getEl<HTMLInputElement>("bt_start");
  const endInput = getEl<HTMLInputElement>("bt_end");
  const purposeInput = getEl<HTMLTextAreaElement>("bt_purpose");
  const resetBtn = getEl<HTMLButtonElement>("bt_reset");
  const resultBox = getEl<HTMLDivElement>("bt_result");

  // 요청자 자동 채우기
  const currentName = (userNameEl?.textContent ?? "").trim() || "사용자";
  reqNameInput.value = currentName;

  // 초기화
  resetBtn.addEventListener("click", () => {
    placeInput.value = "";
    startInput.value = "";
    endInput.value = "";
    purposeInput.value = "";
    resultBox.textContent = "";
  });

  // 저장
  saveBtn.addEventListener("click", async () => {
    const payload: DomesticTripCreatePayload = {
      trip_type: "domestic",
      requester_name: reqNameInput.value.trim(),
      place: placeInput.value.trim(),
      start_date: startInput.value,
      end_date: endInput.value,
      purpose: purposeInput.value.trim(),
    };

    // ✅ 필수값 체크
    if (!payload.requester_name || !payload.place || !payload.start_date || !payload.end_date) {
      await ModalUtil.show({
        type: "alert",
        title: "입력 확인",
        message: "요청자 / 고객사(지역) / 시작일 / 종료일은 필수입니다.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    if (!isValidDateRange(payload.start_date, payload.end_date)) {
      await ModalUtil.show({
        type: "alert",
        title: "날짜 오류",
        message: "종료일은 시작일보다 빠를 수 없습니다.",
        showOk: true,
        showCancel: false,
      });
      return;
    }

    // ✅ 서버 엔드포인트 (노드 서버에 아래 중 하나로 맞추면 됨)
    // 1) 추천: POST /api/trips/domestic
    // 2) 대안: POST /api/trips
  const url = `${API_BASE}/api/business-trips/domestic`;


    try {
      saveBtn.disabled = true;
      resultBox.textContent = "저장 중...";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      resultBox.textContent = "✅ 저장 완료 (승인 대기)";
      await ModalUtil.show({
        type: "alert",
        title: "저장 완료",
        message: "국내 출장 요청이 등록되었습니다.",
        showOk: true,
        showCancel: false,
      });

      // 저장 후 폼 비우고 싶으면 아래 주석 해제
      // resetBtn.click();

    } catch (err: any) {
      console.error("❌ 국내출장 저장 실패:", err);
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
