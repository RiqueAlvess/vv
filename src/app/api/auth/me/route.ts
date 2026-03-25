import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = apiLimiter(user.user_id);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429 }
      );
    }

    const supabase = createServerClient();

    const { data: userData, error } = await supabase
      .from('core.users')
      .select('id, name, email, role, company_id, sector_id, active, created_at')
      .eq('id', user.user_id)
      .single();

    if (error || !userData) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const { data: company } = await supabase
      .from('core.companies')
      .select('id, name, cnpj, cnae')
      .eq('id', userData.company_id)
      .single();

    return NextResponse.json({
      ...userData,
      company: company ?? null,
    });
  } catch (err) {
    console.error('Get me error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
