/* Dekuu Admin Panel — Full Permissions Implementation */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc,
  doc, setDoc, getDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
const $ = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));

const ALL_PERMISSIONS = [
  { id:'access_admin',       label:'⚡ Access Admin Panel',    group:'Panel' },
  { id:'view_dashboard',     label:'📊 View Dashboard Stats',  group:'Panel' },
  { id:'view_users',         label:'👁 View Users List',       group:'Users' },
  { id:'verify_users',       label:'✅ Verify Users',          group:'Users' },
  { id:'edit_users',         label:'✏️ Edit User Info',        group:'Users' },
  { id:'delete_users',       label:'🗑 Delete Users',          group:'Users' },
  { id:'ban_users',          label:'🚫 Ban Users',             group:'Users' },
  { id:'unban_users',        label:'✅ Unban Users',           group:'Users' },
  { id:'assign_roles',       label:'🎭 Assign Roles',          group:'Users' },
  { id:'view_user_activity', label:'📋 View User Activity',    group:'Users' },
  { id:'promote_admins',     label:'⬆️ Promote to Admin',      group:'Admins' },
  { id:'demote_admins',      label:'⬇️ Demote Admins',         group:'Admins' },
  { id:'manage_roles',       label:'🛡️ Create & Edit Roles',   group:'Admins' },
  { id:'manage_blog',        label:'📝 Manage Blog Posts',     group:'Content' },
  { id:'publish_blog',       label:'🚀 Publish Blog Posts',    group:'Content' },
  { id:'delete_blog',        label:'🗑 Delete Blog Posts',     group:'Content' },
  { id:'view_messages',      label:'✉️ View Messages',         group:'Messages' },
  { id:'reply_messages',     label:'↩️ Reply to Messages',     group:'Messages' },
  { id:'delete_messages',    label:'🗑 Delete Messages',       group:'Messages' },
  { id:'send_global_msg',    label:'📢 Send Global Broadcast', group:'Comms' },
  { id:'send_emails',        label:'📧 Send Emails to Users',  group:'Comms' },
  { id:'manage_banner',      label:'🏷 Manage Site Banner',    group:'Comms' },
  { id:'view_logs',          label:'📜 View Activity Logs',    group:'System' },
  { id:'export_data',        label:'📤 Export Data',           group:'System' },
  { id:'manage_settings',    label:'⚙️ Manage Site Settings',  group:'System' },
];

let allUsers=[], allMessages=[], allPosts=[], allRoles=[], allLogs=[];
let currentAdminPerms=[], currentUser=null;
let editingUserId=null, editingRoleId=null;

const obs = new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('show');obs.unobserve(e.target);}});
},{threshold:.08});

function can(perm){ return currentAdminPerms.includes('*')||currentAdminPerms.includes(perm); }

function adminOut(msg,type='ok'){
  const el=$('#admin_out'); el.style.display='block'; el.className='alert '+type; el.textContent=msg;
  setTimeout(()=>{ el.style.display='none'; },4000);
}

function noPerm(what){ return `<div class="empty-state"><div class="empty-state-icon">🔒</div>You don't have permission to ${what}.</div>`; }

async function writeLog(action,details=''){
  try{ await addDoc(collection(db,'admin_logs'),{action,details,adminUid:currentUser?.uid,adminEmail:currentUser?.email,timestamp:serverTimestamp()}); }
  catch(e){/* silent */}
}

function renderNav(user){
  const nav=$('#navAuth'); if(!nav) return;
  if(user){
    nav.innerHTML=`<a class="btn small ghost" href="profile.html">Profile</a> <a class="btn small ghost" id="logoutBtn" href="#">Logout</a>`;
    $('#logoutBtn')?.addEventListener('click',async e=>{e.preventDefault();await signOut(auth);location.href='index.html';});
  } else { nav.innerHTML=`<a class="btn small" href="login.html">Login</a>`; }
}

async function getAdminRecord(user){
  const snap=await getDoc(doc(db,'admins',user.uid)); if(!snap.exists()) return null;
  const data=snap.data();
  if(data.superAdmin||data.grantedAt==='now') return {isSuperAdmin:true,permissions:['*']};
  return {isSuperAdmin:false,permissions:data.permissions||[]};
}

