import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Mail,
  Brain,
  Building2,
  FileCheck,
  Shield,
  Smartphone,
  Clock,
  Zap,
  CheckCircle,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const stats = [
  { value: "10s", label: "Spracovanie dokladu" },
  { value: "95%+", label: "Presnosť AI" },
  { value: "3×", label: "Rýchlejšia uzávierka" },
  { value: "500+", label: "Klientov na účtovníka" },
];

const features = [
  {
    icon: Mail,
    title: "E-mailový agent",
    desc: "Automaticky monitoruje emaily klientov a sťahuje prílohy s faktúrami.",
  },
  {
    icon: Brain,
    title: "AI extrakcia dát",
    desc: "Rozpozná typ dokladu, dodávateľa, sumy, DPH, dátumy — všetko automaticky.",
  },
  {
    icon: Building2,
    title: "Bankové párovanie",
    desc: "Prepojenie s bankou cez open banking, automatické spárovanie transakcií s dokladmi.",
  },
  {
    icon: FileCheck,
    title: "DPH prehľad",
    desc: "Kompletný prehľad o stave DPH za každého klienta s deadlinom do 25. v mesiaci.",
  },
  {
    icon: Shield,
    title: "Bezpečnosť & GDPR",
    desc: "Dáta uložené v EU, šifrovaný prístup, plná zhoda s GDPR nariadením.",
  },
  {
    icon: Smartphone,
    title: "Klientský portál",
    desc: "Klient jednoducho nahrá doklad mobilom alebo počítačom — kedykoľvek, odkiaľkoľvek.",
  },
];

const steps = [
  {
    step: "01",
    title: "Pridajte klientov",
    desc: "Pridajte klientov a pošlite im pozvánku. Klient si pripojí email a banku.",
  },
  {
    step: "02",
    title: "AI zbiera a spracováva",
    desc: "AI automaticky zbiera doklady z emailov a bánk, extrahuje všetky údaje.",
  },
  {
    step: "03",
    title: "Schváľte a podajte DPH",
    desc: "Vy len skontrolujete extrahované dáta, schválite doklady a podáte DPH.",
  },
];

