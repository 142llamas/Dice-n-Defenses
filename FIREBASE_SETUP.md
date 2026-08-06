# Firebase Setup Checklist (Phase 10, D-084)

This is the part of Phase 10 that only Kevin can do — creating cloud
infrastructure and logging into it both require a real Google account and
a real browser, neither of which this environment has. Everything else
(the actual code) is already built and passes typecheck/tests/build with
no Firebase project at all — the game keeps working exactly as it did at
the end of Phase 9 until every step below is done.

Do these in order. Nothing here costs money on its own — Hosting, Auth,
and Firestore at this game's scale all fit comfortably in Firebase's free
"Spark" plan, but double-check current pricing/limits on Firebase's own
site yourself before enabling anything, since that can change and isn't
something to take on faith from this doc.

## 1. Create the Firebase project

1. Go to the Firebase console and create a new project (any name — it
   doesn't have to match the game's title).
2. You can decline Google Analytics for this project; it isn't used here.

## 2. Register a Web App

1. In the new project, click the Web (`</>`) icon to register a web app.
2. Give it any nickname. You do **not** need Firebase Hosting set up at
   this step even though it offers to — that's handled separately below.
3. Firebase shows you a `firebaseConfig` object with six values:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`. Keep this tab open — you'll copy these
   into `.env` in Step 5.

## 3. Enable sign-in providers

In the console: **Build -> Authentication -> Sign-in method** (or **Get
started** if this is the first time):
1. Enable **Anonymous**.
2. Enable **Google** (pick the support email it asks for — this is your
   own email, not something end users see beyond a standard Google
   consent screen).

## 4. Create Firestore

**Build -> Firestore Database -> Create database**:
1. Choose **Native mode** (not Datastore mode).
2. Pick a location close to you. This can't be changed later without
   recreating the database, but it makes no functional difference at this
   game's scale.
3. Start in **production mode** rules (the actual rules come from this
   repo's `firestore.rules` file when we deploy — the console's own
   starting choice here doesn't matter much).

## 5. Fill in `.env`

1. Copy `.env.example` to a new file named `.env` in the repo root
   (already gitignored — it will never be committed).
2. Fill in the six `VITE_FIREBASE_*` values from Step 2's `firebaseConfig`.

## 6. Update `.firebaserc`

Open `.firebaserc` and replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with
your actual project id (visible in the console's Project Settings, or in
the URL when you're viewing the project). Tell me this value too — I'll
double check it matches before we deploy.

## 7. Log into the Firebase CLI (your terminal, not through me)

This is the one step I genuinely cannot do — it opens a real browser
window for you to approve, and this sandboxed session has no browser and
can't drive an interactive login. In your OWN terminal (PowerShell,
outside of this session):

```
npx firebase login
```

This stores your credentials in your Windows user profile. Once that's
done, I can run `firebase deploy` through this session using those same
stored credentials — you only need to do this once.

## 8. (Optional but recommended) Run the Firestore rules tests

`firestore.rules` (already written) and its test suite
(`firestore-tests/rules.test.ts`) check that a signed-in user can only
read/write their OWN saves, that signed-out access is denied, and that
oversized/malformed writes are rejected — before trusting the rules in
production, running them is worth it.

This needs a **JDK 21 or newer** for the Firestore emulator. I checked
this machine and found Java 8 (`1.8.0_501`) — too old; `firebase-tools`
now requires 21+. I did NOT install anything myself since that's a real
change to your system's installed software — if you'd like me to install
one via `winget` (Windows' built-in package manager, already present on
this machine), just say so and I'll do it; otherwise you can install a
JDK 21+ yourself (e.g. Eclipse Temurin) and let me know when it's in
place, or we can skip this verification step for now and rely on manual
testing after deploy instead.

Once a JDK 21+ is available: `npm run test:rules`.

## 9. Give me the go-ahead to deploy

Once Steps 1-7 (8 is optional) are done, let me know and I'll run:

```
npm run build
firebase deploy --only hosting,firestore:rules
```

I'll confirm with you right before actually running that — it's the one
step this session that makes the game reachable at a real public URL.
