// 05_business-master.ts
// 🚗 출장업무 관리 (거리 마스터 + 유류/환율/당직자/공지 설정) 프론트 코드

// ======================
// 타입 정의
// ======================

type BusinessConfig = {
  // ✅ 유류비(리터당 원) 3종
  fuel_price_gasoline: number | null; // 휘발유
  fuel_price_diesel: number | null;   // 경유
  fuel_price_lpg: number | null;      // 가스(LPG)

  // ✅ 환율
  exchange_rate_usd: number | null;
  exchange_rate_jpy: number | null;
  exchange_rate_cny: number | null;

  // ✅ 당직/공지
  duty_members_text: string; // ✅ 여기 안에 JSON 문자열로 (후보/순번) 저장 (백엔드 추가 X)
  notice: string;            // 대시보드 공지
};

type DistanceRow = {
  id: number | null;          // 새 행이면 null
  region: string;             // 지역
  client_name: string;        // 거래처
  distance_km: number | null; // 거리(km)
};

// ✅ 당직 후보(사용자관리에서 가져옴)
type DutyMember = {
  no: number;
  name: string;
};

type DutyAssign = {
  date: string; // YYYY-MM-DD
  name: string;
};

// ======================
// 유틸
// ======================

function parseNumberOrNull(value: string): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapRawDistance(row: any): DistanceRow {
  return {
    id: row.id != null ? Number(row.id) : null,
    region: String(row.region ?? ""),
    client_name: String(row.client_name ?? ""),
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
  };
}

// ===== 당직 날짜 유틸(✅ 매일 포함: 공휴일/주말도 포함됨) =====
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ✅ 월의 모든 날짜(1~말일) 반환: 공휴일/주말 자동 포함
function getAllDaysOfMonth(base: Date) {
  const y = base.getFullYear();
  const m = base.getMonth(); // 0-based
  const last = new Date(y, m + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 1; i <= last; i++) {
    days.push(new Date(y, m, i));
  }
  return days;
}

