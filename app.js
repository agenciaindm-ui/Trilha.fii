(function(){
'use strict';
const MONTHS=12, APORTE=1000, CAIXA0=10000;
const $=(s,r=document)=>r.querySelector(s);
const BRL=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const NUM=(n,d=2)=>n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const ri=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const rf=(a,b,d=2)=>+(a+Math.random()*(b-a)).toFixed(d);
const pick=a=>a[Math.floor(Math.random()*a.length)];
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function fmtC(n){const a=Math.abs(n);if(a>=1e6){return 'R$ '+(n/1e6).toFixed(1).replace('.',',')+' mi';}if(a>=1e3){const v=n/1e3;return 'R$ '+(Number.isInteger(v)?v:v.toFixed(1).replace('.',','))+' mil';}return 'R$ '+Math.round(n);}

/* ---------- conteúdo da trilha ---------- */
let LEVELS=[],MODS={},ORDER=[],ALLQ=[],TERMS=[];
function buildContent(c){
  LEVELS=c.levels;TERMS=c.terms;MODS={};ORDER=[];ALLQ=[];
  LEVELS.forEach((lv,li)=>lv.mods.forEach((m,i)=>{m.lvl=li;m.n=i+1;MODS[m.id]=m;ORDER.push(m.id);}));
  ORDER.forEach(id=>MODS[id].qs.forEach(q=>ALLQ.push({q:q.q,o:q.o,why:q.why,mod:MODS[id].title})));
}

/* ---------- estado salvo (por navegador) ---------- */
let KEY='trilhafii:v2:anon';
function defaults(){return{xp:0,done:{},drill:{ok:0,total:0,streak:0,best:0},cards:{},bestSim:null,watch:null,obj:null,goals:{},dyRef:9,tcart:{best:0,xp:false},ck:{},hlog:{},habits:[{id:'hb1',nome:'Fazer um exercício no Treino',f:'d'},{id:'hb2',nome:'Revisar meus gastos do dia',f:'d'},{id:'hb3',nome:'Ler um relatório gerencial',f:'s'}]};}
function load(){try{const j=JSON.parse(localStorage.getItem(KEY));if(j&&typeof j==='object')return Object.assign(defaults(),j);}catch(e){}return defaults();}
let S=defaults();
let onSave=null;
function save(){S._t=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}if(onSave)onSave();}
const RANKS=[[0,'Curioso'],[100,'Cotista'],[300,'Analista'],[600,'Gestor'],[1000,'Mestre']];
function rank(xp){let i=0;RANKS.forEach((r,k)=>{if(xp>=r[0])i=k;});return{name:RANKS[i][1],base:RANKS[i][0],next:RANKS[i+1]||null};}
function renderHead(){const r=rank(S.xp);const pct=r.next?Math.round((S.xp-r.base)/(r.next[0]-r.base)*100):100;
  $('#xp').innerHTML=`<span class="rank">${r.name}</span><span class="xpn">${S.xp} XP</span><span class="bar sm" aria-hidden="true"><i style="width:${pct}%"></i></span>`;}
const isUnlocked=li=>li===0||LEVELS[li-1].mods.every(m=>S.done[m.id]);
const levelDone=li=>LEVELS[li].mods.every(m=>S.done[m.id]);

/* ---------- ícones ---------- */
const IC={
 check:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>',
 dot:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>',
 lock:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>'
};

/* ---------- roteamento ---------- */
let openMod=null,L=null,trainTab='ind',simTab='cart',lot=1;
let P=null,cardI=0,flipped=false,RV=null,G=null;
const TABS=['trilha','metas','treino','simulacao','mercado','corretoras','dicas','carteira','mentoria','conta','admin'];
const curTab=()=>{const h=location.hash.slice(1);return TABS.includes(h)?h:(typeof defTab==='function'?defTab():'trilha');};

function renderCourseView(v){
  if(v==='mercado'&&MK.st==='idle')loadMercado();
  $('#view').innerHTML=v==='trilha'?viewTrilha():v==='treino'?viewTreino():v==='metas'?viewMetas():v==='mercado'?viewMercado():v==='corretoras'?viewCorretoras():viewSim();
  if(v==='simulacao'&&simTab==='calc')updateCalc();
  if(v==='corretoras')updateKcalc();
}

/* ---------- trilha ---------- */
const BARS=[38,52,30,64,44,72,36,58,48,80,40,66,42,60,34,70,46,78,38,62,50,84,44,68];
function viewTrilha(){
  if(openMod)return viewLesson(openMod);
  const total=ORDER.length,done=ORDER.filter(id=>S.done[id]).length;
  const nxt=nextRec();
  const sky=ORDER.map((id,i)=>`<i class="${S.done[id]?'on':''}" style="height:${BARS[i%BARS.length]}%"></i>`).join('');
  const cta=nxt?`<button class="btn primary" data-act="open" data-id="${nxt}">${done?'Continuar':'Começar'}: ${MODS[nxt].title}</button>`:`<p><b>Trilha completa.</b> Agora reforce no Treino e teste decisões na Simulação.</p>`;
  const hero=`<section class="card hero"><div class="stack"><p class="eyebrow">Seu avanço</p><h1>${done} de ${total} módulos</h1><p class="muted">Cada módulo tem uma lição curta e duas perguntas. Acertando tudo, o módulo conta e você ganha 50 XP. Cada nível abre quando o anterior termina.</p><div class="row">${cta}</div></div><div class="skyline" role="img" aria-label="${done} de ${total} módulos concluídos">${sky}</div></section>`;
  const path=LEVELS.map((lv,li)=>{
    const lock=!isUnlocked(li),dn=levelDone(li);
    const mods=lv.mods.map(m=>{const d=!!S.done[m.id];return`<button class="mod ${d?'done':''}" data-act="open" data-id="${m.id}" ${lock?'disabled':''}>${lock?IC.lock:d?IC.check:IC.dot}<span class="t"><b>${m.title}</b><span>${d?'Concluído':'2 perguntas · +50 XP'}${focus(m.id)?' · foco no seu objetivo':''}</span></span></button>`;}).join('');
    return`<section class="level ${dn?'done':''} ${lock?'locked':''}"><div class="rail"><span class="node" aria-hidden="true">${dn?'✓':li+1}</span></div><div class="lbody"><div><p class="eyebrow">Nível ${li+1}${lock?' · bloqueado':dn?' · concluído':''}</p><h3>${lv.title}</h3></div><p>${lv.desc}</p><div class="mods">${mods}</div></div></section>`;
  }).join('');
  return hero+`<div class="path">${path}</div>`;
}
function startLesson(id){const m=MODS[id];L={checked:false,passed:false,gained:0,lvUp:false,qs:m.qs.map(q=>({q:q.q,why:q.why,pick:-1,opts:shuffle(q.o.map((t,i)=>({t,ok:i===0})))}))};}
function viewLesson(id){
  const m=MODS[id],lv=LEVELS[m.lvl];
  const qs=L.qs.map((q,i)=>{
    const opts=q.opts.map((o,j)=>{const sel=q.pick===j;let c='opt';if(L.checked){if(o.ok)c+=' ok';else if(sel)c+=' no';}
      return`<label class="${c}"><input type="radio" name="q${i}" value="${j}" data-q="${i}" ${sel?'checked':''} ${L.checked?'disabled':''}><span>${o.t}</span></label>`;}).join('');
    const fb=L.checked?`<p class="why ${q.opts[q.pick].ok?'good':'bad'}"><b>${q.opts[q.pick].ok?'Certo.':'Ainda não.'}</b> ${q.why}</p>`:'';
    return`<fieldset><legend>${i+1}. ${q.q}</legend>${opts}${fb}</fieldset>`;}).join('');
  let foot='';
  if(!L.checked){foot=`<div class="row"><button class="btn primary" id="chkBtn" data-act="check" ${L.qs.some(q=>q.pick<0)?'disabled':''}>Conferir respostas</button></div>`;}
  else if(L.passed){
    const nx=ORDER[ORDER.indexOf(id)+1];
    foot=`<div class="result pass" id="result"><h3>Módulo concluído</h3><p>${L.gained?`Você ganhou ${L.gained} XP.`:'Você já tinha concluído este módulo, então não há XP novo.'}${L.lvUp?` O nível ${m.lvl+1}, ${lv.title}, está completo${LEVELS[m.lvl+1]?' e o próximo nível foi liberado':''}.`:''}</p><div class="row">${nx?`<button class="btn primary" data-act="next">Próximo módulo</button>`:''}<button class="btn" data-act="back">Voltar à trilha</button></div></div>`;
  }else{
    const ok=L.qs.filter(q=>q.opts[q.pick].ok).length;
    foot=`<div class="result fail" id="result"><h3>Você acertou ${ok} de ${L.qs.length}</h3><p>Releia o resumo acima e tente de novo. As opções mudam de ordem a cada tentativa.</p><div class="row"><button class="btn primary" data-act="retry">Tentar de novo</button></div></div>`;
  }
  return`<article class="lesson"><button class="btn ghost sm back" data-act="back">← Voltar à trilha</button><p class="eyebrow">Nível ${m.lvl+1} · ${lv.title} · módulo ${m.n} de ${lv.mods.length}</p><h2>${m.title}</h2>${m.text.map(p=>`<p>${p}</p>`).join('')}${m.ex?`<div class="ex"><b>Na prática</b><p>${m.ex}</p></div>`:''}<div class="pts"><h3>Para guardar</h3><ul>${m.pts.map(p=>`<li>${p}</li>`).join('')}</ul></div><section class="quiz" id="quiz"><h3>Confira o que aprendeu</h3>${qs}${foot}</section></article>`;
}

/* ---------- treino ---------- */
const GENS=[
()=>{const p=ri(55,130),v=ri(70,125),a=p/v;return{t:`Uma cota custa R$ ${p} e o valor patrimonial por cota é R$ ${v}. Qual é o P/VP? Use duas casas decimais.`,pre:'',suf:'',ans:a,tol:.011,why:`P/VP = preço ÷ VP = ${p} ÷ ${v} = ${NUM(a)}. `+(a<1?'Abaixo de 1: a cota negocia com desconto.':'Acima de 1: a cota negocia com ágio.')};},
()=>{const p=ri(40,140),r=+(p*rf(.5,1.1,2)/100).toFixed(2),a=r/p*100;return{t:`Uma cota de R$ ${p} pagou R$ ${NUM(r)} de rendimento no mês. Qual é o dividend yield mensal?`,pre:'',suf:'%',ans:a,tol:.02,why:`DY = rendimento ÷ preço = ${NUM(r)} ÷ ${p} = ${NUM(a)}%.`};},
()=>{const meta=pick([300,500,800,1000,1500,2000]),r=pick([.6,.75,.8,.9,1,1.2]),a=Math.ceil(meta/r-1e-9);return{t:`Você quer receber R$ ${meta} por mês. Cada cota paga R$ ${NUM(r)} por mês. Quantas cotas precisa ter? Arredonde para cima.`,pre:'',suf:'cotas',ans:a,tol:.5,why:`${meta} ÷ ${NUM(r)} = ${NUM(meta/r)}. Arredondando para cima: ${a} cotas.`};},
()=>{const tot=ri(8,40)*1000,pc=ri(2,25),vz=tot*pc/100;return{t:`Um fundo tem ${tot.toLocaleString('pt-BR')} m² de área e ${vz.toLocaleString('pt-BR')} m² estão vazios. Qual é a vacância física?`,pre:'',suf:'%',ans:pc,tol:.1,why:`${vz.toLocaleString('pt-BR')} ÷ ${tot.toLocaleString('pt-BR')} = ${pc}%.`};},
()=>{const q=ri(50,400),r=rf(.5,1.1,2),a=q*r;return{t:`Você tem ${q} cotas e cada uma pagou R$ ${NUM(r)} no mês. Quanto você recebeu no total?`,pre:'R$',suf:'',ans:a,tol:.011,why:`${q} × ${NUM(r)} = ${BRL(a)}.`};},
()=>{const pc=ri(60,130),r=+(pc*rf(.55,.95,2)/100).toFixed(2),hj=Math.round(pc*rf(.8,1.15,2)),a=r/pc*100;return{t:`Você comprou uma cota a R$ ${pc} e hoje ela rende R$ ${NUM(r)} por mês. O preço de mercado hoje é R$ ${hj}. Qual é o seu yield on cost mensal?`,pre:'',suf:'%',ans:a,tol:.02,why:`Yield on cost = rendimento ÷ preço que você pagou = ${NUM(r)} ÷ ${pc} = ${NUM(a)}%. O preço de hoje não entra na conta.`};},
()=>{const r=pick([.6,.7,.8,.9,1]),d=pick([8,9,10,12]),a=r*12/(d/100);return{t:`Um fundo paga R$ ${NUM(r)} por mês. Você exige ${d}% de rendimento ao ano. Qual é o preço-teto da cota?`,pre:'R$',suf:'',ans:a,tol:.05,why:`Rendimento anual = ${NUM(r)} × 12 = ${NUM(r*12)}. Preço-teto = ${NUM(r*12)} ÷ ${NUM(d/100)} = ${NUM(a)}.`};},
()=>{const m=pick([1000,1500,2000,3000]),y=pick([.6,.7,.8,.9]),a=m/(y/100);return{t:`Você quer uma renda de R$ ${m.toLocaleString('pt-BR')} por mês. A carteira rende ${NUM(y)}% ao mês. Quanto precisa ter investido? Pode arredondar para o real.`,pre:'R$',suf:'',ans:a,tol:1,why:`${m.toLocaleString('pt-BR')} ÷ ${NUM(y/100,3)} = ${BRL(a)}.`};},
()=>{const v=pick([3000,5000,8000,10000]),w=pick([10,15,20,25]),p=ri(60,120),a=Math.floor(v*w/100/p);return{t:`Você tem R$ ${v.toLocaleString('pt-BR')} e quer ${w}% em um fundo que custa R$ ${p} por cota. Quantas cotas inteiras pode comprar?`,pre:'',suf:'cotas',ans:a,tol:.5,why:`${w}% de ${v.toLocaleString('pt-BR')} = ${BRL(v*w/100)}. Dividindo por ${p}, dá ${NUM(v*w/100/p)}. Cotas inteiras: ${a}.`};},
()=>{const d=pick([8,9,10,12]),i=pick([3.5,4,4.5,5]),a=((1+d/100)/(1+i/100)-1)*100;return{t:`Seus rendimentos somam ${d}% ao ano e a inflação é de ${NUM(i,1)}% ao ano. Qual é o rendimento real aproximado? Use duas casas decimais.`,pre:'',suf:'%',ans:a,tol:.03,why:`Rendimento real = (1 + ${NUM(d/100)}) ÷ (1 + ${NUM(i/100,3)}) − 1 = ${NUM(a)}%.`};}
];
function newProblem(){P=pick(GENS)();P.res=null;}
function parseAns(s){s=String(s).trim().replace(/R\$|%|\s/g,'');if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const v=parseFloat(s);return isNaN(v)?null:v;}
function viewTreino(){
  const seg=`<div class="seg" role="tablist"><button class="${trainTab==='ind'?'on':''}" data-act="ttab" data-id="ind">Indicadores</button><button class="${trainTab==='card'?'on':''}" data-act="ttab" data-id="card">Cartões</button><button class="${trainTab==='rev'?'on':''}" data-act="ttab" data-id="rev">Revisão relâmpago</button><button class="${trainTab==='cart'?'on':''}" data-act="ttab" data-id="cart">Montar carteira</button></div>`;
  return`<section class="stack"><div><p class="eyebrow">Espaço de treinamento</p><h2>Treine até virar reflexo</h2></div>${seg}${trainTab==='ind'?indHTML():trainTab==='card'?cardHTML():trainTab==='cart'?cartTrainHTML():revHTML()}</section>`;
}
function indHTML(){
  if(!P)newProblem();
  const d=S.drill,rate=d.total?Math.round(d.ok/d.total*100):0;
  const stats=`<div class="stats"><div class="stat"><div class="l">Acertos</div><div class="v">${d.ok}/${d.total}</div></div><div class="stat"><div class="l">Taxa</div><div class="v">${rate}%</div></div><div class="stat"><div class="l">Sequência</div><div class="v">${d.streak}</div></div><div class="stat"><div class="l">Melhor</div><div class="v">${d.best}</div></div></div>`;
  const r=P.res;
  const fb=r?`<div class="result ${r.ok?'pass':'fail'}"><h3>${r.ok?'Correto, +10 XP':'Resposta esperada: '+(P.pre?P.pre+' ':'')+NUM(P.ans,Number.isInteger(P.ans)?0:2)+(P.suf?' '+P.suf:'')}</h3><p>${P.why}</p><div class="row"><button class="btn primary" data-act="nextp">Próximo exercício</button></div></div>`:'';
  return`<div class="card stack"><p class="problem">${P.t}</p><form data-form="drill" class="stack" autocomplete="off"><div class="inrow"><label for="ans" class="muted">Resposta</label>${P.pre?`<span class="num">${P.pre}</span>`:''}<input id="ans" type="text" inputmode="decimal" ${r?`value="${r.raw.replace(/"/g,'')}" disabled`:''}>${P.suf?`<span class="num">${P.suf}</span>`:''}</div>${r?'':`<div class="row"><button class="btn primary" type="submit">Conferir</button></div>`}</form>${fb}</div>${stats}`;
}
function cardHTML(){
  const t=TERMS[cardI],st=S.cards[t[0]];
  const known=TERMS.filter(x=>S.cards[x[0]]==='ok').length;
  const face=flipped?`<button class="flash back" data-act="flip" aria-label="Virar o cartão"><span class="eyebrow">Definição</span><span class="term">${t[1]}</span></button>`:`<button class="flash" data-act="flip" aria-label="Virar o cartão"><span class="eyebrow">Termo</span><span class="term">${t[0]}</span><span class="muted">Toque para ver a definição</span></button>`;
  return`<div class="stack"><div class="row"><span class="tag">${cardI+1} de ${TERMS.length}</span>${st?`<span class="tag ${st==='ok'?'':'gold'}">${st==='ok'?'Você já sabe':'Para revisar'}</span>`:''}<span class="muted">${known} de ${TERMS.length} dominados</span></div>${face}<div class="row"><button class="btn" data-act="cprev">← Anterior</button><button class="btn" data-act="cnext">Próximo →</button>${flipped?`<button class="btn primary" data-act="cok">Já sei</button><button class="btn" data-act="crev">Revisar depois</button>`:''}</div></div>`;
}
function revStart(){RV={qs:shuffle(ALLQ).slice(0,5).map(q=>({q:q.q,mod:q.mod,why:q.why,opts:shuffle(q.o.map((t,i)=>({t,ok:i===0})))})),i:0,score:0,pick:-1,end:false};}
function revHTML(){
  if(!RV)return`<div class="card stack"><h3>Cinco perguntas sorteadas de toda a trilha</h3><p class="muted">Resposta imediata, +5 XP por acerto. Serve para manter o conteúdo fresco.</p><div class="row"><button class="btn primary" data-act="rvstart">Começar rodada</button></div></div>`;
  if(RV.end)return`<div class="card stack"><h3>Você acertou ${RV.score} de ${RV.qs.length}</h3><p class="muted">${RV.score===RV.qs.length?'Rodada perfeita.':'Releia os módulos dos erros na Trilha e jogue outra rodada.'}</p><div class="row"><button class="btn primary" data-act="rvstart">Nova rodada</button></div></div>`;
  const q=RV.qs[RV.i],ans=RV.pick>=0;
  const opts=q.opts.map((o,j)=>{let c='qopt';if(ans){if(o.ok)c+=' ok';else if(RV.pick===j)c+=' no';}return`<button class="${c}" data-act="rvpick" data-id="${j}" ${ans?'disabled':''}>${o.t}</button>`;}).join('');
  const fb=ans?`<div class="stack"><p class="why ${q.opts[RV.pick].ok?'good':'bad'}"><b>${q.opts[RV.pick].ok?'Certo, +5 XP.':'Ainda não.'}</b> ${q.why}</p><div class="row"><button class="btn primary" data-act="rvnext">${RV.i+1<RV.qs.length?'Próxima':'Ver resultado'}</button></div></div>`:'';
  return`<div class="card stack"><div class="row"><span class="tag">Pergunta ${RV.i+1} de ${RV.qs.length}</span><span class="muted">${q.mod}</span></div><p class="problem">${q.q}</p><div class="stack" style="gap:8px">${opts}</div>${fb}</div>`;
}

