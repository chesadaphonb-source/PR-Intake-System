// ==========================================
// ⚙️ ค่าที่ต้องตั้งก่อนใช้งานจริง
// ==========================================
// 1) CLIENT_ID: สร้างจาก Google Cloud Console > APIs & Services > Credentials
//    > Create Credentials > OAuth Client ID > Web application
//    ใส่ Authorized JavaScript origins เป็น URL ของหน้าเว็บนี้ (เช่น https://xxxx.github.io)
const CLIENT_ID = '718318914992-teacpoi09b7ndb4ll22v0rtguoevs55h.apps.googleusercontent.com';

// 2) API_URL: URL ของ Web App ที่ deploy จาก Code.gs (อัปเดตทุกครั้งที่ deploy ใหม่)
const API_URL = 'https://script.google.com/macros/s/AKfycbw_a56KSdipmhLD0wb6uAlGwupek4cBnv1f6zIiFWIde0PCRiTjWL8TDV_R6bDXPUACIg/exec';

const ALLOWED_DOMAIN = 'ku.th';
// scope: drive.file (อัปโหลด/จัดการเฉพาะไฟล์ที่แอปนี้สร้าง) + userinfo.email (เอาไว้ตรวจโดเมน)
const OAUTH_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

let tokenClient = null;
let accessToken = null;
let currentUserEmail = null;
let isEditorUser = false;
// รายการ SDGs แบบเต็ม จัดกลุ่มตาม 4 มิติ ตามเอกสารที่ใช้จริง
const SDGS_GROUPS = [
  {
    group: 'มิติด้านสังคม (People) และการศึกษา',
    items: [
      'SDG1: ขจัดความยากจนในทุกรูปแบบ ทุกที่',
      'SDG2: ขจัดความหิวโหย บรรลุความมั่นคงทางอาหาร ส่งเสริมเกษตรกรรมที่ยั่งยืน',
      'SDG3: สร้างหลักประกันการมีสุขภาวะที่ดี และส่งเสริมความเป็นอยู่ที่ดีสำหรับทุกคน',
      'SDG4: สร้างหลักประกันการศึกษาที่เท่าเทียมและครอบคลุม ส่งเสริมโอกาสการเรียนรู้ตลอดชีวิต',
      'SDG5: บรรลุความเท่าเทียมทางเพศ เสริมสร้างศักยภาพของสตรีและเด็กหญิง'
    ]
  },
  {
    group: 'มิติด้านสิ่งแวดล้อม (Planet) และทรัพยากร',
    items: [
      'SDG6: สร้างหลักประกันเรื่องน้ำและการสุขาภิบาลให้มีการจัดการอย่างยั่งยืน',
      'SDG12: สร้างรูปแบบการผลิตและการบริโภคที่ยั่งยืน',
      'SDG13: ปฏิบัติการอย่างเร่งด่วนเพื่อรับมือกับการเปลี่ยนแปลงสภาพภูมิอากาศ',
      'SDG14: อนุรักษ์และใช้ประโยชน์จากมหาสมุทร ทะเล และทรัพยากรทางทะเลอย่างยั่งยืน',
      'SDG15: ปกป้อง ฟื้นฟู และส่งเสริมการใช้ประโยชน์จากระบบนิเวศบนบกอย่างยั่งยืน'
    ]
  },
  {
    group: 'มิติด้านเศรษฐกิจ (Prosperity) และโครงสร้างพื้นฐาน',
    items: [
      'SDG7: สร้างหลักประกันให้ทุกคนเข้าถึงพลังงานที่ยั่งยืนในราคาที่เหมาะสม',
      'SDG8: ส่งเสริมการเติบโตทางเศรษฐกิจที่ต่อเนื่อง ครอบคลุม และยั่งยืน',
      'SDG9: พัฒนาโครงสร้างพื้นฐานที่พร้อมรับการเปลี่ยนแปลง ส่งเสริมอุตสาหกรรมที่ยั่งยืน',
      'SDG10: ลดความไม่เสมอภาคทั้งภายในและระหว่างประเทศ',
      'SDG11: ทำให้เมืองและการตั้งถิ่นฐานของมนุษย์มีความปลอดภัย ทั่วถึง และยั่งยืน'
    ]
  },
  {
    group: 'มิติด้านสันติภาพ (Peace) และหุ้นส่วนการพัฒนา (Partnerships)',
    items: [
      'SDG16: ส่งเสริมสังคมที่สงบสุข ยุติธรรม และครอบคลุม',
      'SDG17: เสริมความเข้มแข็งให้แก่กลไกการดำเนินงานและฟื้นฟูหุ้นส่วนความร่วมมือระดับโลก'
    ]
  },
  {
    group: 'อื่นๆ',
    items: ['ไม่เข้าข่าย SDGs ใดๆ']
  }
];
let sdgsList = SDGS_GROUPS.flatMap(g => g.items); // รายการแบบ flat ไว้ใช้กับแดชบอร์ด/แก้ไข/บันทึกข้อมูล
let allItemsCache = [];
let selectedFiles = [];
let fullCalendarInstance = null;

