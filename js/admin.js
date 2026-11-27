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
    confirmRemove: $('confirmRemoveBtn'),
    classFilter: $('classFilter')
  };

  let allStudents = []; // Master list
  let students = [];    // Filtered list to render
  const rows = {};
  let studentToRemove = null;

  const missed = (s) => ScholaSMS.absences(s);

  /* ---------- Load Classes for Dropdown ---------- */
  async function loadClasses() {
    if (!navigator.onLine || !window.ScholaSupabase) return;
    try {
      const res = await fetch(window.ScholaSupabase.config.url + `/rest/v1/classes?school_abbr=eq.${staff.school}`, {
        headers: {
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        }
      });
      const classes = await res.json();
      els.classFilter.innerHTML = '<option value="all">All Classes</option>';
      classes.forEach(c => {
        els.classFilter.innerHTML += `<option value="${c.code}">${c.name} (${c.code})</option>`;
      });
    } catch (e) { console.error('Error loading classes', e); }
  }

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
        const localStudents = ScholaDB.getStudentsBySchool(staff.school);
        
        allStudents = cloudStudents.map(cs => {
          const local = localStudents.find(ls => ls.id === cs.id);
          return {
            id: cs.id, fullName: cs.full_name, age: cs.age, schoolAbbr: cs.school_abbr,
            classCode: cs.class_code, track: cs.track, parentPhone: cs.parent_phone,
            attendance: local ? local.attendance : [true, true, true, true, true],
            progress: local ? local.progress : {}
          };
        });
        allStudents.forEach(s => ScholaDB.saveStudent(s));
      } catch (err) {
        allStudents = ScholaDB.getStudentsBySchool(staff.school);
      }
    } else {
      allStudents = ScholaDB.getStudentsBySchool(staff.school);
    }
    
    filterStudents(); // Apply the filter and render
  }

  /* ---------- Filtering Logic ---------- */
  function filterStudents() {
    const selected = els.classFilter.value;
    if (selected === 'all') {
      students = [...allStudents];
    } else {
      students = allStudents.filter(s => s.classCode === selected);
    }
    renderTable();
    refreshStats();
  }

  els.classFilter.addEventListener('change', filterStudents);

  /* ---------- Pending Teachers (Keep as is) ---------- */
  async function loadPendingTeachers() {
    if (!navigator.onLine || !window.ScholaSupabase) return;
    try {
      const res = await fetch(window.ScholaSupabase.config.url + `/rest/v1/teachers?school_abbr=eq.${staff.school}&status=eq.pending`, {
        headers: {
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        }
      });
      const pending = await res.json();
      const section = document.getElementById('pending-teachers-section');
      const list = document.getElementById('pending-teachers-list');
      
      if (pending.length === 0) { section.style.display = 'none'; return; }
      
      section.style.display = 'block';
      list.innerHTML = '';
      pending.forEach(t => {
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center';
        row.style.background = 'var(--surface-soft)'; row.style.padding = '10px'; row.style.borderRadius = '8px';
        row.innerHTML = `<div><strong>${t.full_name}</strong><br><small>${t.email}</small></div><button class="btn btn-primary" onclick="approveTeacher('${t.id}')">Approve</button>`;
        list.appendChild(row);
      });
    } catch (e) { console.error('Pending teachers error', e); }
  }

  window.approveTeacher = async function(id) {
    try {
      await fetch(window.ScholaSupabase.config.url + `/rest/v1/teachers?id=eq.${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': window.ScholaSupabase.config.anonKey, 'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey },
        body: JSON.stringify({ status: 'active' })
      });
      loadPendingTeachers();
    } catch (e) { alert('Failed to approve'); }
  };

  /* ---------- Stats & Table Rendering ---------- */
  function refreshStats() {
    els.total.textContent = students.length;
    els.flagged.textContent = students.filter((s) => missed(s) >= FLAG_AT).length;
    const pending = ScholaSMS.pendingCount();
    els.gateway.textContent = navigator.onLine
      ? '● Ready (Low-Cost Queue)' + (pending ? ' · ' + pending + ' queued' : '')
      : '● Offline · ' + pending + ' queued';
  }

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
    nameTd.innerHTML = `<strong>${student.fullName}</strong><span class="cell-id">${student.id}</span>`;
    
    cell(tr).textContent = student.classCode || '—';
    cell(tr).textContent = student.age;
 
    const checks = document.createElement('div');
    checks.className = 'day-checks';
    ScholaDB.DAYS.forEach((day, i) => {
      const label = document.createElement('label');
      label.className = 'day-check-label';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!student.attendance[i];
      box.addEventListener('change', () => {
        student.attendance[i] = box.checked;
        ScholaDB.saveStudent(student);
        refreshRow(student);
        refreshStats();
      });
      label.append(document.createTextNode(day), box);
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

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-ghost text-danger';
    removeBtn.style.marginLeft = '8px';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => openRemoveModal(student));
    actionTd.appendChild(removeBtn);
 
    rows[student.id] = { tr, badge, btn };
    refreshRow(student);
    return tr;
  }

  function renderTable() {
    els.tbody.textContent = '';
    if (!students.length) {
      els.tbody.innerHTML = `<tr><td colSpan="6" class="empty-state">No students found ${els.classFilter.value === 'all' ? '' : 'for this class'}.</td></tr>`;
      return;
    }
    students.forEach((s) => els.tbody.appendChild(buildRow(s)));
  }

  /* ---------- Create Class ---------- */
  document.getElementById('createClassBtn').addEventListener('click', async function() {
    const name = document.getElementById('newClassName').value.trim().toUpperCase();
    if (!name) return alert('Enter a class name (e.g., SS1A)');
    const code = staff.school + '-' + name;
    if (!navigator.onLine) return alert("You must be online to create a class.");
    
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
      if (!res.ok) throw new Error('Class already exists.');
      
      document.getElementById('newClassName').value = '';
      
      // Add the new class to the dropdown and select it
      els.classFilter.innerHTML += `<option value="${code}">${name} (${code})</option>`;
      els.classFilter.value = code;
      filterStudents();
      
      alert('Class created! Code: ' + code);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  });

  document.getElementById('generateInviteBtn').addEventListener('click', async function() {
    if (!navigator.onLine) return alert("You must be online to generate a code.");
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = staff.school + '-' + randomStr;
    try {
      const res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/teacher_invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        },
        body: JSON.stringify({ code: code, school_abbr: staff.school })
      });
      if (!res.ok) throw new Error('Failed to generate code.');
      document.getElementById('active-invite-code').textContent = code;
      alert('Invite code generated: ' + code + '\n\nExpires in 48 hours.');
    } catch (e) {
      alert(e.message);
    }
  });

  /* ---------- Modals (SMS & Remove) ---------- */
  async function openSms(student) {
    const msg = ScholaSMS.buildMessage(student);
    els.recipient.textContent = 'Recipient: ' + student.parentPhone + ' (parent/guardian of ' + student.fullName.split(' ')[0] + ')';
    els.preview.textContent = msg.text;
    els.modalTitle.textContent = '📲 Sending…';
    els.demoNote.hidden = !!ScholaSMS.config.endpoint;
    els.modal.classList.add('open');
    const result = await ScholaSMS.send(student);
    els.modalTitle.textContent = result.status === 'sent' ? '📲 2G SMS Alert Sent' : '📲 2G SMS Queued · sends when signal returns';
    refreshStats();
  }

  function closeSms() { els.modal.classList.remove('open'); }

  function openRemoveModal(student) {
    studentToRemove = student;
    els.removeText.textContent = `Are you sure you want to remove ${student.fullName} from ${student.classCode || 'this school'}?`;
    els.removeModal.classList.add('open');
  }

  els.cancelRemove.addEventListener('click', () => { els.removeModal.classList.remove('open'); studentToRemove = null; });
  els.confirmRemove.addEventListener('click', async () => {
    if (!studentToRemove) return;
    let localStudents = ScholaDB.getStudents();
    localStudents = localStudents.filter(s => s.id !== studentToRemove.id);
    ScholaDB.saveStudents(localStudents);
    
    if (navigator.onLine && window.ScholaSupabase) {
       try {
         await fetch(window.ScholaSupabase.config.url + `/rest/v1/students?id=eq.${studentToRemove.id}`, {
            method: 'DELETE',
            headers: { 'apikey': window.ScholaSupabase.config.anonKey, 'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey }
         });
       } catch (e) { console.warn(e); }
    }
    els.removeModal.classList.remove('open');
    loadStudents();
  });

  els.closeSms.addEventListener('click', closeSms);
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeSms(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSms(); });
  els.logout.addEventListener('click', logout);
  
  // Initialize
  els.sub.textContent = staff.school + ' • Synced with local database • Rows highlight red at ' + FLAG_AT + '+ missed classes';
  loadClasses();       // <-- Loads the dropdown first
  loadStudents();      // <-- Loads the students, then calls filterStudents()
  loadPendingTeachers();
  ScholaSMS.flush();
})();