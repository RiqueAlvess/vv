'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/companies': 'Empresas',
  '/users': 'Usuários',
  '/campaigns': 'Campanhas',
};

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();

  const getTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (pathname === path || pathname.startsWith(path + '/')) return title;
    }
    return 'Asta';
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#E5E7EB] bg-white px-4 text-[#1A1A1A]">
      <SidebarTrigger className="-ml-1 hover:text-[#0D3D4F]" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold text-[#0D3D4F]">{getTitle()}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        {user?.company_name && (
          <Badge className="border-[#00C896]/30 bg-[#E8FBF5] text-xs text-[#00B082] hover:bg-[#E8FBF5]">
            {user.company_name}
          </Badge>
        )}
      </div>
    </header>
  );
}
