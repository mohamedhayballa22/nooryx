import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NooryxFontBlack } from "@/app/fonts/typeface";
import ThemeToggle from "@/components/theme-toggle";

function GdprBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <path
          id="star"
          d="M0,-8 L2.3,-2.8 L7.6,-2.8 L3.3,0.9 L5,6.1 L0,3.1 L-5,6.1 L-3.3,0.9 L-7.6,-2.8 L-2.3,-2.8 Z"
        />
      </defs>
      {/* Ring */}
      <circle
        cx="100"
        cy="100"
        r="90"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.3"
      />
      {/* Stars */}
      <g fill="currentColor">
        <use href="#star" x="100" y="35" />
        <use href="#star" x="132.5" y="43.7" />
        <use href="#star" x="156.3" y="67.5" />
        <use href="#star" x="165" y="100" />
        <use href="#star" x="156.3" y="132.5" />
        <use href="#star" x="132.5" y="156.3" />
        <use href="#star" x="100" y="165" />
        <use href="#star" x="67.5" y="156.3" />
        <use href="#star" x="43.7" y="132.5" />
        <use href="#star" x="35" y="100" />
        <use href="#star" x="43.7" y="67.5" />
        <use href="#star" x="67.5" y="43.7" />
      </g>
      {/* Text */}
      <text
        x="100"
        y="100"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fontSize="28px"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
      >
        GDPR
      </text>
    </svg>
  );
}

export function Footer() {
  const product = [
    { title: "Docs", href: "/docs" },
    { title: "Changelog", href: "/changelog" },
    { title: "Early Access", href: "/waitlist" },
  ];

  const company = [
    { title: "Contact", href: "/contact" },
    { title: "Partnerships", href: "/partnerships" },
  ];

  const legal = [
    { title: "Terms of Service", href: "/terms" },
    { title: "Data & Privacy", href: "/privacy" },
    { title: "Security", href: "/security" },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative">
      {/* Full-width border at top */}
      <div className="absolute inset-x-0 top-0 h-px w-full bg-border" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="relative w-full max-w-6xl mx-auto">
          <div
            className={cn(
              "lg:border-x",
              "dark:bg-[radial-gradient(35%_80%_at_30%_0%,--theme(--color-foreground/.1),transparent)]"
            )}
          >
            <div className="grid grid-cols-6 gap-6 p-4">
              
              {/* LEFT COLUMN: Logo, Desc, and Badge */}
              <div className="col-span-6 flex flex-col justify-between md:col-span-3 pr-8">
                <div className="flex flex-col gap-2">
                  <Link href="/" className="w-max flex items-center gap-3">
                    <Image
                      src="/nooryx-logo.svg"
                      alt="Nooryx logo"
                      width={20}
                      height={20}
                      className="flex-shrink-0 dark:invert"
                    />
                    <span
                      className={`
                        ${NooryxFontBlack.className}
                        select-none
                        mt-0.5
                        text-2xl
                        font-medium
                        whitespace-nowrap
                      `}
                    >
                      Nooryx
                    </span>
                  </Link>
                  <p className="max-w-sm text-balance font-mono text-muted-foreground text-sm">
                    The Fast and Auditable Inventory Operations Platform.
                  </p>
                </div>

                <div className="mt-4 flex items-center">
                    <GdprBadge className="h-15 w-15" />
                </div>
              </div>

              {/* RIGHT COLUMNS: Links */}
			  <div className="col-span-6 md:col-span-3 grid grid-cols-3 gap-6 md:justify-items-end">
				<div className="w-full md:w-auto">
					<span className="text-muted-foreground text-xs">Product</span>
					<div className="mt-2 flex flex-col gap-2">
					{product.map(({ href, title }) => (
						<Link
						className="w-max text-sm no-underline hover:text-muted-foreground transition-colors"
						href={href}
						key={title}
						>
						{title}
						</Link>
					))}
					</div>
				</div>
				<div className="w-full md:w-auto">
					<span className="text-muted-foreground text-xs">Company</span>
					<div className="mt-2 flex flex-col gap-2">
					{company.map(({ href, title }) => (
						<Link
						className="w-max text-sm no-underline hover:text-muted-foreground transition-colors"
						href={href}
						key={title}
						>
						{title}
						</Link>
					))}
					</div>
				</div>
				<div className="w-full md:w-auto">
					<span className="text-muted-foreground text-xs">Legal</span>
					<div className="mt-2 flex flex-col gap-2">
					{legal.map(({ href, title }) => (
						<Link
						className="w-max text-sm no-underline hover:text-muted-foreground transition-colors"
						href={href}
						key={title}
						>
						{title}
						</Link>
					))}
					</div>
				</div>
				</div>
            </div>

            {/* BOTTOM BAR */}
            <div className="flex items-end justify-between p-4">
              <p className="text-sm text-muted-foreground">
                © {currentYear} Nooryx.
              </p>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
