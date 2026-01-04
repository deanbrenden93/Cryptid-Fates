/**
 * Cryptid Fates - Cloudflare Worker Game Server with Authentication
 * 
 * wrangler.toml additions needed:
 * 
 * [[d1_databases]]
 * binding = "DB"
 * database_name = "cryptid-fates-users"
 * database_id = "47207528-1224-443e-86af-8ec77d7b59a0"
 * 
 * [[kv_namespaces]]
 * binding = "SESSIONS"
 * id = "28ed7f9466174d2f95f83eec6798f455"
 * 
 * [vars]
 * GOOGLE_CLIENT_ID = "your-google-client-id"
 * DISCORD_CLIENT_ID = "your-discord-client-id"
 * BASE_URL = "https://cryptid-fates.yourdomain.workers.dev"
 * 
 * # Set these as secrets (wrangler secret put GOOGLE_CLIENT_SECRET)
 * # GOOGLE_CLIENT_SECRET
 * # DISCORD_CLIENT_SECRET
 * # SESSION_SECRET (random 32+ char string for signing)
 */

// ==================== CONFIGURATION ====================

const COOKIE_NAME = 'cf_session';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days in seconds
const CSRF_COOKIE = 'cf_csrf';

// Frontend URL - where to redirect after login
// Change this to your actual domain when ready (e.g., https://cryptid.game)
const FRONTEND_URL = 'https://2633929.playcode.io';

// OAuth endpoints
const OAUTH_CONFIG = {
    google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile']
    },
    discord: {
        authUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        userInfoUrl: 'https://discord.com/api/users/@me',
        scopes: ['identify', 'email']
    }
};

// ==================== UTILITY FUNCTIONS ====================

// Generate cryptographically secure random string
function generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate UUID v4
function generateUUID() {
    return crypto.randomUUID();
}

// Parse cookies from request
function parseCookies(request) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name) cookies[name] = rest.join('=');
    });
    return cookies;
}

// Create Set-Cookie header
function createCookie(name, value, options = {}) {
    const parts = [`${name}=${value}`];
    
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.domain) parts.push(`Domain=${options.domain}`);
    if (options.secure) parts.push('Secure');
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    
    return parts.join('; ');
}

// Create session cookie
function createSessionCookie(sessionId, env) {
    const isProduction = !env.BASE_URL?.includes('localhost');
    return createCookie(COOKIE_NAME, sessionId, {
        maxAge: SESSION_TTL,
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Lax'
    });
}

// Delete session cookie
function deleteSessionCookie(env) {
    const isProduction = !env.BASE_URL?.includes('localhost');
    return createCookie(COOKIE_NAME, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Lax'
    });
}

// Create CSRF cookie
function createCsrfCookie(state, env) {
    const isProduction = !env.BASE_URL?.includes('localhost');
    return createCookie(CSRF_COOKIE, state, {
        maxAge: 600, // 10 minutes
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Lax'
    });
}

// JSON response helper
function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    });
}

// Redirect helper
function redirect(url, headers = {}) {
    return new Response(null, {
        status: 302,
        headers: {
            'Location': url,
            ...headers
        }
    });
}

// ==================== SESSION MANAGEMENT ====================

async function createSession(env, userId, userData) {
    const sessionId = generateSecureToken(48);
    const sessionData = {
        userId,
        ...userData,
        createdAt: Date.now()
    };
    
    // Store in KV with TTL
    await env.SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify(sessionData),
        { expirationTtl: SESSION_TTL }
    );
    
    return sessionId;
}

async function getSession(env, request) {
    let sessionId = null;
    
    // Try cookie first
    const cookies = parseCookies(request);
    sessionId = cookies[COOKIE_NAME];
    
    // Try Authorization header (Bearer token)
    if (!sessionId) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            sessionId = authHeader.slice(7);
        }
    }
    
    // Try query parameter (for cross-domain)
    if (!sessionId) {
        const url = new URL(request.url);
        sessionId = url.searchParams.get('token');
    }
    
    if (!sessionId) return null;
    
    const sessionData = await env.SESSIONS.get(`session:${sessionId}`);
    if (!sessionData) return null;
    
    try {
        return JSON.parse(sessionData);
    } catch {
        return null;
    }
}

