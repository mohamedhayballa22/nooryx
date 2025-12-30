export function generateStaticParams() {
  return [{ resources: [] }];
}

import AdminLoader from './AdminLoader';

export default function AdminPage() {
  return <AdminLoader />;
}
