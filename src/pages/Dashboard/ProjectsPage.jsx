import React, { useState, useEffect } from 'react';

import Card from '../../components/Card/Card';

const ProjectsPage = () => {
  const API_BASE = window.location.hostname.includes('run.app') ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' : 'http://localhost:5000';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [visibleSections, setVisibleSections] = useState({
    aws: true,
    azure: true,
    gcp: true,
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
            let standardizedName = p.name;
            if (p.provider === 'aws' && standardizedName.startsWith('AWS Project')) standardizedName = standardizedName.replace('AWS Project', 'AWS Account');
            if (p.provider === 'azure' && standardizedName.startsWith('Azure Project')) standardizedName = standardizedName.replace('Azure Project', 'Azure Subscription');
            
            uniqueProjectsMap.set(key, { ...p, name: standardizedName });
          } else {
            const curr = uniqueProjectsMap.get(key);
            curr._count = curr._count || { scans: 0 };
            const additional = p._count?.scans || 0;
            curr._count.scans += additional;
            
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

  const toggleSection = (provider) => {
    setVisibleSections(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const awsProjects = projects.filter(p => p.provider === 'aws');
  const azureProjects = projects.filter(p => p.provider === 'azure');
  const gcpProjects = projects.filter(p => p.provider === 'gcp');

  const ProjectCard = ({ proj }) => (
    <a key={proj.id} href={`/dashboard/projects/${proj.id}`} style={{ textDecoration: 'none' }}>
     
      <Card style={{ cursor: 'pointer', transition: 'transform 0.15s', padding: 'var(--spacing-4)', background: 'var(--color-bg-secondary, #ffffff)',margin:'10px' }} className="project-card-hover">
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
          <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '4px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
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

  const ProviderSection = ({ id, title, logo, count, projectsList, fallbackText }) => {
    const isVisible = visibleSections[id];

    return (
      /* Section uses --color-bg-secondary to guarantee perfect visibility on top of the Slate 900 background */
      <div style={{ 
        background: 'var(--color-bg-secondary, #ffffff)', 
        border: '1px solid var(--color-border)', 
        borderRadius: '12px', 
        padding: 'var(--spacing-5)',
        marginBottom: 'var(--spacing-6)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Header section containing metadata and the minimal toggle icon */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',margin:"10px" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={logo} alt={title} width="24" height="24" />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{title}</h2>
            {/* Project count badge matches your app tokens */}
            <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '12px',color: 'var(--color-text-muted)', fontWeight: 600 }}>
              {count}
            </span>
          </div>

          <button 
            onClick={() => toggleSection(id)}
            className="transparent-chevron-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              borderRadius: '50%'
            }}
            title={isVisible ? 'Collapse' : 'Expand'}
          >
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ 
                transform: isVisible ? 'rotate(180deg)' : 'rotate(0deg)', 
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' 
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        
        {/* Sub-section Body Panel separated by margins & theme borders */}
        {isVisible && (
          <div style={{ 
            marginTop: 'var(--spacing-5)', 
            paddingTop: 'var(--spacing-5)', 
            borderTop: '1px solid var(--color-border)',
            animation: 'fadeInSection 0.2s ease-out' 
          }}>
            {projectsList.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--spacing-6) 0', textAlign: 'center', background: 'transparent', borderRadius: '8px', border: '1px dashed var(--color-border)',margin:'15px' }}>
                {fallbackText}
              </div>
            ) : (
              <div className="projects-list-grid">
                {projectsList.map(proj => <ProjectCard key={proj.id} proj={proj} />)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .project-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: var(--color-primary) !important;
        }
        .transparent-chevron-btn:hover {
          color: var(--color-text) !important;
          background-color: var(--color-border);
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
        @keyframes fadeInSection {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <div style={{ paddingBottom: 'var(--spacing-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text)' }}>Projects</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-8)' }}>
          Cloud projects you have previously scanned, organized by provider.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-8)' }}>Loading projects...</div>
        ) : projects.length === 0 ? (
          <Card style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)', background: 'var(--color-bg-secondary, #ffffff)' }}>
            <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>📁</div>
            <h3 style={{ color: 'var(--color-text)' }}>No projects yet</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Run a scan to automatically create a project.</p>
          </Card>
        ) : (
          <div>
            {/* AWS Section */}
            <ProviderSection 
              id="aws"
              title="AWS" 
              logo="/assets/aws-logo.svg" 
              count={`${awsProjects.length} project(s)`}
              projectsList={awsProjects}
              fallbackText="No AWS projects scanned yet."
            />

            {/* Azure Section */}
            <ProviderSection 
              id="azure"
              title="Azure" 
              logo="/assets/azure-logo.svg" 
              count={`${azureProjects.length} project(s)`}
              projectsList={azureProjects}
              fallbackText="No Azure projects scanned yet."
            />

            {/* Google Cloud Section */}
            <ProviderSection 
              id="gcp"
              title="Google Cloud" 
              logo="/assets/gcp-logo.svg" 
              count={`${gcpProjects.length} project(s)`}
              projectsList={gcpProjects}
              fallbackText="No GCP projects scanned yet."
            />
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;
