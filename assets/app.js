/* Dekuu v2 — Firebase + Animated UI */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, updateProfile, updateEmail, GoogleAuthProvider, signInWithPopup, sendEmailVerification, sendPasswordResetEmail, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, query, where, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8GwON5ncowfllNuvKi3FXW6op_9phMts",
  authDomain: "dekuu-8483c.firebaseapp.com",
  projectId: "dekuu-8483c",
  storageBucket: "dekuu-8483c.firebasestorage.app",
  messagingSenderId: "512811810672",
  appId: "1:512811810672:web:c3ec24c64a50d341d919b5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();


// Send custom email via Resend (through Vercel function)
async function sendCustomEmail(to, type, linkOrCode, name) {
  try {
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, link: linkOrCode, name })
    });
  } catch(err) {
    console.warn('Custom email failed, Firebase fallback used:', err);
  }
}


// Global banner message
async function checkGlobalBanner() {
  try {
    const { getDoc: gd, doc: d } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await gd(d(db, 'global', 'banner'));
    if(snap.exists() && snap.data().active && snap.data().message) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:linear-gradient(135deg,rgba(124,58,237,.2),rgba(34,211,238,.15));border-bottom:1px solid rgba(124,58,237,.3);padding:10px 24px;text-align:center;font-size:.9rem;color:#e6e8ee;position:relative';
      banner.innerHTML = `<span>📢 ${snap.data().message}</span><button onclick="this.parentNode.remove()" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.1rem">✕</button>`;
      document.body.insertBefore(banner, document.body.firstChild);
    }
  } catch(e) { console.warn('Banner check failed:', e); }
}

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

// Active nav
(function(){
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a => {
    if(a.getAttribute('href') === page) a.classList.add('active-link');
  });
})();

// Reveal animation
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('show'); obs.unobserve(e.target); } });
}, { threshold: .12 });
$$('.reveal').forEach(el => obs.observe(el));

// Auth nav
async function renderNav(user) {
  const nav = $('#navAuth'); if(!nav) return;
  if(user){
    // Check if user is admin
    let isAdmin = false;
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      isAdmin = adminSnap.exists();
    } catch(e) {}

    const adminBtn = isAdmin
      ? `<a class="btn small" href="admin.html" style="background:linear-gradient(135deg,#7c3aed,#22d3ee);position:relative;overflow:hidden" id="adminNavBtn">
           <span style="position:relative;z-index:1">⚡ Admin</span>
         </a>`
      : '';
    nav.innerHTML = `${adminBtn}<a class="btn small ghost" href="profile.html">Profile</a> <a class="btn small ghost" id="logoutBtn" href="#">Logout</a>`;
    $('#logoutBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut(auth);
      location.href = 'index.html';
    });
  } else {
    nav.innerHTML = `<a class="btn small" href="login.html">Login</a> <a class="btn small ghost" href="signup.html">Sign up</a>`;
  }
}

onAuthStateChanged(auth, (user) => renderNav(user));

// Google sign-in
async function onGoogleSignIn(outEl) {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const isNew = result._tokenResponse?.isNewUser;
    // Save user record to Firestore
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName || '',
        email: user.email || '',
        createdAt: new Date()
      }, { merge: true });
      // Google users are auto-verified
      const q = query(collection(db, 'verified_users'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      if(snap.empty) {
        await addDoc(collection(db, 'verified_users'), {
          uid: user.uid, email: user.email, verifiedAt: new Date(), verifiedBy: 'google'
        });
      }
    } catch(e) { console.warn('Could not save Google user record:', e); }
    // Send welcome email with password reset link for new Google users
    if(isNew) {
      try {
        await sendPasswordResetEmail(auth, user.email, {
          url: window.location.origin + '/reset-password.html'
        });
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            type: 'googleWelcome',
            name: user.displayName || user.email,
            link: window.location.origin + '/login.html'
          })
        });
      } catch(e) { console.warn('Welcome email failed:', e); }
    }
    outSet(outEl, 'Signed in with Google! Redirecting…');
    setTimeout(() => location.href = 'profile.html', 700);
  } catch(err) {
    if(err.code === 'auth/popup-blocked') {
      outSet(outEl, 'Popup was blocked by your browser. Please allow popups for this site and try again.', true);
    } else if(err.code === 'auth/popup-closed-by-user') {
      outSet(outEl, 'Sign-in cancelled.', true);
    } else {
      outSet(outEl, err.message, true);
    }
  }
}

