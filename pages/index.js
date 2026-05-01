import { useState, useEffect, useContext, createContext, useReducer, useMemo, useCallback } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';

// ===================== CONSTANTS =====================
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_F = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATS_EXP = ['Alimentação','Casa','Transporte','Saúde','Educação','Streaming','Tecnologia','Comunicação','Trabalho','Pet','Religião','Restaurante','Presentes','Vestuário','Compromissos','Pessoal','Outros'];
const CATS_INC = ['Salário','Freelance','Bônus','Investimentos','Outra Fonte','Renda Extra'];
const PAY_METHODS = ['pix','credit','debit','boleto','cash'];
const PAY_LABELS = {pix:'Pix',credit:'Crédito',debit:'Débito',boleto:'Boleto',cash:'Dinheiro'};
const CAT_COLORS = ['#FF3F5B','#4C7BFD','#00D26A','#F5A623','#9B72F6','#20C4F4','#FF7A00','#E86FD8','#52CC83','#F5D020','#FF6B6B','#74B9FF','#A8E063','#FD79A8','#6C5CE7','#FDCB6E','#00CEC9'];

// ===================== HELPERS =====================
const toCents = v => Math.round(parseFloat(String(v).replace(',','.')) * 100) || 0;
const fromCents = c => (c / 100).toFixed(2);
const fmt = c => `R$ ${(Math.abs(c) / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
const fmtSigned = c => `${c < 0 ? '−' : '+'} ${fmt(Math.abs(c))}`;
const fmtPct = v => `${Math.abs(v).toFixed(1)}%`;
const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2,7)}`;
const todayISO = () => new Date().toISOString().split('T')[0];
const dateToMonthYear = d => { const p = d.split('-'); return { month: parseInt(p[1]), year: parseInt(p[0]) }; };

const filterMonth = (txns, m, y) => txns.filter(t => t.month === m && t.year === y);
const filterType = (txns, tp) => txns.filter(t => t.type === tp);
const sumAmts = txns => txns.reduce((s, t) => s + t.amount, 0);
const savingsRate = (inc, exp) => inc === 0 ? 0 : ((inc - exp) / inc * 100);
const groupByCat = txns => {
  const acc = {};
  txns.forEach(t => { acc[t.category] = (acc[t.category] || 0) + t.amount; });
  return Object.entries(acc).sort(([,a],[,b]) => b - a).map(([cat, amt]) => ({cat, amt}));
};
const groupsByType = txns => {
  const acc = {necessidades: 0, desejos: 0, futuro: 0};
  txns.forEach(t => { if (acc[t.group_name] !== undefined) acc[t.group_name] += t.amount; });
  return acc;
};
const getMonthlyTotals = (txns, year) =>
  Array.from({length: 12}, (_, i) => {
    const m = filterMonth(txns, i+1, year);
    const inc = sumAmts(filterType(m, 'income'));
    const exp = sumAmts(filterType(m, 'expense'));
    return {month: i+1, label: MONTHS[i], inc, exp, net: inc - exp};
  });
const buildCalGrid = (year, month) => {
  const fd = new Date(year, month-1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  return [...Array(fd).fill(null), ...Array.from({length: days}, (_, i) => i+1)];
};

// ===================== SUPABASE LAYER =====================
// Maps DB row (snake_case) to app transaction (camelCase fields)
const fromDB = row => ({
  id: row.id,
  type: row.type,
  description: row.description,
  amount: row.amount,
  category: row.category,
  group_name: row.group_name,
  subcategory: row.subcategory,
  status: row.status,
  paymentMethod: row.payment_method,
  date: row.date,
  month: row.month,
  year: row.year,
});

// Maps app transaction to DB row
const toDB = txn => ({
  id: txn.id,
  type: txn.type,
  description: txn.description,
  amount: txn.amount,
  category: txn.category,
  group_name: txn.group_name || txn.group || null,
  subcategory: txn.subcategory || null,
  status: txn.status,
  payment_method: txn.paymentMethod || null,
  date: txn.date,
  month: txn.month,
  year: txn.year,
});

async function dbLoad() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDB);
}

