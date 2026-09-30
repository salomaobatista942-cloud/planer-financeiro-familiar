function importedSignature(txn) {
  return [
    txn.date || '',
    txn.type || '',
    Number(txn.amount) || 0,
    String(txn.description || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim(),
  ].join('|');
}

function mergeImportedTransactions(existing, imported, categoryGroups = {}) {
  const merged = (existing || []).map(txn => ({ ...txn }));
  const byId = new Map(merged.map(txn => [txn.id, txn]));
  const byImportRecordId = new Map(
    merged.filter(txn => txn.importRecordId).map(txn => [txn.importRecordId, txn]),
  );
  const bySignature = new Map();

  merged.forEach(txn => {
    const signature = importedSignature(txn);
    if (!bySignature.has(signature)) bySignature.set(signature, []);
    bySignature.get(signature).push(txn);
  });

  const matchedExisting = new Set();
  (imported || []).forEach(txn => {
    let match = byId.get(txn.id) || byImportRecordId.get(txn.id);
    if (!match) {
      const candidates = bySignature.get(importedSignature(txn)) || [];
      match = candidates.find(candidate => !matchedExisting.has(candidate));
    }

    if (match) {
      matchedExisting.add(match);
      match.importRecordId = txn.id;
      if (txn.titular) match.titular = txn.titular;
      if (txn.source) match.source = txn.source;

      // Preserve an explicit override, or infer a pre-migration manual edit
      // when the saved database category differs from the imported suggestion.
      const savedCategory = match.categoryOverride || (
        match.category && txn.category && match.category !== txn.category
          ? match.category
          : null
      );
      if (savedCategory) {
        match.categoryOverride = savedCategory;
        match.category = savedCategory;
        match.group = categoryGroups[savedCategory] || 'a_classificar';
      } else {
        if (txn.category) match.category = txn.category;
        if (txn.group !== undefined) match.group = txn.group;
      }

      byId.set(match.id, match);
      byImportRecordId.set(txn.id, match);
      return;
    }

    if (byId.has(txn.id)) return;
    const added = { ...txn, importRecordId: txn.id };
    merged.push(added);
    byId.set(added.id, added);
    byImportRecordId.set(txn.id, added);
  });

  return merged;
}

function toDbRow(txn) {
  const row = {
    id: txn.id,
    type: txn.type,
    description: txn.description,
    amount: txn.amount,
    category: txn.category,
    category_override: txn.categoryOverride || null,
    import_record_id: txn.importRecordId || null,
    group_name: txn.group,
    subcategory: txn.subcategory,
    status: txn.status,
    payment_method: txn.paymentMethod,
    date: txn.date,
    month: txn.month,
    year: txn.year,
    installments: txn.installments || 1,
    installment_month: txn.installmentMonth || null,
  };
  if (txn.titular) row.titular = txn.titular;
  return row;
}

async function saveTransaction(client, txn) {
  if (!client) return;
  const { error } = await client.from('transactions').upsert(toDbRow(txn), { onConflict:'id' });
  if (error) throw error;
}

module.exports = { importedSignature, mergeImportedTransactions, saveTransaction, toDbRow };
