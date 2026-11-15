
/* ScholaSync — sms.js : parent SMS alerts with an offline queue
 * Messages are always queued first. They send when the device is online.
 *
 * DEMO MODE (config.endpoint = null): "sending" is simulated, no real SMS leaves the device.
 * REAL SMS: set ScholaSMS.config.endpoint to a small server/serverless function that calls
 * Termii or Africa's Talking. NEVER put an SMS API key in this file; it would be public.
 * The endpoint receives POST JSON { to, body } and must answer 2xx on success.
 *
 * Exposes: window.ScholaSMS
 */
(function (root) {
  'use strict';
 
  var QUEUE_KEY = 'ss_sms_queue';
  var config = { endpoint: null };
  var memory = null;
 
  function readQueue() {
    try {
      return JSON.parse(root.localStorage.getItem(QUEUE_KEY)) || [];
    } catch (e) {
      return memory || [];
    }
  }
 
  function writeQueue(queue) {
    try {
      root.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      memory = queue;
    }
  }
 
  /* Basic 2G phones: keep to plain GSM-style text (strip accents / symbols). */
  function plain(text) {
    return String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  }
 
  function absences(student) {
    return student.attendance.filter(function (present) { return !present; }).length;
  }
 
  function buildMessage(student) {
    var missed = absences(student);
    var first = plain(student.fullName.split(' ')[0]);
    var head = 'ScholaSync ' + student.schoolAbbr + ': ' + first + ' (' + student.id + ') ';
    var body;
 
    if (missed >= 3) {
      body = head + 'missed ' + missed + ' of 5 classes this week. Please contact the school. Thank you.';
    } else {
      body = head + 'attended ' + (5 - missed) + ' of 5 classes this week. Thank you for your support.';
    }
 
    return { text: body, length: body.length, segments: Math.ceil(body.length / 160), alert: missed >= 3 };
  }
 
  function getQueue() {
    return readQueue();
  }
 
  function pendingCount() {
    return readQueue().filter(function (m) { return m.status === 'queued'; }).length;
  }
 
  function notify() {
    document.dispatchEvent(new CustomEvent('ss:sms-updated'));
  }
 
  function queue(student) {
    var msg = buildMessage(student);
    var item = {
      id: 'sms_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      studentId: student.id,
      to: student.parentPhone,
      body: msg.text,
      createdAt: new Date().toISOString(),
      status: 'queued',
      sentAt: null,
      demo: !config.endpoint
    };
    var q = readQueue();
    q.push(item);
    writeQueue(q);
    notify();
    return item;
  }
 
  var flushing = false;
 
  /* Sends everything that is queued. Safe to call any time (does nothing offline). */
  async function flush() {
    if (flushing || !root.navigator.onLine) return readQueue();
    flushing = true;
    try {
      var q = readQueue();
      for (var i = 0; i < q.length; i++) {
        if (q[i].status !== 'queued') continue;
        if (config.endpoint) {
          try {
            var res = await root.fetch(config.endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: q[i].to, body: q[i].body })
            });
            if (!res.ok) continue;
          } catch (e) {
            continue; // signal dropped: stays queued
          }
        }
        q[i].status = 'sent';
        q[i].sentAt = new Date().toISOString();
      }
      writeQueue(q);
      notify();
      return q;
    } finally {
      flushing = false;
    }
  }
 
  /* Convenience for the admin page: queue, try to send, return the final record. */
  async function send(student) {
    var item = queue(student);
    var q = await flush();
    for (var i = 0; i < q.length; i++) {
      if (q[i].id === item.id) return q[i];
    }
    return item;
  }
 
  root.addEventListener('online', flush);
 
  root.ScholaSMS = {
    config: config,
    buildMessage: buildMessage,
    absences: absences,
    queue: queue,
    flush: flush,
    send: send,
    getQueue: getQueue,
    pendingCount: pendingCount
  };
})(window);
 