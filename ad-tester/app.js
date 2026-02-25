// Ad Tester — Synthetic Persona Testing Tool
// Connects to Cloudflare Worker backend for Claude API calls

const API_BASE = 'https://ad-tester-worker.aliqureshi.workers.dev';
const USE_MOCK = true; // Toggle to false when worker is deployed
const MAX_CREATIVES = 5;
const PERSONAS_PER_TEST = 200;
const VISIBLE_PERSONAS_DEFAULT = 20;

let visiblePersonaCount = VISIBLE_PERSONAS_DEFAULT;
let currentTierFilter = 'all';
let currentCreativeFilter = 0;
let testResults = null;

// Store media data per creative index: { type: 'image'|'video', base64: string, frames: string[] }
const creativeMedia = {};
const VIDEO_FRAME_TIMES = [0, 1, 3, 5]; // seconds to extract frames at

// ─── Creative Card Management ───

function getCreativeCount() {
  return document.querySelectorAll('.creative-card').length;
}

function getCreativeLabel(index) {
  return String.fromCharCode(65 + index); // A, B, C, D, E
}

function addCreativeCard() {
  const count = getCreativeCount();
  if (count >= MAX_CREATIVES) return;

  const label = getCreativeLabel(count);
  const card = document.createElement('div');
  card.className = 'creative-card border border-border p-6';
  card.dataset.index = count;
  card.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <span class="font-serif text-[20px] italic">Creative ${label}</span>
      <button class="btn-remove-creative text-[11px] uppercase tracking-[0.15em] text-muted hover:text-off-white transition-colors" data-index="${count}">Remove</button>
    </div>
    <div class="space-y-4">
      <div>
        <label class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-2">Creative Asset <span class="text-muted/60">(image or video)</span></label>
        <div class="media-upload-zone relative border border-dashed border-border-focus bg-input-bg hover:border-muted transition-colors cursor-pointer" data-index="${count}">
          <input type="file" name="media" accept="image/*,video/*" class="media-file-input absolute inset-0 w-full h-full opacity-0 cursor-pointer">
          <div class="media-placeholder flex flex-col items-center justify-center py-8 pointer-events-none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" stroke-width="1.5" class="mb-2"><rect x="3" y="3" width="18" height="18" rx="0"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <span class="text-[12px] text-muted">Drop an image or video, or click to upload</span>
            <span class="text-[11px] text-muted/60 mt-1">Static ads, UGC, video ads — any format</span>
          </div>
          <div class="media-preview hidden">
            <img class="media-preview-img hidden w-full max-h-[300px] object-contain">
            <video class="media-preview-video hidden w-full max-h-[300px] object-contain" controls muted></video>
            <div class="media-preview-info flex items-center justify-between px-4 py-2 border-t border-border">
              <span class="media-preview-name text-[11px] text-muted truncate"></span>
              <button class="media-remove text-[11px] text-muted hover:text-off-white transition-colors uppercase tracking-[0.15em]">Remove</button>
            </div>
          </div>
          <canvas class="media-canvas hidden"></canvas>
        </div>
        <div class="media-frames hidden mt-3">
          <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-2">Extracted Frames</span>
          <div class="media-frames-grid grid grid-cols-4 gap-2"></div>
        </div>
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-2">Headline</label>
        <input type="text" name="headline" placeholder="e.g., Your muscles are disappearing. Here's why." class="w-full bg-input-bg border border-border-focus text-off-white text-[13px] px-4 py-3 focus:border-off-white focus:outline-none transition-colors">
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-2">Body Copy / Script</label>
        <textarea name="body" rows="3" placeholder="The main ad copy, script, or voiceover text..." class="w-full bg-input-bg border border-border-focus text-off-white text-[13px] px-4 py-3 focus:border-off-white focus:outline-none transition-colors resize-none"></textarea>
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-2">CTA</label>
        <input type="text" name="cta" placeholder="e.g., Shop Now" class="w-full bg-input-bg border border-border-focus text-off-white text-[13px] px-4 py-3 focus:border-off-white focus:outline-none transition-colors">
      </div>
    </div>
  `;

  document.getElementById('creatives-container').appendChild(card);
  updateAddButton();
  bindRemoveButtons();

  // Init media upload on the new card
  const newZone = card.querySelector('.media-upload-zone');
  if (newZone) initMediaUpload(newZone);
}

function removeCreativeCard(index) {
  const cards = document.querySelectorAll('.creative-card');
  if (cards.length <= 1) return;
  cards[index].remove();
  reindexCreativeCards();
  updateAddButton();
}

function reindexCreativeCards() {
  document.querySelectorAll('.creative-card').forEach((card, i) => {
    card.dataset.index = i;
    const label = card.querySelector('.font-serif');
    if (label) label.textContent = `Creative ${getCreativeLabel(i)}`;
    const removeBtn = card.querySelector('.btn-remove-creative');
    if (removeBtn) removeBtn.dataset.index = i;
  });
}

function updateAddButton() {
  const btn = document.getElementById('btn-add-creative');
  if (getCreativeCount() >= MAX_CREATIVES) {
    btn.classList.add('opacity-30', 'pointer-events-none');
  } else {
    btn.classList.remove('opacity-30', 'pointer-events-none');
  }
}

function bindRemoveButtons() {
  document.querySelectorAll('.btn-remove-creative').forEach(btn => {
    btn.onclick = () => removeCreativeCard(parseInt(btn.dataset.index));
  });
}

// ─── Media Upload Handling ───

function initMediaUpload(zone) {
  const fileInput = zone.querySelector('.media-file-input');
  const placeholder = zone.querySelector('.media-placeholder');
  const preview = zone.querySelector('.media-preview');
  const previewImg = zone.querySelector('.media-preview-img');
  const previewVideo = zone.querySelector('.media-preview-video');
  const previewName = zone.querySelector('.media-preview-name');
  const removeBtn = zone.querySelector('.media-remove');
  const canvas = zone.querySelector('.media-canvas');
  const index = parseInt(zone.dataset.index);

  // Get the frames container (sibling of the zone)
  const card = zone.closest('.creative-card') || zone.closest('.space-y-4').parentElement;
  const framesContainer = card.querySelector('.media-frames');
  const framesGrid = card.querySelector('.media-frames-grid');

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) return;

    // Show preview
    placeholder.classList.add('hidden');
    preview.classList.remove('hidden');
    previewName.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;

    if (isImage) {
      const dataUrl = await fileToBase64(file);
      previewImg.src = dataUrl;
      previewImg.classList.remove('hidden');
      previewVideo.classList.add('hidden');
      if (framesContainer) framesContainer.classList.add('hidden');

      // Store for API
      creativeMedia[index] = {
        type: 'image',
        base64: dataUrl.split(',')[1],
        mediaType: file.type,
        frames: null,
      };
    }

    if (isVideo) {
      const videoUrl = URL.createObjectURL(file);
      previewVideo.src = videoUrl;
      previewVideo.classList.remove('hidden');
      previewImg.classList.add('hidden');

      // Extract frames
      previewVideo.addEventListener('loadeddata', async () => {
        const frames = await extractVideoFrames(previewVideo, canvas);
        creativeMedia[index] = {
          type: 'video',
          base64: null,
          mediaType: 'image/jpeg',
          frames: frames,
        };

        // Show extracted frames
        if (framesContainer && framesGrid) {
          framesGrid.innerHTML = '';
          frames.forEach((frame, fi) => {
            const label = VIDEO_FRAME_TIMES[fi] !== undefined ? `${VIDEO_FRAME_TIMES[fi]}s` : `${fi}`;
            const img = document.createElement('div');
            img.className = 'relative';
            img.innerHTML = `
              <img src="data:image/jpeg;base64,${frame}" class="w-full border border-border object-cover aspect-video">
              <span class="absolute bottom-1 right-1 text-[10px] text-muted bg-surface/80 px-1">${label}</span>
            `;
            framesGrid.appendChild(img);
          });
          framesContainer.classList.remove('hidden');
        }
      }, { once: true });
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearMedia(zone, index);
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('border-off-white/40');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('border-off-white/40');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('border-off-white/40');
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });
}

function clearMedia(zone, index) {
  const placeholder = zone.querySelector('.media-placeholder');
  const preview = zone.querySelector('.media-preview');
  const previewImg = zone.querySelector('.media-preview-img');
  const previewVideo = zone.querySelector('.media-preview-video');
  const fileInput = zone.querySelector('.media-file-input');
  const card = zone.closest('.creative-card') || zone.closest('.space-y-4').parentElement;
  const framesContainer = card.querySelector('.media-frames');

  placeholder.classList.remove('hidden');
  preview.classList.add('hidden');
  previewImg.classList.add('hidden');
  previewImg.src = '';
  previewVideo.classList.add('hidden');
  previewVideo.src = '';
  fileInput.value = '';
  if (framesContainer) framesContainer.classList.add('hidden');

  delete creativeMedia[index];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractVideoFrames(video, canvas) {
  const frames = [];
  const ctx = canvas.getContext('2d');
  const duration = video.duration || 10;

  for (const time of VIDEO_FRAME_TIMES) {
    if (time > duration) break;
    const frame = await seekAndCapture(video, canvas, ctx, time);
    frames.push(frame);
  }

  // If video is longer, grab a frame near the end too
  if (duration > 6) {
    const endFrame = await seekAndCapture(video, canvas, ctx, Math.min(duration - 0.5, 8));
    frames.push(endFrame);
  }

  return frames;
}

function seekAndCapture(video, canvas, ctx, time) {
  return new Promise((resolve) => {
    video.currentTime = time;
    video.addEventListener('seeked', () => {
      canvas.width = Math.min(video.videoWidth, 640);
      canvas.height = Math.min(video.videoHeight, 480);
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      resolve(dataUrl.split(',')[1]);
    }, { once: true });
  });
}

function initAllMediaUploads() {
  document.querySelectorAll('.media-upload-zone').forEach(zone => {
    initMediaUpload(zone);
  });
}

// ─── Brand Context Toggle ───

function initBrandToggle() {
  const btnManual = document.getElementById('btn-manual');
  const btnCached = document.getElementById('btn-cached');
  const manualInputs = document.getElementById('manual-inputs');
  const cachedInputs = document.getElementById('cached-inputs');

  btnManual.addEventListener('click', () => {
    manualInputs.classList.remove('hidden');
    cachedInputs.classList.add('hidden');
    btnManual.classList.add('bg-off-white/10', 'border-off-white', 'text-off-white');
    btnManual.classList.remove('border-border', 'text-muted');
    btnCached.classList.remove('bg-off-white/10', 'border-off-white', 'text-off-white');
    btnCached.classList.add('border-border', 'text-muted');
  });

  btnCached.addEventListener('click', () => {
    manualInputs.classList.add('hidden');
    cachedInputs.classList.remove('hidden');
    btnCached.classList.add('bg-off-white/10', 'border-off-white', 'text-off-white');
    btnCached.classList.remove('border-border', 'text-muted');
    btnManual.classList.remove('bg-off-white/10', 'border-off-white', 'text-off-white');
    btnManual.classList.add('border-border', 'text-muted');
    loadCachedBrands();
  });
}

function loadCachedBrands() {
  const container = document.getElementById('cached-brands-list');
  const noCached = document.getElementById('no-cached');
  const brands = JSON.parse(localStorage.getItem('ad-tester-brands') || '{}');
  const keys = Object.keys(brands);

  container.innerHTML = '';

  if (keys.length === 0) {
    noCached.classList.remove('hidden');
    return;
  }

  noCached.classList.add('hidden');
  keys.forEach(key => {
    const brand = brands[key];
    const btn = document.createElement('button');
    btn.className = 'cached-brand-btn text-left border border-border p-4 hover:border-border-focus transition-colors';
    btn.innerHTML = `
      <span class="text-[13px] text-off-white block">${brand.name}</span>
      <span class="text-[11px] text-muted block mt-1">${brand.personaCount || 200} personas cached</span>
    `;
    btn.addEventListener('click', () => selectCachedBrand(key));
    container.appendChild(btn);
  });
}

function selectCachedBrand(key) {
  const brands = JSON.parse(localStorage.getItem('ad-tester-brands') || '{}');
  const brand = brands[key];
  if (!brand) return;

  document.querySelectorAll('.cached-brand-btn').forEach(b => {
    b.classList.remove('border-off-white', 'bg-off-white/5');
    b.classList.add('border-border');
  });

  event.currentTarget.classList.add('border-off-white', 'bg-off-white/5');
  event.currentTarget.classList.remove('border-border');

  document.getElementById('input-product').value = brand.product || '';
  document.getElementById('input-audience').value = brand.audience || '';
  document.getElementById('input-price').value = brand.price || '';
  document.getElementById('input-market').value = brand.market || 'us';
}

function cacheBrand(brandContext, personas) {
  const brands = JSON.parse(localStorage.getItem('ad-tester-brands') || '{}');
  const name = brandContext.product.substring(0, 40).trim();
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  brands[key] = {
    name: name,
    product: brandContext.product,
    audience: brandContext.audience,
    price: brandContext.price,
    market: brandContext.market,
    personas: personas,
    personaCount: personas.length,
    cachedAt: new Date().toISOString()
  };
  localStorage.setItem('ad-tester-brands', JSON.stringify(brands));
}

// ─── Collect Form Data ───

function collectFormData() {
  const brandContext = {
    product: document.getElementById('input-product').value.trim(),
    audience: document.getElementById('input-audience').value.trim(),
    price: document.getElementById('input-price').value.trim(),
    market: document.getElementById('input-market').value,
  };

  const creatives = [];
  document.querySelectorAll('.creative-card').forEach((card, i) => {
    const media = creativeMedia[i] || null;
    creatives.push({
      label: getCreativeLabel(i),
      headline: card.querySelector('input[name="headline"]').value.trim(),
      body: card.querySelector('textarea[name="body"]').value.trim(),
      cta: card.querySelector('input[name="cta"]').value.trim(),
      media: media,
    });
  });

  return { brandContext, creatives };
}

function validateForm(data) {
  if (!data.brandContext.product) return 'Product description is required.';
  for (let i = 0; i < data.creatives.length; i++) {
    const c = data.creatives[i];
    if (!c.headline && !c.body && !c.media) {
      return `Creative ${c.label}: add a headline, body copy, or upload a creative asset.`;
    }
  }
  return null;
}

// ─── Loading State ───

function showLoading() {
  document.getElementById('loading-section').classList.remove('hidden');
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('btn-run-test').disabled = true;
  document.getElementById('btn-run-test').classList.add('opacity-30');
}

function updateLoadingProgress(step, current, total) {
  document.getElementById('loading-step').textContent = step;
  document.getElementById('loading-count').textContent = `${current}/${total}`;
  const pct = total > 0 ? (current / total) * 100 : 0;
  document.getElementById('loading-bar').style.width = `${pct}%`;
}

function addLoadingPersonaCard(persona, delay) {
  const container = document.getElementById('loading-personas');
  const card = document.createElement('div');
  card.className = 'border border-border p-3 opacity-0';
  card.style.animation = `fadeUp 0.4s ease ${delay}ms forwards`;
  card.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 flex items-center justify-center text-[11px] text-muted border border-border flex-shrink-0">${persona.name.split(' ').map(n => n[0]).join('')}</div>
      <div>
        <span class="text-[12px] text-off-white block">${persona.name}</span>
        <span class="text-[11px] text-muted">${persona.age}, ${persona.location}</span>
      </div>
    </div>
  `;
  container.appendChild(card);
}

