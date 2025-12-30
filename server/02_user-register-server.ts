// server/02_user-register-server.ts
import express, { Request, Response } from "express";
import { Pool } from "pg";

export default function userRouter(pool: Pool) {
  const router = express.Router();

  /* ======================================
   *  ✅ 사용자 목록 조회
   *  GET /api/users
   * ====================================== */
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const query = `
        SELECT
          no,
          id,
          name,
          password_hash,
          email,
          company_part,
          permissions,
          home_place_code,
          vehicle_fuel_type,
          fuel_efficiency
        FROM innomax_users
        ORDER BY no ASC
      `;
      const result = await pool.query(query);
      return res.json(result.rows);
    } catch (err) {
      console.error("❌ [사용자 목록] 조회 오류:", err);
      return res
        .status(500)
        .json({ error: "사용자 목록 조회 중 오류가 발생했습니다." });
    }
  });

  /* ======================================
   *  ✅ 단일 사용자 조회 (수정 모달용)
   *  GET /api/users/:no
   * ====================================== */
  router.get("/:no", async (req: Request, res: Response) => {
    const no = parseInt(req.params.no, 10);
    if (Number.isNaN(no)) {
      return res.status(400).json({ error: "잘못된 사용자 번호입니다." });
    }

    try {
      const query = `
        SELECT
          no,
          id,
          name,
          password_hash,
          email,
          company_part,
          permissions,
          home_place_code,
          vehicle_fuel_type,
          fuel_efficiency
        FROM innomax_users
        WHERE no = $1
        LIMIT 1
      `;
      const result = await pool.query(query, [no]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("❌ [단일 사용자 조회] 오류:", err);
      return res
        .status(500)
        .json({ error: "사용자 조회 중 오류가 발생했습니다." });
    }
  });

  /* ======================================
   *  ✅ 사용자 추가
   *  POST /api/users
   *  body: { Name, ID, password, email, company_part, permissions,
   *          home_place_code, vehicle_fuel_type, fuel_efficiency }
   * ====================================== */
  router.post("/", async (req: Request, res: Response) => {
    const {
      Name,
      ID,
      password,
      email,
      company_part,
      permissions,
      home_place_code,
      vehicle_fuel_type,
      fuel_efficiency,
    } = req.body ?? {};

    if (!Name || !ID || !password) {
      return res.status(400).json({
        ok: false,
        error: "이름, ID, 비밀번호는 필수입니다.",
      });
    }

    try {
      const insertQuery = `
        INSERT INTO innomax_users (
          id,
          name,
          password_hash,
          email,
          company_part,
          permissions,
          home_place_code,
          vehicle_fuel_type,
          fuel_efficiency
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING no, id, name, email, company_part, permissions,
                  home_place_code, vehicle_fuel_type, fuel_efficiency
      `;

      const permsValue =
        permissions && Object.keys(permissions).length > 0
          ? JSON.stringify(permissions)
          : null;

      const fuelEffNum =
        fuel_efficiency === undefined || fuel_efficiency === null || fuel_efficiency === ""
          ? null
          : Number(fuel_efficiency);

      const result = await pool.query(insertQuery, [
        ID,
        Name,
        password, // 나중에 bcrypt 등으로 해시하면 됨
        email ?? null,
        company_part ?? null,
        permsValue,
        home_place_code ?? null,
        vehicle_fuel_type ?? null,
        fuelEffNum,
      ]);

      return res.json({
        ok: true,
        user: result.rows[0],
      });
    } catch (err) {
      console.error("❌ [사용자 추가] 오류:", err);
      return res
        .status(500)
        .json({ ok: false, error: "사용자 추가 중 오류가 발생했습니다." });
    }
  });

  /* ======================================
   *  ✅ 사용자 수정
   *  PUT /api/users/:no
   *  body: { Name, ID, email, company_part, permissions, password?,
   *          home_place_code, vehicle_fuel_type, fuel_efficiency }
   * ====================================== */
  router.put("/:no", async (req: Request, res: Response) => {
    const no = parseInt(req.params.no, 10);
    if (Number.isNaN(no)) {
      return res.status(400).json({ ok: false, error: "잘못된 사용자 번호입니다." });
    }

    const {
      Name,
      ID,
      email,
      company_part,
      permissions,
      password,
      home_place_code,
      vehicle_fuel_type,
      fuel_efficiency,
    } = req.body ?? {};

    if (!Name || !ID) {
      return res
        .status(400)
        .json({ ok: false, error: "이름과 ID는 필수입니다." });
    }

    try {
      const permsValue =
        permissions && Object.keys(permissions).length > 0
          ? JSON.stringify(permissions)
          : null;

      const fuelEffNum =
        fuel_efficiency === undefined || fuel_efficiency === null || fuel_efficiency === ""
          ? null
          : Number(fuel_efficiency);

      // 비밀번호를 수정할지 여부에 따라 쿼리 분기
      if (password && String(password).trim() !== "") {
        const updateWithPw = `
          UPDATE innomax_users
          SET
            id = $1,
            name = $2,
            password_hash = $3,
            email = $4,
            company_part = $5,
            permissions = $6,
            home_place_code = $7,
            vehicle_fuel_type = $8,
            fuel_efficiency = $9,
            updated_at = NOW()
          WHERE no = $10
          RETURNING no, id, name, email, company_part, permissions,
                    home_place_code, vehicle_fuel_type, fuel_efficiency
        `;
        const result = await pool.query(updateWithPw, [
          ID,
          Name,
          password,
          email ?? null,
          company_part ?? null,
          permsValue,
          home_place_code ?? null,
          vehicle_fuel_type ?? null,
          fuelEffNum,
          no,
        ]);

        if (result.rows.length === 0) {
          return res
            .status(404)
            .json({ ok: false, error: "수정할 사용자를 찾을 수 없습니다." });
        }

        return res.json({ ok: true, user: result.rows[0] });
      } else {
        const updateWithoutPw = `
          UPDATE innomax_users
          SET
            id = $1,
            name = $2,
            email = $3,
            company_part = $4,
            permissions = $5,
            home_place_code = $6,
            vehicle_fuel_type = $7,
            fuel_efficiency = $8,
            updated_at = NOW()
          WHERE no = $9
          RETURNING no, id, name, email, company_part, permissions,
                    home_place_code, vehicle_fuel_type, fuel_efficiency
        `;
        const result = await pool.query(updateWithoutPw, [
          ID,
          Name,
          email ?? null,
          company_part ?? null,
          permsValue,
          home_place_code ?? null,
          vehicle_fuel_type ?? null,
          fuelEffNum,
          no,
        ]);

        if (result.rows.length === 0) {
          return res
            .status(404)
            .json({ ok: false, error: "수정할 사용자를 찾을 수 없습니다." });
        }

        return res.json({ ok: true, user: result.rows[0] });
      }
    } catch (err) {
      console.error("❌ [사용자 수정] 오류:", err);
      return res
        .status(500)
        .json({ ok: false, error: "사용자 수정 중 오류가 발생했습니다." });
    }
  });

  /* ======================================
   *  ✅ 사용자 삭제
   *  DELETE /api/users/:no
   * ====================================== */
  router.delete("/:no", async (req: Request, res: Response) => {
    const no = parseInt(req.params.no, 10);
    if (Number.isNaN(no)) {
      return res.status(400).json({ ok: false, error: "잘못된 사용자 번호입니다." });
    }

    try {
      const result = await pool.query(
        `DELETE FROM innomax_users WHERE no = $1`,
        [no]
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ ok: false, error: "삭제할 사용자를 찾을 수 없습니다." });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("❌ [사용자 삭제] 오류:", err);
      return res
        .status(500)
        .json({ ok: false, error: "사용자 삭제 중 오류가 발생했습니다." });
    }
  });

  return router;
}
