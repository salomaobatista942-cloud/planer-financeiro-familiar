// ===================== TITULAR / CARTAO x DEBITO =====================
function TitularPage() {
  const { state } = useFin();
  const { transactions, year } = state;
  const [titular, setTitular] = useState('todos');
  const filtered = transactions.filter(t => t.type === 'expense' && t.year === year && (titular === 'todos' || t.titular === titular));
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mTxns = filtered.filter(t => t.month === m);
    const cartao = mTxns.filter(t => t.paymentMethod === 'credit').reduce((s, t) => s + t.amount, 0);
    const debito = mTxns.filter(t => t.paymentMethod !== 'credit').reduce((s, t) => s + t.amount, 0);
    return { month: m, label: MONTHS[i], inc: cartao, exp: debito };
  });
  const active = monthly.filter(m => m.inc > 0 || m.exp > 0);
  const totalCartao = monthly.reduce((s, m) => s + m.inc, 0);
  const totalDebito = monthly.reduce((s, m) => s + m.exp, 0);

  return (
    <div className="content">
      <div className="cards-row" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
        <div className="card blue"><div className="card-label">Cartao {year}</div><div className="card-value">{fmt(totalCartao)}</div></div>
        <div className="card amber"><div className="card-label">Debito/Pix {year}</div><div className="card-value">{fmt(totalDebito)}</div></div>
        <div className="card red"><div className="card-label">Total</div><div className="card-value">{fmt(totalCartao + totalDebito)}</div></div>
      </div>
      <div className="chart-card">
        <div className="chart-title">Cartao vs Debito por mes — {year}</div>
        <div className="chart-sub">
          <select style={{ width:160, display:'inline-block' }} value={titular} onChange={e => setTitular(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="salomao">Salomao</option>
            <option value="elizandra">Elizandra</option>
          </select>
        </div>
        <BarChart data={active} />
        <div className="legend" style={{ marginTop:8 }}>
          <div className="legend-item"><div className="legend-dot" style={{ background:'var(--green)' }} /> Cartao</div>
          <div className="legend-item"><div className="legend-dot" style={{ background:'var(--red)' }} /> Debito/Pix</div>
        </div>
      </div>
      <div className="table-wrap">
        <div className="table-header"><div className="table-title">Detalhamento Mensal</div></div>
        <table>
          <thead><tr><th>Mes</th><th>Cartao</th><th>Debito/Pix</th><th>Total</th></tr></thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan="4" style={{ textAlign:'center', color:'var(--t3)', padding:24 }}>Sem dados para este filtro</td></tr>}
            {active.map(m => (
              <tr key={m.month}>
                <td><b>{MONTHS_F[m.month - 1]}</b></td>
                <td style={{ fontFamily:'monospace', color:'var(--green)' }}>{fmt(m.inc)}</td>
                <td style={{ fontFamily:'monospace', color:'var(--red)' }}>{fmt(m.exp)}</td>
                <td style={{ fontFamily:'monospace', fontWeight:700 }}>{fmt(m.inc + m.exp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
