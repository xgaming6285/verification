/**
 * IP Geolocation Detector
 * Automatically detects user's country based on IP address and sets appropriate language
 */
class GeolocationDetector {
    constructor() {
        this.defaultLanguage = 'en';
        this.spanishLanguage = 'es';
        this.detectionTimeout = 5000; // 5 seconds timeout
        this.fallbackToDefault = true;
        
        // Multiple IP geolocation services for redundancy
        this.ipServices = [
            {
                name: 'ipapi',
                url: 'https://ipapi.co/json/',
                parseResponse: (data) => data.country_code?.toLowerCase()
            },
            {
                name: 'ipgeolocation',
                url: 'https://api.ipgeolocation.io/ipgeo?apiKey=free',
                parseResponse: (data) => data.country_code2?.toLowerCase()
            },
            {
                name: 'ipify-geo',
                url: 'https://geo.ipify.org/api/v2/country?apiKey=at_free',
                parseResponse: (data) => data.location?.country?.toLowerCase()
            },
            {
                name: 'ip-api',
                url: 'http://ip-api.com/json/',
                parseResponse: (data) => data.countryCode?.toLowerCase()
            }
        ];
    }

    /**
     * Initialize geolocation detection and set language automatically
     */
    async init(translationManager) {
        try {
            console.log('Starting IP-based geolocation detection...');
            
            // Check if user already has a stored language preference
            const storedLanguage = translationManager.getStoredLanguage();
            if (storedLanguage) {
                console.log(`Using stored language preference: ${storedLanguage}`);
                return storedLanguage;
            }

            // Detect country based on IP
            const countryCode = await this.detectCountry();
            console.log(`Detected country: ${countryCode || 'unknown'}`);
            
            // Determine language based on country
            const language = this.getLanguageForCountry(countryCode);
            console.log(`Setting language to: ${language}`);
            
            // Apply the detected language
            if (translationManager && language !== translationManager.getCurrentLanguage()) {
                await translationManager.changeLanguage(language);
            }
            
            return language;
            
        } catch (error) {
            console.error('Error in geolocation detection:', error);
            return this.defaultLanguage;
        }
    }

    /**
     * Detect user's country based on IP address
     */
    async detectCountry() {
        // First try to use a service that doesn't require API key
        try {
            const countryCode = await this.tryService(this.ipServices[0]);
            if (countryCode) {
                return countryCode;
            }
        } catch (error) {
            console.warn('Primary IP service failed, trying alternatives...');
        }

        // Try other services as fallback
        for (let i = 1; i < this.ipServices.length; i++) {
            try {
                const countryCode = await this.tryService(this.ipServices[i]);
                if (countryCode) {
                    return countryCode;
                }
            } catch (error) {
                console.warn(`IP service ${this.ipServices[i].name} failed:`, error.message);
                continue;
            }
        }

        // If all services fail, try browser geolocation as last resort
        try {
            return await this.tryBrowserGeolocation();
        } catch (error) {
            console.warn('Browser geolocation failed:', error.message);
        }

        return null;
    }

    /**
     * Try a specific IP geolocation service
     */
    async tryService(service) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.detectionTimeout);

            fetch(service.url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                },
            })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const countryCode = service.parseResponse(data);
                if (countryCode && countryCode.length === 2) {
                    resolve(countryCode);
                } else {
                    reject(new Error('Invalid country code received'));
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    /**
     * Try browser geolocation API as fallback (less reliable for country detection)
     */
    async tryBrowserGeolocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error('Geolocation timeout'));
            }, this.detectionTimeout);

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    clearTimeout(timeoutId);
                    try {
                        // Use reverse geocoding to get country from coordinates
                        const countryCode = await this.reverseGeocode(
                            position.coords.latitude, 
                            position.coords.longitude
                        );
                        resolve(countryCode);
                    } catch (error) {
                        reject(error);
                    }
                },
                (error) => {
                    clearTimeout(timeoutId);
                    reject(new Error(`Geolocation error: ${error.message}`));
                },
                {
                    timeout: this.detectionTimeout - 1000,
                    enableHighAccuracy: false,
                    maximumAge: 600000 // 10 minutes
                }
            );
        });
    }

    /**
     * Reverse geocode coordinates to get country code
     */
    async reverseGeocode(lat, lon) {
        // Use a simple reverse geocoding service
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Reverse geocoding failed');
        }
        
        const data = await response.json();
        return data.countryCode?.toLowerCase();
    }

    /**
     * Determine language based on country code
     */
    getLanguageForCountry(countryCode) {
        if (!countryCode) {
            return this.defaultLanguage;
        }

        // List of Spanish-speaking countries
        const spanishCountries = [
            'es', // Spain
            'mx', // Mexico
            'ar', // Argentina
            'co', // Colombia
            've', // Venezuela
            'pe', // Peru
            'cl', // Chile
            'ec', // Ecuador
            'gt', // Guatemala
            'cu', // Cuba
            'bo', // Bolivia
            'do', // Dominican Republic
            'hn', // Honduras
            'py', // Paraguay
            'sv', // El Salvador
            'ni', // Nicaragua
            'cr', // Costa Rica
            'pa', // Panama
            'uy', // Uruguay
            'gq'  // Equatorial Guinea
        ];

        if (spanishCountries.includes(countryCode)) {
            console.log(`Detected Spanish-speaking country: ${countryCode.toUpperCase()}`);
            return this.spanishLanguage;
        }

        console.log(`Detected non-Spanish country: ${countryCode.toUpperCase()}, defaulting to English`);
        return this.defaultLanguage;
    }

    /**
     * Force detection refresh (useful for testing)
     */
    async forceDetection(translationManager) {
        // Clear stored language to force detection
        if (translationManager) {
            localStorage.removeItem('preferred-language');
        }
        
        return await this.init(translationManager);
    }

    /**
     * Get debug information about the detection process
     */
    async getDebugInfo() {
        const debugInfo = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            detectedCountry: null,
            detectedLanguage: null,
            serviceResults: []
        };

        // Test each service
        for (const service of this.ipServices) {
            try {
                const countryCode = await this.tryService(service);
                debugInfo.serviceResults.push({
                    service: service.name,
                    success: true,
                    countryCode: countryCode
                });
                
                if (!debugInfo.detectedCountry) {
                    debugInfo.detectedCountry = countryCode;
                    debugInfo.detectedLanguage = this.getLanguageForCountry(countryCode);
                }
            } catch (error) {
                debugInfo.serviceResults.push({
                    service: service.name,
                    success: false,
                    error: error.message
                });
            }
        }

        return debugInfo;
    }
}

// Export for use in other scripts
window.GeolocationDetector = GeolocationDetector;