/* ---------- simulação ---------- */
const FUNDS0=[
{id:'LGNO11',name:'Logística Norte',seg:'logistica',kind:'tijolo',price:98,vp:104,y:.0075,vol:1.8,vac:4,tag:'Galpões logísticos'},
{id:'LJPA11',name:'Lajes Paulista',seg:'lajes',kind:'tijolo',price:62,vp:108,y:.0098,vol:3.0,vac:28,tag:'Lajes corporativas'},
{id:'SHOR11',name:'Shopping Orla',seg:'shopping',kind:'tijolo',price:95,vp:92,y:.0070,vol:2.1,vac:6,tag:'Shopping centers'},
{id:'HVID11',name:'Hospitais Vida',seg:'hospital',kind:'tijolo',price:110,vp:105,y:.0066,vol:1.4,vac:0,tag:'Hospitais, contrato longo'},
{id:'GURB11',name:'Galpão Urbano',seg:'logistica',kind:'tijolo',price:70,vp:72,y:.0080,vol:2.4,vac:9,tag:'Logística de última milha'},
{id:'PHGR11',name:'Papel High Grade',seg:'papel-hg',kind:'papel',price:100,vp:100,y:.0088,vol:.9,cred:'Baixo',tag:'CRIs de alta qualidade'},
{id:'PHYD11',name:'Papel High Yield',seg:'papel-hy',kind:'papel',price:88,vp:100,y:.0120,vol:2.6,cred:'Alto',tag:'CRIs de maior risco'},
{id:'FMIX11',name:'Fundo de Fundos Mix',seg:'fof',kind:'fof',price:85,vp:90,y:.0078,vol:1.7,tag:'Carteira de vários FIIs'}
];
const EVENTS=[
{id:'calm',w:2,t:'Mês de calmaria',d:'Sem grandes notícias. Os fundos seguem o ritmo normal.',l:'Sem surpresas, o que sustenta seu retorno é o rendimento recorrente de cada fundo.',fx:f=>({})},
{id:'down',w:1,t:'Juros em queda',d:'O Banco Central reduziu a taxa básica de juros.',l:'Juros menores valorizam imóveis. Fundos de papel passam a render menos, porque seus títulos seguem o CDI.',fx:f=>f.kind==='tijolo'?{p:.025}:f.kind==='papel'?{p:.005,d:.97}:{p:.015}},
{id:'up',w:1,t:'Juros em alta',d:'A taxa básica de juros subiu.',l:'Juros maiores pesam sobre o preço dos imóveis, mas fundos de papel indexados ao CDI passam a render mais.',fx:f=>f.kind==='tijolo'?{p:-.03}:f.kind==='papel'?{p:-.005,d:1.03}:{p:-.02}},
{id:'shop',w:1,t:'Boa temporada de consumo',d:'As vendas dos lojistas cresceram e os shoppings lotaram.',l:'Shoppings dependem do consumo. Segmentos diferentes reagem a notícias diferentes, e por isso diversificar ajuda.',fx:f=>f.seg==='shopping'?{p:.03,d:1.02,x:1.1}:{}},
{id:'office',w:1,t:'Escritórios esvaziam',d:'Empresas devolveram andares e as lajes corporativas ficaram mais vazias.',l:'Vacância maior reduz o aluguel e o rendimento. Um preço barato na laje podia estar avisando desse risco.',fx:f=>f.seg==='lajes'?{p:-.06,v:-.02,vac:4,d:.92}:{}},
{id:'log',w:1,t:'Demanda logística aquecida',d:'O comércio online pediu mais galpões e a vacância logística caiu.',l:'Cada segmento tem seu ciclo. Aqui, quem tinha galpões se beneficiou.',fx:f=>f.seg==='logistica'?{p:.035,d:1.03,vac:-1}:{}},
{id:'default',w:1,t:'Calote em um CRI',d:'Um devedor de CRI atrasou o pagamento. Fundos de papel de maior risco sentiram.',l:'Risco de crédito é o que você recebe pelo rendimento maior de um fundo high yield. Um calote reduz preço, patrimônio e rendimento.',fx:f=>f.seg==='papel-hy'?{p:-.12,v:-.08,x:.5,d:.9}:f.seg==='papel-hg'?{p:-.01}:{}},
{id:'extra',w:1,t:'Rendimento extraordinário',d:'',l:'Um rendimento fora do comum vem de um ganho pontual e não se repete. Não projete o mês seguinte com base nele.',fx:f=>f.id===G.xt?{x:2.2,p:.01}:{}}
];
function newGame(){
  const funds=FUNDS0.map(f=>Object.assign({},f,{div0:+(f.price*f.y).toFixed(2),div:+(f.price*f.y).toFixed(2)}));
  G={m:0,cash:CAIXA0,aportado:CAIXA0,funds,pos:{},hist:[{m:0,pat:CAIXA0,apor:CAIXA0}],idle:[],incomeTotal:0,lastInc:0,ev:null,evs:[],done:false,tax:0,msg:'',cr:false,res:null,xt:null};
}
const fById=id=>G.funds.find(f=>f.id===id);
function patr(){return G.cash+G.funds.reduce((s,f)=>s+(G.pos[f.id]?G.pos[f.id].q*f.price:0),0);}
function pickEvent(){const bag=[];EVENTS.forEach(e=>{for(let i=0;i<e.w;i++)bag.push(e);});const e=Object.assign({},pick(bag));if(e.id==='extra'){G.xt=pick(G.funds).id;e.d=`${G.xt} vendeu um ativo e pagou um rendimento bem acima do normal neste mês.`;}return e;}
function advance(){
  if(G.done)return;
  G.m++;G.cash+=APORTE;G.aportado+=APORTE;
  const ev=pickEvent();let inc=0;
  G.funds.forEach(f=>{
    const fx=Object.assign({p:0,d:1,v:0,vac:0,x:1},ev.fx(f));
    const rev=Math.max(-.01,Math.min(.01,.02*(f.vp/f.price-1)));
    f.price=Math.max(5,+(f.price*(1+.002+rev+fx.p+randn()*f.vol/100*.6)).toFixed(2));
    f.vp=+(f.vp*(1+fx.v)).toFixed(2);
    f.div0=f.div0*fx.d;
    if(f.kind==='tijolo')f.vac=Math.max(0,+(f.vac+fx.vac).toFixed(1));
    f.div=+Math.max(0,f.div0*fx.x*(1+randn()*.03)).toFixed(2);
    const p=G.pos[f.id];if(p)inc+=p.q*f.div;
  });
  G.cash+=inc;G.incomeTotal+=inc;G.lastInc=inc;G.ev=ev;G.evs.push({m:G.m,t:ev.t,d:ev.d,l:ev.l});
  const pat=patr();G.hist.push({m:G.m,pat,apor:G.aportado});G.idle.push(pat?G.cash/pat:1);G.msg='';
  if(G.m>=MONTHS)finishGame();
}
function finishGame(){
  G.done=true;
  const pat=patr(),ret=(pat-G.aportado)/G.aportado*100;
  const held=G.funds.filter(f=>G.pos[f.id]).map(f=>({f,v:G.pos[f.id].q*f.price}));
  const inv=held.reduce((s,h)=>s+h.v,0);
  const top=held.sort((a,b)=>b.v-a.v)[0];
  const avgIdle=G.idle.reduce((a,b)=>a+b,0)/G.idle.length;
  const notes=[];
  if(!held.length)notes.push('Você terminou sem nenhuma cota. Nesta simulação o caixa não rende, então o dinheiro parado perdeu a chance de gerar renda.');
  else{
    if(held.length<=2)notes.push(`Você terminou com ${held.length} fundo${held.length>1?'s':''}. Com tão poucos, um problema isolado pesa muito.`);
    if(held.length>=2&&top.v/inv>.4)notes.push(`${top.f.id} chegou a ${Math.round(top.v/inv*100)}% do que você tinha investido. Defina um limite por posição e rebalanceie.`);
    if(held.length>=4&&(!top||top.v/inv<=.4))notes.push(`Você manteve ${held.length} fundos sem concentrar demais em um deles. Foi uma carteira mais protegida de surpresas.`);
  }
  if(avgIdle>.3)notes.push(`Em média, ${Math.round(avgIdle*100)}% do seu patrimônio ficou em caixa. Dinheiro parado não gera rendimento.`);
  if(G.tax>0)notes.push(`Você pagou ${BRL(G.tax)} de imposto sobre lucros nas vendas. Girar muito a carteira tem custo.`);
  if(G.incomeTotal>0)notes.push(`Os rendimentos somaram ${BRL(G.incomeTotal)} no ano, isentos de imposto nesta simulação.`);
  G.res={pat,ret,notes};
  S.xp+=60;
  if(S.bestSim===null||ret>S.bestSim)S.bestSim=ret;
  save();
}
function buy(id){const f=fById(id),c=f.price*lot;if(G.done||G.cash+1e-9<c)return;G.cash-=c;const p=G.pos[id]||(G.pos[id]={q:0,cost:0});p.q+=lot;p.cost+=c;G.msg=`Comprou ${lot} cota${lot>1?'s':''} de ${id} por ${BRL(c)}.`;}
function sell(id){const f=fById(id),p=G.pos[id];if(G.done||!p)return;const q=Math.min(lot,p.q),pr=q*f.price,avg=p.cost/p.q,gain=pr-q*avg,tax=gain>0?gain*.2:0;G.cash+=pr-tax;G.tax+=tax;p.cost-=q*avg;p.q-=q;if(p.q<=0)delete G.pos[id];G.msg=`Vendeu ${q} cota${q>1?'s':''} de ${id} por ${BRL(pr)}.`+(tax>0?` Imposto de 20% sobre o lucro: ${BRL(tax)}.`:gain<0?' Sem imposto, pois houve prejuízo.':'');}