async function deleteSession(env, request) {
    let sessionId = null;
    
    // Try cookie
    const cookies = parseCookies(request);
    sessionId = cookies[COOKIE_NAME];
    
    // Try Authorization header
    if (!sessionId) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            sessionId = authHeader.slice(7);
        }
    }
    
    if (sessionId) {
        await env.SESSIONS.delete(`session:${sessionId}`);
    }
}

// ==================== USER DATABASE OPERATIONS ====================

async function findUserByProviderId(env, provider, providerId) {
    const column = provider === 'google' ? 'google_id' : 'discord_id';
    const result = await env.DB.prepare(
        `SELECT * FROM users WHERE ${column} = ?`
    ).bind(providerId).first();
    
    return result;
}

async function findUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();
}

async function createUser(env, userData) {
    const id = generateUUID();
    const now = Date.now();
    
    await env.DB.prepare(`
        INSERT INTO users (id, display_name, avatar_url, email, google_id, discord_id, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        id,
        userData.displayName,
        userData.avatarUrl || null,
        userData.email || null,
        userData.googleId || null,
        userData.discordId || null,
        now,
        now
    ).run();
    
    return { id, ...userData, created_at: now, last_login: now, wins: 0, losses: 0, elo_rating: 1000 };
}

async function updateUserLogin(env, userId, updates = {}) {
    const setClauses = ['last_login = ?'];
    const values = [Date.now()];
    
    if (updates.avatarUrl !== undefined) {
        setClauses.push('avatar_url = ?');
        values.push(updates.avatarUrl);
    }
    if (updates.displayName !== undefined) {
        setClauses.push('display_name = ?');
        values.push(updates.displayName);
    }
    if (updates.googleId !== undefined) {
        setClauses.push('google_id = ?');
        values.push(updates.googleId);
    }
    if (updates.discordId !== undefined) {
        setClauses.push('discord_id = ?');
        values.push(updates.discordId);
    }
    
    values.push(userId);
    
    await env.DB.prepare(`
        UPDATE users SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run();
}

async function linkProviderToUser(env, userId, provider, providerId) {
    const column = provider === 'google' ? 'google_id' : 'discord_id';
    await env.DB.prepare(`
        UPDATE users SET ${column} = ? WHERE id = ?
    `).bind(providerId, userId).run();
}

// ==================== OAUTH HANDLERS ====================

// Start OAuth flow - redirect to provider
async function handleOAuthStart(provider, env, request) {
    const config = OAUTH_CONFIG[provider];
    if (!config) {
        return jsonResponse({ error: 'Invalid provider' }, 400);
    }
    
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.DISCORD_CLIENT_ID;
    const redirectUri = `${env.BASE_URL}/auth/${provider}/callback`;
    
    // Generate CSRF state token
    const state = generateSecureToken(32);
    
    // Build authorization URL
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state: state
    });
    
    // Discord requires specific prompt parameter
    if (provider === 'discord') {
        params.set('prompt', 'consent');
    }
    
    // Google-specific params for better UX
    if (provider === 'google') {
        params.set('access_type', 'offline');
        params.set('prompt', 'select_account');
    }
    
    const authUrl = `${config.authUrl}?${params.toString()}`;
    
    // Set CSRF cookie and redirect
    return redirect(authUrl, {
        'Set-Cookie': createCsrfCookie(state, env)
    });
}