// ==========================================
// 🔐 1. Google Sign-In (จำกัดเฉพาะโดเมน ku.th)
// ==========================================
window.addEventListener('load', () => {
  // รอให้ google identity services โหลดเสร็จก่อนค่อย init
  const waitForGis = setInterval(() => {
    if (window.google && google.accounts && google.accounts.oauth2) {
      clearInterval(waitForGis);
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: OAUTH_SCOPES,
        callback: handleTokenResponse
      });
    }
  }, 200);

  document.getElementById('btn-login').addEventListener('click', () => {
    if (!tokenClient) {
      showLoginError('ระบบยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่');
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
});

async function handleTokenResponse(resp) {
  if (resp.error) {
    showLoginError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    return;
  }
  accessToken = resp.access_token;

  // ตรวจอีเมล + โดเมนจาก Google โดยตรง (ฝั่ง client)
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const info = await res.json();
    const email = info.email || '';

    if (!email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN)) {
      showLoginError('กรุณาเข้าสู่ระบบด้วยอีเมล @' + ALLOWED_DOMAIN + ' เท่านั้น (บัญชีที่เลือกคือ ' + email + ')');
      accessToken = null;
      return;
    }

    currentUserEmail = email;
    await afterLoginSuccess();
  } catch (err) {
    console.error(err);
    showLoginError('ไม่สามารถตรวจสอบบัญชีได้ กรุณาลองใหม่อีกครั้ง');
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function afterLoginSuccess() {
  document.getElementById('login-gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-email').textContent = currentUserEmail;

  renderSdgsChecklist(); // แสดงรายการ SDGs ทันที ไม่ต้องรอ backend เพราะเป็นข้อมูลคงที่
  switchTab('form');
  fetchConfig(); // ยิงแยกไว้เบื้องหลัง เอาไว้เช็คสิทธิ์ผู้ดูแล (is_editor) เท่านั้น
}

function logout() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  currentUserEmail = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-gate').classList.remove('hidden');
  document.getElementById('login-error').classList.add('hidden');
}

