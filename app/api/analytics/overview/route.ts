import { NextResponse, type NextRequest } from "next/server";
import { buildEmptyOverview } from "../../../../data/analytics";
import { getCurrentUser } from "../../../../lib/current-user";
import { getOverviewForUser } from "../../../../lib/analytics/overview";
import { TIME_RANGES, type TimeRange } from "../../../../types/analytics";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(buildEmptyOverview());

  const requested = new URL(request.url).searchParams.get("range") as TimeRange | null;
  const range = requested && TIME_RANGES.includes(requested) ? requested : "7d";

  const overview = await getOverviewForUser(user.id, range);
  return NextResponse.json(overview);
}
