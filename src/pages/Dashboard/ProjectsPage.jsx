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
        .provider-tab-header {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 14px 20px;
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
          flex: 1;
          min-width: 220px;
        }
        .provider-tab-header:hover {
          border-color: rgba(99,102,241,0.4);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .provider-tab-header.active-aws {
          border-color: #FF9900;
          box-shadow: 0 0 12px rgba(255,153,0,0.15);
          background: rgba(255,153,0,0.04);
        }
        .provider-tab-header.active-azure {
          border-color: #0078D4;
          box-shadow: 0 0 12px rgba(0,120,212,0.15);
          background: rgba(0,120,212,0.04);
        }
        .provider-tab-header.active-gcp {
          border-color: #4285F4;
          box-shadow: 0 0 12px rgba(66,133,244,0.15);
          background: rgba(66,133,244,0.04);
        }
        .tab-chevron {
          transition: transform 0.2s ease;
        }
        .active-chevron {
          transform: rotate(180deg);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
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
          <div>
            {/* Horizontal Provider Tab Headers */}
            <div style={{ display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap', marginBottom: 'var(--spacing-6)' }}>
              {/* AWS Tab */}
              <div 
                className={`provider-tab-header ${expandedProviders.aws ? 'active-aws' : ''}`}
                onClick={() => setExpandedProviders(prev => ({ aws: !prev.aws, azure: false, gcp: false }))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src="/assets/aws-logo.svg" alt="AWS" width="22" height="22" />
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text)' }}>AWS</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {awsProjects.length} project(s)
                  </span>
                </div>
                <div className={`tab-chevron ${expandedProviders.aws ? 'active-chevron' : ''}`} style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>

              {/* Azure Tab */}
              <div 
                className={`provider-tab-header ${expandedProviders.azure ? 'active-azure' : ''}`}
                onClick={() => setExpandedProviders(prev => ({ azure: !prev.azure, aws: false, gcp: false }))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src="/assets/azure-logo.svg" alt="Azure" width="22" height="22" />
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text)' }}>Azure</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {azureProjects.length} project(s)
                  </span>
                </div>
                <div className={`tab-chevron ${expandedProviders.azure ? 'active-chevron' : ''}`} style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>

              {/* GCP Tab */}
              <div 
                className={`provider-tab-header ${expandedProviders.gcp ? 'active-gcp' : ''}`}
                onClick={() => setExpandedProviders(prev => ({ gcp: !prev.gcp, aws: false, azure: false }))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src="/assets/gcp-logo.svg" alt="GCP" width="22" height="22" />
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text)' }}>Google Cloud</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {gcpProjects.length} project(s)
                  </span>
                </div>
                <div className={`tab-chevron ${expandedProviders.gcp ? 'active-chevron' : ''}`} style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>

            {/* Expanded List Panel */}
            <div style={{ minHeight: '120px' }}>
              {expandedProviders.aws && (
                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  {awsProjects.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-6) 0', textAlign: 'center', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>No AWS projects scanned yet.</div>
                  ) : (
                    <div className="projects-list-grid">
                      {awsProjects.map(proj => <ProjectCard key={proj.id} proj={proj} />)}
                    </div>
                  )}
                </div>
              )}

              {expandedProviders.azure && (
                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  {azureProjects.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-6) 0', textAlign: 'center', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>No Azure projects scanned yet.</div>
                  ) : (
                    <div className="projects-list-grid">
                      {azureProjects.map(proj => <ProjectCard key={proj.id} proj={proj} />)}
                    </div>
                  )}
                </div>
              )}

              {expandedProviders.gcp && (
                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  {gcpProjects.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-6) 0', textAlign: 'center', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>No GCP projects scanned yet.</div>
                  ) : (
                    <div className="projects-list-grid">
                      {gcpProjects.map(proj => <ProjectCard key={proj.id} proj={proj} />)}
                    </div>
                  )}
                </div>
              )}

              {!expandedProviders.aws && !expandedProviders.azure && !expandedProviders.gcp && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', background: 'rgba(255,255,255,0.01)' }}>
                  Select a cloud provider above to view its scanned projects.
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
