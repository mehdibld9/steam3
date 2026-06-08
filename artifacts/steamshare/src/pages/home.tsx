import { useListAccounts, useGetStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AccountCard } from "@/components/account-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ShieldCheck, Users, Gamepad2, TrendingUp } from "lucide-react";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: accountsData, isLoading: accountsLoading } = useListAccounts({ sort: "recent", limit: 12 });

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="container relative z-10 mx-auto px-4 py-20 md:py-32 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground mb-6 leading-tight">
            Welcome to{" "}
            <span className="text-primary">Steam Family</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-10">
            Share unused Steam libraries, claim games you want, and rise through the ranks in the most active gaming exchange.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/browse">
              <Button size="lg" className="font-bold px-8 h-12" data-testid="button-browse-hero">
                Explore Accounts
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="font-bold px-8 h-12 border-border hover:border-primary/50" data-testid="button-join-hero">
                Join Community
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mt-16 w-full max-w-3xl">
            {[
              { icon: Users, label: "Active Users", value: stats?.totalUsers },
              { icon: Gamepad2, label: "Accounts Shared", value: stats?.totalAccounts },
              { icon: ShieldCheck, label: "Claims Made", value: stats?.totalClaims },
              { icon: TrendingUp, label: "Points in Circulation", value: stats?.totalPointsCirculating },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center p-4 bg-card border border-border rounded-xl">
                <stat.icon className="h-5 w-5 text-primary mb-2" />
                {statsLoading ? (
                  <Skeleton className="h-7 w-14 mb-1" />
                ) : (
                  <span className="text-xl font-bold font-mono">{stat.value?.toLocaleString() ?? "—"}</span>
                )}
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide text-center">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Accounts */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center mb-8">
          <h2 className="text-2xl font-bold flex items-center gap-2 justify-center">
            <span className="w-2 h-6 bg-primary rounded-sm inline-block" />
            Latest Accounts
          </h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Freshly dropped accounts ready to be claimed.
          </p>
        </div>

        <div className="flex justify-end mb-4 -mt-2">
          <Link href="/browse">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              View All →
            </Button>
          </Link>
        </div>

        {accountsLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {accountsData?.accounts?.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
            {(accountsData?.accounts?.length ?? 0) === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No accounts yet. Be the first to upload!
              </div>
            )}
          </div>
        )}
      </section>
    </Layout>
  );
}
