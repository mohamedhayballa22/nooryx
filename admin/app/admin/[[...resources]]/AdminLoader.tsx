'use client';

import dynamic from 'next/dynamic';

/**
 * This is the ONLY place `ssr: false` is allowed
 */
const AdminClient = dynamic(
  () => import('./AdminClient'),
  { ssr: false }
);

export default function AdminLoader() {
  return <AdminClient />;
}
