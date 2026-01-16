import Layout from "@/components/layout";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10 max-w-6xl mx-auto">
        
        {/* Main Content Area - Daily Run Prominent */}
        <div className="grid gap-6 md:grid-cols-12 mt-4">
          
          {/* Primary Action Card - Takes Center Stage */}
          <Card className="md:col-span-12 border-none shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 overflow-hidden group relative">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute -right-10 -top-10 bg-primary/10 w-64 h-64 rounded-full blur-3xl"></div>
            
            <CardHeader className="relative z-10">
              <CardTitle className="text-3xl font-serif font-medium">Daily Run</CardTitle>
              <CardDescription className="text-lg mt-2 max-w-lg animate-pulse text-emerald-600 dark:text-emerald-400">
                Your daily command center. Manage schedule changes, approve exceptions and finalize today's schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
            </CardContent>
            <CardFooter className="relative z-10 pt-4">
              <Link href="/daily">
                <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all rounded-full px-8 h-12 text-base group/btn">
                  <Play className="mr-2 h-4 w-4 fill-current group-hover/btn:scale-110 transition-transform" />
                  Start Daily Run
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