function chart(xl,series,zero){
  const W=420,H=250,pl=64,pr=12,pt=14,pb=28;
  const vals=series.flatMap(s=>s.v);
  let lo=zero?0:Math.min(...vals),hi=Math.max(...vals);
  if(hi<=lo)hi=lo+1;
  const nice=x=>{const p=Math.pow(10,Math.floor(Math.log10(x))),f=x/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p;};
  const step=nice((hi-lo)/4);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  const n=xl.length,X=i=>n<2?pl+(W-pl-pr)/2:pl+i*(W-pl-pr)/(n-1),Y=v=>pt+(hi-v)/(hi-lo)*(H-pt-pb);
  let g='';const cnt=Math.round((hi-lo)/step);
  for(let k=0;k<=cnt;k++){const t=lo+k*step;g+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text x="${pl-8}" y="${(Y(t)+4).toFixed(1)}" text-anchor="end">${fmtC(t)}</text>`;}
  const ev=Math.ceil(n/7);
  xl.forEach((l,i)=>{if(i%ev===0)g+=`<text x="${X(i).toFixed(1)}" y="${H-8}" text-anchor="middle">${l}</text>`;});
  series.forEach((s,k)=>{
    const d=s.v.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
    if(k===0&&n>1)g+=`<path class="ar" d="${d} L${X(n-1).toFixed(1)} ${Y(lo).toFixed(1)} L${X(0).toFixed(1)} ${Y(lo).toFixed(1)} Z"/>`;
    g+=`<path class="s${k+1}" d="${d}"/><circle class="dot${k+1}" cx="${X(n-1).toFixed(1)}" cy="${Y(s.v[n-1]).toFixed(1)}" r="4"/>`;
  });
  return`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico: ${series.map(s=>s.name).join(' e ')}">${g}</svg>`;
}

function viewSim(){
  const seg=`<div class="seg"><button class="${simTab==='cart'?'on':''}" data-act="stab" data-id="cart">Carteira virtual</button><button class="${simTab==='calc'?'on':''}" data-act="stab" data-id="calc">Renda passiva</button></div>`;
  return`<section class="stack"><div><p class="eyebrow">Simulação</p><h2>Decida sem arriscar dinheiro de verdade</h2></div>${seg}${simTab==='cart'?cartHTML():calcHTML()}</section>`;
}
function cartHTML(){
  if(!G)return`<div class="card stack"><h3>Doze meses, oito fundos fictícios</h3><p>Você começa com ${BRL(CAIXA0)} em caixa e recebe ${BRL(APORTE)} de aporte a cada mês. Monte uma carteira, avance o tempo e veja como notícias, vacância, juros e crédito mexem no preço e nos rendimentos.</p><p class="muted">Preços, rendimentos e notícias são sorteados a cada partida. Os rendimentos entram no caixa, sem imposto, e o lucro na venda paga 20%. Ao terminar a partida, você ganha 60 XP.</p><div class="row"><button class="btn primary" data-act="simstart">Começar simulação</button>${S.bestSim!==null?`<span class="muted">Melhor retorno: ${NUM(S.bestSim,1)}%</span>`:''}</div></div>`;
  const pat=patr(),res=pat-G.aportado;
  const stats=`<div class="stats"><div class="stat"><div class="l">Mês</div><div class="v">${G.m} de ${MONTHS}</div></div><div class="stat"><div class="l">Caixa</div><div class="v">${BRL(G.cash)}</div></div><div class="stat"><div class="l">Patrimônio</div><div class="v">${BRL(pat)}</div></div><div class="stat"><div class="l">Renda no mês</div><div class="v">${BRL(G.lastInc)}</div></div><div class="stat"><div class="l">Resultado</div><div class="v ${res>=0?'pos':'neg'}">${(res>=0?'+':'')+BRL(res)}</div></div></div>`;
  const ctrl=G.done?'':`<div class="row"><button class="btn primary" data-act="advance">Avançar para o mês ${G.m+1}</button><div class="seg" aria-label="Quantidade por clique">${[1,5,10].map(n=>`<button class="${lot===n?'on':''}" data-act="lot" data-id="${n}">Lote ${n}</button>`).join('')}</div></div>`;
  let evc='';
  if(G.ev)evc=`<div class="event"><p class="eyebrow">Notícia do mês ${G.m}</p><h3>${G.ev.t}</h3><p>${G.ev.d}</p><p class="muted"><b>O que aprender:</b> ${G.ev.l}</p></div>`;
  else evc=`<div class="event"><p class="eyebrow">Mês 0</p><h3>Monte a carteira inicial</h3><p>Compare preço, P/VP, rendimento e risco de cada fundo antes de comprar. Depois avance o mês e veja o que acontece.</p></div>`;
  let final='';
  if(G.done){const r=G.res;final=`<div class="card stack"><p class="eyebrow">Fim da simulação</p><h3>Retorno de ${(r.ret>=0?'+':'')+NUM(r.ret,1)}% sobre ${BRL(G.aportado)} aportados</h3><p>Patrimônio final: <b>${BRL(r.pat)}</b>. Se tudo tivesse ficado parado em caixa, você teria ${BRL(G.aportado)}.</p><ul style="margin:0;padding-left:20px;display:grid;gap:6px">${r.notes.map(n=>`<li>${n}</li>`).join('')}</ul><div class="row"><button class="btn primary" data-act="simreset">Jogar de novo</button></div></div>`;}
  const funds=G.funds.map(f=>{
    const p=G.pos[f.id],pvp=f.price/f.vp,dy=f.div/f.price*100;
    const x=f.kind==='tijolo'?['Vacância',NUM(f.vac,f.vac%1?1:0)+'%']:f.kind==='papel'?['Risco crédito',f.cred]:['Composição','Mista'];
    const posTxt=p?`<span><b class="num">${p.q}</b> cota${p.q>1?'s':''} · ${BRL(p.q*f.price)}<br><span class="muted">Preço médio ${BRL(p.cost/p.q)}</span></span>`:`<span class="muted">Sem posição</span>`;
    return`<div class="card fund"><div class="head"><div><div class="tk">${f.id}</div><div>${f.name}</div></div><span class="tag ${f.kind==='papel'?'gold':''}">${f.tag}</span></div><div class="mets"><div class="met"><span>Preço</span><b>${BRL(f.price)}</b></div><div class="met"><span>P/VP</span><b>${NUM(pvp)}</b></div><div class="met"><span>DY no mês</span><b>${NUM(dy)}%</b></div><div class="met"><span>${x[0]}</span><b>${x[1]}</b></div></div><div class="pos">${posTxt}<span class="row" style="gap:6px"><button class="btn sm" data-act="sell" data-id="${f.id}" ${p&&!G.done?'':'disabled'}>Vender</button><button class="btn sm primary" data-act="buy" data-id="${f.id}" ${!G.done&&G.cash+1e-9>=f.price*lot?'':'disabled'}>Comprar ${lot}</button></span></div></div>`;}).join('');
  const ch=G.hist.length>1?`<div class="card stack"><h3>Patrimônio ao longo do tempo</h3>${chart(G.hist.map(h=>'M'+h.m),[{name:'Patrimônio',v:G.hist.map(h=>h.pat)},{name:'Total aportado',v:G.hist.map(h=>h.apor)}])}<div class="legend"><span>Patrimônio</span><span class="g">Total aportado</span></div></div>`:'';
  const log=G.evs.length?`<details><summary>Histórico de notícias (${G.evs.length})</summary><ol>${G.evs.map(e=>`<li><b>Mês ${e.m}: ${e.t}.</b> ${e.l}</li>`).join('')}</ol></details>`:'';
  return`<div class="stack">${stats}${evc}${ctrl}<div class="toast" role="status">${G.msg||''}</div>${final}<div class="funds">${funds}</div>${ch}${log}<div class="row"><button class="btn ghost sm" data-act="simreset">${G.cr?'Clique de novo para reiniciar':'Reiniciar partida'}</button></div></div>`;
}

/* ---------- calculadora de renda passiva ---------- */
function calcHTML(){
  return`<div class="card stack"><h3>Quanto sua carteira pode render</h3><p class="muted">Projeção ilustrativa com taxas fixas. Rendimentos e preços reais variam e não há garantia.</p><div class="fields"><div class="field"><label for="c-ini">Aporte inicial (R$)</label><input id="c-ini" type="number" min="0" step="500" value="5000" data-calc></div><div class="field"><label for="c-apo">Aporte mensal (R$)</label><input id="c-apo" type="number" min="0" step="100" value="500" data-calc></div><div class="field"><label for="c-dy">Rendimento ao ano (%)</label><input id="c-dy" type="number" min="0" max="30" step="0.5" value="9" data-calc></div><div class="field"><label for="c-val">Valorização das cotas ao ano (%)</label><input id="c-val" type="number" min="-10" max="20" step="0.5" value="3" data-calc></div><div class="field"><label for="c-anos">Prazo (anos)</label><input id="c-anos" type="number" min="1" max="40" step="1" value="10" data-calc></div><div class="field"><label for="c-meta">Renda mensal desejada (R$)</label><input id="c-meta" type="number" min="0" step="100" value="2000" data-calc></div></div><label class="row" style="gap:8px"><input id="c-rein" type="checkbox" checked data-calc style="width:20px;height:20px;accent-color:var(--accent)"><span>Reinvestir todos os rendimentos</span></label></div><div id="calcOut" class="stack"></div>`;
}
function updateCalc(){
  const g=id=>$('#'+id);if(!g('c-ini')||!$('#calcOut'))return;
  const cl=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const ini=cl(g('c-ini').value,0,1e9),apo=cl(g('c-apo').value,0,1e9),dy=cl(g('c-dy').value,0,30),val=cl(g('c-val').value,-10,20),anos=Math.round(cl(g('c-anos').value,1,40)),meta=cl(g('c-meta').value,0,1e9),rein=g('c-rein').checked;
  const dm=dy/100/12,gm=Math.pow(1+val/100,1/12)-1;
  let Pt=ini,ap=ini,rec=0;const pa=[Pt],aa=[ap],xl=['0'];
  for(let m=1;m<=anos*12;m++){const r=Pt*dm;if(rein){Pt=Pt*(1+gm)+r+apo;}else{rec+=r;Pt=Pt*(1+gm)+apo;}ap+=apo;if(m%12===0){pa.push(Pt);aa.push(ap);xl.push(String(m/12));}}
  const renda=Pt*dm,ganho=Pt+rec-ap,need=dm>0?meta/dm:0;
  const out=`<div class="stats"><div class="stat"><div class="l">Patrimônio final</div><div class="v">${BRL(Pt)}</div></div><div class="stat"><div class="l">Total aportado</div><div class="v">${BRL(ap)}</div></div><div class="stat"><div class="l">Ganho total</div><div class="v ${ganho>=0?'pos':'neg'}">${BRL(ganho)}</div></div><div class="stat"><div class="l">Renda mensal no fim</div><div class="v">${BRL(renda)}</div></div></div><div class="card stack"><h3>Evolução em ${anos} ${anos>1?'anos':'ano'}</h3>${chart(xl,[{name:'Patrimônio',v:pa},{name:'Total aportado',v:aa}],true)}<div class="legend"><span>Patrimônio</span><span class="g">Total aportado</span></div><p class="muted">Eixo horizontal em anos.${rein?'':` Rendimentos recebidos e não reinvestidos: ${BRL(rec)}.`}</p></div>${meta>0&&dm>0?`<div class="ex"><b>Meta de renda</b><p>Para receber ${BRL(meta)} por mês com rendimento de ${NUM(dy,1)}% ao ano, você precisaria de cerca de <b>${BRL(need)}</b> investidos.</p></div>`:''}`;
  $('#calcOut').innerHTML=out;
}

/* ---------- metas e hábitos ---------- */
const PRIO={renda:['m2','m5','m8','m9','m13','m14','m15','m22','m23'],patrimonio:['m7','m10','m12','m15','m16','m19','m22'],seguranca:['m3','m5','m9','m10','m11','m17','m21','m24']};
const focus=id=>!!(S.obj&&PRIO[S.obj]&&PRIO[S.obj].includes(id));
function nextRec(){
  if(S.obj&&PRIO[S.obj]){const r=PRIO[S.obj].find(id=>!S.done[id]&&isUnlocked(MODS[id].lvl));if(r)return r;}
  return ORDER.find(id=>!S.done[id]);
}
const OBJS=[
 {id:'renda',nome:'Renda mensal',d:'Quero receber proventos todo mês para complementar minha renda.'},
 {id:'patrimonio',nome:'Patrimônio',d:'Quero crescer a longo prazo, reinvestindo os rendimentos.'},
 {id:'seguranca',nome:'Segurança',d:'Quero começar com cuidado, protegendo minha reserva.'}
];
const HZ=[{id:'h3',m:3,nome:'3 meses'},{id:'h6',m:6,nome:'6 meses'},{id:'h12',m:12,nome:'1 ano'}];
const SUG={
 geral:{h3:['Criar o hábito de poupar todo mês','Montar minha reserva de emergência'],h6:['Juntar meu primeiro capital para investir','Concluir a trilha de aprendizado'],h12:['Ter uma carteira de fundos montada','Receber uma renda mensal de proventos']},
 renda:{h3:['Montar minha reserva de emergência','Aprender a analisar um fundo'],h6:['Fazer minhas primeiras compras de cotas','Montar uma carteira com 3 fundos'],h12:['Receber uma renda mensal de proventos','Reinvestir os rendimentos todo mês']},
 patrimonio:{h3:['Criar o hábito de aportar todo mês','Concluir os níveis 1 e 2 da trilha'],h6:['Juntar meu primeiro capital para investir','Aprender a ler relatórios gerenciais'],h12:['Ter uma carteira diversificada','Dobrar meu aporte mensal']},
 seguranca:{h3:['Reserva de emergência de 3 meses de gastos','Quitar dívidas caras'],h6:['Reserva de 6 meses de gastos','Treinar na simulação sem pressa'],h12:['Dar o primeiro passo na renda variável','Manter o aporte mensal sem falhar']}
};
const pad=n=>String(n).padStart(2,'0');
const isoOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const hoje=()=>isoOf(new Date());
const parseISO=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]):null;};
const addMonths=(s,n)=>{const d=parseISO(s);if(!d)return s;d.setMonth(d.getMonth()+n);return isoOf(d);};
const daysBetween=(a,b)=>Math.round((parseISO(b)-parseISO(a))/864e5);
const dmy=s=>{const d=parseISO(s);return d?pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear():'—';};
let GE=null,GD=null,GM='',GDEL=null;
const gTotal=()=>Object.keys(S.goals).reduce((s,k)=>s+(S.goals[k].aportes||[]).reduce((a,x)=>a+x.v,0),0);
function gInfo(g,m){
  const t=hoje(),fim=addMonths(g.inicio,m),saved=(g.aportes||[]).reduce((s,a)=>s+a.v,0);
  const tot=Math.max(1,daysBetween(g.inicio,fim)),pas=Math.max(0,Math.min(tot,daysBetween(g.inicio,t)));
  const esp=g.alvo*pas/tot,rest=Math.max(0,g.alvo-saved),dias=daysBetween(t,fim),mr=dias/30.4;
  let st;
  if(saved>=g.alvo)st=['Concluída','ok'];else if(dias<0)st=['Prazo encerrado','bad'];else if(saved+1e-9>=esp)st=['No ritmo','ok'];else st=['Atrasada','gold'];
  return{fim,saved,rest,dias,st,pct:Math.min(100,saved/g.alvo*100),porMes:mr>.05?rest/mr:rest};
}
function goalForm(h){
  const d=GD||{nome:'',alvo:'',inicio:hoje()};
  return`<div class="card stack"><div class="row"><span class="tag">${h.nome}</span></div><h3>${S.goals[h.id]?'Editar meta':'Definir meta'} de ${h.nome}</h3><form data-form="goal" data-h="${h.id}" class="stack" autocomplete="off"><div class="fields"><div class="field" style="grid-column:1/-1"><label for="g-nome">O que você quer conquistar?</label><input id="g-nome" type="text" maxlength="60" value="${esc(d.nome)}"></div><div class="field"><label for="g-alvo">Valor da meta (R$)</label><input id="g-alvo" type="number" min="1" step="50" inputmode="decimal" value="${esc(d.alvo)}"></div><div class="field"><label for="g-ini">Data de início</label><input id="g-ini" type="date" value="${esc(d.inicio)}"></div></div>${GM?`<p class="why bad"><b>Atenção.</b> ${esc(GM)}</p>`:''}<p class="muted">O prazo é de ${h.nome} a partir da data de início.</p><div class="row"><button class="btn primary" type="submit">Salvar meta</button><button class="btn" type="button" data-act="gcancel">Cancelar</button></div></form></div>`;
}
function goalCard(h){
  if(GE===h.id)return goalForm(h);
  const g=S.goals[h.id];
  if(!g){
    const sug=(SUG[S.obj]||SUG.geral)[h.id];
    return`<div class="card stack"><div class="row"><span class="tag">${h.nome}</span></div><h3>Qual é a sua meta em ${h.nome}?</h3><p class="muted">Escolha uma ideia ou escreva a sua. Você pode editar quando quiser.</p><div class="row">${sug.map((s,i)=>`<button class="btn sm" data-act="gsug" data-id="${h.id}:${i}">${esc(s)}</button>`).join('')}</div><div class="row"><button class="btn primary" data-act="gnew" data-id="${h.id}">Definir minha meta</button></div></div>`;
  }
  const i=gInfo(g,h.m);
  const msg=i.saved>=g.alvo?'Meta batida. Parabéns! Edite o valor ou defina a próxima.':i.dias>=0?`Faltam ${BRL(i.rest)}. Poupando cerca de ${BRL(i.porMes)} por mês, você chega lá até ${dmy(i.fim)}.`:`O prazo terminou com ${BRL(i.rest)} faltando. Edite a data de início ou o valor para recomeçar.`;
  const ap=(g.aportes||[]).map((a,idx)=>({a,idx})).slice(-4).reverse();
  const lista=ap.length?`<div class="stack" style="gap:6px"><p class="eyebrow">Últimos aportes</p>${ap.map(x=>`<div class="row" style="justify-content:space-between"><span class="num">${dmy(x.a.d)} · ${BRL(x.a.v)}</span><button class="btn sm ghost" data-act="gundo" data-id="${h.id}:${x.idx}">Desfazer</button></div>`).join('')}</div>`:'';
  return`<div class="card stack"><div class="row" style="justify-content:space-between"><span class="tag">${h.nome}</span><span class="tag ${i.st[1]}">${i.st[0]}</span></div><div><h3>${esc(g.nome)}</h3><p class="muted">Início ${dmy(g.inicio)} · prazo ${dmy(i.fim)}</p></div><div class="stack" style="gap:6px"><span class="bar" role="progressbar" aria-valuenow="${Math.round(i.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da meta"><i style="width:${i.pct}%"></i></span><div class="row" style="justify-content:space-between"><b class="num">${BRL(i.saved)}</b><span class="muted num">meta ${BRL(g.alvo)}</span></div></div><p>${msg}</p><form data-form="aporte" data-h="${h.id}" class="add"><div class="field"><label for="a-${h.id}">Registrar aporte (R$)</label><input id="a-${h.id}" type="number" min="0" step="10" inputmode="decimal"></div><button class="btn primary" type="submit">Registrar</button></form>${lista}<div class="row"><button class="btn sm" data-act="gedit" data-id="${h.id}">Editar meta</button><button class="btn sm ghost" data-act="gdel" data-id="${h.id}">${GDEL===h.id?'Confirmar exclusão':'Excluir'}</button></div></div>`;
}
function gSave(f){
  const h=f.dataset.h,rawA=$('#g-alvo').value,nome=$('#g-nome').value.trim().slice(0,60),alvo=Number(rawA),ini=$('#g-ini').value;
  if(!nome||!(alvo>0)||!parseISO(ini)){GM='Preencha o nome, um valor maior que zero e a data de início.';GD={h,nome,alvo:rawA,inicio:ini||hoje()};render();return;}
  const old=S.goals[h];
  S.goals[h]={nome,alvo:Math.round(alvo*100)/100,inicio:ini,aportes:old?old.aportes:[]};
  GE=null;GD=null;GM='';save();render();
}
function gAporte(f){
  const g=S.goals[f.dataset.h],v=Number(f.querySelector('input').value);
  if(!g||!(v>0))return;
  g.aportes.push({d:hoje(),v:Math.round(v*100)/100});save();render();
}
const weekDays=()=>{const d=new Date(),wd=(d.getDay()+6)%7;return Array.from({length:7},(_,i)=>isoOf(new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd+i)));};
function hDone(h){return h.f==='s'?weekDays().some(d=>(S.hlog[d]||[]).includes(h.id)):(S.hlog[hoje()]||[]).includes(h.id);}
function streak(){const d=new Date(),has=x=>(S.hlog[isoOf(x)]||[]).length>0;let n=0;if(!has(d))d.setDate(d.getDate()-1);while(has(d)){n++;d.setDate(d.getDate()-1);}return n;}
function hAdd(){
  const el=$('#h-new');if(!el)return;
  const nome=el.value.trim().slice(0,50),f=$('#h-freq').value==='s'?'s':'d';
  if(!nome||S.habits.length>=8)return;
  S.habits.push({id:'hb'+Date.now(),nome,f});save();render();
}
function habitsHTML(){
  const t=hoje(),lab=['seg','ter','qua','qui','sex','sáb','dom'];
  const week=weekDays().map((d,i)=>{const n=(S.hlog[d]||[]).length;return`<div class="day ${n?'on':''} ${d===t?'today':''}" role="img" aria-label="${lab[i]}: ${n} hábito${n===1?'':'s'}"><span>${lab[i]}</span><i></i></div>`;}).join('');
  const list=S.habits.map(h=>{const dn=hDone(h);return`<div class="habit"><button class="habit-btn ${dn?'on':''}" data-act="hcheck" data-id="${h.id}" aria-pressed="${dn}">${dn?IC.check:IC.dot}<span class="t"><b>${esc(h.nome)}</b><span>${h.f==='s'?'1 vez por semana':'Todo dia'}</span></span></button><button class="btn sm ghost" data-act="hdel" data-id="${h.id}" aria-label="Remover ${esc(h.nome)}">Remover</button></div>`;}).join('');
  return`<div class="stack"><h3>Seus hábitos</h3><p class="muted">Marque o que você fez hoje. A sequência conta os dias seguidos com pelo menos um hábito feito.</p><div class="card stack"><div class="week">${week}</div>${list||'<p class="muted">Nenhum hábito. Adicione o primeiro abaixo.</p>'}<form data-form="habit" class="add" autocomplete="off"><div class="field"><label for="h-new">Novo hábito</label><input id="h-new" type="text" maxlength="50" placeholder="Ex.: Separar R$ 20 hoje"></div><div class="field" style="flex:0 0 150px;min-width:130px"><label for="h-freq">Frequência</label><select id="h-freq"><option value="d">Todo dia</option><option value="s">Toda semana</option></select></div><button class="btn primary" type="submit">Adicionar</button></form></div></div>`;
}
function viewMetas(){
  const gs=HZ.filter(h=>S.goals[h.id]),total=gTotal();
  const dh=S.habits.filter(h=>h.f==='d'),dhDone=dh.filter(hDone).length,sk=streak();
  const stats=`<div class="stats"><div class="stat"><div class="l">Sequência</div><div class="v">${sk} dia${sk===1?'':'s'}</div></div><div class="stat"><div class="l">Hábitos de hoje</div><div class="v">${dhDone}/${dh.length}</div></div><div class="stat"><div class="l">Metas ativas</div><div class="v">${gs.length}</div></div><div class="stat"><div class="l">Total poupado</div><div class="v">${BRL(total)}</div></div></div>`;
  const objs=`<div class="stack"><h3>Qual é o seu objetivo principal?</h3><div class="objs">${OBJS.map(o=>`<button class="obj ${S.obj===o.id?'on':''}" data-act="obj" data-id="${o.id}" aria-pressed="${S.obj===o.id}"><b>${o.nome}</b><span>${o.d}</span></button>`).join('')}</div></div>`;
  const ob=OBJS.find(o=>o.id===S.obj);
  const trilha=ob?`<div class="card stack"><h3>Sua trilha para ${ob.nome.toLowerCase()}</h3><p class="muted">Estes módulos têm mais a ver com o seu objetivo. Siga nesta ordem.</p><div class="mods">${PRIO[ob.id].map(id=>{const m=MODS[id],d=!!S.done[id],lock=!isUnlocked(m.lvl);return`<button class="mod ${d?'done':''}" data-act="open" data-id="${id}" ${lock?'disabled':''}>${lock?IC.lock:d?IC.check:IC.dot}<span class="t"><b>${m.title}</b><span>Nível ${m.lvl+1}${lock?' · conclua o nível anterior':d?' · concluído':''}</span></span></button>`;}).join('')}</div></div>`:'';
  const renda=total>0?`<div class="ex"><b>O que o valor poupado poderia render</b><div class="add"><div class="field" style="flex:0 0 170px"><label for="g-dy">Rendimento ao ano (%)</label><input id="g-dy" type="number" min="0" max="30" step="0.5" value="${S.dyRef}"></div><p>Com ${BRL(total)} investidos, a renda seria de cerca de <b id="g-renda">${BRL(total*S.dyRef/100/12)}</b> por mês.</p></div><p class="muted">Ilustração com taxa fixa e sem garantia. Rendimentos reais variam.</p></div>`:'';
  return`<section class="stack"><div><p class="eyebrow">Objetivos e hábitos</p><h2>Poupe com um plano, um passo por vez</h2></div>${stats}${objs}${trilha}<div class="stack"><h3>Suas metas</h3><p class="muted">Defina o que quer conquistar em 3 meses, 6 meses e 1 ano. Registre cada aporte e acompanhe o ritmo. Tudo fica salvo só neste navegador.</p>${HZ.map(goalCard).join('')}</div>${renda}${habitsHTML()}</section>`;
}