// Handle OAuth callback
async function handleOAuthCallback(provider, env, request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Check for OAuth errors
    if (error) {
        console.error(`OAuth error from ${provider}:`, error);
        return redirect(`${FRONTEND_URL}/?error=oauth_denied`);
    }
    
    if (!code) {
        return redirect(`${FRONTEND_URL}/?error=no_code`);
    }
    
    // Verify CSRF state
    const cookies = parseCookies(request);
    const storedState = cookies[CSRF_COOKIE];
    
    if (!storedState || storedState !== state) {
        console.error('CSRF state mismatch');
        return redirect(`${FRONTEND_URL}/?error=invalid_state`);
    }
    
    const config = OAUTH_CONFIG[provider];
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.DISCORD_CLIENT_ID;
    const clientSecret = provider === 'google' ? env.GOOGLE_CLIENT_SECRET : env.DISCORD_CLIENT_SECRET;
    const redirectUri = `${env.BASE_URL}/auth/${provider}/callback`;
    
    try {
        // Exchange code for tokens
        const tokenBody = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });
        
        const tokenResponse = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenBody.toString()
        });
        
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(`Token exchange failed for ${provider}:`, errorText);
            return redirect(`${FRONTEND_URL}/?error=token_exchange_failed`);
        }
        
        const tokens = await tokenResponse.json();
        
        // Fetch user info
        const userInfoResponse = await fetch(config.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!userInfoResponse.ok) {
            console.error(`Failed to fetch user info from ${provider}`);
            return redirect(`${FRONTEND_URL}/?error=user_info_failed`);
        }
        
        const providerUser = await userInfoResponse.json();
        
        // Normalize user data across providers
        let userData;
        if (provider === 'google') {
            userData = {
                providerId: providerUser.id,
                email: providerUser.email,
                displayName: providerUser.name || providerUser.email?.split('@')[0] || 'Summoner',
                avatarUrl: providerUser.picture,
                googleId: providerUser.id
            };
        } else if (provider === 'discord') {
            const avatarUrl = providerUser.avatar 
                ? `https://cdn.discordapp.com/avatars/${providerUser.id}/${providerUser.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(providerUser.discriminator || '0') % 5}.png`;
            
            userData = {
                providerId: providerUser.id,
                email: providerUser.email,
                displayName: providerUser.global_name || providerUser.username || 'Summoner',
                avatarUrl: avatarUrl,
                discordId: providerUser.id
            };
        }
        
        // Check if user exists
        let user = await findUserByProviderId(env, provider, userData.providerId);
        
        if (user) {
            // Update last login and potentially avatar/name
            await updateUserLogin(env, user.id, {
                avatarUrl: userData.avatarUrl,
                displayName: userData.displayName
            });
        } else {
            // Check if we have an existing session (linking accounts)
            const existingSession = await getSession(env, request);
            
            if (existingSession) {
                // Link this provider to existing account
                await linkProviderToUser(env, existingSession.userId, provider, userData.providerId);
                user = await findUserById(env, existingSession.userId);
            } else {
                // Create new user
                user = await createUser(env, userData);
            }
        }
        
        // Check if user is banned
        if (user.is_banned) {
            return redirect(`${FRONTEND_URL}/?error=account_banned&reason=${encodeURIComponent(user.ban_reason || '')}`);
        }
        
        // Create session
        const sessionId = await createSession(env, user.id, {
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            email: user.email
        });
        
        // Redirect to frontend with session token in URL
        // Also set cookie for same-domain requests (when frontend moves to same domain)
        return redirect(`${FRONTEND_URL}/?token=${sessionId}`, {
            'Set-Cookie': createSessionCookie(sessionId, env)
        });
        
    } catch (err) {
        console.error(`OAuth callback error for ${provider}:`, err);
        return redirect(`${FRONTEND_URL}/?error=auth_failed`);
    }
}

// ==================== AUTH API ENDPOINTS ====================

// Get current user
async function handleGetUser(env, request) {
    const session = await getSession(env, request);
    
    if (!session) {
        return jsonResponse({ authenticated: false }, 200);
    }
    
    const user = await findUserById(env, session.userId);
    
    if (!user) {
        return jsonResponse({ authenticated: false }, 200);
    }
    
    return jsonResponse({
        authenticated: true,
        user: {
            id: user.id,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            email: user.email,
            wins: user.wins,
            losses: user.losses,
            eloRating: user.elo_rating,
            hasGoogle: !!user.google_id,
            hasDiscord: !!user.discord_id,
            createdAt: user.created_at
        }
    });
}

// Logout
async function handleLogout(env, request) {
    await deleteSession(env, request);
    
    return jsonResponse({ success: true }, 200, {
        'Set-Cookie': deleteSessionCookie(env)
    });
}

