/* ScholaSync — signup.js : controller for pages/signup.html */
(function () {
  'use strict';
 
  var form = document.getElementById('signup-form');
  var errorBox = document.getElementById('signup-error');
  var copyBtn = document.getElementById('copyIdBtn');
 
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.style.display = 'none';
 
    try {
      var student = registerStudent({
        fullName: document.getElementById('fullName').value,
        age: document.getElementById('age').value,
        schoolAbbr: document.getElementById('schoolAbbr').value,
        track: document.getElementById('track').value,
        parentPhone: document.getElementById('parentPhone').value,
        consent: document.getElementById('consentCheck').checked
      });
 
      document.getElementById('signup-form-container').style.display = 'none';
      document.getElementById('generated-id-display').textContent = student.id;
      document.getElementById('id-result-box').style.display = 'block';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });
 
  copyBtn.addEventListener('click', function () {
    var idText = document.getElementById('generated-id-display').textContent;
    function done() { copyBtn.textContent = 'Copied to Clipboard ✓'; }
 
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(idText).then(done, done);
    } else {
      var temp = document.createElement('textarea');
      temp.value = idText;
      document.body.appendChild(temp);
      temp.select();
      try { document.execCommand('copy'); } catch (err) { /* ignore */ }
      document.body.removeChild(temp);
      done();
    }
  });
})();
 