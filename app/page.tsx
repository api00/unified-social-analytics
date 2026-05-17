import DashboardShell from "../components/DashboardShell";
import { getCurrentUser } from "../lib/current-user";
import { hasAuthEnv } from "../lib/env";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <DashboardShell
      initialUser={user}
      authConfigured={hasAuthEnv()}
    />
  );
}
