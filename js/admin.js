/* ============ AI Video Generator by Joe — admin.js ============ */
const API_BASE = 'https://nexabot.id/api/v1';
const DEFAULT_PASS = 'joeadmin';

function getPass(){ return localStorage.getItem('joeai_admin_pass') || DEFAULT_PASS; }
function isLoggedIn(){ return sessionStorage.getItem('joeai_admin_auth') === '1'; }

const loginView = document.getElementById('loginView');
const configView = document.getElementById('configView');

if(isLoggedIn()) showConfig();

document.getElementById('loginBtn').onclick = tryLogin;
document.getElementById('adminPass').addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(); });

function tryLogin(){
  const v = document.getElementById('adminPass').value;
  if(v === getPass()){
    sessionStorage.setItem('joeai_admin_auth','1');
    showConfig();
  }else{
    toast('Kata laluan salah!', true);
  }
}

function showConfig(){
  loginView.classList.add('hidden');
  configView.classList.remove('hidden');
  // load saved config
  let c = {};
  try{ c = JSON.parse(localStorage.getItem('joeai_config')) || {}; }catch(e){}
  document.getElementById('apiKey').value = c.apiKey || '';
  ['t2v','sfv','i2v','r2v'].forEach(m=>{
    document.getElementById('model_'+m).value = c['model_'+m] || '';
  });
}

document.getElementById('saveBtn').onclick = ()=>{
  const apiKey = document.getElementById('apiKey').value.trim();
  if(!apiKey){ toast('API key tidak boleh kosong!', true); return; }
  const c = { apiKey };
  ['t2v','sfv','i2v','r2v'].forEach(m=>{
    c['model_'+m] = document.getElementById('model_'+m).value.trim();
  });
  localStorage.setItem('joeai_config', JSON.stringify(c));
  toast('✅ Tetapan disimpan! Semua fitur kini bersambung ke API anda.');
};

document.getElementById('passBtn').onclick = ()=>{
  const np = document.getElementById('newPass').value.trim();
  if(np.length < 4){ toast('Kata laluan baru mesti sekurangnya 4 aksara.', true); return; }
  localStorage.setItem('joeai_admin_pass', np);
  document.getElementById('newPass').value = '';
  toast('✅ Kata laluan admin ditukar.');
};

document.getElementById('logoutBtn').onclick = ()=>{
  sessionStorage.removeItem('joeai_admin_auth');
  location.reload();
};

document.getElementById('testBtn').onclick = async ()=>{
  const out = document.getElementById('testResult');
  const key = document.getElementById('apiKey').value.trim();
  if(!key){ toast('Isi API key dahulu.', true); return; }
  out.textContent = 'Menguji sambungan...';
  try{
    const res = await fetch(`${API_BASE}/api/credit`, { headers:{ 'x-api-key': key } });
    const d = await res.json();
    out.textContent = JSON.stringify(d, null, 2);
    if(d.ok) toast('✅ Sambungan berjaya! Baki: ' + d.credit + ' kredit');
    else toast('Sambungan gagal — semak response.', true);
  }catch(e){
    out.textContent = 'Ralat: ' + e.message;
    toast('Gagal berhubung dengan server API.', true);
  }
};

let toastTimer;
function toast(msg, isErr){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.add('hidden'), 3000);
}
