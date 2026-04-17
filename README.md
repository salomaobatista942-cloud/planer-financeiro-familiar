# Financeiro Família 💰

Controle financeiro familiar com dashboard, entradas, saídas, calendário e analytics.

## Como fazer o deploy no Vercel

### Opção 1: Via GitHub (recomendado)

1. Faça upload desta pasta para um repositório no GitHub
2. Acesse [vercel.com](https://vercel.com) e faça login
3. Clique em **"Add New Project"**
4. Importe o repositório do GitHub
5. O Vercel detecta automaticamente que é Next.js — clique **Deploy**
6. Pronto! Seu app estará online em segundos.

### Opção 2: Via Vercel CLI

```bash
npm install -g vercel
cd financeiro-familia
vercel
```

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

## Estrutura

```
financeiro-familia/
├── pages/
│   ├── _app.js       # Entry point
│   ├── _document.js  # HTML head (fontes Google)
│   └── index.js      # App completo
├── styles/
│   └── globals.css   # Estilos globais
├── package.json
├── next.config.js
├── .gitignore
└── README.md
```

## Funcionalidades

- 📊 **Dashboard** — Visão geral com cards, gráficos e pendências
- ↑ **Entradas** — Controle de ganhos mensais
- ↓ **Saídas** — Controle de gastos com filtros e categorias
- 📅 **Calendário** — Visualização por dia
- 📈 **Analytics** — Projeções, heatmap e breakdown anual
- 💾 **Persistência** — Dados salvos no localStorage do navegador