/* ---------- treino: montar carteira ---------- */
const TC_BUDGET=10000;
let TC={q:{},res:null};
const tcF=()=>FUNDS0.map(f=>({id:f.id,name:f.name,kind:f.kind,price:f.price,div:+(f.price*f.y).toFixed(2),risk:f.id==='LJPA11'||f.id==='PHYD11',tag:f.tag}));
function tcCalc(){
  const fs=tcF(),held=fs.filter(f=>(TC.q[f.id]||0)>0).map(f=>({f,q:TC.q[f.id],v:TC.q[f.id]*f.price}));
  const inv=held.reduce((s,h)=>s+h.v,0),inc=held.reduce((s,h)=>s+h.q*h.f.div,0);
  return{fs,held,inv,cash:TC_BUDGET-inv,inc};
}
function tcScore(){
  const c=tcCalc(),n=c.held.length,pts=[];
  const mx=n?Math.max(...c.held.map(h=>h.v))/c.inv:0;
  const papel=n?c.held.filter(h=>h.f.kind==='papel').reduce((s,h)=>s+h.v,0)/c.inv:0;
  const risco=n?c.held.filter(h=>h.f.risk).reduce((s,h)=>s+h.v,0)/c.inv:0;
  const y=c.inc/TC_BUDGET*100,cp=c.cash/TC_BUDGET*100;
  const add=(nome,max,got,msg)=>pts.push({nome,max,got,msg});
  add('Diversificação',20,n>=5?20:n===4?15:n===3?9:n===2?4:0,n?`Você tem ${n} fundo${n>1?'s':''}. ${n>=5?'Boa diversificação.':'Com 5 ou mais, um problema isolado pesa menos.'}`:'Nenhum fundo na carteira ainda.');
  add('Concentração',20,!n?0:mx<=.25?20:mx<=.35?13:mx<=.5?6:0,n?`Sua maior posição tem ${Math.round(mx*100)}% do investido. ${mx<=.25?'Dentro do limite de 25%.':'Tente ficar perto de 25% por fundo.'}`:'Sem posições.');
  add('Tijolo e papel',15,!n?0:(papel>=.25&&papel<=.6)?15:(papel>=.15&&papel<=.7)?9:3,n?`Papel representa ${Math.round(papel*100)}% do investido. ${(papel>=.25&&papel<=.6)?'Uma mistura equilibrada com tijolo.':'Misturar tijolo e papel reduz a dependência de um só tipo de risco.'}`:'Sem posições.');
  add('Risco elevado',15,!n?0:risco<=.25?15:risco<=.4?8:0,n?`Os fundos de maior risco (Lajes Paulista e Papel High Yield) somam ${Math.round(risco*100)}%. ${risco<=.25?'Exposição controlada.':'Rendimento alto costuma vir com mais risco.'}`:'Sem posições.');
  add('Uso do caixa',10,!n?0:cp<=5?10:cp<=15?6:0,`Sobraram ${BRL(c.cash)} (${NUM(cp,1)}% do valor). ${cp<=5?'Quase tudo investido.':'Dinheiro parado não rende.'}`);
  add('Renda mensal',20,!n?0:y>=.8?20:y>=.7?14:y>=.6?8:3,`Renda estimada de ${BRL(c.inc)} por mês, ou ${NUM(y)}% do valor. ${y>=.8?'Acima da meta de 0,80%.':'A meta do exercício é 0,80% ao mês.'}`);
  return{pts,tot:pts.reduce((s,p)=>s+p.got,0)};
}
function cartTrainHTML(){
  const c=tcCalc();
  const fundos=c.fs.map(f=>{
    const q=TC.q[f.id]||0,w=c.inv?q*f.price/c.inv*100:0;
    return`<div class="card fund"><div class="head"><div><div class="tk">${f.id}</div><div>${f.name}</div></div><span class="tag ${f.kind==='papel'?'gold':''}">${f.tag}</span></div><div class="mets"><div class="met"><span>Preço</span><b>${BRL(f.price)}</b></div><div class="met"><span>Rend./mês</span><b>${BRL(f.div)}</b></div><div class="met"><span>DY no mês</span><b>${NUM(f.div/f.price*100)}%</b></div><div class="met"><span>Peso</span><b>${NUM(w,0)}%</b></div></div><div class="pos"><span><b class="num">${q}</b> cota${q===1?'':'s'}</span><span class="row" style="gap:6px"><button class="btn sm" data-act="tcsub" data-id="${f.id}" ${q?'':'disabled'}>−${lot}</button><button class="btn sm primary" data-act="tcadd" data-id="${f.id}" ${c.cash+1e-9>=f.price*lot?'':'disabled'}>+${lot}</button></span></div></div>`;
  }).join('');
  const stats=`<div class="stats"><div class="stat"><div class="l">Valor total</div><div class="v">${BRL(TC_BUDGET)}</div></div><div class="stat"><div class="l">Investido</div><div class="v">${BRL(c.inv)}</div></div><div class="stat"><div class="l">Sobra</div><div class="v">${BRL(c.cash)}</div></div><div class="stat"><div class="l">Renda por mês</div><div class="v">${BRL(c.inc)}</div></div></div>`;
  let res='';
  if(TC.res){const r=TC.res;res=`<div class="card stack" id="tcres"><div class="row" style="justify-content:space-between"><h3>Nota da carteira</h3><span class="score">${r.tot}<span class="muted" style="font-size:1rem"> / 100</span></span></div>${r.pts.map(p=>`<div class="dim"><div class="row" style="justify-content:space-between"><b>${p.nome}</b><span class="num">${p.got}/${p.max}</span></div><span class="bar" aria-hidden="true"><i style="width:${p.got/p.max*100}%"></i></span><p class="muted">${p.msg}</p></div>`).join('')}<p>${r.tot>=70?'Boa carteira para o objetivo de renda com dividendos.':'Ajuste os pontos com menos nota e avalie de novo.'}${r.xpGain?` Você ganhou ${r.xpGain} XP pela primeira nota acima de 70.`:''}</p><p class="muted">Melhor nota: ${S.tcart.best}</p></div>`;}
  return`<div class="stack"><div class="card stack"><h3>Monte uma carteira de renda com ${BRL(TC_BUDGET)}</h3><p>Escolha cotas dos oito fundos fictícios. A meta é uma renda de 0,80% ao mês, sem concentrar demais nem assumir risco alto. Quando terminar, peça a avaliação.</p><div class="row"><div class="seg" aria-label="Quantidade por clique">${[1,5,10].map(n=>`<button class="${lot===n?'on':''}" data-act="lot" data-id="${n}">Lote ${n}</button>`).join('')}</div><button class="btn primary" data-act="tceval" ${c.inv?'':'disabled'}>Avaliar carteira</button><button class="btn ghost" data-act="tczero">Zerar</button></div></div>${stats}${res}<div class="funds">${fundos}</div></div>`;
}

/* ---------- corretoras ---------- */
let BF='all';
const BROKERS=[
 {n:'Ágora',tags:[],d:'Plataforma modernizada.',x:'Mercado futuro e operações pela Mesa.'},
 {n:'Banco do Brasil',tags:['banco'],d:'App de investimentos separado do app da conta, com interface considerada mais difícil.',x:'Mercado futuro e Mesa.'},
 {n:'C6 Bank',tags:['banco'],d:'Corretora integrada à conta digital.',x:'Cobranças na conta global de investimentos.'},
 {n:'Clear',tags:['grafica'],d:'Várias plataformas gráficas, voltadas a quem opera com frequência. O aplicativo novo dividiu opiniões.',x:'Mesa.'},
 {n:'CM Capital',tags:[],d:'Interface descomplicada.',x:'Mercado futuro e Mesa. Há relato de corretagem no mercado padrão de ações, fora do lote fracionário: confirme antes.'},
 {n:'Inter',tags:['banco'],d:'Permite investir direto do saldo da conta digital.',x:'Contratos cheios e Mesa.'},
 {n:'Íon (Itaú)',tags:['banco'],d:'Plataforma de investimentos do Itaú, acessível sem ser correntista.',x:'Contratos cheios, criptomoedas e Mesa.'},
 {n:'Nubank',tags:['banco'],d:'Conta de investimentos integrada ao app da conta digital.',x:'Criptomoedas e Mesa.'},
 {n:'Rico',tags:[],d:'Plataforma completa e gratuita.',x:'Mercado futuro, taxa consolidada de 5,9% sobre a corretagem quando ela existe, e Mesa.'},
 {n:'Toro (Santander)',tags:['grafica'],d:'Plataformas gráficas gratuitas e atendimento por WhatsApp.',x:'Taxa consolidada de 5,9% quando há corretagem, e Mesa.'}
];
const CHECK=['Está autorizada pelo Banco Central e sujeita às regras da B3 e da CVM?','A corretagem zero vale para FIIs? Quais são as exceções?','Cobra taxa de custódia?','Você vai precisar de ordens pela Mesa (telefone), que costumam ter custo?','O app mostra proventos, histórico de operações e informe de rendimentos para o imposto de renda?','Dá para comprar cotas de FII de uma em uma?','Há atendimento claro se algo der errado?','O que clientes dizem em canais públicos de reclamação?'];
function viewCorretoras(){
  const n=Object.keys(S.ck).filter(k=>S.ck[k]).length;
  const list=BROKERS.filter(b=>BF==='all'||b.tags.includes(BF));
  const seg=`<div class="seg" aria-label="Filtrar corretoras">${[['all','Todas'],['banco','Ligadas a banco'],['grafica','Plataformas gráficas']].map(o=>`<button class="${BF===o[0]?'on':''}" data-act="bfilter" data-id="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  const cards=list.map(b=>`<div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><h3>${b.n}</h3>${b.tags.includes('banco')?'<span class="tag">Ligada a banco</span>':''}${b.tags.includes('grafica')?'<span class="tag">Plataforma gráfica</span>':''}</div><p>${b.d}</p><p class="muted"><b>Exceções à corretagem zero:</b> ${b.x}</p></div>`).join('');
  const chk=CHECK.map((t,i)=>`<label class="ckrow"><input type="checkbox" data-ck="${i}" ${S.ck[i]?'checked':''}><span>${t}</span></label>`).join('');
  return`<section class="stack"><div><p class="eyebrow">Corretoras</p><h2>Onde abrir sua conta para investir</h2></div><div class="event"><b>Sugestões para pesquisar, não recomendação.</b><p>A lista reúne corretoras que, em um levantamento de julho de 2026, não cobravam corretagem em ações e FIIs. Políticas mudam: confirme as condições no site de cada uma antes de abrir a conta.</p></div><div class="stack"><h3>Antes de abrir a conta</h3><p class="muted">Marque o que você já conferiu. <b id="ckN">${n}</b> de ${CHECK.length}.</p><div class="stack" style="gap:8px">${chk}</div></div><div class="stack"><h3>Corretoras de partida</h3>${seg}<div class="stack">${cards}</div></div><details><summary>Como a corretora ganha dinheiro</summary><div class="stack"><p><b>Corretagem:</b> taxa por ordem de compra ou venda, fixa, proporcional ao valor ou mista. A corretagem zero costuma valer só para certos produtos.</p><p><b>Custódia:</b> percentual cobrado para guardar seus títulos. Muitas corretoras não cobram.</p><p><b>Emolumentos da B3:</b> custo cobrado pela bolsa em cada operação. Não é a mesma coisa que custódia.</p><p><b>Outras fontes:</b> o dinheiro parado na conta, a diferença de preço em alguns produtos e o repasse de fundos distribuídos na plataforma.</p></div></details>${kCalcHTML()}<p class="muted">Fontes: levantamento de corretoras sem corretagem do iDinheiro (atualizado em 30/07/2026) e o guia da B3 sobre como as corretoras ganham dinheiro.</p><div class="row"><a class="btn sm" href="https://www.idinheiro.com.br/investimentos/corretoras/corretoras-corretagem-zero/" target="_blank" rel="noopener">iDinheiro</a><a class="btn sm" href="https://borainvestir.b3.com.br/tipos-de-investimentos/renda-variavel/etfs/como-funcionam-as-corretoras-como-elas-ganham-dinheiro/" target="_blank" rel="noopener">B3 Bora Investir</a></div></section>`;
}
function kCalcHTML(){
  return`<div class="card stack"><h3>Quanto a corretagem pesa no ano</h3><p class="muted">Exemplo para comparar corretoras. Troque pelo valor cobrado por quem você está avaliando.</p><div class="fields"><div class="field"><label for="k-cor">Corretagem por ordem (R$)</label><input id="k-cor" type="number" min="0" step="0.5" value="5" data-kcalc></div><div class="field"><label for="k-ord">Ordens por mês</label><input id="k-ord" type="number" min="0" max="100" step="1" value="3" data-kcalc></div><div class="field"><label for="k-apo">Aporte mensal (R$)</label><input id="k-apo" type="number" min="1" step="100" value="1000" data-kcalc></div></div><div id="kOut" class="stack"></div></div>`;
}
function updateKcalc(){
  const g=id=>$('#'+id);if(!g('k-cor')||!$('#kOut'))return;
  const cor=Math.max(0,Number(g('k-cor').value)||0),ord=Math.max(0,Math.min(100,Math.round(Number(g('k-ord').value)||0))),apo=Math.max(1,Number(g('k-apo').value)||1);
  const ano=cor*ord*12,pct=ano/(apo*12)*100;
  $('#kOut').innerHTML=`<div class="stats"><div class="stat"><div class="l">Custo por mês</div><div class="v">${BRL(cor*ord)}</div></div><div class="stat"><div class="l">Custo por ano</div><div class="v">${BRL(ano)}</div></div><div class="stat"><div class="l">Parte do aporte</div><div class="v">${NUM(pct)}%</div></div></div><p class="muted">${cor===0?'Com corretagem zero esse custo some. Ainda existem os emolumentos da B3, cobrados pela bolsa.':'Esse valor sai direto do seu rendimento. Em aportes pequenos, a corretagem fixa pesa mais.'}</p>`;
}

