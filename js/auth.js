/* ScholaSync — auth.js
 * Registration, student/staff login, session guards and logout.
 * Requires js/db.js to be loaded first.
 * Globals used by the pages: registerStudent, loginStudent, loginStaff,
 * getCurrentStudent, getCurrentStaff, requireStudent, requireStaff, logout
 */
(function (root) {
  'use strict';
 
  var DB = root.ScholaDB;
  if (!DB) {
    throw new Error('ScholaSync: load js/db.js before js/auth.js');
  }
 
  function normalizeId(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
  }
 
  /* Accepts 08031234567, +2348031234567 or 2348031234567 -> returns 08031234567 */
  function normalizePhone(value) {
    var digits = String(value || '').replace(/[\s\-()]/g, '');
    if (digits.indexOf('+234') === 0) digits = '0' + digits.slice(4);
    else if (digits.indexOf('234') === 0 && digits.length === 13) digits = '0' + digits.slice(3);
    return /^0\d{10}$/.test(digits) ? digits : null;
  }
 
  function registerStudent(data) {
    var fullName = String(data.fullName || '').trim().replace(/\s+/g, ' ');
    var age = parseInt(data.age, 10);
    var school = String(data.schoolAbbr || '').trim().toUpperCase();
    var track = data.track;
    var phone = normalizePhone(data.parentPhone);
 
    if (fullName.length < 2) throw new Error('Please enter the student\'s full name.');
    if (isNaN(age) || age < 10 || age > 25) throw new Error('Age must be between 10 and 25.');
    if (!/^[A-Z]{2,5}$/.test(school)) throw new Error('School abbreviation must be 2–5 letters (e.g., UNN).');
    if (DB.TRACKS.indexOf(track) === -1) throw new Error('Please choose a department.');
    if (!phone) throw new Error('Enter a valid Nigerian phone number (e.g., 08031234567).');
    if (!data.consent) throw new Error('Parental/school consent is required to register.');
 
    var now = new Date().toISOString();
    var student = {
      id: DB.nextStudentId(school),
      fullName: fullName,
      age: age,
      schoolAbbr: school,
      track: track,
      parentPhone: phone,
      consentAt: now,
      createdAt: now,
      progress: {},
      attendance: [true, true, true, true, true]
    };
 
    DB.saveStudent(student);
    DB.setSession({ role: 'student', id: student.id });
    return student;
  }
 
  function loginStudent(idInput) {
    var id = normalizeId(idInput);
    if (!id) return { ok: false, message: 'Please enter your Student ID.' };
 
    var student = DB.getStudent(id);
    if (!student) {
      return { ok: false, message: 'Student ID not found on this device. Check the ID or register a new one.' };
    }
        // Push to Supabase if online
    if (navigator.onLine && window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
      try {
        fetch(window.ScholaSupabase.config.url + '/rest/v1/students', { // I removed "await" from this block, hope it doesn'
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
            class_code: data.classCode || null, // Assuming you pass this in
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
    return { ok: true, student: student };
  }
 
        async function loginStaff(identifier, passwordInput, isPrincipal = false) {
    var pw = String(passwordInput || '').trim();
    if (!identifier || !pw) return { ok: false, message: 'Enter your details.' };

    if (navigator.onLine && window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
      try {
        var endpoint = isPrincipal 
          ? '/rest/v1/schools?abbr=eq.' + identifier.toUpperCase()
          : '/rest/v1/teachers?email=eq.' + encodeURIComponent(identifier.toLowerCase());
          
        var res = await fetch(window.ScholaSupabase.config.url + endpoint, {
          headers: {
            'apikey': window.ScholaSupabase.config.anonKey,
            'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
          }
        });
        var data = await res.json();
        
        if (data.length === 0) return { ok: false, message: 'Account not found.' };
        var authRecord = data[0];
        
        var saltBytes = Uint8Array.from(atob(authRecord.salt), c => c.charCodeAt(0));
        var enc = new TextEncoder();
        var key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
        var bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, key, 256
        );
        var attemptHash = btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));
        
        if (attemptHash !== authRecord.password_hash) return { ok: false, message: 'Incorrect password.' };
        
        DB.setSession({ 
          role: 'staff', 
          school: isPrincipal ? authRecord.abbr : authRecord.school_abbr, 
          email: isPrincipal ? authRecord.initiator_email : authRecord.email, 
          name: isPrincipal ? authRecord.initiator_name : authRecord.full_name 
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, message: 'Network error.' };
      }
    }
    return { ok: false, message: 'You must be online to log in.' };
  }
 
  function getCurrentStudent() {
    var s = DB.getSession();
    return s && s.role === 'student' ? DB.getStudent(s.id) : null;
  }
 
  function getCurrentStaff() {
    var s = DB.getSession();
    return s && s.role === 'staff' ? s : null;
  }
 
  /* Page guards: call at the top of student.js / admin.js */
  function requireStudent() {
    var student = getCurrentStudent();
    if (!student) {
      root.location.href = 'login.html';
      return null;
    }
    return student;
  }
 
  function requireStaff() {
    var staff = getCurrentStaff();
    if (!staff) {
      root.location.href = 'login.html';
      return null;
    }
    return staff;
  }
 
  function logout() {
    DB.clearSession();
    root.location.href = 'login.html';
  }
 
  root.registerStudent = registerStudent;
  root.loginStudent = loginStudent;
  root.loginStaff = loginStaff;
  root.getCurrentStudent = getCurrentStudent;
  root.getCurrentStaff = getCurrentStaff;
  root.requireStudent = requireStudent;
  root.requireStaff = requireStaff;
  root.logout = logout;
})(typeof window !== 'undefined' ? window : globalThis);
 