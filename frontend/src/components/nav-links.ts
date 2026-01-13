import {
	BarChart,
	BookOpen,
	Briefcase,
	Eye,
	EyeClosed,
	EyeOff,
	FileText,
	Handshake,
	History,
	Lock,
	Mail,
	RotateCcw,
	Shield,
	Users,
	Workflow,
} from "lucide-react";
import type { LinkItemType } from "@/components/sheard";
import { PrivacyPolicy } from "iconoir-react";

export const productLinks: LinkItemType[] = [
	{
		label: "Philosophy",
		href: "/docs/philosophy",
		description: "Our core principles and vision",
		icon: BookOpen,
	},
	{
		label: "Changelog",
		href: "/changelog",
		description: "Latest updates and improvements",
		icon: History,
	},
	{
		label: "Finance",
		href: "/docs/core-concepts/valuation",
		description: "Financial concepts and valuation",
		icon: BarChart,
	},
	{
		label: "Management",
		href: "/docs/management",
		description: "Tools and practices for effective management",
		icon: Briefcase,
	},
	{
		label: "Operations",
		href: "/docs/workflows",
		description: "Streamline your operational workflows",
		icon: Workflow,
	},
	{
		label: "Collaboration",
		href: "/docs/getting-started/team",
		description: "Get your team started working together",
		icon: Users,
	},
];

export const companyLinks: LinkItemType[] = [
	{
		label: "Contact",
		href: "/contact",
		description: "Get in touch with us",
		icon: Mail,
	},
	{
		label: "Partnerships",
		href: "/partnerships",
		icon: Handshake,
		description: "Collaborate with us for mutual growth",
	},
];

export const companyLinks2: LinkItemType[] = [
	{
		label: "Terms of Service",
		href: "/terms",
		icon: FileText,
	},
	{
		label: "Privacy Policy",
		href: "/privacy",
		icon: Shield,
	},
	{
		label: "Security",
		href: "/security",
		icon: Lock,
	},
];
