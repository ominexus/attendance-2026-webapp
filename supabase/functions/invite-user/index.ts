// 마일스톤 4: 관리자 전용 사용자 초대 Edge Function
//
// 동작
// 1. 호출자 JWT 로 일반 클라이언트를 만들고 profiles.role='admin' 검증
// 2. service_role 키로 Admin Client 를 만들어 inviteUserByEmail 호출
// 3. 초대 메일 본문의 링크는 redirectTo (앱 도메인 + /set-password) 로 이동
//
// 환경변수
//   SUPABASE_URL              (자동 주입)
//   SUPABASE_ANON_KEY         (자동 주입)
//   SUPABASE_SERVICE_ROLE_KEY (자동 주입)
//   APP_PUBLIC_URL            (수동 등록: 예 https://ominexus.github.io/attendance-2026-webapp)
//
// 배포: supabase functions deploy invite-user --no-verify-jwt=false

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "missing bearer token" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const APP_URL = Deno.env.get("APP_PUBLIC_URL") ??
      "https://ominexus.github.io/attendance-2026-webapp";

    // 1. 호출자 admin 검증
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

    const { data: prof, error: profErr } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (profErr) return json({ error: profErr.message }, 403);
    if (prof.role !== "admin") return json({ error: "admin only" }, 403);

    // 2. 본문 파싱
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const display_name = body.display_name ? String(body.display_name) : null;
    const role: "admin" | "teacher" = body.role === "admin" ? "admin" : "teacher";
    if (!email) return json({ error: "email required" }, 400);

    // 3. service_role 로 invite
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const redirectTo = `${APP_URL}/set-password`;
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name, role },
      redirectTo,
    });
    if (invErr) return json({ error: invErr.message }, 400);

    // 4. 트리거가 profiles 자동 생성 후, role 보정
    if (inv.user) {
      await admin
        .from("profiles")
        .update({ display_name, role })
        .eq("id", inv.user.id);
    }

    return json({ ok: true, user_id: inv.user?.id, redirect_to: redirectTo });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
