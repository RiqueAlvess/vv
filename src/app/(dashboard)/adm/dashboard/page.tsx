'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CompanyOption {
  id: string;
  name: string;
  cnpj: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface EmployeeRecord {
  id: string;
  employee_name: string | null;
  employee_email: string;
  department: string | null;
  position: string | null;
  status: string;
}

interface CampaignRecord {
  id: string;
  name: string;
  status: string;
  created_at: string;
  total_invitations: number;
  responded: number;
  pending: number;
}

interface StatsSelected {
  company: CompanyOption;
  users: UserRecord[];
  employees: EmployeeRecord[];
  campaigns: CampaignRecord[];
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'ADM')
    return (
      <Badge className="bg-[#C5A059] text-[#002B49] border-[#C5A059]/60 hover:bg-[#D4AF37] font-semibold">
        ADM
      </Badge>
    );
  if (role === 'RH')
    return (
      <Badge className="bg-[#002B49] text-white border-[#002B49] hover:bg-[#002B49]">
        RH
      </Badge>
    );
  return (
    <Badge className="bg-[#002B49]/70 text-white border-[#002B49]/70 hover:bg-[#002B49]/70">
      {role}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'responded')
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        respondido
      </Badge>
    );
  if (status === 'sent')
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
        enviado
      </Badge>
    );
  if (status === 'active')
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        ativo
      </Badge>
    );
  if (status === 'closed')
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        encerrado
      </Badge>
    );
  if (status === 'draft')
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
        rascunho
      </Badge>
    );
  return (
    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">
      {status}
    </Badge>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function AdmDashboardPage() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(
    null
  );
  const [selected, setSelected] = useState<StatsSelected | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load company list on mount
  useEffect(() => {
    fetch('/api/adm/stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies ?? []);
      })
      .finally(() => setLoadingCompanies(false));
  }, []);

  // Load selected company data
  useEffect(() => {
    if (!selectedCompany) {
      setSelected(null);
      return;
    }
    setLoadingSelected(true);
    fetch(`/api/adm/stats?companyId=${selectedCompany.id}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.selected) setSelected(data.selected);
      })
      .finally(() => setLoadingSelected(false));
  }, [selectedCompany]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(company: CompanyOption) {
    setSelectedCompany(company);
    setSearch('');
    setIsOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setIsOpen(true);
    setSelectedCompany(null);
    setSelected(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Selecione uma empresa para visualizar detalhes.
        </p>
      </div>

      {/* Company combobox */}
      <div className="relative w-full max-w-sm" ref={dropdownRef}>
        <Input
          placeholder="Search company..."
          value={selectedCompany ? selectedCompany.name : search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={loadingCompanies}
          autoComplete="off"
        />
        {isOpen && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md max-h-60 overflow-auto">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
                onMouseDown={() => handleSelect(c)}
              >
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.cnpj}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!selectedCompany && !loadingSelected && (
        <p className="text-sm text-muted-foreground">
          Select a company to view details.
        </p>
      )}

      {selectedCompany && (
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSelected ? (
                    <TableSkeleton cols={6} />
                  ) : (selected?.users ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (selected?.users ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={u.role} />
                        </TableCell>
                        <TableCell>
                          {u.active ? (
                            <span className="text-green-600 text-sm">Yes</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              No
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(u.last_login_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(u.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Hash</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSelected ? (
                    <TableSkeleton cols={4} />
                  ) : (selected?.employees ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        No employees found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (selected?.employees ?? []).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                          {e.employee_email}
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.position ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.department ?? '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={e.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Invited</TableHead>
                    <TableHead className="text-right">Responded</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSelected ? (
                    <TableSkeleton cols={6} />
                  ) : (selected?.campaigns ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        No campaigns found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (selected?.campaigns ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {c.total_invitations}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {c.responded}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {c.pending}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(c.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
