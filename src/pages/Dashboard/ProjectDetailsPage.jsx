import React, { useState, useEffect } from 'react';
import Card from '../../components/Card/Card';

const PROVIDER_META = {
  gcp:   { label: 'Google Cloud',       color: '#4285F4', bg: 'rgba(66,133,244,0.10)',   icon: <img src="/assets/gcp-logo.svg" alt="GCP" width="22" height="22" /> },
  aws:   { label: 'Amazon Web Services', color: '#FF9900', bg: 'rgba(255,153,0,0.10)',    icon: <img src="/assets/aws-logo.svg" alt="AWS" width="22" height="22" /> },
  azure: { label: 'Microsoft Azure',     color: '#0078D4', bg: 'rgba(0,120,212,0.10)',    icon: <img src="/assets/azure-logo.svg" alt="Azure" width="22" height="22" /> },
};

const scoreColor = (s) => {
  if (s == null) return '#6b7280';
  if (s > 80) return '#22c55e';
  if (s > 50) return '#eab308';
  return '#ef4444';
};

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const barColorByScore = (score) => {
  if (score > 80) return { fill: '#10b981', stop1: '#34d399', stop2: '#059669', glow: 'rgba(16,185,129,0.35)' };
  if (score > 50) return { fill: '#f59e0b', stop1: '#fcd34d', stop2: '#d97706', glow: 'rgba(245,158,11,0.35)' };
  return { fill: '#ef4444', stop1: '#f87171', stop2: '#dc2626', glow: 'rgba(239,68,68,0.35)' };
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--color-bg)',
        border: `1px solid var(--color-border)`,
        padding: '14px 18px',
        borderRadius: '12px',
        boxShadow: `0 8px 24px rgba(0,0,0,0.15)`,
        backdropFilter: 'blur(12px)',
        minWidth: 200,
      }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📅 {label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {payload.map((entry, index) => {
            const timeKey = `scanTime${entry.dataKey.replace('scan', '')}`;
            const time = entry.payload[timeKey] || `Scan ${index + 1}`;
            return (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color || entry.fill || '#3b82f6' }} />
                  <span style={{ fontSize: '12px', color: 'var(--color-text)', fontWeight: 600 }}>{time}</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: entry.color || entry.fill || '#3b82f6' }}>{entry.value}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const StatCard = ({ label, value, icon, accent, trend, tooltip, richTooltip }) => (
  <div style={{
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: 3,
    flex: 1, minWidth: 0, position: 'relative', overflow: 'visible',
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accent, borderRadius: '10px 10px 0 0' }} />
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
      {(richTooltip || tooltip) && (
        richTooltip ? (
          <div
            style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
            onMouseEnter={(e) => { const t = e.currentTarget.querySelector('[data-rtip]'); if (t) { t.style.opacity='1'; t.style.visibility='visible'; t.style.transform='translateX(-50%) translateY(4px)'; } }}
            onMouseLeave={(e) => { const t = e.currentTarget.querySelector('[data-rtip]'); if (t) { t.style.opacity='0'; t.style.visibility='hidden'; t.style.transform='translateX(-50%) translateY(0)'; } }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700 }}>?</div>
            <div data-rtip style={{
              opacity: 0, visibility: 'hidden',
              transition: 'all 0.2s ease',
              position: 'absolute',
              top: '100%', left: '50%',
              transform: 'translateX(-50%) translateY(0)',
              marginTop: '8px',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '12px 14px',
              width: '250px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
              zIndex: 100,
              pointerEvents: 'none',
              textAlign: 'left',
            }}>
              {/* Arrow border */}
              <div style={{ position:'absolute', bottom:'100%', left:'50%', marginLeft:'-5px', borderWidth:'0 5px 5px 5px', borderStyle:'solid', borderColor:'transparent transparent var(--color-border) transparent' }} />
              <div style={{ position:'absolute', bottom:'calc(100% - 1px)', left:'50%', marginLeft:'-4px', borderWidth:'0 4px 4px 4px', borderStyle:'solid', borderColor:'transparent transparent var(--color-bg) transparent' }} />
              {richTooltip}
            </div>
          </div>
        ) : (
          <div style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700 }} title={tooltip}>
            ?
          </div>
        )
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: (richTooltip || tooltip) ? -4 : 4 }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{value}</div>
      {trend && (
        <div style={{ fontSize: 10, fontWeight: 700, color: trend.color, paddingBottom: 1 }}>
          {trend.icon} {trend.text}
        </div>
      )}
    </div>
    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
  </div>
);

