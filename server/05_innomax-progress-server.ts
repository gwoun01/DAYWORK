// server/innomax-progress-server.ts

import express from "express";
import { Pool } from "pg";

export default function innomaxProgressRouter(pool: Pool) {
    const router = express.Router();

    // ==============================
    // 유틸: JSON 값 안전하게 읽기
    // ==============================
    function safeText(obj: any, key: string, def: string = ""): string {
        if (!obj || typeof obj[key] === "undefined" || obj[key] === null) return def;
        return String(obj[key]);
    }

    function safeNumber(obj: any, key: string, def: number = 0): number {
        if (!obj || typeof obj[key] === "undefined" || obj[key] === null) return def;
        const n = Number(obj[key]);
        return isNaN(n) ? def : n;
    }

    // ============================================
    // 1) 내 업무 조회: GET /api/my-works?userId=...
    // ============================================
    router.get("/my-works", async (req, res) => {
        const userId = String(req.query.userId || "").trim();

        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }

        console.log("\n==============================");
        console.log("📌 [my-works] userId =", userId);
        console.log("==============================");

        try {
            const query = `
                SELECT id, detail_json
                FROM innomax_works
                WHERE EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(COALESCE(detail_json->'employees', '[]'::jsonb)) emp
                    WHERE emp->>'id' = $1 OR emp->>'name' = $1
                )
            `;


            console.log("📡 실행 SQL:");
            console.log(query);
            console.log("📡 SQL 바인딩 파라미터:", [userId]);

            const { rows } = await pool.query(query, [userId]);

            console.log(`📌 조회 결과 ${rows.length}건`);
            rows.forEach((row, index) => {
                console.log(`------------------------------------------`);
                console.log(`📌 row #${index + 1}`);
                console.log("id:", row.id);
                console.log("detail_json:", JSON.stringify(row.detail_json, null, 2));

                // employees 배열 확인
                const employees = row.detail_json?.employees;
                console.log("employees:", employees);

                if (Array.isArray(employees)) {
                    employees.forEach((emp, idx) => {
                        console.log(`  - employee #${idx + 1}:`, emp);
                    });
                } else {
                    console.log("⚠ employees 배열이 아님 또는 없음:", employees);
                }
            });

            // 변환 결과 로그
            console.log("\n📌 변환 후 결과(result):");

            const result = rows.map(row => {
                const d = row.detail_json || {};
                const logs = Array.isArray(d.progress_logs) ? d.progress_logs : [];

                const myLogs = logs.filter((x: any) => x.user_id === userId);
                const latest = myLogs.length > 0 ? myLogs[myLogs.length - 1] : null;

                const obj = {
                    id: row.id,
                    orderNo: safeText(d, "orderNo", "-"),
                    category: safeText(d, "category", "-"),
                    clientName: safeText(d, "clientName", "-"),
                    startDate: safeText(d, "startDate", ""),
                    endDate: safeText(d, "endDate", ""),
                    employees: Array.isArray(d.employees) ? d.employees : [],
                    instruction: safeText(d, "instruction", ""),

                    latest_progress: latest
                        ? {
                            progress_status: latest.progress_status,
                            progress_percent: latest.progress_percent,
                            latest_report_at: latest.created_at
                        }
                        : null
                };

                console.log("  > 변환된 객체:", obj);
                return obj;
            });

            console.log("📤 최종 전송 result:", JSON.stringify(result, null, 2));

            res.json(result);

        } catch (err) {
            console.error("❌ [GET /api/my-works] error:", err);
            res.status(500).json({ error: "internal server error" });
        }
    });

    // 📌 단일 업무 조회 API
    router.get("/my-works-detail/:id", async (req, res) => {
        try {
            const { id } = req.params;

            const query = `
            SELECT *
            FROM innomax_works
            WHERE id = $1
        `;

            const result = await pool.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "NOT_FOUND" });
            }

            res.json(result.rows[0]);

        } catch (err) {
            console.error("❌ [GET /api/innomax-works/:orderNo] error:", err);
            res.status(500).json({ error: "SERVER_ERROR" });
        }
    });



    // ==========================================================
    // 2) 내 진행 히스토리 조회: GET /api/work/:workId/my-progress
    // ==========================================================
    router.get("/work/:workId/my-progress", async (req, res) => {
        const workId = req.params.workId;
        const userId = String(req.query.userId || "").trim();

        if (!workId || !userId) {
            return res.status(400).json({ error: "workId and userId are required" });
        }

        try {
            const q = `SELECT detail_json FROM innomax_works WHERE id = $1`;
            const { rows } = await pool.query(q, [workId]);

            if (rows.length === 0) {
                return res.status(404).json({ error: "work not found" });
            }

            const d = rows[0].detail_json || {};
            const logs = Array.isArray(d.progress_logs) ? d.progress_logs : [];

            // 해당 user 의 로그만
            const myLogs = logs.filter((x: any) => x.user_id === userId);

            const latest = myLogs.length > 0 ? myLogs[myLogs.length - 1] : null;

            res.json({
                history: myLogs,
                latest: latest
                    ? {
                        progress_status: latest.progress_status,
                        progress_percent: latest.progress_percent,
                        created_at: latest.created_at
                    }
                    : null
            });
        } catch (err) {
            console.error("❌ [GET /my-progress] error:", err);
            res.status(500).json({ error: "internal server error" });
        }
    });


    // ==================================================================
    // 📌 진행상황 저장 API
    // ==================================================================
    router.post("/work/progress-update/:currentWorkId", async (req, res) => {
        const client = await pool.connect();

        try {
            const { currentWorkId } = req.params;

            const {
                work_id,
                user_id,
                date,
                progress_status,
                progress_percent,
                report_text,
                attached_file_url,
            } = req.body;

            console.log("📡 [progress/save] params =", currentWorkId);
            console.log("📡 [progress/save] body =", req.body);

            // ⚠️ 파라미터 ID와 body 의 work_id 불일치 대비
            const finalWorkId = work_id ?? currentWorkId;

            // 1) 기존 detail_json 조회
            const q1 = `
            SELECT detail_json
            FROM innomax_works
            WHERE id = $1
            `;
            const r1 = await client.query(q1, [finalWorkId]);

            if (r1.rows.length === 0) {
                return res.status(404).json({ error: "WORK_NOT_FOUND" });
            }

            // 기존 detail_json
            const detail = r1.rows[0].detail_json || {};

            // 진행상황 버퍼 생성
            if (!detail.progress_buffer) detail.progress_buffer = {};

            // 날짜 버퍼 생성
            if (!detail.progress_buffer[date]) {
                detail.progress_buffer[date] = {};
            }

            // 직원별 진행상황 업데이트
            detail.progress_buffer[date][user_id] = {
                status: progress_status,
                percent: progress_percent,
                review: report_text,
                file_url: attached_file_url,
            };

            // 2) DB 업데이트
            const q2 = `
            UPDATE innomax_works
            SET detail_json = $1
            WHERE id = $2
        `;
            await client.query(q2, [detail, finalWorkId]);

            console.log("✅ [progress/save] 업데이트 완료");

            res.json({ success: true });

        } catch (err) {
            console.error("❌ [progress/save] 에러:", err);
            res.status(500).json({ error: "SERVER_ERROR" });
        } finally {
            client.release();
        }
    });



    return router;
}
