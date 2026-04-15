# WebsiteReview

A lightweight visual feedback tool for web projects. Drop a single `<script>` tag onto any website and give clients a click-to-comment overlay — no logins, no iframes. Manage all projects and comments from the admin dashboard.

---

## How it works

```
Admin dashboard (this app)          Client's website
────────────────────────            ────────────────────────
1. Create a project          →      2. Embed review-widget.js
   (gets a Project ID)                 (no config needed)
3. Share a review URL        →      4. Open link — widget
   ?review=<projectId>                 activates automatically
                             ←      5. Reviewers click to leave
6. View & resolve comments              visual comments
   in real time (Firestore)
```

- **Admin app** — Angular SPA hosted on Vercel. Create projects, copy shareable review URLs, monitor comment counts, and manage individual comments.
- **Review widget** — a self-contained vanilla JS file (`public/review-widget.js`) injected directly into the client's site DOM. No iframe. Syncs comments in real time via Firestore. Activates only when the `?review` query parameter is present in the URL.
- **Backend** — Firebase Firestore. No server. The widget and admin app both read/write Firestore directly using security rules.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone components) |
| Database | Firebase Firestore |
| Hosting | Vercel |
| Widget | Vanilla JS (no dependencies bundled) |
| Tests | Vitest |

---

## Prerequisites

- Node.js 18+
- npm 10+
- A Firebase project with Firestore enabled
- A Vercel account (for deployment)

---

## Local development

### 1. Clone the repo

```bash
git clone https://github.com/kalenyng/website-review.git
cd website-review/website-review
npm install
```

### 2. Set up environment variables

The app reads Firebase config from environment variables at build time. Copy the values from your Firebase project settings.

Create a `.env` file (never commit this):

```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

The `scripts/set-env.js` script reads these variables and writes them into `src/environments/environment.ts` before each build.

### 3. Start the dev server

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200). The admin dashboard loads at `/admin`.

---

## Admin dashboard

### Creating a project

1. Go to `/admin`
2. Enter a **project name** and the **URL of the client site**
3. Click **Create project**

Each project gets a unique **Project ID**. Copy it using the Copy button on the project card — you'll need it to configure the widget.

### Project board

Each project card shows:
- Total comments, open count, resolved count
- A link to **Manage comments** (detailed comment list with resolve/reopen controls)
- A link to **Open live site**

---

## Embedding the review widget

The widget file is served from `public/review-widget.js`. After deploying, its URL will be:

```
https://your-vercel-url.vercel.app/review-widget.js
```

### Option 1 — URL parameter (recommended)

Add this single tag anywhere in the client site's HTML **with no project ID configured**:

```html
<script src="https://your-vercel-url.vercel.app/review-widget.js"></script>
```

The widget stays completely dormant until the page is visited with a `?review=<projectId>` query parameter. Share the review URL directly from the admin dashboard:

```
https://clientsite.com/page?review=YOUR_PROJECT_ID
```

- Visitors browsing the site normally never see the widget
- Anyone with the `?review` link gets the full comment overlay
- No code changes needed on the client site between projects

### Option 2 — Auto-initialize via data attribute

Use this if the widget should always be active on a given page (e.g. a dedicated staging environment):

```html
<script
  src="https://your-vercel-url.vercel.app/review-widget.js"
  data-project-id="YOUR_PROJECT_ID"
></script>
```

### Option 3 — Manual initialization

Use this if you need to pass a custom user name or override the Firebase config:

```html
<script src="https://your-vercel-url.vercel.app/review-widget.js"></script>
<script>
  window.WebsiteReviewWidget.init({
    projectId: 'YOUR_PROJECT_ID',
    userName: 'Client Name',
  });
</script>
```

**Initialization priority:** URL parameter → `data-project-id` attribute → manual `init()` call.

### Widget modes

Once injected, the widget adds a small toolbar to the page:

| Mode | Behavior |
|---|---|
| **View** | Shows all existing comment pins on the page. Click a pin to read the thread. |
| **Comment** | Hover over any element to highlight it. Click to place a new comment pin and type a note. |

Comments are stored in Firestore and appear in real time across all viewers on that page and in the admin dashboard.

---

## Deployment (Vercel)

### Environment variables

Set the same Firebase variables from the `.env` file above in your Vercel project settings under **Settings → Environment Variables**.

### Build settings

These are handled automatically by `vercel.json`:

| Setting | Value |
|---|---|
| Build command | `npm run build` (runs `set-env.js` then `ng build`) |
| Output directory | `dist/website-review/browser` |
| Rewrites | All routes → `index.html` (required for Angular client-side routing) |

Push to `main` and Vercel deploys automatically.

---

## Firestore security rules

Rules are in `firestore.rules`. Deploy them with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

Key rules:
- **Projects** — open read/write (admin only in practice, no auth yet)
- **Comments** — anyone can read and create; updates are limited to changing `status` only; deletes are blocked
- **Review sessions** — anyone can read and create; updates and deletes are blocked

---

## Running tests

```bash
npm test
```

Uses Vitest. Firestore rule tests live in `src/app/firestore.rules.spec.ts` and run against a local emulator.

---

## Project structure

```
src/
  app/
    core/
      data/          # Firestore repositories (ReviewRepository, CommentRepository)
      models/        # TypeScript interfaces (ReviewProject, ReviewComment, etc.)
      utils/         # URL normalization helpers
    features/
      admin/         # Project board — create projects, view stats
      project-detail/# Per-project comment list with resolve/reopen
      review-workspace/  # Shared comment thread component
  environments/      # Firebase config (generated by scripts/set-env.js)
public/
  review-widget.js   # Self-contained embeddable widget
scripts/
  set-env.js         # Writes environment.ts from env vars at build time
```
