import { useListAccounts, useGetStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AccountCard } from "@/components/account-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Users, Gamepad2, ShieldCheck, TrendingUp } from "lucide-react";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: accountsData, isLoading: accountsLoading } = useListAccounts({ sort: "recent", limit: 12 });

  return (
    <Layout>
      {/* Full dark circuit background */}
      <div className="circuit-bg min-h-screen">

        {/* Hero card section */}
        <div className="flex justify-center px-4 pt-12 pb-10">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-10 text-center">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-4 leading-tight">
              Welcome to{" "}
              <span className="text-[#00b894]">Steam Family</span>
            </h1>
            <p className="text-sm md:text-base text-gray-500 max-w-md mx-auto mb-8">
              Share unused Steam libraries, claim games you want, and rise through the ranks in the most active gaming exchange.
            </p>

            <div className="flex flex-wrap gap-3 justify-center mb-10">
              <Link href="/browse">
                <Button
                  size="lg"
                  className="font-bold px-8 h-11 bg-[#00b894] hover:bg-[#00a381] text-white"
                  data-testid="button-browse-hero"
                >
                  Explore Accounts
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-bold px-8 h-11 border-gray-200 text-gray-700 hover:border-[#00b894]/50 hover:text-[#00b894]"
                  data-testid="button-join-hero"
                >
                  Join Community
                </Button>
              </Link>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Users, label: "Active Users", value: stats?.totalUsers },
                { icon: Gamepad2, label: "Accounts Shared", value: stats?.totalAccounts },
                { icon: ShieldCheck, label: "Claims Made", value: stats?.totalClaims },
                { icon: TrendingUp, label: "Points in Circulation", value: stats?.totalPointsCirculating },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <stat.icon className="h-4 w-4 text-[#00b894] mb-1.5" />
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12 mb-1 bg-gray-200" />
                  ) : (
                    <span className="text-lg font-bold font-mono text-gray-900">
                      {stat.value?.toLocaleString() ?? "0"}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide text-center leading-tight">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Latest Accounts */}
        <div className="px-4 pb-16">
          <div className="max-w-3xl mx-auto bg-card rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <span className="w-1 h-5 bg-primary rounded-full inline-block" />
                  Latest Accounts
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Freshly dropped accounts ready to be claimed.
                </p>
              </div>
              <Link href="/browse">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 text-sm">
                  View All →
                </Button>
              </Link>
            </div>

            <div className="divide-y divide-border">
              {accountsLoading ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} className="px-6 py-4">
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                ))
              ) : (accountsData?.accounts?.length ?? 0) === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No accounts yet. Be the first to upload!
                </div>
              ) : (
                accountsData?.accounts?.map((account) => (
                  <div key={account.id} className="px-3 py-2">
                    <AccountCard account={account} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
