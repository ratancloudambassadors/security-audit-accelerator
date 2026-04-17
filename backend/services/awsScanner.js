const { IAMClient, ListUsersCommand, ListAccessKeysCommand, GetAccountPasswordPolicyCommand } = require('@aws-sdk/client-iam');
const { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVolumesCommand } = require('@aws-sdk/client-ec2');
const { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand, GetBucketEncryptionCommand, GetBucketVersioningCommand } = require('@aws-sdk/client-s3');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { EKSClient, ListClustersCommand, DescribeClusterCommand } = require('@aws-sdk/client-eks');
const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeLoadBalancerAttributesCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { LambdaClient, ListFunctionsCommand, GetPolicyCommand } = require('@aws-sdk/client-lambda');
const { AppRunnerClient, ListServicesCommand } = require('@aws-sdk/client-apprunner');
const { KMSClient, ListKeysCommand, GetKeyRotationStatusCommand } = require('@aws-sdk/client-kms');

async function auditAwsIam(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const client = new IAMClient({ region: credentials.region || 'us-east-1', credentials });
    
    // Check Password Policy
    try {
      const policyData = await client.send(new GetAccountPasswordPolicyCommand({}));
      scannedCount++;
      const policy = policyData.PasswordPolicy;
      if (!policy || policy.MinimumPasswordLength < 14) {
        findings.push({
          id: 'AWS-IAM-PASSWORD-POLICY',
          severity: 'Medium',
          resource: 'IAM Account Password Policy',
          issue: 'Password policy does not enforce a minimum length of 14 characters.',
          remediation: 'Update IAM account password policy to require strong passwords with at least 14 characters.'
        });
      }
    } catch (err) {
      if (err.name === 'NoSuchEntityException') {
        findings.push({
          id: 'AWS-IAM-PASSWORD-POLICY-MISSING',
          severity: 'High',
          resource: 'IAM Account Password Policy',
          issue: 'No custom IAM password policy is defined for the account.',
          remediation: 'Configure a strong IAM password policy for all users.'
        });
      }
    }

    const data = await client.send(new ListUsersCommand({}));
    const users = data.Users || [];
    scannedCount += users.length;

    for (const user of users) {
      const keysData = await client.send(new ListAccessKeysCommand({ UserName: user.UserName }));
      const keys = keysData.AccessKeyMetadata || [];
      if (keys.length > 0) {
        findings.push({
          id: `AWS-IAM-USER-KEYS-${user.UserName}`,
          severity: 'Medium',
          resource: `IAM User (${user.UserName})`,
          issue: 'User has active long-term access keys. Temporary credentials (IAM Roles) are preferred.',
          remediation: 'Rotate keys every 90 days or switch to IAM Roles with temporary security tokens.'
        });
      }
    }
  } catch (err) { console.error('[AWS IAM] Error:', err.message); }
  return { findings, scannedCount };
}

