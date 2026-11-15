/* ScholaSync — app.js : controller for index.html
 * 1. Registers the service worker (offline caching)
 * 2. "Install app" button (Add to Home Screen)
 * 3. Fills the live study-space preview card, if present on the page
 * Needs: db.js (for the preview)
 */
(function () {
  'use strict';
 
  /* 1. Service worker */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* unsupported or blocked: app still works online */ });
    });
  }
 
  /* 2. Install prompt */
  var installBtn = document.getElementById('installBtn');
  var deferredPrompt = null;
 
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });
 
  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  }
 
  window.addEventListener('appinstalled', function () {
    if (installBtn) installBtn.hidden = true;
  });
 
  /* 3. Landing preview card (uses the signed-in student, else the demo student) */
  var nameEl = document.getElementById('preview-name');
  var idEl = document.getElementById('preview-id');
  var pctEl = document.getElementById('preview-progress');
  var daysEl = document.getElementById('preview-days');
  if (!window.ScholaDB || !(nameEl || idEl || pctEl || daysEl)) return;
 
  var session = ScholaDB.getSession();
  var student =
    (session && session.role === 'student' && ScholaDB.getStudent(session.id)) ||
    ScholaDB.getStudent('AAAA0000UNN');
  if (!student) return;
 
  if (nameEl) nameEl.textContent = student.fullName.split(' ')[0];
  if (idEl) idEl.textContent = student.id;
 
  if (daysEl) {
    daysEl.textContent = '';
    ['M', 'T', 'W', 'T', 'F'].forEach(function (letter, i) {
      var pill = document.createElement('span');
      pill.className = 'day-pill' + (student.attendance[i] ? '' : ' pending');
      pill.textContent = letter;
      daysEl.appendChild(pill);
    });
  }
 
  if (pctEl) {
    fetch('data/syllabus.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var subjects = (data.tracks[student.track] || { subjects: [] }).subjects;
        var total = 0;
        var done = 0;
        subjects.forEach(function (s) {
          s.topics.forEach(function (t) {
            total += 1;
            if (student.progress[t.id]) done += 1;
          });
        });
        pctEl.textContent = (total ? Math.round((done / total) * 100) : 0) + '%';
      })
      .catch(function () { /* keep placeholder */ });
  }
})();
 