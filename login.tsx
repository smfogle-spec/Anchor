import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Anchor, Lock } from "lucide-react";
import logoImage from '@assets/generated_images/modern_abstract_logo_for_a_scheduling_app_named_anchor.png';

export default function Login() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate network request
    setTimeout(() => {
      setLoading(false);
      setLocation("/");
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border-border/60 shadow-xl bg-card/80 backdrop-blur-sm z-10">
        <CardHeader className="space-y-4 flex flex-col items-center text-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
             <img 
               src={logoImage} 
               alt="Anchor Logo" 
               className="w-10 h-10 object-contain"
             />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-serif font-bold tracking-tight">Welcome to Anchor</CardTitle>
            <CardDescription className="text-base">Client Centered Scheduling</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@clinic.com" required className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <Input id="password" type="password" required className="bg-background/50" />
            </div>
            <Button type="submit" className="w-full h-10 font-medium shadow-md transition-all hover:shadow-lg" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 text-center border-t bg-muted/20 pt-6">
          <p className="text-xs text-muted-foreground">
            Protected System. Authorized Access Only.
          </p>
        </CardFooter>
      </Card>
      
      <div className="absolute bottom-6 text-center text-xs text-muted-foreground font-serif italic">
        "Chaos To Calm"
      </div>
    </div>
  );
}