/* ─── TAB VISIBILITY ── */
function applyTabPermissions(){
  const tabMap={
    users:    can('view_users'),
    messages: can('view_messages'),
    blog:     can('manage_blog')||can('publish_blog')||can('delete_blog'),
    roles:    can('manage_roles'),
    global:   can('send_global_msg')||can('manage_banner'),
    logs:     can('view_logs'),
    export:   can('export_data'),
    settings: can('manage_settings'),
  };
  Object.entries(tabMap).forEach(([tab,allowed])=>{
    const btn=$(`.tab-btn[data-tab="${tab}"]`);
    if(btn) btn.style.display=allowed?'':'none';
  });
  const first=$$('.tab-btn').find(b=>b.style.display!=='none');
  if(first){ $$('.tab-btn').forEach(b=>b.classList.remove('active')); $$('.tab-panel').forEach(p=>p.classList.remove('active')); first.classList.add('active'); $(`#tab_${first.dataset.tab}`)?.classList.add('active'); }
}

/* ─── STATS ── */
function updateStats(){
  if(!can('view_dashboard')){ $('#stats_section').style.display='none'; return; }
  $('#stats_section').style.display='';
  $('#stat_users').textContent=allUsers.length;
  $('#stat_verified').textContent=allUsers.filter(u=>u.isVerified).length;
  $('#stat_messages').textContent=allMessages.length;
  $('#stat_posts').textContent=allPosts.length;
  $('#stat_banned').textContent=allUsers.filter(u=>u.isBanned).length;
  $('#stat_admins').textContent=allUsers.filter(u=>u.isAdmin).length;
}

async function loadAll(){
  await Promise.all([loadUsers(),loadMessages(),loadPosts(),loadRoles(),loadSettings()]);
  if(can('view_logs')) loadLogs();
  updateStats();
}

/* ─── USERS ── */
async function loadUsers(){
  if(!can('view_users')){ $('#users_list').innerHTML=noPerm('view users'); return; }
  try{
    const [usersSnap,verifiedSnap,adminsSnap]=await Promise.all([
      getDocs(collection(db,'users')),getDocs(collection(db,'verified_users')),getDocs(collection(db,'admins'))
    ]);
    const verifiedUids=new Set(verifiedSnap.docs.map(d=>d.data().uid));
    const adminMap={}; adminsSnap.docs.forEach(d=>{adminMap[d.id]=d.data();});
    allUsers=usersSnap.docs.map(d=>({
      id:d.id,...d.data(),
      isVerified:verifiedUids.has(d.id),
      isAdmin:!!adminMap[d.id],
      isSuperAdmin:adminMap[d.id]?.superAdmin||adminMap[d.id]?.grantedAt==='now',
      isBanned:d.data().isBanned||false,
      role:d.data().role||null
    }));
    renderUsers(allUsers);
  }catch(e){ $('#users_list').innerHTML=`<div class="alert err">Failed to load users: ${e.message}</div>`; }
}

