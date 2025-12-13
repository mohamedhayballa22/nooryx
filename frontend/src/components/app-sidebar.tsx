"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  HomeSimple, BoxIso, ClockRotateRight, 
  Bell, Settings, NavArrowUp, LogOut, 
  User, Coins, NavArrowDown, Wrench,
  Package, Group, Lock, CreditCard, OpenBook,
  MessageText
 } from "iconoir-react"
import { useUserAccount } from "@/app/core/settings/account/hooks/use-account"
import { SignOutConfirmDialog } from "./signout-dialog";
import { useUnreadCount } from "@/hooks/use-alerts"
import { toast } from "sonner"
import { useRouter, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { SidebarFeedbackCard } from "./feedback/sidebar-feedback-card"
import { FeedbackModal } from "./feedback/feedback-modal"

const mainItems = [
  { title: "Dashboard", url: "/core/dashboard", icon: HomeSimple },
  { title: "Inventory", url: "/core/inventory", icon: BoxIso },
  { title: "Audit Trail", url: "/core/audit-trail", icon: ClockRotateRight },
  { title: "Valuation", url: "/core/valuation", icon: Coins },
  { title: "Alerts", url: "/core/alerts", icon: Bell },
]

const settingsSubItems = [
  { title: "General", url: "/core/settings/general", icon: Wrench },
  { title: "Operations", url: "/core/settings/operations", icon: Package },
  { title: "Team & Access", url: "/core/settings/team", icon: Group },
  { title: "Account & Security", url: "/core/settings/account", icon: Lock },
  { title: "Billing & Plan", url: "/core/settings/billing", icon: CreditCard },
]

// Documentation Tree Mapping
const docsStructure = [
  {
    header: "Introduction",
    url: "/docs",
    items: [
      { title: "The Core Philosophy", url: "/docs/philosophy" },
    ]
  },
  {
    header: "Getting Started",
    url: "/docs/getting-started",
    items: [
      { title: "Creating Your Workspace", url: "/docs/getting-started/workspace" },
      { title: "Inviting Team", url: "/docs/getting-started/team" },
      { title: "Receiving Stock", url: "/docs/getting-started/receiving-stock" },
    ]
  },
  {
    header: "Core Concepts & Data",
    url: "/docs/core-concepts",
    items: [
      { title: "SKUs", url: "/docs/core-concepts/skus" },
      { title: "Managing Locations", url: "/docs/core-concepts/locations" },
      { title: "Understanding Stock State", url: "/docs/core-concepts/stock-states" },
      { title: "Valuation", url: "/docs/core-concepts/valuation" },
    ]
  },
  {
    header: "Workflows & Transactions",
    url: "/docs/workflows",
    items: [
      { title: "Shipping Stock", url: "/docs/workflows/ship-stock" },
      { title: "Internal Transfers", url: "/docs/workflows/transfer-stock" },
      { title: "Adjusting Stock", url: "/docs/workflows/stock-adjustments" },
      { title: "Managing Reservations", url: "/docs/workflows/reservations" },
    ]
  },
  {
    header: "Monitoring, Analysis & Alerts",
    url: "/docs/monitoring",
    items: [
      { title: "The Nooryx Dashboard", url: "/docs/monitoring/dashboard" },
      { title: "Activity and Accountability", url: "/docs/monitoring/audit-trail" },
      { title: "Configurable Alerting System", url: "/docs/monitoring/alerts" },
      { title: "Global Search & Quick Find", url: "/docs/monitoring/search" },
    ]
  },
  {
    header: "Settings & Administration",
    url: "/docs/settings",
    items: [
      { title: "Team Management", url: "/docs/settings/team" },
      { title: "General", url: "/docs/settings/general" },
      { title: "Account & Security", url: "/docs/settings/account-security" },
      { title: "Billing & Subscription", url: "/docs/settings/billing" },
    ]
  }
]

export function AppSidebar() {
  const { data } = useUserAccount()
  const initials = (data?.user.first_name?.charAt(0) || '') + (data?.user.last_name?.charAt(0) || '')
  const userName = (data?.user.first_name || '') + " " + (data?.user.last_name || '')
  const userEmail = data?.user.email
  const [showSignOutDialog, setShowSignOutDialog] = React.useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = React.useState(false)
  const { count: unreadCount, hasInitialData } = useUnreadCount()
  const displayCount = unreadCount > 9 ? "9+" : unreadCount.toString();
  const router = useRouter()
  const queryClient = useQueryClient()
  const { state, setOpen, isMobile, openMobile, setOpenMobile } = useSidebar()
  const pathname = usePathname()

  React.useEffect(() => {
    if (isMobile && openMobile) {
      setOpenMobile(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const prevUnreadRef = React.useRef(unreadCount);

  React.useEffect(() => {
    const prev = prevUnreadRef.current;

    if (hasInitialData && prev !== undefined && unreadCount > prev) {
      toast.info(
        `You have ${unreadCount - prev} new alert${unreadCount - prev === 1 ? "" : "s"}`,
        {
          action: {
            label: "View Alerts", 
            onClick: () => {
              router.push("/core/alerts")
              queryClient.invalidateQueries({ queryKey: ["alerts", "list"]})
            }
          },
          duration: 7000,
          position: "top-center"
        }
      );
    }

    prevUnreadRef.current = unreadCount;
  }, [unreadCount, hasInitialData, router, queryClient]);

  // Handler to expand sidebar when icon is clicked in collapsed state
  const handleExpandOnClick = (e: React.MouseEvent) => {
    if (state === "collapsed") {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader className="h-14 border-b px-4 group-data-[collapsible=icon]:px-0">
        <div className="flex h-full items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Image
            src="/mock-logo.svg"
            alt="Nooryx logo"
            width={24}
            height={24}
            className="flex-shrink-0 pt-1"
          />
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
            Nooryx
          </span>
        </div>
      </SidebarHeader>

      {/* Main Menu */}
      <SidebarContent className="sidebar-scrollbar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} className="flex items-center group/link">
                      <item.icon className="h-6 w-6" />
                      <span>{item.title}</span>
                      {item.title === "Alerts" && unreadCount > 0 && (
                        <span
                          className="
                            absolute
                            top-0
                            left-[0.8rem]
                            group-data-[collapsible=icon]/sidebar-wrapper:left-1/2
                            group-data-[collapsible=icon]/sidebar-wrapper:-translate-x-1/2

                            flex
                            h-4
                            min-w-[1rem]
                            items-center
                            justify-center
                            px-1
                            rounded-full
                            bg-red-600
                            text-[10px]
                            font-bold
                            text-white
                            whitespace-nowrap
                          "
                        >
                          {displayCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Section */}
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              
              {/* Settings Collapsible */}
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="w-full cursor-pointer" onClick={handleExpandOnClick}>
                      <Settings className="w-5 h-5" />
                      <span >Settings</span>
                      <NavArrowDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            <Link href={subItem.url} className="flex items-center">
                              <subItem.icon className="w-5 h-5" />
                              <span >{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Help & Docs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Single collapsed item */}
              <SidebarMenuItem className="group-data-[collapsible=icon]:block hidden">
                <SidebarMenuButton 
                  className="flex items-center cursor-pointer"
                  onClick={handleExpandOnClick}
                >
                  <OpenBook className="w-5 h-5" />
                  <span>Documentation</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Expanded items */}
              <div className="group-data-[collapsible=icon]:hidden">
                {docsStructure.map((section) => (
                  <Collapsible key={section.header} className="group/section">
                    <SidebarMenuItem>
                      <div className="flex items-center w-full">
                        <SidebarMenuButton asChild className="flex-1">
                          <Link 
                            href={section.url} 
                            className="flex items-center"
                          >
                            <OpenBook className="w-5 h-5" />
                            <span >{section.header}</span>
                          </Link>
                        </SidebarMenuButton>
                        <CollapsibleTrigger asChild>
                          <button className="p-2 hover:bg-accent rounded-md cursor-pointer">
                            <NavArrowDown className="h-4 w-4 transition-transform group-data-[state=open]/section:rotate-180" />
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {section.items.map((docItem) => (
                            <SidebarMenuSubItem key={docItem.title}>
                              <SidebarMenuSubButton asChild>
                                <Link 
                                  href={docItem.url} 
                                  className="flex items-center text-sm pl-6"
                                >
                                  <span>{docItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto pt-2">
          <SidebarFeedbackCard />
        </div>

      </SidebarContent>

      {/* Footer User Menu */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="cursor-pointer h-auto py-2">
                  <div className="flex items-center w-full min-w-0 group-data-[collapsible=icon]:justify-center">
                    <Avatar className="rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        <strong>{initials}</strong>
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start min-w-0 flex-1 ml-2 group-data-[collapsible=icon]:hidden">
                      <span className="font-medium truncate w-full text-left">
                        {userName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-full text-left">
                        {userEmail}
                      </span>
                    </div>
                    <NavArrowUp className="flex-shrink-0 h-4 w-4 group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" className="w-(--radix-popper-anchor-width)">
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href="/core/settings/account">
                    <User className="mr-2" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setIsFeedbackModalOpen(true)}
                >
                  <MessageText className="mr-2" />
                  Submit Feedback
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setShowSignOutDialog(true)}
                >
                  <LogOut className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <SignOutConfirmDialog
              open={showSignOutDialog}
              onOpenChange={setShowSignOutDialog}
            />
            <FeedbackModal 
              open={isFeedbackModalOpen} 
              onOpenChange={setIsFeedbackModalOpen} 
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
