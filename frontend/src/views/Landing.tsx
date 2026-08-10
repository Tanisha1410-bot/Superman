import { useRef, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  Bot,
  ListFilter,
  MessageSquare,
  RefreshCw,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/* -------------------------------------------------------------------------- */
/*  SiteNav                                                                    */
/* -------------------------------------------------------------------------- */

function SiteNav() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border font-display text-lg font-bold tracking-tight text-foreground"
          aria-hidden="true"
        >
          C
        </span>
        <span className="font-display text-lg font-semibold tracking-tight text-foreground" aria-hidden="true">
          Chrono
        </span>
        <span className="sr-only">Chrono — AI email client</span>
      </div>

      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <a href="#features" className="transition-colors hover:text-foreground">
          Features
        </a>
        <a href="#triage" className="transition-colors hover:text-foreground">
          Triage
        </a>
        <a href="#agent" className="transition-colors hover:text-foreground">
          Agent
        </a>
      </nav>

      <a
        href="#connect"
        className="rounded-full border border-border px-4 py-2 text-sm text-foreground/90 transition-colors hover:border-primary/60 hover:text-foreground"
      >
        Sign in
      </a>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero({ onConnect }: { onConnect?: () => void }) {
  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-20 pb-24 text-center md:pt-28">
      {/* status pill */}
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        Now in private beta
      </div>

      {/* app name eyebrow */}
      <div className="hero-eyebrow mb-5 flex items-center gap-3 text-sm font-medium uppercase tracking-[0.5em] text-blue-400">
        <span aria-hidden="true" className="h-px w-10 bg-blue-400/60" />
        <span aria-hidden="true" className="hero-eyebrow-dot inline-block h-2 w-2 rounded-full bg-blue-400" />
        <span className="pl-1">CHRONO</span>
        <span aria-hidden="true" className="h-px w-10 bg-blue-400/60" />
      </div>

      <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-balance text-foreground sm:text-6xl md:text-7xl">
        <span className="sr-only">Your inbox, finally intelligent</span>

        {/* "Your inbox," — word by word slide up */}
        <span aria-hidden="true">
          {'Your inbox,'.split(' ').map((word, i) => (
            <span key={`w-${i}`}>
              <span className="hero-word" style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
                {word}
              </span>
              <span className="hero-space" />
            </span>
          ))}
        </span>

        {/* "finally intelligent" — letter by letter fade+slide with shimmer */}
        <span aria-hidden="true" className="hero-shimmer">
          {'finally intelligent'.split('').map((char, i) =>
            char === ' ' ? (
              <span key={`l-${i}`} className="hero-space" />
            ) : (
              <span
                key={`l-${i}`}
                className="hero-letter"
                style={{ '--stagger': `${0.7 + i * 0.04}s` } as Record<string, string>}
              >
                {char}
              </span>
            ),
          )}
        </span>
      </h1>

      <div className="mt-8 flex w-full max-w-[400px] flex-col gap-3">
        {[
          { Icon: Zap, label: 'Priority-sorted', desc: 'emails ranked by urgency, automatically' },
          { Icon: Bot, label: 'Agent-powered', desc: 'type in plain English, Chrono acts' },
          { Icon: RefreshCw, label: 'Zero lag', desc: 'realtime sync, no refresh ever needed' },
        ].map(({ Icon, label, desc }, i) => (
          <div
            key={label}
            className="hero-subline flex items-center gap-3 text-left text-sm text-gray-400"
            style={{ animationDelay: `${1.6 + i * 0.3}s` }}
          >
            <Icon className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
            <span>
              <span className="text-foreground">{label}</span> — {desc}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-10" id="connect">
        <button
          type="button"
          onClick={onConnect}
          className="group relative inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-[0_0_0_1px_rgba(37,99,235,0.45),0_8px_40px_-6px_rgba(37,99,235,0.7)] transition-all duration-300 hover:shadow-[0_0_0_1px_rgba(37,99,235,0.65),0_10px_60px_-4px_rgba(37,99,235,0.95)] hover:brightness-110"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-primary/30 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          />
          Connect your Gmail
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground/70">Read-only by default. Revoke access anytime.</p>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Features                                                                   */
/* -------------------------------------------------------------------------- */

type Feature = {
  id: string
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    id: 'triage',
    icon: ListFilter,
    title: 'AI Triage',
    description: 'Emails sorted by urgency automatically, so the message that matters is always at the top.',
  },
  {
    id: 'agent',
    icon: MessageSquare,
    title: 'Agent Chat',
    description: 'Type in plain English and the agent acts — archive, draft, schedule, and reply on your behalf.',
  },
  {
    id: 'sync',
    icon: Zap,
    title: 'Realtime Sync',
    description: 'No refresh, no polling. Live updates land the instant they happen across every device.',
  },
]

const MAX_TILT = 15

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  const cardRef = useRef<HTMLElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  function handleMouseMove(event: React.MouseEvent<HTMLElement>) {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: -py * MAX_TILT * 2, y: px * MAX_TILT * 2 })
    setHovered(true)
  }

  function handleMouseLeave() {
    setHovered(false)
    setTilt({ x: 0, y: 0 })
  }

  const style: CSSProperties = {
    transform: hovered
      ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(-4px)`
      : 'none',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
    boxShadow: hovered
      ? '0 0 20px rgba(37, 99, 235, 0.3), 0 0 40px rgba(79, 70, 229, 0.15), inset 0 0 0 1px rgba(37, 99, 235, 0.4)'
      : 'none',
  }

  return (
    <article
      ref={cardRef}
      id={feature.id}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-7 [will-change:transform] hover:border-primary/50"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/0 blur-3xl transition-colors duration-500 group-hover:bg-primary/15"
      />
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">{feature.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{feature.description}</p>
    </article>
  )
}

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-6 pb-28">
      <div className="grid gap-4 md:grid-cols-3" style={{ perspective: '1000px' }}>
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  SiteFooter                                                                 */
/* -------------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="relative border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
        <p className="font-display text-2xl font-medium tracking-tight text-balance text-foreground md:text-3xl">
          Built for people who live in their inbox
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className="flex h-6 w-6 items-center justify-center rounded border border-border font-display text-xs font-bold text-foreground"
            aria-hidden="true"
          >
            C
          </span>
          <span>© {new Date().getFullYear()} Chrono. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}

/* -------------------------------------------------------------------------- */
/*  Landing (default export)                                                  */
/* -------------------------------------------------------------------------- */

export function Landing({ onConnect }: { onConnect?: () => void }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <span className="hero-orb hero-orb-blue left-[6%] top-[4%]" />
        <span className="hero-orb hero-orb-indigo right-[2%] top-[38%]" />
        <span className="hero-orb hero-orb-cyan left-[30%] top-[72%]" />
      </div>

      <div className="relative z-10">
        <SiteNav />
        <Hero onConnect={onConnect} />
        <Features />
        <SiteFooter />
      </div>
    </main>
  )
}