// Update display name
async function handleUpdateProfile(env, request) {
    const session = await getSession(env, request);
    
    if (!session) {
        return jsonResponse({ error: 'Not authenticated' }, 401);
    }
    
    try {
        const body = await request.json();
        const { displayName } = body;
        
        if (!displayName || displayName.length < 2 || displayName.length > 24) {
            return jsonResponse({ error: 'Display name must be 2-24 characters' }, 400);
        }
        
        // Basic profanity/invalid char filter
        const sanitized = displayName.trim().replace(/[<>'"&]/g, '');
        
        await env.DB.prepare(
            'UPDATE users SET display_name = ? WHERE id = ?'
        ).bind(sanitized, session.userId).run();
        
        return jsonResponse({ success: true, displayName: sanitized });
    } catch (err) {
        return jsonResponse({ error: 'Invalid request' }, 400);
    }
}

// ==================== MAIN ROUTER ====================

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // CORS headers for API requests (allow cross-domain during testing)
        const corsHeaders = {
            'Access-Control-Allow-Origin': FRONTEND_URL,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true'
        };
        
        // Handle preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        
        // ==================== AUTH ROUTES ====================
        
        // Start Google OAuth
        if (url.pathname === '/auth/google') {
            return handleOAuthStart('google', env, request);
        }
        
        // Start Discord OAuth
        if (url.pathname === '/auth/discord') {
            return handleOAuthStart('discord', env, request);
        }
        
        // Google OAuth callback
        if (url.pathname === '/auth/google/callback') {
            return handleOAuthCallback('google', env, request);
        }
        
        // Discord OAuth callback
        if (url.pathname === '/auth/discord/callback') {
            return handleOAuthCallback('discord', env, request);
        }
        
        // Get current user
        if (url.pathname === '/auth/user' && request.method === 'GET') {
            const response = await handleGetUser(env, request);
            // Add CORS headers
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }
        
        // Logout
        if (url.pathname === '/auth/logout' && request.method === 'POST') {
            const response = await handleLogout(env, request);
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }
        
        // Update profile
        if (url.pathname === '/auth/profile' && request.method === 'POST') {
            const response = await handleUpdateProfile(env, request);
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }
        
        // ==================== GAME ROUTES ====================
        
        // WebSocket upgrade for multiplayer
        if (request.headers.get('Upgrade') === 'websocket') {
            // Verify authentication for multiplayer
            const session = await getSession(env, request);
            if (!session) {
                return new Response('Unauthorized', { status: 401 });
            }
            
            // Pass user info to matchmaker
            const matchmakerId = env.MATCHMAKER.idFromName('global');
            const matchmaker = env.MATCHMAKER.get(matchmakerId);
            
            // Add user info to request headers for the matchmaker
            const newHeaders = new Headers(request.headers);
            newHeaders.set('X-User-Id', session.userId);
            newHeaders.set('X-User-Name', session.displayName);
            
            const newRequest = new Request(request.url, {
                method: request.method,
                headers: newHeaders,
                body: request.body
            });
            
            return matchmaker.fetch(newRequest);
        }
        
        // Health check
        if (url.pathname === '/health') {
            return new Response('OK', { status: 200 });
        }
        
        // Default response
        return new Response('Cryptid Fates Game Server', { status: 200 });
    }
};

// ==================== MATCHMAKER DURABLE OBJECT ====================
// (Keep your existing Matchmaker class but modify handleAuth to use verified user)

