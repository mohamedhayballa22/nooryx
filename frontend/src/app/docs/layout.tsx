import { source } from '@/lib/source';
import { DocsLayout } from '@/components/layout/docs/index';
import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { DocsHeaderWrapper } from '@/components/docs/ui/docs-header-wrapper';

export default function DocsLayoutComponent({ children }: { children: ReactNode }) {
  return (
    <Fragment>
      <style>{`
        html {
          scroll-padding-top: 10rem;
        }
        
        @media (min-width: 768px) {
          html {
            scroll-padding-top: 6.5rem;
          }
        }
      `}</style>
      <div
        style={{ '--fd-banner-height': '3.5rem' } as React.CSSProperties}
      >
        <DocsHeaderWrapper />

        <DocsLayout
          tree={source.pageTree}
          containerProps={{ className: "flex-1" }}
        >
          {children}
        </DocsLayout>
      </div>
    </Fragment>
  );
}
