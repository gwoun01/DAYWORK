// 03_business-master-server.ts
import express from "express";
import type { Pool } from "pg";

export default function businessMasterRouter(pool: Pool) {
  const router = express.Router();

  /* ===========================
   * 1. 출장 기본 설정 조회
   *    GET /api/business-master/config
   * =========================== */
  router.get("/config", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, config_json
           FROM business_trip_config
           ORDER BY id
           LIMIT 1`
      );

      if (result.rows.length === 0) {
        const defaultConfig = {
          fuel_price_per_liter: null,
          km_per_liter: null,
          exchange_rate_usd: null,
          exchange_rate_jpy: null,
          exchange_rate_cny: null,
          default_oil_type: "휘발유",
          duty_members_text: "",
          note: "",
        };
        return res.json(defaultConfig);
      }

      const cfg = result.rows[0].config_json || {};
      const merged = {
        fuel_price_per_liter: cfg.fuel_price_per_liter ?? null,
        km_per_liter: cfg.km_per_liter ?? null,
        exchange_rate_usd: cfg.exchange_rate_usd ?? null,
        exchange_rate_jpy: cfg.exchange_rate_jpy ?? null,
        exchange_rate_cny: cfg.exchange_rate_cny ?? null,
        default_oil_type: cfg.default_oil_type ?? "휘발유",
        duty_members_text: cfg.duty_members_text ?? "",
        note: cfg.note ?? "",
      };
      return res.json(merged);
    } catch (err) {
      console.error("[business-master][GET /config] 에러:", err);
      return res.status(500).json({ error: "설정 조회 에러" });
    }
  });

  /* ===========================
   * 2. 출장 기본 설정 저장
   *    POST /api/business-master/config
   * =========================== */
  router.post("/config", async (req, res) => {
    const configJson = req.body ?? {};

    try {
      const check = await pool.query(
        `SELECT id FROM business_trip_config ORDER BY id LIMIT 1`
      );

      if (check.rows.length === 0) {
        const insertResult = await pool.query(
          `
          INSERT INTO business_trip_config (config_json)
          VALUES ($1)
          RETURNING config_json
        `,
          [configJson]
        );
        return res.json(insertResult.rows[0].config_json);
      }

      const id = check.rows[0].id;
      const updateResult = await pool.query(
        `
        UPDATE business_trip_config
        SET config_json = $1,
            updated_at  = NOW()
        WHERE id = $2
        RETURNING config_json
      `,
        [configJson, id]
      );

      return res.json(updateResult.rows[0].config_json);
    } catch (err) {
      console.error("[business-master][POST /config] 에러:", err);
      return res.status(500).json({ error: "설정 저장 에러" });
    }
  });

  /* ===========================
   * 3. 거리 마스터 목록 조회
   *    GET /api/business-master/distances
   *    (지역 / 거래처 / 소요시간 / 거리(km))
   * =========================== */
  router.get("/distances", async (_req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          region,
          client_name,
          travel_time_text,
          home_distance_km AS distance_km
        FROM trip_distance_master
        ORDER BY region, client_name
      `
      );
      return res.json(result.rows);
    } catch (err) {
      console.error("[business-master][GET /distances] 에러:", err);
      return res.status(500).json({ error: "거리 마스터 조회 에러" });
    }
  });

  /* ===========================
   * 3-1. 거래처 기본 목록
   *     GET /api/business-master/client-list
   *     (사용자 관리 모달에서 A~Z 리스트용)
   * =========================== */
  router.get("/client-list", async (_req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          MIN(id)               AS id,
          region,
          client_name,
          MAX(travel_time_text) AS travel_time_text
        FROM trip_distance_master
        GROUP BY region, client_name
        ORDER BY client_name, region
      `
      );
      return res.json(result.rows);
    } catch (err) {
      console.error("[business-master][GET /client-list] 에러:", err);
      return res.status(500).json({ error: "거래처 목록 조회 에러" });
    }
  });

  /* ===========================
   * 4. 거리 마스터 등록
   *    POST /api/business-master/distances
   * =========================== */
  router.post("/distances", async (req, res) => {
    const { region, client_name, travel_time_text, distance_km } = req.body ?? {};

    if (!client_name) {
      return res.status(400).json({ error: "거래처는 필수입니다." });
    }
    if (distance_km == null || distance_km === "") {
      return res.status(400).json({ error: "거리(km)는 필수입니다." });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO trip_distance_master (
          region,
          client_name,
          travel_time_text,
          home_distance_km
        )
        VALUES ($1,$2,$3,$4)
        RETURNING
          id,
          region,
          client_name,
          travel_time_text,
          home_distance_km AS distance_km
      `,
        [region ?? null, client_name, travel_time_text ?? null, distance_km]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error("[business-master][POST /distances] 에러:", err);
      return res.status(500).json({ error: "거리 마스터 등록 에러" });
    }
  });

  /* ===========================
   * 5. 거리 마스터 수정
   *    PUT /api/business-master/distances/:id
   * =========================== */
  router.put("/distances/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "id가 없습니다." });

    const { region, client_name, travel_time_text, distance_km } = req.body ?? {};

    if (!client_name) {
      return res.status(400).json({ error: "거래처는 필수입니다." });
    }
    if (distance_km == null || distance_km === "") {
      return res.status(400).json({ error: "거리(km)는 필수입니다." });
    }

    try {
      const result = await pool.query(
        `
        UPDATE trip_distance_master
        SET
          region           = $1,
          client_name      = $2,
          travel_time_text = $3,
          home_distance_km = $4,
          updated_at       = NOW()
        WHERE id = $5
        RETURNING
          id,
          region,
          client_name,
          travel_time_text,
          home_distance_km AS distance_km
      `,
        [region ?? null, client_name, travel_time_text ?? null, distance_km, id]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error("[business-master][PUT /distances/:id] 에러:", err);
      return res.status(500).json({ error: "거리 마스터 수정 에러" });
    }
  });

  /* ===========================
   * 6. 거리 마스터 삭제
   *    DELETE /api/business-master/distances/:id
   * =========================== */
  router.delete("/distances/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "id가 없습니다." });

    try {
      await pool.query(`DELETE FROM trip_distance_master WHERE id = $1`, [id]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[business-master][DELETE /distances/:id] 에러:", err);
      return res.status(500).json({ error: "거리 마스터 삭제 에러" });
    }
  });

  return router;
}
