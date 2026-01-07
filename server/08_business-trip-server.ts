// src/routers/businessTripRouter.ts
import express from "express";
import type { Pool } from "pg";

// ===================== 금액 계산 유틸 =====================
const MEAL_UNIT = 12000;       // 1인당 식대 (개인 부담)
const FUEL_PRICE_PER_KM = 200; // km당 유류비 (예시값)

type MealCalcResult = { count: number; amount: number };
type FuelCalcResult = { distanceKm: number; amount: number };

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

  return {
    count,
    amount: count * MEAL_UNIT,
  };
}

/**
 * ✅ 회사↔출장지(거래처) 거리(편도) 조회
 * - trip_distance_master.home_distance_km 사용
 */
async function getCompanyToClientKm(pool: Pool, clientName: string): Promise<number> {
  if (!clientName) return 0;

  const r = await pool.query(
    `
    SELECT home_distance_km
    FROM trip_distance_master
    WHERE client_name = $1
    LIMIT 1
    `,
    [clientName]
  );

  if (r.rows.length === 0) return 0;
  return Number(r.rows[0].home_distance_km) || 0;
}

/**
 * ✅ 자택↔출장지(거래처) 거리(편도) 조회
 * - innomax_users.distance_detail_json 안에서 client_name 매칭해서 home_distance_km 사용
 * - distance_detail_json 예:
 *   [{ region, client_name, home_distance_km, travel_time_text }, ...]
 */
async function getHomeToClientKm(pool: Pool, userName: string, clientName: string): Promise<number> {
  if (!userName || !clientName) return 0;

  const r = await pool.query(
    `
    SELECT distance_detail_json
    FROM innomax_users
    WHERE name = $1
    LIMIT 1
    `,
    [userName]
  );

  if (r.rows.length === 0) return 0;

  const arr = r.rows[0]?.distance_detail_json;
  if (!Array.isArray(arr)) return 0;

  const found = arr.find((x: any) => String(x?.client_name ?? "") === String(clientName));
  return Number(found?.home_distance_km) || 0;
}

/**
 * ✅ 유류비 계산 (케이스 4개)
 * - vehicle:
 *    personal(개인차량)만 유류비 발생
 *    corp / other / public 는 0원
 *
 * - placeType:
 *    "company" | "home"
 *
 * - 케이스:
 *   1) 회사 -> 출장지 -> 회사 : (회사↔출장지)*2
 *   2) 회사 -> 출장지 -> 자택 : 회사↔출장지 + 자택↔출장지
 *   3) 자택 -> 출장지 -> 회사 : 자택↔출장지 + 회사↔출장지
 *   4) 자택 -> 출장지 -> 자택 : (자택↔출장지)*2
 */
