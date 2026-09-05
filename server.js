const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════ In-Memory Shared Data Store ═══════════
let store = {
  projects: [],
  archives: {},
  activityLog: [],
  users: [],
  workspaceName: '豆豆王西安工作室'
};

// Default users
const DEFAULT_USERS = [
  {id:'u1',name:'知宴',role:'负责人',color:0,password:'1111'},
  {id:'u2',name:'王思怡',role:'主编',color:1,password:'2222'},
  {id:'u3',name:'王副编',role:'副主编',color:2,password:'3333'},
  {id:'u4',name:'赵编剧',role:'编剧',color:3,password:'4444'},
  {id:'u5',name:'陈编剧',role:'编剧',color:4,password:'5555'},
];

// ═══════════ Load from Disk ═══════════
const DATA_FILE = path.join(__dirname, 'data.json');
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    store = { projects: [], archives: {}, activityLog: [], users: DEFAULT_USERS.map(u=>({...u})), workspaceName: '豆豆王西安工作室', ...data };
    console.log('Loaded data from disk:', store.projects.length, 'projects,', Object.keys(store.archives).length, 'archives');
  } else {
    // Init with sample data
    const now = new Date();
    const d = (off) => new Date(now.getFullYear(), now.getMonth(), now.getDate()+off).toISOString().slice(0,10);
    store.users = DEFAULT_USERS.map(u=>({...u}));
    store.projects = [
      {id:'s1',name:'龙凤呈祥',type:'premium',startDate:d(-35),expectedDate:d(-5),actualDate:'',overallStatus:'active',mainPerson:'知宴',chiefEditor:'王思怡',deputyEditor:'王副编',leadWriter:'赵编剧',benchmarks:[{name:'庆余年',achievement:'日活500万'},{name:'赘婿',achievement:'均集播放1.2亿'}],upgrades:[{name:'龙凤呈祥第一季',approach:'强化反派线'}],progress:{outline:{status:2,expectedDate:d(-30),actualDate:d(-30)},epguide:{status:2,expectedDate:d(-20),actualDate:d(-18)},card1:{status:2,expectedDate:d(-10),actualDate:d(-8)},card2:{status:1,expectedDate:d(-3),actualDate:''},fullbook:{status:0,expectedDate:d(10),actualDate:''}},_updatedBy:'知宴',_updatedAt:new Date().toLocaleString()},
      {id:'s2',name:'春风渡',type:'premium',startDate:d(-25),expectedDate:d(20),actualDate:'',overallStatus:'active',mainPerson:'知宴',chiefEditor:'王思怡',deputyEditor:'王副编',leadWriter:'陈编剧',benchmarks:[{name:'东宫',achievement:'豆瓣8.5'}],upgrades:[],progress:{outline:{status:2,expectedDate:d(-20),actualDate:d(-19)},epguide:{status:2,expectedDate:d(-10),actualDate:d(-8)},card1:{status:1,expectedDate:d(5),actualDate:''},card2:{status:0,expectedDate:d(15),actualDate:''},fullbook:{status:0,expectedDate:d(30),actualDate:''}},_updatedBy:'王思怡',_updatedAt:new Date().toLocaleString()},
      {id:'s3',name:'暗恋公式',type:'basic',startDate:d(-15),expectedDate:d(30),actualDate:'',overallStatus:'active',mainPerson:'知宴',chiefEditor:'王思怡',deputyEditor:'王副编',leadWriter:'赵编剧',benchmarks:[],upgrades:[{name:'暗恋公式第一季',approach:'增加支线CP'}],progress:{outline:{status:2,expectedDate:d(-10),actualDate:d(-9)},epguide:{status:1,expectedDate:d(3),actualDate:''},card1:{status:0,expectedDate:d(15),actualDate:''},card2:{status:0,expectedDate:d(22),actualDate:''},fullbook:{status:0,expectedDate:d(35),actualDate:''}},_updatedBy:'赵编剧',_updatedAt:new Date().toLocaleString()},
      {id:'s4',name:'替身娇妻',type:'basic',startDate:d(-45),expectedDate:d(-15),actualDate:d(-15),overallStatus:'done',mainPerson:'知宴',chiefEditor:'王思怡',deputyEditor:'王副编',leadWriter:'陈编剧',benchmarks:[{name:'回家的诱惑',achievement:'收视率3.5%'}],upgrades:[],progress:{outline:{status:2,expectedDate:d(-40),actualDate:d(-38)},epguide:{status:2,expectedDate:d(-30),actualDate:d(-28)},card1:{status:2,expectedDate:d(-25),actualDate:d(-24)},card2:{status:2,expectedDate:d(-20),actualDate:d(-19)},fullbook:{status:2,expectedDate:d(-15),actualDate:d(-15)}},_updatedBy:'王思怡',_updatedAt:new Date().toLocaleString()},
      {id:'s5',name:'重生千金',type:'premium',startDate:d(-20),expectedDate:d(25),actualDate:'',overallStatus:'active',mainPerson:'知宴',chiefEditor:'王思怡',deputyEditor:'王副编',leadWriter:'赵编剧',benchmarks:[{name:'甄嬛传',achievement:'经典宫斗IP'}],upgrades:[],progress:{outline:{status:2,expectedDate:d(-15),actualDate:d(-14)},epguide:{status:3,expectedDate:d(-5),actualDate:d(-3)},card1:{status:0,expectedDate:d(5),actualDate:''},card2:{status:0,expectedDate:d(15),actualDate:''},fullbook:{status:0,expectedDate:d(25),actualDate:''}},_updatedBy:'王思怡',_updatedAt:new Date().toLocaleString()},
    ];
    store.activityLog = [{time:new Date().toLocaleString(),user:{name:'系统',color:0},action:'初始化',project:'',detail:'创建 5 个示例项目'}];
    saveToDisk();
  }
} catch (e) {
  console.warn('Could not load data.json, starting fresh:', e.message);
}

