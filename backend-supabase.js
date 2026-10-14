/* Conexão com o Supabase (banco de dados + login). Usado no site publicado. */
(function () {
  const C = window.APP_CONFIG || {};
  let sb = null;
  let uid = null;
  let recCb = null;

  const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };

  window.BK = {
    modo: 'supabase',
    configurado() {
      return !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
    },
    onRecuperacao(cb) { recCb = cb; },
    async init() {
      sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      sb.auth.onAuthStateChange((evt) => { if (evt === 'PASSWORD_RECOVERY' && recCb) recCb(); });
      const { data } = await sb.auth.getSession();
      uid = data.session ? data.session.user.id : null;
      return data.session ? { id: uid, email: data.session.user.email } : null;
    },
    async precos() { return ok(await sb.rpc('precos_publicos')); },

    /* ----- conta ----- */
    async cadastrar({ email, senha, nome, whatsapp }) {
      const r = await sb.auth.signUp({ email, password: senha, options: { data: { nome, whatsapp }, emailRedirectTo: location.origin + location.pathname } });
      if (r.error) throw new Error(r.error.message);
      // e-mail já cadastrado: o Supabase devolve usuário sem identidades
      if (r.data.user && Array.isArray(r.data.user.identities) && r.data.user.identities.length === 0) {
        throw new Error('already registered');
      }
      return { sessao: !!r.data.session };
    },
    async entrar(email, senha) {
      const r = await sb.auth.signInWithPassword({ email, password: senha });
      if (r.error) throw new Error(r.error.message);
      uid = r.data.user.id;
    },
    async sair() { await sb.auth.signOut(); uid = null; },
    async recuperar(email) {
      const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (r.error) throw new Error(r.error.message);
    },
    async novaSenha(senha) {
      const r = await sb.auth.updateUser({ password: senha });
      if (r.error) throw new Error(r.error.message);
    },
    entrarDemo() { throw new Error('Disponível só no modo demonstração.'); },

    /* ----- aluno ----- */
    async meu() {
      const u = (await sb.auth.getUser()).data.user;
      if (!u) throw new Error('Sessão expirada. Entre de novo.');
      uid = u.id;
      const [perfil, ass, plano, adm, prog, cart] = await Promise.all([
        sb.from('perfis').select('nome,email,whatsapp').eq('id', uid).maybeSingle(),
        sb.from('assinaturas').select('plano,status,vence_em').eq('user_id', uid).maybeSingle(),
        sb.rpc('meu_plano'),
        sb.rpc('is_admin'),
        sb.from('progresso').select('dados').eq('user_id', uid).maybeSingle(),
        sb.from('carteiras').select('dados').eq('user_id', uid).maybeSingle()
      ]);
      return {
        id: uid,
        perfil: ok(perfil) || { nome: '', email: u.email, whatsapp: '' },
        assinatura: ok(ass) || null,
        plano: Number(ok(plano)) || 0,
        admin: ok(adm) === true,
        progresso: (ok(prog) || {}).dados || null,
        carteira: (ok(cart) || {}).dados || null
      };
    },
    async salvarProgresso(obj) {
      ok(await sb.from('progresso').upsert({ user_id: uid, dados: obj, atualizado_em: new Date().toISOString() }));
    },
    async salvarCarteira(obj) {
      ok(await sb.from('carteiras').upsert({ user_id: uid, dados: obj, atualizado_em: new Date().toISOString() }));
    },
    async salvarPerfil({ nome, whatsapp }) {
      ok(await sb.from('perfis').update({ nome, whatsapp }).eq('id', uid));
    },
    async config() { return ok(await sb.from('config').select('*').eq('id', 1).maybeSingle()); },
    async conteudo() { const r = ok(await sb.from('conteudo').select('dados').eq('id', 'curso').maybeSingle()); return r ? r.dados : null; },
    async dicas() { return ok(await sb.from('dicas').select('*').eq('publicada', true).order('criado_em', { ascending: false })); },
    async solicitar(plano, nota) {
      const r = await sb.from('solicitacoes').insert({ user_id: uid, plano, nota: String(nota || '').slice(0, 200) });
      if (r.error) {
        if (/duplicate|unique/i.test(r.error.message)) throw new Error('Você já tem um pedido aguardando confirmação.');
        throw new Error(r.error.message);
      }
    },
    async minhasSolicitacoes() { return ok(await sb.from('solicitacoes').select('*').eq('user_id', uid).order('criado_em', { ascending: false })); },
    async meusPagamentos() { return ok(await sb.from('pagamentos').select('*').eq('user_id', uid).order('criado_em', { ascending: false })); },
    async minhasMentorias() { return ok(await sb.from('mentorias').select('*').eq('user_id', uid).order('mes', { ascending: false })); },
    async pedirMentoria({ mes, preferencia, assunto }) {
      const r = await sb.from('mentorias').insert({ user_id: uid, mes, preferencia, assunto, status: 'pedida' });
      if (r.error) {
        if (/duplicate|unique/i.test(r.error.message)) throw new Error('Você já pediu a mentoria deste mês.');
        throw new Error(r.error.message);
      }
    },

    /* ----- administração ----- */
    async adminAlunos() { return ok(await sb.rpc('admin_alunos')); },
    async adminSolicitacoes() { return ok(await sb.rpc('admin_solicitacoes')); },
    async adminMentorias() { return ok(await sb.rpc('admin_mentorias')); },
    async adminAluno(id) {
      const [pag, prog, cart, men, sol] = await Promise.all([
        sb.from('pagamentos').select('*').eq('user_id', id).order('criado_em', { ascending: false }),
        sb.from('progresso').select('dados').eq('user_id', id).maybeSingle(),
        sb.from('carteiras').select('dados').eq('user_id', id).maybeSingle(),
        sb.from('mentorias').select('*').eq('user_id', id).order('mes', { ascending: false }),
        sb.from('solicitacoes').select('*').eq('user_id', id).order('criado_em', { ascending: false })
      ]);
      return {
        pagamentos: ok(pag), progresso: (ok(prog) || {}).dados || null, carteira: (ok(cart) || {}).dados || null,
        mentorias: ok(men), solicitacoes: ok(sol)
      };
    },
    async adminConfirmar({ user_id, plano, valor, dias, forma, obs }) {
      return ok(await sb.rpc('confirmar_pagamento', { p_user: user_id, p_plano: plano, p_valor: valor, p_dias: dias, p_forma: forma, p_obs: obs }));
    },
    async adminAjustarAssinatura({ user_id, plano, status, vence_em }) {
      ok(await sb.from('assinaturas').upsert({ user_id, plano, status, vence_em, atualizado_em: new Date().toISOString() }));
    },
    async adminRecusar(id, motivo) {
      ok(await sb.from('solicitacoes').update({ status: 'recusada', motivo: motivo || '' }).eq('id', id));
    },
    async adminNota(user_id, texto) {
      ok(await sb.from('notas_admin').upsert({ user_id, texto, atualizado_em: new Date().toISOString() }));
    },
    async adminSalvarMentoria(id, patch) { ok(await sb.from('mentorias').update(patch).eq('id', id)); },
    async adminDicas() { return ok(await sb.from('dicas').select('*').order('criado_em', { ascending: false })); },
    async adminSalvarDica(d) {
      const corpo = { titulo: d.titulo, categoria: d.categoria, corpo: d.corpo, publicada: !!d.publicada, destaque: !!d.destaque };
      if (d.id) ok(await sb.from('dicas').update(corpo).eq('id', d.id));
      else ok(await sb.from('dicas').insert(corpo));
    },
    async adminExcluirDica(id) { ok(await sb.from('dicas').delete().eq('id', id)); },
    async adminSalvarConfig(c) { ok(await sb.from('config').update(c).eq('id', 1)); }
  };
})();
