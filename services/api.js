// ============================================
// API SERVICE
// ============================================
// All backend communication happens here
// Change UI freely - this file stays the same unless API changes
// ============================================

const APIService = {
    /**
     * Parse natural language text into activity data
     * Supports ADD, EDIT, and DELETE operations
     * 
     * @param {string} text - Natural language input (e.g., "Soccer for Emma tomorrow at 3pm")
     * @param {Array} kids - Array of kid objects [{id, name, age, color}, ...]
     * @param {Array} activities - Array of existing activity objects
     * @returns {Promise<Object>} - Parsed result with action and data
     * 
     * Response format:
     * {
     *   action: 'add' | 'edit' | 'delete',
     *   data: { ... },
     *   confidence: 'high' | 'medium' | 'low'
     * }
     */
    parseActivity: async (text, kids, activities) => {
        try {
            const url = `${APP_CONFIG.BACKEND_URL}${APP_CONFIG.ENDPOINTS.PARSE_ACTIVITY}`;
            
            console.log('🔄 Calling API:', url);
            console.log('📤 Request:', { text, kidsCount: kids.length, activitiesCount: activities.length });
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    text, 
                    kids, 
                    activities 
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ API Response:', result);
            
            return result;
            
        } catch (error) {
            console.error('❌ API Error:', error);
            throw error;
        }
    },

    /**
     * Get AI-suggested prep tasks for an activity
     * 
     * @param {string} activityTitle - Title of the activity (e.g., "Swimming Lesson")
     * @returns {Promise<Object>} - Object with tasks array
     * 
     * Response format:
     * {
     *   tasks: ['Pack swimsuit', 'Pack towel', ...]
     * }
     */
    suggestPrepTasks: async (activityTitle) => {
        try {
            // Check if feature is enabled
            if (!APP_CONFIG.FEATURES.PREP_TASKS) {
                console.log('⚠️ Prep tasks feature is disabled');
                return { tasks: [] };
            }
            
            const url = `${APP_CONFIG.BACKEND_URL}${APP_CONFIG.ENDPOINTS.SUGGEST_PREP_TASKS}`;
            
            console.log('🔄 Calling API:', url);
            console.log('📤 Request:', { activityTitle });
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ activityTitle })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ API Response:', result);
            
            return result;
            
        } catch (error) {
            console.error('❌ API Error:', error);
            // Return empty tasks on error instead of throwing
            return { tasks: [] };
        }
    },

    /**
     * Get activity recommendations based on location and preferences
     * 
     * @param {string} location - User location (e.g., "Seattle, WA")
     * @param {Array} kids - Array of kid objects
     * @param {string} preferences - Optional preferences (e.g., "outdoor, educational")
     * @returns {Promise<Object>} - Object with recommendations array
     * 
     * Response format:
     * {
     *   recommendations: [
     *     {
     *       title: "...",
     *       description: "...",
     *       location: "...",
     *       category: "...",
     *       ...
     *     }
     *   ]
     * }
     */
    recommendActivities: async (location, kids, preferences = '') => {
        try {
            // Check if feature is enabled
            if (!APP_CONFIG.FEATURES.RECOMMENDATIONS) {
                console.log('⚠️ Recommendations feature is disabled');
                return { recommendations: [] };
            }
            
            const url = `${APP_CONFIG.BACKEND_URL}${APP_CONFIG.ENDPOINTS.RECOMMEND_ACTIVITIES}`;
            
            console.log('🔄 Calling API:', url);
            console.log('📤 Request:', { location, kidsCount: kids.length, preferences });
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    location, 
                    kids, 
                    preferences 
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ API Response:', result);
            
            return result;
            
        } catch (error) {
            console.error('❌ API Error:', error);
            throw error;
        }
    },

    /**
     * Test if backend is reachable
     * 
     * @returns {Promise<boolean>} - true if backend is up
     */
    healthCheck: async () => {
        try {
            const response = await fetch(APP_CONFIG.BACKEND_URL, {
                method: 'HEAD'
            });
            return response.ok;
        } catch (error) {
            console.error('❌ Backend health check failed:', error);
            return false;
        }
    }
};

// Make available globally
window.APIService = APIService;

// Logging for debugging
console.log('✅ API Service Loaded');
console.log('Available methods:', Object.keys(APIService));
