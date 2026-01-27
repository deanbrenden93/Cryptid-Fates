/**
 * Cryptid Fates - Cloudflare Worker Game Server with Authentication
 * 
 * ARCHITECTURE: Uses SharedGameEngine v2 (data-driven abilities)
 * The server validates actions and delegates to the engine.
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

// ==================== IMPORTS ====================

// Import the new data-driven game engine
import { SharedGameEngine, Triggers } from './shared-game-engine.js';

// ==================== CONFIGURATION ====================

const SERVER_VERSION = 38; // v=38 - Fixed getStateForPlayer perspective (no double flip)

const COOKIE_NAME = 'cf_session';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days in seconds
const CSRF_COOKIE = 'cf_csrf';

// Frontend URL - where to redirect after login
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

function generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateUUID() {
    return crypto.randomUUID();
}

function parseCookies(request) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name) cookies[name] = rest.join('=');
    });
    return cookies;
}

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

function createCsrfCookie(state, env) {
    const isProduction = !env.BASE_URL?.includes('localhost');
    return createCookie(CSRF_COOKIE, state, {
        maxAge: 600,
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Lax'
    });
}

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    });
}

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
    const sessionId = generateSecureToken();
    const sessionData = {
        userId,
        ...userData,
        createdAt: Date.now(),
        expiresAt: Date.now() + (SESSION_TTL * 1000)
    };
    
    await env.SESSIONS.put(sessionId, JSON.stringify(sessionData), {
        expirationTtl: SESSION_TTL
    });
    
    return sessionId;
}

async function getSession(env, request) {
    const cookies = parseCookies(request);
    const sessionId = cookies[COOKIE_NAME];
    
    if (!sessionId) return null;
    
    const sessionData = await env.SESSIONS.get(sessionId);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    
    if (Date.now() > session.expiresAt) {
        await env.SESSIONS.delete(sessionId);
        return null;
    }
    
    return session;
}

async function deleteSession(env, request) {
    const cookies = parseCookies(request);
    const sessionId = cookies[COOKIE_NAME];
    
    if (sessionId) {
        await env.SESSIONS.delete(sessionId);
    }
}

// ==================== DATABASE HELPERS ====================

async function findOrCreateUser(env, provider, providerUserId, email, displayName) {
    let user = await env.DB.prepare(
        'SELECT * FROM users WHERE provider = ? AND provider_user_id = ?'
    ).bind(provider, providerUserId).first();
    
    if (!user) {
        const userId = generateUUID();
        const now = new Date().toISOString();
    
    await env.DB.prepare(`
            INSERT INTO users (id, email, display_name, provider, provider_user_id, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(userId, email, displayName, provider, providerUserId, now, now).run();
        
        user = {
            id: userId,
            email,
            display_name: displayName,
            provider,
            provider_user_id: providerUserId,
            created_at: now,
            last_login: now,
            stats: null
        };
    } else {
        await env.DB.prepare(
            'UPDATE users SET last_login = ? WHERE id = ?'
        ).bind(new Date().toISOString(), user.id).run();
    }
    
    return user;
}

// ==================== OAUTH HANDLERS ====================

async function handleOAuthStart(provider, env, request) {
    const config = OAUTH_CONFIG[provider];
    if (!config) {
        return jsonResponse({ error: 'Unknown provider' }, 400);
    }
    
    const state = generateSecureToken();
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.DISCORD_CLIENT_ID;
    
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${env.BASE_URL}/auth/${provider}/callback`,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state
    });
    
    if (provider === 'google') {
        params.set('access_type', 'offline');
        params.set('prompt', 'consent');
    }
    
    return redirect(`${config.authUrl}?${params.toString()}`, {
        'Set-Cookie': createCsrfCookie(state, env)
    });
}

async function handleOAuthCallback(provider, env, request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    if (error) {
        return redirect(`${FRONTEND_URL}?error=${encodeURIComponent(error)}`);
    }
    
    const cookies = parseCookies(request);
    const savedState = cookies[CSRF_COOKIE];
    
    if (!code || !state || state !== savedState) {
        return redirect(`${FRONTEND_URL}?error=invalid_state`);
    }
    
    try {
    const config = OAUTH_CONFIG[provider];
    const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.DISCORD_CLIENT_ID;
    const clientSecret = provider === 'google' ? env.GOOGLE_CLIENT_SECRET : env.DISCORD_CLIENT_SECRET;
    
        const tokenParams = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${env.BASE_URL}/auth/${provider}/callback`
        });
        
        const tokenResponse = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenParams.toString()
        });
        
        const tokens = await tokenResponse.json();
        
        if (!tokens.access_token) {
            console.error('Token error:', tokens);
            return redirect(`${FRONTEND_URL}?error=token_exchange_failed`);
        }
        
        const userResponse = await fetch(config.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Accept': 'application/json'
            }
        });
        
        const userInfo = await userResponse.json();
        
        let providerUserId, email, displayName;
        
        if (provider === 'google') {
            providerUserId = userInfo.id;
            email = userInfo.email;
            displayName = userInfo.name || email.split('@')[0];
        } else {
            providerUserId = userInfo.id;
            email = userInfo.email;
            displayName = userInfo.global_name || userInfo.username;
        }
        
        const user = await findOrCreateUser(env, provider, providerUserId, email, displayName);
        const sessionId = await createSession(env, user.id, {
            email: user.email,
            displayName: user.display_name,
            provider
        });
        
        return redirect(FRONTEND_URL, {
            'Set-Cookie': createSessionCookie(sessionId, env)
        });
        
    } catch (err) {
        console.error('OAuth callback error:', err);
        return redirect(`${FRONTEND_URL}?error=auth_failed`);
    }
}

async function handleGetUser(env, request) {
    const session = await getSession(env, request);
    
    if (!session) {
        return jsonResponse({ authenticated: false });
    }
    
    try {
        const user = await env.DB.prepare(
            'SELECT id, email, display_name, created_at, stats FROM users WHERE id = ?'
        ).bind(session.userId).first();
    
    if (!user) {
            return jsonResponse({ authenticated: false });
    }
    
    return jsonResponse({
        authenticated: true,
        user: {
            id: user.id,
            email: user.email,
                displayName: user.display_name,
                createdAt: user.created_at,
                stats: user.stats ? JSON.parse(user.stats) : null
            }
        });
    } catch (err) {
        console.error('Get user error:', err);
        return jsonResponse({ authenticated: false, error: 'Database error' });
    }
}

async function handleLogout(env, request) {
    await deleteSession(env, request);
    
    return jsonResponse({ success: true }, 200, {
        'Set-Cookie': deleteSessionCookie(env)
    });
}

async function handleUpdateProfile(env, request) {
    const session = await getSession(env, request);
    
    if (!session) {
        return jsonResponse({ error: 'Not authenticated' }, 401);
    }
    
    try {
        const body = await request.json();
        const { displayName } = body;
        
        if (displayName) {
        await env.DB.prepare(
            'UPDATE users SET display_name = ? WHERE id = ?'
            ).bind(displayName, session.userId).run();
        }
        
        return jsonResponse({ success: true });
    } catch (err) {
        console.error('Update profile error:', err);
        return jsonResponse({ error: 'Failed to update profile' }, 500);
    }
}

// ==================== MAIN WORKER ====================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        const corsHeaders = {
            'Access-Control-Allow-Origin': FRONTEND_URL,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true'
        };
        
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }
        
        // Auth routes
        if (url.pathname === '/auth/google') {
            return handleOAuthStart('google', env, request);
        }
        if (url.pathname === '/auth/discord') {
            return handleOAuthStart('discord', env, request);
        }
        if (url.pathname === '/auth/google/callback') {
            return handleOAuthCallback('google', env, request);
        }
        if (url.pathname === '/auth/discord/callback') {
            return handleOAuthCallback('discord', env, request);
        }
        if (url.pathname === '/auth/user' && request.method === 'GET') {
            const response = await handleGetUser(env, request);
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }
        if (url.pathname === '/auth/logout' && request.method === 'POST') {
            const response = await handleLogout(env, request);
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }
        if (url.pathname === '/auth/profile' && request.method === 'POST') {
            const response = await handleUpdateProfile(env, request);
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }
        
        // WebSocket upgrade for multiplayer
        if (request.headers.get('Upgrade') === 'websocket') {
            const session = await getSession(env, request);
            
            const matchmakerId = env.MATCHMAKER.idFromName('global');
            const matchmaker = env.MATCHMAKER.get(matchmakerId);
            
            const newHeaders = new Headers(request.headers);
            if (session) {
                newHeaders.set('X-User-Id', session.userId);
                newHeaders.set('X-User-Name', session.displayName || 'Player');
            }
            
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
        
        // Version check
        if (url.pathname === '/version') {
            return jsonResponse({ version: SERVER_VERSION });
        }
        
        return new Response('Cryptid Fates Game Server', { status: 200 });
    }
};

// ==================== MATCHMAKER DURABLE OBJECT ====================

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
        
        const userId = request.headers.get('X-User-Id');
        const userName = request.headers.get('X-User-Name');
        
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
                if (!this.connections.has(tempId)) {
                    this.handleAuth(tempId, ws, msg);
                }
                break;
            
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
    
    handleAuth(tempId, ws, msg) {
        const playerId = msg.playerId || crypto.randomUUID();
        const playerName = msg.playerName || 'Summoner';
        
        this.connections.set(tempId, playerId);
        this.players.set(playerId, {
            ws,
            tempId,
            name: playerName,
            searching: false,
            mode: null,
            deckId: null,
            matchId: null
        });
        
        ws.send(JSON.stringify({
            type: 'authenticated',
            playerId,
            playerName
        }));
    }
    
    handleFindMatch(playerId, msg) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        const mode = msg.mode || 'bo1';
        player.searching = true;
        player.mode = mode;
        player.deckId = msg.deckId;
        
        const queue = this.queues[mode] || this.queues.bo1;
        
        if (!queue.includes(playerId)) {
            queue.push(playerId);
        }
        
        player.ws.send(JSON.stringify({ type: 'searching' }));
        
        this.tryMatchPlayers(mode);
    }
    
    handleCancelMatch(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        player.searching = false;
        
        for (const mode of ['bo1', 'bo3']) {
            const queue = this.queues[mode];
            const index = queue.indexOf(playerId);
            if (index !== -1) {
                queue.splice(index, 1);
            }
        }
        
        player.ws.send(JSON.stringify({ type: 'searchCancelled' }));
    }
    
    tryMatchPlayers(mode) {
        const queue = this.queues[mode];
        
        while (queue.length >= 2) {
            const player1Id = queue.shift();
            const player2Id = queue.shift();
            
        const player1 = this.players.get(player1Id);
        const player2 = this.players.get(player2Id);
        
            if (!player1 || !player2) {
                if (player1 && !player2) queue.unshift(player1Id);
                if (player2 && !player1) queue.unshift(player2Id);
                continue;
            }
            
            this.createMatch(player1Id, player2Id, mode);
        }
    }
    
    createMatch(player1Id, player2Id, mode) {
        const matchId = crypto.randomUUID();
        const goesFirst = Math.random() < 0.5 ? player1Id : player2Id;
        const seed = Date.now();
        
        const player1 = this.players.get(player1Id);
        const player2 = this.players.get(player2Id);
        
        player1.searching = false;
        player2.searching = false;
        player1.matchId = matchId;
        player2.matchId = matchId;
        
        // Create game room
        const roomId = this.env.GAME_ROOM.idFromName(matchId);
        const gameRoom = this.env.GAME_ROOM.get(roomId);
        
        this.gameRooms.set(matchId, {
            matchId,
            mode,
            players: {
                [player1Id]: player1.ws,
                [player2Id]: player2.ws
            },
            gameRoom
        });
        
        // Initialize game room
        gameRoom.fetch(new Request('http://internal/init', {
            method: 'POST',
            body: JSON.stringify({
                matchId,
                mode,
                player1: { id: player1Id, name: player1.name },
                player2: { id: player2Id, name: player2.name },
                goesFirst,
                seed
            })
        }));
        
        // Notify players
        player1.ws.send(JSON.stringify({
            type: 'matchFound',
            matchId,
            opponentId: player2Id,
            opponentName: player2.name,
            goesFirst: goesFirst === player1Id,
            mode,
            seed
        }));
        
        player2.ws.send(JSON.stringify({
            type: 'matchFound',
            matchId,
            opponentId: player1Id,
            opponentName: player1.name,
            goesFirst: goesFirst === player2Id,
            mode,
            seed
        }));
    }
    
    async handleGameAction(tempId, msg) {
        const playerId = this.connections.get(tempId);
        if (!playerId) return;
        
        const player = this.players.get(playerId);
        if (!player || !player.matchId) return;
        
        const room = this.gameRooms?.get(player.matchId);
        if (!room) return;
        
        // Forward to game room
        const response = await room.gameRoom.fetch(new Request('http://internal/action', {
            method: 'POST',
            body: JSON.stringify({
                playerId,
                action: msg.action,
                deckData: msg.deckData
            })
        }));
        
        const result = await response.json();
        
        if (!result.valid) {
            const senderWs = room.players[playerId];
            if (senderWs?.readyState === 1) {
                senderWs.send(JSON.stringify({
                    type: 'actionError',
                    error: result.error
                }));
            }
            return;
        }
        
        // Send state to each player
        const serverTime = result.serverTime || Date.now();
        const startAtServerMs = serverTime + 150;
        
        for (const [pid, pws] of Object.entries(room.players)) {
            if (pws.readyState !== 1) continue;
            
            const playerData = (result.player1?.playerId === pid) ? result.player1 : result.player2;
            
            if (!playerData) continue;
            
            const resolvedAction = {
                type: 'resolvedAction',
                action: msg.action,
                events: playerData.events,
                state: playerData.state,
                sourcePlayerId: playerId,
                isMyAction: pid === playerId,
                serverTime,
                startAtServerMs,
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
        
        const syncMsg = {
            type: 'kindlingSync',
            kindling: msg.kindling,
            sourcePlayerId: playerId,
            serverTime: Date.now()
        };
        
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
// Uses SharedGameEngine v2 with data-driven abilities

export class GameRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        
        // Match metadata
        this.matchId = null;
        this.mode = null;
        this.players = {};    // playerId -> { slot, name, connected, timeouts }
        this.playerIds = [];  // [player1Id, player2Id]
        
        // Timer settings
        this.TURN_TIME = 150;
        this.DISCONNECT_GRACE = 60000;
        this.TIMEOUT_FORFEIT = 3;
        
        this.turnStartTime = null;
        this.turnTimer = null;
        
        // *** SHARED GAME ENGINE v2 - Data-driven abilities ***
        this.engine = null;
        this.eventLog = [];
        
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
        
        const p1Id = data.player1.id;
        const p2Id = data.player2.id;
        this.playerIds = [p1Id, p2Id];
        
        this.players = {
            [p1Id]: { 
                ...data.player1, 
                connected: true, 
                slot: 'player',  // p1 is always 'player' in engine terms
                timeouts: 0,
                deckInitialized: false
            },
            [p2Id]: { 
                ...data.player2, 
                connected: true, 
                slot: 'enemy',   // p2 is always 'enemy' in engine terms
                timeouts: 0,
                deckInitialized: false
            }
        };
        
        // Create the game engine
        this.engine = new SharedGameEngine();
        
        // Set initial turn based on who goes first
        // p1Id = 'player', p2Id = 'enemy' in engine terms
        const goesFirstOwner = data.goesFirst === p1Id ? 'player' : 'enemy';
        this.engine.state.currentTurn = goesFirstOwner;
        
        // Give starting pyre to first player
        if (goesFirstOwner === 'player') {
            this.engine.state.playerPyre = 1;
        } else {
            this.engine.state.enemyPyre = 1;
        }
        
        console.log('[GameRoom] Init:', { p1Id, p2Id, goesFirst: goesFirstOwner });
        
        // Set up event logging
        this.engine.on('onSummon', (data) => this.logEvent('onSummon', data));
        this.engine.on('onDamageTaken', (data) => this.logEvent('onDamageTaken', data));
        this.engine.on('onDeath', (data) => this.logEvent('onDeath', data));
        this.engine.on('onPyreGained', (data) => this.logEvent('onPyreGained', data));
        
        this.startTurnTimer();
        
        return new Response(JSON.stringify({
            success: true,
            matchId: this.matchId,
            firstPlayer: data.goesFirst,
            seed: data.seed
        }), { status: 200 });
    }
    
    logEvent(type, data) {
        this.eventLog.push({ type, data, timestamp: Date.now() });
    }
    
    // ==================== ACTION PROCESSING ====================
    
    async handleAction(data) {
        const { playerId, action, deckData } = data;
        const player = this.players[playerId];
        
        if (!player) {
            return new Response(JSON.stringify({ 
                valid: false, 
                error: 'Player not in game' 
            }), { status: 400 });
        }
        
        // Determine owner ('player' or 'enemy')
        const owner = player.slot; // 'player' or 'enemy'
        
        // Initialize deck if provided
        if (deckData && !player.deckInitialized) {
            console.log(`[GameRoom] Initializing deck for ${playerId} (${owner})`);
            this.initializeDeck(owner, deckData);
            player.deckInitialized = true;
        }
        
        // Clear event log for this action
        this.eventLog = [];
        if (this.engine.executor) {
            this.engine.executor.eventQueue = [];
        }
        
        // Basic turn validation (unless it's a sync action)
        const noTurnCheckActions = ['turnStartSync', 'kindlingSync'];
        if (!noTurnCheckActions.includes(action.type)) {
            if (this.engine.state.currentTurn !== owner) {
                return new Response(JSON.stringify({ 
                    valid: false, 
                    error: 'Not your turn' 
                }), { status: 400 });
            }
        }
        
        // Execute the action (validation happens in execute methods)
        const result = this.executeAction(owner, action);
        
        if (!result.success) {
            return new Response(JSON.stringify({ 
                valid: false, 
                error: result.error 
            }), { status: 400 });
        }
        
        // Restart turn timer
        this.startTurnTimer();
        
        // Get events from executor
        const events = [...this.engine.executor.eventQueue, ...this.eventLog];
        
        // Get state for each player
        const p1State = this.getStateForPlayer(this.playerIds[0]);
        const p2State = this.getStateForPlayer(this.playerIds[1]);
        
        const serverTime = Date.now();
        
        return new Response(JSON.stringify({
            valid: true,
            sourcePlayerId: playerId,
            serverTime,
            startAtServerMs: serverTime + 150,
            player1: {
                playerId: this.playerIds[0],
                events,
                state: p1State
            },
            player2: {
                playerId: this.playerIds[1],
                events,
                state: p2State
            }
        }), { status: 200 });
    }
    
    initializeDeck(owner, deckData) {
        const hand = owner === 'player' ? this.engine.state.playerHand : this.engine.state.enemyHand;
        const kindling = owner === 'player' ? this.engine.state.playerKindling : this.engine.state.enemyKindling;
        const deck = owner === 'player' ? this.engine.state.playerDeck : this.engine.state.enemyDeck;
        
        // Add cards to hand
        if (deckData.hand) {
            for (const card of deckData.hand) {
                hand.push({ ...card, id: card.id || `${owner}-hand-${Date.now()}-${Math.random()}` });
            }
        }
        
        // Add kindling
        if (deckData.kindling) {
            for (const card of deckData.kindling) {
                kindling.push({ ...card, id: card.id || `${owner}-kindling-${Date.now()}-${Math.random()}` });
            }
        }
        
        // Add deck (client sends as mainDeck)
        if (deckData.mainDeck) {
            deck.push(...deckData.mainDeck);
        } else if (deckData.deck) {
            deck.push(...deckData.deck);
        }
    }
    
    executeAction(owner, action) {
        switch (action.type) {
            case 'summon':
                return this.executeSummon(owner, action);
            case 'summonKindling':
                return this.executeSummonKindling(owner, action);
            case 'attack':
                return this.executeAttack(owner, action);
            case 'rest':
                return this.executeRest(owner, action);
            case 'playPyre':
                return this.executePlayPyre(owner, action);
            case 'playBurst':
                return this.executePlayBurst(owner, action);
            case 'playTrap':
                return this.executePlayTrap(owner, action);
            case 'playAura':
                return this.executePlayAura(owner, action);
            case 'evolve':
                return this.executeEvolve(owner, action);
            case 'activateAbility':
                return this.executeActivateAbility(owner, action);
            case 'endPhase':
                return this.executeEndPhase(owner);
            case 'endTurn':
                return this.executeEndTurn(owner);
            case 'turnStartSync':
                // Client sync message - acknowledge but don't process
                return { success: true };
            default:
                console.log(`[GameRoom] Unknown action type: ${action.type}`);
                return { success: false, error: `Unknown action: ${action.type}` };
        }
    }
    
    executeSummon(owner, action) {
        const { cardId, cardIndex, col, row } = action;
        const hand = owner === 'player' ? this.engine.state.playerHand : this.engine.state.enemyHand;
        
        // Find card
        let idx = cardIndex;
        if (cardId !== undefined) {
            idx = hand.findIndex(c => c.id === cardId || c.id == cardId);
        }
        
        if (idx < 0 || idx >= hand.length) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand.splice(idx, 1)[0];
        
        const result = this.engine.summon(owner, card, col, row);
        if (!result.success) {
            // Put card back
            hand.splice(idx, 0, card);
        }
        
        return result;
    }
    
    executeSummonKindling(owner, action) {
        const { kindlingId, kindlingIndex, col, row } = action;
        const kindling = owner === 'player' ? this.engine.state.playerKindling : this.engine.state.enemyKindling;
        
        // Find kindling
        let idx = kindlingIndex;
        if (kindlingId !== undefined) {
            idx = kindling.findIndex(k => k.id === kindlingId || k.id == kindlingId);
        }
        
        if (idx < 0 || idx >= kindling.length) {
            return { success: false, error: 'Kindling not found' };
        }
        
        const card = kindling.splice(idx, 1)[0];
        
        const result = this.engine.summon(owner, card, col, row);
        if (!result.success) {
            kindling.splice(idx, 0, card);
        }
        
        return result;
    }
    
    executeAttack(owner, action) {
        const { attackerCol, attackerRow, targetCol, targetRow } = action;
        
        const attacker = this.engine.getCryptidAt(owner, attackerCol, attackerRow);
        if (!attacker) {
            return { success: false, error: 'No attacker at position' };
        }
        
        const targetOwner = owner === 'player' ? 'enemy' : 'player';
        
        return this.engine.attack(attacker, targetOwner, targetCol, targetRow);
    }
    
    executeRest(owner, action) {
        const { col, row } = action;
        
        const cryptid = this.engine.getCryptidAt(owner, col, row);
        if (!cryptid) {
            return { success: false, error: 'No cryptid at position' };
        }
        
        this.engine.rest(cryptid);
        return { success: true };
    }
    
    executePlayPyre(owner, action) {
        const { cardId, cardIndex } = action;
        const hand = owner === 'player' ? this.engine.state.playerHand : this.engine.state.enemyHand;
        
        let idx = cardIndex;
        if (cardId !== undefined) {
            idx = hand.findIndex(c => c.id === cardId || c.id == cardId);
        }
        
        if (idx < 0 || idx >= hand.length) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[idx];
        if (card.type !== 'pyre') {
            return { success: false, error: 'Not a pyre card' };
        }
        
        // Remove card and gain pyre
        hand.splice(idx, 1);
        this.engine.gainPyre(owner, card.pyreValue || 1, card.name);
        
        return { success: true };
    }
    
    executePlayBurst(owner, action) {
        const { cardId, cardIndex, targetCol, targetRow, targetOwner } = action;
        const hand = owner === 'player' ? this.engine.state.playerHand : this.engine.state.enemyHand;
        const pyre = owner === 'player' ? this.engine.state.playerPyre : this.engine.state.enemyPyre;
        
        let idx = cardIndex;
        if (cardId !== undefined) {
            idx = hand.findIndex(c => c.id === cardId || c.id == cardId);
        }
        
        if (idx < 0 || idx >= hand.length) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[idx];
        if (card.type !== 'burst') {
            return { success: false, error: 'Not a burst card' };
        }
        
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        // Deduct pyre
        if (owner === 'player') {
            this.engine.state.playerPyre -= card.cost;
        } else {
            this.engine.state.enemyPyre -= card.cost;
        }
        
        // Remove from hand
        hand.splice(idx, 1);
        
        // Execute burst effects using ability executor
        if (card.effects && this.engine.executor) {
            const resolvedTargetOwner = targetOwner === 'enemy' ? (owner === 'player' ? 'enemy' : 'player') : owner;
            const target = targetCol !== undefined && targetRow !== undefined 
                ? this.engine.getCryptidAt(resolvedTargetOwner, targetCol, targetRow)
                : null;
            
            this.engine.executor.context = {
                self: card,
                owner,
                target,
                eventData: { targetCol, targetRow, targetOwner: resolvedTargetOwner }
            };
            
            for (const effect of card.effects) {
                this.engine.executeEffect(effect);
            }
        }
        
        this.engine.emit('onBurstPlayed', { card, owner, targetCol, targetRow });
        
        return { success: true };
    }
    
    executePlayTrap(owner, action) {
        const { cardId, cardIndex, row } = action;
        const hand = owner === 'player' ? this.engine.state.playerHand : this.engine.state.enemyHand;
        const traps = owner === 'player' ? this.engine.state.playerTraps : this.engine.state.enemyTraps;
        const pyre = owner === 'player' ? this.engine.state.playerPyre : this.engine.state.enemyPyre;
        
        let idx = cardIndex;
        if (cardId !== undefined) {
            idx = hand.findIndex(c => c.id === cardId || c.id == cardId);
        }
        
        if (idx < 0 || idx >= hand.length) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[idx];
        if (card.type !== 'trap') {
            return { success: false, error: 'Not a trap card' };
        }
        
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        const trapRow = row !== undefined ? row : 0;
        if (traps[trapRow]) {
            return { success: false, error: 'Trap slot occupied' };
        }
        
        // Deduct pyre
        if (owner === 'player') {
            this.engine.state.playerPyre -= card.cost;
        } else {
            this.engine.state.enemyPyre -= card.cost;
        }
        
        // Remove from hand and set trap
        hand.splice(idx, 1);
        traps[trapRow] = { ...card, row: trapRow };
        
        this.engine.emit('onTrapSet', { card, owner, row: trapRow });
        
        return { success: true };
    }
    
    executePlayAura(owner, action) {
        const { cardId, cardIndex, targetCol, targetRow } = action;
        const hand = owner === 'player' ? this.engine.state.playerHand : this.engine.state.enemyHand;
        const pyre = owner === 'player' ? this.engine.state.playerPyre : this.engine.state.enemyPyre;
        
        let idx = cardIndex;
        if (cardId !== undefined) {
            idx = hand.findIndex(c => c.id === cardId || c.id == cardId);
        }
        
        if (idx < 0 || idx >= hand.length) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[idx];
        if (card.type !== 'aura') {
            return { success: false, error: 'Not an aura card' };
        }
        
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        const target = this.engine.getCryptidAt(owner, targetCol, targetRow);
        if (!target) {
            return { success: false, error: 'No target for aura' };
        }
        
        // Deduct pyre
        if (owner === 'player') {
            this.engine.state.playerPyre -= card.cost;
        } else {
            this.engine.state.enemyPyre -= card.cost;
        }
        
        // Remove from hand
        hand.splice(idx, 1);
        
        // Apply aura to target
        target.auras = target.auras || [];
        target.auras.push({ key: card.key, name: card.name });
        
        // Apply aura bonuses
        if (card.atkBonus) target.currentAtk = (target.currentAtk || target.atk) + card.atkBonus;
        if (card.hpBonus) target.currentHp = (target.currentHp || target.hp) + card.hpBonus;
        if (card.grantsFlags) {
            for (const flag of card.grantsFlags) {
                target[flag] = true;
            }
        }
        if (card.grantsRegeneration) {
            target.regeneration = (target.regeneration || 0) + card.grantsRegeneration;
        }
        
        this.engine.emit('onAuraApplied', { card, target, owner });
        
        return { success: true };
    }
    
    executeEvolve(owner, action) {
        const { cardId, cardIndex, targetCol, targetRow } = action;
        const hand = owner === 'player' ? this.engine.state.playerHand : this.engine.state.enemyHand;
        const pyre = owner === 'player' ? this.engine.state.playerPyre : this.engine.state.enemyPyre;
        
        let idx = cardIndex;
        if (cardId !== undefined) {
            idx = hand.findIndex(c => c.id === cardId || c.id == cardId);
        }
        
        if (idx < 0 || idx >= hand.length) {
            return { success: false, error: 'Card not in hand' };
        }
        
        const card = hand[idx];
        const target = this.engine.getCryptidAt(owner, targetCol, targetRow);
        
        if (!target) {
            return { success: false, error: 'No target for evolution' };
        }
        
        // Check evolution is valid
        if (target.key !== card.evolvesFrom && target.evolvesInto !== card.key) {
            return { success: false, error: 'Invalid evolution target' };
        }
        
        if (card.cost > pyre) {
            return { success: false, error: 'Not enough pyre' };
        }
        
        // Deduct pyre
        if (owner === 'player') {
            this.engine.state.playerPyre -= card.cost;
        } else {
            this.engine.state.enemyPyre -= card.cost;
        }
        
        // Remove card from hand
        hand.splice(idx, 1);
        
        // Evolve the cryptid: replace with new card, preserve position state
        const evolved = this.engine.createCryptidInstance(card, owner, target.col, target.row);
        evolved.tapped = target.tapped;
        evolved.canAttack = target.canAttack;
        
        const field = this.engine.getField(owner);
        field[target.col][target.row] = evolved;
        
        this.engine.emit('onEvolve', { from: target, to: evolved, owner });
        
        return { success: true };
    }
    
    executeActivateAbility(owner, action) {
        const { abilityName, col, row, targetCol, targetRow, targetOwner } = action;
        
        const cryptid = this.engine.getCryptidAt(owner, col, row);
        if (!cryptid) {
            return { success: false, error: 'No cryptid at position' };
        }
        
        // Find the activatable ability
        const ability = cryptid.abilities?.find(a => 
            a.trigger === 'activatable' && a.id === abilityName
        );
        
        if (!ability) {
            return { success: false, error: `Ability ${abilityName} not found` };
        }
        
        // Check condition
        if (ability.condition && !this.engine.executor.checkCondition(ability.condition)) {
            return { success: false, error: 'Ability condition not met' };
        }
        
        // Execute ability effects
        const resolvedTargetOwner = targetOwner === 'enemy' ? (owner === 'player' ? 'enemy' : 'player') : owner;
        const target = targetCol !== undefined && targetRow !== undefined 
            ? this.engine.getCryptidAt(resolvedTargetOwner, targetCol, targetRow)
            : null;
        
        this.engine.executor.context = {
            self: cryptid,
            owner,
            target,
            eventData: { abilityName, targetCol, targetRow, targetOwner: resolvedTargetOwner }
        };
        
        this.engine.executor.executeEffects(ability.effects || [], ability.target);
        
        this.engine.emit('onAbilityActivated', { cryptid, abilityName, owner });
        
        return { success: true };
    }
    
    executeEndPhase(owner) {
        // Just end the current turn (phase management happens client-side)
        return this.executeEndTurn(owner);
    }
    
    executeEndTurn(owner) {
        // End current turn
        this.engine.endTurn(owner);
        
        // Start next turn
        const nextOwner = owner === 'player' ? 'enemy' : 'player';
        this.engine.startTurn(nextOwner);
        
        // Give pyre to new player
        this.engine.gainPyre(nextOwner, 1, 'turnStart');
        
        return { success: true };
    }
    
    getStateForPlayer(playerId) {
        // NEW ARCHITECTURE: Send state from PLAYER's OWN perspective
        // No flipping - client's applyServerState expects:
        // - state.playerField = player's own field
        // - state.enemyField = opponent's field
        
        const player = this.players[playerId];
        if (!player) return null;
        
        const isPlayer1 = player.slot === 'player';
        const state = this.engine.state;
        
        if (isPlayer1) {
            // Player 1: their field is playerField, opponent is enemyField
            return {
                playerField: this.serializeField(state.playerField),
                enemyField: this.serializeField(state.enemyField),
                playerPyre: state.playerPyre,
                enemyPyre: state.enemyPyre,
                playerDeaths: state.playerDeaths,
                enemyDeaths: state.enemyDeaths,
                hand: state.playerHand,
                kindling: state.playerKindling,
                currentTurn: state.currentTurn,
                phase: state.phase,
                turnNumber: state.turnNumber,
                isMyTurn: state.currentTurn === 'player',
                gameOver: state.gameOver,
                winner: state.winner
            };
        } else {
            // Player 2: their field is enemyField, opponent is playerField
            // Send from P2's perspective where they see themselves as "player"
            return {
                playerField: this.serializeField(state.enemyField),   // P2's field
                enemyField: this.serializeField(state.playerField),   // P1's field (enemy to P2)
                playerPyre: state.enemyPyre,
                enemyPyre: state.playerPyre,
                playerDeaths: state.enemyDeaths,
                enemyDeaths: state.playerDeaths,
                hand: state.enemyHand,
                kindling: state.enemyKindling,
                // From P2's perspective: if currentTurn is 'enemy', it's P2's turn (their turn)
                currentTurn: state.currentTurn === 'enemy' ? 'player' : 'enemy',
                phase: state.phase,
                turnNumber: state.turnNumber,
                isMyTurn: state.currentTurn === 'enemy',
                gameOver: state.gameOver,
                winner: state.winner === 'player' ? 'enemy' : state.winner === 'enemy' ? 'player' : state.winner
            };
        }
    }
    
    serializeField(field) {
        return field.map(col => col.map(cryptid => {
            if (!cryptid) return null;
            return this.serializeCryptid(cryptid);
        }));
    }
    
    serializeCryptid(cryptid) {
        if (!cryptid) return null;
        
        // Return a clean copy without function references
        return {
            id: cryptid.id,
            key: cryptid.key,
            name: cryptid.name,
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            type: cryptid.type,
            cost: cryptid.cost,
            atk: cryptid.atk,
            hp: cryptid.hp,
            currentHp: cryptid.currentHp,
            maxHp: cryptid.maxHp,
            currentAtk: cryptid.currentAtk,
            baseAtk: cryptid.baseAtk,
            tapped: cryptid.tapped,
            canAttack: cryptid.canAttack,
            isKindling: cryptid.isKindling,
            element: cryptid.element,
            rarity: cryptid.rarity,
            // Status effects
            burnTurns: cryptid.burnTurns,
            bleedTurns: cryptid.bleedTurns,
            paralyzed: cryptid.paralyzed,
            paralyzeTurns: cryptid.paralyzeTurns,
            calamityCounters: cryptid.calamityCounters,
            curseTokens: cryptid.curseTokens
        };
    }
    
    // ==================== TIMER MANAGEMENT ====================
    
    startTurnTimer() {
        this.stopTurnTimer();
        this.turnStartTime = Date.now();
        
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
        
        const currentOwner = this.engine.state.currentTurn;
        const currentPlayerId = currentOwner === 'player' ? this.playerIds[0] : this.playerIds[1];
        const player = this.players[currentPlayerId];
        
        if (player) {
            player.timeouts++;
            
            if (player.timeouts >= this.TIMEOUT_FORFEIT) {
                this.handleForfeit(currentPlayerId, 'timeout');
                return;
            }
        }
        
        // Force end turn
        this.executeEndTurn(currentOwner);
    }
    
    handleForfeit(playerId, reason) {
        this.stopTurnTimer();
        const winnerId = this.playerIds.find(id => id !== playerId);
        
        this.engine.state.gameOver = true;
        this.engine.state.winner = this.players[winnerId]?.slot || 'player';
        
        return new Response(JSON.stringify({
            type: 'matchEnd',
            winner: winnerId,
            reason
        }), { status: 200 });
    }
    
    handleDisconnect(data) {
        const { playerId } = data;
        const player = this.players[playerId];
        
        if (player) {
            player.connected = false;
            
            this.disconnectTimers[playerId] = setTimeout(() => {
                const winnerId = this.playerIds.find(id => id !== playerId);
                this.engine.state.gameOver = true;
                this.engine.state.winner = this.players[winnerId]?.slot || 'player';
            }, this.DISCONNECT_GRACE);
        }
        
        return new Response('OK', { status: 200 });
    }
}
