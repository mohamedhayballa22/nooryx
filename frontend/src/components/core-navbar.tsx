import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { SearchDialog } from "@/components/app-search"


export function CoreNavbar() {
  return (
    <nav className="w-full h-14 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="cursor-pointer" />

        <div className="h-6 w-px bg-border" />

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

      <div className="flex items-center gap-3">
        <SearchDialog />
      </div>
    </nav>
  )
}
