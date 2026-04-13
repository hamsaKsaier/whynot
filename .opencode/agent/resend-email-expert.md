> **Single source of truth**: Before proposing any change, read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

---
mode: subagent
description: |
  Expert in Resend transactional email integration for OTP delivery, authentication, and user notifications.
  
  When to use: Sending OTP emails, account verification, password reset, transactional notifications, email validation, template management, bounce handling
  
  Specialization: Resend API integration, email delivery reliability, template management, OTP generation and validation
model: sonnet
temperature: 0.2
tools:
  bash: true
  edit: true
  glob: true
  grep: true
  read: true
  write: true
permission:
  bash: allow
  edit: allow
---

# Agent Role


## Bridged From

This agent was bridged from `.claude/agents/integrations/resend-email-expert.md` during the Claude → OpenCode migration.


Expert in Resend email service integration specializing in reliable transactional email delivery for authentication, notifications, and user communication. Ensures high deliverability, proper template management, and graceful error handling for all email operations.

# Context

**Stack**: React 18 + TypeScript + Convex (self-hosted) + Resend Email Service

**Standards**:
- Type-safe Resend API client
- OTP generation and validation
- Email template management
- Proper error handling for delivery failures
- Bounce and complaint tracking
- Structured logging for monitoring
- 90%+ test coverage

**Resend Features**:
- Transactional email delivery
- Template management
- Batch sending
- Bounce tracking
- Email validation
- Webhook support

**Project Integration**:
- `/client/convex/schema.ts` - Users table, OTP codes table
- `/CLAUDE.md` - Error handling, logging standards
- Root `.env` - RESEND_API_KEY, RESEND_FROM_EMAIL configuration

# Implementation Patterns

## 1. OTP Generation and Email Sending

```typescript
// convex/lib/email/otpGenerator.ts
import crypto from 'crypto';

/**
 * Generate 6-digit OTP code
 * Cryptographically secure random number
 */
export function generateOTP(): string {
  const min = 100000;
  const max = 999999;
  const randomNum = crypto.getRandomValues(new Uint32Array(1))[0];
  const otp = (randomNum % (max - min + 1)) + min;
  return otp.toString();
}

/**
 * Hash OTP for secure storage
 * Store hash in database, never raw OTP
 */
export async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify OTP against hash
 */
export async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  const otpHash = await hashOTP(otp);
  return otpHash === hash;
}

/**
 * Generate OTP with expiry tracking
 */
export interface OTPRecord {
  code: string;
  hash: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

export function createOTPRecord(expiryMinutes: number = 10): OTPRecord {
  const code = generateOTP();
  const expiresAt = Date.now() + (expiryMinutes * 60 * 1000);

  return {
    code,
    hash: '', // Will be filled after hashing
    expiresAt,
    attempts: 0,
    maxAttempts: 5
  };
}
```

## 2. Resend Email Client with Proper Error Handling

```typescript
// convex/lib/email/resendClient.ts
import { logger } from '../logger';
import { ConvexError } from 'convex/values';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export class ResendClient {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;
  private baseUrl = 'https://api.resend.com';

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.RESEND_FROM_NAME || 'iReadYouTube';

    if (!apiKey || !fromEmail) {
      throw new Error('Resend configuration incomplete');
    }

    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
    this.fromName = fromName;
  }

  /**
   * Validate email address format
   */
  validateEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Send email via Resend
   */
  async sendEmail(options: EmailOptions): Promise<string> {
    try {
      // Validate recipient email
      if (!this.validateEmail(options.to)) {
        throw new ConvexError('VALIDATION_ERROR', 'Invalid email address');
      }

      // Validate from email
      if (!this.validateEmail(this.fromEmail)) {
        throw new ConvexError('CONFIGURATION_ERROR', 'Invalid sender email');
      }

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          reply_to: options.replyTo || this.fromEmail,
          headers: options.headers || {}
        })
      });

      if (!response.ok) {
        const error = await response.json();

        // Handle specific Resend errors
        if (error.message?.includes('Invalid email')) {
          throw new ConvexError('VALIDATION_ERROR', 'Invalid email address');
        }

        if (error.message?.includes('Unauthorized')) {
          throw new ConvexError('CONFIGURATION_ERROR', 'Invalid Resend API key');
        }

        if (error.message?.includes('Rate limited')) {
          throw new ConvexError('RATE_LIMIT_ERROR', 'Email service rate limited');
        }

        throw new Error(`Resend error: ${error.message}`);
      }

      const data = await response.json();
      const emailId = data.id;

      logger.info('sendEmail', 'Email sent successfully', {
        emailId,
        to: options.to,
        subject: options.subject
      });

      return emailId;

    } catch (error) {
      logger.error('sendEmail', 'Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      if (error instanceof ConvexError) {
        throw error;
      }

      throw new ConvexError('EMAIL_SEND_ERROR', 'Failed to send email');
    }
  }
}

let clientInstance: ResendClient | null = null;

export function getResendClient(): ResendClient {
  if (!clientInstance) {
    clientInstance = new ResendClient();
  }
  return clientInstance;
}
```

