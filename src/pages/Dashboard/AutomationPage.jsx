import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import ScheduleModal from '../../components/ScheduleModal/ScheduleModal';

const AutomationPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auditscope_token');
      const [schedRes, projRes] = await Promise.all([
        fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/schedules', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/projects/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const schedData = await schedRes.json();
      const projData = await projRes.json();

      setSchedules(schedData);
      setProjects(projData);
    } catch (err) {
      console.error('Failed to fetch automation data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (id) => {
    try {
      const token = localStorage.getItem('auditscope_token');
      await fetch(`https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/schedules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error('Toggle failed');
    }
  };

  const deleteSchedule = async (id) => {
    if (!window.confirm('Are you sure you want to remove this automation?')) return;
    try {
      const token = localStorage.getItem('auditscope_token');
      await fetch(`https://security-audit-accelerator-backend-196053730058.asia-south1.run.app/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error('Delete failed');
    }
  };

  const handleCreateNew = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div style={{ paddingBottom: 'var(--spacing-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-8)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--spacing-1)' }}>Automation Hub</h1>
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
              Manage your scheduled security audits and automated reporting.
            </p>
          </div>
          <Button variant="primary" onClick={handleCreateNew}>
            + New Automation
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px' }}>Loading automations...</div>
        ) : schedules.length === 0 ? (
          <Card style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-4)', borderStyle: 'dashed', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ fontSize: '4rem', opacity: 0.2 }}>⏰</div>
            <h3 style={{ margin: 0 }}>No active automations</h3>
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '350px' }}>
              Schedule recurring audits to keep your cloud infrastructure secure without manual effort.
            </p>
            <Button variant="secondary" onClick={handleCreateNew}>Get Started</Button>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--spacing-6)' }}>
            {schedules.map((schedule) => (
              <Card key={schedule.id} style={{ padding: 'var(--spacing-6)', position: 'relative', border: '1px solid var(--color-border)', background: schedule.isActive ? 'rgba(0, 229, 255, 0.02)' : 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-4)' }}>
                  <div>
                    <span style={{ 
                        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', 
                        background: schedule.isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: schedule.isActive ? '#22c55e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {schedule.isActive ? 'Active' : 'Paused'}
                    </span>
                    <h3 style={{ margin: '8px 0 4px 0', fontSize: 'var(--font-size-xl)' }}>{schedule.project?.name}</h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0, textTransform: 'uppercase' }}>
                      {schedule.project?.provider} • {schedule.frequency}
                    </p>
                  </div>
                  <div style={{ fontSize: '1.5rem' }}>🔄</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: 'var(--spacing-6)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Next Run:</div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{new Date(schedule.nextRun).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Last Run:</div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{schedule.lastRun ? new Date(schedule.lastRun).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
                  <button 
                    onClick={() => toggleSchedule(schedule.id)}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '13px' }}
                  >
                    {schedule.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button 
                    onClick={() => deleteSchedule(schedule.id)}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Remove
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ScheduleModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); fetchData(); }}
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
      />
    </DashboardLayout>
  );
};

export default AutomationPage;