export class Matchmaker {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.players = new Map();
        this.connections = new Map();
        this.queues = {
            bo1: [],
            bo3: []
        };
        this.gameRooms = new Map();
    }
    
    async fetch(request) {
        const [client, server] = Object.values(new WebSocketPair());
        
        server.accept();
        
        const tempId = crypto.randomUUID();
        
        // Get verified user info from headers (set by main worker)
        const userId = request.headers.get('X-User-Id');
        const userName = request.headers.get('X-User-Name');
        
        // If we have verified user info, pre-authenticate
        if (userId) {
            this.connections.set(tempId, userId);
            this.players.set(userId, {
                ws: server,
                tempId,
                name: userName || 'Summoner',
                searching: false,
                mode: null,
                deckId: null,
                matchId: null
            });
            
            // Send authenticated message
            server.send(JSON.stringify({
                type: 'authenticated',
                playerId: userId,
                playerName: userName
            }));
        }
        
        server.addEventListener('message', async (event) => {
            try {
                const msg = JSON.parse(event.data);
                await this.handleMessage(tempId, server, msg);
            } catch (e) {
                console.error('Message handling error:', e);
            }
        });
        
        server.addEventListener('close', () => {
            this.handleDisconnect(tempId);
        });
        
        server.addEventListener('error', (e) => {
            console.error('WebSocket error:', e);
            this.handleDisconnect(tempId);
        });
        
        return new Response(null, { status: 101, webSocket: client });
    }
    
    async handleMessage(tempId, ws, msg) {
        switch (msg.type) {
            case 'auth':
                // Legacy auth - still allow for backwards compatibility
                // but prefer pre-authenticated sessions
                if (!this.connections.has(tempId)) {
                    this.handleAuth(tempId, ws, msg);
                }
                break;
                
            case 'findMatch':
                const findPlayerId = this.connections.get(tempId);
                if (findPlayerId) {
                    this.handleFindMatch(findPlayerId, msg);
                }
                break;
                
            case 'cancelMatch':
                const cancelPlayerId = this.connections.get(tempId);
                if (cancelPlayerId) {
                    this.handleCancelMatch(cancelPlayerId);
                }
                break;
                
            case 'action':
                await this.handleGameAction(tempId, msg);
                break;
            
            case 'kindlingSync':
                await this.handleKindlingSync(tempId, msg);
                break;
                
            case 'forfeit':
            case 'timeoutForfeit':
            case 'concede':
                await this.handleForfeit(tempId, msg);
                break;
                
            case 'rejoin':
                await this.forwardToGameRoom(msg);
                break;
            
            case 'rematch_request':
                await this.handleRematchRequest(tempId, msg);
                break;
                
            case 'leave_results':
                await this.handleLeaveResults(tempId, msg);
                break;
                
            case 'start_rematch':
                await this.handleStartRematch(tempId, msg);
                break;
        }
    }
    
    // ... (rest of Matchmaker methods remain the same as your existing code)
    
    handleAuth(tempId, ws, msg) {
        const playerId = msg.playerId || tempId;
        
        this.connections.set(tempId, playerId);
        
        this.players.set(playerId, {
            ws,
            tempId,
            name: msg.playerName || 'Summoner',
            searching: false,
            mode: null,
            deckId: null,
            matchId: null
        });
        
        ws.send(JSON.stringify({
            type: 'authenticated',
            playerId
        }));
    }
    
    handleFindMatch(playerId, msg) {
        console.log('[Matchmaker] findMatch request from:', playerId, 'mode:', msg.mode);
        
        const player = this.players.get(playerId);
        if (!player) {
            console.log('[Matchmaker] Player not found:', playerId);
            return;
        }
        
        player.searching = true;
        player.mode = msg.mode;
        player.deckId = msg.deckId;
        
        const queue = this.queues[msg.mode];
        console.log('[Matchmaker] Queue length:', queue.length, 'for mode:', msg.mode);
        
        if (queue.length > 0) {
            const opponentId = queue.shift();
            const opponent = this.players.get(opponentId);
            
            console.log('[Matchmaker] Found opponent in queue:', opponentId, 'searching:', opponent?.searching);
            
            if (opponent && opponent.searching) {
                console.log('[Matchmaker] Creating match between', playerId, 'and', opponentId);
                this.createMatch(playerId, opponentId, msg.mode);
                return;
            }
        }
        
        queue.push(playerId);
        console.log('[Matchmaker] Added to queue, new length:', queue.length);
    }
    
    handleCancelMatch(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        player.searching = false;
        
        for (const mode of ['bo1', 'bo3']) {
            const idx = this.queues[mode].indexOf(playerId);
            if (idx > -1) this.queues[mode].splice(idx, 1);
        }
    }
    
    async createMatch(player1Id, player2Id, mode) {
        const player1 = this.players.get(player1Id);
        const player2 = this.players.get(player2Id);
        
        if (!player1 || !player2) return;
        
        const matchId = crypto.randomUUID();
        const gameRoomId = this.env.GAME_ROOM.idFromName(matchId);
        const gameRoom = this.env.GAME_ROOM.get(gameRoomId);
        
        const coinFlip = Math.random();
        const goesFirst = coinFlip < 0.5 ? player1Id : player2Id;
        console.log(`[Matchmaker] Coin flip: ${coinFlip.toFixed(4)} - ${goesFirst === player1Id ? player1.name : player2.name} goes first`);
        
        await gameRoom.fetch(new Request('http://internal/init', {
            method: 'POST',
            body: JSON.stringify({
                matchId,
                mode,
                player1: { id: player1Id, name: player1.name, deckId: player1.deckId },
                player2: { id: player2Id, name: player2.name, deckId: player2.deckId },
                goesFirst
            })
        }));
        
        player1.searching = false;
        player1.matchId = matchId;
        player2.searching = false;
        player2.matchId = matchId;
        
        const matchFoundMsg1 = {
            type: 'matchFound',
            matchId,
            opponentId: player2Id,
            opponentName: player2.name,
            goesFirst: goesFirst === player1Id
        };
        
        const matchFoundMsg2 = {
            type: 'matchFound',
            matchId,
            opponentId: player1Id,
            opponentName: player1.name,
            goesFirst: goesFirst === player2Id
        };
        
        player1.ws.send(JSON.stringify(matchFoundMsg1));
        player2.ws.send(JSON.stringify(matchFoundMsg2));
        
        this.gameRooms.set(matchId, {
            matchId,
            mode,
            players: { [player1Id]: player1.ws, [player2Id]: player2.ws },
            gameRoom,
            rematchRequests: {}
        });
    }
    
    async handleGameAction(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (!room) return;
        
        const opponentMsg = {
            type: 'opponentAction',
            action: msg.action,
            state: msg.state,
            playerId: playerId
        };
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pid !== playerId && pws.readyState === 1) {
                pws.send(JSON.stringify(opponentMsg));
            }
        }
        
        await this.forwardToGameRoom(msg);
    }
    
    async handleKindlingSync(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (!room) return;
        
        const syncMsg = {
            type: 'kindlingSync',
            kindling: msg.kindling,
            playerId: playerId
        };
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pid !== playerId && pws.readyState === 1) {
                pws.send(JSON.stringify(syncMsg));
            }
        }
    }
    
    async handleForfeit(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (!room) return;
        
        const winnerId = Object.keys(room.players).find(id => id !== playerId);
        
        const endMsg = {
            type: 'matchEnd',
            winner: winnerId,
            reason: msg.type === 'timeoutForfeit' ? 'timeout' : 'forfeit'
        };
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pws.readyState === 1) {
                pws.send(JSON.stringify(endMsg));
            }
        }
        
        this.gameRooms.delete(player.matchId);
    }
    
    async handleRematchRequest(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (!room) return;
        
        room.rematchRequests = room.rematchRequests || {};
        room.rematchRequests[playerId] = true;
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pid !== playerId && pws.readyState === 1) {
                pws.send(JSON.stringify({ type: 'rematch_requested' }));
                
                if (room.rematchRequests[pid]) {
                    this.startRematchGame(room);
                    return;
                }
            }
        }
    }
    
    async handleLeaveResults(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (!room) return;
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pid !== playerId && pws.readyState === 1) {
                pws.send(JSON.stringify({ type: 'opponent_left_results' }));
            }
        }
        
        player.matchId = null;
    }
    
    async handleStartRematch(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (room) {
            this.startRematchGame(room);
        }
    }
    
    startRematchGame(room) {
        const playerIds = Object.keys(room.players);
        if (playerIds.length !== 2) return;
        
        const player1 = this.players.get(playerIds[0]);
        const player2 = this.players.get(playerIds[1]);
        
        if (!player1 || !player2) return;
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pws.readyState === 1) {
                pws.send(JSON.stringify({ type: 'rematch_accepted' }));
            }
        }
        
        room.rematchRequests = {};
        
        const goesFirst = playerIds[Math.random() < 0.5 ? 0 : 1];
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pws.readyState === 1) {
                const opponentId = playerIds.find(id => id !== pid);
                const opponent = this.players.get(opponentId);
                const matchFoundMsg = {
                    type: 'matchFound',
                    matchId: room.matchId,
                    opponentId: opponentId,
                    opponentName: opponent?.name || 'Opponent',
                    goesFirst: goesFirst === pid,
                    mode: room.mode || 'bo1',
                    isRematch: true
                };
                pws.send(JSON.stringify(matchFoundMsg));
            }
        }
    }
    
    async forwardToGameRoom(msg) {
        const room = this.gameRooms?.get(msg.matchId);
        if (!room) return;
        
        await room.gameRoom.fetch(new Request('http://internal/action', {
            method: 'POST',
            body: JSON.stringify(msg)
        }));
    }
    
    handleDisconnect(tempId) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player) return;
        
        this.handleCancelMatch(playerId);
        
        if (player.matchId && this.gameRooms) {
            const room = this.gameRooms.get(player.matchId);
            if (room) {
                room.gameRoom.fetch(new Request('http://internal/disconnect', {
                    method: 'POST',
                    body: JSON.stringify({ playerId, matchId: player.matchId })
                }));
            }
        }
        
        this.connections.delete(tempId);
        this.players.delete(playerId);
    }
}