function hideLoading() {
  document.getElementById('loading-section').classList.add('hidden');
  document.getElementById('loading-personas').innerHTML = '';
  document.getElementById('btn-run-test').disabled = false;
  document.getElementById('btn-run-test').classList.remove('opacity-30');
}

// ─── Results Rendering ───

function showResults(results) {
  testResults = results;
  const section = document.getElementById('results-section');
  section.classList.remove('hidden');

  renderComparisonMatrix(results);
  renderRecommendations(results);
  renderCannibalisation(results);
  renderAudienceSkew(results);
  renderPatterns(results);
  renderFatigue(results);
  renderObjectionMap(results);
  renderRefinementNotes(results);
  renderPersonaCards(results);

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderComparisonMatrix(results) {
  const header = document.getElementById('matrix-header');
  const body = document.getElementById('matrix-body');

  // Only show matrix for multi-creative
  if (results.creatives.length < 2) {
    document.getElementById('comparison-matrix').classList.add('hidden');
    return;
  }
  document.getElementById('comparison-matrix').classList.remove('hidden');

  // Header
  header.innerHTML = '<th class="text-left text-[11px] uppercase tracking-[0.15em] text-muted py-3 pr-6"></th>';
  results.creatives.forEach(c => {
    header.innerHTML += `<th class="text-center text-[11px] uppercase tracking-[0.15em] text-muted py-3 px-4">${c.label}</th>`;
  });

  // Rows
  const rows = [
    { label: 'Bullseye', key: 'bullseye' },
    { label: 'Adjacent', key: 'adjacent' },
    { label: 'Skeptics', key: 'skeptic' },
    { label: 'Wild Cards', key: 'wildcard' },
    { label: 'Hook Rate', key: 'hookRate', format: 'pct' },
    { label: 'Hold Rate', key: 'holdRate', format: 'pct' },
    { label: 'CTR', key: 'ctr', format: 'pct' },
    { label: 'Verdict', key: 'verdict', format: 'verdict' },
  ];

  body.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-border';
    let html = `<td class="text-[12px] text-muted py-3 pr-6">${row.label}</td>`;

    results.creatives.forEach(c => {
      let val;
      if (row.key === 'verdict') {
        val = c.recommendation.verdict;
        const cls = getVerdictClass(val);
        html += `<td class="text-center text-[12px] py-3 px-4 ${cls}">${val}</td>`;
      } else if (row.format === 'pct') {
        val = c.metrics[row.key];
        html += `<td class="text-center text-[13px] py-3 px-4">${val}%</td>`;
      } else {
        val = c.tierScores[row.key];
        const opacity = Math.max(0.2, val / 100);
        html += `<td class="text-center text-[13px] py-3 px-4"><span class="inline-block w-10 py-1 border border-border" style="background: rgba(245,245,240,${opacity * 0.15})">${val}</span></td>`;
      }
    });

    tr.innerHTML = html;
    body.appendChild(tr);
  });
}

