/* Dekuu v2 — Firebase + Animated UI */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, updateProfile, updateEmail, GoogleAuthProvider, signInWithPopup, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// Active nav
(function () {
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active-link');
  });
})();

// Reveal animation
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('show'); obs.unobserve(e.target); } });
}, { threshold: .12 });
$$('.reveal').forEach(el => obs.observe(el));

// Auth nav
function renderNav(user) {
  const nav = $('#navAuth'); if (!nav) return;
  if (user) {
    nav.innerHTML = `<a class="btn small" href="profile.html">Profile</a> <a class="btn small ghost" id="logoutBtn" href="#">Logout</a>`;
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
    await signInWithPopup(auth, googleProvider);
    outSet(outEl, 'Signed in with Google! Redirecting…');
    setTimeout(() => location.href = 'profile.html', 700);
  } catch (err) {
    outSet(outEl, err.message, true);
  }
}

// Inject Google button
function injectGoogleButton(outEl) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;gap:10px;margin-top:4px';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin:4px 0">
      <div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div>
      <span style="color:#99a3b2;font-size:.85rem">or continue with</span>
      <div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div>
    </div>
    <button id="googleBtn" type="button" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:11px;border-radius:14px;background:#fff;color:#111;border:none;font-weight:700;cursor:pointer;font-size:.95rem;width:100%">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Continue with Google
    </button>
  `;
  outEl.parentNode.insertBefore(wrap, outEl);
  document.getElementById('googleBtn').addEventListener('click', () => onGoogleSignIn(outEl));
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
    if (!email) return outSet(outEl, 'Enter your email above first.', true);
    try {
      await sendPasswordResetEmail(auth, email);
      outSet(outEl, '✅ Password reset email sent! Check your inbox.');
    } catch (err) {
      outSet(outEl, err.message, true);
    }
  });
}

// Signup
async function onSignup(e) {
  e.preventDefault();
  const name = $('#s_name').value.trim();
  const email = $('#s_email').value.trim();
  const pass = $('#s_pass').value;
  const pass2 = $('#s_pass2').value;
  const out = $('#s_out');
  if (!name || !email || !pass) return outSet(out, 'Please fill all fields', true);
  if (pass !== pass2) return outSet(out, 'Passwords do not match', true);
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(user, { displayName: name });
    await sendEmailVerification(user);
    outSet(out, '✅ Account created! Check your email to verify before logging in.');
    await signOut(auth);
    setTimeout(() => location.href = 'login.html', 3000);
  } catch (err) {
    outSet(out, err.message, true);
  }
}

// Login
async function onLogin(e) {
  e.preventDefault();
  const email = $('#l_email').value.trim();
  const pass = $('#l_pass').value;
  const out = $('#l_out');
  // Remove any old resend button
  document.getElementById('resendBtn')?.remove();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    if (!user.emailVerified) {
      await signOut(auth);
      outSet(out, '❌ Please verify your email first. Check your inbox.', true);
      const resendBtn = document.createElement('button');
      resendBtn.id = 'resendBtn';
      resendBtn.textContent = 'Resend verification email';
      resendBtn.className = 'btn small ghost';
      resendBtn.style.marginTop = '8px';
      resendBtn.onclick = async () => {
        const { user: u } = await signInWithEmailAndPassword(auth, email, pass);
        await sendEmailVerification(u);
        await signOut(auth);
        resendBtn.textContent = '✅ Sent! Check your inbox.';
        resendBtn.disabled = true;
      };
      out.after(resendBtn);
      return;
    }
    outSet(out, 'Logged in! Redirecting…');
    setTimeout(() => location.href = 'profile.html', 700);
  } catch (err) {
    outSet(out, err.message, true);
  }
}

// Profile
function loadProfile() {
  const user = auth.currentUser;
  if (!user) { location.href = 'login.html'; return; }
  const name = user.displayName || user.email;
  $('#pf_name_text').textContent = name;
  $('#pf_email').textContent = user.email;

  // Email verified badge
  const badge = user.emailVerified
    ? '<span style="color:#10b981;font-size:.8rem;margin-left:6px">✅ Verified</span>'
    : '<span style="color:#f59e0b;font-size:.8rem;margin-left:6px">⚠️ Not verified</span>';
  $('#pf_email').insertAdjacentHTML('afterend', badge);

  // Avatar
  const avatarEl = $('#pf_avatar_img');
  if (user.photoURL) {
    avatarEl.src = user.photoURL;
    avatarEl.style.display = 'block';
  } else {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    avatarEl.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.textContent = initials;
    fallback.style.cssText = 'width:96px;height:96px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#22d3ee);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:white;flex-shrink:0';
    avatarEl.parentNode.insertBefore(fallback, avatarEl);
  }
}

// Update display name
async function onSaveName() {
  const name = $('#pf_name_edit').value.trim();
  const out = $('#pf_out');
  if (!name) return outSet(out, 'Enter a name', true);
  try {
    await updateProfile(auth.currentUser, { displayName: name });
    $('#pf_name_text').textContent = name;
    outSet(out, 'Name saved!');
  } catch (err) {
    outSet(out, err.message, true);
  }
}

// Change email
async function onChangeEmail() {
  const newEmail = $('#pf_email_edit').value.trim();
  const out = $('#pf_out');
  if (!newEmail) return outSet(out, 'Enter a new email', true);
  try {
    await updateEmail(auth.currentUser, newEmail);
    await sendEmailVerification(auth.currentUser);
    $('#pf_email').textContent = newEmail;
    outSet(out, '✅ Email updated! Check your new inbox to verify it.');
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      outSet(out, 'For security, please log out and log back in before changing your email.', true);
    } else {
      outSet(out, err.message, true);
    }
  }
}

// Change password
async function onChangePassword() {
  const pass = $('#pf_pass').value;
  const pass2 = $('#pf_pass2').value;
  const out = $('#pf_out');
  if (!pass || pass.length < 6) return outSet(out, 'Password too short', true);
  if (pass !== pass2) return outSet(out, 'Passwords do not match', true);
  try {
    await updatePassword(auth.currentUser, pass);
    outSet(out, 'Password changed!');
    $('#pf_pass').value = ''; $('#pf_pass2').value = '';
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      outSet(out, 'For security, please log out and log back in before changing your password.', true);
    } else {
      outSet(out, err.message, true);
    }
  }
}

// Avatar upload — disabled (requires Firebase Storage paid plan)
async function onAvatarChange() {
  outSet($('#pf_out'), 'Avatar upload requires a paid Firebase plan.', true);
}

function outSet(el, msg, err = false) {
  el.className = 'alert ' + (err ? 'err' : 'ok');
  el.textContent = msg;
}

// Contact → save to Firestore
async function onContact(e) {
  e.preventDefault();
  const name = $('#c_name').value.trim();
  const email = $('#c_email').value.trim();
  const msg = $('#c_msg').value.trim();
  const out = $('#c_out');
  if (!name || !email || !msg) return outSet(out, 'Please fill all fields', true);
  try {
    await addDoc(collection(db, 'contacts'), { name, email, message: msg, createdAt: new Date() });
    outSet(out, 'Message sent!');
    $('#c_form').reset();
  } catch (err) {
    outSet(out, 'Error sending message', true);
  }
}

// Blog / Info loader
async function loadPosts() {
  const wrap = $('#posts'); if (!wrap) return;
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
  } catch (err) {
    wrap.innerHTML = '<div class="alert err">Could not load posts.</div>';
  }
}

// Page boot
document.addEventListener('DOMContentLoaded', () => {
  const rawPage = location.pathname.split('/').pop() || 'index';
  const page = rawPage.replace('.html', '').toLowerCase();

  if (page === 'signup') {
    $('#s_form')?.addEventListener('submit', onSignup);
    injectGoogleButton($('#s_out'));
  }
  if (page === 'login') {
    $('#l_form')?.addEventListener('submit', onLogin);
    injectForgotPassword($('#l_out'));
    injectGoogleButton($('#l_out'));
  }
  if (page === 'profile') {
    onAuthStateChanged(auth, (user) => {
      if (!user) { location.href = 'login.html'; return; }
      loadProfile();
    });
    $('#pf_save')?.addEventListener('click', onSaveName);
    $('#pf_email_save')?.addEventListener('click', onChangeEmail);
    $('#pf_chgpass')?.addEventListener('click', onChangePassword);
    $('#pf_avatar')?.addEventListener('change', onAvatarChange);
  }
  if (page === 'contact') $('#c_form')?.addEventListener('submit', onContact);
  if (page === 'info' || page === 'blog') loadPosts();
});
