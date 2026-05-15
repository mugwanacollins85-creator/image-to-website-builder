import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Truck, Package, MapPin, Shield, Zap, Clock, Phone, Mail,
  ArrowRight, CheckCircle2, Bike, Building2, Globe2, Sparkles,
  Menu, X, Star,
} from "lucide-react";
import logo from "@/assets/logo.png";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({ component: Landing });

const services = [
  { icon: Bike, title: "Same-Day Courier", desc: "Door-to-door pickup and drop-off across Nairobi in under 90 minutes.", tag: "Most popular" },
  { icon: Truck, title: "Bulk & Pallet Freight", desc: "Vans, pickups and 3-tonne trucks for businesses moving real volume.", tag: "Business" },
  { icon: Package, title: "E-commerce Fulfilment", desc: "Pick, pack, ship and COD reconciliation for online sellers.", tag: "Merchant" },
  { icon: Globe2, title: "Countrywide Network", desc: "Mombasa, Kisumu, Nakuru, Eldoret — overnight intercity routes.", tag: "Nationwide" },
];

const features = [
  { icon: Zap, title: "AI Dispatch Engine", desc: "ADAI matches every parcel to the closest, highest-rated rider in milliseconds." },
  { icon: MapPin, title: "Live GPS Tracking", desc: "Share a tracking link. Watch the rider move on the map in real time." },
  { icon: Shield, title: "Insured & Verified", desc: "Every rider KYC-verified. Every parcel insured up to KSh 50,000." },
  { icon: Clock, title: "On-Time Guarantee", desc: "98.4% on-time rate. If we miss the window, the next delivery is on us." },
];

const stats = [
  { value: "120K+", label: "Parcels delivered" },
  { value: "850+", label: "Verified riders" },
  { value: "47", label: "Towns served" },
  { value: "98.4%", label: "On-time rate" },
];

const steps = [
  { n: "01", title: "Book in 30 seconds", desc: "Enter pickup and drop-off. Get an instant KSh quote — no hidden fees." },
  { n: "02", title: "Pay with M-Pesa", desc: "STK push to your phone. Confirm and we dispatch a rider immediately." },
  { n: "03", title: "Track door-to-door", desc: "Live map, rider photo, ETA updates and proof-of-delivery photo." },
];

const partners = ["Jumia", "Naivas", "Carrefour", "Java House", "Quickmart", "EABL", "Twiga", "Copia"];

