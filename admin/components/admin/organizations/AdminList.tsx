import {
  List,
  useListContext,
} from 'react-admin';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Calendar, Mail } from 'lucide-react';

interface Admin {
  id: string;
  email: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string | null;
}

const Empty = () => (
  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
    <Shield className="w-12 h-12 mb-4 opacity-50" />
    <p className="text-sm">No admins found</p>
  </div>
);

const AdminGrid = () => {
  const { data, isLoading } = useListContext<Admin>();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-2/3 mb-3" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
      {data?.map((admin) => (
        <Card
          key={admin.id}
          className="p-6 hover:shadow-md transition-all duration-200 border-border/40"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground break-all">
                {admin.email}
              </p>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>
                  {new Date(admin.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(admin.created_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export const AdminList = () => (
  <div className="h-full bg-background">
    <List
      empty={<Empty />}
      perPage={25}
      component="div"
      className="shadow-none"
      actions={false}
    >
      <AdminGrid />
    </List>
  </div>
);
