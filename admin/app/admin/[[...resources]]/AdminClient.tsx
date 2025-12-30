'use client';

import { Admin, Resource, bwDarkTheme } from 'react-admin';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { dataProvider } from '@/lib/api/dataProvider';
import { authProvider } from '@/lib/auth/adminAuth';
import { OrganizationList } from '@/components/admin/organizations/OrganizationList';
import { OrganizationCreate } from '@/components/admin/organizations/OrganizationCreate';
import { Waitlist } from '@/components/admin/organizations/Waitlist';
import { AdminList } from '@/components/admin/organizations/AdminList';

// Custom component that redirects to /login
const LoginPage = () => {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/login');
  }, [router]);
  
  return null;
};

export default function AdminClient() {
  return (
    <Admin
      dataProvider={dataProvider}
      authProvider={authProvider}
      loginPage={LoginPage}
      theme={bwDarkTheme}
      requireAuth
    >
      <Resource
        name="organizations"
        list={OrganizationList}
        create={OrganizationCreate}
        options={{ label: 'Organizations' }}
      />
      <Resource
        name="waitlist"
        list={Waitlist}
        options={{ label: 'Waitlist' }}
      />
      <Resource
        name="admins"
        list={AdminList}
        options={{ label: 'Admins' }}
      />
    </Admin>
  );
}
