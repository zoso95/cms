# Authentication Setup

## Overview
Authentication has been implemented using Supabase Auth. All API routes (except webhooks) now require authentication.

## Environment Variables

### Backend (.env)
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Frontend (.env)
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AUTH_REDIRECT_URL=http://localhost:3000  # For local dev
```

**Note:** Frontend environment variables MUST have the `VITE_` prefix to be accessible in the browser.

## Supabase Configuration

You MUST configure Supabase to allow redirects to this CMS:

1. Go to **Supabase Dashboard > Authentication > URL Configuration**
2. Add your CMS URL to **Redirect URLs**:
   - For local dev: `http://localhost:3000`
   - For production: `https://cms.yourdomain.com`
   - You can add multiple URLs (comma-separated)

**Why?** Supabase only allows redirects to pre-approved URLs. If you're being redirected to another website after clicking the magic link, it's because that other website is configured as the default and this CMS isn't in the allowed list.

## What Was Implemented

### Backend
1. **Auth Middleware** (`backend/src/middleware/auth.ts`)
   - Validates Supabase JWT tokens from `Authorization: Bearer <token>` header
   - Attaches user info to request object

2. **Route Protection** (`backend/src/routes/index.ts`)
   - All `/api/*` routes require authentication
   - `/api/webhooks/*` routes are NOT protected (external services need access)
   - `/api/webhooks/elevenlabs/conversation` is also NOT protected (registered separately)

### Frontend
1. **Supabase Client** (`frontend/src/lib/supabase.ts`)
   - Configured with environment variables

2. **Auth Context** (`frontend/src/contexts/AuthContext.tsx`)
   - Manages auth state (user, session, loading)
   - Provides `signIn` and `signOut` functions
   - Listens for auth state changes

3. **API Client** (`frontend/src/api/client.ts`)
   - Automatically includes JWT token in all API requests
   - Gets token from Supabase session

4. **Login Page** (`frontend/src/pages/Login.tsx`)
   - Simple email/password login form
   - Error handling
   - Redirects to dashboard on success

5. **Protected Routes** (`frontend/src/components/ProtectedRoute.tsx`)
   - Redirects to `/login` if user not authenticated
   - Shows loading state while checking auth

6. **Layout Updates** (`frontend/src/components/Layout.tsx`)
   - Shows user email in header
   - Includes Sign Out button

7. **App Routes** (`frontend/src/App.tsx`)
   - `/login` - public
   - `/` and `/cases/:id` - protected
   - All routes wrapped with `AuthProvider`

## Creating Users

You can create users in Supabase Dashboard:

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User"
3. Enter email address
4. You can either:
   - Set a password (for password-based login)
   - Leave password blank (user will use magic link)
5. Check "Auto Confirm User" so they don't need to verify email

Alternatively, use the Supabase CLI:
```bash
supabase auth signup --email user@example.com --password password123
```

## How Login Works

The login page supports two methods:

1. **Magic Link (Default)**: Just enter your email and you'll receive a login link. Click the link to sign in. No password required!

2. **Password**: Click "Sign in with password instead" to use traditional email/password authentication.

**Note**: Magic links require your Supabase project to have email configured. Make sure SMTP settings are configured in Supabase Dashboard > Project Settings > Auth > SMTP Settings.

## Testing

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Visit `http://localhost:3000` - should redirect to login
4. Sign in with a valid user
5. Should see dashboard with user email and Sign Out button
6. Try accessing API directly without auth - should get 401

## Webhook Routes (No Auth Required)

These routes remain accessible without authentication:
- `POST /api/webhooks/elevenlabs/conversation`
- `POST /api/webhooks/humblefax`
- `POST /api/webhooks/twilio/sms`
- `POST /api/webhooks/twilio/voice`
- `POST /api/webhooks/twilio/transcription`