// ==========================================
// 🌐 2. เรียก backend (GAS) — ใช้ JSONP แทน fetch() ทั้งหมด
// เหตุผล: fetch() ข้ามโดเมนไปหา Apps Script เจอบั๊ก CORS ของ Google เอง (302 redirect ที่
// script.google.com ไม่แนบ CORS header) ทำให้ fetch ล้มเหลวเสมอ ไม่ว่าจะตั้งค่า deployment
// ถูกแค่ไหนก็ตาม การโหลดผ่าน <script> tag (JSONP) ไม่ถูกจำกัดด้วย CORS เลย จึงใช้ทางนี้แทน
// ==========================================
function jsonp(url, retriesLeft) {
  retriesLeft = retriesLeft === undefined ? 2 : retriesLeft;
  return new Promise((resolve, reject) => {
    const cbName = 'jsonp_cb_' + Math.random().toString(36).slice(2) + Date.now();
    const script = document.createElement('script');

    const cleanup = () => {
      delete window[cbName];
      script.remove();
    };

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      console.log('[debug] jsonp script.onerror fired for URL (first 120 chars):', script.src.slice(0, 120));
      cleanup();
      if (retriesLeft > 0) {
        // ลองใหม่อัตโนมัติ เผื่อเป็นปัญหาเครือข่าย/quota ชั่วคราว
        setTimeout(() => {
          jsonp(url, retriesLeft - 1).then(resolve).catch(reject);
        }, 800);
      } else {
        reject(new Error('เชื่อมต่อกับระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
      }
    };

    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    document.body.appendChild(script);
  });
}

async function fetchConfig() {
  try {
    console.log('[debug] fetchConfig — accessToken present:', !!accessToken, 'length:', accessToken ? accessToken.length : 0);
    const data = await jsonp(API_URL + '?type=config&tok=' + encodeURIComponent(accessToken));
    if (data.status === 'success') {
      isEditorUser = !!data.is_editor;
    } else {
      console.log('[debug] fetchConfig backend responded with error:', data.message);
      console.log('[debug] backend received these param keys:', data.debug_received_params, '| token present:', data.debug_token_present, '| token length:', data.debug_token_length);
    }
  } catch (err) {
    console.error('fetchConfig error', err);
  }
}

async function fetchItems() {
  try {
    console.log('[debug] fetchItems — accessToken present:', !!accessToken, 'length:', accessToken ? accessToken.length : 0);
    const data = await jsonp(API_URL + '?tok=' + encodeURIComponent(accessToken));
    if (data.status === 'success') {
      isEditorUser = !!data.is_editor;
      return data.items || [];
    }
    console.log('[debug] fetchItems backend responded with error:', data.message);
    console.log('[debug] backend received these param keys:', data.debug_received_params, '| token present:', data.debug_token_present, '| token length:', data.debug_token_length);
    return [];
  } catch (err) {
    console.error('fetchItems error', err);
    return [];
  }
}

async function postAction(payload) {
  payload.access_token = accessToken;
  const url = API_URL + '?action=' + encodeURIComponent(payload.action) + '&payload=' + encodeURIComponent(JSON.stringify(payload));
  return jsonp(url);
}

// ==========================================
// 📎 3. อัปโหลดไฟล์ตรงขึ้น Google Drive (ไม่ผ่าน backend เพื่อรองรับไฟล์ใหญ่/วิดีโอ)
//    จัดเก็บเป็นโครงสร้าง: <โฟลเดอร์ระบบ>/<ชื่อผู้แจ้ง>/<วันที่แจ้ง>/<รูป หรือ วิดิโอ>/ไฟล์จริง
// ==========================================
const DRIVE_ROOT_FOLDER_NAME = 'ระบบประชาสัมพันธ์ - ไฟล์แนบ';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
let folderIdCache = {}; // cache กัน query ซ้ำๆ ระหว่างไฟล์หลายไฟล์ในการส่งเดียวกัน

// หา folder ตามชื่อภายใต้ parent ที่กำหนด ถ้าไม่มีให้สร้างใหม่ (คืนค่า folder id)
async function findOrCreateFolder(name, parentId) {
  const cacheKey = (parentId || 'root') + '::' + name;
  if (folderIdCache[cacheKey]) return folderIdCache[cacheKey];

  let query = `name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  query += parentId ? ` and '${parentId}' in parents` : ` and 'root' in parents`;

  const searchRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) + '&fields=files(id,name)',
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const searchData = await searchRes.json();

  let folderId;
  if (searchData.files && searchData.files.length) {
    folderId = searchData.files[0].id;
  } else {
    const metadata = { name, mimeType: FOLDER_MIME };
    if (parentId) metadata.parents = [parentId];
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });
    const created = await createRes.json();
    folderId = created.id;
  }

  folderIdCache[cacheKey] = folderId;
  return folderId;
}

// สร้าง/หาโฟลเดอร์ปลายทางสำหรับไฟล์หนึ่งไฟล์ ตามชื่อผู้แจ้ง + วันที่แจ้ง + ประเภทไฟล์
async function getDestinationFolderId(reporterName, reportDateStr, isVideo) {
  const rootId = await findOrCreateFolder(DRIVE_ROOT_FOLDER_NAME, null);
  const reporterId = await findOrCreateFolder((reporterName || 'ไม่ระบุชื่อ').trim(), rootId);
  const dateId = await findOrCreateFolder(reportDateStr, reporterId);
  const typeId = await findOrCreateFolder(isVideo ? 'วิดิโอ' : 'รูป', dateId);
  return typeId;
}

async function uploadFileToDrive(file, folderId, onProgress) {
  const metadata = { name: file.name, parents: folderId ? [folderId] : undefined };

  // 1) เริ่ม session แบบ resumable (สำคัญมากสำหรับไฟล์ใหญ่ เช่น วิดีโอ 1 ชั่วโมง)
  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.type || 'application/octet-stream',
      'X-Upload-Content-Length': String(file.size)
    },
    body: JSON.stringify(metadata)
  });
  if (!initRes.ok) throw new Error('เริ่มอัปโหลดไฟล์ไม่สำเร็จ: ' + file.name);
  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('ไม่พบช่องทางอัปโหลดไฟล์: ' + file.name);

  // 2) ส่งไฟล์เป็นก้อนๆ (chunk ละ 8MB) แทนการส่งทีเดียวทั้งไฟล์
  //    - ไม่ต้องแปลง base64 ทั้งไฟล์ (ลดการใช้หน่วยความจำเบราว์เซอร์ลงมาก)
  //    - ถ้าก้อนไหนล้มเหลว ลอง retry เฉพาะก้อนนั้นได้ ไม่ต้องเริ่มใหม่ทั้งไฟล์
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
  let start = 0;
  let uploadedFileId = null;
  let uploadedWebViewLink = null;

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    let res;
    let attempt = 0;
    while (true) {
      try {
        res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` },
          body: chunk
        });
        break;
      } catch (err) {
        attempt++;
        if (attempt >= 3) throw new Error('อัปโหลดไฟล์ล้มเหลว (เครือข่ายขัดข้อง): ' + file.name);
        await new Promise(r => setTimeout(r, 1000 * attempt)); // รอแล้วลองใหม่ กันเน็ตสะดุดชั่วคราว
      }
    }

    if (res.status === 200 || res.status === 201) {
      const result = await res.json();
      uploadedFileId = result.id;
      uploadedWebViewLink = result.webViewLink;
      if (onProgress) onProgress(1);
      break;
    } else if (res.status === 308) {
      // ยังอัปโหลดไม่ครบ ไปต่อก้อนถัดไป
      start = end;
      if (onProgress) onProgress(start / file.size);
    } else {
      throw new Error('อัปโหลดไฟล์ไม่สำเร็จ: ' + file.name + ' (รหัสสถานะ ' + res.status + ')');
    }
  }

  if (!uploadedFileId) throw new Error('อัปโหลดไฟล์ไม่สำเร็จ: ' + file.name);

  // เปิดสิทธิ์ให้ดูผ่านลิงก์ได้ (จำเป็นเพื่อให้เจ้าหน้าที่คนอื่นดูไฟล์แนบผ่านระบบได้)
  await fetch('https://www.googleapis.com/drive/v3/files/' + uploadedFileId + '/permissions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });

  return uploadedWebViewLink || ('https://drive.google.com/file/d/' + uploadedFileId + '/view');
}

