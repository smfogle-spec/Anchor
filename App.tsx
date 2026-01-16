import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundaryRecovery } from "@/components/error-boundary-recovery";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Login from "@/pages/login";
import ClientInfo from "@/pages/client-info";
import StaffInfo from "@/pages/staff-info";
import Template from "@/pages/template";
import IdealDay from "@/pages/ideal-day";
import DailyRun from "@/pages/daily-run";
import Schedule from "@/pages/schedule";
import ChangeLog from "@/pages/change-log";
import TrainingPlan from "@/pages/training-plan";
import OrgChart from "@/pages/org-chart";

const ScenarioLab = lazy(() => import("@/pages/scenario-lab"));
const PerformanceDashboard = lazy(() => import("@/pages/performance-dashboard"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Home} />
      <Route path="/clients" component={ClientInfo} />
      <Route path="/staff" component={StaffInfo} />
      <Route path="/template" component={Template} />
      <Route path="/ideal-day" component={IdealDay} />
      <Route path="/training" component={TrainingPlan} />
      <Route path="/daily" component={DailyRun} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/schedule/changes" component={ChangeLog} />
      <Route path="/org-chart" component={OrgChart} />
      <Route path="/lab">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <ScenarioLab />
          </Suspense>
        )}
      </Route>
      <Route path="/performance">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <PerformanceDashboard />
          </Suspense>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundaryRecovery fallbackMessage="The application encountered an unexpected error. Your data has been preserved.">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundaryRecovery>
  );
}

export default App;