const ProjectDetailsPage = ({ projectId }) => {
  const API_BASE = window.location.hostname.includes('run.app') ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' : 'http://localhost:5000';

  const [project,  setProject]  = useState(null);
  const [scans,    setScans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [dlStatus, setDlStatus] = useState('idle'); // idle | downloading | done | error
  
  // Chart Date Range Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  const latest = scans[0] || null;
  const totalScans = scans.length;
  
  // Current stats relative to the latest scan
  const currentScore = latest?.score ?? null;
  const currentResources = latest?.scannedResources || 0;
  const currentCritical = latest?.criticalCount || 0;
  const currentHigh = latest?.highCount || 0;
  const currentMedium = latest?.mediumCount || 0;
  const currentTotalIssues = currentCritical + currentHigh + currentMedium;

  // New Coverage Stats
  const latestSkippedRaw = latest?.skippedChecks ? JSON.parse(latest.skippedChecks) : [];
  const totalChecks = latest?.totalChecks || 77; // Default to the new 77-checkpoint standard
  const skippedCount = latestSkippedRaw.length;
  const completedCount = totalChecks - skippedCount;
  const coveragePercent = Math.round((completedCount / totalChecks) * 100);

  // Previous stats for trend computation
  const previous = scans[1] || null;
  const prevScore = previous?.score ?? null;
  const prevTotalIssues = previous ? (previous.criticalCount + previous.highCount + previous.mediumCount) : null;

  // Helpers for Trend Arrows
  const getScoreTrend = () => {
    if (currentScore === null || prevScore === null) return null;
    const diff = currentScore - prevScore;
    if (diff > 0) return { text: `${diff}%`, icon: '↑', color: '#22c55e' }; // Score Up is Good
    if (diff < 0) return { text: `${Math.abs(diff)}%`, icon: '↓', color: '#ef4444' };
    return { text: 'unchanged', icon: '–', color: 'var(--color-text-muted)' };
  };

  const getIssuesTrend = () => {
    if (currentTotalIssues === null || prevTotalIssues === null) return null;
    const diff = currentTotalIssues - prevTotalIssues;
    if (diff > 0) return { text: `${diff} new`, icon: '↑', color: '#ef4444' }; // Issues Up is Bad
    if (diff < 0) return { text: `${Math.abs(diff)} fixed`, icon: '↓', color: '#22c55e' };
    return { text: 'unchanged', icon: '–', color: 'var(--color-text-muted)' };
  };

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
        latestScore:    currentScore,
        totalResources: currentResources,
        totalIssues:    currentTotalIssues,
        totalCritical:  currentCritical,
        totalHigh:      currentHigh,
        totalMedium:    currentMedium,
        scoreHistory:   chartData, // The trend bar data
        recentScans:    scans.slice(0, 10).map(s => ({ // Send top 10 for the PDF list
          score: s.score,
          date: new Date(s.createdAt).toLocaleDateString(),
          time: new Date(s.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          resources: s.scannedResources,
          critical: s.criticalCount,
          high: s.highCount,
          medium: s.mediumCount
        }))
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
      a.download = `CA_AuditScope_${project.name}_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
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

  const prov = PROVIDER_META[project.provider] || PROVIDER_META.gcp;

  // Filter scans by Date Range
  const filteredScans = scans.filter(s => {
    if (!startDate && !endDate) return true;
    const sDate = new Date(s.createdAt).toISOString().split('T')[0];
    if (startDate && sDate < startDate) return false;
    if (endDate && sDate > endDate) return false;
    return true;
  });

  // Group scans by Date for Grouped Bar Chart
  const groupedByDate = {};
  let maxScansInADay = 0;

  [...filteredScans].reverse().forEach(s => {
    const d = new Date(s.createdAt);
    const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDate = d.toLocaleDateString('en-CA');
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!groupedByDate[shortDate]) {
      groupedByDate[shortDate] = { label: shortDate, fullDate, scans: [] };
    }
    groupedByDate[shortDate].scans.push({
      createdAt: s.createdAt,
      score: s.score || 0,
      time: time,
      critical: s.criticalCount || 0,
      high: s.highCount || 0,
      medium: s.mediumCount || 0
    });
    
    if (groupedByDate[shortDate].scans.length > maxScansInADay) {
      maxScansInADay = groupedByDate[shortDate].scans.length;
    }
  });

  const chartData = Object.values(groupedByDate).map(day => {
    const dataObj = { label: day.label, fullDate: day.fullDate };
    day.scans.forEach((scan, index) => {
      dataObj[`scan${index}`] = scan.score;
      dataObj[`scanTime${index}`] = scan.time;
    });
    return dataObj;
  }).slice(-15);

  const lineChartData = Object.values(groupedByDate).map(day => {
    // Explicitly sort scans by createdAt ascending to ensure last one is the latest scan
    const sortedScans = [...day.scans].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const latestScan = sortedScans[sortedScans.length - 1] || {};
    const totalIssues = (latestScan.critical || 0) + (latestScan.high || 0) + (latestScan.medium || 0);
    return {
      label: day.label,
      fullDate: day.fullDate,
      time: latestScan.time || '',
      vulnerabilities: totalIssues,
    };
  }).slice(-15);

  const dlLabel = dlStatus === 'downloading' ? '⏳ Generating PDF...'
                : dlStatus === 'done'        ? '✅ Downloaded!'
                : dlStatus === 'error'       ? '❌ Failed'
                : '⬇ Download Report';

  return (
    <>
      <style>{`
        .pd-card { transition: transform 0.15s, box-shadow 0.15s; position: relative; z-index: 0; }
        .pd-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.10); z-index: 10; }
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
                color: '#fff', fontWeight: 700, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
                opacity: dlStatus === 'downloading' ? 0.7 : 1,
              }}
            >
              {dlLabel}
            </button>
          )}
        </div>

        {/* ── Row 1: 4 Stat cards — now using Latest + Trend stats ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            <StatCard label="Total Scans"    value={totalScans.toLocaleString()}                              icon="🔍" accent="#6366f1" tooltip="The total number of security audits performed on this project since creation." />
          </div>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            <StatCard
              label="Latest Score"
              value={latest ? `${currentScore}%` : '—'}
              icon="🛡️"
              accent={scoreColor(currentScore)}
              trend={getScoreTrend()}
              richTooltip={
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '11px', marginBottom: '6px' }}>🛡️ How is the Score calculated?</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text)', lineHeight: 1.6 }}>
                    <div style={{ background: 'rgba(99,102,241,0.07)', borderRadius: '6px', padding: '6px 8px', fontFamily: 'monospace', marginBottom: '7px', fontSize: '10px' }}>
                      Score = (Healthy Resources ÷ Total Scanned) × 100
                    </div>
                    A resource is <strong>Healthy</strong> only if it has <em>zero</em> vulnerability findings. Even one finding marks it as vulnerable.
                  </div>
                  <div style={{ marginTop: '7px', fontSize: '10px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '6px' }}>
                    e.g. 190 healthy out of 200 scanned → <strong style={{ color: 'var(--color-primary)' }}>95%</strong>
                  </div>
                </div>
              }
            />
          </div>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            <StatCard label="Latest Resources" value={currentResources.toLocaleString()}        icon="🖥️" accent="#10b981" tooltip="The total number of cloud resources assessed during the most recent scan." />
          </div>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            <StatCard label="Active Issues"   value={currentTotalIssues.toLocaleString()}            icon="⚠️" accent={currentTotalIssues > 0 ? '#ef4444' : '#22c55e'} trend={getIssuesTrend()} tooltip="The total number of open vulnerabilities (Critical, High, and Medium) detected in the most recent scan." />
          </div>
          <div className="pd-card" style={{ flex: 1, minWidth: 120 }}>
            <StatCard 
              label="Audit Coverage"   
              value={latest ? `${coveragePercent}%` : '—'} 
              icon="⚖️" 
              accent={coveragePercent > 90 ? '#22c55e' : coveragePercent > 70 ? '#eab308' : '#ef4444'} 
              tooltip={`This audit successfully executed ${completedCount.toLocaleString()} out of ${totalChecks.toLocaleString()} individual security validations across your resources. ${skippedCount > 0 ? `${skippedCount} validations were skipped due to service availability.` : 'Audit depth is 100%!'}`} 
            />
          </div>
        </div>

        {/* ── Row 2: Historical Score Trend chart ── */}
        {scans.length > 0 && (
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 0,
            boxShadow: '0 2px 16px rgba(99,102,241,0.06), 0 1px 4px rgba(0,0,0,0.04)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Subtle ambient glow */}
            <div style={{ position:'absolute', top:'-60px', left:'50%', transform:'translateX(-50%)', width:'500px', height:'160px', background:'radial-gradient(ellipse at center, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents:'none' }} />

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text)' }}>Security Score Trend</span>
                  <span style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', color: 'var(--color-text-muted)', fontSize: 9, fontWeight: 700 }} title="Shows your Security Score (0-100%) across scans. An upward trend means improving security posture.">?</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display:'block' }}>across {totalScans} scan{totalScans !== 1 ? 's' : ''} · click any bar to explore</span>
              </div>
              
              {/* Legend + Date Filters */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Legend pills */}
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {[{c:'#10b981', label:'>80% Safe'},{c:'#f59e0b', label:'50–80% Warn'},{c:'#ef4444', label:'<50% Risk'}].map(l => (
                    <span key={l.label} style={{ display:'inline-flex', alignItems:'center', gap:4, background:`${l.c}18`, border:`1px solid ${l.c}44`, borderRadius:20, padding:'2px 8px', fontSize:9, color:l.c, fontWeight:700 }}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:l.c,display:'inline-block'}}/>{l.label}
                    </span>
                  ))}
                </div>
                {/* Date pickers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:8, padding:'4px 10px' }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>From</span>
                  <input 
                    type="date" 
                    value={startDate} 
                    max={endDate || undefined}
                    onChange={e => setStartDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '11px', outline:'none' }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>→</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    min={startDate || undefined}
                    onChange={e => setEndDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '11px', outline:'none' }}
                  />
                  {(startDate || endDate) && (
                    <button onClick={() => { setStartDate(''); setEndDate(''); }} style={{ background: 'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer', fontSize: '9px', borderRadius:4, padding:'2px 6px', fontWeight:700 }}>✕</button>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -5, bottom: 15 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 600 }} 
                    dy={10} 
                    label={{ value: 'Scan Timeline', position: 'insideBottom', offset: -10, fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 600 }} 
                    label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', offset: 12, fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }} />
                  {Array.from({ length: maxScansInADay || 1 }).map((_, i) => (
                    <Bar 
                      key={`bar-${i}`}
                      dataKey={`scan${i}`} 
                      radius={[4, 4, 0, 0]}
                      animationDuration={1000}
                      isAnimationActive={true}
                      fill={['#3b82f6', '#f97316', '#9ca3af', '#eab308', '#8b5cf6', '#10b981', '#ec4899'][i % 7]}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* ── Row 2.5: Vulnerability Trend Line Chart ── */}
        {scans.length > 0 && (
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: '20px 24px',
            marginTop: '24px',
            display: 'flex', flexDirection: 'column', gap: 0,
            boxShadow: '0 2px 16px rgba(239,68,68,0.06), 0 1px 4px rgba(0,0,0,0.04)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Subtle ambient glow */}
            <div style={{ position:'absolute', top:'-60px', left:'50%', transform:'translateX(-50%)', width:'500px', height:'160px', background:'radial-gradient(ellipse at center, rgba(239,68,68,0.04) 0%, transparent 70%)', pointerEvents:'none' }} />
            
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text)' }}>Vulnerability Trend</span>
                </div>
                 <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display:'block' }}>Tracking total vulnerability findings across days</span>
              </div>
            </div>

            {/* Chart */}
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -5, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 600 }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 600 }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                    itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                    labelStyle={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}
                    formatter={(value, name, props) => {
                      const time = props.payload.time ? ` (at ${props.payload.time})` : '';
                      return [`${value}${time}`, name];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vulnerabilities" 
                    name="Total Issues"
                    stroke="#ef4444" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 2 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {/* ── Row 3: Local Scan History Logs ── */}
        {scans.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
               <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', margin: 0 }}>Project Scan History</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              {scans.map((scan) => {
                const safeScore = typeof scan.score === 'number' ? scan.score : 0;
                const safeDate = new Date(scan.createdAt);
                
                const openScanDetails = (scanToOpen) => {
                  const adaptedData = {
                    score: scanToOpen.score,
                    vulnerabilities: scanToOpen.findings || [],
                    scanned: scanToOpen.scannedResources,
                    provider: project.provider || 'gcp',
                    dbProjectId: scanToOpen.projectId || project._id || project.id,
                    isHistory: true
                  };
                  // Use sessionStorage — NOT localStorage — so this historical view
                  // does not overwrite the active scan state across the app.
                  sessionStorage.setItem('history_scan_view', JSON.stringify(adaptedData));
                  window.location.href = '/dashboard';
                };

                return (
                  <Card 
                    key={scan._id || scan.id || Math.random()} 
                    onClick={() => openScanDetails(scan)}
                    style={{ padding: 'var(--spacing-4)', transition: 'border-color 0.2s, background-color 0.2s', cursor: 'pointer' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
                        <div style={{
                          fontSize: 'var(--font-size-xl)',
                          fontWeight: 800,
                          color: safeScore > 80 ? 'var(--color-success)' : safeScore > 50 ? '#eab308' : 'var(--color-danger)'
                        }}>
                          {safeScore}%
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                            {project.name} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({prov.label})</span>
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            <span style={{ fontWeight: 500 }}>Date:</span> {safeDate.toLocaleDateString()} &nbsp;|&nbsp; <span style={{ fontWeight: 500 }}>Time:</span> {safeDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {scan.scannedResources || 0} resources scanned
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                        {currentCritical > 0 && scan.criticalCount > 0 && (
                          <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 600 }}>
                            {scan.criticalCount} Critical
                          </span>
                        )}
                        {scan.highCount > 0 && (
                          <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', color: '#f97316', fontWeight: 600 }}>
                            {scan.highCount} High
                          </span>
                        )}
                        {scan.mediumCount > 0 && (
                          <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', color: '#eab308', fontWeight: 600 }}>
                            {scan.mediumCount} Medium
                          </span>
                        )}
                      </div>
                    </div>

                    {/* New: Skipped Checks Display */}
                    {scan.skippedChecks && JSON.parse(scan.skippedChecks).length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)', fontSize: '11px' }}>
                        <div style={{ color: '#ca8a04', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span>🛡️</span> {JSON.parse(scan.skippedChecks).length} CHECK(S) SKIPPED
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {JSON.parse(scan.skippedChecks).map((skip, sidx) => (
                            <div key={sidx} style={{ background: 'var(--color-bg-secondary)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                              <strong style={{ color: 'var(--color-text)' }}>{skip.service}:</strong> {skip.reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectDetailsPage;
