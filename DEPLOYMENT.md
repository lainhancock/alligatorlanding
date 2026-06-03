# Alligator Landing — Deployment Instructions

## What you have
A complete React PWA connected to your Supabase project at:
https://oaqkevbmyioofceopytr.supabase.co

---

## STEP 1 — Set up the database (5 minutes)

1. Go to https://supabase.com and sign in
2. Open your project (oaqkevbmyioofceopytr)
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Open the file `supabase-schema.sql` from this folder
6. Copy the entire contents and paste into the SQL editor
7. Click **Run** (the green button)
8. You should see "Success. No rows returned" — that means it worked

---

## STEP 2 — Configure email (magic link login) (2 minutes)

1. In Supabase, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: https://alligatorlanding.vercel.app
3. Under **Redirect URLs**, add: https://alligatorlanding.vercel.app
4. Click **Save**

---

## STEP 3 — Deploy to Vercel (5 minutes)

### Option A — GitHub (recommended)
1. Create a free account at https://github.com
2. Create a new repository called `alligator-landing`
3. Upload all the files from this folder to the repository
4. Go to https://vercel.com and sign up (use your GitHub account)
5. Click **New Project** → Import your `alligator-landing` repository
6. Leave all settings as default
7. Click **Deploy**
8. Wait about 2 minutes — you'll get a URL like `alligator-landing.vercel.app`

### Option B — Vercel CLI (if you're comfortable with terminal)
```bash
npm install -g vercel
cd alligator-landing
vercel --prod
```

---

## STEP 4 — Create your account (2 minutes)

1. Open the app URL in Safari on your iPhone
2. Enter your email address
3. Check your email — tap the magic link
4. You're in! You'll be set up as Owner automatically

---

## STEP 5 — Install on iPhone home screen (1 minute)

1. Open the app in Safari
2. Tap the **Share** button (box with arrow at bottom of screen)
3. Scroll down and tap **Add to Home Screen**
4. Name it "AL Property" and tap **Add**
5. The app icon will appear on your home screen

---

## STEP 6 — Add your initial tasks (do this after logging in)

After you log in, go to Admin → Tasks and start adding your tasks.
Your categories, assets, and blinds are already pre-loaded from the schema.

---

## STEP 7 — Invite your team

1. Go to Admin → Users
2. Tap **Invite user**
3. Enter their email and select their role
4. They'll get a magic link email to join

---

## Troubleshooting

**"Invalid login" or email not arriving:**
- Check spam folder
- Verify Site URL is set correctly in Supabase Auth settings

**App not loading:**
- Make sure you ran the full SQL schema in Step 1
- Check Vercel deployment logs for any build errors

**Photos not uploading:**
- Storage buckets are created by the schema — verify they exist in Supabase Storage

---

## Your credentials (save these)

Supabase Project URL: https://oaqkevbmyioofceopytr.supabase.co
Supabase Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
App URL (after deploy): https://alligatorlanding.vercel.app

---

Need help? Come back to this chat and describe what you're seeing.
