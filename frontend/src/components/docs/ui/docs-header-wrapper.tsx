"use client";

import { DocsHeader } from './docs-header';
import { useAuth } from '@/lib/auth';

export function DocsHeaderWrapper() {
  const { isAuthenticated } = useAuth();
  
  return <DocsHeader isAuthenticated={isAuthenticated} />;
}
