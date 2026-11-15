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
 
    DB.setSession({ role: 'student', id: student.id });
    return { ok: true, student: student };
  }
 
  function loginStaff(schoolInput, pinInput) {
    var school = String(schoolInput || '').trim().toUpperCase();
    var pin = String(pinInput || '').trim();
 
    if (!school || !pin) return { ok: false, message: 'Enter your school abbreviation and PIN.' };
    if (!DB.schoolExists(school)) {
      return { ok: false, message: 'No school "' + school + '" found on this device.' };
    }
    if (pin !== DB.DEMO_STAFF_PIN) return { ok: false, message: 'Incorrect staff PIN.' };
 
    DB.setSession({ role: 'staff', school: school });
    return { ok: true, school: school };
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
 