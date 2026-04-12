import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import Card from '../../components/Card/Card';
import ScanDetailModal from '../../components/ScanDetailModal/ScanDetailModal';

const ProjectDetailsPage = ({ projectId }) => {
  const [project, setProject] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedScan, setSelectedScan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auditscope_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch Project Info
        const projRes = await fetch(`https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/projects/${projectId}`, { headers });
        if (!projRes.ok) throw new Error('Project not found');
        const projData = await projRes.json();
        setProject(projData);

        // Fetch Scans
        const scanRes = await fetch(`https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/projects/${projectId}/scans`, { headers });
        const scanData = await scanRes.json();
        setScans(scanData);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [projectId]);

  const openScanDetails = (scan) => {
    const adaptedData = {
      score: scan.score,
      vulnerabilities: scan.findings || [],
      scanned: scan.scannedResources,
      provider: project?.provider || 'gcp',
      dbProjectId: scan.projectId,
      isHistory: true
    };
    
    localStorage.setItem('last_viewed_scan', JSON.stringify(adaptedData));
    window.location.href = '/dashboard';
  };

  const getProviderIcon = (prov) => {
    if (prov === 'gcp') return '☁️';
    if (prov === 'aws') return '🟠';
    return '🔵';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>Loading project details...</div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--color-danger)' }}>
          Project not found or access denied.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ paddingBottom: 'var(--spacing-4)' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <a href="/dashboard/projects" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: 'var(--font-size-sm)', display: 'inline-block', marginBottom: 'var(--spacing-2)' }}>
            ← Back to Projects
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <span style={{ fontSize: '2rem' }}>{getProviderIcon(project.provider)}</span>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: 0 }}>{project.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.4)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {project.provider}
                </span>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  Created on {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
          <Card style={{ padding: 'var(--spacing-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-1)' }}>Total Scans</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-text)' }}>{scans.length}</div>
          </Card>
          <Card style={{ padding: 'var(--spacing-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-1)' }}>Latest Security Score</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: scans[0]?.score > 80 ? 'var(--color-success)' : scans[0]?.score > 50 ? '#eab308' : 'var(--color-danger)' }}>
              {scans.length > 0 ? `${scans[0].score}%` : 'N/A'}
            </div>
          </Card>
          <Card style={{ padding: 'var(--spacing-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-1)' }}>Latest Scan Date</div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-text)' }}>
              {scans.length > 0 ? new Date(scans[0].createdAt).toLocaleDateString() : 'No Scans'}
            </div>
          </Card>
        </div>

        {/* Scans List / Tables */}
        <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-3)' }}>Scan History</h2>
        {scans.length === 0 ? (
           <Card style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
             No scans have been run for this project yet.
           </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {scans.map((scan) => (
              <Card 
                key={scan.id} 
                style={{ padding: 'var(--spacing-4)', cursor: 'pointer', transition: 'border-color 0.2s', backgroundColor: 'var(--color-bg-secondary)' }}
                onClick={() => openScanDetails(scan)}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: scan.score > 80 ? 'var(--color-success)' : scan.score > 50 ? '#eab308' : 'var(--color-danger)' }}>
                      {scan.score}%
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {new Date(scan.createdAt).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {scan.scannedResources} resources scanned
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                    {scan.criticalCount > 0 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 600 }}>
                        {scan.criticalCount} Critical
                      </span>
                    )}
                    {scan.highCount > 0 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#f97316', fontWeight: 600 }}>
                        {scan.highCount} High
                      </span>
                    )}
                    {scan.mediumCount > 0 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308', fontWeight: 600 }}>
                        {scan.mediumCount} Medium
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ScanDetailModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        scan={selectedScan} 
      />
    </DashboardLayout>
  );
};

export default ProjectDetailsPage;
