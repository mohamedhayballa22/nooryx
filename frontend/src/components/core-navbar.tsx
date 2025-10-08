"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SearchDialog } from "@/components/app-search";
import { usePathname } from "next/navigation";
import Link from "next/link";

export function CoreNavbar() {
  const pathname = usePathname();

  // Split the path into segments
  const segments = pathname.split("/").filter(Boolean);

  // Remove 'core' (if it exists)
  const filteredSegments = segments.filter((segment) => segment !== "core");

  // Helper to rebuild URLs progressively after '/core'
  const getHref = (index: number) =>
    "/core/" + filteredSegments.slice(0, index + 1).join("/");

  return (
    <nav className="w-full h-14 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="cursor-pointer" />
        <div className="h-6 w-px bg-border" />

        <Breadcrumb>
          <BreadcrumbList className="flex items-center gap-1.5">
            {filteredSegments.map((segment, index) => {
              const isLast = index === filteredSegments.length - 1;
              const href = getHref(index);
              const label = segment
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div key={href} className="flex items-center gap-1.5">
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={href}>{label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        <SearchDialog />
      </div>
    </nav>
  );
}
