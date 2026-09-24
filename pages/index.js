import { useState, useEffect, useContext, createContext, useReducer, useRef, useCallback } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

// ===================== SUPABASE =====================
const SUPABASE_URL = 'https://ajftntxhhrntqnbtyizu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZnRudHhoaHJudHFuYnR5aXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NjU2MjEsImV4cCI6MjA5MzI0MTYyMX0.hmUQc_C4rEXF2NG-XsCRwt_81QRLDbqUv_eRsEGP9_o';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== CONSTANTS =====================
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_F = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATS_EXP = ['Alimentacao','Casa','Transporte','Saude','Educacao','Streaming','Tecnologia','Comunicacao','Trabalho','Pet','Religiao','Restaurante','Presentes','Vestuario','Compromissos','Pessoal','Outros'];
const CATS_INC = ['Salario','Freelance','Bonus','Investimentos','Outra Fonte','Renda Extra'];
const PAY_METHODS = ['pix','credit','debit','boleto','cash'];
const PAY_LABELS = {pix:'Pix',credit:'Credito',debit:'Debito',boleto:'Boleto',cash:'Dinheiro'};
const CAT_COLORS = ['#FF3F5B','#4C7BFD','#00D26A','#F5A623','#9B72F6','#20C4F4','#FF7A00','#E86FD8','#52CC83','#F5D020','#FF6B6B','#74B9FF','#A8E063','#FD79A8','#6C5CE7','#FDCB6E','#00CEC9'];

// ===================== DOMAIN =====================
const toCents = v => Math.round(parseFloat(String(v).replace(',','.')) * 100) || 0;
const fromCents = c => (c / 100).toFixed(2);
const fmt = c => {
  const s = (Math.abs(c) / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  return 'R$ ' + s;
};
const fmtSigned = c => {
  const sign = c < 0 ? '-' : '+';
  return sign + ' ' + fmt(Math.abs(c));
};
const fmtPct = v => Math.abs(v).toFixed(1) + '%';
const uuid = () => Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 7);
const todayISO = () => new Date().toISOString().split('T')[0];
const dateToMonthYear = d => {
  const p = d.split('-');
  return { month: parseInt(p[1]), year: parseInt(p[0]) };
};

const filterMonth = (txns, m, y) => txns.filter(t => t.month === m && t.year === y);
const filterType = (txns, tp) => txns.filter(t => t.type === tp);
const sumAmts = txns => txns.reduce((s, t) => s + t.amount, 0);
const savingsRate = (inc, exp) => inc === 0 ? 0 : ((inc - exp) / inc * 100);

const groupByCat = txns => {
  const acc = {};
  txns.forEach(t => { acc[t.category] = (acc[t.category] || 0) + t.amount; });
  return Object.entries(acc).sort(([,a],[,b]) => b - a).map(([cat, amt]) => ({ cat, amt }));
};

const groupsByType = txns => {
  const acc = { necessidades: 0, desejos: 0, futuro: 0 };
  txns.forEach(t => { if (acc[t.group] !== undefined) acc[t.group] += t.amount; });
  return acc;
};

const getMonthlyTotals = (txns, year) =>
  Array.from({ length: 12 }, (_, i) => {
    const m = filterMonth(txns, i + 1, year);
    const inc = sumAmts(filterType(m, 'income'));
    const exp = sumAmts(filterType(m, 'expense'));
    return { month: i + 1, label: MONTHS[i], inc, exp, net: inc - exp };
  });

