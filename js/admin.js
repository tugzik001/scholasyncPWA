/* ScholaSync — admin.js */
(function () {
  'use strict';

  const staff = requireStaff();
  if (!staff) return;

  document.getElementById('staff-name').textContent = staff.name || 'Teacher';
  document.getElementById('staff-school').textContent = staff.school;

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
    closeSms: $('closeSmsBtn'),
    removeModal: $('removeModal'),
    removeText: $('removeModalText'),
    cancelRemove: $('cancelRemoveBtn'),
    confirmRemove: $('confirmRemoveBtn')
  };

  let students = []; // Will be populated from Supabase or local
  const rows = {};
  let studentToRemove = null;

  const missed = (s) => ScholaSMS.absences(s);

  /* ---------- Fetch Students ---------- */
  async function loadStudents() {
    if (navigator.onLine && window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
      try {
        const res = await fetch(window.ScholaSupabase.config.url + `/rest/v1/students?school_abbr=eq.${staff.school}`, {
          headers: {
            'apikey': window.ScholaSupabase.config.anonKey,
            'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
          }
        });
        const cloudStudents = await res.json();
        
        // Merge with local data for attendance progress
        const localStudents = ScholaDB.getStudentsBySchool(staff.school);
        
        students = cloudStudents.map(cs => {
          const local = localStudents.find(ls => ls.id === cs.id);
          return {
            id: cs.id,
            fullName: cs.full_name,
            age: cs.age,
            schoolAbbr: cs.school_abbr,
            classCode: cs.class_code,
            track: cs.track,
            parentPhone: cs.parent_phone,
            attendance: local ? local.attendance : [true, true, true, true, true],
            progress: local ? local.progress : {}
          };
        });
        
        // Save cloud data locally so it works offline next time
        students.forEach(s => ScholaDB.saveStudent(s));
        
      } catch (err) {
        console.warn('Offline or network error. Falling back to local database.');
        students = ScholaDB.getStudentsBySchool(staff.school);
      }
    } else {
      students = ScholaDB.getStudentsBySchool(staff.school);
    }
    
    renderTable();
    refreshStats();
  }

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
    if (!r) return;
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
    id.textContent = student.id + (student.classCode ? ' • ' + student.classCode : '');
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
 
    const actionTd = cell(tr);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.addEventListener('click', () => openSms(student));
    actionTd.appendChild(btn);

    // Remove Button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-ghost text-danger';
    removeBtn.style.marginLeft = '8px';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => openRemoveModal(student));
    actionTd.appendChild(removeBtn);
 
    rows[student.id] = { tr: tr, badge: badge, btn: btn };
    refreshRow(student);
    return tr;
  }

  function renderTable() {
    els.tbody.textContent = '';
    if (!students.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'empty-state';
      td.textContent = 'No students registered for ' + staff.school + ' yet.';
      tr.appendChild(td);
      els.tbody.appendChild(tr);
      return;
    }
    students.forEach((s) => els.tbody.appendChild(buildRow(s)));
  }

  /* ---------- Remove Student Logic ---------- */
  function openRemoveModal(student) {
    studentToRemove = student;
    els.removeText.textContent = `Are you sure you want to remove ${student.fullName} from ${student.classCode || 'this school'}? This cannot be undone.`;
    els.removeModal.classList.add('open');
  }

  els.cancelRemove.addEventListener('click', () => {
    els.removeModal.classList.remove('open');
    studentToRemove = null;
  });

  els.confirmRemove.addEventListener('click', async () => {
    if (!studentToRemove) return;
    
    // Remove locally
    let localStudents = ScholaDB.getStudents();
    localStudents = localStudents.filter(s => s.id !== studentToRemove.id);
    ScholaDB.saveStudents(localStudents);
    
    // Remove from Supabase
    if (navigator.onLine && window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
       try {
         await fetch(window.ScholaSupabase.config.url + `/rest/v1/students?id=eq.${studentToRemove.id}`, {
            method: 'DELETE',
            headers: {
              'apikey': window.ScholaSupabase.config.anonKey,
              'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
            }
         });
       } catch (e) {
         console.warn('Failed to delete from cloud, but removed locally.');
       }
    }
    
    els.removeModal.classList.remove('open');
    loadStudents(); // Refresh the list
  });

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

  /* ---------- Wiring ---------- */
  els.closeSms.addEventListener('click', closeSms);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeSms();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSms();
  });
  els.logout.addEventListener('click', logout);
  
  document.getElementById('createClassBtn').addEventListener('click', async function() {
    const name = document.getElementById('newClassName').value.trim().toUpperCase();
    if (!name) return alert('Enter a class name (e.g., SS1A)');
    const code = staff.school + '-' + name;
    if (!navigator.onLine) return alert("You must be online to create a class.");
    try {
          if (!window.ScholaSupabase || !window.ScholaSupabase.isConfigured()) {
      alert("Database not configured. Cannot create class.");
      return;
    }
      const res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        },
        body: JSON.stringify({ school_abbr: staff.school, name: name, code: code })
      });
      if (!res.ok) throw new Error('Class already exists.');
      document.getElementById('active-class-code').textContent = code;
      document.getElementById('newClassName').value = '';
      alert('Class created! Code: ' + code);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  });

  document.getElementById('addTeacherBtn').addEventListener('click', async function() {
    const name = document.getElementById('newTeacherName').value.trim();
    const email = document.getElementById('newTeacherEmail').value.trim().toLowerCase();
    const pw = document.getElementById('newTeacherPassword').value;
    if (!name || !email || pw.length < 6) return alert('Enter a name, email, and 6+ char password.');
    try {
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const salt = btoa(String.fromCharCode.apply(null, saltBytes));
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, key, 256);
      const hash = btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));
          if (!window.ScholaSupabase || !window.ScholaSupabase.isConfigured()) {
      alert("Database not configured. Cannot create class.");
      return;
    }
      const res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        },
        body: JSON.stringify({ school_abbr: staff.school, full_name: name, email: email, password_hash: hash, salt: salt, role: 'teacher' })
      });
      if (!res.ok) throw new Error('Email already registered.');
      alert('Teacher added successfully!');
      document.getElementById('newTeacherName').value = '';
      document.getElementById('newTeacherEmail').value = '';
      document.getElementById('newTeacherPassword').value = '';
    } catch (e) {
      alert(e.message);
    }
  });

  // Initialize
  els.sub.textContent = staff.school + ' • Synced with local database • Rows highlight red at ' + FLAG_AT + '+ missed classes';
  loadStudents();
  ScholaSMS.flush();
})();