async function auditAwsEc2(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const client = new EC2Client({ region: credentials.region || 'us-east-1', credentials });
    
    // 1. EC2 Instances
    const data = await client.send(new DescribeInstancesCommand({}));
    const reservations = data.Reservations || [];
    reservations.forEach(res => {
      (res.Instances || []).forEach(instance => {
        scannedCount++;
        if (instance.PublicIpAddress) {
          findings.push({
            id: `AWS-EC2-PUBLIC-IP-${instance.InstanceId}`,
            severity: 'High',
            resource: `EC2 Instance (${instance.InstanceId})`,
            issue: 'Instance is assigned a public IP address and is reachable from the internet.',
            remediation: 'Use a NAT Gateway or Elastic Load Balancer for egress/ingress instead of direct public IPs.'
          });
        }
        // Check Metadata Version (IMDSv2)
        if (instance.MetadataOptions?.HttpTokens !== 'required') {
           findings.push({
            id: `AWS-EC2-IMDSV1-ENABLED-${instance.InstanceId}`,
            severity: 'Critical',
            resource: `EC2 Instance (${instance.InstanceId})`,
            issue: 'EC2 instance metadata service allows IMDSv1 which is vulnerable to SSRF attacks.',
            remediation: 'Enforce IMDSv2 by requiring a token for metadata retrieval.'
          });
        }
      });
    });

    // 2. Security Groups
    const sgData = await client.send(new DescribeSecurityGroupsCommand({}));
    const sgs = sgData.SecurityGroups || [];
    scannedCount += sgs.length;
    sgs.forEach(sg => {
      // Check Default SG
      if (sg.GroupName === 'default') {
         const hasIngress = sg.IpPermissions?.length > 0;
         const hasEgress = sg.IpPermissionsEgress?.length > 0;
         if (hasIngress || hasEgress) {
            findings.push({
              id: `AWS-NET-DEFAULT-SG-${sg.GroupId}`,
              severity: 'Medium',
              resource: `Security Group (${sg.GroupId})`,
              issue: 'The default security group has active ingress or egress rules.',
              remediation: 'Remove all rules from the VPC default security group to enforce zero trust.'
            });
         }
      }

      (sg.IpPermissions || []).forEach(perm => {
        const isPublic = perm.IpRanges?.some(r => r.CidrIp === '0.0.0.0/0' || r.CidrIp === '::/0');
        if (isPublic) {
          if (perm.FromPort === 22) {
            findings.push({
              id: `AWS-NET-PUBLIC-SSH-${sg.GroupId}`,
              severity: 'Critical',
              resource: `Security Group (${sg.GroupName})`,
              issue: 'Inbound SSH (Port 22) is open to the entire internet (0.0.0.0/0).',
              remediation: 'Restrict SSH access to specific trusted CIDR ranges or use AWS Systems Manager Session Manager.'
            });
          }
          if (perm.FromPort === 3389) {
            findings.push({
              id: `AWS-NET-PUBLIC-RDP-${sg.GroupId}`,
              severity: 'Critical',
              resource: `Security Group (${sg.GroupName})`,
              issue: 'Inbound RDP (Port 3389) is open to the entire internet (0.0.0.0/0).',
              remediation: 'Restrict RDP access to trusted IPs or use a VPN/Bastion host.'
            });
          }
          if (!perm.FromPort || perm.IpProtocol === '-1') {
            findings.push({
              id: `AWS-NET-PUBLIC-ALL-${sg.GroupId}`,
              severity: 'Critical',
              resource: `Security Group (${sg.GroupName})`,
              issue: 'Security group allows all inbound traffic from any IP globally.',
              remediation: 'Implement principle of least privilege by specifying precise port protocols and trusted IP ranges.'
            });
          }
        }
      });
    });

    // 3. EBS Volumes
    try {
      const volData = await client.send(new DescribeVolumesCommand({}));
      const vols = volData.Volumes || [];
      scannedCount += vols.length;
      vols.forEach(v => {
        if (!v.Encrypted) {
          findings.push({
            id: `AWS-EBS-UNENCRYPTED-${v.VolumeId}`,
            severity: 'High',
            resource: `EBS Volume (${v.VolumeId})`,
            issue: 'EBS volume is not encrypted at rest.',
            remediation: 'Enable default EBS encryption for the account and migrate the volume to an encrypted snapshot.'
          });
        }
      });
    } catch (e) { /* Ignore */ }

  } catch (err) { console.error('[AWS EC2] Error:', err.message); }
  return { findings, scannedCount };
}

async function auditAwsS3(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const client = new S3Client({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new ListBucketsCommand({}));
    const buckets = data.Buckets || [];
    scannedCount = buckets.length * 3; // We do 3 checks per bucket

    for (const b of buckets) {
      // Check 1: Public Access Block Missing
      try {
        await client.send(new GetPublicAccessBlockCommand({ Bucket: b.Name }));
      } catch (err) {
        if (err.name === 'NoSuchPublicAccessBlockConfiguration') {
          findings.push({
            id: `AWS-S3-PUBLIC-BLOCK-MISSING-${b.Name}`,
            severity: 'High',
            resource: `S3 Bucket (${b.Name})`,
            issue: 'S3 Block Public Access is disabled or missing.',
            remediation: 'Enable "Block all public access" settings at the bucket or account level.'
          });
        }
      }

      // Check 2: Encryption disabled
      try {
        await client.send(new GetBucketEncryptionCommand({ Bucket: b.Name }));
      } catch (err) {
        if (err.name === 'ServerSideEncryptionConfigurationNotFoundError') {
           findings.push({
            id: `AWS-S3-UNENCRYPTED-${b.Name}`,
            severity: 'High',
            resource: `S3 Bucket (${b.Name})`,
            issue: 'S3 Default Server-Side Encryption is not configured.',
            remediation: 'Enable Amazon S3 Managed Keys (SSE-S3) or KMS Keys (SSE-KMS) on the bucket.'
          });
        }
      }

      // Check 3: Versioning Disabled
      try {
         const verData = await client.send(new GetBucketVersioningCommand({ Bucket: b.Name }));
         if (verData.Status !== 'Enabled') {
            findings.push({
              id: `AWS-S3-NO-VERSIONING-${b.Name}`,
              severity: 'Medium',
              resource: `S3 Bucket (${b.Name})`,
              issue: 'S3 Object Versioning is disabled, preying it to permanent data loss upon accidental overwrites.',
              remediation: 'Turn on bucket versioning to ensure object safety and ransomware recovery.'
            });
         }
      } catch (err) { /* Ignored */ }
    }
  } catch (err) { console.error('[AWS S3] Error:', err.message); }
  return { findings, scannedCount };
}