// ======================
// ✅ (추가) 당직 "표" 렌더 (사진처럼 공지용 테이블 스타일)
// - 저장 X / 화면에만 표시
// - <div id="dutyTableBox"></div> 가 HTML에 있어야 함
// ======================
function renderDutyTable(assigns: DutyAssign[]) {
  const box = document.getElementById("dutyTableBox") as HTMLDivElement | null;
  if (!box) return;

  if (!assigns.length) {
    box.innerHTML = `
      <div class="text-xs text-gray-400">
        - 생성된 당직 데이터가 없습니다.
      </div>
    `;
    return;
  }

  // ✅ 2열(왼쪽/오른쪽)로 나누기 (사진처럼 보기 좋게)
  const half = Math.ceil(assigns.length / 2);
  const left = assigns.slice(0, half);
  const right = assigns.slice(half);

  const makeRows = (list: DutyAssign[]) =>
    list
      .map((a) => {
        const mmdd = a.date.slice(5); // "01-02"
        return `
          <tr class="border-b">
            <td class="px-2 py-2 text-center text-[11px]">${mmdd}</td>
            <td class="px-2 py-2 text-center text-[11px] text-gray-500">-</td>
            <td class="px-2 py-2 text-center text-[11px] font-semibold">${a.name}</td>
            <td class="px-2 py-2 text-center text-[11px] text-gray-400">-</td>
          </tr>
        `;
      })
      .join("");

  box.innerHTML = `
    <div class="border rounded-xl overflow-hidden bg-white">
      <div class="px-3 py-2 border-b text-sm font-bold text-gray-800">당직근무 일정</div>

      <div class="grid grid-cols-1 md:grid-cols-2">
        <!-- 왼쪽 -->
        <div class="overflow-auto">
          <table class="w-full border-collapse text-[11px]">
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="border-r px-2 py-2 w-20 text-center">월일</th>
                <th class="border-r px-2 py-2 text-center">소속</th>
                <th class="border-r px-2 py-2 text-center">근무자</th>
                <th class="px-2 py-2 w-16 text-center">변경</th>
              </tr>
            </thead>
            <tbody>
              ${makeRows(left)}
            </tbody>
          </table>
        </div>

        <!-- 오른쪽 -->
        <div class="overflow-auto border-t md:border-t-0 md:border-l">
          <table class="w-full border-collapse text-[11px]">
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="border-r px-2 py-2 w-20 text-center">월일</th>
                <th class="border-r px-2 py-2 text-center">소속</th>
                <th class="border-r px-2 py-2 text-center">근무자</th>
                <th class="px-2 py-2 w-16 text-center">변경</th>
              </tr>
            </thead>
            <tbody>
              ${makeRows(right)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ======================
// 메인 진입 함수
// ======================

export function initBusinessMasterPanel(API_BASE: string) {
  console.log("[출장업무관리] initBusinessMasterPanel 시작");

  //#region 돔수집쪽임
  const panel = document.getElementById("panel-출장업무-관리") as HTMLDivElement | null;

  const distanceTbodyEl = document.getElementById("distanceTbody") as HTMLTableSectionElement | null;

  const btnConfigSave = document.getElementById("btnConfigSave") as HTMLButtonElement | null;
  const btnDistanceAddRow = document.getElementById("btnDistanceAddRow") as HTMLButtonElement | null;
  const btnDistanceSave = document.getElementById("btnDistanceSave") as HTMLButtonElement | null;

  // ✅ 유류 3종 input (새 HTML id 기준)
  const inputFuelGasoline = document.getElementById("cfgFuelGasoline") as HTMLInputElement | null;
  const inputFuelDiesel = document.getElementById("cfgFuelDiesel") as HTMLInputElement | null;
  const inputFuelGas = document.getElementById("cfgFuelGas") as HTMLInputElement | null;

  // ✅ 환율 input
  const inputUsd = document.getElementById("cfgUsd") as HTMLInputElement | null;
  const inputJpy = document.getElementById("cfgJpy") as HTMLInputElement | null;
  const inputCny = document.getElementById("cfgCny") as HTMLInputElement | null;

  // ✅ 공지 textarea
  const textareaNotice = document.getElementById("cfgNotice") as HTMLTextAreaElement | null;

  // ✅ 당직 관련 DOM (행추가 X, 후보는 사용자관리에서 자동 렌더링)
  const dutyTbody = document.getElementById("dutyTbody") as HTMLTableSectionElement | null;

  // ✅ 버튼: id가 헷갈려도 둘 중 하나 잡히게 처리
  const btnDutyGenerateThisMonth =
    (document.getElementById("btnDutyGenerateThisMonth") as HTMLButtonElement | null) ||
    (document.getElementById("btnDutyGenThisMonth") as HTMLButtonElement | null);

  const dutyResultBox = document.getElementById("dutyResultBox") as HTMLDivElement | null;
  //#endregion

  if (!panel || !distanceTbodyEl) {
    console.warn("[출장업무관리] 필수 DOM(panel-출장업무-관리, distanceTbody) 없음");
    return;
  }

  if ((panel as any)._bound) {
    console.debug("[출장업무관리] 이미 초기화됨, 재바인딩 안함");
    return;
  }
  (panel as any)._bound = true;

  const distanceTbody = distanceTbodyEl;

  let distanceRows: DistanceRow[] = [];
  let deletedIds: number[] = [];

  // =====================================================
  // ✅ 당직 후보/순번 상태
  // =====================================================
  let dutyMembers: DutyMember[] = [];
  let dutyStartIndex = 0; // 다음 배정 시작 인덱스(순환)

  function renderDutyMembers() {
    if (!dutyTbody) return;

    if (!dutyMembers.length) {
      dutyTbody.innerHTML = `
        <tr>
          <td colspan="3" class="border px-2 py-2 text-center text-gray-400">
            후보 인원이 없습니다. (사용자관리에 먼저 등록하세요)
          </td>
        </tr>
      `;
      return;
    }

    dutyTbody.innerHTML = "";
    dutyMembers.forEach((m, idx) => {
      const tr = document.createElement("tr");
      tr.dataset.idx = String(idx);
      tr.innerHTML = `
        <td class="border-b px-2 py-2 text-center text-[11px]">${idx + 1}</td>
        <td class="border-b px-2 py-2 text-xs">${m.name}</td>
        <td class="border-b px-2 py-2 text-center">
          <button type="button"
            class="px-2 py-1 text-[11px] rounded-lg bg-red-100 text-red-700 hover:bg-red-200 btn-duty-delete">
            삭제
          </button>
        </td>
      `;
      dutyTbody.appendChild(tr);
    });
  }

  async function loadDutyMembersFromUsers() {
    if (!dutyTbody) return;

    dutyTbody.innerHTML = `
      <tr>
        <td colspan="3" class="border px-2 py-2 text-center text-gray-400">
          사용자 목록 로딩 중...
        </td>
      </tr>
    `;

    try {
      const res = await fetch(`${API_BASE}/api/users`, { credentials: "include" });
      if (!res.ok) {
        dutyTbody.innerHTML = `
          <tr>
            <td colspan="3" class="border px-2 py-2 text-center text-red-500">
              사용자 목록 조회 실패 (status ${res.status})
            </td>
          </tr>
        `;
        return;
      }

      const rows = await res.json();
      dutyMembers = Array.isArray(rows)
        ? rows
            .map((u: any) => ({
              no: Number(u.no ?? 0),
              name: String(u.name ?? u.Name ?? "").trim(),
            }))
            .filter((u: DutyMember) => u.no > 0 && u.name)
            .sort((a: DutyMember, b: DutyMember) => a.no - b.no)
        : [];

      if (dutyMembers.length === 0) dutyStartIndex = 0;
      else dutyStartIndex = dutyStartIndex % dutyMembers.length;

      renderDutyMembers();
    } catch (err) {
      console.error("[출장업무관리] 사용자 목록 로딩 오류:", err);
      dutyTbody.innerHTML = `
        <tr>
          <td colspan="3" class="border px-2 py-2 text-center text-red-500">
            사용자 목록 로딩 중 오류
          </td>
        </tr>
      `;
    }
  }

  // ✅ “현재 달” 자동 생성 + 표로 바로 보여주기
  function generateDutyForCurrentMonth() {
    if (!dutyMembers.length) {
      alert("당직 후보가 없습니다. 사용자관리에서 먼저 등록하세요.");
      return;
    }

    const base = new Date();
    base.setDate(1); // 이번달 1일 기준

    const days = getAllDaysOfMonth(base);
    const assigns: DutyAssign[] = [];

    let idx = dutyStartIndex;
    for (const d of days) {
      assigns.push({ date: ymd(d), name: dutyMembers[idx].name });
      idx = (idx + 1) % dutyMembers.length;
    }

    dutyStartIndex = idx;

    // ✅ 요약 표시
    if (dutyResultBox) {
      const first = assigns[0];
      const last = assigns[assigns.length - 1];
      dutyResultBox.innerHTML = `
        - 생성 월: ${base.getFullYear()}-${pad2(base.getMonth() + 1)}<br/>
        - 날짜 수(공휴일/주말 포함): ${assigns.length}일<br/>
        - 시작: ${first.date} (${first.name})<br/>
        - 마지막: ${last.date} (${last.name})<br/>
        - 다음 시작번호(자동): ${dutyStartIndex + 1}번
      `;
    }

    console.log("[당직생성 상세]", assigns);

    // ✅ (핵심) 생성 즉시 표로 보여주기
    renderDutyTable(assigns);

    // ✅ 생성 후 바로 설정 저장(순번 이어가기만 저장)
    saveConfig(true);
    alert("이번달 당직이 생성되었습니다. (표로 표시됨)");
  }

  // =====================================================
  // ✅ 설정 로딩/저장
  // =====================================================
  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/business-master/config`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.error("[출장업무관리] 설정 조회 실패 status =", res.status);
        return;
      }
      const data = (await res.json()) as any;

      const gasoline = data.fuel_price_gasoline ?? data.fuel_price_per_liter ?? null;
      const diesel = data.fuel_price_diesel ?? null;
      const lpg = data.fuel_price_lpg ?? null;

      if (inputFuelGasoline) inputFuelGasoline.value = gasoline?.toString() ?? "";
      if (inputFuelDiesel) inputFuelDiesel.value = diesel?.toString() ?? "";
      if (inputFuelGas) inputFuelGas.value = lpg?.toString() ?? "";

      if (inputUsd) inputUsd.value = data.exchange_rate_usd?.toString() ?? "";
      if (inputJpy) inputJpy.value = data.exchange_rate_jpy?.toString() ?? "";
      if (inputCny) inputCny.value = data.exchange_rate_cny?.toString() ?? "";

      if (textareaNotice) textareaNotice.value = data.notice ?? data.note ?? "";

      // ✅ duty_members_text 에 저장된 JSON 복원(순번)
      const rawDutyText = String(data.duty_members_text ?? "");
      if (rawDutyText) {
        try {
          const parsed = JSON.parse(rawDutyText);
          if (typeof parsed?.startIndex === "number") dutyStartIndex = parsed.startIndex;
        } catch {
          // 무시
        }
      }

      if (dutyResultBox) {
        dutyResultBox.textContent = "- '당직 생성'을 누르면 이번달이 자동 로테이션으로 채워집니다.";
      }

      // ✅ 초기에는 표 비워둠
      renderDutyTable([]);
    } catch (err) {
      console.error("[출장업무관리] 설정 조회 중 오류:", err);
    }
  }

  async function saveConfig(forceSilent: boolean = false) {
    const dutyStore = JSON.stringify({
      startIndex: dutyStartIndex,
      updatedAt: new Date().toISOString(),
    });

    const body: BusinessConfig = {
      fuel_price_gasoline: parseNumberOrNull(inputFuelGasoline?.value ?? ""),
      fuel_price_diesel: parseNumberOrNull(inputFuelDiesel?.value ?? ""),
      fuel_price_lpg: parseNumberOrNull(inputFuelGas?.value ?? ""),

      exchange_rate_usd: parseNumberOrNull(inputUsd?.value ?? ""),
      exchange_rate_jpy: parseNumberOrNull(inputJpy?.value ?? ""),
      exchange_rate_cny: parseNumberOrNull(inputCny?.value ?? ""),

      duty_members_text: dutyStore,
      notice: textareaNotice?.value ?? "",
    };

    try {
      const res = await fetch(`${API_BASE}/api/business-master/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.ok === false) {
        console.error("[출장업무관리] 설정 저장 실패 status =", res.status, json);
        if (!forceSilent) alert(json?.error || "설정 저장 중 오류가 발생했습니다.");
        return;
      }

      if (!forceSilent) alert("설정이 저장되었습니다.");
    } catch (err) {
      console.error("[출장업무관리] 설정 저장 중 오류:", err);
      if (!forceSilent) alert("설정 저장 중 오류가 발생했습니다.");
    }
  }

  // =====================================================
  // ✅ 거리 마스터 로딩/표시
  // =====================================================
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
        console.error("[출장업무관리] 거리 목록 조회 실패 status =", res.status);
        return;
      }

      const rows = await res.json();
      distanceRows = Array.isArray(rows) ? rows.map(mapRawDistance) : [];
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
        <td class="border-b px-2 py-2 text-center text-[11px]">${index + 1}</td>
        <td class="border-b px-2 py-2">
          <input type="text"
            class="w-full border rounded-xl px-2 py-2 text-xs region-input bg-white"
            value="${row.region ?? ""}" />
        </td>
        <td class="border-b px-2 py-2">
          <input type="text"
            class="w-full border rounded-xl px-2 py-2 text-xs client-input bg-white"
            value="${row.client_name ?? ""}" />
        </td>
        <td class="border-b px-2 py-2">
          <input type="number" step="0.1"
            class="w-full border rounded-xl px-2 py-2 text-right text-xs distance-km-input bg-white"
            placeholder="km"
            value="${row.distance_km ?? ""}" />
        </td>
        <td class="border-b px-2 py-2 text-center">
          <button type="button"
            class="px-2 py-1 text-[11px] rounded-lg bg-red-100 text-red-700 hover:bg-red-200 btn-row-delete">
            삭제
          </button>
        </td>
      `;

      distanceTbody.appendChild(tr);
    });
  }

  function syncDistanceFromTable() {
    const rows = distanceTbody.querySelectorAll<HTMLTableRowElement>("tr");
    rows.forEach((tr) => {
      const idxStr = tr.dataset.index;
      if (idxStr == null) return;
      const idx = Number(idxStr);
      const row = distanceRows[idx];
      if (!row) return;

      const regionInput = tr.querySelector<HTMLInputElement>(".region-input");
      const clientInput = tr.querySelector<HTMLInputElement>(".client-input");
      const distanceInput = tr.querySelector<HTMLInputElement>(".distance-km-input");

      row.region = regionInput?.value?.trim() ?? "";
      row.client_name = clientInput?.value?.trim() ?? "";
      row.distance_km = parseNumberOrNull(distanceInput?.value ?? "");
    });
  }

  async function saveDistances() {
    syncDistanceFromTable();

    for (const row of distanceRows) {
      if (!row.client_name || row.distance_km == null) {
        alert("거래처와 거리(km)는 반드시 입력해야 합니다.");
        return;
      }
    }

    try {
      // 1) 삭제
      for (const id of deletedIds) {
        if (!id) continue;
        const res = await fetch(`${API_BASE}/api/business-master/distances/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          console.error("[출장업무관리] 거리 삭제 실패 id=", id, "status=", res.status);
        }
      }
      deletedIds = [];

      // 2) 저장/수정
      for (const row of distanceRows) {
        const payload = {
          region: row.region,
          client_name: row.client_name,
          distance_km: row.distance_km,
        };

        if (row.id == null) {
          const res = await fetch(`${API_BASE}/api/business-master/distances`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            console.error("[출장업무관리] 거리 등록 실패 status=", res.status);
          }
        } else {
          const res = await fetch(`${API_BASE}/api/business-master/distances/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            console.error("[출장업무관리] 거리 수정 실패 id=", row.id, "status=", res.status);
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
      region: "",
      client_name: "",
      distance_km: null,
    });
    renderDistanceTable();
  }

  // =====================================================
  // 이벤트 바인딩
  // =====================================================
  btnConfigSave?.addEventListener("click", () => saveConfig(false));
  btnDistanceAddRow?.addEventListener("click", () => addEmptyRow());
  btnDistanceSave?.addEventListener("click", () => saveDistances());

  // 거리 삭제
  distanceTbody.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target?.classList.contains("btn-row-delete")) return;

    const tr = target.closest("tr") as HTMLTableRowElement | null;
    if (!tr) return;

    const idxStr = tr.dataset.index;
    if (idxStr == null) return;

    const idx = Number(idxStr);
    const row = distanceRows[idx];
    if (!row) return;

    if (row.id != null) deletedIds.push(row.id);
    distanceRows.splice(idx, 1);
    renderDistanceTable();
  });

  // ✅ 당직 후보 삭제(이벤트 위임)
  dutyTbody?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target?.classList.contains("btn-duty-delete")) return;

    const tr = target.closest("tr") as HTMLTableRowElement | null;
    if (!tr) return;

    const idx = Number(tr.dataset.idx);
    if (!Number.isFinite(idx)) return;

    dutyMembers.splice(idx, 1);

    if (dutyMembers.length === 0) dutyStartIndex = 0;
    else dutyStartIndex = dutyStartIndex % dutyMembers.length;

    renderDutyMembers();
  });

  // ✅ 당직 생성 버튼
  btnDutyGenerateThisMonth?.addEventListener("click", () => generateDutyForCurrentMonth());

  // =====================================================
  // 초기 로딩
  // =====================================================
  loadConfig().then(() => {
    loadDutyMembersFromUsers();
  });
  loadDistances();
}
