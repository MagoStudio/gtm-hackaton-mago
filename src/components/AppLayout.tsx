import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 h-12 flex items-center border-b border-border/40 bg-background/80 backdrop-blur-md px-2">
            <SidebarTrigger />
          </header>
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