async function auditAwsRds(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const client = new RDSClient({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new DescribeDBInstancesCommand({}));
    const dbs = data.DBInstances || [];
    scannedCount = dbs.length;

    for (const db of dbs) {
      if (db.PubliclyAccessible) {
        findings.push({
          id: `AWS-RDS-PUBLIC-ACCESS-${db.DBInstanceIdentifier}`,
          severity: 'Critical',
          resource: `RDS Instance (${db.DBInstanceIdentifier})`,
          issue: 'RDS instance is publicly accessible from the internet.',
          remediation: 'Modify the instance to disable "Public Accessibility" and move it to a private subnet.'
        });
      }
      if (!db.StorageEncrypted) {
         findings.push({
          id: `AWS-RDS-UNENCRYPTED-${db.DBInstanceIdentifier}`,
          severity: 'High',
          resource: `RDS Instance (${db.DBInstanceIdentifier})`,
          issue: 'RDS instance storage is not encrypted at rest.',
          remediation: 'Launch a new encrypted RDS instance and migrate data to it or restore from an encrypted snapshot.'
        });
      }
      if (!db.MultiAZ) {
        findings.push({
          id: `AWS-RDS-NO-MULTIAZ-${db.DBInstanceIdentifier}`,
          severity: 'Medium',
          resource: `RDS Instance (${db.DBInstanceIdentifier})`,
          issue: 'Multi-AZ deployment is completely disabled.',
          remediation: 'Enable Multi-AZ to guarantee high availability and failover for mission-critical databases.'
        });
      }
      if (!db.DeletionProtection) {
        findings.push({
          id: `AWS-RDS-NO-DEL-PROTECTION-${db.DBInstanceIdentifier}`,
          severity: 'Low',
          resource: `RDS Instance (${db.DBInstanceIdentifier})`,
          issue: 'RDS instance has deletion protection disabled.',
          remediation: 'Enable deletion protection to prevent accidental or malicious destruction of database.'
        });
      }
    }
  } catch (err) { console.error('[AWS RDS] Error:', err.message); }
  return { findings, scannedCount };
}

async function auditAwsEks(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const client = new EKSClient({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new ListClustersCommand({}));
    const clusterNames = data.clusters || [];
    scannedCount = clusterNames.length;

    for (const name of clusterNames) {
      const clusterData = await client.send(new DescribeClusterCommand({ name }));
      const cluster = clusterData.cluster;
      
      // Check Public Endpoint
      if (cluster.resourcesVpcConfig?.endpointPublicAccess) {
        findings.push({
          id: `AWS-EKS-PUBLIC-ENDPOINT-${name}`,
          severity: 'High',
          resource: `EKS Cluster (${name})`,
          issue: 'EKS cluster endpoint has public access enabled.',
          remediation: 'Disable public access to the EKS endpoint or restrict it to authorized CIDR ranges.'
        });
      }

      // Check Control Plane Logging
      const loggingEnabled = cluster.logging?.clusterLogging?.some(log => log.enabled);
      if (!loggingEnabled) {
         findings.push({
          id: `AWS-EKS-NO-LOGGING-${name}`,
          severity: 'Medium',
          resource: `EKS Cluster (${name})`,
          issue: 'EKS Control Plane Logging is entirely disabled.',
          remediation: 'Turn on EKS API, audit, authenticator, controller manager, and scheduler logs for forensics.'
        });
      }
    }
  } catch (err) { console.error('[AWS EKS] Error:', err.message); }
  return { findings, scannedCount };
}

