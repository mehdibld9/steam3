import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Browse from "./pages/browse";
import Leaderboard from "./pages/leaderboard";
import AccountDetail from "./pages/account-detail";
import Profile from "./pages/profile";
import Submit from "./pages/submit";
import Admin from "./pages/admin";
import Earn from "./pages/earn";
import Login from "./pages/login";
import Register from "./pages/register";
import Giveaways from "./pages/giveaways";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import Banned from "./pages/banned";
import Messages from "./pages/messages";
import EditProfile from "./pages/edit-profile";
import Store from "./pages/store";
import ProductDetail from "./pages/product-detail";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  return null;
}

function BannedGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 30_000,
  });

  // If banned and not already on the banned page, redirect there
  if (user?.isBanned && location !== "/banned") {
    window.location.replace("/banned");
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/browse" component={Browse} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/accounts/:id" component={AccountDetail} />
      <Route path="/profile/:id" component={Profile} />
      <Route path="/submit" component={Submit} />
      <Route path="/admin" component={Admin} />
      <Route path="/earn" component={Earn} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/giveaways" component={Giveaways} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/banned" component={Banned} />
      <Route path="/store" component={Store} />
      <Route path="/store/:id" component={ProductDetail} />
      <Route path="/messages" component={Messages} />
      <Route path="/edit-profile" component={EditProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base="">
            <BannedGuard>
              <ScrollToTop />
              <Router />
            </BannedGuard>
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
