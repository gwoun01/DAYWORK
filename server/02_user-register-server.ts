import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";

export default function userRegisterRouter(pool: Pool) {
  const router = Router();

  // ✅ 사용자 목록 조회
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT "No","ID","Name","email","company_part","created_at","updated_at","permissions"
         FROM public.innomax_users
         ORDER BY created_at DESC NULLS LAST`
      );
      res.json(result.rows);
    } catch (err) {
      console.error("❌ 사용자 목록 조회 실패:", err);
      res.status(500).json({ error: "사용자 목록 조회 실패" });
    }
  });

  

  // ✅ 사용자 등록
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { Name, ID, password, email, company_part, permissions } = req.body;

      if (!Name || !ID || !password) {
        return res.status(400).json({ error: "Name, ID, password는 필수입니다." });
      }

      const No = uuidv4(); // ✅ 서버에서 No 자동 생성
      const now = new Date().toISOString();
      const perms = JSON.stringify(permissions ?? {});

      await pool.query(
        `INSERT INTO public.innomax_users
          ("No","ID","password_hash","Name","email","company_part","created_at","updated_at","permissions")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [No, ID, password, Name, email ?? null, company_part ?? null, now, now, perms]
      );

      res.json({ ok: true, No });
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "중복된 ID입니다." });
      }
      console.error("❌ 사용자 등록 실패:", err);
      res.status(500).json({ error: "사용자 등록 실패" });
    }
  });

  // ✅ 사용자 수정
  router.put("/:no", async (req: Request, res: Response) => {
    try {
      const { no } = req.params;
      const { Name, ID, password, email, company_part, permissions } = req.body;

      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      if (Name !== undefined) { sets.push(`"Name"=$${idx++}`); vals.push(Name); }
      if (ID !== undefined) { sets.push(`"ID"=$${idx++}`); vals.push(ID); }
      if (email !== undefined) { sets.push(`"email"=$${idx++}`); vals.push(email); }
      if (company_part !== undefined) { sets.push(`"company_part"=$${idx++}`); vals.push(company_part); }
      if (permissions !== undefined) { sets.push(`"permissions"=$${idx++}`); vals.push(JSON.stringify(permissions)); }
      if (password) { sets.push(`"password_hash"=$${idx++}`); vals.push(password); }

      sets.push(`"updated_at"=$${idx++}`); vals.push(new Date().toISOString());

      if (sets.length === 0) return res.json({ ok: true });

      vals.push(no);
      const query = `UPDATE public.innomax_users SET ${sets.join(", ")} WHERE "No"=$${idx}`;
      await pool.query(query, vals);

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ 사용자 수정 실패:", err);
      res.status(500).json({ error: "사용자 수정 실패" });
    }
  });

  // ✅ 사용자 삭제
  router.delete("/:no", async (req: Request, res: Response) => {
    try {
      const { no } = req.params;
      await pool.query(`DELETE FROM public.innomax_users WHERE "No"=$1`, [no]);
      res.json({ ok: true });
    } catch (err) {
      console.error("❌ 사용자 삭제 실패:", err);
      res.status(500).json({ error: "사용자 삭제 실패" });
    }
  });

  // ✅ 특정 사용자 조회 (수정 모달용)
  router.get("/:no", async (req: Request, res: Response) => {
    try {
      const { no } = req.params;
      const result = await pool.query(
        `SELECT "No","ID","Name","email","company_part","created_at","updated_at","permissions"
 FROM public.innomax_users WHERE "No"=$1`,
        [no]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("❌ 사용자 단일 조회 실패:", err);
      res.status(500).json({ error: "사용자 단일 조회 실패" });
    }
  });

  return router;
}
