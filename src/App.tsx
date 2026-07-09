import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Pipeline from "./pages/Pipeline";
import Sequences from "./pages/Sequences";
import IcpEdit from "./pages/IcpEdit";
import LeadGen from "./pages/agents/LeadGen";
import CrmAgent from "./pages/agents/CrmAgent";
import QuoteBuilder from "./pages/QuoteBuilder";
import QuoteDetail from "./pages/QuoteDetail";
import QuoteSettings from "./pages/QuoteSettings";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/icp/new" element={<IcpEdit />} />
            <Route path="/icp/:id" element={<IcpEdit />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/sequences" element={<Sequences />} />
            {/* Lead Gen tooling powers the ICP flow; CRM + quote routes are
                reachable via deep links inside the pipeline deal panel. */}
            <Route path="/agents/lead-gen" element={<LeadGen />} />
            <Route path="/agents/crm" element={<CrmAgent />} />
            <Route path="/quotes/new" element={<QuoteBuilder />} />
            <Route path="/quotes/settings" element={<QuoteSettings />} />
            <Route path="/quotes/:id" element={<QuoteDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
