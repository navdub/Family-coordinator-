// ============================================
// APP CONFIGURATION
// ============================================
// Change backend URL here when you deploy a new backend
// Change Firebase config here if you switch projects
// ============================================

const APP_CONFIG = {
    // Backend API URL (Vercel)
    BACKEND_URL: 'https://family-coordinator-3mwt-navds-projects-80c6ecc2.vercel.app',
    
    // Firebase Configuration
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyCsjCSABxbzg7c16g_kaP_TjiJkmwprTdM",
        authDomain: "family-activity-tracker-8c417.firebaseapp.com",
        projectId: "family-activity-tracker-8c417",
        storageBucket: "family-activity-tracker-8c417.firebasestorage.app",
        messagingSenderId: "434971947503",
        appId: "1:434971947503:web:aa2d53068d9be28082861a"
    },
    
    // App Settings (change these to customize behavior)
    APP_NAME: 'Family Activity Coordinator',
    DEFAULT_PARENT: 'Mom',
    DEFAULT_ACTIVITY_TYPE: 'Pick Up',
    DEFAULT_DURATION: 60,
    DEFAULT_CATEGORY: 'Physical',
    
    // API Endpoints (change if backend structure changes)
    ENDPOINTS: {
        PARSE_ACTIVITY: '/api/parse-activity',
        SUGGEST_PREP_TASKS: '/api/suggest-prep-tasks',
        RECOMMEND_ACTIVITIES: '/api/recommend-activities'
    },
    
    // Feature Flags (turn features on/off)
    FEATURES: {
        NATURAL_LANGUAGE: true,
        PREP_TASKS: true,
        RECOMMENDATIONS: true,
        RECURRING_ACTIVITIES: true,
        NOTIFICATIONS: false
    },
    
    // UI Customization
    THEME: {
        PRIMARY_COLOR: 'blue',  // Tailwind color name
        ACCENT_COLOR: 'purple',
        CALENDAR_VIEW_DEFAULT: 'month'  // 'day', 'week', 'month'
    },
    
    // Google Calendar Integration
    GOOGLE_CALENDAR: {
        CLIENT_ID: '178041915921-mqkof44jajlrgi7i4u9s5bfdg5ebihss.apps.googleusercontent.com',
        API_KEY: 'AIzaSyB7dFK-wqJCSy7RQsYKiOqjXSJPmCuUUyY',
        SCOPES: 'https://www.googleapis.com/auth/calendar.readonly',
        DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
    }
};

// Make available globally
window.APP_CONFIG = APP_CONFIG;

// Logging for debugging
console.log('✅ App Config Loaded');
console.log('Backend URL:', APP_CONFIG.BACKEND_URL);
console.log('Features:', APP_CONFIG.FEATURES);