async function dbInsert(txn) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([toDB(txn)])
    .select()
    .single();
  if (error) throw error;
  return fromDB(data);
}

async function dbUpdate(txn) {
  const { data, error } = await supabase
    .from('transactions')
    .update(toDB(txn))
    .eq('id', txn.id)
    .select()
    .single();
  if (error) throw error;
  return fromDB(data);
}

async function dbDelete(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===================== STATE / CONTEXT =====================
const FinCtx = createContext(null);
const today = new Date();

function FinProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [view, setView] = useState('dashboard');
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load from Supabase on mount
  useEffect(() => {
    dbLoad()
      .then(rows => { setTransactions(rows); setLoading(false); })
      .catch(err => { console.error(err); showToast('Erro ao carregar dados: ' + err.message, 'error'); setLoading(false); });
  }, []);

  const addTxn = useCallback(async (txn) => {
    try {
      const saved = await dbInsert({ ...txn, id: uuid() });
      setTransactions(prev => [saved, ...prev]);
      showToast('Registro salvo com sucesso!');
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, 'error');
    }
  }, []);

  const updateTxn = useCallback(async (txn) => {
    try {
      const saved = await dbUpdate(txn);
      setTransactions(prev => prev.map(t => t.id === saved.id ? saved : t));
      showToast('Registro atualizado!');
    } catch (err) {
      showToast('Erro ao atualizar: ' + err.message, 'error');
    }
  }, []);

  const deleteTxn = useCallback(async (id) => {
    try {
      await dbDelete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      showToast('Registro excluído.');
    } catch (err) {
      showToast('Erro ao excluir: ' + err.message, 'error');
    }
  }, []);

  const changeMonth = useCallback((m, y) => { setMonth(m); setYear(y); }, []);

  return (
    <FinCtx.Provider value={{ transactions, view, setView, month, year, changeMonth, loading, addTxn, updateTxn, deleteTxn }}>
      {children}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </FinCtx.Provider>
  );
}

const useFin = () => useContext(FinCtx);

// ===================== SVG CHARTS =====================
function DonutChart({ data, total, size = 180 }) {
  if (!data.length) return <div style={{textAlign:'center',color:'var(--t3)',padding:40}}>Sem dados</div>;
  const r = 60, cx = size/2, cy = size/2, stroke = 20;
  let acc = 0;
  const slices = data.slice(0, 10).map((d, i) => {
    const pct = d.amt / total;
    const start = acc * 2 * Math.PI - Math.PI/2;
    acc += pct;
    const end = acc * 2 * Math.PI - Math.PI/2;
    const lg = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    return {...d, path:`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`, color: CAT_COLORS[i % CAT_COLORS.length]};
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="var(--s2)"/>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={.9}><title>{s.cat}: {fmt(s.amt)}</title></path>)}
      <circle cx={cx} cy={cy} r={r - stroke} fill="var(--s1)"/>
    </svg>
  );
}

