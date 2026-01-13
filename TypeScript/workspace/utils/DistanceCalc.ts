// TypeScript/workspace/utils/DistanceCalc.ts
// ✅ 교체본: 유류비 = (총km / 연비(km/L)) * 유종단가(원/L)
// - 디버그 로그 포함(원인 추적용)
// - 기존 거리 계산(calcFuelKmByCase)은 유지
// - 기존 calcFuelAmount(totalKm, pricePerKm) 호출도 안깨지게 호환 유지(구식 방식은 그대로 동작)

export type DistanceRow = {
  region?: string;
  client_name: string;

  // 사용자 거리(자택↔거래처)
  home_distance_km?: number | null;

  // 회사 거리(회사↔거래처)
  distance_km?: number | null;

  // 예외 대비
  km?: number | null;

  travel_time_text?: string;
};

export type PlaceType = "company" | "home";

// ✅ (구식) km당 단가 방식 호환용 (예전 코드 깨지지 않게 유지)
export const DEFAULT_FUEL_PRICE_PER_KM = 200;

function norm(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** ✅ "회사/자택/company/home" 혼용값을 계산용 표준값으로 정리 */
export function normalizePlace(v: any): PlaceType | null {
  const s = norm(v);
  if (!s) return null;

  if (s === "company" || s === "회사") return "company";
  if (s === "home" || s === "자택") return "home";

  return null;
}

/** ✅ 화면 표시용 */
export function placeLabel(v: any): string {
  const p = normalizePlace(v);
  if (p === "company") return "회사";
  if (p === "home") return "자택";
  return String(v ?? "").trim();
}

/** ✅ 거래처명으로 row 찾기 (대소문자/공백 무시) */
function findRow(list: DistanceRow[], clientName: string): DistanceRow | undefined {
  const key = norm(clientName);
  return list.find((x) => norm(x.client_name) === key);
}

/** ✅ 사용자(자택) 거리 읽기: home_distance_km 우선 */
export function findKmHome(list: DistanceRow[], clientName: string): number {
  const row = findRow(list, clientName);
  return toNum(row?.home_distance_km ?? row?.distance_km ?? row?.km);
}

/** ✅ 회사 거리 읽기: distance_km 우선 */
export function findKmCompany(list: DistanceRow[], clientName: string): number {
  const row = findRow(list, clientName);
  return toNum(row?.distance_km ?? row?.home_distance_km ?? row?.km);
}

/**
 * ✅ 개인차량일 때만 유류비 거리(km) 계산
 * - 출발/복귀가 회사/자택이면 케이스별 합산
 * - 기타 텍스트 출발지/복귀지는 계산 불가 -> 0
 */
export function calcFuelKmByCase(opts: {
  depart_place: any;
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

  if (!depart || !ret) return 0;

  const companyKm = findKmCompany(companyDistances, destination);
  const homeKm = findKmHome(userDistances, destination);

  if (depart === "home" && ret === "home") return homeKm * 2;
  if (depart === "company" && ret === "company") return companyKm * 2;
  if (depart === "company" && ret === "home") return companyKm + homeKm;
  if (depart === "home" && ret === "company") return homeKm + companyKm;

  return 0;
}

// =====================================================
// ✅✅✅ NEW: 리터당 방식 유류비 계산 (너가 원하는 공식)
//   유류비(원) = round( (총km / 연비(km/L)) * 유종단가(원/L) )
// =====================================================

export type FuelTypeKor = "휘발유" | "경유" | "lpg" | "LPG" | "가스" | "기타";

/** ✅ 숫자 방어 (0/NaN 방지) */
function safePositive(v: any, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * ✅ 너 공식대로 계산
 * @param totalKm 총 주행거리(km)
 * @param kmPerLiter 연비(km/L) - 예: 7
 * @param pricePerLiter 유종단가(원/L) - 예: 1000
 */
export function calcFuelAmountByLiter(totalKm: number, kmPerLiter: number, pricePerLiter: number) {
  const km = safePositive(totalKm, 0);
  const eff = safePositive(kmPerLiter, 7); // 기본 7
  const ppl = safePositive(pricePerLiter, 0);

  if (km <= 0 || ppl <= 0) return 0;

  const liters = km / eff;
  const amount = Math.round(liters * ppl);

  console.log("[FUEL DEBUG][LITER]", {
    totalKm: km,
    kmPerLiter: eff,
    pricePerLiter: ppl,
    liters,
    amount,
  });

  return amount;
}

/**
 * ✅ 설정(유종별 단가)에서 유저 유종(fuel_type)으로 가격 선택
 * - cfgFuel: { gasoline, diesel, lpg } 형태면 그대로 넣으면 됨
 */
export function pickFuelPricePerLiterByType(
  fuelTypeRaw: any,
  cfgFuel: {
    gasoline?: number | null; // 휘발유
    diesel?: number | null; // 경유
    lpg?: number | null; // LPG
  }
) {
  const t = String(fuelTypeRaw ?? "").trim().toLowerCase();

  // 한글/영문 혼용 방어
  const isGasoline = t === "휘발유" || t === "gasoline" || t === "gas" || t === "petrol";
  const isDiesel = t === "경유" || t === "diesel";
  const isLpg = t === "lpg" || t === "가스" || t === "엘피지" || t === "lpg(가스)";

  const g = cfgFuel.gasoline ?? null;
  const d = cfgFuel.diesel ?? null;
  const l = cfgFuel.lpg ?? null;

  let picked: number | null = null;

  if (isGasoline) picked = g;
  else if (isDiesel) picked = d;
  else if (isLpg) picked = l;
  else picked = g ?? d ?? l ?? null; // 모르겠으면 있는 값 중 하나

  const price = Number(picked);
  const out = Number.isFinite(price) && price > 0 ? price : 0;

  console.log("[FUEL DEBUG][PICK]", { fuelTypeRaw, picked: out, cfgFuel });

  return out;
}

/**
 * ✅ NEW: (거리계산 + 너 공식)까지 한번에
 * - totalKm은 calcFuelKmByCase로 먼저 구하고,
 * - fuel_type + 설정단가 + 연비로 유류비를 계산한다.
 */
export function calcFuelAmountByCaseWithLiter(opts: {
  depart_place: any;
  return_place: any;
  destination: string;
  vehicle: "personal" | "corp" | "other" | "public";

  companyDistances: DistanceRow[];
  userDistances: DistanceRow[];

  // ✅ 유저 유종(사용자 관리에서 저장된 값)
  fuel_type: any; // "휘발유" | "경유" | "LPG" ...

  // ✅ 설정값
  km_per_liter: number; // 예: 7
  fuel_price_gasoline: number; // 원/L
  fuel_price_diesel: number; // 원/L
  fuel_price_lpg: number; // 원/L
}) {
  const totalKm = calcFuelKmByCase({
    depart_place: opts.depart_place,
    return_place: opts.return_place,
    destination: opts.destination,
    vehicle: opts.vehicle,
    companyDistances: opts.companyDistances,
    userDistances: opts.userDistances,
  });

  const pricePerLiter = pickFuelPricePerLiterByType(opts.fuel_type, {
    gasoline: opts.fuel_price_gasoline,
    diesel: opts.fuel_price_diesel,
    lpg: opts.fuel_price_lpg,
  });

  const amount = calcFuelAmountByLiter(totalKm, opts.km_per_liter, pricePerLiter);

  console.log("[FUEL DEBUG][CASE+LITER]", {
    destination: opts.destination,
    depart_place: opts.depart_place,
    return_place: opts.return_place,
    vehicle: opts.vehicle,
    fuel_type: opts.fuel_type,
    totalKm,
    km_per_liter: opts.km_per_liter,
    pricePerLiter,
    amount,
  });

  return { totalKm, amount, pricePerLiter };
}

// =====================================================
// ✅ 호환 유지: 예전 코드가 calcFuelAmount(km, pricePerKm) 쓰면 그대로 동작
// =====================================================
export function calcFuelAmount(totalKm: number, pricePerKm = DEFAULT_FUEL_PRICE_PER_KM) {
  console.log("[FUEL DEBUG][PER_KM]", { totalKm, pricePerKm });
  return Math.round(safePositive(totalKm, 0) * safePositive(pricePerKm, DEFAULT_FUEL_PRICE_PER_KM));
}