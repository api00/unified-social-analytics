import { NextResponse } from "next/server";
import { buildEmptyOverview } from "../../../../data/analytics";
import { getCurrentUser } from "../../../../lib/current-user";
import { getOverviewForUser } from "../../../../lib/analytics/overview";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(buildEmptyOverview());

  const overview = await getOverviewForUser(user.id);
  return NextResponse.json(overview);
}
