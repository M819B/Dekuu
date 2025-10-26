
/* Dekuu v2 — Supabase + Animated UI */
const $ = (s, r=document)=> r.querySelector(s);
const $$ = (s, r=document)=> Array.from(r.querySelectorAll(s));

// Supabase init
const SUPABASE_URL = 'https://hmvqwbwjjynzzljjrgcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdnF3YndqanluenpsampyZ2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTA0ODAsImV4cCI6MjA3NzA2NjQ4MH0.933JVF1tI8qgYI2Om0aMwOuCLr4Eyi0OZ9tnamDIYow';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Active nav
(function(){
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a=>{
    const href = a.getAttribute('href');
    if(href===page) a.classList.add('active-link');
  });
})();

// Reveal animation
const obs = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('show'); obs.unobserve(e.target);} });
},{ threshold:.12 });
$$('.reveal').forEach(el=> obs.observe(el));

// Auth nav
async function renderNav(){
  const nav = $('#navAuth'); if(!nav) return;
  const { data:{ user } } = await sb.auth.getUser();
  if(user){
    nav.innerHTML = `<a class="btn small" href="profile.html">Profile</a> <a class="btn small ghost" id="logoutBtn">Logout</a>`;
    $('#logoutBtn')?.addEventListener('click', async (e)=>{ e.preventDefault(); await sb.auth.signOut(); location.href='index.html'; });
  }else{
    nav.innerHTML = `<a class="btn small" href="login.html">Login</a> <a class="btn small ghost" href="signup.html">Sign up</a>`;
  }
}
renderNav();

// Signup
async function onSignup(e){
  e.preventDefault();
  const name  = $('#s_name').value.trim();
  const email = $('#s_email').value.trim();
  const pass  = $('#s_pass').value;
  const pass2 = $('#s_pass2').value;
  const out   = $('#s_out');
  if(!name || !email || !pass) return outSet(out,'Please fill all fields',true);
  if(pass!==pass2) return outSet(out,'Passwords do not match',true);

  const { data, error } = await sb.auth.signUp({ email, password: pass, options:{ data:{ name } } });
  if(error) return outSet(out, error.message, true);
  outSet(out, 'Account created! Check your email to verify.');
  setTimeout(()=> location.href='profile.html', 900);
}

// Login
async function onLogin(e){
  e.preventDefault();
  const email = $('#l_email').value.trim();
  const pass  = $('#l_pass').value;
  const out   = $('#l_out');
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if(error) return outSet(out, error.message, true);
  outSet(out, 'Logged in! Redirecting…');
  setTimeout(()=> location.href='profile.html', 700);
}

// Profile
async function loadProfile(){
  const { data:{ user } } = await sb.auth.getUser();
  if(!user){ location.href='login.html'; return; }
  $('#pf_name_text').textContent = user.user_metadata?.name || user.email;
  $('#pf_email').textContent = user.email;
  const avatar = user.user_metadata?.avatar_url;
  if(avatar) $('#pf_avatar_img').src = avatar;
}

// Update display name
async function onSaveName(){
  const name = $('#pf_name_edit').value.trim();
  const out  = $('#pf_out');
  if(!name) return outSet(out,'Enter a name',true);
  const { error } = await sb.auth.updateUser({ data:{ name } });
  if(error) return outSet(out, error.message, true);
  $('#pf_name_text').textContent = name;
  outSet(out,'Saved!');
}

// Change password
async function onChangePassword(){
  const pass = $('#pf_pass').value;
  const pass2= $('#pf_pass2').value;
  const out  = $('#pf_out');
  if(!pass || pass.length<6) return outSet(out,'Password too short',true);
  if(pass!==pass2) return outSet(out,'Passwords do not match',true);
  const { error } = await sb.auth.updateUser({ password: pass });
  if(error) return outSet(out, error.message, true);
  outSet(out,'Password changed!');
  $('#pf_pass').value=''; $('#pf_pass2').value='';
}

// Avatar upload
async function onAvatarChange(e){
  const file = e.target.files?.[0];
  const out  = $('#pf_out');
  if(!file) return;
  const { data:{ user } } = await sb.auth.getUser();
  if(!user) return outSet(out,'Not logged in',true);
  const ext = file.name.split('.').pop();
  const path = `${user.id}/${Date.now()}.${ext}`;

  const up = await sb.storage.from('avatars').upload(path, file, { upsert: true });
  if(up.error) return outSet(out, up.error.message, true);

  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  const url = data?.publicUrl;
  if(!url) return outSet(out,'Could not get public URL',true);

  const { error } = await sb.auth.updateUser({ data:{ avatar_url: url } });
  if(error) return outSet(out, error.message, true);
  $('#pf_avatar_img').src = url;
  outSet(out,'Avatar updated!');
}

function outSet(el, msg, err=false){ el.className = 'alert ' + (err?'err':'ok'); el.textContent = msg; }

// Contact → insert into contacts
async function onContact(e){
  e.preventDefault();
  const name  = $('#c_name').value.trim();
  const email = $('#c_email').value.trim();
  const msg   = $('#c_msg').value.trim();
  const out   = $('#c_out');
  if(!name || !email || !msg) return outSet(out,'Please fill all fields',true);
  const { error } = await sb.from('contacts').insert([{ name, email, message: msg }]);
  if(error) return outSet(out,'Error sending message',true);
  outSet(out,'Message sent!');
  $('#c_form').reset();
}

// Blog loader
async function loadPosts(){
  const wrap = $('#posts'); if(!wrap) return;
  try{
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
    $$('.post.reveal').forEach(el=>obs.observe(el));
  }catch(e){
    wrap.innerHTML = '<div class="alert err">Could not load posts.</div>';
  }
}

// Page boot
document.addEventListener('DOMContentLoaded', ()=>{
  renderNav();
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if(page==='signup.html') document.getElementById('s_form')?.addEventListener('submit', onSignup);
  if(page==='login.html')  document.getElementById('l_form')?.addEventListener('submit', onLogin);
  if(page==='profile.html'){
    loadProfile();
    document.getElementById('pf_save')?.addEventListener('click', onSaveName);
    document.getElementById('pf_chgpass')?.addEventListener('click', onChangePassword);
    document.getElementById('pf_avatar')?.addEventListener('change', onAvatarChange);
  }
  if(page==='contact.html') document.getElementById('c_form')?.addEventListener('submit', onContact);
  if(page==='info.html' || page==='blog.html') loadPosts();
});