// ==========================================
// 📝 4. ฟอร์ม + SDGs checklist
// ==========================================
function renderSdgsChecklist(selected) {
  selected = selected || [];
  const container = document.getElementById('sdgs-checklist');
  if (!container) return;
  container.innerHTML = SDGS_GROUPS.map(g => `
    <div class="col-span-full">
      <p class="text-xs font-bold text-blue-600 mt-2 mb-1">${g.group}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${g.items.map(s => `
          <label class="sdgs-chip">
            <input type="checkbox" value="${escapeAttr(s)}" ${selected.includes(s) ? 'checked' : ''}>
            <span>${s}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  flatpickr('#publish-date', {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'j F Y',
    locale: 'th',
    disableMobile: true
  });

  const filesInput = document.getElementById('pr-files');
  if (filesInput) {
    filesInput.addEventListener('change', (e) => {
      selectedFiles = Array.from(e.target.files || []);
      renderFilePreview();
    });
  }

  const form = document.getElementById('pr-form');
  if (form) form.addEventListener('submit', handleFormSubmit);
});

function renderFilePreview() {
  const el = document.getElementById('file-preview');
  if (!el) return;
  el.innerHTML = selectedFiles.map((f, idx) => `
    <div class="text-xs bg-slate-100 border border-slate-200 text-slate-700 rounded-lg px-2 py-1 flex items-center gap-2">
      <span>${f.type.startsWith('video') ? '🎬' : '🖼️'} ${f.name}</span>
      <button type="button" onclick="removeSelectedFile(${idx})" class="text-slate-500 hover:text-red-400">✕</button>
    </div>
  `).join('');
}
function removeSelectedFile(idx) {
  selectedFiles.splice(idx, 1);
  renderFilePreview();
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const reporterName = document.getElementById('reporter-name').value.trim();
  const publishDate = document.getElementById('publish-date').value;
  const checked = Array.from(document.querySelectorAll('#sdgs-checklist input:checked')).map(i => i.value);

  if (!checked.length) {
    Swal.fire({ icon: 'warning', title: 'กรุณาเลือกหมวดหมู่ SDGs อย่างน้อย 1 ข้อ', confirmButtonColor: '#ea580c' });
    return;
  }

  const progressEl = document.getElementById('upload-progress');
  progressEl.classList.remove('hidden');

  Swal.fire({
    title: 'กำลังส่งข้อมูล...',
    html: 'กำลังอัปโหลดไฟล์แนบ (0/' + selectedFiles.length + ')',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    folderIdCache = {}; // เริ่ม cache ใหม่ทุกครั้งที่ส่งฟอร์ม
    const reportDateStr = formatDateYMD(new Date()); // "วันที่แจ้ง" = วันนี้ ตอนกดส่งฟอร์ม
    const fileLinks = [];
    const fileTypes = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const isVideo = selectedFiles[i].type.startsWith('video');
      const folderId = await getDestinationFolderId(reporterName, reportDateStr, isVideo);
      const link = await uploadFileToDrive(selectedFiles[i], folderId, (fraction) => {
        const pct = Math.round(fraction * 100);
        Swal.update({ html: 'กำลังอัปโหลดไฟล์แนบ (' + (i + 1) + '/' + selectedFiles.length + ') — ' + pct + '%<br><span style="font-size:11px;color:#94a3b8">ไฟล์ขนาดใหญ่ เช่น วิดีโอยาว อาจใช้เวลาหลายนาที กรุณาอย่าปิดหน้านี้</span>' });
      });
      fileLinks.push(link);
      fileTypes.push(isVideo ? 'video' : 'image');
    }

    const result = await postAction({
      action: 'create',
      reporter_name: reporterName,
      publish_date: publishDate,
      sdgs: checked,
      file_links: fileLinks,
      file_types: fileTypes
    });

    if (result.status === 'success') {
      Swal.fire({
        icon: 'success',
        title: 'ส่งข้อมูลประชาสัมพันธ์สำเร็จ!',
        html: 'รหัสอ้างอิง: <b class="text-blue-600">' + result.id + '</b>',
        confirmButtonColor: '#ea580c'
      }).then(() => {
        document.getElementById('pr-form').reset();
        selectedFiles = [];
        renderFilePreview();
        renderSdgsChecklist();
        progressEl.classList.add('hidden');
      });
    } else {
      throw new Error(result.message || 'ไม่ทราบสาเหตุ');
    }
  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message, confirmButtonColor: '#ea580c' });
  }
}