async function calcFuelAmountByCase(
  pool: Pool,
  reqName: string,
  destination: string,
  vehicle: string,
  departPlaceType: "company" | "home",
  returnPlaceType: "company" | "home"
): Promise<FuelCalcResult> {
  // ✅ 개인차량만 계산
  if (vehicle !== "personal") {
    return { distanceKm: 0, amount: 0 };
  }

  // 회사↔출장지(편도)
  const companyOneWay = await getCompanyToClientKm(pool, destination);

  // 자택↔출장지(편도) - 사용자 JSON에서
  const homeOneWay = await getHomeToClientKm(pool, reqName, destination);

  let totalKm = 0;

  // 1) 회사 -> 출장지 -> 회사
  if (departPlaceType === "company" && returnPlaceType === "company") {
    totalKm = companyOneWay * 2;
  }
  // 2) 회사 -> 출장지 -> 자택
  else if (departPlaceType === "company" && returnPlaceType === "home") {
    totalKm = companyOneWay + homeOneWay;
  }
  // 3) 자택 -> 출장지 -> 회사
  else if (departPlaceType === "home" && returnPlaceType === "company") {
    totalKm = homeOneWay + companyOneWay;
  }
  // 4) 자택 -> 출장지 -> 자택
  else {
    totalKm = homeOneWay * 2;
  }

  const amount = Math.round(totalKm * FUEL_PRICE_PER_KM);
  return { distanceKm: totalKm, amount };
}

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

  /* ============================
      0) 출장지(거래처) 목록/거리 조회
      GET /api/business-trip/clients
      - trip_distance_master 전체를 내려줌 (프론트 select + 계산용)
   ============================ */
  router.get("/clients", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT region, client_name, home_distance_km, travel_time_text
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
      GET /api/business-trip/user-distance?name=홍길동
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

      return res.json({
        ok: true,
        data: r.rows[0].distance_detail_json ?? [],
      });
    } catch (err: any) {
      console.error("[user-distance] error:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
    1) 국내출장 등록 → start_data + detail_json.register
  =============================*/
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
      // ✅ 앞으로 프론트에서 보내도 되고(선택), 없어도 동작
      // depart_place_type, // "company" | "home"
      // return_place_type, // "company" | "home"
    } = req.body ?? {};

    console.log("[POST /api/business-trip/domestic] body =", req.body);

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
      return res.status(400).json({
        ok: false,
        message: "국내출장 필수값 누락",
      });
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
          trip_id,
          req_name,
          trip_date,
          start_data,
          end_data,
          detail_json,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::jsonb,
          NULL,
          jsonb_build_object('register', $4::jsonb),
          NOW()
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
      console.error("국내출장 등록 실패 MESSAGE:", err?.message);
      console.error("국내출장 등록 실패 DETAIL:", err?.detail);
      console.error("국내출장 등록 실패 CODE:", err?.code);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
    2) 이어 정산 저장
    - end_data 저장
    - detail_json 기존 내용 유지하면서 settlement만 넣기
    - 식대/유류비 자동 계산 후 settlement.calc 저장
    ✅ 중요: 케이스별 거리 계산(회사/자택/복귀지) 반영
  =============================*/
  router.post("/settlement", async (req, res) => {
    const { req_name, trip_date, detail_json } = req.body ?? {};
    const settlement = detail_json?.settlement;

    if (!req_name || !trip_date || !settlement) {
      return res.status(400).json({ ok: false, message: "정산 필수값 누락" });
    }

    const trip_id = `${req_name}|${trip_date}`;

    try {
      // ✅ 1) 기존 등록 데이터 조회
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
      const vehicle = String(settlement.vehicle ?? "");

      // ✅ 2) 출발/복귀 타입 결정
      // - 프론트에서 return_place 값이 home/company로 오게 바꾸는 걸 추천
      // - 지금은 return_place가 "home"면 home, 그 외는 company로 처리(초보용 안전장치)
      const departPlaceText = String(startData.depart_place ?? "");
      const returnPlaceText = String(settlement.return_place ?? "");

      const departPlaceType: "company" | "home" =
        departPlaceText === "자택" || departPlaceText === "home" ? "home" : "company";

      const returnPlaceType: "company" | "home" =
        returnPlaceText === "자택" || returnPlaceText === "home" ? "home" : "company";

      // ✅ 3) 식대/유류비 계산
      const mealResult = calcMealAmount(settlement.meals);
      const fuelResult = await calcFuelAmountByCase(
        pool,
        req_name,
        destination,
        vehicle,
        departPlaceType,
        returnPlaceType
      );

      const calc = {
        meals_personal_count: mealResult.count,
        meals_personal_amount: mealResult.amount,
        fuel_distance_km: fuelResult.distanceKm,
        fuel_amount: fuelResult.amount,
        total_amount: mealResult.amount + fuelResult.amount,
        // 디버깅용(원하면 프론트에서 표시 가능)
        depart_place_type: departPlaceType,
        return_place_type: returnPlaceType,
      };

      const endData = {
        ...settlement,
        calc,
      };

      // ✅ 4) DB 저장 (settlement만 업데이트)
      const sql = `
        INSERT INTO business_trips (
          trip_id,
          req_name,
          trip_date,
          end_data,
          detail_json,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::jsonb,
          jsonb_build_object('settlement', $4::jsonb),
          NOW()
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
        data: {
          ...result.rows[0],
          calc,
        },
      });
    } catch (err: any) {
      console.error("정산 저장 실패 FULL:", err);
      console.error("정산 저장 실패 MESSAGE:", err?.message);
      console.error("정산 저장 실패 DETAIL:", err?.detail);
      console.error("정산 저장 실패 CODE:", err?.code);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     3) 날짜로 출장정보 1건 조회 (등록/정산 화면에서 재조회용)
  ===================================================== */
  router.get("/by-date", async (req, res) => {
    const date = String(req.query.date ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim();

    if (!date || !reqName) {
      return res.status(400).json({
        ok: false,
        message: "date + req_name 필요",
      });
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
      console.error("출장조회 실패 MESSAGE:", err?.message);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     4) 대시보드용 출장자 현황 (/api/business-trip/status)
  ===================================================== */
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
      console.error("출장자 현황 조회 실패 MESSAGE:", err?.message);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     5) (직원용) 정산 내역 기간 조회
  ===================================================== */
  router.get("/settlements-range", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim();

    if (!from || !to) {
      return res.status(400).json({
        ok: false,
        message: "from, to 날짜는 필수입니다.",
      });
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
      console.error("정산 내역 기간조회 실패 MESSAGE:", err?.message);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     6) (관리자용) 정산 내역 기간 조회 - 전체 직원 + 상태 필터
  ===================================================== */
  router.get("/settlements-range-admin", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const rawStatus = String(req.query.status ?? "").trim();

    if (!from || !to) {
      return res.status(400).json({
        ok: false,
        message: "from, to 날짜는 필수입니다.",
      });
    }

    let status: "all" | "pending" | "approved" | "rejected" = "all";
    if (rawStatus === "pending") status = "pending";
    else if (rawStatus === "approved") status = "approved";
    else if (rawStatus === "rejected") status = "rejected";
    else status = "all";

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
      console.error("관리자용 정산 내역 기간조회 실패 MESSAGE:", err?.message);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     7) 승인/반려 공통 업데이트 함수
  ===================================================== */
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

  /* =====================================================
     8) 승인 / 반려 API
  ===================================================== */

  router.post("/:trip_id/approve", async (req, res) => {
    const tripId = req.params.trip_id;
    const { approver, comment } = req.body ?? {};

    if (!tripId) {
      return res.status(400).json({ ok: false, message: "trip_id가 필요합니다." });
    }

    try {
      const row = await updateApproval(
        tripId,
        "approved",
        approver ?? null,
        comment ?? null
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: "해당 출장 건을 찾을 수 없습니다." });
      }

      return res.json({ ok: true, data: row });
    } catch (err: any) {
      console.error("[approve] error FULL:", err);
      console.error("[approve] error MESSAGE:", err?.message);
      return res.status(500).json({ ok: false, message: "서버 오류" });
    }
  });

  router.post("/:trip_id/reject", async (req, res) => {
    const tripId = req.params.trip_id;
    const { approver, comment } = req.body ?? {};

    if (!tripId) {
      return res.status(400).json({ ok: false, message: "trip_id가 필요합니다." });
    }

    try {
      const row = await updateApproval(
        tripId,
        "rejected",
        approver ?? null,
        comment ?? null
      );

      if (!row) {
        return res.status(404).json({ ok: false, message: "해당 출장 건을 찾을 수 없습니다." });
      }

      return res.json({ ok: true, data: row });
    } catch (err: any) {
      console.error("[reject] error FULL:", err);
      console.error("[reject] error MESSAGE:", err?.message);
      return res.status(500).json({ ok: false, message: "서버 오류" });
    }
  });

  return router;
}
