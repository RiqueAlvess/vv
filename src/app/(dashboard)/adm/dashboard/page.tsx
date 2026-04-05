'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileSpreadsheet } from 'lucide-react';

const TAB_PAGE_SIZE = 10;

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
  campaigns: CampaignRecord[];
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'ADM')
    return (
      <Badge className="bg-[#00C896] text-[#0D3D4F] border-[#00C896]/60 hover:bg-[#00B082] font-semibold">
        ADM
      </Badge>
    );
  if (role === 'RH')
    return (
      <Badge className="bg-[#0D3D4F] text-white border-[#0D3D4F] hover:bg-[#0D3D4F]">
        RH
      </Badge>
    );
  return (
    <Badge className="bg-[#1B5F75] text-white border-[#1B5F75] hover:bg-[#1B5F75]">
      {role}
    </Badge>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === 'active')
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        Ativa
      </Badge>
    );
  if (status === 'closed')
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        Encerrada
      </Badge>
    );
  if (status === 'draft')
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
        Rascunho
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
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [selected, setSelected] = useState<StatsSelected | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tab search + pagination state
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignPage, setCampaignPage] = useState(1);

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
    // Reset tab state when switching company
    setUserSearch('');
    setUserPage(1);
    setCampaignSearch('');
    setCampaignPage(1);
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

  function handleExportXLSX(data: StatsSelected, companyName: string) {
    const usersSheet = XLSX.utils.json_to_sheet(
      data.users.map((u) => ({
        Nome: u.name,
        Email: u.email,
        Perfil: u.role,
        Ativo: u.active ? 'Sim' : 'Não',
        'Último Login': formatDate(u.last_login_at),
        'Criado em': formatDate(u.created_at),
      }))
    );

    const campaignsSheet = XLSX.utils.json_to_sheet(
      data.campaigns.map((c) => ({
        Nome: c.name,
        Status: c.status === 'active' ? 'Ativa' : c.status === 'closed' ? 'Encerrada' : 'Rascunho',
        'Total de Respostas': c.responded,
        'Criado em': formatDate(c.created_at),
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, usersSheet, 'Usuários');
    XLSX.utils.book_append_sheet(wb, campaignsSheet, 'Campanhas');

    const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    XLSX.writeFile(wb, `${safeName}_dados.xlsx`);
  }

  // Client-side filtering + pagination for tabs
  const allUsers = selected?.users ?? [];
  const filteredUsers = userSearch
    ? allUsers.filter(u =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
      )
    : allUsers;
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / TAB_PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((userPage - 1) * TAB_PAGE_SIZE, userPage * TAB_PAGE_SIZE);

  const allCampaigns = selected?.campaigns ?? [];
  const filteredCampaigns = campaignSearch
    ? allCampaigns.filter(c =>
        c.name.toLowerCase().includes(campaignSearch.toLowerCase())
      )
    : allCampaigns;
  const campaignTotalPages = Math.max(1, Math.ceil(filteredCampaigns.length / TAB_PAGE_SIZE));
  const pagedCampaigns = filteredCampaigns.slice((campaignPage - 1) * TAB_PAGE_SIZE, campaignPage * TAB_PAGE_SIZE);

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
          Selecione uma empresa para visualizar detalhes.
        </p>
      )}

      {selectedCompany && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedCompany.name}
            </span>
            {selected && !loadingSelected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportXLSX(selected, selectedCompany.name)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar XLSX
              </Button>
            )}
          </div>

          <Tabs defaultValue="users">
            <TabsList>
              <TabsTrigger value="users">
                Usuários {!loadingSelected && `(${filteredUsers.length})`}
              </TabsTrigger>
              <TabsTrigger value="campaigns">
                Campanhas {!loadingSelected && `(${filteredCampaigns.length})`}
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-3">
              <Input
                placeholder="Buscar por nome ou email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="max-w-sm"
              />
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingSelected ? (
                      <TableSkeleton cols={6} />
                    ) : pagedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          {userSearch ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum usuário encontrado.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedUsers.map((u) => (
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
                              <span className="text-green-600 text-sm">Sim</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Não</span>
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
              <PaginationControls
                page={userPage}
                totalPages={userTotalPages}
                total={filteredUsers.length}
                onPageChange={setUserPage}
              />
            </TabsContent>

            {/* Campaigns Tab */}
            <TabsContent value="campaigns" className="space-y-3">
              <Input
                placeholder="Buscar por nome da campanha..."
                value={campaignSearch}
                onChange={(e) => { setCampaignSearch(e.target.value); setCampaignPage(1); }}
                className="max-w-sm"
              />
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total de Respostas</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingSelected ? (
                      <TableSkeleton cols={4} />
                    ) : pagedCampaigns.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          {campaignSearch ? 'Nenhuma campanha encontrada para esta busca.' : 'Nenhuma campanha encontrada.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedCampaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <CampaignStatusBadge status={c.status} />
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {c.responded}
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
              <PaginationControls
                page={campaignPage}
                totalPages={campaignTotalPages}
                total={filteredCampaigns.length}
                onPageChange={setCampaignPage}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
