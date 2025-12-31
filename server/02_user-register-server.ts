// server/04_user-manage-server.ts
import express, { Request, Response } from "express";
import type { Pool } from "pg";

export default function userManageRouter(pool: Pool) {
  const router = express.Router();

  /* 1. 사용자 전체 목록 조회: GET /api/users */
  router.get("/", async (_req: Request, res: Response) => {
    console.log("[users][GET /api/users] start");
    try {
      const result = await pool.query(
        `
        SELECT
          no,
          id,
          name,
          email,
          company_part,
          permissions,
          address,
          distance_detail_json
        FROM innomax_users
        ORDER BY no ASC
      `
      );

      console.log(
        "[users][GET /api/users] rows length =",
        result.rows.length
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("[users][GET /api/users] 에러:", err);
      return res
        .status(500)
        .json({ ok: false, error: String(err?.message || err) });
    }
  });

  /* 2. 개별 사용자 조회: GET /api/users/:no */
  router.get("/:no", async (req: Request, res: Response) => {
    const no = Number(req.params.no);
    if (!Number.isFinite(no)) {
      return res.status(400).json({ error: "잘못된 no 값" });
    }

    try {
      const result = await pool.query(
        `
        SELECT
          no,
          id,
          name,
          email,
          company_part,
          permissions,
          address,
          distance_detail_json
        FROM innomax_users
        WHERE no = $1
        LIMIT 1
      `,
        [no]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[users][GET /api/users/:no] 에러:", err);
      return res
        .status(500)
        .json({ ok: false, error: String(err?.message || err) });
    }
  });

  /* 3. 사용자 추가: POST /api/users */
  router.post("/", async (req: Request, res: Response) => {
    const {
      Name,
      ID,
      password,
      email,
      company_part,
      permissions,
      address,
      distance_detail,
    } = req.body ?? {};

    if (!Name || !ID || !password) {
      return res
        .status(400)
        .json({ error: "Name, ID, password 는 필수입니다." });
    }

    try {
      // ID 중복 체크
      const dup = await pool.query(
        `SELECT 1 FROM innomax_users WHERE id = $1 LIMIT 1`,
        [ID]
      );
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: "이미 존재하는 ID 입니다." });
      }

      const result = await pool.query(
        `
        INSERT INTO innomax_users (
          id,
          name,
          password_hash,
          email,
          company_part,
          permissions,
          address,
          distance_detail_json
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING
          no,
          id,
          name,
          email,
          company_part,
          permissions,
          address,
          distance_detail_json
      `,
        [
          ID,
          Name,
          password,               // 지금은 평문 사용 (login 이랑 맞춤)
          email ?? null,
          company_part ?? null,
          permissions ?? null,
          address ?? null,
          distance_detail ?? null,
        ]
      );

      return res.json({ ok: true, user: result.rows[0] });
    } catch (err: any) {
      console.error("[users][POST /api/users] 에러:", err);
      return res
        .status(500)
        .json({ ok: false, error: String(err?.message || err) });
    }
  });

  /* 4. 사용자 수정: PUT /api/users/:no */
  router.put("/:no", async (req: Request, res: Response) => {
    const no = Number(req.params.no);
    if (!Number.isFinite(no)) {
      return res.status(400).json({ error: "잘못된 no 값" });
    }

    const {
      Name,
      ID,
      password,
      email,
      company_part,
      permissions,
      address,
      distance_detail,
    } = req.body ?? {};

    if (!Name || !ID) {
      return res
        .status(400)
        .json({ error: "Name, ID 는 필수입니다." });
    }

    try {
      // ID 중복 체크 (자기 자신 제외)
      const dup = await pool.query(
        `SELECT no FROM innomax_users WHERE id = $1 AND no <> $2 LIMIT 1`,
        [ID, no]
      );
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: "이미 존재하는 ID 입니다." });
      }

      const params: any[] = [
        ID,
        Name,
        email ?? null,
        company_part ?? null,
        permissions ?? null,
        address ?? null,
        distance_detail ?? null,
      ];

      let sql = `
        UPDATE innomax_users
        SET
          id                  = $1,
          name                = $2,
          email               = $3,
          company_part        = $4,
          permissions         = $5,
          address             = $6,
          distance_detail_json= $7,
          updated_at          = now()
      `;

      if (password) {
        sql += `,
          password_hash = $8
        WHERE no = $9
        RETURNING
          no,
          id,
          name,
          email,
          company_part,
          permissions,
          address,
          distance_detail_json`;
        params.push(password);
        params.push(no);
      } else {
        sql += `
        WHERE no = $8
        RETURNING
          no,
          id,
          name,
          email,
          company_part,
          permissions,
          address,
          distance_detail_json`;
        params.push(no);
      }

      const result = await pool.query(sql, params);

      return res.json({ ok: true, user: result.rows[0] });
    } catch (err: any) {
      console.error("[users][PUT /api/users/:no] 에러:", err);
      return res
        .status(500)
        .json({ ok: false, error: String(err?.message || err) });
    }
  });

  /* 5. 사용자 삭제: DELETE /api/users/:no */
  router.delete("/:no", async (req: Request, res: Response) => {
    const no = Number(req.params.no);
    if (!Number.isFinite(no)) {
      return res.status(400).json({ error: "잘못된 no 값" });
    }

    try {
      await pool.query(`DELETE FROM innomax_users WHERE no = $1`, [no]);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[users][DELETE /api/users/:no] 에러:", err);
      return res
        .status(500)
        .json({ ok: false, error: String(err?.message || err) });
    }
  });

  return router;
}
