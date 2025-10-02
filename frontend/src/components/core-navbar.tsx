import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

export function CoreNavbar() {
  return (
    <nav className="w-full h-14 border-b flex items-center justify-between px-4">
      {/* Left section: trigger + divider + breadcrumb */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="cursor-pointer" />

        {/* Subtle vertical separator */}
        <div className="h-6 w-px bg-border" />

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Empty for now */}
      </div>
    </nav>
  )
}
