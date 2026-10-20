/* Conexão com o Firebase (login + Firestore). Usado no site publicado.
   Usa a biblioteca "compat" do Firebase, carregada por <script> no index.html. */
(function () {
  const C = window.FIREBASE_CONFIG || {};
  let auth = null, fs = null, uid = null, TS = null;

  const pad = (n) => String(n).padStart(2, '0');
  const agora = () => new Date().toISOString();
  const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const porDataDesc = (campo) => (a, b) => String(b[campo] || '').localeCompare(String(a[campo] || ''));
  const col = (n) => fs.collection(n);
  const docRef = (n, id) => fs.collection(n).doc(id);
  const lista = (snap) => snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  const limpa = (o) => { const r = {}; Object.keys(o || {}).forEach((k) => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };

  /* Fim do último dia de acesso (vencimento + tolerância), meia-noite de Brasília = 03:00 UTC do dia seguinte. */
  function acessoAte(venceEm, tol) {
    const [y, m, d] = String(venceEm).split('-').map(Number);
    return TS.fromMillis(Date.UTC(y, m - 1, d + Number(tol || 0) + 1, 3, 0, 0));
  }
  function somaDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  async function tolerancia() {
    const s = await docRef('config', 'main').get();
    const v = s.exists ? s.data().tolerancia_dias : null;
    return v == null ? 3 : Number(v);
  }
  const lerJson = (snap) => {
    if (!snap || !snap.exists) return null;
    try { return JSON.parse(snap.data().json); } catch (e) { return null; }
  };

  /* Traduz erros do Firebase para as mensagens que a tela já sabe mostrar. */
  function erro(e) {
    const c = (e && e.code) || '';
    const mapa = {
      'auth/invalid-credential': 'Invalid login credentials', 'auth/wrong-password': 'Invalid login credentials',
      'auth/user-not-found': 'Invalid login credentials', 'auth/invalid-login-credentials': 'Invalid login credentials',
      'auth/email-already-in-use': 'already registered', 'auth/weak-password': 'Password should be at least 6 characters',
      'auth/invalid-email': 'E-mail inválido.', 'auth/too-many-requests': 'rate limit',
      'auth/network-request-failed': 'Failed to fetch', 'auth/requires-recent-login': 'Por segurança, saia, entre de novo e repita.',
      'permission-denied': 'row-level security', 'unavailable': 'Failed to fetch'
    };
    return new Error(mapa[c] || (e && e.message) || 'Algo deu errado.');
  }
  const seg = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw (e instanceof Error && !e.code) ? e : erro(e); } };
  const SINCRONOS = ['configurado', 'onRecuperacao', 'entrarDemo'];
  function embrulha(obj) { Object.keys(obj).forEach((k) => { if (typeof obj[k] === 'function' && !SINCRONOS.includes(k)) obj[k] = seg(obj[k]); }); return obj; }

  const BKfb = {
    modo: 'firebase',
    configurado() {
      return !!(C.apiKey && C.projectId && C.appId && window.firebase && window.firebase.initializeApp);
    },
    onRecuperacao() { /* o Firebase abre a própria página de redefinição de senha */ },
    async init() {
      if (!window.firebase.apps.length) window.firebase.initializeApp(C);
      auth = window.firebase.auth();
      fs = window.firebase.firestore();
      TS = window.firebase.firestore.Timestamp;
      auth.languageCode = 'pt-BR';
      const u = await new Promise((res) => { const off = auth.onAuthStateChanged((x) => { off(); res(x); }); });
      uid = u ? u.uid : null;
      return u ? { id: u.uid, email: u.email } : null;
    },
    async precos() {
      // antes do login só a coleção "publico" é legível
      if (!fs) { if (!window.firebase.apps.length) window.firebase.initializeApp(C); fs = window.firebase.firestore(); TS = window.firebase.firestore.Timestamp; }
      const s = await docRef('publico', 'config').get();
      const d = s.exists ? s.data() : {};
      return { preco1: d.preco1 || 14.99, preco2: d.preco2 || 19.99, preco3: d.preco3 || 49.99 };
    },

    /* ----- conta ----- */
    async cadastrar({ email, senha, nome, whatsapp }) {
      const r = await auth.createUserWithEmailAndPassword(email, senha);
      uid = r.user.uid;
      await docRef('perfis', uid).set({ nome: nome || '', email: r.user.email, whatsapp: whatsapp || '', criado_em: agora() });
      return { sessao: true };
    },
    async entrar(email, senha) { const r = await auth.signInWithEmailAndPassword(email, senha); uid = r.user.uid; },
    async sair() { await auth.signOut(); uid = null; },
    async recuperar(email) { await auth.sendPasswordResetEmail(email); },
    async novaSenha(senha) { await auth.currentUser.updatePassword(senha); },
    entrarDemo() { throw new Error('Disponível só no modo demonstração.'); },

    /* ----- aluno ----- */
    async meu() {
      const u = auth.currentUser;
      if (!u) throw new Error('Sessão expirada. Entre de novo.');
      uid = u.uid;
      const [perfil, ass, adm, prog, cart] = await Promise.all([
        docRef('perfis', uid).get(), docRef('assinaturas', uid).get(), docRef('admins', uid).get(),
        docRef('progresso', uid).get(), docRef('carteiras', uid).get()
      ]);
      const a = ass.exists ? ass.data() : null;
      let plano = 0;
      if (a && a.status === 'ativa' && a.acesso_ate && a.acesso_ate.toMillis() > Date.now()) plano = Number(a.plano) || 0;
      return {
        id: uid,
        perfil: perfil.exists ? { nome: perfil.data().nome, email: perfil.data().email, whatsapp: perfil.data().whatsapp } : { nome: '', email: u.email, whatsapp: '' },
        assinatura: a ? { plano: a.plano, status: a.status, vence_em: a.vence_em } : null,
        plano, admin: adm.exists,
        progresso: lerJson(prog), carteira: lerJson(cart)
      };
    },
    async salvarProgresso(obj) { await docRef('progresso', uid).set({ json: JSON.stringify(obj), atualizado_em: agora() }); },
    async salvarCarteira(obj) { await docRef('carteiras', uid).set({ json: JSON.stringify(obj), atualizado_em: agora() }); },
    async salvarPerfil({ nome, whatsapp }) { await docRef('perfis', uid).update({ nome, whatsapp }); },
    async config() {
      const [pub, main] = await Promise.all([docRef('publico', 'config').get(), docRef('config', 'main').get()]);
      return Object.assign({ preco1: 14.99, preco2: 19.99, preco3: 49.99, tolerancia_dias: 3 }, pub.exists ? pub.data() : {}, main.exists ? main.data() : {});
    },
    async conteudo() { return lerJson(await docRef('conteudo', 'curso').get()); },
    async dicas() {
      const r = lista(await col('dicas').where('publicada', '==', true).get());
      return r.sort(porDataDesc('criado_em'));
    },
    async solicitar(plano, nota) {
      const ja = lista(await col('solicitacoes').where('user_id', '==', uid).get()).some((s) => s.status === 'pendente');
      if (ja) throw new Error('Você já tem um pedido aguardando confirmação.');
      await col('solicitacoes').add({ user_id: uid, plano, nota: String(nota || '').slice(0, 200), status: 'pendente', motivo: '', criado_em: agora() });
    },
    async minhasSolicitacoes() { return lista(await col('solicitacoes').where('user_id', '==', uid).get()).sort(porDataDesc('criado_em')); },
    async meusPagamentos() { return lista(await col('pagamentos').where('user_id', '==', uid).get()).sort(porDataDesc('criado_em')); },
    async minhasMentorias() { return lista(await col('mentorias').where('user_id', '==', uid).get()).sort(porDataDesc('mes')); },
    async pedirMentoria({ mes, preferencia, assunto }) {
      const ref = docRef('mentorias', uid + '_' + mes);
      if ((await ref.get()).exists) throw new Error('Você já pediu a mentoria deste mês.');
      await ref.set({ user_id: uid, mes, preferencia: preferencia || '', assunto: assunto || '', status: 'pedida', data_hora: null, link: '', resumo: '', estrategia: '', criado_em: agora() });
    },

    /* ----- administração ----- */
    async adminAlunos() {
      const [perfis, ass, prog, cart, sols, notas, adms] = await Promise.all(
        ['perfis', 'assinaturas', 'progresso', 'carteiras', 'solicitacoes', 'notas_admin', 'admins'].map((n) => col(n).get())
      );
      const A = {}, G = {}, K = {}, N = {}, ADM = {}, P = {};
      ass.forEach((d) => { A[d.id] = d.data(); });
      prog.forEach((d) => { G[d.id] = lerJson(d); });
      cart.forEach((d) => { K[d.id] = true; });
      notas.forEach((d) => { N[d.id] = d.data().texto || ''; });
      adms.forEach((d) => { ADM[d.id] = true; });
      sols.forEach((d) => { const s = d.data(); if (s.status === 'pendente' && !P[s.user_id]) P[s.user_id] = s; });
      return lista(perfis).filter((u) => !ADM[u.id]).sort(porDataDesc('criado_em')).map((u) => {
        const a = A[u.id], g = G[u.id], p = P[u.id];
        return {
          id: u.id, nome: u.nome, email: u.email, whatsapp: u.whatsapp, criado_em: u.criado_em,
          plano: a ? a.plano : null, status: a ? a.status : null, vence_em: a ? a.vence_em : null,
          modulos: g && g.done ? Object.keys(g.done).length : 0, xp: g ? g.xp || 0 : 0,
          tem_carteira: !!K[u.id], pendente: !!p, plano_pedido: p ? p.plano : null, nota: N[u.id] || ''
        };
      });
    },
    async adminSolicitacoes() {
      const [sols, perfis] = await Promise.all([col('solicitacoes').where('status', '==', 'pendente').get(), col('perfis').get()]);
      const P = {}; perfis.forEach((d) => { P[d.id] = d.data(); });
      return lista(sols).map((s) => { const u = P[s.user_id] || {}; return { id: s.id, user_id: s.user_id, nome: u.nome || '', email: u.email || '', whatsapp: u.whatsapp || '', plano: s.plano, nota: s.nota, criado_em: s.criado_em }; })
        .sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
    },
    async adminMentorias() {
      const [men, perfis] = await Promise.all([col('mentorias').get(), col('perfis').get()]);
      const P = {}; perfis.forEach((d) => { P[d.id] = d.data(); });
      return lista(men).map((m) => { const u = P[m.user_id] || {}; return Object.assign({}, m, { nome: u.nome || '', email: u.email || '', whatsapp: u.whatsapp || '' }); })
        .sort((a, b) => (b.status === 'pedida') - (a.status === 'pedida') || String(b.mes).localeCompare(String(a.mes)));
    },
    async adminAluno(id) {
      const [pag, prog, cart, men, sol] = await Promise.all([
        col('pagamentos').where('user_id', '==', id).get(), docRef('progresso', id).get(), docRef('carteiras', id).get(),
        col('mentorias').where('user_id', '==', id).get(), col('solicitacoes').where('user_id', '==', id).get()
      ]);
      return {
        pagamentos: lista(pag).sort(porDataDesc('criado_em')), progresso: lerJson(prog), carteira: lerJson(cart),
        mentorias: lista(men), solicitacoes: lista(sol)
      };
    },
    async adminConfirmar({ user_id, plano, valor, dias, forma, obs }) {
      const [perfil, ass, tol, pend] = await Promise.all([
        docRef('perfis', user_id).get(), docRef('assinaturas', user_id).get(), tolerancia(),
        col('solicitacoes').where('user_id', '==', user_id).get()
      ]);
      if (!perfil.exists) throw new Error('Aluno não encontrado.');
      const h = hojeBR();
      const a = ass.exists ? ass.data() : null;
      const base = a && a.vence_em > h ? a.vence_em : h;
      const nova = somaDias(base, Number(dias));
      const b = fs.batch();
      b.set(docRef('assinaturas', user_id), { plano, status: 'ativa', vence_em: nova, acesso_ate: acessoAte(nova, tol), atualizado_em: agora() });
      b.set(col('pagamentos').doc(), { user_id, plano, valor, dias, forma: forma || 'Pix', obs: obs || '', pago_em: h, criado_em: agora() });
      pend.docs.forEach((d) => { if (d.data().status === 'pendente') b.update(d.ref, { status: 'confirmada' }); });
      await b.commit();
      return nova;
    },
    async adminAjustarAssinatura({ user_id, plano, status, vence_em }) {
      const tol = await tolerancia();
      await docRef('assinaturas', user_id).set({ plano, status, vence_em, acesso_ate: acessoAte(vence_em, tol), atualizado_em: agora() });
    },
    async adminRecusar(id, motivo) { await docRef('solicitacoes', id).update({ status: 'recusada', motivo: motivo || '' }); },
    async adminNota(user_id, texto) { await docRef('notas_admin', user_id).set({ texto, atualizado_em: agora() }); },
    async adminSalvarMentoria(id, patch) { await docRef('mentorias', id).update(limpa(patch)); },
    async adminDicas() { return lista(await col('dicas').get()).sort(porDataDesc('criado_em')); },
    async adminSalvarDica(d) {
      const corpo = { titulo: d.titulo, categoria: d.categoria, corpo: d.corpo, publicada: !!d.publicada, destaque: !!d.destaque };
      if (d.id) await docRef('dicas', d.id).update(corpo);
      else await col('dicas').add(Object.assign(corpo, { criado_em: agora() }));
    },
    async adminExcluirDica(id) { await docRef('dicas', id).delete(); },
    async adminSalvarConfig(c) {
      const antes = await tolerancia();
      const b = fs.batch();
      b.set(docRef('publico', 'config'), { preco1: c.preco1, preco2: c.preco2, preco3: c.preco3 }, { merge: true });
      b.set(docRef('config', 'main'), { pix_chave: c.pix_chave, pix_favorecido: c.pix_favorecido, whatsapp: c.whatsapp, tolerancia_dias: c.tolerancia_dias }, { merge: true });
      await b.commit();
      if (Number(c.tolerancia_dias) !== antes) {
        // o limite de acesso de cada assinatura depende da tolerância: recalcula
        const todas = await col('assinaturas').get();
        for (let i = 0; i < todas.docs.length; i += 400) {
          const lote = fs.batch();
          todas.docs.slice(i, i + 400).forEach((d) => { const a = d.data(); if (a.vence_em) lote.update(d.ref, { acesso_ate: acessoAte(a.vence_em, c.tolerancia_dias) }); });
          await lote.commit();
        }
      }
    },
    async importar(tipo, dados) {
      if (tipo === 'curso') {
        await docRef('conteudo', 'curso').set({ json: JSON.stringify(dados), atualizado_em: agora() });
      } else if (tipo === 'dicas') {
        const base = Date.now();
        const b = fs.batch();
        dados.forEach((d, i) => b.set(col('dicas').doc(), {
          titulo: String(d.titulo || ''), categoria: String(d.categoria || ''), corpo: String(d.corpo || ''),
          destaque: !!d.destaque, publicada: true, criado_em: new Date(base - i * 1000).toISOString()
        }));
        await b.commit();
      } else throw new Error('Tipo de importação desconhecido.');
    }
  };

  window.BK = embrulha(BKfb);
})();
