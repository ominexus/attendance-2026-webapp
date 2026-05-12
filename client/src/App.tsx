import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { SelectedDateProvider } from "./contexts/SelectedDateContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Stats from "./pages/Stats";
import Roster from "./pages/Roster";
import Signup from "./pages/Signup";
import SetPassword from "./pages/SetPassword";
import PassCode from "./pages/PassCode";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Router() {
  return (
    <WouterRouter base={BASE}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/access"} component={PassCode} />
        <Route path={"/login"} component={Login} />
        <Route path={"/signup"} component={Signup} />
        <Route path={"/set-password"} component={SetPassword} />
        <Route path={"/stats"} component={Stats} />
        <Route path={"/roster"} component={Roster} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <SelectedDateProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
          </SelectedDateProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
