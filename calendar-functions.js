// calendar-functions.js
// Google Calendar Integration Functions
// Add this file to your project and include it in index.html

// ==============================================
// COPY ALL OF THIS CODE INTO: calendar-functions.js
// ==============================================

// Initialize Google Calendar API
function initializeCalendarAPI(APP_CONFIG, setGapiInited, setGisInited, setTokenClient) {
    console.log('🔄 Initializing Google Calendar API...');
    
    // Check if Google APIs loaded
    if (typeof gapi === 'undefined' || typeof google === 'undefined') {
        console.log('⏳ Waiting for Google APIs to load...');
        setTimeout(() => initializeCalendarAPI(APP_CONFIG, setGapiInited, setGisInited, setTokenClient), 1000);
        return;
    }
    
    // Load GAPI client
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: APP_CONFIG.GOOGLE_CALENDAR.API_KEY,
                discoveryDocs: [APP_CONFIG.GOOGLE_CALENDAR.DISCOVERY_DOC],
            });
            setGapiInited(true);
            console.log('✅ Google API initialized');
        } catch (err) {
            console.error('❌ Error initializing Google API:', err);
        }
    });

    // Initialize Google Identity Services
    try {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: APP_CONFIG.GOOGLE_CALENDAR.CLIENT_ID,
            scope: APP_CONFIG.GOOGLE_CALENDAR.SCOPES,
            callback: '', // Will be set dynamically
        });
        setTokenClient(client);
        setGisInited(true);
        console.log('✅ Google Identity Services initialized');
    } catch (err) {
        console.error('❌ Error initializing Google Identity:', err);
    }
}

// Helper: Guess activity type from title
function guessType(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('pickup') || t.includes('pick up') || t.includes('pick-up')) return 'Pick Up';
    if (t.includes('dropoff') || t.includes('drop off') || t.includes('drop-off')) return 'Drop Off';
    return 'Other';
}

// Helper: Guess category from title
function guessCategory(title) {
    const t = (title || '').toLowerCase();
    if (t.match(/soccer|football|basketball|swim|dance|gym|sport|tennis|baseball|hockey/)) return 'Physical';
    if (t.match(/party|playdate|friend|sleepover|birthday/)) return 'Social';
    if (t.match(/piano|art|music|draw|paint|theater|drama|guitar/)) return 'Creative';
    if (t.match(/tutor|school|class|homework|study|lesson|reading/)) return 'Academic';
    return 'Other';
}

// Helper: Try to find kid from title
function guessKidFromTitle(title, kidsList) {
    const t = (title || '').toLowerCase();
    for (const kid of kidsList) {
        if (t.includes(kid.name.toLowerCase())) {
            return kid.id;
        }
    }
    return null;
}

// Parse calendar event into activity
function parseCalendarEvent(event) {
    const start = event.start.dateTime || event.start.date;
    const startDate = new Date(start);
    
    return {
        title: event.summary || 'Untitled Event',
        date: startDate.toISOString().split('T')[0],
        time: event.start.dateTime ? startDate.toTimeString().slice(0, 5) : '12:00',
        location: event.location || '',
        notes: event.description || '',
        type: guessType(event.summary),
        parent: 'Mom',
        activityCategory: guessCategory(event.summary),
        createdBy: 'Calendar Import',
        recurring: 'none',
        notify: false,
        prepTasks: [],
        duration: 60
    };
}

// Connect to Google Calendar
async function connectCalendar(gapiInited, gisInited, tokenClient, setCalendarConnected, syncCalendar) {
    if (!gapiInited || !gisInited || !tokenClient) {
        alert('Google Calendar API is still loading. Please wait a moment and try again.');
        return;
    }

    tokenClient.callback = async (response) => {
        if (response.error !== undefined) {
            console.error('Auth error:', response.error);
            alert('Error connecting to Google Calendar: ' + response.error);
            return;
        }
        
        setCalendarConnected(true);
        console.log('✅ Calendar connected!');
        
        // Automatically sync after connecting
        await syncCalendar();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// Sync calendar events
async function syncCalendar(gapiInited, kids, code, db, setCalendarSyncing, setSyncResult) {
    if (!gapiInited) {
        alert('Google Calendar API not ready');
        return;
    }

    setCalendarSyncing(true);
    setSyncResult(null);

    try {
        console.log('🔄 Fetching calendar events...');
        
        // Get events from next 30 days
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': now.toISOString(),
            'timeMax': thirtyDays.toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'orderBy': 'startTime'
        });

        const events = response.result.items || [];
        console.log(`📅 Found ${events.length} calendar events`);
        
        let imported = 0;
        let skipped = 0;
        
        // Import each event
        for (const event of events) {
            const activity = parseCalendarEvent(event);
            
            // Try to match to a kid
            const kidId = guessKidFromTitle(activity.title, kids);
            
            if (kidId) {
                activity.kidId = kidId;
                
                // Check if already exists (avoid duplicates)
                const existing = await db.collection('activities')
                    .where('familyCode', '==', code)
                    .where('calendarEventId', '==', event.id)
                    .get();
                
                if (existing.empty) {
                    await db.collection('activities').add({
                        ...activity,
                        familyCode: code,
                        importedFrom: 'Google Calendar',
                        importedAt: new Date().toISOString(),
                        calendarEventId: event.id
                    });
                    imported++;
                    console.log(`✅ Imported: ${activity.title}`);
                } else {
                    console.log(`⏭️ Skipped (duplicate): ${activity.title}`);
                }
            } else {
                skipped++;
                console.log(`⚠️ Skipped (no kid match): ${event.summary}`);
            }
        }
        
        setSyncResult({ imported, skipped, total: events.length });
        console.log(`✅ Sync complete! ${imported} imported, ${skipped} skipped`);
        
        if (imported > 0) {
            alert(`Success! Imported ${imported} activities from your calendar.`);
        } else if (skipped > 0) {
            alert(`Found ${skipped} events but couldn't match them to kids. Try including kid names in your calendar event titles.`);
        } else {
            alert('No new events to import.');
        }
        
    } catch (err) {
        console.error('❌ Sync error:', err);
        alert('Error syncing calendar: ' + err.message);
    } finally {
        setCalendarSyncing(false);
    }
}

// Disconnect calendar
function disconnectCalendar(setCalendarConnected, setSyncResult) {
    const token = gapi.client.getToken();
    if (token) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
    }
    setCalendarConnected(false);
    setSyncResult(null);
    console.log('🔌 Calendar disconnected');
}

// Export functions for use in React
window.CalendarSync = {
    initializeCalendarAPI,
    connectCalendar,
    syncCalendar,
    disconnectCalendar
};

console.log('📦 Calendar functions loaded');
