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

## Extratos Nubank incluídos

O aplicativo carrega `public/nubank-transactions.json` e mescla esses lançamentos com os registros já existentes, sem sobrescrevê-los. Cada lançamento importado usa um ID determinístico para evitar repetição; pagamentos de fatura são ignorados e estornos entram como valores negativos em `Outros`. **O arquivo contém dados financeiros pessoais e está público neste repositório/site por autorização explícita do proprietário.**

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
