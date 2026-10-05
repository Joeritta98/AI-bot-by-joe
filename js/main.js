/* ============ AI Video Generator by Joe — main.js ============ */
const API_BASE = 'https://nexabot.id/api/v1';
const COST = 0.15;

/* ---------- Config helpers ---------- */
function getConfig(){
  try{ return JSON.parse(localStorage.getItem('joeai_config')) || {}; }
  catch(e){ return {}; }
}
function getApiKey(){
  const c = getConfig();
  if(!c.apiKey){
    toast('Sila set API key di Admin Panel dahulu!', true);
    setTimeout(()=>location.href='admin.html', 1200);
    return null;
  }
  return c.apiKey;
}

/* ---------- Sidebar ---------- */
const sidebar = document.getElementById('sidebar');
document.getElementById('openSidebar').onclick = ()=>sidebar.classList.add('open');
document.getElementById('closeSidebar').onclick = ()=>sidebar.classList.remove('open');
if(window.innerWidth < 1024) sidebar.classList.remove('open');

/* ---------- Nav / Panel switching ---------- */
const navItems = document.querySelectorAll('.nav-item[data-mode]');
navItems.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navItems.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('[data-panel]').forEach(p=>
      p.classList.toggle('hidden', p.dataset.panel !== btn.dataset.mode));
    if(window.innerWidth < 1024) sidebar.classList.remove('open');
    window.scrollTo({top:0, behavior:'smooth'});
  });
});

/* ---------- Media previews ---------- */
document.querySelectorAll('input.media').forEach(inp=>{
  inp.addEventListener('change', ()=>{
    const panel = inp.closest('[data-panel]');
    const preview = panel.querySelector('.media-preview');
    preview.innerHTML = '';
    let files = Array.from(inp.files);
    const max = parseInt(inp.dataset.max || '99', 10);
    if(files.length > max){
      toast(`Maksimum ${max} fail sahaja.`, true);
      inp.value = ''; return;
    }
    files.forEach(f=>{
      const url = URL.createObjectURL(f);
      const el = f.type.startsWith('video')
        ? Object.assign(document.createElement('video'), {src:url, controls:true, muted:true})
        : Object.assign(document.createElement('img'), {src:url});
      preview.appendChild(el);
    });
  });
});

/* ---------- File → base64 data URI ---------- */
function fileToDataURI(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ---------- Submit ---------- */
document.querySelectorAll('[data-submit]').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    const mode = btn.dataset.submit;
    const apiKey = getApiKey(); if(!apiKey) return;
    const cfg = getConfig();
    const panel = document.querySelector(`[data-panel="${mode}"]`);
    const prompt = panel.querySelector('.prompt').value.trim();
    if(!prompt){ toast('Sila isi prompt dahulu.', true); return; }

    const ratio = parseInt(panel.querySelector('.ratio').value, 10);
    const resolution = parseInt(panel.querySelector('.resolution').value, 10);

    const body = { mode, prompt, resolution };
    if(ratio) body.ratio = ratio;
    const model = cfg['model_'+mode];
    if(model) body.model = model;

    // media
    if(mode === 'sfv' || mode === 'i2v'){
      const files = Array.from(panel.querySelector('input.media').files);
      const need = mode === 'sfv' ? 1 : 1;
      if(files.length < need){ toast('Sila upload gambar dahulu.', true); return; }
      body.media = await Promise.all(files.map(fileToDataURI));
    }
    if(mode === 'r2v'){
      const vInp = panel.querySelector('.video-media');
      const iInp = panel.querySelector('.image-media');
      if(!vInp.files.length){ toast('Sila upload video rujukan.', true); return; }
      body.media = [ await fileToDataURI(vInp.files[0]) ];
      if(iInp.files.length) body.media.push(await fileToDataURI(iInp.files[0]));
    }

    btn.disabled = true;
    showResult('running', 'Menghantar request...', 5);
    try{
      const res = await fetch(`${API_BASE}/api`, {
        method:'POST',
        headers:{ 'x-api-key': apiKey, 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      if(res.status === 401) throw new Error('API key tidak valid (401). Semak di Admin Panel.');
      if(res.status === 402) throw new Error('Kredit tidak cukup (402). Perlu 0.15 kredit.');
      if(res.status === 400) throw new Error('Request tidak valid (400).');
      if(!res.ok) throw new Error('Ralat HTTP ' + res.status);
      const data = await res.json();
      if(!data.job_id) throw new Error(data.error || 'Tiada job_id diterima.');
      toast('Job diterima! Sedang diproses...');
      pollJob(data.job_id, apiKey, mode, prompt);
    }catch(err){
      showResult('fail', '❌ ' + err.message, 0);
      btn.disabled = false;
    }
  });
});