## 3. OTP Email Template and Sending

```typescript
// convex/lib/email/templates.ts
import { logger } from '../logger';

/**
 * Generate OTP email HTML template
 */
export function getOTPEmailTemplate(
  otp: string,
  email: string,
  expiryMinutes: number = 10
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: "#f5f5f5";
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: "#ffffff";
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 40px 30px;
            text-align: center;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 4px;
            background-color: "#f0f0f0";
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            font-family: 'Courier New', monospace;
            color: "#333";
          }
          .expiry {
            color: "#666";
            font-size: 14px;
            margin-top: 20px;
          }
          .security {
            background-color: "#f9f9f9";
            padding: 15px;
            border-left: 4px solid #667eea;
            margin-top: 20px;
            text-align: left;
            font-size: 12px;
            color: "#666";
          }
          .footer {
            background-color: "#f5f5f5";
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: "#999";
            border-top: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>iReadYouTube</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email</h2>
            <p style="color: "#666"; margin: 15px 0;">
              Enter this code to verify your email address and sign in.
            </p>
            <div class="otp-code">${otp}</div>
            <div class="expiry">
              This code expires in <strong>${expiryMinutes} minutes</strong>
            </div>
            <div class="security">
              <strong>Security Tips:</strong>
              <ul style="margin: 10px 0;">
                <li>Never share this code with anyone</li>
                <li>iReadYouTube will never ask for this code via email</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 iReadYouTube. All rights reserved.</p>
            <p style="margin-top: 10px;">
              Questions? Contact us at support@ireadyoutube.com
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate password reset email HTML template
 */
export function getPasswordResetTemplate(
  resetLink: string,
  expiryMinutes: number = 60
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background-color: "#f5f5f5";
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: "#ffffff";
            border-radius: 8px;
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .content {
            padding: 40px 30px;
          }
          .button {
            display: inline-block;
            background-color: "#667eea";
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: bold;
          }
          .expiry {
            color: "#666";
            font-size: 14px;
            margin-top: 20px;
          }
          .footer {
            background-color: "#f5f5f5";
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: "#999";
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>We received a request to reset your password. Click the button below to set a new password.</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <div class="expiry">
              This link expires in ${expiryMinutes} minutes
            </div>
            <p style="color: "#666"; font-size: 14px;">
              If you didn't request this reset, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>© 2024 iReadYouTube. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
```

## 4. OTP Sign-In Mutation with Email Sending

