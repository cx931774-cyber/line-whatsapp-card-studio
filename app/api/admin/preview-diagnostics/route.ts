import { database, getSessionUser } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (user?.role !== "admin") return Response.json({error:"無權存取"},{status:403});
  const probe = new URL(request.url).searchParams.get("probe") || "";
  if (!/^[a-f0-9]{16}$/.test(probe)) return Response.json({error:"Invalid probe"},{status:400});
  const rows = await database().prepare("SELECT path, method, user_agent, status, created_at FROM preview_diagnostics WHERE probe = ? ORDER BY id DESC LIMIT 100").bind(probe).all();
  return Response.json(rows.results,{headers:{"Cache-Control":"no-store"}});
}
