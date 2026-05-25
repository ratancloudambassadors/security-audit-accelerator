import React, { useState, useEffect } from 'react';

import Card from '../../components/Card/Card';

const ProjectsPage = () => {
  const API_BASE = window.location.hostname.includes('run.app') ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' : 'http://localhost:5000';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProviders, setExpandedProviders] = useState({
    aws: false,
    azure: false,
    gcp: false,
  });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('auditscope_token');
        const res = await fetch(`${API_BASE}/api/projects`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!Array.isArray(data)) {
          console.error('Projects API did not return an array:', data);
          setProjects([]);
          return;
        }

        // Deduplicate locally by core ID to fix any old data issues with naming changes
        const uniqueProjectsMap = new Map();
        
        const getCoreId = (name, provider) => {
          const match = name.match(/\((.*?)\)/);
          if (match) return match[1];
          return name;
        };

        data.forEach(p => {
          const coreId = getCoreId(p.name, p.provider);
          const key = `${p.provider}-${coreId}`;
          
          if (!uniqueProjectsMap.has(key)) {
            // Standardize older names for initial set
            let standardizedName = p.name;
            if (p.provider === 'aws' && standardizedName.startsWith('AWS Project')) standardizedName = standardizedName.replace('AWS Project', 'AWS Account');
            if (p.provider === 'azure' && standardizedName.startsWith('Azure Project')) standardizedName = standardizedName.replace('Azure Project', 'Azure Subscription');
            
            uniqueProjectsMap.set(key, { ...p, name: standardizedName });
          } else {
            // Merge scan count for duplicates
            const curr = uniqueProjectsMap.get(key);
            curr._count = curr._count || { scans: 0 };
            const additional = p._count?.scans || 0;
            curr._count.scans += additional;
            
            // Prefer newer naming conventions if we encounter them
            if (curr.name.startsWith('AWS Project') && p.name.startsWith('AWS Account')) curr.name = p.name;
            if (curr.name.startsWith('Azure Project') && p.name.startsWith('Azure Subscription')) curr.name = p.name;
          }
        });
        
        setProjects(Array.from(uniqueProjectsMap.values()));
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const awsProjects = projects.filter(p => p.provider === 'aws');
  const azureProjects = projects.filter(p => p.provider === 'azure');
  const gcpProjects = projects.filter(p => p.provider === 'gcp');

  const ProjectCard = ({ proj }) => (
    <a key={proj.id} href={`/dashboard/projects/${proj.id}`} style={{ textDecoration: 'none' }}>
      <Card style={{ cursor: 'pointer', transition: 'transform 0.15s', padding: 'var(--spacing-4)' }} className="project-card-hover">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
          <span style={{ display: 'flex' }}>
            {proj.provider === 'gcp' ? (
              <img src="/assets/gcp-logo.svg" alt="GCP" width="24" height="24" />
            ) : proj.provider === 'aws' ? (
              <img src="/assets/aws-logo.svg" alt="AWS" width="24" height="24" />
            ) : (
              <img src="/assets/azure-logo.svg" alt="Azure" width="24" height="24" />
            )}
          </span>
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
  );

  return (
    <>
      <style>{`
        .project-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--color-primary);
        }
        .projects-list-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-4);
        }
        @media (max-width: 1200px) {
          .projects-list-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 900px) {
          .projects-list-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .projects-list-grid { grid-template-columns: 1fr; }
        }
        .provider-header-row {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 16px 20px;
          cursor: pointer;
          user-select: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .provider-header-row:hover {
          border-color: rgba(99,102,241,0.4);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
      `}</style>
      <div style={{ paddingBottom: 'var(--spacing-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)' }}>Projects</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-6)' }}>
          Cloud projects you have previously scanned, organized by provider.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-5)' }}>
            {/* AWS Section */}
            <div className="provider-header-row" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div 
                onClick={() => setExpandedProviders(prev => ({ ...prev, aws: !prev.aws }))}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src="/assets/aws-logo.svg" alt="AWS" width="24" height="24" />
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text)' }}>AWS</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {awsProjects.length} project(s)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', transition: 'transform 0.2s', transform: expandedProviders.aws ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              {expandedProviders.aws && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                  {awsProjects.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-2) 0' }}>No AWS projects scanned yet.</div>
                  ) : (
                    <div className="projects-list-grid">
                      {awsProjects.map(proj => <ProjectCard key={proj.id} proj={proj} />)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Azure Section */}
            <div className="provider-header-row" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div 
                onClick={() => setExpandedProviders(prev => ({ ...prev, azure: !prev.azure }))}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src="/assets/azure-logo.svg" alt="Azure" width="24" height="24" />
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text)' }}>Azure</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {azureProjects.length} project(s)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', transition: 'transform 0.2s', transform: expandedProviders.azure ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              {expandedProviders.azure && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                  {azureProjects.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-2) 0' }}>No Azure projects scanned yet.</div>
                  ) : (
                    <div className="projects-list-grid">
                      {azureProjects.map(proj => <ProjectCard key={proj.id} proj={proj} />)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* GCP Section */}
            <div className="provider-header-row" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div 
                onClick={() => setExpandedProviders(prev => ({ ...prev, gcp: !prev.gcp }))}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src="/assets/gcp-logo.svg" alt="GCP" width="24" height="24" />
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text)' }}>Google Cloud</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {gcpProjects.length} project(s)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', transition: 'transform 0.2s', transform: expandedProviders.gcp ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              {expandedProviders.gcp && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                  {gcpProjects.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-2) 0' }}>No GCP projects scanned yet.</div>
                  ) : (
                    <div className="projects-list-grid">
                      {gcpProjects.map(proj => <ProjectCard key={proj.id} proj={proj} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;
