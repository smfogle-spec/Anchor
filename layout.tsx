import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LogOut, LayoutDashboard, Users, UserCog, CalendarDays, Play, Calendar, FlaskConical, Menu, X, GraduationCap, Network, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logoImage from '@assets/generated_images/modern_abstract_logo_for_a_scheduling_app_named_anchor.png';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/staff", label: "Staff", icon: UserCog },
    { href: "/template", label: "Template", icon: CalendarDays },
    { href: "/ideal-day", label: "Ideal Day", icon: Clock },
    { href: "/training", label: "Training", icon: GraduationCap },
    { href: "/daily", label: "Daily Run", icon: Play },
    { href: "/schedule", label: "Schedule", icon: Calendar },
    { href: "/org-chart", label: "Org Chart", icon: Network },
    { href: "/lab", label: "Lab", icon: FlaskConical },
  ];

  const NavLink = ({ item, mobile = false }: { item: typeof navItems[0], mobile?: boolean }) => (
    <Link
      href={item.href}
      onClick={() => mobile && setMobileMenuOpen(false)}
      className={cn(
        "flex items-center font-medium rounded-md transition-all duration-200 whitespace-nowrap",
        mobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm",
        location === item.href
          ? "text-primary bg-primary/10 shadow-sm"
          : "text-muted-foreground hover:text-primary hover:bg-accent/50"
      )}
    >
      <item.icon className={cn(
        mobile ? "mr-3 h-5 w-5" : "mr-2 h-4 w-4", 
        location === item.href ? "text-primary" : "text-muted-foreground"
      )} />
      {item.label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Top Bar (Sticky) */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 md:h-20 items-center justify-between px-4 md:px-6">
          {/* Branding Section */}
          <div className="flex items-center gap-3 md:gap-4">
            <Link href="/" className="flex items-center gap-2 md:gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <img 
                  src={logoImage} 
                  alt="Anchor Logo" 
                  className="w-8 h-8 md:w-10 md:h-10 object-contain relative z-10"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-base md:text-xl font-bold text-primary tracking-tight leading-none">
                  <span className="hidden sm:inline">Anchor: Client Centered Scheduling</span>
                  <span className="sm:hidden">Anchor</span>
                </span>
                <span className="text-xs md:text-sm text-muted-foreground italic font-serif hidden sm:block">
                  Chaos To Calm
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-4">
            <nav className="flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
            <div className="w-px h-6 bg-border/60 mx-2"></div>
            <Link href="/login">
              <button className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <span className="font-serif text-lg font-bold text-primary">Menu</span>
                </div>
                
                {/* Mobile Navigation */}
                <nav className="flex-1 flex flex-col p-4 space-y-1">
                  {navItems.map((item) => (
                    <NavLink key={item.href} item={item} mobile />
                  ))}
                </nav>
                
                {/* Mobile Footer */}
                <div className="p-4 border-t">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <button className="flex items-center w-full px-4 py-3 text-base font-medium rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Status Strip - Hidden on mobile, visible on tablet+ */}
      <div className="hidden sm:block w-full border-b border-border bg-card/50 px-4 md:px-6 py-1.5 backdrop-blur-sm">
        <div className="container flex items-center justify-between text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
          <div className="flex items-center gap-4 md:gap-6">
             <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
               <span>Last Generated: <span className="text-foreground">Today, 08:30 AM</span></span>
             </div>
             <span>Pending Approvals: <span className="text-foreground font-bold">2</span></span>
          </div>
          <div className="flex items-center gap-4 md:gap-6 hidden md:flex">
             <span>Unfilled Slots: <span className="text-foreground">0</span></span>
             <span>Data Warnings: <span className="text-foreground">0</span></span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-4 md:py-8 px-4 md:px-6 animate-in fade-in duration-500">
        {children}
      </main>
    </div>
  );
}
