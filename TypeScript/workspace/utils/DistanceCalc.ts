// TypeScript/workspace/utils/DistanceCalc.ts

export type DistanceRow = {
  region?: string;
  client_name: string;

  // 사용자 거리(자택↔거래처)에서 주로 쓰는 필드
  home_distance_km?: number | null;

  // 회사 거리마스터(회사↔거래처)에서 흔히 쓰는 필드
  distance_km?: number | null;

  // 혹시 다른 이름으로 내려오면 대비
  km?: number | null;

  travel_time_text?: string;
};

export type PlaceType = "company" | "home";

export const DEFAULT_FUEL_PRICE_PER_KM = 200;

function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

/** ✅ "회사/자택/company/home" 혼용값을 계산용 표준값으로 정리 */
export function normalizePlace(v: any): PlaceType | null {
  const s = norm(v);

  if (!s) return null;

  // 한글/영문 다 대응
  if (s === "company" || s === "회사") return "company";
  if (s === "home" || s === "자택") return "home";

  return null; // 기타 텍스트는 계산에 사용하지 않음
}

/** ✅ 숫자 안전 변환 */
function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** ✅ 거래처명으로 거리 row 찾기 (대소문자/공백 무시) */
function findRow(list: DistanceRow[], clientName: string): DistanceRow | undefined {
  const key = norm(clientName);
  return list.find((x) => norm(x.client_name) === key);
}

/** ✅ 회사거리 / 자택거리 각각 읽기 (필드명 달라도 최대한 읽어줌) */
export function findKmHome(list: DistanceRow[], clientName: string): number {
  const row = findRow(list, clientName);
  // 사용자 거리: home_distance_km 우선
  return toNum(row?.home_distance_km ?? row?.distance_km ?? row?.km);
}

export function findKmCompany(list: DistanceRow[], clientName: string): number {
  const row = findRow(list, clientName);
  // 회사 거리: distance_km 우선
  return toNum(row?.distance_km ?? row?.home_distance_km ?? row?.km);
}

/**
 * ✅ 개인차량일 때만 유류비 거리(km) 계산
 * - 출발/복귀가 회사/자택이면 케이스별 합산
 * - 기타 텍스트 출발지/복귀지는 계산 불가 -> 0
 */
export function calcFuelKmByCase(opts: {
  depart_place: any; // 들어오는 값은 혼용될 수 있음
  return_place: any;
  destination: string;
  vehicle: "personal" | "corp" | "other" | "public";
  companyDistances: DistanceRow[];
  userDistances: DistanceRow[];
}) {
  const { depart_place, return_place, destination, vehicle, companyDistances, userDistances } = opts;

  if (vehicle !== "personal") return 0;

  const depart = normalizePlace(depart_place);
  const ret = normalizePlace(return_place);

  // 회사/자택이 아니면 거리 계산 불가(기타 텍스트)
  if (!depart || !ret) return 0;

  const companyKm = findKmCompany(companyDistances, destination);
  const homeKm = findKmHome(userDistances, destination);

  // 자택->출장지->자택
  if (depart === "home" && ret === "home") return homeKm * 2;

  // 회사->출장지->회사
  if (depart === "company" && ret === "company") return companyKm * 2;

  // 회사->출장지->자택
  if (depart === "company" && ret === "home") return companyKm + homeKm;

  // 자택->출장지->회사
  if (depart === "home" && ret === "company") return homeKm + companyKm;

  return 0;
}

export function calcFuelAmount(totalKm: number, pricePerKm = DEFAULT_FUEL_PRICE_PER_KM) {
  return Math.round(totalKm * pricePerKm);
}

/** ✅ 화면 표시용 한글 변환 */
export function placeLabel(v: any): string {
  const p = normalizePlace(v);
  if (p === "company") return "회사";
  if (p === "home") return "자택";
  // 기타 텍스트면 그 텍스트 자체를 보여줌
  return String(v ?? "").trim();
}
