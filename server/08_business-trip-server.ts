// src/routers/businessTripRouter.ts
import express from "express";
import type { Pool } from "pg";

// ===================== 금액 계산 유틸 =====================
const MEAL_UNIT = 12000; // 1인당 식대 (개인 부담)

// ✅ 기본값(설정 못 불러오면 fallback)
const DEFAULT_KM_PER_LITER = 7; // 연비 7km/L
const DEFAULT_FUEL_PRICE = 1000; // 1L당 1000원

type MealCalcResult = { count: number; amount: number };
type FuelCalcResult = { distanceKm: number; amount: number; debug: any };

type PlaceType = "company" | "home";
type VehicleType = "corp" | "personal" | "other" | "public";

function norm(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

/** ✅ vehicle 값을 서버 표준 코드로 통일 */
function normalizeVehicle(v: any): VehicleType {
  const s = norm(v);
  if (s === "personal" || s === "개인") return "personal";
  if (s === "corp" || s === "corporate" || s === "법인" || s === "회사") return "corp";
  if (s === "public" || s === "대중교통") return "public";
  if (s === "other" || s === "other_personal" || s === "기타") return "other";
  return "other";
}

/** ✅ 출발/복귀지 값을 company/home 로만 판별 (기타는 null) */
function normalizePlace(v: any): PlaceType | null {
  const s = norm(v);
  if (!s) return null;

  if (s === "home" || s === "자택") return "home";
  if (s === "company" || s === "회사") return "company";

  return null; // 기타 텍스트면 계산 불가
}

// 🍱 식대 계산 (개인 부담만)
function calcMealAmount(meals: any | undefined | null): MealCalcResult {
  if (!meals) return { count: 0, amount: 0 };

  const list = [meals.breakfast, meals.lunch, meals.dinner];
  let count = 0;

  for (const m of list) {
    if (!m) continue;
    if (!m.checked) continue;
    if (m.owner !== "personal") continue; // 법인/회사면 0원
    count += 1;
  }

  return { count, amount: count * MEAL_UNIT };
}

function toNumberOrNull(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * ✅ Business Master 설정(config_json)에서 유류 단가 + 연비 읽기
 * - 너의 05_business-master.ts에서 저장하는 config endpoint(/api/business-master/config)와 같은 테이블/값을 사용해야 함
 * - 여기서는 "business_trip_config" 테이블에서 가져온다고 가정 (너 백엔드 구조에 맞춰 둠)
 *
 * ✅ 지원 키(유연하게):
 * - fuel_price_gasoline / fuel_price_diesel / fuel_price_lpg
 * - fuel_km_per_liter (또는 km_per_liter, fuel_efficiency, fuel_kmpl 등 아무거나 들어와도 최대한 읽음)
 */
async function getFuelSettings(pool: Pool): Promise<{
  priceGasoline: number;
  priceDiesel: number;
  priceLpg: number;
  kmPerLiter: number;
}> {
  // ✅ 1순위: business_trip_settings (네 스샷의 테이블)
  try {
    const r = await pool.query(`
      SELECT
        km_per_liter,
        fuel_price_gasoline,
        fuel_price_diesel,
        fuel_price_lpg
      FROM business_trip_settings
      WHERE id = 1
      LIMIT 1
    `);

    const row = r.rows?.[0] ?? {};

    const kmPerLiter = toNumberOrNull(row.km_per_liter) ?? DEFAULT_KM_PER_LITER;
    const safeKmPerLiter = kmPerLiter > 0 && kmPerLiter < 1000 ? kmPerLiter : DEFAULT_KM_PER_LITER;

    const priceGasoline = toNumberOrNull(row.fuel_price_gasoline) ?? DEFAULT_FUEL_PRICE;
    const priceDiesel = toNumberOrNull(row.fuel_price_diesel) ?? DEFAULT_FUEL_PRICE;
    const priceLpg = toNumberOrNull(row.fuel_price_lpg) ?? DEFAULT_FUEL_PRICE;

    return {
      priceGasoline,
      priceDiesel,
      priceLpg,
      kmPerLiter: safeKmPerLiter,
    };
  } catch (e) {
    // 아래 fallback으로 진행
  }

  // ✅ 2순위 fallback: business_trip_config.config_json (혹시 남아있을 때)
  try {
    const r = await pool.query(`
      SELECT config_json
      FROM business_trip_config
      WHERE id = 1
      LIMIT 1
    `);

    const cfg = r.rows?.[0]?.config_json ?? {};

    const priceGasoline =
      toNumberOrNull(cfg.fuel_price_gasoline) ??
      toNumberOrNull(cfg.gasoline_price) ??
      DEFAULT_FUEL_PRICE;

    const priceDiesel =
      toNumberOrNull(cfg.fuel_price_diesel) ??
      toNumberOrNull(cfg.diesel_price) ??
      DEFAULT_FUEL_PRICE;

    const priceLpg =
      toNumberOrNull(cfg.fuel_price_lpg) ??
      toNumberOrNull(cfg.lpg_price) ??
      DEFAULT_FUEL_PRICE;

    const kmPerLiter =
      toNumberOrNull(cfg.km_per_liter) ??              // ✅ 네 JSON에 이 키가 있음
      toNumberOrNull(cfg.fuel_km_per_liter) ??
      toNumberOrNull(cfg.km_per_liter) ??
      toNumberOrNull(cfg.fuel_efficiency) ??
      toNumberOrNull(cfg.fuel_kmpl) ??
      DEFAULT_KM_PER_LITER;

    const safeKmPerLiter =
      kmPerLiter > 0 && kmPerLiter < 1000 ? kmPerLiter : DEFAULT_KM_PER_LITER;

    return {
      priceGasoline,
      priceDiesel,
      priceLpg,
      kmPerLiter: safeKmPerLiter,
    };
  } catch {
    return {
      priceGasoline: DEFAULT_FUEL_PRICE,
      priceDiesel: DEFAULT_FUEL_PRICE,
      priceLpg: DEFAULT_FUEL_PRICE,
      kmPerLiter: DEFAULT_KM_PER_LITER,
    };
  }
}

/**
 * ✅ 사용자 유종(휘발유/경유/LPG) 읽기
 * - innomax_users.fuel_type 컬럼을 사용한다고 너가 스샷으로 보여줌
 */
async function getUserFuelType(pool: Pool, userName: string): Promise<"gasoline" | "diesel" | "lpg" | "unknown"> {
  const u = String(userName ?? "").trim();
  if (!u) return "unknown";

  try {
    const r = await pool.query(
      `
      SELECT fuel_type
      FROM innomax_users
      WHERE name = $1
      LIMIT 1
      `,
      [u]
    );

    const raw = String(r.rows?.[0]?.fuel_type ?? "").trim();

    // 한국어/영문 모두 대응
    const s = norm(raw);
    if (s.includes("휘발") || s === "gasoline") return "gasoline";
    if (s.includes("경유") || s === "diesel") return "diesel";
    if (s.includes("lpg") || s.includes("가스")) return "lpg";

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * ✅ 회사↔출장지(거래처) 거리(편도) 조회
 * - trip_distance_master.home_distance_km 사용
 * - 문자열 완전일치 문제 방지 위해 trim/lower 매칭
 */
async function getCompanyToClientKm(pool: Pool, clientName: string): Promise<number> {
  const key = String(clientName ?? "").trim();
  if (!key) return 0;

  const r = await pool.query(
    `
    SELECT home_distance_km
    FROM trip_distance_master
    WHERE LOWER(TRIM(client_name)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [key]
  );

  if (r.rows.length === 0) return 0;
  return Number(r.rows[0].home_distance_km) || 0;
}

/**
 * ✅ 자택↔출장지(거래처) 거리(편도) 조회
 * - innomax_users.distance_detail_json 안에서 client_name 매칭해서 home_distance_km 사용
 */
async function getHomeToClientKm(pool: Pool, userName: string, clientName: string): Promise<number> {
  const u = String(userName ?? "").trim();
  const c = String(clientName ?? "").trim();
  if (!u || !c) return 0;

  const r = await pool.query(
    `
    SELECT distance_detail_json
    FROM innomax_users
    WHERE name = $1
    LIMIT 1
    `,
    [u]
  );

  if (r.rows.length === 0) return 0;

  const arr = r.rows[0]?.distance_detail_json;
  if (!Array.isArray(arr)) return 0;

  const cKey = norm(c);
  const found = arr.find((x: any) => norm(x?.client_name) === cKey);

  return Number(found?.home_distance_km) || 0;
}

/**
 * ✅ 유류비 계산
 * - 개인차량(personal)만 유류비 발생
 * - 출발/복귀가 company/home로 판별 불가(기타)면 계산 불가 → 0
 * - 총km 계산 후: (총km / 연비) * 유류단가(유종별)
 *
 * ✅ calc.debug에 전부 남겨서 "왜 이 값인지" 바로 확인 가능
 */
async function calcFuelAmountByCase(
  pool: Pool,
  reqName: string,
  destination: string,
  vehicleRaw: any,
  departPlaceRaw: any,
  returnPlaceRaw: any
): Promise<FuelCalcResult> {
  const vehicle = normalizeVehicle(vehicleRaw);

  // ✅ 개인차량만 계산
  if (vehicle !== "personal") {
    return {
      distanceKm: 0,
      amount: 0,
      debug: {
        reason: "vehicle_not_personal",
        vehicle_norm: vehicle,
      },
    };
  }

  const departPlaceType = normalizePlace(departPlaceRaw);
  const returnPlaceType = normalizePlace(returnPlaceRaw);

  // ✅ 출발/복귀가 회사/자택으로 판별 불가(기타)면 계산 불가
  if (!departPlaceType || !returnPlaceType) {
    return {
      distanceKm: 0,
      amount: 0,
      debug: {
        reason: "place_not_supported",
        depart_place_raw: departPlaceRaw,
        return_place_raw: returnPlaceRaw,
        depart_place_type: departPlaceType,
        return_place_type: returnPlaceType,
      },
    };
  }

  // 1) 편도 거리
  const companyOneWay = await getCompanyToClientKm(pool, destination);
  const homeOneWay = await getHomeToClientKm(pool, reqName, destination);

  // 2) 총 km 계산(케이스 4개)
  let totalKm = 0;
  let caseUsed = "";

  // 회사 -> 출장지 -> 회사
  if (departPlaceType === "company" && returnPlaceType === "company") {
    totalKm = companyOneWay * 2;
    caseUsed = "C->D->C";
  }
  // 회사 -> 출장지 -> 자택
  else if (departPlaceType === "company" && returnPlaceType === "home") {
    totalKm = companyOneWay + homeOneWay;
    caseUsed = "C->D->H";
  }
  // 자택 -> 출장지 -> 회사
  else if (departPlaceType === "home" && returnPlaceType === "company") {
    totalKm = homeOneWay + companyOneWay;
    caseUsed = "H->D->C";
  }
  // 자택 -> 출장지 -> 자택
  else {
    totalKm = homeOneWay * 2;
    caseUsed = "H->D->H";
  }

  // 3) 유종/설정(단가+연비) 가져오기
  const fuelType = await getUserFuelType(pool, reqName);
  const settings = await getFuelSettings(pool);

  const fuelPricePerLiter =
    fuelType === "diesel"
      ? settings.priceDiesel
      : fuelType === "lpg"
        ? settings.priceLpg
        : settings.priceGasoline; // unknown은 휘발유로 fallback

  const kmPerLiter = settings.kmPerLiter;

  // 4) 최종 금액: (총km / 연비) * 단가
  const liters = kmPerLiter > 0 ? totalKm / kmPerLiter : 0;
  const amount = Math.round(liters * fuelPricePerLiter);

  return {
    distanceKm: totalKm,
    amount,
    debug: {
      case_used: caseUsed,
      destination_raw: destination,
      req_name: reqName,

      company_oneway_km: companyOneWay,
      home_oneway_km: homeOneWay,
      total_km: totalKm,

      fuel_type_user: fuelType,
      fuel_price_per_liter_used: fuelPricePerLiter,
      km_per_liter_used: kmPerLiter,

      liters_calc: liters,
      formula: "(totalKm / kmPerLiter) * fuelPricePerLiter",
    },
  };
}

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

  /* ============================
      0) 출장지(거래처) 목록/거리 조회
   ============================ */
  router.get("/clients", async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          region,
          client_name,
          home_distance_km,
          home_distance_km AS distance_km,
          travel_time_text
        FROM trip_distance_master
        WHERE client_name IS NOT NULL AND client_name <> ''
        ORDER BY client_name ASC
      `);

      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("[clients] error:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
      0-1) 유저 자택거리(distance_detail_json) 조회
   ============================ */
  router.get("/user-distance", async (req, res) => {
    const name = String(req.query.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ ok: false, message: "name 필요" });
    }

    try {
      const r = await pool.query(
        `
        SELECT distance_detail_json
        FROM innomax_users
        WHERE name = $1
        LIMIT 1
        `,
        [name]
      );

      if (r.rows.length === 0) {
        return res.status(404).json({ ok: false, message: "유저 없음" });
      }

      return res.json({ ok: true, data: r.rows[0].distance_detail_json ?? [] });
    } catch (err: any) {
      console.error("[user-distance] error:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
    1) 국내출장 등록
  ============================ */
  router.post("/domestic", async (req, res) => {
    const {
      trip_type,
      req_name,
      depart_place,
      destination,
      start_date,
      depart_time,
      arrive_time,
      purpose,
    } = req.body ?? {};

    if (
      trip_type !== "domestic" ||
      !req_name ||
      !depart_place ||
      !destination ||
      !start_date ||
      !depart_time ||
      !arrive_time ||
      !purpose
    ) {
      return res.status(400).json({ ok: false, message: "국내출장 필수값 누락" });
    }

    const trip_date = start_date;
    const trip_id = `${req_name}|${trip_date}`;

    const startData = {
      trip_type,
      req_name,
      depart_place,
      destination,
      start_date,
      depart_time,
      arrive_time,
      purpose,
    };

    try {
      const sql = `
        INSERT INTO business_trips (
          trip_id, req_name, trip_date, start_data, end_data, detail_json, created_at
        )
        VALUES (
          $1, $2, $3, $4::jsonb, NULL, jsonb_build_object('register', $4::jsonb), NOW()
        )
        ON CONFLICT (req_name, trip_date)
        DO UPDATE SET
          trip_id    = EXCLUDED.trip_id,
          start_data = EXCLUDED.start_data,
          detail_json = jsonb_set(
            COALESCE(business_trips.detail_json, '{}'::jsonb),
            '{register}',
            EXCLUDED.start_data,
            true
          )
        RETURNING *;
      `;

      const params = [trip_id, req_name, trip_date, JSON.stringify(startData)];
      const result = await pool.query(sql, params);

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("국내출장 등록 실패 FULL:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
    2) 정산 저장 + 식대/유류비 자동 계산
    ✅ 유류 공식: (총km / 연비) * 유종별단가
    ✅ calc.fuel_debug 저장해서 근거 추적 가능
  ============================ */
  router.post("/settlement", async (req, res) => {
    const { req_name, trip_date, detail_json } = req.body ?? {};
    const settlement = detail_json?.settlement;

    if (!req_name || !trip_date || !settlement) {
      return res.status(400).json({ ok: false, message: "정산 필수값 누락" });
    }

    const trip_id = `${req_name}|${trip_date}`;

    try {
      const baseResult = await pool.query(
        `
        SELECT start_data, detail_json
          FROM business_trips
         WHERE req_name = $1
           AND trip_date = $2
         LIMIT 1
        `,
        [req_name, trip_date]
      );

      if (baseResult.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          message: "출장등록 데이터가 없습니다. 먼저 출장등록을 해주세요.",
        });
      }

      const row = baseResult.rows[0] ?? {};
      const startData =
        row.start_data && Object.keys(row.start_data).length > 0
          ? row.start_data
          : row.detail_json?.register ?? {};

      const destination = String(startData.destination ?? "");

      const vehicleRaw = settlement.vehicle;
      const departPlaceRaw = startData.depart_place;
      const returnPlaceRaw = settlement.return_place;

      // ✅ 1) 식대
      const mealResult = calcMealAmount(settlement.meals);

      // ✅ 2) 유류(설정 기반)
      const fuelResult = await calcFuelAmountByCase(
        pool,
        req_name,
        destination,
        vehicleRaw,
        departPlaceRaw,
        returnPlaceRaw
      );

      const calc = {
        meals_personal_count: mealResult.count,
        meals_personal_amount: mealResult.amount,

        fuel_distance_km: fuelResult.distanceKm,
        fuel_amount: fuelResult.amount,

        total_amount: mealResult.amount + fuelResult.amount,

        // ✅ 디버깅용
        fuel_debug: fuelResult.debug,
        vehicle_norm: normalizeVehicle(vehicleRaw),
        depart_place_type: normalizePlace(departPlaceRaw),
        return_place_type: normalizePlace(returnPlaceRaw),
      };

      const endData = {
        ...settlement,
        vehicle: normalizeVehicle(vehicleRaw),
        calc,
      };

      const sql = `
        INSERT INTO business_trips (
          trip_id, req_name, trip_date, end_data, detail_json, created_at
        )
        VALUES (
          $1, $2, $3, $4::jsonb, jsonb_build_object('settlement', $4::jsonb), NOW()
        )
        ON CONFLICT (req_name, trip_date)
        DO UPDATE SET
          trip_id  = EXCLUDED.trip_id,
          end_data = EXCLUDED.end_data,
          detail_json = jsonb_set(
            COALESCE(business_trips.detail_json, '{}'::jsonb),
            '{settlement}',
            EXCLUDED.end_data,
            true
          )
        RETURNING *;
      `;

      const params = [trip_id, req_name, trip_date, JSON.stringify(endData)];
      const result = await pool.query(sql, params);

      return res.json({
        ok: true,
        data: { ...result.rows[0], calc },
      });
    } catch (err: any) {
      console.error("정산 저장 실패 FULL:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
     3) 날짜로 출장정보 1건 조회
  ============================ */
  router.get("/by-date", async (req, res) => {
    const date = String(req.query.date ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim();

    if (!date || !reqName) {
      return res.status(400).json({ ok: false, message: "date + req_name 필요" });
    }

    try {
      const result = await pool.query(
        `
        SELECT *
        FROM business_trips
        WHERE req_name = $1
          AND trip_date = $2
        LIMIT 1
        `,
        [reqName, date]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ ok: false, message: "출장 없음" });
      }

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("출장조회 실패 FULL:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
     4) 대시보드용 출장자 현황
  ============================ */
  router.get("/status", async (req, res) => {
    const date = String(req.query.date ?? "").trim();

    try {
      const result = await pool.query(
        `
        SELECT
          trip_id,
          req_name,
          trip_date,
          start_data,
          end_data,
          detail_json,
          created_at,
          approve_status
        FROM business_trips
        WHERE trip_date = COALESCE($1::date, CURRENT_DATE)
        ORDER BY created_at DESC;
        `,
        [date || null]
      );

      const items = result.rows.map((row) => {
        const start =
          row.start_data && Object.keys(row.start_data).length > 0
            ? row.start_data
            : row.detail_json?.register ?? {};

        const end =
          row.end_data && Object.keys(row.end_data).length > 0
            ? row.end_data
            : row.detail_json?.settlement ?? {};

        return {
          trip_id: row.trip_id,
          req_name: row.req_name,
          trip_date: row.trip_date,

          depart_place: start.depart_place ?? "",
          destination: start.destination ?? "",
          depart_time: start.depart_time ?? "",
          arrive_time: start.arrive_time ?? "",

          status: end && Object.keys(end).length > 0 ? "SETTLED" : "REGISTERED",
          approve_status: row.approve_status ?? null,
        };
      });

      return res.json({ ok: true, data: items });
    } catch (err: any) {
      console.error("출장자 현황 조회 실패 FULL:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
     5) (직원용) 정산 내역 기간 조회
  ============================ */
  router.get("/settlements-range", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim();

    if (!from || !to) {
      return res.status(400).json({ ok: false, message: "from, to 날짜는 필수입니다." });
    }

    try {
      const params: any[] = [from, to];
      let where = "trip_date BETWEEN $1::date AND $2::date";

      if (reqName) {
        where += " AND req_name = $3";
        params.push(reqName);
      }

      const result = await pool.query(
        `
        SELECT
          trip_id,
          req_name,
          trip_date,
          start_data,
          end_data,
          detail_json,
          created_at,
          approve_status
        FROM business_trips
        WHERE ${where}
        ORDER BY trip_date ASC, req_name ASC, created_at ASC
        `,
        params
      );

      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("정산 내역 기간조회 실패 FULL:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
     6) (관리자용) 정산 내역 기간 조회 - 전체 직원 + 상태 필터
  ============================ */
  router.get("/settlements-range-admin", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const rawStatus = String(req.query.status ?? "").trim();

    if (!from || !to) {
      return res.status(400).json({ ok: false, message: "from, to 날짜는 필수입니다." });
    }

    let status: "all" | "pending" | "approved" | "rejected" = "all";
    if (rawStatus === "pending") status = "pending";
    else if (rawStatus === "approved") status = "approved";
    else if (rawStatus === "rejected") status = "rejected";

    try {
      const params: any[] = [from, to];
      let where = "bt.trip_date BETWEEN $1::date AND $2::date";

      if (status === "approved" || status === "rejected") {
        where += " AND bt.approve_status = $3";
        params.push(status);
      } else if (status === "pending") {
        where += " AND bt.approve_status IS NULL";
      }

      const result = await pool.query(
        `
        SELECT
          bt.trip_id,
          bt.req_name,
          bt.trip_date,
          bt.start_data,
          bt.end_data,
          bt.detail_json,
          bt.created_at,
          COALESCE(bt.approve_status, 'pending') AS approve_status,
          bt.approve_by,
          bt.approve_at,
          bt.approve_comment,
          u.company_part
        FROM business_trips bt
        LEFT JOIN innomax_users u
          ON bt.req_name = u.name
        WHERE ${where}
        ORDER BY bt.trip_date ASC, bt.req_name ASC, bt.created_at ASC
        `,
        params
      );

      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("관리자용 정산 내역 기간조회 실패 FULL:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
     7) 승인/반려 업데이트
  ============================ */
  async function updateApproval(
    tripId: string,
    decision: "approved" | "rejected",
    approver: string | null,
    comment: string | null
  ) {
    const sql = `
      UPDATE business_trips
      SET
        approve_status  = $2,
        approve_by      = $3,
        approve_at      = NOW(),
        approve_comment = $4
      WHERE trip_id = $1
      RETURNING trip_id, approve_status, approve_by, approve_at, approve_comment;
    `;
    const result = await pool.query(sql, [tripId, decision, approver, comment]);
    return result.rows[0];
  }

  router.post("/:trip_id/approve", async (req, res) => {
    const tripId = req.params.trip_id;
    const { approver, comment } = req.body ?? {};

    if (!tripId) return res.status(400).json({ ok: false, message: "trip_id가 필요합니다." });

    try {
      const row = await updateApproval(tripId, "approved", approver ?? null, comment ?? null);
      if (!row) return res.status(404).json({ ok: false, message: "해당 출장 건을 찾을 수 없습니다." });
      return res.json({ ok: true, data: row });
    } catch (err: any) {
      console.error("[approve] error FULL:", err);
      return res.status(500).json({ ok: false, message: "서버 오류" });
    }
  });

  router.post("/:trip_id/reject", async (req, res) => {
    const tripId = req.params.trip_id;
    const { approver, comment } = req.body ?? {};

    if (!tripId) return res.status(400).json({ ok: false, message: "trip_id가 필요합니다." });

    try {
      const row = await updateApproval(tripId, "rejected", approver ?? null, comment ?? null);
      if (!row) return res.status(404).json({ ok: false, message: "해당 출장 건을 찾을 수 없습니다." });
      return res.json({ ok: true, data: row });
    } catch (err: any) {
      console.error("[reject] error FULL:", err);
      return res.status(500).json({ ok: false, message: "서버 오류" });
    }
  });

  return router;
}