function LineChart({ data, width = 500, height = 160 }) {
  if (!data.length || data.every(d => d.inc === 0 && d.exp === 0))
    return <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)'}}>Sem dados</div>;
  const pad = {t:16, b:32, l:56, r:16};
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const vals = [...data.flatMap(d => [d.inc, d.exp])].filter(v => v > 0);
  const maxV = Math.max(...vals) || 1;
  const scX = i => pad.l + i * (W / (data.length - 1 || 1));
  const scY = v => pad.t + H - (v / maxV) * H;
  const pathOf = key => `M ${data.map((d, i) => `${scX(i)},${scY(d[key])}`).join(' L ')}`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {[0,.25,.5,.75,1].map(t => <line key={t} x1={pad.l} x2={width-pad.r} y1={pad.t+H*(1-t)} y2={pad.t+H*(1-t)} stroke="var(--bd)" strokeWidth=".5"/>)}
      {data.map((d, i) => <text key={i} x={scX(i)} y={height-6} textAnchor="middle" fill="var(--t3)" fontSize="10">{d.label}</text>)}
      {[0,.25,.5,.75,1].map((t, i) => <text key={i} x={pad.l-6} y={pad.t+H*(1-t)+4} textAnchor="end" fill="var(--t3)" fontSize="9">{(maxV*t/100).toFixed(0)}k</text>)}
      <path d={pathOf('inc')} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={pathOf('exp')} fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((d, i) => [
        <circle key={`i${i}`} cx={scX(i)} cy={scY(d.inc)} r="3" fill="var(--green)" opacity={d.inc > 0 ? .9 : 0}/>,
        <circle key={`e${i}`} cx={scX(i)} cy={scY(d.exp)} r="3" fill="var(--red)" opacity={d.exp > 0 ? .9 : 0}/>
      ])}
    </svg>
  );
}