function renderUsers(users){
  const el=$('#users_list');
  if(!users.length){ el.innerHTML='<div class="empty-state"><div class="empty-state-icon">👤</div>No users found.</div>'; return; }
  el.innerHTML=users.map(u=>{
    const roleBadge=u.role?`<span class="chip cyan">${u.role}</span>`:'';
    return `<div class="user-row" style="${u.isBanned?'opacity:.55':''}">
      <div class="user-avatar" style="${u.isBanned?'background:linear-gradient(135deg,#ef4444,#dc2626)':''}">
        ${(u.displayName||u.email||'?')[0].toUpperCase()}
      </div>
      <div class="user-info">
        <div class="user-name">${u.displayName||'(no name)'}${u.isBanned?' <span style="color:#ef4444;font-size:.75rem">· Banned</span>':''}</div>
        <div class="user-email">${u.email||u.id}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        ${u.isVerified?'<span class="chip green">✅ Verified</span>':'<span class="chip yellow">⚠️ Unverified</span>'}
        ${u.isSuperAdmin?'<span class="chip">👑 Super</span>':u.isAdmin?'<span class="chip">🛡️ Admin</span>':''}
        ${roleBadge}
      </div>
      <div class="user-actions">
        ${can('edit_users')?`<button class="btn small" onclick="editUser('${u.id}')">Edit</button>`:''}
        ${can('verify_users')&&!u.isVerified?`<button class="btn small success" onclick="verifyUser('${u.id}','${u.email||''}')">Verify</button>`:''}
        ${can('ban_users')&&!u.isBanned&&!u.isSuperAdmin?`<button class="btn small warn" onclick="banUser('${u.id}',true)">Ban</button>`:''}
        ${can('unban_users')&&u.isBanned?`<button class="btn small success" onclick="banUser('${u.id}',false)">Unban</button>`:''}
        ${can('view_user_activity')?`<button class="btn small ghost" onclick="viewActivity('${u.id}','${(u.displayName||u.email||u.id).replace(/'/g,"\\'")}')">Activity</button>`:''}
        ${can('delete_users')&&!u.isSuperAdmin?`<button class="btn small danger" onclick="deleteUserRecord('${u.id}')">Delete</button>`:''}
      </div>
    </div>`;
  }).join('');
}

window.verifyUser=async(uid,email)=>{
  if(!can('verify_users')) return adminOut('No permission to verify users.','err');
  try{
    await addDoc(collection(db,'verified_users'),{uid,email,verifiedAt:new Date(),verifiedBy:'admin'});
    await writeLog('verify_user',`Verified ${email}`); adminOut('✅ User verified.'); loadUsers();
  }catch(e){adminOut(e.message,'err');}
};

window.banUser=async(uid,ban)=>{
  if(!can(ban?'ban_users':'unban_users')) return adminOut(`No permission to ${ban?'ban':'unban'} users.`,'err');
  const u=allUsers.find(u=>u.id===uid);
  if(u?.isSuperAdmin) return adminOut('Cannot ban a super admin.','err');
  if(ban&&!confirm('Ban this user? They will be locked out.')) return;
  try{
    await setDoc(doc(db,'users',uid),{isBanned:ban,bannedAt:ban?new Date():null},{merge:true});
    await writeLog(ban?'ban_user':'unban_user',`${ban?'Banned':'Unbanned'} ${u?.email||uid}`);
    adminOut(ban?'🚫 User banned.':'✅ User unbanned.'); loadUsers();
  }catch(e){adminOut(e.message,'err');}
};

window.deleteUserRecord=async(uid)=>{
  if(!can('delete_users')) return adminOut('No permission.','err');
  const u=allUsers.find(u=>u.id===uid);
  if(u?.isSuperAdmin) return adminOut('Cannot delete a super admin.','err');
  if(!confirm('Delete this user record? Cannot be undone.')) return;
  try{
    await deleteDoc(doc(db,'users',uid));
    const vSnap=await getDocs(query(collection(db,'verified_users'),where('uid','==',uid)));
    for(const d of vSnap.docs) await deleteDoc(d.ref);
    await writeLog('delete_user',`Deleted ${u?.email||uid}`); adminOut('User deleted.'); loadUsers();
  }catch(e){adminOut(e.message,'err');}
};

window.viewActivity=async(uid,name)=>{
  if(!can('view_user_activity')) return adminOut('No permission.','err');
  $('#activity_modal_title').textContent=`📋 Activity — ${name}`;
  $('#activity_list').innerHTML='<div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px;opacity:.6"></div>';
  $('#activity_modal').classList.add('open');
  try{
    const snap=await getDocs(collection(db,'admin_logs'));
    const logs=snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(l=>l.adminUid===uid||l.targetUid===uid)
      .sort((a,b)=>(b.timestamp?.seconds||0)-(a.timestamp?.seconds||0))
      .slice(0,50);
    if(!logs.length){ $('#activity_list').innerHTML='<div class="empty-state">No activity for this user.</div>'; return; }
    $('#activity_list').innerHTML=logs.map(l=>`
      <div style="padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.07);margin-bottom:6px;background:rgba(255,255,255,.02)">
        <div style="font-weight:600;font-size:.88rem">${l.action}</div>
        <div style="color:var(--muted-2);font-size:.82rem;margin-top:2px">${l.details||''}</div>
        <div style="color:var(--muted);font-size:.78rem;margin-top:4px">${l.timestamp?.toDate?l.timestamp.toDate().toLocaleString():'—'}</div>
      </div>`).join('');
  }catch(e){ $('#activity_list').innerHTML=`<div class="alert err">${e.message}</div>`; }
};

/* ─── EDIT USER ── */
window.editUser=async(uid)=>{
  if(!can('edit_users')) return adminOut('No permission to edit users.','err');
  const u=allUsers.find(u=>u.id===uid); if(!u) return;
  editingUserId=uid;
  $('#edit_name').value=u.displayName||'';
  $('#edit_email').value=u.email||'';
  $('#edit_verified').checked=u.isVerified; $('#edit_verified').disabled=!can('verify_users');
  $('#edit_admin').checked=u.isAdmin; $('#edit_admin').disabled=!(can('promote_admins')||can('demote_admins'));
  const rs=$('#edit_role'); rs.disabled=!can('assign_roles');
  rs.innerHTML='<option value="">No role</option>'+allRoles.map(r=>`<option value="${r.name}" ${u.role===r.name?'selected':''}>${r.name}</option>`).join('');
  const eb=$('#edit_send_email_btn'); if(eb) eb.style.display=can('send_emails')?'':'none';
  $('#edit_modal').classList.add('open');
};
$('#edit_cancel')?.addEventListener('click',()=>{$('#edit_modal').classList.remove('open');editingUserId=null;});
$('#edit_modal')?.addEventListener('click',e=>{if(e.target===$('#edit_modal')){$('#edit_modal').classList.remove('open');editingUserId=null;}});
$('#edit_send_email_btn')?.addEventListener('click',()=>{
  if(!can('send_emails')) return adminOut('No permission to send emails.','err');
  const u=allUsers.find(u=>u.id===editingUserId); if(!u) return;
  $('#email_to').value=u.email||''; $('#email_subject').value=''; $('#email_body').value='';
  $('#email_modal').classList.add('open');
});
$('#edit_save')?.addEventListener('click',async()=>{
  if(!editingUserId||!can('edit_users')) return;
  const name=$('#edit_name').value.trim(), verified=$('#edit_verified').checked;
  const isAdmin=$('#edit_admin').checked, role=$('#edit_role').value;
  const u=allUsers.find(u=>u.id===editingUserId);
  try{
    await setDoc(doc(db,'users',editingUserId),{displayName:name,role:role||null,updatedAt:new Date()},{merge:true});
    if(can('verify_users')){
      const vSnap=await getDocs(query(collection(db,'verified_users'),where('uid','==',editingUserId)));
      if(verified&&vSnap.empty) await addDoc(collection(db,'verified_users'),{uid:editingUserId,email:u?.email||'',verifiedAt:new Date(),verifiedBy:'admin'});
      else if(!verified&&!vSnap.empty) for(const d of vSnap.docs) await deleteDoc(d.ref);
    }
    if(isAdmin&&!u.isAdmin&&can('promote_admins')){
      const rd=allRoles.find(r=>r.name===role);
      await setDoc(doc(db,'admins',editingUserId),{permissions:rd?.permissions||[],grantedAt:new Date()});
      await writeLog('promote_admin',`Promoted ${u?.email}`);
    } else if(!isAdmin&&u.isAdmin&&can('demote_admins')){
      if(u.isSuperAdmin){ adminOut('Cannot demote a super admin.','err'); return; }
      await deleteDoc(doc(db,'admins',editingUserId)); await writeLog('demote_admin',`Demoted ${u?.email}`);
    }
    await writeLog('edit_user',`Edited ${u?.email}`); adminOut('✅ User updated!');
    $('#edit_modal').classList.remove('open'); editingUserId=null; loadUsers();
  }catch(e){adminOut(e.message,'err');}
});

/* ─── MESSAGES ── */
async function loadMessages(){
  if(!can('view_messages')){ $('#messages_list').innerHTML=noPerm('view messages'); return; }
  try{
    const snap=await getDocs(collection(db,'contacts'));
    allMessages=snap.docs.map(d=>({id:d.id,...d.data()}));
    allMessages.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderMessages(allMessages);
  }catch(e){ $('#messages_list').innerHTML=`<div class="alert err">${e.message}</div>`; }
}

function renderMessages(messages){
  const el=$('#messages_list');
  if(!messages.length){ el.innerHTML='<div class="empty-state"><div class="empty-state-icon">✉️</div>No messages yet.</div>'; return; }
  el.innerHTML=messages.map(m=>`
    <div class="msg-row">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <strong style="color:var(--text)">${m.name||'Unknown'}</strong>
          <span class="chip cyan">${m.email||''}</span>
          <span style="color:var(--muted);font-size:.8rem">${m.createdAt?new Date(m.createdAt.seconds*1000).toLocaleString():''}</span>
        </div>
        <div style="color:var(--muted-2);font-size:.9rem;line-height:1.5">${m.message||''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-end">
        ${can('reply_messages')?`<button class="btn small" onclick="replyMessage('${m.id}','${(m.email||'').replace(/'/g,"\\'")}','${(m.name||'').replace(/'/g,"\\'")}')">Reply</button>`:''}
        ${can('delete_messages')?`<button class="btn small danger" onclick="deleteMessage('${m.id}')">Delete</button>`:''}
      </div>
    </div>`).join('');
}

window.deleteMessage=async id=>{
  if(!can('delete_messages')) return adminOut('No permission.','err');
  if(!confirm('Delete this message?')) return;
  try{ await deleteDoc(doc(db,'contacts',id)); await writeLog('delete_message',`Deleted message ${id}`); adminOut('Message deleted.'); loadMessages(); }
  catch(e){adminOut(e.message,'err');}
};
window.replyMessage=(id,email,name)=>{
  if(!can('reply_messages')) return adminOut('No permission to reply.','err');
  $('#email_to').value=email; $('#email_subject').value='Re: Your message to Dekuu';
  $('#email_body').value=`Hi ${name},\n\nThank you for reaching out.\n\n`;
  $('#email_modal').classList.add('open');
};

/* ─── BLOG ── */
async function loadPosts(){
  const hasPerm=can('manage_blog')||can('publish_blog')||can('delete_blog');
  if(!hasPerm){ $('#blog_list').innerHTML=noPerm('manage blog'); if($('#blog_add_section')) $('#blog_add_section').style.display='none'; return; }
  if($('#blog_add_section')) $('#blog_add_section').style.display=(can('manage_blog')||can('publish_blog'))?'':'none';
  try{
    const res=await fetch('posts.json'); allPosts=await res.json(); renderPosts(allPosts);
  }catch(e){ $('#blog_list').innerHTML=`<div class="alert err">Failed to load posts.</div>`; }
}

function renderPosts(posts){
  const el=$('#blog_list');
  if(!posts.length){ el.innerHTML='<div class="empty-state"><div class="empty-state-icon">📝</div>No posts yet.</div>'; return; }
  el.innerHTML=posts.map((p,i)=>`
    <div class="blog-post-row">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="flex:1">
          <div style="font-weight:700;margin-bottom:4px">${p.title}</div>
          <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
            <span class="chip">${p.category||'Uncategorised'}</span>
            <span style="color:var(--muted);font-size:.82rem">${p.date?new Date(p.date).toLocaleDateString():''}</span>
            ${p.published===false?'<span class="chip yellow">Draft</span>':'<span class="chip green">Published</span>'}
          </div>
          <div style="color:var(--muted);font-size:.85rem">${p.excerpt||''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${can('publish_blog')?`<button class="btn small ${p.published===false?'success':'warn'}" onclick="togglePublish(${i})">${p.published===false?'Publish':'Unpublish'}</button>`:''}
          ${can('delete_blog')?`<button class="btn small danger" onclick="deletePost(${i})">Delete</button>`:''}
        </div>
      </div>
    </div>`).join('');
}

window.togglePublish=idx=>{
  if(!can('publish_blog')) return adminOut('No permission to publish.','err');
  allPosts[idx].published=allPosts[idx].published===false; renderPosts(allPosts); savePostsJson();
  adminOut(allPosts[idx].published?'✅ Post published.':'📄 Post set to draft.');
};
window.deletePost=idx=>{
  if(!can('delete_blog')) return adminOut('No permission.','err');
  if(!confirm('Delete this post?')) return;
  const title=allPosts[idx].title; allPosts.splice(idx,1); renderPosts(allPosts); $('#stat_posts').textContent=allPosts.length;
  savePostsJson(); writeLog('delete_post',`Deleted "${title}"`); adminOut('Post deleted. posts.json downloaded.');
};
function savePostsJson(){
  const blob=new Blob([JSON.stringify(allPosts,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='posts.json'; a.click();
}
$('#blog_add_btn')?.addEventListener('click',async()=>{
  if(!can('manage_blog')&&!can('publish_blog')) return adminOut('No permission.','err');
  const title=$('#blog_title').value.trim(),excerpt=$('#blog_excerpt').value.trim();
  const category=$('#blog_category').value.trim(),date=$('#blog_date').value,link=$('#blog_link').value.trim();
  if(!title||!excerpt||!category||!date) return adminOut('Fill in all fields.','err');
  allPosts.unshift({title,excerpt,category,date,link:link||null,published:can('publish_blog')});
  renderPosts(allPosts); $('#stat_posts').textContent=allPosts.length; savePostsJson();
  await writeLog('add_post',`Added "${title}"`); adminOut('Post added! posts.json downloaded.');
  ['#blog_title','#blog_excerpt','#blog_category','#blog_date','#blog_link'].forEach(s=>$(s).value='');
});

/* ─── ROLES ── */
async function loadRoles(){
  try{ const snap=await getDocs(collection(db,'roles')); allRoles=snap.docs.map(d=>({id:d.id,...d.data()})); renderRoles(); }
  catch(e){ console.warn(e); }
}
function renderRoles(){
  const el=$('#roles_list'); if(!el) return;
  if(!can('manage_roles')){ el.innerHTML=noPerm('manage roles'); if($('#create_role_btn')) $('#create_role_btn').style.display='none'; return; }
  if($('#create_role_btn')) $('#create_role_btn').style.display='';
  if(!allRoles.length){ el.innerHTML='<div class="empty-state"><div class="empty-state-icon">🛡️</div>No roles yet.</div>'; return; }
  el.innerHTML=allRoles.map(r=>`
    <div class="user-row">
      <div style="flex:1">
        <div class="user-name" style="margin-bottom:6px">🛡️ ${r.name}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${(r.permissions||[]).map(p=>{const perm=ALL_PERMISSIONS.find(x=>x.id===p);return perm?`<span class="chip" style="font-size:.72rem">${perm.label}</span>`:''}).join('')}
          ${!(r.permissions||[]).length?'<span style="color:var(--muted);font-size:.82rem">No permissions</span>':''}
        </div>
        <div style="color:var(--muted);font-size:.78rem;margin-top:6px">${(r.permissions||[]).length} permissions</div>
      </div>
      <div class="user-actions">
        <button class="btn small" onclick="editRole('${r.id}')">Edit</button>
        <button class="btn small danger" onclick="deleteRole('${r.id}')">Delete</button>
      </div>
    </div>`).join('');
}
window.editRole=id=>{
  if(!can('manage_roles')) return adminOut('No permission.','err');
  const r=allRoles.find(r=>r.id===id); if(!r) return;
  editingRoleId=id; $('#role_name').value=r.name;
  ALL_PERMISSIONS.forEach(p=>{const cb=document.getElementById(`perm_${p.id}`);if(cb)cb.checked=(r.permissions||[]).includes(p.id);});
  $('#role_modal_title').textContent='✏️ Edit Role'; $('#role_modal').classList.add('open');
};
window.deleteRole=async id=>{
  if(!can('manage_roles')) return adminOut('No permission.','err');
  const r=allRoles.find(r=>r.id===id);
  if(!confirm(`Delete role "${r?.name}"?`)) return;
  try{ await deleteDoc(doc(db,'roles',id)); await writeLog('delete_role',`Deleted "${r?.name}"`); adminOut('Role deleted.'); loadRoles(); }
  catch(e){adminOut(e.message,'err');}
};
$('#role_cancel')?.addEventListener('click',()=>{$('#role_modal').classList.remove('open');editingRoleId=null;});
$('#role_modal')?.addEventListener('click',e=>{if(e.target===$('#role_modal')){$('#role_modal').classList.remove('open');editingRoleId=null;}});
$('#create_role_btn')?.addEventListener('click',()=>{
  if(!can('manage_roles')) return adminOut('No permission.','err');
  editingRoleId=null; $('#role_name').value='';
  ALL_PERMISSIONS.forEach(p=>{const cb=document.getElementById(`perm_${p.id}`);if(cb)cb.checked=false;});
  $('#role_modal_title').textContent='🛡️ Create Role'; $('#role_modal').classList.add('open');
});
$('#role_save')?.addEventListener('click',async()=>{
  if(!can('manage_roles')) return adminOut('No permission.','err');
  const name=$('#role_name').value.trim(); if(!name) return adminOut('Enter a role name.','err');
  const permissions=ALL_PERMISSIONS.filter(p=>document.getElementById(`perm_${p.id}`)?.checked).map(p=>p.id);
  try{
    if(editingRoleId){ await setDoc(doc(db,'roles',editingRoleId),{name,permissions}); await writeLog('edit_role',`Updated "${name}"`); adminOut('Role updated!'); }
    else { await addDoc(collection(db,'roles'),{name,permissions,createdAt:serverTimestamp()}); await writeLog('create_role',`Created "${name}"`); adminOut('Role created!'); }
    $('#role_modal').classList.remove('open'); editingRoleId=null; loadRoles();
  }catch(e){adminOut(e.message,'err');}
});

/* ─── BROADCAST ── */
$('#send_global_btn')?.addEventListener('click',async()=>{
  if(!can('send_global_msg')) return adminOut('No permission.','err');
  const msg=$('#global_msg').value.trim(); if(!msg) return adminOut('Enter a message.','err');
  try{
    await setDoc(doc(db,'global','banner'),{message:msg,active:true,sentAt:serverTimestamp()});
    await writeLog('send_global',`Broadcast: "${msg.substring(0,60)}"`); adminOut('✅ Broadcast sent!');
    $('#global_msg').value=''; document.getElementById('global_preview').style.display='none';
  }catch(e){adminOut(e.message,'err');}
});
$('#clear_global_btn')?.addEventListener('click',async()=>{
  if(!can('manage_banner')&&!can('send_global_msg')) return adminOut('No permission.','err');
  try{ await setDoc(doc(db,'global','banner'),{active:false}); await writeLog('clear_banner','Cleared banner'); adminOut('Banner cleared.'); }
  catch(e){adminOut(e.message,'err');}
});

/* ─── EMAIL ── */
$('#email_cancel')?.addEventListener('click',()=>$('#email_modal').classList.remove('open'));
$('#email_modal')?.addEventListener('click',e=>{if(e.target===$('#email_modal'))$('#email_modal').classList.remove('open');});
$('#email_send_btn')?.addEventListener('click',async()=>{
  if(!can('send_emails')&&!can('reply_messages')) return adminOut('No permission.','err');
  const to=$('#email_to').value.trim(),subject=$('#email_subject').value.trim(),body=$('#email_body').value.trim();
  if(!to||!subject||!body) return adminOut('Fill in all email fields.','err');
  try{
    const res=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'custom',to,subject,body})});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Send failed');
    await writeLog('send_email',`Sent to ${to} — "${subject}"`);
    adminOut(`✅ Email sent to ${to}`);
    $('#email_modal').classList.remove('open');
  }catch(e){
    adminOut('Failed to send: '+e.message,'err');
  }
});

/* ─── LOGS ── */
async function loadLogs(){
  if(!can('view_logs')){ $('#logs_list').innerHTML=noPerm('view logs'); return; }
  try{
    const snap=await getDocs(collection(db,'admin_logs'));
    allLogs=snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.timestamp?.seconds||0)-(a.timestamp?.seconds||0))
      .slice(0,100);
    renderLogs(allLogs);
  }catch(e){ $('#logs_list').innerHTML=`<div class="alert err">${e.message}</div>`; }
}
function logIcon(a=''){ const m={verify:'✅',ban:'🚫',delete:'🗑',edit:'✏️',promote:'⬆️',demote:'⬇️',send:'📢',create:'✨',export:'📤',post:'📝',role:'🛡️',email:'📧',access:'🔐'}; return Object.entries(m).find(([k])=>a.includes(k))?.[1]||'📋'; }
function renderLogs(logs){
  const el=$('#logs_list'); if(!el) return;
  if(!logs.length){ el.innerHTML='<div class="empty-state"><div class="empty-state-icon">📜</div>No logs yet.</div>'; return; }
  el.innerHTML=logs.map(l=>`
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.07);margin-bottom:6px;background:rgba(255,255,255,.02);transition:border-color .2s" onmouseover="this.style.borderColor='rgba(124,58,237,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.07)'">
      <div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,rgba(124,58,237,.2),rgba(34,211,238,.1));display:flex;align-items:center;justify-content:center;flex-shrink:0">${logIcon(l.action)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.88rem">${l.action||'action'}</div>
        <div style="color:var(--muted-2);font-size:.82rem">${l.details||''}</div>
        <div style="color:var(--muted);font-size:.78rem;margin-top:3px">by ${l.adminEmail||'unknown'} · ${l.timestamp?.toDate?l.timestamp.toDate().toLocaleString():'—'}</div>
      </div>
    </div>`).join('');
}
$('#log_search')?.addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  renderLogs(allLogs.filter(l=>(l.action||'').includes(q)||(l.details||'').includes(q)||(l.adminEmail||'').includes(q)));
});
$('#log_clear_btn')?.addEventListener('click',async()=>{
  if(!can('view_logs')) return;
  if(!confirm('Clear all logs?')) return;
  try{ const snap=await getDocs(collection(db,'admin_logs')); await Promise.all(snap.docs.map(d=>deleteDoc(d.ref))); allLogs=[]; renderLogs([]); adminOut('Logs cleared.'); }
  catch(e){adminOut(e.message,'err');}
});

/* ─── EXPORT ── */
function downloadCSV(rows,filename){
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=filename; a.click();
}
$('#export_users_btn')?.addEventListener('click',async()=>{
  if(!can('export_data')) return adminOut('No permission.','err');
  downloadCSV([['UID','Name','Email','Verified','Admin','Banned','Role'],...allUsers.map(u=>[u.id,u.displayName||'',u.email||'',u.isVerified,u.isAdmin,u.isBanned,u.role||''])],'dekuu-users.csv');
  await writeLog('export_data','Exported users CSV'); adminOut('✅ Users exported.');
});
$('#export_messages_btn')?.addEventListener('click',async()=>{
  if(!can('export_data')) return adminOut('No permission.','err');
  downloadCSV([['ID','Name','Email','Message','Date'],...allMessages.map(m=>[m.id,m.name||'',m.email||'',(m.message||'').replace(/\n/g,' '),m.createdAt?.toDate?m.createdAt.toDate().toISOString():''])],'dekuu-messages.csv');
  await writeLog('export_data','Exported messages CSV'); adminOut('✅ Messages exported.');
});
$('#export_logs_btn')?.addEventListener('click',async()=>{
  if(!can('export_data')) return adminOut('No permission.','err');
  downloadCSV([['Action','Details','Admin','Timestamp'],...allLogs.map(l=>[l.action||'',l.details||'',l.adminEmail||'',l.timestamp?.toDate?l.timestamp.toDate().toISOString():''])],'dekuu-logs.csv');
  adminOut('✅ Logs exported.');
});

/* ─── SETTINGS ── */
async function loadSettings(){
  if(!can('manage_settings')){ const el=$('#settings_form'); if(el) el.innerHTML=noPerm('manage settings'); return; }
  try{
    const snap=await getDoc(doc(db,'global','settings'));
    const s=snap.exists()?snap.data():{};
    if($('#setting_site_name')) $('#setting_site_name').value=s.siteName||'Dekuu';
    if($('#setting_maintenance')) $('#setting_maintenance').checked=s.maintenance||false;
    if($('#setting_signup_open')) $('#setting_signup_open').checked=s.signupOpen!==false;
    if($('#setting_contact_open')) $('#setting_contact_open').checked=s.contactOpen!==false;
    if($('#setting_blog_open')) $('#setting_blog_open').checked=s.blogOpen!==false;
  }catch(e){ console.warn(e); }
}
$('#settings_save_btn')?.addEventListener('click',async()=>{
  if(!can('manage_settings')) return adminOut('No permission.','err');
  try{
    await setDoc(doc(db,'global','settings'),{
      siteName:$('#setting_site_name').value.trim()||'Dekuu',
      maintenance:$('#setting_maintenance').checked,
      signupOpen:$('#setting_signup_open').checked,
      contactOpen:$('#setting_contact_open').checked,
      blogOpen:$('#setting_blog_open').checked,
      updatedAt:serverTimestamp(), updatedBy:currentUser?.email
    });
    await writeLog('manage_settings','Updated site settings'); adminOut('✅ Settings saved!');
  }catch(e){adminOut(e.message,'err');}
});

/* ─── SEARCH ── */
$('#user_search')?.addEventListener('input',e=>{ const q=e.target.value.toLowerCase(); renderUsers(allUsers.filter(u=>(u.displayName||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q))); });
$('#msg_search')?.addEventListener('input',e=>{ const q=e.target.value.toLowerCase(); renderMessages(allMessages.filter(m=>m.name?.toLowerCase().includes(q)||m.email?.toLowerCase().includes(q)||m.message?.toLowerCase().includes(q))); });

/* ─── TABS ── */
$$('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    $$('.tab-btn').forEach(b=>b.classList.remove('active')); $$('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); $(`#tab_${btn.dataset.tab}`)?.classList.add('active');
  });
});

