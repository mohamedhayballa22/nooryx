import { useState } from 'react';
import {
  List,
  useListContext,
} from 'react-admin';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Calendar, UserPlus } from 'lucide-react';
import { GrantAccessModal } from './GrantAccessModal';

interface Organization {
  id: string;
  name: string;
  currency: string;
  valuation_method: string;
  created_at: string;
  updated_at: string | null;
  user_count: number;
  users: Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string | null;
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
  }>;
}

const Empty = () => (
  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
    <Building2 className="w-12 h-12 mb-4 opacity-50" />
    <p className="text-sm">No organizations found</p>
  </div>
);

const OrganizationGrid = () => {
  const { data, isLoading } = useListContext<Organization>();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
      {data?.map((org) => (
        <Card
          key={org.id}
          className="p-6 hover:shadow-md transition-all duration-200 border-border/40"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">
                  {org.name}
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {org.id}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {org.currency}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {org.valuation_method}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                Created {new Date(org.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {org.users.length > 0 && (
            <div className="pt-4 border-t border-border/40">
              <div className="space-y-3">
                {org.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {user.first_name[0]}
                        {user.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {user.is_verified && (
                        <Badge variant="outline" className="text-xs">
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

const ListHeader = ({ onGrantAccessClick }: { onGrantAccessClick: () => void }) => (
  <div className="flex items-center justify-between p-6 border-b border-border/40">
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Organizations</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage organizations and user access
      </p>
    </div>
    <Button variant="outline" onClick={onGrantAccessClick} className="gap-2 cursor-pointer">
      <UserPlus className="w-4 h-4" />
      Grant Access
    </Button>
  </div>
);

export const OrganizationList = () => {
  const [isGrantAccessOpen, setIsGrantAccessOpen] = useState(false);

  return (
    <div className="h-full bg-background">
      <ListHeader onGrantAccessClick={() => setIsGrantAccessOpen(true)} />
      <List
        empty={<Empty />}
        perPage={25}
        component="div"
        className="shadow-none"
        actions={false}
      >
        <OrganizationGrid />
      </List>
      <GrantAccessModal 
        isOpen={isGrantAccessOpen} 
        onOpenChange={setIsGrantAccessOpen} 
      />
    </div>
  );
};
