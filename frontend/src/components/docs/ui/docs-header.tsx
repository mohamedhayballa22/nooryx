"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { NooryxFontBlack } from "@/app/fonts/typeface";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LargeSearchToggle } from "@/components/search-toggle";
import { DocsDesktopNav } from "./docs-desktop-nav";
import { DocsMobileNav } from "./docs-mobile-nav";
import { ArrowRight } from "lucide-react";

interface DocsHeaderProps {
	isAuthenticated?: boolean;
}

export function DocsHeader({ isAuthenticated = false }: DocsHeaderProps) {
	const router = useRouter();
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 0);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);
	
	return (
		<header 
			className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50 transition-all duration-200"
			style={{
				borderBottom: isScrolled
					? "0.3px solid var(--navbar-border)"
					: "0.1px solid transparent"
			}}
		>
			<nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
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
					<DocsDesktopNav />
				</div>
				
				<div className="hidden flex-1 items-center justify-center px-8 md:flex">
					<LargeSearchToggle className="w-full max-w-md" />
				</div>
				
				<div className="hidden items-center gap-2 md:flex">
					{isAuthenticated ? (
						<Button onClick={() => router.push('/core/dashboard')} variant={"outline"}>
							Go to app
							<ArrowRight className="ml-1 size-4" />
						</Button>
					) : (
						<>
							<Button variant="outline" onClick={() => router.push('/login')}>Log In</Button>
							<Button onClick={() => router.push('#')}>Book a demo</Button>
						</>
					)}
				</div>
				<DocsMobileNav isAuthenticated={isAuthenticated} />
			</nav>
		</header>
	);
}
