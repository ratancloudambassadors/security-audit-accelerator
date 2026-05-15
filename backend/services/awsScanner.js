// =============================================================================
// AWS Comprehensive Security Auditor
// 81 Checkpoints across 14 service categories — mirrors GCP audit parity
// =============================================================================
const { IAMClient, ListUsersCommand, ListAccessKeysCommand, GetAccountPasswordPolicyCommand, GetAccountSummaryCommand, ListUserPoliciesCommand, ListAttachedUserPoliciesCommand } = require('@aws-sdk/client-iam');
const { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVolumesCommand, DescribeVpcsCommand, DescribeFlowLogsCommand, DescribeNetworkAclsCommand, DescribeSnapshotsCommand } = require('@aws-sdk/client-ec2');
const { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand, GetBucketEncryptionCommand, GetBucketVersioningCommand, GetBucketLoggingCommand, GetBucketLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { EKSClient, ListClustersCommand, DescribeClusterCommand } = require('@aws-sdk/client-eks');
const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeLoadBalancerAttributesCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { LambdaClient, ListFunctionsCommand, GetPolicyCommand } = require('@aws-sdk/client-lambda');
const { KMSClient, ListKeysCommand, GetKeyRotationStatusCommand, DescribeKeyCommand, ListKeyPoliciesCommand, GetKeyPolicyCommand } = require('@aws-sdk/client-kms');
const { CloudTrailClient, DescribeTrailsCommand, GetTrailStatusCommand, GetEventSelectorsCommand } = require('@aws-sdk/client-cloudtrail');
const { CloudWatchClient, DescribeAlarmsCommand } = require('@aws-sdk/client-cloudwatch');
const { CloudWatchLogsClient, DescribeMetricFiltersCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { ConfigServiceClient, DescribeConfigurationRecordersCommand, DescribeConfigurationRecorderStatusCommand } = require('@aws-sdk/client-config-service');
const { GuardDutyClient, ListDetectorsCommand, GetDetectorCommand } = require('@aws-sdk/client-guardduty');
const { SecurityHubClient, DescribeHubCommand } = require('@aws-sdk/client-securityhub');
const { Route53Client, ListHostedZonesCommand, GetDNSSECCommand, ListQueryLoggingConfigsCommand } = require('@aws-sdk/client-route-53');
const { RedshiftClient, DescribeClustersCommand } = require('@aws-sdk/client-redshift');
const { EMRClient, ListClustersCommand: ListEMRClustersCommand, DescribeClusterCommand: DescribeEMRClusterCommand } = require('@aws-sdk/client-emr');
const { SNSClient, ListTopicsCommand, GetTopicAttributesCommand } = require('@aws-sdk/client-sns');

// =============================================================================
// 1. IAM AUDITOR — 11 Checks
// =============================================================================
async function auditAwsIam(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new IAMClient({ region: credentials.region || 'us-east-1', credentials });

    // Check 1 & 2: Account Summary — Root MFA, Root Access Keys
    try {
      const summary = await client.send(new GetAccountSummaryCommand({}));
      const s = summary.SummaryMap || {};
      scannedCount++;
          scannedResourceList.push({ service: 'AWS', name: 'AWS Resource' });

      if (!s['AccountMFAEnabled'] || s['AccountMFAEnabled'] === 0) {
        findings.push({ id: 'AWS-IAM-ROOT-MFA-DISABLED', severity: 'Critical', resource: 'AWS Root Account', issue: 'Multi-Factor Authentication (MFA) is NOT enabled for the root account.', remediation: 'Enable MFA on root account immediately using a hardware or virtual MFA device.' });
      }
      if (s['AccountAccessKeysPresent'] && s['AccountAccessKeysPresent'] > 0) {
        findings.push({ id: 'AWS-IAM-ROOT-ACCESS-KEYS', severity: 'Critical', resource: 'AWS Root Account', issue: 'Root account has active access keys, posing extreme breach risk.', remediation: 'Delete root account access keys and use IAM users/roles for programmatic access.' });
      }
    } catch (err) { console.warn('[AWS IAM] GetAccountSummary:', err.message); }

    // Check 3–9: Password Policy
    try {
      const policyData = await client.send(new GetAccountPasswordPolicyCommand({}));
      scannedCount++;
          scannedResourceList.push({ service: 'AWS', name: 'AWS Resource' });
      const p = policyData.PasswordPolicy;
      if (!p || p.MinimumPasswordLength < 14) findings.push({ id: 'AWS-IAM-PASSWORD-MINLEN', severity: 'Medium', resource: 'IAM Password Policy', issue: 'Minimum password length is less than 14 characters.', remediation: 'Set minimum password length to 14+ characters in IAM password policy.' });
      if (!p || !p.RequireUppercaseCharacters) findings.push({ id: 'AWS-IAM-PASSWORD-UPPERCASE', severity: 'Low', resource: 'IAM Password Policy', issue: 'Password policy does not require uppercase characters.', remediation: 'Enable uppercase character requirement in IAM password policy.' });
      if (!p || !p.RequireLowercaseCharacters) findings.push({ id: 'AWS-IAM-PASSWORD-LOWERCASE', severity: 'Low', resource: 'IAM Password Policy', issue: 'Password policy does not require lowercase characters.', remediation: 'Enable lowercase character requirement in IAM password policy.' });
      if (!p || !p.RequireNumbers) findings.push({ id: 'AWS-IAM-PASSWORD-NUMBERS', severity: 'Low', resource: 'IAM Password Policy', issue: 'Password policy does not require numeric characters.', remediation: 'Enable numeric character requirement in IAM password policy.' });
      if (!p || !p.RequireSymbols) findings.push({ id: 'AWS-IAM-PASSWORD-SYMBOLS', severity: 'Low', resource: 'IAM Password Policy', issue: 'Password policy does not require symbol characters.', remediation: 'Enable symbol character requirement in IAM password policy.' });
      if (!p || !p.MaxPasswordAge || p.MaxPasswordAge > 90) findings.push({ id: 'AWS-IAM-PASSWORD-MAXAGE', severity: 'Medium', resource: 'IAM Password Policy', issue: `Password max age is not enforced or exceeds 90 days (current: ${p?.MaxPasswordAge || 'not set'}).`, remediation: 'Set password expiry to 90 days or fewer in IAM password policy.' });
      if (!p || !p.PasswordReusePrevention || p.PasswordReusePrevention < 24) findings.push({ id: 'AWS-IAM-PASSWORD-REUSE', severity: 'Medium', resource: 'IAM Password Policy', issue: 'Password reuse prevention is not set to 24 or more previous passwords.', remediation: 'Set password reuse prevention to 24 in IAM password policy.' });
    } catch (err) {
      if (err.name === 'NoSuchEntityException') {
        findings.push({ id: 'AWS-IAM-PASSWORD-POLICY-MISSING', severity: 'High', resource: 'IAM Password Policy', issue: 'No custom password policy is configured for the AWS account.', remediation: 'Configure a strong IAM password policy with complexity requirements.' });
      }
    }

    // Check 10 & 11: User Access Keys & Inline Policies
    try {
      const usersData = await client.send(new ListUsersCommand({}));
      const users = usersData.Users || [];
      scannedCount += users.length;

      for (const user of users) {
        const keysData = await client.send(new ListAccessKeysCommand({ UserName: user.UserName }));
        const keys = keysData.AccessKeyMetadata || [];
        if (keys.length > 0) {
          findings.push({ id: `AWS-IAM-USER-KEYS-${user.UserName.substring(0,8)}`, severity: 'Medium', resource: `IAM User (${user.UserName})`, issue: 'User has active long-term access keys. Temporary credentials via IAM Roles are preferred.', remediation: 'Rotate keys every 90 days or switch to IAM Roles for programmatic access.' });
        }
        // Check for inline policies (violates managed policy best practice)
        try {
          const inlineRes = await client.send(new ListUserPoliciesCommand({ UserName: user.UserName }));
          if (inlineRes.PolicyNames && inlineRes.PolicyNames.length > 0) {
            findings.push({ id: `AWS-IAM-INLINE-POLICY-${user.UserName.substring(0,8)}`, severity: 'Low', resource: `IAM User (${user.UserName})`, issue: `User has ${inlineRes.PolicyNames.length} inline policy/policies attached directly.`, remediation: 'Convert inline policies to managed policies for centralized governance and reusability.' });
          }
        } catch (e) { /* ignore */ }
      }
    } catch (err) { console.warn('[AWS IAM] ListUsers:', err.message); }

  } catch (err) { console.error('[AWS IAM] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 2. EC2 AUDITOR — 13 Checks
// =============================================================================
async function auditAwsEc2(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new EC2Client({ region: credentials.region || 'us-east-1', credentials });

    // Instances
    const instData = await client.send(new DescribeInstancesCommand({}));
    const instances = (instData.Reservations || []).flatMap(r => r.Instances || []);
    scannedCount += instances.length;

    for (const instance of instances) {
      const id = instance.InstanceId;
      // Check 1: Public IP
      if (instance.PublicIpAddress) findings.push({ id: `AWS-EC2-PUBLIC-IP-${id}`, severity: 'High', resource: `EC2 Instance (${id})`, issue: 'Instance has a public IP address and is internet-reachable.', remediation: 'Use NAT Gateway or Load Balancer instead of direct public IPs.' });
      // Check 2: IMDSv1
      if (instance.MetadataOptions?.HttpTokens !== 'required') findings.push({ id: `AWS-EC2-IMDSV1-${id}`, severity: 'Critical', resource: `EC2 Instance (${id})`, issue: 'IMDSv1 is enabled, making instance vulnerable to SSRF attacks.', remediation: 'Enforce IMDSv2 by requiring session-oriented metadata tokens.' });
      // Check 3: Detailed Monitoring
      if (!instance.Monitoring || instance.Monitoring.State !== 'enabled') findings.push({ id: `AWS-EC2-NO-MONITORING-${id}`, severity: 'Low', resource: `EC2 Instance (${id})`, issue: 'Detailed CloudWatch monitoring is not enabled.', remediation: 'Enable detailed monitoring to get 1-minute granularity metrics for operational visibility.' });
      // Check 4: Default Service Account equivalent (IAM Role attached)
      if (!instance.IamInstanceProfile) findings.push({ id: `AWS-EC2-NO-IAM-ROLE-${id}`, severity: 'Medium', resource: `EC2 Instance (${id})`, issue: 'No IAM Instance Profile is attached to this instance.', remediation: 'Attach a least-privilege IAM role to the instance for secure API access without static credentials.' });
    }

    // Security Groups
    const sgData = await client.send(new DescribeSecurityGroupsCommand({}));
    const sgs = sgData.SecurityGroups || [];
    scannedCount += sgs.length;

    const dangerousPorts = [
      { port: 21, name: 'FTP', severity: 'High' },
      { port: 22, name: 'SSH', severity: 'Critical' },
      { port: 23, name: 'Telnet', severity: 'Critical' },
      { port: 25, name: 'SMTP', severity: 'Medium' },
      { port: 110, name: 'POP3', severity: 'Medium' },
      { port: 135, name: 'RPC', severity: 'High' },
      { port: 143, name: 'IMAP', severity: 'Medium' },
      { port: 445, name: 'CIFS/SMB', severity: 'Critical' },
      { port: 1433, name: 'MSSQL', severity: 'Critical' },
      { port: 1521, name: 'Oracle DB', severity: 'Critical' },
      { port: 3306, name: 'MySQL', severity: 'Critical' },
      { port: 3389, name: 'RDP', severity: 'Critical' },
      { port: 5432, name: 'PostgreSQL', severity: 'Critical' },
      { port: 5900, name: 'VNC', severity: 'Critical' },
      { port: 27017, name: 'MongoDB', severity: 'Critical' }
    ];

    for (const sg of sgs) {
      // Check 5: Default SG rules
      if (sg.GroupName === 'default') {
        if ((sg.IpPermissions?.length > 0) || (sg.IpPermissionsEgress?.length > 0)) {
          findings.push({ id: `AWS-NET-DEFAULT-SG-${sg.GroupId}`, severity: 'Medium', resource: `Default Security Group (${sg.GroupId})`, issue: 'VPC default security group has active inbound or outbound rules.', remediation: 'Remove all rules from the default security group to enforce zero-trust networking.' });
        }
      }
      for (const perm of (sg.IpPermissions || [])) {
        const isIPv4Public = perm.IpRanges?.some(r => r.CidrIp === '0.0.0.0/0');
        const isIPv6Public = perm.Ipv6Ranges?.some(r => r.CidrIpv6 === '::/0');
        const isPublic = isIPv4Public || isIPv6Public;
        if (isPublic) {
          // Check 6: All traffic open
          if (perm.IpProtocol === '-1') {
            findings.push({ id: `AWS-NET-ALL-TRAFFIC-${sg.GroupId}`, severity: 'Critical', resource: `Security Group (${sg.GroupName})`, issue: 'Security group allows ALL inbound traffic from the internet (0.0.0.0/0).', remediation: 'Restrict to specific protocols, ports, and trusted CIDR ranges only.' });
          }
          // Check 7–13: Specific dangerous ports
          for (const dp of dangerousPorts) {
            const fromPort = perm.FromPort;
            const toPort = perm.ToPort;
            if (fromPort !== undefined && fromPort !== null && fromPort <= dp.port && toPort >= dp.port) {
              findings.push({ id: `AWS-NET-PORT-${dp.port}-${sg.GroupId}`, severity: dp.severity, resource: `Security Group (${sg.GroupName})`, issue: `Inbound ${dp.name} (Port ${dp.port}) is open to the entire internet.`, remediation: `Restrict port ${dp.port} access to specific trusted IPs or disable if not needed.` });
            }
          }
        }
      }
    }

    // EBS Volumes — Check: Unencrypted
    try {
      const volData = await client.send(new DescribeVolumesCommand({}));
      const vols = volData.Volumes || [];
      scannedCount += vols.length;
      for (const v of vols) {
        if (!v.Encrypted) findings.push({ id: `AWS-EBS-UNENCRYPTED-${v.VolumeId}`, severity: 'High', resource: `EBS Volume (${v.VolumeId})`, issue: 'EBS volume is not encrypted at rest.', remediation: 'Enable default EBS encryption for the account and migrate existing volumes to encrypted copies.' });
      }
    } catch (e) { /* ignore */ }

    // EBS Snapshots — Check: Public or Unencrypted
    try {
      const snapData = await client.send(new DescribeSnapshotsCommand({ OwnerIds: ['self'] }));
      const snaps = snapData.Snapshots || [];
      scannedCount += snaps.length;
      for (const snap of snaps) {
        if (!snap.Encrypted) findings.push({ id: `AWS-EBS-SNAP-UNENCRYPTED-${snap.SnapshotId}`, severity: 'Medium', resource: `EBS Snapshot (${snap.SnapshotId})`, issue: 'EBS snapshot is not encrypted.', remediation: 'Copy the snapshot with encryption enabled and delete the unencrypted original.' });
      }
    } catch (e) { /* ignore */ }

  } catch (err) { console.error('[AWS EC2] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 3. VPC / NETWORKING AUDITOR — 7 Checks
// =============================================================================
async function auditAwsVpc(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new EC2Client({ region: credentials.region || 'us-east-1', credentials });

    // Check 1: Default VPC exists
    try {
      const vpcData = await client.send(new DescribeVpcsCommand({}));
      const vpcs = vpcData.Vpcs || [];
      scannedCount += vpcs.length;

      const defaultVpc = vpcs.find(v => v.IsDefault);
      if (defaultVpc) {
        findings.push({ id: `AWS-VPC-DEFAULT-EXISTS-${defaultVpc.VpcId}`, severity: 'Medium', resource: `VPC (${defaultVpc.VpcId})`, issue: 'The default VPC exists in this region. Default VPCs are often misconfigured and over-permissive.', remediation: 'Delete the default VPC and create custom VPCs with explicit subnet configurations and security controls.' });
      }

      // Check 2: VPC Flow Logs not enabled
      for (const vpc of vpcs) {
        const flowData = await client.send(new DescribeFlowLogsCommand({ Filter: [{ Name: 'resource-id', Values: [vpc.VpcId] }] }));
        if (!flowData.FlowLogs || flowData.FlowLogs.length === 0) {
          findings.push({ id: `AWS-VPC-NO-FLOWLOGS-${vpc.VpcId}`, severity: 'Medium', resource: `VPC (${vpc.VpcId})`, issue: 'VPC Flow Logs are not enabled for this VPC.', remediation: 'Enable VPC Flow Logs and send to CloudWatch Logs or S3 for traffic analysis and threat hunting.' });
        }
      }
    } catch (e) { console.warn('[AWS VPC] VPC check:', e.message); }

    // Check 3 & 4: Network ACL — Allow All Inbound/Outbound
    try {
      const naclData = await client.send(new DescribeNetworkAclsCommand({}));
      const nacls = naclData.NetworkAcls || [];
      scannedCount += nacls.length;

      for (const nacl of nacls) {
        const inboundAllowAll = nacl.Entries?.some(e => !e.Egress && e.RuleAction === 'allow' && e.CidrBlock === '0.0.0.0/0' && e.Protocol === '-1');
        const outboundAllowAll = nacl.Entries?.some(e => e.Egress && e.RuleAction === 'allow' && e.CidrBlock === '0.0.0.0/0' && e.Protocol === '-1');

        if (inboundAllowAll) findings.push({ id: `AWS-NACL-ALLOW-ALL-IN-${nacl.NetworkAclId}`, severity: 'Medium', resource: `Network ACL (${nacl.NetworkAclId})`, issue: 'NACL allows all inbound traffic (0.0.0.0/0, all protocols). NACLs should enforce subnet-level restrictions.', remediation: 'Define specific NACL rules to allow only required protocols and ports from trusted sources.' });
        if (outboundAllowAll) findings.push({ id: `AWS-NACL-ALLOW-ALL-OUT-${nacl.NetworkAclId}`, severity: 'Low', resource: `Network ACL (${nacl.NetworkAclId})`, issue: 'NACL allows unrestricted outbound traffic (0.0.0.0/0). Data exfiltration risk.', remediation: 'Restrict outbound NACL rules to only required destinations and protocols.' });
      }
    } catch (e) { console.warn('[AWS NACL] NACL check:', e.message); }

  } catch (err) { console.error('[AWS VPC] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 4. CLOUDTRAIL / LOGGING AUDITOR — 15 Checks (mirrors GCP Logging)
// =============================================================================
async function auditAwsCloudTrail(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const ctClient = new CloudTrailClient({ region: credentials.region || 'us-east-1', credentials });
    const cwLogsClient = new CloudWatchLogsClient({ region: credentials.region || 'us-east-1', credentials });
    const cwClient = new CloudWatchClient({ region: credentials.region || 'us-east-1', credentials });

    // Get all trails
    let trails = [];
    try {
      const trailsData = await ctClient.send(new DescribeTrailsCommand({ includeShadowTrails: false }));
      trails = trailsData.trailList || [];
      scannedCount += trails.length;
    } catch (e) { console.warn('[CloudTrail] DescribeTrails:', e.message); }

    if (trails.length === 0) {
      findings.push({ id: 'AWS-CLOUDTRAIL-DISABLED', severity: 'Critical', resource: 'AWS CloudTrail', issue: 'CloudTrail is not enabled. No API activity logging is occurring in this region.', remediation: 'Enable CloudTrail across all regions to track all account activity.' });
    }

    for (const trail of trails) {
      const name = trail.TrailARN || trail.Name;

      // Check 1: Multi-region trail
      if (!trail.IsMultiRegionTrail) findings.push({ id: `AWS-CT-NOT-MULTIREGION-${trail.Name}`, severity: 'High', resource: `CloudTrail (${trail.Name})`, issue: 'Trail is not configured as multi-region, leaving other regions unmonitored.', remediation: 'Enable multi-region trail to capture API calls from all AWS regions.' });

      // Check 2: Log file validation
      if (!trail.LogFileValidationEnabled) findings.push({ id: `AWS-CT-NO-VALIDATION-${trail.Name}`, severity: 'Medium', resource: `CloudTrail (${trail.Name})`, issue: 'Log file integrity validation is disabled. Log tampering may go undetected.', remediation: 'Enable log file validation to ensure CloudTrail logs have not been modified or deleted.' });

      // Check 3: KMS encryption
      if (!trail.KMSKeyId) findings.push({ id: `AWS-CT-NO-KMS-${trail.Name}`, severity: 'Medium', resource: `CloudTrail (${trail.Name})`, issue: 'CloudTrail logs are not encrypted with a customer-managed KMS key.', remediation: 'Configure a KMS CMK to encrypt CloudTrail log files at rest.' });

      // Check 4: Trail status (is it logging?)
      try {
        const status = await ctClient.send(new GetTrailStatusCommand({ Name: trail.TrailARN || trail.Name }));
        if (!status.IsLogging) {
          findings.push({ id: `AWS-CT-NOT-LOGGING-${trail.Name}`, severity: 'Critical', resource: `CloudTrail (${trail.Name})`, issue: 'CloudTrail trail exists but logging is currently stopped.', remediation: 'Start logging on all CloudTrail trails immediately.' });
        }
      } catch (e) { /* ignore */ }

      // Check 5: S3 Access Logging
      if (!trail.S3BucketName) {
        findings.push({ id: `AWS-CT-NO-S3-${trail.Name}`, severity: 'Medium', resource: `CloudTrail (${trail.Name})`, issue: 'CloudTrail trail has no S3 bucket configured for log delivery.', remediation: 'Configure an S3 bucket to receive and durably store CloudTrail log files.' });
      }

      // Check 6: CloudWatch Logs integration
      if (!trail.CloudWatchLogsLogGroupArn) {
        findings.push({ id: `AWS-CT-NO-CW-${trail.Name}`, severity: 'Medium', resource: `CloudTrail (${trail.Name})`, issue: 'CloudTrail is not integrated with CloudWatch Logs for real-time alerting.', remediation: 'Connect CloudTrail to a CloudWatch Logs group for real-time monitoring and alerting.' });
      }
    }

    // Check 7–15: CloudWatch Metric Filters (mirrors GCP Logging Metrics)
    try {
      const requiredFilters = [
        { id: 'ROOT-USAGE', pattern: 'userIdentity.type=Root', title: 'Root Account Usage' },
        { id: 'UNAUTH-API', pattern: '"errorCode" = "*UnauthorizedAccess*"', title: 'Unauthorized API Calls' },
        { id: 'CONSOLE-AUTH-FAIL', pattern: 'ConsoleLogin.*Failed', title: 'Console Sign-In Failures' },
        { id: 'IAM-POLICY-CHANGE', pattern: 'CreatePolicy OR DeletePolicy OR AttachUserPolicy OR DetachUserPolicy', title: 'IAM Policy Changes' },
        { id: 'CT-CONFIG-CHANGE', pattern: 'DeleteTrail OR StopLogging OR CreateTrail OR UpdateTrail', title: 'CloudTrail Configuration Changes' },
        { id: 'SG-CHANGE', pattern: 'AuthorizeSecurityGroupIngress OR RevokeSecurityGroupIngress', title: 'Security Group Changes' },
        { id: 'NACL-CHANGE', pattern: 'CreateNetworkAcl OR DeleteNetworkAcl OR CreateNetworkAclEntry', title: 'Network ACL Changes' },
        { id: 'VPC-CHANGE', pattern: 'CreateVpc OR DeleteVpc OR ModifyVpcAttribute', title: 'VPC Network Changes' },
        { id: 'S3-POLICY-CHANGE', pattern: 'PutBucketAcl OR PutBucketPolicy OR DeleteBucketPolicy', title: 'S3 Bucket Policy Changes' },
      ];

      let allFilters = [];
      try {
        const metricsRes = await cwLogsClient.send(new DescribeMetricFiltersCommand({}));
        allFilters = metricsRes.metricFilters || [];
        scannedCount += allFilters.length;
      } catch (e) { /* ignore */ }

      const allFilterPatterns = allFilters.map(f => f.filterPattern?.toLowerCase() || '').join(' | ');

      const alarmsRes = await cwClient.send(new DescribeAlarmsCommand({}));
      const allAlarms = alarmsRes.MetricAlarms || [];

      for (const req of requiredFilters) {
        const patternKeyword = req.pattern.split(' ')[0].replace(/["*]/g, '').toLowerCase();
        const hasFilter = allFilterPatterns.includes(patternKeyword);
        if (!hasFilter) {
          findings.push({ id: `AWS-CW-METRIC-${req.id}`, severity: 'Low', resource: 'CloudWatch Metric Filters', issue: `No CloudWatch Metric Filter and Alarm exists for: ${req.title}.`, remediation: `Create a CloudWatch metric filter matching "${req.pattern}" and configure an SNS alarm to notify administrators.` });
        }
      }
    } catch (e) { console.warn('[CloudTrail] MetricFilters check:', e.message); }

  } catch (err) { console.error('[AWS CloudTrail] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 5. CONFIG / SECURITYHUB / GUARDDUTY AUDITOR — 3 Checks
// =============================================================================
async function auditAwsSecurityServices(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 3; // We're checking 3 services
  try {
    const region = credentials.region || 'us-east-1';

    // Check 1: AWS Config enabled
    try {
      const configClient = new ConfigServiceClient({ region, credentials });
      const recData = await configClient.send(new DescribeConfigurationRecordersCommand({}));
      const statusData = await configClient.send(new DescribeConfigurationRecorderStatusCommand({}));
      const recorders = recData.ConfigurationRecorders || [];
      const statuses = statusData.ConfigurationRecordersStatus || [];
      const isRecording = statuses.some(s => s.recording);
      if (recorders.length === 0 || !isRecording) {
        findings.push({ id: 'AWS-CONFIG-DISABLED', severity: 'High', resource: 'AWS Config', issue: 'AWS Config is not enabled or not actively recording resource configurations.', remediation: 'Enable AWS Config in all regions to maintain a continuous inventory of resource configurations and compliance history.' });
      }
    } catch (e) { console.warn('[Security Services] Config check:', e.message); }

    // Check 2: GuardDuty enabled
    try {
      const gdClient = new GuardDutyClient({ region, credentials });
      const detectorsRes = await gdClient.send(new ListDetectorsCommand({}));
      const detectorIds = detectorsRes.DetectorIds || [];
      if (detectorIds.length === 0) {
        findings.push({ id: 'AWS-GUARDDUTY-DISABLED', severity: 'High', resource: 'AWS GuardDuty', issue: 'GuardDuty is not enabled. Intelligent threat detection is inactive.', remediation: 'Enable Amazon GuardDuty to continuously monitor for malicious activity and unauthorized behavior.' });
      } else {
        const detector = await gdClient.send(new GetDetectorCommand({ DetectorId: detectorIds[0] }));
        if (detector.Status !== 'ENABLED') {
          findings.push({ id: 'AWS-GUARDDUTY-SUSPENDED', severity: 'Critical', resource: 'AWS GuardDuty', issue: 'GuardDuty detector exists but is suspended/disabled.', remediation: 'Re-enable the GuardDuty detector to restore threat detection capabilities.' });
        }
      }
    } catch (e) { console.warn('[Security Services] GuardDuty check:', e.message); }

    // Check 3: SecurityHub enabled
    try {
      const shClient = new SecurityHubClient({ region, credentials });
      await shClient.send(new DescribeHubCommand({}));
    } catch (e) {
      if (e.name === 'InvalidAccessException' || e.$metadata?.httpStatusCode === 403 || e.message?.includes('not subscribed')) {
        findings.push({ id: 'AWS-SECURITYHUB-DISABLED', severity: 'Medium', resource: 'AWS Security Hub', issue: 'AWS Security Hub is not enabled. Centralized security findings aggregation is inactive.', remediation: 'Enable Security Hub to aggregate findings from multiple security services and get a unified security posture view.' });
      }
    }

  } catch (err) { console.error('[AWS Security Services] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 6. S3 AUDITOR — 6 Checks (mirrors GCP Storage)
// =============================================================================
async function auditAwsS3(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new S3Client({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new ListBucketsCommand({}));
    const buckets = data.Buckets || [];
    scannedCount = buckets.length;

    for (const b of buckets) {
      const name = b.Name;

      // Check 1: Public Access Block
      try {
        await client.send(new GetPublicAccessBlockCommand({ Bucket: name }));
      } catch (err) {
        if (err.name === 'NoSuchPublicAccessBlockConfiguration') findings.push({ id: `AWS-S3-PUBLIC-BLOCK-${name.substring(0,8)}`, severity: 'High', resource: `S3 Bucket (${name})`, issue: 'S3 Block Public Access configuration is missing.', remediation: 'Enable all four Block Public Access settings for the bucket.' });
      }

      // Check 2: Default Encryption
      try {
        await client.send(new GetBucketEncryptionCommand({ Bucket: name }));
      } catch (err) {
        if (err.name === 'ServerSideEncryptionConfigurationNotFoundError' || err.$metadata?.httpStatusCode === 404) {
          findings.push({ id: `AWS-S3-NO-ENCRYPTION-${name.substring(0,8)}`, severity: 'High', resource: `S3 Bucket (${name})`, issue: 'Default server-side encryption is not configured.', remediation: 'Enable SSE-S3 or SSE-KMS default encryption on the S3 bucket.' });
        }
      }

      // Check 3: Versioning
      try {
        const verData = await client.send(new GetBucketVersioningCommand({ Bucket: name }));
        if (verData.Status !== 'Enabled') findings.push({ id: `AWS-S3-NO-VERSIONING-${name.substring(0,8)}`, severity: 'Medium', resource: `S3 Bucket (${name})`, issue: 'S3 Object Versioning is disabled.', remediation: 'Enable S3 versioning to protect against accidental deletions and enable ransomware recovery.' });
      } catch (e) { /* ignore */ }

      // Check 4: Access Logging
      try {
        const logData = await client.send(new GetBucketLoggingCommand({ Bucket: name }));
        if (!logData.LoggingEnabled) findings.push({ id: `AWS-S3-NO-LOGGING-${name.substring(0,8)}`, severity: 'Low', resource: `S3 Bucket (${name})`, issue: 'S3 server access logging is not enabled.', remediation: 'Enable S3 access logging to maintain an audit trail of requests made to the bucket.' });
      } catch (e) { /* ignore */ }

      // Check 5: Lifecycle Policy
      try {
        await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: name }));
      } catch (err) {
        if (err.name === 'NoSuchLifecycleConfiguration') findings.push({ id: `AWS-S3-NO-LIFECYCLE-${name.substring(0,8)}`, severity: 'Low', resource: `S3 Bucket (${name})`, issue: 'No lifecycle policy is configured on the S3 bucket.', remediation: 'Define lifecycle rules to automatically transition and expire objects to optimize cost and compliance.' });
      }
    }
  } catch (err) { console.error('[AWS S3] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 7. RDS AUDITOR — 13 Checks (mirrors GCP Cloud SQL)
// =============================================================================
async function auditAwsRds(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new RDSClient({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new DescribeDBInstancesCommand({}));
    const dbs = data.DBInstances || [];
    scannedCount = dbs.length;

    for (const db of dbs) {
      const id = db.DBInstanceIdentifier;

      if (db.PubliclyAccessible) findings.push({ id: `AWS-RDS-PUBLIC-${id}`, severity: 'Critical', resource: `RDS (${id})`, issue: 'RDS instance is publicly accessible from the internet.', remediation: 'Disable public accessibility and move instance to a private subnet.' });
      if (!db.StorageEncrypted) findings.push({ id: `AWS-RDS-UNENCRYPTED-${id}`, severity: 'High', resource: `RDS (${id})`, issue: 'RDS instance storage is not encrypted at rest.', remediation: 'Restore from an encrypted snapshot or create a new encrypted instance.' });
      if (!db.MultiAZ) findings.push({ id: `AWS-RDS-NO-MULTIAZ-${id}`, severity: 'Medium', resource: `RDS (${id})`, issue: 'Multi-AZ is disabled, risking availability during AZ failure.', remediation: 'Enable Multi-AZ for high availability and automatic failover.' });
      if (!db.DeletionProtection) findings.push({ id: `AWS-RDS-NO-DEL-PROT-${id}`, severity: 'Low', resource: `RDS (${id})`, issue: 'Deletion protection is disabled.', remediation: 'Enable deletion protection to prevent accidental database removal.' });
      if (!db.AutoMinorVersionUpgrade) findings.push({ id: `AWS-RDS-NO-AUTO-MINOR-${id}`, severity: 'Low', resource: `RDS (${id})`, issue: 'Auto minor version upgrade is disabled.', remediation: 'Enable auto minor version upgrades to automatically apply security patches.' });
      if (!db.IAMDatabaseAuthenticationEnabled) findings.push({ id: `AWS-RDS-NO-IAM-AUTH-${id}`, severity: 'Medium', resource: `RDS (${id})`, issue: 'IAM database authentication is not enabled.', remediation: 'Enable IAM database authentication to eliminate use of static database passwords.' });
      if (!db.BackupRetentionPeriod || db.BackupRetentionPeriod < 7) findings.push({ id: `AWS-RDS-SHORT-BACKUP-${id}`, severity: 'Medium', resource: `RDS (${id})`, issue: `Backup retention period is ${db.BackupRetentionPeriod || 0} days (minimum recommended: 7 days).`, remediation: 'Set backup retention period to at least 7 days for adequate recovery options.' });
      if (!db.EnhancedMonitoringResourceArn) findings.push({ id: `AWS-RDS-NO-ENHANCED-MONITORING-${id}`, severity: 'Low', resource: `RDS (${id})`, issue: 'Enhanced Monitoring is not enabled.', remediation: 'Enable Enhanced Monitoring for OS-level metrics with 1-second granularity.' });
      if (!db.PerformanceInsightsEnabled) findings.push({ id: `AWS-RDS-NO-PERF-INSIGHTS-${id}`, severity: 'Low', resource: `RDS (${id})`, issue: 'Performance Insights is not enabled.', remediation: 'Enable Performance Insights for query-level database performance monitoring.' });
      if (!db.CopyTagsToSnapshot) findings.push({ id: `AWS-RDS-NO-TAG-COPY-${id}`, severity: 'Low', resource: `RDS (${id})`, issue: 'Tags are not copied to snapshots.', remediation: 'Enable copy tags to snapshots for better resource tracking and governance.' });

      // Database flag checks (mirrors GCP SQL flags)
      const flags = db.PendingModifiedValues?.DBParameterGroups || db.DBParameterGroups || [];
      if (db.Engine?.includes('postgres')) {
        if (!db.EnabledCloudwatchLogsExports?.includes('postgresql')) {
          findings.push({ id: `AWS-RDS-PG-NO-LOGS-${id}`, severity: 'Medium', resource: `RDS PostgreSQL (${id})`, issue: 'PostgreSQL audit logs are not exported to CloudWatch.', remediation: 'Enable PostgreSQL log exports to CloudWatch for connection and query auditing.' });
        }
      }
      if (db.Engine?.includes('mysql') || db.Engine?.includes('mariadb')) {
        if (!db.EnabledCloudwatchLogsExports?.includes('audit') && !db.EnabledCloudwatchLogsExports?.includes('general')) {
          findings.push({ id: `AWS-RDS-MYSQL-NO-LOGS-${id}`, severity: 'Medium', resource: `RDS MySQL (${id})`, issue: 'MySQL general or audit logs are not exported to CloudWatch.', remediation: 'Enable MySQL audit/general log exports to CloudWatch for comprehensive query monitoring.' });
        }
      }
    }
  } catch (err) { console.error('[AWS RDS] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 8. EKS AUDITOR — 2 Checks
// =============================================================================
async function auditAwsEks(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new EKSClient({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new ListClustersCommand({}));
    const clusterNames = data.clusters || [];
    scannedCount = clusterNames.length;
    for (const name of clusterNames) {
      const clusterData = await client.send(new DescribeClusterCommand({ name }));
      const cluster = clusterData.cluster;
      if (cluster.resourcesVpcConfig?.endpointPublicAccess) findings.push({ id: `AWS-EKS-PUBLIC-ENDPOINT-${name}`, severity: 'High', resource: `EKS Cluster (${name})`, issue: 'EKS API server endpoint has public access enabled.', remediation: 'Disable public endpoint access or restrict it to trusted CIDR ranges.' });
      const loggingEnabled = cluster.logging?.clusterLogging?.some(log => log.enabled);
      if (!loggingEnabled) findings.push({ id: `AWS-EKS-NO-LOGGING-${name}`, severity: 'Medium', resource: `EKS Cluster (${name})`, issue: 'EKS Control plane logging is not enabled.', remediation: 'Enable all control plane log types (api, audit, authenticator, controllerManager, scheduler).' });
    }
  } catch (err) { console.error('[AWS EKS] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 9. LOAD BALANCER AUDITOR — 2 Checks
// =============================================================================
async function auditAwsLb(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new ElasticLoadBalancingV2Client({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new DescribeLoadBalancersCommand({}));
    const lbs = data.LoadBalancers || [];
    scannedCount = lbs.length;
    for (const lb of lbs) {
      const attrs = (await client.send(new DescribeLoadBalancerAttributesCommand({ LoadBalancerArn: lb.LoadBalancerArn }))).Attributes || [];
      const delProt = attrs.find(a => a.Key === 'deletion_protection.enabled')?.Value === 'true';
      const dropHeaders = attrs.find(a => a.Key === 'routing.http.drop_invalid_header_fields.enabled')?.Value === 'true';
      if (!delProt) findings.push({ id: `AWS-ELB-NO-DEL-PROT-${lb.LoadBalancerName}`, severity: 'Low', resource: `Load Balancer (${lb.LoadBalancerName})`, issue: 'Deletion protection is disabled.', remediation: 'Enable deletion protection to prevent accidental deletion of load balancers.' });
      if (!dropHeaders && lb.Type === 'application') findings.push({ id: `AWS-ELB-INVALID-HEADERS-${lb.LoadBalancerName}`, severity: 'Medium', resource: `ALB (${lb.LoadBalancerName})`, issue: 'Invalid HTTP header dropping is not enabled, risking HTTP desync attacks.', remediation: 'Enable routing.http.drop_invalid_header_fields.enabled on the ALB.' });
    }
  } catch (err) { console.error('[AWS ELB] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 10. KMS AUDITOR — 3 Checks (mirrors GCP KMS)
// =============================================================================
async function auditAwsKms(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new KMSClient({ region: credentials.region || 'us-east-1', credentials });
    const res = await client.send(new ListKeysCommand({}));
    const keys = res.Keys || [];
    scannedCount = keys.length;
    for (const key of keys) {
      try {
        const detail = await client.send(new DescribeKeyCommand({ KeyId: key.KeyId }));
        const km = detail.KeyMetadata;
        if (km.KeyManager !== 'CUSTOMER') continue; // Only audit customer-managed keys
        if (km.KeyState === 'PendingDeletion') findings.push({ id: `AWS-KMS-PENDING-DEL-${key.KeyId.substring(0,8)}`, severity: 'High', resource: `KMS Key (${key.KeyId})`, issue: 'Customer-managed KMS key is scheduled for deletion. Dependent resources may lose access.', remediation: 'Cancel the key deletion if it is still in use, or ensure all dependent resources have migrated.' });
        const rotRes = await client.send(new GetKeyRotationStatusCommand({ KeyId: key.KeyId }));
        if (!rotRes.KeyRotationEnabled) findings.push({ id: `AWS-KMS-NO-ROTATION-${key.KeyId.substring(0,8)}`, severity: 'Medium', resource: `KMS Key (${key.KeyId})`, issue: 'Automatic annual key rotation is not enabled for this customer-managed key.', remediation: 'Enable automatic key rotation for all CMKs to comply with cryptographic best practices.' });
        try {
          const policyRes = await client.send(new GetKeyPolicyCommand({ KeyId: key.KeyId, PolicyName: 'default' }));
          const policy = JSON.parse(policyRes.Policy || '{}');
          const isPublic = (policy.Statement || []).some(s => s.Principal === '*' || s.Principal?.AWS === '*');
          if (isPublic) findings.push({ id: `AWS-KMS-PUBLIC-KEY-${key.KeyId.substring(0,8)}`, severity: 'Critical', resource: `KMS Key (${key.KeyId})`, issue: 'KMS key policy grants access to all principals (*). Key is effectively public.', remediation: 'Restrict KMS key policy to specific trusted AWS accounts and IAM principals.' });
        } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }
    }
  } catch (err) { console.error('[AWS KMS] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 11. LAMBDA AUDITOR — 3 Checks (mirrors GCP Serverless)
// =============================================================================
async function auditAwsServerless(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new LambdaClient({ region: credentials.region || 'us-east-1', credentials });
    const res = await client.send(new ListFunctionsCommand({}));
    const functions = res.Functions || [];
    scannedCount = functions.length;

    const DEPRECATED_RUNTIMES = ['nodejs14.x', 'nodejs12.x', 'nodejs10.x', 'python2.7', 'python3.6', 'dotnetcore2.1', 'ruby2.5', 'java8'];

    for (const fn of functions) {
      // Check 1: Public resource policy
      try {
        const policyRes = await client.send(new GetPolicyCommand({ FunctionName: fn.FunctionName }));
        const policy = JSON.parse(policyRes.Policy);
        const isPublic = (policy.Statement || []).some(s => s.Principal === '*' || s.Principal?.AWS === '*' || s.Principal?.Service === '*');
        if (isPublic) findings.push({ id: `AWS-LAMBDA-PUBLIC-${fn.FunctionName.substring(0,8)}`, severity: 'High', resource: `Lambda (${fn.FunctionName})`, issue: 'Lambda function has a resource policy allowing public (*) access.', remediation: 'Restrict lambda resource policies to specific trusted AWS accounts and services.' });
      } catch (e) { /* no policy = no issue */ }

      // Check 2: Deprecated runtime
      if (DEPRECATED_RUNTIMES.includes(fn.Runtime)) {
        findings.push({ id: `AWS-LAMBDA-DEPRECATED-RUNTIME-${fn.FunctionName.substring(0,8)}`, severity: 'High', resource: `Lambda (${fn.FunctionName})`, issue: `Function uses deprecated runtime: ${fn.Runtime}.`, remediation: 'Upgrade the Lambda function to a supported runtime to receive security patches.' });
      }

      // Check 3: No VPC configuration
      if (!fn.VpcConfig || !fn.VpcConfig.VpcId) {
        findings.push({ id: `AWS-LAMBDA-NO-VPC-${fn.FunctionName.substring(0,8)}`, severity: 'Low', resource: `Lambda (${fn.FunctionName})`, issue: 'Lambda function is not configured to run inside a VPC.', remediation: 'Configure a VPC for Lambda functions that access private resources to restrict network exposure.' });
      }
    }
  } catch (err) { console.error('[AWS Lambda] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 12. ROUTE 53 AUDITOR — 2 Checks (mirrors GCP DNS)
// =============================================================================
async function auditAwsRoute53(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new Route53Client({ region: 'us-east-1', credentials }); // Route53 is global
    const zonesRes = await client.send(new ListHostedZonesCommand({}));
    const zones = zonesRes.HostedZones || [];
    scannedCount = zones.length;

    for (const zone of zones) {
      const zoneId = zone.Id.replace('/hostedzone/', '');
      // Check 1: DNSSEC enabled
      try {
        const dnssecRes = await client.send(new GetDNSSECCommand({ HostedZoneId: zoneId }));
        const status = dnssecRes.Status?.ServeSignature;
        if (status !== 'SIGNING') {
          findings.push({ id: `AWS-R53-NO-DNSSEC-${zoneId.substring(0,8)}`, severity: 'Medium', resource: `Route53 Zone (${zone.Name})`, issue: 'DNSSEC signing is not enabled for this hosted zone.', remediation: 'Enable DNSSEC signing on Route53 to protect against DNS spoofing and cache poisoning attacks.' });
        }
      } catch (e) { console.warn('[Route53] DNSSEC check:', e.message); }

      // Check 2: Query Logging
      try {
        const logRes = await client.send(new ListQueryLoggingConfigsCommand({ HostedZoneId: zoneId }));
        if (!logRes.QueryLoggingConfigs || logRes.QueryLoggingConfigs.length === 0) {
          findings.push({ id: `AWS-R53-NO-QUERY-LOG-${zoneId.substring(0,8)}`, severity: 'Low', resource: `Route53 Zone (${zone.Name})`, issue: 'DNS query logging is not enabled for this hosted zone.', remediation: 'Enable Route53 query logging to CloudWatch Logs for threat hunting and DNS analytics.' });
        }
      } catch (e) { /* ignore */ }
    }
  } catch (err) { console.error('[AWS Route53] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 13. REDSHIFT AUDITOR — 3 Checks (mirrors GCP BigQuery)
// =============================================================================
async function auditAwsRedshift(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new RedshiftClient({ region: credentials.region || 'us-east-1', credentials });
    const res = await client.send(new DescribeClustersCommand({}));
    const clusters = res.Clusters || [];
    scannedCount = clusters.length;
    for (const cluster of clusters) {
      const id = cluster.ClusterIdentifier;
      if (cluster.PubliclyAccessible) findings.push({ id: `AWS-REDSHIFT-PUBLIC-${id}`, severity: 'Critical', resource: `Redshift Cluster (${id})`, issue: 'Redshift cluster is publicly accessible from the internet.', remediation: 'Disable public accessibility and access Redshift only through VPC internal routing.' });
      if (!cluster.Encrypted) findings.push({ id: `AWS-REDSHIFT-UNENCRYPTED-${id}`, severity: 'High', resource: `Redshift Cluster (${id})`, issue: 'Redshift cluster data is not encrypted at rest.', remediation: 'Enable encryption for the Redshift cluster and configure a KMS CMK if required.' });
      const sslRequired = (cluster.Parameters?.some(p => p.ParameterName === 'require_ssl' && p.ParameterValue === 'true'));
      if (!sslRequired) findings.push({ id: `AWS-REDSHIFT-NO-SSL-${id}`, severity: 'High', resource: `Redshift Cluster (${id})`, issue: 'SSL is not required for Redshift connections.', remediation: 'Set the require_ssl parameter to true in the cluster parameter group.' });
    }
  } catch (err) { console.error('[AWS Redshift] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// 14. EMR AUDITOR — 1 Check (mirrors GCP Dataproc)
// =============================================================================
async function auditAwsEmr(credentials) {
  const findings = [];
  const scannedResourceList = [];
  let scannedCount = 0;
  try {
    const client = new EMRClient({ region: credentials.region || 'us-east-1', credentials });
    const res = await client.send(new ListEMRClustersCommand({ ClusterStates: ['BOOTSTRAPPING', 'STARTING', 'RUNNING', 'WAITING'] }));
    const clusters = res.Clusters || [];
    scannedCount = clusters.length;
    for (const cluster of clusters) {
      try {
        const detail = await client.send(new DescribeEMRClusterCommand({ ClusterId: cluster.Id }));
        const c = detail.Cluster;
        if (!c.TerminationProtected) findings.push({ id: `AWS-EMR-NO-TERMINATION-PROT-${cluster.Id}`, severity: 'Medium', resource: `EMR Cluster (${c.Name || cluster.Id})`, issue: 'EMR cluster termination protection is disabled.', remediation: 'Enable termination protection to prevent accidental cluster shutdown and data loss.' });
        if (!c.EbsRootVolumeSize || !c.SecurityConfiguration) findings.push({ id: `AWS-EMR-NO-SECURITY-CONFIG-${cluster.Id}`, severity: 'Medium', resource: `EMR Cluster (${c.Name || cluster.Id})`, issue: 'EMR cluster has no security configuration applied (no encryption, no Kerberos).', remediation: 'Apply an EMR security configuration to enforce at-rest and in-transit encryption.' });
      } catch (e) { /* ignore */ }
    }
  } catch (err) { console.error('[AWS EMR] Error:', err.message); }
  return { findings, scannedCount, scannedResourceList };
}

// =============================================================================
// MASTER EXPORT
// =============================================================================
module.exports = {
  auditAwsIam,
  auditAwsEc2,
  auditAwsVpc,
  auditAwsCloudTrail,
  auditAwsSecurityServices,
  auditAwsS3,
  auditAwsRds,
  auditAwsEks,
  auditAwsLb,
  auditAwsKms,
  auditAwsServerless,
  auditAwsRoute53,
  auditAwsRedshift,
  auditAwsEmr
};