function Landing() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all ${
          scrolled ? "bg-background/85 backdrop-blur-xl border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-18 py-3 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3">
            <img src={logo} alt="SwiftLink Logistics" className="h-11 w-11 object-contain" />
            <div className="leading-tight hidden sm:block">
              <div className="font-display font-extrabold text-navy text-lg">SwiftLink</div>
              <div className="text-[10px] tracking-[0.22em] text-green font-semibold">LOGISTICS</div>
            </div>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground/80">
            <a href="#services" className="hover:text-navy transition">Services</a>
            <a href="#how" className="hover:text-navy transition">How it works</a>
            <a href="#why" className="hover:text-navy transition">Why SwiftLink</a>
            <a href="#business" className="hover:text-navy transition">For business</a>
            <a href="#contact" className="hover:text-navy transition">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="#book"
              className="hidden md:inline-flex items-center gap-2 rounded-full bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:bg-navy/90 transition shadow-soft"
            >
              Book a delivery <ArrowRight className="h-4 w-4" />
            </a>
            <button
              className="md:hidden p-2 rounded-lg border border-border"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-border bg-background px-5 py-4 flex flex-col gap-3 text-sm font-medium">
            {["services", "how", "why", "business", "contact"].map((s) => (
              <a key={s} href={`#${s}`} onClick={() => setOpen(false)} className="py-1 capitalize">
                {s === "how" ? "How it works" : s === "why" ? "Why SwiftLink" : s === "business" ? "For business" : s}
              </a>
            ))}
            <a href="#book" onClick={() => setOpen(false)} className="mt-2 rounded-full bg-navy text-white px-5 py-3 text-center font-semibold">
              Book a delivery
            </a>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative min-h-[100vh] flex items-center overflow-hidden">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" width={1600} height={1024} />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.62_0.17_145_/_0.25),_transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 pt-32 pb-20 grid lg:grid-cols-12 gap-12 items-center w-full">
          <div className="lg:col-span-7 text-white">
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold tracking-wide">
              <span className="h-2 w-2 rounded-full bg-green animate-pulse-glow" />
              KENYA'S #1 AI-POWERED DELIVERY PLATFORM
            </div>
            <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.02]">
              Connecting today.{" "}
              <span className="text-green">Delivering tomorrow.</span>
            </h1>
            <p className="mt-6 text-lg text-white/80 max-w-xl">
              From a single envelope to a full pallet — SwiftLink moves it across Nairobi and Kenya
              with verified riders, live tracking and M-Pesa payments. No paperwork. No surprises.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#book"
                className="inline-flex items-center gap-2 rounded-full bg-green px-7 py-4 text-base font-semibold text-white hover:brightness-110 transition shadow-glow"
              >
                Get instant quote <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="#business"
                className="inline-flex items-center gap-2 rounded-full glass px-7 py-4 text-base font-semibold text-white hover:bg-white/15 transition"
              >
                Talk to sales
              </a>
            </div>

            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-3xl sm:text-4xl font-extrabold text-white">{s.value}</div>
                  <div className="text-xs uppercase tracking-wider text-white/60 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* QUOTE CARD */}
          <div id="book" className="lg:col-span-5">
            <div className="rounded-3xl bg-white p-7 shadow-glow">
              <div className="flex items-center gap-2 text-xs font-semibold text-green uppercase tracking-wider">
                <Sparkles className="h-4 w-4" /> Instant quote
              </div>
              <h3 className="mt-2 font-display font-extrabold text-2xl text-navy">Book a delivery</h3>
              <p className="text-sm text-muted-foreground mt-1">Get a price in seconds. Pay with M-Pesa.</p>

              <form className="mt-5 space-y-3" onSubmit={(e) => e.preventDefault()}>
                <Field icon={MapPin} placeholder="Pickup location" />
                <Field icon={MapPin} placeholder="Drop-off location" iconColor="text-green" />
                <div className="grid grid-cols-2 gap-3">
                  <select className="rounded-xl border border-input bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green">
                    <option>Motorbike — KSh 250+</option>
                    <option>Pickup — KSh 1,800+</option>
                    <option>Truck — KSh 4,500+</option>
                  </select>
                  <select className="rounded-xl border border-input bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green">
                    <option>Standard</option>
                    <option>Express (1.5×)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-navy text-white py-4 font-semibold hover:bg-navy/90 transition flex items-center justify-center gap-2"
                >
                  See instant price <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-[11px] text-muted-foreground text-center">
                  By booking you agree to our Terms. Insured up to KSh 50,000.
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* partner marquee */}
        <div className="absolute bottom-0 inset-x-0 border-t border-white/10 bg-dark-bg/60 backdrop-blur-md py-4 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap gap-12 text-white/50 text-sm font-semibold tracking-widest uppercase">
            {[...partners, ...partners].map((p, i) => (
              <span key={i} className="flex items-center gap-12">
                {p} <span className="text-green">●</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-28 bg-background">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHead eyebrow="What we move" title="Built for every kind of delivery" subtitle="One platform, four tiers of service. From a single envelope to a 3-tonne palletised load." />
          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((s) => (
              <article key={s.title} className="group rounded-2xl border border-border bg-card p-7 hover:border-green hover:-translate-y-1 transition-all duration-300 shadow-soft">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-accent text-navy flex items-center justify-center group-hover:bg-green group-hover:text-white transition">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green">{s.tag}</span>
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-navy">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-navy group-hover:text-green transition">
                  Learn more <ArrowRight className="h-4 w-4" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-28 bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHead eyebrow="How it works" title="Three steps. Zero friction." />
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="relative rounded-2xl bg-card border border-border p-8 shadow-soft">
                <div className="absolute -top-4 left-7 inline-flex items-center px-3 py-1 rounded-full bg-navy text-white text-xs font-bold tracking-wider">
                  STEP {s.n}
                </div>
                <h3 className="font-display text-2xl font-bold text-navy mt-3">{s.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">{s.desc}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-5 -translate-y-1/2 h-7 w-7 text-green" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section id="why" className="py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionHead eyebrow="Why SwiftLink" title="The smart layer between you and your customer." align="left" />
            <p className="mt-5 text-muted-foreground leading-relaxed">
              We're not just another courier. SwiftLink is an AI-powered logistics platform purpose-built
              for African cities — engineered for traffic, hustle and trust.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "ADAI dispatch picks the best rider in <300ms",
                "M-Pesa Daraja, card and invoice payments",
                "Live GPS tracking link for every parcel",
                "Photo proof-of-delivery with signature capture",
                "Dedicated account manager for SMEs and enterprise",
              ].map((x) => (
                <li key={x} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green shrink-0 mt-0.5" />
                  <span className="text-foreground">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-card border border-border p-6 shadow-soft hover:shadow-glow transition">
                <div className="h-11 w-11 rounded-xl bg-gradient-brand flex items-center justify-center text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h4 className="mt-4 font-display font-bold text-lg text-navy">{f.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BUSINESS BAND */}
      <section id="business" className="py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="rounded-3xl overflow-hidden bg-gradient-brand p-10 lg:p-16 text-white relative">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_20%,_white,_transparent_50%)]" />
            <div className="relative grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-green-300/90">
                  <Building2 className="h-4 w-4" /> SwiftLink for Business
                </div>
                <h2 className="mt-4 font-display text-4xl lg:text-5xl font-extrabold leading-tight">
                  Logistics infrastructure for ambitious Kenyan businesses.
                </h2>
                <p className="mt-5 text-white/85 max-w-xl">
                  Volume pricing, monthly invoicing, COD reconciliation, dedicated dispatch and
                  white-label tracking pages. Built for retailers, restaurants, pharmacies and B2B.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href="#contact" className="rounded-full bg-white text-navy px-7 py-3.5 font-semibold hover:bg-white/90 transition">
                    Request volume pricing
                  </a>
                  <a href="#contact" className="rounded-full border border-white/40 px-7 py-3.5 font-semibold hover:bg-white/10 transition">
                    See API docs
                  </a>
                </div>
              </div>
              <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                {[
                  { v: "-32%", l: "Avg. delivery cost vs in-house fleet" },
                  { v: "12 min", l: "Avg. rider arrival time" },
                  { v: "24/7", l: "Operations & support" },
                  { v: "API", l: "Direct integration" },
                ].map((x) => (
                  <div key={x.l} className="glass rounded-2xl p-5">
                    <div className="font-display text-3xl font-extrabold">{x.v}</div>
                    <div className="text-xs text-white/70 mt-1">{x.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-24 bg-accent/40">
        <div className="mx-auto max-w-4xl px-5 lg:px-8 text-center">
          <div className="flex justify-center gap-1 text-green">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
          </div>
          <blockquote className="mt-6 font-display text-2xl lg:text-3xl font-bold text-navy leading-snug">
            "We replaced three couriers with SwiftLink. Faster deliveries, cleaner invoices and our
            customers can finally see where their parcel is. It just works."
          </blockquote>
          <div className="mt-6 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Aisha N.</span> · Operations Lead, Nairobi e-commerce
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <SectionHead eyebrow="Get in touch" title="Move something today." align="left" />
            <p className="mt-4 text-muted-foreground max-w-md">
              Talk to a human, request enterprise pricing, or just say hi. We're based in Nairobi and reply within an hour.
            </p>
            <div className="mt-8 space-y-4">
              <ContactRow icon={Phone} label="WhatsApp / Call" value="+254 743 509 810" href="tel:+254743509810" />
              <ContactRow icon={Mail} label="General" value="hello@swiftlink.co.ke" href="mailto:hello@swiftlink.co.ke" />
              <ContactRow icon={Mail} label="Support" value="support@swiftlink.co.ke" href="mailto:support@swiftlink.co.ke" />
              <ContactRow icon={MapPin} label="Head office" value="Westlands, Nairobi, Kenya" />
            </div>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="rounded-3xl bg-card border border-border p-8 shadow-soft space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input placeholder="Full name" />
              <Input placeholder="Company (optional)" />
            </div>
            <Input placeholder="Phone (+254...)" />
            <Input placeholder="Email" type="email" />
            <textarea rows={4} placeholder="Tell us what you need to move" className="w-full rounded-xl border border-input bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green resize-none" />
            <button className="w-full rounded-xl bg-green text-white py-4 font-semibold hover:brightness-110 transition shadow-glow">
              Send message
            </button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-dark-bg text-white/80 pt-20 pb-10">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid md:grid-cols-12 gap-10">
            <div className="md:col-span-5">
              <div className="flex items-center gap-3">
                <img src={logo} alt="SwiftLink" className="h-12 w-12 object-contain bg-white rounded-xl p-1" />
                <div>
                  <div className="font-display font-extrabold text-white text-xl">SwiftLink</div>
                  <div className="text-[10px] tracking-[0.22em] text-green font-semibold">LOGISTICS</div>
                </div>
              </div>
              <p className="mt-5 text-sm text-white/60 max-w-sm italic">
                "Connecting today. Delivering tomorrow."
              </p>
              <p className="mt-4 text-sm text-white/50">
                SwiftLink Technologies Ltd · Nairobi, Kenya · Founded 2026
              </p>
            </div>
            <FooterCol title="Platform" links={["Same-day courier", "Bulk freight", "E-commerce", "API & integrations"]} />
            <FooterCol title="Company" links={["About", "Careers", "Press", "Partners"]} />
            <FooterCol title="Help" links={["Track a parcel", "Support center", "Privacy", "Terms"]} />
          </div>
          <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-4 text-xs text-white/40">
            <div>© 2026 SwiftLink Technologies Ltd. All rights reserved.</div>
            <div>Made in Nairobi 🇰🇪</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, subtitle, align = "center" }: { eyebrow: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}>
      <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-green">
        <span className="h-px w-8 bg-green" /> {eyebrow}
      </div>
      <h2 className="mt-4 font-display text-4xl lg:text-5xl font-extrabold text-navy leading-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Field({ icon: Icon, placeholder, iconColor = "text-navy" }: { icon: any; placeholder: string; iconColor?: string }) {
  return (
    <div className="relative">
      <Icon className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${iconColor}`} />
      <input className="w-full rounded-xl border border-input bg-white pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green" placeholder={placeholder} />
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-xl border border-input bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green" />;
}

function ContactRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  const Tag: any = href ? "a" : "div";
  return (
    <Tag href={href} className="flex items-center gap-4 group">
      <div className="h-11 w-11 rounded-xl bg-accent text-navy flex items-center justify-center group-hover:bg-green group-hover:text-white transition">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-semibold text-foreground">{value}</div>
      </div>
    </Tag>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="md:col-span-2">
      <div className="font-display font-bold text-white text-sm uppercase tracking-wider">{title}</div>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l}><a href="#" className="text-white/60 hover:text-green transition">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}
