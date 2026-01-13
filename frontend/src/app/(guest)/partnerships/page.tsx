import Link from "next/link";
import { cn } from "@/lib/utils";
import { NooryxFontBlack, NooryxFontBold } from "@/app/fonts/typeface";

export default function PartnershipsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-32">
      {/* Hero */}
      <section className="mb-12">
        <h1
          className={cn(
            "text-[2.5rem] leading-[1.1] tracking-[-0.02em]",
            NooryxFontBlack.className
          )}
        >
          Partnerships
        </h1>

        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            We partner with a small number of companies to shape Nooryx in real
            operating environments, where inventory accuracy, traceability, and
            speed actually matter.
          </p>

          <p>
            These collaborations help us validate assumptions, refine workflows,
            and build a product that earns trust through precision, not promises.
          </p>
        </div>
      </section>

      {/* Design Partners */}
      <section className="mb-12">
        <h2
          className={cn(
            "text-2xl leading-tight tracking-[-0.01em]",
            NooryxFontBold.className
          )}
        >
          Design partners
        </h2>

        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
          Design partners work closely with the Nooryx team to influence product
          direction and ensure the system holds up under real operational
          complexity.
        </p>

        <div className="mt-12 space-y-8">
          <div className="border-l-2 border-border pl-6">
            <h3
              className={cn(
                "text-base tracking-[-0.01em]",
                NooryxFontBold.className
              )}
            >
              What this looks like
            </h3>
            <div className="mt-4 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
              <p>Early access to features as they're developed</p>
              <p>Direct feedback loops with the founding team</p>
              <p>Influence on workflows, data models, and edge cases</p>
              <p>A seat at the table as the product evolves</p>
            </div>
          </div>

          <div className="border-l-2 border-border pl-6">
            <h3
              className={cn(
                "text-base tracking-[-0.01em]",
                NooryxFontBold.className
              )}
            >
              Who this is for
            </h3>
            <div className="mt-4 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
              <p>Companies managing real inventory across locations</p>
              <p>Teams who care about correctness, not workarounds</p>
              <p>Operators willing to challenge assumptions</p>
              <p>Businesses looking for a long-term system, not a patch</p>
            </div>
          </div>
        </div>
      </section>

      {/* Other collaborations */}
      <section className="mb-12">
        <h2
          className={cn(
            "text-2xl leading-tight tracking-[-0.01em]",
            NooryxFontBold.className
          )}
        >
          Other collaborations
        </h2>

        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
          We're also open to thoughtful collaborations that align with Nooryx's scope and product
          philosophy.
        </p>

        <div className="mt-8 border-l-2 border-border pl-6 text-[14px] leading-relaxed text-muted-foreground">
          <p>
            Implementation partners, operators with deep domain expertise, or
            teams building complementary tooling around inventory, logistics, or
            operations.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border pt-12">
        <h2
          className={cn(
            "text-2xl leading-tight tracking-[-0.01em]",
            NooryxFontBold.className
          )}
        >
          Partner with Nooryx
        </h2>

        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
          If you believe Nooryx could benefit from your environment, perspective,
          or expertise, we'd like to hear from you.
        </p>

        <div className="mt-8">
          <Link
            href="/contact"
            className="inline-flex items-center border-b-2 border-foreground pb-0.5 text-[14px] font-medium transition hover:border-muted-foreground hover:text-muted-foreground"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </main>
  );
}
