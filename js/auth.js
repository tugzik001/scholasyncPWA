/* ScholaSync — auth.js */
(function (root) {
  'use strict';

  var DB = root.ScholaDB;
  if (!DB) throw new Error('ScholaSync: load js/db.js before js/auth.js');

  var ITERATIONS = 100000;
  var enc = new TextEncoder();

  function b64(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  }
  function unb64(s) {
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }
  function normalizeId(v) { return String(v || '').replace(/\s+/g, '').toUpperCase(); }
  function normalizePhone(v) {
    var d = String(v || '').replace(/[\s\-()]/g, '');
    if (d.indexOf('+234') === 0) d = '0' + d.slice(4);
    else if (d.indexOf('234') === 0 && d.length === 13) d = '0' + d.slice(3);
    return /^0\d{10}$/.test(d) ? d : null;
  }
  function normalizeEmail(v) {
    var s = String(v || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
  }

  /* ---------- HASHING HELPERS ---------- */
  async function derive(password, saltB64, iterations) {
    var key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: unb64(saltB64), iterations: iterations, hash: 'SHA-256' }, key, 256
    );
    return b64(bits);
  }
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }

  /* ---------- REGISTER STUDENT ---------- */
  async function registerStudent(data) {
    var fullName = String(data.fullName || '').trim().replace(/\s+/g, ' ');
    var age = parseInt(data.age, 10);
    var school = String(data.schoolAbbr || '').trim().toUpperCase();
    var track = data.track;
    var phone = normalizePhone(data.parentPhone);
    var password = String(data.password || '');
    var email = normalizeEmail(data.email);
    var classCode = String(data.classCode || '').trim().toUpperCase();

    if (fullName.length < 2) throw new Error("Please enter the student's full name.");
    if (isNaN(age) || age < 10 || age > 25) throw new Error('Age must be between 10 and 25.');
    if (!/^[A-Z]{2,5}$/.test(school)) throw new Error('School abbreviation must be 2–5 letters.');
    if (DB.TRACKS.indexOf(track) === -1) throw new Error('Please choose a department.');
    if (!phone) throw new Error('Enter a valid Nigerian phone number.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (data.email && !email) throw new Error('That email address does not look valid.');
    if (!data.consent) throw new Error('Consent is required to register.');

        var id;
    if (navigator.onLine && window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
       id = DB.encodeIdFromCounter(await window.ScholaSupabase.reserveStudentId(school), school);
    } else {
       id = DB.nextStudentId(school);
    }
    var now = new Date().toISOString();
    
    // Generate password hash
    var salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    var hash = await derive(password, salt, ITERATIONS);

    var student = {
      id: id, fullName: fullName, age: age, schoolAbbr: school, classCode: classCode, track: track,
      parentPhone: phone, email: email, consentAt: now, createdAt: now,
      progress: {}, attendance: [true, true, true, true, true]
    };
    
    // Save locally
    DB.saveStudent(student);
    DB.saveAuth(id, { salt: salt, hash: hash, iterations: ITERATIONS, email: email });
    
    // Sync to Supabase
    if (navigator.onLine && window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
      try {
        await fetch(window.ScholaSupabase.config.url + '/rest/v1/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': window.ScholaSupabase.config.anonKey,
            'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
          },
          body: JSON.stringify({
            id: id,
            full_name: fullName,
            age: age,
            school_abbr: school,
            class_code: classCode || null,
            track: track,
            parent_phone: phone,
            email: email,
            password_hash: hash,
            salt: salt,
            consent_at: now
          })
        });
      } catch (err) {
        console.warn('Failed to sync student to Supabase, but saved locally.', err);
      }
    }

    DB.setSession({ role: 'student', id: student.id });
    return student;
  }

  /* ---------- LOGIN STUDENT ---------- */
  async function loginStudent(idInput, password) {
    var id = normalizeId(idInput);
    var pw = String(password || '');
    if (!id) return { ok: false, message: 'Please enter your Student ID.' };
    if (!pw) return { ok: false, message: 'Please enter your password.' };

    var student = DB.getStudent(id);
    if (!student) return { ok: false, message: 'Student ID not found on this device.' };

    var auth = DB.getAuth(id);
    
    if (!auth) {
      // Demo bootstrap
      if (pw !== 'demo1234') return { ok: false, message: 'No password set. Ask a teacher to reset.' };
      var salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      var hash = await derive(pw, salt, ITERATIONS);
      auth = { salt: salt, hash: hash, iterations: ITERATIONS, email: student.email || null };
      DB.saveAuth(id, auth);
    } else {
      var attempt = await derive(pw, auth.salt, auth.iterations);
      if (!safeEqual(attempt, auth.hash)) return { ok: false, message: 'Incorrect password.' };
    }
    
    DB.setSession({ role: 'student', id: student.id });
    return { ok: true, student: student };
  }

  /* ---------- LOGIN STAFF (Teacher & Principal) ---------- */
  async function loginStaff(schoolInput, emailInput, passwordInput) {
    var school = String(schoolInput || '').trim().toUpperCase();
    var email = String(emailInput || '').trim().toLowerCase();
    var pw = String(passwordInput || '').trim();
    
    if (!school || !email || !pw) return { ok: false, message: 'Enter your school, email/ID, and password.' };
    if (!navigator.onLine) return { ok: false, message: 'You must be online to log in as staff.' };
    if (!window.ScholaSupabase || !window.ScholaSupabase.isConfigured()) return { ok: false, message: 'Database not configured.' };

    try {
      var endpoint = email === 'principal' 
        ? `/rest/v1/schools?abbr=eq.${school}`
        : `/rest/v1/teachers?school_abbr=eq.${school}&email=eq.${encodeURIComponent(email)}`;

      var res = await fetch(window.ScholaSupabase.config.url + endpoint, {
        headers: {
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        }
      });
      var data = await res.json();
      
      if (data.length === 0) return { ok: false, message: 'Account not found at this school.' };
      
      var authRecord = data[0];
      var attemptHash = await derive(pw, authRecord.salt, 100000);
      
      if (!safeEqual(attemptHash, authRecord.password_hash)) {
        return { ok: false, message: 'Incorrect password.' };
      }
      
      DB.setSession({ 
        role: 'staff', 
        school: school, 
        email: email === 'principal' ? authRecord.initiator_email : authRecord.email, 
        name: email === 'principal' ? authRecord.initiator_name : authRecord.full_name 
      });
      return { ok: true, school: school };
      
    } catch (e) {
      return { ok: false, message: 'Network error. Could not reach database.' };
    }
  }

  /* ---------- HELPERS ---------- */
  function getCurrentStudent() {
    var s = DB.getSession();
    return s && s.role === 'student' ? DB.getStudent(s.id) : null;
  }
  function getCurrentStaff() {
    var s = DB.getSession();
    return s && s.role === 'staff' ? s : null;
  }
  function requireStudent() {
    var st = getCurrentStudent();
    if (!st) { root.location.href = 'login.html'; return null; }
    return st;
  }
  function requireStaff() {
    var s = getCurrentStaff();
    if (!s) { root.location.href = 'login.html'; return null; }
    return s;
  }
  function logout() {
    DB.clearSession();
    root.location.href = 'login.html';
  }

  /* ---------- EXPORTS ---------- */
  root.registerStudent = registerStudent;
  root.loginStudent = loginStudent;
  root.loginStaff = loginStaff;
  root.getCurrentStudent = getCurrentStudent;
  root.getCurrentStaff = getCurrentStaff;
  root.requireStudent = requireStudent;
  root.requireStaff = requireStaff;
  root.logout = logout;

})(typeof window !== 'undefined' ? window : globalThis);