// ==================== GAME ROOM DURABLE OBJECT ====================
// (Keep your existing GameRoom class unchanged)

export class GameRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        
        this.matchId = null;
        this.mode = null;
        this.players = {};
        this.currentTurn = null;
        this.phase = 'conjure1';
        this.turnNumber = 1;
        
        this.TURN_TIME = 150;
        this.WARNING_TIME = 30;
        this.DISCONNECT_GRACE = 60000;
        this.TIMEOUT_FORFEIT = 3;
        
        this.turnStartTime = null;
        this.turnTimer = null;
        this.warningSent = false;
        
        this.gameState = {
            player1: { pyre: 0, field: [[null,null,null],[null,null,null]], hand: [], kindling: [] },
            player2: { pyre: 0, field: [[null,null,null],[null,null,null]], hand: [], kindling: [] }
        };
        
        this.scores = { player1: 0, player2: 0 };
        this.currentGame = 1;
        
        this.disconnectTimers = {};
    }
    
    async fetch(request) {
        const url = new URL(request.url);
        
        if (request.method === 'POST') {
            const body = await request.json();
            
            switch (url.pathname) {
                case '/init':
                    return this.handleInit(body);
                case '/action':
                    return this.handleAction(body);
                case '/disconnect':
                    return this.handleDisconnect(body);
            }
        }
        
        return new Response('OK', { status: 200 });
    }
    
    handleInit(data) {
        this.matchId = data.matchId;
        this.mode = data.mode;
        this.players = {
            [data.player1.id]: { ...data.player1, connected: true, slot: 'player1', timeouts: 0 },
            [data.player2.id]: { ...data.player2, connected: true, slot: 'player2', timeouts: 0 }
        };
        this.currentTurn = data.goesFirst;
        
        this.startTurnTimer();
        
        return new Response('Initialized', { status: 200 });
    }
    
    startTurnTimer() {
        this.stopTurnTimer();
        this.turnStartTime = Date.now();
        this.warningSent = false;
        
        this.turnTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
            const remaining = this.TURN_TIME - elapsed;
            
            if (remaining <= this.WARNING_TIME && !this.warningSent) {
                this.warningSent = true;
                this.broadcastToMatch({
                    type: 'timerWarning',
                    playerId: this.currentTurn,
                    timeRemaining: remaining
                });
            }
            
            if (remaining <= 0) {
                this.handleTurnTimeout();
            }
        }, 1000);
    }
    
    stopTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }
    
    handleTurnTimeout() {
        this.stopTurnTimer();
        
        const player = this.players[this.currentTurn];
        if (!player) return;
        
        player.timeouts++;
        
        this.broadcastToMatch({
            type: 'turnTimeout',
            playerId: this.currentTurn,
            totalTimeouts: player.timeouts
        });
        
        if (player.timeouts >= this.TIMEOUT_FORFEIT) {
            const winnerId = Object.keys(this.players).find(id => id !== this.currentTurn);
            this.endMatch(winnerId, 'timeout');
            return;
        }
        
        this.advancePhase(this.currentTurn);
        this.broadcastToMatch({
            type: 'turnChange',
            currentTurn: this.currentTurn,
            phase: this.phase,
            turn: this.turnNumber
        });
        
        this.startTurnTimer();
    }
    
    broadcastToMatch(msg) {
        console.log('[GameRoom] Broadcast:', msg.type);
    }
    
    async handleAction(data) {
        const { playerId, matchId, action, type } = data;
        
        if (type === 'forfeit') {
            return this.handleForfeitAction(playerId, 'forfeit');
        }
        
        if (type === 'timeoutForfeit') {
            return this.handleForfeitAction(playerId, 'timeout');
        }
        
        if (type === 'concede') {
            return this.handleConcede(playerId);
        }
        
        if (type === 'rejoin') {
            return this.handleRejoin(playerId);
        }
        
        if (type === 'action' && playerId !== this.currentTurn) {
            return new Response(JSON.stringify({ error: 'Not your turn' }), { status: 400 });
        }
        
        const result = this.processAction(playerId, action);
        
        if (result.error) {
            return new Response(JSON.stringify({ error: result.error }), { status: 400 });
        }
        
        return new Response(JSON.stringify({ success: true, result }), { status: 200 });
    }
    
    handleForfeitAction(playerId, reason) {
        this.stopTurnTimer();
        const winnerId = Object.keys(this.players).find(id => id !== playerId);
        return this.endMatch(winnerId, reason);
    }
    
    processAction(playerId, action) {
        switch (action?.type) {
            case 'summon':
            case 'attack':
            case 'burst':
            case 'trap':
            case 'aura':
            case 'pyre':
                return { success: true };
                
            case 'endPhase':
                this.advancePhase(playerId);
                return { success: true, newPhase: this.phase };
                
            default:
                return { error: 'Unknown action type' };
        }
    }
    
    advancePhase(playerId) {
        const phases = ['conjure1', 'combat', 'conjure2', 'end'];
        const currentIndex = phases.indexOf(this.phase);
        
        if (currentIndex < phases.length - 1) {
            this.phase = phases[currentIndex + 1];
        } else {
            this.phase = 'conjure1';
            this.currentTurn = Object.keys(this.players).find(id => id !== this.currentTurn);
            this.turnNumber++;
            
            this.startTurnTimer();
        }
    }
    
    handleConcede(playerId) {
        const winnerId = Object.keys(this.players).find(id => id !== playerId);
        return this.endMatch(winnerId, 'concede');
    }
    
    handleRejoin(playerId) {
        const player = this.players[playerId];
        if (player) {
            player.connected = true;
            
            if (this.disconnectTimers[playerId]) {
                clearTimeout(this.disconnectTimers[playerId]);
                delete this.disconnectTimers[playerId];
            }
            
            this.broadcastToMatch({
                type: 'opponentReconnected',
                playerId
            });
            
            const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
            const timeRemaining = Math.max(0, this.TURN_TIME - elapsed);
            
            const playerTimeouts = {};
            Object.entries(this.players).forEach(([id, p]) => {
                playerTimeouts[id] = p.timeouts;
            });
            
            return new Response(JSON.stringify({
                type: 'gameState',
                state: this.gameState,
                currentTurn: this.currentTurn,
                phase: this.phase,
                turn: this.turnNumber,
                timeRemaining,
                playerTimeouts,
                scores: this.mode === 'bo3' ? this.scores : null
            }), { status: 200 });
        }
        
        return new Response(JSON.stringify({ error: 'Player not in match' }), { status: 400 });
    }
    
    handleDisconnect(data) {
        const { playerId } = data;
        const player = this.players[playerId];
        
        if (player) {
            player.connected = false;
            
            this.broadcastToMatch({
                type: 'opponentDisconnected',
                playerId,
                waitingForReconnect: true
            });
            
            this.disconnectTimers[playerId] = setTimeout(() => {
                const winnerId = Object.keys(this.players).find(id => id !== playerId);
                this.endMatch(winnerId, 'disconnect');
            }, this.DISCONNECT_GRACE);
        }
        
        return new Response('OK', { status: 200 });
    }
    
    endMatch(winnerId, reason) {
        this.stopTurnTimer();
        
        if (this.mode === 'bo3') {
            const winnerSlot = this.players[winnerId].slot;
            this.scores[winnerSlot]++;
            
            if (this.scores.player1 < 2 && this.scores.player2 < 2) {
                if (reason === 'forfeit' || reason === 'timeout' || reason === 'disconnect') {
                    return new Response(JSON.stringify({
                        type: 'matchEnd',
                        winner: winnerId,
                        reason,
                        finalScores: this.scores
                    }), { status: 200 });
                }
                
                this.currentGame++;
                this.resetGameState();
                
                return new Response(JSON.stringify({
                    type: 'gameEnd',
                    winner: winnerId,
                    reason,
                    scores: this.scores,
                    nextGame: this.currentGame
                }), { status: 200 });
            }
        }
        
        return new Response(JSON.stringify({
            type: 'matchEnd',
            winner: winnerId,
            reason,
            finalScores: this.mode === 'bo3' ? this.scores : null
        }), { status: 200 });
    }
    
    resetGameState() {
        this.gameState = {
            player1: { pyre: 0, field: [[null,null,null],[null,null,null]], hand: [], kindling: [] },
            player2: { pyre: 0, field: [[null,null,null],[null,null,null]], hand: [], kindling: [] }
        };
        this.phase = 'conjure1';
        this.turnNumber = 1;
        
        const playerIds = Object.keys(this.players);
        this.currentTurn = this.currentTurn === playerIds[0] ? playerIds[1] : playerIds[0];
        
        this.startTurnTimer();
    }
}