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
import { SearchTrigger } from "@/components/app-search";
import { ThemeToggle } from "@/components/nav-theme-toggle";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CoreNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Split the path into segments
  const segments = pathname.split("/").filter(Boolean);

  // Remove 'core' (if it exists)
  const filteredSegments = segments.filter((segment) => segment !== "core");

  // Helper to rebuild URLs progressively after '/core'
  const getHref = (index: number) =>
    "/core/" + filteredSegments.slice(0, index + 1).join("/");

  // Check if we're on inventory page with a SKU query param
  const skuCode = pathname === "/core/inventory" ? searchParams.get("sku") : null;

  const handleSearchClick = () => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const event = new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <nav className="w-full h-14 border-b flex items-center justify-between px-4 gap-4 bg-background">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="cursor-pointer flex-shrink-0" />
        <div className="h-6 w-px bg-border flex-shrink-0" />

        <Breadcrumb className="min-w-0 overflow-hidden">
          <BreadcrumbList className="flex-nowrap whitespace-nowrap">
            {filteredSegments.map((segment, index) => {
              const isLast = index === filteredSegments.length - 1;
              const href = getHref(index);
              const label = segment
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

              const visibilityClass = isLast ? "flex" : "hidden md:flex";

              return (
                <div
                  key={href}
                  className={`${visibilityClass} items-center gap-1.5`}
                >
                  <BreadcrumbItem>
                    {isLast && !skuCode ? (
                      <BreadcrumbPage className="truncate max-w-[150px] md:max-w-none">
                        {label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link 
                          href={href} 
                          className="truncate max-w-[120px] md:max-w-none"
                        >
                          {label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  
                  {/* Only show separator if it's NOT the last item OR if we have a SKU coming up */}
                  {(!isLast || skuCode) && (
                    <BreadcrumbSeparator />
                  )}
                </div>
              );
            })}

            {/* Add SKU breadcrumb if present */}
            {skuCode && (
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate max-w-[150px] md:max-w-none font-mono">
                  {skuCode}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mobile: Icon button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSearchClick}
          className="md:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Desktop: Search bar */}
        <ThemeToggle />
        <div className="hidden md:block">
          <SearchTrigger />
        </div>
      </div>
    </nav>
  );
}
