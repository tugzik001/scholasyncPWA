/* ScholaSync — student.js : controller for pages/student-dashboard.html
 * Needs: db.js, auth.js. Data: ../data/syllabus.json, ../assets/guides/<track>/<subject>.json
 * Progress is saved per student in student.progress { topicId: true }.
 */
(function () {
  'use strict';
 
  const student = requireStudent();
  if (!student) return;
 
  const SYLLABUS_URL = '../data/syllabus.json';
 
  const $ = (id) => document.getElementById(id);
  const els = {
    greeting: $('student-greeting'),
    idPill: $('student-id-pill'),
    trackPill: $('student-track-pill'),
    schoolPill: $('student-school-pill'),
    progressLabel: $('progress-label'),
    progressSub: $('progress-sub'),
    progressFill: $('progress-fill'),
    grid: $('subjects-grid'),
    modal: $('noteModal'),
    modalTitle: $('modalTitle'),
    modalContent: $('modalContent'),
    closeModal: $('closeModalBtn'),
    logout: $('logoutBtn'),
    status: $('offline-status'),
    tabs: document.querySelectorAll('.track-btn')
  };
 
  let syllabus = null;
  let activeTrack = student.track;
  const countEls = {}; // subject id -> counter pill
 
  /* ---------- header ---------- */
  function renderHeader() {
    const h = new Date().getHours();
    const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const icon = h < 12 ? '☀' : h < 17 ? '🌤' : '🌙';
    els.greeting.textContent = hello + ', ' + student.fullName.split(' ')[0] + ' ' + icon;
    els.idPill.textContent = 'ID: ' + student.id;
    els.trackPill.textContent = 'Department: ' + student.track;
    els.schoolPill.textContent = 'School: ' + student.schoolAbbr;
  }
 
  function renderStatus() {
    const online = navigator.onLine;
    els.status.textContent = online ? '● Online' : '● Offline mode';
    els.status.classList.toggle('green', online);
  }
 
  /* ---------- progress ---------- */
  function trackSubjects() {
    return syllabus.tracks[activeTrack].subjects;
  }
 
  function subjectDone(subject) {
    return subject.topics.filter((t) => student.progress[t.id]).length;
  }
 
  function refreshProgress() {
    let total = 0;
    let done = 0;
    trackSubjects().forEach((s) => {
      total += s.topics.length;
      const d = subjectDone(s);
      done += d;
      if (countEls[s.id]) countEls[s.id].textContent = d + '/' + s.topics.length;
    });
 
    const pct = total ? Math.round((done / total) * 100) : 0;
    els.progressLabel.textContent = pct + '% Syllabus Completed';
    els.progressFill.style.width = pct + '%';
    els.progressSub.textContent =
      pct === 100
        ? 'Every topic revised. Time for past questions!'
        : done + ' of ' + total + ' ' + activeTrack + ' topics revised for WAEC & JAMB';
  }
 
  function setTopic(id, checked) {
    if (checked) student.progress[id] = true;
    else delete student.progress[id];
    ScholaDB.saveStudent(student);
    refreshProgress();
  }
 
  /* ---------- subject cards ---------- */
  function buildTopic(topic) {
    const li = document.createElement('li');
    li.className = 'topic-item';
 
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'topic-' + topic.id;
    box.checked = !!student.progress[topic.id];
 
    const text = document.createElement('span');
    text.textContent = topic.title;
 
    li.classList.toggle('checked', box.checked);
    box.addEventListener('change', () => {
      li.classList.toggle('checked', box.checked);
      setTopic(topic.id, box.checked);
    });
    li.addEventListener('click', (e) => {
      if (e.target !== box) box.click();
    });
 
    li.append(box, text);
    return li;
  }
 
  function buildSubject(subject) {
    const card = document.createElement('article');
    card.className = 'subject-card';
 
    const top = document.createElement('div');
    top.className = 'subject-top';
    const title = document.createElement('h3');
    title.textContent = subject.name;
    const count = document.createElement('span');
    count.className = 'pill green';
    countEls[subject.id] = count;
    top.append(title, count);
 
    const list = document.createElement('ul');
    list.className = 'topic-list';
    subject.topics.forEach((t) => list.appendChild(buildTopic(t)));
 
    const notesBtn = document.createElement('button');
    notesBtn.type = 'button';
    notesBtn.className = 'btn btn-outline btn-block';
    notesBtn.textContent = '📖 Open Offline Study Notes';
    notesBtn.addEventListener('click', () => openNotes(subject));
 
    const body = document.createElement('div');
    body.append(top, list);
    card.append(body, notesBtn);
    return card;
  }
 
  function renderTrack() {
    els.tabs.forEach((b) => b.classList.toggle('active', b.dataset.track === activeTrack));
    els.grid.textContent = '';
    Object.keys(countEls).forEach((k) => delete countEls[k]);
    trackSubjects().forEach((s) => els.grid.appendChild(buildSubject(s)));
    refreshProgress();
  }
 
  /* ---------- notes modal ---------- */
  function addBlock(parent, heading, items) {
    if (!items || !items.length) return;
    const h = document.createElement('h3');
    h.textContent = heading;
    const ul = document.createElement('ul');
    items.forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    parent.append(h, ul);
  }
 
  function renderGuide(guide) {
    els.modalContent.textContent = '';
    if (guide.summary) {
      const p = document.createElement('p');
      p.textContent = guide.summary;
      els.modalContent.appendChild(p);
    }
    (guide.sections || []).forEach((s) => addBlock(els.modalContent, s.heading, s.points));
    addBlock(els.modalContent, 'Key formulas & facts', guide.formulas);
    addBlock(els.modalContent, 'Exam tips', guide.tips);
  }
 
  function renderNotesFallback(subject) {
    els.modalContent.textContent = '';
    const p = document.createElement('p');
    p.textContent =
      'These notes are not saved on this device yet. Open ScholaSync once while online and they will be stored for offline use. Meanwhile, here is the topic list to revise:';
    els.modalContent.appendChild(p);
    addBlock(els.modalContent, subject.name + ' topics', subject.topics.map((t) => t.title));
  }
 
  async function openNotes(subject) {
    els.modalTitle.textContent = subject.name + ' — Study Notes';
    els.modalContent.textContent = 'Loading notes…';
    els.modal.classList.add('open');
    try {
      const res = await fetch('../' + subject.notes);
      if (!res.ok) throw new Error('missing');
      renderGuide(await res.json());
    } catch (e) {
      renderNotesFallback(subject);
    }
  }
 
  function closeNotes() {
    els.modal.classList.remove('open');
  }
 
  /* ---------- wiring ---------- */
  els.tabs.forEach((b) =>
    b.addEventListener('click', () => {
      activeTrack = b.dataset.track;
      renderTrack();
    })
  );
  els.closeModal.addEventListener('click', closeNotes);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeNotes();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNotes();
  });
  els.logout.addEventListener('click', logout);
  window.addEventListener('online', renderStatus);
  window.addEventListener('offline', renderStatus);
 
  renderHeader();
  renderStatus();
 
    fetch(SYLLABUS_URL)
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' - ' + res.statusText);
      return res.json();
    })
    .then((data) => {
      syllabus = data;
      if (!syllabus.tracks[activeTrack]) activeTrack = Object.keys(syllabus.tracks)[0];
      renderTrack();
    })
    .catch((err) => {
      console.error("Syllabus load failed:", err);
      els.grid.textContent = '';
      const msg = document.createElement('p');
      msg.className = 'empty-state text-danger';
      // This will print the exact reason on your screen!
      msg.textContent = 'Error loading syllabus: ' + err.message + '. Ensure data/syllabus.json exists.';
      els.grid.appendChild(msg);
    });
})();
 