/* ---------- Polling ---------- */
async function pollJob(jobId, apiKey, mode, prompt){
  const btn = document.querySelector(`[data-submit="${mode}"]`);
  let pct = 10;
  const tick = setInterval(()=>{
    pct = Math.min(pct + Math.random()*6, 92);
    showResult('running', `Sedang diproses... (job: ${jobId})`, pct);
  }, 3000);

  while(true){
    await new Promise(r=>setTimeout(r, 3000));
    let j;
    try{
      const res = await fetch(`${API_BASE}/jobs/${jobId}`, { headers:{ 'x-api-key': apiKey } });
      j = await res.json();
    }catch(e){ continue; }
    const job = j.job || {};
    if(job.status === 'done'){
      clearInterval(tick);
      const dl = `${API_BASE}/jobs/${jobId}/download`;
      showResult('done', '✅ Siap! Hasil sedia dimuat turun.', 100);
      await loadResult(dl, apiKey, mode, prompt);
      btn.disabled = false;
      refreshCredit(apiKey);
      return;
    }
    if(job.status === 'failed'){
      clearInterval(tick);
      showResult('fail', '❌ Generate gagal: ' + (job.error || 'unknown') + ' (kredit di-refund)', 0);
      btn.disabled = false;
      return;
    }
  }
}

/* ---------- Load result (blob → preview + download) ---------- */
async function loadResult(dlUrl, apiKey, mode, prompt){
  const box = document.getElementById('resultMedia');
  const dlBtn = document.getElementById('downloadBtn');
  try{
    const res = await fetch(dlUrl, { headers:{ 'x-api-key': apiKey } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    box.innerHTML = '';
    if(blob.type.startsWith('video') || dlUrl.includes('.mp4') || mode !== 'img'){
      const v = document.createElement('video');
      v.src = url; v.controls = true; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
      box.appendChild(v);
    }else{
      const img = document.createElement('img'); img.src = url; box.appendChild(img);
    }
    dlBtn.href = url;
    dlBtn.classList.remove('hidden');
    dlBtn.setAttribute('download', `joeai_${mode}_${Date.now()}.mp4`);
    saveToGallery(mode, prompt, url);
  }catch(e){
    box.innerHTML = `<p style="color:#ff6666">Gagal memuat hasil. Cuba download manual: <a style="color:var(--yellow)" href="${dlUrl}">di sini</a></p>`;
  }
}

/* ---------- Result UI ---------- */
function showResult(state, text, pct){
  const box = document.getElementById('resultBox');
  box.classList.remove('hidden');
  box.scrollIntoView({behavior:'smooth', block:'nearest'});
  const dot = document.getElementById('statusDot');
  dot.className = 'dot' + (state==='done' ? ' done' : state==='fail' ? ' fail' : '');
  document.getElementById('statusText').textContent = text;
  document.getElementById('progressFill').style.width = (pct||0) + '%';
}

/* ---------- Gallery (localStorage) ---------- */
function saveToGallery(mode, prompt, url){
  const g = JSON.parse(localStorage.getItem('joeai_gallery') || '[]');
  g.unshift({ mode, prompt: prompt.slice(0,80), url, time: new Date().toLocaleString('ms-MY') });
  localStorage.setItem('joeai_gallery', JSON.stringify(g.slice(0, 30)));
  renderGallery();
}
function renderGallery(){
  const grid = document.getElementById('galleryGrid');
  const g = JSON.parse(localStorage.getItem('joeai_gallery') || '[]');
  if(!g.length) return;
  grid.innerHTML = g.map(it=>`
    <div class="g-item">
      <video src="${it.url}" muted loop playsinline onmouseenter="this.play()" onmouseleave="this.pause()"></video>
      <div class="g-meta"><b>${it.mode.toUpperCase()}</b>${it.prompt}<br>${it.time}</div>
    </div>`).join('');
}
renderGallery();

/* ---------- Credit badge ---------- */
async function refreshCredit(key){
  key = key || (getConfig().apiKey || null);
  if(!key) return;
  try{
    const res = await fetch(`${API_BASE}/api/credit`, { headers:{ 'x-api-key': key } });
    const d = await res.json();
    if(d.ok) document.getElementById('creditBadge').textContent = '💳 ' + d.credit + ' kredit';
  }catch(e){ /* senyap */ }
}
refreshCredit();

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, isErr){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.add('hidden'), 3000);
}