// ═══════════ Save to Disk ═══════════
let saveTimer = null;
function saveToDisk() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
    } catch(e) { console.error('Save to disk failed:', e.message); }
    // 触发 GitHub 自动备份（异步，不阻塞）
    if (BACKUP_TOKEN && BACKUP_REPO) {
      clearTimeout(backupTimer);
      backupTimer = setTimeout(backupToGitHub, 1000);
    }
  }, 2000);
}

// ═══════════ GitHub Auto Backup ═══════════
// 防丢失机制：每次数据变动后异步同步到 GitHub 备份仓库
const BACKUP_TOKEN = process.env.BACKUP_TOKEN || '';
const BACKUP_REPO  = process.env.BACKUP_REPO  || '';   // 格式: owner/repo
const BACKUP_BRANCH = process.env.BACKUP_BRANCH || 'main';
let lastBackupSha = null;
let backupTimer = null;
let backupInProgress = false;
let backupDirty = false;
let backupCount = 0;

async function backupToGitHub() {
  if (!BACKUP_TOKEN || !BACKUP_REPO) return;
  if (backupInProgress) { backupDirty = true; return; }
  backupInProgress = true;
  try {
    const content = JSON.stringify(store, null, 2);
    const contentBase64 = Buffer.from(content).toString('base64');

    // 读取现有 SHA（用于覆盖）
    if (!lastBackupSha) {
      try {
        const getResp = await fetch(
          `https://api.github.com/repos/${BACKUP_REPO}/contents/data.json?ref=${BACKUP_BRANCH}`,
          { headers: { 'Authorization': `Bearer ${BACKUP_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'script-studio-server' } }
        );
        if (getResp.ok) lastBackupSha = (await getResp.json()).sha;
      } catch (e) { /* 文件不存在也正常 */ }
    }

    const putResp = await fetch(
      `https://api.github.com/repos/${BACKUP_REPO}/contents/data.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${BACKUP_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'script-studio-server'
        },
        body: JSON.stringify({
          message: `auto-backup ${new Date().toISOString()} (#${++backupCount})`,
          content: contentBase64,
          branch: BACKUP_BRANCH,
          sha: lastBackupSha || undefined
        })
      }
    );

    if (putResp.ok) {
      const result = await putResp.json();
      lastBackupSha = result.content.sha;
      console.log(`[GitHub备份] ✅ 同步成功 #${backupCount} (${(content.length/1024).toFixed(1)}KB)`);
    } else {
      const errText = await putResp.text();
      // SHA 过期冲突，重置后下次自动重试
      if (putResp.status === 409 || putResp.status === 422) {
        console.warn('[GitHub备份] SHA冲突，下次重试');
        lastBackupSha = null;
      } else {
        console.error('[GitHub备份] 失败:', putResp.status, errText.slice(0, 200));
      }
    }
  } catch (e) {
    console.error('[GitHub备份] 异常:', e.message);
  } finally {
    backupInProgress = false;
    // 如果期间有新数据变动，再来一次
    if (backupDirty) {
      backupDirty = false;
      setTimeout(backupToGitHub, 5000);
    }
  }
}

// ═══════════ SSE Clients ═══════════
const sseClients = new Set();

function broadcast(eventType, data) {
  const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(msg); } catch (e) { sseClients.delete(client); }
  });
}

