import * as React from "react"
import Link from "next/link"
import Image from "next/image"

import {
  Bell,
  Settings,
  HelpCircle,
  User,
  LogOut,
  ChevronUp,
  ClipboardClock,
  ChartSpline,
  Box,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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

import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const mainItems = [
  { title: "Dashboard", url: "dashboard", icon: ChartSpline },
  { title: "Inventory", url: "inventory", icon: Box },
  { title: "Audit Trail", url: "audit-trail", icon: ClipboardClock },
  { title: "Notifications", url: "#", icon: Bell },
]

const systemItems = [
  { title: "Settings", url: "settings", icon: Settings },
  { title: "Help & Docs", url: "#", icon: HelpCircle },
]

export function AppSidebar() {
  const userEmail = "mohamed.hayballa@nooryx.com"
  const userName = "Mohamed Hayballa"
  const initials = "MH"

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
                        {item.title === "Notifications" && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            3
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
                    <ChevronUp className="flex-shrink-0 h-4 w-4 group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-(--radix-popper-anchor-width)">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <Link href={"/"}>
                  <DropdownMenuItem className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