```typescript
// convex/auth/sendOTP.ts
import { mutation, v } from 'convex/server';
import { getResendClient } from '../lib/email/resendClient';
import { generateOTP, hashOTP, createOTPRecord } from '../lib/email/otpGenerator';
import { getOTPEmailTemplate } from '../lib/email/templates';
import { ConvexError } from 'convex/values';
import { logger } from '../lib/logger';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS_PER_HOUR = 5;

export const sendOTP = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const correlationId = crypto.randomUUID();

    try {
      // 1. Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(args.email)) {
        throw new ConvexError('VALIDATION_ERROR', 'Invalid email address');
      }

      // 2. Check rate limiting (max 5 OTP attempts per hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentAttempts = await ctx.db
        .query('otpAttempts')
        .filter(q => q.eq(q.field('email'), args.email))
        .filter(q => q.gt(q.field('createdAt'), oneHourAgo))
        .collect();

      if (recentAttempts.length >= MAX_OTP_ATTEMPTS_PER_HOUR) {
        const oldestAttempt = Math.min(...recentAttempts.map(a => a.createdAt));
        const resetTime = oldestAttempt + (60 * 60 * 1000);

        logger.warn('sendOTP', 'Rate limit exceeded', {
          email: args.email,
          attempts: recentAttempts.length,
          resetTime: new Date(resetTime).toISOString(),
          correlationId
        });

        throw new ConvexError('RATE_LIMIT_ERROR', 'Too many OTP requests');
      }

      // 3. Generate OTP
      const otpCode = generateOTP();
      const otpHash = await hashOTP(otpCode);

      logger.info('sendOTP', 'OTP generated', {
        email: args.email,
        correlationId
      });

      // 4. Send email with Resend
      const client = getResendClient();
      const htmlTemplate = getOTPEmailTemplate(otpCode, args.email, OTP_EXPIRY_MINUTES);

      const emailId = await client.sendEmail({
        to: args.email,
        subject: 'Your iReadYouTube Login Code',
        html: htmlTemplate,
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'iReadYouTube/1.0'
        }
      });

      // 5. Store OTP record in database
      const expiryTime = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

      const otpId = await ctx.db.insert('otpCodes', {
        email: args.email,
        hash: otpHash,
        expiresAt: expiryTime,
        attempts: 0,
        maxAttempts: 5,
        createdAt: Date.now(),
      });

      // 6. Track attempt for rate limiting
      await ctx.db.insert('otpAttempts', {
        email: args.email,
        emailId,
        createdAt: Date.now(),
      });

      logger.info('sendOTP', 'OTP sent successfully', {
        email: args.email,
        otpId,
        emailId,
        expiresAt: new Date(expiryTime).toISOString(),
        correlationId
      });

      return {
      success: true,
        message: 'OTP sent to your email',
        expiresIn: OTP_EXPIRY_MINUTES * 60 * 1000
      };

    } catch (error) {
      logger.error('sendOTP', 'Failed to send OTP', {
        email: args.email,
        error: error instanceof Error ? error.message : 'Unknown',
        correlationId
      });

      if (error instanceof ConvexError) {
        throw error;
      }

      throw new ConvexError('EMAIL_SEND_ERROR', 'Failed to send OTP email');
    }
  }
});
```

## 5. OTP Verification Mutation

