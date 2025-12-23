# Google Cloud Storage - ADC Setup Guide

## Overview
The application now uses **Application Default Credentials (ADC)** for Google Cloud Storage, which means:
- ✅ **No credentials needed** when deployed to GCP (Cloud Run, App Engine, GKE)
- ✅ **Automatic authentication** using the service account attached to your GCP resource
- ✅ **Only bucket name required** in production
- ⚠️ **Service account credentials needed** for local development only

## How It Works

### Production (GCP Deployment)
When deployed to Google Cloud Platform:
```bash
# .env (Production)
GCS_BUCKET_NAME=starteasedev
GCS_PROJECT_ID=your-project-id
# GCS_CREDENTIALS is NOT needed - ADC is used automatically
```

The code automatically detects it's running on GCP and uses ADC:
```typescript
// No credentials provided → Uses ADC
storage = new Storage({
  projectId: projectId, // Optional: ADC can auto-detect
});
```

### Local Development
For local testing, you need service account credentials:
```bash
# .env (Local)
GCS_BUCKET_NAME=starteasedev
GCS_PROJECT_ID=your-project-id
GCS_CREDENTIALS=/path/to/service-account-key.json
```

## Setup Instructions

### 1. For GCP Deployment (Cloud Run, App Engine, GKE)

#### Step 1: Create/Configure Service Account
```bash
# Create a service account for your GCP resource
gcloud iam service-accounts create startease-storage \
  --display-name="StartEase Storage Service Account"

# Grant Storage Object Admin role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:startease-storage@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

#### Step 2: Attach Service Account to Your GCP Resource

**For Cloud Run:**
```bash
gcloud run deploy startease-backend \
  --service-account=startease-storage@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="GCS_BUCKET_NAME=starteasedev,GCS_PROJECT_ID=YOUR_PROJECT_ID"
```

**For App Engine:**
Add to `app.yaml`:
```yaml
service_account: startease-storage@YOUR_PROJECT_ID.iam.gserviceaccount.com
env_variables:
  GCS_BUCKET_NAME: starteasedev
  GCS_PROJECT_ID: YOUR_PROJECT_ID
```

**For GKE:**
Add to your deployment:
```yaml
spec:
  serviceAccountName: startease-storage
  containers:
  - name: backend
    env:
    - name: GCS_BUCKET_NAME
      value: starteasedev
    - name: GCS_PROJECT_ID
      value: YOUR_PROJECT_ID
```

#### Step 3: Deploy
That's it! No credentials file needed. ADC will automatically authenticate.

### 2. For Local Development

#### Step 1: Create Service Account Key
```bash
# Create service account (if not exists)
gcloud iam service-accounts create startease-local \
  --display-name="StartEase Local Development"

# Grant Storage Object Admin role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:startease-local@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Create and download key
gcloud iam service-accounts keys create ~/startease-gcs-key.json \
  --iam-account=startease-local@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### Step 2: Configure .env
```bash
# .env
GCS_BUCKET_NAME=starteasedev
GCS_PROJECT_ID=your-project-id
GCS_CREDENTIALS=/Users/yourname/startease-gcs-key.json
```

#### Step 3: Run Locally
```bash
npm run dev
```

You'll see: `🔑 Using service account credentials for GCS`

## Environment Variables

### Required (Both Local & Production)
```bash
GCS_BUCKET_NAME=starteasedev        # Your GCS bucket name
GCS_PROJECT_ID=your-project-id      # Your GCP project ID
```

### Optional (Local Development Only)
```bash
GCS_CREDENTIALS=/path/to/key.json   # Service account key file
# OR
GCS_CREDENTIALS='{"type":"service_account",...}'  # Inline JSON
```

## Verification

### Check Logs on Startup
**Production (ADC):**
```
☁️  Using Application Default Credentials (ADC) for GCS
✅ Google Cloud Storage initialized successfully
```

**Local (Service Account):**
```
🔑 Using service account credentials for GCS
✅ Google Cloud Storage initialized successfully
```

### Test Upload
Upload a document through the UI and verify:
1. File appears in GCS bucket: `gs://starteasedev/businesses/{id}/products/{id}/...`
2. No authentication errors in logs
3. File URL is accessible

## Troubleshooting

### Error: "Could not load the default credentials"
**On GCP:**
- Ensure service account is attached to your resource
- Verify service account has `roles/storage.objectAdmin` permission
- Check `GCS_PROJECT_ID` matches your project

**Locally:**
- Ensure `GCS_CREDENTIALS` points to valid key file
- Verify key file has correct permissions
- Try using inline JSON instead of file path

### Error: "Access Denied"
```bash
# Grant storage permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/storage.objectAdmin"
```

### Error: "Bucket not found"
```bash
# Verify bucket exists
gsutil ls gs://starteasedev

# Create bucket if needed
gsutil mb -p YOUR_PROJECT_ID gs://starteasedev
```

## Security Best Practices

1. **Use separate service accounts** for local vs production
2. **Grant minimum permissions** (Storage Object Admin only)
3. **Never commit** service account keys to git
4. **Rotate keys regularly** for local development
5. **Use workload identity** on GKE for enhanced security

## Migration Checklist

- [x] Updated `gcs.ts` to use ADC
- [x] Updated `.env.example` with ADC documentation
- [x] Backend builds successfully
- [ ] Create GCP service account
- [ ] Attach service account to GCP resource
- [ ] Set environment variables in GCP
- [ ] Deploy to GCP
- [ ] Test document upload in production
- [ ] Verify files appear in GCS bucket

## Summary

✅ **Production**: Only need `GCS_BUCKET_NAME` and `GCS_PROJECT_ID`  
✅ **Local**: Also need `GCS_CREDENTIALS` for testing  
✅ **Automatic**: ADC handles authentication on GCP  
✅ **Secure**: No credentials in code or environment (production)  
✅ **Simple**: Just attach service account to your GCP resource
