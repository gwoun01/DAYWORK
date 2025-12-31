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

// 📏 직원 자택 → 출장지 거리 조회
//   trip_distance_master 에서
//   client_name = 출장지(거래처명), person_name = 직원명 기준으로 home_distance_km 조회
async function getDistanceKm(
  pool: Pool,
  employeeName: string,
  clientName: string
): Promise<number> {
  if (!employeeName || !clientName) return 0;

  const res = await pool.query(
    `
    SELECT home_distance_km
      FROM trip_distance_master
     WHERE client_name = $1
       AND person_name = $2
     LIMIT 1
    `,
    [clientName, employeeName]
  );

  if (res.rows.length === 0) return 0;
  return Number(res.rows[0].home_distance_km) || 0;
}

// ⛽ 유류비 계산 (직원 자택 ↔ 출장지 왕복)
async function calcFuelAmount(
  pool: Pool,
  reqName: string,    // 직원 이름
  destination: string, // 출장지(거래처명)
  vehicle: string
): Promise<FuelCalcResult> {
  // 법인차량이면 개인 유류비 0원
  if (vehicle !== "personal") {
    return { distanceKm: 0, amount: 0 };
  }

  // 직원 자택 → 출장지 거리 (one-way)
  const oneWay = await getDistanceKm(pool, reqName, destination);
  const totalKm = oneWay * 2; // 왕복

  const amount = Math.round(totalKm * FUEL_PRICE_PER_KM);

  return { distanceKm: totalKm, amount };
}

