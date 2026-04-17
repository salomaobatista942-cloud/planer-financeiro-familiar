import { useState, useEffect, useContext, createContext, useReducer, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';

// ===================== CONSTANTS =====================
const MONTHS=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_F=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATS_EXP=['Alimentação','Casa','Transporte','Saúde','Educação','Streaming','Tecnologia','Comunicação','Trabalho','Pet','Religião','Restaurante','Presentes','Vestuário','Compromissos','Pessoal','Outros'];
const CATS_INC=['Salário','Freelance','Bônus','Investimentos','Outra Fonte','Renda Extra'];
const PAY_METHODS=['pix','credit','debit','boleto','cash'];
const PAY_LABELS={pix:'Pix',credit:'Crédito',debit:'Débito',boleto:'Boleto',cash:'Dinheiro'};
const GROUPS=['necessidades','desejos','futuro'];
const CAT_COLORS=['#FF3F5B','#4C7BFD','#00D26A','#F5A623','#9B72F6','#20C4F4','#FF7A00','#E86FD8','#52CC83','#F5D020','#FF6B6B','#74B9FF','#A8E063','#FD79A8','#6C5CE7','#FDCB6E','#00CEC9'];

// ===================== DOMAIN (PURE) =====================
const toCents=v=>Math.round(parseFloat(v)*100)||0;
const fromCents=c=>c/100;
const fmt=c=>{
  const s=(Math.abs(c)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  return `R$ ${s}`;
};
const fmtSigned=c=>{
  const sign=c<0?'−':'+';
  return `${sign} ${fmt(Math.abs(c))}`;
};
const fmtPct=v=>`${Math.abs(v).toFixed(1)}%`;
const uuid=()=>`${Date.now().toString(36)}-${Math.random().toString(36).substr(2,7)}`;
const todayISO=()=>new Date().toISOString().split('T')[0];
const dateToMonthYear=d=>{const p=d.split('-');return{month:parseInt(p[1]),year:parseInt(p[0])}};

const filterMonth=(txns,m,y)=>txns.filter(t=>t.month===m&&t.year===y);
const filterType=(txns,tp)=>txns.filter(t=>t.type===tp);
const sumAmts=txns=>txns.reduce((s,t)=>s+t.amount,0);
const savingsRate=(inc,exp)=>inc===0?0:((inc-exp)/inc*100);

const groupByCat=txns=>{
  const acc={};
  txns.forEach(t=>{acc[t.category]=(acc[t.category]||0)+t.amount;});
  return Object.entries(acc).sort(([,a],[,b])=>b-a).map(([cat,amt])=>({cat,amt}));
};

const groupsByType=txns=>{
  const acc={necessidades:0,desejos:0,futuro:0};
  txns.forEach(t=>{if(acc[t.group]!==undefined)acc[t.group]+=t.amount;});
  return acc;
};

const getMonthlyTotals=(txns,year)=>
  Array.from({length:12},(_,i)=>{
    const m=filterMonth(txns,i+1,year);
    const inc=sumAmts(filterType(m,'income'));
    const exp=sumAmts(filterType(m,'expense'));
    return{month:i+1,label:MONTHS[i],inc,exp,net:inc-exp};
  });

const linReg=data=>{
  const n=data.length;
  if(n<2)return{slope:0,intercept:data[0]||0};
  const sx=data.reduce((_,__,i)=>_+i,0),sy=data.reduce((a,b)=>a+b,0);
  const sxy=data.reduce((a,v,i)=>a+i*v,0),sx2=data.reduce((a,_,i)=>a+i*i,0);
  const slope=(n*sxy-sx*sy)/(n*sx2-sx*sx||1);
  return{slope,intercept:(sy-slope*sx)/n};
};

const buildProjection=(monthlyTotals,months)=>{
  const active=monthlyTotals.filter(m=>m.inc>0);
  if(!active.length)return[];
  const nets=active.map(m=>m.net);
  const {slope,intercept}=linReg(nets);
  const avgNet=nets.reduce((a,b)=>a+b,0)/nets.length;
  let cum=0;
  return Array.from({length:months},(_,i)=>{
    const proj=intercept+slope*(nets.length+i);
    cum+=avgNet;
    return{i:i+1,proj,cumulative:cum};
  });
};

const buildCalGrid=(year,month)=>{
  const fd=new Date(year,month-1,1).getDay();
  const days=new Date(year,month,0).getDate();
  return[...Array(fd).fill(null),...Array.from({length:days},(_,i)=>i+1)];
};

// ===================== SEED DATA =====================
const mkExp=(d,month,year)=>({...d,id:uuid(),type:'expense',month,year});
const mkInc=(d,month,year)=>({...d,id:uuid(),type:'income',month,year});

const SEED=()=>{
  const mar_fixed=[
    {description:'Seguro Carro',amount:toCents(128),category:'Transporte',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'boleto',date:'2026-03-05'},
    {description:'Caern (Água)',amount:toCents(99),category:'Casa',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'boleto',date:'2026-03-10'},
    {description:'Internet',amount:toCents(102.28),category:'Casa',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'boleto',date:'2026-03-15'},
    {description:'Tim (Telefone)',amount:toCents(54),category:'Comunicação',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'boleto',date:'2026-03-05'},
    {description:'MEI',amount:toCents(174.10),category:'Trabalho',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'pix',date:'2026-03-20'},
    {description:'Growth (Curso)',amount:toCents(68.77),category:'Educação',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-01'},
    {description:'Veterinário 3/5',amount:toCents(148),category:'Pet',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-12'},
    {description:'Computador',amount:toCents(189.18),category:'Tecnologia',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-01'},
    {description:'Alianças',amount:toCents(245),category:'Compromissos',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-01'},
    {description:'Academia',amount:toCents(120),category:'Saúde',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'pix',date:'2026-03-05'},
    {description:'Água Mineral',amount:toCents(25.50),category:'Casa',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'cash',date:'2026-03-08'},
    {description:'Colchão',amount:toCents(191.37),category:'Casa',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-01'},
    {description:'Roupas Shopping',amount:toCents(156.66),category:'Vestuário',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-15'},
  ];
  const mar_var=[
    {description:'Energia',amount:toCents(49.63),category:'Casa',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'boleto',date:'2026-03-20'},
    {description:'Mercado',amount:toCents(972.63),category:'Alimentação',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'credit',date:'2026-03-15'},
    {description:'Combustível',amount:toCents(110),category:'Transporte',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'pix',date:'2026-03-10'},
    {description:'Plano Saúde',amount:toCents(449.43),category:'Saúde',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'boleto',date:'2026-03-05'},
    {description:'Dízimo',amount:toCents(499),category:'Religião',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'pix',date:'2026-03-01'},
    {description:'Plano Saúde Novo',amount:toCents(335.41),category:'Saúde',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'boleto',date:'2026-03-05'},
    {description:'Ultrassonografias',amount:toCents(500),category:'Saúde',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'credit',date:'2026-03-18'},
    {description:'Detran',amount:toCents(91.44),category:'Transporte',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'boleto',date:'2026-03-22'},
    {description:'Corpo Bombeiros',amount:toCents(25),category:'Casa',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'boleto',date:'2026-03-25'},
    {description:'Uber',amount:toCents(34.25),category:'Transporte',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'credit',date:'2026-03-20'},
    {description:'Gás',amount:toCents(110),category:'Casa',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-12'},
  ];
  const mar_des=[
    {description:'Amazon Prime',amount:toCents(3.98),category:'Streaming',group:'desejos',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-15'},
    {description:'Crunchroll',amount:toCents(6.25),category:'Streaming',group:'desejos',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-15'},
    {description:'One Drive',amount:toCents(12),category:'Tecnologia',group:'desejos',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-15'},
    {description:'Spotify',amount:toCents(6.82),category:'Streaming',group:'desejos',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:'2026-03-15'},
    {description:'Presente Sara',amount:toCents(68),category:'Presentes',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'pix',date:'2026-03-10'},
    {description:'Pasta Coral',amount:toCents(26.05),category:'Outros',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'pix',date:'2026-03-14'},
    {description:'Cookie',amount:toCents(8),category:'Alimentação',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-16'},
    {description:'Presente Amanda',amount:toCents(65),category:'Presentes',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'pix',date:'2026-03-20'},
    {description:'Doce Shopping',amount:toCents(26.46),category:'Alimentação',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-08'},
    {description:'Almoço Shopping',amount:toCents(41.90),category:'Restaurante',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'credit',date:'2026-03-08'},
    {description:'Esposa',amount:toCents(100),category:'Pessoal',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'pix',date:'2026-03-01'},
    {description:'Quitanda Rosa',amount:toCents(27.90),category:'Alimentação',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-22'},
    {description:'Santo Doce',amount:toCents(28),category:'Alimentação',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-25'},
    {description:'Presente Pastor',amount:toCents(10),category:'Presentes',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'pix',date:'2026-03-30'},
    {description:'Estacionamento',amount:toCents(11),category:'Transporte',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-08'},
    {description:'Bom Doce',amount:toCents(38),category:'Alimentação',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-12'},
    {description:'Companhia Churrasco',amount:toCents(26.90),category:'Restaurante',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-15'},
    {description:'Super Duper',amount:toCents(20),category:'Restaurante',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'cash',date:'2026-03-20'},
    {description:'Restaurante',amount:toCents(33.45),category:'Restaurante',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'credit',date:'2026-03-22'},
    {description:'iFood',amount:toCents(70.67),category:'Restaurante',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'credit',date:'2026-03-25'},
    {description:'Curso Sarah',amount:toCents(49),category:'Educação',group:'futuro',subcategory:'fixed',status:'paid',paymentMethod:'pix',date:'2026-03-01'},
  ];
  const apr_fixed=[
    {description:'Seguro Carro',amount:toCents(128),category:'Transporte',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'boleto',date:'2026-04-05'},
    {description:'Caern (Água)',amount:toCents(99),category:'Casa',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'boleto',date:'2026-04-10'},
    {description:'Internet',amount:toCents(102.28),category:'Casa',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'boleto',date:'2026-04-15'},
    {description:'Tim (Telefone)',amount:toCents(54),category:'Comunicação',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'boleto',date:'2026-04-05'},
    {description:'MEI',amount:toCents(174.10),category:'Trabalho',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'pix',date:'2026-04-20'},
    {description:'Growth (Curso)',amount:toCents(68.77),category:'Educação',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'credit',date:'2026-04-01'},
    {description:'Veterinário 4/5',amount:toCents(148),category:'Pet',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'credit',date:'2026-04-12'},
    {description:'Computador',amount:toCents(189.18),category:'Tecnologia',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'credit',date:'2026-04-01'},
    {description:'Alianças',amount:toCents(245),category:'Compromissos',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'credit',date:'2026-04-01'},
    {description:'Academia',amount:toCents(120),category:'Saúde',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'pix',date:'2026-04-05'},
    {description:'Água Mineral',amount:toCents(25.50),category:'Casa',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'cash',date:'2026-04-08'},
    {description:'Colchão',amount:toCents(191.37),category:'Casa',group:'necessidades',subcategory:'fixed',status:'pending',paymentMethod:'credit',date:'2026-04-01'},
    {description:'Amazon Prime',amount:toCents(3.98),category:'Streaming',group:'desejos',subcategory:'fixed',status:'pending',paymentMethod:'credit',date:'2026-04-15'},
    {description:'Spotify',amount:toCents(6.82),category:'Streaming',group:'desejos',subcategory:'fixed',status:'pending',paymentMethod:'credit',date:'2026-04-15'},
    {description:'Curso Sarah',amount:toCents(49),category:'Educação',group:'futuro',subcategory:'fixed',status:'pending',paymentMethod:'pix',date:'2026-04-01'},
  ];
  const mkHist=(month,year,factor)=>[
    {description:'Seguro Carro',amount:toCents(128*factor),category:'Transporte',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'boleto',date:`${year}-${String(month).padStart(2,'0')}-05`},
    {description:'Internet',amount:toCents(102.28),category:'Casa',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'boleto',date:`${year}-${String(month).padStart(2,'0')}-15`},
    {description:'Tim',amount:toCents(54),category:'Comunicação',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'boleto',date:`${year}-${String(month).padStart(2,'0')}-05`},
    {description:'MEI',amount:toCents(174.10),category:'Trabalho',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'pix',date:`${year}-${String(month).padStart(2,'0')}-20`},
    {description:'Academia',amount:toCents(120),category:'Saúde',group:'necessidades',subcategory:'fixed',status:'paid',paymentMethod:'pix',date:`${year}-${String(month).padStart(2,'0')}-05`},
    {description:'Mercado',amount:toCents(880*factor),category:'Alimentação',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'credit',date:`${year}-${String(month).padStart(2,'0')}-15`},
    {description:'Combustível',amount:toCents(100),category:'Transporte',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'pix',date:`${year}-${String(month).padStart(2,'0')}-10`},
    {description:'Plano Saúde',amount:toCents(449.43),category:'Saúde',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'boleto',date:`${year}-${String(month).padStart(2,'0')}-05`},
    {description:'Dízimo',amount:toCents(380*factor),category:'Religião',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'pix',date:`${year}-${String(month).padStart(2,'0')}-01`},
    {description:'Energia',amount:toCents(55*factor),category:'Casa',group:'necessidades',subcategory:'variable',status:'paid',paymentMethod:'boleto',date:`${year}-${String(month).padStart(2,'0')}-20`},
    {description:'Spotify',amount:toCents(6.82),category:'Streaming',group:'desejos',subcategory:'fixed',status:'paid',paymentMethod:'credit',date:`${year}-${String(month).padStart(2,'0')}-15`},
    {description:'iFood',amount:toCents(55*factor),category:'Restaurante',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'credit',date:`${year}-${String(month).padStart(2,'0')}-20`},
    {description:'Restaurante',amount:toCents(80*factor),category:'Restaurante',group:'desejos',subcategory:'variable',status:'paid',paymentMethod:'credit',date:`${year}-${String(month).padStart(2,'0')}-22`},
  ].map(e=>({...e,id:uuid(),type:'expense',month,year}));

  const income=[
    mkInc({description:'Renda Fixa',amount:toCents(2300),category:'Salário',status:'received',date:'2026-03-05'},3,2026),
    mkInc({description:'Renda Variável',amount:toCents(1200),category:'Freelance',status:'received',date:'2026-03-10'},3,2026),
    mkInc({description:'Bônus/Pai Salomão',amount:toCents(350),category:'Bônus',status:'received',date:'2026-03-15'},3,2026),
    mkInc({description:'Renda Fixa',amount:toCents(2300),category:'Salário',status:'pending',date:'2026-04-05'},4,2026),
    mkInc({description:'Renda Variável',amount:toCents(1200),category:'Freelance',status:'pending',date:'2026-04-10'},4,2026),
    mkInc({description:'Renda Fixa',amount:toCents(2300),category:'Salário',status:'received',date:'2026-01-05'},1,2026),
    mkInc({description:'Renda Variável',amount:toCents(800),category:'Freelance',status:'received',date:'2026-01-10'},1,2026),
    mkInc({description:'Renda Fixa',amount:toCents(2300),category:'Salário',status:'received',date:'2026-02-05'},2,2026),
    mkInc({description:'Renda Variável',amount:toCents(950),category:'Freelance',status:'received',date:'2026-02-10'},2,2026),
  ];

  return[
    ...[...mar_fixed,...mar_var,...mar_des].map(e=>mkExp(e,3,2026)),
    ...apr_fixed.map(e=>mkExp(e,4,2026)),
    ...mkHist(1,2026,0.88),
    ...mkHist(2,2026,0.93),
    ...income
  ];
};

// ===================== STATE =====================
const FinCtx=createContext(null);
const INIT_STATE={transactions:[],view:'dashboard',month:4,year:2026};

function reducer(state,action){
  switch(action.type){
    case'SET_TXN':return{...state,transactions:action.payload};
    case'ADD_TXN':return{...state,transactions:[...state.transactions,action.payload]};
    case'UPD_TXN':return{...state,transactions:state.transactions.map(t=>t.id===action.payload.id?action.payload:t)};
    case'DEL_TXN':return{...state,transactions:state.transactions.filter(t=>t.id!==action.id)};
    case'SET_VIEW':return{...state,view:action.payload};
    case'SET_MONTH':return{...state,month:action.month,year:action.year};
    default:return state;
  }
}

function FinProvider({children}){
  const[state,dispatch]=useReducer(reducer,INIT_STATE);
  useEffect(()=>{
    try{
      const saved=localStorage.getItem('fin_txns_v2');
      if(saved){dispatch({type:'SET_TXN',payload:JSON.parse(saved)});}
      else{dispatch({type:'SET_TXN',payload:SEED()});}
    }catch{dispatch({type:'SET_TXN',payload:SEED()});}
  },[]);
  useEffect(()=>{
    if(state.transactions.length>0)
      localStorage.setItem('fin_txns_v2',JSON.stringify(state.transactions));
  },[state.transactions]);
  return <FinCtx.Provider value={{state,dispatch}}>{children}</FinCtx.Provider>;
}
const useFin=()=>useContext(FinCtx);

// ===================== SVG CHARTS =====================
function DonutChart({data,total,size=180}){
  if(!data.length)return<div style={{textAlign:'center',color:'var(--t3)',padding:40}}>Sem dados</div>;
  const r=60,cx=size/2,cy=size/2,stroke=20;
  let acc=0;
  const slices=data.slice(0,10).map((d,i)=>{
    const pct=d.amt/total;
    const start=acc*2*Math.PI-Math.PI/2;
    acc+=pct;
    const end=acc*2*Math.PI-Math.PI/2;
    const lg=end-start>Math.PI?1:0;
    const x1=cx+r*Math.cos(start),y1=cy+r*Math.sin(start);
    const x2=cx+r*Math.cos(end),y2=cy+r*Math.sin(end);
    return{...d,path:`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`,color:CAT_COLORS[i%CAT_COLORS.length]};
  });
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="var(--s2)"/>
      {slices.map((s,i)=>(
        <path key={i} d={s.path} fill={s.color} opacity={.9}>
          <title>{s.cat}: {fmt(s.amt)}</title>
        </path>
      ))}
      <circle cx={cx} cy={cy} r={r-stroke} fill="var(--s1)"/>
    </svg>
  );
}

function LineChart({data,width=500,height=160}){
  if(!data.length||data.every(d=>d.inc===0&&d.exp===0))
    return<div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--t3)'}}>Sem dados</div>;
  const pad={t:16,b:32,l:56,r:16};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const vals=[...data.flatMap(d=>[d.inc,d.exp])].filter(v=>v>0);
  const maxV=Math.max(...vals)||1;
  const scX=i=>pad.l+i*(W/(data.length-1||1));
  const scY=v=>pad.t+H-(v/maxV)*H;
  const pathOf=key=>{
    const pts=data.map((d,i)=>`${scX(i)},${scY(d[key])}`);
    return`M ${pts.join(' L ')}`;
  };
  return(
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {[0,.25,.5,.75,1].map(t=>(
        <line key={t} x1={pad.l} x2={width-pad.r} y1={pad.t+H*(1-t)} y2={pad.t+H*(1-t)} stroke="var(--bd)" strokeWidth=".5"/>
      ))}
      {data.map((d,i)=>(
        <text key={i} x={scX(i)} y={height-6} textAnchor="middle" fill="var(--t3)" fontSize="10">{d.label}</text>
      ))}
      {[0,.25,.5,.75,1].map((t,i)=>(
        <text key={i} x={pad.l-6} y={pad.t+H*(1-t)+4} textAnchor="end" fill="var(--t3)" fontSize="9">
          {(maxV*t/100).toFixed(0)}k
        </text>
      ))}
      <path d={pathOf('inc')} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={pathOf('exp')} fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((d,i)=>[
        <circle key={`i${i}`} cx={scX(i)} cy={scY(d.inc)} r="3" fill="var(--green)" opacity={d.inc>0?.9:0}/>,
        <circle key={`e${i}`} cx={scX(i)} cy={scY(d.exp)} r="3" fill="var(--red)" opacity={d.exp>0?.9:0}/>
      ])}
    </svg>
  );
}

function BarChart({data,width=400,height=140}){
  if(!data.length)return null;
  const pad={t:12,b:28,l:10,r:10};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const maxV=Math.max(...data.flatMap(d=>[d.inc,d.exp]))||1;
  const bw=Math.max(4,(W/(data.length*2.5))-2);
  const gap=W/data.length;
  return(
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((d,i)=>{
        const x=pad.l+i*gap+gap/2;
        const hI=(d.inc/maxV)*H,hE=(d.exp/maxV)*H;
        return(
          <g key={i}>
            <rect x={x-bw-1} y={pad.t+H-hI} width={bw} height={hI} fill="var(--green)" rx="2" opacity=".8"/>
            <rect x={x+1} y={pad.t+H-hE} width={bw} height={hE} fill="var(--red)" rx="2" opacity=".8"/>
            <text x={x} y={height-6} textAnchor="middle" fill="var(--t3)" fontSize="9">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ProjectionChart({data,width=500,height=160}){
  if(!data.length)return<div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--t3)'}}>Sem histórico</div>;
  const pad={t:16,b:28,l:48,r:16};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const vals=data.map(d=>d.cumulative);
  const minV=Math.min(...vals),maxV=Math.max(...vals);
  const range=maxV-minV||1;
  const scX=i=>pad.l+i*(W/(data.length-1||1));
  const scY=v=>pad.t+H-((v-minV)/range)*H;
  const pts=data.map((d,i)=>`${scX(i)},${scY(d.cumulative)}`).join(' L ');
  const below=minV<0;
  return(
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={below?'var(--red)':'var(--purple)'} stopOpacity=".3"/>
          <stop offset="100%" stopColor={below?'var(--red)':'var(--purple)'} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0,.25,.5,.75,1].map(t=>(
        <line key={t} x1={pad.l} x2={width-pad.r} y1={pad.t+H*(1-t)} y2={pad.t+H*(1-t)} stroke="var(--bd)" strokeWidth=".5"/>
      ))}
      {data.filter((_,i)=>i%3===0).map((d)=>{const i=data.indexOf(d);return(
        <text key={i} x={scX(i)} y={height-6} textAnchor="middle" fill="var(--t3)" fontSize="9">M{d.i}</text>
      );})}
      <path d={`M ${data.map((d,i)=>`${scX(i)},${scY(d.cumulative)}`).join(' L ')} L ${scX(data.length-1)} ${pad.t+H} L ${pad.l} ${pad.t+H} Z`} fill="url(#projGrad)"/>
      <path d={`M ${pts}`} fill="none" stroke={below?'var(--red)':'var(--purple)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HeatmapChart({txns}){
  const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const weeks=['S1','S2','S3','S4','S5'];
  const grid=Array.from({length:7},()=>Array(5).fill(0));
  txns.forEach(t=>{
    if(t.type!=='expense')return;
    const d=new Date(t.date+'T12:00:00');
    const day=d.getDay();
    const firstDay=new Date(d.getFullYear(),d.getMonth(),1).getDay();
    const week=Math.floor((d.getDate()-1+firstDay)/7);
    if(week<5)grid[day][week]+=t.amount;
  });
  const max=Math.max(...grid.flatMap(r=>r))||1;
  const cellColor=(v)=>{
    if(!v)return'var(--s3)';
    const i=v/max;
    if(i<.2)return'rgba(255,63,91,.15)';
    if(i<.4)return'rgba(255,63,91,.3)';
    if(i<.6)return'rgba(255,63,91,.5)';
    if(i<.8)return'rgba(255,63,91,.7)';
    return'rgba(255,63,91,.95)';
  };
  return(
    <div>
      <div style={{display:'flex',gap:3,marginBottom:4,marginLeft:36}}>
        {weeks.map(w=><div key={w} style={{width:44,textAlign:'center',fontSize:10,color:'var(--t3)'}}>{w}</div>)}
      </div>
      {days.map((day,di)=>(
        <div key={day} style={{display:'flex',alignItems:'center',gap:3,marginBottom:3}}>
          <div style={{width:32,fontSize:10,color:'var(--t3)',textAlign:'right',paddingRight:4}}>{day}</div>
          {weeks.map((_,wi)=>(
            <div key={wi} title={grid[di][wi]?fmt(grid[di][wi]):''} style={{width:44,height:26,borderRadius:3,background:cellColor(grid[di][wi]),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'rgba(255,255,255,.6)',fontFamily:'Space Mono,monospace'}}>
              {grid[di][wi]>0?`${(grid[di][wi]/100).toFixed(0)}`:''}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ===================== UI COMPONENTS =====================
function MonthSelector({month,year,onChange}){
  const prev=()=>{if(month===1)onChange(12,year-1);else onChange(month-1,year);};
  const next=()=>{if(month===12)onChange(1,year+1);else onChange(month+1,year);};
  return(
    <div className="month-sel">
      <button className="month-btn" onClick={prev}>‹</button>
      <div className="month-display">{MONTHS_F[month-1].slice(0,3)} {year}</div>
      <button className="month-btn" onClick={next}>›</button>
    </div>
  );
}

function StatusBadge({status}){
  const map={paid:'Pago',received:'Recebido',pending:'Pendente',overdue:'Vencido'};
  return<span className={`badge ${status}`}>{status==='paid'||status==='received'?'✓ ':status==='pending'?'○ ':'! '}{map[status]||status}</span>;
}

function PayBadge({method}){
  if(!method)return null;
  return<span className={`pay-badge pay-${method}`}>{PAY_LABELS[method]||method}</span>;
}

function GroupBadge({group}){
  const colors={necessidades:'var(--blue)',desejos:'var(--amber)',futuro:'var(--purple)'};
  return<span style={{color:colors[group]||'var(--t2)',fontSize:11,fontWeight:500}}>{group==='necessidades'?'Necessidades':group==='desejos'?'Desejos':'Futuro'}</span>;
}

function TxnModal({txn,type,onSave,onClose}){
  const init=txn||{description:'',amount:'',category:type==='income'?'Salário':'Alimentação',group:'necessidades',subcategory:'variable',status:type==='income'?'received':'pending',paymentMethod:'pix',date:todayISO(),type};
  const[form,setForm]=useState(init);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleDateChange=(v)=>{
    const{month,year}=dateToMonthYear(v);
    setForm(f=>({...f,date:v,month,year}));
  };
  const submit=()=>{
    if(!form.description||!form.amount)return;
    const{month,year}=dateToMonthYear(form.date);
    onSave({...form,id:txn?.id||uuid(),amount:toCents(form.amount),month,year,type:form.type||type});
  };
  return(
    <div className="overlay" onClick={e=>{if(e.target.classList.contains('overlay'))onClose();}}>
      <div className="modal">
        <div className="modal-title">
          <span>{txn?'Editar':'Nova'} {type==='income'?'Entrada':'Saída'}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group">
            <label className="lbl">Descrição *</label>
            <input value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Ex: Aluguel, Salário..."/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="lbl">Valor (R$) *</label>
              <input type="number" step="0.01" value={form.amount===''?'':fromCents(form.amount)||form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0,00"/>
            </div>
            <div className="form-group">
              <label className="lbl">Data</label>
              <input type="date" value={form.date} onChange={e=>handleDateChange(e.target.value)}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="lbl">Categoria</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)}>
                {(type==='income'?CATS_INC:CATS_EXP).map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="lbl">Status</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)}>
                {type==='income'?['received','pending'].map(s=><option key={s} value={s}>{s==='received'?'Recebido':'Pendente'}</option>)
                  :['paid','pending','overdue'].map(s=><option key={s} value={s}>{s==='paid'?'Pago':s==='pending'?'Pendente':'Vencido'}</option>)}
              </select>
            </div>
          </div>
          {type==='expense'&&(
            <div className="form-row">
              <div className="form-group">
                <label className="lbl">Grupo (50/30/20)</label>
                <select value={form.group} onChange={e=>set('group',e.target.value)}>
                  <option value="necessidades">Necessidades (50%)</option>
                  <option value="desejos">Desejos (30%)</option>
                  <option value="futuro">Futuro (20%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="lbl">Tipo</label>
                <select value={form.subcategory} onChange={e=>set('subcategory',e.target.value)}>
                  <option value="fixed">Fixo</option>
                  <option value="variable">Variável</option>
                </select>
              </div>
            </div>
          )}
          {type==='expense'&&(
            <div className="form-group">
              <label className="lbl">Forma de Pagamento</label>
              <select value={form.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)}>
                {PAY_METHODS.map(m=><option key={m} value={m}>{PAY_LABELS[m]}</option>)}
              </select>
            </div>
          )}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={submit}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== DASHBOARD =====================
function Dashboard(){
  const{state}=useFin();
  const{transactions,month,year}=state;
  const monthTxns=filterMonth(transactions,month,year);
  const incTxns=filterType(monthTxns,'income');
  const expTxns=filterType(monthTxns,'expense');
  const inc=sumAmts(incTxns),exp=sumAmts(expTxns),net=inc-exp;
  const sr=savingsRate(inc,exp);
  const monthly=getMonthlyTotals(transactions,year);
  const catData=groupByCat(expTxns);
  const groups=groupsByType(expTxns);
  const pending=filterType(monthTxns,'expense').filter(t=>t.status==='pending'||t.status==='overdue');
  const pendingAmt=sumAmts(pending);

  return(
    <div className="content">
      <div className="cards-row">
        <div className="card green">
          <div className="card-label">↑ Entradas</div>
          <div className="card-value">{fmt(inc)}</div>
          <div className="card-sub">{incTxns.length} recebimentos</div>
        </div>
        <div className="card red">
          <div className="card-label">↓ Saídas</div>
          <div className="card-value">{fmt(exp)}</div>
          <div className="card-sub">{expTxns.length} transações</div>
        </div>
        <div className={`card ${net>=0?'blue':'red'}`}>
          <div className="card-label">= Saldo Líquido</div>
          <div className="card-value">{fmtSigned(net)}</div>
          <div className="card-sub">{net>=0?'Superávit':'Déficit'} no mês</div>
        </div>
        <div className="card amber">
          <div className="card-label">⏳ A Pagar</div>
          <div className="card-value">{fmt(pendingAmt)}</div>
          <div className="card-sub">{pending.length} pendentes</div>
        </div>
      </div>

      {inc>0&&(
        <div className="chart-card">
          <div className="chart-title">Taxa de Poupança</div>
          <div className="chart-sub">{sr>=0?`${fmtPct(sr)} do salário poupado`:`Gastos excedem renda em ${fmtPct(Math.abs(sr))}`}</div>
          <div className="prog-bar"><div className="prog-fill" style={{width:`${Math.min(100,Math.max(0,sr))}%`,background:sr>=20?'var(--green)':sr>=0?'var(--amber)':'var(--red)'}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,color:'var(--t3)'}}>
            <span>Meta: 20%</span><span style={{color:sr>=20?'var(--green)':sr>=10?'var(--amber)':'var(--red)'}}>{sr>=20?'✓ Ótimo':sr>=10?'Razoável':'Melhorar'}</span>
          </div>
        </div>
      )}

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Evolução Anual {year}</div>
          <div className="chart-sub">Entradas vs Saídas mês a mês</div>
          <LineChart data={monthly}/>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{background:'var(--green)'}}/> Entradas</div>
            <div className="legend-item"><div className="legend-dot" style={{background:'var(--red)'}}/> Saídas</div>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Gastos por Categoria</div>
          <div className="chart-sub">{MONTHS_F[month-1]} {year}</div>
          <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
            <DonutChart data={catData} total={exp}/>
            <div style={{flex:1,overflow:'hidden'}}>
              {catData.slice(0,6).map((c,i)=>(
                <div key={c.cat} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                    <span style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:CAT_COLORS[i%CAT_COLORS.length],display:'inline-block'}}/>
                      {c.cat}
                    </span>
                    <span style={{fontFamily:'Space Mono,monospace',fontSize:11,color:'var(--t2)'}}>{fmt(c.amt)}</span>
                  </div>
                  <div className="prog-bar"><div className="prog-fill" style={{width:`${(c.amt/exp*100)||0}%`,background:CAT_COLORS[i%CAT_COLORS.length]}}/></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {exp>0&&(
        <div className="chart-card">
          <div className="chart-title">Regra 50/30/20</div>
          <div className="chart-sub">Necessidades · Desejos · Futuro</div>
          <div className="budget-split">
            {[
              {key:'necessidades',label:'Necessidades',target:50,color:'var(--blue)'},
              {key:'desejos',label:'Desejos',target:30,color:'var(--amber)'},
              {key:'futuro',label:'Futuro / Poupança',target:20,color:'var(--purple)'},
            ].map(g=>{
              const amt=groups[g.key]||0;
              const pct=exp?((amt/exp)*100):0;
              return(
                <div key={g.key} className="budget-item">
                  <div className="budget-cat"><span className="budget-cat-dot" style={{background:g.color}}/>{g.label}</div>
                  <div className="budget-amt" style={{color:g.color}}>{fmt(amt)}</div>
                  <div className="budget-target">{pct.toFixed(1)}% · meta {g.target}%</div>
                  <div className="prog-bar"><div className="prog-fill" style={{width:`${Math.min(100,pct)}%`,background:g.color}}/></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pending.length>0&&(
        <div className="table-wrap">
          <div className="table-header"><div className="table-title">⚠ Pendências do Mês</div></div>
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {pending.map(t=>(
                <tr key={t.id}>
                  <td>{t.description}</td>
                  <td>{t.category}</td>
                  <td>{t.date}</td>
                  <td style={{fontFamily:'Space Mono,monospace',color:'var(--red)'}}>{fmt(t.amount)}</td>
                  <td><StatusBadge status={t.status}/></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="3">Total pendente</td><td colSpan="2" style={{color:'var(--red)'}}>{fmt(pendingAmt)}</td></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== INCOME PAGE =====================
function IncomePage(){
  const{state,dispatch}=useFin();
  const{transactions,month,year}=state;
  const[modal,setModal]=useState(null);
  const[search,setSearch]=useState('');
  const monthTxns=filterMonth(filterType(transactions,'income'),month,year);
  const filtered=monthTxns.filter(t=>t.description.toLowerCase().includes(search.toLowerCase())||t.category.toLowerCase().includes(search.toLowerCase()));
  const total=sumAmts(filtered);
  const received=sumAmts(filtered.filter(t=>t.status==='received'));

  const save=(txn)=>{
    if(txn.id&&transactions.find(t=>t.id===txn.id))dispatch({type:'UPD_TXN',payload:txn});
    else dispatch({type:'ADD_TXN',payload:{...txn,type:'income'}});
    setModal(null);
  };

  return(
    <div className="content">
      <div className="cards-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="card green"><div className="card-label">Total Entradas</div><div className="card-value">{fmt(total)}</div></div>
        <div className="card blue"><div className="card-label">Recebido</div><div className="card-value">{fmt(received)}</div></div>
        <div className="card amber"><div className="card-label">Pendente</div><div className="card-value">{fmt(total-received)}</div></div>
      </div>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Entradas — {MONTHS_F[month-1]} {year}</div>
          <div className="table-controls">
            <input style={{width:180}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <button className="btn btn-primary" onClick={()=>setModal({type:'income'})}>+ Nova Entrada</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan="6" style={{textAlign:'center',color:'var(--t3)',padding:24}}>Nenhuma entrada registrada</td></tr>}
            {filtered.map(t=>(
              <tr key={t.id}>
                <td><b>{t.description}</b></td>
                <td>{t.category}</td>
                <td>{t.date}</td>
                <td><StatusBadge status={t.status}/></td>
                <td style={{fontFamily:'Space Mono,monospace',color:'var(--green)',fontWeight:700}}>{fmt(t.amount)}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn-icon" onClick={()=>setModal({...t,_edit:true})}>✎</button>
                    <button className="btn-icon btn-danger" onClick={()=>{if(confirm('Excluir?'))dispatch({type:'DEL_TXN',id:t.id});}}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length>0&&<tfoot><tr><td colSpan="4">Total</td><td>{fmt(total)}</td><td/></tr></tfoot>}
        </table>
      </div>
      {modal&&<TxnModal txn={modal._edit?modal:null} type={modal.type||'income'} onSave={save} onClose={()=>setModal(null)}/>}
    </div>
  );
}

// ===================== EXPENSES PAGE =====================
function ExpensesPage(){
  const{state,dispatch}=useFin();
  const{transactions,month,year}=state;
  const[modal,setModal]=useState(null);
  const[search,setSearch]=useState('');
  const[filterGrp,setFilterGrp]=useState('all');
  const[filterSub,setFilterSub]=useState('all');
  const monthTxns=filterMonth(filterType(transactions,'expense'),month,year);
  const filtered=monthTxns.filter(t=>{
    const q=search.toLowerCase();
    const matchQ=!q||t.description.toLowerCase().includes(q)||t.category.toLowerCase().includes(q);
    const matchG=filterGrp==='all'||t.group===filterGrp;
    const matchS=filterSub==='all'||t.subcategory===filterSub;
    return matchQ&&matchG&&matchS;
  });
  const total=sumAmts(filtered);
  const paid=sumAmts(filtered.filter(t=>t.status==='paid'));
  const pending=sumAmts(filtered.filter(t=>t.status==='pending'||t.status==='overdue'));

  const save=(txn)=>{
    if(txn.id&&transactions.find(t=>t.id===txn.id))dispatch({type:'UPD_TXN',payload:txn});
    else dispatch({type:'ADD_TXN',payload:{...txn,type:'expense'}});
    setModal(null);
  };

  return(
    <div className="content">
      <div className="cards-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="card red"><div className="card-label">Total Saídas</div><div className="card-value">{fmt(total)}</div></div>
        <div className="card green"><div className="card-label">Pago</div><div className="card-value">{fmt(paid)}</div></div>
        <div className="card amber"><div className="card-label">Pendente</div><div className="card-value">{fmt(pending)}</div></div>
      </div>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Saídas — {MONTHS_F[month-1]} {year}</div>
          <div className="table-controls" style={{flexWrap:'wrap'}}>
            <input style={{width:150}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={{width:130}} value={filterGrp} onChange={e=>setFilterGrp(e.target.value)}>
              <option value="all">Todos grupos</option>
              <option value="necessidades">Necessidades</option>
              <option value="desejos">Desejos</option>
              <option value="futuro">Futuro</option>
            </select>
            <select style={{width:110}} value={filterSub} onChange={e=>setFilterSub(e.target.value)}>
              <option value="all">Fixo/Variável</option>
              <option value="fixed">Fixo</option>
              <option value="variable">Variável</option>
            </select>
            <button className="btn btn-primary" onClick={()=>setModal({type:'expense'})}>+ Nova Saída</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Grupo</th><th>Pagamento</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan="7" style={{textAlign:'center',color:'var(--t3)',padding:24}}>Nenhuma saída registrada</td></tr>}
            {filtered.map(t=>(
              <tr key={t.id}>
                <td><b>{t.description}</b><br/><span style={{fontSize:11,color:'var(--t3)'}}>{t.subcategory==='fixed'?'Fixo':'Variável'}</span></td>
                <td>{t.category}</td>
                <td><GroupBadge group={t.group}/></td>
                <td><PayBadge method={t.paymentMethod}/></td>
                <td><StatusBadge status={t.status}/></td>
                <td style={{fontFamily:'Space Mono,monospace',color:'var(--red)',fontWeight:700}}>{fmt(t.amount)}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn-icon" onClick={()=>setModal({...t,_edit:true})}>✎</button>
                    <button className="btn-icon" style={{color:'var(--red)'}} onClick={()=>{if(confirm('Excluir?'))dispatch({type:'DEL_TXN',id:t.id});}}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length>0&&<tfoot><tr><td colSpan="5">Total ({filtered.length} itens)</td><td>{fmt(total)}</td><td/></tr></tfoot>}
        </table>
      </div>
      {modal&&<TxnModal txn={modal._edit?modal:null} type={modal.type||'expense'} onSave={save} onClose={()=>setModal(null)}/>}
    </div>
  );
}

// ===================== CALENDAR PAGE =====================
function CalendarPage(){
  const{state}=useFin();
  const{transactions,month,year}=state;
  const monthTxns=filterMonth(transactions,month,year);
  const[selected,setSelected]=useState(null);
  const today=new Date();
  const isToday=(d)=>d===today.getDate()&&month===today.getMonth()+1&&year===today.getFullYear();
  const grid=buildCalGrid(year,month);
  const byDay={};
  monthTxns.forEach(t=>{
    const d=parseInt(t.date.split('-')[2]);
    if(!byDay[d])byDay[d]=[];
    byDay[d].push(t);
  });
  const selTxns=selected?byDay[selected]||[]:[];

  return(
    <div className="content">
      <div className="chart-card">
        <div className="chart-title">Calendário — {MONTHS_F[month-1]} {year}</div>
        <div className="chart-sub">Clique em um dia para ver as transações</div>
        <div className="cal-grid" style={{marginTop:12}}>
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div key={d} className="cal-hdr">{d}</div>)}
          {grid.map((d,i)=>{
            if(!d)return<div key={`e${i}`} className="cal-day empty"/>;
            const txns=byDay[d]||[];
            const inc=txns.filter(t=>t.type==='income');
            const exp=txns.filter(t=>t.type==='expense');
            return(
              <div key={d} className={`cal-day ${isToday(d)?'today':''} ${selected===d?'active':''}`}
                style={selected===d?{borderColor:'var(--green)',background:'var(--green-dim)'}:{}}
                onClick={()=>setSelected(selected===d?null:d)}>
                <div className="cal-day-num">{d}</div>
                <div className="cal-dots">
                  {inc.map((_,j)=><div key={`i${j}`} className="cal-dot" style={{background:'var(--green)'}}/>)}
                  {exp.map((_,j)=><div key={`e${j}`} className="cal-dot" style={{background:'var(--red)'}}/>)}
                </div>
                {txns.length>0&&<div style={{fontSize:9,color:'var(--t3)',marginTop:2}}>{fmt(sumAmts(txns))}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {selected&&(
        <div className="table-wrap">
          <div className="table-header"><div className="table-title">Transações — {selected}/{String(month).padStart(2,'0')}/{year}</div></div>
          {selTxns.length===0?<div style={{padding:20,color:'var(--t3)',textAlign:'center'}}>Nenhuma transação neste dia</div>:(
            <table>
              <thead><tr><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Status</th><th>Valor</th></tr></thead>
              <tbody>
                {selTxns.map(t=>(
                  <tr key={t.id}>
                    <td>{t.description}</td>
                    <td><span className={`badge ${t.type==='income'?'received':'overdue'}`}>{t.type==='income'?'↑ Entrada':'↓ Saída'}</span></td>
                    <td>{t.category}</td>
                    <td><StatusBadge status={t.status}/></td>
                    <td style={{fontFamily:'Space Mono,monospace',color:t.type==='income'?'var(--green)':'var(--red)',fontWeight:700}}>{fmt(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== ANALYTICS PAGE =====================
function AnalyticsPage(){
  const{state}=useFin();
  const{transactions,year}=state;
  const monthly=getMonthlyTotals(transactions,year);
  const projection=buildProjection(monthly,12);
  const allExp=filterType(transactions,'expense');
  const allInc=filterType(transactions,'income');
  const totalExp=sumAmts(allExp);
  const totalInc=sumAmts(allInc);
  const catData=groupByCat(allExp);

  return(
    <div className="content">
      <div className="cards-row">
        <div className="card green"><div className="card-label">Total Entradas {year}</div><div className="card-value">{fmt(totalInc)}</div></div>
        <div className="card red"><div className="card-label">Total Saídas {year}</div><div className="card-value">{fmt(totalExp)}</div></div>
        <div className={`card ${totalInc-totalExp>=0?'blue':'red'}`}><div className="card-label">Saldo Anual</div><div className="card-value">{fmtSigned(totalInc-totalExp)}</div></div>
        <div className="card amber"><div className="card-label">Taxa Poupança Média</div><div className="card-value">{fmtPct(savingsRate(totalInc,totalExp))}</div></div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Projeção Acumulada (12 meses)</div>
          <div className="chart-sub">Baseada na tendência atual</div>
          <ProjectionChart data={projection}/>
          {projection.length>0&&<div style={{marginTop:8,fontSize:12,color:'var(--t3)'}}>Projeção em 12m: <b style={{color:projection[projection.length-1].cumulative>=0?'var(--purple)':'var(--red)'}}>{fmt(projection[projection.length-1].cumulative)}</b></div>}
        </div>
        <div className="chart-card">
          <div className="chart-title">Gastos por Categoria (Anual)</div>
          <div className="chart-sub">Todos os meses de {year}</div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <DonutChart data={catData} total={totalExp} size={160}/>
            <div style={{flex:1}}>
              {catData.slice(0,7).map((c,i)=>(
                <div key={c.cat} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5,alignItems:'center'}}>
                  <span style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:CAT_COLORS[i%CAT_COLORS.length],display:'inline-block'}}/>
                    {c.cat}
                  </span>
                  <span style={{fontFamily:'Space Mono,monospace',fontSize:11,color:'var(--t2)'}}>{((c.amt/totalExp)*100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Heatmap de Gastos</div>
        <div className="chart-sub">Distribuição por dia da semana e semana do mês</div>
        <HeatmapChart txns={allExp}/>
      </div>

      <div className="chart-card">
        <div className="chart-title">Breakdown Mensal Detalhado</div>
        <div className="chart-sub">Mês a mês — entradas, saídas e líquido</div>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr>
              <th>Mês</th><th>Entradas</th><th>Saídas</th><th>Líquido</th><th>Taxa Poupar</th><th>Status</th>
            </tr></thead>
            <tbody>
              {monthly.filter(m=>m.inc>0||m.exp>0).map(m=>{
                const sr=savingsRate(m.inc,m.exp);
                return(
                  <tr key={m.month}>
                    <td><b>{MONTHS_F[m.month-1]}</b></td>
                    <td style={{fontFamily:'Space Mono,monospace',color:'var(--green)'}}>{fmt(m.inc)}</td>
                    <td style={{fontFamily:'Space Mono,monospace',color:'var(--red)'}}>{fmt(m.exp)}</td>
                    <td style={{fontFamily:'Space Mono,monospace',color:m.net>=0?'var(--blue)':'var(--red)',fontWeight:700}}>{fmtSigned(m.net)}</td>
                    <td style={{fontFamily:'Space Mono,monospace',color:sr>=20?'var(--green)':sr>=0?'var(--amber)':'var(--red)'}}>{sr>=0?fmtPct(sr):`−${fmtPct(Math.abs(sr))}`}</td>
                    <td><span className={`badge ${m.net>=0?'received':'overdue'}`}>{m.net>=0?'✓ Superávit':'! Déficit'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===================== ICONS =====================
const Icons={
  dashboard:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  income:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 19V5m-7 7 7-7 7 7"/></svg>,
  expense:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 5v14m7-7-7 7-7-7"/></svg>,
  calendar:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  analytics:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  reset:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
};

// ===================== APP SHELL =====================
function Sidebar(){
  const{state,dispatch}=useFin();
  const{view,transactions,month,year}=state;
  const monthTxns=filterMonth(transactions,month,year);
  const inc=sumAmts(filterType(monthTxns,'income'));
  const exp=sumAmts(filterType(monthTxns,'expense'));
  const net=inc-exp;
  const NAV=[
    {id:'dashboard',label:'Dashboard',icon:Icons.dashboard},
    {id:'income',label:'Entradas',icon:Icons.income},
    {id:'expenses',label:'Saídas',icon:Icons.expense},
    {id:'calendar',label:'Calendário',icon:Icons.calendar},
    {id:'analytics',label:'Analytics',icon:Icons.analytics},
  ];
  return(
    <div className="sidebar">
      <div className="logo">
        <div className="logo-title">
          <span style={{fontSize:20}}>💰</span>
          Financeiro
        </div>
        <div className="logo-sub">Controle Familiar</div>
      </div>
      <nav className="nav">
        {NAV.map(n=>(
          <div key={n.id} className={`nav-item ${view===n.id?'active':''}`} onClick={()=>dispatch({type:'SET_VIEW',payload:n.id})}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="balance-card">
          <div className="balance-label">Saldo do Mês</div>
          <div className="balance-value" style={{color:net>=0?'var(--green)':'var(--red)'}}>{fmtSigned(net)}</div>
          <div style={{fontSize:10,color:'var(--t3)',marginTop:4}}>{MONTHS_F[month-1]} {year}</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{width:'100%',marginTop:8,justifyContent:'center',fontSize:11}}
          onClick={()=>{if(confirm('Resetar todos os dados para o padrão?')){localStorage.removeItem('fin_txns_v2');window.location.reload();}}}>
          <span style={{width:14,height:14,display:'inline-block'}}>{Icons.reset}</span> Resetar Dados
        </button>
      </div>
    </div>
  );
}

const PAGE_TITLES={dashboard:'Dashboard',income:'Entradas',expenses:'Saídas',calendar:'Calendário',analytics:'Analytics'};
const PAGE_SUBS={dashboard:'Visão geral financeira',income:'Controle de ganhos',expenses:'Controle de gastos',calendar:'Calendário de pagamentos',analytics:'Projeções e análises'};

function AppInner(){
  const{state,dispatch}=useFin();
  const{view,month,year}=state;
  const pages={dashboard:<Dashboard/>,income:<IncomePage/>,expenses:<ExpensesPage/>,calendar:<CalendarPage/>,analytics:<AnalyticsPage/>};
  return(
    <div className="app">
      <Sidebar/>
      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">{PAGE_TITLES[view]}<span>{PAGE_SUBS[view]}</span></div>
          </div>
          <div className="topbar-right">
            <MonthSelector month={month} year={year} onChange={(m,y)=>dispatch({type:'SET_MONTH',month:m,year:y})}/>
          </div>
        </div>
        {pages[view]||<Dashboard/>}
      </div>
    </div>
  );
}

export default function Home(){
  return(
    <>
      <Head>
        <title>Financeiro Família</title>
        <meta name="description" content="Controle financeiro familiar"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>
      <FinProvider>
        <AppInner/>
      </FinProvider>
    </>
  );
}
