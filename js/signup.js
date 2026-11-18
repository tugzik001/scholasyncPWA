/* ScholaSync — signup.js (patched: School Dropdown + Auth) */
(function () {
  'use strict';

  var form = document.getElementById('signup-form');
  var errorBox = document.getElementById('signup-error');
  var copyBtn = document.getElementById('copyIdBtn');
  var submitBtn = form.querySelector('button[type="submit"]');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  // --- 1. Fetch schools from Supabase for the dropdown ---
    let validSchools = {}; // Dictionary to verify against

  async function loadSchools() {
    const datalist = document.getElementById('school-options');
    try {
      if (window.ScholaSupabase && window.ScholaSupabase.isConfigured()) {
        const res = await fetch(window.ScholaSupabase.config.url + '/rest/v1/schools?select=abbr,name', {
          headers: {
            'apikey': window.ScholaSupabase.config.anonKey,
            'Authorization': 'Bearer ' + window.ScholaSupabase.config.anonKey
          }
        });
        const schools = await res.json();
        
        datalist.innerHTML = '';
        schools.forEach(s => {
          validSchools[s.abbr] = s.name; // Save for validation
          const opt = document.createElement('option');
          opt.value = s.abbr;
          opt.textContent = s.name;
          datalist.appendChild(opt);
        });
      } else {
        // Fallback for local testing
        validSchools['UNN'] = 'Demo University';
        datalist.innerHTML = '<option value="UNN">Demo University</option>';
      }
    } catch (err) {
      console.error('Failed to load schools:', err);
    }
  }
  
  loadSchools();

  // --- 2. Handle Form Submission ---
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorBox.style.display = 'none';

    var pw = document.getElementById('password').value;
    var pw2 = document.getElementById('passwordConfirm').value;
    if (pw !== pw2) { showError('Passwords do not match.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating your ID…';

    var schoolInput = document.getElementById('schoolAbbr').value.trim().toUpperCase();
    
    // THE VERIFIER: Check if the school exists in our dictionary
    if (!validSchools[schoolInput]) {
      showError('School abbreviation not found. Please select a valid registered school.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Generate My Student ID';
      return; // Stop the submission
    }

    // ... then proceed with registerStudent using schoolInput ...
    
    try {
        var student = await registerStudent({
        fullName: document.getElementById('fullName').value,
        age: document.getElementById('age').value,
        schoolAbbr: document.getElementById('schoolAbbr').value,
        classCode: document.getElementById('classCode').value.trim().toUpperCase(), // Add this!
        track: document.getElementById('track').value,
        parentPhone: document.getElementById('parentPhone').value,
        password: pw,
        email: document.getElementById('email').value,
        consent: document.getElementById('consentCheck').checked
      });
      
      document.getElementById('signup-form-container').style.display = 'none';
      document.getElementById('generated-id-display').textContent = student.id;
      document.getElementById('id-result-box').style.display = 'block';
    } catch (err) {
      showError(err.message || 'Something went wrong.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Generate My Student ID';
    }
  });

  // --- 3. Copy ID Button ---
  copyBtn.addEventListener('click', function () {
    var idText = document.getElementById('generated-id-display').textContent;
    function done() { copyBtn.textContent = 'Copied to Clipboard ✓'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(idText).then(done, done);
    } else {
      var t = document.createElement('textarea');
      t.value = idText; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t); done();
    }
  });
})();