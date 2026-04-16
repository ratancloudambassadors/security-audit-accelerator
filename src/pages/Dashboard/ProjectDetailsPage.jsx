import React, { useState, useEffect } from 'react';



const PROVIDER_META = {
  gcp:   { label: 'Google Cloud',       color: '#4285F4', bg: 'rgba(66,133,244,0.10)',   icon: '☁️' },
  aws:   { label: 'Amazon Web Services', color: '#FF9900', bg: 'rgba(255,153,0,0.10)',    icon: '🟠' },
  azure: { label: 'Microsoft Azure',     color: '#0078D4', bg: 'rgba(0,120,212,0.10)',    icon: '🔵' },
};

const scoreColor = (s) => {
  if (s == null) return '#6b7280';
  if (s > 80) return '#22c55e';
  if (s > 50) return '#eab308';
  return '#ef4444';
};

/* ── Tiny bar chart (pure SVG) ── */
const BarChart = ({ data }) => {
  const W = 600, H = 130, PAD = { top: 14, right: 20, bottom: 30, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = 28;
  const yTicks = 4;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const val = Math.round((maxVal / yTicks) * i);
        const y   = PAD.top + innerH - (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
              stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontSize="9" fill="var(--color-text-muted)">{val.toLocaleString()}</text>
          </g>
        );
      })}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH}
        stroke="var(--color-border)" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH}
        stroke="var(--color-border)" strokeWidth="1" />
      {data.map((d, i) => {
        const x  = PAD.left + i * (innerW / data.length) + (innerW / data.length - barW) / 2;
        const bh = (d.value / maxVal) * innerH;
        const y  = PAD.top + innerH - bh;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={bh} rx="4" fill={d.color} opacity="0.85" />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle"
              fontSize="9" fontWeight="700" fill={d.color}>{d.value.toLocaleString()}</text>
            <text x={x + barW / 2} y={PAD.top + innerH + 16} textAnchor="middle"
              fontSize="9" fill="var(--color-text-muted)" fontWeight="600">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

const StatCard = ({ label, value, icon, accent }) => (
  <div style={{
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: 3,
    flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accent, borderRadius: '10px 10px 0 0' }} />
    <div style={{ fontSize: 13 }}>{icon}</div>
    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
  </div>
);

const ProjectDetailsPage = ({ projectId }) => {
  const API_BASE = window.location.hostname.includes('run.app')
    ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' 
    : 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app';

  const [project,  setProject]  = useState(null);
  const [scans,    setScans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [dlStatus, setDlStatus] = useState('idle'); // idle | downloading | done | error

  useEffect(() => {
    const go = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auditscope_token');
        const h = { 'Authorization': `Bearer ${token}` };

        const projRes = await fetch(`${API_BASE}/api/projects/${projectId}`, { headers: h });
        if (!projRes.ok) throw new Error('Not found');
        const projData = await projRes.json();
        setProject(projData);

        const scanRes  = await fetch(`${API_BASE}/api/projects/all/scans`, { headers: h });
        const allScans = await scanRes.json();
        if (Array.isArray(allScans)) {
          setScans(allScans.filter(s => s.project && s.project.name === projData.name));
        } else {
          console.error('Scans API did not return an array:', allScans);
          setScans([]);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    go();
  }, [projectId]);

  // ── Download Project Summary PDF ─────────────────────────────────
  const handleDownloadReport = async () => {
    if (!project) return;
    setDlStatus('downloading');

    try {
      const payload = {
        projectName:    project.name,
        projectId:      project._id || project.id || project.name,
        provider:       project.provider,
        createdAt:      project.createdAt,
        totalScans,
        latestScore:    latest?.score ?? null,
        totalResources,
        totalIssues,
        totalCritical,
        totalHigh,
        totalMedium,
      };

      const token = localStorage.getItem('auditscope_token');
      const res = await fetch(`${API_BASE}/api/reports/project-summary`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate PDF');
      }

      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `AuditScope_${project.name}_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setDlStatus('done');
      setTimeout(() => setDlStatus('idle'), 3000);
    } catch (err) {
      console.error('[Download]', err);
      setDlStatus('error');
      setTimeout(() => setDlStatus('idle'), 4000);
    }
  };

  // ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</p>
    </div>
  );

  if (!project) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-danger)', fontSize: 13 }}>Project not found.</div>
  );

  const prov   = PROVIDER_META[project.provider] || PROVIDER_META.gcp;
  const latest = scans[0] || null;

  // ── Cumulative stats across ALL scans (not just the latest) ───────
  const totalScans     = scans.length;
  const totalResources = scans.reduce((acc, s) => acc + (s.scannedResources || 0), 0);
  const totalCritical  = scans.reduce((acc, s) => acc + (s.criticalCount    || 0), 0);
  const totalHigh      = scans.reduce((acc, s) => acc + (s.highCount        || 0), 0);
  const totalMedium    = scans.reduce((acc, s) => acc + (s.mediumCount      || 0), 0);
  const totalIssues    = totalCritical + totalHigh + totalMedium;

  // Bar chart uses cumulative totals across all scans
  const barData = [
    { label: 'Critical', value: totalCritical, color: '#ef4444' },
    { label: 'High',     value: totalHigh,     color: '#f97316' },
    { label: 'Medium',   value: totalMedium,   color: '#eab308' },
  ];

  const dlLabel = dlStatus === 'downloading' ? '⏳ Generating PDF...'
                : dlStatus === 'done'        ? '✅ Downloaded!'
                : dlStatus === 'error'       ? '❌ Failed'
                : '⬇ Download Report';

  return (
    <>
      <style>{`
        .pd-card { transition: transform 0.15s, box-shadow 0.15s; }
        .pd-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.10); }
        .pd-btn  { transition: opacity 0.15s, transform 0.15s; }
        .pd-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
      `}</style>

      <div style={{ paddingBottom: 32 }}>

        {/* Back */}
        <a href="/dashboard/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: 12, marginBottom: 16, fontWeight: 500 }}>
          <span>←</span> Back to Projects
        </a>

        {/* ── Header ── */}
        <div style={{
          background: `linear-gradient(130deg, ${prov.bg} 0%, var(--color-bg-secondary) 100%)`,
          border: '1px solid var(--color-border)', borderRadius: 14,
          padding: '18px 22px', marginBottom: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: prov.bg, border: `1.5px solid ${prov.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {prov.icon}
            </div>
            <div>
              <h1 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{project.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 8px', borderRadius: 99, background: prov.bg, color: prov.color, border: `1px solid ${prov.color}40` }}>
                  {prov.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Created {new Date(project.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* ── Download Report button ── */}
          {latest && (
            <button
              className="pd-btn"
              onClick={handleDownloadReport}
              disabled={dlStatus === 'downloading'}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', cursor: dlStatus === 'downloading' ? 'wait' : 'pointer',
                background: dlStatus === 'done'  ? '#22c55e'
                          : dlStatus === 'error' ? '#ef4444'
                          : 'var(--color-primary)',
                color: '#000', fontWeight: 700, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
                opacity: dlStatus === 'downloading' ? 0.7 : 1,
              }}
            >
              {dlLabel}
            </button>
          )}
        </div>

        {/* ── Row 1: 4 Stat cards — now using CUMULATIVE totals ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            <StatCard label="Total Scans"    value={totalScans}                              icon="🔍" accent="#6366f1" />
          </div>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            <StatCard label="Latest Score"   value={latest ? `${latest.score}%` : '—'}      icon="🛡️" accent={scoreColor(latest?.score)} />
          </div>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            {/* Total resources = sum of scannedResources across ALL scans */}
            <StatCard label="Total Resources" value={totalResources.toLocaleString()}        icon="🖥️" accent="#10b981" />
          </div>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            {/* Total issues = sum of (critical+high+medium) across ALL scans */}
            <StatCard label="Total Issues"   value={totalIssues.toLocaleString()}            icon="⚠️" accent={totalIssues > 0 ? '#ef4444' : '#22c55e'} />
          </div>
        </div>

        {/* ── Row 2: Vulnerability Breakdown chart (cumulative) ── */}
        {scans.length > 0 && (
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>
                  Vulnerability Breakdown
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                  (cumulative across {totalScans} scan{totalScans !== 1 ? 's' : ''})
                </span>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {[
                  { label: 'Critical', count: totalCritical, color: '#ef4444' },
                  { label: 'High',     count: totalHigh,     color: '#f97316' },
                  { label: 'Medium',   count: totalMedium,   color: '#eab308' },
                ].map(s => (
                  <span key={s.label} style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: s.color, marginRight: 4, verticalAlign: 'middle' }} />
                    {s.label}: {s.count.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
            <BarChart data={barData} />
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectDetailsPage;