export default function businessTripRouter(pool: Pool) {
  const router = express.Router();

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
    } = req.body ?? {};

    console.log("[POST /api/business-trip/domestic] body =", req.body);

    // 기본 필수값 체크
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

    const trip_date = start_date; // 날짜 기준
    const trip_id = `${req_name}|${trip_date}`;

    // 👉 출장등록 데이터 = start_data (= register)
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

      console.log("[DOMESTIC] SQL params =", params);

      const result = await pool.query(sql, params);

      console.log("[DOMESTIC] 저장 완료 row =", result.rows[0]);

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("국내출장 등록 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* ============================
       2) 이어 정산 저장 → end_data + detail_json(= start + end 합본)
          + 식대/유류비 자동 계산 후 settlement.calc 에 저장
   =============================*/
  router.post("/settlement", async (req, res) => {
    const { req_name, trip_date, detail_json } = req.body ?? {};
    const settlement = detail_json?.settlement;

    if (!req_name || !trip_date || !settlement) {
      return res
        .status(400)
        .json({ ok: false, message: "정산 필수값 누락" });
    }

    const trip_id = `${req_name}|${trip_date}`;

    try {
      // ★ 1) 기존 출장등록 데이터에서 출장지 가져오기
      const baseResult = await pool.query(
        `
        SELECT start_data
          FROM business_trips
         WHERE req_name = $1
           AND trip_date = $2
         LIMIT 1
        `,
        [req_name, trip_date]
      );

      const startData = baseResult.rows[0]?.start_data || {};
      const destination = startData.destination || ""; // 출장지(거래처명)
      const vehicle = settlement.vehicle || "";

      // ★ 2) 식대/유류비 금액 계산
      const mealResult = calcMealAmount(settlement.meals);
      const fuelResult = await calcFuelAmount(
        pool,
        req_name,    // 직원 이름
        destination, // 출장지
        vehicle
      );

      const calc = {
        meals_personal_count: mealResult.count,
        meals_personal_amount: mealResult.amount,
        fuel_distance_km: fuelResult.distanceKm,
        fuel_amount: fuelResult.amount,
        total_amount: mealResult.amount + fuelResult.amount,
      };

      // settlement 안에 calc 붙여서 저장
      const endData = {
        ...settlement,
        calc,
      };

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
          '{}'::jsonb,
          $4::jsonb,
          jsonb_build_object(
            'register', '{}'::jsonb,
            'settlement', $4::jsonb
          ),
          NOW()
        )
        ON CONFLICT (req_name, trip_date)
        DO UPDATE SET
          trip_id  = EXCLUDED.trip_id,
          end_data = EXCLUDED.end_data,
          detail_json = jsonb_build_object(
            'register', COALESCE(business_trips.start_data, '{}'::jsonb),
            'settlement', EXCLUDED.end_data
          )
        RETURNING *;
      `;

      const params = [trip_id, req_name, trip_date, JSON.stringify(endData)];

      console.log("[SETTLEMENT] SQL params =", params);

      const result = await pool.query(sql, params);

      console.log("[SETTLEMENT] 저장 완료 row =", result.rows[0]);

      return res.json({
        ok: true,
        data: {
          ...result.rows[0],
          calc, // 프론트에서 바로 참고하고 싶으면 같이 넘겨줌
        },
      });
    } catch (err: any) {
      console.error("정산 저장 실패:", err?.message ?? err);
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
    } catch (err) {
      console.error("출장조회 실패:", err);
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

      console.log("[STATUS] raw rows =", result.rows);

      const items = result.rows.map((row) => {
        // ✅ start_data 우선, 없으면 detail_json.register
        const start =
          row.start_data && Object.keys(row.start_data).length > 0
            ? row.start_data
            : row.detail_json?.register ?? {};

        // ✅ end_data 우선, 없으면 detail_json.settlement
        const end =
          row.end_data && Object.keys(row.end_data).length > 0
            ? row.end_data
            : row.detail_json?.settlement ?? {};

        const item = {
          trip_id: row.trip_id,
          req_name: row.req_name,
          trip_date: row.trip_date,

          depart_place: start.depart_place ?? "",
          destination: start.destination ?? "",
          depart_time: start.depart_time ?? "",
          arrive_time: start.arrive_time ?? "",

          status:
            end && Object.keys(end).length > 0 ? "SETTLED" : "REGISTERED",
          approve_status: row.approve_status ?? null,
        };

        console.log("[STATUS] mapped item =", item);
        return item;
      });

      return res.json({ ok: true, data: items });
    } catch (err: any) {
      console.error("출장자 현황 조회 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     5) (직원용) 정산 내역 기간 조회
  ===================================================== */
  router.get("/settlements-range", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const reqName = String(req.query.req_name ?? "").trim(); // 옵션

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

      return res.json({
        ok: true,
        data: result.rows,
      });
    } catch (err: any) {
      console.error("정산 내역 기간조회 실패:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  });

  /* =====================================================
     6) (관리자용) 정산 내역 기간 조회 - 전체 직원 + 상태 필터
        GET /api/business-trip/settlements-range-admin
        ?from=...&to=...&status=pending|approved|rejected|all
  ===================================================== */
  router.get("/settlements-range-admin", async (req, res) => {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const rawStatus = String(req.query.status ?? "").trim(); // optional

    if (!from || !to) {
      return res.status(400).json({
        ok: false,
        message: "from, to 날짜는 필수입니다.",
      });
    }

    // 🔹 status 문자열 정규화
    let status: "all" | "pending" | "approved" | "rejected" = "all";
    if (rawStatus === "pending") status = "pending";
    else if (rawStatus === "approved") status = "approved";
    else if (rawStatus === "rejected") status = "rejected";
    else status = "all";

    try {
      const params: any[] = [from, to];
      let where = "bt.trip_date BETWEEN $1::date AND $2::date";

      // ✅ pending → approve_status IS NULL (대기건)
      if (status === "approved" || status === "rejected") {
        where += " AND bt.approve_status = $3";
        params.push(status);
      } else if (status === "pending") {
        where += " AND bt.approve_status IS NULL";
      }
      // status === "all" 이면 추가 조건 없음

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

      return res.json({
        ok: true,
        data: result.rows,
      });
    } catch (err: any) {
      console.error(
        "관리자용 정산 내역 기간조회 실패:",
        err?.message ?? err
      );
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
    const result = await pool.query(sql, [
      tripId,
      decision,
      approver,
      comment,
    ]);
    return result.rows[0];
  }

  /* =====================================================
     8) 승인 / 반려 API
        POST /api/business-trip/:trip_id/approve
        POST /api/business-trip/:trip_id/reject
  ===================================================== */

  // 승인
  router.post("/:trip_id/approve", async (req, res) => {
    const tripId = req.params.trip_id;
    const { approver, comment } = req.body ?? {};

    if (!tripId) {
      return res
        .status(400)
        .json({ ok: false, message: "trip_id가 필요합니다." });
    }

    try {
      const row = await updateApproval(
        tripId,
        "approved",
        approver ?? null,
        comment ?? null
      );
      if (!row) {
        return res
          .status(404)
          .json({ ok: false, message: "해당 출장 건을 찾을 수 없습니다." });
      }
      return res.json({ ok: true, data: row });
    } catch (err: any) {
      console.error("[approve] error:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "서버 오류" });
    }
  });

  // 반려
  router.post("/:trip_id/reject", async (req, res) => {
    const tripId = req.params.trip_id;
    const { approver, comment } = req.body ?? {};

    if (!tripId) {
      return res
        .status(400)
        .json({ ok: false, message: "trip_id가 필요합니다." });
    }

    try {
      const row = await updateApproval(
        tripId,
        "rejected",
        approver ?? null,
        comment ?? null
      );
      if (!row) {
        return res
          .status(404)
          .json({ ok: false, message: "해당 출장 건을 찾을 수 없습니다." });
      }
      return res.json({ ok: true, data: row });
    } catch (err: any) {
      console.error("[reject] error:", err?.message ?? err);
      return res.status(500).json({ ok: false, message: "서버 오류" });
    }
  });

  return router;
}
