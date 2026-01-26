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

const SERVER_VERSION = 21; // v=21 - Increment for cache invalidation

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
            // Try to get session (optional - allow unauthenticated for legacy/guest support)
            const session = await getSession(env, request);
            
            // Pass to matchmaker
            const matchmakerId = env.MATCHMAKER.idFromName('global');
            const matchmaker = env.MATCHMAKER.get(matchmakerId);
            
            // Add user info to request headers for the matchmaker (if authenticated)
            const newHeaders = new Headers(request.headers);
            if (session) {
                newHeaders.set('X-User-Id', session.userId);
                newHeaders.set('X-User-Name', session.displayName || 'Player');
            }
            // If no session, Matchmaker will handle via legacy 'auth' message
            
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
            
            // Time sync ping/pong
            case 'ping':
                ws.send(JSON.stringify({
                    type: 'pong',
                    clientTime: msg.clientTime,
                    serverTime: Date.now()
                }));
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
        
        // Forward action to GameRoom for authoritative processing
        const response = await room.gameRoom.fetch(new Request('http://internal/action', {
            method: 'POST',
            body: JSON.stringify({
                playerId: playerId,
                action: msg.action,
                deckData: msg.deckData // For initial deck setup
            })
        }));
        
        const result = await response.json();
        
        if (!result.valid) {
            // Send error back to sender only
            const senderWs = room.players[playerId];
            if (senderWs?.readyState === 1) {
                senderWs.send(JSON.stringify({
                    type: 'actionError',
                    error: result.error
                }));
            }
            return;
        }
        
        // Server timestamp for synchronized playback
        const serverTime = result.serverTime || Date.now();
        const startAtServerMs = serverTime + 150; // 150ms buffer for network
        
        // Send personalized state and events to each player
        // Player 1 gets player1 data, Player 2 gets player2 data
        const playerIds = Object.keys(room.players);
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pws.readyState !== 1) continue;
            
            // Determine which data to send based on player
            const isPlayer1 = pid === playerIds[0];
            const playerData = isPlayer1 ? result.player1 : result.player2;
            
            if (!playerData) continue;
            
            const resolvedAction = {
                type: 'resolvedAction',
                action: msg.action,
                events: playerData.events,
                animationSequence: playerData.animationSequence || [],
                state: playerData.state,
                sourcePlayerId: playerId,
                isMyAction: pid === playerId,
                serverTime: result.serverTime || serverTime,
                startAtServerMs: result.startAtServerMs || startAtServerMs,
                matchId: player.matchId
            };
            
            pws.send(JSON.stringify(resolvedAction));
        }
    }
    
    async handleKindlingSync(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (!room) return;
        
        const serverTime = Date.now();
        
        const syncMsg = {
            type: 'kindlingSync',
            kindling: msg.kindling,
            sourcePlayerId: playerId,
            serverTime: serverTime
        };
        
        // Broadcast to BOTH players
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pws.readyState === 1) {
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

// ==================== GAME ENGINE (EMBEDDED) ====================
// Headless authoritative game logic - runs on server only

// Game event types
const GameEventTypes = {
    MATCH_START: 'matchStart',
    MATCH_END: 'matchEnd',
    TURN_START: 'turnStart',
    TURN_END: 'turnEnd',
    PHASE_CHANGE: 'phaseChange',
    CARD_DRAWN: 'cardDrawn',
    CRYPTID_SUMMONED: 'cryptidSummoned',
    CRYPTID_DIED: 'cryptidDied',
    CRYPTID_PROMOTED: 'cryptidPromoted',
    ATTACK_DECLARED: 'attackDeclared',
    DAMAGE_DEALT: 'damageDealt',
    HEALING_DONE: 'healingDone',
    STATUS_APPLIED: 'statusApplied',
    STATUS_REMOVED: 'statusRemoved',
    PYRE_CHANGED: 'pyreChanged',
    MESSAGE: 'message',
    ABILITY_TRIGGERED: 'abilityTriggered',
};

// ==================== SEEDED RNG (inline for Durable Object) ====================

class SeededRNG {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
    
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return this.seed;
    }
    
    float() {
        return (this.next() - 1) / 2147483646;
    }
    
    int(min, max) {
        return Math.floor(this.float() * (max - min + 1)) + min;
    }
    
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// ==================== INLINE SERVER CARD REGISTRY ====================
// Simplified card definitions for server-side ability execution

function getAilmentStacks(target) {
    if (!target) return 0;
    let stacks = 0;
    if (target.paralyzed) stacks += 1;
    if (target.burnStacks > 0) stacks += target.burnStacks;
    if (target.bleedStacks > 0) stacks += target.bleedStacks;
    if (target.calamityCounters > 0) stacks += target.calamityCounters;
    if (target.curseTokens > 0) stacks += target.curseTokens;
    return stacks;
}

const ServerCardAbilities = {
    // Hellpup abilities
    hellpup: {
        onCombat: (cryptid, game) => { cryptid.guardAvailable = true; },
        onTurnStart: (cryptid, game) => {
            if (cryptid.col === game.getCombatCol(cryptid.owner)) {
                cryptid.guardAvailable = true;
            }
        },
        onBeforeDefend: (cryptid, game, ctx) => {
            if (cryptid.guardAvailable && ctx.attacker) {
                cryptid.guardAvailable = false;
                game.applyBurn(ctx.attacker, 1);
                cryptid.negateIncomingAttack = true;
                return { blocked: true };
            }
            return null;
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.attacksApplyBurn = true;
        },
        onDeath: (cryptid, game) => {
            if (cryptid.killedBy === 'burn') {
                const evo = game.findEvolutionCard(cryptid.owner, 'hellhound');
                if (evo) {
                    cryptid.preventDeath = true;
                    game.evolveInPlace(cryptid, evo.card);
                    game.removeCard(evo);
                    return { evolved: 'hellhound' };
                }
            }
            return null;
        }
    },
    
    // Myling abilities
    myling: {
        bonusVsBurning: 1,
        onSupport: (cryptid, game) => { cryptid.burnOnCombatantDamage = true; },
        onDeath: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            for (let col = 0; col < 2; col++) {
                const target = game.getFieldCryptid(enemyOwner, col, cryptid.row);
                if (target) game.applyBurn(target, 1);
            }
        }
    },
    
    // Hellhound abilities
    hellhound: {
        onKill: (cryptid, game, ctx) => {
            const target = ctx.target;
            const adjacentRows = [target.row - 1, target.row + 1].filter(r => r >= 0 && r < 3);
            const targetField = game.getField(target.owner);
            const combatCol = game.getCombatCol(target.owner);
            
            for (const row of adjacentRows) {
                const adjacent = targetField[combatCol][row];
                if (adjacent) game.applyBurn(adjacent, 1);
            }
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.bonusVsBurning = (combatant.bonusVsBurning || 0) + 2;
        }
    },
    
    // Kuchisake abilities
    kuchisake: {
        onEnterCombat: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            const supportCol = game.getSupportCol(enemyOwner);
            const target = game.getFieldCryptid(enemyOwner, supportCol, cryptid.row);
            
            if (target) {
                target.killedBy = 'destroyer';
                game.killCryptid(target);
                return { killed: target.key };
            }
            return null;
        },
        onCombatAttack: (cryptid, game, ctx) => {
            if (game.rng.float() < 0.5) {
                game.dealDamage(cryptid, 3, cryptid, 'explosion');
                if (ctx.target) game.dealDamage(ctx.target, 3, cryptid, 'explosion');
                return { exploded: true };
            }
            return { exploded: false };
        }
    },
    
    // Mothman abilities
    mothman: {
        canTargetAny: true,
        onEnterCombat: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            const targets = [];
            const deaths = [];
            
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const enemy = game.getFieldCryptid(enemyOwner, col, row);
                    if (enemy) {
                        const stacks = getAilmentStacks(enemy);
                        if (stacks > 0) {
                            targets.push({
                                cryptid: enemy,
                                damage: stacks,
                                col, row,
                                owner: enemyOwner,
                                isCombatant: col === game.getCombatCol(enemyOwner)
                            });
                        }
                    }
                }
            }
            
            if (targets.length === 0) return null;
            
            // Apply damage
            for (const t of targets) {
                game.dealDamage(t.cryptid, t.damage, cryptid, 'harbinger');
                if (t.cryptid.currentHp <= 0) {
                    t.cryptid.killedBy = 'harbinger';
                    deaths.push(t);
                }
            }
            
            // Process deaths
            for (const d of deaths) {
                game.killCryptid(d.cryptid, { skipPromotion: true });
            }
            
            // Queue promotions
            for (const d of deaths) {
                if (d.isCombatant) game.queuePromotion(d.owner, d.row);
            }
            
            return { targets: targets.length, deaths: deaths.length };
        },
        onSupport: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            let cleansed = 0;
            
            for (let row = 0; row < 3; row++) {
                const c = field[combatCol][row];
                if (c) {
                    const stacks = getAilmentStacks(c);
                    if (stacks > 0) {
                        c.paralyzed = false;
                        c.burnStacks = 0;
                        c.bleedStacks = 0;
                        c.curseTokens = 0;
                        c.currentAtk = (c.currentAtk || c.atk) + stacks;
                        c.currentHp = (c.currentHp || c.hp) + stacks;
                        c.maxHp = (c.maxHp || c.hp) + stacks;
                        cleansed += stacks;
                    }
                    c.hasMothmanImmunity = true;
                }
            }
            return { cleansed };
        },
        onAnyDeath: (cryptid, game, ctx) => {
            if (ctx.deadCryptid && ctx.deadCryptid.owner !== cryptid.owner) {
                const hadAilments = getAilmentStacks(ctx.deadCryptid) > 0 ||
                    ctx.deadCryptid.killedBy === 'burn' ||
                    ctx.deadCryptid.killedBy === 'harbinger';
                
                if (hadAilments) {
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                    cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
                    cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
                    return { grew: true };
                }
            }
            return null;
        }
    },
    
    // Cerberus abilities
    cerberus: {
        attacksAllCombatants: true,
        onKill: (cryptid, game, ctx) => {
            const target = ctx.target;
            const adjacentRows = [target.row - 1, target.row + 1].filter(r => r >= 0 && r < 3);
            const targetField = game.getField(target.owner);
            const combatCol = game.getCombatCol(target.owner);
            
            for (const row of adjacentRows) {
                const adjacent = targetField[combatCol][row];
                if (adjacent) game.applyBurn(adjacent, 2);
            }
        },
        onSupport: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            for (let row = 0; row < 3; row++) {
                const c = field[combatCol][row];
                if (c) c.bonusVsBurning = (c.bonusVsBurning || 0) + 2;
            }
        }
    },
    
    // Stormhawk abilities
    stormhawk: {
        canTargetAny: true,
        onSummon: (cryptid, game) => {
            if (cryptid.col === game.getCombatCol(cryptid.owner)) {
                const field = game.getField(cryptid.owner);
                const combatCol = game.getCombatCol(cryptid.owner);
                let count = 0;
                for (let row = 0; row < 3; row++) {
                    if (field[combatCol][row]) count++;
                }
                if (count === 1) {
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                }
            }
        },
        onSupport: (cryptid, game) => { cryptid.thermalAvailable = true; }
    },
    
    // Bigfoot abilities
    bigfoot: {
        onDamageTaken: (cryptid, game, ctx) => {
            if (ctx.source && ctx.source.owner !== cryptid.owner) {
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
                cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
            }
        }
    },
    
    // Feu Follet abilities
    feuFollet: {
        onDamageTaken: (cryptid, game, ctx) => {
            if (ctx.source && ctx.source.owner !== cryptid.owner && ctx.damage > 0) {
                game.applyCurse(ctx.source, 2);
            }
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.attacksApplyCurse = 1;
        }
    },
    
    // Rougarou abilities
    rougarou: {
        onKill: (cryptid, game) => {
            cryptid.currentHp = cryptid.maxHp;
        },
        onDeath: (cryptid, game) => {
            if (!cryptid.hasResurrected && game.rng.float() < 0.5) {
                cryptid.preventDeath = true;
                cryptid.currentHp = 1;
                cryptid.hasResurrected = true;
                return { resurrected: true };
            }
            return null;
        }
    },
    
    // Vampire Bat abilities
    vampireBat: {
        hasLifesteal: true,
        onCombatHit: (cryptid, game, ctx) => {
            if (ctx.target) {
                // Heal for damage dealt
                const damage = cryptid.currentAtk || cryptid.atk;
                cryptid.currentHp = Math.min(cryptid.maxHp, (cryptid.currentHp || cryptid.hp) + damage);
            }
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.grantPyreOnDamage = true;
        }
    },
    
    // Gremlin abilities
    gremlin: {
        onCombat: (cryptid, game) => {
            cryptid.appliesAilmentAtkDebuff = true;
            // Apply debuff to enemy across
            const enemy = game.getEnemyCombatantAcross(cryptid);
            if (enemy) {
                const stacks = getAilmentStacks(enemy);
                enemy.atkDebuff = (enemy.atkDebuff || 0) + stacks;
            }
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.gremlinSupport = true;
        }
    },
    
    // Boggart abilities
    boggart: {
        ailmentImmune: true,
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                let cleansed = 0;
                if (combatant.paralyzed) { combatant.paralyzed = false; cleansed++; }
                if (combatant.burnStacks > 0) { combatant.burnStacks = 0; cleansed++; }
                if (combatant.bleedStacks > 0) { combatant.bleedStacks = 0; cleansed++; }
                if (combatant.curseTokens > 0) { combatant.curseTokens = 0; cleansed++; }
                
                if (cleansed > 0) {
                    combatant.currentHp = (combatant.currentHp || combatant.hp) + cleansed;
                    combatant.maxHp = (combatant.maxHp || combatant.hp) + cleansed;
                }
            }
        }
    },
    
    // Rooftop Gargoyle abilities
    rooftopGargoyle: {
        onDefend: (cryptid, game, ctx) => {
            if (ctx.attacker && getAilmentStacks(ctx.attacker) > 0) {
                return { damageReduction: 2 };
            }
            return null;
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.gargoyleProtection = true;
        }
    },
    
    // Decay Rat abilities
    decayRat: {
        onCombat: (cryptid, game) => { cryptid.swapAvailable = true; },
        onSupport: (cryptid, game) => {
            cryptid.debuffAvailable = true;
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.decayRatSupport = cryptid;
        }
    },
    
    // Skeleton King abilities
    skeletonKing: {
        onCombat: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            const adjacentRows = [cryptid.row - 1, cryptid.row + 1].filter(r => r >= 0 && r < 3);
            
            for (const row of adjacentRows) {
                const ally = field[combatCol][row];
                if (ally) {
                    ally.currentAtk = (ally.currentAtk || ally.atk) + 1;
                    ally.currentHp = (ally.currentHp || ally.hp) + 1;
                    ally.maxHp = (ally.maxHp || ally.hp) + 1;
                }
            }
        },
        onDeath: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            const adjacentRows = [cryptid.row - 1, cryptid.row + 1].filter(r => r >= 0 && r < 3);
            
            for (const row of adjacentRows) {
                if (!field[combatCol][row]) {
                    // Create bone minion token
                    const minion = game.createCryptid({
                        key: 'boneMinion',
                        name: 'Bone Minion',
                        atk: 1,
                        hp: 1,
                        element: 'blood',
                        isToken: true
                    }, cryptid.owner, combatCol, row);
                    field[combatCol][row] = minion;
                }
            }
        }
    },
    
    // Mana Wyrm abilities  
    manaWyrm: {
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.reflectAilments = true;
        }
    },
    
    // Thunderbird abilities
    thunderbird: {
        canTargetAny: true,
        onCombatAttack: (cryptid, game, ctx) => {
            // Chain lightning to adjacent
            if (ctx.target) {
                const adjacentRows = [ctx.target.row - 1, ctx.target.row + 1].filter(r => r >= 0 && r < 3);
                const enemyField = game.getField(ctx.target.owner);
                const combatCol = game.getCombatCol(ctx.target.owner);
                
                for (const row of adjacentRows) {
                    const adjacent = enemyField[combatCol][row];
                    if (adjacent) {
                        game.dealDamage(adjacent, 1, cryptid, 'chainLightning');
                    }
                }
            }
        }
    },
    
    // Sasquatch abilities
    sasquatch: {
        onDamageTaken: (cryptid, game, ctx) => {
            if (ctx.source && ctx.source.owner !== cryptid.owner) {
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
            }
        },
        onTurnStartSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                combatant.currentHp = Math.min(combatant.maxHp, (combatant.currentHp || combatant.hp) + 1);
            }
        }
    },
    
    // Newborn Wendigo abilities
    newbornWendigo: {
        onCombat: (cryptid, game) => {
            const enemy = game.getEnemyCombatantAcross(cryptid);
            if (enemy && !enemy.wendigoIntimidateApplied) {
                enemy.atkDebuff = (enemy.atkDebuff || 0) + 1;
                enemy.wendigoIntimidateApplied = true;
            }
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant && !cryptid._buffedCombatant) {
                combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 1;
                combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
                combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
                cryptid._buffedCombatant = combatant.id;
            }
        }
    },
    
    // Swamp Rat abilities
    swampRat: {
        onCombatHit: (cryptid, game, ctx) => {
            if (ctx.target) {
                const enemyOwner = ctx.target.owner;
                const enemyPyre = game.getPyre(enemyOwner);
                if (enemyPyre > 0) {
                    game.modifyPyre(enemyOwner, -1);
                    game.modifyPyre(cryptid.owner, 1);
                }
            }
        },
        onTurnStartSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant && combatant.curseTokens > 0) {
                game.modifyPyre(cryptid.owner, 1);
            }
        }
    },
    
    // Voodoo Doll abilities
    voodooDoll: {
        onDamageTaken: (cryptid, game, ctx) => {
            const enemy = game.getEnemyCombatantAcross(cryptid);
            if (enemy && ctx.damage > 0) {
                const mirrorDamage = Math.ceil(ctx.damage / 2);
                game.dealDamage(enemy, mirrorDamage, cryptid, 'mirror');
            }
        }
    },
    
    // Plague Rat abilities (evolved from Swamp Rat)
    plagueRat: {
        onCombatHit: (cryptid, game, ctx) => {
            if (ctx.target) {
                // Steal 2 pyre
                const enemyOwner = ctx.target.owner;
                const enemyPyre = game.getPyre(enemyOwner);
                const toSteal = Math.min(2, enemyPyre);
                if (toSteal > 0) {
                    game.modifyPyre(enemyOwner, -toSteal);
                    game.modifyPyre(cryptid.owner, toSteal);
                }
            }
        },
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) combatant.spreadsCurse = true;
        }
    }
};