const plans = [
  {
    name: "Štart",
    price: "29",
    period: "mesiac",
    docs: "do 100 dokladov",
    features: ["AI extrakcia", "Emailový agent", "Klientský portál", "5 klientov"],
    highlighted: false,
  },
  {
    name: "Profesionál",
    price: "79",
    period: "mesiac",
    docs: "do 500 dokladov",
    features: ["Všetko zo Štartu", "Bankové párovanie", "DPH prehľad", "50 klientov", "Prioritná podpora"],
    highlighted: true,
  },
  {
    name: "Kancelária",
    price: "149",
    period: "mesiac",
    docs: "neobmedzené doklady",
    features: ["Všetko z Profesionála", "API integrácie", "Neobmedzení klienti", "Dedikovaná podpora"],
    highlighted: false,
  },
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
      {/* Navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md transition-transform duration-300 ${
          scrolled ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-base sm:text-lg font-bold tracking-tight text-primary">fantozzi</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#funkcie" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Funkcie</a>
            <a href="#ako-to-funguje" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Ako to funguje</a>
            <a href="#cennik" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Cenník</a>
          </nav>
          <div className="hidden sm:flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Mám už účet</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">
                Začať zadarmo <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-none p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground sm:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-border/40 bg-background px-4 py-4 space-y-3 sm:hidden">
            <a href="#funkcie" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground min-h-[44px] flex items-center">Funkcie</a>
            <a href="#ako-to-funguje" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground min-h-[44px] flex items-center">Ako to funguje</a>
            <a href="#cennik" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground min-h-[44px] flex items-center">Cenník</a>
            <Button asChild variant="ghost" className="w-full justify-start min-h-[44px]">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Mám už účet</Link>
            </Button>
            <Button asChild className="w-full min-h-[44px]">
              <Link to="/register" onClick={() => setMobileMenuOpen(false)}>Začať zadarmo</Link>
            </Button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-16 sm:pt-24 pb-32 sm:pb-40 text-center overflow-hidden bg-gradient-to-br from-[#002333] via-[#003345] to-[#004455]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-4xl animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-primary">fantozzi</span>
          </div>

          <h1 className="mt-5 sm:mt-6 text-2xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-[1.15]">
            Váš klient klikne raz.
            <br />
            <span className="text-primary">Vy už nikdy nežiadate doklady.</span>
          </h1>

          <p className="mx-auto mt-4 sm:mt-5 max-w-2xl text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed px-2">
            fantozzi automaticky zbiera faktúry z emailov, AI extrahuje dáta,
            páruje s bankovými výpismi a pripravuje DPH. Vy len schvaľujete.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 shadow-lg shadow-primary/30 w-full sm:w-auto min-h-[44px]">
              <Link to="/register">
                Začať zadarmo <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" className="border-2 border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm px-6 w-full sm:w-auto min-h-[44px]">
              <Link to="/login">Mám už účet</Link>
            </Button>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" />Bez kreditnej karty</span>
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-primary" />GDPR compliant</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" />Setup za 5 minút</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 -mt-16 relative z-10 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="border-border/40 bg-card shadow-lg">
              <CardContent className="p-4 sm:p-6 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-primary">{s.value}</p>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funkcie" className="bg-muted/10 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Funkcie</span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
              Všetko čo účtovník potrebuje
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-muted-foreground px-2">
              Od automatického zberu dokladov až po prípravu DPH — fantozzi pokryje celý workflow.
            </p>
          </div>

          <div className="mt-10 sm:mt-14 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/40 bg-card/80 h-full transition-all hover:shadow-lg hover:-translate-y-1">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-none bg-primary/10">
                    <f.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="ako-to-funguje" className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Ako to funguje</span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
              Tri kroky k automatizácii
            </h2>
          </div>

          <div className="mt-10 sm:mt-14 grid gap-4 sm:gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <Card key={s.step} className="border-border/40 h-full text-center transition-all hover:shadow-lg hover:-translate-y-1">
                <CardContent className="p-5 sm:p-6 pt-6 sm:pt-8">
                  <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-none bg-primary text-lg sm:text-xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
                    {s.step}
                  </div>
                  <h3 className="mt-4 sm:mt-5 text-sm font-semibold">{s.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="cennik" className="bg-muted/10 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Cenník</span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
              Jednoduchý a transparentný cenník
            </h2>
          </div>

          <div className="mt-10 sm:mt-14 grid gap-4 sm:gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={`h-full transition-all hover:shadow-lg hover:-translate-y-1 ${plan.highlighted ? "border-primary border-2 shadow-lg shadow-primary/10" : "border-border/40"}`}>
                <CardContent className="p-5 sm:p-6">
                  {plan.highlighted && (
                    <span className="inline-block mb-3 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5">
                      Najpopulárnejší
                    </span>
                  )}
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold">{plan.price} €</span>
                    <span className="text-sm text-muted-foreground">/ {plan.period}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.docs}</p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs sm:text-sm">
                        <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className={`mt-6 w-full min-h-[44px] ${plan.highlighted ? "" : "variant-outline"}`} variant={plan.highlighted ? "default" : "outline"}>
                    <Link to="/register">Začať zadarmo</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Footer */}
      <section className="border-t border-white/10 bg-[#002333] pt-14 sm:pt-20 pb-6 sm:pb-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Prestaňte žiadať doklady.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60 px-2">
            Nastavte si fantozzi za 5 minút. Žiadna kreditná karta, žiadny komplikovaný onboarding.
          </p>
          <Button asChild size="lg" className="mt-6 sm:mt-8 px-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 w-full sm:w-auto min-h-[44px]">
            <Link to="/register">
              Začať zadarmo <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mx-auto mt-12 sm:mt-16 max-w-6xl border-t border-white/10 px-4 sm:px-6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <span className="font-bold text-primary">fantozzi</span>
          <span>© {new Date().getFullYear()} fantozzi. Všetky práva vyhradené.</span>
        </div>
      </section>
    </div>
  );
}
