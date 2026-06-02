import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import Badges from "./pages/badges";
import Giveaways from "./pages/giveaways";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";

const queryClient = new QueryClient();

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
      <Route path="/badges" component={Badges} />
      <Route path="/giveaways" component={Giveaways} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