/* ─── CLOSE MODALS ── */
$('#activity_close')?.addEventListener('click',()=>$('#activity_modal').classList.remove('open'));
$('#activity_modal')?.addEventListener('click',e=>{if(e.target===$('#activity_modal'))$('#activity_modal').classList.remove('open');});

/* ─── AUTH ── */
const authTimeout=setTimeout(()=>{ $('#admin_loading').innerHTML=`<div class="alert err">Auth timed out. <a href="login.html" style="color:#7c3aed">Log in again</a>.</div>`; },8000);

onAuthStateChanged(auth,async user=>{
  clearTimeout(authTimeout); currentUser=user; renderNav(user);
  if(!user){ $('#admin_loading').style.display='none'; location.href='login.html'; return; }
  try{
    const adminRecord=await getAdminRecord(user);
    $('#admin_loading').style.display='none';
    if(!adminRecord){ $('#admin_denied').style.display='block'; return; }
    currentAdminPerms=adminRecord.permissions;
    $('#admin_panel').style.display='block';
    $('#admin_welcome').textContent=`Welcome back, ${user.displayName||user.email}`;
    $('#admin_role_badge').textContent=adminRecord.isSuperAdmin?'👑 Super Admin':'🛡️ Admin';
    $$('.reveal').forEach(el=>obs.observe(el));
    applyTabPermissions();
    await loadAll();
    await writeLog('panel_access','Opened admin panel');
  }catch(e){
    $('#admin_loading').innerHTML=`<div class="alert err">Error: ${e.message}<br><br><a class="btn small" href="login.html">Go to Login</a></div>`;
  }
});
