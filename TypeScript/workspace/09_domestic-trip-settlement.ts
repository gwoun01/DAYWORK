// TypeScript/workspace/09_domestic-trip-settlement.ts
import { ModalUtil } from "./utils/ModalUtil";

type SettlementFormPayload = {
  work_end_time: string;
  return_time: string;
  return_place: string; // company/home/기타텍스트
  vehicle: "corp" | "personal" | "other" | "public"; // ✅ 표준 코드로 통일
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

/** ✅ 차량 라디오 value가 뭐로 오든, 서버/계산용 표준 코드로 변환 */
function toVehicleCode(v: string): "corp" | "personal" | "other" | "public" {
  const s = String(v ?? "").trim();
  if (s === "corp" || s === "corporate") return "corp";
  if (s === "personal") return "personal";
  if (s === "other" || s === "other_personal") return "other";
  if (s === "public") return "public";
  return "other";
}

function textOrEmpty(v: any) {
  return String(v ?? "").trim();
}

// ✅ HH:mm → 분(min) 변환 (자정 넘어감 판단에 사용)
function parseHHMMToMinutes(v: any): number | null {
  const s = String(v ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * ✅ URL 파라미터 읽기 (search + hash 둘 다 대응)
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

/** ✅ (추가) URL 파라미터 세팅 (08과 동일하게 방어적으로) */
function setQueryParams(params: Record<string, string>) {
  try {
    const url = new URL(window.location.href);

    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

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

// ✅ 날짜 표시 유틸: 어떤 값이 와도 YYYY-MM-DD로 고정
function toYmd(v: any): string {
  if (!v) return "";
  const s = String(v).trim();

  // 이미 YYYY-MM-DD 형태면 그대로
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  // Date/ISO 등은 ISO로 바꾼 뒤 앞 10자리만
  try {
    const iso = new Date(v).toISOString();
    return iso.slice(0, 10);
  } catch {
    return "";
  }
}

// ✅ YYYY-MM-DD → (월/화/...) KST 기준 요일
function ymdToKoreanDow(ymd: string): string {
  const [y, m, d] = String(ymd).split("-").map((x) => Number(x));
  if (!y || !m || !d) return "";

  // UTC로 만들고 +9h 해서 KST 요일 계산
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][kst.getUTCDay()];
  return dow ? `(${dow})` : "";
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

  // ✅ (추가) 변경 감지 배지
  const dirtyBadge = document.getElementById("bt_dirty_badge") as HTMLDivElement | null;

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

  // (있으면) 현재 로그인 사용자명 검사에 사용
  const userNameEl = document.getElementById("userName");
  function currentUserName(): string {
    return (userNameEl?.textContent ?? "").trim();
  }

  // ✅ 체크 안 한 식사는 owner="none"
  const normalizeMeal = (checked: boolean, owner: string) => {
    if (!checked) return { checked: false, owner: "none" };
    return { checked: true, owner: owner || "personal" };
  };

  // ===========================
  // ✅ 변경 감지(Dirty) + 새로고침 경고
  // ===========================
  let snapshot = "";
  let isDirty = false;

  function setDirtyUI(v: boolean) {
    isDirty = v;
    if (dirtyBadge) dirtyBadge.classList.toggle("hidden", !v);
  }

  function collectFormSnapshot(): string {
    try {
      const vehicleValueRaw = getCheckedRadioValue("bt_vehicle");
      const vehicleValue = toVehicleCode(vehicleValueRaw);

      const return_place =
        returnPlaceSelect.value === "other"
          ? (returnPlaceOther?.value ?? "").trim()
          : returnPlaceSelect.value;

      const b = normalizeMeal(mealBreakfastCheck.checked, mealBreakfastOwner.value);
      const l = normalizeMeal(mealLunchCheck.checked, mealLunchOwner.value);
      const d = normalizeMeal(mealDinnerCheck.checked, mealDinnerOwner.value);

      const payload: SettlementFormPayload = {
        work_end_time: workEndInput.value,
        return_time: returnTimeInput.value,
        return_place,
        vehicle: vehicleValue,
        meals: { breakfast: b, lunch: l, dinner: d },
      };

      return JSON.stringify(payload);
    } catch {
      return "";
    }
  }

  function applySnapshotNow() {
    snapshot = collectFormSnapshot();
    setDirtyUI(false);
  }

  function markDirty() {
    const now = collectFormSnapshot();
    setDirtyUI(now !== snapshot);
  }

  // ✅✅✅ 폼 완전 초기화
  function clearForm(msg?: string) {
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

    resultBox.textContent = msg ?? "";
    applySnapshotNow(); // dirty 해제
  }

  // ✅✅✅ 08에서 "이어서 정산" 누르면 무조건 폼 초기화(브라우저 자동복원 제거)
  window.addEventListener("settlement:force-clear", () => {
    clearForm("");
    applySnapshotNow();
  });

  // ✅✅✅ 정산 시간 인터락(자정 넘어감 허용)
  // - 업무종료(예: 23:00) > 복귀(예: 02:00)면 "익일 복귀" 안내만 띄움
  function showNextDayHint_Settlement() {
    const s = parseHHMMToMinutes(workEndInput.value);
    const e = parseHHMMToMinutes(returnTimeInput.value);
    if (s == null || e == null) return;

    if (s > e) {
      resultBox.textContent =
        "ℹ️ 복귀시간이 업무종료시간보다 빠릅니다 → 익일 복귀(자정 넘어감)으로 처리됩니다.";
    }
  }

  workEndInput.addEventListener("change", showNextDayHint_Settlement);
  returnTimeInput.addEventListener("change", showNextDayHint_Settlement);
  workEndInput.addEventListener("input", showNextDayHint_Settlement);
  returnTimeInput.addEventListener("input", showNextDayHint_Settlement);

  // ✅ 복귀지 기타 토글
  returnPlaceSelect.addEventListener("change", () => {
    if (!returnPlaceOther) return;
    const isOther = returnPlaceSelect.value === "other";
    returnPlaceOther.classList.toggle("hidden", !isOther);
    if (!isOther) returnPlaceOther.value = "";
    markDirty();
  });

  // ✅ 입력 변화 감지(최소 침습)
  const bindDirty = (el: HTMLElement | null) => {
    if (!el) return;
    el.addEventListener("input", markDirty);
    el.addEventListener("change", markDirty);
  };

  [
    workEndInput,
    returnTimeInput,
    returnPlaceSelect,
    returnPlaceOther,
    mealBreakfastCheck,
    mealLunchCheck,
    mealDinnerCheck,
    mealBreakfastOwner,
    mealLunchOwner,
    mealDinnerOwner,
  ].forEach((x) => bindDirty(x as any));

  document.querySelectorAll<HTMLInputElement>(`input[name="bt_vehicle"]`).forEach((r) => {
    r.addEventListener("change", markDirty);
  });

  // ✅ 새로고침/탭닫기 경고
  window.addEventListener("beforeunload", (e) => {
    if (!isDirty) return;
    e.preventDefault();
    (e as any).returnValue = "";
  });

  // ✅ 정산 대상(요청자/날짜/✅trip_id) 읽기: URL 파라미터에서만
  function readSettleTarget(): { req_name: string; trip_date: string; trip_id: string } {
    const req_name = textOrEmpty(getQueryParam("req_name"));
    const trip_date = textOrEmpty(getQueryParam("trip_date"));
    const trip_id = textOrEmpty(getQueryParam("trip_id"));
    return { req_name, trip_date, trip_id };
  }

  // ✅ 다른 계정 로그인 상태에서 URL 파라미터가 남아있으면 즉시 제거(정보 잔존 방지)
  function validateTargetOrClear() {
    const { req_name, trip_date, trip_id } = readSettleTarget();
    const me = currentUserName();

    if (!req_name || !trip_date) return { ok: false, req_name, trip_date, trip_id };

    if (me && req_name !== me) {
      clearQueryParams(["req_name", "trip_date", "trip_id"]);
      return { ok: false, req_name: "", trip_date: "", trip_id: "" };
    }

    return { ok: true, req_name, trip_date, trip_id };
  }

  // ✅✅✅ 핵심: 타겟이 바뀌면 폼을 무조건 비움
  // - 기존엔 req_name|trip_date 만 써서 "같은날 2건"이면 안 비워졌음
  let lastTargetKey = "";
  function syncTargetAndClearIfChanged() {
    const t = validateTargetOrClear();

    // ✅ trip_id가 있으면 반드시 포함(같은 날짜 다건 처리)
    const key = `${t.req_name}|${t.trip_date}|${t.trip_id || "-"}`;

    if (!t.req_name || !t.trip_date) {
      lastTargetKey = "";
      clearForm("");
      return;
    }

    if (lastTargetKey && key !== lastTargetKey) {
      clearForm("✅ 이전 정산 입력값을 초기화했습니다.");
    }

    lastTargetKey = key;
  }

  /**
   * ✅ URL 파라미터가 없을 때 "진행중 정산" 1건을 서버에서 다시 찾아 자동 세팅
   * - 가능하면 trip_id도 같이 세팅 (서버가 내려주면)
   */
  async function restoreTargetIfMissing() {
    const me = currentUserName();
    if (!me) return;

    const now = readSettleTarget();
    if (now.req_name && now.trip_date) return;

    try {
      const r = await fetch(`${API_BASE}/api/business-trip/settlement/in-progress?req_name=${encodeURIComponent(me)}`);
      if (!r.ok) return;

      const j = await r.json().catch(() => null);
      const data = j?.data;

      if (!data?.trip_date) return;
      if (String(data.req_name ?? "") !== me) return;

      const params: Record<string, string> = { req_name: me, trip_date: String(data.trip_date) };
      const tid = textOrEmpty(data.trip_id ?? data.id);
      if (tid) params.trip_id = tid;

      setQueryParams(params);
      resultBox.textContent = "✅ 진행중 정산 건을 자동으로 불러왔습니다. 이어서 작성하세요.";
    } catch {
      // ignore
    }
  }

  // ✅ 초기 1회: 혹시 URL이 비어있으면 진행중 복원 시도
  restoreTargetIfMissing().then(() => {
    syncTargetAndClearIfChanged();
    applySnapshotNow();
  });

  // ✅ (선택) URL이 바뀌는 SPA 환경 대응
  window.addEventListener("hashchange", () => syncTargetAndClearIfChanged());
  window.addEventListener("popstate", () => syncTargetAndClearIfChanged());

  resetBtn.addEventListener("click", async () => {
    if (isDirty) {
      const ok = await ModalUtil.show({
        type: "warn",
        title: "초기화 확인",
        messageHtml: "저장되지 않은 변경사항이 있습니다.<br/>정산 입력값을 초기화할까요?",
        showOk: true,
        showCancel: true,
        okText: "초기화",
        cancelText: "취소",
        okClass: "bg-rose-600 hover:bg-rose-700",
        cancelClass: "border border-gray-300 text-gray-700 hover:bg-gray-50",
      });
      if (ok !== true) return;
    }

    clearForm("정산 입력값이 초기화되었습니다.");
  });

  saveBtn.addEventListener("click", async () => {
    const vehicleValueRaw = getCheckedRadioValue("bt_vehicle");
    const vehicleValue = toVehicleCode(vehicleValueRaw);

    // ✅ 저장 순간에도 URL이 비어있으면 한번 더 복원 시도 후 검증
    await restoreTargetIfMissing();
    syncTargetAndClearIfChanged();

    const t = validateTargetOrClear();
    const trip_date = t.trip_date;
    const req_name = t.req_name;
    const trip_id = t.trip_id; // ✅ 있으면 같이 전송(백엔드가 무시해도 OK)

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

    const return_place =
      returnPlaceSelect.value === "other" ? (returnPlaceOther?.value ?? "").trim() : returnPlaceSelect.value;

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

    if (!vehicleValueRaw) {
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
        body: JSON.stringify({ req_name, trip_date, trip_id, detail_json }),
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

      clearQueryParams(["req_name", "trip_date", "trip_id"]);
      window.dispatchEvent(new Event("domestic-trip-settled"));
      window.dispatchEvent(new Event("trip-status-refresh"));

      applySnapshotNow();
      lastTargetKey = "";
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

  // ✅ SPA 패널 전환 대응: 정산 섹션이 "보이는 순간" 타겟 점검 + 타겟 없으면 clearForm()
  const mo = new MutationObserver(() => {
    const isHidden = section.classList.contains("hidden");
    if (!isHidden) {
      syncTargetAndClearIfChanged();
      applySnapshotNow();
    }
  });
  mo.observe(section, { attributes: true, attributeFilter: ["class"] });

  // ✅ 섹션이 이미 보이는 상태로 init 되었을 수도 있으니 1회 보정
  if (!section.classList.contains("hidden")) {
    syncTargetAndClearIfChanged();
    applySnapshotNow();
  }

  syncTargetAndClearIfChanged();
}
