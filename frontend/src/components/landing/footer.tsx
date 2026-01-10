import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NooryxFontBlack } from "@/app/fonts/typeface";
import ThemeToggle from "@/components/theme-toggle";

export function Footer() {
	const product = [
		{
			title: "Docs",
			href: "/docs",
		},
		{
			title: "Changelog",
			href: "#",
		},
		{
			title: "Early Access",
			href: "/waitlist",
		},
	];

	const company = [
		{
			title: "Contact",
			href: "#",
		},
		{
			title: "Partnerships",
			href: "#",
		},
	];

	const legal = [
		{
			title: "Terms of Service",
			href: "#",
		},
		{
			title: "Data & Privacy",
			href: "#",
		},
		{
			title: "Security",
			href: "#",
		},
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
							<div className="col-span-6 flex flex-col gap-2 md:col-span-3">
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
							<div className="col-span-2 w-full md:col-span-1">
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
							<div className="col-span-2 w-full md:col-span-1">
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
							<div className="col-span-2 w-full md:col-span-1">
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
						<div className="flex items-center justify-between p-4">
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
