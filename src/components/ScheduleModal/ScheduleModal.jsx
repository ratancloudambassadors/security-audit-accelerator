import React, { useState, useEffect } from 'react';
import Card from '../Card/Card';
import Button from '../Button/Button';

const ScheduleModal = ({ isOpen, onClose, projectId: initialProjectId, projectName: initialProjectName }) => {
    const [step, setStep] = useState(1);
    const [provider, setProvider] = useState('gcp');
    const [creds, setCreds] = useState('');
    const [frequency, setFrequency] = useState('daily');
    const [time, setTime] = useState('09:00');
    const [daysOfWeek, setDaysOfWeek] = useState(['Monday']);
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const days = [
        { id: 'Monday', label: 'Mon' },
        { id: 'Tuesday', label: 'Tue' },
        { id: 'Wednesday', label: 'Wed' },
        { id: 'Thursday', label: 'Thu' },
        { id: 'Friday', label: 'Fri' },
        { id: 'Saturday', label: 'Sat' },
        { id: 'Sunday', label: 'Sun' }
    ];

    if (!isOpen) return null;

    const toggleDay = (day) => {
        if (daysOfWeek.includes(day)) {
            setDaysOfWeek(daysOfWeek.filter(d => d !== day));
        } else {
            setDaysOfWeek([...daysOfWeek, day]);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem('auditscope_token');
            const res = await fetch('http://localhost:5000/api/schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    projectId: initialProjectId,
                    provider,
                    credentials: typeof creds === 'object' ? JSON.stringify(creds) : creds,
                    frequency,
                    time,
                    daysOfWeek,
                    dayOfMonth
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    onClose();
                    setStep(1); // Reset
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to save schedule');
        } finally {
            setSubmitting(false);
        }
    };

    const renderFrequencyContent = () => {
        switch (frequency) {
            case 'daily':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '12px' }}>Runs every single day at the specified time.</p>
                        <input 
                            type="time" 
                            value={time} 
                            onChange={(e) => setTime(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '1.2rem' }}
                        />
                    </div>
                );
            case 'weekly':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '12px' }}>Choose which days of the week to run the audit.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                            {days.map(d => (
                                <div 
                                    key={d.id} 
                                    onClick={() => toggleDay(d.id)}
                                    style={{
                                        width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: daysOfWeek.includes(d.id) ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                        color: daysOfWeek.includes(d.id) ? '#000' : 'var(--color-text)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, fontSize: '12px'
                                    }}
                                >
                                    {d.label}
                                </div>
                            ))}
                        </div>
                        <input 
                            type="time" 
                            value={time} 
                            onChange={(e) => setTime(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '1.2rem' }}
                        />
                    </div>
                );
            case 'monthly':
                return (
                    <div style={{ animation: 'fadeIn 0.3s' }}>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '12px' }}>Specify the day of the month (1-31).</p>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Day of Month</label>
                                <input 
                                    type="number" 
                                    min="1" max="31" 
                                    value={dayOfMonth} 
                                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                                    style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Time</label>
                                <input 
                                    type="time" 
                                    value={time} 
                                    onChange={(e) => setTime(e.target.value)}
                                    style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }}
                                />
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000,
            backdropFilter: 'blur(12px)'
        }}>
            <div style={{ width: '100%', maxWidth: '550px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                <Card style={{ padding: 'var(--spacing-8)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(0, 229, 255, 0.2)', background: '#0e111d' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--color-primary), #a855f7)' }}></div>
                    
                    <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                        {[1, 2, 3].map(s => (
                            <div key={s} style={{ height: '4px', flex: 1, borderRadius: '4px', background: step >= s ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)' }}></div>
                        ))}
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-8)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--spacing-1)' }}>
                            {step === 1 ? 'Select Provider' : step === 2 ? 'Cloud Credentials' : 'Set Schedule'}
                        </h2>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            {step === 1 ? 'Which cloud ecosystem are we securing today?' : 
                             step === 2 ? 'Paste your Access Keys or Service Account JSON' : 
                             'When should we perform the automated audit?'}
                        </p>
                    </div>

                    {success ? (
                        <div style={{ textAlign: 'center', color: 'var(--color-success)', padding: 'var(--spacing-8)', animation: 'scaleUp 0.4s' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏆</div>
                            <h3 style={{ margin: 0 }}>Automation Configured!</h3>
                            <p style={{ color: 'var(--color-text-muted)' }}>We'll notify you via email at {time} on your schedule.</p>
                        </div>
                    ) : (
                        <div>
                            {step === 1 && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {['gcp', 'aws'].map(p => (
                                        <div 
                                            key={p} 
                                            onClick={() => { setProvider(p); setStep(2); }}
                                            style={{
                                                padding: '30px 20px', borderRadius: '16px', border: provider === p ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.05)',
                                                background: provider === p ? 'rgba(0, 229, 255, 0.05)' : 'rgba(0,0,0,0.3)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s'
                                            }}
                                        >
                                            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{p === 'gcp' ? '☁️' : '📦'}</div>
                                            <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{p}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {step === 2 && (
                                <div style={{ animation: 'slideIn 0.3s' }}>
                                    {provider === 'gcp' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div 
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const file = e.dataTransfer.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (re) => setCreds(re.target.result);
                                                        reader.readAsText(file);
                                                    }
                                                }}
                                                style={{ border: '2px dashed var(--color-border)', borderRadius: '12px', padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.3s' }}
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = '.json';
                                                    input.onchange = (e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (re) => setCreds(re.target.result);
                                                            reader.readAsText(file);
                                                        }
                                                    };
                                                    input.click();
                                                }}
                                            >
                                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📄</div>
                                                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>Drop Service Account JSON</div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>or click to browse...</div>
                                            </div>
                                            
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '8px', textAlign: 'center' }}>- OR PASTE MANUALLY -</div>
                                                <textarea 
                                                    placeholder="Paste Service Account JSON content here..."
                                                    value={creds && typeof creds === 'string' ? creds : ''}
                                                    onChange={(e) => setCreds(e.target.value)}
                                                    style={{ width: '100%', height: '120px', padding: '16px', background: 'rgba(0,0,0,0.4)', color: 'var(--color-primary)', border: '1px solid var(--color-border)', borderRadius: '12px', fontFamily: 'monospace', fontSize: '13px', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '-10px' }}>Provide your AWS IAM User credentials to authorize the read-only security audit.</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>ACCESS KEY ID</label>
                                                <input 
                                                    type="text"
                                                    placeholder="AKIA..."
                                                    value={typeof creds === 'object' ? creds.accessKeyId : ''}
                                                    onChange={(e) => setCreds(prev => ({ ...(typeof prev === 'object' ? prev : {}), accessKeyId: e.target.value }))}
                                                    style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: '10px', color: 'var(--color-text)', outline: 'none' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>SECRET ACCESS KEY</label>
                                                <input 
                                                    type="password"
                                                    placeholder="wJal..."
                                                    value={typeof creds === 'object' ? creds.secretAccessKey : ''}
                                                    onChange={(e) => setCreds(prev => ({ ...(typeof prev === 'object' ? prev : {}), secretAccessKey: e.target.value }))}
                                                    style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: '10px', color: 'var(--color-text)', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                        <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent', border: '1px solid #334155', color: 'var(--color-text)', cursor: 'pointer' }}>Back</button>
                                        <button 
                                            onClick={() => setStep(3)} 
                                            disabled={!creds} 
                                            style={{ flex: 2, padding: '12px', borderRadius: '8px', background: 'var(--color-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)', opacity: creds ? 1 : 0.5 }}
                                        >
                                            Next: Configure Schedule
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div style={{ animation: 'slideIn 0.3s' }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                        {['daily', 'weekly', 'monthly'].map(f => (
                                            <div 
                                                key={f} 
                                                onClick={() => setFrequency(f)}
                                                style={{ flex: 1, padding: '10px', borderRadius: '8px', textAlign: 'center', background: frequency === f ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)', color: frequency === f ? '#000' : 'var(--color-text-muted)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontSize: '13px' }}
                                            >
                                                {f}
                                            </div>
                                        ))}
                                    </div>

                                    {renderFrequencyContent()}

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
                                        <button onClick={() => setStep(2)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent', border: '1px solid #334155', color: 'var(--color-text)', cursor: 'pointer' }}>Back</button>
                                        <Button variant="primary" style={{ flex: 2 }} onClick={handleSave} disabled={submitting}>
                                            {submitting ? 'Creating Automation...' : 'Finalize Automation'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <style>{`
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                        @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    `}</style>
                </Card>
            </div>
        </div>
    );
};

export default ScheduleModal;