// ===================== UI COMPONENTS =====================
function MonthSelector({ month, year, onChange }) {
  const prev = () => onChange(month === 1 ? 12 : month - 1, month === 1 ? year - 1 : year);
  const next = () => onChange(month === 12 ? 1 : month + 1, month === 12 ? year + 1 : year);
  return (
    <div className="month-sel">
      <button className="month-btn" onClick={prev}>‹</button>
      <div className="month-display">{MONTHS_F[month-1].slice(0,3)} {year}</div>
      <button className="month-btn" onClick={next}>›</button>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {paid:'Pago', received:'Recebido', pending:'Pendente', overdue:'Vencido'};
  const icon = status === 'paid' || status === 'received' ? '✓ ' : status === 'pending' ? '○ ' : '! ';
  return <span className={`badge ${status}`}>{icon}{map[status] || status}</span>;
}

function PayBadge({ method }) {
  if (!method) return null;
  return <span className={`pay-badge pay-${method}`}>{PAY_LABELS[method] || method}</span>;
}

function GroupBadge({ group }) {
  const colors = {necessidades:'var(--blue)', desejos:'var(--amber)', futuro:'var(--purple)'};
  const labels = {necessidades:'Necessidades', desejos:'Desejos', futuro:'Futuro'};
  return <span style={{color: colors[group] || 'var(--t2)', fontSize:11, fontWeight:500}}>{labels[group] || group}</span>;
}

function TxnModal({ txn, type, onSave, onClose }) {
  const init = txn ? {...txn, amount: fromCents(txn.amount)} : {
    description: '', amount: '', category: type === 'income' ? 'Salário' : 'Alimentação',
    group_name: 'necessidades', subcategory: 'variable',
    status: type === 'income' ? 'received' : 'pending',
    paymentMethod: 'pix', date: todayISO(), type
  };
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const submit = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    const { month, year } = dateToMonthYear(form.date);
    await onSave({
      ...form,
      id: txn?.id || uuid(),
      amount: toCents(form.amount),
      month, year,
      type: form.type || type
    });
    setSaving(false);
  };

  return (
    <div className="overlay" onClick={e => { if (e.target.classList.contains('overlay')) onClose(); }}>
      <div className="modal">
        <div className="modal-title">
          <span>{txn ? 'Editar' : 'Nova'} {type === 'income' ? 'Entrada' : 'Saída'}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="form-group">
            <label className="lbl">Descrição *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Aluguel, Salário..."/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="lbl">Valor (R$) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0,00"/>
            </div>
            <div className="form-group">
              <label className="lbl">Data</label>
              <input type="date" value={form.date} onChange={e => { set('date', e.target.value); }}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="lbl">Categoria</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {(type === 'income' ? CATS_INC : CATS_EXP).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="lbl">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {type === 'income'
                  ? [{v:'received',l:'Recebido'},{v:'pending',l:'Pendente'}].map(s => <option key={s.v} value={s.v}>{s.l}</option>)
                  : [{v:'paid',l:'Pago'},{v:'pending',l:'Pendente'},{v:'overdue',l:'Vencido'}].map(s => <option key={s.v} value={s.v}>{s.l}</option>)
                }
              </select>
            </div>
          </div>
          {type === 'expense' && (
            <div className="form-row">
              <div className="form-group">
                <label className="lbl">Grupo (50/30/20)</label>
                <select value={form.group_name} onChange={e => set('group_name', e.target.value)}>
                  <option value="necessidades">Necessidades (50%)</option>
                  <option value="desejos">Desejos (30%)</option>
                  <option value="futuro">Futuro (20%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="lbl">Tipo</label>
                <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)}>
                  <option value="fixed">Fixo</option>
                  <option value="variable">Variável</option>
                </select>
              </div>
            </div>
          )}
          {type === 'expense' && (
            <div className="form-group">
              <label className="lbl">Forma de Pagamento</label>
              <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                {PAY_METHODS.map(m => <option key={m} value={m}>{PAY_LABELS[m]}</option>)}
              </select>
            </div>
          )}
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:8}}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== DASHBOARD =====================
function Dashboard() {
  const { transactions, month, year, loading } = useFin();
  const monthTxns = filterMonth(transactions, month, year);
  const incTxns = filterType(monthTxns, 'income');
  const expTxns = filterType(monthTxns, 'expense');
  const inc = sumAmts(incTxns), exp = sumAmts(expTxns), net = inc - exp;
  const sr = savingsRate(inc, exp);
  const monthly = getMonthlyTotals(transactions, year);
  const catData = groupByCat(expTxns);
  const groups = groupsByType(expTxns);
  const pending = expTxns.filter(t => t.status === 'pending' || t.status === 'overdue');
  const pendingAmt = sumAmts(pending);

  if (loading) return <div className="loading-bar"><div className="spinner"/> Carregando dados...</div>;

  return (
    <div className="content">
      <div className="cards-row">
        <div className="card green"><div className="card-label">↑ Entradas</div><div className="card-value">{fmt(inc)}</div><div className="card-sub">{incTxns.length} recebimentos</div></div>
        <div className="card red"><div className="card-label">↓ Saídas</div><div className="card-value">{fmt(exp)}</div><div className="card-sub">{expTxns.length} transações</div></div>
        <div className={`card ${net >= 0 ? 'blue' : 'red'}`}><div className="card-label">= Saldo Líquido</div><div className="card-value">{fmtSigned(net)}</div><div className="card-sub">{net >= 0 ? 'Superávit' : 'Déficit'} no mês</div></div>
        <div className="card amber"><div className="card-label">⏳ A Pagar</div><div className="card-value">{fmt(pendingAmt)}</div><div className="card-sub">{pending.length} pendentes</div></div>
      </div>

      {inc > 0 && (
        <div className="chart-card">
          <div className="chart-title">Taxa de Poupança</div>
          <div className="chart-sub">{sr >= 0 ? `${fmtPct(sr)} do salário poupado` : `Gastos excedem renda em ${fmtPct(Math.abs(sr))}`}</div>
          <div className="prog-bar"><div className="prog-fill" style={{width:`${Math.min(100, Math.max(0, sr))}%`, background: sr >= 20 ? 'var(--green)' : sr >= 0 ? 'var(--amber)' : 'var(--red)'}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,color:'var(--t3)'}}>
            <span>Meta: 20%</span>
            <span style={{color: sr >= 20 ? 'var(--green)' : sr >= 10 ? 'var(--amber)' : 'var(--red)'}}>{sr >= 20 ? '✓ Ótimo' : sr >= 10 ? 'Razoável' : 'Melhorar'}</span>
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
          {exp === 0 ? <div style={{color:'var(--t3)',fontSize:13,padding:'20px 0'}}>Nenhum gasto registrado</div> : (
            <div style={{display:'flex', gap:16, alignItems:'flex-start'}}>
              <DonutChart data={catData} total={exp}/>
              <div style={{flex:1, overflow:'hidden'}}>
                {catData.slice(0,6).map((c,i) => (
                  <div key={c.cat} style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                      <span style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:CAT_COLORS[i%CAT_COLORS.length],display:'inline-block'}}/>
                        {c.cat}
                      </span>
                      <span style={{fontFamily:'Space Mono,monospace',fontSize:11,color:'var(--t2)'}}>{fmt(c.amt)}</span>
                    </div>
                    <div className="prog-bar"><div className="prog-fill" style={{width:`${(c.amt/exp*100)||0}%`, background:CAT_COLORS[i%CAT_COLORS.length]}}/></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {exp > 0 && (
        <div className="chart-card">
          <div className="chart-title">Regra 50/30/20</div>
          <div className="chart-sub">Necessidades · Desejos · Futuro</div>
          <div className="budget-split">
            {[
              {key:'necessidades',label:'Necessidades',target:50,color:'var(--blue)'},
              {key:'desejos',label:'Desejos',target:30,color:'var(--amber)'},
              {key:'futuro',label:'Futuro / Poupança',target:20,color:'var(--purple)'},
            ].map(g => {
              const amt = groups[g.key] || 0;
              const pct = exp ? ((amt/exp)*100) : 0;
              return (
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

      {pending.length > 0 && (
        <div className="table-wrap">
          <div className="table-header"><div className="table-title">⚠ Pendências do Mês</div></div>
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {pending.map(t => (
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
function IncomePage() {
  const { transactions, month, year, loading, addTxn, updateTxn, deleteTxn } = useFin();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const monthTxns = filterMonth(filterType(transactions, 'income'), month, year);
  const filtered = monthTxns.filter(t =>
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );
  const total = sumAmts(filtered);
  const received = sumAmts(filtered.filter(t => t.status === 'received'));

  const save = async (txn) => {
    if (txn.id && transactions.find(t => t.id === txn.id)) await updateTxn(txn);
    else await addTxn({...txn, type:'income'});
    setModal(null);
  };

  if (loading) return <div className="loading-bar"><div className="spinner"/> Carregando...</div>;

  return (
    <div className="content">
      <div className="cards-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="card green"><div className="card-label">Total Entradas</div><div className="card-value">{fmt(total)}</div></div>
        <div className="card blue"><div className="card-label">Recebido</div><div className="card-value">{fmt(received)}</div></div>
        <div className="card amber"><div className="card-label">Pendente</div><div className="card-value">{fmt(total - received)}</div></div>
      </div>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Entradas — {MONTHS_F[month-1]} {year}</div>
          <div className="table-controls">
            <input style={{width:180}} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}/>
            <button className="btn btn-primary" onClick={() => setModal({type:'income'})}>+ Nova Entrada</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="6" style={{textAlign:'center',color:'var(--t3)',padding:24}}>Nenhuma entrada registrada</td></tr>}
            {filtered.map(t => (
              <tr key={t.id}>
                <td><b>{t.description}</b></td>
                <td>{t.category}</td>
                <td>{t.date}</td>
                <td><StatusBadge status={t.status}/></td>
                <td style={{fontFamily:'Space Mono,monospace',color:'var(--green)',fontWeight:700}}>{fmt(t.amount)}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn-icon" onClick={() => setModal({...t, _edit:true})}>✎</button>
                    <button className="btn-icon" style={{color:'var(--red)'}} onClick={() => { if(confirm('Excluir?')) deleteTxn(t.id); }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && <tfoot><tr><td colSpan="4">Total</td><td>{fmt(total)}</td><td/></tr></tfoot>}
        </table>
      </div>
      {modal && <TxnModal txn={modal._edit ? modal : null} type={modal.type || 'income'} onSave={save} onClose={() => setModal(null)}/>}
    </div>
  );
}

// ===================== EXPENSES PAGE =====================
function ExpensesPage() {
  const { transactions, month, year, loading, addTxn, updateTxn, deleteTxn } = useFin();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filterGrp, setFilterGrp] = useState('all');
  const [filterSub, setFilterSub] = useState('all');
  const monthTxns = filterMonth(filterType(transactions, 'expense'), month, year);
  const filtered = monthTxns.filter(t => {
    const q = search.toLowerCase();
    return (!q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) &&
      (filterGrp === 'all' || t.group_name === filterGrp) &&
      (filterSub === 'all' || t.subcategory === filterSub);
  });
  const total = sumAmts(filtered);
  const paid = sumAmts(filtered.filter(t => t.status === 'paid'));
  const pending = sumAmts(filtered.filter(t => t.status === 'pending' || t.status === 'overdue'));

  const save = async (txn) => {
    if (txn.id && transactions.find(t => t.id === txn.id)) await updateTxn(txn);
    else await addTxn({...txn, type:'expense'});
    setModal(null);
  };

  if (loading) return <div className="loading-bar"><div className="spinner"/> Carregando...</div>;

  return (
    <div className="content">
      <div className="cards-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="card red"><div className="card-label">Total Saídas</div><div className="card-value">{fmt(total)}</div></div>
        <div className="card green"><div className="card-label">Pago</div><div className="card-value">{fmt(paid)}</div></div>
        <div className="card amber"><div className="card-label">Pendente</div><div className="card-value">{fmt(pending)}</div></div>
      </div>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Saídas — {MONTHS_F[month-1]} {year}</div>
          <div className="table-controls">
            <input style={{width:150}} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}/>
            <select style={{width:130}} value={filterGrp} onChange={e => setFilterGrp(e.target.value)}>
              <option value="all">Todos grupos</option>
              <option value="necessidades">Necessidades</option>
              <option value="desejos">Desejos</option>
              <option value="futuro">Futuro</option>
            </select>
            <select style={{width:110}} value={filterSub} onChange={e => setFilterSub(e.target.value)}>
              <option value="all">Fixo/Variável</option>
              <option value="fixed">Fixo</option>
              <option value="variable">Variável</option>
            </select>
            <button className="btn btn-primary" onClick={() => setModal({type:'expense'})}>+ Nova Saída</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Grupo</th><th>Pagamento</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="7" style={{textAlign:'center',color:'var(--t3)',padding:24}}>Nenhuma saída registrada</td></tr>}
            {filtered.map(t => (
              <tr key={t.id}>
                <td><b>{t.description}</b><br/><span style={{fontSize:11,color:'var(--t3)'}}>{t.subcategory === 'fixed' ? 'Fixo' : 'Variável'}</span></td>
                <td>{t.category}</td>
                <td><GroupBadge group={t.group_name}/></td>
                <td><PayBadge method={t.paymentMethod || t.payment_method}/></td>
                <td><StatusBadge status={t.status}/></td>
                <td style={{fontFamily:'Space Mono,monospace',color:'var(--red)',fontWeight:700}}>{fmt(t.amount)}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn-icon" onClick={() => setModal({...t, _edit:true})}>✎</button>
                    <button className="btn-icon" style={{color:'var(--red)'}} onClick={() => { if(confirm('Excluir?')) deleteTxn(t.id); }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && <tfoot><tr><td colSpan="5">Total ({filtered.length} itens)</td><td>{fmt(total)}</td><td/></tr></tfoot>}
        </table>
      </div>
      {modal && <TxnModal txn={modal._edit ? modal : null} type={modal.type || 'expense'} onSave={save} onClose={() => setModal(null)}/>}
    </div>
  );
}

// ===================== CALENDAR PAGE =====================
function CalendarPage() {
  const { transactions, month, year, loading } = useFin();
  const monthTxns = filterMonth(transactions, month, year);
  const [selected, setSelected] = useState(null);
  const now = new Date();
  const isToday = d => d === now.getDate() && month === now.getMonth()+1 && year === now.getFullYear();
  const grid = buildCalGrid(year, month);
  const byDay = {};
  monthTxns.forEach(t => {
    const d = parseInt(t.date.split('-')[2]);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(t);
  });

  if (loading) return <div className="loading-bar"><div className="spinner"/> Carregando...</div>;

  return (
    <div className="content">
      <div className="chart-card">
        <div className="chart-title">Calendário — {MONTHS_F[month-1]} {year}</div>
        <div className="chart-sub">Clique em um dia para ver as transações</div>
        <div className="cal-grid" style={{marginTop:12}}>
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} className="cal-hdr">{d}</div>)}
          {grid.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="cal-day empty"/>;
            const txns = byDay[d] || [];
            const inc = txns.filter(t => t.type === 'income');
            const exp = txns.filter(t => t.type === 'expense');
            return (
              <div key={d} className={`cal-day ${isToday(d) ? 'today' : ''}`}
                style={selected === d ? {borderColor:'var(--green)',background:'var(--green-dim)'} : {}}
                onClick={() => setSelected(selected === d ? null : d)}>
                <div className="cal-day-num">{d}</div>
                <div className="cal-dots">
                  {inc.map((_,j) => <div key={`i${j}`} className="cal-dot" style={{background:'var(--green)'}}/>)}
                  {exp.map((_,j) => <div key={`e${j}`} className="cal-dot" style={{background:'var(--red)'}}/>)}
                </div>
                {txns.length > 0 && <div style={{fontSize:9,color:'var(--t3)',marginTop:2}}>{fmt(sumAmts(txns))}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="table-wrap">
          <div className="table-header"><div className="table-title">Transações — {selected}/{String(month).padStart(2,'0')}/{year}</div></div>
          {(byDay[selected] || []).length === 0 ? <div style={{padding:20,color:'var(--t3)',textAlign:'center'}}>Nenhuma transação neste dia</div> : (
            <table>
              <thead><tr><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Status</th><th>Valor</th></tr></thead>
              <tbody>
                {(byDay[selected] || []).map(t => (
                  <tr key={t.id}>
                    <td>{t.description}</td>
                    <td><span className={`badge ${t.type === 'income' ? 'received' : 'overdue'}`}>{t.type === 'income' ? '↑ Entrada' : '↓ Saída'}</span></td>
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
function AnalyticsPage() {
  const { transactions, year, loading } = useFin();
  const monthly = getMonthlyTotals(transactions, year);
  const allExp = filterType(transactions, 'expense');
  const allInc = filterType(transactions, 'income');
  const totalExp = sumAmts(allExp);
  const totalInc = sumAmts(allInc);
  const catData = groupByCat(allExp);

  if (loading) return <div className="loading-bar"><div className="spinner"/> Carregando...</div>;

  return (
    <div className="content">
      <div className="cards-row">
        <div className="card green"><div className="card-label">Total Entradas {year}</div><div className="card-value">{fmt(totalInc)}</div></div>
        <div className="card red"><div className="card-label">Total Saídas {year}</div><div className="card-value">{fmt(totalExp)}</div></div>
        <div className={`card ${totalInc-totalExp >= 0 ? 'blue' : 'red'}`}><div className="card-label">Saldo Anual</div><div className="card-value">{fmtSigned(totalInc-totalExp)}</div></div>
        <div className="card purple"><div className="card-label">Taxa Poupança</div><div className="card-value">{fmtPct(savingsRate(totalInc,totalExp))}</div></div>
      </div>
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Evolução Anual — Barras</div>
          <div className="chart-sub">Entradas vs Saídas — {year}</div>
          <LineChart data={monthly}/>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{background:'var(--green)'}}/> Entradas</div>
            <div className="legend-item"><div className="legend-dot" style={{background:'var(--red)'}}/> Saídas</div>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Categorias (Anual)</div>
          <div className="chart-sub">Todos os meses de {year}</div>
          {totalExp === 0 ? <div style={{color:'var(--t3)',padding:'20px 0'}}>Nenhum gasto</div> : (
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <DonutChart data={catData} total={totalExp} size={160}/>
              <div style={{flex:1}}>
                {catData.slice(0,7).map((c,i) => (
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
          )}
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-title">Breakdown Mensal</div>
        <div className="chart-sub">Mês a mês — entradas, saídas e saldo</div>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Poupança</th><th>Status</th></tr></thead>
            <tbody>
              {monthly.filter(m => m.inc > 0 || m.exp > 0).map(m => {
                const sr = savingsRate(m.inc, m.exp);
                return (
                  <tr key={m.month}>
                    <td><b>{MONTHS_F[m.month-1]}</b></td>
                    <td style={{fontFamily:'Space Mono,monospace',color:'var(--green)'}}>{fmt(m.inc)}</td>
                    <td style={{fontFamily:'Space Mono,monospace',color:'var(--red)'}}>{fmt(m.exp)}</td>
                    <td style={{fontFamily:'Space Mono,monospace',color:m.net>=0?'var(--blue)':'var(--red)',fontWeight:700}}>{fmtSigned(m.net)}</td>
                    <td style={{fontFamily:'Space Mono,monospace',color:sr>=20?'var(--green)':sr>=0?'var(--amber)':'var(--red)'}}>{fmtPct(sr)}</td>
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
const Icons = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  income: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 19V5m-7 7 7-7 7 7"/></svg>,
  expense: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 5v14m7-7-7 7-7-7"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
};

// ===================== APP SHELL =====================
function Sidebar() {
  const { view, setView, transactions, month, year } = useFin();
  const monthTxns = filterMonth(transactions, month, year);
  const inc = sumAmts(filterType(monthTxns, 'income'));
  const exp = sumAmts(filterType(monthTxns, 'expense'));
  const net = inc - exp;
  const NAV = [
    {id:'dashboard', label:'Dashboard', icon:Icons.dashboard},
    {id:'income', label:'Entradas', icon:Icons.income},
    {id:'expenses', label:'Saídas', icon:Icons.expense},
    {id:'calendar', label:'Calendário', icon:Icons.calendar},
    {id:'analytics', label:'Analytics', icon:Icons.analytics},
  ];
  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-title"><span style={{fontSize:20}}>💰</span> Financeiro</div>
        <div className="logo-sub">Controle Familiar</div>
      </div>
      <nav className="nav">
        {NAV.map(n => (
          <div key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="balance-card">
          <div className="balance-label">Saldo do Mês</div>
          <div className="balance-value" style={{color: net >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtSigned(net)}</div>
          <div style={{fontSize:10,color:'var(--t3)',marginTop:4}}>{MONTHS_F[month-1]} {year}</div>
        </div>
      </div>
    </div>
  );
}

const PAGE_TITLES = {dashboard:'Dashboard', income:'Entradas', expenses:'Saídas', calendar:'Calendário', analytics:'Analytics'};
const PAGE_SUBS = {dashboard:'Visão geral financeira', income:'Controle de ganhos', expenses:'Controle de gastos', calendar:'Calendário de pagamentos', analytics:'Projeções e análises'};

function AppInner() {
  const { view, month, year, changeMonth } = useFin();
  const pages = {dashboard:<Dashboard/>, income:<IncomePage/>, expenses:<ExpensesPage/>, calendar:<CalendarPage/>, analytics:<AnalyticsPage/>};
  return (
    <div className="app">
      <Sidebar/>
      <div className="main">
        <div className="topbar">
          <div className="page-title">{PAGE_TITLES[view]}<span>{PAGE_SUBS[view]}</span></div>
          <div className="topbar-right">
            <MonthSelector month={month} year={year} onChange={changeMonth}/>
          </div>
        </div>
        {pages[view] || <Dashboard/>}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Head>
        <title>Financeiro Família</title>
        <meta name="description" content="Controle financeiro familiar com Supabase"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>
      <FinProvider>
        <AppInner/>
      </FinProvider>
    </>
  );
}
