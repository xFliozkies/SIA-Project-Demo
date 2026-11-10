// Local preview only. This adapter never connects to Supabase.
(function () {
  'use strict';
  var key = 'working-papers-local-demo-v1';
  var sessionKey = key + '-session';
  var initial = {
    profiles: [
      { id: 'demo-partner', full_name: 'Sample Partner', role: 'Partner' },
      { id: 'demo-reviewer', full_name: 'Sample Reviewer', role: 'Reviewer' },
      { id: 'demo-preparer', full_name: 'Sample Preparer', role: 'Preparer' }
    ],
    engagements: [], checklist_items: [], files: {}
  };
  var db = JSON.parse(localStorage.getItem(key) || 'null') || initial;
  function save() { localStorage.setItem(key, JSON.stringify(db)); }
  function session() {
    return sessionStorage.getItem(sessionKey) ? { user: { id: 'demo-partner', email: 'sample@gmail.com' } } : null;
  }
  function query(table) {
    var operation = 'select', payload, filters = [], sort, one = false;
    var q = {
      select: function () { return q; },
      insert: function (value) { operation = 'insert'; payload = value; return q; },
      update: function (value) { operation = 'update'; payload = value; return q; },
      eq: function (field, value) { filters.push(function (r) { return r[field] === value; }); return q; },
      in: function (field, values) { filters.push(function (r) { return values.includes(r[field]); }); return q; },
      ilike: function (field, value) {
        var term = value.replace(/^%|%$/g, '').toLowerCase();
        filters.push(function (r) { return String(r[field] || '').toLowerCase().includes(term); }); return q;
      },
      order: function (field, options) { sort = { field: field, ascending: !options || options.ascending !== false }; return q; },
      limit: function (count) { q.count = count; return q; },
      single: function () { one = true; return q; },
      then: function (resolve, reject) {
        return Promise.resolve().then(function () {
          var rows = db[table].filter(function (r) { return filters.every(function (f) { return f(r); }); });
          if (operation === 'insert') {
            rows = (Array.isArray(payload) ? payload : [payload]).map(function (r) {
              return Object.assign({ id: crypto.randomUUID(), created_at: new Date().toISOString() }, r);
            });
            db[table].push.apply(db[table], rows); save();
          } else if (operation === 'update') {
            rows.forEach(function (r) { Object.assign(r, payload); }); save();
          }
          if (sort) rows.sort(function (a,b) { return String(a[sort.field] || '').localeCompare(String(b[sort.field] || '')) * (sort.ascending ? 1 : -1); });
          if (q.count) rows = rows.slice(0, q.count);
          return { data: JSON.parse(JSON.stringify(one ? rows[0] || null : rows)), error: null };
        }).then(resolve, reject);
      }
    };
    return q;
  }
  window.demoBackend = {
    auth: {
      signInWithPassword: async function (credentials) {
        if (credentials.email.toLowerCase() !== 'sample@gmail.com' || credentials.password !== 'sample') {
          return { error: { message: 'Use sample@gmail.com and password sample for this local demo.' } };
        }
        sessionStorage.setItem(sessionKey, 'true');
        return { data: { session: session() }, error: null };
      },
      getSession: async function () { return { data: { session: session() }, error: null }; },
      signOut: async function () { sessionStorage.removeItem(sessionKey); return { error: null }; }
    },
    from: query,
    storage: { from: function () { return {
      upload: async function (path, file) {
        try {
          var url = await new Promise(function (resolve,reject) {
            var reader = new FileReader(); reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject; reader.readAsDataURL(file);
          });
          db.files[path] = url; save(); return { error: null };
        } catch (error) { delete db.files[path]; return { error: { message: 'Browser storage is full. Try a smaller file.' } }; }
      },
      getPublicUrl: function (path) { return { data: { publicUrl: db.files[path] || '#' } }; },
      remove: async function (paths) { paths.forEach(function (p) { delete db.files[p]; }); save(); return { error: null }; }
    }; } }
  };
})();
