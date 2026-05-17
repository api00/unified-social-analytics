import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/current-user";
import { syncAllXAccountsForUser } from "../../../../lib/x/sync";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before syncing X." }, { status: 401 });

  const result = await syncAllXAccountsForUser(user.id);
  return NextResponse.json({ synced: result.ok, attempted: result.attempted });
}
