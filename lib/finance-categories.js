const CATEGORY_GROUPS = {
  Casa: 'necessidades',
  Alimentacao: 'necessidades',
  Transporte: 'necessidades',
  Saude: 'necessidades',
  Educacao: 'necessidades',
  Comunicacao: 'necessidades',
  Trabalho: 'necessidades',
  Pet: 'necessidades',
  Compromissos: 'necessidades',
  Tarifas: 'necessidades',
  Dividas: 'futuro',
  Investimentos: 'futuro',
  Streaming: 'desejos',
  Restaurante: 'desejos',
  Tecnologia: 'desejos',
  Presentes: 'desejos',
  Vestuario: 'desejos',
  Lazer: 'desejos',
  Pessoal: 'desejos',
  Transferencias: 'fora_orcamento',
  Outros: 'a_classificar',
  'A classificar': 'a_classificar',
};

const RULES = [
  ['Investimentos', 'futuro', /\b(xp|invest[a-z]*|aplicac[a-z]*|corretora|tesouro|cdb|rdb|fundo|acoes|etf)\b/],
  ['Dividas', 'futuro', /\b(emprest[a-z]*|financiamento|consorcio|parcelamento|acordo de divida)\b/],
  ['Tarifas', 'necessidades', /\b(tarif[a-z]*|anuidade|iof|juros|mora|encargo[a-z]*|taxa banc[a-z]*)\b/],
  ['Casa', 'necessidades', /\b(aluguel|condominio|imobili[a-z]*|energia|eletric[a-z]*|luz|agua|caern|cosern|neoenergia|saneamento|gas de cozinha|iptu|seguro residencial|internet|banda larga|provedor)\b/],
  ['Alimentacao', 'necessidades', /\b(supermerc[a-z]*|mercado|atacad[a-z]*|assai|carrefour|hortifruti|feira|mercearia|grocery|sacolao)\b/],
  ['Saude', 'necessidades', /\b(farmacia|drogaria|pague menos|drogasil|raia|hospital|clinica|consulta|medic[a-z]*|plano de saude|laboratorio|odont[a-z]*|dentista|terapia)\b/],
  ['Transporte', 'necessidades', /\b(uber|99app|99 pop|taxi|onibus|metro|combust[a-z]*|gasolina|etanol|posto|estacionamento|pedagio|ipva|seguro carro)\b/],
  ['Comunicacao', 'necessidades', /\b(tim|vivo|claro|oi movel|telefon|recarga celular)\b/],
  ['Educacao', 'necessidades', /\b(escola|faculdade|universidade|curso|mensalidade|udemy|alura|material escolar|livraria)\b/],
  ['Pet', 'necessidades', /\b(pet|veterin[a-z]*|cobasi|petz|racao|banho e tosa)\b/],
  ['Trabalho', 'necessidades', /\b(mei|das mei|contabilidade|ferramenta de trabalho)\b/],
  ['Compromissos', 'necessidades', /\b(seguro de vida|previdencia|documento|cartorio)\b/],
  ['Streaming', 'desejos', /\b(netflix|spotify|hbo|max|disney|globoplay|amazon prime|youtube premium|deezer|paramount|streaming)\b/],
  ['Restaurante', 'desejos', /\b(ifood|restaurante|lanchonete|padaria|delivery|pizzaria|hamburguer|burger|mcdonald|starbucks|cafeteria|sorvete|acai)\b/],
  ['Vestuario', 'desejos', /\b(roupa|vestuario|renner|riachuelo|c&a|shein|zara|marisa|centauro|calcado|tenis)\b/],
  ['Tecnologia', 'desejos', /\b(eletro[a-z]*|informat[a-z]*|computador|celular|apple|google play|app store|software|licenc[a-z]*|shopee|mercado livre|magalu|amazon|loja online|compra online)\b/],
  ['Presentes', 'desejos', /\b(presente|flores|floricultura)\b/],
  ['Lazer', 'desejos', /\b(cinema|teatro|show|parque|viagem|hotel|passeio|academia|esporte|jogo)\b/],
  ['Pessoal', 'desejos', /\b(salao|manicure|barbearia|beleza|cosmetico|perfumaria)\b/],
  ['Transferencias', 'fora_orcamento', /\b(pix enviado|transferencia enviada|transferencia realizada|ted enviada|doc enviado|envio pix|transfer enviado)\b/],
];

function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function classifyImportedTransaction(txn) {
  const text = normalize(txn.description);
  if (txn.type === 'income') {
    const category = /\b(salario|folha|pagamento salario)\b/.test(text)
      ? 'Salario'
      : /\b(bonus|comissao|freelance|renda extra|uber|aluguel recebido)\b/.test(text)
        ? 'Renda Extra'
        : 'Outra Fonte';
    return { ...txn, category, group: null };
  }
  if (txn.type !== 'expense') return txn;
  const match = RULES.find(([, , pattern]) => pattern.test(text));
  if (!match) return { ...txn, category: 'A classificar', group: 'a_classificar' };
  return { ...txn, category: match[0], group: match[1] };
}

module.exports = { CATEGORY_GROUPS, classifyImportedTransaction, normalize };
