/* ScholaSync — teacher-signup.js */
(function () {
  'use strict';

  const form = document.getElementById('teacher-reg-form');
  const errorBox = document.getElementById('teacher-reg-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  // Load schools for the dropdown
  async function loadSchools() {
    const select = document.getElementById('regTeacherSchool');
    try {
      if (window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
        const res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/schools?select=abbr,name', {
          headers: {
            'apikey': window.ScholaSupabase.config.anonKey,
            'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
          }
        });
        const schools = await res.json();
        select.innerHTML = '<option value="">Select your school...</option>';
        schools.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.abbr;
          opt.textContent = `${s.name} (${s.abbr})`;
          select.appendChild(opt);
        });
      }
    } catch (err) {
      select.innerHTML = '<option value="">Error loading schools</option>';
    }
  }
  loadSchools();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorBox.style.display = 'none';

    const name = document.getElementById('regTeacherName').value.trim();
    const school = document.getElementById('regTeacherSchool').value;
    const email = document.getElementById('regTeacherEmail').value.trim().toLowerCase();
    const pw = document.getElementById('regTeacherPassword').value;
    const pw2 = document.getElementById('regTeacherPasswordConfirm').value;
    const inviteCode = document.getElementById('regTeacherInviteCode').value.trim().toUpperCase();

    if (pw !== pw2) return showError('Passwords do not match.');
    if (!window.ScholaSupabase || !window.ScholaSupabase.isConfigured()) return showError('Database not configured.');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      let finalStatus = 'pending';

      // 1. Check Invite Code if provided
      if (inviteCode) {
                // Get current time to check if the code has expired
        const nowISO = new Date().toISOString();
        
        // Query asks: Does this code exist, for this school, AND is the expiry date in the future?
        const checkRes = await fetch(window.ScholaSupabase.config.url + `/rest/v1/teacher_invites?code=eq.${inviteCode}&school_abbr=eq.${school}&expires_at=gt.${nowISO}`, {
          headers: {
            'apikey': window.ScholaSupabase.config.anonKey,
            'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
          }
        });
        const validCode = await checkRes.json();
        
        if (validCode.length === 0) {
          throw new Error('Invalid or expired invite code. Please check with your Principal.');
        }
        finalStatus = 'active'; // Bypass manual approval!
      }

      // 2. Hash Password
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const salt = btoa(String.fromCharCode.apply(null, saltBytes));
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, key, 256
      );
      const hash = btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));

      // 3. Create Account
      const res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.ScholaSupabase.config.anonKey,
          'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
        },
        body: JSON.stringify({
          school_abbr: school,
          full_name: name,
          email: email,
          password_hash: hash,
          salt: salt,
          status: finalStatus
        })
      });

      if (!res.ok) throw new Error('This email is already registered.');

      // 4. Consume the Invite Code
      if (inviteCode) {
        await fetch(window.ScholaSupabase.config.url + `/rest/v1/teacher_invites?code=eq.${inviteCode}`, {
          method: 'DELETE',
          headers: {
            'apikey': window.ScholaSupabase.config.anonKey,
            'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
          }
        });
      }

      if (finalStatus === 'active') {
        alert('Registration successful! You can now log in.');
      } else {
        alert('Registration submitted! Please wait for your Principal to approve your account.');
      }
      window.location.href = 'login.html';

    } catch (err) {
      showError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Registration';
    }
  });
})();