const buildCalGrid = (year, month) => {
  const fd = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  return [...Array(fd).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
};

// ===================== SEED DATA (March, April + May) =====================
const SEED = () => {
  const mkExp = (d, month, year) => ({ ...d, id: uuid(), type: 'expense', month, year });
  const mkInc = (d, month, year) => ({ ...d, id: uuid(), type: 'income', month, year });

  const mar_exp = [
    { description:'Seguro Carro', amount:toCents(128), category:'Transporte', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'boleto', date:'2026-03-05', installments:1, installmentMonth:null },
    { description:'Caern (Agua)', amount:toCents(99), category:'Casa', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'boleto', date:'2026-03-10', installments:1, installmentMonth:null },
    { description:'Internet', amount:toCents(102.28), category:'Casa', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'boleto', date:'2026-03-15', installments:1, installmentMonth:null },
    { description:'MEI', amount:toCents(174.10), category:'Trabalho', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-03-20', installments:1, installmentMonth:null },
    { description:'Veterinario 3/5', amount:toCents(148), category:'Pet', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'credit', date:'2026-03-12', installments:5, installmentMonth:3 },
    { description:'Computador', amount:toCents(189.18), category:'Tecnologia', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'credit', date:'2026-03-01', installments:12, installmentMonth:3 },
    { description:'Academia', amount:toCents(120), category:'Saude', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-03-05', installments:1, installmentMonth:null },
    { description:'Mercado', amount:toCents(972.63), category:'Alimentacao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'credit', date:'2026-03-15', installments:1, installmentMonth:null },
    { description:'Combustivel', amount:toCents(110), category:'Transporte', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-03-10', installments:1, installmentMonth:null },
    { description:'Plano Saude', amount:toCents(449.43), category:'Saude', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'boleto', date:'2026-03-05', installments:1, installmentMonth:null },
    { description:'Dizimo', amount:toCents(499), category:'Religiao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-03-01', installments:1, installmentMonth:null },
    { description:'Energia', amount:toCents(49.63), category:'Casa', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'boleto', date:'2026-03-20', installments:1, installmentMonth:null },
    { description:'Amazon Prime', amount:toCents(3.98), category:'Streaming', group:'desejos', subcategory:'fixed', status:'paid', paymentMethod:'credit', date:'2026-03-15', installments:1, installmentMonth:null },
    { description:'Spotify', amount:toCents(6.82), category:'Streaming', group:'desejos', subcategory:'fixed', status:'paid', paymentMethod:'credit', date:'2026-03-15', installments:1, installmentMonth:null },
    { description:'iFood', amount:toCents(70.67), category:'Restaurante', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'credit', date:'2026-03-25', installments:1, installmentMonth:null },
    { description:'Curso Sarah', amount:toCents(49), category:'Educacao', group:'futuro', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-03-01', installments:1, installmentMonth:null },
  ];

  const apr_exp = [
    { description:'Seguro Carro', amount:toCents(128), category:'Transporte', group:'necessidades', subcategory:'fixed', status:'pending', paymentMethod:'boleto', date:'2026-04-05', installments:1, installmentMonth:null },
    { description:'Caern (Agua)', amount:toCents(99), category:'Casa', group:'necessidades', subcategory:'fixed', status:'pending', paymentMethod:'boleto', date:'2026-04-10', installments:1, installmentMonth:null },
    { description:'Internet', amount:toCents(102.28), category:'Casa', group:'necessidades', subcategory:'fixed', status:'pending', paymentMethod:'boleto', date:'2026-04-15', installments:1, installmentMonth:null },
    { description:'MEI', amount:toCents(174.10), category:'Trabalho', group:'necessidades', subcategory:'fixed', status:'pending', paymentMethod:'pix', date:'2026-04-20', installments:1, installmentMonth:null },
    { description:'Veterinario 4/5', amount:toCents(148), category:'Pet', group:'necessidades', subcategory:'fixed', status:'pending', paymentMethod:'credit', date:'2026-04-12', installments:5, installmentMonth:4 },
    { description:'Academia', amount:toCents(120), category:'Saude', group:'necessidades', subcategory:'fixed', status:'pending', paymentMethod:'pix', date:'2026-04-05', installments:1, installmentMonth:null },
    { description:'Amazon Prime', amount:toCents(3.98), category:'Streaming', group:'desejos', subcategory:'fixed', status:'pending', paymentMethod:'credit', date:'2026-04-15', installments:1, installmentMonth:null },
    { description:'Spotify', amount:toCents(6.82), category:'Streaming', group:'desejos', subcategory:'fixed', status:'pending', paymentMethod:'credit', date:'2026-04-15', installments:1, installmentMonth:null },
    { description:'Curso Sarah', amount:toCents(49), category:'Educacao', group:'futuro', subcategory:'fixed', status:'pending', paymentMethod:'pix', date:'2026-04-01', installments:1, installmentMonth:null },
  ];

  const income = [
    mkInc({ description:'Renda Fixa', amount:toCents(2300), category:'Salario', status:'received', date:'2026-03-05', installments:1, installmentMonth:null }, 3, 2026),
    mkInc({ description:'Renda Variavel', amount:toCents(1200), category:'Freelance', status:'received', date:'2026-03-10', installments:1, installmentMonth:null }, 3, 2026),
    mkInc({ description:'Renda Fixa', amount:toCents(2300), category:'Salario', status:'received', date:'2026-04-05', installments:1, installmentMonth:null }, 4, 2026),
    mkInc({ description:'Renda Variavel', amount:toCents(1200), category:'Freelance', status:'received', date:'2026-04-10', installments:1, installmentMonth:null }, 4, 2026),
  ];

  // ===================== MAIO 2026 — Extrato BB + Nubank =====================
  const may_exp = [
    // BB — saidas
    mkExp({ description:'Shpp Brasil (Shopee)', amount:toCents(59.38), category:'Outros', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-01', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Pao Nosso Oliver Delivery', amount:toCents(26.60), category:'Restaurante', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-04', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Farmacia Pague Menos', amount:toCents(45.60), category:'Saude', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-03', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Elizandra Andre De Oliveira', amount:toCents(500.00), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-05', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Uber Do Brasil', amount:toCents(6.15), category:'Transporte', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-06', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'TIM (Recarga)', amount:toCents(20.00), category:'Comunicacao', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-06', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Finnas Flores E Cestas', amount:toCents(86.00), category:'Presentes', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-07', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Nordestao (Supermercado)', amount:toCents(31.59), category:'Alimentacao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-08', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Jean Aparecido Silva De Brito', amount:toCents(30.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Igreja Batista Ibrecem (Dizimo)', amount:toCents(562.30), category:'Religiao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Elizandra Andre (Transferencia)', amount:toCents(102.02), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Elizandra Andre (Transferencia)', amount:toCents(126.00), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Elizandra Andre (Transferencia)', amount:toCents(1442.33), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Elizandra Andre (Transferencia)', amount:toCents(1207.00), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Via Hospitalar', amount:toCents(110.00), category:'Saude', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-15', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Jose Rodrigo Souza Nunes', amount:toCents(10.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-17', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Pao Nosso Oliver Delivery', amount:toCents(27.15), category:'Restaurante', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-18', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Alessandra Moura De Araujo', amount:toCents(13.50), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-20', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Heridan Pinheiro Da Silva', amount:toCents(16.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-21', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Maternidade Almeida Castro', amount:toCents(4.50), category:'Saude', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-22', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Farmacia Pague Menos', amount:toCents(634.87), category:'Saude', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-23', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Nordestao (Supermercado)', amount:toCents(88.23), category:'Alimentacao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-26', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Li Ji', amount:toCents(50.95), category:'Alimentacao', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-29', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Uber Do Brasil', amount:toCents(7.35), category:'Transporte', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Uber Do Brasil', amount:toCents(6.68), category:'Transporte', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'TIM (Recarga)', amount:toCents(30.00), category:'Comunicacao', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Drogaria Globo', amount:toCents(52.99), category:'Saude', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-31', installments:1, installmentMonth:null }, 5, 2026),
    // Nubank — saidas
    mkExp({ description:'PicPay (Transferencia)', amount:toCents(0.21), category:'Outros', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-01', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Keziany Kathleen', amount:toCents(4.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-01', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Danielle Louise Fernandes', amount:toCents(520.00), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-04', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Airbnb', amount:toCents(348.60), category:'Outros', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-04', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Lucia Helena Soares Da Costa', amount:toCents(40.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-07', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Churrascaria Camaratuba', amount:toCents(3.00), category:'Restaurante', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-07', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Fina Flores E Cestas', amount:toCents(214.00), category:'Presentes', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-08', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Panificadora Pao Nosso', amount:toCents(14.79), category:'Alimentacao', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'debit', date:'2026-05-09', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Dia A Dia Atacado', amount:toCents(428.64), category:'Alimentacao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'debit', date:'2026-05-09', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Assai Atacadista', amount:toCents(90.19), category:'Alimentacao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'debit', date:'2026-05-09', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Farmacia Pague Menos', amount:toCents(114.58), category:'Saude', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-11', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Aplicacao RDB', amount:toCents(1207.00), category:'Investimentos', group:'futuro', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Aplicacao RDB', amount:toCents(200.00), category:'Investimentos', group:'futuro', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Aplicacao RDB', amount:toCents(1442.33), category:'Investimentos', group:'futuro', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'TCM TV Cabo Mossoro', amount:toCents(102.02), category:'Casa', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'TIM (Plano)', amount:toCents(59.99), category:'Comunicacao', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Y T C Monteiro Ltda', amount:toCents(104.00), category:'Casa', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'PicPay (Transferencia)', amount:toCents(8.44), category:'Outros', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-13', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Larissa De Castro Marques', amount:toCents(70.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-13', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'D B O Do Nascimento Barros', amount:toCents(28.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-14', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Francisca Aldevenia Soares', amount:toCents(5.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-15', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Caern (Agua)', amount:toCents(96.83), category:'Casa', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'pix', date:'2026-05-16', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Eric Vinicius Reinaldo', amount:toCents(10.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-16', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Y T C Monteiro Ltda', amount:toCents(31.00), category:'Casa', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-17', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Hinova Pay (Boleto)', amount:toCents(126.90), category:'Outros', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'boleto', date:'2026-05-18', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Danielle Louise Fernandes', amount:toCents(500.20), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-18', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Receita Federal', amount:toCents(87.34), category:'Trabalho', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-21', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Unimed Natal (Plano Saude)', amount:toCents(458.54), category:'Saude', group:'necessidades', subcategory:'fixed', status:'paid', paymentMethod:'boleto', date:'2026-05-21', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Receita Federal', amount:toCents(112.39), category:'Trabalho', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-22', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'iFood', amount:toCents(44.98), category:'Restaurante', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-22', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Salomao Batista (Transf.)', amount:toCents(150.00), category:'Pessoal', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-23', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Assai Atacadista', amount:toCents(30.68), category:'Alimentacao', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'debit', date:'2026-05-24', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'D B O Do Nascimento Barros', amount:toCents(34.90), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-24', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Y T C Monteiro Ltda', amount:toCents(23.50), category:'Casa', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-26', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Americanas', amount:toCents(11.99), category:'Outros', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'debit', date:'2026-05-29', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Epar Estacionamentos', amount:toCents(11.00), category:'Transporte', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'debit', date:'2026-05-29', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Eric Vinicius Reinaldo', amount:toCents(20.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Allan Gas', amount:toCents(115.00), category:'Casa', group:'necessidades', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
    mkExp({ description:'Yonara Viviany Santana', amount:toCents(100.00), category:'Pessoal', group:'desejos', subcategory:'variable', status:'paid', paymentMethod:'pix', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
  ];

  const may_inc = [
    // BB — entradas
    mkInc({ description:'Kiwify Pagamentos', amount:toCents(492.33), category:'Renda Extra', status:'received', date:'2026-05-05', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Adao Jose De Oliveira', amount:toCents(130.00), category:'Outra Fonte', status:'received', date:'2026-05-06', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Amarketing & Vendas Ltda', amount:toCents(2299.32), category:'Freelance', status:'received', date:'2026-05-06', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Matheus Da Silva Nascimento', amount:toCents(892.00), category:'Outra Fonte', status:'received', date:'2026-05-07', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Wepayments Kiwify', amount:toCents(46.76), category:'Renda Extra', status:'received', date:'2026-05-08', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Matheus Da Silva Nascimento', amount:toCents(285.00), category:'Outra Fonte', status:'received', date:'2026-05-10', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Matheus Da Silva Nascimento', amount:toCents(30.00), category:'Outra Fonte', status:'received', date:'2026-05-11', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Kiwify Pagamentos', amount:toCents(596.33), category:'Renda Extra', status:'received', date:'2026-05-18', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Mardonio Luiz Peixoto Chaves', amount:toCents(200.00), category:'Outra Fonte', status:'received', date:'2026-05-24', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Elizandra Andre De Oliveira', amount:toCents(150.00), category:'Outra Fonte', status:'received', date:'2026-05-23', installments:1, installmentMonth:null }, 5, 2026),
    // Nubank — entradas
    mkInc({ description:'Resgate RDB', amount:toCents(15.00), category:'Investimentos', status:'received', date:'2026-05-01', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Belchior Lino De Oliveira', amount:toCents(1500.00), category:'Outra Fonte', status:'received', date:'2026-05-03', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Yonara Viviany Santana', amount:toCents(3.98), category:'Outra Fonte', status:'received', date:'2026-05-05', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Salomao Salim Da Silva Batista', amount:toCents(500.00), category:'Outra Fonte', status:'received', date:'2026-05-05', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Franciane Maraiza Olinto', amount:toCents(3.98), category:'Outra Fonte', status:'received', date:'2026-05-09', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Quezia Sharlene Marinho', amount:toCents(200.00), category:'Outra Fonte', status:'received', date:'2026-05-09', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Maria Gorette Andre De Oliveira', amount:toCents(500.00), category:'Outra Fonte', status:'received', date:'2026-05-09', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Janaina Cortez Oliveira', amount:toCents(150.00), category:'Outra Fonte', status:'received', date:'2026-05-09', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Belchior Lino De Oliveira', amount:toCents(2000.00), category:'Outra Fonte', status:'received', date:'2026-05-11', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Salomao Salim Da Silva Batista', amount:toCents(1207.00), category:'Outra Fonte', status:'received', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Salomao Salim Da Silva Batista', amount:toCents(1442.33), category:'Outra Fonte', status:'received', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Salomao Salim Da Silva Batista', amount:toCents(126.00), category:'Outra Fonte', status:'received', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Salomao Salim Da Silva Batista', amount:toCents(102.02), category:'Outra Fonte', status:'received', date:'2026-05-12', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Gilrlliany Lidya Justino', amount:toCents(12.30), category:'Outra Fonte', status:'received', date:'2026-05-14', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Gabriel Nunes Arruda Gurgel', amount:toCents(8.30), category:'Outra Fonte', status:'received', date:'2026-05-15', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Jonathan Evangelista Do Rego', amount:toCents(3.98), category:'Outra Fonte', status:'received', date:'2026-05-15', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Resgate RDB', amount:toCents(520.00), category:'Investimentos', status:'received', date:'2026-05-18', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Clelio Silva Batista', amount:toCents(350.00), category:'Outra Fonte', status:'received', date:'2026-05-19', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Resgate RDB', amount:toCents(90.00), category:'Investimentos', status:'received', date:'2026-05-24', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Unimed Natal (Reembolso)', amount:toCents(808.12), category:'Outra Fonte', status:'received', date:'2026-05-26', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Elizandra Andre De Oliveira', amount:toCents(300.00), category:'Outra Fonte', status:'received', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
    mkInc({ description:'Eric Vinicius Reinaldo (Reemb.)', amount:toCents(10.00), category:'Outra Fonte', status:'received', date:'2026-05-30', installments:1, installmentMonth:null }, 5, 2026),
  ];

  return [
    ...mar_exp.map(e => mkExp(e, 3, 2026)),
    ...apr_exp.map(e => mkExp(e, 4, 2026)),
    ...income,
    ...may_exp,
    ...may_inc,
  ];
};

// ===================== STATE =====================
const FinCtx = createContext(null);
const INIT_STATE = { transactions: [], view: 'dashboard', month: new Date().getMonth() + 1, year: new Date().getFullYear(), loading: true, syncing: false };

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TXN': return { ...state, transactions: action.payload, loading: false };
    case 'ADD_TXN': return { ...state, transactions: [...state.transactions, action.payload] };
    case 'UPD_TXN': return { ...state, transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DEL_TXN': return { ...state, transactions: state.transactions.filter(t => t.id !== action.id) };
    case 'SET_VIEW': return { ...state, view: action.payload };
    case 'SET_MONTH': return { ...state, month: action.month, year: action.year };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_SYNCING': return { ...state, syncing: action.payload };
    default: return state;
  }
}

// ===================== SUPABASE HELPERS =====================
async function dbLoad() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
  if (error) { console.error('Supabase load error:', error); return null; }
  return data.map(r => ({
    id: r.id, type: r.type, description: r.description, amount: r.amount,
    category: r.category, group: r.group_name, subcategory: r.subcategory,
    status: r.status, paymentMethod: r.payment_method, date: r.date,
    month: r.month, year: r.year,
    installments: r.installments || 1, installmentMonth: r.installment_month || null,
  }));
}

const toDbRow = txn => ({
  id: txn.id, type: txn.type, description: txn.description, amount: txn.amount,
  category: txn.category, group_name: txn.group, subcategory: txn.subcategory,
  status: txn.status, payment_method: txn.paymentMethod, date: txn.date,
  month: txn.month, year: txn.year,
  installments: txn.installments || 1, installment_month: txn.installmentMonth || null,
});

async function dbInsert(txn) {
  if (!supabase) return;
  return supabase.from('transactions').insert([toDbRow(txn)]);
}

async function loadDriveTransactions() {
  try {
    const response = await fetch('/nubank-transactions.json');
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('Extrato Nubank indisponível:', error);
    return [];
  }
}

async function dbUpdate(txn) {
  if (!supabase) return;
  await supabase.from('transactions').update({
    type: txn.type, description: txn.description, amount: txn.amount,
    category: txn.category, group_name: txn.group, subcategory: txn.subcategory,
    status: txn.status, payment_method: txn.paymentMethod, date: txn.date,
    month: txn.month, year: txn.year,
    installments: txn.installments || 1, installment_month: txn.installmentMonth || null,
  }).eq('id', txn.id);
}

async function dbDelete(id) {
  if (!supabase) return;
  await supabase.from('transactions').delete().eq('id', id);
}

// ===================== PROVIDER =====================
function FinProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT_STATE);

  useEffect(() => {
    let channel;
    let active = true;
    async function init() {
      dispatch({ type: 'SET_LOADING', payload: true });
      const imported = await loadDriveTransactions();
      if (supabase) {
        const remote = await dbLoad();
        const existing = remote && remote.length > 0 ? remote : SEED();
        const knownIds = new Set(existing.map(t => t.id));
        const missing = imported.filter(t => !knownIds.has(t.id));
        if (active) dispatch({ type: 'SET_TXN', payload: [...existing, ...missing] });
        // Imported CSV rows are displayed without writing them to Supabase.
        // Realtime subscription
        channel = supabase.channel('transactions-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async () => {
            const fresh = await dbLoad();
            if (active && fresh) {
              const freshIds = new Set(fresh.map(t => t.id));
              dispatch({ type: 'SET_TXN', payload: [...fresh, ...imported.filter(t => !freshIds.has(t.id))] });
            }
          }).subscribe();
      } else {
        try {
          const saved = localStorage.getItem('fin_txns_v3');
          if (saved) {
            const local = JSON.parse(saved);
            const knownIds = new Set(local.map(t => t.id));
            const missing = imported.filter(t => !knownIds.has(t.id));
            if (active) dispatch({ type: 'SET_TXN', payload: [...local, ...missing] });
          } else if (active) dispatch({ type: 'SET_TXN', payload: [...SEED(), ...imported] });
        } catch {
          if (active) dispatch({ type: 'SET_TXN', payload: [...SEED(), ...imported] });
        }
      }
    }
    init();
    return () => {
      active = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!supabase && state.transactions.length > 0 && !state.loading) {
      localStorage.setItem('fin_txns_v3', JSON.stringify(state.transactions));
    }
  }, [state.transactions, state.loading]);

  const actions = {
    addTxn: async txn => {
      dispatch({ type: 'ADD_TXN', payload: txn });
      await dbInsert(txn);
    },
    updTxn: async txn => {
      dispatch({ type: 'UPD_TXN', payload: txn });
      await dbUpdate(txn);
    },
    delTxn: async id => {
      dispatch({ type: 'DEL_TXN', id });
      await dbDelete(id);
    },
  };

  return <FinCtx.Provider value={{ state, dispatch, actions }}>{children}</FinCtx.Provider>;
}

const useFin = () => useContext(FinCtx);

// ===================== TOOLTIP HOOK =====================
function useTooltip() {
  const [tooltip, setTooltip] = useState(null);
  const show = useCallback((e, content) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, content });
  }, []);
  const hide = useCallback(() => setTooltip(null), []);
  return { tooltip, show, hide };
}

function Tooltip({ tooltip }) {
  if (!tooltip) return null;
  return (
    <div style={{
      position: 'fixed', left: tooltip.x, top: tooltip.y,
      transform: 'translate(-50%,-100%)',
      background: 'var(--s3)', border: '1px solid var(--bd2)',
      borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--t1)',
      pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    }}>
      {tooltip.content}
      <div style={{ position:'absolute', left:'50%', bottom:-5, transform:'translateX(-50%)',
        width:8, height:8, background:'var(--s3)', border:'1px solid var(--bd2)',
        borderTop:'none', borderLeft:'none', transform:'translateX(-50%) rotate(45deg)' }}/>
    </div>
  );
}

// ===================== DONUT CHART (Interactive) =====================
function DonutChart({ data, total, size = 200 }) {
  const { tooltip, show, hide } = useTooltip();
  const [hovered, setHovered] = useState(null);
  if (!data.length) return <div style={{ textAlign:'center', color:'var(--t3)', padding:40 }}>Sem dados</div>;
  const r = 72, cx = size / 2, cy = size / 2, stroke = 26;
  let acc = 0;
  const slices = data.slice(0, 10).map((d, i) => {
    const pct = d.amt / total;
    const start = acc * 2 * Math.PI - Math.PI / 2;
    acc += pct;
    const end = acc * 2 * Math.PI - Math.PI / 2;
    const lg = end - start > Math.PI ? 1 : 0;
    const expand = hovered === i ? 4 : 0;
    const midAngle = (start + end) / 2;
    const ox = Math.cos(midAngle) * expand;
    const oy = Math.sin(midAngle) * expand;
    const x1 = cx + ox + r * Math.cos(start), y1 = cy + oy + r * Math.sin(start);
    const x2 = cx + ox + r * Math.cos(end), y2 = cy + oy + r * Math.sin(end);
    return { ...d, path: `M ${cx + ox} ${cy + oy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`, color: CAT_COLORS[i % CAT_COLORS.length], i, pct };
  });
  return (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:'visible' }}>
        <circle cx={cx} cy={cy} r={r} fill="var(--s2)" />
        {slices.map((s) => (
          <path key={s.i} d={s.path} fill={s.color}
            opacity={hovered === null || hovered === s.i ? 0.92 : 0.45}
            style={{ cursor:'pointer', transition:'opacity 0.15s' }}
            onMouseEnter={e => { setHovered(s.i); show(e, s.cat + ' — ' + fmt(s.amt) + ' (' + (s.pct * 100).toFixed(1) + '%)'); }}
            onMouseLeave={() => { setHovered(null); hide(); }}
            onTouchStart={e => { setHovered(s.i); }}
            onTouchEnd={() => { setHovered(null); }}
          />
        ))}
        <circle cx={cx} cy={cy} r={r - stroke} fill="var(--s1)" />
        <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--t3)" fontSize="10">Total</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--t1)" fontSize="13" fontWeight="700">
          {(total / 100).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 })}
        </text>
      </svg>
      <Tooltip tooltip={tooltip} />
    </>
  );
}

// ===================== LINE CHART (Interactive) =====================
function LineChart({ data, width = 520, height = 170 }) {
  const { tooltip, show, hide } = useTooltip();
  if (!data.length || data.every(d => d.inc === 0 && d.exp === 0))
    return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)' }}>Sem dados</div>;
  const pad = { t:16, b:34, l:60, r:16 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const vals = [...data.flatMap(d => [d.inc, d.exp])].filter(v => v > 0);
  const maxV = Math.max(...vals) || 1;
  const scX = i => pad.l + i * (W / (data.length - 1 || 1));
  const scY = v => pad.t + H - (v / maxV) * H;
  const pathOf = key => {
    const pts = data.map((d, i) => `${scX(i)},${scY(d[key])}`);
    return 'M ' + pts.join(' L ');
  };
  return (
    <>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow:'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={pad.l} x2={width - pad.r} y1={pad.t + H * (1 - t)} y2={pad.t + H * (1 - t)} stroke="var(--bd)" strokeWidth=".5" />
        ))}
        {data.map((d, i) => (
          <text key={i} x={scX(i)} y={height - 6} textAnchor="middle" fill="var(--t3)" fontSize="10">{d.label}</text>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <text key={i} x={pad.l - 6} y={pad.t + H * (1 - t) + 4} textAnchor="end" fill="var(--t3)" fontSize="9">
            {(maxV * t / 100).toFixed(0)}k
          </text>
        ))}
        <path d={pathOf('inc')} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathOf('exp')} fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            {d.inc > 0 && (
              <circle cx={scX(i)} cy={scY(d.inc)} r="5" fill="var(--green)"
                style={{ cursor:'pointer' }}
                onMouseEnter={e => show(e, MONTHS_F[d.month - 1] + ' — Entrada: ' + fmt(d.inc))}
                onMouseLeave={hide}
              />
            )}
            {d.exp > 0 && (
              <circle cx={scX(i)} cy={scY(d.exp)} r="5" fill="var(--red)"
                style={{ cursor:'pointer' }}
                onMouseEnter={e => show(e, MONTHS_F[d.month - 1] + ' — Saida: ' + fmt(d.exp))}
                onMouseLeave={hide}
              />
            )}
          </g>
        ))}
      </svg>
      <Tooltip tooltip={tooltip} />
    </>
  );
}

