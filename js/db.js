/* ScholaSync — db.js (patched: 0-based IDs, auth storage) */
(function (root) {
  'use strict';

  var KEYS = {
    students: 'ss_students',
    auth:     'ss_auth',        // NEW: per-student salt + hash
    counters: 'ss_counters',
    seeded:   'ss_seeded_v1',
    session:  'ss_session'
  };

  var TRACKS = ['Science', 'Art', 'Commercial'];
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var DEMO_STAFF_PIN = '1234';

  var memory = { local: {}, session: {} };
  function getArea(name) {
    try { var a = root[name]; a.setItem('__t__','1'); a.removeItem('__t__'); return a; }
    catch (e) { return null; }
  }
  var areas = { local: getArea('localStorage'), session: getArea('sessionStorage') };
  function read(kind, key, fallback) {
    try { var raw = areas[kind] ? areas[kind].getItem(key) : memory[kind][key];
      return raw == null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  }
  function write(kind, key, value) {
    var raw = JSON.stringify(value);
    if (areas[kind]) { try { areas[kind].setItem(key, raw); return true; } catch (e) {} }
    memory[kind][key] = raw; return false;
  }
  function remove(kind, key) {
    try { if (areas[kind]) areas[kind].removeItem(key); } catch (e) {}
    delete memory[kind][key];
  }

  /* ---------- Student ID engine — 0-based ----------
   * n=0 -> AAAA0000 | n=9999 -> AAAA9999 | n=10000 -> AAAB0000 ... ZZZZ9999
   */
  function encodeIdFromCounter(n, school) {
    var block = Math.floor(n / 10000);
    var num = n % 10000;
    var letters = '';
    for (var i = 0; i < 4; i++) {
      letters = String.fromCharCode(65 + (block % 26)) + letters;
      block = Math.floor(block / 26);
    }
    if (block > 0) throw new Error('Student ID capacity reached for this school.');
    return letters + String(num).padStart(4, '0') + school;
  }

  /* ---------- students ---------- */
  function getStudents() { return read('local', KEYS.students, []); }
  function saveStudents(list) { write('local', KEYS.students, list); }
  function getStudent(id) {
    var list = getStudents();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function saveStudent(student) {
    var list = getStudents();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === student.id) { list[i] = student; saveStudents(list); return student; }
    }
    list.push(student); saveStudents(list); return student;
  }
  function getStudentsBySchool(school) {
    return getStudents().filter(function (s) { return s.schoolAbbr === school; });
  }
  function schoolExists(school) { return getStudentsBySchool(school).length > 0; }

  function nextStudentId(school) {
    var counters = read('local', KEYS.counters, {});
    var n = counters[school] || 0;
    var id;
    do { id = encodeIdFromCounter(n, school); n += 1; } while (getStudent(id));
    counters[school] = n;
    write('local', KEYS.counters, counters);
    return id;
  }

  /* ---------- auth records (salt + PBKDF2 hash, optional email) ---------- */
  function getAuth(id) {
    var all = read('local', KEYS.auth, {});
    return all[id] || null;
  }
  function saveAuth(id, record) {
    var all = read('local', KEYS.auth, {});
    all[id] = record;
    write('local', KEYS.auth, all);
    return record;
  }
  function deleteAuth(id) {
    var all = read('local', KEYS.auth, {});
    delete all[id];
    write('local', KEYS.auth, all);
  }

  /* ---------- session ---------- */
  function getSession() { return read('session', KEYS.session, null); }
  function setSession(s) { write('session', KEYS.session, s); }
  function clearSession() { remove('session', KEYS.session); }

  /* ---------- demo seed ---------- */
  function seedIfNeeded() {
    if (read('local', KEYS.seeded, false)) return;
    var T = true, F = false;
    var demo = [
      ['Chinedu Okafor', 16, 'Science',    '08031234567', [T,T,T,T,T]],
      ['Amina Bello',    17, 'Science',    '08052345678', [T,F,F,F,T]],
      ['Ngozi Eze',      15, 'Art',        '07061234567', [T,T,F,T,T]],
      ['Tunde Adeyemi',  18, 'Commercial', '08123456789', [F,F,T,F,T]],
      ['Blessing Udo',   16, 'Art',        '09012345678', [T,T,T,F,T]],
      ['Emeka Nwosu',    17, 'Commercial', '08034567890', [F,T,T,T,T]]
    ];
    var list = getStudents();
    demo.forEach(function (d) {
      list.push({
        id: nextStudentId('UNN'),
        fullName: d[0], age: d[1], schoolAbbr: 'UNN', track: d[2],
        parentPhone: d[3], email: null,
        consentAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        progress: {}, attendance: d[4]
      });
    });
    saveStudents(list);
    write('local', KEYS.seeded, true);
  }

  function resetAll() {
    [KEYS.students, KEYS.auth, KEYS.counters, KEYS.seeded].forEach(function (k) { remove('local', k); });
    clearSession(); seedIfNeeded();
  }

  seedIfNeeded();

  root.ScholaDB = {
    TRACKS: TRACKS, DAYS: DAYS, DEMO_STAFF_PIN: DEMO_STAFF_PIN,
    encodeIdFromCounter: encodeIdFromCounter,
    getStudents: getStudents, getStudent: getStudent,
    getStudentsBySchool: getStudentsBySchool, saveStudent: saveStudent, saveStudents: saveStudents,
    schoolExists: schoolExists, nextStudentId: nextStudentId,
    getAuth: getAuth, saveAuth: saveAuth, deleteAuth: deleteAuth,
    getSession: getSession, setSession: setSession, clearSession: clearSession,
    resetAll: resetAll
  };
})(typeof window !== 'undefined' ? window : globalThis);