// ==================== GAME ROOM DURABLE OBJECT ====================
// Authoritative game server - processes actions and broadcasts results

export class GameRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        
        // Match metadata
        this.matchId = null;
        this.mode = null;
        this.players = {};    // playerId -> { slot, name, connected, timeouts, deckConfig }
        this.playerIds = [];  // [player1Id, player2Id]
        
        // Timer settings
        this.TURN_TIME = 150;
        this.WARNING_TIME = 30;
        this.DISCONNECT_GRACE = 60000;
        this.TIMEOUT_FORFEIT = 3;
        
        this.turnStartTime = null;
        this.turnTimer = null;
        this.warningSent = false;
        
        // RNG
        this.rng = null;
        this.seed = null;
        
        // Authoritative game state
        this.gameState = {
            // Fields: [col][row] where player col 0=combat, col 1=support
            playerField: [[null, null, null], [null, null, null]],
            enemyField: [[null, null, null], [null, null, null]],
            
            // Hands (array of card objects)
            playerHand: [],
            enemyHand: [],
            
            // Kindling pools
            playerKindling: [],
            enemyKindling: [],
            
            // Resources - First player (player1) starts with 1 pyre
            playerPyre: 1,
            enemyPyre: 0,
            
            // Turn state
            currentTurn: 'player', // 'player' = player1, 'enemy' = player2
            phase: 'conjure1',
            turnNumber: 1,
            
            // Traps
            playerTraps: [null, null, null],
            enemyTraps: [null, null, null],
            
            // Decks
            playerDeck: [],
            enemyDeck: [],
            
            // Per-turn flags
            playerKindlingPlayed: false,
            enemyKindlingPlayed: false,
            playerPyreCardPlayed: false,
            enemyPyreCardPlayed: false,
            playerPyreBurnUsed: false,
            enemyPyreBurnUsed: false,
            
            // Counters
            playerDeaths: 0,
            enemyDeaths: 0,
            
            // Game end
            gameOver: false,
            winner: null,
            
            // Unique IDs
            nextCryptidId: 1,
        };
        
        // Event log for current action
        this.events = [];
        
        // Animation sequence for current action
        this.animationSequence = [];
        
        // Pending promotions
        this.pendingPromotions = [];
        
        // Death listeners (for Mothman etc)
        this.deathListeners = [];
        
        // BO3 tracking
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
    
    // ==================== INITIALIZATION ====================
    
    handleInit(data) {
        this.matchId = data.matchId;
        this.mode = data.mode;
        
        // Store player info
        const p1Id = data.player1.id;
        const p2Id = data.player2.id;
        this.playerIds = [p1Id, p2Id];
        
        this.players = {
            [p1Id]: { 
                ...data.player1, 
                connected: true, 
                slot: 'player1', 
                timeouts: 0,
                deckConfig: data.player1.deckConfig || null
            },
            [p2Id]: { 
                ...data.player2, 
                connected: true, 
                slot: 'player2', 
                timeouts: 0,
                deckConfig: data.player2.deckConfig || null
            }
        };
        
        // Initialize RNG
        this.seed = data.seed || Date.now();
        this.rng = new SeededRNG(this.seed);
        
        // Determine first player
        const firstPlayerId = data.goesFirst || this.playerIds[this.rng.int(0, 1)];
        this.gameState.currentTurn = firstPlayerId === p1Id ? 'player' : 'enemy';
        
        // TODO: Initialize decks from player deck configs
        // For now, clients will send deck data with first action
        
        this.startTurnTimer();
        
        // Emit match start event
        this.emit(GameEventTypes.MATCH_START, {
            matchId: this.matchId,
            player1: p1Id,
            player2: p2Id,
            firstPlayer: firstPlayerId,
            seed: this.seed
        });
        
        return new Response(JSON.stringify({
            success: true,
            matchId: this.matchId,
            firstPlayer: firstPlayerId,
            seed: this.seed
        }), { status: 200 });
    }
    
    // ==================== ACTION PROCESSING ====================
    
    async handleAction(data) {
        const { playerId, action, type, deckData } = data;
        
        // Initialize deck if provided (first action of match for this player)
        // Check THIS PLAYER's deck, not just player1's deck
        if (deckData) {
            const isPlayer1 = playerId === this.playerIds[0];
            const playerDeck = isPlayer1 ? this.gameState.playerDeck : this.gameState.enemyDeck;
            if (!playerDeck || playerDeck.length === 0) {
                this.initializeDecks(playerId, deckData);
            }
        }
        
        // Handle special action types
        if (type === 'forfeit') {
            return this.handleForfeit(playerId, 'forfeit');
        }
        if (type === 'concede') {
            return this.handleForfeit(playerId, 'concede');
        }
        if (type === 'rejoin') {
            return this.handleRejoin(playerId);
        }
        
        // Validate it's this player's turn
        const isPlayer1 = playerId === this.playerIds[0];
        const expectedTurn = isPlayer1 ? 'player' : 'enemy';
        
        if (this.gameState.currentTurn !== expectedTurn) {
            return new Response(JSON.stringify({ 
                valid: false, 
                error: 'Not your turn' 
            }), { status: 400 });
        }
        
        // Process the action (events/animations cleared inside processAction)
        const result = this.processAction(playerId, action);
        
        if (!result.valid) {
            return new Response(JSON.stringify(result), { status: 400 });
        }
        
        // Return result with events, animations, and state for both players
        const player1State = this.getStateForPlayer(this.playerIds[0]);
        const player2State = this.getStateForPlayer(this.playerIds[1]);
        const player1Events = this.filterEventsForPlayer(this.events, this.playerIds[0]);
        const player2Events = this.filterEventsForPlayer(this.events, this.playerIds[1]);
        const player1Anims = this.filterAnimationsForPlayer(this.animationSequence, this.playerIds[0]);
        const player2Anims = this.filterAnimationsForPlayer(this.animationSequence, this.playerIds[1]);
        
        const serverTime = Date.now();
        const startAtServerMs = serverTime + 150; // 150ms buffer for network
        
        return new Response(JSON.stringify({
            valid: true,
            sourcePlayerId: playerId,
            serverTime,
            startAtServerMs,
            player1: {
                playerId: this.playerIds[0],
                events: player1Events,
                animationSequence: player1Anims,
                state: player1State
            },
            player2: {
                playerId: this.playerIds[1],
                events: player2Events,
                animationSequence: player2Anims,
                state: player2State
            }
        }), { status: 200 });
    }
    
    // Filter animations for a player's perspective (flip owner fields)
    filterAnimationsForPlayer(animations, playerId) {
        const isPlayer1 = playerId === this.playerIds[0];
        const myOwner = isPlayer1 ? 'player' : 'enemy';
        
        return animations.map(anim => {
            const flipped = { ...anim };
            
            // Flip owner fields
            if (flipped.owner) {
                flipped.owner = flipped.owner === myOwner ? 'player' : 'enemy';
            }
            if (flipped.targetOwner) {
                flipped.targetOwner = flipped.targetOwner === myOwner ? 'player' : 'enemy';
            }
            if (flipped.attackerOwner) {
                flipped.attackerOwner = flipped.attackerOwner === myOwner ? 'player' : 'enemy';
            }
            if (flipped.sourceOwner) {
                flipped.sourceOwner = flipped.sourceOwner === myOwner ? 'player' : 'enemy';
            }
            
            return flipped;
        });
    }
    
    /**
     * Normalize column from client perspective to server perspective.
     * 
     * Client always sees themselves as 'player' with:
     *   - combat col = 1 (right side)
     *   - support col = 0 (left side)
     * Client sends cols after transformation: serverCol = 1 - clientCol
     * So client sends col 0 for their combat position.
     * 
     * Server has different conventions for 'player' vs 'enemy':
     *   - 'player': combat = col 0, support = col 1
     *   - 'enemy': combat = col 1, support = col 0
     * 
     * For 'player' owner: received col 0 (client combat) = server col 0 (server player combat) ✓
     * For 'enemy' owner: received col 0 (client combat) should = server col 1 (server enemy combat)
     * 
     * Solution: flip column for 'enemy' owner
     */
    normalizeClientCol(col, owner) {
        if (col === undefined || col === null) return col;
        return owner === 'enemy' ? 1 - col : col;
    }
    
    processAction(playerId, action) {
        if (!action || !action.type) {
            return { valid: false, error: 'Invalid action' };
        }
        
        const isPlayer1 = playerId === this.playerIds[0];
        const owner = isPlayer1 ? 'player' : 'enemy';
        
        // Clear events and animations for this action
        this.events = [];
        this.animationSequence = [];
        this.pendingPromotions = [];
        
        let result;
        
        switch (action.type) {
            case 'endPhase':
                result = this.handleEndPhase(owner);
                break;
                
            case 'summon':
                result = this.handleSummon(owner, action);
                break;
                
            case 'summonKindling':
                result = this.handleSummonKindling(owner, action);
                break;
                
            case 'attack':
                result = this.handleAttack(owner, action);
                break;
                
            case 'playBurst':
                result = this.handlePlayBurst(owner, action);
                break;
                
            case 'playTrap':
                result = this.handlePlayTrap(owner, action);
                break;
                
            case 'playAura':
                result = this.handlePlayAura(owner, action);
                break;
                
            case 'playPyre':
                result = this.handlePlayPyre(owner, action);
                break;
                
            case 'evolve':
                result = this.handleEvolve(owner, action);
                break;
                
            case 'burnForPyre':
                result = this.handleBurnForPyre(owner, action);
                break;
                
            case 'activateAbility':
                result = this.handleActivateAbility(owner, action);
                break;
                
            default:
                result = { valid: false, error: 'Unknown action type: ' + action.type };
        }
        
        // Process pending promotions
        this.processPendingPromotions();
        
        return result;
    }
    
    // Animation sequence builder
    addAnimation(type, data) {
        this.animationSequence.push({ type, ...data });
    }
    
    // ==================== ACTION HANDLERS ====================
    
    handleEndPhase(owner) {
        const phases = ['conjure1', 'combat', 'conjure2'];
        const currentIndex = phases.indexOf(this.gameState.phase);
        
        if (currentIndex === phases.length - 1) {
            // End of turn
            this.endTurn(owner);
        } else {
            // Advance phase
            this.gameState.phase = phases[currentIndex + 1];
            
            this.emit(GameEventTypes.PHASE_CHANGE, {
                owner,
                phase: this.gameState.phase
            });
        }
        
        // Restart turn timer
        this.startTurnTimer();
        
        return { valid: true };
    }
    
    handleSummon(owner, action) {
        const { cardId, row } = action;
        // Normalize column from client perspective to server perspective
        const col = this.normalizeClientCol(action.col, owner);
        
        // Validate phase
        if (this.gameState.phase !== 'conjure1' && this.gameState.phase !== 'conjure2') {
            return { valid: false, error: 'Can only summon during conjure phase' };
        }
        
        // Get hand
        const hand = owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate pyre cost
        const pyre = owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Validate slot is empty
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        if (field[col][row]) {
            return { valid: false, error: 'Slot is occupied' };
        }
        
        // Execute summon
        hand.splice(cardIndex, 1);
        
        // Deduct pyre
        if (owner === 'player') {
            this.gameState.playerPyre -= card.cost;
        } else {
            this.gameState.enemyPyre -= card.cost;
        }
        
        // Create cryptid
        const cryptid = this.createCryptid(card, owner, col, row);
        field[col][row] = cryptid;
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre
        });
        
        this.emit(GameEventTypes.CRYPTID_SUMMONED, {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: false
        });
        
        // Add summon animation
        this.addAnimation('summon', {
            owner,
            col,
            row,
            key: cryptid.key,
            name: cryptid.name,
            element: cryptid.element,
            rarity: cryptid.rarity
        });
        
        // Handle onSummon / onEnterCombat / onSupport abilities
        this.triggerAbility(cryptid, 'onSummon', { owner, col, row });
        
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        if (col === combatCol) {
            this.triggerAbility(cryptid, 'onEnterCombat', { owner, col, row });
            this.triggerAbility(cryptid, 'onCombat', { owner, col, row });
        } else if (col === supportCol) {
            this.triggerAbility(cryptid, 'onSupport', { owner, col, row });
        }
        
        return { valid: true };
    }
    
    handleSummonKindling(owner, action) {
        const { kindlingId, row } = action;
        // Normalize column from client perspective to server perspective
        const col = this.normalizeClientCol(action.col, owner);
        
        // Validate phase
        if (this.gameState.phase !== 'conjure1' && this.gameState.phase !== 'conjure2') {
            return { valid: false, error: 'Can only summon during conjure phase' };
        }
        
        // Check kindling played this turn
        const playedFlag = owner === 'player' ? 
            this.gameState.playerKindlingPlayed : 
            this.gameState.enemyKindlingPlayed;
        
        if (playedFlag) {
            return { valid: false, error: 'Already played kindling this turn' };
        }
        
        // Get kindling pool
        const pool = owner === 'player' ? this.gameState.playerKindling : this.gameState.enemyKindling;
        const kindlingIndex = pool.findIndex(k => k.id === kindlingId);
        
        if (kindlingIndex === -1) {
            return { valid: false, error: 'Kindling not found' };
        }
        
        // Validate slot is empty
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        if (field[col][row]) {
            return { valid: false, error: 'Slot is occupied' };
        }
        
        // Execute
        const kindling = pool.splice(kindlingIndex, 1)[0];
        
        if (owner === 'player') {
            this.gameState.playerKindlingPlayed = true;
        } else {
            this.gameState.enemyKindlingPlayed = true;
        }
        
        // Create cryptid
        const cryptid = this.createCryptid({ ...kindling, isKindling: true }, owner, col, row);
        field[col][row] = cryptid;
        
        this.emit(GameEventTypes.CRYPTID_SUMMONED, {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: true
        });
        
        // Add summon animation
        this.addAnimation('summon', {
            owner,
            col,
            row,
            key: cryptid.key,
            name: cryptid.name,
            element: cryptid.element,
            rarity: cryptid.rarity,
            isKindling: true
        });
        
        // Handle abilities
        this.triggerAbility(cryptid, 'onSummon', { owner, col, row });
        
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        if (col === combatCol) {
            this.triggerAbility(cryptid, 'onEnterCombat', { owner, col, row });
            this.triggerAbility(cryptid, 'onCombat', { owner, col, row });
        } else if (col === supportCol) {
            this.triggerAbility(cryptid, 'onSupport', { owner, col, row });
        }
        
        return { valid: true };
    }
    
    handleAttack(owner, action) {
        const { attackerRow, targetRow } = action;
        // Normalize attacker column from client perspective to server perspective
        const attackerCol = this.normalizeClientCol(action.attackerCol, owner);
        // Target column normalization: client targets enemy's field from their perspective
        // The targetCol (if present) targets the opponent, so we normalize with opponent's owner
        const opponentOwner = owner === 'player' ? 'enemy' : 'player';
        const targetCol = action.targetCol !== undefined ? 
            this.normalizeClientCol(action.targetCol, opponentOwner) : undefined;
        
        // Validate combat phase
        if (this.gameState.phase !== 'combat') {
            return { valid: false, error: 'Can only attack during combat phase' };
        }
        
        // Get attacker
        const attackerField = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        const attacker = attackerField[attackerCol]?.[attackerRow];
        
        if (!attacker) {
            return { valid: false, error: 'No attacker at position' };
        }
        
        // Validate attacker can attack
        if (attacker.tapped || attacker.attackedThisTurn) {
            return { valid: false, error: 'Attacker cannot attack' };
        }
        
        // Validate attacker is not paralyzed
        if (attacker.paralyzed) {
            return { valid: false, error: 'Attacker is paralyzed' };
        }
        
        // Validate attacker is in combat position
        if (attackerCol !== this.getCombatCol(owner)) {
            return { valid: false, error: 'Attacker must be in combat position' };
        }
        
        // Get target
        const targetField = owner === 'player' ? this.gameState.enemyField : this.gameState.playerField;
        const targetCombatCol = this.getCombatCol(opponentOwner);
        const target = targetField[targetCombatCol]?.[targetRow];
        
        // Validate target (flight check)
        if (!attacker.canTargetAny && targetRow !== attackerRow && target) {
            return { valid: false, error: 'Cannot attack that target' };
        }
        
        // Execute attack
        attacker.attackedThisTurn = true;
        attacker.tapped = true;
        
        let damage = this.calculateAttackDamage(attacker, owner);
        
        // Add bonus damage vs burning
        if (target && target.burnStacks > 0 && attacker.bonusVsBurning) {
            damage += attacker.bonusVsBurning;
        }
        
        this.emit(GameEventTypes.ATTACK_DECLARED, {
            attackerOwner: owner,
            attackerCol,
            attackerRow,
            attackerKey: attacker.key,
            targetOwner: opponentOwner,
            targetRow,
            target: target ? this.serializeCryptid(target) : null,
            damage
        });
        
        // Add attack animation (attackerCol already available from action params)
        const animTargetCol = this.getCombatCol(opponentOwner);
        this.addAnimation('attackMove', {
            attackerOwner: owner,
            attackerCol: attackerCol, // From action params
            attackerRow,
            targetOwner: opponentOwner,
            targetCol: animTargetCol,
            targetRow,
            attackerKey: attacker.key,
            attackerName: attacker.name
        });
        
        // Trigger onCombatAttack ability
        this.triggerAbility(attacker, 'onCombatAttack', { target });
        
        if (target) {
            // Check for guard/block abilities
            const defenseResult = this.triggerAbility(target, 'onBeforeDefend', { attacker });
            
            if (defenseResult?.blocked) {
                this.addAnimation('attackBlocked', {
                    targetOwner: opponentOwner,
                    targetRow,
                    blockerKey: target.key
                });
            } else {
                // Deal damage
                this.dealDamage(target, damage, attacker, 'attack');
                
                // Apply status effects from attacker
                if (attacker.attacksApplyBurn) {
                    this.applyBurn(target, 1);
                }
                if (attacker.attacksApplyCurse) {
                    this.applyCurse(target, attacker.attacksApplyCurse);
                }
                
                // Trigger onCombatHit
                this.triggerAbility(attacker, 'onCombatHit', { target });
            }
        }
        
        return { valid: true };
    }
    
    handlePlayBurst(owner, action) {
        const { cardId, targetRow } = action;
        // Determine actual target owner on server (client sends 'player'/'enemy' from their perspective)
        // If client says 'enemy', that's the opponent from their view
        const clientTargetOwner = action.targetOwner;
        const actualTargetOwner = clientTargetOwner === 'player' ? owner : 
            (owner === 'player' ? 'enemy' : 'player');
        // Normalize target column based on actual target owner
        const targetCol = this.normalizeClientCol(action.targetCol, actualTargetOwner);
        
        const hand = owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Validate pyre
        const pyre = owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.gameState.playerPyre -= card.cost;
        } else {
            this.gameState.enemyPyre -= card.cost;
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre
        });
        
        // Execute burst effect (simplified - actual effects would need card registry)
        this.emit(GameEventTypes.MESSAGE, {
            text: `${card.name} cast!`,
            owner
        });
        
        return { valid: true };
    }
    
    handlePlayTrap(owner, action) {
        const { cardId, row } = action;
        
        const hand = owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        const traps = owner === 'player' ? this.gameState.playerTraps : this.gameState.enemyTraps;
        
        if (traps[row]) {
            return { valid: false, error: 'Trap slot occupied' };
        }
        
        // Validate pyre
        const pyre = owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.gameState.playerPyre -= card.cost;
            this.gameState.playerTraps[row] = { ...card, faceDown: true };
        } else {
            this.gameState.enemyPyre -= card.cost;
            this.gameState.enemyTraps[row] = { ...card, faceDown: true };
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre
        });
        
        // Add trap set animation
        this.addAnimation('trapSet', {
            owner,
            row,
            key: card.key,
            name: card.name
        });
        
        return { valid: true };
    }
    
    handlePlayAura(owner, action) {
        // Similar to burst but attaches
        return { valid: true };
    }
    
    handlePlayPyre(owner, action) {
        const { cardId } = action;
        
        const playedFlag = owner === 'player' ? 
            this.gameState.playerPyreCardPlayed : 
            this.gameState.enemyPyreCardPlayed;
        
        if (playedFlag) {
            return { valid: false, error: 'Already played pyre card this turn' };
        }
        
        const hand = owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand.splice(cardIndex, 1)[0];
        
        if (owner === 'player') {
            this.gameState.playerPyreCardPlayed = true;
            this.gameState.playerPyre += 1;
        } else {
            this.gameState.enemyPyreCardPlayed = true;
            this.gameState.enemyPyre += 1;
        }
        
        // Add animation for pyre card play
        this.addAnimation('pyreCard', {
            owner,
            cardKey: card.key,
            cardName: card.name,
            pyreGained: 1
        });
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: 1,
            newValue: owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre
        });
        
        return { valid: true };
    }
    
    handleEvolve(owner, action) {
        const { cardId, targetRow } = action;
        // Normalize column from client perspective to server perspective
        const targetCol = this.normalizeClientCol(action.targetCol, owner);
        
        const hand = owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        if (!card.evolvesFrom) {
            return { valid: false, error: 'Card is not an evolution' };
        }
        
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        const target = field[targetCol]?.[targetRow];
        
        if (!target) {
            return { valid: false, error: 'No target at position' };
        }
        
        if (target.key !== card.evolvesFrom) {
            return { valid: false, error: 'Target does not match evolution base' };
        }
        
        // Validate pyre
        const pyre = owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre;
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute evolution
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.gameState.playerPyre -= card.cost;
        } else {
            this.gameState.enemyPyre -= card.cost;
        }
        
        // Update target with evolution stats
        const oldKey = target.key;
        target.key = card.key;
        target.name = card.name;
        target.currentAtk = target.currentAtk + (card.atk - target.baseAtk);
        target.currentHp = target.currentHp + (card.hp - target.baseHp);
        target.maxHp = target.maxHp + (card.hp - target.baseHp);
        target.baseAtk = card.atk;
        target.baseHp = card.hp;
        target.evolutionChain = target.evolutionChain || [];
        target.evolutionChain.push(card.key);
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: -card.cost,
            newValue: owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre
        });
        
        this.emit(GameEventTypes.CRYPTID_EVOLVED || 'cryptidEvolved', {
            owner,
            col: targetCol,
            row: targetRow,
            fromKey: oldKey,
            toKey: card.key,
            cryptid: this.serializeCryptid(target)
        });
        
        // Add evolution animation
        this.addAnimation('evolve', {
            owner,
            col: targetCol,
            row: targetRow,
            fromKey: oldKey,
            toKey: card.key,
            name: card.name
        });
        
        return { valid: true };
    }
    
    handleBurnForPyre(owner, action) {
        // Pyre Burn: Convert death count into pyre and draw cards
        const usedFlag = owner === 'player' ? 
            this.gameState.playerPyreBurnUsed : 
            this.gameState.enemyPyreBurnUsed;
        
        if (usedFlag) {
            return { valid: false, error: 'Already burned this turn' };
        }
        
        // Get death count for this player
        const deaths = owner === 'player' ? 
            this.gameState.playerDeaths : 
            this.gameState.enemyDeaths;
        
        if (!deaths || deaths <= 0) {
            return { valid: false, error: 'No deaths to burn' };
        }
        
        // Grant pyre equal to death count
        if (owner === 'player') {
            this.gameState.playerPyreBurnUsed = true;
            this.gameState.playerPyre += deaths;
        } else {
            this.gameState.enemyPyreBurnUsed = true;
            this.gameState.enemyPyre += deaths;
        }
        
        // Draw cards equal to death count
        for (let i = 0; i < deaths; i++) {
            this.drawCard(owner);
        }
        
        // Add animation
        this.addAnimation('pyreBurn', {
            owner,
            amount: deaths
        });
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount: deaths,
            newValue: owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre
        });
        
        return { valid: true };
    }
    
    // ==================== GAME LOGIC HELPERS ====================
    
    createCryptid(card, owner, col, row) {
        const id = this.gameState.nextCryptidId++;
        
        // Get abilities from card registry
        const abilities = ServerCardAbilities[card.key] || {};
        
        return {
            id,
            key: card.key,
            name: card.name,
            baseAtk: card.atk,
            baseHp: card.hp,
            currentAtk: card.atk,
            currentHp: card.hp,
            maxHp: card.hp,
            cost: card.cost || 0,
            owner,
            col,
            row,
            tapped: false,
            attackedThisTurn: false,
            attackedLastTurn: false,
            justSummoned: true,
            isKindling: card.isKindling || false,
            burnStacks: 0,
            bleedStacks: 0,
            curseTokens: 0,
            calamityCounters: 0,
            paralyzed: false,
            paralyzedTurns: 0,
            hasProtection: false,
            hasMothmanImmunity: false,
            evolutionChain: [card.key],
            element: card.element,
            rarity: card.rarity || 'common',
            // Apply ability flags from registry
            canTargetAny: abilities.canTargetAny || false,
            bonusVsBurning: abilities.bonusVsBurning || 0,
            attacksAllCombatants: abilities.attacksAllCombatants || false,
            auras: []
        };
    }
    
    calculateAttackDamage(attacker, owner) {
        let damage = attacker.currentAtk - (attacker.atkDebuff || 0);
        
        // Add support bonus
        const supportCol = this.getSupportCol(owner);
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        const support = field[supportCol]?.[attacker.row];
        
        if (support) {
            damage += support.currentAtk - (support.atkDebuff || 0);
        }
        
        return Math.max(0, damage);
    }
    
    dealDamage(target, amount, source, damageType) {
        if (amount <= 0) return;
        
        // Apply damage reduction
        if (target.damageReduction && damageType === 'attack') {
            amount = Math.max(1, amount - target.damageReduction);
        }
        
        // Check protection
        if (target.hasProtection) {
            target.hasProtection = false;
            this.emit(GameEventTypes.STATUS_REMOVED, {
                owner: target.owner,
                col: target.col,
                row: target.row,
                status: 'protection'
            });
            this.addAnimation('protectionBlock', {
                targetOwner: target.owner,
                targetCol: target.col,
                targetRow: target.row
            });
            return;
        }
        
        const hpBefore = target.currentHp;
        target.currentHp -= amount;
        
        this.emit(GameEventTypes.DAMAGE_DEALT, {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            amount,
            damageType,
            sourceOwner: source?.owner,
            newHp: target.currentHp,
            hpBefore
        });
        
        // Add damage animation
        this.addAnimation('damage', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            amount,
            damageType
        });
        
        // Trigger onDamageTaken
        this.triggerAbility(target, 'onDamageTaken', { damage: amount, source });
        
        // Check death
        if (target.currentHp <= 0) {
            target.killedBy = damageType;
            target.killedBySource = source;
            this.killCryptid(target, source?.owner);
        }
    }
    
    killCryptid(cryptid, killerOwner, options = {}) {
        // Trigger onDeath ability (may prevent death)
        this.triggerAbility(cryptid, 'onDeath', {});
        
        if (cryptid.preventDeath) {
            cryptid.preventDeath = false;
            return;
        }
        
        const { owner, col, row } = cryptid;
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        
        // Remove from field
        field[col][row] = null;
        
        // Increment death count
        if (owner === 'player') {
            this.gameState.playerDeaths++;
        } else {
            this.gameState.enemyDeaths++;
        }
        
        this.emit(GameEventTypes.CRYPTID_DIED, {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            killerOwner,
            killedBy: cryptid.killedBy
        });
        
        // Add death animation
        this.addAnimation('death', {
            owner,
            col,
            row,
            key: cryptid.key,
            name: cryptid.name,
            rarity: cryptid.rarity
        });
        
        // Notify death listeners (for Mothman's onAnyDeath)
        for (const listener of this.deathListeners) {
            listener(cryptid);
        }
        
        // Trigger any onAnyDeath abilities on all cryptids
        this.triggerAllOnAnyDeath(cryptid);
        
        // Trigger onKill on the killer
        if (cryptid.killedBySource) {
            this.triggerAbility(cryptid.killedBySource, 'onKill', { target: cryptid });
        }
        
        // Check for promotion (unless skipped)
        if (!options.skipPromotion && col === this.getCombatCol(owner)) {
            this.queuePromotion(owner, row);
        }
        
        // Check game end
        this.checkGameEnd();
    }
    
    triggerAllOnAnyDeath(deadCryptid) {
        // Check all cryptids for onAnyDeath abilities
        for (const owner of ['player', 'enemy']) {
            const cryptids = this.getAllCryptids(owner);
            for (const cryptid of cryptids) {
                if (cryptid !== deadCryptid) {
                    this.triggerAbility(cryptid, 'onAnyDeath', { deadCryptid });
                }
            }
        }
    }
    
    checkPromotion(owner, row) {
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        
        // If combat slot is empty, promote support
        if (!field[combatCol][row] && field[supportCol][row]) {
            const support = field[supportCol][row];
            field[supportCol][row] = null;
            field[combatCol][row] = support;
            support.col = combatCol;
            
            this.emit(GameEventTypes.CRYPTID_PROMOTED, {
                owner,
                fromCol: supportCol,
                toCol: combatCol,
                row,
                cryptid: this.serializeCryptid(support)
            });
            
            // Add promotion animation
            this.addAnimation('promotion', {
                owner,
                row,
                fromCol: supportCol,
                toCol: combatCol,
                key: support.key,
                name: support.name
            });
            
            this.triggerAbility(support, 'onEnterCombat', { promoted: true });
        }
    }
    
    getCombatCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    getSupportCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    getPyre(owner) {
        return owner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre;
    }
    
    modifyPyre(owner, amount) {
        if (owner === 'player') {
            this.gameState.playerPyre = Math.max(0, this.gameState.playerPyre + amount);
        } else {
            this.gameState.enemyPyre = Math.max(0, this.gameState.enemyPyre + amount);
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner,
            amount,
            newValue: this.getPyre(owner)
        });
        
        if (amount !== 0) {
            this.addAnimation('pyreGain', {
                owner,
                amount
            });
        }
    }
    
    triggerAbility(cryptid, abilityName, context = {}) {
        const abilities = ServerCardAbilities[cryptid.key];
        if (!abilities || !abilities[abilityName]) return null;
        
        try {
            const result = abilities[abilityName](cryptid, this, context);
            
            if (result) {
                this.emit(GameEventTypes.ABILITY_TRIGGERED, {
                    owner: cryptid.owner,
                    col: cryptid.col,
                    row: cryptid.row,
                    cryptidKey: cryptid.key,
                    abilityName,
                    result
                });
            }
            
            return result;
        } catch (err) {
            console.error(`Error triggering ${abilityName} on ${cryptid.key}:`, err);
            return null;
        }
    }
    
    // Process pending promotions after main action
    processPendingPromotions() {
        for (const { owner, row } of this.pendingPromotions) {
            this.checkPromotion(owner, row);
        }
        this.pendingPromotions = [];
    }
    
    // Queue a promotion for processing
    queuePromotion(owner, row) {
        this.pendingPromotions.push({ owner, row });
    }
    
    // ==================== STATUS EFFECT HELPERS ====================
    
    applyBurn(target, stacks = 1) {
        if (target.hasMothmanImmunity) return;
        
        target.burnStacks = (target.burnStacks || 0) + stacks;
        
        this.emit('burnApplied', {
            owner: target.owner,
            col: target.col,
            row: target.row,
            stacks,
            totalStacks: target.burnStacks
        });
        
        this.addAnimation('statusApply', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            status: 'burn',
            stacks
        });
    }
    
    applyCurse(target, tokens = 1) {
        if (target.hasMothmanImmunity) return;
        
        target.curseTokens = (target.curseTokens || 0) + tokens;
        
        this.emit('curseApplied', {
            owner: target.owner,
            col: target.col,
            row: target.row,
            tokens,
            totalTokens: target.curseTokens
        });
        
        this.addAnimation('statusApply', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            status: 'curse',
            stacks: tokens
        });
    }
    
    applyBleed(target, stacks = 1) {
        if (target.hasMothmanImmunity) return;
        
        target.bleedStacks = (target.bleedStacks || 0) + stacks;
        
        this.emit('bleedApplied', {
            owner: target.owner,
            col: target.col,
            row: target.row,
            stacks
        });
        
        this.addAnimation('statusApply', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            status: 'bleed',
            stacks
        });
    }
    
    // Find an evolution card in hand or deck
    findEvolutionCard(owner, key) {
        const hand = owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
        const inHand = hand.find(c => c.key === key);
        if (inHand) return { card: inHand, location: 'hand', owner };
        
        const deck = owner === 'player' ? this.gameState.playerDeck : this.gameState.enemyDeck;
        const inDeck = deck.find(c => c.key === key);
        if (inDeck) return { card: inDeck, location: 'deck', owner };
        
        return null;
    }
    
    // Remove a card from hand or deck
    removeCard(cardInfo) {
        if (cardInfo.location === 'hand') {
            const hand = cardInfo.owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
            const idx = hand.findIndex(c => c.id === cardInfo.card.id);
            if (idx !== -1) hand.splice(idx, 1);
        } else if (cardInfo.location === 'deck') {
            const deck = cardInfo.owner === 'player' ? this.gameState.playerDeck : this.gameState.enemyDeck;
            const idx = deck.findIndex(c => c.id === cardInfo.card.id);
            if (idx !== -1) deck.splice(idx, 1);
        }
    }
    
    // Evolve a cryptid in place
    evolveInPlace(cryptid, evolutionCard) {
        const oldKey = cryptid.key;
        cryptid.key = evolutionCard.key;
        cryptid.name = evolutionCard.name;
        
        // Calculate stat changes
        const atkDiff = (evolutionCard.atk || 0) - (cryptid.baseAtk || 0);
        const hpDiff = (evolutionCard.hp || 0) - (cryptid.baseHp || 0);
        
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.baseAtk) + atkDiff;
        cryptid.currentHp = (cryptid.currentHp || cryptid.baseHp) + hpDiff;
        cryptid.maxHp = (cryptid.maxHp || cryptid.baseHp) + hpDiff;
        cryptid.baseAtk = evolutionCard.atk || 0;
        cryptid.baseHp = evolutionCard.hp || 0;
        
        cryptid.evolutionChain = cryptid.evolutionChain || [];
        cryptid.evolutionChain.push(evolutionCard.key);
        cryptid.isKindling = false;
        
        // Update abilities from new card
        const abilities = ServerCardAbilities[evolutionCard.key];
        if (abilities?.canTargetAny) cryptid.canTargetAny = true;
        if (abilities?.attacksAllCombatants) cryptid.attacksAllCombatants = true;
        if (abilities?.bonusVsBurning) cryptid.bonusVsBurning = abilities.bonusVsBurning;
        
        this.addAnimation('evolve', {
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            fromKey: oldKey,
            toKey: evolutionCard.key
        });
    }
    
    // Get all cryptids on a field
    getAllCryptids(owner) {
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        const cryptids = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]) cryptids.push(field[col][row]);
            }
        }
        return cryptids;
    }
    
    // Get cryptid in a specific position
    getFieldCryptid(owner, col, row) {
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        return field[col]?.[row] || null;
    }
    
    // Get the field for an owner
    getField(owner) {
        return owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
    }
    
    // Get combatant in same row as support
    getCombatant(support) {
        const combatCol = this.getCombatCol(support.owner);
        return this.getFieldCryptid(support.owner, combatCol, support.row);
    }
    
    // Get enemy combatant across from a cryptid
    getEnemyCombatantAcross(cryptid) {
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const combatCol = this.getCombatCol(enemyOwner);
        return this.getFieldCryptid(enemyOwner, combatCol, cryptid.row);
    }
    
    // Activate an ability manually
    handleActivateAbility(owner, action) {
        const { cryptidId, abilityKey, targetRow } = action;
        
        // Find cryptid
        let cryptid = null;
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]?.id === cryptidId) {
                    cryptid = field[col][row];
                    break;
                }
            }
        }
        
        if (!cryptid) {
            return { valid: false, error: 'Cryptid not found' };
        }
        
        const abilities = ServerCardAbilities[cryptid.key];
        const abilityFn = abilities?.[abilityKey];
        
        if (!abilityFn) {
            return { valid: false, error: 'Invalid ability' };
        }
        
        const result = abilityFn(cryptid, this, { targetRow });
        
        if (result === false) {
            return { valid: false, error: 'Ability cannot be used' };
        }
        
        return { valid: true, result };
    }
    
    endTurn(owner) {
        this.emit(GameEventTypes.TURN_END, {
            owner,
            turnNumber: this.gameState.turnNumber
        });
        
        this.addAnimation('turnEnd', { owner });
        
        // Switch turn
        this.gameState.currentTurn = this.gameState.currentTurn === 'player' ? 'enemy' : 'player';
        this.gameState.phase = 'conjure1';
        
        if (this.gameState.currentTurn === 'player') {
            this.gameState.turnNumber++;
        }
        
        // Reset per-turn flags
        this.resetTurnFlags(this.gameState.currentTurn);
        
        // Process turn start effects (burn, bleed, curse, paralysis)
        this.processTurnStartEffects(this.gameState.currentTurn);
        
        // Give 1 pyre at turn start
        const newOwner = this.gameState.currentTurn;
        if (newOwner === 'player') {
            this.gameState.playerPyre += 1;
        } else {
            this.gameState.enemyPyre += 1;
        }
        
        this.emit(GameEventTypes.PYRE_CHANGED, {
            owner: newOwner,
            amount: 1,
            newValue: newOwner === 'player' ? this.gameState.playerPyre : this.gameState.enemyPyre,
            source: 'turnStart'
        });
        
        this.addAnimation('pyreGain', {
            owner: newOwner,
            amount: 1,
            source: 'turnStart'
        });
        
        // Draw card
        this.drawCard(this.gameState.currentTurn);
        
        this.emit(GameEventTypes.TURN_START, {
            owner: this.gameState.currentTurn,
            turnNumber: this.gameState.turnNumber
        });
        
        this.addAnimation('turnStart', { 
            owner: this.gameState.currentTurn,
            turnNumber: this.gameState.turnNumber
        });
    }
    
    // Process status effects at turn start
    processTurnStartEffects(owner) {
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (!cryptid) continue;
                
                // Process burn damage at turn start
                if (cryptid.burnStacks > 0) {
                    const burnDamage = cryptid.burnStacks;
                    this.dealDamage(cryptid, burnDamage, null, 'burn');
                    
                    // Reduce burn by 1 if still alive
                    if (cryptid.currentHp > 0) {
                        cryptid.burnStacks = Math.max(0, cryptid.burnStacks - 1);
                    }
                }
                
                // Process bleed (damages if cryptid attacked last turn)
                if (cryptid.bleedStacks > 0 && cryptid.attackedLastTurn) {
                    const bleedDamage = cryptid.bleedStacks;
                    this.dealDamage(cryptid, bleedDamage, null, 'bleed');
                }
                
                // Track attacked status for bleed
                cryptid.attackedLastTurn = cryptid.attackedThisTurn;
                
                // Decay curse by 1
                if (cryptid.curseTokens > 0) {
                    cryptid.curseTokens = Math.max(0, cryptid.curseTokens - 1);
                }
                
                // Decay paralysis
                if (cryptid.paralyzed) {
                    cryptid.paralyzedTurns = Math.max(0, (cryptid.paralyzedTurns || 0) - 1);
                    if (cryptid.paralyzedTurns <= 0) {
                        cryptid.paralyzed = false;
                    }
                }
                
                // Trigger onTurnStart ability
                this.triggerAbility(cryptid, 'onTurnStart', {});
                
                // Trigger onTurnStartSupport for supports
                if (col === this.getSupportCol(owner)) {
                    this.triggerAbility(cryptid, 'onTurnStartSupport', {});
                }
            }
        }
    }
    
    resetTurnFlags(owner) {
        if (owner === 'player') {
            this.gameState.playerKindlingPlayed = false;
            this.gameState.playerPyreCardPlayed = false;
            this.gameState.playerPyreBurnUsed = false;
        } else {
            this.gameState.enemyKindlingPlayed = false;
            this.gameState.enemyPyreCardPlayed = false;
            this.gameState.enemyPyreBurnUsed = false;
        }
        
        // Untap cryptids
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (cryptid) {
                    cryptid.tapped = false;
                    cryptid.attackedThisTurn = false;
                    cryptid.justSummoned = false;
                }
            }
        }
    }
    
    drawCard(owner) {
        const deck = owner === 'player' ? this.gameState.playerDeck : this.gameState.enemyDeck;
        const hand = owner === 'player' ? this.gameState.playerHand : this.gameState.enemyHand;
        
        if (deck.length > 0) {
            const card = deck.shift();
            hand.push(card);
            
            this.emit(GameEventTypes.CARD_DRAWN, {
                owner,
                card: this.serializeCard(card)
            });
        }
    }
    
    checkGameEnd() {
        // Check win condition (all cryptids dead and no kindling/playable cards)
        const playerCryptids = this.countCryptids('player');
        const enemyCryptids = this.countCryptids('enemy');
        
        // Simple win condition: opponent has no cryptids
        if (enemyCryptids === 0 && this.gameState.enemyKindling.length === 0) {
            this.gameState.gameOver = true;
            this.gameState.winner = 'player';
            this.emit(GameEventTypes.MATCH_END, { winner: 'player', reason: 'elimination' });
        } else if (playerCryptids === 0 && this.gameState.playerKindling.length === 0) {
            this.gameState.gameOver = true;
            this.gameState.winner = 'enemy';
            this.emit(GameEventTypes.MATCH_END, { winner: 'enemy', reason: 'elimination' });
        }
    }
    
    countCryptids(owner) {
        const field = owner === 'player' ? this.gameState.playerField : this.gameState.enemyField;
        let count = 0;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]) count++;
            }
        }
        return count;
    }
    
    // ==================== DECK INITIALIZATION ====================
    
    initializeDecks(playerId, deckData) {
        const isPlayer1 = playerId === this.playerIds[0];
        
        // Trust client deck data - client has already shuffled and drawn
        // If client sends hand, use it directly; otherwise draw from deck
        if (isPlayer1) {
            // Use deck as-is (client already shuffled) - NO re-shuffle for consistent IDs
            this.gameState.playerDeck = [...deckData.mainDeck];
            this.gameState.playerKindling = [...deckData.kindling];
            
            // If client sent pre-drawn hand, use it; otherwise draw 7 cards
            if (deckData.hand && deckData.hand.length > 0) {
                this.gameState.playerHand = [...deckData.hand];
            } else {
                // Fallback: draw 7 cards from top of deck
                for (let i = 0; i < 7 && this.gameState.playerDeck.length > 0; i++) {
                    this.gameState.playerHand.push(this.gameState.playerDeck.shift());
                }
            }
        } else {
            // Use deck as-is (client already shuffled) - NO re-shuffle for consistent IDs
            this.gameState.enemyDeck = [...deckData.mainDeck];
            this.gameState.enemyKindling = [...deckData.kindling];
            
            // If client sent pre-drawn hand, use it; otherwise draw 7 cards
            if (deckData.hand && deckData.hand.length > 0) {
                this.gameState.enemyHand = [...deckData.hand];
            } else {
                // Fallback: draw 7 cards from top of deck
                for (let i = 0; i < 7 && this.gameState.enemyDeck.length > 0; i++) {
                    this.gameState.enemyHand.push(this.gameState.enemyDeck.shift());
                }
            }
        }
    }
    
    // ==================== SERIALIZATION ====================
    
    emit(type, data) {
        this.events.push({ type, ...data, timestamp: Date.now() });
    }
    
    serializeCryptid(cryptid) {
        // Calculate canAttack for client
        const canAttack = !cryptid.paralyzed && !cryptid.justSummoned && !cryptid.tapped;
        
        return {
            id: cryptid.id,
            key: cryptid.key,
            name: cryptid.name,
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            currentAtk: cryptid.currentAtk,
            currentHp: cryptid.currentHp,
            maxHp: cryptid.maxHp,
            baseAtk: cryptid.baseAtk,
            baseHp: cryptid.baseHp,
            tapped: cryptid.tapped || false,
            burnStacks: cryptid.burnStacks || 0,
            bleedStacks: cryptid.bleedStacks || 0,
            paralyzed: cryptid.paralyzed || false,
            hasProtection: cryptid.hasProtection || false,
            isKindling: cryptid.isKindling || false,
            evolutionChain: cryptid.evolutionChain || [],
            element: cryptid.element,
            rarity: cryptid.rarity,
            // Additional properties for client
            justSummoned: cryptid.justSummoned || false,
            attackedThisTurn: cryptid.attackedThisTurn || false,
            canAttack: canAttack
        };
    }
    
    serializeCard(card) {
        return {
            id: card.id,
            key: card.key,
            name: card.name,
            type: card.type,
            cost: card.cost,
            atk: card.atk,
            hp: card.hp,
            element: card.element,
            rarity: card.rarity,
            evolvesFrom: card.evolvesFrom
        };
    }
    
    getStateForPlayer(playerId) {
        const isPlayer1 = playerId === this.playerIds[0];
        
        // Determine perspective
        const myField = isPlayer1 ? this.gameState.playerField : this.gameState.enemyField;
        const opponentField = isPlayer1 ? this.gameState.enemyField : this.gameState.playerField;
        const myHand = isPlayer1 ? this.gameState.playerHand : this.gameState.enemyHand;
        const myKindling = isPlayer1 ? this.gameState.playerKindling : this.gameState.enemyKindling;
        const myPyre = isPlayer1 ? this.gameState.playerPyre : this.gameState.enemyPyre;
        const opponentPyre = isPlayer1 ? this.gameState.enemyPyre : this.gameState.playerPyre;
        const myTraps = isPlayer1 ? this.gameState.playerTraps : this.gameState.enemyTraps;
        const opponentTraps = isPlayer1 ? this.gameState.enemyTraps : this.gameState.playerTraps;
        const opponentHand = isPlayer1 ? this.gameState.enemyHand : this.gameState.playerHand;
        const opponentKindling = isPlayer1 ? this.gameState.enemyKindling : this.gameState.playerKindling;
        
        const currentTurn = this.gameState.currentTurn;
        const isMyTurn = (isPlayer1 && currentTurn === 'player') || (!isPlayer1 && currentTurn === 'enemy');
        
        return {
            // Fields from my perspective
            playerField: myField.map(col => col.map(c => c ? this.serializeCryptid(c) : null)),
            enemyField: opponentField.map(col => col.map(c => c ? this.serializeCryptid(c) : null)),
            
            // My private info
            hand: myHand.map(c => this.serializeCard(c)),
            kindling: myKindling.map(c => this.serializeCard(c)),
            
            // Opponent hidden info (just counts)
            opponentHandCount: opponentHand.length,
            opponentKindlingCount: opponentKindling.length,
            
            // Resources
            playerPyre: myPyre,
            enemyPyre: opponentPyre,
            
            // Traps (opponent's are hidden)
            playerTraps: myTraps,
            enemyTraps: opponentTraps.map(t => t ? { type: 'trap', faceDown: true, row: t.row } : null),
            
            // Turn info
            isMyTurn,
            phase: this.gameState.phase,
            turnNumber: this.gameState.turnNumber,
            
            // Flags
            kindlingPlayed: isPlayer1 ? this.gameState.playerKindlingPlayed : this.gameState.enemyKindlingPlayed,
            pyreCardPlayed: isPlayer1 ? this.gameState.playerPyreCardPlayed : this.gameState.enemyPyreCardPlayed,
            pyreBurnUsed: isPlayer1 ? this.gameState.playerPyreBurnUsed : this.gameState.enemyPyreBurnUsed,
            
            // Game end
            gameOver: this.gameState.gameOver,
            winner: this.gameState.winner ? 
                ((isPlayer1 && this.gameState.winner === 'player') || (!isPlayer1 && this.gameState.winner === 'enemy') ? 'player' : 'enemy') 
                : null
        };
    }
    
    filterEventsForPlayer(events, playerId) {
        const isPlayer1 = playerId === this.playerIds[0];
        const myOwner = isPlayer1 ? 'player' : 'enemy';
        
        return events.map(event => {
            // Hide opponent's card draws
            if (event.type === GameEventTypes.CARD_DRAWN && event.owner !== myOwner) {
                return { type: event.type, owner: event.owner, cardCount: 1 };
            }
            
            // Flip perspective for field events
            if (event.owner) {
                return {
                    ...event,
                    owner: event.owner === myOwner ? 'player' : 'enemy'
                };
            }
            
            return event;
        });
    }
    
    // ==================== TIMER MANAGEMENT ====================
    
    startTurnTimer() {
        this.stopTurnTimer();
        this.turnStartTime = Date.now();
        this.warningSent = false;
        
        this.turnTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
            const remaining = this.TURN_TIME - elapsed;
            
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
        
        const currentPlayerId = this.gameState.currentTurn === 'player' ? this.playerIds[0] : this.playerIds[1];
        const player = this.players[currentPlayerId];
        
        if (player) {
            player.timeouts++;
            
            if (player.timeouts >= this.TIMEOUT_FORFEIT) {
                const winnerId = this.playerIds.find(id => id !== currentPlayerId);
                this.handleForfeit(currentPlayerId, 'timeout');
                return;
            }
        }
        
        // Force end phase
        this.events = [];
        const owner = this.gameState.currentTurn;
        this.handleEndPhase(owner);
    }
    
    // ==================== SPECIAL HANDLERS ====================
    
    handleForfeit(playerId, reason) {
        this.stopTurnTimer();
        const winnerId = this.playerIds.find(id => id !== playerId);
        
        return new Response(JSON.stringify({
            type: 'matchEnd',
            winner: winnerId,
            reason
        }), { status: 200 });
    }
    
    handleRejoin(playerId) {
        const player = this.players[playerId];
        if (!player) {
            return new Response(JSON.stringify({ error: 'Player not in match' }), { status: 400 });
        }
        
        player.connected = true;
        
        if (this.disconnectTimers[playerId]) {
            clearTimeout(this.disconnectTimers[playerId]);
            delete this.disconnectTimers[playerId];
        }
        
        const state = this.getStateForPlayer(playerId);
        const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
        
        return new Response(JSON.stringify({
            type: 'rejoinState',
            state,
            timeRemaining: Math.max(0, this.TURN_TIME - elapsed),
            phase: this.gameState.phase,
            turnNumber: this.gameState.turnNumber
        }), { status: 200 });
    }
    
    handleDisconnect(data) {
        const { playerId } = data;
        const player = this.players[playerId];
        
        if (player) {
            player.connected = false;
            
            this.disconnectTimers[playerId] = setTimeout(() => {
                const winnerId = this.playerIds.find(id => id !== playerId);
                // Mark match as ended due to disconnect
                this.gameState.gameOver = true;
                this.gameState.winner = winnerId === this.playerIds[0] ? 'player' : 'enemy';
            }, this.DISCONNECT_GRACE);
        }
        
        return new Response('OK', { status: 200 });
    }
}