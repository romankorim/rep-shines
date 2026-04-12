import { createFileRoute, Link } from "@tanstack/react-router";
import heroBg from "@/assets/hero-bg.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Calculator,
  Settings,
  BarChart3,
  Users,
  ArrowRight,
  DollarSign,
  FileText,
  CheckCircle,
  Zap,
  Shield,
  Clock,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const metrics = [
  { label: "Total commissions", value: "$284,500", icon: DollarSign, change: "+12.3%", accent: "text-primary bg-primary/10" },
  { label: "Deals closed", value: "47", icon: FileText, change: "+8 this month", accent: "text-[#7C5CFC] bg-[#7C5CFC]/10" },
  { label: "Avg deal size", value: "$38,200", icon: TrendingUp, change: "+5.1%", accent: "text-[#F59E0B] bg-[#F59E0B]/10" },
  { label: "Active reps", value: "12", icon: Users, change: "3 teams", accent: "text-primary bg-primary/10" },
];

const features = [
  {
    icon: Calculator,
    title: "Instant commission engine",
    desc: "The moment a deal closes, payouts calculate automatically. No formulas, no spreadsheets, no waiting until end-of-month.",
  },
  {
    icon: Settings,
    title: "Flexible comp plan builder",
    desc: "Build tiered structures, set deal-size brackets, assign effective dates — update plans without breaking historical data.",
  },
  {
    icon: BarChart3,
    title: "Smart quota tiers",
    desc: "Reps automatically slot into attainment tiers with rate multipliers. Accelerators reward overperformance in real time.",
  },
  {
    icon: Users,
    title: "Full rep visibility",
    desc: "Every rep gets a personal dashboard showing their deals, attainment trajectory, and projected payouts for the period.",
  },
];

const steps = [
  {
    step: "01",
    title: "Set up your comp plans",
    desc: "Define commission tiers, rate multipliers, and quota targets. Changes take effect immediately — no deploy needed.",
    icon: Settings,
  },
  {
    step: "02",
    title: "Log deals as they close",
    desc: "Add deals with size, rep, and close date. The engine applies the right tier and calculates commissions on the spot.",
    icon: FileText,
  },
  {
    step: "03",
    title: "Track payouts in real time",
    desc: "Dashboards update live. Filter by rep, team, or period. Export when finance needs the numbers.",
    icon: BarChart3,
  },
];

const trustPoints = [
  { icon: Zap, text: "Sub-second calculations" },
  { icon: Shield, text: "Role-based access control" },
  { icon: Clock, text: "Full audit trail" },
];

