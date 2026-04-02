import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import Card from '../../components/Card/Card';

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('auditscope_token');
        const res = await fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/projects', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setProjects(data);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <DashboardLayout>
      <div style={{ paddingBottom: 'var(--spacing-4)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)' }}>Projects</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-6)' }}>
          Cloud projects you have previously scanned.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-8)' }}>Loading projects...</div>
        ) : projects.length === 0 ? (
          <Card style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)' }}>
            <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>📁</div>
            <h3 style={{ color: 'var(--color-text)' }}>No projects yet</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Run a scan to automatically create a project.</p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-4)' }}>
            {projects.map((proj) => (
              <a key={proj.id} href={`/dashboard/history?project=${proj.id}`} style={{ textDecoration: 'none' }}>
                <Card style={{ cursor: 'pointer', transition: 'transform 0.15s', padding: 'var(--spacing-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
                    <span style={{ fontSize: '1.5rem' }}>{proj.provider === 'gcp' ? '☁️' : proj.provider === 'aws' ? '🟠' : '🔵'}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {proj.provider}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text)' }}>{proj.name}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {proj._count?.scans || 0} scan(s)
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {new Date(proj.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProjectsPage;
