# AWS Secrets Manager Integration

This document explains how to set up and use AWS Secrets Manager with the Customer Portal Backend application.

## Overview

The application now supports loading secrets from AWS Secrets Manager during startup. This allows you to store sensitive configuration data (like database passwords, API keys, etc.) securely in AWS instead of environment variables.

## Setup

### 1. AWS Configuration

Add the following environment variables to your `.env` file:

```env
# AWS Secrets Manager Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_SECRET_NAME=your-secret-name
```

### 2. Create Secret in AWS Secrets Manager

1. Go to AWS Secrets Manager in your AWS Console
2. Create a new secret
3. Choose "Other type of secret"
4. Add your key-value pairs (e.g., database passwords, API keys)
5. Give your secret a name (this will be your `AWS_SECRET_NAME`)

Example secret structure:
```json
{
  "DATABASE_PASSWORD": "your-database-password",
  "JWT_SECRET": "your-jwt-secret",
  "SENDGRID_API_KEY": "your-sendgrid-api-key",
  "AUTH0_CLIENT_SECRET": "your-auth0-client-secret"
}
```

### 3. IAM Permissions

Ensure your AWS credentials have the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:SECRET_NAME*"
    }
  ]
}
```

## How It Works

1. **Application Startup**: When the application starts, it first loads environment variables from the `.env` file
2. **Secrets Loading**: If AWS Secrets Manager is configured, it loads secrets from AWS and merges them with existing environment variables
3. **Fallback**: If AWS Secrets Manager is not configured or fails to load, the application continues with existing environment variables

## Features

- **Non-blocking**: If AWS Secrets Manager is not configured, the application continues normally
- **Error Handling**: Graceful error handling with detailed logging
- **Type Safety**: Full TypeScript support with proper interfaces
- **Security**: Secrets are loaded once at startup and stored in memory

## Usage

### Automatic Loading

Secrets are automatically loaded during application startup. No additional code is required.

### Manual Access

You can also access the secrets manager service directly:

```typescript
import { secretsManagerService } from './src/services/secretsManager.service';

// Check if secrets are enabled
if (SecretsManagerService.isSecretsEnabled()) {
  // Load secrets
  const success = await secretsManagerService.loadSecrets();
  
  // Get a specific secret
  const secretValue = await secretsManagerService.getSecretValue('DATABASE_PASSWORD');
}
```

## Environment Variables

The following environment variables are required for AWS Secrets Manager:

| Variable | Description | Required |
|----------|-------------|----------|
| `AWS_REGION` | AWS region where your secret is stored | Yes |
| `AWS_ACCESS_KEY_ID` | AWS access key ID | Yes |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | Yes |
| `AWS_SECRET_NAME` | Name of the secret in AWS Secrets Manager | Yes |

## Troubleshooting

### Common Issues

1. **"AWS_REGION environment variable is required"**
   - Make sure you have set the `AWS_REGION` environment variable

2. **"Access Denied" errors**
   - Check your AWS credentials and IAM permissions
   - Ensure the secret exists and is accessible

3. **"Secret not found"**
   - Verify the `AWS_SECRET_NAME` matches exactly with your secret name in AWS
   - Check that the secret is in the correct region

### Logs

The application provides detailed logging for secrets loading:

```
Starting application initialization...
Environment variables loaded from .env file
AWS Secrets Manager configuration detected
Loading secrets from AWS Secrets Manager: your-secret-name
Successfully loaded secrets from AWS Secrets Manager
Loaded 5 secrets
Application initialization completed successfully
```

## Security Best Practices

1. **Use IAM Roles**: In production, use IAM roles instead of access keys when possible
2. **Least Privilege**: Grant only the minimum required permissions
3. **Secret Rotation**: Enable automatic secret rotation in AWS Secrets Manager
4. **Encryption**: Ensure secrets are encrypted at rest and in transit
5. **Monitoring**: Set up CloudWatch alarms for secret access

## Migration from Environment Variables

To migrate from environment variables to AWS Secrets Manager:

1. Create a secret in AWS Secrets Manager with your current environment variables
2. Add AWS configuration to your `.env` file
3. Remove sensitive values from your `.env` file (keep non-sensitive ones)
4. Test the application to ensure secrets are loaded correctly

## Support

For issues or questions regarding AWS Secrets Manager integration, please check the application logs and AWS CloudWatch logs for detailed error information.
