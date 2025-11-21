import { source } from '@/lib/source';
import { DocsLayout } from '@/components/layout/docs/index';
import type { ReactNode } from 'react';

export default function DocsLayoutComponent({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
    >
      {children}
    </DocsLayout>
  );
}