// ==========================================
// 🗂️ 5. Tabs
// ==========================================
function switchTab(tab) {
  ['form', 'calendar', 'dashboard', 'list'].forEach(t => {
    document.getElementById(t + '-section').classList.toggle('hidden', t !== tab);
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });

  if (tab === 'calendar' || tab === 'dashboard' || tab === 'list') {
    fetchItems().then(items => {
      allItemsCache = items;
      if (tab === 'calendar') renderCalendarTab(items);
      if (tab === 'dashboard') renderDashboardTab(items);
      if (tab === 'list') renderListTab(items);
    });
  }
}

// ==========================================
// 📅 6. ปฏิทิน
// ==========================================
function renderCalendarTab(items) {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || typeof FullCalendar === 'undefined') return;

  const events = items
    .filter(t => t.publish_date)
    .map(t => ({
      title: '📰 ' + (t.reporter_name || t.id),
      start: t.publish_date,
      color: getDeadlineColor(t.publish_date),
      extendedProps: { item: t }
    }));

  if (fullCalendarInstance) {
    fullCalendarInstance.removeAllEventSources();
    fullCalendarInstance.addEventSource(events);
    fullCalendarInstance.updateSize();
    return;
  }

  fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'th',
    height: 'auto',
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    events: events,
    eventClick: (info) => showItemDetail(info.event.extendedProps.item)
  });
  fullCalendarInstance.render();
}

