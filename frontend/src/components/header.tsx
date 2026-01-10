"use client";
import { useScroll } from "@/hooks/use-scroll";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DesktopNav } from "@/components/desktop-nav";
import { MobileNav } from "@/components/mobile-nav";
import { NooryxFontBlack } from "@/app/fonts/typeface";
import Link from "next/link";
import { useRouter } from "next/navigation"

export function Header() {
	const router = useRouter()
	const scrolled = useScroll(10);
	return (
		<header
			className={cn(
				"sticky top-0 z-50 mx-auto w-full max-w-5xl border-transparent border-b md:rounded-md md:border md:transition-all md:ease-out",
				{
					"border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50 md:top-2 md:max-w-4xl md:shadow":
						scrolled,
				}
			)}
		>
			<nav
				className={cn(
					"flex h-14 w-full items-center justify-between px-4 md:transition-all md:ease-out",
					{
						"md:px-2": scrolled,
					}
				)}
			>
				<div className="flex items-center gap-5">
					<Link className="flex items-center gap-2 rounded-md px-3 py-2.5 hover:bg-accent" href="/">
						<Image
							src="/nooryx-logo.svg"
							alt="Nooryx logo"
							width={20}
							height={20}
							className="flex-shrink-0 dark:invert"
						/>
						<span className={`${NooryxFontBlack.className} select-none text-lg font-medium`}>
							Nooryx
						</span>
					</Link>
					<DesktopNav />
				</div>
				<div className="hidden items-center gap-2 md:flex">
					<Button variant="outline" onClick={() => router.push('/login')}>Log In</Button>
					<Button onClick={() => router.push('#')}>Book a demo</Button>	
				</div>
				<MobileNav />
			</nav>
		</header>
	);
}
