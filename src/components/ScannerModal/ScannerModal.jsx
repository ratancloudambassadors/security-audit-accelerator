import React, { useState, useRef, useEffect } from 'react';
import styles from './ScannerModal.module.css';
import Button from '../Button/Button';

const ScannerModal = ({ isOpen, onClose, provider: initialProvider, onScanComplete, onScanStatusChange }) => {
  const [provider, setProvider] = useState(initialProvider || null);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'paste'

  useEffect(() => {
    if (isOpen && !isScanning) {
      // Only reset state on a fresh open, not when re-opening mid-scan
      setProvider(initialProvider || null);
      setFile(null);
      setJsonText('');
      setAwsAccessKey('');
      setAwsSecretKey('');
      setAzureTenantId('');
      setAzureClientId('');
      setAzureClientSecret('');
      setAzureSubscriptionId('');
      setError(null);
      setActiveTab('upload');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const [completedResults, setCompletedResults] = useState(null);
  const [file, setFile] = useState(null);
  const [jsonText, setJsonText] = useState('');

  // AWS State
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');

  // Azure State
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureSubscriptionId, setAzureSubscriptionId] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleStartScan = async () => {
    if (provider === 'gcp') {
      if (activeTab === 'upload' && !file) {
        setError("Please upload a JSON file first.");
        return;
      }
      if (activeTab === 'paste' && !jsonText.trim()) {
        setError("Please paste valid JSON credentials.");
        return;
      }
    } else if (provider === 'aws') {
      if (!awsAccessKey.trim() || !awsSecretKey.trim()) {
        setError("Please provide both Access Key ID and Secret Access Key.");
        return;
      }
    } else if (provider === 'azure') {
      if (activeTab === 'paste' && !jsonText.trim()) {
        setError("Please paste valid JSON credentials.");
        return;
      }
      if (activeTab === 'upload' && (!azureTenantId.trim() || !azureClientId.trim() || !azureClientSecret.trim() || !azureSubscriptionId.trim())) {
        setError("Please provide all 4 fields: Tenant ID, Client ID, Client Secret, and Subscription ID.");
        return;
      }
    }

    localStorage.removeItem('latest_scan_result');
    localStorage.removeItem('last_viewed_scan');
    window.dispatchEvent(new CustomEvent('scanStarted'));

    setIsScanning(true);
    setScanProgress(0);
    setError(null);
    if (onScanStatusChange) onScanStatusChange('scanning');

    // Simulated progress tick (jumps every 500ms, slowing down as it reaches 99%)
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
         const remaining = 99 - prev;
         if (remaining <= 0) return 99;
         const jump = Math.max(1, Math.floor(remaining * 0.1));
         return prev + jump;
      });
    }, 500);

    const API_BASE = window.location.hostname.includes('run.app') ? 'https://security-audit-accelerator-backend-196053730058.asia-south1.run.app' : 'http://localhost:5000';
    try {
      const token = localStorage.getItem('auditscope_token');
      let response;

      if (provider === 'aws') {
        response = await fetch(`${API_BASE}/api/scan/aws`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            accessKeyId: awsAccessKey.trim(),
            secretAccessKey: awsSecretKey.trim()
          }),
        });
      } else if (provider === 'azure') {
        let payload = {};
        if (activeTab === 'paste') {
          payload = { credentials: jsonText };
        } else {
          payload = {
            tenantId: azureTenantId.trim(),
            clientId: azureClientId.trim(),
            clientSecret: azureClientSecret.trim(),
            subscriptionId: azureSubscriptionId.trim()
          };
        }
        response = await fetch(`${API_BASE}/api/scan/azure`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload),
        });
      } else { // GCP
        if (activeTab === 'upload') {
          // Parse the file in the frontend to avoid multer and FormData issues on Cloud Run
          const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsText(file);
          });

          response = await fetch(`${API_BASE}/api/scan/gcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ credentials: fileContent }),
          });
        } else {
          response = await fetch(`${API_BASE}/api/scan/gcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ credentials: jsonText }),
          });
        }
      }

      if (!response.ok) {
        clearInterval(progressInterval);
        let errorMsg = `Server responded with status: ${response.status}`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } else {
            const textData = await response.text();
            console.error("Non-JSON error response:", textData);
            if (response.status === 404) {
              errorMsg = `API route not found (404). Make sure the latest backend code is deployed.`;
            }
          }
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(errorMsg);
      }

      setScanProgress(100);
      clearInterval(progressInterval);
      
      const rawResults = await response.json();

      const adaptedResults = {
        id: rawResults.dbScanId, // Store the DB ID for exports
        dbScanId: rawResults.dbScanId,
        dbProjectId: rawResults.dbProjectId,
        score: rawResults.summary.score,
        vulnerabilities: (rawResults.vulnerabilities || []).map(f => ({
          id: f.id,
          severity: f.severity,
          resource: f.resource,
          issue: f.issue,
          remediation: f.remediation
        })),
        scanned: rawResults.summary.scannedResources,
        provider: provider
      };

      if (onScanStatusChange) onScanStatusChange('completed');
      setCompletedResults(adaptedResults);
      localStorage.setItem('latest_scan_result', JSON.stringify(adaptedResults));
      window.dispatchEvent(new CustomEvent('scanCompleted', { detail: adaptedResults }));
      setIsScanning(false);

    } catch (err) {
      console.error("Scan Error:", err);
      clearInterval(progressInterval);
      setError(err.message || "Invalid JSON or network error. Ensure backend is running.");
      if (onScanStatusChange) onScanStatusChange('idle');
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${!provider && !completedResults && !isScanning ? styles.modalContentLarge : ''}`}>

        {completedResults ? (
          <div className={styles.completionState}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.scanTitle}>Scan Complete</h2>
            <p className={styles.scanSubtitle}>Audit finished with {completedResults.vulnerabilities.length} vulnerabilities across {completedResults.scanned} resources.</p>
            <div style={{ marginTop: 'var(--spacing-6)' }}>
              <Button variant="primary" onClick={() => {
                onScanComplete(completedResults);
                setCompletedResults(null);
                if (onScanStatusChange) onScanStatusChange('idle');
                onClose();
              }}>View Results</Button>
            </div>
          </div>
        ) : isScanning ? (
          <div className={styles.scanningState}>
            <button className={styles.minimizeBtn} onClick={onClose} title="Minimize to background">−</button>
            <div className={styles.scannerRing}></div>
            <h2 className={styles.scanPercentage}>{scanProgress}%</h2>
            <h2 className={styles.scanTitle}>Auditing {(provider || 'Cloud').toUpperCase()} Infrastructure</h2>
            <p className={styles.scanSubtitle}>Analyzing IAM configurations, firewalls, and storage blobs...</p>
          </div>
        ) : !provider ? (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Choose your provider</h2>
              <button className={styles.closeBtn} onClick={onClose}>×</button>
            </div>
            <div className={styles.providerGrid}>
              <div className={styles.providerCard} onClick={() => setProvider('aws')}>
                <img src="/assets/aws-logo.svg" alt="AWS" className={styles.providerIcon} />
                <span className={styles.providerName}>AWS</span>
              </div>
              <div className={styles.providerCard} onClick={() => setProvider('azure')}>
                <img src="/assets/azure-logo.svg" alt="Azure" className={styles.providerIcon} />
                <span className={styles.providerName}>Azure</span>
              </div>
              <div className={styles.providerCard} onClick={() => setProvider('gcp')}>
                <img src="/assets/gcp-logo.svg" alt="GCP" className={styles.providerIcon} />
                <span className={styles.providerName}>GCP</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button className={styles.backBtn} onClick={() => setProvider(null)}>← Back</button>
                <h2 className={styles.title}>Scan {(provider || 'Cloud').toUpperCase()} Environment</h2>
              </div>
              <button className={styles.closeBtn} onClick={onClose}>×</button>
            </div>

            <div className={styles.descriptionWrapper}>
              <p className={styles.description}>
                {provider === 'aws'
                  ? "Provide your AWS IAM User credentials to authorize the read-only security audit."
                  : provider === 'azure'
                  ? "Provide your Azure Service Principal credentials to authorize the read-only security audit."
                  : "Provide your Service Account Key to authorize the read-only security audit."
                }
              </p>
              <div className={styles.helpIconWrapper}>
                <span className={styles.helpIcon}>?</span>
                <div className={styles.helpTooltip}>
                  {provider === 'aws' && (
                    <ol>
                      <li>Go to AWS Console &gt; IAM.</li>
                      <li>Select Users &gt; Add users or existing.</li>
                      <li>Go to Security credentials tab.</li>
                      <li>Click Create access key.</li>
                      <li>Copy Access Key ID and Secret Access Key.</li>
                    </ol>
                  )}
                  {provider === 'azure' && (
                    <ol>
                      <li>Go to Azure Portal &gt; App registrations.</li>
                      <li>Create an app and copy <b>Client ID</b> & <b>Tenant ID</b>.</li>
                      <li>Go to Certificates & secrets &gt; create <b>Client Secret</b>.</li>
                      <li>Go to Subscriptions and copy <b>Subscription ID</b>.</li>
                      <li>Assign 'Reader' role to the app in the Subscription.</li>
                    </ol>
                  )}
                  {provider === 'gcp' && (
                    <ol>
                      <li>Go to GCP Console &gt; IAM & Admin &gt; Service Accounts.</li>
                      <li>Select or Create a Service Account.</li>
                      <li>Go to Keys &gt; Add Key &gt; Create new key.</li>
                      <li>Select JSON and download the file.</li>
                    </ol>
                  )}
                </div>
              </div>
            </div>

            {provider === 'aws' ? (
              <div className={styles.awsForm}>
                <div className={styles.formGroup}>
                  <label className={styles.awsLabel}>Access Key ID</label>
                  <input
                    type="text"
                    value={awsAccessKey}
                    onChange={(e) => setAwsAccessKey(e.target.value)}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className={styles.awsInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.awsLabel}>Secret Access Key</label>
                  <input
                    type="password"
                    value={awsSecretKey}
                    onChange={(e) => setAwsSecretKey(e.target.value)}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    className={styles.awsInput}
                  />
                </div>
              </div>
            ) : provider === 'azure' ? (
              <>
                <div className={styles.tabs}>
                  <button
                    className={`${styles.tab} ${activeTab === 'upload' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('upload')}
                  >
                    Manual Fields
                  </button>
                  <button
                    className={`${styles.tab} ${activeTab === 'paste' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('paste')}
                  >
                    Paste JSON
                  </button>
                </div>

                <div className={styles.tabContent}>
                  {activeTab === 'upload' ? (
                    <div className={styles.awsForm} style={{ gap: '1rem' }}>
                      <div className={styles.formGroup}>
                        <label className={styles.awsLabel}>Tenant ID (Directory ID)</label>
                        <input type="text" value={azureTenantId} onChange={(e) => setAzureTenantId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className={styles.awsInput} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.awsLabel}>Client ID (App ID)</label>
                        <input type="text" value={azureClientId} onChange={(e) => setAzureClientId(e.target.value)} placeholder="11111111-1111-1111-1111-111111111111" className={styles.awsInput} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.awsLabel}>Client Secret</label>
                        <input type="password" value={azureClientSecret} onChange={(e) => setAzureClientSecret(e.target.value)} placeholder="Your Azure Service Principal Secret" className={styles.awsInput} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.awsLabel}>Subscription ID</label>
                        <input type="text" value={azureSubscriptionId} onChange={(e) => setAzureSubscriptionId(e.target.value)} placeholder="22222222-2222-2222-2222-222222222222" className={styles.awsInput} />
                      </div>
                    </div>
                  ) : (
                    <textarea
                      className={styles.jsonTextarea}
                      placeholder='{&#10;  "tenantId": "...",&#10;  "clientId": "...",&#10;  "clientSecret": "...",&#10;  "subscriptionId": "..."&#10;}'
                      value={jsonText}
                      onChange={(e) => {
                        setJsonText(e.target.value);
                        setError(null);
                      }}
                      spellCheck="false"
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.tabs}>
                  <button
                    className={`${styles.tab} ${activeTab === 'upload' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('upload')}
                  >
                    Upload File
                  </button>
                  <button
                    className={`${styles.tab} ${activeTab === 'paste' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('paste')}
                  >
                    Paste JSON
                  </button>
                </div>

                <div className={styles.tabContent}>
                  {activeTab === 'upload' ? (
                    <div
                      className={styles.dropZone}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        accept=".json"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleFileChange}
                      />

                      {file ? (
                        <div className={styles.fileName}>{file.name}</div>
                      ) : (
                        <div>
                          <p className={styles.dropText}>Drag & Drop your .json file here</p>
                          <p className={styles.dropSubtext}>or click to browse</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <textarea
                      className={styles.jsonTextarea}
                      placeholder='{ "type": "service_account", "project_id": "..." }'
                      value={jsonText}
                      onChange={(e) => {
                        setJsonText(e.target.value);
                        setError(null);
                      }}
                      spellCheck="false"
                    />
                  )}
                </div>
              </>
            )}

            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.footer}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleStartScan}>Start Scan</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScannerModal;
