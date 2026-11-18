/* ScholaSync — school-portal.js */
(function () {
  'use strict';

  var form = document.getElementById('school-form');
  var errorBox = document.getElementById('school-error');
  var submitBtn = form.querySelector('button[type="submit"]');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorBox.style.display = 'none';

    var pw = document.getElementById('adminPassword').value;
    var pw2 = document.getElementById('adminPasswordConfirm').value;
    if (pw !== pw2) { showError('Passwords do not match.'); return; }

    var abbr = document.getElementById('schoolAbbr').value.toUpperCase();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';

    try {
      // 1. Check if Supabase is configured
      if (!window.ScholaSupabase || !window.ScholaSupabase.isConfigured()) {
        throw new Error('Supabase is not configured. Cannot register school.');
      }

      // 2. Check if School Abbr already exists
      var checkRes = await fetch(window.ScholaSupabase.config.url + '/rest/v1/schools?abbr=eq.' + abbr, {
        headers: {
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        }
      });
      var existing = await checkRes.json();
      if (existing.length > 0) {
        throw new Error('The abbreviation "' + abbr + '" is already taken. Please choose another.');
      }

      // 3. Hash the admin password
      var salt = btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(16))));
      var enc = new TextEncoder();
      var key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      var bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: 100000, hash: 'SHA-256' },
        key, 256
      );
      var hash = btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));

      // 4. Insert into Supabase
      var payload = {
        name: document.getElementById('schoolName').value,
        abbr: abbr,
        type: document.getElementById('schoolType').value,
        state: document.getElementById('schoolState').value,
        lga: document.getElementById('schoolLga').value,
        initiator_name: document.getElementById('initiatorName').value,
        initiator_role: document.getElementById('initiatorRole').value,
        initiator_phone: document.getElementById('initiatorPhone').value,
        initiator_email: document.getElementById('initiatorEmail').value,
        password_hash: hash,
        salt: salt,
        status: 'approved' // Auto-approve for pilot. Change to 'pending' for production.
      };

      var res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        var errText = await res.text();
        throw new Error('Failed to register: ' + errText);
      }

      // 5. Show success
      document.getElementById('signup-form-container').style.display = 'none';
      document.getElementById('generated-school-id').textContent = abbr;
      document.getElementById('success-box').style.display = 'block';

    } catch (err) {
      showError(err.message || 'Something went wrong.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register School';
    }
  });
})();