/* ScholaSync — login.js (patched: password + async + #staff) */
(function () {
  'use strict';

  var tabStudent = document.getElementById('tab-student');
  var tabStaff = document.getElementById('tab-staff');
  var panelStudent = document.getElementById('panel-student');
  var panelStaff = document.getElementById('panel-staff');
  var errorBox = document.getElementById('login-error');

  function showError(msg) { errorBox.textContent = msg; errorBox.style.display = 'block'; }
  function clearError() { errorBox.style.display = 'none'; }

  function showTab(role) {
    var isStudent = role === 'student';
    tabStudent.classList.toggle('active', isStudent);
    tabStaff.classList.toggle('active', !isStudent);
    panelStudent.hidden = !isStudent;
    panelStaff.hidden = isStudent;
    clearError();
  }

  tabStudent.addEventListener('click', function () { showTab('student'); });
  tabStaff.addEventListener('click', function () { showTab('staff'); });
  if (window.location.hash === '#staff') showTab('staff');

  document.getElementById('student-login-form').addEventListener('submit', async function (e) {
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

  document.getElementById('staff-login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    var result = loginStaff(
      document.getElementById('staffSchoolAbbr').value,
      document.getElementById('staffPin').value
    );
    if (result.ok) window.location.href = 'admin.html';
    else showError(result.message);
  });
    // --- Principal Login Tabs ---
  const tabTeacher = document.getElementById('staff-tab-teacher');
  const tabPrincipal = document.getElementById('staff-tab-principal');
  const formTeacher = document.getElementById('staff-login-form-teacher');
  const formPrincipal = document.getElementById('staff-login-form-principal');

  if (tabTeacher && tabPrincipal) {
    tabTeacher.addEventListener('click', () => {
      tabTeacher.classList.add('active');
      tabPrincipal.classList.remove('active');
      formTeacher.hidden = false;
      formPrincipal.hidden = true;
    });

    tabPrincipal.addEventListener('click', () => {
      tabPrincipal.classList.add('active');
      tabTeacher.classList.remove('active');
      formTeacher.hidden = true;
      formPrincipal.hidden = false;
    });

    formPrincipal.addEventListener('submit', async function(e) {
      e.preventDefault();
      clearError();
      const btn = formPrincipal.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Checking...';
      try {
        // We will reuse loginStaff, but pass the school abbr and master password
        const result = await loginStaff(
          document.getElementById('principalSchool').value,
          document.getElementById('principalPassword').value,
          true // isPrincipal flag
        );
        if (result.ok) window.location.href = 'admin.html';
        else showError(result.message);
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Login as Principal';
      }
    });
  }
})();