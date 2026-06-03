require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const { LowSync } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;

// ── DB ────────────────────────────────────────────────────
const dbFile = path.join(__dirname, 'leads.json');
const adapter = new JSONFileSync(dbFile);
const db = new LowSync(adapter, { leads: [] });
db.read();

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Email transporter ─────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── POST /api/audit ───────────────────────────────────────
app.post('/api/audit', async (req, res) => {
  const { name, company, email, role, problem, pipelines } = req.body;

  if (!name || !email || !company) {
    return res.status(400).json({ ok: false, error: 'Name, email and company are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const lead = {
    id: Date.now().toString(),
    name: name.trim(),
    company: company.trim(),
    email: email.trim().toLowerCase(),
    role: (role || '').trim(),
    problem: (problem || '').trim(),
    pipelines: (pipelines || '').trim(),
    submittedAt: new Date().toISOString(),
    status: 'new',
  };

  db.data.leads.unshift(lead);
  db.write();

  // Notification email to you
  try {
    await transporter.sendMail({
      from: `"PipelineX Leads" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: `New audit request — ${lead.company} (${lead.name})`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;background:#f8fafc;">
          <div style="background:#0c1424;border-radius:10px;padding:24px 28px;margin-bottom:20px;">
            <h2 style="color:#00e5a0;margin:0 0 4px;font-size:20px;">New Audit Request</h2>
            <p style="color:#7899b8;margin:0;font-size:13px;">PipelineX Lead Notification</p>
          </div>
          <table style="width:100%;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e8eef5;border-collapse:collapse;">
            <tr style="background:#f6f8fb;"><td style="padding:13px 18px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.8px;width:130px;">Name</td><td style="padding:13px 18px;font-size:15px;color:#0c1424;font-weight:600;">${esc(lead.name)}</td></tr>
            <tr style="border-top:1px solid #e8eef5;"><td style="padding:13px 18px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.8px;">Company</td><td style="padding:13px 18px;font-size:15px;color:#0c1424;">${esc(lead.company)}</td></tr>
            <tr style="border-top:1px solid #e8eef5;background:#f6f8fb;"><td style="padding:13px 18px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.8px;">Email</td><td style="padding:13px 18px;font-size:15px;"><a href="mailto:${esc(lead.email)}" style="color:#155eef;">${esc(lead.email)}</a></td></tr>
            <tr style="border-top:1px solid #e8eef5;"><td style="padding:13px 18px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.8px;">Role</td><td style="padding:13px 18px;font-size:15px;color:#0c1424;">${esc(lead.role) || '—'}</td></tr>
            <tr style="border-top:1px solid #e8eef5;background:#f6f8fb;"><td style="padding:13px 18px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.8px;">Pipelines</td><td style="padding:13px 18px;font-size:15px;color:#0c1424;">${esc(lead.pipelines) || '—'}</td></tr>
            <tr style="border-top:1px solid #e8eef5;"><td style="padding:13px 18px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.8px;vertical-align:top;">Problem</td><td style="padding:13px 18px;font-size:15px;color:#0c1424;line-height:1.6;">${esc(lead.problem) || '—'}</td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
            ${new Date(lead.submittedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST
            &nbsp;·&nbsp;
            <a href="${process.env.BASE_URL||'http://localhost:3000'}/admin?token=${process.env.ADMIN_TOKEN}" style="color:#155eef;">View dashboard</a>
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Notification email failed:', e.message);
  }

  // Confirmation email to the lead
  try {
    await transporter.sendMail({
      from: `"PipelineX" <${process.env.SMTP_USER}>`,
      to: lead.email,
      subject: `Got your audit request, ${lead.name.split(' ')[0]}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;">
          <div style="background:#0c1424;border-radius:10px;padding:28px;margin-bottom:24px;">
            <h2 style="color:#00e5a0;margin:0 0 10px;">We received your request.</h2>
            <p style="color:#aabbd3;margin:0;line-height:1.65;font-size:15px;">Thanks for reaching out, ${esc(lead.name.split(' ')[0])}. One of our engineers will review what you shared and get back to you within 24 hours to schedule the audit call.</p>
          </div>
          <p style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:8px;">What happens next:</p>
          <ol style="color:#334155;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
            <li>We review your submission and research your company's data context</li>
            <li>We send a calendar invite for the 60-minute audit call</li>
            <li>After the call you receive a written findings doc within 48 hours — no obligation</li>
          </ol>
          <p style="color:#64748b;font-size:13px;margin-top:24px;padding-top:18px;border-top:1px solid #e8eef5;">
            Questions? Reply to this email or write to
            <a href="mailto:hello@pipelinex.in" style="color:#155eef;">hello@pipelinex.in</a><br>
            <span style="color:#94a3b8;">PipelineX Technologies Pvt. Ltd. · Lucknow, India</span>
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Confirmation email failed:', e.message);
  }

  res.json({ ok: true, message: 'Received. We will be in touch within 24 hours.' });
});

// ── GET /admin ────────────────────────────────────────────
app.get('/admin', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).send(`<!DOCTYPE html><html><head><title>PipelineX Admin</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0c1424;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;}.box{background:#111c2d;border:1px solid #1e3a5f;border-radius:12px;padding:40px 36px;width:100%;max-width:360px;}h2{color:#e2eaf3;font-size:20px;margin-bottom:6px;font-family:system-ui;}p{color:#7899b8;font-size:14px;margin-bottom:24px;}input{width:100%;background:#0c1424;border:1px solid #1e3a5f;border-radius:7px;padding:11px 14px;color:#e2eaf3;font-size:15px;outline:none;font:inherit;}input:focus{border-color:#155eef;}button{width:100%;margin-top:12px;background:#155eef;border:none;border-radius:7px;padding:12px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;font:inherit;}button:hover{background:#0f3fa8;}</style></head>
    <body><div class="box"><h2>PipelineX Admin</h2><p>Enter your admin token to view leads.</p>
    <input type="password" id="t" placeholder="Admin token" onkeydown="if(event.key==='Enter')go()">
    <button onclick="go()">Access dashboard →</button></div>
    <script>function go(){const t=document.getElementById('t').value;if(t)window.location='/admin?token='+encodeURIComponent(t);}</script>
    </body></html>`);
  }

  db.read();
  const leads = db.data.leads || [];
  const statusColor = { new: '#00e5a0', contacted: '#f59e0b', closed: '#64748b' };

  const rows = leads.map(l => `
    <tr>
      <td><div style="font-weight:600;color:#e2eaf3;">${esc(l.name)}</div><div style="font-size:12px;color:#7899b8;margin-top:2px;">${esc(l.role||'—')}</div></td>
      <td style="font-weight:500;color:#93bbff;">${esc(l.company)}</td>
      <td><a href="mailto:${esc(l.email)}" style="color:#155eef;text-decoration:none;">${esc(l.email)}</a></td>
      <td style="color:#aabbd3;font-size:13px;">${esc(l.pipelines||'—')}</td>
      <td style="color:#aabbd3;max-width:240px;font-size:13px;line-height:1.5;">${esc(l.problem||'—')}</td>
      <td style="white-space:nowrap;color:#7899b8;font-size:12px;">${new Date(l.submittedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      <td>
        <select onchange="updateStatus('${l.id}',this.value,'${esc(token)}')"
          style="background:#0c1424;border:1px solid #1e3a5f;border-radius:5px;color:${statusColor[l.status]||'#64748b'};padding:5px 8px;font-size:12px;cursor:pointer;font:inherit;">
          <option value="new" ${l.status==='new'?'selected':''} style="color:#00e5a0;">New</option>
          <option value="contacted" ${l.status==='contacted'?'selected':''} style="color:#f59e0b;">Contacted</option>
          <option value="closed" ${l.status==='closed'?'selected':''} style="color:#64748b;">Closed</option>
        </select>
      </td>
    </tr>`).join('');

  res.send(`<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PipelineX — Leads</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#080e1a;color:#e2eaf3;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;}
    .top{background:#0c1424;border-bottom:1px solid #1e3a5f;padding:16px 28px;display:flex;align-items:center;justify-content:space-between;}
    .logo{font-size:17px;font-weight:700;color:#fff;display:flex;align-items:center;gap:9px;}
    .dot{width:9px;height:9px;background:#00e5a0;border-radius:50%;}
    .stats{display:flex;gap:16px;padding:20px 28px 0;flex-wrap:wrap;}
    .stat{background:#0c1424;border:1px solid #1e3a5f;border-radius:10px;padding:16px 22px;min-width:120px;}
    .stat-num{font-size:28px;font-weight:700;color:#00e5a0;letter-spacing:-1px;line-height:1;}
    .stat-label{font-size:11px;color:#7899b8;margin-top:3px;text-transform:uppercase;letter-spacing:.8px;}
    .wrap{margin:20px 28px;overflow-x:auto;border-radius:10px;border:1px solid #1e3a5f;}
    table{width:100%;border-collapse:collapse;background:#0c1424;}
    thead tr{background:#111c2d;}
    th{padding:12px 14px;text-align:left;font-size:11px;color:#7899b8;font-weight:600;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;}
    td{padding:13px 14px;border-top:1px solid #1a2d45;vertical-align:top;font-size:13px;}
    tr:hover td{background:#111c2d;}
    .empty{text-align:center;padding:56px;color:#7899b8;}
    .ref{background:none;border:1px solid #1e3a5f;border-radius:7px;color:#7899b8;padding:7px 14px;font-size:13px;cursor:pointer;font:inherit;}
    .ref:hover{border-color:#155eef;color:#93bbff;}
  </style></head><body>
  <div class="top">
    <div class="logo"><span class="dot"></span>PipelineX Admin</div>
    <button class="ref" onclick="location.reload()">↻ Refresh</button>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-num">${leads.length}</div><div class="stat-label">Total leads</div></div>
    <div class="stat"><div class="stat-num">${leads.filter(l=>l.status==='new').length}</div><div class="stat-label">New</div></div>
    <div class="stat"><div class="stat-num">${leads.filter(l=>l.status==='contacted').length}</div><div class="stat-label">Contacted</div></div>
    <div class="stat"><div class="stat-num">${leads.filter(l=>l.status==='closed').length}</div><div class="stat-label">Closed</div></div>
  </div>
  <div class="wrap">
    <table>
      <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Pipelines</th><th>Problem</th><th>Submitted</th><th>Status</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="7" class="empty">No leads yet.</td></tr>`}</tbody>
    </table>
  </div>
  <script>
    function updateStatus(id,status,token){
      fetch('/api/lead/'+id+'/status',{
        method:'PATCH',
        headers:{'Content-Type':'application/json','x-admin-token':token},
        body:JSON.stringify({status})
      });
    }
  </script>
  </body></html>`);
});

// ── PATCH /api/lead/:id/status ────────────────────────────
app.patch('/api/lead/:id/status', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ ok: false });

  const { status } = req.body;
  if (!['new','contacted','closed'].includes(status)) {
    return res.status(400).json({ ok: false });
  }

  db.read();
  const lead = db.data.leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ ok: false });

  lead.status = status;
  db.write();
  res.json({ ok: true });
});

// ── Health ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, leads: db.data.leads.length }));

app.listen(PORT, () => {
  console.log(`PipelineX running on http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});