// ═══════════ Helpers ═══════════
function addLog(action, project, detail) {
  store.activityLog.unshift({
    time: new Date().toLocaleString(),
    user: { name: '系统', color: 0 },
    action, project, detail: detail || ''
  });
  if (store.activityLog.length > 200) store.activityLog = store.activityLog.slice(0, 200);
}

// ═══════════ Middleware ═══════════
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════ API ═══════════

// GET /api/data — fetch all shared data
app.get('/api/data', (req, res) => {
  res.json(store);
});

// POST /api/login — authenticate
app.post('/api/login', (req, res) => {
  const { userId, password, workspaceName } = req.body;
  if (workspaceName) store.workspaceName = workspaceName;
  const user = store.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.password && user.password !== password) return res.status(401).json({ error: '密码错误' });
  if (!user.password) { user.password = password; saveToDisk(); }
  res.json({ user, workspaceName: store.workspaceName });
});

// POST /api/projects — create or update project
app.post('/api/projects', (req, res) => {
  const { project, action, logEntry } = req.body;
  if (action === 'create') {
    project.id = 'p' + Date.now();
    store.projects.push(project);
  } else if (action === 'update') {
    const idx = store.projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      store.projects[idx] = project;
    } else {
      return res.status(404).json({ error: '项目不存在' });
    }
  }
  if (logEntry) {
    store.activityLog.unshift(logEntry);
    if (store.activityLog.length > 200) store.activityLog = store.activityLog.slice(0, 200);
  }
  saveToDisk();
  broadcast('dataUpdate', { projects: store.projects, activityLog: store.activityLog, archives: store.archives });
  res.json({ success: true, project });
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', (req, res) => {
  store.projects = store.projects.filter(p => p.id !== req.params.id);
  if (req.body && req.body.logEntry) {
    store.activityLog.unshift(req.body.logEntry);
    if (store.activityLog.length > 200) store.activityLog = store.activityLog.slice(0, 200);
  }
  saveToDisk();
  broadcast('dataUpdate', { projects: store.projects, activityLog: store.activityLog, archives: store.archives });
  res.json({ success: true });
});

// POST /api/archive/:ym — archive a month
app.post('/api/archive/:ym', (req, res) => {
  store.archives[req.params.ym] = req.body;
  if (req.body._logEntry) {
    store.activityLog.unshift(req.body._logEntry);
    if (store.activityLog.length > 200) store.activityLog = store.activityLog.slice(0, 200);
  }
  saveToDisk();
  broadcast('dataUpdate', { projects: store.projects, activityLog: store.activityLog, archives: store.archives });
  res.json({ success: true });
});

// PUT /api/users — update user list (admin only)
app.put('/api/users', (req, res) => {
  store.users = req.body.users;
  saveToDisk();
  broadcast('usersUpdate', { users: store.users });
  res.json({ success: true });
});

// PUT /api/projects — bulk replace all projects (for import, clear samples)
app.put('/api/projects', (req, res) => {
  store.projects = req.body.projects || [];
  if (req.body.logEntry) {
    store.activityLog.unshift(req.body.logEntry);
    if (store.activityLog.length > 200) store.activityLog = store.activityLog.slice(0, 200);
  }
  saveToDisk();
  broadcast('dataUpdate', { projects: store.projects, activityLog: store.activityLog, archives: store.archives });
  res.json({ success: true });
});

