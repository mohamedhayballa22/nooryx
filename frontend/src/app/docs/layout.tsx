import { source } from '@/lib/source';
import { DocsLayout } from '@/components/layout/docs/index';
import type { ReactNode } from 'react';
import GuestNavbar from "@/components/guest-navbar";

export default function DocsLayoutComponent({ children }: { children: ReactNode }) {
  return (
    <div 
      style={{ '--fd-banner-height': '5rem' } as React.CSSProperties}
      className="flex flex-col min-h-screen pt-20" 
    >
      <GuestNavbar />
      
      <DocsLayout
        tree={source.pageTree}
        containerProps={{ className: "flex-1" }} 
      >
        {children}
      </DocsLayout>
    </div>
  );
}