/* ---------- mercado ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let MK={st:'idle',data:null,erro:'',sort:'tk',msg:''};
function mercadoSrc(){if(window.__MERCADO__)return Promise.resolve(window.__MERCADO__);return fetch('mercado.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('erro '+r.status);return r.json();});}
function loadMercado(){
  MK.st='loading';
  mercadoSrc()
    .then(j=>{if(!j||!Array.isArray(j.fundos))throw new Error('formato inesperado');MK.data=j;MK.st='ok';})
    .catch(e=>{MK.st='err';MK.erro=String(e&&e.message||e);})
    .then(()=>{if(curTab()==='mercado')render();});
}
const dtBR=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||'');return m?m[3]+'/'+m[2]:'—';};
const mkList=()=>Array.isArray(S.watch)?S.watch:MK.data.fundos.map(f=>f.ticker);
function mkMetrics(f){return{chg:f.fechAnt?(f.preco/f.fechAnt-1)*100:null,dy:f.provento&&f.preco?f.provento.valor/f.preco*100:null,pvp:f.vp?f.preco/f.vp:null};}
function mkAdd(){
  const el=$('#tk-add');if(!el||!MK.data)return;
  const t=el.value.trim().toUpperCase();
  if(!/^[A-Z]{4}\d{2}$/.test(t)){MK.msg='Use o código com 4 letras e 2 números, como MXRF11.';render();return;}
  const cur=mkList();
  if(cur.includes(t)){MK.msg=t+' já está na sua lista.';}else{S.watch=cur.concat(t);save();MK.msg='';}
  render();
}
function mkInfo(){
  return`<details><summary>Como ligar este painel aos dados reais da B3</summary><div class="stack"><p>Esta página roda isolada e não consegue chamar sites de cotação. Ela lê o arquivo <b>mercado.json</b>, publicado junto dela.</p><p>Para dados reais, um serviço seu (um pequeno backend ou uma tarefa diária) consulta uma fonte de cotações e gera esse arquivo no formato abaixo.</p><p>Cotação em tempo real da B3 exige contrato de dados de mercado com a bolsa ou com um distribuidor autorizado. Fontes gratuitas costumam ter atraso.</p><pre>{
  "exemplo": false,
  "atualizado": "2026-10-09T17:30:00-03:00",
  "atrasoMin": 30,
  "fundos": [{
    "ticker": "XPTO11", "nome": "Nome do fundo",
    "segmento": "Logística", "preco": 98.40,
    "fechAnt": 97.60, "vp": 104.00,
    "provento": {"valor": 0.74,
      "dataCom": "2026-09-30",
      "pagamento": "2026-10-14"}
  }]
}</pre></div></details>`;
}
function mkCard(r){
  if(!r.f)return`<div class="card fund"><div class="head"><div><div class="tk">${esc(r.t)}</div><div class="muted">Sem dados nesta fonte</div></div><button class="btn sm ghost" data-act="mkdel" data-id="${esc(r.t)}">Remover</button></div></div>`;
  const f=r.f,m=r.m,cls=m.chg===null?'':m.chg>0?'up':m.chg<0?'dn':'';
  const dia=m.chg===null?'—':(m.chg>0?'▲ +':m.chg<0?'▼ ':'')+NUM(m.chg)+'%';
  const prov=f.provento;
  const rodape=prov?`Data-com ${dtBR(prov.dataCom)} · Pagamento ${dtBR(prov.pagamento)} · DY do mês ${NUM(m.dy)}%`:'Sem provento informado neste mês';
  return`<div class="card fund"><div class="head"><div><div class="tk">${esc(f.ticker)}</div><div>${esc(f.nome)}</div></div><span class="tag">${esc(f.segmento)}</span></div><div class="mets"><div class="met"><span>Preço</span><b>${BRL(f.preco)}</b></div><div class="met"><span>No dia</span><b class="${cls}">${dia}</b></div><div class="met"><span>Provento</span><b>${prov?BRL(prov.valor):'—'}</b></div><div class="met"><span>P/VP</span><b>${m.pvp===null?'—':NUM(m.pvp)}</b></div></div><div class="pos"><span class="muted">${rodape}</span><button class="btn sm ghost" data-act="mkdel" data-id="${esc(f.ticker)}">Remover</button></div></div>`;
}
function viewMercado(){
  const head=`<div><p class="eyebrow">Mercado</p><h2>Seus fundos no dia a dia</h2></div>`;
  if(MK.st==='err')return`<section class="stack">${head}<div class="card stack"><h3>Não consegui carregar as cotações</h3><p class="muted">A fonte de dados não respondeu (${esc(MK.erro)}). Tente de novo em instantes.</p><div class="row"><button class="btn primary" data-act="mkreload">Tentar de novo</button></div></div>${mkInfo()}</section>`;
  if(MK.st!=='ok')return`<section class="stack">${head}<div class="card"><p class="muted">Carregando cotações…</p></div></section>`;
  const d=MK.data,ex=!!d.exemplo,dt=new Date(d.atualizado);
  const quando=isNaN(dt)?'—':dt.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
  const by=Object.create(null);d.fundos.forEach(f=>{by[f.ticker]=f;});
  const rows=mkList().map(t=>({t,f:by[t]||null}));
  rows.forEach(r=>{r.m=r.f?mkMetrics(r.f):null;});
  const key=r=>MK.sort==='alta'?(r.m&&r.m.chg!==null?r.m.chg:-1e9):(r.m&&r.m.dy!==null?r.m.dy:-1e9);
  rows.sort((a,b)=>MK.sort==='tk'?a.t.localeCompare(b.t):key(b)-key(a));
  const com=rows.filter(r=>r.m);
  const ups=com.filter(r=>r.m.chg>0).length,dns=com.filter(r=>r.m.chg<0).length;
  const dys=com.filter(r=>r.m.dy!==null).map(r=>r.m.dy);
  const dyMed=dys.length?dys.reduce((a,b)=>a+b,0)/dys.length:null;
  const status=`<div class="row"><span class="tag ${ex?'gold':''}">${ex?'Dados de exemplo':'Dados da fonte'}</span><span class="muted">Atualizado em ${quando}${d.atrasoMin?` · atraso de cerca de ${d.atrasoMin} min`:''}</span><button class="btn sm" data-act="mkreload">Atualizar</button></div>`;
  const aviso=ex?`<div class="event"><b>Os fundos e preços abaixo são fictícios.</b><p>Eles só mostram o formato do painel. Com uma fonte de dados reais ligada, este mesmo painel mostra os seus fundos de verdade.</p></div>`:'';
  const stats=`<div class="stats"><div class="stat"><div class="l">Acompanhados</div><div class="v">${rows.length}</div></div><div class="stat"><div class="l">Em alta</div><div class="v ${ups?'pos':''}">${ups}</div></div><div class="stat"><div class="l">Em queda</div><div class="v ${dns?'neg':''}">${dns}</div></div><div class="stat"><div class="l">DY médio do mês</div><div class="v">${dyMed===null?'—':NUM(dyMed)+'%'}</div></div></div>`;
  const seg=`<div class="seg" aria-label="Ordenar por">${[['tk','Código'],['alta','Maior alta'],['dy','Maior DY']].map(o=>`<button class="${MK.sort===o[0]?'on':''}" data-act="mksort" data-id="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  const add=`<form data-form="mkadd" class="add" autocomplete="off"><div class="field"><label for="tk-add">Acompanhar outro código</label><input id="tk-add" type="text" maxlength="6" placeholder="Ex.: MXRF11"></div><button class="btn primary" type="submit">Adicionar</button></form><div class="toast" role="status">${esc(MK.msg)}</div>`;
  const lista=rows.length?`<div class="funds">${rows.map(mkCard).join('')}</div>`:`<div class="card"><p class="muted">Nenhum fundo na lista. Adicione um código acima.</p></div>`;
  return`<section class="stack">${head}${status}${aviso}${stats}<div class="row">${seg}</div>${add}${lista}${mkInfo()}</section>`;
}

/* ---------- eventos ---------- */
const ACT={
  open(id){openMod=id;startLesson(id);if(curTab()!=='trilha'){location.hash='trilha';return;}render();window.scrollTo(0,0);},
  back(){openMod=null;L=null;render();window.scrollTo(0,0);},
  next(){const nx=ORDER[ORDER.indexOf(openMod)+1];if(nx&&isUnlocked(MODS[nx].lvl))ACT.open(nx);else ACT.back();},
  check(){
    if(!L||L.qs.some(q=>q.pick<0))return;
    L.checked=true;L.passed=L.qs.every(q=>q.opts[q.pick].ok);
    if(L.passed&&!S.done[openMod]){S.done[openMod]=true;S.xp+=50;L.gained=50;L.lvUp=levelDone(MODS[openMod].lvl);save();}
    render();const r=$('#result');if(r)r.scrollIntoView({block:'center'});
  },
  retry(){startLesson(openMod);render();const q=$('#quiz');if(q)q.scrollIntoView({block:'start'});},
  ttab(id){trainTab=id;render();},
  nextp(){newProblem();render();const a=$('#ans');if(a)a.focus();},
  flip(){flipped=!flipped;render();},
  cprev(){cardI=(cardI+TERMS.length-1)%TERMS.length;flipped=false;render();},
  cnext(){cardI=(cardI+1)%TERMS.length;flipped=false;render();},
  cok(){S.cards[TERMS[cardI][0]]='ok';save();ACT.cnext();},
  crev(){S.cards[TERMS[cardI][0]]='rev';save();ACT.cnext();},
  rvstart(){revStart();render();},
  rvpick(id){if(!RV||RV.pick>=0)return;RV.pick=+id;if(RV.qs[RV.i].opts[RV.pick].ok){RV.score++;S.xp+=5;save();}render();},
  rvnext(){if(RV.i+1<RV.qs.length){RV.i++;RV.pick=-1;}else RV.end=true;render();},
  stab(id){simTab=id;render();},
  simstart(){newGame();render();},
  simreset(){if(G&&!G.done&&!G.cr){G.cr=true;render();return;}G=null;render();},
  advance(){if(!G)return;const was=G.done;advance();render();if(!was&&G.done){const d=$('.event');if(d)d.scrollIntoView({block:'start'});}},
  lot(id){lot=+id;render();},
  buy(id){buy(id);render();},
  sell(id){sell(id);render();},
  mkreload(){MK.st='idle';render();},
  mksort(id){MK.sort=id;render();},
  mkdel(id){if(!MK.data)return;S.watch=mkList().filter(x=>x!==id);save();render();},
  obj(id){S.obj=S.obj===id?null:id;save();render();},
  gnew(h){GD={h,nome:'',alvo:'',inicio:hoje()};GE=h;GM='';render();},
  gsug(id){const p=id.split(':');GD={h:p[0],nome:(SUG[S.obj]||SUG.geral)[p[0]][+p[1]],alvo:'',inicio:hoje()};GE=p[0];GM='';render();},
  gedit(h){const g=S.goals[h];if(!g)return;GD={h,nome:g.nome,alvo:g.alvo,inicio:g.inicio};GE=h;GM='';render();},
  gcancel(){GE=null;GD=null;GM='';render();},
  gdel(h){if(GDEL!==h){GDEL=h;render();return;}delete S.goals[h];GDEL=null;save();render();},
  gundo(id){const p=id.split(':'),g=S.goals[p[0]];if(g){g.aportes.splice(+p[1],1);save();}render();},
  hcheck(id){
    const h=S.habits.find(x=>x.id===id);if(!h)return;
    if(hDone(h)){(h.f==='s'?weekDays():[hoje()]).forEach(d=>{if(S.hlog[d]){S.hlog[d]=S.hlog[d].filter(x=>x!==id);if(!S.hlog[d].length)delete S.hlog[d];}});}
    else{const t=hoje();(S.hlog[t]=S.hlog[t]||[]).push(id);}
    save();render();
  },
  hdel(id){S.habits=S.habits.filter(h=>h.id!==id);save();render();},
  tcadd(id){const f=tcF().find(x=>x.id===id),c=tcCalc();if(f&&c.cash+1e-9>=f.price*lot){TC.q[id]=(TC.q[id]||0)+lot;TC.res=null;}render();},
  tcsub(id){TC.q[id]=Math.max(0,(TC.q[id]||0)-lot);TC.res=null;render();},
  tczero(){TC={q:{},res:null};render();},
  tceval(){
    const r=tcScore();r.xpGain=0;
    if(r.tot>S.tcart.best)S.tcart.best=r.tot;
    if(r.tot>=70&&!S.tcart.xp){S.tcart.xp=true;S.xp+=40;r.xpGain=40;}
    TC.res=r;save();render();const el=$('#tcres');if(el)el.scrollIntoView({block:'start'});
  },
  bfilter(id){BF=id;render();}
};
const view=$('#view');
view.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t||t.disabled)return;if(t.dataset.act!=='gdel')GDEL=null;const f=ACT[t.dataset.act];if(f)f(t.dataset.id,t);});
view.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches&&t.matches('input[data-q]')&&L&&!L.checked){L.qs[+t.dataset.q].pick=+t.value;const b=$('#chkBtn');if(b)b.disabled=L.qs.some(q=>q.pick<0);}
  if(t.matches&&t.matches('input[data-ck]')){S.ck[t.dataset.ck]=t.checked;save();const el=$('#ckN');if(el)el.textContent=Object.keys(S.ck).filter(k=>S.ck[k]).length;}
});
view.addEventListener('input',e=>{
  if(e.target.matches&&e.target.matches('[data-calc]'))updateCalc();
  if(e.target.matches&&e.target.matches('[data-kcalc]'))updateKcalc();
  if(e.target.id==='g-dy'){S.dyRef=Math.max(0,Math.min(30,Number(e.target.value)||0));save();const el=$('#g-renda');if(el)el.textContent=BRL(gTotal()*S.dyRef/100/12);}
});
view.addEventListener('submit',e=>{
  e.preventDefault();
  const fm=e.target.dataset.form;
  if(fm==='mkadd'){mkAdd();return;}
  if(fm==='goal'){gSave(e.target);return;}
  if(fm==='aporte'){gAporte(e.target);return;}
  if(fm==='habit'){hAdd();return;}
  if(e.target.dataset.form==='drill'&&P&&!P.res){
    const raw=$('#ans').value,v=parseAns(raw);if(v===null)return;
    const ok=Math.abs(v-P.ans)<=P.tol,d=S.drill;
    d.total++;if(ok){d.ok++;d.streak++;d.best=Math.max(d.best,d.streak);S.xp+=10;}else d.streak=0;
    P.res={ok,raw};save();render();
  }
});
/* =====================================================================
   Camada de contas, planos, carteira, mentoria e painel Admin
   (roda dentro do mesmo escopo da lógica do curso)
   ===================================================================== */
const BK=window.BK;
const PLANOS=[
 {id:1,nome:'Essencial',def:14.99,tag:'Acesso completo ao curso',itens:['Trilha com 8 níveis e 24 módulos','Treino: exercícios, cartões, revisão e montagem de carteira','Simulador de carteira e calculadoras','Metas, hábitos, painel de mercado e guia de corretoras']},
 {id:2,nome:'Investidor',def:19.99,tag:'Completo + dicas e carteira',itens:['Tudo do plano Essencial','Dicas de investimento publicadas pelo mentor','Minha carteira: pesos, renda estimada e aporte sugerido']},
 {id:3,nome:'Mentoria',def:49.99,tag:'Planos 1 e 2 + mentoria',itens:['Tudo dos planos Essencial e Investidor','1 hora de mentoria por mês','Análise da sua carteira e estratégia de longo prazo']}
];
const NEED={trilha:1,metas:1,treino:1,simulacao:1,mercado:1,corretoras:1,dicas:2,carteira:2,mentoria:3,conta:0};
const TABNAME={admin:'Admin',trilha:'Trilha',metas:'Metas',treino:'Treino',simulacao:'Simular',mercado:'Mercado',corretoras:'Corretoras',dicas:'Dicas',carteira:'Carteira',mentoria:'Mentoria',conta:'Conta'};
const TABORDER=['trilha','metas','treino','simulacao','mercado','corretoras','dicas','carteira','mentoria','conta'];

const AUTH={st:'loading',modo:'entrar',err:'',msg:'',f:{nome:'',whatsapp:'',email:''}};
let ME=null,CFG=null,PREC=null,SOL=[],PAG=[],DICAS=null,CART=null,MEN=null;
const UI={plano:0,nota:'',copied:false,msg:'',dcat:'Todas',busy:false};
const AD={sub:'resumo',alunos:null,sols:null,mens:null,dicas:null,loading:false,err:'',q:'',fl:'todos',pl:'0',det:null,detLoading:false,edDica:null};

/* ---------- utilidades ---------- */
const preco=id=>{const src=CFG||PREC||{};const v=Number(src['preco'+id]);return isFinite(v)&&v>0?v:PLANOS[id-1].def;};
const isAdmin=()=>!!(ME&&ME.admin);
const planoAcesso=()=>ME?(ME.admin?3:(ME.plano||0)):0;
const podeAbrir=t=>t==='admin'?isAdmin():(NEED[t]===0||planoAcesso()>=NEED[t]);
function defTab(){return ME&&ME.admin?'admin':'trilha';}
const num=v=>{const n=Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.'));return isFinite(n)?n:0;};
const paras=t=>String(t||'').split(/\n{2,}/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
const nomeMes=m=>{const [y,mm]=String(m).split('-').map(Number);return new Date(y,(mm||1)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});};
const dtHora=iso=>{if(!iso)return '—';const d=new Date(iso);return isNaN(d)?'—':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const paraInputDT=iso=>{if(!iso)return '';const d=new Date(iso);if(isNaN(d))return '';const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());};
const deInputDT=v=>{if(!v)return null;const d=new Date(v);return isNaN(d)?null:d.toISOString();};
function waLink(numero,msg){const d=String(numero||'').replace(/\D/g,'');if(d.length<10)return '';const n=d.length<=11?'55'+d:d;return 'https://wa.me/'+n+(msg?'?text='+encodeURIComponent(msg):'');}
function msgErro(e){
  const m=String(e&&e.message||e||'');
  const t=[['Invalid login credentials','E-mail ou senha incorretos.'],['already registered','Este e-mail já tem cadastro. Use a opção Entrar.'],['Email not confirmed','Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).'],['at least 6','A senha precisa ter pelo menos 6 caracteres.'],['rate limit','Muitas tentativas. Aguarde um pouco e tente de novo.'],['Failed to fetch','Sem conexão com o servidor. Verifique a internet.'],['row-level security','Sem permissão para esta ação.'],['duplicate key','Este registro já existe.']];
  for(const [k,v] of t)if(m.toLowerCase().includes(k.toLowerCase()))return v;
  return m||'Algo deu errado. Tente de novo.';
}
function situacao(x,tol){
  if(!x||!x.plano)return x&&x.pendente?{k:'pendente',t:'Aguardando confirmação',c:'gold'}:{k:'sem',t:'Sem assinatura',c:''};
  if(x.status==='suspensa')return {k:'suspensa',t:'Suspensa',c:'bad'};
  const d=daysBetween(hoje(),x.vence_em);
  if(d<-tol)return {k:'vencida',t:`Vencida há ${-d} dia${-d>1?'s':''}`,c:'bad',d};
  if(d<0)return {k:'tolerancia',t:`Venceu há ${-d} dia${-d>1?'s':''} (tolerância)`,c:'gold',d};
  if(d<=5)return {k:'avencer',t:d===0?'Vence hoje':`Vence em ${d} dia${d>1?'s':''}`,c:'gold',d};
  return {k:'emdia',t:'Em dia',c:'ok',d};
}
const tolDias=()=>CFG&&Number.isFinite(Number(CFG.tolerancia_dias))?Number(CFG.tolerancia_dias):3;
async function run(fn){UI.busy=true;try{await fn();}catch(e){UI.msg=msgErro(e);}UI.busy=false;render();}
function refocus(id){const el=$('#'+id);if(el){el.focus();try{const n=el.value.length;el.setSelectionRange(n,n);}catch(e){}}}

/* ---------- sincronização do progresso ---------- */
let syncT=null,syncPend=false,cartT=null,cartPend=false;
function agendarSync(){if(!ME)return;syncPend=true;clearTimeout(syncT);syncT=setTimeout(syncAgora,1500);}
async function syncAgora(){if(!syncPend||!ME)return;syncPend=false;try{await BK.salvarProgresso(S);}catch(e){syncPend=true;}}
function agendarCart(){if(!ME)return;cartPend=true;clearTimeout(cartT);cartT=setTimeout(cartAgora,1200);}
async function cartAgora(){if(!cartPend||!ME)return;cartPend=false;try{await BK.salvarCarteira(CART);}catch(e){cartPend=true;UI.msg='Não consegui salvar a carteira: '+msgErro(e);}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){syncAgora();cartAgora();}});
window.addEventListener('pagehide',()=>{syncAgora();cartAgora();});
function hidratar(){
  let local=null;try{local=JSON.parse(localStorage.getItem(KEY));}catch(e){}
  const rem=ME.progresso&&typeof ME.progresso==='object'&&Object.keys(ME.progresso).length?ME.progresso:null;
  let src=null,local_ganha=false;
  if(rem&&local){local_ganha=(local._t||0)>(rem._t||0);src=local_ganha?local:rem;}else src=rem||local;
  S=Object.assign(defaults(),src||{});
  onSave=agendarSync;
  if(local_ganha)agendarSync();
}
function normCart(d){const c=d&&typeof d==='object'?d:{};return{pos:Array.isArray(c.pos)?c.pos.filter(p=>p&&p.t):[],aporte:num(c.aporte)>0?num(c.aporte):1000,limite:num(c.limite)>0?num(c.limite):25};}

/* ---------- entrada no sistema ---------- */
async function entrar(){
  AUTH.st='loading';render();
  try{
    ME=await BK.meu();
    CFG=await BK.config().catch(()=>null);
    SOL=await BK.minhasSolicitacoes().catch(()=>[]);
    PAG=await BK.meusPagamentos().catch(()=>[]);
    KEY='trilhafii:v2:'+ME.id;
    hidratar();
    CART=normCart(ME.carteira);
    DICAS=null;MEN=null;Object.assign(AD,{sub:'resumo',alunos:null,sols:null,mens:null,dicas:null,det:null,detId:null,edDica:null,q:'',fl:'todos',pl:'0',err:''});
    if(planoAcesso()>=1){
      const c=await BK.conteudo();
      if(!c||!Array.isArray(c.levels))throw new Error('O conteúdo do curso não está no banco de dados. Rode o arquivo seed-conteudo.sql no Supabase.');
      buildContent(c);
    }
    AUTH.st='in';
    if(!location.hash||!TABS.includes(location.hash.slice(1))||!podeAbrir(location.hash.slice(1)))location.hash=defTab();
  }catch(e){AUTH.st='erro';AUTH.err=msgErro(e);}
  render();
}
async function boot(){
  if(!BK||!BK.configurado()){AUTH.st='setup';render();return;}
  try{
    BK.onRecuperacao(()=>{AUTH.modo='nova';AUTH.st='out';render();});
    PREC=await BK.precos().catch(()=>null);
    const u=await BK.init();
    if(u&&AUTH.modo!=='nova')await entrar();else{AUTH.st='out';render();}
  }catch(e){AUTH.st='erro';AUTH.err=msgErro(e);render();}
}

/* ---------- tela de entrada ---------- */
function planoCards(modo){
  const atual=planoAcesso();
  return `<div class="plans">${PLANOS.map(p=>`<div class="plan ${modo==='escolher'&&UI.plano===p.id?'sel':''}"><div class="row" style="justify-content:space-between"><h3>${p.nome}</h3>${atual===p.id&&modo==='escolher'?'<span class="tag ok">Seu plano</span>':''}</div><div class="price"><b class="num">${BRL(preco(p.id))}</b><span class="muted"> por mês</span></div><p class="muted">${p.tag}</p><ul>${p.itens.map(i=>`<li>${i}</li>`).join('')}</ul>${modo==='escolher'?`<button class="btn ${UI.plano===p.id?'primary':''}" data-act="plano" data-id="${p.id}">${atual===p.id?'Renovar este plano':atual>0&&p.id>atual?'Fazer upgrade':'Escolher'}</button>`:''}</div>`).join('')}</div>`;
}
function authForm(){
  const m=AUTH.modo,f=AUTH.f;
  const campo=(id,rot,tipo,val,extra)=>`<div class="field"><label for="${id}">${rot}</label><input id="${id}" type="${tipo}" value="${esc(val)}" ${extra||''}></div>`;
  let titulo='Entrar',btn='Entrar',campos='';
  if(m==='cadastro'){titulo='Criar minha conta';btn='Criar conta';campos=campo('a-nome','Nome completo','text',f.nome,'autocomplete="name" maxlength="120"')+campo('a-wa','WhatsApp (opcional)','tel',f.whatsapp,'autocomplete="tel" maxlength="30" placeholder="(11) 99999-9999"')+campo('a-email','E-mail','email',f.email,'autocomplete="email"')+campo('a-senha','Senha (mínimo 6 caracteres)','password','','autocomplete="new-password"');}
  else if(m==='recuperar'){titulo='Recuperar senha';btn='Enviar link';campos=campo('a-email','E-mail do cadastro','email',f.email,'autocomplete="email"');}
  else if(m==='nova'){titulo='Escolha uma nova senha';btn='Salvar nova senha';campos=campo('a-senha','Nova senha (mínimo 6 caracteres)','password','','autocomplete="new-password"');}
  else{campos=campo('a-email','E-mail','email',f.email,'autocomplete="email"')+campo('a-senha','Senha','password','','autocomplete="current-password"');}
  const links=m==='entrar'?`<button type="button" class="link" data-act="modo" data-id="cadastro">Ainda não tenho conta</button><button type="button" class="link" data-act="modo" data-id="recuperar">Esqueci a senha</button>`:m==='nova'?'':`<button type="button" class="link" data-act="modo" data-id="entrar">Já tenho conta</button>`;
  return `<form class="card stack" data-form="auth" autocomplete="on"><h2>${titulo}</h2>${campos}${AUTH.err?`<p class="why bad"><b>Atenção.</b> ${esc(AUTH.err)}</p>`:''}${AUTH.msg?`<p class="why good"><b>Pronto.</b> ${esc(AUTH.msg)}</p>`:''}<div class="row"><button class="btn primary" id="a-btn" type="submit">${btn}</button></div><div class="row">${links}</div></form>`;
}
function demoBox(){
  if(BK.modo!=='demo')return '';
  const b=(id,t)=>`<button class="btn sm" data-act="demo" data-id="${id}">${t}</button>`;
  return `<div class="event"><b>Modo demonstração</b><p>Os dados abaixo são fictícios e ficam só neste navegador. Entre direto como:</p><div class="row">${b('admin','Administrador')}${b('a0','Aluno sem assinatura')}${b('a1','Aluno plano 1')}${b('a2','Aluno plano 2')}${b('a3','Aluno plano 3')}</div></div>`;
}
function authHTML(){
  if(AUTH.st==='loading')return `<div class="card"><p class="muted">Carregando…</p></div>`;
  if(AUTH.st==='setup')return `<div class="card stack"><h2>Falta conectar o banco de dados</h2><p>Abra o arquivo <b>config.js</b> e preencha o endereço e a chave pública do seu projeto no Supabase. O passo a passo está no arquivo <b>LEIA-ME.md</b>.</p></div>`;
  if(AUTH.st==='erro')return `<div class="card stack"><h2>Não foi possível carregar</h2><p class="why bad">${esc(AUTH.err)}</p><div class="row"><button class="btn primary" data-act="recarregar">Tentar de novo</button><button class="btn" data-act="sair">Sair</button></div></div>`;
  return `<section class="stack">${demoBox()}<div class="hero2"><div class="stack"><p class="eyebrow">Curso de fundos imobiliários</p><h1>Aprenda a investir em FIIs, passo a passo</h1><p class="muted">Trilha com 8 níveis, treino com exercícios, simulador de carteira, metas e hábitos para poupar. Crie sua conta, escolha um plano e comece.</p></div>${authForm()}</div><div class="stack"><h2>Planos</h2>${planoCards('landing')}<p class="muted">Pagamento por Pix. Depois que o administrador confirmar o pagamento, seu acesso é liberado. Conteúdo educacional, sem recomendação de investimento.</p></div></section>`;
}

