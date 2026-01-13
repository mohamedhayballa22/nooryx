import Link from "next/link";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { companyLinks, companyLinks2, productLinks } from "@/components/nav-links";
import { LinkItem } from "@/components/sheard";

export function DocsDesktopNav() {
	return (
		<NavigationMenu className="hidden md:flex">
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger className="bg-transparent">
						Product
					</NavigationMenuTrigger>
					<NavigationMenuContent className="bg-muted/50 p-1 pr-1.5 dark:bg-background">
						<div className="grid w-lg grid-cols-2 gap-2 rounded-md border bg-popover p-2 shadow">
							{productLinks.map((item, i) => (
								<NavigationMenuLink
									asChild
									className="w-full flex-row gap-x-2"
									key={`item-${item.label}-${i}`}
								>
									<LinkItem {...item} />
								</NavigationMenuLink>
							))}
						</div>
						<div className="p-2">
							<p className="text-muted-foreground text-sm">
								Interested?{" "}
								<Link
									className="font-medium text-foreground hover:underline"
									href="#"
								>
									Schedule a demo
								</Link>
							</p>
						</div>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger className="bg-transparent">
						Company
					</NavigationMenuTrigger>
					<NavigationMenuContent className="bg-muted/50 p-1 pr-1.5 pb-1.5 dark:bg-background">
						<div className="grid w-lg grid-cols-2 gap-2">
							<div className="space-y-2 rounded-md border bg-popover p-2 shadow">
								{companyLinks.map((item, i) => (
									<NavigationMenuLink
										asChild
										className="w-full flex-row gap-x-2"
										key={`item-${item.label}-${i}`}
									>
										<LinkItem {...item} />
									</NavigationMenuLink>
								))}
							</div>
							<div className="space-y-2 p-3 flex flex-col justify-center">
								{companyLinks2.map((item, i) => (
									<NavigationMenuLink
										asChild
										className="flex-row items-center gap-x-2"
										key={`item-${item.label}-${i}`}
									>
										<Link href={item.href} className="flex items-center gap-x-2">
											<item.icon className="size-4 text-foreground" />
											<span className="font-medium">{item.label}</span>
										</Link>
									</NavigationMenuLink>
								))}
							</div>
						</div>
					</NavigationMenuContent>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	);
}
