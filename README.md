# Financeiro Familia v2.0

Controle financeiro familiar com dashboard, graficos interativos, suporte a parcelas e sincronizacao via Supabase.

## Setup Supabase (sincronizacao entre dispositivos)

1. Acesse seu projeto no [supabase.com](https://supabase.com)
2. Va em **SQL Editor** e execute o conteudo do arquivo `supabase/schema.sql`
3. Crie o arquivo `.env.local` na raiz do projeto:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

4. No Vercel, va em **Settings > Environment Variables** e adicione as mesmas variaveis

## Rodando localmente

```bash
npm install
npm run dev
```

## Deploy no Vercel

1. Faca push para o GitHub
2. Importe no Vercel
3. Adicione as variaveis de ambiente no Vercel (Settings > Environment Variables)
4. Deploy!

## Estrutura

```
financeiro-familia/
├── pages/
│   ├── _app.js
│   ├── _document.js
│   └── index.js
├── styles/
│   └── globals.css
├── supabase/
│   └── schema.sql   <- Execute este SQL no Supabase
├── package.json
├── next.config.js
└── .env.local.example
```
