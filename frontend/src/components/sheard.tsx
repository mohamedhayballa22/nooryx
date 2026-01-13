import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type LinkItemType = {
	label: string;
	href: string;
	icon: LucideIcon;
	description?: string;
};

export function LinkItem({
	label,
	description,
	icon: Icon,
	className,
	href,
	...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & LinkItemType) {
	return (
		<Link
			className={cn("flex gap-x-2 rounded-md p-2 hover:bg-accent", className)}
			href={href}
			{...props}
		>
			<div className="flex aspect-square size-12 items-center justify-center rounded-md border bg-card text-sm shadow-sm">
				<Icon className="size-5 text-foreground" />
			</div>
			<div className="flex flex-col items-start justify-center">
				<span className="font-medium">{label}</span>
				<span className="line-clamp-2 text-muted-foreground text-xs">
					{description}
				</span>
			</div>
		</Link>
	);
}