// Inject Google button
function injectGoogleButton(formEl, outEl) {
  // Insert AFTER the form element, never inside it, to prevent form submit interference
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;gap:10px;margin-top:14px';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div>
      <span style="color:#99a3b2;font-size:.85rem">or continue with</span>
      <div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div>
    </div>
    <button id="googleBtn" type="button" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;border-radius:14px;background:#fff;color:#111;border:none;font-weight:700;cursor:pointer;font-size:.95rem;width:100%;transition:opacity .2s" onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Continue with Google
    </button>
  `;
  // Place after the form, not inside it
  formEl.insertAdjacentElement('afterend', wrap);
  document.getElementById('googleBtn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onGoogleSignIn(outEl);
  });
}

// Inject forgot password link into login form
function injectForgotPassword(outEl) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;justify-content:flex-end;margin-top:-4px';
  wrap.innerHTML = `<a id="forgotBtn" href="#" style="color:#7c3aed;font-size:.9rem;text-decoration:none;">Forgot password?</a>`;
  outEl.parentNode.insertBefore(wrap, outEl);

  document.getElementById('forgotBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('#l_email').value.trim();
    if(!email) return outSet(outEl, 'Enter your email above first.', true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: window.location.origin + '/reset-password.html'
      });
      outSet(outEl, '✅ Password reset email sent! Check your inbox.');
    } catch(err) {
      outSet(outEl, err.message, true);
    }
  });
}

// Signup
async function onSignup(e){
  e.preventDefault();
  const name  = $('#s_name').value.trim();
  const email = $('#s_email').value.trim();
  const pass  = $('#s_pass').value;
  const pass2 = $('#s_pass2').value;
  const out   = $('#s_out');
  if(!name || !email || !pass) return outSet(out, 'Please fill all fields', true);
  if(pass !== pass2) return outSet(out, 'Passwords do not match', true);
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(user, { displayName: name });
    // Save user record to Firestore for admin panel
    try {
      await setDoc(doc(db, 'users', user.uid), { displayName: name, email, createdAt: new Date() });
    } catch(e) { console.warn('Could not save user record:', e); }
    await signOut(auth);
    // Generate OTP and send styled email via Resend
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem('dekuu_verify_code', code);
    sessionStorage.setItem('dekuu_verify_email', email);
    sessionStorage.setItem('dekuu_verify_pass', pass);
    await sendCustomEmail(email, 'verify', code, name);
    outSet(out, '✅ Account created! A 6-digit code was sent to your email.');
    // Show code input
    const wrap = document.createElement('div');
    wrap.id = 'verify_wrap';
    wrap.style.cssText = 'display:grid;gap:8px;margin-top:10px';
    wrap.innerHTML = `
      <input id="verify_code_input" class="input" placeholder="Enter 6-digit code" maxlength="6">
      <button id="verify_code_btn" class="btn small" type="button">Verify & Continue</button>
      <button id="resend_code_btn" class="btn small ghost" type="button">Resend code</button>
    `;
    out.after(wrap);
    document.getElementById('resend_code_btn').onclick = async () => {
      const resendBtn = document.getElementById('resend_code_btn');
      resendBtn.disabled = true;
      resendBtn.textContent = 'Sending…';
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      sessionStorage.setItem('dekuu_verify_code', newCode);
      await sendCustomEmail(sessionStorage.getItem('dekuu_verify_email'), 'verify', newCode, name);
      resendBtn.textContent = '✅ Sent! Check your inbox.';
      setTimeout(() => { resendBtn.disabled = false; resendBtn.textContent = 'Resend code'; }, 30000);
    };
    document.getElementById('verify_code_btn').onclick = async () => {
      const entered = document.getElementById('verify_code_input').value.trim();
      const saved = sessionStorage.getItem('dekuu_verify_code');
      const savedEmail = sessionStorage.getItem('dekuu_verify_email');
      const savedPass = sessionStorage.getItem('dekuu_verify_pass');
      if(entered !== saved) return outSet(out, '❌ Wrong code. Try again.', true);
      sessionStorage.removeItem('dekuu_verify_code');
      sessionStorage.removeItem('dekuu_verify_email');
      sessionStorage.removeItem('dekuu_verify_pass');
      // Sign in and mark verified in Firestore
      const { user: u } = await signInWithEmailAndPassword(auth, savedEmail, savedPass);
      try {
        await addDoc(collection(db, 'verified_users'), { uid: u.uid, email: savedEmail, verifiedAt: new Date() });
      } catch(e) { console.warn('Could not save verification:', e); }
      wrap.remove();
      outSet(out, '✅ Email verified! Redirecting…');
      setTimeout(() => location.href = 'profile.html', 1500);
    };
  } catch(err) {
    outSet(out, err.message, true);
  }
}

// Login
async function onLogin(e){
  e.preventDefault();
  const email = $('#l_email').value.trim();
  const pass  = $('#l_pass').value;
  const out   = $('#l_out');
  // Remove any old resend button
  document.getElementById('resendBtn')?.remove();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    // Check if user verified via our OTP system
    let isVerified = false;
    try {
      const q = query(collection(db, 'verified_users'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      isVerified = !snap.empty;
    } catch(e) {
      console.warn('Verification check failed:', e);
      isVerified = true; // allow login if Firestore check fails
    }
    if(!isVerified){
      await signOut(auth);
      outSet(out, '❌ Please verify your email first. Check your inbox.', true);
      const resendBtn = document.createElement('button');
      resendBtn.id = 'resendBtn';
      resendBtn.textContent = 'Resend verification email';
      resendBtn.className = 'btn small ghost';
      resendBtn.style.marginTop = '8px';
      resendBtn.onclick = async () => {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        sessionStorage.setItem('dekuu_verify_code', code);
        sessionStorage.setItem('dekuu_verify_email', email);
        sessionStorage.setItem('dekuu_verify_pass', pass);
        const { user: u } = await signInWithEmailAndPassword(auth, email, pass);
        await sendCustomEmail(email, 'verify', code, u.displayName || '');
        await signOut(auth);
        resendBtn.textContent = '✅ Sent! Check your inbox.';
        resendBtn.disabled = true;
        // Show code input
        const wrap = document.createElement('div');
        wrap.id = 'verify_wrap';
        wrap.style.cssText = 'display:grid;gap:8px;margin-top:10px';
        wrap.innerHTML = `
          <input id="verify_code_input" class="input" placeholder="Enter 6-digit code" maxlength="6">
          <button id="verify_code_btn" class="btn small" type="button">Verify & Continue</button>
        `;
        resendBtn.after(wrap);
        document.getElementById('verify_code_btn').onclick = async () => {
          const entered = document.getElementById('verify_code_input').value.trim();
          const saved = sessionStorage.getItem('dekuu_verify_code');
          const savedEmail = sessionStorage.getItem('dekuu_verify_email');
          const savedPass = sessionStorage.getItem('dekuu_verify_pass');
          if(entered !== saved) return outSet(out, '❌ Wrong code. Try again.', true);
          sessionStorage.removeItem('dekuu_verify_code');
          sessionStorage.removeItem('dekuu_verify_email');
          sessionStorage.removeItem('dekuu_verify_pass');
          const { user: u2 } = await signInWithEmailAndPassword(auth, savedEmail, savedPass);
          try {
            await addDoc(collection(db, 'verified_users'), { uid: u2.uid, email: savedEmail, verifiedAt: new Date() });
          } catch(e) { console.warn('Could not save verification:', e); }
          wrap.remove();
          outSet(out, '✅ Email verified! Redirecting…');
          setTimeout(() => location.href = 'profile.html', 1500);
        };
      };
      out.after(resendBtn);
      return;
    }
    // Check if user has email 2FA enabled
    if(localStorage.getItem('dekuu_2fa_' + user.uid) === 'on') {
      await signOut(auth);
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      sessionStorage.setItem('dekuu_2fa_login_code', code);
      sessionStorage.setItem('dekuu_2fa_login_email', email);
      sessionStorage.setItem('dekuu_2fa_login_pass', pass);
      await sendCustomEmail(email, 'otp', code, user.displayName || '');
      outSet(out, '📧 A verification code was sent to your email.');
      // Show 2FA code input
      document.getElementById('resendBtn')?.remove();
      const wrap = document.createElement('div');
      wrap.id = 'twofa_login_wrap';
      wrap.style.cssText = 'display:grid;gap:8px;margin-top:10px';
      wrap.innerHTML = `
        <input id="twofa_login_code" class="input" placeholder="Enter 6-digit code" maxlength="6">
        <button id="twofa_login_submit" class="btn small" type="button">Verify & Login</button>
      `;
      out.after(wrap);
      document.getElementById('twofa_login_submit').onclick = async () => {
        const entered = document.getElementById('twofa_login_code').value.trim();
        const saved = sessionStorage.getItem('dekuu_2fa_login_code');
        if(entered !== saved) return outSet(out, '❌ Wrong code. Try again.', true);
        sessionStorage.removeItem('dekuu_2fa_login_code');
        const savedEmail = sessionStorage.getItem('dekuu_2fa_login_email');
        const savedPass = sessionStorage.getItem('dekuu_2fa_login_pass');
        sessionStorage.removeItem('dekuu_2fa_login_email');
        sessionStorage.removeItem('dekuu_2fa_login_pass');
        await signInWithEmailAndPassword(auth, savedEmail, savedPass);
        wrap.remove();
        outSet(out, 'Logged in! Redirecting…');
        setTimeout(() => location.href = 'profile.html', 700);
      };
      return;
    }
    outSet(out, 'Logged in! Redirecting…');
    setTimeout(() => location.href = 'profile.html', 700);
  } catch(err) {
    outSet(out, err.message, true);
  }
}


// 2FA — Email OTP second factor
async function load2FA() {
  const user = auth.currentUser;
  const statusEl = document.getElementById('twofa_status');
  const controlsEl = document.getElementById('twofa_controls');
  if (!statusEl || !controlsEl) return;

  const is2FAOn = localStorage.getItem('dekuu_2fa_' + user.uid) === 'on';

  statusEl.innerHTML = is2FAOn
    ? '<span style="color:#10b981;font-weight:700">✅ Two-factor authentication is ON</span>'
    : '<span style="color:#f59e0b;font-weight:700">⚠️ Two-factor authentication is OFF</span>';

  if (is2FAOn) {
    controlsEl.innerHTML = `<button id="disable2fa" class="btn small ghost" type="button" style="border-color:rgba(239,68,68,.4);color:#fca5a5">Disable 2FA</button>`;
    document.getElementById('disable2fa').onclick = () => {
      localStorage.removeItem('dekuu_2fa_' + user.uid);
      outSet(document.getElementById('pf_out'), '2FA disabled.');
      load2FA();
    };
  } else {
    controlsEl.innerHTML = `
      <p style="color:#99a3b2;font-size:.85rem;margin:0 0 10px">When enabled, you will receive a code to your email every time you log in.</p>
      <button id="enable2fa" class="btn small" type="button">Enable Email 2FA</button>
    `;
    document.getElementById('enable2fa').onclick = async () => {
      const out = document.getElementById('pf_out');
      try {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        sessionStorage.setItem('dekuu_2fa_setup_code', code);
        sessionStorage.setItem('dekuu_2fa_setup_uid', user.uid);
        await sendCustomEmail(user.email, 'otp', code, user.displayName || '');
        controlsEl.innerHTML = `
          <p style="color:#99a3b2;font-size:.85rem;margin:0 0 10px">A 6-digit code was sent to <strong style="color:#e6e8ee">${user.email}</strong>. Enter it below to confirm.</p>
          <div style="display:grid;gap:10px">
            <input id="twofa_code" class="input" placeholder="Enter 6-digit code" maxlength="6">
            <button id="confirm2fa" class="btn small" type="button">Confirm & Activate</button>
          </div>
        `;
        document.getElementById('confirm2fa').onclick = () => {
          const entered = document.getElementById('twofa_code').value.trim();
          const saved = sessionStorage.getItem('dekuu_2fa_setup_code');
          const savedUid = sessionStorage.getItem('dekuu_2fa_setup_uid');
          if (entered === saved && savedUid === user.uid) {
            localStorage.setItem('dekuu_2fa_' + user.uid, 'on');
            sessionStorage.removeItem('dekuu_2fa_setup_code');
            sessionStorage.removeItem('dekuu_2fa_setup_uid');
            outSet(document.getElementById('pf_out'), '✅ Email 2FA enabled!');
            load2FA();
          } else {
            outSet(document.getElementById('pf_out'), '❌ Wrong code. Try again.', true);
          }
        };
        outSet(out, 'Code sent to your email!');
      } catch(err) {
        outSet(out, err.message, true);
      }
    };
  }
}

// Profile
async function loadProfile(){
  const user = auth.currentUser;
  if(!user){ location.href = 'login.html'; return; }
  const name = user.displayName || user.email;
  $('#pf_name_text').textContent = name;
  $('#pf_email').textContent = user.email;

  // Email verified badge — check Firestore verified_users
  let isVerified = false;
  try {
    const q = query(collection(db, 'verified_users'), where('uid', '==', user.uid));
    const snap = await getDocs(q);
    isVerified = !snap.empty;
  } catch(e) {
    console.warn('Could not check verification status:', e);
  }

  const badge = isVerified
    ? '<span style="color:#10b981;font-size:.8rem;margin-left:6px">✅ Verified</span>'
    : '<span style="color:#f59e0b;font-size:.8rem;margin-left:6px">⚠️ Not verified</span>';
  $('#pf_email').insertAdjacentHTML('afterend', badge);

  // Avatar
  const avatarEl = $('#pf_avatar_img');
  if(user.photoURL){
    avatarEl.src = user.photoURL;
    avatarEl.style.display = 'block';
  } else {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    avatarEl.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.textContent = initials;
    fallback.style.cssText = 'width:96px;height:96px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#22d3ee);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:white;flex-shrink:0';
    avatarEl.parentNode.insertBefore(fallback, avatarEl);
  }
}

// Update display name
async function onSaveName(){
  const name = $('#pf_name_edit').value.trim();
  const out  = $('#pf_out');
  if(!name) return outSet(out, 'Enter a name', true);
  try {
    await updateProfile(auth.currentUser, { displayName: name });
    $('#pf_name_text').textContent = name;
    outSet(out, 'Name saved!');
  } catch(err) {
    outSet(out, err.message, true);
  }
}

// Change email
async function onChangeEmail(){
  const newEmail = $('#pf_email_edit').value.trim();
  const out = $('#pf_out');
  if(!newEmail) return outSet(out, 'Enter a new email', true);
  try {
    await updateEmail(auth.currentUser, newEmail);
    await sendEmailVerification(auth.currentUser);
    await sendCustomEmail(newEmail, 'emailChange', window.location.origin + '/profile.html', auth.currentUser.displayName);
    $('#pf_email').textContent = newEmail;
    outSet(out, '✅ Email updated! Check your new inbox to verify it.');
  } catch(err) {
    if(err.code === 'auth/requires-recent-login'){
      outSet(out, 'For security, please log out and log back in before changing your email.', true);
    } else {
      outSet(out, err.message, true);
    }
  }
}

// Change password
async function onChangePassword(){
  const pass  = $('#pf_pass').value;
  const pass2 = $('#pf_pass2').value;
  const out   = $('#pf_out');
  if(!pass || pass.length < 6) return outSet(out, 'Password too short', true);
  if(pass !== pass2) return outSet(out, 'Passwords do not match', true);
  try {
    await updatePassword(auth.currentUser, pass);
    outSet(out, 'Password changed!');
    $('#pf_pass').value = ''; $('#pf_pass2').value = '';
  } catch(err) {
    if(err.code === 'auth/requires-recent-login'){
      outSet(out, 'For security, please log out and log back in before changing your password.', true);
    } else {
      outSet(out, err.message, true);
    }
  }
}

// Avatar upload — disabled (requires Firebase Storage paid plan)
async function onAvatarChange(){
  outSet($('#pf_out'), 'Avatar upload requires a paid Firebase plan.', true);
}

function outSet(el, msg, err=false){
  el.className = 'alert ' + (err ? 'err' : 'ok');
  el.textContent = msg;
}

// Contact → save to Firestore
async function onContact(e){
  e.preventDefault();
  const name  = $('#c_name').value.trim();
  const email = $('#c_email').value.trim();
  const msg   = $('#c_msg').value.trim();
  const out   = $('#c_out');
  if(!name || !email || !msg) return outSet(out, 'Please fill all fields', true);
  try {
    await addDoc(collection(db, 'contacts'), { name, email, message: msg, createdAt: new Date() });
    outSet(out, 'Message sent!');
    $('#c_form').reset();
  } catch(err) {
    outSet(out, 'Error sending message', true);
  }
}

// Blog / Info loader
async function loadPosts(){
  const wrap = $('#posts'); if(!wrap) return;
  try {
    const res = await fetch('posts.json');
    const posts = await res.json();
    wrap.innerHTML = posts.map(p => `
      <article class="post reveal">
        <h4>${p.title}</h4>
        <div class="meta">${new Date(p.date).toLocaleDateString()} • ${p.category}</div>
        <p>${p.excerpt}</p>
        ${p.link ? `<a class="btn small" href="${p.link}">Read more</a>` : ''}
      </article>
    `).join('');
    $$('.post.reveal').forEach(el => obs.observe(el));
  } catch(err) {
    wrap.innerHTML = '<div class="alert err">Could not load posts.</div>';
  }
}

// Page boot
document.addEventListener('DOMContentLoaded', () => {
  checkGlobalBanner();
  const rawPage = location.pathname.split('/').pop() || 'index';
  const page = rawPage.replace('.html', '').toLowerCase();

  if(page === 'signup'){
    $('#s_form')?.addEventListener('submit', onSignup);
    injectGoogleButton($('#s_form'), $('#s_out'));
  }
  if(page === 'login'){
    $('#l_form')?.addEventListener('submit', onLogin);
    injectForgotPassword($('#l_out'));
    injectGoogleButton($('#l_form'), $('#l_out'));
  }
  if(page === 'profile'){
    onAuthStateChanged(auth, (user) => {
      if(!user){ location.href = 'login.html'; return; }
      loadProfile();
      load2FA();
    });
    $('#pf_save')?.addEventListener('click', onSaveName);
    $('#pf_email_save')?.addEventListener('click', onChangeEmail);
    $('#pf_chgpass')?.addEventListener('click', onChangePassword);
    $('#pf_avatar')?.addEventListener('change', onAvatarChange);
  }
  if(page === 'contact') {
    $('#c_form')?.addEventListener('submit', onContact);
    // Pre-fill name and email if logged in
    onAuthStateChanged(auth, (user) => {
      if(user) {
        if($('#c_name') && user.displayName) $('#c_name').value = user.displayName;
        if($('#c_email') && user.email) $('#c_email').value = user.email;
      }
    });
  }
  if(page === 'info' || page === 'blog') loadPosts();
});
