/* ScholaSync — login.js */
(function () {
  'use strict';

  var tabStudent = document.getElementById('tab-student');
  var tabStaff = document.getElementById('tab-staff');
  var panelStudent = document.getElementById('panel-student');
  var panelStaff = document.getElementById('panel-staff');
  var errorBox = document.getElementById('login-error');

  function showError(msg) { 
    if (errorBox) { errorBox.textContent = msg; errorBox.style.display = 'block'; }
    else { alert(msg); }
  }
  function clearError() { 
    if (errorBox) errorBox.style.display = 'none'; 
  }

  function showTab(role) {
    var isStudent = role === 'student';
    if (tabStudent) tabStudent.classList.toggle('active', isStudent);
    if (tabStaff) tabStaff.classList.toggle('active', !isStudent);
    if (panelStudent) panelStudent.hidden = !isStudent;
    if (panelStaff) panelStaff.hidden = isStudent;
    clearError();
  }

  if (tabStudent) tabStudent.addEventListener('click', function () { showTab('student'); });
  if (tabStaff) tabStaff.addEventListener('click', function () { showTab('staff'); });
  if (window.location.hash === '#staff') showTab('staff');

  /* ---------- 1. Student Login ---------- */
  var studentForm = document.getElementById('student-login-form');
  if (studentForm) {
    studentForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError();
      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Checking…';
      try {
        var result = await loginStudent(
          document.getElementById('studentId').value,
          document.getElementById('studentPassword').value
        );
        if (result.ok) window.location.href = 'student-dashboard.html';
        else showError(result.message);
      } catch (err) {
        showError(err.message || 'Login failed.');
      } finally {
        btn.disabled = false; btn.textContent = 'Open Study Space';
      }
    });
  }

  /* ---------- 2. Staff Tabs (Teacher vs Principal) ---------- */
  var tabTeacher = document.getElementById('staff-tab-teacher');
  var tabPrincipal = document.getElementById('staff-tab-principal');
  var formTeacher = document.getElementById('staff-login-form-teacher');
  var formPrincipal = document.getElementById('staff-login-form-principal');

  if (tabTeacher && tabPrincipal && formTeacher && formPrincipal) {
    tabTeacher.addEventListener('click', () => {
      tabTeacher.classList.add('active');
      tabPrincipal.classList.remove('active');
      formTeacher.hidden = false;
      formPrincipal.hidden = true;
      clearError();
    });

    tabPrincipal.addEventListener('click', () => {
      tabPrincipal.classList.add('active');
      tabTeacher.classList.remove('active');
      formTeacher.hidden = true;
      formPrincipal.hidden = false;
      clearError();
    });
  }

  /* ---------- 3. Teacher Login ---------- */
  if (formTeacher) {
    formTeacher.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError();
      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Checking…';
      try {
        var result = await loginStaff(
          document.getElementById('teacherSchoolAbbr').value,
          document.getElementById('staffEmail').value,
          document.getElementById('staffPassword').value
        );
        if (result.ok) window.location.href = 'admin.html';
        else showError(result.message);
      } catch (err) {
        showError(err.message || 'Login failed.');
      } finally {
        btn.disabled = false; btn.textContent = 'Login as Teacher';
      }
    });
  }

  /* ---------- 4. Principal Login ---------- */
  if (formPrincipal) {
    formPrincipal.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Checking...';
      try {
        // FIXED: Pass 'principal' as the second argument (email), and the password as the third
        const result = await loginStaff(
          document.getElementById('principalSchool').value,
          'principal', 
          document.getElementById('principalPassword').value
        );
        if (result.ok) window.location.href = 'admin.html';
        else showError(result.message);
      } catch (err) {
        showError(err.message || 'Login failed.');
      } finally {
        btn.disabled = false; btn.textContent = 'Login as Principal';
      }
    });
  }

})();