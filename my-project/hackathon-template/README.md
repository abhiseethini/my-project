# Hackathon Template

A lightweight starter template for hackathon projects with Firebase Authentication, a user dashboard, and an admin panel.

## Features

- **Landing page** — clean hero section with call-to-action
- **Authentication** — email/password sign up and login via Firebase Auth
- **Dashboard** — protected user area with profile info
- **Admin panel** — role-based admin view (requires custom claims or Firestore role field)

## Project Structure

```
hackathon-template/
├── pages/          # HTML pages
├── css/            # Stylesheets
├── js/             # JavaScript modules
├── assets/         # Images and icons
├── README.md
└── .gitignore
```

## Quick Start

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/)

2. **Enable Authentication**
   - Go to Authentication → Sign-in method
   - Enable **Email/Password**

3. **Configure Firebase**
   - Open `js/firebase.js`
   - Replace the placeholder config with your project's credentials:

   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

4. **Serve locally** (any static file server works):

   ```bash
   # Python
   python -m http.server 8080

   # Node (npx)
   npx serve .

   # VS Code Live Server extension
   ```

5. Open `http://localhost:8080/pages/index.html` in your browser.

## Pages

| Page | Path | Description |
|------|------|-------------|
| Home | `pages/index.html` | Landing page |
| Login | `pages/login.html` | Sign in |
| Sign Up | `pages/signup.html` | Create account |
| Dashboard | `pages/dashboard.html` | User dashboard (auth required) |
| Admin | `pages/admin.html` | Admin panel (admin role required) |

## Admin Access

By default, new users are regular users. To grant admin access:

1. Store a `role: "admin"` field in Firestore under `users/{uid}`, **or**
2. Set a custom claim via Firebase Admin SDK on your backend.

The admin page checks for this role before rendering.

## Customization

- Edit `css/style.css` for global theme variables (colors, fonts)
- Replace placeholder content in each HTML page
- Extend `js/dashboard.js` and `js/admin.js` with your hackathon logic

## License

MIT — use freely for hackathons and personal projects.
