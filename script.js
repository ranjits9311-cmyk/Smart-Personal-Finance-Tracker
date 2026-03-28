const balanceEl = document.getElementById('balance');
const incomeEl = document.getElementById('income');
const expenseEl = document.getElementById('expense');

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

const formEl = document.getElementById('tx-form');
const textEl = document.getElementById('text');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');
const categoryEl = document.getElementById('category');
const dateEl = document.getElementById('date');

const searchEl = document.getElementById('search');
const exportCsvBtn = document.getElementById('exportCsv');
const exportJsonBtn = document.getElementById('exportJson');
const importJsonBtn = document.getElementById('importJson');
const importJsonFileEl = document.getElementById('importJsonFile');
const clearAllBtn = document.getElementById('clearAll');

const STORAGE_KEY = 'spft.transactions.v1';

/** @type {{id:string, text:string, amount:number, category:string, date:string}[]} */
let transactions = loadTransactions();

// default date to today
if (dateEl) {
  const today = new Date();
  dateEl.value = today.toISOString().slice(0, 10);
}

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  addTransaction();
});

searchEl.addEventListener('input', () => render());
exportCsvBtn.addEventListener('click', () => exportCsv());
exportJsonBtn.addEventListener('click', () => exportJson());
importJsonBtn.addEventListener('click', () => importJsonFileEl.click());
importJsonFileEl.addEventListener('change', () => importJson());
clearAllBtn.addEventListener('click', () => clearAll());

function addTransaction() {
  const text = textEl.value.trim();
  const rawAmount = amountEl.value;
  const type = typeEl.value; // income | expense
  const category = categoryEl.value;
  const date = dateEl.value || new Date().toISOString().slice(0, 10);

  if (!text || !rawAmount) {
    alert('Please add a description and amount');
    return;
  }

  const amountNum = Number(rawAmount);
  if (!Number.isFinite(amountNum) || amountNum === 0) {
    alert('Amount must be a valid non-zero number');
    return;
  }

  const signedAmount = (type === 'expense') ? -Math.abs(amountNum) : Math.abs(amountNum);

  const tx = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    text,
    amount: signedAmount,
    category,
    date,
  };

  transactions.unshift(tx);
  persist();
  resetForm();
  render();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  persist();
  render();
}

function resetForm() {
  textEl.value = '';
  amountEl.value = '';
  typeEl.value = 'expense';
  categoryEl.value = 'Other';
  // keep date as-is
  textEl.focus();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(Boolean)
      .map(t => ({
        id: String(t.id ?? ''),
        text: String(t.text ?? ''),
        amount: Number(t.amount ?? 0),
        category: String(t.category ?? 'Other'),
        date: String(t.date ?? ''),
      }))
      .filter(t => t.id && t.text && Number.isFinite(t.amount));
  } catch {
    return [];
  }
}

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function render() {
  const q = (searchEl.value || '').trim().toLowerCase();

  const filtered = q
    ? transactions.filter(t =>
        t.text.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q)
      )
    : transactions;

  // list
  listEl.innerHTML = '';
  for (const t of filtered) {
    const item = document.createElement('li');
    item.className = t.amount < 0 ? 'minus' : 'plus';

    const left = document.createElement('div');
    left.className = 'tx-left';
    left.innerHTML = `
      <div class="tx-title">${escapeHtml(t.text)}</div>
      <div class="tx-meta">${escapeHtml(t.category)} • ${escapeHtml(t.date)}</div>
    `;

    const right = document.createElement('div');
    right.className = 'tx-right';

    const amt = document.createElement('div');
    amt.className = 'tx-amount';
    amt.textContent = money(t.amount);

    const del = document.createElement('button');
    del.className = 'tx-del';
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteTransaction(t.id));

    right.appendChild(amt);
    right.appendChild(del);

    item.appendChild(left);
    item.appendChild(right);

    listEl.appendChild(item);
  }

  emptyEl.style.display = filtered.length ? 'none' : 'block';

  // summary
  const income = transactions
    .filter(t => t.amount > 0)
    .reduce((a, t) => a + t.amount, 0);

  const expenses = transactions
    .filter(t => t.amount < 0)
    .reduce((a, t) => a + Math.abs(t.amount), 0);

  const total = income - expenses;

  incomeEl.textContent = money(income);
  expenseEl.textContent = money(expenses);
  balanceEl.textContent = money(total);
}

let lastDeletedSnapshot = null;
let undoTimer = null;

function clearAll() {
  if (!transactions.length) return;
  if (!confirm('Clear all transactions? You can undo for 15 seconds.')) return;

  lastDeletedSnapshot = [...transactions];
  transactions = [];
  persist();
  render();

  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    lastDeletedSnapshot = null;
  }, 15000);

  const undo = confirm('Cleared. Undo? (available for 15 seconds)');
  if (undo && lastDeletedSnapshot) {
    transactions = lastDeletedSnapshot;
    lastDeletedSnapshot = null;
    persist();
    render();
  }
}

function exportCsv() {
  const rows = [
    ['date', 'description', 'category', 'amount'],
    ...transactions.map(t => [t.date, t.text, t.category, String(t.amount)]),
  ];

  const csv = rows
    .map(r => r.map(csvEscape).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJson() {
  const file = importJsonFileEl.files && importJsonFileEl.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ''));
      const arr = Array.isArray(parsed) ? parsed : parsed.transactions;
      if (!Array.isArray(arr)) throw new Error('Invalid backup format');

      const cleaned = arr
        .filter(Boolean)
        .map(t => ({
          id: String(t.id ?? ''),
          text: String(t.text ?? ''),
          amount: Number(t.amount ?? 0),
          category: String(t.category ?? 'Other'),
          date: String(t.date ?? ''),
        }))
        .filter(t => t.id && t.text && Number.isFinite(t.amount));

      if (!confirm(`Restore ${cleaned.length} transactions? This will replace your current list.`)) return;

      transactions = cleaned;
      persist();
      render();
      alert('Restore complete.');
    } catch (e) {
      alert('Could not restore backup. Please choose a valid JSON backup file.');
    } finally {
      importJsonFileEl.value = '';
    }
  };
  reader.readAsText(file);
}

function csvEscape(s) {
  const str = String(s ?? '');
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Make it hard to accidentally add expenses as income:
// - Default Type is Expense
// - Choosing Income category flips Type to Income
// - Choosing any non-Income category flips Type to Expense
if (categoryEl && typeEl) {
  categoryEl.addEventListener('change', () => {
    if (categoryEl.value === 'Income') typeEl.value = 'income';
    else typeEl.value = 'expense';
  });
}

// Minor helper when switching type: if user switches to income, suggest Income category
if (typeEl && categoryEl) {
  typeEl.addEventListener('change', () => {
    if (typeEl.value === 'income' && categoryEl.value !== 'Income') {
      // don't force, but nudge to Income
      // (user can still keep Other for e.g. bonus)
    }
  });
}

// initial render
render();