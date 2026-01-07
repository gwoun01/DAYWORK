// TypeScript/workspace/utils/DistanceCalc.ts

export type DistanceRow = {
  region?: string;
  client_name: string;
  home_distance_km: number | null;
  travel_time_text?: string;
};

export type PlaceType = "company" | "home";

export const DEFAULT_FUEL_PRICE_PER_KM = 200;

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

export function findKm(list: DistanceRow[], clientName: string): number {
  const key = norm(clientName);
  const row = list.find((x) => norm(x.client_name) === key);
  return Number(row?.home_distance_km) || 0;
}

export function calcFuelKmByCase(opts: {
  depart_place: PlaceType;
  return_place: PlaceType;
  destination: string;
  vehicle: "personal" | "corp" | "other" | "public";
  companyDistances: DistanceRow[];
  userDistances: DistanceRow[];
}) {
  const {
    depart_place,
    return_place,
    destination,
    vehicle,
    companyDistances,
    userDistances,
  } = opts;

  if (vehicle !== "personal") return 0;

  const companyKm = findKm(companyDistances, destination);
  const homeKm = findKm(userDistances, destination);

  // ✅ 자택->출장지->자택 (가장 흔함)
  if (depart_place === "home" && return_place === "home") {
    return homeKm * 2;
  }

  // 회사->출장지->회사
  if (depart_place === "company" && return_place === "company") {
    return companyKm * 2;
  }

  // 회사->출장지->자택
  if (depart_place === "company" && return_place === "home") {
    return companyKm + homeKm;
  }

  // 자택->출장지->회사
  if (depart_place === "home" && return_place === "company") {
    return homeKm + companyKm;
  }

  return 0;
}

export function calcFuelAmount(
  totalKm: number,
  pricePerKm = DEFAULT_FUEL_PRICE_PER_KM
) {
  return Math.round(totalKm * pricePerKm);
}
