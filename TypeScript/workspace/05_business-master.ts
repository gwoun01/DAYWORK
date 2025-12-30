// 10_business-master.ts
// 🚗 출장업무 관리 (거리 마스터 + 유류/환율/수당 설정) 프론트 코드

// ======================
// 타입 정의
// ======================

type BusinessConfig = {
  fuel_price_per_liter: number | null;
  km_per_liter: number | null;
  exchange_rate_usd: number | null;
  exchange_rate_jpy: number | null;
  exchange_rate_cny: number | null;
  duty_allowance_weekday: number | null;
  duty_allowance_weekend: number | null;
  default_oil_type: string;
  note: string;
};

type DistanceRow = {
  id: number | null; // 새로 추가된 행은 null
  from_place: string;
  to_place: string;
  distance_km: number | null;
  remark: string;
};

// ======================
// 유틸 함수
// ======================

function parseNumberOrNull(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapRawDistance(row: any): DistanceRow {
  return {
    id: row.id != null ? Number(row.id) : null,
    from_place: String(row.from_place ?? ""),
    to_place: String(row.to_place ?? ""),
    distance_km:
      row.distance_km != null ? Number(row.distance_km) : null,
    remark: String(row.remark ?? ""),
  };
}

// ======================
// 메인 진입 함수 (export)
// ======================

export function initBusinessMasterPanel(API_BASE: string) {
  console.log("[출장업무관리] initBusinessMasterPanel 시작");

  // 패널 루트 / 주요 DOM 요소들
  const panel = document.getElementById(
    "panel-출장업무-관리"
  ) as HTMLDivElement | null;
  const distanceTbodyEl = document.getElementById(
    "distanceTbody"
  ) as HTMLTableSectionElement | null;

  const btnConfigSave = document.getElementById(
    "btnConfigSave"
  ) as HTMLButtonElement | null;
  const btnDistanceAddRow = document.getElementById(
    "btnDistanceAddRow"
  ) as HTMLButtonElement | null;
  const btnDistanceSave = document.getElementById(
    "btnDistanceSave"
  ) as HTMLButtonElement | null;

  // 설정 input 요소들
  const inputFuelPrice = document.getElementById(
    "cfgFuelPrice"
  ) as HTMLInputElement | null;
  const inputKmPerLiter = document.getElementById(
    "cfgKmPerLiter"
  ) as HTMLInputElement | null;
  const inputUsd = document.getElementById(
    "cfgUsd"
  ) as HTMLInputElement | null;
  const inputJpy = document.getElementById(
    "cfgJpy"
  ) as HTMLInputElement | null;
  const inputCny = document.getElementById(
    "cfgCny"
  ) as HTMLInputElement | null;
  const inputDutyWeekday = document.getElementById(
    "cfgDutyWeekday"
  ) as HTMLInputElement | null;
  const inputDutyWeekend = document.getElementById(
    "cfgDutyWeekend"
  ) as HTMLInputElement | null;
  const selectOilType = document.getElementById(
    "cfgOilType"
  ) as HTMLSelectElement | null;
  const textareaNote = document.getElementById(
    "cfgNote"
  ) as HTMLTextAreaElement | null;

  // 필수 DOM 없으면 초기화 스킵 (다른 페이지에서 불려도 안전)
  if (!panel || !distanceTbodyEl) {
    console.warn(
      "[출장업무관리] 필수 DOM 요소(panel-business-master, distanceTbody)를 찾지 못했습니다."
    );
    return;
  }

  // ✅ 여기서부터는 distanceTbodyEl 이 null 아님을 확정해서 새 변수에 담음
  const distanceTbody: HTMLTableSectionElement = distanceTbodyEl;

  // 이미 초기화된 경우 다시 초기화하지 않기 (사이드바 이동 시 중복 방지)
  if ((panel as any)._bound) {
    console.debug(
      "[출장업무관리] 이미 초기화된 상태이므로 다시 바인딩하지 않음"
    );
    return;
  }
  (panel as any)._bound = true;

  console.log("[출장업무관리] DOM 요소들 확인 완료, 이벤트 바인딩 시작");

  // 내부에서 관리할 상태
  let distanceRows: DistanceRow[] = [];
  let deletedIds: number[] = [];

  // ======================
  // 설정 조회/표시
  // ======================

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/business-master/config`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.error(
          "[출장업무관리] 설정 조회 실패 status =",
          res.status
        );
        return;
      }
      const data = (await res.json()) as BusinessConfig;
      console.log("[출장업무관리] 설정 조회 응답:", data);

      if (inputFuelPrice)
        inputFuelPrice.value =
          data.fuel_price_per_liter?.toString() ?? "";
      if (inputKmPerLiter)
        inputKmPerLiter.value = data.km_per_liter?.toString() ?? "";
      if (inputUsd)
        inputUsd.value = data.exchange_rate_usd?.toString() ?? "";
      if (inputJpy)
        inputJpy.value = data.exchange_rate_jpy?.toString() ?? "";
      if (inputCny)
        inputCny.value = data.exchange_rate_cny?.toString() ?? "";
      if (inputDutyWeekday)
        inputDutyWeekday.value =
          data.duty_allowance_weekday?.toString() ?? "";
      if (inputDutyWeekend)
        inputDutyWeekend.value =
          data.duty_allowance_weekend?.toString() ?? "";
      if (selectOilType)
        selectOilType.value = data.default_oil_type || "휘발유";
      if (textareaNote) textareaNote.value = data.note || "";
    } catch (err) {
      console.error("[출장업무관리] 설정 조회 중 오류:", err);
    }
  }

  async function saveConfig() {
    const body: BusinessConfig = {
      fuel_price_per_liter: parseNumberOrNull(
        inputFuelPrice?.value ?? ""
      ),
      km_per_liter: parseNumberOrNull(inputKmPerLiter?.value ?? ""),
      exchange_rate_usd: parseNumberOrNull(inputUsd?.value ?? ""),
      exchange_rate_jpy: parseNumberOrNull(inputJpy?.value ?? ""),
      exchange_rate_cny: parseNumberOrNull(inputCny?.value ?? ""),
      duty_allowance_weekday: parseNumberOrNull(
        inputDutyWeekday?.value ?? ""
      ),
      duty_allowance_weekend: parseNumberOrNull(
        inputDutyWeekend?.value ?? ""
      ),
      default_oil_type: selectOilType?.value || "휘발유",
      note: textareaNote?.value ?? "",
    };

    try {
      const res = await fetch(`${API_BASE}/api/business-master/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(
          "[출장업무관리] 설정 저장 실패 status =",
          res.status
        );
        alert("설정 저장 중 오류가 발생했습니다.");
        return;
      }
      const saved = await res.json();
      console.log("[출장업무관리] 설정 저장 완료:", saved);
      alert("설정이 저장되었습니다.");
    } catch (err) {
      console.error("[출장업무관리] 설정 저장 중 오류:", err);
      alert("설정 저장 중 오류가 발생했습니다.");
    }
  }

  // ======================
  // 거리 마스터 조회/표시
  // ======================

  async function loadDistances() {
    distanceTbody.innerHTML = `
      <tr>
        <td colspan="6" class="border px-2 py-2 text-center text-xs text-gray-400">
          거리 목록 로딩 중...
        </td>
      </tr>
    `;
    try {
      const res = await fetch(`${API_BASE}/api/business-master/distances`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.error(
          "[출장업무관리] 거리 목록 조회 실패 status =",
          res.status
        );
        return;
      }
      const rows = await res.json();
      console.log("[출장업무관리] 거리 목록 응답:", rows);

      const list: DistanceRow[] = Array.isArray(rows)
        ? rows.map(mapRawDistance)
        : [];

      distanceRows = list;
      deletedIds = [];

      renderDistanceTable();
    } catch (err) {
      console.error("[출장업무관리] 거리 목록 조회 중 오류:", err);
    }
  }

  function renderDistanceTable() {
    distanceTbody.innerHTML = "";

    if (!distanceRows.length) {
      distanceTbody.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-2 text-center text-xs text-gray-400">
            등록된 거리 정보가 없습니다. [+ 행 추가] 버튼으로 추가하세요.
          </td>
        </tr>
      `;
      return;
    }

    distanceRows.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = String(index);

      tr.innerHTML = `
        <td class="border px-2 py-1 text-center">${index + 1}</td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-xs from-input"
            value="${row.from_place ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-xs to-input"
            value="${row.to_place ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="number"
            step="0.1"
            class="w-full border rounded px-1 py-[2px] text-right text-xs km-input"
            value="${row.distance_km ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-xs remark-input"
            value="${row.remark ?? ""}"
          />
        </td>
        <td class="border px-1 py-1 text-center">
          <button
            type="button"
            class="px-2 py-[2px] text-[11px] rounded bg-red-100 text-red-700 hover:bg-red-200 btn-row-delete"
          >
            삭제
          </button>
        </td>
      `;

      distanceTbody.appendChild(tr);
    });
  }

  /** 테이블 input 값 → distanceRows 배열에 반영 */
  function syncDistanceFromTable() {
    const rows = distanceTbody.querySelectorAll<HTMLTableRowElement>("tr");
    rows.forEach((tr) => {
      const idxStr = tr.dataset.index;
      if (idxStr == null) return;
      const idx = Number(idxStr);
      const row = distanceRows[idx];
      if (!row) return;

      const fromInput = tr.querySelector<HTMLInputElement>(".from-input");
      const toInput = tr.querySelector<HTMLInputElement>(".to-input");
      const kmInput = tr.querySelector<HTMLInputElement>(".km-input");
      const remarkInput = tr.querySelector<HTMLInputElement>(".remark-input");

      row.from_place = fromInput?.value ?? "";
      row.to_place = toInput?.value ?? "";
      row.distance_km = parseNumberOrNull(kmInput?.value ?? "");
      row.remark = remarkInput?.value ?? "";
    });
  }

  async function saveDistances() {
    // 먼저 화면 → 메모리 반영
    syncDistanceFromTable();

    // 필수값 체크
    for (const row of distanceRows) {
      if (!row.from_place || !row.to_place || row.distance_km == null) {
        alert("출발지, 도착지, 거리(km)는 모두 입력해야 합니다.");
        return;
      }
    }

    try {
      // 1) 삭제해야 할 id 삭제
      for (const id of deletedIds) {
        if (!id) continue;
        const res = await fetch(
          `${API_BASE}/api/business-master/distances/${id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
        if (!res.ok) {
          console.error(
            "[출장업무관리] 거리 삭제 실패 id =",
            id,
            "status =",
            res.status
          );
        }
      }
      deletedIds = [];

      // 2) 새 행 / 기존 행 저장
      for (const row of distanceRows) {
        const payload = {
          from_place: row.from_place,
          to_place: row.to_place,
          distance_km: row.distance_km,
          remark: row.remark,
        };

        if (row.id == null) {
          // INSERT
          const res = await fetch(
            `${API_BASE}/api/business-master/distances`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );
          if (!res.ok) {
            console.error(
              "[출장업무관리] 거리 등록 실패 status =",
              res.status
            );
          }
        } else {
          // UPDATE
          const res = await fetch(
            `${API_BASE}/api/business-master/distances/${row.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );
          if (!res.ok) {
            console.error(
              "[출장업무관리] 거리 수정 실패 id =",
              row.id,
              "status =",
              res.status
            );
          }
        }
      }

      alert("거리 마스터가 저장되었습니다.");
      await loadDistances();
    } catch (err) {
      console.error("[출장업무관리] 거리 저장 중 오류:", err);
      alert("거리 저장 중 오류가 발생했습니다.");
    }
  }

  function addEmptyRow() {
    distanceRows.push({
      id: null,
      from_place: "",
      to_place: "",
      distance_km: null,
      remark: "",
    });
    renderDistanceTable();
  }

  // ======================
  // 이벤트 바인딩
  // ======================

  btnConfigSave?.addEventListener("click", () => {
    console.log("[출장업무관리] 설정 저장 버튼 클릭");
    saveConfig();
  });

  btnDistanceAddRow?.addEventListener("click", () => {
    console.log("[출장업무관리] 거리 행 추가 버튼 클릭");
    addEmptyRow();
  });

  btnDistanceSave?.addEventListener("click", () => {
    console.log("[출장업무관리] 거리 저장 버튼 클릭");
    saveDistances();
  });

  // 테이블 내 삭제 버튼 (이벤트 위임)
  distanceTbody.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    if (!target.classList.contains("btn-row-delete")) return;

    const tr = target.closest("tr") as HTMLTableRowElement | null;
    if (!tr) return;

    const idxStr = tr.dataset.index;
    if (idxStr == null) return;
    const idx = Number(idxStr);
    const row = distanceRows[idx];
    if (!row) return;

    if (row.id != null) {
      deletedIds.push(row.id);
    }
    distanceRows.splice(idx, 1);
    renderDistanceTable();
  });

  // ======================
  // 초기 데이터 로딩
  // ======================

  loadConfig();
  loadDistances();
}
