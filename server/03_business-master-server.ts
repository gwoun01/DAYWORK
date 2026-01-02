// 03_business-master-server.ts
import express from "express";
import type { Pool } from "pg";

type AnyObj = Record<string, any>;

function toNumberOrNull(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

      // ✅ 기본값(새 구조 + 구 구조 같이 제공)
      const defaultConfig = {
        // --- 새 구조(프론트 새 UI용) ---
        fuel_price_gasoline: null,
        fuel_price_diesel: null,
        fuel_price_lpg: null,
        exchange_rate_usd: null,
        exchange_rate_jpy: null,
        exchange_rate_cny: null,
        duty_members_text: "",
        notice: "",

        // --- 구 구조(기존 코드 호환) ---
        fuel_price_per_liter: null, // = gasoline로 내려줌
        km_per_liter: 7,            // ✅ 고정
        default_oil_type: "휘발유",
        note: "",
      };

      if (result.rows.length === 0) {
        return res.json(defaultConfig);
      }

      const cfg: AnyObj = result.rows[0].config_json || {};

      // ✅ 새 키 우선, 없으면 구 키에서 가져오기
      const gasoline =
        toNumberOrNull(cfg.fuel_price_gasoline) ??
        toNumberOrNull(cfg.fuel_price_per_liter) ??
        null;

      const merged = {
        // --- 새 구조 ---
        fuel_price_gasoline: gasoline,
        fuel_price_diesel: toNumberOrNull(cfg.fuel_price_diesel) ?? null,
        fuel_price_lpg: toNumberOrNull(cfg.fuel_price_lpg) ?? null,
        exchange_rate_usd: toNumberOrNull(cfg.exchange_rate_usd) ?? null,
        exchange_rate_jpy: toNumberOrNull(cfg.exchange_rate_jpy) ?? null,
        exchange_rate_cny: toNumberOrNull(cfg.exchange_rate_cny) ?? null,
        duty_members_text: String(cfg.duty_members_text ?? ""),
        notice: String(cfg.notice ?? cfg.note ?? ""),

        // --- 구 구조 호환값 같이 내려줌 ---
        fuel_price_per_liter: gasoline,
        km_per_liter: 7, // ✅ 고정
        default_oil_type: String(cfg.default_oil_type ?? "휘발유"),
        note: String(cfg.note ?? cfg.notice ?? ""),
      };

      return res.json(merged);
    } catch (err) {
      console.error("[business-master][GET /config] 에러:", err);
      return res.status(500).json({ ok: false, error: "설정 조회 에러" });
    }
  });

  /* ===========================
   * 2. 출장 기본 설정 저장
   *    POST /api/business-master/config
   * =========================== */
  router.post("/config", async (req, res) => {
    const body: AnyObj = req.body ?? {};

    try {
      // ✅ 기존 설정 읽고 merge 저장(덮어쓰기 방지)
      const check = await pool.query(
        `SELECT id, config_json FROM business_trip_config ORDER BY id LIMIT 1`
      );

      const existingCfg: AnyObj =
        check.rows.length > 0 ? (check.rows[0].config_json || {}) : {};

      // ✅ 새 구조 우선
      const gasoline =
        toNumberOrNull(body.fuel_price_gasoline) ??
        toNumberOrNull(body.fuel_price_per_liter) ?? // 구버전이 보내면 매핑
        toNumberOrNull(existingCfg.fuel_price_gasoline) ??
        toNumberOrNull(existingCfg.fuel_price_per_liter) ??
        null;

      const nextCfg: AnyObj = {
        ...existingCfg,

        // --- 새 구조 저장 ---
        fuel_price_gasoline: gasoline,
        fuel_price_diesel:
          toNumberOrNull(body.fuel_price_diesel) ??
          toNumberOrNull(existingCfg.fuel_price_diesel) ??
          null,
        fuel_price_lpg:
          toNumberOrNull(body.fuel_price_lpg) ??
          toNumberOrNull(existingCfg.fuel_price_lpg) ??
          null,

        exchange_rate_usd:
          toNumberOrNull(body.exchange_rate_usd) ??
          toNumberOrNull(existingCfg.exchange_rate_usd) ??
          null,
        exchange_rate_jpy:
          toNumberOrNull(body.exchange_rate_jpy) ??
          toNumberOrNull(existingCfg.exchange_rate_jpy) ??
          null,
        exchange_rate_cny:
          toNumberOrNull(body.exchange_rate_cny) ??
          toNumberOrNull(existingCfg.exchange_rate_cny) ??
          null,

        // 당직/공지
        duty_members_text:
          body.duty_members_text != null
            ? String(body.duty_members_text)
            : String(existingCfg.duty_members_text ?? ""),

        // ✅ notice 새 키 우선, 없으면 note(구키)로 저장
        notice:
          body.notice != null
            ? String(body.notice)
            : body.note != null
            ? String(body.note)
            : String(existingCfg.notice ?? existingCfg.note ?? ""),

        // --- 구 구조도 같이 유지(혹시 기존 화면이 읽을 수 있게) ---
        fuel_price_per_liter: gasoline,
        km_per_liter: 7, // ✅ 고정
        default_oil_type:
          body.default_oil_type != null
            ? String(body.default_oil_type)
            : String(existingCfg.default_oil_type ?? "휘발유"),
        note:
          body.note != null
            ? String(body.note)
            : body.notice != null
            ? String(body.notice)
            : String(existingCfg.note ?? existingCfg.notice ?? ""),
      };

      if (check.rows.length === 0) {
        const insertResult = await pool.query(
          `
          INSERT INTO business_trip_config (config_json)
          VALUES ($1)
          RETURNING config_json
        `,
          [nextCfg]
        );
        return res.json({ ok: true, config: insertResult.rows[0].config_json });
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
        [nextCfg, id]
      );

      return res.json({ ok: true, config: updateResult.rows[0].config_json });
    } catch (err) {
      console.error("[business-master][POST /config] 에러:", err);
      return res.status(500).json({ ok: false, error: "설정 저장 에러" });
    }
  });

  /* ===========================
   * 3. 거리 마스터 목록 조회
   *    GET /api/business-master/distances
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
// ✅ 공휴일 조회 (한국천문연구원_특일정보)
// GET /api/business-master/holidays?year=2026&month=01
router.get("/holidays", async (req, res) => {
  try {
    const year = String(req.query.year ?? "");
    const month = String(req.query.month ?? "");

    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({ ok: false, error: "year(YYYY) 필요" });
    }
    if (!/^\d{1,2}$/.test(month)) {
      return res.status(400).json({ ok: false, error: "month(MM) 필요" });
    }

    const mm = month.padStart(2, "0");

    const serviceKey = process.env.HOLIDAY_SERVICE_KEY;
    if (!serviceKey) {
      return res.status(500).json({ ok: false, error: "HOLIDAY_SERVICE_KEY 미설정" });
    }

    // 공휴일 조회 endpoint
    // 예: http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo?solYear=2023&solMonth=01&_type=json&ServiceKey=...
    const url =
      `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo` +
      `?solYear=${encodeURIComponent(year)}` +
      `&solMonth=${encodeURIComponent(mm)}` +
      `&_type=json` +
      `&ServiceKey=${serviceKey}`; // 보통 이미 인코딩된 키라 encodeURIComponent() 하지 않는 편이 안전

    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `holiday api status=${r.status}` });
    }

    const data: any = await r.json();

    // 안전 파싱
    const items = data?.response?.body?.items?.item;
    const list = (Array.isArray(items) ? items : items ? [items] : []).map((it: any) => ({
      // locdate: 20260101 같은 형태
      date: String(it.locdate ?? ""),
      name: String(it.dateName ?? ""),
      isHoliday: String(it.isHoliday ?? "") === "Y",
    }));

    return res.json({ ok: true, year, month: mm, holidays: list });
  } catch (err: any) {
    console.error("[business-master][GET /holidays] 에러:", err);
    return res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
});

  return router;
}
