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
  Bell, Settings, HelpCircle,
  NavArrowUp, LogOut, User, Coins,
  NavArrowDown, Globe, Package, Group,
  Lock, CreditCard
 } from "iconoir-react"
import { useUserAccount } from "@/app/core/settings/account/hooks/use-account"
import { SignOutConfirmDialog } from "./signout-dialog";
import { useUnreadCount } from "@/hooks/use-alerts"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

const mainItems = [
  { title: "Dashboard", url: "/core/dashboard", icon: HomeSimple },
  { title: "Inventory", url: "/core/inventory", icon: BoxIso },
  { title: "Audit Trail", url: "/core/audit-trail", icon: ClockRotateRight },
  { title: "Valuation", url: "/core/valuation", icon: Coins },
  { title: "Alerts", url: "/core/alerts", icon: Bell },
]

const settingsSubItems = [
  { title: "General", url: "/core/settings/general", icon: Globe },
  { title: "Operations", url: "/core/settings/operations", icon: Package },
  { title: "Team & Access", url: "/core/settings/team", icon: Group },
  { title: "Account & Security", url: "/core/settings/account", icon: Lock },
  { title: "Billing & Plan", url: "/core/settings/billing", icon: CreditCard },
]

const systemItems = [
  { title: "Help & Docs", url: "#", icon: HelpCircle },
]

export function AppSidebar() {
  const { data } = useUserAccount()
  const initials = (data?.user.first_name?.charAt(0) || '') + (data?.user.last_name?.charAt(0) || '')
  const userName = (data?.user.first_name || '') + " " + (data?.user.last_name || '')
  const userEmail = data?.user.email
  const [showSignOutDialog, setShowSignOutDialog] = React.useState(false)
  const { count: unreadCount, hasInitialData } = useUnreadCount()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Track previous unread count without causing re-renders
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
              // Invalidate alerts queries when user clicks to view alerts
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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} className="relative flex items-center">
                      <div className="relative">
                        <item.icon className="w-5 h-5" />
                        {item.title === "Alerts" && unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="ml-2">{item.title}</span>
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
              {/* Settings with Submenu */}
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="w-full">
                      <Settings className="w-5 h-5" />
                      <span className="ml-2">Settings</span>
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
                              <span className="ml-2">{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Other System Items */}
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} className="relative flex items-center">
                      <div className="relative">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="ml-2">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