// ===================== BAR CHART (Interactive) =====================
function BarChart({ data, width = 420, height = 150 }) {
  const { tooltip, show, hide } = useTooltip();
  const [hovered, setHovered] = useState(null);
  if (!data.length) return null;
  const pad = { t:12, b:30, l:10, r:10 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const maxV = Math.max(...data.flatMap(d => [d.inc, d.exp])) || 1;
  const bw = Math.max(6, (W / (data.length * 2.8)) - 2);
  const gap = W / data.length;
  return (
    <>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow:'visible' }}>
        {data.map((d, i) => {
          const x = pad.l + i * gap + gap / 2;
          const hI = (d.inc / maxV) * H, hE = (d.exp / maxV) * H;
          return (
            <g key={i}>
              <rect x={x - bw - 1} y={pad.t + H - hI} width={bw} height={hI} fill="var(--green)" rx="3"
                opacity={hovered === null || hovered === i + 'i' ? 0.85 : 0.35}
                style={{ cursor:'pointer' }}
                onMouseEnter={e => { setHovered(i + 'i'); show(e, d.label + ' Entrada: ' + fmt(d.inc)); }}
                onMouseLeave={() => { setHovered(null); hide(); }}
              />
              <rect x={x + 1} y={pad.t + H - hE} width={bw} height={hE} fill="var(--red)" rx="3"
                opacity={hovered === null || hovered === i + 'e' ? 0.85 : 0.35}
                style={{ cursor:'pointer' }}
                onMouseEnter={e => { setHovered(i + 'e'); show(e, d.label + ' Saida: ' + fmt(d.exp)); }}
                onMouseLeave={() => { setHovered(null); hide(); }}
              />
              <text x={x} y={height - 8} textAnchor="middle" fill="var(--t3)" fontSize="9">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <Tooltip tooltip={tooltip} />
    </>
  );
}

// ===================== HEATMAP CHART (Interactive) =====================
function HeatmapChart({ txns }) {
  const { tooltip, show, hide } = useTooltip();
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
  const weeks = ['S1','S2','S3','S4','S5'];
  const grid = Array.from({ length: 7 }, () => Array(5).fill(0));
  txns.forEach(t => {
    if (t.type !== 'expense') return;
    const d = new Date(t.date + 'T12:00:00');
    const day = d.getDay();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const week = Math.floor((d.getDate() - 1 + firstDay) / 7);
    if (week < 5) grid[day][week] += t.amount;
  });
  const max = Math.max(...grid.flatMap(r => r)) || 1;
  const cellColor = v => {
    if (!v) return 'var(--s3)';
    const intensity = v / max;
    if (intensity < 0.2) return 'rgba(255,63,91,.15)';
    if (intensity < 0.4) return 'rgba(255,63,91,.3)';
    if (intensity < 0.6) return 'rgba(255,63,91,.5)';
    if (intensity < 0.8) return 'rgba(255,63,91,.7)';
    return 'rgba(255,63,91,.95)';
  };
  return (
    <>
      <div style={{ display:'flex', gap:3, marginBottom:4, marginLeft:38 }}>
        {weeks.map(w => <div key={w} style={{ width:44, textAlign:'center', fontSize:10, color:'var(--t3)' }}>{w}</div>)}
      </div>
      {days.map((day, di) => (
        <div key={day} style={{ display:'flex', alignItems:'center', gap:3, marginBottom:3 }}>
          <div style={{ width:34, fontSize:10, color:'var(--t3)', textAlign:'right', paddingRight:4 }}>{day}</div>
          {weeks.map((_, wi) => (
            <div key={wi}
              style={{ width:44, height:28, borderRadius:4, background:cellColor(grid[di][wi]),
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, color:'rgba(255,255,255,.7)', fontFamily:'monospace', cursor: grid[di][wi] > 0 ? 'pointer' : 'default' }}
              onMouseEnter={grid[di][wi] > 0 ? e => show(e, days[di] + ' ' + weeks[wi] + ': ' + fmt(grid[di][wi])) : undefined}
              onMouseLeave={hide}
            >
              {grid[di][wi] > 0 ? (grid[di][wi] / 100).toFixed(0) : ''}
            </div>
          ))}
        </div>
      ))}
      <Tooltip tooltip={tooltip} />
    </>
  );
}

// ===================== PROGRESS BAR CHART =====================
function CategoryBars({ data, total }) {
  const { tooltip, show, hide } = useTooltip();
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {data.slice(0, 8).map((c, i) => (
        <div key={c.cat}
          style={{ cursor:'pointer', opacity: hovered === null || hovered === i ? 1 : 0.5, transition:'opacity 0.15s' }}
          onMouseEnter={e => { setHovered(i); show(e, c.cat + ': ' + fmt(c.amt) + ' (' + ((c.amt / total) * 100).toFixed(1) + '%)'); }}
          onMouseLeave={() => { setHovered(null); hide(); }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:CAT_COLORS[i % CAT_COLORS.length], display:'inline-block' }} />
              {c.cat}
            </span>
            <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--t2)' }}>{fmt(c.amt)}</span>
          </div>
          <div className="prog-bar">
            <div className="prog-fill" style={{ width:((c.amt / total * 100) || 0) + '%', background:CAT_COLORS[i % CAT_COLORS.length], transition:'width 0.6s ease' }} />
          </div>
        </div>
      ))}
      <Tooltip tooltip={tooltip} />
    </div>
  );
}