function getDeadlineColor(publishDate) {
  const days = daysUntil(publishDate);
  if (days < 0) return '#f43f5e'; // เลยกำหนด
  if (days <= 3) return '#facc15'; // ใกล้ครบกำหนด
  return '#3b82f6'; // รอลง
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

// ==========================================
// 📊 7. แดชบอร์ดภาระงาน
// ==========================================
function renderDashboardTab(items) {
  const total = items.length;
  const pending = items.filter(t => daysUntil(t.publish_date) > 3).length;
  const overdueOrSoon = items.filter(t => daysUntil(t.publish_date) <= 3);

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-overdue').textContent = overdueOrSoon.length;

  const overdueList = document.getElementById('overdue-list');
  const sorted = overdueOrSoon.slice().sort((a, b) => daysUntil(a.publish_date) - daysUntil(b.publish_date));
  overdueList.innerHTML = sorted.length ? sorted.map(t => {
    const d = daysUntil(t.publish_date);
    const badge = d < 0
      ? `<span class="px-2 py-0.5 rounded badge-overdue text-xs font-bold">เลยกำหนด ${Math.abs(d)} วัน</span>`
      : `<span class="px-2 py-0.5 rounded badge-soon text-xs font-bold">อีก ${d} วัน</span>`;
    return `
      <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-400" onclick='showItemDetail(${JSON.stringify(t).replace(/'/g, "&apos;")})'>
        <div>
          <p class="font-semibold">${t.reporter_name || '-'} <span class="text-slate-500 font-mono text-xs">#${t.id}</span></p>
          <p class="text-xs text-slate-500">กำหนดลง: ${formatThaiDate(t.publish_date)}</p>
        </div>
        ${badge}
      </div>`;
  }).join('') : '<p class="text-slate-500 text-sm">ไม่มีข่าวที่ใกล้ครบกำหนดหรือเลยกำหนด 🎉</p>';

  const sdgsCount = {};
  sdgsList.forEach(s => sdgsCount[s] = 0);
  items.forEach(t => (t.sdgs || []).forEach(s => { sdgsCount[s] = (sdgsCount[s] || 0) + 1; }));
  const maxCount = Math.max(1, ...Object.values(sdgsCount));

  const chartEl = document.getElementById('sdgs-chart');
  chartEl.innerHTML = Object.keys(sdgsCount).map(s => {
    const count = sdgsCount[s];
    const pct = Math.round((count / maxCount) * 100);
    return `
      <div>
        <div class="flex justify-between text-xs mb-1"><span>${s}</span><span class="text-slate-500">${count}</span></div>
        <div class="w-full bg-slate-100 rounded-full h-2.5">
          <div class="bg-gradient-to-r from-blue-500 to-blue-700 h-2.5 rounded-full" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ดึง Google Drive File ID จากลิงก์แบบ https://drive.google.com/file/d/FILE_ID/view...
function extractDriveFileId(url) {
  const match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// แสดงไฟล์แนบเป็นรูปตัวอย่าง (thumbnail) แทนลิงก์ข้อความ คลิกแล้วเปิดดูแบบเต็มในแท็บใหม่
// - รูปภาพ: โชว์ thumbnail จริงจาก Drive
// - วิดีโอ: โชว์การ์ดไอคอน 🎬 แทน (ไม่พยายามโหลด thumbnail เพราะ Drive อาจยังประมวลผลวิดีโอไม่เสร็จ ทำให้ขึ้นรูปว่างเปล่า)
//   ลิงก์จะพาไปเปิดที่ Google Drive เสมอ ซึ่งเป็นทางที่เชื่อถือได้ที่สุดในการเล่นวิดีโอ (ถ้า Drive ยังประมวลผลไม่เสร็จ
//   จะขึ้นข้อความ "still being processed" ที่หน้า Drive เอง — เป็นเรื่องปกติของไฟล์ใหญ่/ยาว ต้องรอสักครู่แล้วลองใหม่)
function renderFileThumbnails(fileLinks, fileTypes) {
  if (!fileLinks || !fileLinks.length) return '';
  fileTypes = fileTypes || [];
  return `
    <div class="flex flex-wrap gap-2 mt-2">
      ${fileLinks.map((url, idx) => {
        const isVideo = fileTypes[idx] === 'video';
        const fileId = extractDriveFileId(url);

        if (isVideo) {
          return `
            <a href="${url}" target="_blank" rel="noopener" class="flex flex-col items-center justify-center gap-1 w-24 h-24 rounded-lg border border-slate-200 shadow-sm hover:ring-2 hover:ring-blue-400 transition-all bg-slate-100 text-slate-600" title="วิดีโอที่ ${idx + 1} — เปิดดูใน Google Drive">
              <span class="text-2xl">🎬</span>
              <span class="text-[10px] text-center px-1">เปิดดูใน Drive</span>
            </a>
          `;
        }
        if (fileId) {
          const thumbSrc = `https://lh3.googleusercontent.com/d/${fileId}=w300`;
          return `
            <a href="${url}" target="_blank" rel="noopener" class="block w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 hover:ring-blue-400 transition-all bg-slate-100" title="ไฟล์ที่ ${idx + 1} (คลิกเพื่อดูขนาดเต็ม)">
              <img src="${thumbSrc}" alt="ไฟล์แนบที่ ${idx + 1}" class="w-full h-full object-cover" loading="lazy">
            </a>
          `;
        }
        return `
          <a href="${url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors">
            📎 ไฟล์ที่ ${idx + 1}
          </a>
        `;
      }).join('')}
    </div>
  `;
}

function showItemDetail(t) {
  Swal.fire({
    title: t.reporter_name || t.id,
    html: `
      <div class="text-left text-sm space-y-2">
        <p>🆔 ${t.id}</p>
        <p>👤 ผู้แจ้ง: ${t.reporter_name || '-'} (${t.reporter_email || '-'})</p>
        <p>📅 กำหนดลง: ${formatThaiDate(t.publish_date)}</p>
        <p>🏷️ SDGs: ${(t.sdgs || []).join(', ') || '-'}</p>
        ${(t.file_links || []).length ? `<p>📎 ไฟล์แนบ: ${t.file_links.length} ไฟล์ ${(t.file_types || []).includes('video') ? '<span style="font-size:11px;color:#94a3b8">(วิดีโอที่เพิ่งอัปโหลดใหม่ อาจต้องรอ Drive ประมวลผลสักครู่ก่อนเล่นได้)</span>' : ''}</p>${renderFileThumbnails(t.file_links, t.file_types)}` : ''}
      </div>
    `,
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#ea580c'
  });
}

// ==========================================
// 📂 8. รายการทั้งหมด (แก้ไข/ลบ เฉพาะผู้ดูแล)
// ==========================================
function renderListTab(items) {
  const el = document.getElementById('pr-list');
  if (!items.length) {
    el.innerHTML = '<div class="p-8 text-center text-slate-500">ยังไม่มีข้อมูลในระบบ</div>';
    return;
  }
  el.innerHTML = items.map(t => `
    <div class="p-4 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold">${t.reporter_name || '-'}</span>
          <span class="text-xs font-mono text-slate-500">#${t.id}</span>
        </div>
        <p class="text-sm text-slate-500">📅 ${formatThaiDate(t.publish_date)} · 🏷️ ${(t.sdgs || []).join(', ') || '-'}</p>
        <p class="text-xs text-slate-500">โดย ${t.reporter_email || '-'} · แจ้งเมื่อ ${t.created_at || '-'}</p>
      </div>
      <div class="flex gap-2">
        <button onclick='showItemDetail(${JSON.stringify(t).replace(/'/g, "&apos;")})' class="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200">ดูรายละเอียด</button>
        ${isEditorUser ? `
          <button onclick='openEditModal(${JSON.stringify(t).replace(/'/g, "&apos;")})' class="px-3 py-1.5 bg-blue-600 text-xs rounded-lg hover:bg-blue-700">แก้ไข</button>
          <button onclick="confirmDelete('${t.id}')" class="px-3 py-1.5 bg-red-600 text-xs rounded-lg hover:bg-red-700">ลบ</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function openEditModal(t) {
  const chips = SDGS_GROUPS.map(g => `
    <div class="col-span-full">
      <p class="text-xs font-bold text-blue-600 mt-2 mb-1">${g.group}</p>
      <div class="grid grid-cols-1 gap-2">
        ${g.items.map(s => `
          <label class="sdgs-chip">
            <input type="checkbox" value="${escapeAttr(s)}" ${(t.sdgs || []).includes(s) ? 'checked' : ''}>
            <span>${s}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  Swal.fire({
    title: 'แก้ไขรายการ #' + t.id,
    html: `
      <div class="text-left space-y-3">
        <div>
          <label class="text-xs font-semibold block mb-1">ชื่อผู้แจ้ง</label>
          <input id="edit-name" class="swal2-input" style="margin:0" value="${escapeAttr(t.reporter_name || '')}">
        </div>
        <div>
          <label class="text-xs font-semibold block mb-1">วันที่ต้องการให้ลง</label>
          <input id="edit-date" type="date" class="swal2-input" style="margin:0" value="${t.publish_date || ''}">
        </div>
        <div>
          <label class="text-xs font-semibold block mb-1">SDGs</label>
          <div id="edit-sdgs" class="grid grid-cols-1 gap-1 max-h-72 overflow-y-auto">${chips}</div>
        </div>
      </div>
    `,
    confirmButtonText: 'บันทึกการแก้ไข',
    showCancelButton: true,
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ea580c',
    preConfirm: async () => {
      const name = document.getElementById('edit-name').value.trim();
      const date = document.getElementById('edit-date').value;
      const checked = Array.from(document.querySelectorAll('#edit-sdgs input:checked')).map(i => i.value);
      const result = await postAction({ action: 'update', id: t.id, reporter_name: name, publish_date: date, sdgs: checked });
      if (result.status !== 'success') {
        Swal.showValidationMessage(result.message || 'แก้ไขไม่สำเร็จ');
        return false;
      }
      return true;
    }
  }).then(res => {
    if (res.isConfirmed) {
      Swal.fire({ icon: 'success', title: 'แก้ไขข้อมูลสำเร็จ', confirmButtonColor: '#ea580c' })
        .then(() => switchTab('list'));
    }
  });
}

function confirmDelete(id) {
  Swal.fire({
    title: 'ลบรายการนี้?',
    text: 'รหัส ' + id + ' จะถูกลบออกจากระบบถาวร',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ลบเลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#d33'
  }).then(async (res) => {
    if (!res.isConfirmed) return;
    const result = await postAction({ action: 'delete', id: id });
    if (result.status === 'success') {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#ea580c' }).then(() => switchTab('list'));
    } else {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: result.message, confirmButtonColor: '#ea580c' });
    }
  });
}

// ==========================================
// 🔧 Utils
// ==========================================
function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}
function formatDateYMD(d) {
  const pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