function renderRecommendations(results) {
  const container = document.getElementById('recommendation-cards');
  container.innerHTML = '';

  results.creatives.forEach(c => {
    const rec = c.recommendation;
    const cls = getVerdictClass(rec.verdict);
    const card = document.createElement('div');
    card.className = 'border border-border p-6';
    card.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <div>
          <span class="font-serif text-[20px] italic">${c.label}</span>
          <span class="text-[12px] text-muted ml-3">${c.headline}</span>
        </div>
        <div class="text-right flex-shrink-0 ml-4">
          <span class="text-[24px] font-serif ${cls}">${rec.verdict}</span>
          <span class="text-[11px] text-muted block">${rec.confidence}% confidence</span>
        </div>
      </div>
      <p class="text-[13px] text-off-white/80 leading-relaxed">${rec.reasoning}</p>
      ${rec.caveats ? `<p class="text-[12px] text-muted mt-3 border-l-2 border-border pl-4">${rec.caveats}</p>` : ''}
    `;
    container.appendChild(card);
  });
}

function renderCannibalisation(results) {
  const section = document.getElementById('cannibalisation-section');
  const container = document.getElementById('cannibalisation-cards');

  if (!results.cannibalisation || results.cannibalisation.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = '';

  results.cannibalisation.forEach(warning => {
    const card = document.createElement('div');
    card.className = 'border border-border-focus p-6 bg-off-white/[0.02]';
    card.innerHTML = `
      <div class="flex items-start gap-4">
        <span class="text-[18px] flex-shrink-0">&#9888;</span>
        <div>
          <p class="text-[13px] text-off-white mb-2"><strong class="font-normal text-off-white">${warning.creatives.join(' & ')}</strong> — ${warning.overlap}% persona overlap</p>
          <p class="text-[12px] text-muted">${warning.detail}</p>
          <p class="text-[12px] text-off-white/70 mt-2">${warning.recommendation}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderAudienceSkew(results) {
  const container = document.getElementById('audience-skew-cards');
  container.innerHTML = '';

  results.creatives.forEach(c => {
    const skew = c.audienceSkew;
    const card = document.createElement('div');
    card.className = 'border border-border p-6';

    const genderBar = buildBar(skew.genderSplit.male, skew.genderSplit.female, 'Male', 'Female');
    const ageRows = skew.ageBrackets.map(a =>
      `<div class="flex items-center gap-3 mb-2">
        <span class="text-[11px] text-muted w-16 flex-shrink-0">${a.range}</span>
        <div class="flex-1 h-[6px] bg-border"><div class="h-full bg-off-white/40 bar-fill" style="width: ${a.percentage}%"></div></div>
        <span class="text-[12px] text-off-white w-10 text-right">${a.percentage}%</span>
      </div>`
    ).join('');

    card.innerHTML = `
      <span class="font-serif text-[18px] italic block mb-4">${c.label}</span>
      <div class="mb-6">
        <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-3">Gender Split</span>
        ${genderBar}
      </div>
      <div class="mb-4">
        <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-3">Age Distribution</span>
        ${ageRows}
      </div>
      ${skew.mismatchFlag ? `<p class="text-[12px] text-off-white/70 border-l-2 border-border-focus pl-4 mt-4">${skew.mismatchFlag}</p>` : ''}
    `;
    container.appendChild(card);
  });
}

function buildBar(valA, valB, labelA, labelB) {
  return `
    <div class="flex items-center gap-3">
      <span class="text-[11px] text-muted w-12">${labelA}</span>
      <div class="flex-1 h-[8px] bg-border flex">
        <div class="h-full bg-off-white/30 bar-fill" style="width: ${valA}%"></div>
        <div class="h-full bg-off-white/10 bar-fill" style="width: ${valB}%"></div>
      </div>
      <span class="text-[11px] text-muted w-12 text-right">${labelB}</span>
    </div>
    <div class="flex justify-between mt-1">
      <span class="text-[12px] text-off-white">${valA}%</span>
      <span class="text-[12px] text-off-white">${valB}%</span>
    </div>
  `;
}

function renderPatterns(results) {
  const container = document.getElementById('pattern-cards');
  container.innerHTML = '';

  if (!results.patterns || results.patterns.length === 0) {
    document.getElementById('patterns-section').classList.add('hidden');
    return;
  }

  document.getElementById('patterns-section').classList.remove('hidden');
  results.patterns.forEach(insight => {
    const card = document.createElement('div');
    card.className = 'border-l-2 border-border pl-4 py-1';
    card.innerHTML = `<p class="text-[13px] font-serif italic text-off-white/80">${insight}</p>`;
    container.appendChild(card);
  });
}

function renderFatigue(results) {
  const container = document.getElementById('fatigue-cards');
  container.innerHTML = '';

  results.creatives.forEach(c => {
    const f = c.fatigue;
    const card = document.createElement('div');
    card.className = 'border border-border p-6';

    const spreadLabel = f.appealSpread === 'broad' ? 'Broad appeal — will sustain' : f.appealSpread === 'moderate' ? 'Moderate appeal — watch frequency' : 'Narrow appeal — will fatigue fast';
    const spreadWidth = f.appealSpread === 'broad' ? 85 : f.appealSpread === 'moderate' ? 55 : 25;

    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <span class="font-serif text-[18px] italic">${c.label}</span>
        <span class="text-[12px] text-muted">${spreadLabel}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-[11px] text-muted">Narrow</span>
        <div class="flex-1 h-[6px] bg-border"><div class="h-full bg-off-white/40 bar-fill" style="width: ${spreadWidth}%"></div></div>
        <span class="text-[11px] text-muted">Broad</span>
      </div>
      <p class="text-[12px] text-muted mt-3">${f.detail}</p>
    `;
    container.appendChild(card);
  });
}

function renderObjectionMap(results) {
  const container = document.getElementById('objection-bars');
  container.innerHTML = '';

  // Aggregate objections across all creatives or show per-creative
  const objections = results.objections || [];
  if (objections.length === 0) {
    document.getElementById('objection-section').classList.add('hidden');
    return;
  }

  document.getElementById('objection-section').classList.remove('hidden');
  const maxFreq = Math.max(...objections.map(o => o.frequency));

  objections.forEach(obj => {
    const barWidth = (obj.frequency / maxFreq) * 100;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-4';
    row.innerHTML = `
      <span class="text-[12px] text-off-white/80 w-[200px] flex-shrink-0 md:w-[280px]">${obj.objection}</span>
      <div class="flex-1 h-[8px] bg-border"><div class="h-full bg-off-white/30 bar-fill" style="width: ${barWidth}%"></div></div>
      <span class="text-[12px] text-muted w-10 text-right flex-shrink-0">${obj.frequency}%</span>
    `;
    container.appendChild(row);
  });
}

function renderRefinementNotes(results) {
  const section = document.getElementById('refinement-section');
  const container = document.getElementById('refinement-cards');

  const refinements = results.creatives.filter(c => c.recommendation.verdict === 'Refine' && c.refinementNotes);
  if (refinements.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = '';

  refinements.forEach(c => {
    const card = document.createElement('div');
    card.className = 'border border-border p-6';
    card.innerHTML = `
      <span class="font-serif text-[18px] italic block mb-4">${c.label}</span>
      <div class="space-y-3">
        ${c.refinementNotes.map(note => `
          <div class="flex items-start gap-3">
            <span class="text-[11px] uppercase tracking-[0.15em] text-muted w-16 flex-shrink-0 pt-0.5">${note.area}</span>
            <p class="text-[13px] text-off-white/80">${note.suggestion}</p>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderPersonaCards(results) {
  const container = document.getElementById('persona-cards-container');
  container.innerHTML = '';
  visiblePersonaCount = VISIBLE_PERSONAS_DEFAULT;

  // Multi-creative selector
  const selectorContainer = document.getElementById('persona-creative-selector');
  if (results.creatives.length > 1) {
    selectorContainer.classList.remove('hidden');
    selectorContainer.innerHTML = '';
    results.creatives.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = `persona-creative-btn text-[11px] uppercase tracking-[0.15em] px-3 py-1.5 border transition-colors ${i === 0 ? 'border-off-white text-off-white bg-off-white/10' : 'border-border text-muted hover:border-border-focus'}`;
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        currentCreativeFilter = i;
        document.querySelectorAll('.persona-creative-btn').forEach(b => {
          b.classList.remove('border-off-white', 'text-off-white', 'bg-off-white/10');
          b.classList.add('border-border', 'text-muted');
        });
        btn.classList.add('border-off-white', 'text-off-white', 'bg-off-white/10');
        btn.classList.remove('border-border', 'text-muted');
        renderFilteredPersonas(results);
      });
      selectorContainer.appendChild(btn);
    });
  } else {
    selectorContainer.classList.add('hidden');
  }

  renderFilteredPersonas(results);
}

function renderFilteredPersonas(results) {
  const container = document.getElementById('persona-cards-container');
  container.innerHTML = '';

  const creative = results.creatives[currentCreativeFilter];
  let personas = creative.personaResults || [];

  if (currentTierFilter !== 'all') {
    personas = personas.filter(p => p.tier === currentTierFilter);
  }

  const toShow = personas.slice(0, visiblePersonaCount);
  const hasMore = personas.length > visiblePersonaCount;

  toShow.forEach((p, i) => {
    const card = buildPersonaCard(p, i);
    container.appendChild(card);
  });

  const showMoreBtn = document.getElementById('btn-show-more-personas');
  if (hasMore) {
    showMoreBtn.classList.remove('hidden');
    showMoreBtn.textContent = `Show More (${personas.length - visiblePersonaCount} remaining)`;
  } else {
    showMoreBtn.classList.add('hidden');
  }
}

function buildPersonaCard(persona, index) {
  const card = document.createElement('div');
  card.className = 'border border-border hover:border-border-focus transition-colors cursor-pointer';
  card.style.animation = `fadeUp 0.3s ease ${index * 30}ms forwards`;
  card.style.opacity = '0';

  const initials = persona.name.split(' ').map(n => n[0]).join('');
  const tierLabel = persona.tier.charAt(0).toUpperCase() + persona.tier.slice(1);
  const actionIcon = getActionIcon(persona.action);

  // Collapsed state
  const header = document.createElement('div');
  header.className = 'p-4 flex items-center gap-4';
  header.innerHTML = `
    <div class="w-10 h-10 flex items-center justify-center text-[12px] text-muted border border-border flex-shrink-0">${initials}</div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="text-[13px] text-off-white">${persona.name}</span>
        <span class="text-[11px] text-muted">${persona.age}, ${persona.gender}</span>
        <span class="text-[10px] uppercase tracking-[0.15em] text-muted border border-border px-1.5 py-0.5">${tierLabel}</span>
      </div>
      <span class="text-[11px] text-muted">${persona.occupation} — ${persona.location}</span>
    </div>
    <div class="flex items-center gap-4 flex-shrink-0">
      <span class="text-[11px] text-muted">${actionIcon} ${persona.action}</span>
      <span class="text-[18px] font-serif">${persona.overallScore}</span>
    </div>
  `;

  // Expanded state
  const details = document.createElement('div');
  details.className = 'hidden border-t border-border p-4';
  details.innerHTML = `
    <div class="grid grid-cols-3 gap-4 mb-4">
      <div>
        <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-1">Hook</span>
        <span class="text-[15px]">${persona.stopped ? 'Stopped' : 'Scrolled past'}</span>
      </div>
      <div>
        <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-1">Hold</span>
        <span class="text-[15px]">${persona.keptWatching ? 'Watched' : 'Dropped off'}</span>
      </div>
      <div>
        <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-1">Action</span>
        <span class="text-[15px]">${persona.action}</span>
      </div>
    </div>
    <div class="mb-4">
      <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-2">First Impression</span>
      <p class="font-serif italic text-[14px] text-off-white/80">"${persona.firstImpression}"</p>
    </div>
    <div class="mb-4">
      <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-2">Reasoning</span>
      <p class="text-[13px] text-off-white/70">${persona.reasoning}</p>
    </div>
    <div class="border-l-2 border-off-white/20 pl-4">
      <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-1">Primary Objection</span>
      <p class="text-[13px] text-off-white/80">${persona.primaryObjection}</p>
    </div>
    ${persona.wouldMakeThemClick ? `
      <div class="mt-4">
        <span class="text-[11px] uppercase tracking-[0.15em] text-muted block mb-1">What Would Make Them Click</span>
        <p class="text-[13px] text-off-white/70">${persona.wouldMakeThemClick}</p>
      </div>
    ` : ''}
    <div class="mt-4 text-[11px] text-muted">
      <span>${persona.income}</span> · <span>${persona.education}</span> · <span class="italic">${persona.backstory}</span>
    </div>
  `;

  header.addEventListener('click', () => {
    details.classList.toggle('hidden');
  });

  card.appendChild(header);
  card.appendChild(details);
  return card;
}

function getActionIcon(action) {
  switch (action) {
    case 'Clicked': return '&#8599;';
    case 'Scrolled past': return '&#8595;';
    case 'Saved': return '&#9733;';
    case 'Shared': return '&#8618;';
    case 'Screenshot': return '&#9744;';
    default: return '';
  }
}

function getVerdictClass(verdict) {
  switch (verdict) {
    case 'Launch': return 'verdict-launch';
    case 'Launch with note': return 'verdict-launch-note';
    case 'Refine': return 'verdict-refine';
    case 'Drop': return 'verdict-drop';
    default: return '';
  }
}

// ─── Tier Filter ───

function initTierFilters() {
  document.querySelectorAll('.tier-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTierFilter = btn.dataset.tier;
      visiblePersonaCount = VISIBLE_PERSONAS_DEFAULT;

      document.querySelectorAll('.tier-filter').forEach(b => {
        b.classList.remove('border-off-white', 'text-off-white', 'bg-off-white/10');
        b.classList.add('border-border', 'text-muted');
      });
      btn.classList.add('border-off-white', 'text-off-white', 'bg-off-white/10');
      btn.classList.remove('border-border', 'text-muted');

      if (testResults) renderFilteredPersonas(testResults);
    });
  });
}

// ─── API Calls ───

async function runTest(formData) {
  if (USE_MOCK) return getMockResults(formData);

  // Step 1: Generate personas (or use cached)
  const cachedBrands = JSON.parse(localStorage.getItem('ad-tester-brands') || '{}');
  const brandKey = formData.brandContext.product.substring(0, 40).toLowerCase().replace(/[^a-z0-9]/g, '-');
  let personas;

  if (cachedBrands[brandKey] && cachedBrands[brandKey].personas) {
    personas = cachedBrands[brandKey].personas;
    updateLoadingProgress('Using cached personas', 200, 200);
  } else {
    updateLoadingProgress('Generating 200 personas...', 0, 200);
    const personaRes = await fetch(`${API_BASE}/api/generate-personas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_context: formData.brandContext,
      }),
    });

    if (!personaRes.ok) throw new Error('Failed to generate personas');
    const personaData = await personaRes.json();
    personas = personaData.personas;
    cacheBrand(formData.brandContext, personas);
  }

  // Step 2: Test creatives against personas
  updateLoadingProgress('Testing creatives against personas...', 0, formData.creatives.length * personas.length);
  const testRes = await fetch(`${API_BASE}/api/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personas: personas,
      creatives: formData.creatives,
      brand_context: formData.brandContext,
    }),
  });

  if (!testRes.ok) throw new Error('Failed to run test');
  return testRes.json();
}

// ─── Main Flow ───

async function handleRunTest() {
  const formData = collectFormData();
  const error = validateForm(formData);

  if (error) {
    const status = document.getElementById('test-status');
    status.textContent = error;
    status.classList.remove('hidden');
    return;
  }

  document.getElementById('test-status').classList.add('hidden');
  showLoading();

  try {
    // Simulate loading animation
    if (USE_MOCK) {
      const mockPersonas = getMockPersonaNames();
      for (let i = 0; i < Math.min(mockPersonas.length, 16); i++) {
        await sleep(80);
        addLoadingPersonaCard(mockPersonas[i], 0);
        updateLoadingProgress('Generating personas...', (i + 1) * 12, 200);
      }
      await sleep(400);
      updateLoadingProgress('Testing creatives...', 120, 200);
      await sleep(600);
      updateLoadingProgress('Analysing patterns...', 180, 200);
      await sleep(400);
      updateLoadingProgress('Generating recommendations...', 200, 200);
      await sleep(300);
    }

    const results = await runTest(formData);
    hideLoading();
    showResults(results);
  } catch (err) {
    hideLoading();
    const status = document.getElementById('test-status');
    status.textContent = `Error: ${err.message}`;
    status.classList.remove('hidden');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Demo Loader ───

function loadDemo() {
  // Clear existing creatives beyond the first
  while (getCreativeCount() > 1) {
    removeCreativeCard(getCreativeCount() - 1);
  }

  // Fill brand context
  document.getElementById('input-product').value = 'Premium body composition supplement. Helps maintain muscle during fat loss. $89 for 30-day supply. Subscription model. Targets health-conscious adults who exercise regularly and want to optimise body composition, not just lose weight.';
  document.getElementById('input-audience').value = '25-55, active adults, gym-goers, health-conscious';
  document.getElementById('input-price').value = '$89/month';
  document.getElementById('input-market').value = 'us';

  // Fill Creative A — muscle-focused angle
  const cardA = document.querySelector('.creative-card[data-index="0"]');
  cardA.querySelector('input[name="headline"]').value = 'Your muscles are disappearing. And you don\'t even know it.';
  cardA.querySelector('textarea[name="body"]').value = 'Every year after 30, you lose 3-5% of your muscle mass. Dieting makes it worse. Most "weight loss" is actually muscle loss disguised as progress on the scale. Your body is cannibalising its own engine. This supplement preserves lean muscle while your body burns fat — so the weight you lose stays lost.';
  cardA.querySelector('input[name="cta"]').value = 'Protect Your Muscle';

  // Add Creative B — frustrated dieter angle
  addCreativeCard();
  const cardB = document.querySelectorAll('.creative-card')[1];
  cardB.querySelector('input[name="headline"]').value = 'You\'re doing everything right. So why doesn\'t your body show it?';
  cardB.querySelector('textarea[name="body"]').value = 'You eat well. You watch the scale. You do the work. But the mirror tells a different story. The number goes down but nothing changes. Here\'s what nobody told you: most diets burn muscle, not fat. You\'re shrinking, not transforming. This changes that. Preserve what matters. Lose what doesn\'t.';
  cardB.querySelector('input[name="cta"]').value = 'See How It Works';

  // Scroll to submit
  document.getElementById('btn-run-test').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Event Listeners ───

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-add-creative').addEventListener('click', addCreativeCard);
  document.getElementById('btn-run-test').addEventListener('click', handleRunTest);
  document.getElementById('btn-load-demo').addEventListener('click', loadDemo);
  document.getElementById('btn-show-more-personas').addEventListener('click', () => {
    visiblePersonaCount += 20;
    if (testResults) renderFilteredPersonas(testResults);
  });

  initBrandToggle();
  initTierFilters();
  bindRemoveButtons();
  initAllMediaUploads();
});

// ─── Mock Data ───

function getMockPersonaNames() {
  return [
    { name: 'Sarah Chen', age: 28, location: 'Austin, TX' },
    { name: 'Marcus Williams', age: 42, location: 'Chicago, IL' },
    { name: 'Emma Rodriguez', age: 35, location: 'Miami, FL' },
    { name: 'James O\'Brien', age: 51, location: 'Boston, MA' },
    { name: 'Priya Patel', age: 24, location: 'San Francisco, CA' },
    { name: 'David Kim', age: 38, location: 'Seattle, WA' },
    { name: 'Lisa Thompson', age: 46, location: 'Denver, CO' },
    { name: 'Omar Hassan', age: 31, location: 'New York, NY' },
    { name: 'Rachel Green', age: 29, location: 'Portland, OR' },
    { name: 'Michael Torres', age: 55, location: 'Phoenix, AZ' },
    { name: 'Aisha Johnson', age: 33, location: 'Atlanta, GA' },
    { name: 'Kevin Zhao', age: 27, location: 'Los Angeles, CA' },
    { name: 'Diane Foster', age: 48, location: 'Nashville, TN' },
    { name: 'Carlos Mendez', age: 36, location: 'Houston, TX' },
    { name: 'Nina Volkov', age: 22, location: 'Brooklyn, NY' },
    { name: 'Robert Singh', age: 44, location: 'Dallas, TX' },
  ];
}

function getMockResults(formData) {
  const creativeLabels = formData.creatives.map(c => c.label);
  const isMulti = creativeLabels.length > 1;

  const tiers = ['bullseye', 'adjacent', 'skeptic', 'wildcard'];
  const tierCounts = { bullseye: 60, adjacent: 60, skeptic: 40, wildcard: 40 };
  const actions = ['Clicked', 'Scrolled past', 'Saved', 'Shared', 'Screenshot'];

  function randomPersonas(creativeIndex) {
    const personas = [];
    const names = [
      'Sarah Chen', 'Marcus Williams', 'Emma Rodriguez', 'James O\'Brien', 'Priya Patel',
      'David Kim', 'Lisa Thompson', 'Omar Hassan', 'Rachel Green', 'Michael Torres',
      'Aisha Johnson', 'Kevin Zhao', 'Diane Foster', 'Carlos Mendez', 'Nina Volkov',
      'Robert Singh', 'Michelle Park', 'Anthony Brown', 'Samira Ali', 'Jake Wilson',
      'Laura Martinez', 'Chris Adams', 'Fatima Nguyen', 'Tyler Reed', 'Hannah Schmidt',
      'Derek Washington', 'Yuki Tanaka', 'Brian Murphy', 'Zara Khan', 'Greg Patterson',
    ];

    const occupations = ['Product Manager', 'Nurse', 'Software Engineer', 'Teacher', 'Marketing Director', 'Freelance Designer', 'Accountant', 'Personal Trainer', 'Sales Executive', 'Stay-at-home Parent', 'Retired', 'Student', 'Small Business Owner', 'HR Manager', 'Lawyer'];
    const locations = ['Austin, TX', 'Chicago, IL', 'Miami, FL', 'Boston, MA', 'San Francisco, CA', 'Seattle, WA', 'Denver, CO', 'New York, NY', 'Portland, OR', 'Phoenix, AZ', 'Atlanta, GA', 'Los Angeles, CA', 'Nashville, TN', 'Houston, TX', 'Brooklyn, NY'];
    const impressions = [
      'This speaks directly to my frustration with my current routine.',
      'Interesting angle but I\'m not sure it applies to me.',
      'Feels like every other ad I see on Instagram.',
      'The headline grabbed me but the body copy lost me.',
      'This is exactly what I\'ve been looking for.',
      'Too aggressive — I don\'t trust brands that use fear.',
      'I\'d want to see reviews before clicking.',
      'The visual style caught my eye more than the copy.',
      'Reminds me of a product I already use and love.',
      'I\'d share this with my partner — we\'ve talked about this.',
    ];

    let idx = 0;
    for (const tier of tiers) {
      const count = tierCounts[tier];
      for (let i = 0; i < count; i++) {
        const nameIdx = idx % names.length;
        const score = tier === 'bullseye' ? 55 + Math.floor(Math.random() * 40) :
                      tier === 'adjacent' ? 40 + Math.floor(Math.random() * 40) :
                      tier === 'skeptic' ? 15 + Math.floor(Math.random() * 35) :
                      25 + Math.floor(Math.random() * 50);

        const stopped = score > 40 || Math.random() > 0.4;
        const keptWatching = stopped && (score > 55 || Math.random() > 0.5);
        const action = score > 70 ? 'Clicked' : score > 55 ? (Math.random() > 0.5 ? 'Saved' : 'Scrolled past') : 'Scrolled past';
        const age = tier === 'wildcard' ? (18 + Math.floor(Math.random() * 47)) : (22 + Math.floor(Math.random() * 35));
        const gender = Math.random() > 0.5 ? 'Male' : 'Female';

        personas.push({
          name: names[nameIdx] + (idx >= names.length ? ` ${Math.floor(idx / names.length) + 1}` : ''),
          age: age,
          gender: gender,
          location: locations[idx % locations.length],
          occupation: occupations[idx % occupations.length],
          income: ['$35,000', '$55,000', '$75,000', '$95,000', '$120,000', '$150,000'][Math.floor(Math.random() * 6)],
          education: ['High school', 'Associate\'s', 'Bachelor\'s', 'Master\'s', 'PhD'][Math.floor(Math.random() * 5)],
          backstory: 'Has tried similar products before with mixed results. Currently looking for something that actually delivers.',
          tier: tier,
          overallScore: score,
          stopped: stopped,
          keptWatching: keptWatching,
          action: action,
          firstImpression: impressions[Math.floor(Math.random() * impressions.length)],
          reasoning: 'The headline creates curiosity but the body copy doesn\'t resolve the tension quickly enough. The CTA feels generic compared to the promise in the hook.',
          primaryObjection: ['Price seems high without proof it works', 'No social proof or reviews visible', 'I\'ve seen similar claims that didn\'t deliver', 'Not sure this is for my specific situation', 'The tone feels too salesy'][Math.floor(Math.random() * 5)],
          wouldMakeThemClick: 'A specific before/after result from someone like me, or a free trial to reduce risk.',
        });
        idx++;
      }
    }
    return personas;
  }

  const creativeResults = formData.creatives.map((c, i) => {
    const personaResults = randomPersonas(i);
    const hookRate = Math.round(personaResults.filter(p => p.stopped).length / personaResults.length * 100);
    const holdRate = Math.round(personaResults.filter(p => p.keptWatching).length / personaResults.length * 100);
    const ctr = (personaResults.filter(p => p.action === 'Clicked').length / personaResults.length * 100).toFixed(1);

    const tierScores = {};
    tiers.forEach(t => {
      const tierPersonas = personaResults.filter(p => p.tier === t);
      tierScores[t] = Math.round(tierPersonas.reduce((sum, p) => sum + p.overallScore, 0) / tierPersonas.length);
    });

    const overallScore = Math.round(personaResults.reduce((sum, p) => sum + p.overallScore, 0) / personaResults.length);
    const verdict = overallScore > 65 ? 'Launch' : overallScore > 50 ? 'Refine' : 'Drop';

    const maleCount = personaResults.filter(p => p.gender === 'Male' && p.stopped).length;
    const femaleCount = personaResults.filter(p => p.gender === 'Female' && p.stopped).length;
    const totalStopped = maleCount + femaleCount || 1;

    return {
      label: c.label,
      headline: c.headline || '(no headline)',
      metrics: {
        hookRate: hookRate,
        holdRate: holdRate,
        ctr: parseFloat(ctr),
        overallScore: overallScore,
      },
      tierScores: tierScores,
      recommendation: {
        verdict: verdict,
        confidence: overallScore > 65 ? 78 : overallScore > 50 ? 62 : 45,
        reasoning: verdict === 'Launch'
          ? 'Strong hook and hold rates across Bullseye and Adjacent tiers. Audience skew is within expected range. Predicted to expand reach in cold prospecting.'
          : verdict === 'Refine'
          ? 'Hook rate is promising but hold drops significantly, suggesting the body copy doesn\'t deliver on the headline\'s promise. CTA underperforms with 50+ personas.'
          : 'Weak across all tiers. The angle doesn\'t resonate with the target audience and generates strong negative reactions from Skeptics. Consider a fundamentally different approach.',
        caveats: verdict === 'Launch' ? 'Skews younger/male — consider a complementary variation for the 40+ female segment.' : null,
      },
      audienceSkew: {
        genderSplit: {
          male: Math.round(maleCount / totalStopped * 100),
          female: Math.round(femaleCount / totalStopped * 100),
        },
        ageBrackets: [
          { range: '18-24', percentage: 15 + Math.floor(Math.random() * 15) },
          { range: '25-34', percentage: 25 + Math.floor(Math.random() * 15) },
          { range: '35-44', percentage: 15 + Math.floor(Math.random() * 15) },
          { range: '45-54', percentage: 8 + Math.floor(Math.random() * 10) },
          { range: '55-64', percentage: 5 + Math.floor(Math.random() * 8) },
        ],
        mismatchFlag: i === 0 ? 'Skews 62% male and 25-34 — this may not match your stated target of broad 25-40 audience.' : null,
      },
      fatigue: {
        appealSpread: overallScore > 65 ? 'broad' : overallScore > 50 ? 'moderate' : 'narrow',
        detail: overallScore > 65
          ? 'Positive responses distributed across 3+ tiers and demographic segments. Expect sustained delivery without rapid frequency increases.'
          : overallScore > 50
          ? 'Concentrated response in Bullseye tier with some Adjacent pickup. Will sustain for 2-3 weeks before frequency rises. Plan a refresh.'
          : 'Response concentrated in a single demographic band. Will fatigue within 1-2 weeks. Consider broadening the angle or testing with a different audience.',
      },
      refinementNotes: verdict === 'Refine' ? [
        { area: 'Hook', suggestion: 'Hook is strong — keep the headline as-is. The problem is downstream.' },
        { area: 'Body', suggestion: 'Body copy loses momentum after the first sentence. Get to the value proposition faster. Cut the setup.' },
        { area: 'CTA', suggestion: '"Shop Now" reads too aggressive for skeptical personas. Test "See How It Works" or "Learn More" to reduce commitment friction.' },
      ] : null,
      personaResults: personaResults,
    };
  });

  const result = {
    creatives: creativeResults,
    patterns: [
      `Creative ${creativeLabels[0]} scores 40% higher with under-30 males — this may unlock a buyer persona the account hasn't reached before.`,
      `72% of female personas over 40 flagged pricing as their primary objection — consider a value-justification angle for this segment.`,
      isMulti ? `Creative ${creativeLabels[0]} polarises sharply: loved by Bullseye, rejected by Skeptics. Strong for cold prospecting, weak for retargeting.` : null,
      'Animated/stylised creative formats consistently skew younger and more male than the account baseline — track demographic reports closely.',
    ].filter(Boolean),
    objections: [
      { objection: 'Price seems high without proof it works', frequency: 67 },
      { objection: 'No social proof or reviews visible in the ad', frequency: 54 },
      { objection: 'I\'ve seen similar claims that didn\'t deliver', frequency: 41 },
      { objection: 'Not sure this is for my specific situation', frequency: 38 },
      { objection: 'The tone feels too salesy / aggressive', frequency: 29 },
      { objection: 'CTA doesn\'t tell me what happens next', frequency: 22 },
    ],
    cannibalisation: isMulti ? [
      {
        creatives: [`Creative ${creativeLabels[0]}`, `Creative ${creativeLabels[1]}`],
        overlap: 68,
        detail: 'Both creatives index highest with 25-34 males in the Bullseye tier. Running both in the same ad set will result in audience overlap and inflated frequency.',
        recommendation: 'Separate into different ad sets, or pick the stronger performer and test Creative ' + creativeLabels[1] + ' against a different angle.',
      }
    ] : [],
  };

  return result;
}
