// 04_user-manage.ts

// ✅ 사용자별 거래처 거리 한 행 타입
type UserDistanceRow = {
  region: string;            // 지역
  client_name: string;       // 거래처
  travel_time_text: string;  // 소요시간 텍스트
  home_distance_km: number | null; // 자택 → 출장지 (km)
  fuel_type: string;         // 유종
};

// ✅ 사용자 타입
type InnomaxUser = {
  no: number;
  id: string;
  name: string;
  email: string | null;
  company_part: string | null;
  address: string | null;
  permissions: Record<string, string> | null;
  distance_detail: UserDistanceRow[];
};

const PERM_KEYS = ["출장승인", "출장내역관리", "출장등록", "출장내역", "사용자관리"];

/** 문자열 → number | null 공통 함수 */
function parseNumberOrNull(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 서버에서 온 row(any 형태)를 InnomaxUser 로 변환 */
function mapRawUser(row: any): InnomaxUser {
  // distance_detail_json 파싱
  let distanceArr: UserDistanceRow[] = [];
  const rawDistance = row.distance_detail_json ?? null;
  if (rawDistance) {
    let parsed: any = rawDistance;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = [];
      }
    }
    if (Array.isArray(parsed)) {
      distanceArr = parsed.map(
        (r: any): UserDistanceRow => ({
          region: String(r.region ?? ""),
          client_name: String(r.client_name ?? ""),
          travel_time_text: String(r.travel_time_text ?? ""),
          // 예전 구조도 최대한 따라와서 km 필드로 변환
          home_distance_km:
            r.home_distance_km != null
              ? Number(r.home_distance_km)
              : r.distance_km != null
              ? Number(r.distance_km)
              : r.home_distance_min != null
              ? Number(r.home_distance_min)
              : null,
          fuel_type: String(r.fuel_type ?? ""),
        })
      );
    }
  }

  // permissions: jsonb / text / null 어떤 형태로 와도 처리
  let perms: Record<string, string> | null = null;
  let rawPerms = row.permissions ?? null;
  if (rawPerms) {
    if (typeof rawPerms === "string") {
      try {
        rawPerms = JSON.parse(rawPerms);
      } catch {
        rawPerms = null;
      }
    }
    if (rawPerms && typeof rawPerms === "object" && !Array.isArray(rawPerms)) {
      perms = rawPerms as Record<string, string>;
    }
  }

  return {
    no: Number(row.no ?? row.No ?? 0),
    id: String(row.id ?? row.ID ?? ""),
    name: String(row.name ?? row.Name ?? ""),
    email: row.email ?? null,
    company_part: row.company_part ?? null,
    address: row.address ?? null,
    permissions: perms,
    distance_detail: distanceArr,
  };
}

/** 폼의 permission select 값들 → 객체로 모으기 */
function collectPermissionsFromForm(): Record<string, string> {
  const perms: Record<string, string> = {};
  PERM_KEYS.forEach((key) => {
    const el = document.getElementById(key) as HTMLSelectElement | null;
    if (el) perms[key] = el.value;
  });
  return perms;
}

/** 폼 select 들을 주어진 permission 값으로 채우기 */
function fillPermissionSelects(perms: any) {
  PERM_KEYS.forEach((key) => {
    const el = document.getElementById(key) as HTMLSelectElement | null;
    if (!el) return;
    const v = perms?.[key];
    if (v) el.value = v;
    else el.value = "None"; // 기본값
  });
}

/** 👁 버튼용 비밀번호 표시/숨기기 */
function togglePassword() {
  const input = document.getElementById("modalPassword") as HTMLInputElement | null;
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}
// HTML에서 onclick="togglePassword()" 쓸 수 있게 전역에 올리기
(window as any).togglePassword = togglePassword;