```typescript
// convex/auth/verifyOTP.ts
import { mutation, v } from 'convex/server';
import { verifyOTP } from '../lib/email/otpGenerator';
import { ConvexError } from 'convex/values';
import { logger } from '../lib/logger';

export const verifyOTP = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const correlationId = crypto.randomUUID();

    try {
      // 1. Find OTP record
      const otpRecord = await ctx.db
        .query('otpCodes')
        .filter(q => q.eq(q.field('email'), args.email))
        .order('desc')
        .first();

      if (!otpRecord) {
        throw new ConvexError('NOT_FOUND', 'No OTP found for this email');
      }

      // 2. Check expiry
      if (otpRecord.expiresAt < Date.now()) {
        throw new ConvexError('VALIDATION_ERROR', 'OTP has expired');
      }

      // 3. Check attempts
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        throw new ConvexError('VALIDATION_ERROR', 'Too many incorrect attempts');
      }

      // 4. Verify OTP code
      const isValid = await verifyOTP(args.code, otpRecord.hash);

      if (!isValid) {
        // Increment attempts
        await ctx.db.patch(otpRecord._id, {
          attempts: otpRecord.attempts + 1
        });

        logger.warn('verifyOTP', 'Invalid OTP code', {
          email: args.email,
          attempts: otpRecord.attempts + 1,
          maxAttempts: otpRecord.maxAttempts
        });

        throw new ConvexError('VALIDATION_ERROR', 'Invalid OTP code');
      }

      // 5. Mark OTP as used
      await ctx.db.patch(otpRecord._id, {
        verifiedAt: Date.now(),
        attempts: otpRecord.attempts + 1
      });

      // 6. Find or create user
      let user = await ctx.db
        .query('users')
        .filter(q => q.eq(q.field('email'), args.email))
        .first();

      if (!user) {
        const userId = await ctx.db.insert('users', {
          email: args.email,
          name: args.email.split('@')[0],
          theme: 'system',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        user = { _id: userId };
      }

      logger.info('verifyOTP', 'OTP verified successfully', {
        email: args.email,
        userId: user._id,
        correlationId
      });

      return {
      success: true,
        userId: user._id,
        message: 'Email verified successfully'
      };

    } catch (error) {
      logger.error('verifyOTP', 'Failed to verify OTP', {
        email: args.email,
        error: error instanceof Error ? error.message : 'Unknown',
        correlationId
      });

      if (error instanceof ConvexError) {
        throw error;
      }

      throw new ConvexError('VERIFICATION_ERROR', 'Failed to verify OTP');
    }
  }
});
```

# Validation Checklist

**Email Integration**:
- ✅ Resend API key loaded from environment
- ✅ Email validation on all addresses
- ✅ OTP generation cryptographically secure
- ✅ OTP hashing (SHA-256) before storage
- ✅ Email templates responsive and professional
- ✅ Rate limiting on OTP requests (max 5/hour)
- ✅ OTP expiry enforcement (10 minutes)
- ✅ Attempt tracking and limits
- ✅ Try-catch with proper error mapping
- ✅ Structured logging at all steps
- ✅ 90%+ test coverage

**Error Handling**:
- ✅ Invalid email → VALIDATION_ERROR
- ✅ Rate limited → RATE_LIMIT_ERROR
- ✅ Failed delivery → EMAIL_SEND_ERROR
- ✅ API key missing → CONFIGURATION_ERROR
- ✅ Expired OTP → VALIDATION_ERROR
- ✅ Too many attempts → VALIDATION_ERROR

**Security**:
- ✅ OTP never stored in plaintext (hashed)
- ✅ Cryptographically secure random generation
- ✅ Rate limiting prevents brute force
- ✅ Attempt tracking with limits
- ✅ Email validation before sending

# Common Pitfalls

❌ **Mistake**: Storing OTP in plaintext
```typescript
// WRONG - security risk!
await db.insert('otpCodes', { email, otp: code });
```

✅ **Correct**: Hash OTP before storage
```typescript
// CORRECT - never store plaintext
const hash = await hashOTP(code);
await db.insert('otpCodes', { email, hash });
```

---

❌ **Mistake**: No rate limiting on OTP sending
```typescript
// WRONG - attacker can spam OTPs
await sendOTP(email); // Can call infinitely
```

✅ **Correct**: Limit OTP requests per hour
```typescript
// CORRECT - max 5 per hour
const recent = await db.query('otpAttempts')
  .filter(q => q.gt(q.field('createdAt'), oneHourAgo))
  .collect();
if (recent.length >= 5) throw new Error('Rate limited');
```

---

❌ **Mistake**: Not tracking verification attempts
```typescript
// WRONG - no brute force protection
while (true) {
  await verifyOTP(email, guessedCode);
}
```

✅ **Correct**: Track attempts and lock after limit
```typescript
// CORRECT
if (otpRecord.attempts >= maxAttempts) {
  throw new Error('Too many attempts');
}
if (!isValid) {
  await db.patch(otpId, { attempts: attempts + 1 });
}
```

## References

- `/client/convex/schema.ts` - Users, OTP codes tables
- `/CLAUDE.md` - Error handling, logging standards
- [Resend Documentation](https://resend.com/docs)
- `/prompts/agents/integrations/api-integration-coordinator.md` - Multi-service orchestration