// ===================== SPARKLINE =====================
function Sparkline({ values, color = 'var(--green)', height = 40, width = 120 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const scX = i => (i / (values.length - 1)) * width;
  const scY = v => height - ((v - min) / range) * (height - 6) - 3;
  const pts = values.map((v, i) => scX(i) + ',' + scY(v)).join(' L ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={'M ' + pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ===================== UI COMPONENTS =====================
function MonthSelector({ month, year, onChange }) {
  const prev = () => { if (month === 1) onChange(12, year - 1); else onChange(month - 1, year); };
  const next = () => { if (month === 12) onChange(1, year + 1); else onChange(month + 1, year); };
  return (
    <div className="month-sel">
      <button className="month-btn" onClick={prev}>&#8249;</button>
      <div className="month-display">{MONTHS_F[month - 1].slice(0, 3)} {year}</div>
      <button className="month-btn" onClick={next}>&#8250;</button>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { paid:'Pago', received:'Recebido', pending:'Pendente', overdue:'Vencido' };
  const icon = status === 'paid' || status === 'received' ? '✓ ' : status === 'pending' ? '○ ' : '! ';
  return <span className={`badge ${status}`}>{icon}{map[status] || status}</span>;
}

function PayBadge({ method }) {
  if (!method) return null;
  return <span className={`pay-badge pay-${method}`}>{PAY_LABELS[method] || method}</span>;
}

function GroupBadge({ group }) {
  const colors = { necessidades:'var(--blue)', desejos:'var(--amber)', futuro:'var(--purple)' };
  const labels = { necessidades:'Necessidades', desejos:'Desejos', futuro:'Futuro' };
  return <span style={{ color:colors[group] || 'var(--t2)', fontSize:11, fontWeight:500 }}>{labels[group] || group}</span>;
}

// ===================== AMOUNT INPUT =====================
function AmountInput({ value, onChange, placeholder = '0,00' }) {
  const [raw, setRaw] = useState(value === '' ? '' : value === 0 ? '' : fromCents(value));

  useEffect(() => {
    if (value === '' || value === 0) setRaw('');
    else setRaw(fromCents(value));
  }, []);

  const handleChange = e => {
    let v = e.target.value;
    // Allow only digits, comma, and dot
    v = v.replace(/[^0-9.,]/g, '');
    // Only one decimal separator
    const parts = v.split(/[.,]/);
    if (parts.length > 2) v = parts[0] + ',' + parts.slice(1).join('');
    setRaw(v);
    const parsed = parseFloat(v.replace(',', '.'));
    if (!isNaN(parsed)) onChange(toCents(parsed));
    else onChange(0);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={handleChange}
      placeholder={placeholder}
    />
  );
}

// ===================== TRANSACTION MODAL =====================
function TxnModal({ txn, type, onSave, onClose }) {
  const initAmount = txn ? txn.amount : 0;
  const [form, setForm] = useState(txn || {
    description:'', amount:0, category: type === 'income' ? 'Salario' : 'Alimentacao',
    group:'necessidades', subcategory:'variable', status: type === 'income' ? 'received' : 'pending',
    paymentMethod:'pix', date:todayISO(), type,
    installments:1, installmentMonth:null,
  });
  const [amtCents, setAmtCents] = useState(initAmount);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isCredit = form.paymentMethod === 'credit';

  const handleDateChange = v => {
    const { month, year } = dateToMonthYear(v);
    setForm(f => ({ ...f, date:v, month, year }));
  };

  const submit = () => {
    if (!form.description || amtCents === 0) return;
    const { month, year } = dateToMonthYear(form.date);
    onSave({
      ...form, id: txn ? txn.id : uuid(), amount: amtCents,
      month, year, type: form.type || type,
      installments: isCredit ? (parseInt(form.installments) || 1) : 1,
      installmentMonth: isCredit ? (parseInt(form.installmentMonth) || month) : null,
    });
  };

  return (
    <div className="overlay" onClick={e => { if (e.target.classList.contains('overlay')) onClose(); }}>
      <div className="modal">
        <div className="modal-title">
          <span>{txn ? 'Editar' : 'Nova'} {type === 'income' ? 'Entrada' : 'Saida'}</span>
          <button className="btn-icon" onClick={onClose}>&#x2715;</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="form-group">
            <label className="lbl">Descricao *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Mercado, Salario..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="lbl">Valor (R$) *</label>
              <AmountInput value={amtCents} onChange={setAmtCents} />
            </div>
            <div className="form-group">
              <label className="lbl">Data</label>
              <input type="date" value={form.date} onChange={e => handleDateChange(e.target.value)} />
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
                  ? ['received','pending'].map(s => <option key={s} value={s}>{s === 'received' ? 'Recebido' : 'Pendente'}</option>)
                  : ['paid','pending','overdue'].map(s => <option key={s} value={s}>{s === 'paid' ? 'Pago' : s === 'pending' ? 'Pendente' : 'Vencido'}</option>)}
              </select>
            </div>
          </div>
          {type === 'expense' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="lbl">Grupo (50/30/20)</label>
                  <select value={form.group} onChange={e => set('group', e.target.value)}>
                    <option value="necessidades">Necessidades (50%)</option>
                    <option value="desejos">Desejos (30%)</option>
                    <option value="futuro">Futuro (20%)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="lbl">Tipo</label>
                  <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)}>
                    <option value="fixed">Fixo</option>
                    <option value="variable">Variavel</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="lbl">Forma de Pagamento</label>
                <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                  {PAY_METHODS.map(m => <option key={m} value={m}>{PAY_LABELS[m]}</option>)}
                </select>
              </div>
              {isCredit && (
                <div style={{ background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:'var(--r2)', padding:14, display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ fontSize:12, color:'var(--blue)', fontWeight:600 }}>&#128179; Opcoes de Credito</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="lbl">Numero de Parcelas</label>
                      <select value={form.installments} onChange={e => set('installments', parseInt(e.target.value))}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(n => (
                          <option key={n} value={n}>{n === 1 ? 'A vista (1x)' : n + 'x'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="lbl">Mes da Compra</label>
                      <select value={form.installmentMonth || dateToMonthYear(form.date).month} onChange={e => set('installmentMonth', parseInt(e.target.value))}>
                        {MONTHS_F.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  {form.installments > 1 && (
                    <div style={{ fontSize:12, color:'var(--t3)', background:'var(--s3)', borderRadius:6, padding:'8px 12px' }}>
                      Valor por parcela: <b style={{ color:'var(--t1)', fontFamily:'monospace' }}>{fmt(Math.round(amtCents / form.installments))}</b>
                      {' '} &#x2022; Parcela atual: {form.installmentMonth || dateToMonthYear(form.date).month}/{dateToMonthYear(form.date).year}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={submit}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== DASHBOARD =====================
function Dashboard() {
  const { state } = useFin();
  const { transactions, month, year } = state;
  const monthTxns = filterMonth(transactions, month, year);
  const incTxns = filterType(monthTxns, 'income');
  const expTxns = filterType(monthTxns, 'expense');
  const inc = sumAmts(incTxns), exp = sumAmts(expTxns), net = inc - exp;
  const sr = savingsRate(inc, exp);
  const monthly = getMonthlyTotals(transactions, year).filter(m => m.inc > 0 || m.exp > 0);
  const catData = groupByCat(expTxns);
  const groups = groupsByType(expTxns);
  const pending = expTxns.filter(t => t.status === 'pending' || t.status === 'overdue');
  const pendingAmt = sumAmts(pending);
  const incHistory = getMonthlyTotals(transactions, year).map(m => m.inc);
  const expHistory = getMonthlyTotals(transactions, year).map(m => m.exp);

  return (
    <div className="content">
      <div className="cards-row">
        <div className="card green">
          <div className="card-label">&#8593; Entradas</div>
          <div className="card-value">{fmt(inc)}</div>
          <div className="card-sub">{incTxns.length} recebimentos</div>
          <div style={{ position:'absolute', bottom:12, right:12 }}><Sparkline values={incHistory} color="var(--green)" /></div>
        </div>
        <div className="card red">
          <div className="card-label">&#8595; Saidas</div>
          <div className="card-value">{fmt(exp)}</div>
          <div className="card-sub">{expTxns.length} transacoes</div>
          <div style={{ position:'absolute', bottom:12, right:12 }}><Sparkline values={expHistory} color="var(--red)" /></div>
        </div>
        <div className={`card ${net >= 0 ? 'blue' : 'red'}`}>
          <div className="card-label">= Saldo Liquido</div>
          <div className="card-value">{fmtSigned(net)}</div>
          <div className="card-sub">{net >= 0 ? 'Superavit' : 'Deficit'} no mes</div>
        </div>
        <div className="card amber">
          <div className="card-label">&#9203; A Pagar</div>
          <div className="card-value">{fmt(pendingAmt)}</div>
          <div className="card-sub">{pending.length} pendentes</div>
        </div>
      </div>

      {inc > 0 && (
        <div className="chart-card">
          <div className="chart-title">Taxa de Poupanca</div>
          <div className="chart-sub">{sr >= 0 ? fmtPct(sr) + ' do salario poupado' : 'Gastos excedem renda em ' + fmtPct(Math.abs(sr))}</div>
          <div className="prog-bar" style={{ height:10 }}>
            <div className="prog-fill" style={{ width: Math.min(100, Math.max(0, sr)) + '%', background: sr >= 20 ? 'var(--green)' : sr >= 0 ? 'var(--amber)' : 'var(--red)', transition:'width 0.8s ease' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--t3)' }}>
            <span>Meta: 20%</span>
            <span style={{ color: sr >= 20 ? 'var(--green)' : sr >= 10 ? 'var(--amber)' : 'var(--red)' }}>
              {sr >= 20 ? '✓ Otimo' : sr >= 10 ? 'Razoavel' : 'Melhorar'}
            </span>
          </div>
        </div>
      )}

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Evolucao Anual {year}</div>
          <div className="chart-sub">Entradas vs Saidas — passe o mouse nos pontos</div>
          <LineChart data={monthly} />
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background:'var(--green)' }} /> Entradas</div>
            <div className="legend-item"><div className="legend-dot" style={{ background:'var(--red)' }} /> Saidas</div>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Gastos por Categoria</div>
          <div className="chart-sub">Passe o mouse para detalhes</div>
          <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
            <DonutChart data={catData} total={exp} />
            <div style={{ flex:1, overflow:'hidden' }}>
              <CategoryBars data={catData} total={exp} />
            </div>
          </div>
        </div>
      </div>

      {exp > 0 && (
        <div className="chart-card">
          <div className="chart-title">Regra 50/30/20</div>
          <div className="chart-sub">Necessidades · Desejos · Futuro</div>
          <div className="budget-split">
            {[
              { key:'necessidades', label:'Necessidades', target:50, color:'var(--blue)' },
              { key:'desejos', label:'Desejos', target:30, color:'var(--amber)' },
              { key:'futuro', label:'Futuro / Poupanca', target:20, color:'var(--purple)' },
            ].map(g => {
              const amt = groups[g.key] || 0;
              const pct = exp ? (amt / exp) * 100 : 0;
              const ok = pct <= g.target;
              return (
                <div key={g.key} className="budget-item">
                  <div className="budget-cat"><span className="budget-cat-dot" style={{ background:g.color }} />{g.label}</div>
                  <div className="budget-amt" style={{ color:g.color }}>{fmt(amt)}</div>
                  <div className="budget-target">{pct.toFixed(1)}% · meta {g.target}% {ok ? '✓' : '!'}</div>
                  <div className="prog-bar" style={{ height:8 }}>
                    <div className="prog-fill" style={{ width: Math.min(100, pct) + '%', background:g.color, transition:'width 0.8s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="table-wrap">
          <div className="table-header"><div className="table-title">&#9888; Pendencias do Mes</div></div>
          <table>
            <thead><tr><th>Descricao</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {pending.map(t => (
                <tr key={t.id}>
                  <td>{t.description}</td><td>{t.category}</td><td>{t.date}</td>
                  <td style={{ fontFamily:'monospace', color:'var(--red)' }}>{fmt(t.amount)}</td>
                  <td><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="3">Total pendente</td><td colSpan="2" style={{ color:'var(--red)' }}>{fmt(pendingAmt)}</td></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== INCOME PAGE =====================
function IncomePage() {
  const { state, actions } = useFin();
  const { transactions, month, year } = state;
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const monthTxns = filterMonth(filterType(transactions, 'income'), month, year);
  const filtered = monthTxns.filter(t =>
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );
  const total = sumAmts(filtered);
  const received = sumAmts(filtered.filter(t => t.status === 'received'));

  const save = async txn => {
    if (txn.id && transactions.find(t => t.id === txn.id)) await actions.updTxn(txn);
    else await actions.addTxn({ ...txn, type:'income' });
    setModal(null);
  };

  return (
    <div className="content">
      <div className="cards-row" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
        <div className="card green"><div className="card-label">Total Entradas</div><div className="card-value">{fmt(total)}</div></div>
        <div className="card blue"><div className="card-label">Recebido</div><div className="card-value">{fmt(received)}</div></div>
        <div className="card amber"><div className="card-label">Pendente</div><div className="card-value">{fmt(total - received)}</div></div>
      </div>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Entradas — {MONTHS_F[month - 1]} {year}</div>
          <div className="table-controls">
            <input style={{ width:180 }} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-primary" onClick={() => setModal({ type:'income' })}>+ Nova Entrada</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Descricao</th><th>Categoria</th><th>Data</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="6" style={{ textAlign:'center', color:'var(--t3)', padding:24 }}>Nenhuma entrada registrada</td></tr>}
            {filtered.map(t => (
              <tr key={t.id}>
                <td><b>{t.description}</b></td>
                <td>{t.category}</td>
                <td>{t.date}</td>
                <td><StatusBadge status={t.status} /></td>
                <td style={{ fontFamily:'monospace', color:'var(--green)', fontWeight:700 }}>{fmt(t.amount)}</td>
                <td>
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn-icon" onClick={() => setModal({ ...t, _edit:true })}>&#9998;</button>
                    <button className="btn-icon btn-danger" onClick={() => { if (confirm('Excluir?')) actions.delTxn(t.id); }}>&#x2715;</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && <tfoot><tr><td colSpan="4">Total</td><td>{fmt(total)}</td><td /></tr></tfoot>}
        </table>
      </div>
      {modal && <TxnModal txn={modal._edit ? modal : null} type={modal.type || 'income'} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}

// ===================== EXPENSES PAGE =====================
function ExpensesPage() {
  const { state, actions } = useFin();
  const { transactions, month, year } = state;
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filterGrp, setFilterGrp] = useState('all');
  const [filterSub, setFilterSub] = useState('all');
  const [filterPay, setFilterPay] = useState('all');
  const monthTxns = filterMonth(filterType(transactions, 'expense'), month, year);
  const filtered = monthTxns.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    const matchG = filterGrp === 'all' || t.group === filterGrp;
    const matchS = filterSub === 'all' || t.subcategory === filterSub;
    const matchP = filterPay === 'all' || t.paymentMethod === filterPay;
    return matchQ && matchG && matchS && matchP;
  });
  const total = sumAmts(filtered);
  const paid = sumAmts(filtered.filter(t => t.status === 'paid'));
  const pending = sumAmts(filtered.filter(t => t.status === 'pending' || t.status === 'overdue'));
  const creditTotal = sumAmts(filtered.filter(t => t.paymentMethod === 'credit'));

  const save = async txn => {
    if (txn.id && transactions.find(t => t.id === txn.id)) await actions.updTxn(txn);
    else await actions.addTxn({ ...txn, type:'expense' });
    setModal(null);
  };

  return (
    <div className="content">
      <div className="cards-row">
        <div className="card red"><div className="card-label">Total Saidas</div><div className="card-value">{fmt(total)}</div></div>
        <div className="card green"><div className="card-label">Pago</div><div className="card-value">{fmt(paid)}</div></div>
        <div className="card amber"><div className="card-label">Pendente</div><div className="card-value">{fmt(pending)}</div></div>
        <div className="card blue"><div className="card-label">&#128179; Credito</div><div className="card-value">{fmt(creditTotal)}</div></div>
      </div>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Saidas — {MONTHS_F[month - 1]} {year}</div>
          <div className="table-controls" style={{ flexWrap:'wrap', gap:8 }}>
            <input style={{ width:140 }} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ width:130 }} value={filterGrp} onChange={e => setFilterGrp(e.target.value)}>
              <option value="all">Todos grupos</option>
              <option value="necessidades">Necessidades</option>
              <option value="desejos">Desejos</option>
              <option value="futuro">Futuro</option>
            </select>
            <select style={{ width:110 }} value={filterSub} onChange={e => setFilterSub(e.target.value)}>
              <option value="all">Fixo/Variavel</option>
              <option value="fixed">Fixo</option>
              <option value="variable">Variavel</option>
            </select>
            <select style={{ width:110 }} value={filterPay} onChange={e => setFilterPay(e.target.value)}>
              <option value="all">Pagamento</option>
              {PAY_METHODS.map(m => <option key={m} value={m}>{PAY_LABELS[m]}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => setModal({ type:'expense' })}>+ Nova Saida</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Descricao</th><th>Categoria</th><th>Grupo</th>
              <th>Pagamento</th><th>Parcelas</th><th>Status</th><th>Valor</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="8" style={{ textAlign:'center', color:'var(--t3)', padding:24 }}>Nenhuma saida registrada</td></tr>}
            {filtered.map(t => (
              <tr key={t.id}>
                <td>
                  <b>{t.description}</b>
                  <br />
                  <span style={{ fontSize:11, color:'var(--t3)' }}>{t.subcategory === 'fixed' ? 'Fixo' : 'Variavel'}</span>
                </td>
                <td>{t.category}</td>
                <td><GroupBadge group={t.group} /></td>
                <td><PayBadge method={t.paymentMethod} /></td>
                <td style={{ fontSize:12, color: t.installments > 1 ? 'var(--blue)' : 'var(--t3)' }}>
                  {t.installments > 1 ? t.installmentMonth + '/' + year + ' — ' + t.installments + 'x' : 'A vista'}
                </td>
                <td><StatusBadge status={t.status} /></td>
                <td style={{ fontFamily:'monospace', color:'var(--red)', fontWeight:700 }}>{fmt(t.amount)}</td>
                <td>
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn-icon" onClick={() => setModal({ ...t, _edit:true })}>&#9998;</button>
                    <button className="btn-icon" style={{ color:'var(--red)' }} onClick={() => { if (confirm('Excluir?')) actions.delTxn(t.id); }}>&#x2715;</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot><tr><td colSpan="6">Total ({filtered.length} itens)</td><td>{fmt(total)}</td><td /></tr></tfoot>
          )}
        </table>
      </div>
      {modal && <TxnModal txn={modal._edit ? modal : null} type={modal.type || 'expense'} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}

// ===================== CALENDAR PAGE =====================
function CalendarPage() {
  const { state } = useFin();
  const { transactions, month, year } = state;
  const monthTxns = filterMonth(transactions, month, year);
  const [selected, setSelected] = useState(null);
  const today = new Date();
  const isToday = d => d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
  const grid = buildCalGrid(year, month);
  const byDay = {};
  monthTxns.forEach(t => {
    const d = parseInt(t.date.split('-')[2]);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(t);
  });
  const selTxns = selected ? byDay[selected] || [] : [];

  return (
    <div className="content">
      <div className="chart-card">
        <div className="chart-title">Calendario — {MONTHS_F[month - 1]} {year}</div>
        <div className="chart-sub">Toque em um dia para ver as transacoes</div>
        <div className="cal-grid" style={{ marginTop:12 }}>
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => <div key={d} className="cal-hdr">{d}</div>)}
          {grid.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="cal-day empty" />;
            const txns = byDay[d] || [];
            const inc = txns.filter(t => t.type === 'income');
            const exp = txns.filter(t => t.type === 'expense');
            return (
              <div key={d} className={`cal-day ${isToday(d) ? 'today' : ''}`}
                style={selected === d ? { borderColor:'var(--green)', background:'var(--green-dim)' } : {}}
                onClick={() => setSelected(selected === d ? null : d)}>
                <div className="cal-day-num">{d}</div>
                <div className="cal-dots">
                  {inc.map((_, j) => <div key={`i${j}`} className="cal-dot" style={{ background:'var(--green)' }} />)}
                  {exp.map((_, j) => <div key={`e${j}`} className="cal-dot" style={{ background:'var(--red)' }} />)}
                </div>
                {txns.length > 0 && <div style={{ fontSize:9, color:'var(--t3)', marginTop:2 }}>{fmt(sumAmts(txns))}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Transacoes — {selected}/{String(month).padStart(2, '0')}/{year}</div>
          </div>
          {selTxns.length === 0
            ? <div style={{ padding:20, color:'var(--t3)', textAlign:'center' }}>Nenhuma transacao neste dia</div>
            : (
              <table>
                <thead><tr><th>Descricao</th><th>Tipo</th><th>Categoria</th><th>Status</th><th>Valor</th></tr></thead>
                <tbody>
                  {selTxns.map(t => (
                    <tr key={t.id}>
                      <td>{t.description}</td>
                      <td><span className={`badge ${t.type === 'income' ? 'received' : 'overdue'}`}>{t.type === 'income' ? '↑ Entrada' : '↓ Saida'}</span></td>
                      <td>{t.category}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td style={{ fontFamily:'monospace', color: t.type === 'income' ? 'var(--green)' : 'var(--red)', fontWeight:700 }}>{fmt(t.amount)}</td>
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
  const { state } = useFin();
  const { transactions, year } = state;
  const monthly = getMonthlyTotals(transactions, year);
  const activeMonths = monthly.filter(m => m.inc > 0 || m.exp > 0);
  const allExp = filterType(transactions, 'expense');
  const allInc = filterType(transactions, 'income');
  const totalExp = sumAmts(allExp);
  const totalInc = sumAmts(allInc);
  const catData = groupByCat(allExp);
  const creditExp = allExp.filter(t => t.paymentMethod === 'credit');
  const creditTotal = sumAmts(creditExp);
  const installmentExp = allExp.filter(t => t.installments > 1);

  return (
    <div className="content">
      <div className="cards-row">
        <div className="card green"><div className="card-label">Total Entradas {year}</div><div className="card-value">{fmt(totalInc)}</div></div>
        <div className="card red"><div className="card-label">Total Saidas {year}</div><div className="card-value">{fmt(totalExp)}</div></div>
        <div className={`card ${totalInc - totalExp >= 0 ? 'blue' : 'red'}`}>
          <div className="card-label">Saldo Anual</div>
          <div className="card-value">{fmtSigned(totalInc - totalExp)}</div>
        </div>
        <div className="card amber">
          <div className="card-label">Taxa Poupanca Media</div>
          <div className="card-value">{fmtPct(savingsRate(totalInc, totalExp))}</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Evolucao Mensal {year}</div>
          <div className="chart-sub">Barras comparativas — passe o mouse</div>
          <BarChart data={activeMonths} />
          <div className="legend" style={{ marginTop:8 }}>
            <div className="legend-item"><div className="legend-dot" style={{ background:'var(--green)' }} /> Entradas</div>
            <div className="legend-item"><div className="legend-dot" style={{ background:'var(--red)' }} /> Saidas</div>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Gastos por Categoria (Anual)</div>
          <div className="chart-sub">Todos os meses de {year} — interativo</div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <DonutChart data={catData} total={totalExp} size={160} />
            <CategoryBars data={catData} total={totalExp} />
          </div>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Heatmap de Gastos</div>
        <div className="chart-sub">Distribuicao por dia da semana — passe o mouse nas celulas</div>
        <HeatmapChart txns={allExp} />
      </div>

      {creditTotal > 0 && (
        <div className="chart-card">
          <div className="chart-title">&#128179; Analise de Credito</div>
          <div className="chart-sub">Gastos no cartao e parcelamentos</div>
          <div className="cards-row" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:16 }}>
            <div className="card blue" style={{ padding:'12px 16px' }}>
              <div className="card-label" style={{ fontSize:10 }}>Total Credito</div>
              <div className="card-value" style={{ fontSize:18 }}>{fmt(creditTotal)}</div>
            </div>
            <div className="card purple" style={{ padding:'12px 16px' }}>
              <div className="card-label" style={{ fontSize:10 }}>Parcelados</div>
              <div className="card-value" style={{ fontSize:18 }}>{installmentExp.length} itens</div>
            </div>
            <div className="card amber" style={{ padding:'12px 16px' }}>
              <div className="card-label" style={{ fontSize:10 }}>% do Total</div>
              <div className="card-value" style={{ fontSize:18 }}>{totalExp > 0 ? fmtPct(creditTotal / totalExp * 100) : '0%'}</div>
            </div>
          </div>
          {installmentExp.length > 0 && (
            <table>
              <thead><tr><th>Descricao</th><th>Compra</th><th>Parcelas</th><th>Valor/parcela</th><th>Total</th></tr></thead>
              <tbody>
                {installmentExp.map(t => (
                  <tr key={t.id}>
                    <td><b>{t.description}</b></td>
                    <td>{MONTHS_F[(t.installmentMonth || t.month) - 1]}/{t.year}</td>
                    <td style={{ color:'var(--blue)' }}>{t.installments}x</td>
                    <td style={{ fontFamily:'monospace' }}>{fmt(Math.round(t.amount / t.installments))}</td>
                    <td style={{ fontFamily:'monospace', color:'var(--red)' }}>{fmt(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="chart-card">
        <div className="chart-title">Breakdown Mensal Detalhado</div>
        <div className="chart-sub">Mes a mes — entradas, saidas e liquido</div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead>
              <tr><th>Mes</th><th>Entradas</th><th>Saidas</th><th>Liquido</th><th>Taxa Poupar</th><th>Status</th></tr>
            </thead>
            <tbody>
              {monthly.filter(m => m.inc > 0 || m.exp > 0).map(m => {
                const sr2 = savingsRate(m.inc, m.exp);
                return (
                  <tr key={m.month}>
                    <td><b>{MONTHS_F[m.month - 1]}</b></td>
                    <td style={{ fontFamily:'monospace', color:'var(--green)' }}>{fmt(m.inc)}</td>
                    <td style={{ fontFamily:'monospace', color:'var(--red)' }}>{fmt(m.exp)}</td>
                    <td style={{ fontFamily:'monospace', color: m.net >= 0 ? 'var(--blue)' : 'var(--red)', fontWeight:700 }}>{fmtSigned(m.net)}</td>
                    <td style={{ fontFamily:'monospace', color: sr2 >= 20 ? 'var(--green)' : sr2 >= 0 ? 'var(--amber)' : 'var(--red)' }}>{fmtPct(Math.abs(sr2))}</td>
                    <td><span className={`badge ${m.net >= 0 ? 'received' : 'overdue'}`}>{m.net >= 0 ? '✓ Superavit' : '! Deficit'}</span></td>
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
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
  income: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 19V5m-7 7 7-7 7 7" /></svg>,
  expense: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 5v14m7-7-7 7-7-7" /></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>,
  sync: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
};

// ===================== APP SHELL =====================
const NAV = [
  { id:'dashboard', label:'Dashboard', icon:Icons.dashboard },
  { id:'income', label:'Entradas', icon:Icons.income },
  { id:'expenses', label:'Saidas', icon:Icons.expense },
  { id:'calendar', label:'Calendario', icon:Icons.calendar },
  { id:'analytics', label:'Analytics', icon:Icons.analytics },
];

function Sidebar({ mobile, onClose }) {
  const { state, dispatch, actions } = useFin();
  const { view, transactions, month, year } = state;
  const monthTxns = filterMonth(transactions, month, year);
  const inc = sumAmts(filterType(monthTxns, 'income'));
  const exp = sumAmts(filterType(monthTxns, 'expense'));
  const net = inc - exp;
  const isSupabase = !!supabase;

  return (
    <>
      {mobile && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar ${mobile ? 'sidebar-mobile open' : ''}`}>
        <div className="logo">
          <div className="logo-title"><span style={{ fontSize:20 }}>&#128176;</span>Financeiro</div>
          <div className="logo-sub">Controle Familiar</div>
          {isSupabase && <div style={{ fontSize:10, color:'var(--green)', marginTop:4, display:'flex', alignItems:'center', gap:4 }}><span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block' }} />Sincronizado</div>}
        </div>
        <nav className="nav">
          {NAV.map(n => (
            <div key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => { dispatch({ type:'SET_VIEW', payload:n.id }); if (onClose) onClose(); }}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="balance-card">
            <div className="balance-label">Saldo do Mes</div>
            <div className="balance-value" style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtSigned(net)}</div>
            <div style={{ fontSize:10, color:'var(--t3)', marginTop:4 }}>{MONTHS_F[month - 1]} {year}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width:'100%', marginTop:8, justifyContent:'center', fontSize:11 }}
            onClick={() => { if (confirm('Resetar todos os dados?')) { localStorage.removeItem('fin_txns_v3'); window.location.reload(); } }}>
            <span style={{ width:14, height:14, display:'inline-block' }}>{Icons.sync}</span> Resetar Dados
          </button>
        </div>
      </div>
    </>
  );
}

const PAGE_TITLES = { dashboard:'Dashboard', income:'Entradas', expenses:'Saidas', calendar:'Calendario', analytics:'Analytics' };
const PAGE_SUBS = { dashboard:'Visao geral financeira', income:'Controle de ganhos', expenses:'Controle de gastos', calendar:'Calendario de pagamentos', analytics:'Projecoes e analises' };

function AppInner() {
  const { state, dispatch } = useFin();
  const { view, month, year, loading, syncing } = state;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const pages = {
    dashboard: <Dashboard />,
    income: <IncomePage />,
    expenses: <ExpensesPage />,
    calendar: <CalendarPage />,
    analytics: <AnalyticsPage />,
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid var(--bd)', borderTop:'3px solid var(--green)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <div style={{ color:'var(--t3)', fontSize:14 }}>Carregando dados...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="app">
      {!isMobile && <Sidebar />}
      {isMobile && sidebarOpen && <Sidebar mobile onClose={() => setSidebarOpen(false)} />}
      <div className="main">
        <div className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {isMobile && (
              <button className="btn-icon" onClick={() => setSidebarOpen(true)} style={{ flexShrink:0 }}>
                {Icons.menu}
              </button>
            )}
            <div>
              <div className="page-title">{PAGE_TITLES[view]}<span>{PAGE_SUBS[view]}</span></div>
            </div>
          </div>
          <div className="topbar-right">
            {syncing && <div style={{ fontSize:11, color:'var(--t3)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'var(--amber)', animation:'pulse 1s infinite' }} />Sincronizando</div>}
            <MonthSelector month={month} year={year} onChange={(m, y) => dispatch({ type:'SET_MONTH', month:m, year:y })} />
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {pages[view] || <Dashboard />}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Head>
        <title>Financeiro Familia</title>
        <meta name="description" content="Controle financeiro familiar" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0A0A0C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </Head>
      <FinProvider>
        <AppInner />
      </FinProvider>
    </>
  );
}