/* ---------- plano bloqueado, Pix e conta ---------- */
function pixHTML(){
  const n=UI.plano;if(!n)return '';
  const c=CFG||{},p=PLANOS[n-1],pend=SOL.find(s=>s.status==='pendente');
  const wa=waLink(c.whatsapp,`Olá! Fiz o Pix do plano ${p.nome} (${BRL(preco(n))}). Meu e-mail: ${ME&&ME.perfil?ME.perfil.email:''}`);
  if(pend){return `<div class="card stack"><h3>Pedido enviado</h3><p>Você avisou o pagamento do plano <b>${PLANOS[pend.plano-1].nome}</b> em ${dmy(String(pend.criado_em).slice(0,10))}. O administrador confere o Pix e libera seu acesso. Depois, toque em "Atualizar minha situação".</p><div class="row"><button class="btn primary" data-act="atualizar">Atualizar minha situação</button>${wa?`<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Falar no WhatsApp</a>`:''}</div></div>`;}
  const chave=c.pix_chave?`<div class="pixkey"><span class="num">${esc(c.pix_chave)}</span><button class="btn sm" data-act="copiar" data-id="${esc(c.pix_chave)}">${UI.copied?'Copiado':'Copiar'}</button></div>${c.pix_favorecido?`<p class="muted">Favorecido: ${esc(c.pix_favorecido)}</p>`:''}`:`<p class="why bad"><b>Atenção.</b> O administrador ainda não cadastrou a chave Pix.${wa?' Fale com ele pelo WhatsApp.':''}</p>`;
  return `<div class="card stack"><h3>Plano ${p.nome}: ${BRL(preco(n))} por mês</h3><ol class="steps"><li>Faça um Pix de <b>${BRL(preco(n))}</b> para a chave abaixo.</li><li>Volte aqui e toque em <b>Já paguei</b>.</li><li>O administrador confirma o pagamento e libera o acesso.</li></ol>${chave}<div class="field"><label for="pix-nota">Observação para o administrador (opcional)</label><input id="pix-nota" type="text" maxlength="200" value="${esc(UI.nota)}" placeholder="Ex.: nome que aparece no comprovante"></div><div class="row"><button class="btn primary" data-act="solicitar" ${c.pix_chave?'':'disabled'}>Já paguei</button>${wa?`<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Enviar comprovante no WhatsApp</a>`:''}</div></div>`;
}
function lockedHTML(v){
  const need=NEED[v]||1,atual=planoAcesso();
  if(atual===0)return `<section class="stack"><div><p class="eyebrow">Assinatura</p><h2>Escolha um plano para liberar o conteúdo</h2></div>${statusAssinatura()}${planoCards('escolher')}${pixHTML()}</section>`;
  const p=PLANOS[need-1];
  return `<section class="stack"><div class="card stack"><p class="eyebrow">Disponível no plano ${p.nome}</p><h2>${TABNAME[v]}</h2><p>${p.itens.slice(-1)[0]}.</p><p class="muted">Você está no plano ${PLANOS[atual-1].nome}. Faça o upgrade para ${p.nome} por ${BRL(preco(need))} por mês.</p><div class="row"><button class="btn primary" data-act="upgrade" data-id="${need}">Ver como fazer o upgrade</button></div></div></section>`;
}
function statusAssinatura(){
  const a=ME&&ME.assinatura,pend=SOL.some(s=>s.status==='pendente');
  const sit=situacao(a?{plano:a.plano,status:a.status,vence_em:a.vence_em,pendente:pend}:{pendente:pend},tolDias());
  const d=a&&a.vence_em?daysBetween(hoje(),a.vence_em):null;
  const lin=a?`<p>Plano <b>${PLANOS[a.plano-1].nome}</b> · vencimento em <b>${dmy(a.vence_em)}</b>${d!==null?(d>=0?` (${d} dia${d===1?'':'s'} restante${d===1?'':'s'})`:''):''}</p>`:'<p class="muted">Você ainda não tem uma assinatura.</p>';
  return `<div class="card stack"><div class="row" style="justify-content:space-between"><h3>Minha assinatura</h3><span class="tag ${sit.c}">${sit.t}</span></div>${lin}<div class="row"><button class="btn sm" data-act="atualizar">Atualizar minha situação</button></div></div>`;
}
function contaHTML(){
  const pf=(ME&&ME.perfil)||{};
  const hist=PAG.length?`<div class="stack" style="gap:6px">${PAG.map(p=>`<div class="row" style="justify-content:space-between"><span class="num">${dmy(p.pago_em)} · ${BRL(Number(p.valor))}</span><span class="muted">Plano ${PLANOS[p.plano-1].nome} · +${p.dias} dias</span></div>`).join('')}</div>`:'<p class="muted">Nenhum pagamento confirmado ainda.</p>';
  const planos=isAdmin()?'':`<div class="stack"><h2>${planoAcesso()>0?'Renovar ou mudar de plano':'Planos'}</h2>${planoCards('escolher')}${pixHTML()}</div>`;
  return `<section class="stack"><div><p class="eyebrow">Conta</p><h2>${esc(pf.nome||'Minha conta')}</h2></div>${isAdmin()?'':statusAssinatura()}${planos}<form class="card stack" data-form="perfil"><h3>Meus dados</h3><div class="fields"><div class="field"><label for="p-nome">Nome</label><input id="p-nome" type="text" maxlength="120" value="${esc(pf.nome||'')}"></div><div class="field"><label for="p-wa">WhatsApp</label><input id="p-wa" type="tel" maxlength="30" value="${esc(pf.whatsapp||'')}"></div></div><p class="muted">E-mail de acesso: ${esc(pf.email||'')}</p><div class="row"><button class="btn primary" type="submit">Salvar dados</button></div></form>${isAdmin()?'':`<div class="card stack"><h3>Pagamentos confirmados</h3>${hist}</div>`}<div class="row"><button class="btn" data-act="sair">Sair da conta</button></div></section>`;
}

/* ---------- dicas (plano 2+) ---------- */
function dicasHTML(){
  if(DICAS===null)return `<div class="card"><p class="muted">Carregando dicas…</p></div>`;
  const cats=['Todas'].concat([...new Set(DICAS.map(d=>d.categoria||'Geral'))]);
  const lista=DICAS.filter(d=>UI.dcat==='Todas'||(d.categoria||'Geral')===UI.dcat).sort((a,b)=>(b.destaque-a.destaque)||String(b.criado_em).localeCompare(String(a.criado_em)));
  const seg=`<div class="seg">${cats.map(c=>`<button class="${UI.dcat===c?'on':''}" data-act="dcat" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  const cards=lista.map(d=>`<article class="card stack"><div class="row"><span class="tag">${esc(d.categoria||'Geral')}</span>${d.destaque?'<span class="tag gold">Destaque</span>':''}<span class="muted">${dmy(String(d.criado_em).slice(0,10))}</span></div><h3>${esc(d.titulo)}</h3>${paras(d.corpo)}</article>`).join('');
  return `<section class="stack"><div><p class="eyebrow">Dicas de investimento</p><h2>Boas práticas para sua carteira</h2></div>${DICAS.length?seg:''}${cards||'<div class="card"><p class="muted">Ainda não há dicas publicadas.</p></div>'}<p class="muted">Conteúdo educacional. Não é recomendação de compra ou venda. Cada decisão depende do seu objetivo, prazo e perfil.</p></section>`;
}