async function auditAwsLb(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const client = new ElasticLoadBalancingV2Client({ region: credentials.region || 'us-east-1', credentials });
    const data = await client.send(new DescribeLoadBalancersCommand({}));
    const lbs = data.LoadBalancers || [];
    scannedCount = lbs.length;

    for (const lb of lbs) {
      const attrData = await client.send(new DescribeLoadBalancerAttributesCommand({ LoadBalancerArn: lb.LoadBalancerArn }));
      const attrs = attrData.Attributes || [];
      const delProtection = attrs.find(a => a.Key === 'deletion_protection.enabled')?.Value === 'true';
      const dropInvalidHeaders = attrs.find(a => a.Key === 'routing.http.drop_invalid_header_fields.enabled')?.Value === 'true';

      if (!delProtection) {
        findings.push({
          id: `AWS-ELB-NO-DEL-PROTECTION-${lb.LoadBalancerName}`,
          severity: 'Low',
          resource: `Load Balancer (${lb.LoadBalancerName})`,
          issue: 'Deletion protection is disabled for this load balancer.',
          remediation: 'Enable deletion protection to prevent accidental removal of the load balancer.'
        });
      }
      
      if (!dropInvalidHeaders && lb.Type === 'application') {
         findings.push({
          id: `AWS-ELB-NO-INVALID-HEADERS-DROP-${lb.LoadBalancerName}`,
          severity: 'Medium',
          resource: `Application Load Balancer (${lb.LoadBalancerName})`,
          issue: 'Defensive dropping of invalid HTTP headers is not enabled, leaving downstream susceptible to desync attacks.',
          remediation: 'Configure the load balancer to forcefully drop HTTP headers with invalid header fields.'
        });
      }
    }
  } catch (err) { console.error('[AWS ELB] Error:', err.message); }
  return { findings, scannedCount };
}

async function auditAwsKms(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const client = new KMSClient({ region: credentials.region || 'us-east-1', credentials });
    const res = await client.send(new ListKeysCommand({}));
    const keys = res.Keys || [];
    scannedCount = keys.length;
    
    for (const key of keys) {
      try {
         const rotRes = await client.send(new GetKeyRotationStatusCommand({ KeyId: key.KeyId }));
         if (!rotRes.KeyRotationEnabled) {
            findings.push({
              id: `AWS-KMS-NO-ROTATION-${key.KeyId}`,
              severity: 'Medium',
              resource: `KMS Client Key (${key.KeyId})`,
              issue: 'Automatic key rotation is not enabled on this customer managed KMS key.',
              remediation: 'Enable automated annual key rotation for all symmetric CMKs to comply with standard cryptographic hygiene.'
            });
         }
      } catch (err) { /* Ignored */ }
    }
  } catch (err) { console.error('[AWS KMS] Error:', err.message); }
  return { findings, scannedCount };
}

async function auditAwsServerless(credentials) {
  const findings = [];
  let scannedCount = 0;
  try {
    const region = credentials.region || 'us-east-1';
    const lambda = new LambdaClient({ region, credentials });
    
    try {
      const fnRes = await lambda.send(new ListFunctionsCommand({}));
      const functions = fnRes.Functions || [];
      scannedCount += functions.length;

      for (const fn of functions) {
        try {
          const policyRes = await lambda.send(new GetPolicyCommand({ FunctionName: fn.FunctionName }));
          const policy = JSON.parse(policyRes.Policy);
          const isPublic = (policy.Statement || []).some(s => 
            s.Principal === '*' || s.Principal?.AWS === '*' || s.Principal?.Service === '*'
          );
          if (isPublic) {
            findings.push({
              id: `AWS-LAMBDA-PUBLIC-POLICY-${fn.FunctionName}`,
              severity: 'High',
              resource: `Lambda Function (${fn.FunctionName})`,
              issue: 'Lambda function has a resource-based policy that allows access from any principal ("*").',
              remediation: 'Restrict the resource-based policy to specific AWS accounts or services.'
            });
          }
        } catch (e) { /* no policy */ }
      }
    } catch (e) { /* lambda list error */ }

  } catch (err) { console.error('[AWS Serverless] Error:', err.message); }
  return { findings, scannedCount };
}

module.exports = {
  auditAwsIam,
  auditAwsEc2,
  auditAwsS3,
  auditAwsRds,
  auditAwsEks,
  auditAwsLb,
  auditAwsKms,
  auditAwsServerless
};
