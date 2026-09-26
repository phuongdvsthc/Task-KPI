const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const STORE_PATH = path.resolve('/tmp/ai_requests.json');

function getStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving ai_requests store:', e);
  }
}

function handleAiRequests() {
  return {
    insert(record) {
      const store = getStore();
      const rows = Array.isArray(record) ? record : [record];
      const newRows = rows.map(row => ({
        id: row.id || crypto.randomUUID(),
        request_id: row.request_id || crypto.randomUUID(),
        created_at: row.created_at || new Date().toISOString(),
        ...row
      }));
      store.push(...newRows);
      saveStore(store);
      const resData = Array.isArray(record) ? newRows : newRows[0];
      const result = { data: resData, error: null };
      return {
        select(fields) {
          return {
            single: async () => ({ data: newRows[0], error: null }),
            maybeSingle: async () => ({ data: newRows[0] || null, error: null }),
            then: (resolve) => resolve({ data: newRows, error: null })
          };
        },
        single: async () => ({ data: newRows[0], error: null }),
        maybeSingle: async () => ({ data: newRows[0] || null, error: null }),
        then: (resolve) => resolve(result)
      };
    },
    select(fields) {
      let rows = [...getStore()];
      const builder = {
        order(col, { ascending = true } = {}) {
          rows.sort((a, b) => {
            if (a[col] < b[col]) return ascending ? -1 : 1;
            if (a[col] > b[col]) return ascending ? 1 : -1;
            return 0;
          });
          return builder;
        },
        limit(n) {
          rows = rows.slice(0, n);
          return builder;
        },
        eq(col, val) {
          rows = rows.filter(r => r[col] === val);
          return builder;
        },
        single: async () => ({ data: rows[0] || null, error: rows[0] ? null : { message: 'Not found' } }),
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (resolve) => resolve({ data: rows, error: null })
      };
      return builder;
    },
    update(updates) {
      return {
        eq(col, val) {
          const store = getStore();
          const idx = store.findIndex(r => r[col] === val);
          if (idx !== -1) {
            store[idx] = { ...store[idx], ...updates };
            saveStore(store);
            return Promise.resolve({ data: store[idx], error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }
      };
    },
    delete() {
      return {
        eq(col, val) {
          const store = getStore().filter(r => r[col] !== val);
          saveStore(store);
          return Promise.resolve({ data: null, error: null });
        },
        in(col, vals) {
          const set = new Set(vals);
          const store = getStore().filter(r => !set.has(r[col]));
          saveStore(store);
          return Promise.resolve({ data: null, error: null });
        }
      };
    }
  };
}

module.exports = { handleAiRequests, getStore, saveStore, STORE_PATH };