/* ---------- carteira (plano 2+) ---------- */
const TIPOS={tijolo:'Tijolo',papel:'Papel',fof:'Fundo de fundos',hibrido:'Híbrido'};
function cartCalc(){
  const P=CART.pos.map(p=>({...p,custo:p.q*p.pm,valor:p.q*p.preco,renda:p.q*p.rend}));
  const inv=P.reduce((s,p)=>s+p.custo,0),val=P.reduce((s,p)=>s+p.valor,0),renda=P.reduce((s,p)=>s+p.renda,0);
  P.forEach(p=>{p.peso=val?p.valor/val*100:0;});
  return{P,inv,val,renda,res:val-inv};
}
function cartAlertas(c){
  const a=[],n=c.P.length;
  if(!n)return a;
  c.P.filter(p=>p.peso>CART.limite+.05).forEach(p=>a.push(`${p.t} pesa ${NUM(p.peso,1)}%, acima do seu limite de ${NUM(CART.limite,0)}%. Direcione os próximos aportes a outros fundos.`));
  if(n<5)a.push(`Você tem ${n} fundo${n>1?'s':''}. Com poucos fundos, um problema isolado pesa muito. Muitos investidores buscam 5 ou mais.`);
  const papel=c.val?c.P.filter(p=>p.tipo==='papel').reduce((s,p)=>s+p.valor,0)/c.val*100:0;
  if(papel>60)a.push(`Fundos de papel somam ${NUM(papel,0)}% da carteira. Isso concentra o risco de crédito.`);
  if(n>=3&&papel<10)a.push('Sua carteira quase não tem fundos de papel. Misturar tijolo e papel reduz a dependência de um só tipo de risco.');
  if(c.P.some(p=>!(p.preco>0)))a.push('Há fundos sem preço atual informado. Preencha para o cálculo ficar correto.');
  return a;
}
function sugerirAporte(c){
  const A=CART.aporte,P=c.P.filter(p=>p.preco>0);
  if(!P.length||!(A>0))return null;
  const ws=P.reduce((s,p)=>s+(p.alvo>0?p.alvo:0),0),usaAlvo=ws>0;
  const w=p=>usaAlvo?(p.alvo>0?p.alvo:0)/ws:1/P.length;
  const V=P.reduce((s,p)=>s+p.valor,0),tot=V+A;
  const falta=P.map(p=>Math.max(0,w(p)*tot-p.valor)),sf=falta.reduce((a,b)=>a+b,0);
  let aloc=P.map((p,i)=>sf>0?falta[i]*Math.min(1,A/sf):A*w(p));
  const usado=aloc.reduce((a,b)=>a+b,0);
  if(sf>0&&usado<A-1e-6){const rest=A-usado;aloc=aloc.map((x,i)=>x+rest*w(P[i]));}
  const lin=P.map((p,i)=>{const q=Math.floor(aloc[i]/p.preco+1e-9);return{t:p.t,q,gasto:q*p.preco,w:w(p)*100};}).filter(l=>l.q>0);
  const gasto=lin.reduce((s,l)=>s+l.gasto,0);
  return{lin,gasto,sobra:A-gasto,usaAlvo};
}
function carteiraHTML(){
  const c=cartCalc(),al=cartAlertas(c),sg=sugerirAporte(c),pct=c.inv?c.res/c.inv*100:0,yoc=c.inv?c.renda/c.inv*100:0;
  const stats=`<div class="stats"><div class="stat"><div class="l">Investido</div><div class="v">${BRL(c.inv)}</div></div><div class="stat"><div class="l">Valor atual</div><div class="v">${BRL(c.val)}</div></div><div class="stat"><div class="l">Resultado</div><div class="v ${c.res>=0?'pos':'neg'}">${(c.res>=0?'+':'')+BRL(c.res)}</div></div><div class="stat"><div class="l">Renda por mês</div><div class="v">${BRL(c.renda)}</div></div><div class="stat"><div class="l">Yield on cost mensal</div><div class="v">${NUM(yoc)}%</div></div></div>`;
  const add=`<form class="card stack" data-form="cpos" autocomplete="off"><h3>Adicionar fundo</h3><div class="fields"><div class="field"><label for="cp-t">Código</label><input id="cp-t" type="text" maxlength="6" placeholder="Ex.: XPTO11"></div><div class="field"><label for="cp-tipo">Tipo</label><select id="cp-tipo">${Object.entries(TIPOS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label for="cp-q">Cotas</label><input id="cp-q" type="number" min="1" step="1" inputmode="numeric"></div><div class="field"><label for="cp-pm">Preço médio (R$)</label><input id="cp-pm" type="number" min="0" step="0.01" inputmode="decimal"></div><div class="field"><label for="cp-pr">Preço atual (R$)</label><input id="cp-pr" type="number" min="0" step="0.01" inputmode="decimal"></div><div class="field"><label for="cp-r">Rendimento mensal por cota (R$)</label><input id="cp-r" type="number" min="0" step="0.01" inputmode="decimal"></div></div><div class="row"><button class="btn primary" type="submit">Adicionar</button></div></form>`;
  const campos=[['q','Cotas',1],['pm','Preço médio',0.01],['preco','Preço atual',0.01],['rend','Rend./cota/mês',0.01],['alvo','Meta de peso (%)',0.5]];
  const cards=c.P.map(p=>`<div class="card fund"><div class="head"><div><div class="tk">${esc(p.t)}</div><span class="muted">${esc(TIPOS[p.tipo]||'')}</span></div><button class="btn sm ghost" data-act="cdel" data-id="${esc(p.id)}">Remover</button></div><div class="fields">${campos.map(([k,r,st])=>`<div class="field"><label for="c-${esc(p.id)}-${k}">${r}</label><input id="c-${esc(p.id)}-${k}" type="number" min="0" step="${st}" inputmode="decimal" value="${p[k]||''}" data-cp="${esc(p.id)}:${k}"></div>`).join('')}</div><div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="muted">Peso na carteira</span><b class="num">${NUM(p.peso,1)}%</b></div><span class="bar" role="progressbar" aria-valuenow="${Math.round(p.peso)}" aria-valuemin="0" aria-valuemax="100" aria-label="Peso de ${esc(p.t)}"><i style="width:${Math.min(100,p.peso)}%"></i></span><div class="row" style="justify-content:space-between"><span class="muted">Valor ${BRL(p.valor)}</span><span class="muted">Renda ${BRL(p.renda)} por mês</span></div></div></div>`).join('');
  const alHTML=al.length?`<div class="event"><h3>Pontos de atenção</h3><ul style="margin:0;padding-left:20px;display:grid;gap:4px">${al.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:(c.P.length?`<div class="result pass"><b>Nenhum ponto de atenção</b><p>Pelas regras que você definiu, a carteira está equilibrada.</p></div>`:'');
  const sugestao=`<div class="card stack"><h3>Quanto comprar no próximo aporte</h3><p class="muted">O cálculo aproxima a carteira das metas de peso. Sem metas, usa pesos iguais.</p><div class="fields"><div class="field"><label for="c-aporte">Aporte do mês (R$)</label><input id="c-aporte" type="number" min="0" step="50" inputmode="decimal" value="${CART.aporte}" data-cc="aporte"></div><div class="field"><label for="c-limite">Limite por fundo (%)</label><input id="c-limite" type="number" min="1" max="100" step="1" inputmode="decimal" value="${CART.limite}" data-cc="limite"></div></div>${sg?(sg.lin.length?`<div class="stack" style="gap:6px">${sg.lin.map(l=>`<div class="row" style="justify-content:space-between"><b class="num">${esc(l.t)}</b><span>comprar <b class="num">${l.q}</b> cota${l.q>1?'s':''} · ${BRL(l.gasto)}</span></div>`).join('')}<p class="muted">Sobra em caixa: ${BRL(sg.sobra)}. ${sg.usaAlvo?'Usando suas metas de peso.':'Sem metas definidas, usando pesos iguais.'}</p></div>`:'<p class="muted">Com esse aporte não fecha nenhuma cota inteira.</p>'):'<p class="muted">Adicione fundos com preço atual para ver a sugestão.</p>'}<p class="muted">Ferramenta de estudo e organização. Não é recomendação de investimento.</p></div>`;
  const nota=planoAcesso()>=3&&!isAdmin()?`<p class="muted">Seu mentor consegue ver esta carteira para a mentoria mensal.</p>`:'';
  return `<section class="stack"><div><p class="eyebrow">Minha carteira</p><h2>Acompanhe e equilibre seus fundos</h2></div>${c.P.length?stats:''}${alHTML}${cards?`<div class="funds">${cards}</div>`:'<div class="card"><p class="muted">Sua carteira está vazia. Adicione o primeiro fundo abaixo. Os preços são digitados por você.</p></div>'}${add}${sugestao}${nota}</section>`;
}

/* ---------- mentoria (plano 3) ---------- */
function mentoriaHTML(){
  if(MEN===null)return `<div class="card"><p class="muted">Carregando…</p></div>`;
  const mes=hoje().slice(0,7),atual=MEN.find(m=>m.mes===mes&&m.status!=='cancelada');
  const wa=waLink(CFG&&CFG.whatsapp,'Olá! Sobre minha mentoria da Trilha FII.');
  let cartao='';
  if(!atual)cartao=`<form class="card stack" data-form="pedmen"><h3>Pedir a mentoria de ${esc(nomeMes(mes))}</h3><p class="muted">São 60 minutos por mês para analisar sua carteira e montar a estratégia de longo prazo. Diga quando você pode e o que quer tratar.</p><div class="field"><label for="m-pref">Dias e horários que funcionam para você</label><textarea id="m-pref" rows="2" maxlength="300" placeholder="Ex.: terças e quintas depois das 19h"></textarea></div><div class="field"><label for="m-ass">Assunto principal</label><input id="m-ass" type="text" maxlength="200" placeholder="Ex.: rebalancear minha carteira"></div><div class="row"><button class="btn primary" type="submit">Pedir mentoria</button><button class="btn" type="button" data-act="tab" data-id="carteira">Ver minha carteira</button></div></form>`;
  else if(atual.status==='pedida')cartao=`<div class="card stack"><div class="row" style="justify-content:space-between"><h3>Mentoria de ${esc(nomeMes(mes))}</h3><span class="tag gold">Pedido enviado</span></div><p>O mentor vai propor um horário. Quando for agendada, o dia, a hora e o link aparecem aqui.</p>${atual.preferencia?`<p class="muted">Sua preferência: ${esc(atual.preferencia)}</p>`:''}${wa?`<div class="row"><a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>`:''}</div>`;
  else if(atual.status==='agendada')cartao=`<div class="card stack"><div class="row" style="justify-content:space-between"><h3>Mentoria de ${esc(nomeMes(mes))}</h3><span class="tag ok">Agendada</span></div><p><b>${esc(dtHora(atual.data_hora))}</b></p>${atual.link?`<div class="row"><a class="btn primary" href="${esc(atual.link)}" target="_blank" rel="noopener noreferrer">Entrar na reunião</a></div>`:'<p class="muted">O link da reunião ainda não foi informado.</p>'}</div>`;
  else cartao=`<div class="card stack"><div class="row" style="justify-content:space-between"><h3>Mentoria de ${esc(nomeMes(mes))}</h3><span class="tag ok">Realizada</span></div><p class="muted">A próxima mentoria pode ser pedida no mês seguinte.</p></div>`;
  const ult=MEN.filter(m=>m.status==='realizada'&&(m.estrategia||m.resumo)).sort((a,b)=>String(b.mes).localeCompare(String(a.mes)));
  const estr=ult.length?`<div class="card stack"><p class="eyebrow">Estratégia de longo prazo</p><h3>${esc(nomeMes(ult[0].mes))}</h3>${ult[0].estrategia?paras(ult[0].estrategia):'<p class="muted">Sem estratégia registrada.</p>'}${ult[0].resumo?`<details><summary>Resumo da conversa</summary><div class="stack">${paras(ult[0].resumo)}</div></details>`:''}</div>`:'';
  const hist=MEN.filter(m=>m.mes!==mes||m.status==='cancelada').map(m=>`<div class="row" style="justify-content:space-between"><span>${esc(nomeMes(m.mes))}</span><span class="tag ${m.status==='realizada'?'ok':m.status==='cancelada'?'bad':'gold'}">${esc(m.status)}</span></div>`).join('');
  return `<section class="stack"><div><p class="eyebrow">Mentoria</p><h2>Uma hora por mês com você e sua carteira</h2></div>${cartao}${estr}${hist?`<div class="card stack"><h3>Histórico</h3>${hist}</div>`:''}</section>`;
}

/* ---------- Admin ---------- */
const TOTAL_MODS=()=>ORDER.length||24;
function classificar(){
  const tol=tolDias(),c={total:0,emdia:0,avencer:0,tolerancia:0,vencida:0,sem:0,suspensa:0,pendente:0,mrr:0,plano:{1:0,2:0,3:0}};
  AD.alunos.forEach(a=>{
    a.sit=situacao(a,tol);c.total++;
    if(a.sit.k==='emdia'||a.sit.k==='avencer'){c.emdia++;c.mrr+=preco(a.plano);c.plano[a.plano]++;}
    if(a.sit.k==='avencer')c.avencer++;
    if(a.sit.k==='tolerancia'){c.tolerancia++;c.plano[a.plano]++;}
    if(a.sit.k==='vencida')c.vencida++;
    if(a.sit.k==='sem'||a.sit.k==='pendente')c.sem++;
    if(a.sit.k==='suspensa')c.suspensa++;
  });
  c.pendente=AD.sols?AD.sols.length:0;
  return c;
}
async function adminCarregar(){
  AD.loading=true;AD.err='';render();
  try{
    const [al,so,me,di,cf]=await Promise.all([BK.adminAlunos(),BK.adminSolicitacoes(),BK.adminMentorias(),BK.adminDicas(),BK.config()]);
    AD.alunos=al;AD.sols=so;AD.mens=me;AD.dicas=di;CFG=cf;
  }catch(e){AD.err=msgErro(e);}
  AD.loading=false;render();
}
function adminStats(c){
  const k=(l,v,cl)=>`<div class="stat"><div class="l">${l}</div><div class="v ${cl||''}">${v}</div></div>`;
  return `<div class="stats">${k('Alunos',c.total)}${k('Em dia',c.emdia,'pos')}${k('Vencem em 5 dias',c.avencer)}${k('Em tolerância',c.tolerancia)}${k('Vencidas',c.vencida,c.vencida?'neg':'')}${k('Sem assinatura',c.sem)}${k('Aguardando Pix',c.pendente)}${k('Receita mensal em dia',BRL(c.mrr))}</div>`;
}
function msgCobranca(a){
  const cf=CFG||{};
  const d=a.vence_em?dmy(a.vence_em):'';
  const base=a.sit&&(a.sit.k==='vencida'||a.sit.k==='tolerancia')?`Olá, ${a.nome||''}! Sua assinatura da Trilha FII venceu em ${d}.`:`Olá, ${a.nome||''}! Sua assinatura da Trilha FII vence em ${d}.`;
  return base+` Para renovar, faça o Pix de ${BRL(preco(a.plano||1))}${cf.pix_chave?' para a chave '+cf.pix_chave:''} e me avise por aqui. Obrigado!`;
}
function adminResumo(){
  const c=classificar();
  const bar=PLANOS.map(p=>`<div class="stack" style="gap:4px"><div class="row" style="justify-content:space-between"><span>${p.nome}</span><b class="num">${c.plano[p.id]} aluno${c.plano[p.id]===1?'':'s'}</b></div><span class="bar" aria-hidden="true"><i style="width:${(c.emdia+c.tolerancia)?c.plano[p.id]/(c.emdia+c.tolerancia)*100:0}%"></i></span></div>`).join('');
  const cobrar=AD.alunos.filter(a=>['avencer','tolerancia','vencida'].includes(a.sit.k)).sort((a,b)=>String(a.vence_em).localeCompare(String(b.vence_em)));
  const lista=cobrar.length?cobrar.map(a=>{const w=waLink(a.whatsapp,msgCobranca(a));return `<div class="arow2"><div class="who"><b>${esc(a.nome||a.email)}</b><span class="muted">Plano ${PLANOS[a.plano-1].nome} · vence ${dmy(a.vence_em)}</span></div><span class="tag ${a.sit.c}">${a.sit.t}</span><span class="row" style="gap:6px">${w?`<a class="btn sm" href="${esc(w)}" target="_blank" rel="noopener">WhatsApp</a>`:''}<button class="btn sm" data-act="admabrir" data-id="${esc(a.id)}">Abrir</button></span></div>`;}).join(''):'<p class="muted">Ninguém precisa de aviso agora.</p>';
  return `<div class="stack">${adminStats(c)}<div class="card stack"><h3>Alunos por plano (com acesso)</h3>${bar}</div><div class="card stack"><h3>Para avisar ou cobrar</h3>${lista}</div></div>`;
}
function filtrados(){
  const q=AD.q.trim().toLowerCase();
  return AD.alunos.filter(a=>{
    if(AD.pl!=='0'&&String(a.plano)!==AD.pl)return false;
    if(AD.fl==='emdia'&&!(a.sit.k==='emdia'||a.sit.k==='avencer'))return false;
    if(['avencer','tolerancia','vencida','suspensa','pendente'].includes(AD.fl)&&a.sit.k!==AD.fl)return false;
    if(AD.fl==='sem'&&!(a.sit.k==='sem'||a.sit.k==='pendente'))return false;
    if(q&&!((a.nome||'').toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q)))return false;
    return true;
  });
}
function adminAlunos(){
  if(AD.det||AD.detLoading)return adminDetalhe();
  classificar();
  const fls=[['todos','Todos'],['emdia','Em dia'],['avencer','A vencer'],['tolerancia','Tolerância'],['vencida','Vencidos'],['sem','Sem assinatura'],['pendente','Aguardando Pix'],['suspensa','Suspensos']];
  const lista=filtrados();
  const rows=lista.map(a=>`<div class="arow"><div class="who"><b>${esc(a.nome||'(sem nome)')}</b><span class="muted">${esc(a.email)}</span></div><span class="tag">${a.plano?'Plano '+PLANOS[a.plano-1].nome:'—'}</span><span class="tag ${a.sit.c}">${a.sit.t}</span><span class="num">${a.vence_em?dmy(a.vence_em):'—'}</span><div class="prog" title="Módulos concluídos"><span class="bar"><i style="width:${Math.min(100,a.modulos/TOTAL_MODS()*100)}%"></i></span><span class="muted num">${a.modulos}/${TOTAL_MODS()}</span></div><button class="btn sm" data-act="admabrir" data-id="${esc(a.id)}">Abrir</button></div>`).join('');
  return `<div class="stack"><div class="row"><div class="field" style="flex:1;min-width:200px"><label for="ad-q">Buscar por nome ou e-mail</label><input id="ad-q" type="text" value="${esc(AD.q)}" data-adq="1" autocomplete="off"></div><div class="field" style="min-width:140px"><label for="ad-pl">Plano</label><select id="ad-pl" data-adpl="1"><option value="0">Todos</option>${PLANOS.map(p=>`<option value="${p.id}" ${AD.pl===String(p.id)?'selected':''}>${p.nome}</option>`).join('')}</select></div></div><div class="seg" aria-label="Situação">${fls.map(([k,t])=>`<button class="${AD.fl===k?'on':''}" data-act="admfl" data-id="${k}">${t}</button>`).join('')}</div><p class="muted">${lista.length} de ${AD.alunos.length} aluno${AD.alunos.length===1?'':'s'}. <button class="link" data-act="admcsv">Baixar lista em CSV</button></p><div class="stack" style="gap:8px">${rows||'<div class="card"><p class="muted">Nenhum aluno encontrado.</p></div>'}</div></div>`;
}
async function abrirAluno(id){
  AD.detLoading=true;AD.det=null;AD.detId=id;render();
  try{const a=AD.alunos.find(x=>x.id===id);const d=await BK.adminAluno(id);AD.det=Object.assign({a},d);}catch(e){UI.msg=msgErro(e);AD.detId=null;}
  AD.detLoading=false;render();
}
function adminDetalhe(){
  if(AD.detLoading||!AD.det)return `<div class="card"><p class="muted">Carregando aluno…</p></div>`;
  const D=AD.det,a=AD.alunos.find(x=>x.id===D.a.id)||D.a;a.sit=a.sit||situacao(a,tolDias());
  const w=waLink(a.whatsapp,a.vence_em?msgCobranca(a):`Olá, ${a.nome||''}!`);
  const planoSug=a.plano_pedido||a.plano||1;
  const opts=(sel)=>PLANOS.map(p=>`<option value="${p.id}" ${sel===p.id?'selected':''}>${p.nome} (${BRL(preco(p.id))})</option>`).join('');
  const prog=D.progresso&&D.progresso.done?Object.keys(D.progresso.done).length:0;
  const cart=D.carteira&&Array.isArray(D.carteira.pos)?D.carteira.pos:[];
  const cartHTML=cart.length?`<div class="stack" style="gap:4px">${cart.map(p=>`<div class="row" style="justify-content:space-between"><b class="num">${esc(p.t)}</b><span class="muted">${esc(p.q)} cotas · PM ${BRL(num(p.pm))} · atual ${BRL(num(p.preco))}</span></div>`).join('')}</div>`:'<p class="muted">Sem carteira cadastrada.</p>';
  const pags=(D.pagamentos||[]).length?D.pagamentos.map(p=>`<div class="row" style="justify-content:space-between"><span class="num">${dmy(p.pago_em)} · ${BRL(Number(p.valor))}</span><span class="muted">${PLANOS[p.plano-1].nome} · +${p.dias} dias · ${esc(p.forma)}${p.obs?' · '+esc(p.obs):''}</span></div>`).join(''):'<p class="muted">Nenhum pagamento registrado.</p>';
  const mens=(D.mentorias||[]).length?D.mentorias.map(m=>`<div class="row" style="justify-content:space-between"><span>${esc(nomeMes(m.mes))}</span><span class="tag ${m.status==='realizada'?'ok':m.status==='cancelada'?'bad':'gold'}">${esc(m.status)}</span></div>`).join(''):'<p class="muted">Sem mentorias.</p>';
  const pend=(D.solicitacoes||[]).find(s=>s.status==='pendente');
  return `<div class="stack"><div class="row"><button class="btn sm ghost" data-act="admvoltar">← Voltar à lista</button></div><div class="card stack"><div class="row" style="justify-content:space-between"><div><h2>${esc(a.nome||'(sem nome)')}</h2><p class="muted">${esc(a.email)}${a.whatsapp?' · '+esc(a.whatsapp):''}</p></div><span class="tag ${a.sit.c}">${a.sit.t}</span></div><p>${a.plano?`Plano <b>${PLANOS[a.plano-1].nome}</b> · vence em <b>${a.vence_em?dmy(a.vence_em):'—'}</b>${a.status==='suspensa'?' · <b>suspensa</b>':''}`:'Sem assinatura.'} Cadastro em ${dmy(String(a.criado_em).slice(0,10))}.</p>${pend?`<p class="why good"><b>Pedido de pagamento pendente:</b> plano ${PLANOS[pend.plano-1].nome}${pend.nota?` · "${esc(pend.nota)}"`:''}</p>`:''}<div class="row">${w?`<a class="btn sm" href="${esc(w)}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div></div>
<form class="card stack" data-form="admpag" data-id="${esc(a.id)}"><h3>Confirmar pagamento</h3><p class="muted">Soma os dias ao vencimento atual (ou a partir de hoje, se já venceu) e libera o acesso.</p><div class="fields"><div class="field"><label for="ap-plano">Plano</label><select id="ap-plano">${opts(planoSug)}</select></div><div class="field"><label for="ap-valor">Valor recebido (R$)</label><input id="ap-valor" type="number" min="0" step="0.01" inputmode="decimal" value="${preco(planoSug)}"></div><div class="field"><label for="ap-dias">Dias de acesso</label><input id="ap-dias" type="number" min="1" max="400" step="1" value="30"></div></div><div class="field"><label for="ap-obs">Observação (opcional)</label><input id="ap-obs" type="text" maxlength="200"></div><div class="row"><button class="btn primary" type="submit">Confirmar pagamento</button></div></form>
<form class="card stack" data-form="admaj" data-id="${esc(a.id)}"><h3>Ajustar assinatura</h3><div class="fields"><div class="field"><label for="aj-plano">Plano</label><select id="aj-plano">${opts(a.plano||1)}</select></div><div class="field"><label for="aj-status">Situação</label><select id="aj-status"><option value="ativa" ${a.status!=='suspensa'?'selected':''}>Ativa</option><option value="suspensa" ${a.status==='suspensa'?'selected':''}>Suspensa (sem acesso)</option></select></div><div class="field"><label for="aj-vence">Vencimento</label><input id="aj-vence" type="date" value="${esc(a.vence_em||hoje())}"></div></div><div class="row"><button class="btn" type="submit">Salvar ajuste</button></div></form>
<form class="card stack" data-form="admnota" data-id="${esc(a.id)}"><h3>Anotações internas</h3><p class="muted">Só você vê.</p><textarea id="an-texto" rows="3" maxlength="2000">${esc(a.nota||'')}</textarea><div class="row"><button class="btn" type="submit">Salvar anotação</button></div></form>
<div class="card stack"><h3>Progresso e carteira</h3><p>Módulos concluídos: <b class="num">${prog}/${TOTAL_MODS()}</b> · XP <b class="num">${Math.round(D.progresso&&D.progresso.xp||0)}</b></p>${cartHTML}</div><div class="card stack"><h3>Pagamentos</h3>${pags}</div><div class="card stack"><h3>Mentorias</h3>${mens}</div></div>`;
}
function adminPagamentos(){
  const L2=AD.sols||[];
  if(!L2.length)return `<div class="card"><p class="muted">Nenhum pagamento aguardando confirmação.</p></div>`;
  return `<div class="stack"><p class="muted">Confira o Pix recebido no seu banco e confirme. O aluno é liberado na hora.</p>${L2.map(s=>{const w=waLink(s.whatsapp,`Olá, ${s.nome||''}! Recebi seu aviso de pagamento do plano ${PLANOS[s.plano-1].nome}.`);return `<div class="card stack"><div class="row" style="justify-content:space-between"><div><b>${esc(s.nome||s.email)}</b><div class="muted">${esc(s.email)}</div></div><span class="tag gold">Plano ${PLANOS[s.plano-1].nome} · ${BRL(preco(s.plano))}</span></div><p class="muted">Avisou em ${dmy(String(s.criado_em).slice(0,10))}${s.nota?` · "${esc(s.nota)}"`:''}</p><div class="row"><button class="btn primary sm" data-act="admrapido" data-id="${esc(s.user_id)}:${s.plano}">Confirmar ${BRL(preco(s.plano))} · 30 dias</button><button class="btn sm" data-act="admabrir" data-id="${esc(s.user_id)}">Abrir aluno</button><button class="btn sm ghost" data-act="admrecusar" data-id="${esc(s.id)}">Recusar</button>${w?`<a class="btn sm" href="${esc(w)}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div></div>`;}).join('')}</div>`;
}
function adminMentorias(){
  const M=AD.mens||[];
  if(!M.length)return `<div class="card"><p class="muted">Ainda não há pedidos de mentoria.</p></div>`;
  return `<div class="stack">${M.map(m=>`<details class="card" ${m.status==='pedida'?'open':''}><summary>${esc(m.nome||m.email)} · ${esc(nomeMes(m.mes))} <span class="tag ${m.status==='realizada'?'ok':m.status==='cancelada'?'bad':'gold'}">${esc(m.status)}</span></summary><form class="stack" data-form="admmen" data-id="${esc(m.id)}"><p class="muted">Preferência: ${esc(m.preferencia||'—')} · Assunto: ${esc(m.assunto||'—')}</p><div class="fields"><div class="field"><label for="mm-st-${esc(m.id)}">Situação</label><select id="mm-st-${esc(m.id)}">${['pedida','agendada','realizada','cancelada'].map(s=>`<option value="${s}" ${m.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label for="mm-dt-${esc(m.id)}">Data e hora</label><input id="mm-dt-${esc(m.id)}" type="datetime-local" value="${esc(paraInputDT(m.data_hora))}"></div></div><div class="field"><label for="mm-lk-${esc(m.id)}">Link da reunião</label><input id="mm-lk-${esc(m.id)}" type="url" maxlength="300" value="${esc(m.link)}" placeholder="https://"></div><div class="field"><label for="mm-rs-${esc(m.id)}">Resumo da conversa (o aluno vê)</label><textarea id="mm-rs-${esc(m.id)}" rows="3" maxlength="4000">${esc(m.resumo)}</textarea></div><div class="field"><label for="mm-es-${esc(m.id)}">Estratégia de longo prazo (o aluno vê)</label><textarea id="mm-es-${esc(m.id)}" rows="4" maxlength="6000">${esc(m.estrategia)}</textarea></div><div class="row"><button class="btn primary sm" type="submit">Salvar</button><button class="btn sm" type="button" data-act="admabrir" data-id="${esc(m.user_id)}">Abrir aluno</button></div></form></details>`).join('')}</div>`;
}
function adminDicas(){
  const ed=AD.edDica,D=AD.dicas||[];
  const form=`<form class="card stack" data-form="admdica" data-id="${ed&&ed.id?esc(ed.id):''}"><h3>${ed&&ed.id?'Editar dica':'Nova dica'}</h3><div class="fields"><div class="field" style="grid-column:1/-1"><label for="dd-t">Título</label><input id="dd-t" type="text" maxlength="140" value="${esc(ed?ed.titulo:'')}"></div><div class="field"><label for="dd-c">Categoria</label><input id="dd-c" type="text" maxlength="40" list="dd-cats" value="${esc(ed?ed.categoria:'Geral')}"><datalist id="dd-cats">${['Começando','Análise','Carteira','Comportamento','Impostos'].map(c=>`<option value="${c}">`).join('')}</datalist></div></div><div class="field"><label for="dd-b">Texto (separe parágrafos com uma linha em branco)</label><textarea id="dd-b" rows="6" maxlength="8000">${esc(ed?ed.corpo:'')}</textarea></div><div class="row"><label class="ckrow" style="min-height:44px"><input id="dd-p" type="checkbox" ${!ed||ed.publicada?'checked':''}><span>Publicada</span></label><label class="ckrow" style="min-height:44px"><input id="dd-d" type="checkbox" ${ed&&ed.destaque?'checked':''}><span>Destaque</span></label></div><div class="row"><button class="btn primary" type="submit">${ed&&ed.id?'Salvar dica':'Publicar dica'}</button>${ed?`<button class="btn" type="button" data-act="admdicanova">Cancelar</button>`:''}</div></form>`;
  const lista=D.map(d=>`<div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><b>${esc(d.titulo)}</b><span class="row" style="gap:6px"><span class="tag">${esc(d.categoria)}</span><span class="tag ${d.publicada?'ok':'gold'}">${d.publicada?'Publicada':'Rascunho'}</span></span></div><div class="row"><button class="btn sm" data-act="admdicaed" data-id="${esc(d.id)}">Editar</button><button class="btn sm ghost" data-act="admdicadel" data-id="${esc(d.id)}">Excluir</button></div></div>`).join('');
  return `<div class="stack">${form}<div class="stack" style="gap:8px">${lista||'<div class="card"><p class="muted">Nenhuma dica ainda.</p></div>'}</div></div>`;
}
function adminConfig(){
  const c=CFG||{};
  return `<form class="card stack" data-form="admcfg"><h3>Pagamento e preços</h3><div class="fields"><div class="field" style="grid-column:1/-1"><label for="cf-pix">Chave Pix</label><input id="cf-pix" type="text" maxlength="140" value="${esc(c.pix_chave||'')}"></div><div class="field"><label for="cf-fav">Nome do favorecido</label><input id="cf-fav" type="text" maxlength="120" value="${esc(c.pix_favorecido||'')}"></div><div class="field"><label for="cf-wa">Seu WhatsApp</label><input id="cf-wa" type="tel" maxlength="30" value="${esc(c.whatsapp||'')}"></div><div class="field"><label for="cf-tol">Dias de tolerância após o vencimento</label><input id="cf-tol" type="number" min="0" max="30" step="1" value="${esc(c.tolerancia_dias==null?3:c.tolerancia_dias)}"></div></div><div class="fields">${PLANOS.map(p=>`<div class="field"><label for="cf-p${p.id}">Preço do plano ${p.nome} (R$)</label><input id="cf-p${p.id}" type="number" min="1" step="0.01" inputmode="decimal" value="${preco(p.id)}"></div>`).join('')}</div><p class="muted">Durante a tolerância o aluno ainda tem acesso. Depois dela, o conteúdo é bloqueado até a renovação.</p><div class="row"><button class="btn primary" type="submit">Salvar configurações</button></div></form>`;
}
function adminHTML(){
  if(AD.err)return `<div class="card stack"><h2>Não foi possível carregar o painel</h2><p class="why bad">${esc(AD.err)}</p><div class="row"><button class="btn primary" data-act="admrecarregar">Tentar de novo</button></div></div>`;
  if(AD.loading||!AD.alunos)return `<div class="card"><p class="muted">Carregando painel…</p></div>`;
  classificar();
  const subs=[['resumo','Resumo'],['alunos','Alunos'],['pagamentos','Pagamentos'+(AD.sols&&AD.sols.length?' ('+AD.sols.length+')':'')],['mentorias','Mentorias'+(AD.mens&&AD.mens.filter(m=>m.status==='pedida').length?' ('+AD.mens.filter(m=>m.status==='pedida').length+')':'')],['dicas','Dicas'],['config','Configurações']];
  const seg=`<div class="seg">${subs.map(([k,t])=>`<button class="${AD.sub===k?'on':''}" data-act="admsub" data-id="${k}">${t}</button>`).join('')}</div>`;
  const corpo=AD.sub==='alunos'?adminAlunos():AD.sub==='pagamentos'?adminPagamentos():AD.sub==='mentorias'?adminMentorias():AD.sub==='dicas'?adminDicas():AD.sub==='config'?adminConfig():adminResumo();
  return `<section class="stack"><div class="row" style="justify-content:space-between"><div><p class="eyebrow">Administração</p><h2>Alunos e assinaturas</h2></div><button class="btn sm" data-act="admrecarregar">Atualizar</button></div>${seg}${corpo}</section>`;
}
function csvAlunos(){
  const cel=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const linhas=[['Nome','E-mail','WhatsApp','Plano','Situação','Vencimento','Módulos concluídos'].map(cel).join(';')].concat(AD.alunos.map(a=>[a.nome,a.email,a.whatsapp,a.plano?PLANOS[a.plano-1].nome:'',a.sit.t,a.vence_em||'',a.modulos].map(cel).join(';')));
  return '﻿'+linhas.join('\r\n');
}

/* ---------- roteador ---------- */
function banner(){return UI.msg?`<div class="event" role="status"><p>${esc(UI.msg)}</p></div>`:'';}
function render(){
  const logged=AUTH.st==='in';
  const tabs=$('#tabs'),xp=$('#xp'),who=$('#who');
  tabs.hidden=!logged;xp.hidden=!logged||isAdmin();who.hidden=!logged;
  if(!logged){$('#view').innerHTML=authHTML();return;}
  const ordem=(isAdmin()?['admin']:[]).concat(TABORDER.filter(t=>!(isAdmin()&&t==='mentoria')));
  const v=curTab();
  tabs.innerHTML=ordem.map(t=>`<button class="tab ${t===v?'on':''}" data-act="tab" data-id="${t}" ${t===v?'aria-current="page"':''}>${podeAbrir(t)?'':IC.lock}${TABNAME[t]}</button>`).join('');
  const cur=tabs.querySelector('.tab.on');if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest',inline:'nearest'});
  if(!isAdmin())renderHead();
  who.innerHTML=`<span class="muted who-n">${esc((ME.perfil&&ME.perfil.nome)||'')}</span><button class="btn sm ghost" data-act="sair">Sair</button>`;
  const view=$('#view');
  if(v==='admin'){
    if(!isAdmin()){view.innerHTML=lockedHTML('trilha');return;}
    if(!AD.alunos&&!AD.loading&&!AD.err)adminCarregar();
    view.innerHTML=banner()+adminHTML();UI.msg='';return;
  }
  if(!podeAbrir(v)){view.innerHTML=banner()+lockedHTML(v);UI.msg='';return;}
  if(v==='conta'){view.innerHTML=banner()+contaHTML();UI.msg='';return;}
  if(v==='dicas'){
    if(DICAS===null&&!UI.dl){UI.dl=1;BK.dicas().then(d=>{DICAS=d;}).catch(e=>{DICAS=[];UI.msg=msgErro(e);}).then(()=>{UI.dl=0;if(curTab()==='dicas')render();});}
    view.innerHTML=banner()+dicasHTML();UI.msg='';return;
  }
  if(v==='carteira'){view.innerHTML=banner()+carteiraHTML();UI.msg='';return;}
  if(v==='mentoria'){
    if(MEN===null&&!UI.ml){UI.ml=1;BK.minhasMentorias().then(m=>{MEN=m;}).catch(e=>{MEN=[];UI.msg=msgErro(e);}).then(()=>{UI.ml=0;if(curTab()==='mentoria')render();});}
    view.innerHTML=banner()+mentoriaHTML();UI.msg='';return;
  }
  if(!ORDER.length){view.innerHTML=`<div class="card"><p class="muted">Carregando conteúdo…</p></div>`;return;}
  renderCourseView(v);
  if(UI.msg){view.insertAdjacentHTML('afterbegin',banner());UI.msg='';}
}

/* ---------- ações ---------- */
Object.assign(ACT,{
  tab(t){UI.msg='';if(t==='trilha'){openMod=null;L=null;}if(curTab()===t&&location.hash.slice(1)===t){render();window.scrollTo(0,0);}else location.hash=t;},
  modo(m){AUTH.modo=m;AUTH.err='';AUTH.msg='';render();},
  recarregar(){boot();},
  async sair(){try{await syncAgora();await cartAgora();}catch(e){}try{await BK.sair();}catch(e){}ME=null;CFG=null;SOL=[];PAG=[];DICAS=null;MEN=null;CART=null;S=defaults();onSave=null;buildContent({levels:[],terms:[]});openMod=null;L=null;AUTH.st='out';AUTH.modo='entrar';AUTH.err='';AUTH.msg='';UI.plano=0;location.hash='';render();},
  async demo(id){await run(async()=>{await BK.entrarDemo(id);AUTH.st='loading';});await entrar();},
  plano(id){UI.plano=+id;UI.copied=false;render();const el=$('#pix-nota');if(el)el.scrollIntoView({block:'center'});},
  upgrade(id){UI.plano=+id;location.hash='conta';},
  async copiar(t){try{await navigator.clipboard.writeText(t);UI.copied=true;}catch(e){UI.copied=false;UI.msg='Não consegui copiar. Selecione a chave e copie manualmente.';}render();},
  solicitar(){run(async()=>{await BK.solicitar(UI.plano,UI.nota);UI.nota='';SOL=await BK.minhasSolicitacoes();UI.msg='Pedido enviado. Assim que o administrador confirmar o Pix, seu acesso é liberado.';});},
  async atualizar(){UI.msg='';await entrar();if(planoAcesso()>0&&location.hash.slice(1)==='conta')location.hash='trilha';},
  dcat(c){UI.dcat=c;render();},
  cdel(id){CART.pos=CART.pos.filter(p=>p.id!==id);agendarCart();render();},
  admsub(k){AD.sub=k;AD.det=null;AD.detLoading=false;render();},
  admfl(k){AD.fl=k;render();},
  admabrir(id){AD.sub='alunos';abrirAluno(id);},
  admvoltar(){AD.det=null;AD.detId=null;render();},
  admrecarregar(){AD.alunos=null;AD.err='';AD.det=null;adminCarregar();},
  admcsv(){try{const b=new Blob([csvAlunos()],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='alunos-trilha-fii.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}catch(e){UI.msg='Não foi possível baixar o arquivo neste ambiente.';render();}},
  admrapido(v){const [uid,pl]=v.split(':');run(async()=>{const nova=await BK.adminConfirmar({user_id:uid,plano:+pl,valor:preco(+pl),dias:30,forma:'Pix',obs:''});UI.msg='Pagamento confirmado. Acesso até '+dmy(nova)+'.';await recarregarAdmin();});},
  admrecusar(id){const motivo=prompt('Motivo da recusa (o aluno poderá avisar de novo):','Não encontrei o Pix');if(motivo===null)return;run(async()=>{await BK.adminRecusar(id,motivo);UI.msg='Pedido recusado.';await recarregarAdmin();});},
  admdicaed(id){AD.edDica=(AD.dicas||[]).find(d=>d.id===id)||null;render();window.scrollTo(0,0);},
  admdicanova(){AD.edDica=null;render();},
  admdicadel(id){if(!confirm('Excluir esta dica?'))return;run(async()=>{await BK.adminExcluirDica(id);AD.dicas=await BK.adminDicas();DICAS=null;UI.msg='Dica excluída.';});}
});
async function recarregarAdmin(){const id=AD.detId;const [al,so,me]=await Promise.all([BK.adminAlunos(),BK.adminSolicitacoes(),BK.adminMentorias()]);AD.alunos=al;AD.sols=so;AD.mens=me;if(AD.det&&id){const a=AD.alunos.find(x=>x.id===id);const d=await BK.adminAluno(id);AD.det=Object.assign({a},d);}}

/* ---------- eventos de formulário ---------- */
const FORMS={
  async auth(){
    const g=id=>(($('#'+id)||{}).value||'');
    const email=g('a-email').trim(),senha=g('a-senha');
    AUTH.f={nome:g('a-nome').trim(),whatsapp:g('a-wa').trim(),email};AUTH.err='';AUTH.msg='';
    const btn=$('#a-btn');if(btn){btn.disabled=true;btn.textContent='Aguarde…';}
    try{
      if(AUTH.modo==='cadastro'){
        if(!AUTH.f.nome)throw new Error('Informe seu nome.');
        if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Informe um e-mail válido.');
        if(senha.length<6)throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        const r=await BK.cadastrar({email,senha,nome:AUTH.f.nome,whatsapp:AUTH.f.whatsapp});
        if(r.sessao){await entrar();return;}
        AUTH.modo='entrar';AUTH.msg='Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.';
      }else if(AUTH.modo==='recuperar'){
        if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Informe um e-mail válido.');
        await BK.recuperar(email);AUTH.modo='entrar';AUTH.msg='Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.';
      }else if(AUTH.modo==='nova'){
        if(senha.length<6)throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        await BK.novaSenha(senha);AUTH.modo='entrar';await entrar();return;
      }else{
        if(!email||!senha)throw new Error('Informe e-mail e senha.');
        await BK.entrar(email,senha);await entrar();return;
      }
    }catch(e){AUTH.err=msgErro(e);}
    render();
  },
  perfil(){run(async()=>{const nome=$('#p-nome').value.trim(),wa=$('#p-wa').value.trim();if(!nome)throw new Error('Informe seu nome.');await BK.salvarPerfil({nome,whatsapp:wa});ME.perfil=Object.assign({},ME.perfil,{nome,whatsapp:wa});UI.msg='Dados salvos.';});},
  cpos(){
    const t=$('#cp-t').value.trim().toUpperCase(),q=Math.floor(num($('#cp-q').value)),pm=num($('#cp-pm').value),pr=num($('#cp-pr').value),r=num($('#cp-r').value);
    if(!/^[A-Z]{4}\d{2}$/.test(t)){UI.msg='Use o código com 4 letras e 2 números, como XPTO11.';render();return;}
    if(q<1||pm<=0){UI.msg='Informe a quantidade de cotas e o preço médio.';render();return;}
    if(CART.pos.length>=40){UI.msg='Limite de 40 fundos por carteira.';render();return;}
    const ex=CART.pos.find(p=>p.t===t);
    if(ex){const nq=ex.q+q;ex.pm=+((ex.q*ex.pm+q*pm)/nq).toFixed(4);ex.q=nq;if(pr>0)ex.preco=pr;if(r>0)ex.rend=r;UI.msg=t+' já estava na carteira: somei as cotas e recalculei o preço médio.';}
    else CART.pos.push({id:'p'+Date.now().toString(36)+Math.floor(Math.random()*1e3),t,tipo:$('#cp-tipo').value,q,pm,preco:pr>0?pr:pm,rend:r,alvo:0});
    agendarCart();render();
  },
  pedmen(){run(async()=>{const pref=$('#m-pref').value.trim(),ass=$('#m-ass').value.trim();await BK.pedirMentoria({mes:hoje().slice(0,7),preferencia:pref,assunto:ass});MEN=await BK.minhasMentorias();UI.msg='Pedido enviado. O mentor vai propor um horário.';});},
  admpag(f){run(async()=>{const nova=await BK.adminConfirmar({user_id:f.dataset.id,plano:+$('#ap-plano').value,valor:num($('#ap-valor').value),dias:Math.floor(num($('#ap-dias').value))||30,forma:'Pix',obs:$('#ap-obs').value.trim()});UI.msg='Pagamento confirmado. Acesso até '+dmy(nova)+'.';await recarregarAdmin();});},
  admaj(f){run(async()=>{const v=$('#aj-vence').value;if(!parseISO(v))throw new Error('Informe um vencimento válido.');await BK.adminAjustarAssinatura({user_id:f.dataset.id,plano:+$('#aj-plano').value,status:$('#aj-status').value,vence_em:v});UI.msg='Assinatura atualizada.';await recarregarAdmin();});},
  admnota(f){run(async()=>{await BK.adminNota(f.dataset.id,$('#an-texto').value);UI.msg='Anotação salva.';await recarregarAdmin();});},
  admmen(f){const id=f.dataset.id;run(async()=>{await BK.adminSalvarMentoria(id,{status:$('#mm-st-'+id).value,data_hora:deInputDT($('#mm-dt-'+id).value),link:$('#mm-lk-'+id).value.trim(),resumo:$('#mm-rs-'+id).value,estrategia:$('#mm-es-'+id).value});UI.msg='Mentoria salva.';AD.mens=await BK.adminMentorias();});},
  admdica(f){run(async()=>{const titulo=$('#dd-t').value.trim();if(!titulo)throw new Error('Informe o título da dica.');await BK.adminSalvarDica({id:f.dataset.id||null,titulo,categoria:$('#dd-c').value.trim()||'Geral',corpo:$('#dd-b').value,publicada:$('#dd-p').checked,destaque:$('#dd-d').checked});AD.edDica=null;AD.dicas=await BK.adminDicas();DICAS=null;UI.msg='Dica salva.';});},
  admcfg(){run(async()=>{const c={pix_chave:$('#cf-pix').value.trim(),pix_favorecido:$('#cf-fav').value.trim(),whatsapp:$('#cf-wa').value.trim(),tolerancia_dias:Math.max(0,Math.min(30,Math.floor(num($('#cf-tol').value)))),preco1:num($('#cf-p1').value),preco2:num($('#cf-p2').value),preco3:num($('#cf-p3').value)};if(c.preco1<=0||c.preco2<=0||c.preco3<=0)throw new Error('Informe um preço maior que zero para cada plano.');await BK.adminSalvarConfig(c);CFG=Object.assign({},CFG,c);UI.msg='Configurações salvas.';});}
};
view.addEventListener('submit',e=>{const fm=e.target.dataset&&e.target.dataset.form;if(fm&&FORMS[fm]){e.preventDefault();FORMS[fm](e.target);}});
view.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.cp){
    const [id,k]=t.dataset.cp.split(':'),p=CART.pos.find(x=>x.id===id);
    if(p){const v=Math.max(0,num(t.value));p[k]=k==='q'?Math.floor(v):v;agendarCart();render();}
  }
  if(t.dataset&&t.dataset.cc){const v=num(t.value);if(t.dataset.cc==='aporte')CART.aporte=Math.max(0,v);else CART.limite=Math.max(1,Math.min(100,v||25));agendarCart();render();}
  if(t.dataset&&t.dataset.adpl){AD.pl=t.value;render();}
  if(t.id==='ap-plano'){const v=$('#ap-valor');if(v)v.value=preco(+t.value);}
});
view.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='pix-nota')UI.nota=t.value;
  if(t.dataset&&t.dataset.adq){AD.q=t.value;render();refocus('ad-q');}
});
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&ACT[b.dataset.act])ACT[b.dataset.act](b.dataset.id);});
$('#who').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&ACT[b.dataset.act])ACT[b.dataset.act](b.dataset.id);});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
boot();


})();