export function initUserManagePanel(API_BASE: string) {
  console.log("[사용자관리] initUserManagePanel 시작");

  const tbodyEl = document.getElementById("userTableBody");
  const userModal = document.getElementById("userModal") as HTMLDivElement | null;
  const userForm = document.getElementById("userForm") as HTMLFormElement | null;

  const modalTitle = document.getElementById("modalTitle") as HTMLHeadingElement | null;
  const modalMode = document.getElementById("modalMode") as HTMLInputElement | null; // add / edit
  const modalNo = document.getElementById("modalNo") as HTMLInputElement | null;

  const inputName = document.getElementById("modalName") as HTMLInputElement | null;
  const inputID = document.getElementById("modalID") as HTMLInputElement | null;
  const inputPassword = document.getElementById("modalPassword") as HTMLInputElement | null;
  const inputEmail = document.getElementById("modalEmail") as HTMLInputElement | null;
  const inputCompany = document.getElementById("modalCompanyPart") as HTMLInputElement | null;
  const inputAddress = document.getElementById("modalAddress") as HTMLInputElement | null;

  const btnAdd = document.getElementById("userAddBtn") as HTMLButtonElement | null;
  const btnModalClose = document.getElementById(
    "userModalCancelBtn"
  ) as HTMLButtonElement | null; // 모달 안 "취소" 버튼

  // 🔹 거리표 관련 DOM
  const distanceTbodyEl = document.getElementById(
    "userDistanceTbody"
  ) as HTMLTableSectionElement | null;
  const btnDistanceAddRow = document.getElementById(
    "btnUserDistanceAddRow"
  ) as HTMLButtonElement | null;

  // 필수 DOM 없으면 초기화 스킵
  if (!tbodyEl || !userModal || !userForm) {
    console.warn(
      "[사용자관리] 필수 DOM 요소를 찾지 못했습니다. (tbodyEl, userModal, userForm 중 하나 없음)"
    );
    return;
  }

  const tbody = tbodyEl as HTMLTableSectionElement;
  const distanceTbody = distanceTbodyEl as HTMLTableSectionElement | null;

  // 이미 초기화된 경우 또 하지 않기 (사이드바 이동 시 중복 방지)
  if ((tbody as any)._bound) {
    console.debug("[사용자관리] 이미 초기화된 상태이므로 다시 바인딩하지 않음");
    return;
  }
  (tbody as any)._bound = true;

  // 🔹 현재 모달에서 편집 중인 거리 배열
  let distanceRows: UserDistanceRow[] = [];

  // 🔹 거래처 마스터에서 가져온 client 리스트
  type MasterClient = {
    region: string;
    client_name: string;
    travel_time_text: string;
  };
  let masterClients: MasterClient[] = [];

  // ================== 거래처 마스터 로딩 ==================
  async function loadMasterClients() {
    try {
      const res = await fetch(`${API_BASE}/api/business-master/client-list`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.error(
          "[사용자관리] 거래처 마스터 조회 실패 status =",
          res.status
        );
        return;
      }

      const rows = (await res.json()) as any[];

      masterClients = rows
        .map((r) => ({
          region: String(r.region ?? ""),
          client_name: String(r.client_name ?? "").trim(),
          travel_time_text: String(r.travel_time_text ?? ""),
        }))
        .filter((c) => c.client_name) // 이름 없는 건 제외
        .sort((a, b) => a.client_name.localeCompare(b.client_name, "ko"));

      console.log(
        "[사용자관리] 거래처 마스터 로딩 완료, 개수 =",
        masterClients.length
      );
    } catch (err) {
      console.error("[사용자관리] 거래처 마스터 로딩 중 오류:", err);
    }
  }

  // ============= 거리표 렌더링/수집 함수들 =============

  /** 거리표 렌더링 */
  function renderDistanceTable() {
    if (!distanceTbody) return;

    distanceTbody.innerHTML = "";

    if (!distanceRows.length) {
      distanceTbody.innerHTML = `
        <tr>
          <td colspan="6" class="border px-2 py-1 text-center text-[11px] text-gray-400">
            등록된 거리 정보가 없습니다. [+ 거리 행 추가] 버튼으로 추가하세요.
          </td>
        </tr>
      `;
      return;
    }

    distanceRows.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = String(index);

      tr.innerHTML = `
        <td class="border px-1 py-1 text-center text-[11px]">${index + 1}</td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-[11px] region-input"
            value="${row.region ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-[11px] client-input"
            value="${row.client_name ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-[11px] travel-time-input"
            placeholder="예: 1시간8분"
            value="${row.travel_time_text ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="number"
            step="0.1"
            class="w-full border rounded px-1 py-[2px] text-right text-[11px] home-km-input"
            placeholder="자택→출장지 km"
            value="${row.home_distance_km ?? ""}"
          />
        </td>
        <td class="border px-1 py-1">
          <input
            type="text"
            class="w-full border rounded px-1 py-[2px] text-[11px] fuel-input"
            placeholder="예: 휘발유"
            value="${row.fuel_type ?? ""}"
          />
        </td>
      `;

      distanceTbody.appendChild(tr);
    });
  }

  /** 테이블 DOM → distanceRows 배열로 반영 */
  function syncDistanceRowsFromTable() {
    if (!distanceTbody) return;

    const trs = distanceTbody.querySelectorAll<HTMLTableRowElement>("tr");
    const newRows: UserDistanceRow[] = [];
    trs.forEach((tr) => {
      const regionInput = tr.querySelector<HTMLInputElement>(".region-input");
      const clientInput = tr.querySelector<HTMLInputElement>(".client-input");
      const travelTimeInput =
        tr.querySelector<HTMLInputElement>(".travel-time-input");
      const homeKmInput =
        tr.querySelector<HTMLInputElement>(".home-km-input");
      const fuelInput =
        tr.querySelector<HTMLInputElement>(".fuel-input");

      // 안내문 행은 input이 없으니 스킵
      if (!clientInput) return;

      const clientName = clientInput.value.trim();
      const homeKm = parseNumberOrNull(homeKmInput?.value ?? "");

      // 거래처 + 자택거리 둘 다 없으면 완전 빈줄로 보고 스킵
      if (!clientName && homeKm == null) return;

      newRows.push({
        region: regionInput?.value.trim() ?? "",
        client_name: clientName,
        travel_time_text: travelTimeInput?.value.trim() ?? "",
        home_distance_km: homeKm,
        fuel_type: fuelInput?.value.trim() ?? "",
      });
    });

    distanceRows = newRows;
  }

  /** 빈 행 하나 추가 */
  function addDistanceEmptyRow() {
    distanceRows.push({
      region: "",
      client_name: "",
      travel_time_text: "",
      home_distance_km: null,
      fuel_type: "",
    });
    renderDistanceTable();
  }

  /** 모달 열기 */
  function openModal(mode: "add" | "edit", user?: InnomaxUser) {
    if (!userModal || !modalMode || !modalTitle) return;

    modalMode.value = mode;
    if (mode === "add") {
      modalTitle.textContent = "사용자 추가";
      if (modalNo) modalNo.value = "";
      if (inputID) inputID.value = "";
      if (inputName) inputName.value = "";
      if (inputPassword) inputPassword.value = "";
      if (inputEmail) inputEmail.value = "";
      if (inputCompany) inputCompany.value = "이노맥스";
      if (inputAddress) inputAddress.value = "";
      fillPermissionSelects(null);

      // 🔹 거래처 마스터 기준으로 기본 행 생성
      distanceRows =
        masterClients.length > 0
          ? masterClients.map((c) => ({
              region: c.region,
              client_name: c.client_name,
              travel_time_text: c.travel_time_text,
              home_distance_km: null,
              fuel_type: "",
            }))
          : [];
    } else {
      modalTitle.textContent = "사용자 수정";
      if (user && modalNo) modalNo.value = String(user.no);
      if (inputID) inputID.value = user?.id ?? "";
      if (inputName) inputName.value = user?.name ?? "";
      if (inputPassword) inputPassword.value = ""; // 수정 시에만 입력
      if (inputEmail) inputEmail.value = user?.email ?? "";
      if (inputCompany) inputCompany.value = user?.company_part ?? "이노맥스";
      if (inputAddress) inputAddress.value = user?.address ?? "";

      fillPermissionSelects(user?.permissions ?? {});
      // 기존에 저장된 거리 정보가 있으면 그걸 사용, 없으면 마스터 기준
      distanceRows =
        user?.distance_detail && user.distance_detail.length
          ? user.distance_detail
          : masterClients.map((c) => ({
              region: c.region,
              client_name: c.client_name,
              travel_time_text: c.travel_time_text,
              home_distance_km: null,
              fuel_type: "",
            }));
    }

    renderDistanceTable();
    userModal.classList.remove("hidden");
  }

  /** 모달 닫기 */
  function closeModal() {
    if (!userModal) return;
    userModal.classList.add("hidden");
  }

  // 모달 "취소" 버튼
  btnModalClose?.addEventListener("click", () => {
    closeModal();
  });

  // 상단 "사용자 추가" 버튼
  console.log("[사용자관리] userAddBtn =", btnAdd);
  btnAdd?.addEventListener("click", () => {
    console.log("[사용자관리] 추가 버튼 클릭");
    openModal("add");
  });

  /** 사용자 목록 다시 로딩 */
  async function loadUsers() {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-3 py-2 text-center text-xs text-gray-400">
          사용자 목록 로딩 중...
        </td>
      </tr>
    `;

    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`status = ${res.status}`);
      }
      const rows = await res.json();
      console.log("[사용자관리] 서버 응답 =", rows);

      const users: InnomaxUser[] = Array.isArray(rows)
        ? rows.map(mapRawUser)
        : [];

      if (!users.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="px-3 py-2 text-center text-xs text-gray-400">
              등록된 사용자가 없습니다.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = "";

      users.forEach((u, idx) => {
        const tr = document.createElement("tr");
        tr.className = "divide-y divide-gray-200 text-xs";

        // 권한 텍스트 만들기
        let permText = "권한없음";
        if (u.permissions) {
          const parts = Object.entries(u.permissions).map(
            ([k, v]) => `${k}:${v}`
          );
          permText = parts.join(", ");
        }

        tr.innerHTML = `
          <td class="px-3 py-2">${idx + 1}</td>
          <td class="px-3 py-2">${u.name}</td>
          <td class="px-3 py-2">${u.id}</td>
          <td class="px-3 py-2">****</td>
          <td class="px-3 py-2">${u.email ?? ""}</td>
          <td class="px-3 py-2">${u.company_part ?? ""}</td>
          <td class="px-3 py-2 text-center">${permText}</td>
          <td class="px-3 py-2 text-center space-x-1">
            <button 
              class="px-2 py-1 rounded bg-indigo-500 text-white text-[11px] btn-edit-user"
              data-no="${u.no}">
              수정
            </button>
            <button 
              class="px-2 py-1 rounded bg-red-500 text-white text-[11px] btn-del-user"
              data-no="${u.no}">
              삭제
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("[사용자관리] 목록 로딩 실패:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-3 py-2 text-center text-xs text-red-500">
            목록 로딩 중 오류가 발생했습니다.
          </td>
        </tr>
      `;
    }
  }

  /** 테이블에서 수정/삭제 버튼 클릭 처리 (이벤트 위임) */
  tbody.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // 수정 버튼
    if (target.classList.contains("btn-edit-user")) {
      const no = target.dataset.no;
      if (!no) return;

      try {
        const res = await fetch(`${API_BASE}/api/users/${no}`, {
          credentials: "include",
        });
        if (!res.ok) {
          alert("사용자 정보를 불러올 수 없습니다.");
          return;
        }
        const raw = await res.json();
        const user = mapRawUser(raw);
        openModal("edit", user);
      } catch (err) {
        console.error("[사용자관리] 단일 조회 실패:", err);
      }
    }

    // 삭제 버튼
    if (target.classList.contains("btn-del-user")) {
      const no = target.dataset.no;
      if (!no) return;
      if (!confirm("정말 이 사용자를 삭제하시겠습니까?")) return;

      try {
        const res = await fetch(`${API_BASE}/api/users/${no}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          alert("삭제 실패");
          return;
        }
        await loadUsers();
      } catch (err) {
        console.error("[사용자관리] 삭제 실패:", err);
        alert("삭제 중 오류가 발생했습니다.");
      }
    }
  });

  /** 모달 안의 form submit → 추가 또는 수정 */
  userForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const mode = modalMode?.value === "edit" ? "edit" : "add";
    const no = modalNo?.value;

    const id = inputID?.value.trim() ?? "";
    const name = inputName?.value.trim() ?? "";
    const password = inputPassword?.value.trim() ?? "";
    const email = inputEmail?.value.trim() || null;
    const company_part = inputCompany?.value.trim() || null;
    const address = inputAddress?.value.trim() || null;
    const permissions = collectPermissionsFromForm();

    // 🔹 거리표 최신값을 distanceRows에 반영
    syncDistanceRowsFromTable();

    if (!id || !name || (mode === "add" && !password)) {
      alert("ID, 이름, 비밀번호(추가 시)는 필수입니다.");
      return;
    }

    try {
      if (mode === "add") {
        const res = await fetch(`${API_BASE}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // 백엔드가 기대하는 필드명
            Name: name,
            ID: id,
            password,
            email,
            company_part,
            permissions,
            address,
            distance_detail: distanceRows,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) {
          alert(json.error || "사용자 추가 실패");
          return;
        }
      } else {
        if (!no) {
          alert("수정 대상 사용자를 찾을 수 없습니다.");
          return;
        }
        const payload: any = {
          Name: name,
          ID: id,
          email,
          company_part,
          permissions,
          address,
          distance_detail: distanceRows,
        };
        if (password) payload.password = password; // 비밀번호 입력했을 때만 변경

        const res = await fetch(`${API_BASE}/api/users/${no}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) {
          alert(json.error || "사용자 수정 실패");
          return;
        }
      }

      closeModal();
      await loadUsers();
    } catch (err) {
      console.error("[사용자관리] 저장 실패:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  });

  // [+ 거리 행 추가] 버튼
  btnDistanceAddRow?.addEventListener("click", () => {
    addDistanceEmptyRow();
  });

  // 초기 데이터 로딩
  loadMasterClients().then(() => {
    loadUsers();
  });
}