// PUT /api/data — bulk import (projects + archives + activityLog)
app.put('/api/data', (req, res) => {
  const { projects, archives, activityLog } = req.body;
  if (projects !== undefined) store.projects = projects;
  if (archives !== undefined) store.archives = archives;
  if (activityLog !== undefined) store.activityLog = activityLog;
  saveToDisk();
  broadcast('dataUpdate', { projects: store.projects, activityLog: store.activityLog, archives: store.archives });
  res.json({ success: true });
});

// DELETE /api/logs — clear all activity logs
app.delete('/api/logs', (req, res) => {
  store.activityLog = [];
  saveToDisk();
  broadcast('dataUpdate', { projects: store.projects, activityLog: store.activityLog, archives: store.archives });
  res.json({ success: true });
});

// GET /api/stream — Server-Sent Events for real-time updates
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');
  sseClients.add(res);
  console.log('SSE client connected. Total:', sseClients.size);
  req.on('close', () => {
    sseClients.delete(res);
    console.log('SSE client disconnected. Total:', sseClients.size);
  });
});

// Fallback: serve index.html for any other GET route
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════ Startup Restore from GitHub Backup ═══════════
// 关键防丢失闭环：Render 免费版文件系统是临时的，重启/重部署后本地 data.json 会被清空。
// 若启动时发现数据是示例数据（id 为 s1~s5），说明真实数据丢了，自动从备份仓库拉回覆盖。
function normalizeStore(raw) {
  const defaults = { projects: [], archives: {}, activityLog: [], users: DEFAULT_USERS.map(u=>({...u})), workspaceName: '豆豆王西安工作室' };
  const merged = { ...defaults, ...raw };
  if (!Array.isArray(merged.projects)) merged.projects = [];
  if (!merged.archives || typeof merged.archives !== 'object') merged.archives = {};
  if (!Array.isArray(merged.activityLog)) merged.activityLog = [];
  if (!Array.isArray(merged.users) || !merged.users.length) merged.users = DEFAULT_USERS.map(u=>({...u}));
  if (!merged.workspaceName) merged.workspaceName = '豆豆王西安工作室';
  return merged;
}

async function startupRestore() {
  // 是否仍处于示例数据状态（真实项目 id 为 'p'+时间戳，示例为 's1'~'s5'）
  const isSampleOnly = !store.projects.length || store.projects.every(p => /^s\d+$/.test(p.id));
  if (!isSampleOnly) return; // 已有真实数据，跳过
  if (!BACKUP_TOKEN || !BACKUP_REPO) return;
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${BACKUP_REPO}/contents/data.json?ref=${BACKUP_BRANCH}`,
      { headers: { 'Authorization': `Bearer ${BACKUP_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'script-studio-server' } }
    );
    if (resp.ok) {
      const file = await resp.json();
      if (!file.content) return;
      const raw = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      if (raw.projects && raw.projects.length && raw.projects.some(p => !/^s\d+$/.test(p.id))) {
        store = normalizeStore(raw);
        console.log('✅ [启动恢复] 从 GitHub 备份恢复:', store.projects.length, '个项目,', Object.keys(store.archives).length, '个归档');
        saveToDisk();
      } else {
        console.log('⚠️ [启动恢复] 备份中无真实数据，保留当前示例数据');
      }
    } else {
      console.log('⚠️ [启动恢复] 备份仓库暂无可恢复数据 (status ' + resp.status + ')');
    }
  } catch (e) {
    console.error('[启动恢复] 拉取备份失败:', e.message);
  }
}

// ═══════════ Start Server ═══════════
app.listen(PORT, () => {
  console.log('🎬 剧本工作室实时协作服务器已启动');
  console.log('   地址: http://localhost:' + PORT);
  console.log('   在线人数: ' + sseClients.size);
  if (BACKUP_TOKEN && BACKUP_REPO) {
    console.log('   🛡️  GitHub 自动备份: 已启用 → ' + BACKUP_REPO);
  } else {
    console.log('   ⚠️  GitHub 自动备份: 未启用（设置 BACKUP_TOKEN + BACKUP_REPO 环境变量启用）');
  }
  startupRestore(); // 启动即检查是否需要从备份恢复
});

// Graceful shutdown
process.on('SIGINT', () => { saveToDiskImmediate(); process.exit(); });
process.on('SIGTERM', () => { saveToDiskImmediate(); process.exit(); });
function saveToDiskImmediate() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2)); } catch(e) {}
}
