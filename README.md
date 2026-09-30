# 💰 Financeiro Família — com Supabase

Controle financeiro familiar com banco de dados em nuvem (Supabase) e deploy no Vercel.

---

## 1. Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e abra seu projeto
2. Vá em **SQL Editor** e execute o arquivo `schema.sql` que está neste projeto
3. Isso criará a tabela `transactions` com Row Level Security habilitado

---

## 2. Variáveis de ambiente no Vercel

Ao fazer o deploy, adicione estas variáveis em **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL=https://ajftntxhhrntqnbtyizu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

---

## 3. Deploy no Vercel via GitHub

1. Faça upload desta pasta para um repositório no GitHub
2. Acesse [vercel.com](https://vercel.com) → **Add New Project**
3. Importe o repositório
4. Em **Environment Variables**, adicione as duas variáveis acima
5. Clique **Deploy** ✅

---

## Extratos bancários incluídos

O aplicativo carrega `public/nubank-transactions.json` e mescla os lançamentos com os registros já existentes sem gravá-los automaticamente no Supabase. O lote público reúne 1.232 lançamentos: histórico Nubank e novos extratos Nubank atribuídos a **Elizandra**, além do extrato consolidado de conta corrente atribuído a **Salomão**, conforme confirmação do proprietário. A tela **Titular** separa os gastos por titular e compara cartão com débito/Pix.

Na importação foram pulados arquivos Nubank de conteúdo repetido, pagamentos de fatura, cinco coincidências exatas com registros seed, 43 pares de transferências entre contas e uma linha duplicada do extrato corrente. IDs determinísticos e mesclagem por conteúdo ajudam a evitar repetições nos dados já cadastrados. Entradas e despesas usam os valores em centavos; estornos reduzem despesas.

**O JSON contém informações financeiras pessoais e está público neste repositório e no site por autorização explícita do proprietário.**

## 4. Rodar localmente

```bash
npm install
# o arquivo .env.local já vem configurado
npm run dev
```

Acesse http://localhost:3000

---

## Estrutura de arquivos

```
financeiro-familia/
├── lib/
│   └── supabase.js         ← cliente Supabase
├── pages/
│   ├── _app.js
│   ├── _document.js
│   └── index.js            ← app completo
├── styles/
│   └── globals.css
├── schema.sql              ← execute no Supabase SQL Editor
├── .env.local              ← variáveis locais (não subir no git!)
├── next.config.js
└── package.json
```

---

## ⚠️ Segurança

- Nunca suba o arquivo `.env.local` para o GitHub (já está no .gitignore)
- Use apenas a `anon key` no frontend (já está configurado assim)
- A `service_role key` nunca deve ir para o frontend
