const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeImportedTransactions, saveTransaction, toDbRow } = require('../lib/finance-persistence');

const groups = { Alimentacao:'necessidades', Saude:'necessidades', Lazer:'desejos' };

function importedRow(overrides = {}) {
  return {
    id:'csv-row-1',
    type:'expense',
    description:'Farmacia Central',
    amount:2500,
    category:'Alimentacao',
    group:'necessidades',
    date:'2026-09-10',
    month:9,
    year:2026,
    titular:'elizandra',
    source:'nubank',
    paymentMethod:'credit',
    status:'paid',
    ...overrides,
  };
}

test('first merge attaches a stable import id to a matching Supabase row', () => {
  const existing = [{ ...importedRow(), id:'supabase-id-1', categoryOverride:null }];
  const [merged] = mergeImportedTransactions(existing, [importedRow()], groups);
  assert.equal(merged.id, 'supabase-id-1');
  assert.equal(merged.importRecordId, 'csv-row-1');
  assert.equal(merged.titular, 'elizandra');
});

test('edited imported row does not reappear as a duplicate after reload', () => {
  const edited = {
    ...importedRow({ description:'Farmacia Central editada', amount:3100, category:'Saude', group:'necessidades' }),
    id:'supabase-id-1',
    importRecordId:'csv-row-1',
    categoryOverride:'Saude',
  };
  const mergedRows = mergeImportedTransactions([edited], [importedRow()], groups);
  assert.equal(mergedRows.length, 1);
  assert.equal(mergedRows[0].id, 'supabase-id-1');
  assert.equal(mergedRows[0].description, 'Farmacia Central editada');
  assert.equal(mergedRows[0].amount, 3100);
  assert.equal(mergedRows[0].category, 'Saude');
  assert.equal(mergedRows[0].categoryOverride, 'Saude');
});

test('legacy saved category differing from import is preserved as a manual override', () => {
  const legacy = { ...importedRow(), id:'old-db-id', category:'Saude', group:'necessidades' };
  const [merged] = mergeImportedTransactions([legacy], [importedRow()], groups);
  assert.equal(merged.category, 'Saude');
  assert.equal(merged.categoryOverride, 'Saude');
  assert.equal(merged.importRecordId, 'csv-row-1');
});

test('a manually created category does not become an override unless explicitly set', () => {
  const row = toDbRow({ ...importedRow(), id:'manual-id', category:'Saude' });
  assert.equal(row.category, 'Saude');
  assert.equal(row.category_override, null);
});

test('manual category and import linkage are included in the Supabase row', () => {
  const row = toDbRow({
    ...importedRow(),
    id:'supabase-id-1',
    importRecordId:'csv-row-1',
    category:'Saude',
    categoryOverride:'Saude',
  });
  assert.equal(row.category_override, 'Saude');
  assert.equal(row.import_record_id, 'csv-row-1');
  assert.equal(row.titular, 'elizandra');
  assert.equal(row.payment_method, 'credit');
});

test('saving upserts by ID and rethrows database errors', async () => {
  let saved;
  let settings;
  const client = {
    from: table => ({
      upsert: async (row, options) => {
        saved = { table, row };
        settings = options;
        return { error:null };
      },
    }),
  };
  await saveTransaction(client, importedRow());
  assert.equal(saved.table, 'transactions');
  assert.equal(saved.row.id, 'csv-row-1');
  assert.deepEqual(settings, { onConflict:'id' });

  const failure = new Error('write denied');
  const failingClient = { from: () => ({ upsert: async () => ({ error:failure }) }) };
  await assert.rejects(() => saveTransaction(failingClient, importedRow()), failure);
});
