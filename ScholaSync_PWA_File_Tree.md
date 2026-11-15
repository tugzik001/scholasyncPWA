# ScholaSync PWA — Project File Tree (v5)

This updated directory structure reflects the complete, modularized **ScholaSync PWA** architecture where every HTML view pairs with its own dedicated JavaScript controller and zero inline `<script>` tags are used.

```text
ScholaSync-PWA/
├── index.html                      # Offline-first landing page & live study space preview
├── manifest.json                   # PWA install metadata (icons, theme color, standalone mode)
├── sw.js                           # Service Worker pre-caching all HTML, CSS, JS, and assets
├── README.md                       # Setup instructions, demo credentials, and pilot notes
│
├── css/
│   └── styles.css                  # Shared warm cream (#FAF9F6) UI design system & responsive rules
│
├── js/
│   ├── app.js                      # Service Worker registration for index.html
│   ├── auth.js                     # LocalStorage DB layer, demo seeding & AAAA0001UNN ID generator
│   ├── signup.js                   # Dedicated controller for pages/signup.html
│   ├── login.js                    # Dedicated controller for pages/login.html (Student vs. Staff tabs)
│   ├── student.js                  # Dedicated controller for pages/student-dashboard.html
│   └── admin.js                    # Dedicated controller for pages/admin.html (attendance & 2G SMS)
│
├── pages/
│   ├── signup.html                 # Student registration & auto-generated Student ID display
│   ├── login.html                  # Tabbed login for Students (ID) and Staff/Admins (School + PIN)
│   ├── student-dashboard.html      # Science/Art/Commercial study guides & syllabus checklists
│   └── admin.html                  # Weekly attendance register with red-flag alerts & SMS modal
│
├── assets/
│   ├── icons/
│   │   ├── icon-192.png            # PWA home-screen icon (192x192)
│   │   └── icon-512.png            # PWA splash/install icon (512x512)
│   └── guides/
│       ├── science/                # Compressed WAEC/JAMB Science notes (Math, Chemistry, Physics)
│       ├── art/                    # Compressed WAEC/JAMB Art notes (English, Government, Literature)
│       └── commercial/             # Compressed WAEC/JAMB Commercial notes (Economics, Accounting)
│
└── docs/
    └── ScholaSync_Supporting_Evidence.pdf   # Architecture, screenshots & pilot feedback for USPF
```

---

## 1-to-1 Page & Script Mapping

| HTML View | Dedicated Script(s) | Primary Responsibilities |
| :--- | :--- | :--- |
| `index.html` | `js/app.js` | Registers `sw.js` for offline caching and renders the landing preview. |
| `pages/signup.html` | `js/auth.js`, `js/signup.js` | Registers students offline, generates `AAAA0001UNN`–`ZZZZ9999UNN` IDs, and copies IDs. |
| `pages/login.html` | `js/auth.js`, `js/login.js` | Authenticates students via Student ID or staff via School Abbr + PIN (`1234`). |
| `pages/student-dashboard.html` | `js/auth.js`, `js/student.js` | Tracks WAEC/JAMB syllabus checkboxes per student ID and opens offline study notes. |
| `pages/admin.html` | `js/auth.js`, `js/admin.js` | Displays weekly Mon–Fri attendance, highlights 3+ absences in red, and queues 2G SMS alerts. |

---

## Quick Terminal Setup Scripts

### Bash (macOS / Linux / Git Bash)
```bash
mkdir -p ScholaSync-PWA/{css,js,pages,assets/icons,assets/guides/{science,art,commercial},docs}
touch ScholaSync-PWA/{index.html,manifest.json,sw.js,README.md}
touch ScholaSync-PWA/css/styles.css
touch ScholaSync-PWA/js/{app.js,auth.js,signup.js,login.js,student.js,admin.js}
touch ScholaSync-PWA/pages/{signup.html,login.html,student-dashboard.html,admin.html}
```

### Windows PowerShell
```powershell
New-Item -ItemType Directory -Force -Path "ScholaSync-PWA/css","ScholaSync-PWA/js","ScholaSync-PWA/pages","ScholaSync-PWA/assets/icons","ScholaSync-PWA/assets/guides/science","ScholaSync-PWA/assets/guides/art","ScholaSync-PWA/assets/guides/commercial","ScholaSync-PWA/docs"
New-Item -ItemType File -Force -Path "ScholaSync-PWA/index.html","ScholaSync-PWA/manifest.json","ScholaSync-PWA/sw.js","ScholaSync-PWA/README.md","ScholaSync-PWA/css/styles.css","ScholaSync-PWA/js/app.js","ScholaSync-PWA/js/auth.js","ScholaSync-PWA/js/signup.js","ScholaSync-PWA/js/login.js","ScholaSync-PWA/js/student.js","ScholaSync-PWA/js/admin.js","ScholaSync-PWA/pages/signup.html","ScholaSync-PWA/pages/login.html","ScholaSync-PWA/pages/student-dashboard.html","ScholaSync-PWA/pages/admin.html"
```
