/* ScholaSync — admin.js : controller for pages/admin.html
 * Weekly Mon–Fri attendance register, 3+ absence red flags and parent SMS.
 * Needs: db.js, auth.js, sms.js
 */
(function () {
  'use strict';
 
  const staff = requireStaff();
  if (!staff) return;
 
  const FLAG_AT = 3;
  const $ = (id) => document.getElementById(id);
  const els = {
    tbody: $('attendance-tbody'),
    total: $('stat-total'),
    flagged: $('stat-flagged'),
    gateway: $('stat-sms'),
    sub: $('admin-sub'),
    logout: $('staffLogoutBtn'),
    modal: $('smsModal'),
    modalTitle: $('smsModalTitle'),
    recipient: $('smsRecipientLabel'),
    preview: $('smsPreviewText'),
    demoNote: $('smsDemoNote'),
    closeSms: $('closeSmsBtn')
  };
 
  const students = ScholaDB.getStudentsBySchool(staff.school);
  const rows = {}; // student id -> { tr, badge, btn }
 
  const missed = (s) => ScholaSMS.absences(s);
 
  /* ---------- stats ---------- */
  function refreshStats() {
    els.total.textContent = students.length;
    els.flagged.textContent = students.filter((s) => missed(s) >= FLAG_AT).length;
 
    const pending = ScholaSMS.pendingCount();
    const online = navigator.onLine;
    els.gateway.textContent = online
      ? '● Ready (Low-Cost Queue)' + (pending ? ' · ' + pending + ' queued' : '')
      : '● Offline · ' + pending + ' queued';
  }
 
  /* ---------- rows ---------- */
  function refreshRow(student) {
    const r = rows[student.id];
    const n = missed(student);
    const flagged = n >= FLAG_AT;
 
    r.tr.classList.toggle('flagged-row', flagged);
    r.badge.className = 'status-badge ' + (flagged ? 'status-alert' : 'status-ok');
    r.badge.textContent = flagged ? '⚠ ' + n + ' missed' : n ? n + ' missed' : '✓ Perfect';
    r.btn.className = 'btn-sms' + (flagged ? '' : ' normal');
    r.btn.textContent = flagged ? 'Send Alert' : 'Send Update';
  }
 
  function cell(tr) {
    const td = document.createElement('td');
    tr.appendChild(td);
    return td;
  }
 
  function buildRow(student) {
    const tr = document.createElement('tr');
 
    const nameTd = cell(tr);
    nameTd.className = 'cell-name';
    const name = document.createElement('strong');
    name.textContent = student.fullName;
    const id = document.createElement('span');
    id.className = 'cell-id';
    id.textContent = student.id;
    nameTd.append(name, id);
 
    cell(tr).textContent = student.age;
 
    const checks = document.createElement('div');
    checks.className = 'day-checks';
    ScholaDB.DAYS.forEach((day, i) => {
      const label = document.createElement('label');
      label.className = 'day-check-label';
      const text = document.createElement('span');
      text.textContent = day;
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!student.attendance[i];
      box.setAttribute('aria-label', student.fullName + ' present on ' + day);
      box.addEventListener('change', () => {
        student.attendance[i] = box.checked;
        ScholaDB.saveStudent(student);
        refreshRow(student);
        refreshStats();
      });
      label.append(text, box);
      checks.appendChild(label);
    });
    cell(tr).appendChild(checks);
 
    const badge = document.createElement('span');
    cell(tr).appendChild(badge);
 
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.addEventListener('click', () => openSms(student));
    cell(tr).appendChild(btn);
 
    rows[student.id] = { tr: tr, badge: badge, btn: btn };
    refreshRow(student);
    return tr;
  }
   // --- Create Class Logic ---
  document.getElementById('createClassBtn').addEventListener('click', async function() {
    const name = document.getElementById('newClassName').value.trim().toUpperCase();
    if (!name) return alert('Enter a class name (e.g., SS1A)');
    
    const code = staff.school + '-' + name; // e.g., UNN-SS1A
    
    if (!navigator.onLine) {
      alert("You must be online to create a new class so it can sync to the database.");
      return;
    }

    try {
      const res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        },
        body: JSON.stringify({ school_abbr: staff.school, name: name, code: code })
      });
      
      if (!res.ok) throw new Error('Class already exists or network error');
      
      document.getElementById('active-class-code').textContent = code;
      document.getElementById('newClassName').value = '';
      alert('Class created! Code: ' + code);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  });
  function renderTable() {
    els.tbody.textContent = '';
    if (!students.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'empty-state';
      td.textContent = 'No students registered for ' + staff.school + ' yet.';
      tr.appendChild(td);
      els.tbody.appendChild(tr);
      return;
    }
    students.forEach((s) => els.tbody.appendChild(buildRow(s)));
  }
 
  /* ---------- SMS modal ---------- */
  async function openSms(student) {
    const msg = ScholaSMS.buildMessage(student);
    els.recipient.textContent = 'Recipient: ' + student.parentPhone + ' (parent/guardian of ' + student.fullName.split(' ')[0] + ')';
    els.preview.textContent = msg.text;
    els.modalTitle.textContent = '📲 Sending…';
    els.demoNote.hidden = !!ScholaSMS.config.endpoint;
    els.modal.classList.add('open');
 
    const result = await ScholaSMS.send(student);
    els.modalTitle.textContent =
      result.status === 'sent'
        ? '📲 2G SMS Alert Sent'
        : '📲 2G SMS Queued · sends when signal returns';
    refreshStats();
  }
 
  function closeSms() {
    els.modal.classList.remove('open');
  }
 
  /* ---------- wiring ---------- */
  els.closeSms.addEventListener('click', closeSms);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeSms();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSms();
  });
  els.logout.addEventListener('click', logout);
  document.addEventListener('ss:sms-updated', refreshStats);
  window.addEventListener('online', refreshStats);
  window.addEventListener('offline', refreshStats);
 
  els.sub.textContent = staff.school + ' • Synced with local database • Rows highlight red at ' + FLAG_AT + '+ missed classes';
  renderTable();
  refreshStats();
  ScholaSMS.flush(); // send anything left queued from an offline session
})();
 