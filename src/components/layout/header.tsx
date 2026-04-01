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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#C5A059]/30 bg-[#002B49] px-4 text-white">
      <SidebarTrigger className="-ml-1 hover:text-[#C5A059]" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold text-[#C5A059]">{getTitle()}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        {user?.company_name && (
          <Badge className="border-[#C5A059]/30 bg-[#C5A059]/20 text-xs text-[#C5A059] hover:bg-[#C5A059]/30">
            {user.company_name}
          </Badge>
        )}
      </div>
    </header>
  );
}