function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar - hidden until scrolled */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md transition-transform duration-300 ${
          scrolled ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary transition-transform group-hover:scale-105" />
            <span className="text-sm sm:text-base font-semibold tracking-tight">CommCalc</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</a>
          </nav>
          <div className="hidden sm:flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">
                Get started <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground sm:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-border/40 bg-background px-4 py-4 space-y-3 sm:hidden">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground min-h-[44px] flex items-center">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground min-h-[44px] flex items-center">How it works</a>
            <Button asChild variant="ghost" className="w-full justify-start min-h-[44px]">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
            </Button>
            <Button asChild className="w-full min-h-[44px]">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                Get started <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-16 sm:pt-24 pb-32 sm:pb-40 text-center overflow-hidden">
        <img src={heroBg} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" width={1920} height={1080} loading="eager" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#002333]/70 via-[#002333]/60 to-[#002333]/80" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#000]/95 via-[#00131d]/60 to-transparent" />

        <div className="relative mx-auto max-w-6xl animate-fade-in">
          {/* Inline logo in hero */}
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            <span className="text-lg sm:text-xl font-semibold tracking-tight text-white">CommCalc</span>
          </div>

          <h1 className="mt-5 sm:mt-6 text-2xl sm:text-4xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.1] animate-fade-in" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
            Stop guessing commissions.
            <br />
            <span className="text-[#DEEFE7]">Start calculating them.</span>
          </h1>

          <p className="mx-auto mt-4 sm:mt-5 max-w-2xl text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed px-2 animate-fade-in" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
            CommCalc replaces your spreadsheet with a real-time commission engine.
            Configure comp plans, log deals, and watch payouts calculate instantly —
            so your team always knows where they stand.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
            <Button asChild size="lg" className="bg-white text-[#002333] hover:bg-white/90 px-6 shadow-lg shadow-black/20 w-full sm:w-auto min-h-[44px]">
              <Link to="/login">
                Start for free <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" className="border-2 border-white bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm px-6 w-full sm:w-auto min-h-[44px]">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          {/* Trust points */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-white/60 animate-fade-in" style={{ animationDelay: "0.4s", animationFillMode: "both" }}>
            {trustPoints.map((t) => (
              <span key={t.text} className="flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5 text-[#DEEFE7]" />
                {t.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive dashboard preview - overlapping hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 -mt-20 sm:-mt-28 relative z-10 pb-16 sm:pb-24">
        <div className="relative rounded-xl sm:rounded-2xl border border-border/50 bg-card p-1 shadow-2xl shadow-primary/5 animate-fade-in" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
          {/* Fake browser bar */}
          <div className="flex items-center gap-2 border-b border-border/30 px-3 sm:px-4 py-2 sm:py-2.5">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-destructive/40" />
              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-warning/40" />
              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-success/40" />
            </div>
            <div className="ml-2 sm:ml-3 flex-1 rounded-md bg-muted/50 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
              app.commcalc.io/dashboard
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
              {metrics.map((m, i) => (
                <div
                  key={m.label}
                  className="rounded-lg sm:rounded-xl border border-border/30 bg-background/60 p-2.5 sm:p-4 cursor-default transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-in"
                  style={{ animationDelay: `${0.3 + i * 0.1}s`, animationFillMode: "both" }}
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-md sm:rounded-lg ${m.accent.split(" ").slice(1).join(" ")}`}>
                      <m.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${m.accent.split(" ")[0]}`} />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-medium text-success">{m.change}</span>
                  </div>
                  <p className="mt-2 sm:mt-3 text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  <p className="text-lg sm:text-2xl font-bold tracking-tight">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Fake chart + table area */}
            <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="sm:col-span-2 h-24 sm:h-32 rounded-lg sm:rounded-xl border border-border/20 flex items-end p-3 sm:p-4 gap-1">
                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => {
                  const barColors = [
                    "bg-primary", "bg-[#7C5CFC]", "bg-primary/80", "bg-[#F59E0B]",
                    "bg-primary", "bg-[#7C5CFC]", "bg-[#F59E0B]/80", "bg-primary",
                    "bg-[#7C5CFC]/80", "bg-primary", "bg-[#F59E0B]", "bg-[#7C5CFC]",
                  ];
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t-sm ${barColors[i]} animate-fade-in`}
                      style={{ height: `${h}%`, animationDelay: `${0.5 + i * 0.05}s`, animationFillMode: "both" }}
                    />
                  );
                })}
              </div>
              <div className="h-24 sm:h-32 rounded-lg sm:rounded-xl border border-border/20 bg-muted/20 p-3 flex flex-col justify-between">
                {["Sarah K.", "Mike T.", "Priya R."].map((name, i) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-semibold animate-fade-in" style={{ animationDelay: `${0.7 + i * 0.15}s`, animationFillMode: "both" }}>
                      {["$42k", "$38k", "$35k"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/10 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Features
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
              Built for how you actually work
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-muted-foreground px-2">
              No more reconciling formulas at month-end. CommCalc handles the math
              so your team can focus on closing.
            </p>
          </div>

          <div className="mt-10 sm:mt-14 grid gap-4 sm:gap-5 sm:grid-cols-2">
            {features.map((f, i) => (
              <div key={f.title} className="animate-fade-in" style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "both" }}>
                <Card className="border-border/40 bg-card/80 backdrop-blur-sm h-full transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <f.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{f.title}</h3>
                        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              How it works
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
              Three steps to accurate payouts
            </h2>
          </div>

          <div className="mt-10 sm:mt-14 grid gap-4 sm:gap-6 sm:grid-cols-3">
            {steps.map((s, i) => {
              const colors = [
                { bg: "bg-primary", shadow: "shadow-primary/20", text: "text-white" },
                { bg: "bg-[#7C5CFC]", shadow: "shadow-[#7C5CFC]/20", text: "text-white" },
                { bg: "bg-[#F59E0B]", shadow: "shadow-[#F59E0B]/20", text: "text-white" },
              ];
              const c = colors[i];
              return (
                <div key={s.step} className="animate-fade-in" style={{ animationDelay: `${i * 0.12}s`, animationFillMode: "both" }}>
                  <Card className="border-border/40 h-full text-center transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
                    <CardContent className="p-5 sm:p-6 pt-6 sm:pt-8">
                      <div className={`mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl ${c.bg} text-lg sm:text-xl font-bold ${c.text} shadow-lg ${c.shadow}`}>
                        {s.step}
                      </div>
                      <h3 className="mt-4 sm:mt-5 text-sm font-semibold">{s.title}</h3>
                      <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA banner + Footer */}
      <section className="border-t border-white/10 bg-[#002333] pt-14 sm:pt-20 pb-6 sm:pb-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center animate-fade-in">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-primary/20">
            <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          </div>
          <h2 className="mt-4 sm:mt-5 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Ready to ditch the spreadsheet?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60 px-2">
            Set up in under 5 minutes. No credit card, no complex onboarding —
            just accurate commissions from day one.
          </p>
          <Button asChild size="lg" className="mt-6 sm:mt-8 px-8 bg-white text-[#002333] hover:bg-white/90 shadow-md shadow-black/20 w-full sm:w-auto min-h-[44px]">
            <Link to="/login">
              Get started free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        {/* Footer */}
        <div className="mx-auto mt-14 sm:mt-20 flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 px-4 sm:px-6 pt-6 sm:pt-8">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-white">CommCalc</span>
          </div>
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} CommCalc. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
