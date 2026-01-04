/**
 * Cryptid Fates - Frontend Authentication Module
 * 
 * Handles login/logout, user state, and session management
 */

const Auth = {
    // Configuration
    API_BASE: 'https://cryptid-fates.brenden-6ce.workers.dev',
    
    // Token storage key
    TOKEN_KEY: 'cryptid_auth_token',
    
    // Current user state
    user: null,
    isAuthenticated: false,
    isLoading: true,
    
    // Callbacks for state changes
    onAuthChange: null,
    
    /**
     * Get stored token
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },
    
    /**
     * Store token
     */
    setToken(token) {
        if (token) {
            localStorage.setItem(this.TOKEN_KEY, token);
        } else {
            localStorage.removeItem(this.TOKEN_KEY);
        }
    },
    
    /**
     * Initialize auth - check if user is logged in
     * Call this on page load
     */
    async init() {
        this.isLoading = true;
        this.notifyChange();
        
        // Check for token in URL (from OAuth redirect)
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        
        if (urlToken) {
            // Store the token
            this.setToken(urlToken);
            
            // Clean URL
            const url = new URL(window.location);
            url.searchParams.delete('token');
            window.history.replaceState({}, '', url);
        }
        
        // Get token (from URL or storage)
        const token = this.getToken();
        
        if (!token) {
            this.user = null;
            this.isAuthenticated = false;
            this.isLoading = false;
            this.notifyChange();
            this.handleAuthErrors();
            return false;
        }
        
        try {
            const response = await fetch(`${this.API_BASE}/auth/user`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.authenticated && data.user) {
                    this.user = data.user;
                    this.isAuthenticated = true;
                } else {
                    // Invalid token
                    this.setToken(null);
                    this.user = null;
                    this.isAuthenticated = false;
                }
            } else {
                // Token rejected
                this.setToken(null);
                this.user = null;
                this.isAuthenticated = false;
            }
        } catch (error) {
            console.error('Auth init error:', error);
            this.user = null;
            this.isAuthenticated = false;
        }
        
        this.isLoading = false;
        this.notifyChange();
        
        // Check for auth errors in URL
        this.handleAuthErrors();
        
        return this.isAuthenticated;
    },
    
    /**
     * Handle auth errors passed in URL params
     */
    handleAuthErrors() {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        
        if (error) {
            // Remove error from URL
            const url = new URL(window.location);
            url.searchParams.delete('error');
            url.searchParams.delete('reason');
            window.history.replaceState({}, '', url);
            
            // Show error message
            const messages = {
                'oauth_denied': 'Login was cancelled.',
                'no_code': 'Login failed - no authorization code received.',
                'invalid_state': 'Login failed - security check failed. Please try again.',
                'token_exchange_failed': 'Login failed - could not verify with provider.',
                'user_info_failed': 'Login failed - could not get user info.',
                'auth_failed': 'Login failed - please try again.',
                'account_banned': `Your account has been banned. ${params.get('reason') || ''}`
            };
            
            const message = messages[error] || 'Login failed. Please try again.';
            
            // You can customize how to show this error
            if (typeof showMessage === 'function') {
                showMessage(message, 3000);
            } else {
                alert(message);
            }
        }
    },
    
    /**
     * Redirect to Google login
     */
    loginWithGoogle() {
        window.location.href = `${this.API_BASE}/auth/google`;
    },
    
    /**
     * Redirect to Discord login
     */
    loginWithDiscord() {
        window.location.href = `${this.API_BASE}/auth/discord`;
    },
    
    /**
     * Logout current user
     */
    async logout() {
        const token = this.getToken();
        
        try {
            await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        // Clear token
        this.setToken(null);
        
        this.user = null;
        this.isAuthenticated = false;
        this.notifyChange();
        
        // Optionally reload page or redirect
        window.location.reload();
    },
    
    /**
     * Update display name
     */
    async updateDisplayName(newName) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }
        
        const token = this.getToken();
        
        const response = await fetch(`${this.API_BASE}/auth/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ displayName: newName })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update name');
        }
        
        // Update local user state
        if (this.user) {
            this.user.displayName = data.displayName;
            this.notifyChange();
        }
        
        return data.displayName;
    },
    
    /**
     * Link additional OAuth provider to existing account
     */
    linkGoogle() {
        if (!this.isAuthenticated) {
            console.error('Must be logged in to link accounts');
            return;
        }
        window.location.href = `${this.API_BASE}/auth/google`;
    },
    
    linkDiscord() {
        if (!this.isAuthenticated) {
            console.error('Must be logged in to link accounts');
            return;
        }
        window.location.href = `${this.API_BASE}/auth/discord`;
    },
    
    /**
     * Get user ID for multiplayer
     */
    getUserId() {
        return this.user?.id || null;
    },
    
    /**
     * Get display name
     */
    getDisplayName() {
        return this.user?.displayName || 'Summoner';
    },
    
    /**
     * Get avatar URL
     */
    getAvatarUrl() {
        return this.user?.avatarUrl || null;
    },
    
    /**
     * Notify listeners of auth state change
     */
    notifyChange() {
        if (this.onAuthChange) {
            this.onAuthChange({
                isAuthenticated: this.isAuthenticated,
                isLoading: this.isLoading,
                user: this.user
            });
        }
        
        // Dispatch custom event for other listeners
        window.dispatchEvent(new CustomEvent('authChange', {
            detail: {
                isAuthenticated: this.isAuthenticated,
                isLoading: this.isLoading,
                user: this.user
            }
        }));
    },
    
    /**
     * Format stats for display
     */
    getStatsString() {
        if (!this.user) return '';
        
        const wins = this.user.wins || 0;
        const losses = this.user.losses || 0;
        const elo = this.user.eloRating || 1000;
        
        return `${wins}W - ${losses}L | ELO: ${elo}`;
    }
};

// Make available globally
window.Auth = Auth;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Auth;
}