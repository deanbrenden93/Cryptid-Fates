"use strict";(()=>{var Ct=Object.create;var me=Object.defineProperty;var Tt=Object.getOwnPropertyDescriptor;var At=Object.getOwnPropertyNames;var Et=Object.getPrototypeOf,St=Object.prototype.hasOwnProperty;var p=(e,t)=>me(e,"name",{value:t,configurable:!0});var M=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var Pt=(e,t,a,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of At(t))!St.call(e,r)&&r!==a&&me(e,r,{get:()=>t[r],enumerable:!(n=Tt(t,r))||n.enumerable});return e};var H=(e,t,a)=>(a=e!=null?Ct(Et(e)):{},Pt(t||!e||!e.__esModule?me(a,"default",{value:e,enumerable:!0}):a,e));var Se=M((sa,Bt)=>{Bt.exports={}});var Pe=M((la,Dt)=>{Dt.exports={}});var De=M((ca,re)=>{"use strict";var Be={API_BASE:"https://cryptid-fates.brenden-6ce.workers.dev",TOKEN_KEY:"cryptid_auth_token",user:null,isAuthenticated:!1,isLoading:!0,onAuthChange:null,getToken(){return localStorage.getItem(this.TOKEN_KEY)},setToken(e){e?localStorage.setItem(this.TOKEN_KEY,e):localStorage.removeItem(this.TOKEN_KEY)},async init(){this.isLoading=!0,this.notifyChange();let t=new URLSearchParams(window.location.search).get("token");if(t){this.setToken(t);let n=new URL(window.location);n.searchParams.delete("token"),window.history.replaceState({},"",n)}let a=this.getToken();if(!a)return this.user=null,this.isAuthenticated=!1,this.isLoading=!1,this.notifyChange(),this.handleAuthErrors(),!1;try{let n=await fetch(`${this.API_BASE}/auth/user`,{method:"GET",headers:{Accept:"application/json",Authorization:`Bearer ${a}`}});if(n.ok){let r=await n.json();r.authenticated&&r.user?(this.user=r.user,this.isAuthenticated=!0):(this.setToken(null),this.user=null,this.isAuthenticated=!1)}else this.setToken(null),this.user=null,this.isAuthenticated=!1}catch(n){console.error("Auth init error:",n),this.user=null,this.isAuthenticated=!1}return this.isLoading=!1,this.notifyChange(),this.handleAuthErrors(),this.isAuthenticated},handleAuthErrors(){let e=new URLSearchParams(window.location.search),t=e.get("error");if(t){let a=new URL(window.location);a.searchParams.delete("error"),a.searchParams.delete("reason"),window.history.replaceState({},"",a);let r={oauth_denied:"Login was cancelled.",no_code:"Login failed - no authorization code received.",invalid_state:"Login failed - security check failed. Please try again.",token_exchange_failed:"Login failed - could not verify with provider.",user_info_failed:"Login failed - could not get user info.",auth_failed:"Login failed - please try again.",account_banned:`Your account has been banned. ${e.get("reason")||""}`}[t]||"Login failed. Please try again.";typeof showMessage=="function"?showMessage(r,3e3):alert(r)}},loginWithGoogle(){window.location.href=`${this.API_BASE}/auth/google`},loginWithDiscord(){window.location.href=`${this.API_BASE}/auth/discord`},async logout(){let e=this.getToken();try{await fetch(`${this.API_BASE}/auth/logout`,{method:"POST",headers:e?{Authorization:`Bearer ${e}`}:{}})}catch(t){console.error("Logout error:",t)}this.setToken(null),this.user=null,this.isAuthenticated=!1,this.notifyChange(),window.location.reload()},async updateDisplayName(e){if(!this.isAuthenticated)throw new Error("Not authenticated");let t=this.getToken(),a=await fetch(`${this.API_BASE}/auth/profile`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({displayName:e})}),n=await a.json();if(!a.ok)throw new Error(n.error||"Failed to update name");return this.user&&(this.user.displayName=n.displayName,this.notifyChange()),n.displayName},linkGoogle(){if(!this.isAuthenticated){console.error("Must be logged in to link accounts");return}window.location.href=`${this.API_BASE}/auth/google`},linkDiscord(){if(!this.isAuthenticated){console.error("Must be logged in to link accounts");return}window.location.href=`${this.API_BASE}/auth/discord`},getUserId(){return this.user?.id||null},getDisplayName(){return this.user?.displayName||"Summoner"},getAvatarUrl(){return this.user?.avatarUrl||null},notifyChange(){this.onAuthChange&&this.onAuthChange({isAuthenticated:this.isAuthenticated,isLoading:this.isLoading,user:this.user}),window.dispatchEvent(new CustomEvent("authChange",{detail:{isAuthenticated:this.isAuthenticated,isLoading:this.isLoading,user:this.user}}))},getStatsString(){if(!this.user)return"";let e=this.user.wins||0,t=this.user.losses||0,a=this.user.eloRating||1e3;return`${e}W - ${t}L | ELO: ${a}`}};window.Auth=Be;typeof re<"u"&&re.exports&&(re.exports=Be)});var Me=M(()=>{"use strict";var Ie={currentStep:null,async start(){console.log("[GameFlow] Starting..."),this.showLoadingScreen();let e=await Auth.init();console.log("[GameFlow] Auth result:",e),e?await this.onAuthenticated():window.isOfflineMode?await this.onOfflineMode():(this.hideLoadingScreen(),ie.show())},async onAuthenticated(){console.log("[GameFlow] User authenticated:",Auth.user?.displayName),this.hideLoadingScreen(),ie.hide(),this.checkIfNewUser()&&await this.showUsernameEntry(),typeof TutorialManager<"u"&&TutorialManager.isCompleted()||typeof PlayerData<"u"&&PlayerData.tutorialCompleted||localStorage.getItem("cryptid_tutorial_complete")||await this.showTutorial(),this.showWelcomeScreen()},async onOfflineMode(){console.log("[GameFlow] Offline mode"),this.hideLoadingScreen(),ie.hide(),typeof TutorialManager<"u"&&TutorialManager.isCompleted()||typeof PlayerData<"u"&&PlayerData.tutorialCompleted||localStorage.getItem("cryptid_tutorial_complete")||await this.showTutorial(),this.showWelcomeScreen()},checkIfNewUser(){let e=Auth.user?.displayName||"";return!localStorage.getItem("cryptid_name_set")},showLoadingScreen(){if(document.getElementById("loading-screen"))return;let e=document.createElement("div");e.id="loading-screen",e.innerHTML=`
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `,document.body.appendChild(e)},hideLoadingScreen(){let e=document.getElementById("loading-screen");e&&e.remove()},showUsernameEntry(){return new Promise(e=>{let t=document.createElement("div");t.id="username-entry-screen",t.innerHTML=`
                <div class="username-container">
                    <h2>Name Thyself</h2>
                    <p>How shall you be known, Summoner?</p>
                    
                    <div class="username-input-wrapper">
                        <input type="text" 
                               id="username-input" 
                               maxlength="24" 
                               placeholder="Enter your name..."
                               value="${Auth.user?.displayName||""}"
                        >
                        <span class="char-count"><span id="char-current">0</span>/24</span>
                    </div>
                    
                    <button id="username-confirm-btn" class="confirm-btn">
                        Confirm
                    </button>
                </div>
            `,document.body.appendChild(t);let a=document.getElementById("username-input"),n=document.getElementById("char-current"),r=document.getElementById("username-confirm-btn");n.textContent=a.value.length,a.addEventListener("input",()=>{n.textContent=a.value.length}),setTimeout(()=>a.focus(),100);let i=p(async()=>{let o=a.value.trim();if(o.length<2){a.classList.add("error"),setTimeout(()=>a.classList.remove("error"),500);return}r.disabled=!0,r.textContent="Saving...";try{Auth.isAuthenticated&&await Auth.updateDisplayName(o),localStorage.setItem("cryptid_name_set","true"),typeof PlayerData<"u"&&(PlayerData.playerName=o,PlayerData.save()),t.classList.add("fade-out"),setTimeout(()=>{t.remove(),e()},300)}catch(s){console.error("Failed to save name:",s),r.disabled=!1,r.textContent="Confirm"}},"confirm");r.addEventListener("click",i),a.addEventListener("keydown",o=>{o.key==="Enter"&&i()}),requestAnimationFrame(()=>t.classList.add("visible"))})},showTutorial(){return new Promise(e=>{TutorialManager.start();let t=setInterval(()=>{TutorialManager.isActive||(clearInterval(t),e())},500)})},showWelcomeScreen(){console.log("[GameFlow] Showing welcome screen"),typeof HomeScreen<"u"?HomeScreen.init():this.showMainMenu()},showMainMenu(){console.log("[GameFlow] Showing main menu"),typeof MainMenu<"u"&&(MainMenu.init(),MainMenu.show()),Le.update()}},ie={isVisible:!1,show(){if(this.isVisible)return;this.isVisible=!0;let e=document.createElement("div");e.id="login-screen",e.innerHTML=`
            <div class="login-container">
                <div class="login-logo">
                    <div class="logo-icon">
                        <img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" alt="">
                    </div>
                    <h1 class="login-title">CRYPTID FATES</h1>
                    <p class="login-subtitle">A Game of Dark Summons</p>
                </div>
                
                <div class="login-box">
                    <h2>Welcome, Summoner</h2>
                    <p class="login-prompt">Sign in to begin your journey</p>
                    
                    <div class="login-buttons">
                        <button class="login-btn google-btn" onclick="Auth.loginWithGoogle()">
                            <svg class="login-icon" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google
                        </button>
                        
                        <button class="login-btn discord-btn" onclick="Auth.loginWithDiscord()">
                            <svg class="login-icon" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            Discord
                        </button>
                    </div>
                </div>
                
                <div class="login-features">
                    <div class="feature">
                        <span class="feature-icon">\u2694\uFE0F</span>
                        <span>Battle other players online</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">\u{1F3C6}</span>
                        <span>Climb the ranked ladder</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">\u{1F4CA}</span>
                        <span>Track your wins and progress</span>
                    </div>
                </div>
                
                <button class="skip-login-btn" onclick="LoginScreen.playOffline()">
                    \u26A1 Play Offline vs AI
                </button>
                
                <button class="skip-login-btn dev-tutorial-btn" onclick="LoginScreen.startTutorial()">
                    \u{1F4D6} Dev: Start Tutorial
                </button>
            </div>
        `,document.body.appendChild(e),requestAnimationFrame(()=>{e.classList.add("visible")})},async startTutorial(){console.log("[LoginScreen] Starting tutorial bypass..."),this.hide(),["main-menu","home-screen","loading-screen","fullscreen-prompt"].forEach(e=>{let t=document.getElementById(e);t&&(t.style.display="none",t.classList.add("hidden"))}),typeof TutorialManager<"u"?await TutorialManager.start():console.error("[LoginScreen] TutorialManager not found")},hide(){let e=document.getElementById("login-screen");e&&(e.classList.remove("visible"),setTimeout(()=>{e.remove(),this.isVisible=!1},300))},playOffline(){window.isOfflineMode=!0,this.hide(),Ie.onOfflineMode()}},It=`
/* Loading Screen */
#loading-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}

#loading-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

.loading-content {
    text-align: center;
    color: #a09080;
    position: relative;
    z-index: 1;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid rgba(232, 169, 62, 0.2);
    border-top-color: #e8a93e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Login Screen */
#login-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.6s ease;
    padding: 24px;
}

#login-screen.visible {
    opacity: 1;
}

#login-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

.login-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    max-width: 400px;
    width: 100%;
    z-index: 1;
}

.login-logo {
    text-align: center;
}

.login-logo .logo-icon {
    font-size: clamp(60px, 18vw, 100px);
    margin-bottom: 16px;
    animation: menuFlameFlicker 3s infinite ease-in-out;
    filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
    display: block;
}

.login-logo .logo-icon img {
    width: clamp(80px, 22vw, 120px);
    height: auto;
}

@keyframes menuFlameFlicker {
    0%, 100% { 
        opacity: 1; 
        transform: scale(1) translateY(0); 
        filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
    }
    25% { 
        opacity: 0.9; 
        transform: scale(1.02) translateY(-2px); 
    }
    50% { 
        opacity: 0.85; 
        transform: scale(0.98) translateY(1px);
        filter: drop-shadow(0 0 40px rgba(196, 92, 38, 0.6));
    }
    75% { 
        opacity: 0.95; 
        transform: scale(1.01) translateY(-1px); 
    }
}

.login-title {
    font-family: 'Cinzel', serif;
    font-size: clamp(28px, 8vw, 48px);
    font-weight: 700;
    color: #d4c4a0;
    text-align: center;
    letter-spacing: 6px;
    text-shadow: 
        0 0 40px rgba(232, 169, 62, 0.4),
        0 4px 8px rgba(0, 0, 0, 0.8);
    margin: 0 0 8px;
}

.login-subtitle {
    font-family: 'Cinzel', serif;
    font-size: clamp(11px, 2.5vw, 14px);
    color: #a09080;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin: 0;
}

.login-box {
    width: 100%;
}

.login-box h2 {
    font-family: 'Cinzel', serif;
    margin: 0 0 8px;
    font-size: clamp(18px, 5vw, 24px);
    color: #d4c4a0;
    text-align: center;
    letter-spacing: 2px;
}

.login-prompt {
    margin: 0 0 24px;
    color: #706050;
    text-align: center;
    font-size: 14px;
    letter-spacing: 1px;
}

.login-buttons {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.login-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 24px;
    font-family: 'Cinzel', serif;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 700;
    border: 2px solid;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 2px;
    position: relative;
    overflow: hidden;
    width: 100%;
}

.login-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255,255,255,0.15), transparent);
    pointer-events: none;
}

.login-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
}

.google-btn {
    background: linear-gradient(180deg, 
        rgba(220, 220, 230, 0.95) 0%, 
        rgba(180, 180, 195, 0.9) 20%,
        rgba(140, 140, 155, 0.85) 50%,
        rgba(100, 100, 115, 0.9) 80%,
        rgba(70, 70, 85, 0.95) 100%);
    border-color: rgba(255, 255, 255, 0.4);
    color: #151518;
    box-shadow: 
        0 0 60px rgba(200, 200, 220, 0.25),
        0 0 30px rgba(255, 255, 255, 0.1),
        0 4px 20px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.6),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}

.google-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 
        0 0 100px rgba(200, 200, 220, 0.4),
        0 0 50px rgba(255, 255, 255, 0.2),
        0 8px 30px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.7),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}

.discord-btn {
    background: linear-gradient(180deg, 
        rgba(88, 101, 242, 0.95) 0%, 
        rgba(71, 82, 196, 0.9) 50%,
        rgba(57, 66, 157, 0.95) 100%);
    border-color: rgba(130, 145, 255, 0.4);
    color: #fff;
    box-shadow: 
        0 0 40px rgba(88, 101, 242, 0.2),
        0 4px 20px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.discord-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 
        0 0 60px rgba(88, 101, 242, 0.4),
        0 8px 30px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}

.login-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 8px 0;
    color: #504030;
    font-size: 12px;
    letter-spacing: 2px;
}

.login-divider::before,
.login-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(160, 144, 128, 0.3), transparent);
}

.login-features {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(160, 144, 128, 0.1);
}

.feature {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: #908070;
    letter-spacing: 0.5px;
}

.feature-icon {
    font-size: 18px;
    filter: grayscale(0.3);
}

.skip-login-btn {
    background: transparent;
    border: 1px solid rgba(160, 144, 128, 0.2);
    color: #605040;
    padding: 12px 24px;
    border-radius: 6px;
    font-family: 'Cinzel', serif;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.3s;
}

.skip-login-btn:hover {
    background: rgba(160, 144, 128, 0.05);
    color: #908070;
    border-color: rgba(160, 144, 128, 0.3);
}

.dev-tutorial-btn {
    margin-top: 10px;
    border-color: rgba(100, 180, 100, 0.3);
    color: #4a7a4a;
}

.dev-tutorial-btn:hover {
    background: rgba(100, 180, 100, 0.1);
    color: #6a9a6a;
    border-color: rgba(100, 180, 100, 0.5);
}

/* Username Entry Screen */
#username-entry-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.5s ease;
    padding: 24px;
}

#username-entry-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

#username-entry-screen.visible {
    opacity: 1;
}

#username-entry-screen.fade-out {
    opacity: 0;
}

.username-container {
    position: relative;
    text-align: center;
    max-width: 400px;
    width: 100%;
    z-index: 1;
}

.username-container h2 {
    font-family: 'Cinzel', serif;
    color: #d4c4a0;
    font-size: clamp(22px, 6vw, 32px);
    letter-spacing: 4px;
    margin: 0 0 12px;
    text-shadow: 0 0 30px rgba(232, 169, 62, 0.3);
}

.username-container p {
    color: #706050;
    margin: 0 0 32px;
    font-size: 14px;
    letter-spacing: 1px;
}

.username-input-wrapper {
    position: relative;
    margin-bottom: 24px;
}

#username-input {
    width: 100%;
    padding: 18px 70px 18px 24px;
    font-family: 'Cinzel', serif;
    font-size: 18px;
    letter-spacing: 2px;
    background: rgba(10, 13, 18, 0.8);
    border: 2px solid rgba(160, 144, 128, 0.3);
    border-radius: 8px;
    color: #d4c4a0;
    text-align: center;
    outline: none;
    transition: all 0.3s;
    box-sizing: border-box;
}

#username-input::placeholder {
    color: #504030;
}

#username-input:focus {
    border-color: rgba(232, 169, 62, 0.5);
    box-shadow: 0 0 30px rgba(232, 169, 62, 0.15);
}

#username-input.error {
    border-color: rgba(180, 80, 80, 0.6);
    animation: shake 0.3s ease;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

.char-count {
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    color: #504030;
    font-size: 12px;
    letter-spacing: 1px;
}

.confirm-btn {
    background: linear-gradient(180deg, 
        rgba(220, 220, 230, 0.95) 0%, 
        rgba(180, 180, 195, 0.9) 20%,
        rgba(140, 140, 155, 0.85) 50%,
        rgba(100, 100, 115, 0.9) 80%,
        rgba(70, 70, 85, 0.95) 100%);
    border: 2px solid rgba(255, 255, 255, 0.4);
    color: #151518;
    padding: 16px 48px;
    font-family: 'Cinzel', serif;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 
        0 0 60px rgba(200, 200, 220, 0.25),
        0 4px 20px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}

.confirm-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 
        0 0 100px rgba(200, 200, 220, 0.4),
        0 8px 30px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

/* Tutorial Screen */
#tutorial-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.5s ease;
    padding: 24px;
}

#tutorial-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

#tutorial-screen.visible {
    opacity: 1;
}

#tutorial-screen.fade-out {
    opacity: 0;
}

.tutorial-container {
    position: relative;
    text-align: center;
    max-width: 480px;
    width: 100%;
    z-index: 1;
}

.tutorial-container h2 {
    font-family: 'Cinzel', serif;
    color: #d4c4a0;
    font-size: clamp(22px, 6vw, 32px);
    letter-spacing: 4px;
    margin: 0 0 32px;
    text-shadow: 0 0 30px rgba(232, 169, 62, 0.3);
}

.tutorial-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
}

.tutorial-step {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(10, 13, 18, 0.6);
    padding: 16px 20px;
    border-radius: 8px;
    border: 1px solid rgba(160, 144, 128, 0.15);
    text-align: left;
}

.tutorial-step .step-icon {
    font-size: 28px;
    flex-shrink: 0;
    filter: drop-shadow(0 0 8px rgba(232, 169, 62, 0.3));
}

.tutorial-step p {
    color: #a09080;
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    letter-spacing: 0.5px;
}

.tutorial-step strong {
    color: #d4c4a0;
}

.skip-future {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 20px;
    color: #504030;
    font-size: 12px;
    cursor: pointer;
    letter-spacing: 1px;
}

.skip-future input {
    cursor: pointer;
    accent-color: #e8a93e;
}

/* User profile bar */
.user-profile-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    background: rgba(10, 13, 18, 0.9);
    border: 1px solid rgba(160, 144, 128, 0.2);
    border-radius: 25px;
    position: absolute;
    top: 15px;
    right: 15px;
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid rgba(232, 169, 62, 0.5);
    object-fit: cover;
}

.user-avatar.placeholder {
    background: linear-gradient(135deg, rgba(232, 169, 62, 0.3), rgba(180, 100, 50, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-size: 14px;
    color: #d4c4a0;
    font-weight: bold;
}

.user-name {
    font-family: 'Cinzel', serif;
    font-size: 14px;
    font-weight: 600;
    color: #d4c4a0;
    letter-spacing: 1px;
}

.user-stats {
    font-size: 11px;
    color: #706050;
    letter-spacing: 0.5px;
}

.user-menu-btn {
    background: none;
    border: none;
    color: #706050;
    cursor: pointer;
    padding: 4px 8px;
    font-size: 16px;
    transition: color 0.3s;
}

.user-menu-btn:hover {
    color: #e8a93e;
}

/* Mobile adjustments */
@media (max-width: 480px) {
    .login-container,
    .username-container,
    .tutorial-container {
        gap: 24px;
    }
    
    .login-features {
        padding: 16px;
    }
    
    .tutorial-step {
        padding: 12px 16px;
    }
    
    .tutorial-step .step-icon {
        font-size: 24px;
    }
    
    .user-profile-bar {
        top: 10px;
        right: 10px;
        padding: 8px 14px;
    }
    
    .user-avatar {
        width: 30px;
        height: 30px;
    }
    
    .user-name {
        font-size: 12px;
    }
}
`,ze=document.createElement("style");ze.textContent=It;document.head.appendChild(ze);var Le={element:null,create(){if(this.element)return;let e=Auth.user;if(!(!e&&!window.isOfflineMode)){if(this.element=document.createElement("div"),this.element.className="user-profile-bar",e)this.element.innerHTML=`
                ${e.avatarUrl?`<img src="${e.avatarUrl}" class="user-avatar" alt="Avatar">`:`<div class="user-avatar placeholder">${e.displayName.charAt(0).toUpperCase()}</div>`}
                <div>
                    <div class="user-name">${e.displayName}</div>
                    <div class="user-stats">${Auth.getStatsString()}</div>
                </div>
                <button class="user-menu-btn" onclick="UserProfileBar.showMenu()" title="Account">\u2699\uFE0F</button>
            `;else{let t=typeof PlayerData<"u"&&PlayerData.playerName||"Summoner";this.element.innerHTML=`
                <div class="user-avatar placeholder">${t.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="user-name">${t}</div>
                    <div class="user-stats">Offline Mode</div>
                </div>
            `}document.body.appendChild(this.element)}},remove(){this.element&&(this.element.remove(),this.element=null)},update(){this.remove(),this.create()},showMenu(){switch(prompt(`Account Menu

1. Change Display Name
2. ${Auth.user?.hasGoogle?"\u2713 Google Linked":"Link Google Account"}
3. ${Auth.user?.hasDiscord?"\u2713 Discord Linked":"Link Discord Account"}
4. Logout

Enter option number:`)){case"1":let t=prompt("Enter new display name (2-24 characters):",Auth.user?.displayName);t&&t!==Auth.user?.displayName&&Auth.updateDisplayName(t).then(()=>{this.update(),typeof showMessage=="function"&&showMessage("Name updated!",1500)}).catch(a=>alert(a.message));break;case"2":Auth.user?.hasGoogle||Auth.linkGoogle();break;case"3":Auth.user?.hasDiscord||Auth.linkDiscord();break;case"4":confirm("Are you sure you want to logout?")&&Auth.logout();break}}};window.GameFlow=Ie;window.LoginScreen=ie;window.UserProfileBar=Le});var He=M(()=>{"use strict";window.CardRegistry=window.CardRegistry||{cryptids:{},bursts:{},kindling:{},traps:{},auras:{},pyres:{},registerCryptid(e,t){this.cryptids[e]={...t,key:e,type:"cryptid"}},registerBurst(e,t){this.bursts[e]={...t,key:e,type:"burst"}},registerInstant(e,t){this.registerBurst(e,t)},registerKindling(e,t){this.kindling[e]={...t,key:e,type:"cryptid",isKindling:!0}},registerTrap(e,t){this.traps[e]={...t,key:e,type:"trap"}},registerAura(e,t){this.auras[e]={...t,key:e,type:"aura"}},registerPyre(e,t){this.pyres[e]={...t,key:e,type:"pyre",cost:0}},getCryptid(e){return this.cryptids[e]?{...this.cryptids[e]}:null},getBurst(e){return this.bursts[e]?{...this.bursts[e]}:null},getInstant(e){return this.getBurst(e)},getKindling(e){return this.kindling[e]?{...this.kindling[e]}:null},getTrap(e){return this.traps[e]?{...this.traps[e]}:null},getAura(e){return this.auras[e]?{...this.auras[e]}:null},getPyre(e){return this.pyres[e]?{...this.pyres[e]}:null},getAllCryptidKeys(){return Object.keys(this.cryptids)},getAllBurstKeys(){return Object.keys(this.bursts)},getAllInstantKeys(){return this.getAllBurstKeys()},getAllKindlingKeys(){return Object.keys(this.kindling)},getAllTrapKeys(){return Object.keys(this.traps)},getAllAuraKeys(){return Object.keys(this.auras)},getAllPyreKeys(){return Object.keys(this.pyres)}};CardRegistry.registerKindling("myling",{name:"Myling",sprite:"https://f.playcode.io/p-2633929/v-1/019b3c82-70d5-75fb-90eb-17ab504ae4b4/myling.png",spriteScale:1,element:"blood",cost:1,hp:2,atk:2,rarity:"uncommon",combatAbility:"Paralyze enemy cryptid upon damage",supportAbility:"Cleanse combatant ailments on summon, +1/+1 per ailment cleansed",onCombatAttack:p((e,t,a)=>(a.applyParalyze(t),0),"onCombatAttack"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=0;n.paralyzed&&(n.paralyzed=!1,n.paralyzeTurns=0,r++),n.burnTurns>0&&(n.burnTurns=0,r++),n.bleedStacks>0&&(n.bleedStacks=0,r++),n.calamityCounters>0&&(n.calamityCounters=0,r++),r>0&&(e.currentAtk=(e.currentAtk||e.atk)+r,e.currentHp=(e.currentHp||e.hp)+r,e.maxHp=(e.maxHp||e.hp)+r,GameEvents.emit("onCleanse",{cryptid:n,cleansedBy:e,ailmentsCleared:r,owner:t}))}},"onSupport")});CardRegistry.registerKindling("shadowPerson",{name:"Shadow Person",sprite:"https://f.playcode.io/p-2633929/v-1/019b3c82-70d4-752c-8536-d27121bee17f/shadow-person.png",spriteScale:1,element:"void",cost:1,hp:3,atk:0,rarity:"common",evolvesInto:"bogeyman",combatAbility:"Enemies who damage Shadow Person become paralyzed. +2 damage vs paralyzed",supportAbility:"Combatant doesn't tap after attacking. +1 damage to paralyzed",bonusVsParalyzed:2,onBeforeDefend:p((e,t,a)=>{a.applyParalyze(t)},"onBeforeDefend"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);console.log("[Shadow Person] onSupport called, cryptid:",e.name,"row:",e.row,"combatant:",n?.name),n&&(n.noTapOnAttack=!0,n.bonusVsParalyzed=(n.bonusVsParalyzed||0)+1,console.log("[Shadow Person] Set noTapOnAttack=true on",n.name))},"onSupport")});CardRegistry.registerKindling("hellhoundPup",{name:"Hellhound Pup",sprite:"https://f.playcode.io/p-2633929/v-1/019b3c8a-ca9a-754c-948c-d92e7702a51e/hellhound_pup.png",spriteScale:1,element:"blood",cost:1,hp:1,atk:1,rarity:"common",evolvesInto:"hellhound",combatAbility:"Protect from 1 attack/turn, burn attacker",supportAbility:"Regen combatant 2HP/turn if enemy has ailment",otherAbility:"If dies from burn, evolve into Hellhound",onCombat:p((e,t,a)=>{e.protectedFromAttack=!0},"onCombat"),onTurnStart:p((e,t,a)=>{let n=a.getCombatCol(t);e.col===n&&(e.protectedFromAttack=!0)},"onTurnStart"),onBeforeDefend:p((e,t,a)=>{e.protectedFromAttack&&(e.protectedFromAttack=!1,a.applyBurn(t),e.negateIncomingAttack=!0,GameEvents.emit("onProtectionUsed",{cryptid:e,attacker:t,owner:e.owner}))},"onBeforeDefend"),onSupport:p((e,t,a)=>{e.hasHellhoundPupSupport=!0},"onSupport"),onTurnStartSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(!n)return;if(a.getCryptidsAcross(e).some(o=>a.hasStatusAilment(o))){let o=n.maxHp||n.hp;n.currentHp=Math.min(o,n.currentHp+2),GameEvents.emit("onHeal",{cryptid:n,amount:2,source:"Hellhound Pup",owner:t})}},"onTurnStartSupport"),onDeath:p((e,t)=>{if(e.killedBy==="burn"||e.burnTurns>0){let a=e.owner,n=t.findCardInHand(a,"hellhound"),r=t.findCardInDeck(a,"hellhound");if(n||r){e.preventDeath=!0;let i=n||r;t.evolveInPlace(e,i,a),n?t.removeFromHand(a,n):t.removeFromDeck(a,r),GameEvents.emit("onBurnEvolution",{cryptid:e,evolvedInto:"hellhound",owner:a})}}},"onDeath")});CardRegistry.registerKindling("elDuende",{name:"El Duende",sprite:"\u{1F9DD}",spriteScale:1,element:"nature",cost:2,hp:1,atk:2,rarity:"common",combatAbility:"Remove 1 aura or protection from target before attack",supportAbility:"Trap cards cost -1 pyre for you, +1 for opponent",onBeforeAttack:p((e,t,a)=>{if(t.protection>0){t.protection--,GameEvents.emit("onProtectionRemoved",{target:t,removedBy:e,owner:e.owner});return}if(t.auras&&t.auras.length>0){let n=Math.floor(Math.random()*t.auras.length),r=t.auras.splice(n,1)[0];GameEvents.emit("onAuraRemoved",{target:t,aura:r,removedBy:e,owner:e.owner})}},"onBeforeAttack"),onSupport:p((e,t,a)=>{t==="player"?(a.playerTrapCostReduction=(a.playerTrapCostReduction||0)+1,a.enemyTrapCostIncrease=(a.enemyTrapCostIncrease||0)+1):(a.enemyTrapCostReduction=(a.enemyTrapCostReduction||0)+1,a.playerTrapCostIncrease=(a.playerTrapCostIncrease||0)+1),e.hasElDuendeSupport=!0},"onSupport"),onDeath:p((e,t)=>{e.hasElDuendeSupport&&(e.owner==="player"?(t.playerTrapCostReduction=Math.max(0,(t.playerTrapCostReduction||0)-1),t.enemyTrapCostIncrease=Math.max(0,(t.enemyTrapCostIncrease||0)-1)):(t.enemyTrapCostReduction=Math.max(0,(t.enemyTrapCostReduction||0)-1),t.playerTrapCostIncrease=Math.max(0,(t.playerTrapCostIncrease||0)-1)))},"onDeath")});CardRegistry.registerKindling("boggart",{name:"Boggart",sprite:"https://f.playcode.io/p-2633929/v-1/019b3c82-70d6-7466-97c0-72c148e812e2/boggart.png",spriteScale:1,element:"nature",cost:3,hp:2,atk:1,rarity:"common",combatAbility:"When damaging ailmented enemy, copy ailment to adjacent enemy",supportAbility:"Traps on same side of field can't be destroyed/negated",onCombatAttack:p((e,t,a)=>{if(!a.hasStatusAilment(t))return 0;let r=[],{owner:i,row:o,col:s}=t,l=a.getSupportCol(i);if(o>0){let m=a.getFieldCryptid(i,s,o-1);m&&r.push(m)}if(o<2){let m=a.getFieldCryptid(i,s,o+1);m&&r.push(m)}let c=a.getFieldCryptid(i,l,o);if(c&&c!==t&&r.push(c),r.length>0){let m=r[Math.floor(Math.random()*r.length)];t.paralyzed&&a.applyParalyze(m),t.burnTurns>0&&a.applyBurn(m),t.bleedStacks>0&&a.applyBleed(m),t.calamityCounters>0&&a.applyCalamity(m,t.calamityCounters),GameEvents.emit("onAilmentSpread",{source:e,from:t,to:m,owner:e.owner})}return 0},"onCombatAttack"),onSupport:p((e,t,a)=>{if(e.row===1)return;e.protectsTraps=!0,e.protectedTrapSide=e.row===0?"top":"bottom";let n=t==="player"?a.playerTraps:a.enemyTraps;e.row===0&&n[0]?n[0].protected=!0:e.row===2&&n[2]&&(n[2].protected=!0)},"onSupport"),onDeath:p((e,t)=>{if(e.protectsTraps){let n=e.owner==="player"?t.playerTraps:t.enemyTraps;e.row===0&&n[0]?n[0].protected=!1:e.row===2&&n[2]&&(n[2].protected=!1)}},"onDeath")});CardRegistry.registerCryptid("rooftopGargoyle",{name:"Rooftop Gargoyle",sprite:"https://f.playcode.io/p-2633929/v-1/019b3c82-70d4-73ef-8929-822739914541/rooftop-gargoyle.png",spriteScale:1.4,element:"steel",cost:1,hp:3,atk:1,rarity:"common",evolvesInto:"libraryGargoyle",combatAbility:"Stone Skin: Ailment-afflicted attackers deal -2 damage. Removes 1 calamity from target before attacking.",supportAbility:"Vengeance: If combatant dies by enemy attack, give attacker 3 calamity",onDefend:p((e,t,a)=>a.hasStatusAilment(t)?2:0,"onDefend"),onBeforeAttack:p((e,t,a)=>{t.calamityCounters>0&&(t.calamityCounters-=1,t.calamityCounters<=0&&(t.calamityCounters=0,t.hadCalamity=!1))},"onBeforeAttack"),onSummon:p((e,t,a)=>{e._vengeanceListener=n=>{let r=a.getCombatant(e);if(n.cryptid===r&&n.killerOwner&&n.killerOwner!==t){let i=n.killerOwner,o=i==="player"?a.playerField:a.enemyField,s=a.getCombatCol(i),l=o[s][n.row];l&&a.applyCalamity(l,3)}},GameEvents.on("onDeath",e._vengeanceListener)},"onSummon"),onDeath:p((e,t)=>{if(e._vengeanceListener){let a=GameEvents.listeners.onDeath?.indexOf(e._vengeanceListener);a>-1&&GameEvents.listeners.onDeath.splice(a,1)}},"onDeath")});CardRegistry.registerCryptid("libraryGargoyle",{name:"Library Gargoyle",sprite:"https://f.playcode.io/p-2633929/v-1/019b3d25-b581-7759-9bb3-53f15ec1cb37/library-gargoylealt2.png",spriteScale:1,element:"steel",cost:3,hp:4,atk:2,rarity:"common",evolvesFrom:"rooftopGargoyle",combatAbility:"When damaging calamity target: remove 1 counter, gain +1/+2",supportAbility:"If combatant diagonal from ailmented enemy: +2/+2",onCombatAttack:p((e,t,a)=>(t.calamityCounters>0&&(t.calamityCounters--,t.calamityCounters<=0&&(t.calamityCounters=0,t.hadCalamity=!1),e.currentAtk=(e.currentAtk||e.atk)+1,e.baseAtk=(e.baseAtk||e.atk)+1,e.currentHp=(e.currentHp||e.hp)+2,e.maxHp=(e.maxHp||e.hp)+2,GameEvents.emit("onCalamityConsume",{attacker:e,target:t,owner:e.owner})),0),"onCombatAttack"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(!n)return;a.getDiagonalEnemies(n).some(o=>a.hasStatusAilment(o))&&(n.currentAtk=(n.currentAtk||n.atk)+2,n.currentHp=(n.currentHp||n.hp)+2,n.maxHp=(n.maxHp||n.hp)+2,n.libraryGargoyleBuff=!0,GameEvents.emit("onLibraryGargoyleBuff",{support:e,combatant:n,owner:t}))},"onSupport")});CardRegistry.registerCryptid("sewerAlligator",{name:"Sewer Alligator",sprite:"\u{1F40A}",spriteScale:1,element:"water",cost:3,hp:4,atk:2,rarity:"uncommon",combatAbility:"+2 damage to burned/toxic enemies. On bonus damage: regen 4HP, +1 ATK permanent",supportAbility:"Combatant regen 2HP on rest. On combatant death, enemy slot becomes toxic",onCombatAttack:p((e,t,a)=>{let n=t.burnTurns>0,r=a.isInToxicTile(t);if(n||r){let i=e.maxHp||e.hp;return e.currentHp=Math.min(i,e.currentHp+4),e.currentAtk=(e.currentAtk||e.atk)+1,e.baseAtk=(e.baseAtk||e.atk)+1,GameEvents.emit("onSewerAlligatorBonus",{attacker:e,target:t,owner:e.owner}),2}return 0},"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasSewerAlligatorSupport=!0},"onSupport"),onCombatantRest:p((e,t,a)=>{if(!e.hasSewerAlligatorSupport)return;let n=t.maxHp||t.hp;t.currentHp=Math.min(n,t.currentHp+2),GameEvents.emit("onHeal",{cryptid:t,amount:2,source:"Sewer Alligator",owner:e.owner})},"onCombatantRest"),onCombatantDeath:p((e,t,a)=>{if(!e.hasSewerAlligatorSupport)return;let r=e.owner==="player"?"enemy":"player",i=a.getCombatCol(r);a.applyToxicToTile(r,i,e.row,3),GameEvents.emit("onToxicApplied",{owner:r,col:i,row:e.row,source:"Sewer Alligator"})},"onCombatantDeath")});CardRegistry.registerCryptid("kuchisakeOnna",{name:"Kuchisake-Onna",sprite:"\u{1F469}",spriteScale:1,element:"blood",cost:4,hp:4,atk:4,rarity:"rare",mythical:!0,combatAbility:"Slit: Causes bleed. Extra attack if target has ailment",supportAbility:"Sacrifice: May kill combatant to become 7/7 with Destroyer",attacksApplyBleed:!0,onCombatAttack:p((e,t,a)=>(!e.attackedThisTurn&&a.hasStatusAilment(t)&&(e.canAttackAgain=!0),0),"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasSacrificeAbility=!0,e.sacrificeAbilityAvailable=!0},"onSupport"),activateSacrifice:p((e,t)=>{let a=t.getCombatant(e);if(!a||!e.sacrificeAbilityAvailable)return!1;let n=e.owner,r=e.row;a.killedBy="sacrifice",a.killedBySource=e,t.killCryptid(a,e.owner),t.promoteSupport(n,r)&&typeof window.animateSupportPromotion=="function"&&window.animateSupportPromotion(n,r);let o=7-e.currentAtk,s=7-e.currentHp;return e.currentAtk=7,e.baseAtk=7,e.currentHp=7,e.maxHp=7,e.hasDestroyer=!0,e.sacrificeAbilityAvailable=!1,e.sacrificeActivated=!0,GameEvents.emit("onSacrificeActivated",{cryptid:e,victim:a,owner:e.owner,atkGain:o,hpGain:s}),!0},"activateSacrifice")});CardRegistry.registerCryptid("hellhound",{name:"Hellhound",sprite:"https://f.playcode.io/p-2633929/v-1/019b56ab-36a2-73fd-91b6-e5445175ecdc/hellhound.png",spriteScale:1,element:"blood",cost:4,hp:5,atk:1,rarity:"common",evolvesFrom:"hellhoundPup",combatAbility:"Inferno: Burns target before damage. If already burned, burn adjacent enemy",supportAbility:"Scorch: Combatant burns enemies across if they have no ailments",onBeforeAttack:p((e,t,a)=>{let n=t.burnTurns>0;if(a.applyBurn(t),n){let r=[],{owner:i,row:o,col:s}=t,l=a.getSupportCol(i);if(o>0){let m=a.getFieldCryptid(i,s,o-1);m&&r.push(m)}if(o<2){let m=a.getFieldCryptid(i,s,o+1);m&&r.push(m)}let c=a.getFieldCryptid(i,l,o);if(c&&c!==t&&r.push(c),r.length>0){let m=r[Math.floor(Math.random()*r.length)];a.applyBurn(m)}}},"onBeforeAttack"),onCombatantBeforeAttack:p((e,t,a,n)=>{let r=n.getCryptidsAcross(e);if(!r.some(o=>n.hasStatusAilment(o)))for(let o of r)n.applyBurn(o)},"onCombatantBeforeAttack")});CardRegistry.registerCryptid("mothman",{name:"Mothman",sprite:"https://f.playcode.io/p-2633929/v-1/019b56ab-247a-71ca-a81b-4d246f30d69d/mothman.png",spriteScale:1.9,element:"steel",cost:5,hp:9,atk:3,rarity:"ultimate",mythical:!0,combatAbility:"Flight: Can attack any cryptid. On enter, 3 calamity to all enemy combatants",supportAbility:"Omen: Combatant attacks grant 3 calamity before damage",otherAbility:"Harbinger: +1 ATK whenever any cryptid dies by calamity",canTargetAny:!0,onEnterCombat:p((e,t,a)=>{let n=t==="player"?"enemy":"player",r=n==="player"?a.playerField:a.enemyField,i=a.getCombatCol(n);for(let o=0;o<3;o++){let s=r[i][o];s&&a.applyCalamity(s,3)}},"onEnterCombat"),onSummon:p((e,t,a)=>{e._calamityDeathListener=n=>{n.cryptid?.killedBy==="calamity"&&(e.currentAtk+=1,e.baseAtk+=1,GameEvents.emit("onBuffApplied",{cryptid:e,owner:e.owner,atkBonus:1,source:"Mothman Harbinger"}))},GameEvents.on("onDeath",e._calamityDeathListener)},"onSummon"),onCombatantBeforeAttack:p((e,t,a,n)=>{n.applyCalamity(a,3)},"onCombatantBeforeAttack"),onDeath:p((e,t)=>{if(e._calamityDeathListener){let a=GameEvents.listeners.onDeath?.indexOf(e._calamityDeathListener);a>-1&&GameEvents.listeners.onDeath.splice(a,1)}},"onDeath")});CardRegistry.registerCryptid("bogeyman",{name:"Bogeyman",sprite:"\u{1F464}",spriteScale:1,element:"void",cost:2,hp:3,atk:1,rarity:"common",evolvesFrom:"shadowPerson",evolvesInto:"theFlayer",combatAbility:"Terror: Paralyze enemies across on entering combat. +3 vs paralyzed",supportAbility:"Nightmare: Negate enemy support abilities across",bonusVsParalyzed:3,onEnterCombat:p((e,t,a)=>{let n=a.getCryptidsAcross(e);for(let r of n)a.applyParalyze(r)},"onEnterCombat"),negatesEnemySupport:!0});CardRegistry.registerCryptid("theFlayer",{name:"The Flayer",sprite:"\u{1F441}\uFE0F",spriteScale:1.4,element:"void",cost:5,hp:6,atk:4,rarity:"rare",mythical:!0,evolvesFrom:"bogeyman",combatAbility:"Mind Rend: Paralyze all enemy combatants on enter. Gain pyre + draw on paralyzed kill",supportAbility:"Psionic: Combatant gains focus, attacks cause paralysis",onEnterCombat:p((e,t,a)=>{let n=t==="player"?"enemy":"player",r=n==="player"?a.playerField:a.enemyField,i=a.getCombatCol(n);for(let o=0;o<3;o++){let s=r[i][o];s&&a.applyParalyze(s)}},"onEnterCombat"),onCombatAttack:p((e,t,a)=>{if(t.paralyzed){let n=a.calculateAttackDamage(e);t.currentHp<=n&&(e.rewardOnKill=!0)}return 0},"onCombatAttack"),onSummon:p((e,t,a)=>{e._killListener=r=>{r.cryptid?.killedBySource===e&&e.rewardOnKill&&(t==="player"?a.playerPyre++:a.enemyPyre++,a.drawCard(t,"flayerKill"),e.rewardOnKill=!1,GameEvents.emit("onPyreGained",{owner:t,amount:1,source:"The Flayer"}))},GameEvents.on("onDeath",e._killListener);let n=a.getSupportCol(t);if(e.col===n){let r=a.getCombatant(e);r&&(r.hasFocus=!0,r.attacksApplyParalyze=!0)}},"onSummon"),onDeath:p((e,t)=>{if(e._killListener){let n=GameEvents.listeners.onDeath?.indexOf(e._killListener);n>-1&&GameEvents.listeners.onDeath.splice(n,1)}let a=t.getCombatant(e);a&&(a.hasFocus=!1,a.attacksApplyParalyze=!1)},"onDeath"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&(n.hasFocus=!0,n.attacksApplyParalyze=!0)},"onSupport"),grantsFocus:!0});CardRegistry.registerCryptid("mutatedRat",{name:"Mutated Rat",sprite:"\u{1F400}",spriteScale:1,element:"steel",cost:4,hp:6,atk:2,rarity:"uncommon",combatAbility:"Plague: On attack, apply 3 calamity. When attacked, attacker gets 3 calamity",supportAbility:"Infestation: When combatant or this card is attacked, attacker gets 3 calamity",onCombatAttack:p((e,t,a)=>(a.applyCalamity(t,3),0),"onCombatAttack"),onTakeDamage:p((e,t,a,n)=>{t&&n.applyCalamity(t,3)},"onTakeDamage"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&(n.mutatedRatSupport=e),e.onTakeDamage=(r,i,o,s)=>{i&&s.applyCalamity(i,3)}},"onSupport")});CardRegistry.registerCryptid("vampireInitiate",{name:"Vampire Initiate",sprite:"https://f.playcode.io/p-2633929/v-1/019b56ab-b586-702d-96b4-fa0a1318f444/vampire-initiate.png",spriteScale:1.45,element:"blood",cost:1,hp:3,atk:1,rarity:"common",evolvesInto:"elderVampire",combatAbility:"Siphon: On attack, regen 1HP and gain 1 pyre",supportAbility:"Blood Pact: Once per turn, deal 1 damage to combatant to gain 1 pyre",onCombatAttack:p((e,t,a)=>(e.currentHp=Math.min(e.maxHp,e.currentHp+1),e.owner==="player"?a.playerPyre++:a.enemyPyre++,GameEvents.emit("onPyreGained",{owner:e.owner,amount:1,source:"Vampire Initiate Siphon"}),0),"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasBloodPactAbility=!0,e.bloodPactAvailable=!0},"onSupport"),activateBloodPact:p((e,t)=>{let a=t.getCombatant(e);if(!a||!e.bloodPactAvailable)return!1;let n=e.owner,r=e.row,i=t.getCombatCol(n);if(e.bloodPactAvailable=!1,a.currentHp-=1,n==="player"?t.playerPyre++:t.enemyPyre++,GameEvents.emit("onBloodPactActivated",{cryptid:e,victim:a,owner:n}),t.getEffectiveHp(a)<=0){let s=document.querySelector(`.cryptid-sprite[data-owner="${n}"][data-col="${i}"][data-row="${r}"]`);s&&s.classList.add("dying-left");let l=window.TIMING||{deathAnim:400,promoteAnim:600};return setTimeout(()=>{a.killedBy="bloodPact",a.killedBySource=e,t.killCryptid(a,n),t.promoteSupport(n,r)&&typeof window.animateSupportPromotion=="function"&&window.animateSupportPromotion(n,r)},l.deathAnim),"killed"}return!0},"activateBloodPact")});CardRegistry.registerCryptid("elderVampire",{name:"Elder Vampire",sprite:"https://f.playcode.io/p-2633929/v-1/019b3d39-5e70-731e-9b2e-5393265788c9/vampire-lord.png",spriteScale:1.9,element:"blood",cost:4,hp:4,atk:2,rarity:"rare",evolvesFrom:"vampireInitiate",combatAbility:"Dominate: On enter, force all enemy combatants to tap. -1 ATK to tapped targets (min 1)",supportAbility:"Blood Frenzy: Combatant deals double damage to resting cryptids",otherAbility:"Undying: At turn start, regenerate 4HP and gain 1 pyre",onEnterCombat:p((e,t,a)=>{let n=t==="player"?"enemy":"player",r=n==="player"?a.playerField:a.enemyField,i=a.getCombatCol(n);for(let o=0;o<3;o++){let s=r[i][o];s&&(s.tapped=!0,s.canAttack=!1,GameEvents.emit("onForceRest",{cryptid:s,owner:n}))}},"onEnterCombat"),onCombatAttack:p((e,t,a)=>(t.tapped&&t.currentAtk>1&&(t.currentAtk-=1,t.baseAtk=Math.max(1,t.baseAtk-1)),0),"onCombatAttack"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&(n.doubleDamageVsTapped=!0)},"onSupport"),onTurnStart:p((e,t,a)=>{let n=e.maxHp||e.hp;e.currentHp=Math.min(n,e.currentHp+4),t==="player"?a.playerPyre++:a.enemyPyre++,GameEvents.emit("onPyreGained",{owner:t,amount:1,source:"Elder Vampire Undying"})},"onTurnStart")});CardRegistry.registerTrap("crossroads",{name:"Crossroads",sprite:"\u271D\uFE0F",cost:3,rarity:"common",description:"Stop lethal attack, rest attacker, draw 2 cards (+1 if evolution)",triggerDescription:"Triggers: When enemy attack would kill your cryptid",triggerEvent:"onAttackDeclared",triggerCondition:p((e,t,a,n)=>{if(a.attackerOwner===t)return!1;let r=a.target;if(!r||r.owner!==t)return!1;let i=n.calculateAttackDamage(a.attacker);return n.getEffectiveHp(r)<=i},"triggerCondition"),effect:p((e,t,a,n)=>{let r=n.attacker;r.tapped=!0,r.canAttack=!1,GameEvents.emit("onForceRest",{cryptid:r,owner:r.owner}),n.cancelled=!0,e.drawCard(t,"crossroads"),e.drawCard(t,"crossroads"),(t==="player"?e.playerHand:e.enemyHand).slice(-2).some(l=>l&&(l.evolvesFrom||l.evolvesInto))&&e.drawCard(t,"crossroads bonus")},"effect")});CardRegistry.registerTrap("bloodCovenant",{name:"Blood Covenant",sprite:"\u{1FA78}",cost:2,rarity:"rare",description:"Kill the attacker that killed your cryptid",triggerDescription:"Triggers: When your cryptid dies from enemy attack",triggerEvent:"onDeath",triggerCondition:p((e,t,a,n)=>a.owner!==t||!a.cryptid?.killedBySource?!1:a.cryptid.killedBySource.owner!==t,"triggerCondition"),effect:p((e,t,a,n)=>{let r=n.cryptid.killedBySource;r&&r.currentHp>0&&(r.killedBy="bloodCovenant",e.killCryptid(r,t))},"effect")});CardRegistry.registerTrap("turnToStone",{name:"Turn to Stone",sprite:"\u{1FAA8}",cost:1,rarity:"common",description:"Stop attack, rest and paralyze attacker",triggerDescription:"Triggers: When your cryptid is targeted for attack",triggerEvent:"onAttackDeclared",triggerCondition:p((e,t,a,n)=>a.attackerOwner!==t&&a.target?.owner===t,"triggerCondition"),effect:p((e,t,a,n)=>{let r=n.attacker;r.tapped=!0,r.canAttack=!1,GameEvents.emit("onForceRest",{cryptid:r,owner:r.owner}),e.applyParalyze(r),n.cancelled=!0},"effect")});CardRegistry.registerBurst("wakingNightmare",{name:"Waking Nightmare",sprite:"\u{1F631}",cost:1,rarity:"common",description:"Untap ally OR tap enemy",targetType:"any",effect:p((e,t,a)=>{a.owner===t?(a.tapped=!1,a.canAttack=!0,GameEvents.emit("onUntap",{cryptid:a,owner:a.owner,reason:"wakingNightmare"})):(a.tapped=!0,a.canAttack=!1,GameEvents.emit("onForceRest",{cryptid:a,owner:a.owner}))},"effect")});CardRegistry.registerBurst("faceOff",{name:"Face-Off",sprite:"\u2694\uFE0F",cost:1,rarity:"common",description:"Force target cryptid to attack the enemy combatant across from it",targetType:"any",requiresEnemyAcross:!0,effect:p((e,t,a)=>{let r=a.owner==="player"?"enemy":"player",i=e.getCombatCol(r),s=(r==="player"?e.playerField:e.enemyField)[i][a.row];s&&(a.tapped=!1,a.canAttack=!0,typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"attack",source:a,target:s,message:`\u2694\uFE0F ${a.name} faces off against ${s.name}!`}),e.attack(a,r,i,a.row))},"effect")});CardRegistry.registerAura("antiVampiricBlade",{name:"Anti-Vampiric Blade",sprite:"\u{1F5E1}\uFE0F",cost:3,rarity:"common",description:"+2 ATK, regen 2HP/turn, focus. +2 ATK if enemy diagonal/across has ailment",atkBonus:2,hpBonus:0,grantsFocus:!0,grantsRegeneration:2,onApply:p((e,t,a)=>{t.hasFocus=!0,t.regeneration=(t.regeneration||0)+2;let r=t.owner==="player"?"enemy":"player",i=a.getDiagonalEnemies(t),o=a.getCryptidsAcross(t);[...i,...o].some(c=>a.hasStatusAilment(c))&&(t.currentAtk+=2,e.bonusAtkApplied=2)},"onApply")});CardRegistry.registerPyre("pyre",{name:"Basic",sprite:"\u{1F525}",rarity:"common",description:"Gain 1 pyre",pyreGain:1,infinite:!0,effect:p((e,t)=>(t==="player"?e.playerPyre++:e.enemyPyre++,GameEvents.emit("onPyreGained",{owner:t,amount:1,source:"Pyre card"}),{pyreGained:1}),"effect")});CardRegistry.registerPyre("freshKill",{name:"Fresh Kill",sprite:"\u{1F987}",rarity:"uncommon",description:"+1 pyre, +1 per Vampire on field (max +3 extra)",pyreGain:1,effect:p((e,t)=>{let a=t==="player"?e.playerField:e.enemyField,n=0;for(let o=0;o<2;o++)for(let s=0;s<3;s++){let l=a[o][s];l&&l.name&&l.name.toLowerCase().includes("vampire")&&n++}let i=1+Math.min(n,3);return t==="player"?e.playerPyre+=i:e.enemyPyre+=i,GameEvents.emit("onPyreGained",{owner:t,amount:i,source:"Fresh Kill",vampireCount:n}),{pyreGained:i,vampireCount:n}},"effect")});CardRegistry.registerPyre("ratKing",{name:"Rat King",sprite:"\u{1F451}",rarity:"ultimate",description:"+1 pyre and draw 1 for each ally death last enemy turn (max 3)",pyreGain:1,effect:p((e,t)=>{let a=Math.min(e.deathsLastEnemyTurn?.[t]||0,3),n=1+a;t==="player"?e.playerPyre+=n:e.enemyPyre+=n;for(let r=0;r<a;r++)e.drawCard(t,"ratKing");return GameEvents.emit("onPyreGained",{owner:t,amount:n,source:"Rat King",deathCount:a}),{pyreGained:n,deathCount:a}},"effect")});CardRegistry.registerPyre("nightfall",{name:"Nightfall",sprite:"\u{1F319}",rarity:"uncommon",description:"+1 pyre, +1 per Gargoyle on field (max +3 extra)",pyreGain:1,effect:p((e,t)=>{let a=t==="player"?e.playerField:e.enemyField,n=0;for(let o=0;o<2;o++)for(let s=0;s<3;s++){let l=a[o][s];l&&l.name&&l.name.toLowerCase().includes("gargoyle")&&n++}let i=1+Math.min(n,3);return t==="player"?e.playerPyre+=i:e.enemyPyre+=i,GameEvents.emit("onPyreGained",{owner:t,amount:i,source:"Nightfall",gargoyleCount:n}),{pyreGained:i,gargoyleCount:n}},"effect")});window.DeckBuilder={defaultDeckConfig:{cryptidCount:15,basicPyreCount:15,rarePyreCount:5,otherInstanceCount:10,rarityWeights:{common:4,uncommon:3,rare:2,ultimate:1}},buildRandomDeck(e={}){let t={...this.defaultDeckConfig,...e},a=[],n={common:[],uncommon:[],rare:[],ultimate:[]};for(let u of CardRegistry.getAllCryptidKeys()){let b=CardRegistry.getCryptid(u);b.rarity&&n[b.rarity]?n[b.rarity].push(u):n.common.push(u)}let r=[];for(let[u,b]of Object.entries(n)){let x=t.rarityWeights[u]||1;for(let A of b)for(let T=0;T<x;T++)r.push(A)}for(let u=0;u<t.cryptidCount;u++){let b=r[Math.floor(Math.random()*r.length)];a.push(CardRegistry.getCryptid(b))}for(let u=0;u<t.basicPyreCount;u++)a.push(CardRegistry.getPyre("pyre"));let o=CardRegistry.getAllPyreKeys().filter(u=>u!=="pyre");if(o.length>0)for(let u=0;u<t.rarePyreCount;u++){let b=o[Math.floor(Math.random()*o.length)];a.push(CardRegistry.getPyre(b))}else for(let u=0;u<t.rarePyreCount;u++)a.push(CardRegistry.getPyre("pyre"));let s=CardRegistry.getAllBurstKeys(),l=CardRegistry.getAllTrapKeys(),c=CardRegistry.getAllAuraKeys(),m=Math.ceil(t.otherInstanceCount*.4),f=Math.floor(t.otherInstanceCount*.3),h=t.otherInstanceCount-m-f;for(let u=0;u<m&&s.length>0;u++){let b=s[Math.floor(Math.random()*s.length)];a.push(CardRegistry.getBurst(b))}for(let u=0;u<f&&l.length>0;u++){let b=l[Math.floor(Math.random()*l.length)];a.push(CardRegistry.getTrap(b))}for(let u=0;u<h&&c.length>0;u++){let b=c[Math.floor(Math.random()*c.length)];a.push(CardRegistry.getAura(b))}for(let u=a.length-1;u>0;u--){let b=Math.floor(Math.random()*(u+1));[a[u],a[b]]=[a[b],a[u]]}return console.log("Deck built:",{total:a.length,cryptids:a.filter(u=>u.type==="cryptid"&&!u.isKindling).length,kindling:a.filter(u=>u.isKindling).length,pyres:a.filter(u=>u.type==="pyre").length,bursts:a.filter(u=>u.type==="burst").length,traps:a.filter(u=>u.type==="trap").length,auras:a.filter(u=>u.type==="aura").length}),a},buildKindlingPool(e=null){let t=[],a=1e3;if(e&&Array.isArray(e)){for(let r of e){let i=r.cardKey||r.key,o=CardRegistry.getKindling(i);o&&t.push({...o,id:a++,isKindling:!0})}if(t.length>0)return console.log("[DeckBuilder] Built kindling pool from deck:",t.map(r=>r.name)),t}let n=CardRegistry.getAllKindlingKeys();for(let r of n){let i=CardRegistry.getKindling(r);i&&(t.push({...i,id:a++,isKindling:!0}),t.push({...i,id:a++,isKindling:!0}))}return console.log("[DeckBuilder] Built default kindling pool with",t.length,"cards from",n.length,"types"),t}};console.log("City of Flesh Series loaded:",{cryptids:CardRegistry.getAllCryptidKeys().length,bursts:CardRegistry.getAllBurstKeys().length,traps:CardRegistry.getAllTrapKeys().length,auras:CardRegistry.getAllAuraKeys().length,pyres:CardRegistry.getAllPyreKeys().length,kindling:CardRegistry.getAllKindlingKeys().length});typeof window.onCardsReady=="function"?window.onCardsReady():window.cardsLoaded=!0});var $e=M(()=>{"use strict";CardRegistry.registerKindling("newbornWendigo",{name:"Newborn Wendigo",sprite:"\u{1F98C}",spriteScale:1,element:"nature",cost:1,hp:2,atk:1,rarity:"uncommon",evolvesInto:"matureWendigo",combatAbility:"Intimidate: Enemy combatants have -1 ATK (min 1)",supportAbility:"Nurture: Combatant gains +1/+1",onCombat:p((e,t,a)=>{let n=a.getEnemyCombatantAcross(e);n&&!n.wendigoIntimidateApplied&&(n.atkDebuff=(n.atkDebuff||0)+1,n.wendigoIntimidateApplied=!0,n.currentAtk-n.atkDebuff<1&&(n.atkDebuff=Math.max(0,n.currentAtk-1)))},"onCombat"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;n.currentAtk=(n.currentAtk||n.atk)+1,n.currentHp=(n.currentHp||n.hp)+1,n.maxHp=(n.maxHp||n.hp)+1,e._lastBuffedCombatant=r}},"onSupport"),onDeath:p((e,t)=>{let a=e.owner;if((a==="player"?t.playerDeathCount:t.enemyDeathCount)===9){let r=t.findCardInHand(a,"primalWendigo"),i=t.findCardInDeck(a,"primalWendigo");if(r||i){e.preventDeath=!0;let o=r||i;t.evolveInPlace(e,o,a),r?t.removeFromHand(a,r):t.removeFromDeck(a,i);let s=a==="player"?t.enemyField:t.playerField,l=1;typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:"\u{1F480} 10th death! Primal Wendigo ascends!"});for(let c=0;c<3;c++){let m=s[l][c];m&&(typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",target:m,message:`\u2620 ${m.name} perishes!`}),m.killedBy="primalWendigoAscension",t.killCryptid(m,a==="player"?"enemy":"player"))}GameEvents.emit("onPrimalWendigoAscension",{cryptid:e,owner:a,supportsKilled:3})}}},"onDeath")});CardRegistry.registerKindling("stormhawk",{name:"Stormhawk",sprite:"\u{1F985}",spriteScale:1,element:"nature",cost:1,hp:2,atk:1,rarity:"common",evolvesInto:"thunderbird",hasFlight:!0,combatAbility:"Lone Hunter: Flight. +1 ATK if only combatant on summon",supportAbility:"Thermal: Once/turn, swap with adjacent support & heal both 2 HP",onSummon:p((e,t,a)=>{let n=a.getCombatCol(t);if(e.col===n){let r=t==="player"?a.playerField:a.enemyField,i=0;for(let o=0;o<3;o++)r[n][o]&&i++;i===1&&(e.currentAtk=(e.currentAtk||e.atk)+1,GameEvents.emit("onLoneHunterBonus",{cryptid:e,owner:t}))}},"onSummon"),onSupport:p((e,t,a)=>{e.hasThermalAbility=!0,e.thermalAvailable=!0},"onSupport"),activateThermal:p((e,t,a)=>{if(!e.thermalAvailable)return!1;let n=e.owner,r=n==="player"?t.playerField:t.enemyField,i=1,o=e.row;if(Math.abs(a-o)!==1||a<0||a>2)return!1;let s=r[i][a];return s?(r[i][o]=s,r[i][a]=e,s.row=o,e.row=a,e.currentHp=Math.min(e.maxHp||e.hp,(e.currentHp||e.hp)+2),s.currentHp=Math.min(s.maxHp||s.hp,(s.currentHp||s.hp)+2),e.thermalAvailable=!1,GameEvents.emit("onThermalSwap",{cryptid:e,target:s,owner:n}),!0):!1},"activateThermal"),onTurnStart:p((e,t,a)=>{e.hasThermalAbility&&(e.thermalAvailable=!0)},"onTurnStart")});CardRegistry.registerKindling("adolescentBigfoot",{name:"Adolescent Bigfoot",sprite:"\u{1F9B6}",spriteScale:1,element:"nature",cost:1,hp:3,atk:0,rarity:"common",evolvesInto:"adultBigfoot",requiresSacrificeToEvolve:!0,combatAbility:"Rage: +1 ATK when attacked. May sacrifice 1 ATK to heal 2 HP",supportAbility:"Bulk: Combatant gains +2 HP",onTakeDamage:p((e,t,a,n)=>{e.currentAtk=(e.currentAtk||e.atk)+1,GameEvents.emit("onRageStack",{cryptid:e,newAtk:e.currentAtk})},"onTakeDamage"),onCombat:p((e,t,a)=>{e.hasRageHealAbility=!0,e.rageHealAvailable=!0},"onCombat"),activateRageHeal:p((e,t)=>!e.rageHealAvailable||(e.currentAtk||e.atk)<1?!1:(e.currentAtk=(e.currentAtk||e.atk)-1,e.currentHp=Math.min(e.maxHp||e.hp,(e.currentHp||e.hp)+2),e.rageHealAvailable=!1,GameEvents.emit("onRageHeal",{cryptid:e,owner:e.owner}),!0),"activateRageHeal"),onTurnStart:p((e,t,a)=>{e.hasRageHealAbility&&(e.rageHealAvailable=!0)},"onTurnStart"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;n.currentHp=(n.currentHp||n.hp)+2,n.maxHp=(n.maxHp||n.hp)+2,e._lastBuffedCombatant=r}},"onSupport"),canEvolve:p((e,t)=>{let a=e.owner,n=t.getCombatCol(a),r=a==="player"?t.playerField:t.enemyField;for(let i=0;i<3;i++){let o=r[n][i];if(o&&o!==e)return!0}return!1},"canEvolve")});CardRegistry.registerKindling("cursedHybrid",{name:"Cursed Hybrid",sprite:"\u{1F43A}",spriteScale:.9,element:"void",cost:1,hp:1,atk:1,rarity:"common",combatAbility:"Adaptation: +2 ATK if support is blood/void, +2 HP if nature/water",supportAbility:"Curse: +1 damage if combatant is void/blood, heal 1/turn if nature/water",getEvolution:p(e=>{let t=e.currentAtk||e.atk,a=e.currentHp||e.hp;return t>a?"werewolf":a>t?"lycanthrope":null},"getEvolution"),onSummon:p((e,t,a)=>{let n=a.getCombatCol(t),r=a.getSupportCol(t);if(e.col===n){let o=(t==="player"?a.playerField:a.enemyField)[r][e.row];if(o){let s=o.element;s==="blood"||s==="void"?(e.currentAtk=(e.currentAtk||e.atk)+2,GameEvents.emit("onHybridAdaptation",{cryptid:e,type:"atk",element:s})):(s==="nature"||s==="water")&&(e.currentHp=(e.currentHp||e.hp)+2,e.maxHp=(e.maxHp||e.hp)+2,GameEvents.emit("onHybridAdaptation",{cryptid:e,type:"hp",element:s}))}}},"onSummon"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;let i=n.element;i==="blood"||i==="void"?(n.bonusDamage=(n.bonusDamage||0)+1,e.curseType="damage"):(i==="nature"||i==="water")&&(n.curseHealing=!0,e.curseType="healing"),e._lastBuffedCombatant=r}},"onSupport"),onTurnStart:p((e,t,a)=>{let n=a.getSupportCol(t);if(e.col===n&&e.curseType==="healing"){let r=a.getCombatant(e);r&&r.curseHealing&&(r.currentHp=Math.min(r.maxHp||r.hp,(r.currentHp||r.hp)+1),GameEvents.emit("onCurseHeal",{combatant:r,owner:t}))}},"onTurnStart")});CardRegistry.registerKindling("deerWoman",{name:"Deer Woman",sprite:"\u{1F98C}",spriteScale:1,element:"nature",cost:1,hp:3,atk:0,rarity:"common",combatAbility:"Grace: On summon, adjacent combatants gain +1 ATK. +1 ATK if both buffed",supportAbility:"Offering: Gain 1 pyre when Deer Woman or combatant is attacked",onSummon:p((e,t,a)=>{let n=a.getCombatCol(t);if(e.col===n){let r=t==="player"?a.playerField:a.enemyField,i=e.row,o=0;if(i>0&&r[n][i-1]){let s=r[n][i-1];s.currentAtk=(s.currentAtk||s.atk)+1,o++,GameEvents.emit("onGraceBuff",{target:s,owner:t})}if(i<2&&r[n][i+1]){let s=r[n][i+1];s.currentAtk=(s.currentAtk||s.atk)+1,o++,GameEvents.emit("onGraceBuff",{target:s,owner:t})}o>=2&&(e.currentAtk=(e.currentAtk||e.atk)+1,GameEvents.emit("onGraceSelfBuff",{cryptid:e,owner:t}))}},"onSummon"),onSupport:p((e,t,a)=>{e.hasOfferingAbility=!0},"onSupport"),onBeforeDefend:p((e,t,a)=>{let n=e.owner;n==="player"?a.playerPyre++:a.enemyPyre++,GameEvents.emit("onOfferingPyre",{cryptid:e,owner:n,source:"Deer Woman attacked"}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"pyreDrain",target:e,message:"\u{1F98C} Deer Woman's Offering: +1 pyre!"})},"onBeforeDefend"),onCombatantAttacked:p((e,t,a,n)=>{if(e.hasOfferingAbility){let r=e.owner;r==="player"?n.playerPyre++:n.enemyPyre++,GameEvents.emit("onOfferingPyre",{cryptid:e,owner:r,source:"Combatant attacked"}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"pyreDrain",target:e,message:"\u{1F98C} Deer Woman's Offering: +1 pyre!"})}},"onCombatantAttacked")});CardRegistry.registerCryptid("matureWendigo",{name:"Mature Wendigo",sprite:"\u{1F98C}",spriteScale:1.2,element:"blood",cost:3,hp:4,atk:3,rarity:"uncommon",evolvesFrom:"newbornWendigo",evolvesInto:"primalWendigo",combatAbility:"Hunger: If doesn't attack, lose 1 HP & all enemies -1 ATK (min 1)",supportAbility:"Guardian: First attack on combatant each turn: -2 damage, +1 ATK",canSpecialEvolve:p((e,t)=>{if(e.justSummoned||(e.currentHp||e.hp)!==1)return!1;let a=e.owner;return t.findCardInHand(a,"primalWendigo")?!1:!!t.findCardInDeck(a,"primalWendigo")},"canSpecialEvolve"),onCombatAttack:p((e,t,a)=>(e.attackedThisTurn=!0,0),"onCombatAttack"),onTurnEnd:p((e,t,a)=>{let n=a.getCombatCol(t);if(e.col!==n||e.attackedThisTurn)return;e.currentHp=(e.currentHp||e.hp)-1,GameEvents.emit("onHungerDamage",{cryptid:e,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",target:e,damage:1,message:`\u{1F630} ${e.name}'s hunger deals 1 self-damage!`});let r=t==="player"?a.enemyField:a.playerField;for(let i=0;i<2;i++)for(let o=0;o<3;o++){let s=r[i][o];s&&(s.atkDebuff=(s.atkDebuff||0)+1,(s.currentAtk||s.atk)-s.atkDebuff<1&&(s.atkDebuff=Math.max(0,(s.currentAtk||s.atk)-1)))}GameEvents.emit("onWendigoHunger",{cryptid:e,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",message:"\u2B07 All enemies lose 1 ATK!"}),e.currentHp<=0&&a.killCryptid(e,t)},"onTurnEnd"),onSupport:p((e,t,a)=>{e.hasGuardianAbility=!0,e.guardianAvailable=!0},"onSupport"),onCombatantAttacked:p((e,t,a,n)=>{e.guardianAvailable&&(t.damageReduction=(t.damageReduction||0)+2,t.currentAtk=(t.currentAtk||t.atk)+1,e.guardianAvailable=!1,GameEvents.emit("onGuardianProtect",{support:e,combatant:t,owner:e.owner}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:t,message:"\u{1F6E1}\uFE0F Guardian: -2 damage, +1 ATK!"}))},"onCombatantAttacked"),onTurnStart:p((e,t,a)=>{e.hasGuardianAbility&&(e.guardianAvailable=!0)},"onTurnStart")});CardRegistry.registerCryptid("primalWendigo",{name:"Primal Wendigo",sprite:"\u{1F98C}",spriteScale:1.5,element:"blood",cost:6,hp:7,atk:4,rarity:"ultimate",mythical:!0,evolvesFrom:"matureWendigo",combatAbility:"Apex: +2/+2 on kill. Counter-attacks before damage; if kills attacker, negates attack",supportAbility:"Cannibalize: Deals ATK to own support each turn. Kill = +2/+2, 2 pyre, draw 2",onBeforeDefend:p((e,t,a)=>{let n=e.currentAtk||e.atk;t.currentHp-=n,GameEvents.emit("onPrimalCounter",{cryptid:e,attacker:t,damage:n,owner:e.owner}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"counterAttack",source:e,target:t,damage:n,message:`\u26A1 ${e.name} counter-attacks for ${n}!`}),t.currentHp<=0&&(t.killedBy="primalCounter",a.killCryptid(t,e.owner),e.currentAtk=(e.currentAtk||e.atk)+2,e.currentHp=(e.currentHp||e.hp)+2,e.maxHp=(e.maxHp||e.hp)+2,GameEvents.emit("onApexKill",{cryptid:e,victim:t,owner:e.owner}),e.negateIncomingAttack=!0)},"onBeforeDefend"),onKill:p((e,t,a)=>{e.currentAtk=(e.currentAtk||e.atk)+2,e.currentHp=(e.currentHp||e.hp)+2,e.maxHp=(e.maxHp||e.hp)+2,GameEvents.emit("onApexKill",{cryptid:e,victim:t,owner:e.owner})},"onKill"),onTurnStart:p((e,t,a)=>{let n=a.getSupportCol(t);e.col!==n||a.getCombatant(e)},"onTurnStart"),onCombat:p((e,t,a)=>{e.hasCannibalize=!0},"onCombat"),onSupport:p((e,t,a)=>{},"onSupport")});CardRegistry.cryptids.primalWendigo.onTurnStart=function(e,t,a){let n=a.getCombatCol(t);if(e.col!==n)return;let r=a.getSupport(e);if(!r)return;let i=e.currentAtk||e.atk;r.currentHp-=i,GameEvents.emit("onCannibalizeDamage",{cryptid:e,support:r,damage:i,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",source:e,target:r,damage:i,message:`\u{1F480} ${e.name} cannibalizes for ${i}!`}),r.currentHp<=0&&(r.killedBy="cannibalize",a.killCryptid(r,t),e.currentAtk=(e.currentAtk||e.atk)+2,e.currentHp=(e.currentHp||e.hp)+2,e.maxHp=(e.maxHp||e.hp)+2,t==="player"?a.playerPyre+=2:a.enemyPyre+=2,a.drawCards(t,2),GameEvents.emit("onCannibalizeKill",{cryptid:e,support:r,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u2B06 ${e.name} gains +2/+2, 2 pyre, draws 2!`}))};CardRegistry.registerCryptid("thunderbird",{name:"Thunderbird",sprite:"\u{1F985}",spriteScale:1.3,element:"water",cost:4,hp:4,atk:4,rarity:"common",hasFlight:!0,evolvesFrom:"stormhawk",combatAbility:"Storm Call: Flight. Enemies summoned across take 2 damage",supportAbility:"Tailwind: Combatant gains Flight and +1/+1",onCombat:p((e,t,a)=>{e.hasStormCall=!0},"onCombat"),onEnemySummonedAcross:p((e,t,a)=>{e.hasStormCall&&(t.currentHp-=2,GameEvents.emit("onStormCallDamage",{source:e,target:t,damage:2}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",source:e,target:t,damage:2,message:`\u26A1 ${e.name}'s Storm Call hits for 2!`}),t.currentHp<=0&&a.killCryptid(t,e.owner))},"onEnemySummonedAcross"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;n.hasFlight=!0,n.currentAtk=(n.currentAtk||n.atk)+1,n.currentHp=(n.currentHp||n.hp)+1,n.maxHp=(n.maxHp||n.hp)+1,e._lastBuffedCombatant=r,GameEvents.emit("onTailwindBuff",{support:e,combatant:n,owner:t})}},"onSupport")});CardRegistry.registerCryptid("snipe",{name:"Snipe",sprite:"\u{1F986}",spriteScale:1,element:"void",cost:2,hp:4,atk:2,rarity:"common",combatAbility:"Ambush: Hidden on summon. Unhide: paralyze & 2 damage to enemy across. Re-hides each turn",supportAbility:"Mend: On summon, fully heal combatant to base max HP",onSummon:p((e,t,a)=>{let n=a.getCombatCol(t);e.col===n&&(e.isHidden=!0,GameEvents.emit("onHide",{cryptid:e,owner:t}))},"onSummon"),onCombatAttack:p((e,t,a)=>(e.isHidden&&(e.isHidden=!1,a.triggerSnipeReveal(e)),0),"onCombatAttack"),onBeforeDefend:p((e,t,a)=>{e.isHidden&&(e.isHidden=!1,a.triggerSnipeReveal(e))},"onBeforeDefend"),onTurnStart:p((e,t,a)=>{let n=a.getCombatCol(t);e.col===n&&!e.isHidden&&(e.isHidden=!0,GameEvents.emit("onReHide",{cryptid:e,owner:t}))},"onTurnStart"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.baseHp||n.hp;n.currentHp=r,GameEvents.emit("onMendHeal",{support:e,combatant:n,healedTo:r,owner:t})}},"onSupport")});CardRegistry.registerCryptid("adultBigfoot",{name:"Adult Bigfoot",sprite:"\u{1F9B6}",spriteScale:1.5,element:"nature",cost:7,hp:10,atk:2,rarity:"rare",evolvesFrom:"adolescentBigfoot",combatAbility:"Rampage: Attacks hit combatant AND support. Auras cost -1 pyre",supportAbility:"Bulwark: When Adult Bigfoot or combatant targeted, both gain +1 HP",modifyAuraCost:-1,hasCleave:!0,onSummon:p((e,t,a)=>{e.evolutionChain&&e.evolutionChain.length>1&&(e.currentAtk=(e.currentAtk||e.atk)+2,GameEvents.emit("onEvolutionBonus",{cryptid:e,bonus:2,owner:t}))},"onSummon"),onSupport:p((e,t,a)=>{e.hasBulwark=!0},"onSupport"),onBeforeDefend:p((e,t,a)=>{let n=a.getCombatCol(e.owner),r=a.getSupportCol(e.owner);if(e.currentHp=(e.currentHp||e.hp)+1,e.maxHp=(e.maxHp||e.hp)+1,e.col===n){let i=a.getSupport(e);i&&(i.currentHp=(i.currentHp||i.hp)+1,i.maxHp=(i.maxHp||i.hp)+1)}else{let i=a.getCombatant(e);i&&(i.currentHp=(i.currentHp||i.hp)+1,i.maxHp=(i.maxHp||i.hp)+1)}GameEvents.emit("onBulwarkTrigger",{cryptid:e,owner:e.owner}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:"\u{1F9B6} Bulwark: Both gain +1 HP!"})},"onBeforeDefend"),onCombatantAttacked:p((e,t,a,n)=>{e.hasBulwark&&(e.currentHp=(e.currentHp||e.hp)+1,e.maxHp=(e.maxHp||e.hp)+1,t.currentHp=(t.currentHp||t.hp)+1,t.maxHp=(t.maxHp||t.hp)+1,GameEvents.emit("onBulwarkTrigger",{cryptid:e,owner:e.owner}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:t,message:"\u{1F9B6} Bulwark: Both gain +1 HP!"}))},"onCombatantAttacked")});CardRegistry.registerCryptid("werewolf",{name:"Werewolf",sprite:"\u{1F43A}",spriteScale:1.2,element:"blood",cost:3,hp:2,atk:4,rarity:"common",evolvesFrom:"cursedHybrid",combatAbility:"Blood Frenzy: Curse self to die end of turn \u2192 +4 ATK & Destroyer",supportAbility:"Savage: Combatant gains +2 ATK",onCombat:p((e,t,a)=>{e.hasBloodFrenzyAbility=!0,e.bloodFrenzyAvailable=!0},"onCombat"),activateBloodFrenzy:p((e,t)=>{e.bloodFrenzyAvailable&&(e.bloodFrenzyAvailable=!1,e.cursedToDie=!0,e.currentAtk=(e.currentAtk||e.atk)+4,e.hasDestroyer=!0,GameEvents.emit("onBloodFrenzy",{cryptid:e,owner:e.owner}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:"\u{1FA78} Blood Frenzy: +4 ATK, Destroyer!"}))},"activateBloodFrenzy"),onTurnEnd:p((e,t,a)=>{e.cursedToDie&&(typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",target:e,message:`\u2620 Blood Frenzy claims ${e.name}!`}),e.killedBy="bloodFrenzyCurse",a.killCryptid(e,t))},"onTurnEnd"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;n.currentAtk=(n.currentAtk||n.atk)+2,e._lastBuffedCombatant=r,GameEvents.emit("onSavageBuff",{support:e,combatant:n,owner:t})}},"onSupport")});CardRegistry.registerCryptid("lycanthrope",{name:"Lycanthrope",sprite:"\u{1F43A}",spriteScale:1.2,element:"steel",cost:3,hp:4,atk:2,rarity:"common",evolvesFrom:"cursedHybrid",combatAbility:"Pack Growth: +1/+1 when you summon a support",supportAbility:"Pack Leader: Combatant gets +1/+1 when you summon a support",onCombat:p((e,t,a)=>{e.hasPackGrowth=!0},"onCombat"),onSupport:p((e,t,a)=>{e.hasPackLeader=!0},"onSupport")});CardRegistry.registerCryptid("rogueRazorback",{name:"Rogue Razorback",sprite:"\u{1F417}",spriteScale:1.1,element:"steel",cost:4,hp:3,atk:3,rarity:"common",combatAbility:"Gore: On enter combat, deal ATK damage to enemy combatant across",supportAbility:"Iron Hide: Combatant is immune to traps and bursts",onCombat:p((e,t,a)=>{let n=a.getEnemyCombatantAcross(e);if(n){let r=e.currentAtk||e.atk;n.currentHp-=r,GameEvents.emit("onGoreDamage",{source:e,target:n,damage:r,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",source:e,target:n,damage:r,message:`\u{1F417} ${e.name} gores for ${r}!`}),n.currentHp<=0&&a.killCryptid(n,t)}},"onCombat"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&(n.immuneToTraps=!0,n.immuneToBursts=!0,GameEvents.emit("onIronHide",{support:e,combatant:n,owner:t}))},"onSupport")});CardRegistry.registerCryptid("notDeer",{name:"Not-Deer",sprite:"\u{1F98C}",spriteScale:.9,element:"nature",cost:1,hp:3,atk:1,rarity:"common",combatAbility:"Herd Blessing: Gain 1 pyre per adjacent nature cryptid at turn start",supportAbility:"Death Watch: Draw a card when one of your cryptids dies",onTurnStart:p((e,t,a)=>{let n=a.getCombatCol(t);if(e.col!==n)return;let r=t==="player"?a.playerField:a.enemyField,i=0;e.row>0&&r[n][e.row-1]?.element==="nature"&&i++,e.row<2&&r[n][e.row+1]?.element==="nature"&&i++,i>0&&(t==="player"?a.playerPyre+=i:a.enemyPyre+=i,GameEvents.emit("onHerdBlessing",{cryptid:e,owner:t,pyresGained:i}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"pyreDrain",target:e,message:`\u{1F98C} Herd Blessing: +${i} pyre!`}))},"onTurnStart"),onSupport:p((e,t,a)=>{e.hasDeathWatch=!0},"onSupport")});CardRegistry.registerCryptid("jerseyDevil",{name:"Jersey Devil",sprite:"\u{1F608}",spriteScale:1.3,element:"void",cost:5,hp:6,atk:2,rarity:"rare",mythical:!0,hasFlight:!0,combatAbility:"Flight. Swoop: Deal ATK to enemy across on enter. Steal 1 pyre on attack",supportAbility:"Infernal Ward: Immune to pyre drain. Combatant gains Flight",onCombat:p((e,t,a)=>{let n=a.getEnemyCombatantAcross(e);if(n){let r=e.currentAtk||e.atk;n.currentHp-=r,GameEvents.emit("onSwoopDamage",{source:e,target:n,damage:r,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",source:e,target:n,damage:r,message:`\u{1F987} ${e.name} swoops for ${r}!`}),typeof showMessage=="function"&&showMessage(`\u{1F987} ${e.name} swoops for ${r}!`),n.currentHp<=0&&a.killCryptid(n,t)}e.stealsOnAttack=!0},"onCombat"),onCombatAttack:p((e,t,a)=>{if(e.stealsOnAttack){let n=e.owner,r=n==="player"?"enemy":"player";(r==="player"?a.playerPyre:a.enemyPyre)>0&&(r==="player"?a.playerPyre--:a.enemyPyre--,n==="player"?a.playerPyre++:a.enemyPyre++,GameEvents.emit("onPyreSteal",{source:e,owner:n,stolenFrom:r}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"pyreDrain",source:e,message:`\u{1F525} ${e.name} steals 1 pyre!`}))}return 0},"onCombatAttack"),onSupport:p((e,t,a)=>{t==="player"?a.playerPyreDrainImmune=!0:a.enemyPyreDrainImmune=!0;let n=a.getCombatant(e);n&&(n.hasFlight=!0,GameEvents.emit("onInfernalWard",{support:e,combatant:n,owner:t}))},"onSupport")});CardRegistry.registerCryptid("babaYaga",{name:"Baba Yaga",sprite:"\u{1F9D9}",spriteScale:1,element:"void",cost:2,hp:5,atk:1,rarity:"uncommon",mythical:!0,combatAbility:"Hex: Negate traps/bursts targeting Baba Yaga \u2192 kill random enemy",supportAbility:"Crone's Blessing: When combatant targeted, gain 1 pyre & heal combatant 1 HP",immuneToTraps:!0,immuneToBursts:!0,onTargetedByTrap:p((e,t,a)=>{let r=(e.owner==="player"?"enemy":"player")==="player"?a.playerField:a.enemyField,i=[];for(let o=0;o<2;o++)for(let s=0;s<3;s++)r[o][s]&&i.push(r[o][s]);if(i.length>0){let o=i[Math.floor(Math.random()*i.length)];typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"abilityDamage",source:e,target:o,message:`\u{1F9D9} Baba Yaga's Hex kills ${o.name}!`}),o.killedBy="babaYagaHex",a.killCryptid(o,e.owner),GameEvents.emit("onHexKill",{source:e,victim:o,owner:e.owner})}return!0},"onTargetedByTrap"),onTargetedByBurst:p((e,t,a)=>e.onTargetedByTrap(e,t,a),"onTargetedByBurst"),onSupport:p((e,t,a)=>{e.hasCronesBlessing=!0},"onSupport"),onCombatantAttacked:p((e,t,a,n)=>{if(!e.hasCronesBlessing)return;let r=e.owner;r==="player"?n.playerPyre++:n.enemyPyre++,t.currentHp=Math.min(t.maxHp||t.hp,(t.currentHp||t.hp)+1),GameEvents.emit("onCronesBlessing",{support:e,combatant:t,owner:r}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"heal",target:t,damage:1,message:"\u{1F9D9} Crone's Blessing: +1 pyre & heal!"})},"onCombatantAttacked")});CardRegistry.registerPyre("burialGround",{name:"Burial Ground",sprite:"\u26B0\uFE0F",rarity:"uncommon",mythical:!0,maxCopies:1,description:"+1 pyre. +1 per different enemy attacker last turn (max +3)",pyreGain:1,effect:p((e,t)=>{let a=1,n=e.lastTurnAttackers?.[t==="player"?"enemy":"player"]||[],r=new Set(n.map(o=>o.key||o.name)).size,i=Math.min(3,r);return a+=i,t==="player"?e.playerPyre+=a:e.enemyPyre+=a,GameEvents.emit("onPyreGained",{owner:t,amount:a,source:"Burial Ground"}),{pyreGained:a}},"effect")});CardRegistry.registerPyre("cursedWoods",{name:"Cursed Woods",sprite:"\u{1F332}",rarity:"uncommon",mythical:!0,description:"+1 pyre. +1 per enemy support (max +3)",pyreGain:1,effect:p((e,t)=>{let a=1,n=t==="player"?"enemy":"player",r=n==="player"?e.playerField:e.enemyField,i=e.getSupportCol(n),o=0;for(let l=0;l<3;l++)r[i][l]&&o++;let s=Math.min(3,o);return a+=s,t==="player"?e.playerPyre+=a:e.enemyPyre+=a,GameEvents.emit("onPyreGained",{owner:t,amount:a,source:"Cursed Woods"}),{pyreGained:a}},"effect")});CardRegistry.registerPyre("animalPelts",{name:"Animal Pelts",sprite:"\u{1F98A}",rarity:"ultimate",mythical:!0,description:"+1 pyre & draw 1 per nature/water cryptid on your field",pyreGain:1,effect:p((e,t)=>{let a=1,n=t==="player"?e.playerField:e.enemyField,r=0;for(let i=0;i<2;i++)for(let o=0;o<3;o++){let s=n[i][o];s&&(s.element==="nature"||s.element==="water")&&r++}a+=r,t==="player"?e.playerPyre+=a:e.enemyPyre+=a;for(let i=0;i<r;i++)e.drawCard(t,"animalPelts");return GameEvents.emit("onPyreGained",{owner:t,amount:a,source:"Animal Pelts"}),{pyreGained:a,cardsDrawn:r}},"effect")});CardRegistry.registerAura("dauntingPresence",{name:"Daunting Presence",sprite:"\u{1F441}\uFE0F",cost:1,rarity:"common",description:"Grant equipped cryptid +1/+1",atkBonus:1,hpBonus:1});CardRegistry.registerAura("sproutWings",{name:"Sprout Wings",sprite:"\u{1FABD}",cost:1,rarity:"common",description:"Grant equipped cryptid Flight",onApply:p((e,t,a)=>{t.hasFlight=!0},"onApply")});CardRegistry.registerAura("weaponizedTree",{name:"Weaponized Tree",sprite:"\u{1F333}",cost:3,rarity:"common",description:"Equipped cryptid's attacks target all enemy combatants",onApply:p((e,t,a)=>{t.hasMultiAttack=!0},"onApply")});CardRegistry.registerAura("insatiableHunger",{name:"Insatiable Hunger",sprite:"\u{1F356}",cost:2,rarity:"common",description:"Before each attack, equipped cryptid gains +1 ATK",onApply:p((e,t,a)=>{t.hasInsatiableHunger=!0},"onApply")});CardRegistry.registerTrap("terrify",{name:"Terrify",sprite:"\u{1F631}",cost:1,rarity:"common",description:"When enemy attacks: attacker's ATK becomes 0 until end of turn",triggerType:"onEnemyAttack",onTrigger:p((e,t,a)=>{let n=t.attacker;return n&&(n.savedAtk=n.currentAtk||n.atk,n.currentAtk=0,n.terrified=!0,GameEvents.emit("onTerrify",{trap:e,attacker:n,owner:e.owner})),!0},"onTrigger")});CardRegistry.registerTrap("hunt",{name:"Hunt",sprite:"\u{1F3F9}",cost:1,rarity:"rare",description:"When enemy plays pyre card: steal all pyres it would grant",triggerType:"onEnemyPyreCard",onTrigger:p((e,t,a)=>{let n=t.pyreAmount||1,r=e.owner,i=r==="player"?"enemy":"player";return i==="player"?a.playerPyre-=n:a.enemyPyre-=n,r==="player"?a.playerPyre+=n:a.enemyPyre+=n,GameEvents.emit("onHuntSteal",{trap:e,stolenPyre:n,from:i,to:r}),!0},"onTrigger")});CardRegistry.registerBurst("fullMoon",{name:"Full Moon",sprite:"\u{1F315}",cost:3,rarity:"rare",targetType:"allyCryptid",description:"Target cryptid evolves into next form (ignoring conditions) if in hand/deck",validateTarget:p((e,t,a)=>{if(!e)return!1;let n=e.evolvesInto||(e.getEvolution?e.getEvolution(e):null);if(!n)return!1;let r=a.findCardInHand(t,n),i=a.findCardInDeck(t,n);return!!(r||i)},"validateTarget"),effect:p((e,t,a)=>{if(!a)return!1;let n=a.evolvesInto||(a.getEvolution?a.getEvolution(a):null);if(!n)return GameEvents.emit("onFullMoonFail",{target:a,reason:"no evolution"}),!1;let r=e.findCardInHand(t,n),i=e.findCardInDeck(t,n);if(!r&&!i)return GameEvents.emit("onFullMoonFail",{target:a,reason:"evolution not in hand or deck"}),!1;let o=r||i;return r?e.removeFromHand(t,r):e.removeFromDeck(t,i),e.evolveInPlace(a,o,t),GameEvents.emit("onFullMoonEvolve",{target:a,evolution:o,owner:t}),!0},"effect")});CardRegistry.registerCryptid("skinwalker",{name:"Skinwalker",sprite:"\u{1F3AD}",spriteScale:1,element:"nature",cost:2,hp:4,atk:1,rarity:"common",combatAbility:"Mimic: ATK becomes equal to enemy combatant across on enter combat",supportAbility:"Inherit: When combatant dies, gain its ATK/HP if higher than base",onCombat:p((e,t,a)=>{let n=a.getEnemyCombatantAcross(e);if(n){let r=n.currentAtk||n.atk;e.currentAtk=r,GameEvents.emit("onMimic",{cryptid:e,copied:n,newAtk:r,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F3AD} ${e.name} mimics ${n.name}'s ATK (${r})!`})}},"onCombat"),onSupport:p((e,t,a)=>{e.hasInherit=!0},"onSupport")});console.log("Forests of Fear cards loaded:",Object.keys(CardRegistry.cryptids).filter(e=>["matureWendigo","primalWendigo","thunderbird","adultBigfoot","werewolf","lycanthrope","snipe","rogueRazorback","notDeer","jerseyDevil","babaYaga","skinwalker"].includes(e)).length,"cryptids |",Object.keys(CardRegistry.kindling||{}).filter(e=>["newbornWendigo","stormhawk","adolescentBigfoot","cursedHybrid","deerWoman"].includes(e)).length,"kindling |",Object.keys(CardRegistry.pyres||{}).filter(e=>["burialGround","cursedWoods","animalPelts"].includes(e)).length,"pyres |",Object.keys(CardRegistry.auras||{}).filter(e=>["dauntingPresence","sproutWings","weaponizedTree","insatiableHunger"].includes(e)).length,"auras |",Object.keys(CardRegistry.traps||{}).filter(e=>["terrify","hunt"].includes(e)).length,"traps |",Object.keys(CardRegistry.bursts||{}).filter(e=>["fullMoon"].includes(e)).length,"bursts")});var Re=M(()=>{"use strict";CardRegistry.registerKindling("feuFollet",{name:"Feu Follet",sprite:"\u{1F506}",spriteScale:1,element:"nature",cost:1,hp:2,atk:0,rarity:"common",evolvesInto:"ignisFatuus",combatAbility:"Enemies who damage Feu Follet gain 2 curse tokens",supportAbility:"Combatant's attacks apply 1 curse token",onBeforeDefend:p((e,t,a)=>{a.applyCurse(t,2),GameEvents.emit("onCurseApplied",{source:e,target:t,tokens:2}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"debuff",target:t,message:`\u{1F52E} ${t.name} is cursed! (-2 ATK)`})},"onBeforeDefend"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&(n.attacksApplyCurse=1)},"onSupport")});CardRegistry.registerKindling("swampRat",{name:"Swamp Rat",sprite:"\u{1F400}",spriteScale:.9,element:"nature",cost:1,hp:1,atk:1,rarity:"common",evolvesInto:"plagueRat",combatAbility:"On hit, steal 1 pyre from enemy",supportAbility:"+1 pyre at turn start if combatant is cursed",onCombatAttack:p((e,t,a)=>{let n=t.owner,r=e.owner;return n==="player"&&a.playerPyre>0?(a.playerPyre--,a.enemyPyre++,GameEvents.emit("onPyreStolen",{from:"player",to:"enemy",amount:1,source:e})):n==="enemy"&&a.enemyPyre>0&&(a.enemyPyre--,a.playerPyre++,GameEvents.emit("onPyreStolen",{from:"enemy",to:"player",amount:1,source:e})),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F525} ${e.name} steals 1 pyre!`}),0},"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasSwampRatSupport=!0},"onSupport"),onTurnStartSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&n.curseTokens>0&&(t==="player"?a.playerPyre++:a.enemyPyre++,GameEvents.emit("onPyreGained",{owner:t,amount:1,source:"Swamp Rat support"}))},"onTurnStartSupport")});CardRegistry.registerKindling("bayouSprite",{name:"Bayou Sprite",sprite:"\u{1F9DA}",spriteScale:.85,element:"nature",cost:1,hp:2,atk:0,rarity:"common",evolvesInto:"swampHag",combatAbility:"Create toxic tile on enemy side when summoned",supportAbility:"Combatant heals 1 HP when any enemy takes toxic damage",onCombat:p((e,t,a)=>{let n=t==="player"?"enemy":"player",r=a.getCombatCol(n),i=Math.floor(Math.random()*3);a.applyToxic(n,r,i),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"debuff",target:{owner:n,col:r,row:i},message:"\u2620\uFE0F Toxic swamp spreads!"})},"onCombat"),onSupport:p((e,t,a)=>{e.hasBayouSpriteSupport=!0,e._toxicHealListener||(e._toxicHealListener=n=>{if(n.owner!==t){let r=a.getCombatant(e);if(r){let i=r.maxHp||r.hp;r.currentHp<i&&(r.currentHp=Math.min(i,r.currentHp+1),GameEvents.emit("onHeal",{cryptid:r,amount:1,source:"Bayou Sprite"}))}}},GameEvents.on("onToxicDamage",e._toxicHealListener))},"onSupport"),onDeath:p((e,t)=>{if(e._toxicHealListener){let a=GameEvents.listeners.onToxicDamage?.indexOf(e._toxicHealListener);a>-1&&GameEvents.listeners.onToxicDamage.splice(a,1)}},"onDeath")});CardRegistry.registerKindling("voodooDoll",{name:"Voodoo Doll",sprite:"\u{1FA86}",spriteScale:.9,element:"void",cost:1,hp:3,atk:0,rarity:"common",evolvesInto:"effigy",combatAbility:"Mirror: Damage to Voodoo Doll also hits enemy combatant across",supportAbility:"Once per turn, redirect 1 damage from combatant to enemy support",onBeforeDefend:p((e,t,a)=>{let n=a.getEnemyCombatantAcross(e);n&&t!==n&&(e.mirrorDamageTarget=n)},"onBeforeDefend"),onAfterDefend:p((e,t,a,n)=>{e.mirrorDamageTarget&&a>0&&(e.mirrorDamageTarget.currentHp-=a,GameEvents.emit("onMirrorDamage",{source:e,target:e.mirrorDamageTarget,damage:a}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"damage",target:e.mirrorDamageTarget,message:`\u{1FA86} Mirror! ${e.mirrorDamageTarget.name} takes ${a}!`}),e.mirrorDamageTarget.currentHp<=0&&(e.mirrorDamageTarget.killedBy="mirrorDamage",n.killCryptid(e.mirrorDamageTarget,e.owner)),e.mirrorDamageTarget=null)},"onAfterDefend"),onSupport:p((e,t,a)=>{e.hasVoodooDollSupport=!0,e.voodooDollRedirectAvailable=!0},"onSupport")});CardRegistry.registerKindling("platEyePup",{name:"Plat-Eye Pup",sprite:"\u{1F415}\u200D\u{1F9BA}",spriteScale:.9,element:"void",cost:1,hp:2,atk:1,rarity:"common",evolvesInto:"platEye",combatAbility:"Reveals hidden enemies across",supportAbility:"Combatant gains +2 ATK vs enemies with any status ailment",onCombat:p((e,t,a)=>{let n=a.getCryptidsAcross(e);for(let r of n)r.isHidden&&(r.isHidden=!1,GameEvents.emit("onReveal",{cryptid:r,revealedBy:e}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"debuff",target:r,message:`\u{1F441}\uFE0F ${r.name} revealed!`}))},"onCombat"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;n.bonusVsAilment=(n.bonusVsAilment||0)+2,e._lastBuffedCombatant=r}},"onSupport")});CardRegistry.registerCryptid("zombie",{name:"Zombie",sprite:"\u{1F9DF}",spriteScale:1,element:"blood",cost:2,hp:2,atk:2,rarity:"common",evolvesInto:"revenant",combatAbility:"Undying: On first death, return to hand at end of turn",supportAbility:"Combatant heals 1 HP on kill",onSummon:p((e,t,a)=>{e.undyingUsed=!1},"onSummon"),onDeath:p((e,t)=>{if(!e.undyingUsed){e.undyingUsed=!0,e.preventDeath=!0;let a=e.owner,n=a==="player"?t.playerHand:t.enemyHand,r=CardRegistry.getCryptid("zombie");r&&n.length<20&&(r.id=Math.random().toString(36).substr(2,9),r.undyingUsed=!0,n.push(r),GameEvents.emit("onUndying",{cryptid:e,owner:a}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F9DF} ${e.name} will return!`}))}},"onDeath"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;n.healOnKill=(n.healOnKill||0)+1,e._lastBuffedCombatant=r}},"onSupport")});CardRegistry.registerCryptid("crawfishHorror",{name:"Crawfish Horror",sprite:"\u{1F99E}",spriteScale:1,element:"nature",cost:2,hp:3,atk:2,rarity:"common",combatAbility:"Hard Shell: When damaged, apply 1 curse to attacker",supportAbility:"Combatant gains Protection 1",onBeforeDefend:p((e,t,a)=>{a.applyCurse(t,1),GameEvents.emit("onCurseApplied",{source:e,target:t,tokens:1})},"onBeforeDefend"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;a.applyProtection(n,1),e._lastBuffedCombatant=r}},"onSupport")});CardRegistry.registerCryptid("letiche",{name:"Letiche",sprite:"\u{1F479}",spriteScale:1,element:"nature",cost:2,hp:2,atk:3,rarity:"common",evolvesInto:"swampStalker",combatAbility:"Feral: +2 ATK when attacking enemies on toxic tiles",supportAbility:"Create toxic tile in enemy combat column at turn start",onCombatAttack:p((e,t,a)=>a.isTileToxic(t.owner,t.col,t.row)?2:0,"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasLeticheSupport=!0},"onSupport"),onTurnStartSupport:p((e,t,a)=>{if(e.hasLeticheSupport){let n=t==="player"?"enemy":"player",r=a.getCombatCol(n),i=Math.floor(Math.random()*3);a.applyToxic(n,r,i)}},"onTurnStartSupport")});CardRegistry.registerCryptid("haint",{name:"Haint",sprite:"\u{1F47B}",spriteScale:1,element:"void",cost:2,hp:4,atk:1,rarity:"common",evolvesInto:"booHag",combatAbility:"Spirit Form: Immune to curse tokens",supportAbility:"Remove 1 curse token from combatant at turn start",onSummon:p((e,t,a)=>{e.curseImmune=!0},"onSummon"),onSupport:p((e,t,a)=>{e.hasHaintSupport=!0},"onSupport"),onTurnStartSupport:p((e,t,a)=>{if(e.hasHaintSupport){let n=a.getCombatant(e);n&&n.curseTokens>0&&(n.curseTokens--,GameEvents.emit("onCurseCleanse",{cryptid:n,owner:t,tokensRemaining:n.curseTokens}))}},"onTurnStartSupport")});CardRegistry.registerCryptid("ignisFatuus",{name:"Ignis Fatuus",sprite:"\u{1F4AB}",spriteScale:1,element:"nature",cost:3,hp:3,atk:2,rarity:"uncommon",evolvesFrom:"feuFollet",evolvesInto:"spiritFire",combatAbility:"Death Light: Attacks apply 2 curse. Enemies with 4+ curse die instantly",supportAbility:"All enemies gain 1 curse token at your turn start",onCombatAttack:p((e,t,a)=>(a.applyCurse(t,2),t.curseTokens>=4&&(t.killedBy="curseOverload",a.killCryptid(t,e.owner),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"damage",target:t,message:`\u{1F480} ${t.name} consumed by curse!`})),0),"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasIgnisFatuusSupport=!0},"onSupport"),onTurnStartSupport:p((e,t,a)=>{if(e.hasIgnisFatuusSupport){let r=(t==="player"?"enemy":"player")==="player"?a.playerField:a.enemyField;for(let i=0;i<2;i++)for(let o=0;o<3;o++){let s=r[i][o];s&&!s.curseImmune&&a.applyCurse(s,1)}}},"onTurnStartSupport")});CardRegistry.registerCryptid("plagueRat",{name:"Plague Rat",sprite:"\u{1F400}",spriteScale:1.1,element:"nature",cost:3,hp:3,atk:2,rarity:"uncommon",evolvesFrom:"swampRat",combatAbility:"Pestilence: Attacks apply bleed. Steal 1 pyre per bleed stack on target",supportAbility:"+1 pyre per enemy with status ailment at turn start (max 3)",attacksApplyBleed:!0,onCombatAttack:p((e,t,a)=>{let n=t.bleedTurns||0;if(n>0){let r=e.owner,i=t.owner,o=Math.min(n,i==="player"?a.playerPyre:a.enemyPyre);o>0&&(i==="player"?(a.playerPyre-=o,a.enemyPyre+=o):(a.enemyPyre-=o,a.playerPyre+=o),GameEvents.emit("onPyreStolen",{from:i,to:r,amount:o,source:e}))}return 0},"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasPlagueRatSupport=!0},"onSupport"),onTurnStartSupport:p((e,t,a)=>{if(e.hasPlagueRatSupport){let r=(t==="player"?"enemy":"player")==="player"?a.playerField:a.enemyField,i=0;for(let s=0;s<2;s++)for(let l=0;l<3;l++){let c=r[s][l];c&&a.hasStatusAilment(c)&&i++}let o=Math.min(i,3);o>0&&(t==="player"?a.playerPyre+=o:a.enemyPyre+=o,GameEvents.emit("onPyreGained",{owner:t,amount:o,source:"Plague Rat support"}))}},"onTurnStartSupport")});CardRegistry.registerCryptid("swampHag",{name:"Swamp Hag",sprite:"\u{1F9D9}\u200D\u2640\uFE0F",spriteScale:1,element:"nature",cost:3,hp:4,atk:2,rarity:"uncommon",evolvesFrom:"bayouSprite",evolvesInto:"mamaBrigitte",combatAbility:"Hex: Attacks disable enemy support abilities for 1 turn",supportAbility:"Enemy combatant across takes 1 damage at your turn start",onCombatAttack:p((e,t,a)=>{let n=a.getSupport(t);return n&&(n.hexed=!0,n.hexTurns=1,GameEvents.emit("onHex",{source:e,target:n}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"debuff",target:n,message:`\u{1F52E} ${n.name} hexed!`})),0},"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasSwampHagSupport=!0},"onSupport"),onTurnStartSupport:p((e,t,a)=>{if(e.hasSwampHagSupport){let n=a.getCombatant(e);if(n){let r=a.getEnemyCombatantAcross(n);r&&(r.currentHp-=1,GameEvents.emit("onSwampHagDamage",{source:e,target:r,damage:1}),r.currentHp<=0&&(r.killedBy="swampHagCurse",a.killCryptid(r,t)))}}},"onTurnStartSupport")});CardRegistry.registerCryptid("effigy",{name:"Effigy",sprite:"\u{1F5FF}",spriteScale:1,element:"void",cost:3,hp:4,atk:2,rarity:"uncommon",evolvesFrom:"voodooDoll",combatAbility:"Soul Link: Choose enemy on summon. All damage to Effigy splits with linked enemy",supportAbility:"When combatant takes lethal damage, may destroy Effigy to survive at 1 HP",onCombat:p((e,t,a)=>{let n=a.getEnemyCombatantAcross(e);n&&(e.soulLinkedTo=n,GameEvents.emit("onSoulLink",{source:e,target:n}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"debuff",target:n,message:`\u{1F517} Soul linked to ${n.name}!`}))},"onCombat"),onBeforeDefend:p((e,t,a)=>{e.soulLinkedTo&&e.soulLinkedTo.currentHp>0&&(e.splitDamageActive=!0)},"onBeforeDefend"),onAfterDefend:p((e,t,a,n)=>{if(e.splitDamageActive&&e.soulLinkedTo&&a>0){let r=Math.floor(a/2);r>0&&(e.soulLinkedTo.currentHp-=r,GameEvents.emit("onSoulLinkDamage",{source:e,target:e.soulLinkedTo,damage:r}),e.soulLinkedTo.currentHp<=0&&(e.soulLinkedTo.killedBy="soulLink",n.killCryptid(e.soulLinkedTo,e.owner))),e.splitDamageActive=!1}},"onAfterDefend"),onSupport:p((e,t,a)=>{e.hasEffigySupport=!0},"onSupport")});CardRegistry.registerCryptid("platEye",{name:"Plat-Eye",sprite:"\u{1F441}\uFE0F",spriteScale:1.1,element:"void",cost:4,hp:4,atk:3,rarity:"uncommon",evolvesFrom:"platEyePup",combatAbility:"Evil Eye: Attacks bypass protection. Reveals all hidden enemies",supportAbility:"Enemy support across has abilities disabled",hasFocus:!0,onCombat:p((e,t,a)=>{let r=(t==="player"?"enemy":"player")==="player"?a.playerField:a.enemyField;for(let i=0;i<2;i++)for(let o=0;o<3;o++){let s=r[i][o];s&&s.isHidden&&(s.isHidden=!1,GameEvents.emit("onReveal",{cryptid:s,revealedBy:e}))}},"onCombat"),onSupport:p((e,t,a)=>{e.negatesEnemySupport=!0},"onSupport")});CardRegistry.registerCryptid("spiritFire",{name:"Spirit Fire",sprite:"\u{1F525}",spriteScale:1.1,element:"void",cost:5,hp:4,atk:3,rarity:"rare",evolvesFrom:"ignisFatuus",combatAbility:"Attacks apply burn AND 2 curse. Enemies with 5+ curse explode on death",supportAbility:"Cursed enemies take 1 extra damage from all sources",attacksApplyBurn:!0,onCombatAttack:p((e,t,a)=>(a.applyCurse(t,2),t.curseTokens>=5&&(t.explodeOnDeath=!0),0),"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasSpiritFireSupport=!0},"onSupport")});CardRegistry.registerCryptid("booHag",{name:"Boo Hag",sprite:"\u{1F47A}",spriteScale:1,element:"void",cost:5,hp:3,atk:4,rarity:"rare",evolvesFrom:"haint",combatAbility:"Skin Ride: On kill, copy killed enemy's combat ability until end of next turn",supportAbility:"Once per turn, redirect attack targeting combatant to Boo Hag instead",curseImmune:!0,onKill:p((e,t,a)=>{t.onCombatAttack&&(e.copiedAbility=t.onCombatAttack,e.copiedAbilityName=t.name,e.copiedAbilityTurns=2,typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F3AD} ${e.name} copies ${t.name}'s power!`}))},"onKill"),onCombatAttack:p((e,t,a)=>e.copiedAbility&&e.copiedAbilityTurns>0&&e.copiedAbility(e,t,a)||0,"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasBooHagSupport=!0,e.booHagRedirectAvailable=!0},"onSupport")});CardRegistry.registerCryptid("revenant",{name:"Revenant",sprite:"\u{1F480}",spriteScale:1,element:"blood",cost:4,hp:4,atk:4,rarity:"rare",evolvesFrom:"zombie",evolvesInto:"draugrLord",combatAbility:"Grudge: Returns at 1 HP on first death. Gains +1/+1 permanently each death",supportAbility:"When combatant dies, may sacrifice Revenant to revive combatant at 2 HP",onSummon:p((e,t,a)=>{e.grudgeUsed=!1,e.deathCount=0},"onSummon"),onDeath:p((e,t)=>{e.grudgeUsed||(e.grudgeUsed=!0,e.preventDeath=!0,e.deathCount=(e.deathCount||0)+1,e.currentHp=1,e.currentAtk+=1,e.maxHp+=1,e.baseAtk+=1,e.baseHp+=1,GameEvents.emit("onGrudge",{cryptid:e,deathCount:e.deathCount}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F480} ${e.name} rises stronger! (+1/+1)`}))},"onDeath"),onSupport:p((e,t,a)=>{e.hasRevenantSupport=!0},"onSupport")});CardRegistry.registerCryptid("rougarou",{name:"Rougarou",sprite:"\u{1F43A}",spriteScale:1.1,element:"blood",cost:5,hp:4,atk:5,rarity:"rare",evolvesInto:"loupGarou",combatAbility:"Moon Frenzy: +2 ATK on odd turns. On kill while below half HP, fully heal",supportAbility:"Combatant gains +2 ATK and attacks apply bleed",onTurnStart:p((e,t,a)=>{let n=a.getCombatCol(t);e.col===n&&(a.turnNumber%2===1?(e.moonFrenzyActive=!0,e.bonusDamage=(e.bonusDamage||0)+2):(e.moonFrenzyActive=!1,e.bonusDamage=Math.max(0,(e.bonusDamage||0)-2)))},"onTurnStart"),onKill:p((e,t,a)=>{let n=e.maxHp||e.hp;e.currentHp<n/2&&(e.currentHp=n,GameEvents.emit("onHeal",{cryptid:e,amount:n,source:"Rougarou Moon Frenzy"}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F43A} ${e.name} fully heals from the kill!`}))},"onKill"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&(n.currentAtk+=2,n.attacksApplyBleed=!0)},"onSupport")});CardRegistry.registerCryptid("swampStalker",{name:"Swamp Stalker",sprite:"\u{1F98E}",spriteScale:1.1,element:"nature",cost:4,hp:3,atk:4,rarity:"rare",evolvesFrom:"letiche",combatAbility:"Ambush: +3 ATK on first attack. Creates toxic tiles in both enemy columns",supportAbility:"All toxic tiles deal +1 damage",onSummon:p((e,t,a)=>{e.ambushReady=!0},"onSummon"),onCombat:p((e,t,a)=>{let n=t==="player"?"enemy":"player";for(let r=0;r<2;r++){let i=Math.floor(Math.random()*3);a.applyToxic(n,r,i)}},"onCombat"),onCombatAttack:p((e,t,a)=>e.ambushReady?(e.ambushReady=!1,3):a.isTileToxic(t.owner,t.col,t.row)?2:0,"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasSwampStalkerSupport=!0},"onSupport")});CardRegistry.registerCryptid("mamaBrigitte",{name:"Mama Brigitte",sprite:"\u{1F478}",spriteScale:1.1,element:"void",cost:6,hp:5,atk:4,rarity:"ultimate",evolvesFrom:"swampHag",combatAbility:"Death's Bride: Immune to instant death. On kill, choose: heal 4 HP OR draw 2",supportAbility:"All ally deaths generate +2 pyre. Enemy kills heal your cryptids 1 HP each",onSummon:p((e,t,a)=>{e.instantDeathImmune=!0},"onSummon"),onKill:p((e,t,a)=>{let n=e.maxHp||e.hp;e.currentHp=Math.min(n,e.currentHp+4),GameEvents.emit("onHeal",{cryptid:e,amount:4,source:"Mama Brigitte"}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F478} ${e.name} draws power from death! (+4 HP)`})},"onKill"),onSupport:p((e,t,a)=>{e.hasMamaBrigitteSupport=!0,e._deathListener||(e._deathListener=n=>{n.owner===t&&(t==="player"?a.playerPyre+=2:a.enemyPyre+=2,GameEvents.emit("onPyreGained",{owner:t,amount:2,source:"Mama Brigitte"}))},GameEvents.on("onDeath",e._deathListener))},"onSupport"),onDeath:p((e,t)=>{if(e._deathListener){let a=GameEvents.listeners.onDeath?.indexOf(e._deathListener);a>-1&&GameEvents.listeners.onDeath.splice(a,1)}},"onDeath")});CardRegistry.registerCryptid("loupGarou",{name:"Loup-Garou",sprite:"\u{1F43A}",spriteScale:1.2,element:"blood",cost:7,hp:5,atk:7,rarity:"ultimate",evolvesFrom:"rougarou",combatAbility:"Alpha Predator: Double ATK on odd turns. On kill, may immediately attack again",supportAbility:"Combatant has +3 ATK and heals 3 HP after any kill",onTurnStart:p((e,t,a)=>{let n=a.getCombatCol(t);e.col===n&&(a.turnNumber%2===1?(e.moonFrenzyActive=!0,e.bonusDamage=e.currentAtk):(e.moonFrenzyActive=!1,e.bonusDamage=0))},"onTurnStart"),onKill:p((e,t,a)=>{e.canAttackAgain=!0,GameEvents.emit("onAlphaKill",{cryptid:e,victim:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F43A} ${e.name} hunts again!`})},"onKill"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);if(n){let r=n.id||`${n.key}-${n.col}-${n.row}`;if(e._lastBuffedCombatant===r)return;n.currentAtk=(n.currentAtk||n.atk)+3,n.healOnKill=(n.healOnKill||0)+3,e._lastBuffedCombatant=r}},"onSupport")});CardRegistry.registerCryptid("draugrLord",{name:"Draugr Lord",sprite:"\u{1F9DB}",spriteScale:1.1,element:"blood",cost:7,hp:6,atk:6,rarity:"ultimate",evolvesFrom:"revenant",combatAbility:"Undeath Eternal: Returns at full HP on first death. Each kill grants +1/+1. Destroyer",supportAbility:"All ally cryptids return at 1 HP on first death (once each)",hasDestroyer:!0,onSummon:p((e,t,a)=>{e.undeathUsed=!1},"onSummon"),onDeath:p((e,t)=>{e.undeathUsed||(e.undeathUsed=!0,e.preventDeath=!0,e.currentHp=e.maxHp,GameEvents.emit("onUndeathEternal",{cryptid:e}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"buff",target:e,message:`\u{1F451} ${e.name} defies death!`}))},"onDeath"),onKill:p((e,t,a)=>{e.currentAtk+=1,e.currentHp+=1,e.maxHp+=1,GameEvents.emit("onDraugrKill",{cryptid:e,victim:t})},"onKill"),onSupport:p((e,t,a)=>{e.hasDraugrLordSupport=!0;let n=t==="player"?a.playerField:a.enemyField;for(let r=0;r<2;r++)for(let i=0;i<3;i++){let o=n[r][i];o&&o!==e&&!o.draugrUndying&&(o.draugrUndying=!0)}},"onSupport")});CardRegistry.registerCryptid("baronSamedi",{name:"Baron Samedi",sprite:"\u{1F3A9}",spriteScale:1.2,element:"void",cost:8,hp:7,atk:5,rarity:"ultimate",mythical:!0,maxCopies:1,combatAbility:"Lord of the Dead: Cannot die while cryptids in discard. On attack, resurrect common to support",supportAbility:"At turn start, pay 3 pyre to resurrect any cryptid from discard to combat at 1 HP",onBeforeDefend:p((e,t,a)=>{(e.owner==="player"?a.playerDiscardPile:a.enemyDiscardPile).some(i=>i.type==="cryptid")&&(e.cannotDie=!0)},"onBeforeDefend"),onAfterDefend:p((e,t,a,n)=>{if(e.cannotDie&&e.currentHp<=0){e.currentHp=1,e.preventDeath=!0;let r=e.owner==="player"?n.playerDiscardPile:n.enemyDiscardPile,i=r.findIndex(o=>o.type==="cryptid");if(i>-1){let o=r.splice(i,1)[0];GameEvents.emit("onBaronConsume",{baron:e,consumed:o})}}e.cannotDie=!1},"onAfterDefend"),onCombatAttack:p((e,t,a)=>{let n=e.owner,r=n==="player"?a.playerDiscardPile:a.enemyDiscardPile,i=a.getSupportCol(n),o=n==="player"?a.playerField:a.enemyField,s=-1;for(let l=0;l<3;l++)if(!o[i][l]){s=l;break}if(s>=0){let l=r.findIndex(c=>c.type==="cryptid"&&c.rarity==="common");if(l>-1){let c=r.splice(l,1)[0];a.summonCryptid(n,i,s,c);let m=o[i][s];m&&(m.currentHp=1),GameEvents.emit("onResurrect",{source:e,resurrected:c,row:s})}}return 0},"onCombatAttack"),onSupport:p((e,t,a)=>{e.hasBaronSamediSupport=!0},"onSupport")});CardRegistry.registerCryptid("honeyIslandMonster",{name:"Honey Island Monster",sprite:"\u{1F98D}",spriteScale:1.2,element:"nature",cost:5,hp:6,atk:5,rarity:"rare",mythical:!0,maxCopies:1,combatAbility:"Ambush Predator: +3 damage on first attack. Destroys enemy trap in same row on enter",supportAbility:"Combatant cannot be targeted by traps or bursts",onSummon:p((e,t,a)=>{e.firstAttack=!0},"onSummon"),onCombat:p((e,t,a)=>{let n=t==="player"?"enemy":"player",r=n==="player"?a.playerTraps:a.enemyTraps;if(r[e.row]){let i=r[e.row];r[e.row]=null,GameEvents.emit("onTrapDestroyed",{trap:i,destroyer:e}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"damage",target:{owner:n,row:e.row},message:`\u{1F4A5} ${e.name} destroys enemy trap!`})}},"onCombat"),onCombatAttack:p((e,t,a)=>e.firstAttack?(e.firstAttack=!1,3):0,"onCombatAttack"),onSupport:p((e,t,a)=>{let n=a.getCombatant(e);n&&(n.trapImmune=!0,n.burstImmune=!0)},"onSupport")});CardRegistry.registerPyre("grisGrisBag",{name:"Gris-Gris Bag",sprite:"\u{1F45D}",rarity:"common",description:"+1 pyre. Remove all curse tokens from one of your cryptids",pyreGain:1,effect:p((e,t)=>{t==="player"?e.playerPyre++:e.enemyPyre++;let a=t==="player"?e.playerField:e.enemyField,n=[];for(let r=0;r<2;r++)for(let i=0;i<3;i++){let o=a[r][i];o&&o.curseTokens>0&&n.push(o)}if(n.length>0){let r=n[Math.floor(Math.random()*n.length)];r.curseTokens=0,GameEvents.emit("onCurseCleanse",{cryptid:r,owner:t,tokensRemaining:0})}return GameEvents.emit("onPyreGained",{owner:t,amount:1,source:"Gris-Gris Bag"}),{pyreGained:1}},"effect")});CardRegistry.registerPyre("swampGas",{name:"Swamp Gas",sprite:"\u{1F4A8}",rarity:"uncommon",description:"+1 pyre, +1 per toxic tile on field (max +3 bonus)",pyreGain:1,effect:p((e,t)=>{let a=0;for(let i of["player","enemy"]){let o=i==="player"?e.playerToxicTiles:e.enemyToxicTiles;for(let s=0;s<2;s++)for(let l=0;l<3;l++)o[s][l]>0&&a++}let r=1+Math.min(a,3);return t==="player"?e.playerPyre+=r:e.enemyPyre+=r,GameEvents.emit("onPyreGained",{owner:t,amount:r,source:"Swamp Gas",toxicCount:a}),{pyreGained:r,toxicCount:a}},"effect")});CardRegistry.registerBurst("hexCurse",{name:"Hex Curse",sprite:"\u{1F52E}",cost:2,rarity:"common",targetType:"enemy",description:"Apply 3 curse tokens to target enemy cryptid",effect:p((e,t,a,n)=>{let r=n?.target;return r?(e.applyCurse(r,3),GameEvents.emit("onHexCurse",{target:r,tokens:3}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"debuff",target:r,message:`\u{1F52E} ${r.name} is hexed! (-3 ATK)`}),!0):!1},"effect")});CardRegistry.registerTrap("hungryGround",{name:"Hungry Ground",sprite:"\u{1F573}\uFE0F",cost:4,rarity:"rare",triggerType:"onEnemyDeath",description:"When enemy cryptid dies: Remove from game (not to discard). Gain 2 pyre",effect:p((e,t,a,n)=>{let r=n?.cryptid;if(!r)return!1;let o=(t==="player"?"enemy":"player")==="player"?e.playerDiscardPile:e.enemyDiscardPile,s=o.findIndex(l=>l.id===r.id);return s>-1&&o.splice(s,1),t==="player"?e.playerPyre+=2:e.enemyPyre+=2,GameEvents.emit("onHungryGround",{consumed:r,owner:t}),typeof queueAbilityAnimation<"u"&&queueAbilityAnimation({type:"damage",target:r,message:`\u{1F573}\uFE0F The swamp consumes ${r.name}!`}),!0},"effect")});CardRegistry.registerAura("curseVessel",{name:"Curse Vessel",sprite:"\u26B1\uFE0F",cost:1,rarity:"common",description:"+1 ATK per curse token on ALL enemies (max +4). Attacks apply 1 curse",atkBonus:0,hpBonus:0,onApply:p((e,t,a)=>{t.attacksApplyCurse=(t.attacksApplyCurse||0)+1,t.hasCurseVessel=!0},"onApply"),onAttackBonus:p((e,t,a,n)=>{let i=(t.owner==="player"?"enemy":"player")==="player"?n.playerField:n.enemyField,o=0;for(let s=0;s<2;s++)for(let l=0;l<3;l++){let c=i[s][l];c&&c.curseTokens>0&&(o+=c.curseTokens)}return Math.min(o,4)},"onAttackBonus")});console.log("Putrid Swamp cards loaded:",Object.keys(CardRegistry.cryptids).filter(e=>["zombie","crawfishHorror","letiche","haint","ignisFatuus","plagueRat","swampHag","effigy","platEye","spiritFire","booHag","revenant","rougarou","swampStalker","mamaBrigitte","loupGarou","draugrLord","baronSamedi","honeyIslandMonster"].includes(e)).length,"cryptids |",Object.keys(CardRegistry.kindling||{}).filter(e=>["feuFollet","swampRat","bayouSprite","voodooDoll","platEyePup"].includes(e)).length,"kindling |",Object.keys(CardRegistry.pyres||{}).filter(e=>["grisGrisBag","swampGas"].includes(e)).length,"pyres |",Object.keys(CardRegistry.auras||{}).filter(e=>["curseVessel"].includes(e)).length,"auras |",Object.keys(CardRegistry.traps||{}).filter(e=>["hungryGround"].includes(e)).length,"traps |",Object.keys(CardRegistry.bursts||{}).filter(e=>["hexCurse"].includes(e)).length,"bursts")});var Fe=M(()=>{"use strict";window.CombatEffects={config:{screenShakeIntensity:1,particlesEnabled:!0,impactFlashEnabled:!0},screenShake(e=1,t=300){let a=document.getElementById("battlefield-area");if(!a)return;let n=6*e*this.config.screenShakeIntensity;a.classList.add("screen-shaking"),a.style.setProperty("--shake-intensity",n+"px"),setTimeout(()=>{a.classList.remove("screen-shaking"),a.style.removeProperty("--shake-intensity")},t)},heavyImpact(e=1){let t=Math.min(.5+e*.15,2);this.screenShake(t,350)},lightImpact(){this.screenShake(.4,200)},createImpactParticles(e,t,a="#ff6b6b",n=8){if(!this.config.particlesEnabled)return;let r=document.getElementById("battlefield-area");if(!r)return;let i=document.createElement("div");i.className="impact-particles",i.style.left=e+"px",i.style.top=t+"px";for(let o=0;o<n;o++){let s=document.createElement("div");s.className="impact-particle";let l=Math.PI*2/n*o+(Math.random()*.5-.25),c=30+Math.random()*40,m=Math.cos(l)*c,f=Math.sin(l)*c-20;s.style.setProperty("--tx",m+"px"),s.style.setProperty("--ty",f+"px"),s.style.setProperty("--particle-color",a),s.style.animationDelay=Math.random()*50+"ms",i.appendChild(s)}r.appendChild(i),setTimeout(()=>i.remove(),600)},createSparks(e,t,a=12){if(!this.config.particlesEnabled)return;let n=document.getElementById("battlefield-area");if(!n)return;let r=document.createElement("div");r.className="spark-container",r.style.left=e+"px",r.style.top=t+"px";for(let i=0;i<a;i++){let o=document.createElement("div");o.className="spark";let s=Math.random()*Math.PI*2,l=20+Math.random()*60,c=Math.cos(s)*l,m=Math.sin(s)*l-15;o.style.setProperty("--tx",c+"px"),o.style.setProperty("--ty",m+"px"),o.style.animationDelay=Math.random()*30+"ms",o.style.animationDuration=200+Math.random()*200+"ms",r.appendChild(o)}n.appendChild(r),setTimeout(()=>r.remove(),500)},createImpactFlash(e,t,a=80){if(!this.config.impactFlashEnabled)return;let n=document.getElementById("battlefield-area");if(!n)return;let r=document.createElement("div");r.className="impact-flash",r.style.left=e+"px",r.style.top=t+"px",r.style.width=a+"px",r.style.height=a+"px",n.appendChild(r),setTimeout(()=>r.remove(),200)},showDamageNumber(e,t,a=!1,n=!1){if(!e)return;let r=`${e.owner}-${e.col}-${e.row}`,i=window.tilePositions?.[r];if(!i)return;let o=document.getElementById("battlefield-area");if(!o)return;let s=document.createElement("div");s.className="damage-number-container";let l=Math.min(1+t*.08,1.8);n?(s.classList.add("blocked"),s.innerHTML='<span class="damage-text">BLOCKED</span>'):(s.classList.add(a?"critical":"normal"),s.innerHTML=`
                <span class="damage-text" style="--damage-scale: ${l}">-${t}</span>
                ${a?'<span class="crit-label">CRIT!</span>':""}
            `);let c=(Math.random()-.5)*30;s.style.left=i.x+c+"px",s.style.top=i.y-40+"px",o.appendChild(s),setTimeout(()=>s.remove(),1200)},showHealNumber(e,t){if(!e||!t)return;let a=`${e.owner}-${e.col}-${e.row}`,n=window.tilePositions?.[a];if(!n)return;let r=document.getElementById("battlefield-area");if(!r)return;let i=document.createElement("div");i.className="heal-number-container",i.innerHTML=`<span class="heal-text">+${t}</span>`;let o=(Math.random()-.5)*20;i.style.left=n.x+o+"px",i.style.top=n.y-40+"px",r.appendChild(i),setTimeout(()=>i.remove(),1e3)},playAttackSequence(e,t,a,n){if(!e||!t){n&&n();return}let r=t.getBoundingClientRect(),i=document.getElementById("battlefield-area").getBoundingClientRect(),o=r.left+r.width/2-i.left,s=r.top+r.height/2-i.top;e.classList.add("attack-windup"),setTimeout(()=>{e.classList.remove("attack-windup"),e.classList.add("attack-lunge"),setTimeout(()=>{this.createImpactFlash(o,s,100),this.createSparks(o,s,15),this.createImpactParticles(o,s,"#ff4444",10),this.heavyImpact(a),t.classList.add("hit-recoil");let l=t.querySelector(".combat-stats");l&&(l.classList.add("damage-flash"),setTimeout(()=>l.classList.remove("damage-flash"),300)),setTimeout(()=>{e.classList.remove("attack-lunge"),e.classList.add("attack-return"),t.classList.remove("hit-recoil"),setTimeout(()=>{e.classList.remove("attack-return"),n&&n()},200)},150)},180)},150)},animateHPChange(e,t,a){let n=document.querySelector(`.cryptid-sprite[data-owner="${e.owner}"][data-col="${e.col}"][data-row="${e.row}"]`);if(!n)return;let r=n.querySelector(".hp-arc"),i=n.querySelector(".hp-badge .stat-value");if(!i)return;let o=e.maxHp||e.hp,s=Math.max(0,a/o*100);if(r){r.classList.remove("hp-low","hp-medium"),s<=25?r.classList.add("hp-low"):s<=50&&r.classList.add("hp-medium");let c=5+45*(1-s/100),f=e.owner==="player"?`inset(${c}% 50% ${c}% 0)`:`inset(${c}% 0 ${c}% 50%)`;r.style.clipPath=f}let l=a-t;l<0?(i.classList.add("decreased"),setTimeout(()=>i.classList.remove("decreased"),400)):l>0&&(i.classList.add("increased"),setTimeout(()=>i.classList.remove("increased"),400)),i.textContent=a},animateATKChange(e,t,a){let n=document.querySelector(`.cryptid-sprite[data-owner="${e.owner}"][data-col="${e.col}"][data-row="${e.row}"]`);if(!n)return;let r=n.querySelector(".atk-badge .stat-value");if(!r)return;let i=a-t;i>0?(r.classList.add("increased"),setTimeout(()=>r.classList.remove("increased"),500)):i<0&&(r.classList.add("decreased"),setTimeout(()=>r.classList.remove("decreased"),500)),r.textContent=a}};p((function(){if(document.getElementById("combat-effects-styles"))return;let t=document.createElement("style");t.id="combat-effects-styles",t.textContent=`
        /* ==================== SCREEN SHAKE ==================== */
        @keyframes screenShake {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(calc(var(--shake-intensity, 6px) * -0.8), calc(var(--shake-intensity, 6px) * 0.4)); }
            20% { transform: translate(calc(var(--shake-intensity, 6px) * 0.6), calc(var(--shake-intensity, 6px) * -0.6)); }
            30% { transform: translate(calc(var(--shake-intensity, 6px) * -0.4), calc(var(--shake-intensity, 6px) * 0.8)); }
            40% { transform: translate(calc(var(--shake-intensity, 6px) * 0.8), calc(var(--shake-intensity, 6px) * 0.2)); }
            50% { transform: translate(calc(var(--shake-intensity, 6px) * -0.6), calc(var(--shake-intensity, 6px) * -0.4)); }
            60% { transform: translate(calc(var(--shake-intensity, 6px) * 0.3), calc(var(--shake-intensity, 6px) * 0.6)); }
            70% { transform: translate(calc(var(--shake-intensity, 6px) * -0.2), calc(var(--shake-intensity, 6px) * -0.3)); }
            80% { transform: translate(calc(var(--shake-intensity, 6px) * 0.1), calc(var(--shake-intensity, 6px) * 0.2)); }
            90% { transform: translate(calc(var(--shake-intensity, 6px) * -0.05), calc(var(--shake-intensity, 6px) * -0.1)); }
        }
        
        #battlefield-area.screen-shaking {
            animation: screenShake 0.35s ease-out;
        }
        
        /* ==================== IMPACT PARTICLES ==================== */
        .impact-particles {
            position: absolute;
            pointer-events: none;
            z-index: 1000;
        }
        
        .impact-particle {
            position: absolute;
            width: 8px;
            height: 8px;
            background: var(--particle-color, #ff6b6b);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--particle-color, #ff6b6b), 0 0 20px var(--particle-color, #ff6b6b);
            animation: particleBurst 0.5s ease-out forwards;
        }
        
        @keyframes particleBurst {
            0% {
                transform: translate(0, 0) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0);
                opacity: 0;
            }
        }
        
        /* ==================== SPARKS ==================== */
        .spark-container {
            position: absolute;
            pointer-events: none;
            z-index: 1001;
        }
        
        .spark {
            position: absolute;
            width: 4px;
            height: 4px;
            background: #fff;
            border-radius: 50%;
            box-shadow: 0 0 6px #fff, 0 0 12px #ffdd44, 0 0 18px #ff8800;
            animation: sparkFly 0.3s ease-out forwards;
        }
        
        @keyframes sparkFly {
            0% {
                transform: translate(0, 0) scale(1.5);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0);
                opacity: 0;
            }
        }
        
        /* ==================== IMPACT FLASH ==================== */
        .impact-flash {
            position: absolute;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,200,100,0.6) 40%, transparent 70%);
            pointer-events: none;
            z-index: 999;
            animation: flashPulse 0.2s ease-out forwards;
        }
        
        @keyframes flashPulse {
            0% {
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(1.5);
                opacity: 0;
            }
        }
        
        /* ==================== DAMAGE NUMBERS ==================== */
        .damage-number-container {
            position: absolute;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 1100;
            animation: damageFloat 1.2s ease-out forwards;
            text-align: center;
        }
        
        .damage-number-container .damage-text {
            font-family: 'Trebuchet MS', 'Impact', sans-serif;
            font-size: calc(24px * var(--damage-scale, 1));
            font-weight: 900;
            color: #fff;
            text-shadow: 
                0 0 4px #ff0000,
                0 2px 0 #880000,
                0 3px 0 #660000,
                0 4px 8px rgba(0,0,0,0.8),
                0 0 20px rgba(255,0,0,0.5);
            display: block;
            animation: damageImpact 0.3s ease-out;
        }
        
        .damage-number-container.critical .damage-text {
            font-size: calc(32px * var(--damage-scale, 1));
            color: #ffdd00;
            text-shadow: 
                0 0 8px #ff8800,
                0 2px 0 #cc6600,
                0 3px 0 #994400,
                0 4px 10px rgba(0,0,0,0.9),
                0 0 30px rgba(255,150,0,0.6);
            animation: critImpact 0.4s ease-out;
        }
        
        .damage-number-container .crit-label {
            font-family: 'Trebuchet MS', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #ffaa00;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            animation: critLabelPop 0.5s ease-out;
        }
        
        .damage-number-container.blocked .damage-text {
            font-size: 18px;
            color: #88ccff;
            text-shadow: 
                0 0 6px #4488ff,
                0 2px 4px rgba(0,0,0,0.8);
        }
        
        @keyframes damageFloat {
            0% { opacity: 1; transform: translate(-50%, -50%); }
            20% { opacity: 1; transform: translate(-50%, calc(-50% - 20px)); }
            100% { opacity: 0; transform: translate(-50%, calc(-50% - 60px)); }
        }
        
        @keyframes damageImpact {
            0% { transform: scale(0.3); }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); }
        }
        
        @keyframes critImpact {
            0% { transform: scale(0.2) rotate(-10deg); }
            30% { transform: scale(1.5) rotate(5deg); }
            50% { transform: scale(1.2) rotate(-3deg); }
            100% { transform: scale(1) rotate(0deg); }
        }
        
        @keyframes critLabelPop {
            0% { opacity: 0; transform: translateY(10px) scale(0.5); }
            50% { opacity: 1; transform: translateY(-5px) scale(1.2); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        /* ==================== HEAL NUMBERS ==================== */
        .heal-number-container {
            position: absolute;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 1100;
            animation: healFloat 1s ease-out forwards;
        }
        
        .heal-number-container .heal-text {
            font-family: 'Trebuchet MS', sans-serif;
            font-size: 22px;
            font-weight: 900;
            color: #44ff88;
            text-shadow: 
                0 0 6px #22cc66,
                0 2px 0 #118844,
                0 3px 6px rgba(0,0,0,0.8),
                0 0 15px rgba(68,255,136,0.4);
            animation: healPop 0.3s ease-out;
        }
        
        @keyframes healFloat {
            0% { opacity: 1; transform: translate(-50%, -50%); }
            100% { opacity: 0; transform: translate(-50%, calc(-50% - 50px)); }
        }
        
        @keyframes healPop {
            0% { transform: scale(0.5); }
            60% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        
        /* ==================== ATTACK ANIMATIONS ==================== */
        .cryptid-sprite.attack-windup {
            animation: attackWindup 0.15s ease-out forwards !important;
        }
        
        .cryptid-sprite.attack-lunge {
            animation: attackLunge 0.18s ease-out forwards !important;
        }
        
        .cryptid-sprite.attack-return {
            animation: attackReturn 0.2s ease-out forwards !important;
        }
        
        .cryptid-sprite.hit-recoil {
            animation: hitRecoil 0.25s ease-out !important;
        }
        
        /* Player attacks right */
        @keyframes attackWindup {
            0% { transform: translate(-50%, -50%); }
            100% { transform: translate(calc(-50% - 15px), calc(-50% - 8px)) scale(1.15); }
        }
        
        @keyframes attackLunge {
            0% { transform: translate(calc(-50% - 15px), calc(-50% - 8px)) scale(1.15); }
            100% { transform: translate(calc(-50% + 60px), -50%) scale(1.1); }
        }
        
        @keyframes attackReturn {
            0% { transform: translate(calc(-50% + 60px), -50%) scale(1.1); }
            40% { transform: translate(calc(-50% - 8px), -50%) scale(0.95); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        
        @keyframes hitRecoil {
            0% { 
                transform: translate(-50%, -50%); 
                filter: brightness(3) saturate(0);
            }
            20% { 
                transform: translate(calc(-50% + 20px), calc(-50% - 5px)) scale(0.9); 
                filter: brightness(2) saturate(0.5);
            }
            50% { 
                transform: translate(calc(-50% + 10px), -50%) scale(0.95); 
                filter: brightness(0.6);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
                filter: brightness(1);
            }
        }
        
        /* Enemy attacks left - mirror the animations */
        .cryptid-sprite.enemy.attack-windup {
            animation: attackWindupLeft 0.15s ease-out forwards !important;
        }
        
        .cryptid-sprite.enemy.attack-lunge {
            animation: attackLungeLeft 0.18s ease-out forwards !important;
        }
        
        .cryptid-sprite.enemy.attack-return {
            animation: attackReturnLeft 0.2s ease-out forwards !important;
        }
        
        .cryptid-sprite.enemy.hit-recoil {
            animation: hitRecoilLeft 0.25s ease-out !important;
        }
        
        @keyframes attackWindupLeft {
            0% { transform: translate(-50%, -50%); }
            100% { transform: translate(calc(-50% + 15px), calc(-50% - 8px)) scale(1.15); }
        }
        
        @keyframes attackLungeLeft {
            0% { transform: translate(calc(-50% + 15px), calc(-50% - 8px)) scale(1.15); }
            100% { transform: translate(calc(-50% - 60px), -50%) scale(1.1); }
        }
        
        @keyframes attackReturnLeft {
            0% { transform: translate(calc(-50% - 60px), -50%) scale(1.1); }
            40% { transform: translate(calc(-50% + 8px), -50%) scale(0.95); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        
        @keyframes hitRecoilLeft {
            0% { 
                transform: translate(-50%, -50%); 
                filter: brightness(3) saturate(0);
            }
            20% { 
                transform: translate(calc(-50% - 20px), calc(-50% - 5px)) scale(0.9); 
                filter: brightness(2) saturate(0.5);
            }
            50% { 
                transform: translate(calc(-50% - 10px), -50%) scale(0.95); 
                filter: brightness(0.6);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
                filter: brightness(1);
            }
        }
        
        /* ==================== CRESCENT MOON STAT BAR ==================== */
        .cryptid-sprite .combat-stats {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            /* Scale with sprite size - base is ~40px sprite, stats are ~56px tall */
            width: calc(var(--sprite-size, 40px) * 0.7);
            height: calc(var(--sprite-size, 40px) * 1.4);
            z-index: 10;
            pointer-events: none;
        }
        
        /* Player monsters: stats on LEFT */
        .cryptid-sprite[data-owner="player"] .combat-stats {
            left: calc(var(--sprite-size, 40px) * -0.45);
            right: auto;
        }
        
        /* Enemy monsters: stats on RIGHT */
        .cryptid-sprite[data-owner="enemy"] .combat-stats {
            right: calc(var(--sprite-size, 40px) * -0.45);
            left: auto;
        }
        
        /* Crescent background arc */
        .combat-stats .crescent-bg {
            position: absolute;
            width: calc(var(--sprite-size, 40px) * 1.1);
            height: calc(var(--sprite-size, 40px) * 1.4);
            border: 2px solid rgba(50, 45, 40, 0.9);
            border-radius: 50%;
            background: linear-gradient(90deg, rgba(25, 22, 18, 0.85) 30%, transparent 70%);
            box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }
        
        /* Player: arc curves to the right (clip left half visible) */
        .cryptid-sprite[data-owner="player"] .crescent-bg {
            right: 0;
            clip-path: inset(0 50% 0 0);
            border-right-color: transparent;
        }
        
        /* Enemy: arc curves to the left (clip right half visible) */
        .cryptid-sprite[data-owner="enemy"] .crescent-bg {
            left: 0;
            clip-path: inset(0 0 0 50%);
            border-left-color: transparent;
            background: linear-gradient(-90deg, rgba(25, 22, 18, 0.85) 30%, transparent 70%);
        }
        
        /* HP Arc - glowing indicator */
        .combat-stats .hp-arc {
            position: absolute;
            width: calc(var(--sprite-size, 40px) * 1.1);
            height: calc(var(--sprite-size, 40px) * 1.4);
            border: 2px solid transparent;
            border-radius: 50%;
            transition: clip-path 0.4s ease-out;
        }
        
        /* Player HP arc - clip-path set dynamically via inline style */
        .cryptid-sprite[data-owner="player"] .hp-arc {
            right: 0;
            border-left: 2px solid #44dd77;
            filter: drop-shadow(0 0 6px rgba(68, 221, 119, 0.6));
        }
        
        .cryptid-sprite[data-owner="player"] .hp-arc.hp-medium {
            border-left-color: #ddaa22;
            filter: drop-shadow(0 0 6px rgba(221, 170, 34, 0.6));
        }
        
        .cryptid-sprite[data-owner="player"] .hp-arc.hp-low {
            border-left-color: #dd4444;
            filter: drop-shadow(0 0 6px rgba(221, 68, 68, 0.6));
            animation: hpLowPulse 1s ease-in-out infinite;
        }
        
        /* Enemy HP arc */
        .cryptid-sprite[data-owner="enemy"] .hp-arc {
            left: 0;
            border-right: 2px solid #ff6666;
            filter: drop-shadow(0 0 6px rgba(255, 102, 102, 0.6));
        }
        
        .cryptid-sprite[data-owner="enemy"] .hp-arc.hp-medium {
            border-right-color: #ddaa22;
            filter: drop-shadow(0 0 6px rgba(221, 170, 34, 0.6));
        }
        
        .cryptid-sprite[data-owner="enemy"] .hp-arc.hp-low {
            border-right-color: #dd4444;
            filter: drop-shadow(0 0 6px rgba(221, 68, 68, 0.6));
            animation: hpLowPulse 1s ease-in-out infinite;
        }
        
        @keyframes hpLowPulse {
            0%, 100% { opacity: 1; filter: drop-shadow(0 0 6px rgba(221, 68, 68, 0.6)); }
            50% { opacity: 0.7; filter: drop-shadow(0 0 10px rgba(255, 50, 50, 0.9)); }
        }
        
        /* Stat badges */
        .combat-stats .stat-badge {
            position: absolute;
            background: rgba(15, 12, 10, 0.95);
            border: 1px solid rgba(120, 100, 70, 0.5);
            border-radius: 4px;
            padding: 1px 3px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
            min-width: calc(var(--sprite-size, 40px) * 0.45);
        }
        
        /* Player badge positions (on left side) */
        .cryptid-sprite[data-owner="player"] .stat-badge.atk-badge {
            top: 2px;
            left: 0px;
        }
        
        .cryptid-sprite[data-owner="player"] .stat-badge.hp-badge {
            bottom: 2px;
            left: 0px;
        }
        
        /* Enemy badge positions (on right side) */
        .cryptid-sprite[data-owner="enemy"] .stat-badge.atk-badge {
            top: 2px;
            right: 0px;
        }
        
        .cryptid-sprite[data-owner="enemy"] .stat-badge.hp-badge {
            bottom: 2px;
            right: 0px;
        }
        
        .combat-stats .stat-icon {
            font-size: calc(var(--sprite-size, 40px) * 0.18);
            line-height: 1;
        }
        
        .combat-stats .atk-badge .stat-icon { color: #ff8888; }
        .combat-stats .hp-badge .stat-icon { color: #88ffaa; }
        
        .combat-stats .stat-value {
            font-family: 'Trebuchet MS', sans-serif;
            font-size: calc(var(--sprite-size, 40px) * 0.28);
            font-weight: 800;
            line-height: 1;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            transition: transform 0.2s, color 0.2s;
        }
        
        .combat-stats .atk-badge .stat-value {
            color: #ff9999;
        }
        
        .combat-stats .hp-badge .stat-value {
            color: #99ffbb;
        }
        
        /* Evolution pips - below HP badge */
        .combat-stats .evo-pips {
            position: absolute;
            bottom: -8px;
            display: flex;
            gap: 2px;
        }
        
        .cryptid-sprite[data-owner="player"] .evo-pips {
            left: 4px;
        }
        
        .cryptid-sprite[data-owner="enemy"] .evo-pips {
            right: 4px;
        }
        
        .combat-stats .evo-pip {
            width: calc(var(--sprite-size, 40px) * 0.1);
            height: calc(var(--sprite-size, 40px) * 0.1);
            background: linear-gradient(135deg, #88ddff, #44aaff);
            border-radius: 50%;
            box-shadow: 0 0 3px rgba(100, 180, 255, 0.6);
        }
        
        /* Stat change animations */
        .combat-stats .stat-value.decreased {
            animation: statDecrease 0.4s ease-out;
        }
        
        .combat-stats .stat-value.increased {
            animation: statIncrease 0.4s ease-out;
        }
        
        .combat-stats.damage-flash .hp-arc {
            animation: arcDamageFlash 0.3s ease-out;
        }
        
        .combat-stats.damage-flash .hp-badge {
            animation: badgeDamageFlash 0.3s ease-out;
        }
        
        @keyframes statDecrease {
            0% { transform: scale(1); }
            30% { transform: scale(1.5); color: #ff3333; }
            100% { transform: scale(1); }
        }
        
        @keyframes statIncrease {
            0% { transform: scale(1); }
            50% { transform: scale(1.4); color: #44ff88; }
            100% { transform: scale(1); }
        }
        
        @keyframes arcDamageFlash {
            0% { filter: drop-shadow(0 0 8px currentColor); }
            30% { filter: drop-shadow(0 0 20px #ff0000) brightness(2); }
            100% { filter: drop-shadow(0 0 8px currentColor); }
        }
        
        @keyframes badgeDamageFlash {
            0% { background: rgba(15, 12, 10, 0.95); }
            30% { background: rgba(80, 20, 20, 0.95); box-shadow: 0 0 15px rgba(255,0,0,0.5); }
            100% { background: rgba(15, 12, 10, 0.95); }
        }
        
        /* Hide old stat bar */
        .cryptid-sprite .stat-bar {
            display: none !important;
        }
    `,document.head.appendChild(t)}),"injectCombatStyles")();window.showFloatingDamage=function(e,t){CombatEffects.showDamageNumber(e,t,t>=5)};window.showFloatingHeal=function(e,t){CombatEffects.showHealNumber(e,t)};console.log("[CombatEffects] System loaded")});var ct=M(()=>{"use strict";var y={listeners:{},on(e,t,a=null){this.listeners[e]||(this.listeners[e]=[]);let n={callback:t,context:a};return this.listeners[e].push(n),()=>{let r=this.listeners[e].indexOf(n);r>-1&&this.listeners[e].splice(r,1)}},once(e,t){let a=this.on(e,(...n)=>{a(),t(...n)})},emit(e,t={}){if(!this.listeners[e])return;let a={...t,eventName:e,timestamp:Date.now()};for(let n of this.listeners[e])try{n.context?n.callback.call(n.context,a):n.callback(a)}catch(r){console.error(`Error in event listener for ${e}:`,r)}},off(e=null){e?delete this.listeners[e]:this.listeners={}},listenerCount(e){return this.listeners[e]?.length||0}};window.GameEvents=y;function zt(e){if(!e)return;let t=e.querySelectorAll(".gc-ability-box"),a=e.closest(".game-card");if(!a)return;let n=a.offsetWidth||100;t.forEach(r=>{if(!r.textContent.trim()||(r.style.fontSize="",r.offsetWidth-4<=0))return;let s=n*.055,l=n*.028,c=s;r.style.fontSize=c+"px";let m=0;for(;r.scrollWidth>r.offsetWidth&&c>l&&m<20;)c-=.5,r.style.fontSize=c+"px",m++})}p(zt,"autoScaleAbilityText");function _e(){requestAnimationFrame(()=>{document.querySelectorAll(".game-card .gc-abilities").forEach(e=>{zt(e)})})}p(_e,"scaleAllAbilityText");function Z(){Ze()}p(Z,"applyCardFanLayout");function Lt(){let e=document.getElementById("hand-container");if(e){e.addEventListener("wheel",r=>{if(e.scrollWidth>e.clientWidth){r.preventDefault();let i=r.deltaY!==0?r.deltaY:r.deltaX;e.scrollLeft+=i}},{passive:!1});let t=!1,a=0,n=0;e.addEventListener("mousedown",r=>{(r.target===e||r.target.classList.contains("hand-scroll-wrapper"))&&(t=!0,e.style.cursor="grabbing",a=r.pageX-e.offsetLeft,n=e.scrollLeft)}),document.addEventListener("mousemove",r=>{if(!t)return;r.preventDefault();let o=(r.pageX-e.offsetLeft-a)*1.5;e.scrollLeft=n-o}),document.addEventListener("mouseup",()=>{t&&(t=!1,e.style.cursor="")})}}p(Lt,"setupFanHoverEffects");var Oe=!1;function ye(){Oe||(Lt(),Oe=!0)}p(ye,"ensureFanHoverEffects");function qe(e){let t=["draw","conjure1","combat","conjure2","end"],a=document.querySelectorAll(".phase-timeline .phase-node"),n=document.querySelectorAll(".phase-timeline .phase-connector"),r=t.indexOf(e);a.forEach((i,o)=>{i.classList.remove("active","completed"),o<r?i.classList.add("completed"):o===r&&i.classList.add("active")}),n.forEach((i,o)=>{i.classList.remove("completed"),o<r&&i.classList.add("completed")})}p(qe,"updatePhaseTimeline");function Mt(){let e=document.getElementById("advance-phase-btn");e&&(e.addEventListener("click",()=>{let t=document.getElementById("end-conjure1-btn"),a=document.getElementById("end-combat-btn"),n=document.getElementById("end-turn-btn");t&&!t.disabled?t.click():a&&!a.disabled?a.click():n&&!n.disabled&&n.click()}),window.addEventListener("resize",Ue(()=>{Z()},100)))}p(Mt,"setupAdvancePhaseButton");function Ue(e,t){let a;return function(...n){clearTimeout(a),a=setTimeout(()=>e.apply(this,n),t)}}p(Ue,"debounce");var Q={entries:[],maxEntries:50,currentTurn:0,lastTurnLogged:-1,subscribed:!1,init(){this.entries=[],this.currentTurn=0,this.lastTurnLogged=-1,this.render(),this.setupToggle(),this.subscribed||(this.subscribeToEvents(),this.subscribed=!0)},setupToggle(){let e=document.getElementById("event-log-header"),t=document.getElementById("event-log");e&&!e._hasToggleHandler&&(e.onclick=()=>t.classList.toggle("collapsed"),e._hasToggleHandler=!0)},subscribeToEvents(){y.on("onAttackDeclared",e=>{let t=e.attacker?.name||"Unknown",a=e.attackerOwner==="player";this.addEntry({type:"combat",ownerClass:a?"player-action":"enemy-action",icon:"\u2694",text:`<span class="name-${a?"player":"enemy"}">${t}</span> attacks`})}),y.on("onHit",e=>{let t=e.target?.name||"Unknown",a=e.damage||0,n=e.target?.owner==="player";a>0&&this.addEntry({type:"combat",ownerClass:"combat",icon:"\u{1F4A5}",text:`<span class="name-${n?"player":"enemy"}">${t}</span> takes <span class="damage">${a}</span> damage`})}),y.on("onDamageReduced",e=>{let t=e.target?.name||"Unknown",a=e.targetOwner==="player",n=e.reduction||0;e.reducedDamage===0?this.addEntry({type:"protection",ownerClass:"buff",icon:"\u{1F6E1}\uFE0F",text:`<span class="name-${a?"player":"enemy"}">${t}</span>'s protection blocked all damage!`}):this.addEntry({type:"protection",ownerClass:"buff",icon:"\u{1F6E1}\uFE0F",text:`<span class="name-${a?"player":"enemy"}">${t}</span>'s protection reduced damage by ${n}`})}),y.on("onSummon",e=>{let t=e.cryptid?.name||"Unknown",a=e.owner==="player",n=e.isSupport?"ward":"rite",r=e.isKindling?"\u{1F56F}":"\u2726";this.addEntry({type:"summon",ownerClass:a?"player-action":"enemy-action",icon:r,text:`<span class="name-${a?"player":"enemy"}">${t}</span> summoned to ${n}`})}),y.on("onDeath",e=>{let t=e.cryptid?.name||"Unknown",a=e.owner==="player",n=e.deathCount>1?` (${e.deathCount} souls)`:"";this.addEntry({type:"death",ownerClass:"death",icon:"\u2620",text:`<span class="name-${a?"player":"enemy"}">${t}</span> perished${n}`})}),y.on("onSpellCast",e=>{let t=e.card?.name||"Spell",a=e.caster==="player",n=e.target?.name,r=n?` on <span class="name-${e.target?.owner==="player"?"player":"enemy"}">${n}</span>`:"";this.addEntry({type:"spell",ownerClass:"spell",icon:"\u2727",text:`<span class="name-${a?"player":"enemy"}">${a?"Seeker":"Warden"}</span> cast ${t}${r}`})}),y.on("onTrapSet",e=>{let t=e.owner==="player";this.addEntry({type:"trap",ownerClass:"trap",icon:"\u26A1",text:`<span class="name-${t?"player":"enemy"}">${t?"Seeker":"Warden"}</span> set a trap`})}),y.on("onTrapTriggered",e=>{let t=e.trap?.name||"Trap",a=e.owner==="player",n=e.triggerEvent,r="";n?.attacker?.name?r=` (${n.attacker.name} attacked)`:n?.cryptid?.name?r=` (${n.cryptid.name})`:n?.target?.name&&(r=` (${n.target.name} targeted)`),this.addEntry({type:"trap",ownerClass:"trap",icon:"\u26A1",text:`<span class="name-${a?"player":"enemy"}">${t}</span> activated!${r}`})}),y.on("onEvolution",e=>{let t=e.from?.name||"Creature",a=e.to?.name||"Unknown",n=e.owner==="player";this.addEntry({type:"evolution",ownerClass:n?"player-action":"enemy-action",icon:"\u25C8",text:`<span class="name-${n?"player":"enemy"}">${t}</span> evolved into ${a}`})}),y.on("onPromotion",e=>{let t=e.cryptid?.name||"Support",a=e.owner==="player";this.addEntry({type:"promotion",ownerClass:a?"player-action":"enemy-action",icon:"\u2192",text:`<span class="name-${a?"player":"enemy"}">${t}</span> advanced to rite`})}),y.on("onPyreBurn",e=>{let t=e.owner==="player",a=e.pyreGained||0,n=e.cardsDrawn||0;this.addEntry({type:"pyre",ownerClass:t?"player-action":"enemy-action",icon:"\u{1F702}",text:`<span class="name-${t?"player":"enemy"}">${t?"Seeker":"Warden"}</span> burned pyre: <span class="pyre">+${a}</span> pyre, drew ${n} card${n!==1?"s":""}`})}),y.on("onHeal",e=>{let t=e.target?.name||"Creature",a=e.amount||0,n=e.target?.owner==="player";a>0&&this.addEntry({type:"heal",ownerClass:n?"player-action":"enemy-action",icon:"\u2764",text:`<span class="name-${n?"player":"enemy"}">${t}</span> healed <span class="heal">${a}</span>`})}),y.on("onTurnStart",e=>{this.currentTurn=e.turnNumber||this.currentTurn+1;let t=e.owner==="player";this.addTurnSeparator(t)}),y.on("onStatusApplied",e=>{let t=e.cryptid?.name||"Creature",a=e.owner==="player",n=e.status.charAt(0).toUpperCase()+e.status.slice(1),i={burn:"\u{1F525}",paralyze:"\u26A1",bleed:"\u{1FA78}",calamity:"\u{1F480}",protection:"\u{1F6E1}\uFE0F"}[e.status]||"\u26A0";this.addEntry({type:"status",ownerClass:a?"player-action":"enemy-action",icon:i,text:`<span class="name-${a?"player":"enemy"}">${t}</span> ${e.refreshed?"re-":""}afflicted with ${n}`})}),y.on("onBleedDamage",e=>{let t=e.target?.name||"Creature",a=e.owner==="player";this.addEntry({type:"status",ownerClass:a?"player-action":"enemy-action",icon:"\u{1FA78}",text:`<span class="name-${a?"player":"enemy"}">${t}</span> takes <span class="damage">2x</span> damage from bleed!`})}),y.on("onCleanse",e=>{let t=e.cryptid?.name||"Creature",a=e.owner==="player";this.addEntry({type:"heal",ownerClass:a?"player-action":"enemy-action",icon:"\u2728",text:`<span class="name-${a?"player":"enemy"}">${t}</span> cleansed of ${e.count} ailment${e.count>1?"s":""}`})}),y.on("onSacrificeActivated",e=>{let t=e.cryptid?.name||"Creature",a=e.victim?.name||"Combatant",n=e.owner==="player";this.addEntry({type:"death",ownerClass:n?"player-action":"enemy-action",icon:"\u26B0",text:`<span class="name-${n?"player":"enemy"}">${t}</span> sacrificed ${a} - gains Destroyer!`})}),y.on("onDestroyerDamage",e=>{let t=e.attacker?.name||"Attacker",a=e.support?.name||"Support",n=e.attacker?.owner==="player";this.addEntry({type:"combat",ownerClass:"combat",icon:"\u{1F4A5}",text:`Destroyer! ${t} deals <span class="damage">${e.damage}</span> overflow to ${a}`})}),y.on("onBloodPactActivated",e=>{let t=e.cryptid?.name||"Creature",a=e.victim?.name||"Combatant",n=e.owner==="player";this.addEntry({type:"special",ownerClass:n?"player-action":"enemy-action",icon:"\u{1FA78}",text:`<span class="name-${n?"player":"enemy"}">${t}</span> drained ${a} for <span class="pyre">+1</span> pyre`})}),y.on("onForceRest",e=>{let t=e.cryptid?.name||"Creature",a=e.owner==="player";this.addEntry({type:"status",ownerClass:a?"player-action":"enemy-action",icon:"\u{1F4A4}",text:`<span class="name-${a?"player":"enemy"}">${t}</span> forced to rest`})}),y.on("onBuffApplied",e=>{let t=e.cryptid?.name||"Creature",a=e.owner==="player",n=e.source||"ability",r="";e.atkBonus&&(r+=`+${e.atkBonus} ATK`),e.hpBonus&&(r+=(r?", ":"")+`+${e.hpBonus} HP`),this.addEntry({type:"buff",ownerClass:a?"player-action":"enemy-action",icon:"\u2B06\uFE0F",text:`<span class="name-${a?"player":"enemy"}">${t}</span> gained ${r} (${n})`})}),y.on("onBurnDamage",e=>{let t=e.cryptid?.name||"Creature",a=e.owner==="player";this.addEntry({type:"status",ownerClass:a?"player-action":"enemy-action",icon:"\u{1F525}",text:`<span class="name-${a?"player":"enemy"}">${t}</span> burned for <span class="damage">1</span>`})}),y.on("onAuraApplied",e=>{let t=e.cryptid?.name||"Creature",a=e.aura?.name||"Aura",n=e.owner==="player";this.addEntry({type:"aura",ownerClass:n?"player-action":"enemy-action",icon:"\u2728",text:`<span class="name-${n?"player":"enemy"}">${t}</span> enchanted with ${a}`})}),y.on("onPyreCardPlayed",e=>{console.log("[EventLog] onPyreCardPlayed received, owner:",e.owner);let t=e.card?.name||"Pyre",a=e.owner==="player",n=e.pyreGained||0;this.addEntry({type:"pyre",ownerClass:a?"player-action":"enemy-action",icon:"\u{1F525}",text:`<span class="name-${a?"player":"enemy"}">${a?"Seeker":"Warden"}</span> played ${t}: <span class="pyre">+${n}</span> pyre`})}),y.on("onCardDrawn",e=>{if(e.source==="pyreBurn")return;let t=e.owner==="player";this.addEntry({type:"draw",ownerClass:t?"player-action":"enemy-action",icon:"\u{1F4DC}",text:`<span class="name-${t?"player":"enemy"}">${t?"Seeker":"Warden"}</span> drew a card`})}),y.on("onKill",e=>{let t=e.killer?.name||"Unknown",a=e.victim?.name||"Unknown",n=e.killerOwner==="player";this.addEntry({type:"combat",ownerClass:"death",icon:"\u{1F480}",text:`<span class="name-${n?"player":"enemy"}">${t}</span> slew <span class="name-${e.victimOwner==="player"?"player":"enemy"}">${a}</span>`})}),y.on("onPhaseChange",e=>{let t=e.owner==="player",a=e.newPhase==="conjure1"?"First Conjuring":e.newPhase==="combat"?"Combat":e.newPhase==="conjure2"?"Second Conjuring":e.newPhase;this.addEntry({type:"system",ownerClass:"system",icon:"\u25C6",text:`${a} phase begins`})}),y.on("onLatch",e=>{let t=e.attacker?.name||"Creature",a=e.target?.name||"Creature",n=e.attackerOwner==="player";this.addEntry({type:"combat",ownerClass:n?"player-action":"enemy-action",icon:"\u{1F517}",text:`<span class="name-${n?"player":"enemy"}">${t}</span> latched onto <span class="name-${e.targetOwner==="player"?"player":"enemy"}">${a}</span>`})}),y.on("onToxicApplied",e=>{let t=e.owner==="player",a=e.row===0?"top":e.row===1?"middle":"bottom";this.addEntry({type:"trap",ownerClass:"trap",icon:"\u2620",text:`Toxic mist spreads to <span class="name-${t?"enemy":"player"}">${a} tile</span>`})}),y.on("onToxicDamage",e=>{let t=e.target?.name||"Creature",a=e.owner==="player";this.addEntry({type:"status",ownerClass:"combat",icon:"\u2620",text:`<span class="name-${a?"player":"enemy"}">${t}</span> takes <span class="damage">+1</span> toxic damage`})}),y.on("onCalamityTick",e=>{let t=e.cryptid?.name||"Creature",a=e.owner==="player";this.addEntry({type:"status",ownerClass:a?"player-action":"enemy-action",icon:"\u26A0",text:`<span class="name-${a?"player":"enemy"}">${t}</span> calamity: ${e.countersRemaining} turns remain`})}),y.on("onCalamityDeath",e=>{let t=e.cryptid?.name||"Creature",a=e.owner==="player";this.addEntry({type:"death",ownerClass:"death",icon:"\u{1F4A5}",text:`<span class="name-${a?"player":"enemy"}">${t}</span> destroyed by Calamity!`})}),y.on("onPyreGained",e=>{if(e.source==="pyreFuel"){let t=e.sourceCryptid?.name||"Support",a=e.owner==="player";this.addEntry({type:"pyre",ownerClass:a?"player-action":"enemy-action",icon:"\u{1F525}",text:`<span class="name-${a?"player":"enemy"}">${t}</span> fueled pyre: <span class="pyre">+1</span>`})}}),y.on("onTurnEnd",e=>{let t=e.owner==="player";this.addEntry({type:"system",ownerClass:"system",icon:"\u27F3",text:`<span class="name-${t?"player":"enemy"}">${t?"Seeker":"Warden"}'s</span> turn ends`})}),y.on("onFieldEmpty",e=>{let t=e.owner==="player";this.addEntry({type:"system",ownerClass:t?"player-action":"enemy-action",icon:"\u26A0",text:`<span class="name-${t?"player":"enemy"}">${t?"Seeker":"Warden"}'s</span> field is empty!`})}),y.on("onToxicFade",e=>{let t=e.owner==="player",a=e.row===0?"top":e.row===1?"middle":"bottom";this.addEntry({type:"status",ownerClass:"system",icon:"\u2620",text:`Toxic mist fades from <span class="name-${t?"enemy":"player"}">${a} tile</span>`})})},addTurnSeparator(e){this.lastTurnLogged!==this.currentTurn&&(this.lastTurnLogged=this.currentTurn,this.entries.push({isSeparator:!0,turn:this.currentTurn,isPlayerTurn:e}),this.trimEntries(),this.render())},addEntry(e){e.turn=this.currentTurn,e.timestamp=Date.now(),this.entries.push(e),this.trimEntries(),this.render()},trimEntries(){for(;this.entries.length>this.maxEntries;)this.entries.shift()},clear(){this.entries=[],this.currentTurn=0,this.lastTurnLogged=-1,this.render()},render(){let e=document.getElementById("event-log-entries");if(e){e.innerHTML="";for(let t of this.entries)if(t.isSeparator){let a=document.createElement("div");a.className="log-turn-separator",a.textContent=t.isPlayerTurn?`\u2014 Turn ${t.turn}: Seeker \u2014`:`\u2014 Turn ${t.turn}: Warden \u2014`,e.appendChild(a)}else{let a=document.createElement("div");a.className=`log-entry ${t.ownerClass||""} ${t.type||""}`,a.innerHTML=`<span class="log-icon">${t.icon||"\u2022"}</span><span class="log-text">${t.text}</span>`,e.appendChild(a)}e.scrollTop=e.scrollHeight}}};window.EventLog=Q;var E={attackAnim:650,damageAnim:700,deathAnim:800,summonAnim:700,promoteAnim:600,evolveAnim:900,protectionAnim:750,trapTriggerAnim:900,trapMessageDelay:500,attackDelay:400,postAttackDelay:500,betweenAttacksDelay:300,aiPhaseDelay:1e3,aiActionDelay:800,aiAttackDelay:600,messageDisplay:1400,pyreBurnEffect:1400,spellEffect:800,cascadeDelay:400,promotionPause:300};window.pendingTraps=[];window.processingTraps=!1;window.animatingTraps=new Set;async function Ht(){try{for(;window.pendingTraps&&window.pendingTraps.length>0;){let{owner:e,row:t,trap:a,eventData:n}=window.pendingTraps.shift(),r=e==="player"?d.playerTraps:d.enemyTraps;if(!r||!r[t])continue;let i=`${e}-trap-${t}`;window.animatingTraps.add(i),await $t(e,t,a),await new Promise(o=>setTimeout(o,200)),d.triggerTrap(e,t,n),await new Promise(o=>setTimeout(o,E.postAttackDelay)),window.animatingTraps.delete(i),k(),await new Promise(o=>{let s=setTimeout(()=>{console.warn("Trap death check timed out, continuing..."),o()},5e3);j(()=>{clearTimeout(s),k(),o()})}),window.pendingTraps&&window.pendingTraps.length>0&&await new Promise(o=>setTimeout(o,300))}}catch(e){console.error("Error in trap processing:",e)}finally{window.processingTraps=!1}}p(Ht,"processTrapQueue");async function $t(e,t,a){P(`\u26A1 ${a.name}! \u26A1`,E.trapTriggerAnim);let n=document.querySelector(`.trap-sprite[data-owner="${e}"][data-row="${t}"]`);n&&n.classList.add("trap-triggering");let r=document.querySelector(`.tile.trap[data-owner="${e}"][data-row="${t}"]`);r&&(r.classList.add("trap-activating"),setTimeout(()=>r.classList.remove("trap-activating"),E.trapTriggerAnim));let i=document.getElementById("battlefield-area");i&&(i.classList.add("trap-flash"),setTimeout(()=>i.classList.remove("trap-flash"),400)),await new Promise(o=>setTimeout(o,E.trapTriggerAnim))}p($t,"playTrapTriggerAnimation");window.abilityAnimationQueue=[];window.processingAbilityAnimations=!1;function O(e){window.abilityAnimationQueue.push(e),window.processingAbilityAnimations||ge()}p(O,"queueAbilityAnimation");async function ge(){if(!(window.processingAbilityAnimations||window.abilityAnimationQueue.length===0)){for(window.processingAbilityAnimations=!0;window.abilityAnimationQueue.length>0;){let e=window.abilityAnimationQueue.shift();await Rt(e)}window.processingAbilityAnimations=!1}}p(ge,"processAbilityAnimationQueue");async function Rt(e){let{type:t,source:a,target:n,damage:r,message:i,owner:o}=e,s=null;n&&(s=document.querySelector(`.cryptid-sprite[data-owner="${n.owner}"][data-col="${n.col}"][data-row="${n.row}"]`));let l=null;switch(a&&(l=document.querySelector(`.cryptid-sprite[data-owner="${a.owner}"][data-col="${a.col}"][data-row="${a.row}"]`)),t){case"abilityDamage":if(i&&(P(i,800),await new Promise(c=>setTimeout(c,200))),s){if(s.classList.add("hit-recoil"),window.CombatEffects&&n){let c=document.getElementById("battlefield-area");if(c){let m=s.getBoundingClientRect(),f=c.getBoundingClientRect(),h=m.left+m.width/2-f.left,u=m.top+m.height/2-f.top;CombatEffects.createImpactFlash(h,u,60),CombatEffects.createImpactParticles(h,u,"#aa66ff",8),CombatEffects.lightImpact(),CombatEffects.showDamageNumber(n,r)}}else ae(n,r);await new Promise(c=>setTimeout(c,300)),s.classList.remove("hit-recoil")}break;case"counterAttack":if(i&&P(i,900),l&&(l.classList.add("counter-attacking"),await new Promise(c=>setTimeout(c,200))),s){if(s.classList.add("hit-recoil"),window.CombatEffects&&n){let c=document.getElementById("battlefield-area");if(c){let m=s.getBoundingClientRect(),f=c.getBoundingClientRect(),h=m.left+m.width/2-f.left,u=m.top+m.height/2-f.top;CombatEffects.createImpactFlash(h,u,70),CombatEffects.createSparks(h,u,10),CombatEffects.heavyImpact(r||2),CombatEffects.showDamageNumber(n,r,r>=5)}}else ae(n,r);await new Promise(c=>setTimeout(c,250)),s.classList.remove("hit-recoil")}l&&l.classList.remove("counter-attacking"),await new Promise(c=>setTimeout(c,200));break;case"cleave":if(i&&P(i,600),s){if(s.classList.add("hit-recoil"),window.CombatEffects&&n){let c=document.getElementById("battlefield-area");if(c){let m=s.getBoundingClientRect(),f=c.getBoundingClientRect(),h=m.left+m.width/2-f.left,u=m.top+m.height/2-f.top;CombatEffects.createImpactFlash(h,u,60),CombatEffects.createSparks(h,u,8),CombatEffects.lightImpact(),CombatEffects.showDamageNumber(n,r)}}else ae(n,r);await new Promise(c=>setTimeout(c,250)),s.classList.remove("hit-recoil")}break;case"multiAttack":if(s){if(s.classList.add("hit-recoil"),window.CombatEffects&&n){let c=document.getElementById("battlefield-area");if(c){let m=s.getBoundingClientRect(),f=c.getBoundingClientRect(),h=m.left+m.width/2-f.left,u=m.top+m.height/2-f.top;CombatEffects.createImpactFlash(h,u,50),CombatEffects.createSparks(h,u,6),CombatEffects.lightImpact(),CombatEffects.showDamageNumber(n,r)}}else ae(n,r);await new Promise(c=>setTimeout(c,250)),s.classList.remove("hit-recoil")}break;case"buff":i&&P(i,800),s&&(s.classList.add("buff-applied"),await new Promise(c=>setTimeout(c,500)),s.classList.remove("buff-applied"));break;case"heal":s&&(s.classList.add("healing"),Xe(n,r),await new Promise(c=>setTimeout(c,400)),s.classList.remove("healing"));break;case"pyreDrain":i&&P(i,800),await new Promise(c=>setTimeout(c,600));break;case"attack":if(i&&P(i,900),l&&(l.classList.add("attack-windup"),await new Promise(c=>setTimeout(c,150)),l.classList.remove("attack-windup"),l.classList.add("attack-lunge"),await new Promise(c=>setTimeout(c,180))),window.CombatEffects&&s){let c=document.getElementById("battlefield-area");if(c){let m=s.getBoundingClientRect(),f=c.getBoundingClientRect(),h=m.left+m.width/2-f.left,u=m.top+m.height/2-f.top;CombatEffects.createImpactFlash(h,u),CombatEffects.createSparks(h,u,12),CombatEffects.heavyImpact(r||2)}n&&r&&CombatEffects.showDamageNumber(n,r,r>=5)}s&&(s.classList.add("hit-recoil"),await new Promise(c=>setTimeout(c,250)),s.classList.remove("hit-recoil")),l&&(l.classList.remove("attack-lunge"),l.classList.add("attack-return"),await new Promise(c=>setTimeout(c,200)),l.classList.remove("attack-return"));break;case"debuff":i&&P(i,800),s&&(s.classList.add("debuff-applied"),await new Promise(c=>setTimeout(c,500)),s.classList.remove("debuff-applied"));break;default:i&&(P(i,900),await new Promise(c=>setTimeout(c,700)));break}await new Promise(c=>setTimeout(c,150))}p(Rt,"playAbilityAnimation");function ae(e,t){if(!e||!t)return;let a=`${e.owner}-${e.col}-${e.row}`,n=window.tilePositions?.[a];if(!n)return;let r=document.getElementById("battlefield-area");if(!r)return;let i=document.createElement("div");i.className="floating-damage",i.textContent=`-${t}`,i.style.left=`${n.x+30}px`,i.style.top=`${n.y-10}px`,r.appendChild(i),setTimeout(()=>i.remove(),1e3)}p(ae,"showFloatingDamage");function Xe(e,t){if(!e||!t)return;let a=`${e.owner}-${e.col}-${e.row}`,n=window.tilePositions?.[a];if(!n)return;let r=document.getElementById("battlefield-area");if(!r)return;let i=document.createElement("div");i.className="floating-heal",i.textContent=`+${t}`,i.style.left=`${n.x+30}px`,i.style.top=`${n.y-10}px`,r.appendChild(i),setTimeout(()=>i.remove(),1e3)}p(Xe,"showFloatingHeal");window.queueAbilityAnimation=O;window.showFloatingDamage=ae;window.showFloatingHeal=Xe;function _(e){if(typeof CardRegistry<"u"){let t=CardRegistry.getCryptid(e)||CardRegistry.getInstant(e);if(t?.name)return t.name}return e.replace(/([A-Z])/g," $1").replace(/^./,t=>t.toUpperCase()).trim()}p(_,"getCardDisplayName");function be(e){return{void:"\u{1F52E}",blood:"\u{1FA78}",water:"\u{1F4A7}",steel:"\u2699\uFE0F",nature:"\u{1F33F}"}[e]||""}p(be,"getElementIcon");function se(e,t=!1,a=null){if(e&&(e.startsWith("sprites/")||e.startsWith("http"))){let n=t?"sprite-img field-sprite-img":"sprite-img",r=t&&a?` style="transform: scale(${a})"`:"";return`<img src="${e}" class="${n}"${r} alt="" draggable="false">`}return e||"?"}p(se,"renderSprite");var le=class{static{p(this,"Game")}constructor(){this.playerField=[[null,null,null],[null,null,null]],this.enemyField=[[null,null,null],[null,null,null]],this.playerHand=[],this.enemyHand=[],this.playerKindling=[],this.enemyKindling=[],this.playerKindlingPlayedThisTurn=!1,this.enemyKindlingPlayedThisTurn=!1,this.playerPyreCardPlayedThisTurn=!1,this.enemyPyreCardPlayedThisTurn=!1,this.playerPyre=0,this.enemyPyre=0,this.playerDeaths=0,this.enemyDeaths=0,this.playerPyreBurnUsed=!1,this.enemyPyreBurnUsed=!1,this.currentTurn="player",this.phase="conjure1",this.turnNumber=0,this.gameOver=!1,this.isMultiplayer=!1,this.multiplayerData=null,this.evolvedThisTurn={},this.playerTraps=[null,null],this.enemyTraps=[null,null],this.playerToxicTiles=[[0,0,0],[0,0,0]],this.enemyToxicTiles=[[0,0,0],[0,0,0]],this.deathsThisTurn={player:0,enemy:0},this.deathsLastEnemyTurn={player:0,enemy:0},this.attackersThisTurn={player:[],enemy:[]},this.lastTurnAttackers={player:[],enemy:[]},this.playerBurnPile=[],this.playerDiscardPile=[],this.enemyBurnPile=[],this.enemyDiscardPile=[],this.matchStats={startTime:Date.now(),damageDealt:0,damageTaken:0,spellsCast:0,evolutions:0,trapsTriggered:0,kindlingSummoned:0};let t=window.selectedPlayerDeck;if(t&&t.cards){let a=this.buildDeckFromSelection(t);this.deck=a.mainDeck,this.playerKindling=a.kindling,console.log("[Game] Using selected deck:",t.name,"with",this.deck.length,"cards and",this.playerKindling.length,"kindling")}else this.deck=DeckBuilder.buildRandomDeck(),this.playerKindling=DeckBuilder.buildKindlingPool();this.enemyDeck=DeckBuilder.buildRandomDeck(),this.enemyKindling=DeckBuilder.buildKindlingPool(),this.setupTrapListeners()}buildDeckFromSelection(t){let a=[],n=[],r=1,i=1e3;for(let o of t.cards){let s=o.cardKey,l=CardRegistry.getKindling(s);if(l){n.push({...l,id:i++,isKindling:!0,skinId:o.skinId,isHolo:o.isHolo});continue}let c=CardRegistry.getCryptid(s)||CardRegistry.getBurst(s)||CardRegistry.getTrap(s)||CardRegistry.getAura(s)||CardRegistry.getPyre(s);c&&a.push({...c,id:r++,skinId:o.skinId,isHolo:o.isHolo})}for(let o=a.length-1;o>0;o--){let s=Math.floor(Math.random()*(o+1));[a[o],a[s]]=[a[s],a[o]]}return{mainDeck:a,kindling:n}}setupTrapListeners(){this._trapListeners=this._trapListeners||{},["onDamageTaken","onDeath","onSummon","onAttackDeclared","onHit","onSpellCast","onTurnStart","onPyreSpent"].forEach(a=>{if(this._trapListeners[a]){let n=y.listeners[a]?.indexOf(this._trapListeners[a]);n>-1&&y.listeners[a].splice(n,1)}}),this._trapListeners.onDamageTaken=a=>this.checkTraps("onDamageTaken",a),this._trapListeners.onDeath=a=>this.checkTraps("onDeath",a),this._trapListeners.onSummon=a=>this.checkTraps("onSummon",a),this._trapListeners.onAttackDeclared=a=>this.checkTraps("onAttackDeclared",a),this._trapListeners.onHit=a=>this.checkTraps("onHit",a),this._trapListeners.onSpellCast=a=>this.checkTraps("onSpellCast",a),this._trapListeners.onTurnStart=a=>this.checkTraps("onTurnStart",a),this._trapListeners.onPyreSpent=a=>this.checkTraps("onPyreSpent",a),y.on("onDamageTaken",this._trapListeners.onDamageTaken),y.on("onDeath",this._trapListeners.onDeath),y.on("onSummon",this._trapListeners.onSummon),y.on("onAttackDeclared",this._trapListeners.onAttackDeclared),y.on("onHit",this._trapListeners.onHit),y.on("onSpellCast",this._trapListeners.onSpellCast),y.on("onTurnStart",this._trapListeners.onTurnStart),y.on("onPyreSpent",this._trapListeners.onPyreSpent)}checkTraps(t,a){for(let n=0;n<2;n++){let r=this.playerTraps[n];r&&r.triggerEvent===t&&this.shouldTriggerTrap(r,"player",a)&&this.queueTrapTrigger("player",n,a)}for(let n=0;n<2;n++){let r=this.enemyTraps[n];r&&r.triggerEvent===t&&this.shouldTriggerTrap(r,"enemy",a)&&this.queueTrapTrigger("enemy",n,a)}}shouldTriggerTrap(t,a,n){return t.triggerCondition?t.triggerCondition(t,a,n,this):!0}queueTrapTrigger(t,a,n){let r=(t==="player"?this.playerTraps:this.enemyTraps)[a];if(!r)return;window.pendingTraps||(window.pendingTraps=[]);let i=`${t}-trap-${a}`,o=window.pendingTraps.some(l=>l.owner===t&&l.row===a),s=window.animatingTraps?.has(i);o||s||(window.pendingTraps.push({owner:t,row:a,trap:r,eventData:n}),window.processingTraps||(window.processingTraps=!0,setTimeout(()=>Ht(),50)))}triggerTrap(t,a,n){let r=t==="player"?this.playerTraps:this.enemyTraps,i=r[a];i&&(y.emit("onTrapTriggered",{trap:i,owner:t,row:a,triggerEvent:n}),i.effect&&i.effect(this,t,a,n),r[a]=null)}setTrap(t,a,n){let r=t==="player"?this.playerTraps:this.enemyTraps;return a>=2||r[a]!==null?!1:(r[a]={...n,owner:t,row:a,faceDown:!0},console.log("[Trap] Set trap:",r[a].key,"triggerType:",r[a].triggerType,"owner:",t,"row:",a),console.log("[Trap] Full trap object:",JSON.stringify(r[a],null,2)),y.emit("onTrapSet",{trap:r[a],owner:t,row:a}),!0)}getTrap(t,a){return(t==="player"?this.playerTraps:this.enemyTraps)[a]}getValidTrapSlots(t){let a=t==="player"?this.playerTraps:this.enemyTraps,n=[];for(let r=0;r<2;r++)a[r]===null&&n.push({row:r});return n}getModifiedCost(t,a){let n=t.cost||0,r=a==="player"?this.playerField:this.enemyField,i=this.getSupportCol(a);for(let o=0;o<3;o++){let s=r[i][o];s?.trapCostModifier&&t.type==="trap"&&(n+=s.trapCostModifier),s?.auraCostModifier&&t.type==="aura"&&(n+=s.auraCostModifier),s?.burstCostModifier&&t.type==="burst"&&(n+=s.burstCostModifier),s?.cryptidCostModifier&&t.type==="cryptid"&&(n+=s.cryptidCostModifier)}return Math.max(0,n)}getEnemyModifiedCost(t,a){let n=t.cost||0,r=a==="player"?"enemy":"player",i=r==="player"?this.playerField:this.enemyField,o=this.getSupportCol(r);for(let s=0;s<3;s++){let l=i[o][s];l?.enemyTrapCostModifier&&t.type==="trap"&&(n+=l.enemyTrapCostModifier)}return Math.max(0,n)}isTrapImmune(t,a){let n=t==="player"?this.playerField:this.enemyField,r=this.getSupportCol(t);for(let i=0;i<3;i++){let o=n[r][i];if(o?.protectsTraps&&(o.protectsTrapsRow==="all"||o.protectsTrapsRow===a||o.row===a))return!0}return!1}evolveFromSource(t,a,n="field"){let r=t==="player"?this.deck:this.enemyDeck,i=t==="player"?this.playerHand:this.enemyHand,o=t==="player"?this.playerKindling:this.enemyKindling,s=null,l=null,c=i.findIndex(m=>m.evolvesFrom===a);if(c!==-1&&(s=i.splice(c,1)[0],l="hand"),!s){let m=r.findIndex(f=>f.evolvesFrom===a);m!==-1&&(s=r.splice(m,1)[0],l="deck")}if(!s){let m=o.findIndex(f=>f.evolvesFrom===a);m!==-1&&(s=o.splice(m,1)[0],l="kindling")}return{card:s,source:l}}applyDestroyerDamage(t,a,n){if(!t.hasDestroyer||n<=0)return;let r=this.getSupport(a);if(r){let i=r.currentHp;r.currentHp-=n,y.emit("onDestroyerDamage",{attacker:t,target:a,support:r,damage:n,hpBefore:i,hpAfter:r.currentHp}),typeof O<"u"&&O({type:"abilityDamage",source:t,target:r,damage:n,message:`\u{1F4A5} Destroyer: ${n} damage pierces to ${r.name}!`}),r.currentHp<=0&&(r.killedBy="destroyer",r.killedBySource=t,this.killCryptid(r,t.owner))}}isFieldEmpty(t){let a=t==="player"?this.playerField:this.enemyField;for(let n=0;n<2;n++)for(let r=0;r<3;r++)if(a[n][r])return!1;return!0}applyBurn(t){if(!t)return!1;let a=t.burnTurns>0;return t.burnTurns=3,y.emit("onStatusApplied",{status:"burn",cryptid:t,owner:t.owner,refreshed:a}),!0}applyStun(t){return this.applyParalyze(t)}applyToxic(t,a,n){let r=t==="player"?this.playerToxicTiles:this.enemyToxicTiles,i=r[a][n]>0;return r[a][n]=3,y.emit("onToxicApplied",{owner:t,col:a,row:n,refreshed:i}),!0}isTileToxic(t,a,n){return(t==="player"?this.playerToxicTiles:this.enemyToxicTiles)[a][n]>0}isInToxicTile(t){return!t||t.col===void 0||t.row===void 0?!1:this.isTileToxic(t.owner,t.col,t.row)}applyCalamity(t,a=3){return!t||t.calamityCounters>0?!1:(t.calamityCounters=a,t.hadCalamity=!0,y.emit("onStatusApplied",{status:"calamity",cryptid:t,owner:t.owner,count:a}),!0)}applyParalyze(t){return!t||t.paralyzed?!1:(t.paralyzed=!0,t.paralyzeTurns=1,t.tapped=!0,t.canAttack=!1,console.log(`[Paralyze] Applied to ${t.name} (${t.owner}): will skip 1 untap`),y.emit("onStatusApplied",{status:"paralyze",cryptid:t,owner:t.owner}),!0)}applyBleed(t){if(!t)return!1;let a=t.bleedTurns>0;return t.bleedTurns=3,y.emit("onStatusApplied",{status:"bleed",cryptid:t,owner:t.owner,refreshed:a}),!0}applyCurse(t,a=1){return!t||t.curseImmune?!1:(t.curseTokens=(t.curseTokens||0)+a,y.emit("onStatusApplied",{status:"curse",cryptid:t,owner:t.owner,tokens:a,totalTokens:t.curseTokens}),!0)}getCurseAtkReduction(t){return!t||!t.curseTokens?0:t.curseTokens}processCurse(t){let a=t==="player"?this.playerField:this.enemyField;for(let n=0;n<2;n++)for(let r=0;r<3;r++){let i=a[n][r];i&&i.curseTokens>0&&(i.curseTokens--,y.emit("onCurseCleanse",{cryptid:i,owner:t,tokensRemaining:i.curseTokens}),i.curseTokens<=0&&y.emit("onStatusWearOff",{status:"curse",cryptid:i,owner:t}))}}applyProtection(t,a=1){return t?(t.protectionCharges=(t.protectionCharges||0)+a,t.damageReduction=999,t.blockFirstHit=!0,y.emit("onStatusApplied",{status:"protection",cryptid:t,owner:t.owner,charges:a}),!0):!1}removeProtection(t,a=1){return!t||!t.protectionCharges?!1:(t.protectionCharges=Math.max(0,t.protectionCharges-a),t.protectionCharges===0&&(t.damageReduction=0,t.blockFirstHit=!1),y.emit("onProtectionRemoved",{cryptid:t,owner:t.owner,remaining:t.protectionCharges}),!0)}cleanse(t){if(!t)return{cleansed:!1,count:0};let a=0;return t.burnTurns>0&&(t.burnTurns=0,a++),t.paralyzed&&(t.paralyzed=!1,t.paralyzeTurns=0,a++),t.bleedTurns>0&&(t.bleedTurns=0,a++),t.calamityCounters>0&&(t.calamityCounters=0,a++),a>0&&y.emit("onCleanse",{cryptid:t,owner:t.owner,count:a}),{cleansed:a>0,count:a}}hasStatusAilment(t){return t?t.burnTurns>0||t.paralyzed||t.bleedTurns>0||t.calamityCounters>0||t.curseTokens>0:!1}getStatusAilments(t){if(!t)return[];let a=[];return t.burnTurns>0&&a.push("burn"),t.paralyzed&&a.push("paralyze"),t.bleedTurns>0&&a.push("bleed"),t.calamityCounters>0&&a.push("calamity"),t.curseTokens>0&&a.push("curse"),a}copyRandomAilment(t,a){if(!t||!a)return!1;let n=this.getStatusAilments(t);if(n.length===0)return!1;switch(n[Math.floor(Math.random()*n.length)]){case"burn":return this.applyBurn(a);case"paralyze":return this.applyParalyze(a);case"bleed":return this.applyBleed(a);case"calamity":return this.applyCalamity(a,t.calamityCounters);case"curse":return this.applyCurse(a,t.curseTokens)}return!1}getCombatant(t){if(!t)return null;let{owner:a,row:n}=t,r=this.getCombatCol(a),i=this.getSupportCol(a);if(t.col===i){let o=this.getFieldCryptid(a,r,n);return console.log("[getCombatant] cryptid:",t.name,"col:",t.col,"supportCol:",i,"combatCol:",r,"row:",n,"found:",o?.name),o}return console.log("[getCombatant] cryptid:",t.name,"col:",t.col,"is NOT in supportCol:",i),null}getSupport(t){if(!t)return null;let{owner:a,row:n}=t,r=this.getCombatCol(a),i=this.getSupportCol(a);if(t.col===r){let o=this.getFieldCryptid(a,i,n);return console.log("[getSupport] cryptid:",t.name,"col:",t.col,"combatCol:",r,"supportCol:",i,"row:",n,"found:",o?.name),o}return console.log("[getSupport] cryptid:",t.name,"col:",t.col,"is NOT in combatCol:",r),null}isInCombat(t){return t?t.col===this.getCombatCol(t.owner):!1}isInSupport(t){return t?t.col===this.getSupportCol(t.owner):!1}getDiagonalEnemies(t){if(!t)return[];let n=(t.owner==="player"?"enemy":"player")==="player"?this.playerField:this.enemyField,r=[],i=[t.row-1,t.row+1].filter(o=>o>=0&&o<3);for(let o of i)for(let s=0;s<2;s++){let l=n[s][o];l&&r.push(l)}return r}getEnemyCombatantAcross(t){if(!t)return null;let a=t.owner==="player"?"enemy":"player",n=this.getCombatCol(a);return this.getFieldCryptid(a,n,t.row)}getCryptidsAcross(t){if(!t)return[];let a=t.owner==="player"?"enemy":"player",n=this.getCombatCol(a),r=this.getSupportCol(a),i=[],o=this.getFieldCryptid(a,n,t.row);o&&i.push(o);let s=this.getFieldCryptid(a,r,t.row);return s&&i.push(s),i}getCryptidAcross(t){return this.getEnemyCombatantAcross(t)}getAdjacentAllies(t){if(!t)return[];let{owner:a,col:n,row:r}=t,i=[];if(r>0){let o=this.getFieldCryptid(a,n,r-1);o&&i.push(o)}if(r<2){let o=this.getFieldCryptid(a,n,r+1);o&&i.push(o)}return i}getAdjacentEnemies(t){if(!t)return[];let{owner:a,row:n}=t,r=a==="player"?"enemy":"player",i=[];for(let o=0;o<2;o++){if(n>0){let s=this.getFieldCryptid(r,o,n-1);s&&i.push(s)}if(n<2){let s=this.getFieldCryptid(r,o,n+1);s&&i.push(s)}}return i}getEnemyBehind(t){if(!t)return null;let a=this.getSupportCol(t.owner);return this.getFieldCryptid(t.owner,a,t.row)}areOnSameSide(t,a){return!t||!a?!1:t.owner===a.owner&&t.col===a.col}isOnLeftSide(t){return t?t.row<=1:!1}removeRandomAura(t){if(!t||!t.auras||t.auras.length===0)return null;let a=Math.floor(Math.random()*t.auras.length),n=t.auras.splice(a,1)[0];return n.atkBonus&&(t.currentAtk-=n.atkBonus),n.hpBonus&&(t.maxHp-=n.hpBonus,t.currentHp=Math.min(t.currentHp,t.maxHp)),y.emit("onAuraRemoved",{cryptid:t,aura:n,owner:t.owner}),n}applyLatch(t,a){return!t||!a||t.latchedTo?!1:(t.latchedTo={owner:a.owner,col:a.col,row:a.row},a.latchedBy={owner:t.owner,col:t.col,row:t.row},y.emit("onLatch",{attacker:t,target:a,attackerOwner:t.owner,targetOwner:a.owner}),!0)}removeLatch(t){if(t){if(t.latchedTo){let a=this.getFieldCryptid(t.latchedTo.owner,t.latchedTo.col,t.latchedTo.row);a&&a.latchedBy&&delete a.latchedBy,delete t.latchedTo}if(t.latchedBy){let a=this.getFieldCryptid(t.latchedBy.owner,t.latchedBy.col,t.latchedBy.row);a&&a.latchedTo&&delete a.latchedTo,delete t.latchedBy}}}getLatchTarget(t){return t?.latchedTo?this.getFieldCryptid(t.latchedTo.owner,t.latchedTo.col,t.latchedTo.row):null}processBurnDamage(t){let a=t==="player"?this.playerField:this.enemyField,n=[];for(let r=0;r<2;r++)for(let i=0;i<3;i++){let o=a[r][i];o&&o.burnTurns>0&&(o.currentHp-=1,o.burnTurns--,y.emit("onBurnDamage",{cryptid:o,owner:t,damage:1,turnsRemaining:o.burnTurns}),o.currentHp<=0&&n.push({cryptid:o,col:r,row:i}))}return n}processStun(t){return!1}processToxicTiles(t){let a=t==="player"?this.playerToxicTiles:this.enemyToxicTiles;for(let n=0;n<2;n++)for(let r=0;r<3;r++)a[n][r]>0&&(a[n][r]--,a[n][r]===0&&y.emit("onToxicFade",{owner:t,col:n,row:r}))}processCalamity(t){let a=t==="player"?this.playerField:this.enemyField,n=[];for(let r=0;r<2;r++)for(let i=0;i<3;i++){let o=a[r][i];o&&o.calamityCounters>0&&(o.calamityCounters--,y.emit("onCalamityTick",{cryptid:o,owner:t,countersRemaining:o.calamityCounters}),o.calamityCounters===0&&o.hadCalamity&&(n.push({cryptid:o,col:r,row:i}),y.emit("onCalamityDeath",{cryptid:o,owner:t})))}return n}processBleed(t){let a=t==="player"?this.playerField:this.enemyField;for(let n=0;n<2;n++)for(let r=0;r<3;r++){let i=a[n][r];i&&i.bleedTurns>0&&(i.bleedTurns--,i.bleedTurns===0&&y.emit("onStatusWearOff",{status:"bleed",cryptid:i,owner:t}))}}processParalyze(t){}getStatusIcons(t){let a=[];return t.burnTurns>0&&a.push("\u{1F525}"),t.paralyzed&&a.push("\u26A1"),t.bleedTurns>0&&a.push("\u{1FA78}"),t.curseTokens>0&&a.push(`\u{1F52E}${t.curseTokens}`),t.calamityCounters>0&&a.push(`\u{1F480}${t.calamityCounters}`),t.protectionCharges>0&&a.push(`\u{1F6E1}\uFE0F${t.protectionCharges>1?t.protectionCharges:""}`),t.hasFocus&&a.push("\u{1F3AF}"),(t.latchedTo||t.latchedBy)&&a.push("\u{1F517}"),t.auras?.length>0&&a.push("\u2728"),t.hasDestroyer&&a.push("\u{1F4A5}"),a}applyAura(t,a){return!t||!a?!1:(t.auras||(t.auras=[]),t.auras.push({key:a.key,name:a.name,sprite:a.sprite,atkBonus:a.atkBonus||0,hpBonus:a.hpBonus||0,onAttackBonus:a.onAttackBonus||null}),a.atkBonus&&(t.currentAtk+=a.atkBonus),a.hpBonus&&(t.currentHp+=a.hpBonus,t.maxHp+=a.hpBonus),a.onApply&&a.onApply(a,t,this),y.emit("onAuraApplied",{cryptid:t,aura:a,owner:t.owner}),!0)}getAuraAttackBonus(t,a){if(!t?.auras)return 0;let n=0;for(let r of t.auras)r.onAttackBonus&&(n+=r.onAttackBonus(r,t,a,this));return n}getValidAuraTargets(t){let a=[],n=t==="player"?this.playerField:this.enemyField;for(let r=0;r<2;r++)for(let i=0;i<3;i++){let o=n[r][i];o&&a.push({owner:t,col:r,row:i,cryptid:o})}return a}canPlayPyreCard(t){return!(t==="player"?this.playerPyreCardPlayedThisTurn:this.enemyPyreCardPlayedThisTurn)&&(this.phase==="conjure1"||this.phase==="conjure2")}playPyreCard(t,a){if(!this.canPlayPyreCard(t))return!1;t==="player"?this.playerPyreCardPlayedThisTurn=!0:this.enemyPyreCardPlayedThisTurn=!0;let n=a.effect(this,t);return y.emit("onPyreCardPlayed",{owner:t,card:a,pyreGained:n?.pyreGained||0,details:n}),n}drawCard(t,a="normal"){let n=t==="player"?this.deck:this.enemyDeck,r=t==="player"?this.playerHand:this.enemyHand;if(n.length>0&&r.length<20){let i=n.pop();return i.id=Math.random().toString(36).substr(2,9),r.push(i),y.emit("onCardDrawn",{owner:t,card:i,handSize:r.length,deckSize:n.length,source:a}),i}return null}drawCards(t,a){let n=[];for(let r=0;r<a;r++){let i=this.drawCard(t,"effect");i&&n.push(i)}return n}triggerSnipeReveal(t){let a=t.owner,n=a==="player"?"enemy":"player",r=this.getEnemyCombatantAcross(t);y.emit("onSnipeReveal",{cryptid:t,owner:a}),typeof O<"u"&&O({type:"buff",target:t,message:`\u{1F441}\uFE0F ${t.name} reveals itself!`}),r&&(this.applyParalyze(r),r.currentHp-=2,y.emit("onSnipeDamage",{source:t,target:r,damage:2}),typeof O<"u"&&O({type:"abilityDamage",source:t,target:r,damage:2,message:`\u26A1 ${r.name} paralyzed & takes 2 damage!`}),r.currentHp<=0&&this.killCryptid(r,a))}getFieldCryptid(t,a,n){return(t==="player"?this.playerField:this.enemyField)[a]?.[n]||null}setFieldCryptid(t,a,n,r){let i=t==="player"?this.playerField:this.enemyField;i[a][n]=r}getSupportCol(t){return t==="player"?0:1}getCombatCol(t){return t==="player"?1:0}getEffectiveStats(t){if(!t)return null;let{owner:a,col:n,row:r}=t,i=this.getCombatCol(a),o=this.getSupportCol(a),s=t.currentAtk-(t.atkDebuff||0)-(t.curseTokens||0);if(n===i){let l=this.getFieldCryptid(a,o,r);l&&(s+=l.currentAtk-(l.curseTokens||0),t.supportHpBonus=l.currentHp)}return{atk:Math.max(0,s),hp:t.currentHp,maxHp:t.maxHp}}summonCryptid(t,a,n,r){let i=t==="player"?this.playerField:this.enemyField;if(i[a][n]!==null)return!1;let o=this.getSupportCol(t),s=this.getCombatCol(t),l={...r,owner:t,col:a,row:n,currentHp:r.hp,maxHp:r.hp,currentAtk:r.atk,baseAtk:r.atk,baseHp:r.hp,tapped:!1,canAttack:!0,extraTapTurns:0,evolutionChain:r.evolutionChain||[r.key],evolvedThisTurn:!1,justSummoned:!0,burnTurns:0,stunned:!1,paralyzed:!1,paralyzeTurns:0,bleedTurns:0,protectionCharges:0,curseTokens:0,latchedTo:null,latchedBy:null,auras:[],attackedThisTurn:!1,restedThisTurn:!1};if(i[a][n]=l,l.onSummon&&l.onSummon(l,t,this),a===o&&l.onSupport&&l.onSupport(l,t,this),y.emit("onSummon",{owner:t,cryptid:l,col:a,row:n,isSupport:a===o,isKindling:r.isKindling||!1}),a===s){l.onCombat&&l.onCombat(l,t,this),l.onEnterCombat&&l.onEnterCombat(l,t,this),y.emit("onEnterCombat",{cryptid:l,owner:t,row:n,source:"summon"});let c=this.getFieldCryptid(t,o,n);c?.onSupport&&!this.isSupportNegated(c)&&c.onSupport(c,t,this);let m=t==="player"?"enemy":"player",f=this.getCombatCol(m),u=(m==="player"?this.playerField:this.enemyField)[f][n];u?.onEnemySummonedAcross&&u.onEnemySummonedAcross(u,l,this)}return this.isMultiplayer&&t==="player"&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onSummon(r,t,a,n,r.foil||!1),l}getValidSummonSlots(t){let a=t==="player"?this.playerField:this.enemyField,n=this.getCombatCol(t),r=this.getSupportCol(t),i=[];for(let o=0;o<3;o++)a[n][o]===null?i.push({col:n,row:o}):a[r][o]===null&&i.push({col:r,row:o});return i}calculateAttackDamage(t,a=!0){let{owner:n,col:r,row:i}=t,o=this.getCombatCol(n),s=this.getSupportCol(n),l=t.currentAtk-(t.atkDebuff||0)-(t.curseTokens||0);if(r===o){let c=this.getFieldCryptid(n,s,i);c&&(l+=c.currentAtk-(c.atkDebuff||0)-(c.curseTokens||0))}return t.bonusDamage&&(l+=t.bonusDamage),a&&this.isTileToxic(n,r,i)&&(l-=1),Math.max(0,l)}attack(t,a,n,r){let i=this.getFieldCryptid(a,n,r);if(!i)return!1;t.onBeforeAttack&&t.onBeforeAttack(t,i,this);let o=this.getSupport(t);o?.onCombatantBeforeAttack&&!this.isSupportNegated(o)&&o.onCombatantBeforeAttack(o,t,i,this),y.emit("onAttackDeclared",{attacker:t,target:i,attackerOwner:t.owner,targetOwner:a}),y.emit("onTargeted",{target:i,targetOwner:a,source:t,sourceType:"attack"});let s=a==="player"?this.playerTraps:this.enemyTraps;for(let S=0;S<s.length;S++){let C=s[S];if(C?.key==="terrify"&&C.triggerType==="onEnemyAttack"){t.savedAtk=t.currentAtk||t.atk,t.currentAtk=0,t.terrified=!0,y.emit("onTerrify",{trap:C,attacker:t,owner:a}),y.emit("onTrapTriggered",{trap:C,owner:a,row:S}),s[S]=null;break}}if(i.onBeforeDefend&&i.onBeforeDefend(i,t,this),i.negateIncomingAttack){i.negateIncomingAttack=!1;let S=t.currentHp<=0;if(!S){let C=this.getSupport(t),v=t.hasFocus||C?.grantsFocus&&!this.isSupportNegated(C),z=C?.preventCombatantTap||t.noTapOnAttack;t.canAttackAgain?t.canAttackAgain=!1:(v||z||(t.tapped=!0),t.canAttack=!1),t.attackedThisTurn=!0}return y.emit("onAttackNegated",{attacker:t,target:i,targetOwner:a,attackerKilled:S}),{negated:!0,attackerKilled:S}}let l=this.getSupport(i);l?.onCombatantAttacked&&!this.isSupportNegated(l)&&l.onCombatantAttacked(l,i,t,this);let c=this.calculateAttackDamage(t);t.onCombatAttack&&(c+=t.onCombatAttack(t,i,this)||0),c+=this.getAuraAttackBonus(t,i),i.paralyzed&&t.bonusVsParalyzed&&(c+=t.bonusVsParalyzed),t.bonusVsAilment&&this.hasStatusAilment(i)&&(c+=t.bonusVsAilment),i.tapped&&t.doubleDamageVsTapped&&(c*=2),i.bleedTurns>0&&(c*=2,y.emit("onBleedDamage",{target:i,attacker:t,owner:a}));let m=t.hasFocus||o?.grantsFocus&&!this.isSupportNegated(o),f=i.damageReduction||0;i.onDefend&&(f+=i.onDefend(i,t,this)||0),m&&(f=0);let h=c;c=Math.max(0,c-f),f>0&&h>0&&y.emit("onDamageReduced",{target:i,attacker:t,originalDamage:h,reducedDamage:c,reduction:Math.min(f,h),targetOwner:a,attackerOwner:t.owner});let u=!1;!m&&i.blockFirstHit&&(i.damageReduction||0)>=999?(i.damageReduction=0,i.blockFirstHit=!1,i.protectionCharges=Math.max(0,(i.protectionCharges||1)-1),c=0,u=!0,y.emit("onProtectionBlock",{target:i,attacker:t,owner:a})):(i.damageReduction||0)>0&&(i.damageReduction||0)<999&&(i.damageReduction=0),c>0&&this.isTileToxic(a,n,r)&&(c+=1,y.emit("onToxicDamage",{target:i,bonusDamage:1,owner:a}));let b=i.currentHp;if(i.currentHp-=c,c>0&&(y.emit("onDamageTaken",{target:i,damage:c,source:t,sourceType:"attack",hpBefore:b,hpAfter:i.currentHp}),y.emit("onHit",{attacker:t,target:i,damage:c,hpBefore:b,hpAfter:i.currentHp}),i.onTakeDamage&&i.onTakeDamage(i,t,c,this),i.mutatedRatSupport&&this.applyCalamity(t,3),t.attacksApplyCalamity&&this.applyCalamity(i,t.attacksApplyCalamity),t.attacksApplyParalyze&&this.applyParalyze(i),t.attacksApplyBleed&&this.applyBleed(i),t.attacksApplyBurn&&this.applyBurn(i),t.attacksApplyCurse&&this.applyCurse(i,t.attacksApplyCurse),t.owner==="player"?this.matchStats.damageDealt+=c:this.matchStats.damageTaken+=c),t.hasCleave&&c>0){let S=this.getSupportCol(a),C=this.getCombatCol(a);if(n===C){let v=this.getFieldCryptid(a,S,r);v&&(v.currentHp-=c,y.emit("onCleaveDamage",{attacker:t,target:v,damage:c}),O({type:"cleave",source:t,target:v,damage:c,message:`\u2694 ${t.name} cleaves!`}),v.currentHp<=0&&(v.killedBy="cleave",v.killedBySource=t,this.killCryptid(v,t.owner),t.onKill&&t.onKill(t,v,this),y.emit("onKill",{killer:t,victim:v,killerOwner:t.owner,victimOwner:a})))}else if(n===S){let v=this.getFieldCryptid(a,C,r);v&&(v.currentHp-=c,y.emit("onCleaveDamage",{attacker:t,target:v,damage:c}),O({type:"cleave",source:t,target:v,damage:c,message:`\u2694 ${t.name} cleaves!`}),v.currentHp<=0&&(v.killedBy="cleave",v.killedBySource=t,this.killCryptid(v,t.owner),t.onKill&&t.onKill(v,this),y.emit("onKill",{killer:t,victim:v,killerOwner:t.owner,victimOwner:a})))}}let x=this.getEffectiveHp(i),A=!1,T=!1;if(x<=0){A=!0,i.killedBy="attack",i.killedBySource=t;let S=Math.abs(i.currentHp);if(this.killCryptid(i,t.owner),t.onKill&&t.onKill(t,i,this),y.emit("onKill",{killer:t,victim:i,killerOwner:t.owner,victimOwner:a}),t.healOnKill>0){let C=t.maxHp||t.hp,v=Math.min(t.healOnKill,C-t.currentHp);v>0&&(t.currentHp+=v,y.emit("onHeal",{cryptid:t,amount:v,source:"healOnKill"}))}if(t.hasDestroyer&&S>0){let C=this.getFieldCryptid(a,this.getSupportCol(a),r);if(C){let v=C.currentHp;C.currentHp-=S,y.emit("onDestroyerDamage",{attacker:t,target:i,support:C,damage:S,hpBefore:v,hpAfter:C.currentHp}),C.currentHp<=0&&(T=!0,C.killedBy="destroyer",C.killedBySource=t,this.killCryptid(C,t.owner),y.emit("onKill",{killer:t,victim:C,killerOwner:t.owner,victimOwner:a}))}}}!A&&t.hasLatch&&!t.latchedTo&&c>0&&this.applyLatch(t,i),y.emit("onTap",{cryptid:t,owner:t.owner,reason:"attack"});let I=o?.preventCombatantTap||t.noTapOnAttack;if(console.log("[Attack] Tap check:",t.name,"support:",o?.name,"preventCombatantTap:",o?.preventCombatantTap,"noTapOnAttack:",t.noTapOnAttack,"hasFocus:",m,"preventTap:",I),t.canAttackAgain?t.canAttackAgain=!1:(m||I||(t.tapped=!0),t.canAttack=!1),t.attackedThisTurn=!0,this.attackersThisTurn[t.owner].find(S=>S.key===t.key)||this.attackersThisTurn[t.owner].push({key:t.key,name:t.name}),t.elderVampireSupport){let S=t.currentHp;t.currentHp=Math.min(t.maxHp,t.currentHp+2),t.currentHp>S&&y.emit("onHeal",{target:t,amount:2,source:t.elderVampireSupport,sourceType:"elderVampireDarkGift"})}if(t.hasMultiAttack&&!t.multiAttackProcessed){t.multiAttackProcessed=!0;let S=a==="player"?this.playerField:this.enemyField,C=this.getCombatCol(a);for(let v=0;v<3;v++){if(v===r)continue;let z=S[C][v];z&&(z.currentHp-=c,y.emit("onMultiAttackDamage",{attacker:t,target:z,damage:c}),O({type:"multiAttack",source:t,target:z,damage:c}),z.currentHp<=0&&(z.killedBy="multiAttack",this.killCryptid(z,t.owner),t.onKill&&t.onKill(t,z,this)))}t.multiAttackProcessed=!1}return{damage:c,killed:A,protectionBlocked:u}}killCryptid(t,a=null){let n=t.owner;if(n==="player"?this.playerDeathCount=this.playerDeathCount||0:this.enemyDeathCount=this.enemyDeathCount||0,t.onDeath&&t.onDeath(t,this),t.preventDeath)return t.preventDeath=!1,null;let{col:r,row:i}=t,o=this.getCombatCol(n),s=this.getSupportCol(n),l=t.evolutionChain?.length||1;this.removeLatch(t),this.setFieldCryptid(n,r,i,null);let c=n==="player"?this.playerDeaths:this.enemyDeaths;if(n==="player"?(this.playerDeaths+=l,this.playerDeathCount+=1):(this.enemyDeaths+=l,this.enemyDeathCount+=1),this.deathsThisTurn[n]+=l,y.emit("onDeath",{cryptid:t,owner:n,col:r,row:i,killerOwner:a,deathCount:l}),r===o){let m=this.getFieldCryptid(n,s,i);if(m?.hasInherit){let f=t.currentAtk||t.atk,h=!1;f>(m.baseAtk||m.atk)&&(m.currentAtk=f,h=!0);let u=t.currentHp>0?t.currentHp:t.maxHp||t.hp;u>(m.baseHp||m.hp)&&(m.currentHp=u,m.maxHp=u,h=!0),y.emit("onSkinwalkerInherit",{support:m,deadCombatant:t,inheritedAtk:m.currentAtk,inheritedHp:m.currentHp,owner:n}),h&&typeof O<"u"&&O({type:"buff",target:m,message:`\u{1F3AD} ${m.name} inherits ${t.name}'s power!`})}}if(a&&(n===a?y.emit("onAllyDeath",{cryptid:t,owner:n,killerOwner:a}):y.emit("onEnemyDeath",{cryptid:t,owner:n,killerOwner:a})),y.emit("onDeathCounterChanged",{owner:n,oldValue:c,newValue:n==="player"?this.playerDeaths:this.enemyDeaths,change:l}),this.isFieldEmpty(n)&&y.emit("onFieldEmpty",{owner:n}),r===o){let m=this.getFieldCryptid(n,s,i);m&&(this.setFieldCryptid(n,s,i,null),m.col=o,this.setFieldCryptid(n,o,i,m),y.emit("onPromotion",{cryptid:m,owner:n,row:i,fromCol:s,toCol:o}),m.onCombat&&m.onCombat(m,n,this),m.onEnterCombat&&m.onEnterCombat(m,n,this),y.emit("onEnterCombat",{cryptid:m,owner:n,row:i,source:"promotion"}),window.pendingPromotions||(window.pendingPromotions=[]),window.pendingPromotions.push({owner:n,row:i}))}else if(r===s){let m=this.getFieldCryptid(n,o,i);m&&(m.checkDeathAfterSupportLoss=!0)}return this.checkGameOver(),{owner:n,col:r,row:i,deathCount:l}}findCardInHand(t,a){return(t==="player"?this.playerHand:this.enemyHand).find(r=>r.key===a)||null}findCardInDeck(t,a){return(t==="player"?this.deck:this.enemyDeck).find(r=>r.key===a)||null}removeFromHand(t,a){let n=t==="player"?this.playerHand:this.enemyHand,r=n.indexOf(a);return r>=0?(n.splice(r,1),!0):!1}removeFromDeck(t,a){let n=t==="player"?this.deck:this.enemyDeck,r=n.indexOf(a);return r>=0?(n.splice(r,1),!0):!1}evolveInPlace(t,a,n){let{col:r,row:i}=t,o=t.evolutionChain||[t.key],s={...a,owner:n,col:r,row:i,currentHp:a.hp,maxHp:a.hp,currentAtk:a.atk,baseAtk:a.atk,baseHp:a.hp,tapped:t.tapped,canAttack:t.canAttack,extraTapTurns:t.extraTapTurns||0,evolutionChain:[...o,a.key],evolvedThisTurn:!0,justSummoned:!1,burnTurns:0,stunned:!1,paralyzed:!1,paralyzeTurns:0,bleedTurns:0,protectionCharges:0,curseTokens:0,latchedTo:null,latchedBy:null,auras:[],attackedThisTurn:t.attackedThisTurn||!1,restedThisTurn:t.restedThisTurn||!1};this.setFieldCryptid(n,r,i,s),s.onSummon&&s.onSummon(s,n,this);let l=this.getCombatCol(n),c=this.getSupportCol(n);if(r===l){s.onCombat&&s.onCombat(s,n,this);let m=this.getFieldCryptid(n,c,i);m?.onSupport&&!this.isSupportNegated(m)&&m.onSupport(m,n,this)}return r===c&&s.onSupport&&s.onSupport(s,n,this),y.emit("onEvolution",{cryptid:s,previous:t,owner:n,col:r,row:i,source:"special"}),s}getEffectiveHp(t){if(!t)return 0;let a=t.currentHp,n=this.getCombatCol(t.owner),r=this.getSupportCol(t.owner);if(t.col===n){let i=this.getFieldCryptid(t.owner,r,t.row);i&&(a+=i.currentHp)}return a}checkDeath(t){return t?.currentHp<=0?this.killCryptid(t):null}promoteSupport(t,a){let n=this.getCombatCol(t),r=this.getSupportCol(t),i=this.getFieldCryptid(t,n,a),o=this.getFieldCryptid(t,r,a);return!i&&o?(this.setFieldCryptid(t,r,a,null),o.col=n,this.setFieldCryptid(t,n,a,o),y.emit("onPromotion",{cryptid:o,owner:t,row:a,fromCol:r,toCol:n}),o.onCombat&&o.onCombat(o,t,this),o.onEnterCombat&&o.onEnterCombat(o,t,this),y.emit("onEnterCombat",{cryptid:o,owner:t,row:a,source:"promotion"}),o):null}popRandomKindling(t){let a=t==="player"?this.playerKindling:this.enemyKindling;if(this.isMultiplayer&&t==="enemy"&&a.length===0&&(console.log("[Game] Warning: Enemy kindling not synced, using fallback pool"),typeof DeckBuilder<"u"&&DeckBuilder.buildKindlingPool&&(this.enemyKindling=DeckBuilder.buildKindlingPool(),a=this.enemyKindling)),a.length===0)return null;let n=Math.floor(Math.random()*a.length);return a.splice(n,1)[0]}summonKindling(t,a,n,r){if(!r)return null;let i=this.getSupportCol(t),o=this.getCombatCol(t),s={...r,owner:t,col:a,row:n,currentHp:r.hp,maxHp:r.hp,currentAtk:r.atk,baseAtk:r.atk,baseHp:r.hp,tapped:!1,canAttack:!0,extraTapTurns:0,isKindling:!0,evolutionChain:[r.key],justSummoned:!0,burnTurns:0,stunned:!1,paralyzed:!1,paralyzeTurns:0,bleedTurns:0,protectionCharges:0,curseTokens:0,latchedTo:null,latchedBy:null,auras:[],attackedThisTurn:!1,restedThisTurn:!1};if(this.setFieldCryptid(t,a,n,s),s.onSummon&&s.onSummon(s,t,this),a===i&&s.onSupport&&s.onSupport(s,t,this),a===o){s.onCombat&&s.onCombat(s,t,this),y.emit("onEnterCombat",{cryptid:s,owner:t,row:n,source:"summon"});let l=this.getFieldCryptid(t,i,n);l?.onSupport&&!this.isSupportNegated(l)&&l.onSupport(l,t,this)}return y.emit("onSummon",{owner:t,cryptid:s,col:a,row:n,isSupport:a===i,isKindling:!0}),this.isMultiplayer&&t==="player"&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onSummon(r,t,a,n,r.foil||!1),s}canPlayKindling(t){let a=t==="player"?this.playerKindling:this.enemyKindling,n=t==="player"?this.playerKindlingPlayedThisTurn:this.enemyKindlingPlayedThisTurn;return a.length>0&&!n&&(this.phase==="conjure1"||this.phase==="conjure2")}getValidAttackTargets(t){let a=t.owner==="player"?"enemy":"player",n=a==="player"?this.playerField:this.enemyField,r=this.getCombatCol(a),i=this.getSupportCol(a),o=a==="player"?this.playerKindling:this.enemyKindling,s=[],l=this.isFieldEmpty(a);if(t.canTargetAny){for(let c=0;c<2;c++)for(let m=0;m<3;m++){let f=n[c][m];f&&s.push({col:c,row:m,cryptid:f})}if(l&&o.length>0)for(let c=0;c<3;c++)n[r][c]||s.push({owner:a,col:r,row:c,cryptid:null,isEmptyTarget:!0});return s}for(let c=0;c<3;c++){let m=n[r][c],f=n[i][c];m&&s.push({col:r,row:c,cryptid:m}),f&&(t.canTargetSupport||t.hasFlight||!m||m.tapped)&&s.push({col:i,row:c,cryptid:f}),l&&o.length>0&&!m&&s.push({owner:a,col:r,row:c,cryptid:null,isEmptyTarget:!0})}return s}getValidBurstTargets(t,a){let n=[],r=t.targetType||"any",i=t.validateTarget;!i&&t.key&&(i=CardRegistry.getBurst(t.key)?.validateTarget);for(let s=0;s<2;s++)for(let l=0;l<3;l++){let c=this.playerField[s][l],m=this.enemyField[s][l];r==="tile"||r==="enemyTile"||r==="allyTile"?r==="tile"?(n.push({owner:"player",col:s,row:l,cryptid:c,isTile:!0}),n.push({owner:"enemy",col:s,row:l,cryptid:m,isTile:!0})):r==="enemyTile"?(a==="player"&&n.push({owner:"enemy",col:s,row:l,cryptid:m,isTile:!0}),a==="enemy"&&n.push({owner:"player",col:s,row:l,cryptid:c,isTile:!0})):r==="allyTile"&&(a==="player"&&n.push({owner:"player",col:s,row:l,cryptid:c,isTile:!0}),a==="enemy"&&n.push({owner:"enemy",col:s,row:l,cryptid:m,isTile:!0})):(r==="any"||r==="ally"||r==="allyCryptid")&&(a==="player"&&c&&n.push({owner:"player",col:s,row:l,cryptid:c}),a==="enemy"&&m&&n.push({owner:"enemy",col:s,row:l,cryptid:m})),(r==="any"||r==="enemy"||r==="enemyCryptid")&&(a==="player"&&m&&n.push({owner:"enemy",col:s,row:l,cryptid:m}),a==="enemy"&&c&&n.push({owner:"player",col:s,row:l,cryptid:c}))}let o=n;return t.requiresCombatPosition&&(o=o.filter(s=>{if(!s.cryptid)return!1;let l=this.getCombatCol(s.owner);return s.col===l})),t.requiresEnemyAcross&&(o=o.filter(s=>{if(!s.cryptid)return!1;let l=s.owner==="player"?"enemy":"player",c=this.getCombatCol(l);return!!(l==="player"?this.playerField:this.enemyField)[c][s.row]})),i&&(o=o.filter(s=>i(s.cryptid,a,this))),o}getValidEvolutionTargets(t,a){if(!t.evolvesFrom)return[];let n=[],r=a==="player"?this.playerField:this.enemyField;for(let i=0;i<2;i++)for(let o=0;o<3;o++){let s=r[i][o];s&&s.key===t.evolvesFrom&&!s.evolvedThisTurn&&!this.evolvedThisTurn[`${a}-${i}-${o}`]&&n.push({owner:a,col:i,row:o,cryptid:s})}return n}evolveCryptid(t,a){let{owner:n,col:r,row:i}=t,o={...a,owner:n,col:r,row:i,currentHp:a.hp,maxHp:a.hp,currentAtk:a.atk,baseAtk:a.atk,baseHp:a.hp,tapped:t.tapped,canAttack:t.canAttack,extraTapTurns:0,evolutionChain:[...t.evolutionChain||[t.key],a.key],evolvedThisTurn:!0};this.setFieldCryptid(n,r,i,o),this.evolvedThisTurn[`${n}-${r}-${i}`]=!0;let s=this.getSupportCol(n),l=this.getCombatCol(n);if(r===s&&o.onSupport&&o.onSupport(o,n,this),r===l){let c=this.getFieldCryptid(n,s,i);c?.onSupport&&!this.isSupportNegated(c)&&c.onSupport(c,n,this)}return n==="player"&&this.matchStats.evolutions++,y.emit("onEvolution",{baseCryptid:t,evolved:o,owner:n,col:r,row:i,evolutionStage:o.evolutionChain.length}),o}startTurn(t,a=!1){this.currentTurn=t,this.phase="conjure1",this.turnNumber++,this.evolvedThisTurn={},this.deathsThisTurn={player:0,enemy:0};let n=t==="player"?"enemy":"player";this.lastTurnAttackers[n]=[...this.attackersThisTurn[n]],this.attackersThisTurn={player:[],enemy:[]};let r=t==="player"?this.playerField:this.enemyField;for(let f=0;f<2;f++)for(let h=0;h<3;h++){let u=r[f][h];u?.terrified&&(u.currentAtk=u.savedAtk||u.atk,u.terrified=!1,delete u.savedAtk)}this.playerPyreDrainImmune=!1,this.enemyPyreDrainImmune=!1;let i=t==="player"?this.playerField:this.enemyField,o=this.getSupportCol(t);for(let f=0;f<3;f++)i[o][f]?.key==="jerseyDevil"&&(t==="player"?this.playerPyreDrainImmune=!0:this.enemyPyreDrainImmune=!0);let s=t==="player"?this.playerPyre:this.enemyPyre;if(t==="player"?(this.playerPyre++,this.playerKindlingPlayedThisTurn=!1,this.playerPyreCardPlayedThisTurn=!1):(this.enemyPyre++,this.enemyKindlingPlayedThisTurn=!1,this.enemyPyreCardPlayedThisTurn=!1),y.emit("onPyreGained",{owner:t,amount:1,oldValue:s,newValue:s+1,source:"turnStart"}),!a){this.processToxicTiles(t);let f=this.processBurnDamage(t);for(let u of f)u.cryptid.killedBy="burn",this.killCryptid(u.cryptid,null);let h=this.processCalamity(t);for(let u of h)u.cryptid.killedBy="calamity",this.killCryptid(u.cryptid,null);this.processBleed(t),this.processCurse(t)}let l=t==="player"?this.playerField:this.enemyField,c=this.getSupportCol(t),m=this.getCombatCol(t);for(let f=0;f<2;f++)for(let h=0;h<3;h++){let u=l[f][h];if(u){if(u.evolvedThisTurn=!1,f===m&&!u.attackedThisTurn){u.rested=!0;let b=l[c][h];b?.onCombatantRest&&b.onCombatantRest(b,u,this)}else u.rested=!1;if(u.attackedThisTurn=!1,u.protectionPerTurn&&this.applyProtection(u,u.protectionPerTurn),u.extraTapTurns>0)u.extraTapTurns--;else if(u.paralyzed)u.paralyzeTurns--,u.paralyzeTurns<=0&&(u.paralyzed=!1,u.paralyzeTurns=0,console.log(`[Paralyze] ${u.name} recovered - will untap next turn`),y.emit("onStatusWearOff",{status:"paralyze",cryptid:u,owner:t}));else{let b=u.tapped;u.tapped=!1,u.canAttack=!0,b&&y.emit("onUntap",{cryptid:u,owner:t,reason:"turnStart"})}if(u.pyreFuel&&u.col===c){let b=t==="player"?this.playerPyre:this.enemyPyre;t==="player"?this.playerPyre++:this.enemyPyre++,y.emit("onPyreGained",{owner:t,amount:1,oldValue:b,newValue:b+1,source:"pyreFuel",sourceCryptid:u})}if(u.hasBloodPactAbility&&(u.bloodPactAvailable=!0),u.tempAtkDebuff&&(u.atkDebuff=Math.max(0,(u.atkDebuff||0)-1),u.tempAtkDebuff=!1),u.regeneration>0){let b=u.maxHp||u.hp;u.currentHp=Math.min(b,u.currentHp+u.regeneration)}u.onTurnStart&&u.onTurnStart(u,t,this)}}this.drawCard(t),y.emit("onTurnStart",{owner:t,turnNumber:this.turnNumber,phase:this.phase})}getPendingStatusEffects(t){let a=t==="player"?this.playerField:this.enemyField,n=[];for(let o=0;o<2;o++)for(let s=0;s<3;s++){let l=a[o][s];if(l&&l.burnTurns>0){let c=l.currentHp<=1;n.push({type:"burn",owner:t,col:o,row:s,name:l.name,cryptid:l,willDie:c})}if(l&&l.calamityCounters>0){let c=l.calamityCounters<=1;n.push({type:"calamity",owner:t,col:o,row:s,name:l.name,cryptid:l,willDie:c,counters:l.calamityCounters})}}let r=t==="player"?this.playerToxicTiles:this.enemyToxicTiles,i=this.getCombatCol(t);for(let o=0;o<3;o++)if(r[i][o]>0){let s=a[i][o];s&&n.push({type:"toxic",owner:t,col:i,row:o,name:s.name,cryptid:s})}return n}processSingleStatusEffect(t){if(t.type==="burn"){let a=t.cryptid;if(a&&a.burnTurns>0&&(a.currentHp-=1,a.burnTurns--,y.emit("onBurnDamage",{cryptid:a,owner:t.owner,damage:1,turnsRemaining:a.burnTurns}),a.currentHp<=0))return a.killedBy="burn",this.killCryptid(a,null)!==null?{died:!0,cryptid:a}:{died:!1,evolved:!0,cryptid:a}}else if(t.type!=="toxic"){if(t.type==="calamity"){let a=t.cryptid;if(a&&a.calamityCounters>0&&(a.calamityCounters--,y.emit("onCalamityTick",{cryptid:a,owner:t.owner,countersRemaining:a.calamityCounters}),a.calamityCounters<=0))return y.emit("onCalamityDeath",{cryptid:a,owner:t.owner}),this.killCryptid(a,null)!==null?{died:!0,cryptid:a}:{died:!1,evolved:!0,cryptid:a}}}return{died:!1}}applyAllSupportAbilities(t){let a=t==="player"?this.playerField:this.enemyField,n=this.getSupportCol(t);console.log("[applyAllSupportAbilities] owner:",t,"supportCol:",n);for(let r=0;r<3;r++){let i=a[n][r];i?.onSupport&&!this.isSupportNegated(i)&&(console.log("[applyAllSupportAbilities] Calling onSupport for",i.name,"row:",r),i.onSupport(i,t,this))}}isSupportNegated(t){if(!t)return!1;let a=t.owner==="player"?"enemy":"player",n=a==="player"?this.playerField:this.enemyField,r=this.getSupportCol(a);return!!n[r][t.row]?.negatesEnemySupport}endTurn(){let t=this.currentTurn==="player"?this.playerField:this.enemyField,a=this.getSupportCol(this.currentTurn),n=this.getCombatCol(this.currentTurn);for(let s=0;s<3;s++){let l=t[a][s];if(l){if(l.radianceActive)for(let c=0;c<2;c++)for(let m=0;m<3;m++){let f=t[c][m];if(f){let h=f.currentHp;f.currentHp=Math.min(f.maxHp,f.currentHp+1),f.currentHp>h&&y.emit("onHeal",{target:f,amount:f.currentHp-h,source:l,sourceType:"radiance"})}}if(l.regenActive){let c=t[n][s];if(c){let m=c.currentHp;c.currentHp=Math.min(c.maxHp,c.currentHp+1),c.currentHp>m&&y.emit("onHeal",{target:c,amount:c.currentHp-m,source:l,sourceType:"regen"})}}}}let r=this.currentTurn,i=r==="player"?"enemy":"player";this.deathsLastEnemyTurn[i]=this.deathsThisTurn[i];let o=r==="player"?this.playerField:this.enemyField;for(let s=0;s<2;s++)for(let l=0;l<3;l++){let c=o[s][l];c?.onTurnEnd&&c.onTurnEnd(c,r,this)}if(y.emit("onTurnEnd",{owner:this.currentTurn,turnNumber:this.turnNumber}),this.isMultiplayer&&this.currentTurn==="player"){this.processEnemyTurnStartEffects(),this.currentTurn="enemy",this.phase="waiting";return}this.startTurn(this.currentTurn==="player"?"enemy":"player",!0)}processEnemyTurnStartEffects(){let t=this.enemyField,a=this.getCombatCol("enemy"),n=this.getSupportCol("enemy");for(let r=0;r<2;r++)for(let i=0;i<3;i++){let o=t[r][i];o?.terrified&&(o.currentAtk=o.savedAtk||o.atk,o.terrified=!1,delete o.savedAtk)}for(let r=0;r<2;r++)for(let i=0;i<3;i++){let o=t[r][i];o&&r===a&&(o.tapped=!1,o.canAttack=!0)}}pyreBurn(t){let a=t==="player"?this.playerDeaths:this.enemyDeaths;if(!(t==="player"?this.playerPyreBurnUsed:this.enemyPyreBurnUsed)&&a>0){let r=t==="player"?this.playerPyre:this.enemyPyre;t==="player"?(this.playerPyre+=a,this.playerPyreBurnUsed=!0):(this.enemyPyre+=a,this.enemyPyreBurnUsed=!0),y.emit("onPyreBurn",{owner:t,pyreGained:a,cardsDrawn:a}),y.emit("onPyreGained",{owner:t,amount:a,oldValue:r,newValue:r+a,source:"pyreBurn"});for(let i=0;i<a;i++)this.drawCard(t,"pyreBurn");return a}return 0}checkGameOver(){this.playerDeaths>=10?this.endGame("enemy"):this.enemyDeaths>=10&&this.endGame("player")}endGame(t){if(this.gameOver)return;if(this.gameOver=!0,this.isMultiplayer&&typeof window.Multiplayer<"u"&&window.Multiplayer.isInMatch){let i={type:"action",matchId:window.Multiplayer.matchId,playerId:window.Multiplayer.playerId,action:{type:"gameOver",winner:t==="player"?window.Multiplayer.playerId:window.Multiplayer.opponentId},state:window.Multiplayer.serializeGameState()};window.Multiplayer.send(i)}let a=Math.floor((Date.now()-this.matchStats.startTime)/1e3),n=t==="player",r={isWin:n,isHuman:this.isMultiplayer,isMultiplayer:this.isMultiplayer,stats:{kills:this.enemyDeaths,playerDeaths:this.playerDeaths,damageDealt:this.matchStats.damageDealt,turns:this.turnNumber,spellsCast:this.matchStats.spellsCast,evolutions:this.matchStats.evolutions,perfectWin:this.playerDeaths===0&&n},duration:a,deckName:"Battle Deck",opponentName:this.isMultiplayer?window.Multiplayer?.opponentName:"AI"};if(typeof WinScreen<"u"&&WinScreen.show)WinScreen.show(r);else{let i=document.getElementById("game-over"),o=document.getElementById("game-over-text"),s=document.getElementById("game-over-sub");i.classList.remove("victory","defeat"),t==="player"?(o.textContent="VICTORY",s.textContent=`The ritual is complete. ${this.enemyDeaths} spirits vanquished.`,i.classList.add("victory")):(o.textContent="DEFEAT",s.textContent=`The darkness claims you. ${this.playerDeaths} spirits lost...`,i.classList.add("defeat")),i.classList.add("show")}}},d,g={selectedCard:null,attackingCryptid:null,targetingBurst:null,targetingEvolution:null,targetingTrap:null,targetingAura:null,draggedCard:null,dragGhost:null,showingKindling:!1,cardTooltipTimer:null,cardTooltipVisible:!1,handCollapsed:!1},K={},w=!1,ue=0,Ft=5e3;function Ot(){w&&ue>0&&Date.now()-ue>Ft&&(console.warn("[Animation] Failsafe: resetting stuck animation state"),w=!1,ue=0,k(),B())}p(Ot,"checkAnimationTimeout");setInterval(Ot,1e3);var J=0;function qt(){d=new le,window.pendingTraps=[],window.processingTraps=!1,window.animatingTraps=new Set,Q.init(),g={selectedCard:null,attackingCryptid:null,targetingBurst:null,targetingEvolution:null,targetingTrap:null,targetingAura:null,draggedCard:null,dragGhost:null,showingKindling:!1,cardTooltipTimer:null,cardTooltipVisible:!1,handCollapsed:!1},w=!1;let e=document.getElementById("hand-area"),t=document.getElementById("hand-container");if(e&&e.classList.remove("collapsed"),t&&t.classList.remove("not-turn"),lt(),window.testMode){console.log("TEST MODE ENABLED - Granting all cards and 10 pyre"),d.playerPyre=10;for(let n of CardRegistry.getAllCryptidKeys()){let r=CardRegistry.getCryptid(n);r&&d.playerHand.push(r)}for(let n of CardRegistry.getAllInstantKeys()){let r=CardRegistry.getInstant(n);r&&d.playerHand.push(r)}for(let n of CardRegistry.getAllPyreKeys()){let r=CardRegistry.getPyre(n);r&&d.playerHand.push(r)}for(let n=0;n<7;n++)d.drawCard("enemy")}else for(let n=0;n<6;n++)d.drawCard("player"),d.drawCard("enemy");let a=window.playerGoesFirst!==!1?"player":"enemy";d.startTurn(a),setTimeout(()=>{U(),k(),J=document.getElementById("battlefield-area").offsetHeight},50),B(),a==="player"?P("The ritual begins... Your move, Seeker.",E.messageDisplay):window.TutorialManager?.isActive&&!window.TutorialManager?.freePlayMode?P("The ritual begins...",E.messageDisplay):(P("The Warden moves first...",E.messageDisplay),setTimeout(()=>{d.gameOver||window.runEnemyAI()},E.messageDisplay+400)),window.game=d}p(qt,"initGame");function U(){let t=document.getElementById("battlefield-area").getBoundingClientRect();document.querySelectorAll(".tile").forEach(a=>{let n=a.dataset.owner,r=a.dataset.col,i=parseInt(a.dataset.row),o=a.getBoundingClientRect(),s=`${n}-${r}-${i}`;K[s]={x:o.left+o.width/2-t.left,y:o.top+o.height/2-t.top}})}p(U,"calculateTilePositions");function pe(){U(),document.querySelectorAll(".cryptid-sprite, .trap-sprite").forEach(e=>{let t=`${e.dataset.owner}-${e.dataset.col}-${e.dataset.row}`,a=K[t];a&&(e.style.left=a.x+"px",e.style.top=a.y+"px")})}p(pe,"updateSpritePositions");function xe(){let e=document.getElementById("battlefield-area").offsetHeight;e!==J&&(J=e,pe())}p(xe,"onLayoutChange");function k(){Gt(),we(),V(),jt(),Nt()}p(k,"renderAll");function Gt(){if(!d)return;document.getElementById("player-pyre").textContent=d.playerPyre,document.getElementById("enemy-pyre").textContent=d.enemyPyre,document.getElementById("player-deaths").textContent=d.playerDeaths,document.getElementById("enemy-deaths").textContent=d.enemyDeaths;let e=document.getElementById("deck-count"),t=document.getElementById("burn-count"),a=document.getElementById("discard-count");e&&(e.textContent=d.deck?.length||0),t&&(t.textContent=d.playerBurnPile?.length||0),a&&(a.textContent=d.playerDiscardPile?.length||0);let n=document.getElementById("enemy-deck-count"),r=document.getElementById("enemy-burn-count"),i=document.getElementById("enemy-discard-count");n&&(n.textContent=d.enemyDeck?.length||0),r&&(r.textContent=d.enemyBurnPile?.length||0),i&&(i.textContent=d.enemyDiscardPile?.length||0);let o=d.currentTurn==="enemy"?d.isMultiplayer?"Opponent's Turn":"Warden's Turn":d.phase==="conjure1"?"First Conjuring":d.phase==="combat"?"Battle Phase":d.phase==="waiting"?"Waiting...":"Second Conjuring";document.getElementById("phase-text").textContent=o}p(Gt,"renderHUD");function Nt(){let e=document.getElementById("hint");d.currentTurn!=="player"?e.textContent=d.isMultiplayer?"Opponent is thinking...":"The Warden acts...":g.targetingTrap?e.textContent=`Choose trap slot for ${g.targetingTrap.name}`:g.targetingBurst?e.textContent=`Choose target for ${g.targetingBurst.name}`:g.targetingAura?e.textContent=`Choose ally to enchant with ${g.targetingAura.name}`:g.targetingEvolution?e.textContent=`Choose ${_(g.targetingEvolution.evolvesFrom)} to transform`:g.attackingCryptid?e.textContent="Choose your prey":g.selectedCard?e.textContent=g.selectedCard.type==="cryptid"?"Choose a sacred space":g.selectedCard.type==="trap"?"Choose a trap slot":"Choose target":d.phase==="combat"?e.textContent="Command your spirits to strike":e.textContent="Draw from your grimoire"}p(Nt,"updateHint");function we(){let e=document.getElementById("battlefield-area"),t=!1;document.querySelectorAll(".tile").forEach(a=>{let n=a.dataset.owner,r=a.dataset.col,i=parseInt(a.dataset.row);if(a.classList.remove("valid-target","attack-target","instant-target","evolution-target","trap-target","aura-target","drag-over","can-attack","toxic-active"),r==="trap"){let c=n==="player"?d.playerTraps:d.enemyTraps;if(d.currentTurn==="player"&&(d.phase==="conjure1"||d.phase==="conjure2")){let m=g.targetingTrap||(g.draggedCard?.type==="trap"?g.draggedCard:null);n==="player"&&m&&!c[i]&&(a.classList.add("trap-target"),t=!0)}return}let o=parseInt(r),l=(n==="player"?d.playerField:d.enemyField)[o]?.[i];if(d.isTileToxic(n,o,i)&&a.classList.add("toxic-active"),d.currentTurn==="player"&&(d.phase==="conjure1"||d.phase==="conjure2")){let c=g.targetingBurst||(g.draggedCard?.type==="burst"?g.draggedCard:null);c&&c.type==="burst"&&d.getValidBurstTargets(c,"player").some(f=>f.owner===n&&f.col===o&&f.row===i)&&(a.classList.add("instant-target"),t=!0)}if(l){let c=d.getCombatCol(n);if(n==="player"&&o===c&&d.phase==="combat"&&d.currentTurn==="player"&&!l.tapped&&l.canAttack&&(a.classList.add("can-attack"),t=!0),g.attackingCryptid&&n==="enemy"&&d.getValidAttackTargets(g.attackingCryptid).some(f=>f.col===o&&f.row===i)&&(a.classList.add("attack-target"),t=!0),d.currentTurn==="player"&&(d.phase==="conjure1"||d.phase==="conjure2")){(g.targetingAura||g.draggedCard?.type==="aura"&&g.draggedCard)&&n==="player"&&d.getValidAuraTargets("player").some(u=>u.col===o&&u.row===i)&&(a.classList.add("aura-target"),t=!0);let f=g.targetingEvolution||(g.draggedCard?.evolvesFrom?g.draggedCard:null);f&&d.getValidEvolutionTargets(f,"player").some(u=>u.owner===n&&u.col===o&&u.row===i)&&(a.classList.add("evolution-target"),t=!0)}}else{if(n==="player"&&(g.selectedCard||g.draggedCard)){let c=g.selectedCard||g.draggedCard,m=c.isKindling||d.playerPyre>=c.cost;c.type==="cryptid"&&m&&(d.phase==="conjure1"||d.phase==="conjure2")&&d.getValidSummonSlots("player").some(h=>h.col===o&&h.row===i)&&(a.classList.add("valid-target"),t=!0)}n==="enemy"&&g.attackingCryptid&&d.getValidAttackTargets(g.attackingCryptid).some(m=>m.col===o&&m.row===i&&m.isEmptyTarget)&&(a.classList.add("attack-target"),t=!0)}}),e.classList.toggle("has-targets",t)}p(we,"renderField");function V(){U();let e=document.getElementById("sprite-layer"),t=[];window.animatingTraps?.size>0&&document.querySelectorAll(".trap-sprite.trap-triggering").forEach(a=>{let n=`${a.dataset.owner}-trap-${a.dataset.row}`;window.animatingTraps.has(n)&&t.push(a.cloneNode(!0))}),e.innerHTML="",t.forEach(a=>e.appendChild(a));for(let a of["player","enemy"]){let n=a==="player"?d.playerField:d.enemyField,r=d.getCombatCol(a),i=d.getSupportCol(a);for(let s=0;s<2;s++)for(let l=0;l<3;l++){let c=n[s][l];if(c){let m=`${a}-${s}-${l}`,f=K[m];if(!f)continue;let h="cryptid-sprite";c.tapped&&(h+=" tapped"),a==="enemy"&&(h+=" enemy"),c.evolutionChain?.length>1&&(h+=" evolved"),c.element&&(h+=` element-${c.element}`),c.rarity&&(h+=` rarity-${c.rarity}`),c.isHidden&&(h+=" hidden-cryptid"),c.justSummoned&&(h+=" summoning",setTimeout(()=>{c.justSummoned=!1},50));let u=document.createElement("div");if(u.className=h,u.dataset.owner=a,u.dataset.col=s,u.dataset.row=l,c.isHidden&&a==="enemy"){u.innerHTML=`
                            <span class="sprite hidden-sprite">\u2753</span>
                            <div class="combat-stats">
                                <div class="crescent-bg"></div>
                                <div class="hp-arc" style="clip-path: inset(5% 0 5% 50%)"></div>
                                <div class="stat-badge atk-badge">
                                    <span class="stat-icon">\u2694</span>
                                    <span class="stat-value">?</span>
                                </div>
                                <div class="stat-badge hp-badge">
                                    <span class="stat-icon">\u2665</span>
                                    <span class="stat-value">?</span>
                                </div>
                            </div>
                        `,u.style.left=f.x+"px",u.style.top=f.y+"px",u.style.transform="translate(-50%, -50%)",e.appendChild(u);continue}let b=c.currentAtk-(c.atkDebuff||0)-(c.curseTokens||0),x=c.currentHp;if(s===r){let F=d.getFieldCryptid(a,i,l);F&&(b+=F.currentAtk-(F.atkDebuff||0)-(F.curseTokens||0),x+=F.currentHp)}let A=`<span class="sprite">${se(c.sprite,!0,c.spriteScale)}</span>`;c.isHidden&&a==="player"&&(A=`<span class="sprite hidden-own">${se(c.sprite,!0,c.spriteScale)}<span class="hidden-badge">\u{1F441}\uFE0F</span></span>`);let T=c.maxHp||c.hp,I=c.currentHp,S=Math.max(0,Math.min(100,I/T*100)),C="hp-arc";S<=25?C+=" hp-low":S<=50&&(C+=" hp-medium");let v=5+45*(1-S/100),z=a==="player"?`inset(${v}% 50% ${v}% 0)`:`inset(${v}% 0 ${v}% 50%)`,$="";if(c.evolutionChain?.length>1){$='<div class="evo-pips">';for(let F=1;F<c.evolutionChain.length;F++)$+='<span class="evo-pip"></span>';$+="</div>"}A+=`
                        <div class="combat-stats">
                            <div class="crescent-bg"></div>
                            <div class="${C}" style="clip-path: ${z}"></div>
                            <div class="stat-badge atk-badge">
                                <span class="stat-icon">\u2694</span>
                                <span class="stat-value">${Math.max(0,b)}</span>
                            </div>
                            <div class="stat-badge hp-badge">
                                <span class="stat-icon">\u2665</span>
                                <span class="stat-value">${x}</span>
                            </div>
                            ${$}
                        </div>
                    `;let G=d.getStatusIcons(c);G.length>0&&(A+=`<div class="status-icons">${G.join("")}</div>`),u.innerHTML=A,u.style.left=f.x+"px",u.style.top=f.y+"px",u.style.transform="translate(-50%, -50%)",e.appendChild(u)}}let o=a==="player"?d.playerTraps:d.enemyTraps;for(let s=0;s<2;s++){let l=o[s],c=`${a}-trap-${s}`;if(!window.animatingTraps?.has(c)&&l){let m=`${a}-trap-${s}`,f=K[m];if(!f)continue;let h="trap-sprite";(a==="enemy"&&d.isMultiplayer||l.faceDown&&a==="enemy")&&(h+=" face-down"),window.newlySpawnedTrap&&window.newlySpawnedTrap.owner===a&&window.newlySpawnedTrap.row===s&&(h+=" spawning");let b=document.createElement("div");b.className=h,b.dataset.owner=a,b.dataset.col="trap",b.dataset.row=s;let x;a==="enemy"&&d.isMultiplayer||l.faceDown&&a==="enemy"?x='<span class="sprite">\u{1F3B4}</span><span class="trap-indicator">?</span>':x=`<span class="sprite">${l.sprite}</span><span class="trap-indicator">\u26A1</span>`,b.innerHTML=x,b.style.left=f.x+"px",b.style.top=f.y+"px",b.style.transform="translate(-50%, -50%)",e.appendChild(b);let A=document.querySelector(`.tile[data-owner="${a}"][data-col="trap"][data-row="${s}"]`);A&&A.classList.add("has-trap")}}}document.querySelectorAll(".tile.trap").forEach(a=>{let n=a.dataset.owner,r=parseInt(a.dataset.row);(n==="player"?d.playerTraps:d.enemyTraps)[r]||a.classList.remove("has-trap")})}p(V,"renderSprites");var Ge=[],Ne=!1;function Kt(){let e=document.getElementById("hand-container");if(!e||!d)return;let t=g.showingKindling?d.playerKindling:d.playerHand,a=g.showingKindling;d.currentTurn!=="player"?e.classList.add("not-turn"):e.classList.remove("not-turn"),e.querySelectorAll(".card-wrapper").forEach(r=>{let i=r.dataset.cardId,o=t.find(c=>c.id===i);if(!o)return;let s=r.querySelector(".battle-card");if(!s)return;let l=!1;if(a)l=!d.playerKindlingPlayedThisTurn&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.type==="trap")l=d.getValidTrapSlots("player").length>0&&d.playerPyre>=o.cost&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.type==="aura")l=d.getValidAuraTargets("player").length>0&&d.playerPyre>=o.cost&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.type==="pyre")l=d.canPlayPyreCard("player")&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.evolvesFrom){let c=d.getValidEvolutionTargets(o,"player").length>0,m=d.playerPyre>=o.cost;l=(c||m)&&(d.phase==="conjure1"||d.phase==="conjure2")}else l=d.playerPyre>=o.cost&&(d.phase==="conjure1"||d.phase==="conjure2");s.classList.toggle("unplayable",!l),s.classList.toggle("selected",g.selectedCard?.id===o.id)}),ve()}p(Kt,"updateHandCardStates");function jt(){let e=document.getElementById("hand-container");if(!d||w)return;d.currentTurn!=="player"?e.classList.add("not-turn"):e.classList.remove("not-turn");let t=g.showingKindling?d.playerKindling:d.playerHand,a=g.showingKindling,n=t.map(o=>o.id);if(n.join(",")===Ge.join(",")&&a===Ne&&e.children.length>0){Kt();return}Ge=n,Ne=a,e.innerHTML="",t.forEach(o=>{let s=document.createElement("div");s.className="card-wrapper",s.dataset.cardId=o.id;let l=document.createElement("div"),c=o.rarity||"common";l.className="game-card battle-card",o.type==="cryptid"?l.classList.add("cryptid-card"):l.classList.add("spell-card"),a&&l.classList.add("kindling-card"),o.type==="trap"&&l.classList.add("trap-card"),o.type==="aura"&&l.classList.add("aura-card"),o.type==="pyre"&&l.classList.add("pyre-card"),o.type==="burst"&&l.classList.add("burst-card"),o.element&&l.classList.add(`element-${o.element}`),o.mythical&&l.classList.add("mythical"),l.classList.add(c);let m=!1;if(a)m=!d.playerKindlingPlayedThisTurn&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.type==="trap")m=d.getValidTrapSlots("player").length>0&&d.playerPyre>=o.cost&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.type==="aura")m=d.getValidAuraTargets("player").length>0&&d.playerPyre>=o.cost&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.type==="pyre")m=d.canPlayPyreCard("player")&&(d.phase==="conjure1"||d.phase==="conjure2");else if(o.evolvesFrom){let T=d.getValidEvolutionTargets(o,"player").length>0,I=d.playerPyre>=o.cost;m=(T||I)&&(d.phase==="conjure1"||d.phase==="conjure2"),T&&l.classList.add("evolution-card")}else m=d.playerPyre>=o.cost&&(d.phase==="conjure1"||d.phase==="conjure2");m||l.classList.add("unplayable"),g.selectedCard?.id===o.id&&l.classList.add("selected");let f;o.type==="cryptid"?f=a?"Kindling":"Cryptid":f={trap:"Trap",aura:"Aura",pyre:"Pyre",burst:"Burst"}[o.type]||"Spell";let h;o.type==="cryptid"?h=`<span class="gc-stat atk">${o.atk}</span><span class="gc-stat hp">${o.hp}</span>`:h=`<span class="gc-stat-type">${{trap:"Trap",aura:"Aura",pyre:"Pyre",burst:"Burst"}[o.type]||"Spell"}</span>`;let u=`<span class="gc-rarity ${c}"></span>`,b=o.combatAbility?o.combatAbility.split(":")[0].trim():"",x=o.supportAbility?o.supportAbility.split(":")[0].trim():"",A=o.type==="cryptid"?`
            <div class="gc-abilities">
                <span class="gc-ability-box left">${b}</span>
                <span class="gc-ability-box right">${x}</span>
            </div>
        `:"";l.innerHTML=`
            <span class="gc-cost">${o.cost}</span>
            <div class="gc-header"><span class="gc-name">${o.name}</span></div>
            <div class="gc-art">${se(o.sprite,!1,o.spriteScale)}</div>
            <div class="gc-stats">${h}</div>
            <div class="gc-card-type">${f}</div>
            ${A}
            ${u}
        `,Qe(s,l,o,m),s.appendChild(l),e.appendChild(s)}),requestAnimationFrame(()=>{e.scrollWidth<=e.clientWidth?e.classList.add("centered"):e.classList.remove("centered"),xe(),_e(),Z(),ye()}),ve()}p(jt,"renderHand");function Wt(){let e=document.getElementById("hand-container");if(!d)return;e.innerHTML="",e.classList.remove("centered"),d.currentTurn!=="player"?e.classList.add("not-turn"):e.classList.remove("not-turn");let t=g.showingKindling?d.playerKindling:d.playerHand,a=g.showingKindling,n=0;t.forEach(r=>{let i=document.createElement("div");i.className="card-wrapper",i.dataset.cardId=r.id;let o=r.rarity||"common",s=document.createElement("div");s.className="game-card battle-card card-entering",s.style.animationDelay=`${n*.05}s`,n++,r.type==="cryptid"?s.classList.add("cryptid-card"):s.classList.add("spell-card"),a&&s.classList.add("kindling-card"),r.type==="trap"&&s.classList.add("trap-card"),r.type==="aura"&&s.classList.add("aura-card"),r.type==="pyre"&&s.classList.add("pyre-card"),r.type==="burst"&&s.classList.add("burst-card"),r.element&&s.classList.add(`element-${r.element}`),r.mythical&&s.classList.add("mythical"),s.classList.add(o);let l=!1;if(a)l=!d.playerKindlingPlayedThisTurn&&(d.phase==="conjure1"||d.phase==="conjure2");else if(r.type==="trap")l=d.getValidTrapSlots("player").length>0&&d.playerPyre>=r.cost&&(d.phase==="conjure1"||d.phase==="conjure2");else if(r.type==="aura")l=d.getValidAuraTargets("player").length>0&&d.playerPyre>=r.cost&&(d.phase==="conjure1"||d.phase==="conjure2");else if(r.type==="pyre")l=d.canPlayPyreCard("player")&&(d.phase==="conjure1"||d.phase==="conjure2");else if(r.evolvesFrom){let x=d.getValidEvolutionTargets(r,"player").length>0,A=d.playerPyre>=r.cost;l=(x||A)&&(d.phase==="conjure1"||d.phase==="conjure2"),x&&s.classList.add("evolution-card")}else l=d.playerPyre>=r.cost&&(d.phase==="conjure1"||d.phase==="conjure2");l||s.classList.add("unplayable"),g.selectedCard?.id===r.id&&s.classList.add("selected");let c;r.type==="cryptid"?c=a?"Kindling":"Cryptid":c={trap:"Trap",aura:"Aura",pyre:"Pyre",burst:"Burst"}[r.type]||"Spell";let m;r.type==="cryptid"?m=`<span class="gc-stat atk">${r.atk}</span><span class="gc-stat hp">${r.hp}</span>`:m=`<span class="gc-stat-type">${{trap:"Trap",aura:"Aura",pyre:"Pyre",burst:"Burst"}[r.type]||"Spell"}</span>`;let f=`<span class="gc-rarity ${o}"></span>`,h=r.combatAbility?r.combatAbility.split(":")[0].trim():"",u=r.supportAbility?r.supportAbility.split(":")[0].trim():"",b=r.type==="cryptid"?`
            <div class="gc-abilities">
                <span class="gc-ability-box left">${h}</span>
                <span class="gc-ability-box right">${u}</span>
            </div>
        `:"";s.innerHTML=`
            <span class="gc-cost">${r.cost}</span>
            <div class="gc-header"><span class="gc-name">${r.name}</span></div>
            <div class="gc-art">${se(r.sprite,!1,r.spriteScale)}</div>
            <div class="gc-stats">${m}</div>
            <div class="gc-card-type">${c}</div>
            ${b}
            ${f}
        `,Qe(i,s,r,l),i.appendChild(s),e.appendChild(i)}),requestAnimationFrame(()=>{e.scrollWidth<=e.clientWidth?e.classList.add("centered"):e.classList.remove("centered"),xe(),_e(),Z(),ye()}),ve()}p(Wt,"renderHandAnimated");function Qe(e,t,a,n){function r(o,s,l){o.preventDefault(),o.stopPropagation(),document.querySelectorAll(".card-wrapper.inspecting").forEach(c=>c.classList.remove("inspecting")),e.classList.add("inspecting"),Je(a,e,s,l),g.cardTooltipVisible=!0}p(r,"inspectCard");function i(){e.classList.remove("inspecting"),L(),g.cardTooltipVisible=!1}if(p(i,"endInspect"),e.oncontextmenu=o=>{r(o,o.clientX,o.clientY);let s=p(()=>{i(),document.removeEventListener("click",s),document.removeEventListener("contextmenu",s)},"endHandler");setTimeout(()=>{document.addEventListener("click",s),document.addEventListener("contextmenu",s)},100)},n){let o=null,s=!1,l=!1,c=!1,m=!1,f=0;e.onclick=h=>{if(h.stopPropagation(),m||e.classList.contains("inspecting")){m=!1,i();return}g.cardTooltipVisible&&(L(),g.cardTooltipVisible=!1),je(a)},e.onmousedown=h=>{h.button===0&&Ke(h,a,t)},e.ontouchstart=h=>{let u=h.touches[0];o={x:u.clientX,y:u.clientY},f=Date.now(),s=!1,l=!1,c=!1,m=!1,g.cardTooltipTimer&&clearTimeout(g.cardTooltipTimer),g.cardTooltipTimer=setTimeout(()=>{!s&&!c&&!l&&(m=!0,r(h,u.clientX,u.clientY),navigator.vibrate&&navigator.vibrate(30))},400)},e.ontouchmove=h=>{if(o&&h.touches[0]){let u=h.touches[0],b=u.clientX-o.x,x=u.clientY-o.y,A=Math.abs(b),T=Math.abs(x);(A>8||T>8)&&(s=!0,g.cardTooltipTimer&&(clearTimeout(g.cardTooltipTimer),g.cardTooltipTimer=null),g.cardTooltipVisible&&!e.classList.contains("inspecting")&&(L(),g.cardTooltipVisible=!1),!l&&!c&&(A>T*1.5?c=!0:T>A*1.5&&x<-15&&(h.preventDefault(),l=!0,Ke(u,a,t))),l&&h.preventDefault())}},e.ontouchend=h=>{g.cardTooltipTimer&&(clearTimeout(g.cardTooltipTimer),g.cardTooltipTimer=null);let u=Date.now()-f;if(m){setTimeout(i,2500),o=null,l=!1,c=!1;return}!s&&o&&!c&&!l&&u<350&&(L(),g.cardTooltipVisible=!1,je(a)),o=null,l=!1,c=!1}}else e.ontouchstart=o=>{let s=o.touches[0];g.cardTooltipTimer=setTimeout(()=>{r(o,s.clientX,s.clientY),navigator.vibrate&&navigator.vibrate(30)},200)},e.ontouchend=()=>{g.cardTooltipTimer&&(clearTimeout(g.cardTooltipTimer),g.cardTooltipTimer=null),setTimeout(i,3e3)};e.onmouseenter=o=>ea(a,o),e.onmouseleave=()=>{e.classList.contains("inspecting")||L()}}p(Qe,"setupCardInteractions");function Je(e,t,a,n){let r=document.getElementById("tooltip");if(!r)return;if(document.getElementById("tooltip-name").textContent=e.name,e.type==="cryptid"){let x=e.element?e.element.charAt(0).toUpperCase()+e.element.slice(1):"",A=x?` | ${be(e.element)} ${x}`:"";document.getElementById("tooltip-desc").textContent=`Cost: ${e.cost} | ATK: ${e.atk} | HP: ${e.hp}${A}`,document.getElementById("tooltip-combat").textContent=`\u2694 ${e.combatAbility||"None"}`,document.getElementById("tooltip-support").textContent=`\u2727 ${e.supportAbility||"None"}`;let T=document.getElementById("tooltip-other");T&&(T.style.display=e.otherAbility?"block":"none"),T&&e.otherAbility&&(T.textContent=`\u25C8 ${e.otherAbility}`),document.getElementById("tooltip-evolution").textContent=e.evolvesInto?`\u25C8 Transforms into: ${_(e.evolvesInto)}`:e.evolvesFrom?`\u25C8 Transforms from: ${_(e.evolvesFrom)}`:""}else{document.getElementById("tooltip-desc").textContent=`Cost: ${e.cost} | ${e.type?e.type.charAt(0).toUpperCase()+e.type.slice(1):"Spell"}`,document.getElementById("tooltip-combat").textContent=e.description||e.effect||"",document.getElementById("tooltip-support").textContent="",document.getElementById("tooltip-evolution").textContent="";let x=document.getElementById("tooltip-other");x&&(x.style.display="none")}let i=t.getBoundingClientRect(),o=window.innerWidth,s=window.innerHeight,l=25,c=10,m=180,f=150,h,u;i.left+i.width/2>o/2?h=i.left-m-l:h=i.right+l,u=i.top+i.height/2-f/2,h<c&&(h=c),h+m>o-c&&(h=o-m-c),u<c&&(u=c),u+f>s-c&&(u=s-f-c),r.style.left=h+"px",r.style.top=u+"px",r.classList.add("show")}p(Je,"showCardTooltipSmart");function Ze(){if(!d)return;let e=g.showingKindling?d.playerKindling:d.playerHand,t=d.playerDeck?d.playerDeck.length:0,a=d.playerDiscard?d.playerDiscard.length:0,n=document.getElementById("hand-card-count");if(n){let o=g.showingKindling?"Kindling":"Cards";n.textContent=`${e.length} ${o}`}let r=document.getElementById("deck-count");r&&(r.textContent=t);let i=document.getElementById("discard-count");i&&(i.textContent=a)}p(Ze,"updateHandIndicators");function ve(){let e=document.getElementById("kindling-toggle-btn");if(!e||!d)return;let t=d.playerKindling.length;g.showingKindling?e.classList.add("active"):e.classList.remove("active"),e.disabled=t===0&&!g.showingKindling,Ze()}p(ve,"updateKindlingButton");var oe=null;function Ke(e,t,a){if(w||t.isKindling&&d.playerKindlingPlayedThisTurn||t.type==="pyre"&&!d.canPlayPyreCard("player")||t.type==="aura"&&(t.cost>d.playerPyre||d.getValidAuraTargets("player").length===0))return;if(t.evolvesFrom){let o=d.getValidEvolutionTargets(t,"player").length>0,s=d.playerPyre>=t.cost;if(!o&&!s)return}else if(!t.isKindling&&t.cost>d.playerPyre&&t.type!=="pyre")return;g.draggedCard=t,g.selectedCard=null,g.attackingCryptid=null,g.targetingBurst=null,g.targetingEvolution=null,g.targetingAura=null,oe=a;let n=document.createElement("div");n.id="drag-ghost",n.className="game-card",t.type==="cryptid"?n.classList.add("cryptid-card"):n.classList.add("spell-card"),t.isKindling&&n.classList.add("kindling-card"),t.type==="trap"&&n.classList.add("trap-card"),t.type==="aura"&&n.classList.add("aura-card"),t.type==="pyre"&&n.classList.add("pyre-card"),t.type==="burst"&&n.classList.add("burst-card"),t.element&&n.classList.add(`element-${t.element}`),t.mythical&&n.classList.add("mythical"),t.rarity&&n.classList.add(t.rarity),n.innerHTML=a.innerHTML;let r=a.offsetWidth,i=a.offsetHeight;n.style.setProperty("--gc-width",r+"px"),n.style.setProperty("--gc-height",i+"px"),n.style.width=r+"px",n.style.height=i+"px",document.body.appendChild(n),g.dragGhost=n,n.style.left=e.clientX-n.offsetWidth/2+"px",n.style.top=e.clientY-n.offsetHeight/2+"px",a.style.opacity="0.3",document.addEventListener("mousemove",ke),document.addEventListener("touchmove",et,{passive:!1}),document.addEventListener("mouseup",ce),document.addEventListener("touchend",ce),we()}p(Ke,"startDrag");function ke(e){if(g.dragGhost){if(g.dragGhost.style.left=e.clientX-g.dragGhost.offsetWidth/2+"px",g.dragGhost.style.top=e.clientY-g.dragGhost.offsetHeight/2+"px",g.draggedCard?.type==="pyre"){let t=document.getElementById("battlefield-area"),a=t.getBoundingClientRect();t.classList.toggle("pyre-drop-zone",e.clientX>=a.left&&e.clientX<=a.right&&e.clientY>=a.top&&e.clientY<=a.bottom)}document.querySelectorAll(".tile").forEach(t=>{t.classList.remove("drag-over");let a=t.getBoundingClientRect();e.clientX>=a.left&&e.clientX<=a.right&&e.clientY>=a.top&&e.clientY<=a.bottom&&(t.classList.contains("valid-target")||t.classList.contains("instant-target")||t.classList.contains("evolution-target")||t.classList.contains("trap-target")||t.classList.contains("aura-target"))&&t.classList.add("drag-over")})}}p(ke,"moveDrag");function et(e){e.preventDefault(),e.touches[0]&&ke({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY})}p(et,"handleTouchMove");function ce(e){if(document.removeEventListener("mousemove",ke),document.removeEventListener("touchmove",et),document.removeEventListener("mouseup",ce),document.removeEventListener("touchend",ce),!g.dragGhost)return;let t=e.clientX||e.changedTouches?.[0]?.clientX||0,a=e.clientY||e.changedTouches?.[0]?.clientY||0,n=!1;try{if(!w&&g.draggedCard?.type==="pyre"){let i=document.getElementById("battlefield-area").getBoundingClientRect();t>=i.left&&t<=i.right&&a>=i.top&&a<=i.bottom&&d.canPlayPyreCard("player")&&(Qt(g.draggedCard,t,a),n=!0)}!w&&!n&&document.querySelectorAll(".tile").forEach(r=>{if(n)return;let i=r.getBoundingClientRect();if(t>=i.left&&t<=i.right&&a>=i.top&&a<=i.bottom){let o=r.dataset.owner,s=r.dataset.col,l=parseInt(r.dataset.row);if(s==="trap"&&g.draggedCard?.type==="trap"&&r.classList.contains("trap-target")){_t(g.draggedCard,l),n=!0;return}let c=parseInt(s);if(isNaN(c))return;let m=g.draggedCard.isKindling||d.playerPyre>=g.draggedCard.cost;r.classList.contains("valid-target")&&g.draggedCard.type==="cryptid"&&m?(tt(c,l),n=!0):r.classList.contains("evolution-target")&&g.draggedCard.evolvesFrom?(at(o,c,l),n=!0):g.draggedCard.type==="burst"?d.getValidBurstTargets(g.draggedCard,"player").some(h=>h.owner===o&&h.col===c&&h.row===l)&&(Yt(g.draggedCard,o,c,l),n=!0):g.draggedCard.type==="aura"&&o==="player"&&d.playerField[c]?.[l]&&d.getValidAuraTargets("player").some(h=>h.col===c&&h.row===l)&&(Xt(g.draggedCard,c,l),n=!0)}})}catch(r){console.error("[endDrag] Error during drop handling:",r)}finally{g.dragGhost&&(g.dragGhost.remove(),g.dragGhost=null),g.draggedCard=null,oe&&!n&&(oe.style.opacity=""),oe=null,document.querySelectorAll(".tile").forEach(r=>r.classList.remove("drag-over")),document.getElementById("battlefield-area")?.classList.remove("pyre-drop-zone"),n||k()}}p(ce,"endDrag");function je(e){w||(L(),document.getElementById("cancel-target").classList.remove("show"),g.selectedCard?.id===e.id?(g.selectedCard=null,g.targetingBurst=null,g.targetingEvolution=null,g.targetingTrap=null,g.targetingAura=null):(g.selectedCard=e,g.attackingCryptid=null,g.targetingBurst=e.type==="burst"?e:null,g.targetingEvolution=e.evolvesFrom?e:null,g.targetingTrap=e.type==="trap"?e:null,g.targetingAura=e.type==="aura"?e:null,(g.targetingBurst||g.targetingEvolution||g.targetingTrap||g.targetingAura)&&document.getElementById("cancel-target").classList.add("show")),k(),B())}p(je,"selectCard");function tt(e,t){if(w)return;let a=g.selectedCard||g.draggedCard;if(!(!a||a.type!=="cryptid"))if(a.isKindling){if(d.playerKindlingPlayedThisTurn)return;d.summonKindling("player",e,t,a)&&(w=!0,d.playerKindlingPlayedThisTurn=!0,q(a.id,"playing"),g.selectedCard=null,setTimeout(()=>{let r=d.playerKindling.findIndex(o=>o.id===a.id);r>-1&&d.playerKindling.splice(r,1);let i=document.getElementById("hand-container");i.classList.add("transitioning"),setTimeout(()=>{g.showingKindling=!1,i.classList.remove("transitioning"),w=!1,k(),B()},200)},400))}else{if(d.playerPyre<a.cost)return;if(d.summonCryptid("player",e,t,a)){w=!0;let r=d.playerPyre;d.playerPyre-=a.cost,y.emit("onPyreSpent",{owner:"player",amount:a.cost,oldValue:r,newValue:d.playerPyre,source:"summon",card:a}),q(a.id,"playing"),g.selectedCard=null,setTimeout(()=>{let i=d.playerHand.findIndex(o=>o.id===a.id);i>-1&&d.playerHand.splice(i,1),w=!1,k(),B()},400)}}}p(tt,"summonToSlot");function at(e,t,a){let n=g.selectedCard||g.draggedCard||g.targetingEvolution;if(!n?.evolvesFrom||w)return;w=!0;let r=d.getFieldCryptid(e,t,a);if(!r||r.key!==n.evolvesFrom){w=!1;return}q(n.id,"playing"),d.evolveCryptid(r,n),g.selectedCard=null,g.targetingEvolution=null,document.getElementById("cancel-target").classList.remove("show"),P(`${r.name} transforms into ${n.name}!`,E.messageDisplay),setTimeout(()=>{let i=d.playerHand.findIndex(o=>o.id===n.id);i>-1&&d.playerHand.splice(i,1),k()},300),setTimeout(()=>{let i=document.querySelector(`.cryptid-sprite[data-owner="${e}"][data-col="${t}"][data-row="${a}"]`);i&&i.classList.add("evolving")},400),setTimeout(()=>{d.isMultiplayer&&e==="player"&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onEvolve(n,t,a),w=!1,k(),B()},E.evolveAnim)}p(at,"executeEvolution");function We(e,t,a){if(!g.targetingBurst||w)return;w=!0;let n=g.targetingBurst,r=d.getFieldCryptid(e,t,a),i=n.targetType==="tile"||n.targetType==="enemyTile"||n.targetType==="allyTile";function o(){d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onBurst(n,e,t,a)}if(p(o,"sendMultiplayerHook"),r||i){q(n.id,"playing"),P(`\u2727 ${n.name} \u2727`,E.messageDisplay);let s=r?document.querySelector(`.cryptid-sprite[data-owner="${e}"][data-col="${t}"][data-row="${a}"]`):null;s&&(s.classList.add("spell-target"),setTimeout(()=>s.classList.remove("spell-target"),E.spellEffect));let l=document.querySelector(`.tile[data-owner="${e}"][data-col="${t}"][data-row="${a}"]`);l&&(l.classList.add("spell-target-tile"),setTimeout(()=>l.classList.remove("spell-target-tile"),E.spellEffect)),setTimeout(()=>{let c=d.playerHand.findIndex(m=>m.id===n.id);c>-1&&(d.playerHand.splice(c,1),d.playerDiscardPile.push(n)),g.selectedCard=null,g.targetingBurst=null,document.getElementById("cancel-target").classList.remove("show")},300),setTimeout(()=>{let c=d.playerPyre;d.playerPyre-=n.cost,y.emit("onPyreSpent",{owner:"player",amount:n.cost,oldValue:c,newValue:d.playerPyre,source:"spell",card:n}),r&&y.emit("onTargeted",{target:r,targetOwner:e,source:n,sourceType:"spell"}),n.effect(d,"player",r),y.emit("onSpellCast",{card:n,caster:"player",target:r,targetOwner:e}),d.matchStats.spellsCast++,setTimeout(()=>{r?d.getEffectiveHp(r)<=0?rt(e,t,a,r,"player",o):j(()=>{o(),w=!1,k(),B()}):j(()=>{o(),w=!1,k(),B()})},300)},E.spellEffect)}else w=!1}p(We,"executeBurst");function Yt(e,t,a,n){if(w)return;w=!0;let r=d.getFieldCryptid(t,a,n),i=e.targetType==="tile"||e.targetType==="enemyTile"||e.targetType==="allyTile";function o(){d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onBurst(e,t,a,n)}if(p(o,"sendMultiplayerHook"),r||i){q(e.id,"playing"),P(`\u2727 ${e.name} \u2727`,E.messageDisplay);let s=r?document.querySelector(`.cryptid-sprite[data-owner="${t}"][data-col="${a}"][data-row="${n}"]`):null;s&&(s.classList.add("spell-target"),setTimeout(()=>s.classList.remove("spell-target"),E.spellEffect)),setTimeout(()=>{let l=d.playerHand.findIndex(c=>c.id===e.id);l>-1&&(d.playerHand.splice(l,1),d.playerDiscardPile.push(e))},300),setTimeout(()=>{let l=d.playerPyre;d.playerPyre-=e.cost,y.emit("onPyreSpent",{owner:"player",amount:e.cost,oldValue:l,newValue:d.playerPyre,source:"burst",card:e}),e.effect(d,"player",r),d.matchStats.spellsCast++;function c(m){function f(){window.processingAbilityAnimations||window.abilityAnimationQueue&&window.abilityAnimationQueue.length>0?setTimeout(f,100):m()}p(f,"check"),typeof ge=="function"&&ge(),f()}p(c,"waitForAbilityAnimations"),c(()=>{setTimeout(()=>{r?d.getEffectiveHp(r)<=0?rt(t,a,n,r,"player",o):j(()=>{o(),w=!1,k(),B()}):j(()=>{o(),w=!1,k(),B()})},300)})},E.spellEffect)}else w=!1}p(Yt,"executeBurstDirect");function Vt(e){let t=g.targetingTrap;if(!t||w||d.playerPyre<t.cost)return;if(d.setTrap("player",e,t)){w=!0,window.newlySpawnedTrap={owner:"player",row:e},q(t.id,"playing");let n=d.playerPyre;d.playerPyre-=t.cost,y.emit("onPyreSpent",{owner:"player",amount:t.cost,oldValue:n,newValue:d.playerPyre,source:"trap",card:t}),g.targetingTrap=null,g.selectedCard=null,document.getElementById("cancel-target").classList.remove("show"),P("Trap set!",800),setTimeout(()=>{let r=d.playerHand.findIndex(i=>i.id===t.id);r>-1&&d.playerHand.splice(r,1),d.playerDiscardPile.push(t),d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onTrap(t,e),w=!1,k(),B(),setTimeout(()=>{window.newlySpawnedTrap=null},500)},400)}}p(Vt,"executeTrapPlacement");function _t(e,t){if(!e||w||d.playerPyre<e.cost)return;if(d.setTrap("player",t,e)){w=!0,window.newlySpawnedTrap={owner:"player",row:t},q(e.id,"playing");let n=d.playerPyre;d.playerPyre-=e.cost,y.emit("onPyreSpent",{owner:"player",amount:e.cost,oldValue:n,newValue:d.playerPyre,source:"trap",card:e}),P("Trap set!",800),setTimeout(()=>{let r=d.playerHand.findIndex(i=>i.id===e.id);r>-1&&d.playerHand.splice(r,1),d.playerDiscardPile.push(e),d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onTrap(e,t),w=!1,k(),B(),setTimeout(()=>{window.newlySpawnedTrap=null},500)},400)}}p(_t,"executeTrapPlacementDirect");function Ut(e,t){let a=g.targetingAura;if(!a||w||d.playerPyre<a.cost)return;let n=d.getFieldCryptid("player",e,t);if(!n)return;w=!0,q(a.id,"playing"),P(`\u2728 ${a.name} \u2728`,E.messageDisplay);let r=document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${e}"][data-row="${t}"]`);r&&(r.classList.add("aura-target"),setTimeout(()=>r.classList.remove("aura-target"),E.spellEffect)),setTimeout(()=>{let i=d.playerHand.findIndex(o=>o.id===a.id);i>-1&&(d.playerHand.splice(i,1),d.playerDiscardPile.push(a)),g.targetingAura=null,g.selectedCard=null,document.getElementById("cancel-target").classList.remove("show")},300),setTimeout(()=>{let i=d.playerPyre;d.playerPyre-=a.cost,y.emit("onPyreSpent",{owner:"player",amount:a.cost,oldValue:i,newValue:d.playerPyre,source:"aura",card:a}),d.applyAura(n,a),setTimeout(()=>{d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onAura(a,e,t),w=!1,k(),B()},300)},E.spellEffect)}p(Ut,"executeAura");function Xt(e,t,a){if(!e||w||d.playerPyre<e.cost)return;let n=d.getFieldCryptid("player",t,a);if(!n)return;w=!0,q(e.id,"playing"),P(`\u2728 ${e.name} \u2728`,E.messageDisplay);let r=document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${t}"][data-row="${a}"]`);r&&(r.classList.add("aura-target"),setTimeout(()=>r.classList.remove("aura-target"),E.spellEffect)),setTimeout(()=>{let i=d.playerHand.findIndex(o=>o.id===e.id);i>-1&&(d.playerHand.splice(i,1),d.playerDiscardPile.push(e))},300),setTimeout(()=>{let i=d.playerPyre;d.playerPyre-=e.cost,y.emit("onPyreSpent",{owner:"player",amount:e.cost,oldValue:i,newValue:d.playerPyre,source:"aura",card:e}),d.applyAura(n,e),setTimeout(()=>{d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onAura(e,t,a),w=!1,k(),B()},300)},E.spellEffect)}p(Xt,"executeAuraDirect");function nt(e){if(!d.canPlayPyreCard("player")||w)return;w=!0;let t=document.querySelector(`.card-wrapper[data-card-id="${e.id}"]`),a=window.innerWidth/2,n=window.innerHeight/2;if(t){let s=t.getBoundingClientRect();a=s.left+s.width/2,n=s.top}q(e.id,"playing");let r=document.createElement("div");r.className="pyre-burst-effect",r.innerHTML=`<span class="pyre-icon">${e.sprite}</span><span class="pyre-glow">\u{1F525}</span>`,r.style.left=a+"px",r.style.top=n+"px",document.body.appendChild(r),requestAnimationFrame(()=>r.classList.add("active"));let i=d.playPyreCard("player",e);d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onPyre(e),g.selectedCard=null;let o=d.playerHand.findIndex(s=>s.id===e.id);if(o>-1&&(d.playerHand.splice(o,1),d.playerDiscardPile.push(e)),i){let s=i.pyreGained||1,l=`${e.name}: +${s} Pyre`;i.vampireCount!==void 0&&i.vampireCount>0&&(l+=` (${i.vampireCount} vampires)`),i.deathCount!==void 0&&i.deathCount>0&&(l+=` (${i.deathCount} deaths)`),P(l,1200)}setTimeout(()=>{r.remove(),w=!1,k(),B()},600)}p(nt,"executePyreCard");function Qt(e,t,a){if(!d.canPlayPyreCard("player"))return;w=!0,g.selectedCard=null,g.draggedCard=null,g.dragGhost&&(g.dragGhost.remove(),g.dragGhost=null),q(e.id,"playing");let n=document.createElement("div");n.className="pyre-burst-effect",n.innerHTML=`<span class="pyre-icon">${e.sprite}</span><span class="pyre-glow">\u{1F525}</span>`,n.style.left=t+"px",n.style.top=a+"px",document.body.appendChild(n),requestAnimationFrame(()=>n.classList.add("active"));let r=d.playPyreCard("player",e);d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onPyre(e);let i=d.playerHand.findIndex(o=>o.id===e.id);if(i>-1&&(d.playerHand.splice(i,1),d.playerDiscardPile.push(e)),r){let o=r.pyreGained||1,s=`${e.name}: +${o} Pyre`;r.vampireCount!==void 0&&r.vampireCount>0&&(s+=` (${r.vampireCount} vampires)`),r.deathCount!==void 0&&r.deathCount>0&&(s+=` (${r.deathCount} deaths)`),setTimeout(()=>P(s,1200),200)}setTimeout(()=>{n.remove(),w=!1,k(),B()},800)}p(Qt,"executePyreCardWithAnimation");function rt(e,t,a,n,r,i){let o=document.querySelector(`.cryptid-sprite[data-owner="${e}"][data-col="${t}"][data-row="${a}"]`);o&&o.classList.add(e==="enemy"?"dying-right":"dying-left"),setTimeout(()=>d.killCryptid(n,r),100),setTimeout(()=>{k(),Y(()=>{de(()=>{i?.(),w=!1,k(),B()})})},E.deathAnim)}p(rt,"handleDeathAndPromotion");function de(e){let t=[];for(let n of["player","enemy"]){let r=n==="player"?d.playerField:d.enemyField,i=d.getCombatCol(n);for(let o=0;o<3;o++){let s=r[i][o];s&&s.checkDeathAfterSupportLoss&&(delete s.checkDeathAfterSupportLoss,s.currentHp<=0&&t.push({owner:n,col:i,row:o,cryptid:s}))}}if(t.length===0){e?.();return}function a(n){if(n>=t.length){e?.();return}let{owner:r,col:i,row:o,cryptid:s}=t[n],l=document.querySelector(`.cryptid-sprite[data-owner="${r}"][data-col="${i}"][data-row="${o}"]`);l&&l.classList.add(r==="enemy"?"dying-right":"dying-left"),setTimeout(()=>{d.killCryptid(s),k(),setTimeout(()=>a(n+1),200)},E.deathAnim)}p(a,"processNextDeath"),P("Soul bond severed!",E.messageDisplay),a(0)}p(de,"checkCascadingDeaths");function j(e){let t=[];for(let n of["player","enemy"]){let r=n==="player"?d.playerField:d.enemyField;for(let i=0;i<2;i++)for(let o=0;o<3;o++){let s=r[i][o];s&&d.getEffectiveHp(s)<=0&&t.push({owner:n,col:i,row:o,cryptid:s})}}if(t.length===0){Y(()=>e?.());return}function a(n){if(n>=t.length){Y(()=>e?.());return}let{owner:r,col:i,row:o,cryptid:s}=t[n];if(!d.getFieldCryptid(r,i,o)){a(n+1);return}let l=document.querySelector(`.cryptid-sprite[data-owner="${r}"][data-col="${i}"][data-row="${o}"]`);l&&l.classList.add(r==="enemy"?"dying-right":"dying-left"),setTimeout(()=>{d.killCryptid(s),k(),setTimeout(()=>a(n+1),200)},E.deathAnim)}p(a,"processNextDeath"),a(0)}p(j,"checkAllCreaturesForDeath");function Jt(e){w||(document.getElementById("cancel-target").classList.remove("show"),g.attackingCryptid===e?(g.attackingCryptid=null,L()):(g.attackingCryptid=e,g.selectedCard=null,g.targetingBurst=null,g.targetingEvolution=null,document.getElementById("cancel-target").classList.add("show")),k())}p(Jt,"selectAttacker");function Zt(e,t){if(!g.attackingCryptid||w)return;w=!0;let a=g.attackingCryptid,n="enemy";p(i=>{a.hasInsatiableHunger?(a.currentAtk=(a.currentAtk||a.atk)+1,y.emit("onInsatiableHunger",{attacker:a,newAtk:a.currentAtk}),P(`${a.name}: +1 ATK!`,600),k(),setTimeout(i,500)):i()},"applyPreAttackBuffs")(()=>{if(d.isFieldEmpty(n)&&d.enemyKindling.length>0){let o=d.getCombatCol(n),s=d.popRandomKindling(n);d.summonKindling(n,o,t,s),d.isMultiplayer&&typeof window.Multiplayer<"u"&&window.Multiplayer.sendForcedSummon(s.key,o,t),P("Forced Summoning!",E.messageDisplay),V(),setTimeout(()=>{V(),setTimeout(()=>{let l=document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${a.col}"][data-row="${a.row}"]`);fe(l,"player",()=>{he(a,n,o,t)})},50)},E.summonAnim+100)}else{let o=document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${a.col}"][data-row="${a.row}"]`);fe(o,"player",()=>{he(a,n,e,t)})}})}p(Zt,"executeAttack");function fe(e,t,a){if(!e){a&&a();return}e.classList.add("attack-windup"),setTimeout(()=>{e.classList.remove("attack-windup"),e.classList.add("attack-lunge"),setTimeout(()=>{e.classList.remove("attack-lunge"),e.classList.add("attack-return"),a&&a(),setTimeout(()=>{e.classList.remove("attack-return")},200)},180)},150)}p(fe,"playAttackAnimation");function he(e,t,a,n){let r=d.attack(e,t,a,n),i=document.querySelector(`.cryptid-sprite[data-owner="${t}"][data-col="${a}"][data-row="${n}"]`),o=document.querySelector(`.cryptid-sprite[data-owner="${e.owner}"][data-col="${e.col}"][data-row="${e.row}"]`),s=document.getElementById("battlefield-area"),l=0,c=0;if(i&&s){let u=i.getBoundingClientRect(),b=s.getBoundingClientRect();l=u.left+u.width/2-b.left,c=u.top+u.height/2-b.top}function m(u){function b(){window.processingAbilityAnimations||window.abilityAnimationQueue&&window.abilityAnimationQueue.length>0?setTimeout(b,100):u()}p(b,"check"),b()}p(m,"waitForAbilityAnimations");function f(){d.isMultiplayer&&e.owner==="player"&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onAttack(e,t,a,n)}if(p(f,"sendMultiplayerHook"),r.negated){i&&!r.attackerKilled&&(console.log("[Protection] Negated attack, adding animation to target:",i),i.classList.add("protection-block"),setTimeout(()=>i.classList.remove("protection-block"),E.protectionAnim),window.CombatEffects&&r.target&&(CombatEffects.showDamageNumber(r.target,0,!1,!0),CombatEffects.lightImpact())),r.attackerKilled||P("\u{1F6E1}\uFE0F Attack blocked!",800),r.attackerKilled&&(o&&o.classList.add(e.owner==="player"?"dying-left":"dying-right"),window.CombatEffects&&(CombatEffects.heavyImpact(5),CombatEffects.createImpactParticles(l,c,"#ff4444",12))),g.attackingCryptid=null,document.getElementById("cancel-target").classList.remove("show"),m(()=>{setTimeout(()=>{k(),r.attackerKilled?Y(()=>{de(()=>{f(),w=!1,k(),B()})}):(f(),w=!1,k(),B())},r.attackerKilled?E.deathAnim:E.protectionAnim)});return}if(window.CombatEffects){let u=r.damage||0,b=u>=5;CombatEffects.heavyImpact(u),CombatEffects.createImpactFlash(l,c,80+u*10),CombatEffects.createSparks(l,c,10+u*2),CombatEffects.createImpactParticles(l,c,r.killed?"#ff2222":"#ff6666",8+u),r.target&&u>0&&CombatEffects.showDamageNumber(r.target,u,b)}i&&(r.killed?i.classList.add(t==="enemy"?"dying-right":"dying-left"):r.protectionBlocked?(console.log("[Protection] Block detected, adding animation to sprite:",i),i.classList.add("protection-block"),P("\u{1F6E1}\uFE0F Protected!",800),setTimeout(()=>i.classList.remove("protection-block"),E.protectionAnim),window.CombatEffects&&r.target&&CombatEffects.showDamageNumber(r.target,0,!1,!0)):(i.classList.add("hit-recoil"),setTimeout(()=>i.classList.remove("hit-recoil"),250))),g.attackingCryptid=null,document.getElementById("cancel-target").classList.remove("show");let h=r.killed?E.deathAnim+100:r.protectionBlocked?E.protectionAnim:E.postAttackDelay;m(()=>{setTimeout(()=>{k(),Y(()=>{de(()=>{f(),w=!1,k(),B()})})},h)})}p(he,"performAttackOnTarget");function it(e,t){let a=d.getSupportCol(e),n=d.getCombatCol(e),r=`${e}-${a}-${t}`,i=`${e}-${n}-${t}`,o=K[r],s=K[i];if(!o||!s){V();return}let l=Math.abs(s.x-o.x);V();let c=document.querySelector(`.cryptid-sprite[data-owner="${e}"][data-col="${n}"][data-row="${t}"]`);c&&(c.style.setProperty("--promote-distance",`${l}px`),c.style.left=o.x+"px",c.classList.add(e==="player"?"promoting-right":"promoting-left"),setTimeout(()=>{c.classList.remove("promoting-right","promoting-left"),c.style.left=s.x+"px",V()},E.promoteAnim))}p(it,"animateSupportPromotion");function Y(e){if(!window.pendingPromotions||window.pendingPromotions.length===0){e&&e();return}let t=[...window.pendingPromotions];window.pendingPromotions=[];let a=0;function n(){if(a>=t.length){e&&e();return}let{owner:r,row:i}=t[a];it(r,i),a++,setTimeout(n,E.promoteAnim+50)}p(n,"processNext"),n()}p(Y,"processPendingPromotions");function B(){if(!d)return;let e=d.currentTurn==="player",t=d.phase==="conjure1"||d.phase==="conjure2";document.getElementById("pyre-burn-btn").disabled=!e||!t||d.playerPyreBurnUsed||d.playerDeaths===0,document.getElementById("end-conjure1-btn").disabled=!e||d.phase!=="conjure1",document.getElementById("end-combat-btn").disabled=!e||d.phase!=="combat",document.getElementById("end-turn-btn").disabled=!e,typeof Ye=="function"&&Ye()}p(B,"updateButtons");document.getElementById("cancel-target").onclick=()=>{w||(L(),g.selectedCard=null,g.attackingCryptid=null,g.targetingBurst=null,g.targetingEvolution=null,g.targetingTrap=null,document.getElementById("cancel-target").classList.remove("show"),k())};document.getElementById("pyre-burn-btn").onclick=()=>{if(w)return;let e=d.playerDeaths;if(d.playerPyreBurnUsed||e===0)return;w=!0,L();let t=document.getElementById("pyre-burn-overlay"),a=document.getElementById("pyre-burn-text"),n=document.getElementById("game-container");a.textContent=`\u{1F702} PYRE BURN +${e} \u{1F702}`,t.classList.add("active"),a.classList.add("active"),n.classList.add("shaking"),setTimeout(()=>{d.pyreBurn("player"),d.isMultiplayer&&typeof window.multiplayerHook<"u"&&window.multiplayerHook.onPyreBurn(e),k(),B()},300),setTimeout(()=>{t.classList.remove("active"),a.classList.remove("active"),n.classList.remove("shaking"),w=!1},E.pyreBurnEffect)};document.getElementById("end-conjure1-btn").onclick=()=>{w||(L(),j(()=>{let e=d.phase;d.phase="combat",y.emit("onPhaseChange",{owner:d.currentTurn,oldPhase:e,newPhase:"combat"}),g.selectedCard=null,g.targetingBurst=null,g.targetingEvolution=null,document.getElementById("cancel-target").classList.remove("show"),k(),B()}))};document.getElementById("end-combat-btn").onclick=()=>{w||(L(),j(()=>{let e=d.phase;d.phase="conjure2",y.emit("onPhaseChange",{owner:d.currentTurn,oldPhase:e,newPhase:"conjure2"}),g.attackingCryptid=null,document.getElementById("cancel-target").classList.remove("show"),k(),B()}))};document.getElementById("kindling-toggle-btn").onclick=()=>{if(w)return;L(),g.selectedCard=null,g.targetingBurst=null,g.targetingEvolution=null,document.getElementById("cancel-target").classList.remove("show");let e=document.getElementById("hand-container");e.classList.add("transitioning"),setTimeout(()=>{g.showingKindling=!g.showingKindling,e.classList.remove("transitioning"),Wt(),B(),requestAnimationFrame(xe)},300),we()};document.getElementById("hand-menu-btn").onclick=()=>{let e=document.getElementById("hand-menu-panel"),t=document.getElementById("hand-menu-btn");if(window.TutorialManager?.isActive&&!window.TutorialManager?.freePlayMode){e.classList.contains("open")||(e.classList.add("open"),t.classList.add("menu-open"));return}e.classList.toggle("open"),t.classList.toggle("menu-open")};document.addEventListener("click",e=>{let t=document.getElementById("hand-menu-panel"),a=document.getElementById("hand-menu-btn");window.TutorialManager?.isActive&&!window.TutorialManager?.freePlayMode||t&&a&&!t.contains(e.target)&&!a.contains(e.target)&&(t.classList.remove("open"),a.classList.remove("menu-open"))});document.getElementById("hand-menu-panel")?.addEventListener("click",e=>{window.TutorialManager?.isActive&&!window.TutorialManager?.freePlayMode&&(e.target.closest("button")||e.stopPropagation())});document.getElementById("menu-kindling-btn").onclick=()=>{document.getElementById("kindling-toggle-btn").click(),(!window.TutorialManager?.isActive||window.TutorialManager?.freePlayMode)&&(document.getElementById("hand-menu-panel").classList.remove("open"),document.getElementById("hand-menu-btn").classList.remove("menu-open"))};document.getElementById("menu-burn-btn").onclick=()=>{window.TutorialManager?.isActive&&!window.TutorialManager?.freePlayMode||(document.getElementById("pyre-burn-btn").click(),document.getElementById("hand-menu-panel").classList.remove("open"),document.getElementById("hand-menu-btn").classList.remove("menu-open"))};document.getElementById("menu-end-btn").onclick=()=>{window.TutorialManager?.isActive&&!window.TutorialManager?.freePlayMode||(document.getElementById("end-turn-btn").click(),document.getElementById("hand-menu-panel").classList.remove("open"),document.getElementById("hand-menu-btn").classList.remove("menu-open"))};function Ye(){let e=document.getElementById("menu-kindling-btn"),t=document.getElementById("menu-burn-btn"),a=document.getElementById("menu-end-btn");if(!d)return;let n=d.currentTurn==="player",r=d.phase==="conjure1"||d.phase==="conjure2";e&&(g.showingKindling?e.classList.add("active"):e.classList.remove("active"),e.disabled=d.playerKindling.length===0&&!g.showingKindling),t&&(t.disabled=!n||!r||d.playerPyreBurnUsed||d.playerDeaths===0),a&&(a.disabled=!n)}p(Ye,"updateMenuButtons");document.getElementById("end-turn-btn").onclick=()=>{if(!(d.currentTurn!=="player"||w)){if(d.isMultiplayer&&typeof window.Multiplayer<"u"&&window.Multiplayer.turnTransitionLock){console.log("[System] End turn blocked - turn transition in progress");return}w=!0,L(),g.selectedCard=null,g.attackingCryptid=null,g.targetingBurst=null,g.targetingEvolution=null,g.showingKindling=!1,document.getElementById("cancel-target").classList.remove("show"),j(()=>{ot(()=>{if(d.endTurn(),d.isMultiplayer)typeof window.multiplayerHook<"u"&&window.multiplayerHook.onEndPhase(),typeof window.Multiplayer<"u"&&(window.Multiplayer.turnTransitionLock=!0),w=!1,k(),B(),setTimeout(()=>{typeof window.Multiplayer<"u"&&(window.Multiplayer.turnTransitionLock=!1)},300);else if(d.currentTurn==="enemy"&&!d.gameOver){if(window.TutorialManager?.isActive&&!window.TutorialManager?.freePlayMode){console.log("[Game] Tutorial mode - skipping AI, tutorial will control enemy"),w=!1,k(),B();return}st("enemy",()=>{P("The Warden stirs...",E.messageDisplay),k(),B(),setTimeout(()=>{w=!1,window.runEnemyAI()},E.messageDisplay+200)})}else w=!1,k(),B()})})}};function ot(e){let t=d.currentTurn==="player"?d.playerField:d.enemyField,a=d.getSupportCol(d.currentTurn),n=d.getCombatCol(d.currentTurn),r=[];for(let i=0;i<3;i++){let o=t[a][i];if(o){if(o.radianceActive)for(let s=0;s<2;s++)for(let l=0;l<3;l++){let c=t[s][l];c&&c.currentHp<c.maxHp&&r.push({owner:d.currentTurn,col:s,row:l})}if(o.regenActive){let s=t[n][i];s&&s.currentHp<s.maxHp&&r.push({owner:d.currentTurn,col:n,row:i})}}}r.length>0?(r.forEach(i=>{let o=document.querySelector(`.cryptid-sprite[data-owner="${i.owner}"][data-col="${i.col}"][data-row="${i.row}"]`);o&&(o.classList.add("healing"),setTimeout(()=>o.classList.remove("healing"),600))}),setTimeout(e,700)):e()}p(ot,"animateTurnEndEffects");function st(e,t){d.processBleed(e),d.processCurse(e);let a=d.getPendingStatusEffects(e);if(a.length===0){t();return}d.processToxicTiles(e);let n=0;function r(){if(n>=a.length){j(()=>{k(),t()});return}let i=a[n],o=document.querySelector(`.cryptid-sprite[data-owner="${i.owner}"][data-col="${i.col}"][data-row="${i.row}"]`);if(i.type==="burn")P(`\u{1F525} ${i.name} burns!`,900),o&&(o.classList.add("burn-damage"),setTimeout(()=>o.classList.remove("burn-damage"),700)),setTimeout(()=>{let s=d.processSingleStatusEffect(i);if(s.died)o&&o.classList.add("dying-left"),setTimeout(()=>{k(),Y(()=>{setTimeout(()=>{n++,r()},100)})},E.deathAnim);else if(s.evolved){P("\u2728 Evolved from the flames!",1e3),k();let l=document.querySelector(`.cryptid-sprite[data-owner="${i.owner}"][data-col="${i.col}"][data-row="${i.row}"]`);l&&(l.classList.add("evolving"),setTimeout(()=>l.classList.remove("evolving"),800)),setTimeout(()=>{n++,r()},900)}else k(),setTimeout(()=>{n++,r()},400)},300);else if(i.type==="toxic")P(`\u2620 ${i.name} takes toxic damage!`,900),o&&(o.classList.add("toxic-damage"),setTimeout(()=>o.classList.remove("toxic-damage"),600)),k(),setTimeout(()=>{n++,r()},750);else if(i.type==="calamity"){let s=i.counters-1;s<=0?P(`\u{1F4A5} ${i.name}: CALAMITY!`,1e3):P(`\u26A0 ${i.name}: Calamity (${s} left)`,900),o&&(o.classList.add("calamity-tick"),setTimeout(()=>o.classList.remove("calamity-tick"),800)),setTimeout(()=>{let l=d.processSingleStatusEffect(i);if(l.died)o&&o.classList.add("dying-left"),setTimeout(()=>{k(),Y(()=>{setTimeout(()=>{n++,r()},100)})},E.deathAnim);else if(l.evolved){P("\u2728 Transformed from calamity!",1e3),k();let c=document.querySelector(`.cryptid-sprite[data-owner="${i.owner}"][data-col="${i.col}"][data-row="${i.row}"]`);c&&(c.classList.add("evolving"),setTimeout(()=>c.classList.remove("evolving"),800)),setTimeout(()=>{n++,r()},900)}else k(),setTimeout(()=>{n++,r()},400)},400)}else n++,r()}p(r,"processNextEffect"),r()}p(st,"animateTurnStartEffects");function q(e,t="playing",a){let r=document.getElementById("hand-container").querySelector(`.card-wrapper[data-card-id="${e}"]`);if(!r){console.log("Card wrapper not found for id:",e),a?.();return}r.dataset.animating="true";let i=r.querySelector(".card"),o=r.offsetWidth;r.style.width=o+"px",r.style.minWidth=o+"px",r.style.flexShrink="0",r.style.overflow="visible",r.offsetHeight,i&&(i.style.opacity="1",i.style.transform="none",i.offsetHeight,i.style.transition="opacity 0.2s ease-out, transform 0.25s ease-out",i.style.opacity="0",i.style.transform="scale(1.1) translateY(-30px)",i.style.pointerEvents="none"),setTimeout(()=>{r.style.overflow="hidden",r.style.transition="width 0.25s ease-out, min-width 0.25s ease-out, margin 0.25s ease-out, padding 0.25s ease-out",r.style.width="0px",r.style.minWidth="0px",r.style.marginLeft="0px",r.style.marginRight="0px",r.style.paddingLeft="0px",r.style.paddingRight="0px"},150),setTimeout(()=>{r.parentNode&&r.remove(),a?.()},400)}p(q,"animateCardRemoval");function P(e,t=2e3){let a=document.getElementById("message-overlay");document.getElementById("message-text").textContent=e,a.classList.add("show"),setTimeout(()=>a.classList.remove("show"),t)}p(P,"showMessage");function ea(e,t){let a=t.target.closest(".card-wrapper");if(a){Je(e,a,t.clientX,t.clientY);return}ta(e,t.clientX+15,t.clientY-100)}p(ea,"showCardTooltip");function ta(e,t,a){let n=document.getElementById("tooltip");if(document.getElementById("tooltip-name").textContent=e.name,e.type==="cryptid"){let r=e.element?e.element.charAt(0).toUpperCase()+e.element.slice(1):"",i=r?` | ${be(e.element)} ${r}`:"",o=(e.rarity||"common").charAt(0).toUpperCase()+(e.rarity||"common").slice(1),s=e.mythical?" \u2726":"";document.getElementById("tooltip-desc").textContent=`Cost: ${e.cost} | ATK: ${e.atk} | HP: ${e.hp}${i}`,document.getElementById("tooltip-combat").textContent=`\u2694 ${e.combatAbility||"None"}`,document.getElementById("tooltip-support").textContent=`\u2727 ${e.supportAbility||"None"}`;let l=document.getElementById("tooltip-other");l&&(e.otherAbility?(l.textContent=`\u25C8 ${e.otherAbility}`,l.style.display="block"):l.style.display="none");let c="";e.evolvesInto?c=`\u25C8 Transforms into: ${_(e.evolvesInto)}`:e.evolvesFrom&&(c=`\u25C8 Transforms from: ${_(e.evolvesFrom)}`);let m=`\u{1F480} ${o}${s}`;document.getElementById("tooltip-evolution").textContent=c?`${c} | ${m}`:m}else if(e.type==="trap"){document.getElementById("tooltip-desc").textContent=`Cost: ${e.cost} | Trap`,document.getElementById("tooltip-combat").textContent=`\u26A1 ${e.description||"Triggered automatically"}`,document.getElementById("tooltip-support").textContent=e.triggerDescription||"",document.getElementById("tooltip-evolution").textContent="";let r=document.getElementById("tooltip-other");r&&(r.style.display="none")}else if(e.type==="aura"){document.getElementById("tooltip-desc").textContent=`Cost: ${e.cost} | Aura (Enchant Ally)`,document.getElementById("tooltip-combat").textContent=`\u2728 ${e.description}`;let r="";e.atkBonus&&(r+=`+${e.atkBonus} ATK `),e.hpBonus&&(r+=`+${e.hpBonus} HP`),document.getElementById("tooltip-support").textContent=r.trim()||"",document.getElementById("tooltip-evolution").textContent="";let i=document.getElementById("tooltip-other");i&&(i.style.display="none")}else if(e.type==="pyre"){document.getElementById("tooltip-desc").textContent="Free | Pyre Card (1/turn)",document.getElementById("tooltip-combat").textContent=`\u{1F525} ${e.description}`,document.getElementById("tooltip-support").textContent="",document.getElementById("tooltip-evolution").textContent="";let r=document.getElementById("tooltip-other");r&&(r.style.display="none")}else{document.getElementById("tooltip-desc").textContent=`Cost: ${e.cost}`,document.getElementById("tooltip-combat").textContent=e.description,document.getElementById("tooltip-support").textContent="",document.getElementById("tooltip-evolution").textContent="";let r=document.getElementById("tooltip-other");r&&(r.style.display="none")}n.style.left=Math.min(t,window.innerWidth-190)+"px",n.style.top=Math.max(a,10)+"px",n.classList.add("show")}p(ta,"showCardTooltipAtPosition");function L(){let e=document.getElementById("tooltip");e&&e.classList.remove("show","has-sacrifice");let t=document.getElementById("tooltip-sacrifice-btn"),a=document.getElementById("tooltip-bloodpact-btn"),n=document.getElementById("tooltip-thermal-btn"),r=document.getElementById("tooltip-rageheal-btn"),i=document.getElementById("tooltip-bloodfrenzy-btn");t&&(t.style.display="none"),a&&(a.style.display="none"),n&&(n.style.display="none"),r&&(r.style.display="none"),i&&(i.style.display="none"),g.cardTooltipVisible=!1}p(L,"hideTooltip");document.getElementById("battlefield-area").onclick=e=>{let a=document.getElementById("battlefield-area").getBoundingClientRect(),n=e.clientX-a.left,r=e.clientY-a.top,i=null,o=1/0,l=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tile-size"))||80)*.7;for(let[c,m]of Object.entries(K)){let f=Math.sqrt(Math.pow(n-m.x,2)+Math.pow(r-m.y,2));f<l&&f<o&&(o=f,i=c)}if(i){let[c,m,f]=i.split("-");aa(c,m,parseInt(f))}else{if(g.selectedCard?.type==="pyre")if(d.canPlayPyreCard("player")){nt(g.selectedCard);return}else P("Already played a Pyre card this turn",1500);L(),g.selectedCard=null,g.attackingCryptid=null,g.targetingBurst=null,g.targetingEvolution=null,g.targetingTrap=null,g.targetingAura=null,document.getElementById("cancel-target").classList.remove("show"),k()}};function aa(e,t,a){if(w)return;if(L(),g.selectedCard?.type==="pyre")if(d.canPlayPyreCard("player")){nt(g.selectedCard);return}else{P("Already played a Pyre card this turn",1500),g.selectedCard=null,k();return}if(t==="trap"){let s=(e==="player"?d.playerTraps:d.enemyTraps)[a];if(e==="player"&&g.targetingTrap&&d.getValidTrapSlots("player").some(c=>c.row===a)){Vt(a);return}if(e==="player"&&s){na(s,a,e);return}return}let n=parseInt(t),i=(e==="player"?d.playerField:d.enemyField)[n]?.[a];if(i&&e==="player"&&g.targetingEvolution&&d.getValidEvolutionTargets(g.targetingEvolution,"player").some(s=>s.col===n&&s.row===a)){at(e,n,a);return}if(!i&&e==="player"&&(g.selectedCard||g.draggedCard)){let o=g.selectedCard||g.draggedCard,s=o.isKindling||d.playerPyre>=o.cost;if(o.type==="cryptid"&&s&&(d.phase==="conjure1"||d.phase==="conjure2")&&d.getValidSummonSlots("player").some(c=>c.col===n&&c.row===a)){tt(n,a);return}}if(i&&e==="player"){let o=d.getCombatCol("player");if(n===o&&d.phase==="combat"&&d.currentTurn==="player"&&!i.tapped&&i.canAttack){let s=g.attackingCryptid===i;Jt(i),s||Ve(i,n,a,e);return}}if(e==="enemy"&&g.attackingCryptid&&d.getValidAttackTargets(g.attackingCryptid).find(s=>s.col===n&&s.row===a)){Zt(n,a);return}if(i&&g.targetingBurst&&d.getValidBurstTargets(g.targetingBurst,"player").some(s=>s.owner===e&&s.col===n&&s.row===a)){We(e,t,a);return}if(!i&&g.targetingBurst&&(g.targetingBurst.targetType==="tile"||g.targetingBurst.targetType==="enemyTile"||g.targetingBurst.targetType==="allyTile")&&d.getValidBurstTargets(g.targetingBurst,"player").some(l=>l.owner===e&&l.col===n&&l.row===a)){We(e,t,a);return}if(i&&e==="player"&&g.targetingAura&&d.getValidAuraTargets("player").some(s=>s.col===n&&s.row===a)){Ut(n,a);return}i&&Ve(i,t,a,e)}p(aa,"handleTileClick");function Ve(e,t,a,n){let r=`${n}-${t}-${a}`,i=K[r];if(!i)return;let s=document.getElementById("battlefield-area").getBoundingClientRect(),l=document.getElementById("tooltip"),c=d.getCombatCol(n),m=d.getSupportCol(n),f=e.currentAtk-(e.atkDebuff||0)-(e.curseTokens||0),h=e.currentHp,u=e.maxHp;if(t==c){let D=d.getFieldCryptid(n,m,a);D&&(f+=D.currentAtk-(D.atkDebuff||0)-(D.curseTokens||0),h+=D.currentHp,u+=D.maxHp)}let b=[];e.burnTurns>0&&b.push(`\u{1F525} Burning (${e.burnTurns} turns)`),e.paralyzed&&b.push(`\u26A1 Paralyzed (${e.paralyzeTurns||1} turn${e.paralyzeTurns!==1?"s":""})`),e.bleedTurns>0&&b.push(`\u{1FA78} Bleeding (${e.bleedTurns} turns)`),e.curseTokens>0&&b.push(`\u{1F52E} Cursed (-${e.curseTokens} ATK)`),e.calamityCounters>0&&b.push(`\u{1F480} Calamity (${e.calamityCounters} turns)`),e.protectionCharges>0&&b.push(`\u{1F6E1}\uFE0F Protected (${e.protectionCharges})`),e.hasFocus&&b.push("\u{1F3AF} Focus"),e.latchedTo&&b.push("\u{1F517} Latched to enemy"),e.latchedBy&&b.push("\u{1F517} Latched by enemy"),e.hasDestroyer&&b.push("\u{1F4A5} Destroyer"),d.isTileToxic(n,t,a)&&b.push("\u2620 On Toxic Tile"),e.auras?.length>0&&b.push(`\u2728 ${e.auras.map(D=>D.name).join(", ")}`),document.getElementById("tooltip-name").textContent=e.name;let x=e.element?e.element.charAt(0).toUpperCase()+e.element.slice(1):"",A=x?` | ${be(e.element)} ${x}`:"";document.getElementById("tooltip-desc").textContent=`HP: ${h}/${u} | ATK: ${f}${A}`,document.getElementById("tooltip-combat").textContent=`\u2694 ${e.combatAbility||"None"}`,document.getElementById("tooltip-support").textContent=`\u2727 ${e.supportAbility||"None"}`;let T=document.getElementById("tooltip-other");T&&(e.otherAbility?(T.textContent=`\u25C8 ${e.otherAbility}`,T.style.display="block"):T.style.display="none");let I=document.getElementById("tooltip-sacrifice-btn");e.hasSacrificeAbility&&e.sacrificeAbilityAvailable&&e.col===m&&n==="player"&&d.currentTurn==="player"&&d.getCombatant(e)?(I.style.display="block",I.onclick=D=>{D.stopPropagation(),e.activateSacrifice&&(e.activateSacrifice(e,d),L(),setTimeout(()=>k(),E.deathAnim+E.promoteAnim+200))},l.classList.add("has-sacrifice")):(I.style.display="none",l.classList.remove("has-sacrifice"));let C=document.getElementById("tooltip-bloodpact-btn");e.hasBloodPactAbility&&e.bloodPactAvailable&&e.col===m&&n==="player"&&d.currentTurn==="player"&&d.getCombatant(e)?(C.style.display="block",C.onclick=D=>{if(D.stopPropagation(),e.activateBloodPact){let R=d.getCombatant(e),N=(R?d.getEffectiveHp(R):0)<=1;d.isMultiplayer&&typeof window.Multiplayer<"u"&&!window.Multiplayer.processingOpponentAction&&window.Multiplayer.actionActivateAbility("bloodPact",e.col,e.row),e.activateBloodPact(e,d),L(),N?setTimeout(()=>k(),E.deathAnim+E.promoteAnim+200):k()}},l.classList.add("has-sacrifice")):C.style.display="none";let z=document.getElementById("tooltip-thermal-btn");if(z){let D=e.hasThermalAbility&&e.thermalAvailable&&e.col===m&&n==="player"&&d.currentTurn==="player"&&(d.phase==="conjure1"||d.phase==="conjure2"),R=!1;if(D){let ee=d.playerField,N=e.row;(N>0&&ee[m][N-1]||N<2&&ee[m][N+1])&&(R=!0)}D&&R?(z.style.display="block",z.onclick=ee=>{ee.stopPropagation();let N=d.playerField,X=e.row,te=null;X>0&&N[m][X-1]?te=X-1:X<2&&N[m][X+1]&&(te=X+1),te!==null&&e.activateThermal&&(d.isMultiplayer&&typeof window.Multiplayer<"u"&&!window.Multiplayer.processingOpponentAction&&window.Multiplayer.actionActivateAbility("thermalSwap",e.col,e.row,{targetRow:te}),e.activateThermal(e,d,te),L(),k())},l.classList.add("has-sacrifice")):z.style.display="none"}let $=document.getElementById("tooltip-rageheal-btn");$&&(e.hasRageHealAbility&&e.rageHealAvailable&&e.col===c&&n==="player"&&d.currentTurn==="player"&&(e.currentAtk||e.atk)>=1&&(d.phase==="conjure1"||d.phase==="conjure2")?($.style.display="block",$.onclick=R=>{R.stopPropagation(),e.activateRageHeal&&(d.isMultiplayer&&typeof window.Multiplayer<"u"&&!window.Multiplayer.processingOpponentAction&&window.Multiplayer.actionActivateAbility("rageHeal",e.col,e.row),e.activateRageHeal(e,d),L(),k())},l.classList.add("has-sacrifice")):$.style.display="none");let G=document.getElementById("tooltip-bloodfrenzy-btn");if(G&&(e.hasBloodFrenzyAbility&&e.bloodFrenzyAvailable&&e.col===c&&n==="player"&&d.currentTurn==="player"&&!e.cursedToDie&&(d.phase==="conjure1"||d.phase==="conjure2"||d.phase==="combat")?(G.style.display="block",G.onclick=R=>{R.stopPropagation(),e.activateBloodFrenzy&&(e.activateBloodFrenzy(e,d),L(),k())},l.classList.add("has-sacrifice")):G.style.display="none"),e.evolutionChain?.length>1){let D=`\u25C8 Stage ${e.evolutionChain.length} (${e.evolutionChain.length} souls bound)`;b.length>0&&(D+=` | ${b.join(" | ")}`),document.getElementById("tooltip-evolution").textContent=D}else if(e.getEvolution){let D=e.getEvolution(e);if(D){let R=`\u25C8 Will transform into: ${_(D)}`;b.length>0&&(R+=` | ${b.join(" | ")}`),document.getElementById("tooltip-evolution").textContent=R}else{let R="\u25C8 Cannot evolve (stats equal)";b.length>0&&(R+=` | ${b.join(" | ")}`),document.getElementById("tooltip-evolution").textContent=R}}else if(e.evolvesInto){let D=`\u25C8 May transform into: ${_(e.evolvesInto)}`;e.requiresSacrificeToEvolve&&(D+=" (requires sacrifice)"),b.length>0&&(D+=` | ${b.join(" | ")}`),document.getElementById("tooltip-evolution").textContent=D}else document.getElementById("tooltip-evolution").textContent=b.length>0?b.join(" | "):"";let F=s.left+i.x,kt=s.top+i.y;l.style.visibility="hidden",l.classList.add("show");let Ee=l.offsetWidth;l.style.visibility="",l.style.left=(n==="player"?Math.max(10,F-Ee-20):Math.min(F+20,window.innerWidth-Ee-10))+"px",l.style.top=Math.max(kt-60,10)+"px"}p(Ve,"showCryptidTooltip");function na(e,t,a){let n=`${a}-trap-${t}`,r=K[n];if(!r)return;let o=document.getElementById("battlefield-area").getBoundingClientRect(),s=document.getElementById("tooltip");document.getElementById("tooltip-name").textContent=e.name,document.getElementById("tooltip-desc").textContent=`Cost: ${e.cost} | Trap`,document.getElementById("tooltip-combat").textContent=`\u26A1 ${e.description||"Triggered automatically"}`,document.getElementById("tooltip-support").textContent=e.triggerDescription||"",document.getElementById("tooltip-evolution").textContent="";let l=o.left+r.x,c=o.top+r.y;s.style.visibility="hidden",s.classList.add("show");let m=s.offsetWidth;s.style.visibility="",s.style.left=(a==="player"?Math.max(10,l-m-20):Math.min(l+20,window.innerWidth-m-10))+"px",s.style.top=Math.max(c-60,10)+"px"}p(na,"showTrapTooltip");document.getElementById("game-container").onclick=e=>{e.target.id==="game-container"&&(L(),g.selectedCard=null,g.attackingCryptid=null,g.targetingBurst=null,g.targetingEvolution=null,document.getElementById("cancel-target").classList.remove("show"),k())};document.getElementById("hand-area").onclick=e=>{["hand-area","hand-container","action-bar"].includes(e.target.id)&&L()};document.getElementById("hud").onclick=L;document.getElementById("phase-header").onclick=L;window.addEventListener("resize",Ue(()=>{U(),pe(),J=document.getElementById("battlefield-area").offsetHeight,Z()},50));window.addEventListener("orientationchange",()=>{setTimeout(()=>{U(),pe(),J=document.getElementById("battlefield-area").offsetHeight,Z(),k()},150)});screen.orientation&&screen.orientation.addEventListener("change",()=>{setTimeout(()=>{U(),pe(),J=document.getElementById("battlefield-area").offsetHeight,Z(),k()},150)});window.TIMING=E;window.renderAll=k;window.renderSprites=V;window.showMessage=P;window.updateButtons=B;window.animateSupportPromotion=it;window.checkCascadingDeaths=de;window.processPendingPromotions=Y;window.animateTurnStartEffects=st;window.animateTurnEndEffects=ot;window.initGame=qt;window.initMultiplayerGame=function(){d=new le,window.pendingTraps=[],window.processingTraps=!1,window.animatingTraps=new Set,Q.init(),g={selectedCard:null,attackingCryptid:null,targetingBurst:null,targetingEvolution:null,targetingTrap:null,targetingAura:null,draggedCard:null,dragGhost:null,showingKindling:!1,cardTooltipTimer:null,cardTooltipVisible:!1,handCollapsed:!1},w=!1;let e=document.getElementById("hand-area"),t=document.getElementById("hand-container");return e&&e.classList.remove("collapsed"),t&&t.classList.remove("not-turn"),lt(),window.game=d,console.log("[System] Multiplayer game initialized"),d};function lt(){console.log("[Setup] setupGameEventListeners called, clearing old listeners first"),Mt(),ye(),y.off(),Q.subscribed=!1,Q.subscribeToEvents(),Q.subscribed=!0,console.log("[Setup] Listeners cleared and EventLog re-subscribed, setting up game listeners"),y.on("onPhaseChange",e=>{qe(e.newPhase)}),y.on("onTurnStart",e=>{qe("conjure1")}),y.on("onTurnStart",e=>{e.owner==="player"&&(g.selectedCard=null,g.attackingCryptid=null,g.targetingBurst=null,g.targetingEvolution=null,g.targetingTrap=null,g.targetingAura=null,g.draggedCard=null,document.getElementById("cancel-target").classList.remove("show"))}),y.on("onSummon",e=>{if(!e.isSupport)return;let t=e.owner,a=t==="player"?d.playerField:d.enemyField;for(let n=0;n<2;n++)for(let r=0;r<3;r++){let i=a[n][r];if(i&&(i.hasPackGrowth&&i!==e.cryptid&&(i.currentAtk=(i.currentAtk||i.atk)+1,i.currentHp=(i.currentHp||i.hp)+1,i.maxHp=(i.maxHp||i.hp)+1,y.emit("onPackGrowth",{cryptid:i,owner:t})),i.hasPackLeader&&i!==e.cryptid)){let o=d.getCombatant(i);o&&(o.currentAtk=(o.currentAtk||o.atk)+1,o.currentHp=(o.currentHp||o.hp)+1,o.maxHp=(o.maxHp||o.hp)+1,y.emit("onPackLeaderBuff",{support:i,combatant:o,owner:t}))}}}),y.on("onDeath",e=>{let t=e.owner,a=t==="player"?d.playerField:d.enemyField;for(let n=0;n<2;n++)for(let r=0;r<3;r++){let i=a[n][r];i?.hasDeathWatch&&i!==e.cryptid&&(d.drawCard(t,"deathWatch"),y.emit("onDeathWatchDraw",{watcher:i,victim:e.cryptid,owner:t}))}}),y.on("onPyreCardPlayed",e=>{console.log("[Hunt Listener] Callback invoked! data.owner:",e.owner);let t=e.owner,a=t==="player"?"enemy":"player",n=a==="player"?d.playerTraps:d.enemyTraps;console.log("[Hunt] onPyreCardPlayed fired, pyreOwner:",t,"checking traps for:",a,"traps:",n);for(let r=0;r<n.length;r++){let i=n[r];if(console.log("[Hunt] Checking trap slot",r,":",i?.key,i?.triggerType),i?.key==="hunt"&&i.triggerType==="onEnemyPyreCard"){let o=e.pyreGained||1;console.log("[Hunt] TRIGGERED! Stealing",o,"pyre"),P(`\u{1F3F9} Hunt! Stole ${o} pyre!`,1500);let s=document.querySelector(`.tile.trap[data-owner="${a}"][data-row="${r}"]`),l=document.querySelector(`.trap-sprite[data-owner="${a}"][data-row="${r}"]`);s&&(s.classList.add("trap-activating"),setTimeout(()=>s.classList.remove("trap-activating"),600)),l&&(l.classList.add("trap-triggering"),setTimeout(()=>l.classList.remove("trap-triggering"),600));let c=d.playerPyre,m=d.enemyPyre;t==="player"?d.playerPyre-=o:d.enemyPyre-=o,a==="player"?d.playerPyre+=o:d.enemyPyre+=o,t==="player"&&y.emit("onPyreSpent",{owner:"player",amount:o,oldValue:c,newValue:d.playerPyre,source:"huntTrap"}),a==="player"&&y.emit("onPyreGained",{owner:"player",amount:o,oldValue:c,newValue:d.playerPyre,source:"huntTrap"}),y.emit("onHuntSteal",{trap:i,stolenPyre:o,from:t,to:a}),y.emit("onTrapTriggered",{trap:i,owner:a,row:r}),n[r]=null,setTimeout(()=>{typeof k=="function"&&k()},100);break}}}),console.log("[Setup] Hunt trap listener registered, total onPyreCardPlayed listeners:",y.listenerCount("onPyreCardPlayed")),y.on("onPyreGained",e=>{let t=document.getElementById("player-pyre"),a=document.getElementById("enemy-pyre");t&&d&&(t.textContent=d.playerPyre),a&&d&&(a.textContent=d.enemyPyre);let n=e.owner==="player"?t:a;n&&(n.classList.add("pyre-flash-gain"),setTimeout(()=>n.classList.remove("pyre-flash-gain"),400))}),y.on("onPyreSpent",e=>{let t=document.getElementById("player-pyre"),a=document.getElementById("enemy-pyre");t&&d&&(t.textContent=d.playerPyre),a&&d&&(a.textContent=d.enemyPyre);let n=e.owner==="player"?t:a;n&&(n.classList.add("pyre-flash-spend"),setTimeout(()=>n.classList.remove("pyre-flash-spend"),400))}),y.on("onHuntSteal",e=>{let t=document.getElementById("player-pyre"),a=document.getElementById("enemy-pyre");t&&d&&(t.textContent=d.playerPyre),a&&d&&(a.textContent=d.enemyPyre)}),document.getElementById("game-over")?.classList.remove("show"),document.getElementById("cancel-target")?.classList.remove("show")}p(lt,"setupGameEventListeners");window.calculateTilePositions=U;window.performAttackOnTarget=he;window.playAttackAnimation=fe;console.log("Game System loaded")});var pt=M(()=>{"use strict";window.runEnemyAI=function(){let e=window.game,t=window.TIMING;e.gameOver||dt(()=>{setTimeout(()=>{e.gameOver||(e.phase="combat",window.renderAll(),setTimeout(()=>{ra(()=>{e.gameOver||setTimeout(()=>{e.gameOver||(e.phase="conjure2",window.renderAll(),dt(()=>{setTimeout(()=>{e.gameOver||(window.animateTurnEndEffects?window.animateTurnEndEffects(()=>{e.endTurn(),!e.gameOver&&(window.animateTurnStartEffects?window.animateTurnStartEffects("player",()=>{window.showMessage("Your turn begins...",t.messageDisplay),window.renderAll(),window.updateButtons()}):(window.showMessage("Your turn begins...",t.messageDisplay),window.renderAll(),window.updateButtons()))}):(e.endTurn(),e.gameOver||window.showMessage("Your turn begins...",t.messageDisplay),window.renderAll(),window.updateButtons()))},t.aiPhaseDelay)}))},t.aiPhaseDelay)})},300))},t.aiPhaseDelay)})};function dt(e){let t=window.game,a=window.TIMING,n=[],r=t.enemyHand.filter(l=>l.cost<=t.enemyPyre).sort((l,c)=>c.cost-l.cost),i=t.enemyPyre,o=new Set;for(let l of r)if(!(i<l.cost)){if(l.type==="cryptid"){if(l.evolvesFrom){let m=t.getValidEvolutionTargets(l,"enemy");if(m.length>0){n.push({type:"evolve",card:l,target:m[0]});continue}}let c=t.getValidSummonSlots("enemy").filter(m=>!o.has(`${m.col}-${m.row}`));if(c.length>0){let m=c[Math.floor(Math.random()*c.length)];o.add(`${m.col}-${m.row}`),n.push({type:"summon",card:l,slot:m}),i-=l.cost}}else if(l.type==="burst"){let c=t.getValidBurstTargets(l,"enemy"),m;l.key==="pyreBolt"||l.key==="shatter"?m=c.filter(f=>f.owner==="player").sort((f,h)=>t.getEffectiveHp(f.cryptid)-t.getEffectiveHp(h.cryptid))[0]:l.key==="heal"?m=c.filter(f=>f.owner==="enemy"&&f.cryptid.currentHp<f.cryptid.maxHp).sort((f,h)=>f.cryptid.currentHp-h.cryptid.currentHp)[0]:(l.key==="empower"||l.key==="protect")&&(m=c.filter(f=>f.owner==="enemy")[0]),m&&(n.push({type:"burst",card:l,target:m}),i-=l.cost)}}if(!t.enemyKindlingPlayedThisTurn&&t.enemyKindling.length>0){let l=t.getValidSummonSlots("enemy").filter(m=>!o.has(`${m.col}-${m.row}`));if(l.length>0&&(t.isFieldEmpty("enemy")||n.length===0&&t.enemyPyre<2||l.length>=4)){let m=l[Math.floor(Math.random()*l.length)];n.push({type:"kindling",slot:m})}}!t.enemyPyreBurnUsed&&t.enemyDeaths>=3&&t.enemyPyre<=2&&n.push({type:"pyreBurn"});function s(l){if(l>=n.length){window.renderAll(),e?.();return}let c=n[l];if(c.type==="summon"){let{card:m}=c,f=t.getValidSummonSlots("enemy");if(f.length===0){setTimeout(()=>s(l+1),100);return}let h=f[Math.floor(Math.random()*f.length)];if(t.summonCryptid("enemy",h.col,h.row,m)){t.enemyPyre-=m.cost;let u=t.enemyHand.findIndex(b=>b.id===m.id);u>-1&&t.enemyHand.splice(u,1),window.renderAll()}setTimeout(()=>s(l+1),a.summonAnim+200)}else if(c.type==="evolve"){let{card:m,target:f}=c;t.evolveCryptid(f.cryptid,m);let h=t.enemyHand.findIndex(u=>u.id===m.id);h>-1&&t.enemyHand.splice(h,1),window.renderAll(),setTimeout(()=>s(l+1),a.evolveAnim+200)}else if(c.type==="burst"){let{card:m,target:f}=c;window.showMessage(`\u2727 ${m.name} \u2727`,a.messageDisplay);let h=document.querySelector(`.cryptid-sprite[data-owner="${f.owner}"][data-col="${f.col}"][data-row="${f.row}"]`);h&&(h.classList.add("spell-target"),setTimeout(()=>h.classList.remove("spell-target"),a.spellEffect)),setTimeout(()=>{m.effect(t,"enemy",f.cryptid),t.enemyPyre-=m.cost;let u=t.enemyHand.findIndex(x=>x.id===m.id);u>-1&&t.enemyHand.splice(u,1),window.GameEvents.emit("onSpellCast",{card:m,caster:"enemy",target:f.cryptid,targetOwner:f.owner}),t.getEffectiveHp(f.cryptid)<=0?(h&&h.classList.add("dying-left"),setTimeout(()=>t.killCryptid(f.cryptid,"enemy"),100),setTimeout(()=>{t.promoteSupport(f.owner,f.row)&&window.animateSupportPromotion(f.owner,f.row),setTimeout(()=>{window.checkCascadingDeaths(()=>{window.renderAll(),s(l+1)})},a.promoteAnim+100)},a.deathAnim)):(window.renderAll(),setTimeout(()=>s(l+1),400))},a.spellEffect);return}else if(c.type==="kindling"){let m=t.getValidSummonSlots("enemy");if(m.length===0||t.enemyKindling.length===0){setTimeout(()=>s(l+1),100);return}let f=m[Math.floor(Math.random()*m.length)],h=Math.floor(Math.random()*t.enemyKindling.length),u=t.enemyKindling.splice(h,1)[0];u&&(t.summonKindling("enemy",f.col,f.row,u),t.enemyKindlingPlayedThisTurn=!0,window.renderAll()),setTimeout(()=>s(l+1),a.summonAnim+200)}else if(c.type==="pyreBurn"){window.showMessage("\u{1F702} Warden burns pyre! \u{1F702}",a.messageDisplay),setTimeout(()=>{t.pyreBurn("enemy"),window.renderAll(),setTimeout(()=>s(l+1),600)},400);return}}p(s,"processNextAction"),n.length>0?s(0):(window.renderAll(),e?.())}p(dt,"aiPlayCards");function ra(e){let t=window.game,a=window.TIMING,n=[],r=t.getCombatCol("enemy");for(let s=0;s<3;s++){let l=t.enemyField[r][s];if(l&&!l.tapped&&l.canAttack){let c=t.getValidAttackTargets(l);c.length>0&&(c.sort((m,f)=>{if(m.isEmptyTarget&&!f.isEmptyTarget)return 1;if(!m.isEmptyTarget&&f.isEmptyTarget)return-1;if(m.cryptid&&f.cryptid){let h=t.calculateAttackDamage(l),u=t.getEffectiveHp(m.cryptid),b=t.getEffectiveHp(f.cryptid),x=u<=h,A=b<=h;return x&&!A?-1:A&&!x?1:u-b}return 0}),n.push({attacker:l,row:s,target:c[0]}))}}function i(s){if(s>=n.length){e?.();return}let{attacker:l,row:c,target:m}=n[s];if(!l||l.tapped||!l.canAttack){i(s+1);return}let f=t.getCombatCol("player"),h=t.getFieldCryptid("player",f,m.row);h?(m.cryptid=h,m.isEmptyTarget=!1,m.col=f,m.owner="player"):(m.cryptid=null,m.isEmptyTarget=!0);let u=m.isEmptyTarget&&t.playerKindling.length>0;p(x=>{l.hasInsatiableHunger?(l.currentAtk=(l.currentAtk||l.atk)+1,GameEvents.emit("onInsatiableHunger",{attacker:l,newAtk:l.currentAtk}),window.showMessage(`${l.name}: +1 ATK!`,600),window.renderAll(),setTimeout(x,500)):x()},"applyPreAttackBuffs")(()=>{if(u){let x=t.popRandomKindling("player");t.summonKindling("player",f,m.row,x),window.showMessage("Forced Summoning!",a.messageDisplay),window.renderSprites(),setTimeout(()=>{window.renderSprites(),setTimeout(()=>{let A=document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${r}"][data-row="${c}"]`);typeof window.playAttackAnimation=="function"?window.playAttackAnimation(A,"enemy",()=>{o(l,f,m.row,s,i)}):(A&&(A.classList.add("attacking-left"),setTimeout(()=>A.classList.remove("attacking-left"),a.attackAnim)),setTimeout(()=>{o(l,f,m.row,s,i)},a.attackDelay))},50)},a.summonAnim+100)}else{let x=document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${r}"][data-row="${c}"]`);typeof window.playAttackAnimation=="function"?window.playAttackAnimation(x,"enemy",()=>{o(l,m.col,m.row,s,i)}):(x&&(x.classList.add("attacking-left"),setTimeout(()=>x.classList.remove("attacking-left"),a.attackAnim)),setTimeout(()=>{o(l,m.col,m.row,s,i)},a.attackDelay))}})}p(i,"processNextAttack");function o(s,l,c,m,f){let h=t.attack(s,"player",l,c),u=document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${l}"][data-row="${c}"]`),b=document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${s.col}"][data-row="${s.row}"]`),x=document.getElementById("battlefield-area"),A=0,T=0;if(u&&x){let C=u.getBoundingClientRect(),v=x.getBoundingClientRect();A=C.left+C.width/2-v.left,T=C.top+C.height/2-v.top}if(!h.negated&&!h.protectionBlocked&&window.CombatEffects){let C=h.damage||0,v=C>=5;CombatEffects.heavyImpact(C),CombatEffects.createImpactFlash(A,T,80+C*10),CombatEffects.createSparks(A,T,10+C*2),CombatEffects.createImpactParticles(A,T,h.killed?"#ff2222":"#ff6666",8+C),h.target&&C>0&&CombatEffects.showDamageNumber(h.target,C,v)}!h.negated&&!h.protectionBlocked&&!h.killed&&u&&(u.classList.add("hit-recoil"),setTimeout(()=>u.classList.remove("hit-recoil"),250));function I(C,v=1e4){let z=Date.now();function $(){if(Date.now()-z>v){console.warn("Trap wait timeout, forcing continue..."),window.processingTraps=!1,window.pendingTraps=[],C();return}window.processingTraps||window.pendingTraps&&window.pendingTraps.length>0?setTimeout($,100):C()}p($,"check"),$()}p(I,"waitForTraps");function S(C,v=1e4){let z=Date.now();function $(){if(Date.now()-z>v){console.warn("Ability animation timeout, forcing continue..."),window.processingAbilityAnimations=!1,window.abilityAnimationQueue=[],C();return}window.processingAbilityAnimations||window.abilityAnimationQueue&&window.abilityAnimationQueue.length>0?setTimeout($,100):C()}p($,"check"),$()}if(p(S,"waitForAbilityAnimations"),h.negated){h.attackerKilled&&b&&b.classList.add("dying-right"),S(()=>{setTimeout(()=>{window.renderAll(),h.attackerKilled?window.processPendingPromotions(()=>{I(()=>{window.checkCascadingDeaths(()=>{window.renderAll(),I(()=>f(m+1))})})}):I(()=>f(m+1))},h.attackerKilled?a.deathAnim:300)});return}h.killed?(u&&u.classList.add("dying-left"),S(()=>{setTimeout(()=>{window.renderAll(),window.processPendingPromotions(()=>{I(()=>{window.checkCascadingDeaths(()=>{window.renderAll(),I(()=>f(m+1))})})})},a.deathAnim)})):(u&&(u.classList.add("taking-damage"),setTimeout(()=>u.classList.remove("taking-damage"),a.damageAnim)),S(()=>{I(()=>{setTimeout(()=>{window.renderAll(),f(m+1)},a.damageAnim+200)})}))}p(o,"aiPerformAttackOnTarget"),n.length>0?i(0):e?.()}p(ra,"aiCombat");console.log("AI module loaded")});var mt=M(()=>{"use strict";window.PlayerData={level:1,xp:0,embers:1e6,souls:1e6,collection:{},decks:[],maxDeckSlots:5,stats:{gamesPlayed:0,wins:0,losses:0,aiWins:0,aiLosses:0,humanWins:0,humanLosses:0,totalDamageDealt:0,totalKills:0,favoriteCard:null,longestWinStreak:0,currentWinStreak:0},unlockedFeatures:{rankedMode:!1,customBoards:!1,tournaments:!1},settings:{musicVolume:.7,sfxVolume:.8,animations:!0,autoEndTurn:!1},tutorialCompleted:!1,boosters:{standard:0,premium:0,legendary:0},getXPForLevel(e){return Math.floor(100+(e-1)*8+Math.pow(e-1,1.5)*2)},getTotalXPForLevel(e){let t=0;for(let a=1;a<e;a++)t+=this.getXPForLevel(a);return t},addXP(e){let t=this.level;this.xp+=e;let a=[],n=0;for(;this.xp>=this.getXPForLevel(this.level);){this.xp-=this.getXPForLevel(this.level),this.level++,n++;let r=this.getLevelReward(this.level);a.push(r),this.embers+=r.currency,r.boosterPack&&(this.pendingBoosters=(this.pendingBoosters||0)+1),r.deckSlot&&this.maxDeckSlots<25&&this.maxDeckSlots++}return this.save(),{levelsGained:n,newLevel:this.level,rewards:a,currentXP:this.xp,xpToNext:this.getXPForLevel(this.level)}},getLevelReward(e){let t={level:e,currency:25+Math.floor(e/5)*10,boosterPack:e%10===0,deckSlot:e%10===0&&this.maxDeckSlots<25,special:null};return e===10&&(t.special={type:"title",value:"Apprentice Summoner"}),e===25&&(t.special={type:"cardBack",value:"flames_rising"}),e===50&&(t.special={type:"title",value:"Cryptid Master"}),e===100&&(t.special={type:"board",value:"obsidian_altar"}),t},getLevelProgress(){let e=this.getXPForLevel(this.level);return Math.min(100,this.xp/e*100)},addCurrency(e,t="unknown"){return this.embers+=e,console.log(`+${e} Embers (${t}). Total: ${this.embers}`),this.save(),this.embers},spendCurrency(e){return this.embers>=e?(this.embers-=e,this.save(),!0):!1},calculateMatchRewards(e,t,a={}){let n=e?50:20,r=t?1.5:1,i;t?i=e?2.5:.5:i=e?.2:.1;let o=100,s=0;if(a.kills&&(s+=a.kills*2),a.damageDealt&&(s+=Math.floor(a.damageDealt/10)),a.perfectWin&&(s+=25),a.comeback&&(s+=15),e){this.stats.currentWinStreak++,this.stats.currentWinStreak>this.stats.longestWinStreak&&(this.stats.longestWinStreak=this.stats.currentWinStreak);let m=Math.min(.5,this.stats.currentWinStreak*.05);n=Math.floor(n*(1+m))}else this.stats.currentWinStreak=0;let l=Math.floor((n+s)*r),c=Math.floor(o*i);return{xp:l,currency:c,breakdown:{baseXP:n,bonusXP:s,xpMultiplier:r,baseCurrency:o,currencyMultiplier:i,winStreak:this.stats.currentWinStreak}}},initializeStarterCollection(){["emberFox","shadowCat","voidWraith","frostSpider","mossTurtle","sewerAlligator","libraryGargoyle","fireImp"].forEach(a=>this.addToCollection(a,3)),["stoneGolem","thunderBird","lightningWolf","vampireInitiate","thunderSerpent","shadowLeech"].forEach(a=>this.addToCollection(a,2)),["pyreBolt","heal","protect"].forEach(a=>this.addToCollection(a,3)),["empower","shatter"].forEach(a=>this.addToCollection(a,2)),["voidSnare","soulMirror","spiritWard"].forEach(a=>this.addToCollection(a,3)),["adrenaline"].forEach(a=>this.addToCollection(a,3)),["basicPyre"].forEach(a=>this.addToCollection(a,6)),["forgottenGraveyard"].forEach(a=>this.addToCollection(a,2)),typeof CardRegistry<"u"&&CardRegistry.getAllKindlingKeys&&CardRegistry.getAllKindlingKeys().forEach(a=>{this.addToCollection(a,4)}),this.save()},createStarterDeck(e="city-of-flesh"){let t={"city-of-flesh":{name:"City of Flesh",cryptids:["rooftopGargoyle","libraryGargoyle","vampireInitiate","elderVampire","sewerAlligator","kuchisakeOnna","hellhound","mothman","bogeyman","theFlayer","mutatedRat"],kindling:["myling","shadowPerson","hellhoundPup","elDuende","boggart"],pyres:["pyre","freshKill","ratKing","nightfall"],traps:["crossroads","bloodCovenant","turnToStone"],bursts:["wakingNightmare","faceOff"],auras:["antiVampiricBlade"]},"forests-of-fear":{name:"Forests of Fear",cryptids:["matureWendigo","primalWendigo","thunderbird","adultBigfoot","werewolf","lycanthrope","snipe","rogueRazorback","notDeer","jerseyDevil","babaYaga","skinwalker"],kindling:["newbornWendigo","stormhawk","adolescentBigfoot","cursedHybrid","deerWoman"],pyres:["burialGround","cursedWoods","animalPelts"],traps:["terrify","hunt"],bursts:["fullMoon"],auras:["dauntingPresence","sproutWings","weaponizedTree","insatiableHunger"]}},a=t[e]||t["city-of-flesh"],n={id:Date.now(),name:a.name+" Starter",cards:[],created:Date.now(),modified:Date.now(),wins:0,losses:0,favorite:!0},r=p((i,o)=>{i.forEach(s=>{this.grantCardToCollection(s,o);for(let l=0;l<o;l++)n.cards.push({cardKey:s})})},"addCards");for(r(a.cryptids,2),r(a.kindling,3),r(a.pyres,4),r(a.traps,2),r(a.bursts,2),r(a.auras,2);n.cards.length<55&&a.kindling.length>0;){let i=a.kindling[n.cards.length%a.kindling.length],o=this.getOwnedCount(i);n.cards.filter(l=>l.cardKey===i).length>=o&&this.grantCardToCollection(i,1),n.cards.push({cardKey:i})}return console.log("[PlayerData] Created starter deck with",n.cards.length,"cards"),this.decks.push(n),this.save(),n},grantCardToCollection(e,t=1){this.collection[e]||(this.collection[e]={owned:0,skins:{}}),this.collection[e].owned+=t},addToCollection(e,t=1,a=null,n=!1){return this.collection[e]||(this.collection[e]={owned:0,skins:{}}),a?(this.collection[e].skins[a]||(this.collection[e].skins[a]={owned:0,holoOwned:0}),n?this.collection[e].skins[a].holoOwned+=t:this.collection[e].skins[a].owned+=t):n?this.collection[e].holoOwned=(this.collection[e].holoOwned||0)+t:this.collection[e].owned+=t,this.save(),this.collection[e]},getOwnedCount(e,t=null,a=!1){let n=this.collection[e];if(!n)return 0;if(t){let r=n.skins[t];return r?a?r.holoOwned:r.owned+r.holoOwned:0}return a?n.holoOwned||0:n.owned+(n.holoOwned||0)},ownsCard(e){return this.getOwnedCount(e)>0},getOwnedCards(){let e=[];for(let[t,a]of Object.entries(this.collection))(a.owned>0||a.holoOwned&&a.holoOwned>0)&&e.push({key:t,...a});return e},createDeck(e="New Deck"){if(this.decks.length>=this.maxDeckSlots)return{success:!1,error:"Maximum deck slots reached"};let t={id:Date.now(),name:e.substring(0,24),cards:[],created:Date.now(),modified:Date.now(),wins:0,losses:0,favorite:!1};return this.decks.push(t),this.save(),{success:!0,deck:t}},deleteDeck(e){let t=this.decks.findIndex(a=>a.id===e);return t>-1?(this.decks.splice(t,1),this.save(),!0):!1},updateDeck(e,t){let a=this.decks.find(n=>n.id===e);return a?(t.name&&(a.name=t.name.substring(0,24)),t.cards&&(a.cards=t.cards),t.favorite!==void 0&&(a.favorite=t.favorite),a.modified=Date.now(),this.save(),!0):!1},validateDeck(e){let t=[],a={};for(let n of e.cards)a[n.cardKey]=(a[n.cardKey]||0)+1;e.cards.length<55&&t.push(`Deck has ${e.cards.length} cards (minimum 55)`),e.cards.length>100&&t.push(`Deck has ${e.cards.length} cards (maximum 100)`);for(let[n,r]of Object.entries(a)){let i=this.getOwnedCount(n);if(r>i){let s=(CardRegistry.getCryptid(n)||CardRegistry.getBurst(n)||CardRegistry.getTrap(n)||CardRegistry.getAura(n)||CardRegistry.getPyre(n)||CardRegistry.getKindling(n))?.name||n;t.push(`Not enough copies of ${s} (need ${r}, own ${i})`)}}return{valid:t.length===0,errors:t,cardCount:e.cards.length}},getDeckForPlay(e){let t=this.decks.find(o=>o.id===e);if(!t)return null;let a=[],n=[],r=1,i=1e3;for(let o of t.cards){let s=CardRegistry.getKindling(o.cardKey);if(s){n.push({...s,id:i++,skinId:o.skinId,isHolo:o.isHolo});continue}let l=CardRegistry.getCryptid(o.cardKey)||CardRegistry.getBurst(o.cardKey)||CardRegistry.getTrap(o.cardKey)||CardRegistry.getAura(o.cardKey)||CardRegistry.getPyre(o.cardKey);l&&a.push({...l,id:r++,skinId:o.skinId,isHolo:o.isHolo})}for(let o=a.length-1;o>0;o--){let s=Math.floor(Math.random()*(o+1));[a[o],a[s]]=[a[s],a[o]]}return{cards:a,kindling:n}},save(){let e={level:this.level,xp:this.xp,embers:this.embers,souls:this.souls,collection:this.collection,decks:this.decks,maxDeckSlots:this.maxDeckSlots,stats:this.stats,unlockedFeatures:this.unlockedFeatures,settings:this.settings,tutorialCompleted:this.tutorialCompleted,boosters:this.boosters,pendingBoosters:this.pendingBoosters||0,lastSave:Date.now()};try{localStorage.setItem("cryptidFates_playerData",JSON.stringify(e))}catch(t){console.error("Failed to save player data:",t)}},load(){try{let e=localStorage.getItem("cryptidFates_playerData");if(e){let t=JSON.parse(e);return t.currency!==void 0&&(t.embers=t.currency,delete t.currency),t.premiumCurrency!==void 0&&(t.souls=t.premiumCurrency,delete t.premiumCurrency),t.boosters||(t.boosters={standard:0,premium:0,legendary:0}),Object.assign(this,t),console.log("Player data loaded. Level:",this.level),!0}}catch(e){console.error("Failed to load player data:",e)}return!1},reset(){localStorage.removeItem("cryptidFates_playerData"),location.reload()},init(){let e=this.load(),t=Object.keys(this.collection).length>0;!e||!t?(this.initializeStarterCollection(),this.save(),console.log("Starter collection initialized"),this.showWelcome=!0):this.migrateStarterDeck(),typeof CardRegistry<"u"&&CardRegistry.getAllKindlingKeys&&CardRegistry.getAllKindlingKeys().forEach(a=>{(!this.collection[a]||this.collection[a].owned<2)&&this.addToCollection(a,2)})},migrateStarterDeck(){let e=["emberFox","shadowCat","voidWraith","frostSpider","mossTurtle","fireImp","stoneGolem","thunderBird","lightningWolf","thunderSerpent","shadowLeech","pyreBolt","heal","protect","empower","shatter","voidSnare","soulMirror","spiritWard","adrenaline","basicPyre","forgottenGraveyard"],t=!1;for(let a of this.decks){for(let n of a.cards)if(e.includes(n.cardKey)){t=!0;break}if(t)break}if(t){console.log("[PlayerData] Found broken starter deck, rebuilding..."),this.decks=this.decks.filter(n=>!n.cards.some(i=>e.includes(i.cardKey)));let a=this.starterDeck||"city-of-flesh";this.createStarterDeck(a),this.save(),console.log("[PlayerData] Rebuilt starter deck with",a)}this.ensureDeckCardsOwned()},ensureDeckCardsOwned(){let e=0;for(let t of this.decks){let a={};for(let n of t.cards)a[n.cardKey]=(a[n.cardKey]||0)+1;for(let[n,r]of Object.entries(a)){let i=this.getOwnedCount(n);if(i<r){let o=r-i;this.grantCardToCollection(n,o),e+=o}}}e>0&&(console.log("[PlayerData] Granted",e,"missing cards to collection"),this.save())}};window.CardSkins={skins:{},registerSkin(e,t,a){this.skins[e]||(this.skins[e]={}),this.skins[e][t]={id:t,name:a.name,sprite:a.sprite,rarity:a.rarity||"rare",obtainedFrom:a.obtainedFrom||"booster",...a}},getSkinsForCard(e){return this.skins[e]||{}},getSkin(e,t){return this.skins[e]?.[t]}};CardSkins.registerSkin("emberFox","arctic",{name:"Arctic Fox",sprite:"\u{1F98A}",rarity:"epic",description:"A frost-touched variant from the northern wastes"});CardSkins.registerSkin("vampireInitiate","bloodmoon",{name:"Blood Moon Initiate",sprite:"https://example.com/bloodmoon-vampire.png",rarity:"legendary",description:"Awakened under the crimson moon"});CardSkins.registerSkin("mothman","neon",{name:"Neon Mothman",sprite:"https://example.com/neon-mothman.png",rarity:"legendary",description:"City lights beckon the prophet of doom"});console.log("Progression system loaded")});var ut=M(()=>{"use strict";var Ce=window.DeckBuilder||{};window.DeckBuilder={defaultDeckConfig:Ce.defaultDeckConfig,buildRandomDeck:Ce.buildRandomDeck,buildKindlingPool:Ce.buildKindlingPool,isOpen:!1,currentDeck:null,currentDeckId:null,mode:"select",filters:{category:"all",subtype:"all",element:"all",series:"all",search:""},deckPanelMinimized:!1,init(){this.createHTML(),this.bindEvents()},renderSprite(e){return e?e.startsWith("http")||e.startsWith("sprites/")?`<img src="${e}" class="sprite-img" alt="" draggable="false">`:e:"?"},createHTML(){let e=document.createElement("div");e.id="deckbuilder-overlay",e.innerHTML=`
            <!-- DECK SELECTION SCREEN -->
            <div class="db-screen" id="db-select-screen">
                <div class="db-topbar">
                    <button class="db-back-btn" id="db-back-home">\u2190 Back</button>
                    <h1 class="db-title">Your Decks</h1>
                    <div class="db-spacer"></div>
                </div>
                <div class="db-slots-area" id="db-slots"></div>
                <div class="db-footer">
                    <span class="db-hint" id="db-slots-info"></span>
                </div>
            </div>
            
            <!-- DECK EDITOR SCREEN -->
            <div class="db-screen" id="db-edit-screen">
                <div class="db-editor-layout">
                    <!-- Left: Collection Browser -->
                    <div class="db-browser">
                        <div class="db-browser-header">
                            <div class="db-browser-top">
                                <button class="db-back-btn" id="db-back-select">\u2190 Decks</button>
                                <input type="text" class="db-search" id="db-search" placeholder="\u{1F50D} Search cards...">
                            </div>
                            <div class="db-filters-row">
                                <div class="db-filter-group">
                                    <button class="db-filter-btn active" data-category="all">All</button>
                                    <button class="db-filter-btn" data-category="cryptid">Cryptids</button>
                                    <button class="db-filter-btn" data-category="spell">Spells</button>
                                </div>
                            </div>
                            <div class="db-filters-row" id="db-subtype-row">
                                <select class="db-select" id="db-subtype">
                                    <option value="all">All Types</option>
                                </select>
                                <select class="db-select" id="db-element">
                                    <option value="all">All Elements</option>
                                    <option value="blood">\u{1F534} Blood</option>
                                    <option value="void">\u{1F7E3} Void</option>
                                    <option value="nature">\u{1F7E2} Nature</option>
                                    <option value="water">\u{1F535} Water</option>
                                    <option value="steel">\u26AA Steel</option>
                                </select>
                                <select class="db-select" id="db-series">
                                    <option value="all">All Series</option>
                                    <option value="city-of-flesh">\u{1F3DA}\uFE0F City of Flesh</option>
                                    <option value="forests-of-fear">\u{1F332} Forests of Fear</option>
                                    <option value="putrid-swamp">\u{1F40A} Putrid Swamp</option>
                                </select>
                            </div>
                            <div class="db-hint-bar">
                                <span>\u{1F4A1} Click card to add \u2022 Right-click for details</span>
                            </div>
                        </div>
                        <div class="db-cards-scroll" id="db-cards-scroll"></div>
                    </div>
                    
                    <!-- Right: Deck Panel -->
                    <div class="db-deck" id="db-deck-panel">
                        <div class="db-deck-toggle" id="db-deck-toggle">
                            <span class="toggle-icon">\u25BC</span>
                            <span class="toggle-label">Deck</span>
                            <span class="db-deck-count-mini" id="db-count-mini">0</span>
                        </div>
                        <div class="db-deck-top">
                            <input type="text" class="db-deck-name" id="db-deck-name" placeholder="Deck Name" maxlength="20">
                            <div class="db-deck-count-wrap">
                                <span class="db-deck-count" id="db-count">0</span>
                                <span class="db-deck-range">/55-100</span>
                            </div>
                        </div>
                        <div class="db-curve-section">
                            <div class="db-curve-label">Mana Curve</div>
                            <div class="db-curve" id="db-curve"></div>
                        </div>
                        <div class="db-deck-hint">\u{1F4A1} Tap to remove \xB7 Hold for details</div>
                        <div class="db-deck-scroll" id="db-deck-scroll"></div>
                        <div class="db-deck-btns">
                            <button class="db-action-btn secondary" id="db-clear">Clear</button>
                            <button class="db-action-btn primary" id="db-save">Save Deck</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- CARD PREVIEW MODAL -->
            <div class="db-preview-modal" id="db-preview-modal">
                <div class="db-preview-backdrop"></div>
                <div class="db-preview-content" id="db-preview-content"></div>
            </div>
            
            <!-- INCINERATE CONFIRMATION POPUP -->
            <div class="db-incinerate-modal" id="db-incinerate-modal">
                <div class="db-incinerate-backdrop"></div>
                <div class="db-incinerate-content">
                    <div class="incinerate-header"><img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img" alt=""> Incinerate Cards</div>
                    <div class="incinerate-card-info" id="incinerate-card-info"></div>
                    <div class="incinerate-controls">
                        <button class="incinerate-qty-btn" id="incinerate-minus">\u2212</button>
                        <span class="incinerate-qty" id="incinerate-qty">1</span>
                        <button class="incinerate-qty-btn" id="incinerate-plus">+</button>
                    </div>
                    <div class="incinerate-reward" id="incinerate-reward">
                        <span class="reward-label">You'll receive:</span>
                        <span class="reward-amount"><img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img ember-icon" alt=""><span id="incinerate-embers">0</span></span>
                    </div>
                    <div class="incinerate-warning">\u26A0\uFE0F This cannot be undone!</div>
                    <div class="incinerate-btns">
                        <button class="incinerate-btn cancel" id="incinerate-cancel">Cancel</button>
                        <button class="incinerate-btn confirm" id="incinerate-confirm">Incinerate</button>
                    </div>
                </div>
            </div>
        `,document.body.appendChild(e)},bindEvents(){document.getElementById("db-back-home").onclick=()=>this.close(),document.getElementById("db-back-select").onclick=()=>this.showSelectScreen(),document.getElementById("db-search").oninput=e=>{this.filters.search=e.target.value.toLowerCase(),this.renderCards()},document.querySelectorAll(".db-filter-btn").forEach(e=>{e.onclick=()=>{document.querySelectorAll(".db-filter-btn").forEach(t=>t.classList.remove("active")),e.classList.add("active"),this.filters.category=e.dataset.category,this.updateSubtypeOptions(),this.renderCards()}}),document.getElementById("db-subtype").onchange=e=>{this.filters.subtype=e.target.value,this.renderCards()},document.getElementById("db-element").onchange=e=>{this.filters.element=e.target.value,this.renderCards()},document.getElementById("db-series").onchange=e=>{this.filters.series=e.target.value,this.renderCards()},document.getElementById("db-deck-toggle").onclick=()=>{this.toggleDeckPanel()},document.querySelector(".db-incinerate-backdrop").onclick=()=>this.closeIncinerateModal(),document.getElementById("incinerate-cancel").onclick=()=>this.closeIncinerateModal(),document.getElementById("incinerate-confirm").onclick=()=>this.confirmIncinerate(),document.getElementById("incinerate-minus").onclick=()=>this.adjustIncinerateQty(-1),document.getElementById("incinerate-plus").onclick=()=>this.adjustIncinerateQty(1),document.getElementById("db-deck-name").oninput=e=>{this.currentDeck&&(this.currentDeck.name=e.target.value)},document.getElementById("db-clear").onclick=()=>{this.currentDeck&&confirm("Clear all cards?")&&(this.currentDeck.cards=[],this.renderDeck(),this.renderCards())},document.getElementById("db-save").onclick=()=>this.saveDeck(),document.querySelector(".db-preview-backdrop").onclick=()=>this.closePreview(),document.getElementById("db-preview-modal").onclick=e=>{e.target.id==="db-preview-modal"&&this.closePreview()},document.addEventListener("keydown",e=>{e.key==="Escape"&&this.isOpen&&(document.getElementById("db-preview-modal").classList.contains("open")?this.closePreview():this.mode==="edit"?this.showSelectScreen():this.close())})},updateSubtypeOptions(){let e=document.getElementById("db-subtype"),t=document.getElementById("db-element"),a=this.filters.category,n='<option value="all">All Types</option>';a==="all"?(n+=`
                <option value="kindling">Kindling</option>
                <option value="basic">Basic Cryptids</option>
                <option value="mythical">Mythical</option>
                <option value="burst">Bursts</option>
                <option value="trap">Traps</option>
                <option value="aura">Auras</option>
                <option value="pyre">Pyres</option>
            `,t.style.display="block"):a==="cryptid"?(n+=`
                <option value="kindling">Kindling</option>
                <option value="basic">Basic</option>
                <option value="mythical">Mythical</option>
            `,t.style.display="block"):a==="spell"&&(n+=`
                <option value="burst">Bursts</option>
                <option value="trap">Traps</option>
                <option value="aura">Auras</option>
                <option value="pyre">Pyres</option>
            `,t.style.display="none"),e.innerHTML=n,this.filters.subtype="all"},open(){this.isOpen=!0,document.getElementById("deckbuilder-overlay").classList.add("open"),this.showSelectScreen()},close(){this.isOpen=!1,document.getElementById("deckbuilder-overlay").classList.remove("open"),typeof HomeScreen<"u"&&HomeScreen.open()},showSelectScreen(){this.mode="select",this.currentDeck=null,this.currentDeckId=null,document.getElementById("db-select-screen").classList.add("active"),document.getElementById("db-edit-screen").classList.remove("active"),this.renderSlots()},showEditScreen(e){let t=PlayerData.decks.find(i=>i.id===e);if(!t)return;this.mode="edit",this.currentDeckId=e,this.currentDeck=JSON.parse(JSON.stringify(t)),document.getElementById("db-select-screen").classList.remove("active"),document.getElementById("db-edit-screen").classList.add("active"),document.getElementById("db-deck-name").value=this.currentDeck.name,this.filters={category:"all",subtype:"all",element:"all",series:"all",search:""},document.querySelectorAll(".db-filter-btn").forEach(i=>i.classList.remove("active")),document.querySelector('.db-filter-btn[data-category="all"]').classList.add("active"),document.getElementById("db-search").value="",document.getElementById("db-element").value="all",document.getElementById("db-series").value="all",this.updateSubtypeOptions();let a=document.getElementById("db-deck-panel"),n=document.getElementById("db-deck-toggle");window.matchMedia("(max-width: 800px) and (orientation: portrait)").matches?(a.classList.add("minimized"),a.classList.remove("maximized"),n&&(n.querySelector(".toggle-icon").textContent="\u25B2",n.querySelector(".toggle-label").textContent="Deck")):(a.classList.remove("minimized"),a.classList.remove("maximized"),n&&(n.querySelector(".toggle-icon").textContent="\u25BC")),this.renderCards(),this.renderDeck()},renderSlots(){let e=document.getElementById("db-slots"),t=PlayerData.maxDeckSlots,a="";PlayerData.decks.forEach(r=>{let i=PlayerData.validateDeck(r).valid;a+=`
                <div class="db-slot ${i?"valid":"invalid"}" onclick="DeckBuilder.showEditScreen(${r.id})">
                    <div class="db-slot-icon">\u{1F4DC}</div>
                    <div class="db-slot-name">${this.escapeHtml(r.name)}</div>
                    <div class="db-slot-cards">${r.cards.length} cards</div>
                    <div class="db-slot-status">${i?"\u2713 Ready":"\u26A0 "+(r.cards.length<55?"Need "+(55-r.cards.length)+" more":"Too many")}</div>
                    <button class="db-slot-del" onclick="event.stopPropagation(); DeckBuilder.deleteDeck(${r.id})">\xD7</button>
                </div>
            `});let n=t-PlayerData.decks.length;for(let r=0;r<n;r++)a+=`
                <div class="db-slot empty" onclick="DeckBuilder.createNewDeck()">
                    <div class="db-slot-icon">+</div>
                    <div class="db-slot-name">New Deck</div>
                    <div class="db-slot-cards">Click to create</div>
                </div>
            `;t<25&&(a+=`
                <div class="db-slot locked">
                    <div class="db-slot-icon">\u{1F512}</div>
                    <div class="db-slot-name">Locked</div>
                    <div class="db-slot-cards">Level ${(t+1)*10}</div>
                </div>
            `),e.innerHTML=a,document.getElementById("db-slots-info").textContent=`${PlayerData.decks.length}/${t} deck slots used`},createNewDeck(){let e=PlayerData.createDeck("New Deck");e.success&&this.showEditScreen(e.deck.id)},deleteDeck(e){confirm("Delete this deck?")&&(PlayerData.deleteDeck(e),this.renderSlots())},renderCards(){let e=document.getElementById("db-cards-scroll"),t=this.getAllCards(),a=this.filterCards(t);if(a.length===0){let i=this.filters.category!=="all"||this.filters.subtype!=="all"||this.filters.element!=="all"||this.filters.series!=="all"||this.filters.search!==""?"No owned cards match filters":`You don't own any cards yet!<br><span style="font-size:12px;color:#707080;">Visit the Shop to get boosters</span>`;e.innerHTML=`<div class="db-no-cards">${i}</div>`;return}let n="";a.forEach(r=>{let i=r.foil||!1,o=r.infinite||!1,s=o?1/0:i?r.holoOwned||0:r.normalOwned||0,l=this.getVariantCountInDeck(r.key,i),c=this.getBaseCardCountInDeck(r.key),m=this.getMaxCopies(r.key),f=o?1/0:s-l,h=m-c,u=f>0&&h>0;n+=this.renderCardHTML(r,s,l,u?1:0,i,m,c)}),e.innerHTML=n,e.querySelectorAll(".db-card").forEach(r=>{let i=null,o=!1,s=r.dataset.cardKey,l=r.dataset.foil==="true";r.addEventListener("click",c=>{if(o){o=!1;return}DeckBuilder.addCard(s,l)}),r.addEventListener("contextmenu",c=>{c.preventDefault(),this.showPreview(s)}),r.addEventListener("touchstart",c=>{o=!1,s&&(i=setTimeout(()=>{o=!0,this.showPreview(s)},500))},{passive:!0}),r.addEventListener("touchend",()=>{clearTimeout(i)}),r.addEventListener("touchmove",()=>{clearTimeout(i)}),r.addEventListener("touchcancel",()=>{clearTimeout(i)})})},renderCardHTML(e,t,a,n,r=!1,i=3,o=0){let s=e.type==="cryptid",l=s?"cryptid-card":"spell-card",c=e.element?`element-${e.element}`:"",m=this.getTypeClass(e),f=t===0?"unowned":"",h=a>0?"in-deck":"",u=o>=i,b=n<=0&&t>0||u?"unavailable":"",x=e.mythical?"mythical":"",A=r?"foil":"",T=e.rarity||"common",I="";s?I=`
                <span class="gc-stat atk">${e.atk}</span>
                <span class="gc-stat hp">${e.hp}</span>
            `:I=`<span class="gc-stat-type">${{burst:"Burst",trap:"Trap",aura:"Aura",pyre:"Pyre"}[e.type]||"Spell"}</span>`;let S=`<span class="gc-rarity ${T}"></span>`,C=r?'<span class="gc-foil">\u2728</span>':"",v;e.infinite?v=a>0?`${a}/\u221E`:"\u221E":v=a>0?`${a}/${t}`:`\xD7${t}`;let z=u&&!e.infinite?`<span class="gc-max-copies">${o}/${i}</span>`:"";return`
            <div class="game-card db-card ${l} ${c} ${m} ${T} ${f} ${h} ${b} ${x} ${A}"
                 data-card-key="${e.key}"
                 data-foil="${r}">
                <span class="gc-cost">${e.cost}</span>
                <div class="gc-header"><span class="gc-name">${e.name}</span></div>
                <div class="gc-art">${DeckBuilder.renderSprite(e.sprite)}</div>
                <div class="gc-stats">${I}</div>
                ${S}
                ${C}
                <span class="gc-owned">${v}</span>
                ${z}
            </div>
        `},getTypeClass(e){return e.isKindling?"kindling-card":e.type==="trap"?"trap-card":e.type==="aura"?"aura-card":e.type==="pyre"?"pyre-card":e.type==="burst"?"burst-card":""},getAllCards(){let e=[];if(typeof CardRegistry>"u")return e;let t=p((a,n,r,i,o={})=>{let s={...a,key:n,type:r,subtype:i,...o};if(a.infinite){e.push({...s,foil:!1,normalOwned:1/0,holoOwned:0,displayKey:n,infinite:!0});return}let l=PlayerData.collection[n]?.owned||0,c=PlayerData.collection[n]?.holoOwned||0;l>0&&e.push({...s,foil:!1,normalOwned:l,holoOwned:c,displayKey:n}),c>0&&e.push({...s,foil:!0,normalOwned:l,holoOwned:c,displayKey:n+"_foil"})},"addCardWithVariants");return CardRegistry.getAllCryptidKeys().forEach(a=>{let n=CardRegistry.getCryptid(a);n&&t(n,a,"cryptid",n.mythical?"mythical":"basic")}),CardRegistry.getAllKindlingKeys().forEach(a=>{let n=CardRegistry.getKindling(a);n&&t(n,a,"cryptid","kindling",{isKindling:!0})}),CardRegistry.getAllBurstKeys().forEach(a=>{let n=CardRegistry.getBurst(a);n&&t(n,a,"burst","burst")}),CardRegistry.getAllTrapKeys().forEach(a=>{let n=CardRegistry.getTrap(a);n&&t(n,a,"trap","trap")}),CardRegistry.getAllAuraKeys().forEach(a=>{let n=CardRegistry.getAura(a);n&&t(n,a,"aura","aura")}),CardRegistry.getAllPyreKeys().forEach(a=>{let n=CardRegistry.getPyre(a);n&&t(n,a,"pyre","pyre",{cost:0})}),e.sort((a,n)=>a.cost-n.cost||a.name.localeCompare(n.name))},filterCards(e){return e.filter(t=>{let{category:a,subtype:n,element:r,series:i,search:o}=this.filters;return!(a==="cryptid"&&t.type!=="cryptid"||a==="spell"&&t.type==="cryptid"||n!=="all"&&(n==="kindling"&&!t.isKindling||n==="basic"&&(t.isKindling||t.mythical||t.type!=="cryptid")||n==="mythical"&&!t.mythical||["burst","trap","aura","pyre"].includes(n)&&t.type!==n)||r!=="all"&&t.element!==r||i!=="all"&&this.getCardSeries(t.key)!==i||o&&!t.name.toLowerCase().includes(o))})},getCardSeries(e){let t=["newbornWendigo","matureWendigo","primalWendigo","stormhawk","thunderbird","adolescentBigfoot","adultBigfoot","cursedHybrid","werewolf","lycanthrope","deerWoman","snipe","rogueRazorback","notDeer","jerseyDevil","babaYaga","skinwalker","burialGround","cursedWoods","animalPelts","dauntingPresence","sproutWings","weaponizedTree","insatiableHunger","terrify","hunt","fullMoon"],a=["feuFollet","swampRat","bayouSprite","voodooDoll","platEyePup","zombie","crawfishHorror","letiche","haint","ignisFatuus","plagueRat","swampHag","effigy","platEye","spiritFire","booHag","revenant","rougarou","swampStalker","mamaBrigitte","loupGarou","draugrLord","baronSamedi","honeyIslandMonster","grisGrisBag","swampGas","curseVessel","hungryGround","hexCurse"];return t.includes(e)?"forests-of-fear":a.includes(e)?"putrid-swamp":"city-of-flesh"},renderDeck(){if(!this.currentDeck)return;let e=this.currentDeck.cards.length,t=document.getElementById("db-count"),a=document.getElementById("db-count-mini");t.textContent=e,a&&(a.textContent=e),t.className="db-deck-count",e>=55&&e<=100?t.classList.add("valid"):e>0&&t.classList.add("invalid"),this.renderCurve();let n={};this.currentDeck.cards.forEach(s=>{let l=s.cardKey+(s.foil?"_foil":"");n[l]||(n[l]={cardKey:s.cardKey,foil:s.foil||!1,count:0}),n[l].count++});let r=document.getElementById("db-deck-scroll");if(Object.keys(n).length===0){r.innerHTML='<div class="db-deck-empty">Your deck is empty<br><span>Add cards from the left panel</span></div>';return}let i="";Object.keys(n).sort((s,l)=>{let c=this.getCard(n[s].cardKey),m=this.getCard(n[l].cardKey);return(c?.cost||0)-(m?.cost||0)}).forEach(s=>{let l=n[s],c=this.getCard(l.cardKey);if(!c)return;let m=l.count,f=this.getTypeClass(c),h=l.foil?"foil":"",u=l.foil?"\u2728":"";i+=`
                <div class="db-deck-item ${f} ${h}" 
                     data-card-key="${l.cardKey}" 
                     data-foil="${l.foil}">
                    <span class="db-item-cost">${c.cost}</span>
                    <span class="db-item-sprite">${DeckBuilder.renderSprite(c.sprite)}</span>
                    <span class="db-item-name">${c.name}${u}</span>
                    <span class="db-item-qty">\xD7${m}</span>
                </div>
            `}),r.innerHTML=i,r.querySelectorAll(".db-deck-item").forEach(s=>{let l=s.dataset.cardKey,c=s.dataset.foil==="true",m=null,f=!1;s.addEventListener("click",h=>{if(f){f=!1;return}this.removeCard(l,c)}),s.addEventListener("contextmenu",h=>{h.preventDefault(),this.showCardDetail(l)}),s.addEventListener("touchstart",h=>{f=!1,m=setTimeout(()=>{f=!0,this.showCardDetail(l)},500)},{passive:!0}),s.addEventListener("touchend",()=>{clearTimeout(m)}),s.addEventListener("touchmove",()=>{clearTimeout(m)}),s.addEventListener("touchcancel",()=>{clearTimeout(m)})})},showCardDetail(e){this.showPreview(e)},renderCurve(){let e=[0,0,0,0,0,0,0];this.currentDeck&&this.currentDeck.cards.forEach(r=>{let i=this.getCard(r.cardKey);if(i){let o=Math.min(i.cost,6);e[o]++}});let t=Math.max(...e,1),a=36,n=document.getElementById("db-curve");n.innerHTML=e.map((r,i)=>`
                <div class="db-curve-col">
                    <div class="db-curve-bar" style="height: ${Math.max(r/t*a,r>0?4:2)}px;">
                        ${r>0?`<span class="db-curve-num">${r}</span>`:""}
                    </div>
                    <span class="db-curve-cost">${i===6?"6+":i}</span>
                </div>
            `).join("")},getMaxCopies(e){let t=this.getCard(e);return t?t.infinite?1/0:t.mythical?1:3:3},getBaseCardCountInDeck(e){return this.currentDeck?this.currentDeck.cards.filter(t=>t.cardKey===e).length:0},getVariantCountInDeck(e,t){return this.currentDeck?this.currentDeck.cards.filter(a=>a.cardKey===e&&a.foil===t).length:0},addCard(e,t=!1){if(!this.currentDeck)return;let n=this.getCard(e)?.infinite||!1,r=n?1/0:PlayerData.collection[e]?.owned||0,i=PlayerData.collection[e]?.holoOwned||0;if(r+i===0&&!n){this.showPreview(e);return}if(this.currentDeck.cards.length>=100)return;let s=this.getMaxCopies(e);if(this.getBaseCardCountInDeck(e)>=s)return;n&&(t=!1);let c=t,m=this.getVariantCountInDeck(e,!0),f=this.getVariantCountInDeck(e,!1);if(c){if(m>=i)if(f<r)c=!1;else return}else if(f>=r&&!n)if(m<i)c=!0;else return;this.currentDeck.cards.push({cardKey:e,foil:c}),this.renderDeck(),this.renderCards()},removeCard(e,t=!1){if(!this.currentDeck)return;let a=this.currentDeck.cards.findIndex(n=>n.cardKey===e&&n.foil===t);a>-1&&(this.currentDeck.cards.splice(a,1),this.renderDeck(),this.renderCards())},getCardCountInDeck(e){return this.getBaseCardCountInDeck(e)},getCard(e){if(typeof CardRegistry>"u")return null;let t=CardRegistry.getCryptid(e);if(t)return{...t,key:e,type:"cryptid"};let a=CardRegistry.getKindling(e);if(a)return{...a,key:e,type:"cryptid",isKindling:!0};let n=CardRegistry.getBurst(e);if(n)return{...n,key:e,type:"burst"};let r=CardRegistry.getTrap(e);if(r)return{...r,key:e,type:"trap"};let i=CardRegistry.getAura(e);if(i)return{...i,key:e,type:"aura"};let o=CardRegistry.getPyre(e);return o?{...o,key:e,type:"pyre",cost:0}:null},saveDeck(){if(!this.currentDeck)return;let e=this.currentDeck.cards.length;if(e<55){alert(`Deck needs ${55-e} more cards (minimum 55)`);return}if(e>100){alert(`Deck has ${e-100} too many cards (maximum 100)`);return}PlayerData.updateDeck(this.currentDeckId,{name:this.currentDeck.name||"Unnamed Deck",cards:this.currentDeck.cards}),this.showSelectScreen()},showPreview(e,t=!1){let a=this.getCard(e);if(!a)return;let n=a.infinite||!1,r=n?1/0:PlayerData.collection[e]?.owned||0,i=PlayerData.collection[e]?.holoOwned||0,o=n?1/0:r+i,s=this.getCardCountInDeck(e),l=n?1/0:o-s,c=a.type==="cryptid",m=a.element?`element-${a.element}`:"",f=this.getTypeClass(a),h={void:"Void",blood:"Blood",water:"Water",steel:"Steel",nature:"Nature"},u={void:"\u25C8",blood:"\u25C9",water:"\u25CE",steel:"\u2B21",nature:"\u2756"},x={burst:"Burst Spell",trap:"Trap",aura:"Aura",pyre:"Pyre",cryptid:"Cryptid"}[a.type]||"Card";a.isKindling&&(x="Kindling"),a.mythical&&(x="Mythical Cryptid"),a.element&&c&&(x=`${h[a.element]} ${x}`);let A=a.rarity||"common",T=A==="common"?1:A==="uncommon"?2:A==="rare"?3:4,I=c?`<span class="preview-rarity ${A}">${'<span class="rarity-gem"></span>'.repeat(T)}</span>`:"",S=a.element?`<span class="preview-element-badge ${a.element}">${u[a.element]} ${h[a.element]}</span>`:"",C=a.mythical?'<div class="preview-mythical-badge"><div class="preview-mythical-eye"></div></div>':"",v="";a.combatAbility&&(v+=`<div class="preview-ability"><strong>Combat:</strong> ${a.combatAbility}</div>`),a.supportAbility&&(v+=`<div class="preview-ability"><strong>Support:</strong> ${a.supportAbility}</div>`),a.description&&(v+=`<div class="preview-ability">${a.description}</div>`),a.pyreEffect&&(v+=`<div class="preview-ability"><strong>Pyre:</strong> ${a.pyreEffect}</div>`);let z=this.calculateIncinerateValue(e,!1),$=this.calculateIncinerateValue(e,!0),G=document.getElementById("db-preview-content");G.innerHTML=`
            <div class="db-preview-card ${m} ${f}">
                <div class="db-preview-card-inner">
                    <div class="preview-header">
                        <span class="preview-name">${a.name}</span>
                        <span class="preview-cost">${a.cost}</span>
                    </div>
                    
                    <div class="preview-art-container">
                        <div class="preview-sprite">${DeckBuilder.renderSprite(a.sprite)}</div>
                        ${S}
                        ${C}
                    </div>
                    
                    <div class="preview-text-box">
                        <div class="preview-type">${x}</div>
                        ${c?`
                            <div class="preview-stats-row">
                                <span class="preview-stat atk">\u2694 ${a.atk}</span>
                                <span class="preview-stat hp">\u2665 ${a.hp}</span>
                            </div>
                        `:""}
                        ${v?`<div class="preview-abilities">${v}</div>`:""}
                        <div class="preview-availability">
                            ${n?`
                                <div class="preview-owned-row have infinite">
                                    <span class="avail-label">Available:</span>
                                    <span class="avail-value">\u221E Unlimited</span>
                                </div>
                            `:`
                                <div class="preview-owned-row ${r>0?"have":"none"}">
                                    <span class="avail-label">Normal:</span>
                                    <span class="avail-value">${r}</span>
                                    ${r>0?`<span class="ember-value">(<img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img-sm" alt="">${z})</span>`:""}
                                </div>
                                <div class="preview-owned-row ${i>0?"have holo":"none"}">
                                    <span class="avail-label">\u2728 Holo:</span>
                                    <span class="avail-value">${i}</span>
                                    ${i>0?`<span class="ember-value">(<img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img-sm" alt="">${$})</span>`:""}
                                </div>
                            `}
                            ${this.currentDeck?`
                                <div class="preview-deck-row">
                                    <span class="avail-label">In Deck:</span>
                                    <span class="avail-value">${s}</span>
                                </div>
                            `:""}
                        </div>
                    </div>
                    
                    <div class="preview-footer">
                        ${I}
                        <span class="preview-set">${this.getCardSeries(e).split("-").map(F=>F.charAt(0).toUpperCase()).join("")}</span>
                    </div>
                </div>
            </div>
            <div class="preview-actions">
                ${(o>0||n)&&this.currentDeck&&l>0?`<button class="preview-btn add" onclick="DeckBuilder.addCard('${e}'); DeckBuilder.closePreview();">Add to Deck</button>`:""}
                ${r>0&&!n?`<button class="preview-btn incinerate" onclick="DeckBuilder.showIncinerateModal('${e}', false);"><img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img-sm' alt=''> Incinerate</button>`:""}
                ${i>0?`<button class="preview-btn incinerate holo" onclick="DeckBuilder.showIncinerateModal('${e}', true);">\u2728 Incinerate Holo</button>`:""}
                <button class="preview-btn close" onclick="DeckBuilder.closePreview()">Close</button>
            </div>
        `,document.getElementById("db-preview-modal").classList.add("open")},closePreview(){document.getElementById("db-preview-modal").classList.remove("open")},toggleDeckPanel(){let e=document.getElementById("db-deck-panel"),t=document.getElementById("db-deck-toggle");e.classList.contains("minimized")?(e.classList.remove("minimized"),e.classList.add("maximized"),t.querySelector(".toggle-icon").textContent="\u2715",t.querySelector(".toggle-label").textContent="Close"):(e.classList.remove("maximized"),e.classList.add("minimized"),t.querySelector(".toggle-icon").textContent="\u25B2",t.querySelector(".toggle-label").textContent="Deck")},INCINERATE_LIMITS:{kindlingMinEach:2,cryptidsMinTotal:5,spellsMinTotal:5},incinerateState:{cardKey:null,isHolo:!1,maxQty:0,qty:1,embersPerCard:0},getCollectionCounts(){let e={},t=0,a=0;return Object.keys(PlayerData.collection||{}).forEach(n=>{let r=PlayerData.collection[n],i=(r.owned||0)+(r.holoOwned||0);if(i<=0)return;let o=this.getCard(n);o&&(o.isKindling?e[n]=i:o.type==="cryptid"?t+=i:["burst","trap","aura","pyre"].includes(o.type)&&(o.infinite||(a+=i)))}),{kindlingCounts:e,nonKindlingCryptids:t,spells:a}},getMaxIncinerable(e,t=!1){let a=this.getCard(e);if(!a||a.infinite)return 0;let n=t?PlayerData.collection[e]?.holoOwned||0:PlayerData.collection[e]?.owned||0,r=0;PlayerData.decks.forEach(l=>{l.cards.forEach(c=>{c.cardKey===e&&(c.foil||!1)===t&&r++})});let i=n-r;if(i<=0)return 0;let o=this.getCollectionCounts(),s=(PlayerData.collection[e]?.owned||0)+(PlayerData.collection[e]?.holoOwned||0);if(a.isKindling){let l=this.INCINERATE_LIMITS.kindlingMinEach,c=Math.max(0,s-l);i=Math.min(i,c)}else if(a.type==="cryptid"){let l=this.INCINERATE_LIMITS.cryptidsMinTotal,c=Math.max(0,o.nonKindlingCryptids-l);i=Math.min(i,c)}else if(["burst","trap","aura","pyre"].includes(a.type)){let l=this.INCINERATE_LIMITS.spellsMinTotal,c=Math.max(0,o.spells-l);i=Math.min(i,c)}return Math.max(0,i)},getLimitInfo(e){let t=this.getCard(e);if(!t)return null;if(t.infinite)return{type:"infinite",message:"Cannot be incinerated",atLimit:!0};let a=this.getCollectionCounts(),n=(PlayerData.collection[e]?.owned||0)+(PlayerData.collection[e]?.holoOwned||0);if(t.isKindling){let r=this.INCINERATE_LIMITS.kindlingMinEach,i=n<=r;return{type:"kindling",message:`Min ${r} per kindling`,current:n,limit:r,atLimit:i}}else if(t.type==="cryptid"){let r=this.INCINERATE_LIMITS.cryptidsMinTotal,i=a.nonKindlingCryptids<=r;return{type:"cryptid",message:`Min ${r} cryptids total (have ${a.nonKindlingCryptids})`,current:a.nonKindlingCryptids,limit:r,atLimit:i}}else if(["burst","trap","aura","pyre"].includes(t.type)){let r=this.INCINERATE_LIMITS.spellsMinTotal,i=a.spells<=r;return{type:"spell",message:`Min ${r} spells total (have ${a.spells})`,current:a.spells,limit:r,atLimit:i}}return null},calculateIncinerateValue(e,t=!1){let a=this.getCard(e);if(!a||a.infinite)return 0;let r={common:3,uncommon:5,rare:10,ultimate:20}[a.rarity]||3;return t&&(r+=10),a.mythical&&(r+=10),r},showIncinerateModal(e,t=!1){let a=this.getCard(e);if(!a)return;if(a.infinite){showMessage("Basic Pyre cannot be incinerated");return}let n=this.getMaxIncinerable(e,t);if(n<=0){let l=this.getLimitInfo(e);l?.atLimit?showMessage(`\u{1F512} ${l.message}`):showMessage("No available copies to incinerate");return}let r=this.calculateIncinerateValue(e,t),i=this.getLimitInfo(e);this.incinerateState={cardKey:e,isHolo:t,maxQty:n,qty:1,embersPerCard:r};let o=t?" \u2728 (Holo)":"",s=i?`<div class="incinerate-limit-info">\u{1F512} ${i.message}</div>`:"";document.getElementById("incinerate-card-info").innerHTML=`
            <div class="incinerate-card-name">${a.name}${o}</div>
            <div class="incinerate-card-available">Can incinerate: ${n}</div>
            ${s}
        `,this.updateIncinerateQty(),document.getElementById("db-incinerate-modal").classList.add("open")},closeIncinerateModal(){document.getElementById("db-incinerate-modal").classList.remove("open")},adjustIncinerateQty(e){let t=this.incinerateState.qty+e;t>=1&&t<=this.incinerateState.maxQty&&(this.incinerateState.qty=t,this.updateIncinerateQty())},updateIncinerateQty(){let{qty:e,embersPerCard:t,maxQty:a}=this.incinerateState;document.getElementById("incinerate-qty").textContent=e,document.getElementById("incinerate-embers").textContent=(e*t).toLocaleString(),document.getElementById("incinerate-minus").disabled=e<=1,document.getElementById("incinerate-plus").disabled=e>=a},confirmIncinerate(){let{cardKey:e,isHolo:t,qty:a,embersPerCard:n}=this.incinerateState,r=a*n;for(let i=0;i<a;i++)t?PlayerData.collection[e]?.holoOwned>0&&PlayerData.collection[e].holoOwned--:PlayerData.collection[e]?.owned>0&&PlayerData.collection[e].owned--;PlayerData.embers=(PlayerData.embers||0)+r,PlayerData.save(),this.closeIncinerateModal(),this.closePreview(),this.renderCards(),showMessage(`Incinerated ${a} card${a>1?"s":""} for ${r} embers!`)},escapeHtml(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>DeckBuilder.init()):DeckBuilder.init()});var gt=M(()=>{"use strict";window.Collection={isOpen:!1,currentSet:null,mode:"sets",sets:{"city-of-flesh":{id:"city-of-flesh",name:"City of Flesh",type:"deck",released:1,description:"Dark creatures of the night lurk in the City of Flesh. Vampires, gargoyles, and nightmares await.",icon:"\u{1F3DA}\uFE0F",cards:[]},"forests-of-fear":{id:"forests-of-fear",name:"Forests of Fear",type:"deck",released:2,description:"Ancient terrors stalk the primeval woods. Wendigos, werewolves, and forest spirits hunger for prey.",icon:"\u{1F332}",cards:[]},"putrid-swamp":{id:"putrid-swamp",name:"Putrid Swamp",type:"deck",released:3,description:"Cajun folklore comes alive in the bayou. Voodoo curses, swamp monsters, and the restless dead rise from murky waters.",icon:"\u{1F40A}",cards:[]},"diabolical-desert":{id:"diabolical-desert",name:"Diabolical Desert",type:"deck",released:4,description:"Scorching sands hide ancient horrors. Djinn, mummies, and sandworms rise from forgotten tombs.",icon:"\u{1F3DC}\uFE0F",cards:[]},"abhorrent-armory":{id:"abhorrent-armory",name:"Abhorrent Armory",type:"expansion",released:5,description:"Cursed weapons and haunted artifacts empower your cryptids with dark magic.",icon:"\u2694\uFE0F",cards:[]},"paranormal-promo":{id:"paranormal-promo",name:"Paranormal Promo",type:"expansion",released:6,description:"Limited edition promotional cards featuring rare and unique cryptids.",icon:"\u2728",cards:[]}},filters:{setType:"all",sort:"newest",search:"",category:"all",subtype:"all",element:"all",owned:"all"},init(){this.buildSetCards(),this.createHTML(),this.bindEvents()},renderSprite(e){return e?e.startsWith("http")||e.startsWith("sprites/")?`<img src="${e}" class="sprite-img" alt="" draggable="false">`:e:"?"},buildSetCards(){if(typeof CardRegistry>"u")return;let e=["newbornWendigo","matureWendigo","primalWendigo","stormhawk","thunderbird","adolescentBigfoot","adultBigfoot","cursedHybrid","werewolf","lycanthrope","deerWoman","snipe","rogueRazorback","notDeer","jerseyDevil","babaYaga","skinwalker","burialGround","cursedWoods","animalPelts","dauntingPresence","sproutWings","weaponizedTree","insatiableHunger","terrify","hunt","fullMoon"],t=["feuFollet","swampRat","bayouSprite","voodooDoll","platEyePup","zombie","crawfishHorror","letiche","haint","ignisFatuus","plagueRat","swampHag","effigy","platEye","spiritFire","booHag","revenant","rougarou","swampStalker","mamaBrigitte","loupGarou","draugrLord","baronSamedi","honeyIslandMonster","grisGrisBag","swampGas","curseVessel","hungryGround","hexCurse"],a=[],n=[],r=[],i=p((o,s)=>{e.includes(o)?n.push({key:o,type:s}):t.includes(o)?r.push({key:o,type:s}):a.push({key:o,type:s})},"categorizeCard");CardRegistry.getAllCryptidKeys().forEach(o=>{i(o,"cryptid")}),CardRegistry.getAllKindlingKeys().forEach(o=>{i(o,"kindling")}),CardRegistry.getAllBurstKeys().forEach(o=>{i(o,"burst")}),CardRegistry.getAllTrapKeys().forEach(o=>{i(o,"trap")}),CardRegistry.getAllAuraKeys().forEach(o=>{i(o,"aura")}),CardRegistry.getAllPyreKeys().forEach(o=>{i(o,"pyre")}),this.sets["city-of-flesh"].cards=a,this.sets["forests-of-fear"].cards=n,this.sets["putrid-swamp"].cards=r},createHTML(){let e=document.createElement("div");e.id="collection-overlay",e.innerHTML=`
            <!-- SETS LIST SCREEN -->
            <div class="coll-screen" id="coll-sets-screen">
                <div class="coll-topbar">
                    <button class="coll-back-btn" id="coll-back-home">\u2190 Back</button>
                    <h1 class="coll-title">Collection</h1>
                    <div class="coll-spacer"></div>
                </div>
                
                <div class="coll-stats-bar">
                    <div class="coll-stat">
                        <span class="coll-stat-value" id="coll-total-cards">0</span>
                        <span class="coll-stat-label">Cards Owned</span>
                    </div>
                    <div class="coll-stat">
                        <span class="coll-stat-value" id="coll-unique-cards">0</span>
                        <span class="coll-stat-label">Unique Cards</span>
                    </div>
                    <div class="coll-stat">
                        <span class="coll-stat-value" id="coll-completion">0%</span>
                        <span class="coll-stat-label">Complete</span>
                    </div>
                </div>
                
                <div class="coll-filters-bar">
                    <input type="text" class="coll-search" id="coll-set-search" placeholder="\u{1F50D} Search sets...">
                    <select class="coll-select" id="coll-set-type">
                        <option value="all">All Sets</option>
                        <option value="deck">Decks</option>
                        <option value="expansion">Expansions</option>
                    </select>
                    <select class="coll-select" id="coll-set-sort">
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="alpha">A-Z</option>
                        <option value="alphaReverse">Z-A</option>
                    </select>
                </div>
                
                <div class="coll-sets-grid" id="coll-sets-grid"></div>
            </div>
            
            <!-- CARDS IN SET SCREEN -->
            <div class="coll-screen" id="coll-cards-screen">
                <div class="coll-topbar">
                    <button class="coll-back-btn" id="coll-back-sets">\u2190 Sets</button>
                    <h1 class="coll-title" id="coll-set-title">Set Name</h1>
                    <div class="coll-set-progress" id="coll-set-progress">0/0</div>
                </div>
                
                <div class="coll-filters-bar">
                    <input type="text" class="coll-search" id="coll-card-search" placeholder="\u{1F50D} Search cards...">
                    <div class="coll-filter-group">
                        <button class="coll-filter-btn active" data-category="all">All</button>
                        <button class="coll-filter-btn" data-category="cryptid">Cryptids</button>
                        <button class="coll-filter-btn" data-category="spell">Spells</button>
                    </div>
                </div>
                
                <div class="coll-filters-bar coll-filters-secondary">
                    <select class="coll-select" id="coll-card-subtype">
                        <option value="all">All Types</option>
                        <option value="kindling">Kindling</option>
                        <option value="basic">Basic</option>
                        <option value="mythical">Mythical</option>
                        <option value="burst">Bursts</option>
                        <option value="trap">Traps</option>
                        <option value="aura">Auras</option>
                        <option value="pyre">Pyres</option>
                    </select>
                    <select class="coll-select" id="coll-card-element">
                        <option value="all">All Elements</option>
                        <option value="blood">\u{1F534} Blood</option>
                        <option value="void">\u{1F7E3} Void</option>
                        <option value="nature">\u{1F7E2} Nature</option>
                        <option value="water">\u{1F535} Water</option>
                        <option value="steel">\u26AA Steel</option>
                    </select>
                    <select class="coll-select" id="coll-card-owned">
                        <option value="all">All Cards</option>
                        <option value="owned">Owned</option>
                        <option value="unowned">Missing</option>
                    </select>
                </div>
                
                <div class="coll-cards-grid" id="coll-cards-grid"></div>
            </div>
            
            <!-- CARD DETAIL MODAL is now created separately -->
        `,document.body.appendChild(e);let t=document.createElement("div");t.className="coll-detail-modal",t.id="coll-detail-modal",t.innerHTML=`
            <div class="coll-detail-backdrop"></div>
            <div class="coll-detail-content" id="coll-detail-content"></div>
        `,document.body.appendChild(t)},bindEvents(){document.getElementById("coll-back-home").onclick=()=>this.close(),document.getElementById("coll-back-sets").onclick=()=>this.showSetsScreen(),document.getElementById("coll-set-search").oninput=e=>{this.filters.search=e.target.value.toLowerCase(),this.renderSets()},document.getElementById("coll-set-type").onchange=e=>{this.filters.setType=e.target.value,this.renderSets()},document.getElementById("coll-set-sort").onchange=e=>{this.filters.sort=e.target.value,this.renderSets()},document.getElementById("coll-card-search").oninput=e=>{this.filters.search=e.target.value.toLowerCase(),this.renderCards()},document.querySelectorAll("#coll-cards-screen .coll-filter-btn").forEach(e=>{e.onclick=()=>{document.querySelectorAll("#coll-cards-screen .coll-filter-btn").forEach(t=>t.classList.remove("active")),e.classList.add("active"),this.filters.category=e.dataset.category,this.renderCards()}}),document.getElementById("coll-card-subtype").onchange=e=>{this.filters.subtype=e.target.value,this.renderCards()},document.getElementById("coll-card-element").onchange=e=>{this.filters.element=e.target.value,this.renderCards()},document.getElementById("coll-card-owned").onchange=e=>{this.filters.owned=e.target.value,this.renderCards()},document.querySelector(".coll-detail-backdrop").onclick=()=>this.closeDetail(),document.getElementById("coll-detail-modal").onclick=e=>{e.target.id==="coll-detail-modal"&&this.closeDetail()},document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(document.getElementById("coll-detail-modal").classList.contains("open")){this.closeDetail();return}this.isOpen&&(this.mode==="cards"?this.showSetsScreen():this.close())}})},open(){this.isOpen=!0,document.getElementById("collection-overlay").classList.add("open"),this.showSetsScreen()},close(){this.isOpen=!1,document.getElementById("collection-overlay").classList.remove("open"),typeof HomeScreen<"u"&&HomeScreen.open()},showSetsScreen(){this.mode="sets",this.currentSet=null,this.filters.search="",document.getElementById("coll-set-search").value="",document.getElementById("coll-sets-screen").classList.add("active"),document.getElementById("coll-cards-screen").classList.remove("active"),this.updateGlobalStats(),this.renderSets()},showCardsScreen(e){let t=this.sets[e];t&&(this.mode="cards",this.currentSet=t,this.filters.search="",this.filters.category="all",this.filters.subtype="all",this.filters.element="all",this.filters.owned="all",document.getElementById("coll-card-search").value="",document.querySelectorAll("#coll-cards-screen .coll-filter-btn").forEach(a=>a.classList.remove("active")),document.querySelector('#coll-cards-screen .coll-filter-btn[data-category="all"]').classList.add("active"),document.getElementById("coll-card-subtype").value="all",document.getElementById("coll-card-element").value="all",document.getElementById("coll-card-owned").value="all",document.getElementById("coll-set-title").textContent=t.name,document.getElementById("coll-sets-screen").classList.remove("active"),document.getElementById("coll-cards-screen").classList.add("active"),this.updateSetProgress(),this.renderCards())},updateGlobalStats(){let e=0,t=0,a=0;Object.values(this.sets).forEach(n=>{n.cards.forEach(r=>{a++;let i=PlayerData.getOwnedCount(r.key);i>0&&(t++,e+=i)})}),document.getElementById("coll-total-cards").textContent=e,document.getElementById("coll-unique-cards").textContent=`${t}/${a}`,document.getElementById("coll-completion").textContent=a>0?Math.round(t/a*100)+"%":"0%"},updateSetProgress(){if(!this.currentSet)return;let e=0,t=this.currentSet.cards.length;this.currentSet.cards.forEach(a=>{PlayerData.getOwnedCount(a.key)>0&&e++}),document.getElementById("coll-set-progress").textContent=`${e}/${t}`},renderSets(){let e=document.getElementById("coll-sets-grid"),t=Object.values(this.sets);if(this.filters.setType!=="all"&&(t=t.filter(n=>n.type===this.filters.setType)),this.filters.search&&(t=t.filter(n=>n.name.toLowerCase().includes(this.filters.search))),this.filters.sort==="alpha"?t.sort((n,r)=>n.name.localeCompare(r.name)):this.filters.sort==="alphaReverse"?t.sort((n,r)=>r.name.localeCompare(n.name)):this.filters.sort==="newest"?t.sort((n,r)=>r.released-n.released):this.filters.sort==="oldest"&&t.sort((n,r)=>n.released-r.released),t.length===0){e.innerHTML='<div class="coll-empty">No sets found</div>';return}let a="";t.forEach(n=>{let{owned:r,total:i}=this.getSetProgress(n),o=i>0?Math.round(r/i*100):0,s=r===i;a+=`
                <div class="coll-set-card ${s?"complete":""}" onclick="Collection.showCardsScreen('${n.id}')">
                    <div class="coll-set-icon">${n.icon}</div>
                    <div class="coll-set-info">
                        <div class="coll-set-name">${n.name}</div>
                        <div class="coll-set-type">${n.type==="deck"?"\u{1F4DA} Full Deck":"\u{1F4E6} Expansion"}</div>
                        <div class="coll-set-desc">${n.description||""}</div>
                    </div>
                    <div class="coll-set-progress-wrap">
                        <div class="coll-set-progress-bar">
                            <div class="coll-set-progress-fill" style="width: ${o}%"></div>
                        </div>
                        <div class="coll-set-progress-text">
                            ${s?'<span class="coll-set-complete-badge">\u2713 Complete</span>':`${r}/${i} cards`}
                        </div>
                    </div>
                </div>
            `}),e.innerHTML=a},getSetProgress(e){let t=0;return e.cards.forEach(a=>{PlayerData.getOwnedCount(a.key)>0&&t++}),{owned:t,total:e.cards.length}},renderCards(){if(!this.currentSet)return;let e=document.getElementById("coll-cards-grid"),t=this.currentSet.cards.map(n=>this.getCard(n.key)).filter(Boolean);if(t=this.filterCards(t),t.sort((n,r)=>n.cost-r.cost||n.name.localeCompare(r.name)),t.length===0){e.innerHTML='<div class="coll-empty">No cards match filters</div>';return}let a="";t.forEach(n=>{let r=PlayerData.getOwnedCount(n.key);a+=this.renderCardHTML(n,r)}),e.innerHTML=a},filterCards(e){return e.filter(t=>{let{category:a,subtype:n,element:r,owned:i,search:o}=this.filters;if(a==="cryptid"&&t.type!=="cryptid"||a==="spell"&&t.type==="cryptid"||n!=="all"&&(n==="kindling"&&!t.isKindling||n==="basic"&&(t.isKindling||t.mythical||t.type!=="cryptid")||n==="mythical"&&!t.mythical||["burst","trap","aura","pyre"].includes(n)&&t.type!==n)||r!=="all"&&t.element!==r)return!1;let s=PlayerData.getOwnedCount(t.key);return!(i==="owned"&&s===0||i==="unowned"&&s>0||o&&!t.name.toLowerCase().includes(o))})},renderCardHTML(e,t){let a=e.type==="cryptid",n=a?"cryptid-card":"spell-card",r=e.element?`element-${e.element}`:"",i=this.getTypeClass(e),o=t===0?"unowned":"",s=e.mythical?"mythical":"",l=e.foil?"foil":"",c=e.rarity||"common",m="";a?m=`
                <span class="gc-stat atk">${e.atk}</span>
                <span class="gc-stat hp">${e.hp}</span>
            `:m=`<span class="gc-stat-type">${{burst:"Burst",trap:"Trap",aura:"Aura",pyre:"Pyre"}[e.type]||"Spell"}</span>`;let f=`<span class="gc-rarity ${c}"></span>`,h=`<span class="gc-owned ${t>0?"have":"none"}">${t>0?`\xD7${t}`:"\u2717"}</span>`;return`
            <div class="game-card coll-card ${n} ${r} ${i} ${c} ${o} ${s} ${l}"
                 onclick="Collection.showDetail('${e.key}')">
                <span class="gc-cost">${e.cost}</span>
                <div class="gc-header"><span class="gc-name">${e.name}</span></div>
                <div class="gc-art">${Collection.renderSprite(e.sprite)}</div>
                <div class="gc-stats">${m}</div>
                ${f}
                ${h}
            </div>
        `},getTypeClass(e){return e.isKindling?"kindling-card":e.type==="trap"?"trap-card":e.type==="aura"?"aura-card":e.type==="pyre"?"pyre-card":e.type==="burst"?"burst-card":""},getCard(e){if(typeof CardRegistry>"u")return null;let t=CardRegistry.getCryptid(e);if(t)return{...t,key:e,type:"cryptid"};let a=CardRegistry.getKindling(e);if(a)return{...a,key:e,type:"cryptid",isKindling:!0};let n=CardRegistry.getBurst(e);if(n)return{...n,key:e,type:"burst"};let r=CardRegistry.getTrap(e);if(r)return{...r,key:e,type:"trap"};let i=CardRegistry.getAura(e);if(i)return{...i,key:e,type:"aura"};let o=CardRegistry.getPyre(e);return o?{...o,key:e,type:"pyre",cost:0}:null},showDetail(e){let t=this.getCard(e);if(!t)return;let a=PlayerData.getOwnedCount(e),n=t.type==="cryptid",r=t.element?`element-${t.element}`:"",i=this.getTypeClass(t),o={void:"Void",blood:"Blood",water:"Water",steel:"Steel",nature:"Nature"},l={burst:"Burst Spell",trap:"Trap",aura:"Aura",pyre:"Pyre",cryptid:"Cryptid"}[t.type]||"Card";t.isKindling&&(l="Kindling"),t.mythical&&(l="Mythical Cryptid"),t.element&&(l=`${o[t.element]} ${l}`);let c=t.rarity||"common",m=c==="common"?1:c==="uncommon"?2:c==="rare"?3:4,f=n?`
            <div class="detail-rarity ${c}">
                ${'<span class="rarity-gem"></span>'.repeat(m)}
            </div>
        `:"",h=document.getElementById("coll-detail-content");h.innerHTML=`
            <div class="coll-detail-card ${r} ${i}">
                <div class="coll-detail-card-inner">
                    <div class="detail-header">
                        <span class="detail-name">${t.name}</span>
                        <span class="detail-cost">${t.cost}</span>
                    </div>
                    <div class="detail-art-container">
                        <span class="detail-sprite">${Collection.renderSprite(t.sprite)}</span>
                        ${t.element?`<span class="detail-element-badge ${t.element}">${o[t.element]}</span>`:""}
                    </div>
                    <div class="detail-text-box">
                        <div class="detail-type">${l}</div>
                        ${n?`
                            <div class="detail-stats-row">
                                <span class="detail-stat atk">\u2694 ${t.atk}</span>
                                <span class="detail-stat hp">\u2665 ${t.hp}</span>
                            </div>
                        `:""}
                        <div class="detail-abilities">
                            ${t.combatAbility?`<div class="detail-ability"><strong>Combat:</strong> ${t.combatAbility}</div>`:""}
                            ${t.supportAbility?`<div class="detail-ability"><strong>Support:</strong> ${t.supportAbility}</div>`:""}
                            ${t.description?`<div class="detail-ability">${t.description}</div>`:""}
                            ${t.pyreEffect?`<div class="detail-ability"><strong>Pyre:</strong> ${t.pyreEffect}</div>`:""}
                        </div>
                    </div>
                    <div class="detail-footer">
                        ${f}
                        <div class="detail-owned ${a>0?"have":"none"}">
                            ${a>0?`Owned: \xD7${a}`:"Not Owned"}
                        </div>
                    </div>
                </div>
            </div>
            <button class="detail-close-btn" onclick="Collection.closeDetail()">Close</button>
        `,document.getElementById("coll-detail-modal").classList.add("open")},closeDetail(){document.getElementById("coll-detail-modal").classList.remove("open")}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>Collection.init()):Collection.init()});var ft=M(()=>{"use strict";window.Shop={isOpen:!1,openingPack:!1,currentTab:"boosters",packsToOpen:[],currentCards:[],quantities:{},boosters:{standard:{id:"standard",name:"Standard Pack",description:"5 cards with guaranteed rare or better",price:100,cardCount:5,guaranteed:{rarity:"rare",count:1},icon:"\u{1F4E6}",glowColor:"rgba(200, 200, 210, 0.3)"},premium:{id:"premium",name:"Premium Pack",description:"5 cards with guaranteed ultimate",price:300,cardCount:5,guaranteed:{rarity:"ultimate",count:1},icon:"\u{1F381}",glowColor:"rgba(155, 89, 182, 0.3)"},elemental:{id:"elemental",name:"Elemental Pack",description:"5 element-focused cards",price:150,cardCount:5,guaranteed:{rarity:"rare",count:1},icon:"\u{1F308}",glowColor:"rgba(100, 180, 130, 0.3)"},mega:{id:"mega",name:"Mega Pack",description:"10 cards, 2 ultimates + holo chance",price:750,cardCount:10,guaranteed:{rarity:"ultimate",count:2},holoChance:.15,icon:"\u{1F48E}",glowColor:"rgba(231, 76, 60, 0.3)"}},prebuiltDecks:{voidDominion:{id:"voidDominion",name:"Void Dominion",description:"Control the battlefield with Void creatures and debuffs",emberPrice:500,soulPrice:75,icon:"\u{1F7E3}",element:"void",cardCount:55,featured:["voidWraith","shadowCat","shadowLeech"]},bloodFury:{id:"bloodFury",name:"Blood Fury",description:"Aggressive Blood deck focused on fast damage",emberPrice:500,soulPrice:75,icon:"\u{1F534}",element:"blood",cardCount:55,featured:["vampireInitiate","fireImp","emberFox"]},naturesResilience:{id:"naturesResilience",name:"Nature's Resilience",description:"Outlast opponents with healing and tough creatures",emberPrice:500,soulPrice:75,icon:"\u{1F7E2}",element:"nature",cardCount:55,featured:["mossTurtle","stoneGolem","libraryGargoyle"]}},cosmetics:{holoConverter:{id:"holoConverter",name:"Holographic Converter",description:"Convert any owned card to holographic",soulPrice:25,icon:"\u2728",type:"consumable"},cardBackSilver:{id:"cardBackSilver",name:"Silver Mist",description:"Elegant silver card back design",soulPrice:50,emberPrice:300,icon:"\u{1F0CF}",type:"cardback"},cardBackVoid:{id:"cardBackVoid",name:"Void Essence",description:"Swirling purple void energy",soulPrice:75,icon:"\u{1F0CF}",type:"cardback"},cardBackFlame:{id:"cardBackFlame",name:"Eternal Flame",description:"Burning crimson flames",soulPrice:75,icon:"\u{1F0CF}",type:"cardback"},fieldVolcano:{id:"fieldVolcano",name:"Volcanic Arena",description:"Battle on molten rock and fire",soulPrice:100,icon:"\u{1F30B}",type:"field"},fieldForest:{id:"fieldForest",name:"Ancient Forest",description:"Mystical woodland battleground",soulPrice:100,emberPrice:600,icon:"\u{1F332}",type:"field"},fieldCrystal:{id:"fieldCrystal",name:"Crystal Cavern",description:"Shimmering underground crystals",soulPrice:100,icon:"\u{1F48E}",type:"field"},slotGold:{id:"slotGold",name:"Golden Frame",description:"Gilded frame for your card slots",soulPrice:40,icon:"\u{1F5BC}\uFE0F",type:"slot"},slotShadow:{id:"slotShadow",name:"Shadow Frame",description:"Dark ethereal slot borders",soulPrice:40,emberPrice:250,icon:"\u{1F5BC}\uFE0F",type:"slot"},emoteVictory:{id:"emoteVictory",name:"Victory Dance",description:"Celebrate your wins in style",soulPrice:30,emberPrice:200,icon:"\u{1F483}",type:"emote"},emoteTaunt:{id:"emoteTaunt",name:"Confident Smirk",description:"Show your confidence",soulPrice:30,icon:"\u{1F60F}",type:"emote"}},rarityWeights:{common:60,rare:30,ultimate:10},init(){this.createHTML(),this.bindEvents(),Object.keys(this.boosters).forEach(e=>this.quantities[e]=1)},renderSprite(e){return e?e.startsWith("http")||e.startsWith("sprites/")?`<img src="${e}" class="sprite-img" alt="" draggable="false">`:e:"?"},createHTML(){let e=document.createElement("div");e.id="shop-overlay",e.innerHTML=`
            <div class="shop-screen">
                <!-- Header -->
                <div class="shop-topbar">
                    <button class="shop-back-btn" id="shop-back">\u2190 Back</button>
                    <h1 class="shop-title">Shop</h1>
                    <div class="shop-currency">
                        <div class="shop-currency-item embers" title="Earned by playing">
                            <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img currency-icon' alt=''>
                            <span class="currency-amount" id="shop-embers">0</span>
                        </div>
                        <div class="shop-currency-item souls" title="Premium currency">
                            <span class="currency-icon">\u{1F49C}</span>
                            <span class="currency-amount" id="shop-souls">0</span>
                        </div>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div class="shop-tabs">
                    <button class="shop-tab active" data-tab="boosters">
                        <span class="tab-icon">\u{1F4E6}</span>
                        <span class="tab-text">Boosters</span>
                    </button>
                    <button class="shop-tab" data-tab="decks">
                        <span class="tab-icon">\u{1F4DA}</span>
                        <span class="tab-text">Decks</span>
                    </button>
                    <button class="shop-tab" data-tab="cosmetics">
                        <span class="tab-icon">\u2728</span>
                        <span class="tab-text">Cosmetics</span>
                    </button>
                    <button class="shop-tab" data-tab="battlepass">
                        <span class="tab-icon">\u{1F396}\uFE0F</span>
                        <span class="tab-text">Pass</span>
                    </button>
                </div>
                
                <!-- Pending Packs Banner -->
                <div class="shop-pending" id="shop-pending">
                    <div class="pending-glow"></div>
                    <span class="pending-icon">\u{1F381}</span>
                    <span class="pending-text"><strong id="pending-count">0</strong> Pack<span id="pending-plural">s</span> Ready!</span>
                    <div class="pending-buttons">
                        <button class="pending-btn open-one" onclick="Shop.openPendingPacks()">
                            <span class="btn-icon">\u{1F4E6}</span>
                            <span class="btn-text">Open 1</span>
                        </button>
                        <button class="pending-btn open-all" onclick="Shop.openAllPendingPacks()">
                            <span class="btn-icon">\u2728</span>
                            <span class="btn-text" id="open-all-text">Open All</span>
                        </button>
                    </div>
                </div>
                
                <!-- Content Area -->
                <div class="shop-content" id="shop-content"></div>
            </div>
            
            <!-- Pack Opening Overlay -->
            <div class="pack-overlay" id="pack-overlay">
                <div class="pack-stage" id="pack-stage"></div>
                <div class="pack-summary" id="pack-summary">
                    <div class="summary-title">Pack Complete!</div>
                    <div class="summary-stats" id="summary-stats"></div>
                    <div class="summary-actions">
                        <button class="summary-btn secondary" onclick="Shop.closePackOpening()">Done</button>
                        <button class="summary-btn primary" id="open-another-btn" onclick="Shop.openAnotherPack()">Open Another</button>
                    </div>
                </div>
            </div>
        `,document.body.appendChild(e)},bindEvents(){document.getElementById("shop-back").onclick=()=>this.close(),document.querySelectorAll(".shop-tab").forEach(e=>{e.onclick=()=>{document.querySelectorAll(".shop-tab").forEach(t=>t.classList.remove("active")),e.classList.add("active"),this.currentTab=e.dataset.tab,this.renderContent()}}),document.addEventListener("keydown",e=>{e.key==="Escape"&&this.isOpen&&(this.openingPack?this.closePackOpening():this.close())})},open(){this.isOpen=!0,document.getElementById("shop-overlay").classList.add("open"),this.updateCurrency(),this.updatePendingBanner(),this.renderContent()},close(){this.isOpen=!1,document.getElementById("shop-overlay").classList.remove("open"),typeof HomeScreen<"u"&&HomeScreen.open()},getEmbers(){return typeof PlayerData<"u"&&PlayerData.embers||0},getSouls(){return typeof PlayerData<"u"&&PlayerData.souls||0},updateCurrency(){let e=document.getElementById("shop-embers"),t=document.getElementById("shop-souls");e&&(e.textContent=this.getEmbers().toLocaleString()),t&&(t.textContent=this.getSouls().toLocaleString())},updatePendingBanner(){let e=document.getElementById("shop-pending"),t=document.getElementById("pending-count"),a=document.getElementById("pending-plural"),n=document.getElementById("open-all-text"),r=e?.querySelector(".open-all"),i=e?.querySelector(".open-one");if(!e||!t)return;let o=typeof PlayerData<"u"&&PlayerData.pendingPacks?PlayerData.pendingPacks.length:0;o>0?(e.classList.add("show"),t.textContent=o,a&&(a.textContent=o===1?"":"s"),i&&(i.style.display="flex"),r&&n&&(o===1?r.style.display="none":(r.style.display="flex",o<=10?n.textContent=`Open All (${o})`:n.textContent="Open 10"))):e.classList.remove("show")},renderContent(){let e=document.getElementById("shop-content");if(e)switch(this.currentTab){case"boosters":this.renderBoosters(e);break;case"decks":this.renderDecks(e);break;case"cosmetics":this.renderCosmetics(e);break;case"battlepass":this.renderBattlePass(e);break}},renderBoosters(e){let t=this.getEmbers(),a=`
            <div class="shop-section-header">
                <h2 class="section-title">Card Packs</h2>
                <p class="section-note">\u{1F525} <strong>Embers only</strong> \u2014 earned by playing, never purchased!</p>
            </div>
            <div class="booster-grid">
        `;Object.values(this.boosters).forEach(n=>{let r=this.quantities[n.id]||1,i=n.price*r,o=t>=i;a+=`
                <div class="booster-card ${o?"":"unaffordable"}" style="--glow-color: ${n.glowColor}">
                    <div class="booster-icon">${n.icon}</div>
                    <div class="booster-name">${n.name}</div>
                    <div class="booster-desc">${n.description}</div>
                    <div class="booster-cards">${n.cardCount} cards</div>
                    
                    <div class="booster-qty">
                        <button class="qty-btn" onclick="Shop.adjustQty('${n.id}', -1)">\u2212</button>
                        <span class="qty-value">${r}</span>
                        <button class="qty-btn" onclick="Shop.adjustQty('${n.id}', 1)">+</button>
                    </div>
                    
                    <button class="price-btn embers full-width ${o?"affordable":""}" 
                            onclick="Shop.buyPack('${n.id}')" ${o?"":"disabled"}>
                        <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img price-icon' alt=''>
                        <span class="price-amount">${i.toLocaleString()}</span>
                    </button>
                </div>
            `}),a+="</div>",e.innerHTML=a},renderDecks(e){let t=this.getEmbers(),a=this.getSouls(),n=`
            <div class="shop-section-header">
                <h2 class="section-title">Prebuilt Decks</h2>
                <p class="section-note">Ready-to-play 55-card decks \u2014 <strong>no randomness!</strong></p>
            </div>
            <div class="decks-grid">
        `;Object.values(this.prebuiltDecks).forEach(r=>{let i=this.ownsDeck(r.id),o=t>=r.emberPrice,s=a>=r.soulPrice;n+=`
                <div class="deck-card ${i?"owned":""}">
                    <div class="deck-header">
                        <span class="deck-icon">${r.icon}</span>
                        <span class="deck-name">${r.name}</span>
                    </div>
                    <div class="deck-desc">${r.description}</div>
                    <div class="deck-meta">
                        <span>${r.cardCount} cards</span>
                        <span class="deck-element">${r.element}</span>
                    </div>
                    <div class="deck-preview">
                        ${r.featured.map(l=>{let c=this.getCardByKey(l);return`<span class="preview-sprite" title="${c?.name||l}">${Shop.renderSprite(c?.sprite)}</span>`}).join("")}
                    </div>
                    ${i?`
                        <div class="owned-badge">\u2713 Owned</div>
                    `:`
                        <div class="deck-prices">
                            <button class="price-btn embers ${o?"affordable":""}"
                                    onclick="Shop.buyDeck('${r.id}', 'embers')" ${o?"":"disabled"}>
                                <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img price-icon' alt=''>
                                <span class="price-amount">${r.emberPrice}</span>
                            </button>
                            <button class="price-btn souls ${s?"affordable":""}"
                                    onclick="Shop.buyDeck('${r.id}', 'souls')" ${s?"":"disabled"}>
                                <span class="price-icon">\u{1F49C}</span>
                                <span class="price-amount">${r.soulPrice}</span>
                            </button>
                        </div>
                    `}
                </div>
            `}),n+="</div>",e.innerHTML=n},renderCosmetics(e){let t=this.getEmbers(),a=this.getSouls(),n={};Object.values(this.cosmetics).forEach(o=>{n[o.type]||(n[o.type]=[]),n[o.type].push(o)});let r={consumable:"\u{1F9EA} Consumables",cardback:"\u{1F0CF} Card Backs",field:"\u{1F3DF}\uFE0F Battle Fields",slot:"\u{1F5BC}\uFE0F Slot Frames",emote:"\u{1F4AC} Emotes"},i=`
            <div class="shop-section-header">
                <h2 class="section-title">Cosmetics</h2>
                <p class="section-note">\u{1F49C} Souls primary \u2022 Some available for \u{1F525} Embers</p>
            </div>
        `;Object.entries(n).forEach(([o,s])=>{i+=`
                <div class="cosmetic-section">
                    <h3 class="cosmetic-type-title">${r[o]||o}</h3>
                    <div class="cosmetics-grid">
            `,s.forEach(l=>{let c=this.ownsCosmetic(l.id),m=l.soulPrice&&a>=l.soulPrice,f=l.emberPrice&&t>=l.emberPrice;i+=`
                    <div class="cosmetic-card ${c?"owned":""}">
                        <div class="cosmetic-icon">${l.icon}</div>
                        <div class="cosmetic-name">${l.name}</div>
                        <div class="cosmetic-desc">${l.description}</div>
                        ${c?`
                            <div class="owned-badge small">\u2713 Owned</div>
                        `:`
                            <div class="cosmetic-prices">
                                ${l.soulPrice?`
                                    <button class="price-btn souls small ${m?"affordable":""}"
                                            onclick="Shop.buyCosmetic('${l.id}', 'souls')" ${m?"":"disabled"}>
                                        <span class="price-icon">\u{1F49C}</span>
                                        <span class="price-amount">${l.soulPrice}</span>
                                    </button>
                                `:""}
                                ${l.emberPrice?`
                                    <button class="price-btn embers small ${f?"affordable":""}"
                                            onclick="Shop.buyCosmetic('${l.id}', 'embers')" ${f?"":"disabled"}>
                                        <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img price-icon' alt=''>
                                        <span class="price-amount">${l.emberPrice}</span>
                                    </button>
                                `:""}
                            </div>
                        `}
                    </div>
                `}),i+="</div></div>"}),e.innerHTML=i},renderBattlePass(e){let t=typeof PlayerData<"u"&&PlayerData.hasPremiumPass||!1,a=typeof PlayerData<"u"&&PlayerData.battlePassTier||0,n=typeof PlayerData<"u"&&PlayerData.battlePassXP||0,r=1e3,i=50,o=[{tier:1,free:"50 \u{1F525}",premium:"Card Back: Starter"},{tier:5,free:"Standard Pack",premium:"100 \u{1F525}"},{tier:10,free:"100 \u{1F525}",premium:"Premium Pack"},{tier:15,free:"Standard Pack",premium:"Emote: Wave"},{tier:20,free:"150 \u{1F525}",premium:"Field: Crystal Cave"},{tier:25,free:"Standard Pack",premium:"300 \u{1F525}"},{tier:30,free:"200 \u{1F525}",premium:"Premium Pack"},{tier:35,free:"Elemental Pack",premium:"Card Back: Flame"},{tier:40,free:"250 \u{1F525}",premium:"Mega Pack"},{tier:50,free:"500 \u{1F525}",premium:"\u2727 Exclusive Holo Card"}],s=`
            <div class="bp-header">
                <div class="bp-season">
                    <span class="bp-icon">\u{1F396}\uFE0F</span>
                    <div class="bp-season-info">
                        <span class="bp-season-name">Season 1: Origins</span>
                        <span class="bp-season-ends">Ends in 45 days</span>
                    </div>
                </div>
                <div class="bp-progress-section">
                    <div class="bp-tier-display">Tier ${a}/${i}</div>
                    <div class="bp-xp-bar">
                        <div class="bp-xp-fill" style="width: ${n%r/r*100}%"></div>
                    </div>
                    <div class="bp-xp-text">${n%r}/${r} XP to next tier</div>
                </div>
                ${t?`
                    <div class="bp-premium-active">\u2727 Premium Active</div>
                `:`
                    <button class="bp-upgrade-btn" onclick="Shop.upgradeBattlePass()">
                        Upgrade to Premium
                        <span class="bp-price">\u{1F49C} 500</span>
                    </button>
                `}
            </div>
            
            <div class="bp-explainer">
                <div class="bp-explainer-title">How It Works</div>
                <div class="bp-explainer-points">
                    <p>\u{1F3AE} <strong>Play matches</strong> and complete challenges to earn XP</p>
                    <p>\u{1F513} <strong>Unlock rewards</strong> at each tier \u2014 free track for everyone!</p>
                    <p>\u2728 <strong>Premium track</strong> adds exclusive cosmetics + bonus Embers</p>
                </div>
                <div class="bp-ethics-note">
                    \u{1F4A1} All card packs are <strong>earned through gameplay</strong> \u2014 never purchased directly with real money.
                </div>
            </div>
            
            <div class="bp-rewards">
                <div class="bp-track-header">
                    <span class="bp-track-label">Tier</span>
                    <span class="bp-track-label free">Free Track</span>
                    <span class="bp-track-label premium">Premium Track</span>
                </div>
                <div class="bp-track-list">
        `;o.forEach(l=>{let c=a>=l.tier,m=c&&t;s+=`
                <div class="bp-tier-row ${c?"unlocked":""}">
                    <div class="bp-tier-num">${l.tier}</div>
                    <div class="bp-reward free ${c?"claimed":""}">${l.free}</div>
                    <div class="bp-reward premium ${m?"claimed":""} ${!t&&!c?"locked":""}">${l.premium}</div>
                </div>
            `}),s+="</div></div>",e.innerHTML=s},adjustQty(e,t){let a=this.quantities[e]||1;this.quantities[e]=Math.max(1,Math.min(10,a+t)),this.renderContent()},buyPack(e){if(typeof PlayerData>"u")return;let t=this.boosters[e];if(!t)return;let a=this.quantities[e]||1,n=t.price*a;if(!(this.getEmbers()<n)){PlayerData.embers-=n,PlayerData.pendingPacks||(PlayerData.pendingPacks=[]);for(let r=0;r<a;r++)PlayerData.pendingPacks.push(e);PlayerData.save(),this.showPurchaseConfirmation(t,a,n),this.updateCurrency(),this.updatePendingBanner(),this.renderContent()}},showPurchaseConfirmation(e,t,a){let n=document.createElement("div");n.className="purchase-confirmation",n.innerHTML=`
            <div class="purchase-content">
                <div class="purchase-icon">${e.icon}</div>
                <div class="purchase-burst"></div>
                <div class="purchase-title">Pack${t>1?"s":""} Acquired!</div>
                <div class="purchase-details">
                    <span class="purchase-qty">\xD7${t}</span>
                    <span class="purchase-name">${e.name}</span>
                </div>
                <div class="purchase-cost">
                    <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img cost-icon' alt=''>
                    <span class="cost-amount">-${a}</span>
                </div>
                <div class="purchase-hint">Ready to open in your inventory!</div>
            </div>
        `,document.body.appendChild(n),requestAnimationFrame(()=>{n.classList.add("show")}),setTimeout(()=>{n.classList.add("hiding"),setTimeout(()=>n.remove(),400)},2e3),n.onclick=()=>{n.classList.add("hiding"),setTimeout(()=>n.remove(),400)}},buyDeck(e,t){if(typeof PlayerData>"u")return;let a=this.prebuiltDecks[e];if(!a||this.ownsDeck(e))return;let n=t==="souls"?a.soulPrice:a.emberPrice;(t==="souls"?this.getSouls():this.getEmbers())<n||(t==="souls"?PlayerData.souls-=n:PlayerData.embers-=n,PlayerData.ownedDecks||(PlayerData.ownedDecks=[]),PlayerData.ownedDecks.push(e),PlayerData.save(),this.updateCurrency(),this.renderContent())},buyCosmetic(e,t){if(typeof PlayerData>"u")return;let a=this.cosmetics[e];if(!a||this.ownsCosmetic(e))return;let n=t==="souls"?a.soulPrice:a.emberPrice;!n||(t==="souls"?this.getSouls():this.getEmbers())<n||(t==="souls"?PlayerData.souls-=n:PlayerData.embers-=n,PlayerData.ownedCosmetics||(PlayerData.ownedCosmetics=[]),PlayerData.ownedCosmetics.push(e),PlayerData.save(),this.updateCurrency(),this.renderContent())},upgradeBattlePass(){if(typeof PlayerData>"u")return;let e=500;if(this.getSouls()<e){alert("Not enough Souls!");return}PlayerData.souls-=e,PlayerData.hasPremiumPass=!0,PlayerData.save(),this.updateCurrency(),this.renderContent()},ownsDeck(e){return(typeof PlayerData<"u"&&PlayerData.ownedDecks||[]).includes(e)},ownsCosmetic(e){return(typeof PlayerData<"u"&&PlayerData.ownedCosmetics||[]).includes(e)},getCardByKey(e){return typeof CardRegistry>"u"?null:CardRegistry.getCryptid(e)||CardRegistry.getKindling(e)||CardRegistry.getBurst(e)||CardRegistry.getTrap(e)||CardRegistry.getAura(e)||CardRegistry.getPyre(e)},showCardDetail(e){let t=null,a=null;if(typeof CardRegistry<"u"){let A=CardRegistry.getCryptid(e);if(A&&(t={...A,key:e},a="cryptid"),!t){let T=CardRegistry.getKindling(e);T&&(t={...T,key:e,isKindling:!0},a="cryptid")}if(!t){let T=CardRegistry.getBurst(e);T&&(t={...T,key:e},a="burst")}if(!t){let T=CardRegistry.getTrap(e);T&&(t={...T,key:e},a="trap")}if(!t){let T=CardRegistry.getAura(e);T&&(t={...T,key:e},a="aura")}if(!t){let T=CardRegistry.getPyre(e);T&&(t={...T,key:e,cost:0},a="pyre")}}if(!t)return;t.type=a;let n=a==="cryptid",r=t.element?`element-${t.element}`:"",i=t.isKindling?"kindling-card":a==="trap"?"trap-card":a==="aura"?"aura-card":a==="pyre"?"pyre-card":a==="burst"?"burst-card":"",o={void:"Void",blood:"Blood",water:"Water",steel:"Steel",nature:"Nature"},l={burst:"Burst Spell",trap:"Trap",aura:"Aura",pyre:"Pyre",cryptid:"Cryptid"}[a]||"Card";t.isKindling&&(l="Kindling"),t.mythical&&(l="Mythical Cryptid"),t.element&&(l=`${o[t.element]} ${l}`);let c=t.rarity||"common",m=c==="common"?1:c==="uncommon"?2:c==="rare"?3:4,f=n?`
            <div class="detail-rarity ${c}">
                ${'<span class="rarity-gem"></span>'.repeat(m)}
            </div>
        `:"",h=t.sprite?t.sprite.startsWith("http")||t.sprite.startsWith("sprites/")?`<img src="${t.sprite}" class="sprite-img" alt="" draggable="false">`:t.sprite:"?",u=typeof PlayerData<"u"?PlayerData.getOwnedCount(e):0,b=document.getElementById("shop-card-detail-modal");b&&b.remove();let x=document.createElement("div");x.id="shop-card-detail-modal",x.className="shop-card-detail-modal",x.innerHTML=`
            <div class="shop-detail-backdrop"></div>
            <div class="shop-detail-content">
                <div class="coll-detail-card ${r} ${i}">
                    <div class="coll-detail-card-inner">
                        <div class="detail-header">
                            <span class="detail-name">${t.name}</span>
                            <span class="detail-cost">${t.cost}</span>
                        </div>
                        <div class="detail-art-container">
                            <span class="detail-sprite">${h}</span>
                            ${t.element?`<span class="detail-element-badge ${t.element}">${o[t.element]}</span>`:""}
                        </div>
                        <div class="detail-text-box">
                            <div class="detail-type">${l}</div>
                            ${n?`
                                <div class="detail-stats-row">
                                    <span class="detail-stat atk">\u2694 ${t.atk}</span>
                                    <span class="detail-stat hp">\u2665 ${t.hp}</span>
                                </div>
                            `:""}
                            <div class="detail-abilities">
                                ${t.combatAbility?`<div class="detail-ability"><strong>Combat:</strong> ${t.combatAbility}</div>`:""}
                                ${t.supportAbility?`<div class="detail-ability"><strong>Support:</strong> ${t.supportAbility}</div>`:""}
                                ${t.description?`<div class="detail-ability">${t.description}</div>`:""}
                                ${t.pyreEffect?`<div class="detail-ability"><strong>Pyre:</strong> ${t.pyreEffect}</div>`:""}
                            </div>
                        </div>
                        <div class="detail-footer">
                            ${f}
                            <div class="detail-owned ${u>0?"have":"none"}">
                                ${u>0?`Owned: \xD7${u}`:"Not Owned"}
                            </div>
                        </div>
                    </div>
                </div>
                <button class="shop-detail-close" onclick="Shop.closeCardDetail()">\u2715</button>
            </div>
        `,document.body.appendChild(x),requestAnimationFrame(()=>{x.classList.add("open")}),x.querySelector(".shop-detail-backdrop").onclick=()=>this.closeCardDetail()},closeCardDetail(){let e=document.getElementById("shop-card-detail-modal");e&&(e.classList.remove("open"),setTimeout(()=>e.remove(),300))},skipAnimations:!1,flipTimeouts:[],allRevealedCards:[],startPackOpening(){if(!this.packsToOpen.length)return;this.openingPack=!0,this.skipAnimations=!1,this.allRevealedCards=[];let e=Math.min(this.packsToOpen.length,10),t=this.packsToOpen.splice(0,e);t.forEach(r=>{let i=this.boosters[r];if(i){let o=this.generatePackCards(i);o.forEach(s=>s.boosterId=r),this.allRevealedCards.push(...o)}});let a=document.getElementById("pack-stage"),n=this.boosters[t[0]];a.innerHTML=`
            <div class="pack-epic-intro">
                <div class="pack-burst"></div>
                <div class="pack-glow-ring"></div>
                <div class="packs-stack">
                    <div class="pack-unopened" style="--glow-color: ${n.glowColor}">
                        <span class="pack-emoji">${n.icon}</span>
                    </div>
                </div>
                ${e>1?`<div class="pack-count-badge">\xD7${e}</div>`:""}
                <div class="pack-hint">Tap anywhere to open</div>
            </div>
        `,document.getElementById("pack-summary").classList.remove("show"),document.getElementById("pack-overlay").classList.add("active"),document.getElementById("open-another-btn").style.display="none",a.onclick=()=>this.openPackBurst()},openPackBurst(){let e=document.getElementById("pack-stage"),t=e.querySelector(".pack-epic-intro");!t||t.classList.contains("opening")||(t.classList.add("opening"),e.onclick=null,setTimeout(()=>this.revealCards(),1200))},revealCards(){let e=document.getElementById("pack-stage");this.revealComplete=!1,this.skipAnimations=!1,this.flipTimeouts=[];let t={void:"\u25C8",blood:"\u25C9",water:"\u25CE",steel:"\u2B21",nature:"\u2756"},a=`
            <div class="cards-reveal-epic" id="cards-reveal-container">
                <div class="reveal-header-epic">
                    <span class="reveal-count">${this.allRevealedCards.length} Cards</span>
                    <span class="reveal-skip-hint" id="reveal-skip-hint">Tap anywhere to skip</span>
                </div>
                <div class="cards-grid-reveal" id="cards-grid-reveal">
        `;this.allRevealedCards.forEach((o,s)=>{let l=typeof PlayerData<"u"&&!PlayerData.ownsCard(o.key),c=o.type==="cryptid"||o.atk!==void 0,m=c?"cryptid-card":"spell-card",f=o.element?`element-${o.element}`:"",h=this.getCardTypeClass(o),u=o.cost!==void 0?o.cost:0,b=o.rarity||"common",x=o.isHolo?"foil":"",A=o.mythical?"mythical":"",T="";c?T=`
                    <span class="gc-stat atk">${o.atk}</span>
                    <span class="gc-stat hp">${o.hp}</span>
                `:T=`<span class="gc-stat-type">${{burst:"Burst",trap:"Trap",aura:"Aura",pyre:"Pyre",kindling:"Kindling"}[o.type]||"Spell"}</span>`;let I=`<span class="gc-rarity ${b}"></span>`,S=l?'<span class="gc-new">NEW</span>':"",C=typeof Collection<"u"&&Collection.renderSprite?Collection.renderSprite(o.sprite):this.renderSprite(o.sprite);a+=`
                <div class="game-card reveal-card ${m} ${b} ${f} ${h} ${A} ${x}" 
                     data-index="${s}" data-key="${o.key}" data-holo="${o.isHolo?"1":"0"}"
                     style="--delay: ${s*.08}s">
                    <span class="gc-cost">${u}</span>
                    <div class="gc-header"><span class="gc-name">${o.name}</span></div>
                    <div class="gc-art">${C}</div>
                    <div class="gc-stats">${T}</div>
                    ${I}
                    ${S}
                </div>
            `}),a+=`
                </div>
            </div>
        `,e.innerHTML=a,document.querySelectorAll(".game-card.reveal-card").forEach(o=>{o.addEventListener("click",s=>{s.stopPropagation(),o.classList.contains("revealed")&&Shop.showCardDetail(o.dataset.key)}),o.addEventListener("contextmenu",s=>{s.preventDefault(),o.classList.contains("revealed")&&Shop.showCardDetail(o.dataset.key)})}),document.getElementById("cards-reveal-container").addEventListener("click",o=>{o.target.closest(".game-card")||!this.revealComplete&&!this.skipAnimations&&(this.skipAnimations=!0,this.finishAllReveals())}),this.allRevealedCards.forEach((o,s)=>{let l=setTimeout(()=>{if(this.skipAnimations)return;let c=document.querySelector(`.reveal-card[data-index="${s}"]`);c&&(c.classList.add("revealed"),typeof PlayerData<"u"&&PlayerData.addToCollection(o.key,1,null,o.isHolo))},300+s*100);this.flipTimeouts.push(l)});let r=300+this.allRevealedCards.length*100+500,i=setTimeout(()=>{this.skipAnimations||this.showPackSummary()},r);this.flipTimeouts.push(i)},finishAllReveals(){this.revealComplete=!0,this.flipTimeouts&&(this.flipTimeouts.forEach(t=>clearTimeout(t)),this.flipTimeouts=[]);let e=document.getElementById("reveal-skip-hint");e&&(e.style.display="none"),this.allRevealedCards.forEach((t,a)=>{let n=document.querySelector(`.reveal-card[data-index="${a}"]`);n&&!n.classList.contains("revealed")&&(n.style.setProperty("--delay","0s"),n.classList.add("revealed"),typeof PlayerData<"u"&&PlayerData.addToCollection(t.key,1,null,t.isHolo))}),setTimeout(()=>this.showPackSummary(),150)},getCardTypeClass(e){return e.type==="kindling"?"kindling-card":e.type==="trap"?"trap-card":e.type==="aura"?"aura-card":e.type==="pyre"?"pyre-card":e.type==="burst"?"burst-card":""},showPackSummary(){this.revealComplete=!0;let e=document.getElementById("reveal-skip-hint");e&&(e.style.display="none");let t=document.getElementById("summary-stats"),a=this.allRevealedCards.filter(l=>{if(typeof PlayerData>"u")return!0;let c=PlayerData.collection[l.key];return!c||c.owned<=1}).length,n=this.allRevealedCards.filter(l=>l.rarity==="common").length,r=this.allRevealedCards.filter(l=>l.rarity==="rare").length,i=this.allRevealedCards.filter(l=>l.rarity==="ultimate").length,o=this.allRevealedCards.filter(l=>l.isHolo).length;t.innerHTML=`
            <div class="stat-item"><span class="stat-value">${this.allRevealedCards.length}</span><span class="stat-label">Cards</span></div>
            <div class="stat-item new"><span class="stat-value">${a}</span><span class="stat-label">New</span></div>
            ${n?`<div class="stat-item common"><span class="stat-value">${n}</span><span class="stat-label">Common</span></div>`:""}
            ${r?`<div class="stat-item rare"><span class="stat-value">${r}</span><span class="stat-label">Rare</span></div>`:""}
            ${i?`<div class="stat-item ultimate"><span class="stat-value">${i}</span><span class="stat-label">Ultimate</span></div>`:""}
            ${o?`<div class="stat-item holo"><span class="stat-value">\u2727${o}</span><span class="stat-label">Holo</span></div>`:""}
        `;let s=document.getElementById("open-another-btn");if(this.packsToOpen.length>0){let l=Math.min(this.packsToOpen.length,10);s.textContent=l===this.packsToOpen.length?`Open All (${l})`:`Open ${l} More`,s.style.display="block"}else s.style.display="none";document.getElementById("pack-summary").classList.add("show"),document.getElementById("pack-stage").onclick=null},closePackOpening(){this.packsToOpen.length>0&&typeof PlayerData<"u"&&(PlayerData.pendingPacks||(PlayerData.pendingPacks=[]),PlayerData.pendingPacks.push(...this.packsToOpen),PlayerData.save(),this.packsToOpen=[]),this.openingPack=!1,document.getElementById("pack-overlay").classList.remove("active"),this.updateCurrency(),this.updatePendingBanner(),this.renderContent()},openAnotherPack(){this.packsToOpen.length?this.startPackOpening():this.closePackOpening()},openPendingPacks(){typeof PlayerData>"u"||!PlayerData.pendingPacks||PlayerData.pendingPacks.length===0||(this.packsToOpen=[PlayerData.pendingPacks.shift()],PlayerData.save(),this.updatePendingBanner(),this.startPackOpening())},openAllPendingPacks(){if(typeof PlayerData>"u"||!PlayerData.pendingPacks||PlayerData.pendingPacks.length===0)return;let e=Math.min(PlayerData.pendingPacks.length,10);this.packsToOpen=PlayerData.pendingPacks.splice(0,e),PlayerData.save(),this.updatePendingBanner(),this.startPackOpening()},generatePackCards(e){let t=[],a=this.getPackableCards();if(e.guaranteed)for(let n=0;n<e.guaranteed.count;n++){let r=a.filter(i=>i.rarity===e.guaranteed.rarity);if(r.length){let i={...r[Math.floor(Math.random()*r.length)]};i.isHolo=e.holoChance&&Math.random()<e.holoChance,t.push(i)}}for(;t.length<e.cardCount;){let n=this.rollRarity(),r=a.filter(i=>i.rarity===n);if(r.length){let i={...r[Math.floor(Math.random()*r.length)]};i.isHolo=e.holoChance&&Math.random()<e.holoChance,t.push(i)}}return t},getPackableCards(){let e=[];return typeof CardRegistry>"u"||(CardRegistry.getAllCryptidKeys().forEach(t=>{let a=CardRegistry.getCryptid(t);a&&!a.evolvesFrom&&e.push({...a,key:t,rarity:a.rarity||"common"})}),CardRegistry.getAllBurstKeys().forEach(t=>{let a=CardRegistry.getBurst(t);a&&e.push({...a,key:t,rarity:"common"})}),CardRegistry.getAllTrapKeys().forEach(t=>{let a=CardRegistry.getTrap(t);a&&e.push({...a,key:t,rarity:"rare"})}),CardRegistry.getAllAuraKeys().forEach(t=>{let a=CardRegistry.getAura(t);a&&e.push({...a,key:t,rarity:a.rarity||"common"})})),e},rollRarity(){let e=Object.values(this.rarityWeights).reduce((a,n)=>a+n,0),t=Math.random()*e;for(let[a,n]of Object.entries(this.rarityWeights))if(t-=n,t<=0)return a;return"common"}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>Shop.init()):Shop.init()});var ht=M(()=>{"use strict";window.WinScreen={isOpen:!1,lastMatchData:null,rematchPending:!1,rematchTimer:null,opponentAvailable:!0,assets:{background:"https://f.playcode.io/p-2633929/v-1/019b7840-e64e-707d-ad59-aec332a31a52/match-results-background.png",victoryBanner:"https://f.playcode.io/p-2633929/v-1/019b7840-e648-72f6-8014-ef9d4861c026/victory-banner.png",defeatBanner:"https://f.playcode.io/p-2633929/v-1/019b7840-e64a-721f-9798-3e22cd5d6f59/defeat-banner.png",mainMenuBtn:"https://f.playcode.io/p-2633929/v-1/019b7840-e64c-75d9-b410-842a1514c54c/main-menu-results-button.png",rematchBtn:"https://f.playcode.io/p-2633929/v-1/019b7840-e649-72ec-a814-ee99a0f0b204/rematch-button.png"},init(){this.preloadAssets(),this.injectStyles(),this.createHTML(),this.bindEvents()},preloadAssets(){this.assetsLoaded=!1;let e=Object.values(this.assets),t=0;e.forEach(a=>{let n=new Image;n.onload=n.onerror=()=>{t++,t>=e.length&&(this.assetsLoaded=!0,console.log("[WinScreen] All assets preloaded"))},n.src=a})},injectStyles(){if(document.getElementById("winscreen-styles"))return;let e=document.createElement("style");e.id="winscreen-styles",e.textContent=`
            /* ==================== WIN SCREEN OVERLAY ==================== */
            #winscreen-overlay {
                position: fixed;
                inset: 0;
                z-index: 28000;
                display: none;
                justify-content: center;
                align-items: center;
                opacity: 0;
                transition: opacity 0.5s ease;
                background-image: url('${this.assets.background}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
            
            #winscreen-overlay::before {
                content: '';
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                pointer-events: none;
            }
            
            #winscreen-overlay.open {
                display: flex;
                opacity: 1;
            }
            
            .winscreen-container {
                position: relative;
                z-index: 1;
                max-width: 700px;
                width: 95%;
                max-height: 100vh;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
                box-sizing: border-box;
                animation: winscreenSlideIn 0.6s ease-out;
            }
            
            @keyframes winscreenSlideIn {
                from { 
                    opacity: 0; 
                    transform: translateY(30px) scale(0.95); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                }
            }
            
            /* ==================== RESULT BANNER (IMAGE) ==================== */
            .result-banner {
                width: 100%;
                max-width: 500px;
                margin-bottom: 15px;
                animation: bannerPulse 3s ease-in-out infinite;
            }
            
            .result-banner img {
                width: 100%;
                height: auto;
                filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
            }
            
            #winscreen-overlay.defeat .result-banner img {
                filter: drop-shadow(0 0 30px rgba(100, 150, 255, 0.5));
            }
            
            @keyframes bannerPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }
            
            .result-subtitle {
                font-family: 'Cinzel', serif;
                font-size: 16px;
                color: var(--bone, #e8e0d5);
                letter-spacing: 3px;
                text-align: center;
                margin-bottom: 15px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.8);
            }
            
            /* ==================== STATS PANEL ==================== */
            .stats-panel {
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(232, 169, 62, 0.3);
                border-radius: 12px;
                padding: 15px 20px;
                margin-bottom: 15px;
                width: 100%;
                max-width: 450px;
                backdrop-filter: blur(5px);
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-bottom: 10px;
            }
            
            .stat-item {
                text-align: center;
            }
            
            .stat-value {
                font-size: 26px;
                font-weight: bold;
                color: var(--parchment, #d4c4a8);
                line-height: 1;
                text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            
            .stat-label {
                font-size: 10px;
                color: var(--bone, #e8e0d5);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 3px;
            }
            
            .stat-item.highlight .stat-value { color: var(--candlelight, #e8a93e); }
            .stat-item.negative .stat-value { color: #e57373; }
            .stat-item.positive .stat-value { color: var(--rune-glow, #7eb89e); }
            
            .match-details {
                display: flex;
                justify-content: center;
                gap: 20px;
                padding-top: 10px;
                border-top: 1px solid rgba(232, 169, 62, 0.15);
                font-size: 12px;
                color: var(--bone, #e8e0d5);
            }
            
            .match-detail {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            /* ==================== REWARDS PANEL ==================== */
            .rewards-panel {
                background: linear-gradient(180deg, rgba(232, 169, 62, 0.15), rgba(0, 0, 0, 0.5));
                border: 1px solid rgba(232, 169, 62, 0.35);
                border-radius: 12px;
                padding: 15px 20px;
                margin-bottom: 15px;
                width: 100%;
                max-width: 450px;
                backdrop-filter: blur(5px);
            }
            
            .rewards-title {
                font-family: 'Cinzel', serif;
                font-size: 16px;
                color: var(--candlelight, #e8a93e);
                margin-bottom: 12px;
                text-align: center;
                text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            
            .rewards-grid {
                display: flex;
                justify-content: center;
                gap: 30px;
                margin-bottom: 10px;
            }
            
            .reward-item {
                text-align: center;
                animation: rewardPop 0.5s ease-out backwards;
            }
            
            .reward-item:nth-child(1) { animation-delay: 0.3s; }
            .reward-item:nth-child(2) { animation-delay: 0.5s; }
            
            @keyframes rewardPop {
                from { opacity: 0; transform: scale(0.5) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            
            .reward-icon { font-size: 28px; margin-bottom: 5px; }
            .reward-amount {
                font-size: 20px;
                font-weight: bold;
                color: var(--parchment, #d4c4a8);
            }
            .reward-amount.xp { color: #81c784; }
            .reward-amount.currency { color: #e8a93e; }
            .reward-label {
                font-size: 10px;
                color: var(--bone, #e8e0d5);
                text-transform: uppercase;
            }
            
            /* XP Bar */
            .xp-bar-container {
                width: 100%;
                max-width: 350px;
                margin-bottom: 15px;
            }
            
            .xp-bar-header {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--bone, #e8e0d5);
                margin-bottom: 4px;
            }
            
            .xp-level {
                font-family: 'Cinzel', serif;
                font-weight: bold;
                color: var(--candlelight, #e8a93e);
            }
            
            .xp-bar {
                height: 10px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 5px;
                border: 1px solid rgba(232, 169, 62, 0.3);
                overflow: hidden;
            }
            
            .xp-fill {
                height: 100%;
                background: linear-gradient(90deg, #7eb89e, #a8d8c8);
                border-radius: 5px;
                transition: width 1s ease-out;
            }
            
            /* ==================== IMAGE BUTTONS ==================== */
            .winscreen-actions {
                display: flex;
                justify-content: center;
                gap: 20px;
                flex-wrap: wrap;
            }
            
            .winscreen-img-btn {
                background: none;
                border: none;
                padding: 0;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
            }
            
            .winscreen-img-btn img {
                height: 60px;
                width: auto;
                filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
                transition: all 0.2s ease;
            }
            
            .winscreen-img-btn:hover img {
                transform: translateY(-3px) scale(1.05);
                filter: drop-shadow(0 8px 16px rgba(0,0,0,0.6));
            }
            
            .winscreen-img-btn:active img {
                transform: translateY(0) scale(0.98);
            }
            
            .winscreen-img-btn.disabled {
                pointer-events: none;
            }
            
            .winscreen-img-btn.disabled img {
                filter: grayscale(100%) brightness(0.5) drop-shadow(0 4px 8px rgba(0,0,0,0.5));
            }
            
            .winscreen-img-btn.pending img {
                animation: pendingPulse 1.5s ease-in-out infinite;
            }
            
            @keyframes pendingPulse {
                0%, 100% { filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)) brightness(1); }
                50% { filter: drop-shadow(0 4px 15px rgba(100, 200, 255, 0.6)) brightness(1.1); }
            }
            
            /* Rematch status text */
            .rematch-status {
                position: absolute;
                bottom: -18px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 11px;
                color: var(--bone, #e8e0d5);
                white-space: nowrap;
                text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            }
            
            .rematch-status.waiting {
                color: #64b5f6;
            }
            
            .rematch-status.unavailable {
                color: #e57373;
            }
            
            /* Level up banner */
            .level-up-banner {
                display: none;
                background: linear-gradient(90deg, transparent, rgba(232, 169, 62, 0.3), transparent);
                padding: 10px 20px;
                margin-bottom: 10px;
                text-align: center;
                border-radius: 8px;
            }
            
            .level-up-banner.show { display: block; animation: levelUpFlash 0.5s ease-out; }
            
            @keyframes levelUpFlash {
                0% { opacity: 0; transform: scale(0.8); }
                50% { transform: scale(1.05); }
                100% { opacity: 1; transform: scale(1); }
            }
            
            .level-up-text {
                font-family: 'Cinzel', serif;
                font-size: 20px;
                color: var(--candlelight, #e8a93e);
                font-weight: bold;
            }
            
            /* ==================== RESPONSIVE ==================== */
            @media (max-width: 500px) {
                .winscreen-container {
                    padding: 15px 10px;
                }
                
                .result-banner {
                    max-width: 320px;
                }
                
                .stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .stat-value { font-size: 22px; }
                
                .rewards-grid { gap: 20px; }
                
                .winscreen-img-btn img {
                    height: 50px;
                }
                
                .winscreen-actions {
                    gap: 15px;
                }
            }
            
            @media (max-height: 700px) {
                .winscreen-container {
                    padding: 10px;
                }
                
                .result-banner {
                    max-width: 350px;
                    margin-bottom: 10px;
                }
                
                .stats-panel, .rewards-panel {
                    padding: 10px 15px;
                    margin-bottom: 10px;
                }
                
                .stat-value { font-size: 20px; }
                .reward-icon { font-size: 22px; }
                .reward-amount { font-size: 16px; }
            }
        `,document.head.appendChild(e)},createHTML(){let e=document.createElement("div");e.id="winscreen-overlay",e.innerHTML=`
            <div class="winscreen-container">
                <!-- Result Banner (Image) -->
                <div class="result-banner">
                    <img id="result-banner-img" src="${this.assets.victoryBanner}" alt="Result">
                </div>
                
                <div class="result-subtitle" id="result-subtitle">The spirits favor you</div>
                
                <!-- Level Up Banner -->
                <div class="level-up-banner" id="level-up-banner">
                    <div class="level-up-text">\u{1F389} Level Up!</div>
                    <div class="level-up-rewards" id="level-up-rewards"></div>
                </div>
                
                <!-- Stats Panel -->
                <div class="stats-panel">
                    <div class="stats-grid" id="stats-grid"></div>
                    <div class="match-details" id="match-details"></div>
                </div>
                
                <!-- XP Bar -->
                <div class="xp-bar-container">
                    <div class="xp-bar-header">
                        <span class="xp-level">Level <span id="xp-level">1</span></span>
                        <span class="xp-numbers"><span id="xp-current">0</span> / <span id="xp-needed">100</span> XP</span>
                    </div>
                    <div class="xp-bar">
                        <div class="xp-fill" id="xp-fill" style="width: 0%;"></div>
                    </div>
                </div>
                
                <!-- Rewards Panel -->
                <div class="rewards-panel">
                    <div class="rewards-title">\u2727 Rewards Earned \u2727</div>
                    <div class="rewards-grid" id="rewards-grid"></div>
                </div>
                
                <!-- Actions (Image Buttons) -->
                <div class="winscreen-actions">
                    <button class="winscreen-img-btn" id="btn-home">
                        <img src="${this.assets.mainMenuBtn}" alt="Main Menu">
                    </button>
                    <button class="winscreen-img-btn" id="btn-rematch">
                        <img src="${this.assets.rematchBtn}" alt="Rematch">
                        <span class="rematch-status" id="rematch-status"></span>
                    </button>
                </div>
            </div>
        `,document.body.appendChild(e)},bindEvents(){document.getElementById("btn-home").onclick=()=>this.goHome(),document.getElementById("btn-rematch").onclick=()=>this.requestRematch()},show(e){this.isOpen=!0,this.lastMatchData=e,this.rematchPending=!1,this.opponentAvailable=!0;let t=document.getElementById("winscreen-overlay"),a=e.isWin,n=e.isHuman||!1,r=e.isMultiplayer||!1;t.classList.remove("victory","defeat","open"),t.classList.add(a?"victory":"defeat");let i=document.getElementById("result-banner-img");i.src=a?this.assets.victoryBanner:this.assets.defeatBanner,document.getElementById("result-subtitle").textContent=a?this.getVictoryQuote():this.getDefeatQuote(),this.updateRematchButton(r);let o=typeof PlayerData<"u"&&PlayerData.calculateMatchRewards?PlayerData.calculateMatchRewards(a,n,e.stats||{}):{xp:a?25:10,currency:a?15:5,breakdown:{}};if(typeof PlayerData<"u"&&(PlayerData.stats=PlayerData.stats||{gamesPlayed:0,wins:0,losses:0},PlayerData.stats.gamesPlayed++,a?PlayerData.stats.wins++:PlayerData.stats.losses++),this.renderStats(e.stats||{}),this.renderMatchDetails(e),this.renderRewards(o),typeof PlayerData<"u"&&PlayerData.level!==void 0){let s=PlayerData.xp||0,l=PlayerData.level||1,c=PlayerData.addXP?PlayerData.addXP(o.xp):{newLevel:l,currentXP:s+o.xp,xpToNext:100,levelsGained:0,rewards:[]};this.animateXPBar(s,l,c),c.levelsGained>0&&this.showLevelUp(c),PlayerData.embers!==void 0&&(PlayerData.embers+=o.currency),typeof PlayerData.save=="function"&&PlayerData.save()}t.style.display="flex",t.style.opacity="0",t.offsetHeight,requestAnimationFrame(()=>{t.classList.add("open"),t.style.opacity=""}),r&&typeof MultiplayerClient<"u"&&this.setupMultiplayerRematchListeners()},hide(){this.isOpen=!1,this.clearRematchTimer();let e=document.getElementById("winscreen-overlay");e.classList.remove("open"),setTimeout(()=>{this.isOpen||(e.style.display="",e.style.opacity="")},500),document.getElementById("level-up-banner").classList.remove("show")},updateRematchButton(e){let t=document.getElementById("btn-rematch"),a=document.getElementById("rematch-status");t.classList.remove("disabled","pending"),a.textContent="",a.className="rematch-status",e&&(a.textContent="Request Rematch")},requestRematch(){this.lastMatchData?.isMultiplayer||!1?this.requestMultiplayerRematch():this.startRematch()},requestMultiplayerRematch(){if(console.log("[WinScreen] requestMultiplayerRematch called"),console.log("[WinScreen] rematchPending:",this.rematchPending),console.log("[WinScreen] opponentAvailable:",this.opponentAvailable),this.rematchPending){console.log("[WinScreen] Already pending, returning");return}let e=document.getElementById("btn-rematch"),t=document.getElementById("rematch-status");if(!this.opponentAvailable){console.log("[WinScreen] Opponent not available"),t.textContent="Opponent left",t.className="rematch-status unavailable";return}this.rematchPending=!0,e.classList.add("pending"),t.textContent="Waiting... 30s",t.className="rematch-status waiting",console.log("[WinScreen] Checking MultiplayerClient:",typeof MultiplayerClient),typeof MultiplayerClient<"u"&&MultiplayerClient.sendRematchRequest?(console.log("[WinScreen] Calling MultiplayerClient.sendRematchRequest()"),MultiplayerClient.sendRematchRequest()):console.error("[WinScreen] MultiplayerClient not available!");let a=30;this.rematchTimer=setInterval(()=>{a--,t.textContent=`Waiting... ${a}s`,a<=0&&this.cancelRematchRequest("Timed out")},1e3)},cancelRematchRequest(e=""){this.clearRematchTimer(),this.rematchPending=!1;let t=document.getElementById("btn-rematch"),a=document.getElementById("rematch-status");t.classList.remove("pending"),a.textContent=e||"Request Rematch",a.className=e?"rematch-status unavailable":"rematch-status"},clearRematchTimer(){this.rematchTimer&&(clearInterval(this.rematchTimer),this.rematchTimer=null)},onOpponentRematchRequest(){let e=document.getElementById("rematch-status");this.rematchPending?(e.textContent="Starting...",e.className="rematch-status waiting"):(e.textContent="Opponent ready!",e.className="rematch-status waiting")},onOpponentLeft(){this.opponentAvailable=!1,this.cancelRematchRequest("Opponent left"),document.getElementById("btn-rematch").classList.add("disabled")},setupMultiplayerRematchListeners(){if(console.log("[WinScreen] Setting up multiplayer rematch listeners"),typeof MultiplayerClient<"u"){console.log("[WinScreen] MultiplayerClient found, hooking callbacks");let e=MultiplayerClient.onRematchRequest,t=MultiplayerClient.onOpponentLeftResults,a=MultiplayerClient.onRematchAccepted;MultiplayerClient.onRematchRequest=()=>{console.log("[WinScreen] onRematchRequest callback triggered"),this.onOpponentRematchRequest(),e&&e.call(MultiplayerClient)},MultiplayerClient.onOpponentLeftResults=()=>{console.log("[WinScreen] onOpponentLeftResults callback triggered"),this.onOpponentLeft(),t&&t.call(MultiplayerClient)},MultiplayerClient.onRematchAccepted=()=>{console.log("[WinScreen] onRematchAccepted callback triggered"),this.startRematch(),a&&a.call(MultiplayerClient)},console.log("[WinScreen] Rematch listeners set up successfully")}else console.error("[WinScreen] MultiplayerClient not defined!")},startRematch(){this.clearRematchTimer(),this.hide(),this.lastMatchData?.isMultiplayer||!1?document.getElementById("game-container").style.display="flex":typeof HomeScreen<"u"&&HomeScreen.startGame?HomeScreen.startGame():typeof initGame=="function"&&(document.getElementById("game-container").style.display="flex",initGame())},goHome(){this.clearRematchTimer(),this.hide(),this.lastMatchData?.isMultiplayer&&typeof MultiplayerClient<"u"&&MultiplayerClient.leaveResultsScreen&&MultiplayerClient.leaveResultsScreen(),typeof HomeScreen<"u"&&HomeScreen.open?HomeScreen.open():typeof MainMenu<"u"&&MainMenu.show()},renderStats(e){let t=document.getElementById("stats-grid"),a=e.kills||0,n=e.playerDeaths||0,r=e.damageDealt||0,i=e.turns||0;t.innerHTML=`
            <div class="stat-item highlight">
                <div class="stat-value">${a}</div>
                <div class="stat-label">Kills</div>
            </div>
            <div class="stat-item ${n>0?"negative":""}">
                <div class="stat-value">${n}</div>
                <div class="stat-label">Deaths</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${r}</div>
                <div class="stat-label">Damage</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${i}</div>
                <div class="stat-label">Turns</div>
            </div>
            <div class="stat-item ${(e.spellsCast||0)>0?"positive":""}">
                <div class="stat-value">${e.spellsCast||0}</div>
                <div class="stat-label">Spells</div>
            </div>
            <div class="stat-item ${(e.evolutions||0)>0?"positive":""}">
                <div class="stat-value">${e.evolutions||0}</div>
                <div class="stat-label">Evolves</div>
            </div>
        `},renderMatchDetails(e){let t=document.getElementById("match-details"),a=e.duration||0,n=Math.floor(a/60),r=a%60,i=e.isMultiplayer?e.opponentName||"PvP":"vs AI";t.innerHTML=`
            <div class="match-detail">
                <span>\u23F1</span>
                <span>${n}:${r.toString().padStart(2,"0")}</span>
            </div>
            <div class="match-detail">
                <span>\u2694</span>
                <span>${i}</span>
            </div>
        `},renderRewards(e){let t=document.getElementById("rewards-grid");t.innerHTML=`
            <div class="reward-item">
                <div class="reward-icon">\u2B50</div>
                <div class="reward-amount xp">+${e.xp||0}</div>
                <div class="reward-label">Experience</div>
            </div>
            <div class="reward-item">
                <div class="reward-icon">\u{1F525}</div>
                <div class="reward-amount currency">+${e.currency||0}</div>
                <div class="reward-label">Embers</div>
            </div>
        `},animateXPBar(e,t,a){let n=document.getElementById("xp-level"),r=document.getElementById("xp-current"),i=document.getElementById("xp-needed"),o=document.getElementById("xp-fill");n.textContent=t;let s=typeof PlayerData<"u"&&PlayerData.getXPForLevel?PlayerData.getXPForLevel(t):100;r.textContent=e,i.textContent=s,o.style.width=`${e/s*100}%`,setTimeout(()=>{a.levelsGained>0?(o.style.width="100%",setTimeout(()=>{n.textContent=a.newLevel,r.textContent=a.currentXP,i.textContent=a.xpToNext,o.style.transition="none",o.style.width="0%",setTimeout(()=>{o.style.transition="width 1s ease-out",o.style.width=`${a.currentXP/a.xpToNext*100}%`},50)},1e3)):(r.textContent=a.currentXP,o.style.width=`${a.currentXP/a.xpToNext*100}%`)},500)},showLevelUp(e){let t=document.getElementById("level-up-banner"),a=document.getElementById("level-up-rewards"),n=[];for(let r of e.rewards||[])r.currency&&n.push(`<span>+${r.currency} Embers</span>`),r.boosterPack&&n.push("<span>\u{1F4E6} Booster Pack!</span>");a.innerHTML=n.join(" "),t.classList.add("show")},getVictoryQuote(){let e=["The spirits favor you","A glorious triumph","Your legend grows","The cryptids bow to you","Fate smiles upon thee","A masterful display","The darkness retreats"];return e[Math.floor(Math.random()*e.length)]},getDefeatQuote(){let e=["The shadows claim victory","Rise again, challenger","A valiant effort","The cryptids hunger still","Fate is fickle","Learn from this loss","The darkness grows stronger"];return e[Math.floor(Math.random()*e.length)]}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>WinScreen.init()):WinScreen.init()});var yt=M(()=>{"use strict";window.Multiplayer={ws:null,isConnected:!1,isSearching:!1,isInMatch:!1,matchId:null,playerId:null,opponentId:null,opponentName:"Opponent",mode:null,deckId:null,playerWins:0,opponentWins:0,currentGame:1,turnTimer:null,turnTimeRemaining:150,timerWarningShown:!1,playerTimeouts:0,opponentTimeouts:0,isMyTurn:!1,turnTransitionLock:!1,processingOpponentAction:!1,animationQueue:[],isPlayingAnimation:!1,TURN_TIME:150,WARNING_TIME:30,DISCONNECT_GRACE:6e4,TIMEOUT_FORFEIT:3,serverUrl:"wss://cryptid-fates.brenden-6ce.workers.dev",reconnectAttempts:0,maxReconnectAttempts:5,reconnectDelay:1e3,connect(){return this.ws?.readyState===WebSocket.OPEN?Promise.resolve():new Promise((e,t)=>{try{this.ws=new WebSocket(this.serverUrl),this.ws.onopen=()=>{console.log("[MP] Connected"),this.isConnected=!0,this.reconnectAttempts=0,this.send({type:"auth",playerId:this.getPlayerId(),playerName:this.getPlayerName()}),e()},this.ws.onclose=()=>{this.isConnected=!1,this.handleDisconnect()},this.ws.onerror=a=>t(a),this.ws.onmessage=a=>{this.handleMessage(JSON.parse(a.data))}}catch(a){t(a)}})},send(e){this.ws?.readyState===WebSocket.OPEN?(console.log("[MP] Sending:",e.type||e),this.ws.send(JSON.stringify(e))):console.error("[MP] Cannot send - WebSocket not open. readyState:",this.ws?.readyState)},disconnect(){this.ws&&(this.ws.close(),this.ws=null),this.isConnected=!1},getPlayerId(){if(window.Auth?.isAuthenticated&&window.Auth.user?.id)return window.Auth.user.id;let e=localStorage.getItem("cryptid_player_id");return e||(e="offline_"+Math.random().toString(36).substr(2,9),localStorage.setItem("cryptid_player_id",e)),e},getPlayerName(){return window.Auth?.isAuthenticated&&window.Auth.user?.displayName?window.Auth.user.displayName:PlayerData?.playerName||"Summoner"},handleDisconnect(){this.isInMatch&&(showMessage("Connection lost! Reconnecting..."),this.attemptReconnect())},attemptReconnect(){if(this.reconnectAttempts>=this.maxReconnectAttempts){showMessage("Could not reconnect."),this.resetMatchState();return}this.reconnectAttempts++,setTimeout(()=>{this.connect().catch(()=>this.attemptReconnect())},this.reconnectDelay*this.reconnectAttempts)},serializeCryptid(e){return e?{key:e.key,name:e.name,isKindling:e.isKindling||!1,col:e.col,row:e.row,atk:e.atk,hp:e.hp,cost:e.cost,currentAtk:e.currentAtk??e.atk,currentHp:e.currentHp??e.hp,maxHp:e.maxHp??e.hp,baseAtk:e.baseAtk??e.atk,baseHp:e.baseHp??e.hp,tapped:e.tapped||!1,canAttack:e.canAttack!==!1,attackedThisTurn:e.attackedThisTurn||!1,justSummoned:e.justSummoned||!1,evolvedThisTurn:e.evolvedThisTurn||!1,terrified:e.terrified||!1,savedAtk:e.savedAtk,burnTurns:e.burnTurns||0,bleedTurns:e.bleedTurns||0,paralyzed:e.paralyzed||!1,paralyzeTurns:e.paralyzeTurns||0,calamityCounters:e.calamityCounters||0,curseTokens:e.curseTokens||0,protectionCharges:e.protectionCharges||0,damageReduction:e.damageReduction||0,blockFirstHit:e.blockFirstHit||!1,bonusDamage:e.bonusDamage||0,regeneration:e.regeneration||0,healOnKill:e.healOnKill||0,atkDebuff:e.atkDebuff||0,noTapOnAttack:e.noTapOnAttack||!1,hasFocus:e.hasFocus||!1,grantsFocus:e.grantsFocus||!1,hasLatch:e.hasLatch||!1,hasCleave:e.hasCleave||!1,hasDestroyer:e.hasDestroyer||!1,hasMultiAttack:e.hasMultiAttack||!1,canTargetAny:e.canTargetAny||!1,hasFlight:e.hasFlight||!1,immuneToTraps:e.immuneToTraps||!1,immuneToBursts:e.immuneToBursts||!1,curseHealing:e.curseHealing||!1,attacksApplyCalamity:e.attacksApplyCalamity||0,attacksApplyParalyze:e.attacksApplyParalyze||!1,attacksApplyBleed:e.attacksApplyBleed||!1,attacksApplyBurn:e.attacksApplyBurn||!1,attacksApplyCurse:e.attacksApplyCurse||0,bonusVsParalyzed:e.bonusVsParalyzed||0,bonusVsAilment:e.bonusVsAilment||0,doubleDamageVsTapped:e.doubleDamageVsTapped||!1,bloodPactAvailable:e.bloodPactAvailable||!1,thermalAvailable:e.thermalAvailable||!1,rageHealAvailable:e.rageHealAvailable||!1,radianceActive:e.radianceActive||!1,regenActive:e.regenActive||!1,isHidden:e.isHidden||!1,bigfootBulkApplied:e.bigfootBulkApplied||!1,wendigoBondApplied:e.wendigoBondApplied||!1,_lastBuffedCombatant:e._lastBuffedCombatant||null,foil:e.foil||!1,skinId:e.skinId,auras:(e.auras||[]).map(t=>({key:t.key,name:t.name}))}:null},serializeTrap(e){return e?{key:e.key,row:e.row}:null},serializeGameState(){let e=window.game;return e?{playerPyre:e.playerPyre,enemyPyre:e.enemyPyre,playerDeaths:e.playerDeaths,enemyDeaths:e.enemyDeaths,playerField:[[this.serializeCryptid(e.playerField[0]?.[0]),this.serializeCryptid(e.playerField[0]?.[1]),this.serializeCryptid(e.playerField[0]?.[2])],[this.serializeCryptid(e.playerField[1]?.[0]),this.serializeCryptid(e.playerField[1]?.[1]),this.serializeCryptid(e.playerField[1]?.[2])]],enemyField:[[this.serializeCryptid(e.enemyField[0]?.[0]),this.serializeCryptid(e.enemyField[0]?.[1]),this.serializeCryptid(e.enemyField[0]?.[2])],[this.serializeCryptid(e.enemyField[1]?.[0]),this.serializeCryptid(e.enemyField[1]?.[1]),this.serializeCryptid(e.enemyField[1]?.[2])]],playerTraps:[this.serializeTrap(e.playerTraps[0]),this.serializeTrap(e.playerTraps[1])],enemyTraps:[this.serializeTrap(e.enemyTraps[0]),this.serializeTrap(e.enemyTraps[1])],playerHandCount:e.playerHand?.length||0,enemyHandCount:e.enemyHand?.length||0,playerKindlingPlayedThisTurn:e.playerKindlingPlayedThisTurn||!1,playerPyreCardPlayedThisTurn:e.playerPyreCardPlayedThisTurn||!1,playerPyreBurnUsed:e.playerPyreBurnUsed||!1}:null},deserializeCryptid(e,t){if(!e)return null;let a=CardRegistry.getCryptid(e.key)||CardRegistry.getKindling(e.key);return a?{...a,...e,owner:t}:(console.warn("[MP] Card template not found:",e.key),null)},deserializeTrap(e){if(!e)return null;let t=CardRegistry.getTrap(e.key);return t?{...t,...e}:null},applyReceivedState(e){if(!e)return;let t=window.game;if(!t)return;console.log("[MP] Applying received state"),t.enemyPyre=e.playerPyre,t.enemyDeaths=e.playerDeaths;for(let n=0;n<2;n++){let r=1-n;for(let i=0;i<3;i++){let o=e.playerField[n]?.[i];if(o){let s=this.deserializeCryptid(o,"enemy");s&&(s.col=r,s.row=i),t.enemyField[r][i]=s}else t.enemyField[r][i]=null}}for(let n=0;n<2;n++){let r=1-n;for(let i=0;i<3;i++){let o=e.enemyField[n]?.[i],s=t.playerField[r]?.[i];if(o&&s&&o.key===s.key){let l=s._lastBuffedCombatant;s.currentAtk=o.currentAtk,s.currentHp=o.currentHp,s.maxHp=o.maxHp,s.tapped=o.tapped,s.canAttack=o.canAttack,s.attackedThisTurn=o.attackedThisTurn,s.terrified=o.terrified,s.savedAtk=o.savedAtk,s.burnTurns=o.burnTurns,s.bleedTurns=o.bleedTurns,s.paralyzed=o.paralyzed,s.paralyzeTurns=o.paralyzeTurns,s.calamityCounters=o.calamityCounters,s.curseTokens=o.curseTokens,s.protectionCharges=o.protectionCharges,s.damageReduction=o.damageReduction,s.blockFirstHit=o.blockFirstHit,s.bonusDamage=o.bonusDamage,s.regeneration=o.regeneration,s.healOnKill=o.healOnKill,s.atkDebuff=o.atkDebuff,s.hasFlight=o.hasFlight,s.immuneToTraps=o.immuneToTraps,s.immuneToBursts=o.immuneToBursts,s.attacksApplyCurse=o.attacksApplyCurse,s.bonusVsAilment=o.bonusVsAilment,s._lastBuffedCombatant=l}else if(o&&!s){console.log("[MP] Creating cryptid on our field:",o.key,"at col",r,"row",i);let l=this.deserializeCryptid(o,"player");if(l&&(l.col=r,l.row=i,t.playerField[r][i]=l,l.isKindling&&t.playerKindling)){let c=t.playerKindling.findIndex(m=>m.key===l.key);c!==-1&&(t.playerKindling.splice(c,1),console.log("[MP] Removed",l.key,"from playerKindling (forced summon). Remaining:",t.playerKindling.length))}}else!o&&s&&(t.playerField[r][i]=null)}}e.enemyPyre!==void 0&&(t.playerPyre=e.enemyPyre),e.enemyDeaths!==void 0&&(t.playerDeaths=e.enemyDeaths),e.playerDeaths!==void 0&&(t.enemyDeaths=e.playerDeaths),(t.playerDeaths>=10||t.enemyDeaths>=10)&&setTimeout(()=>{t.gameOver||t.checkGameOver()},100),t.enemyTraps[1]=this.deserializeTrap(e.playerTraps[0]),t.enemyTraps[0]=this.deserializeTrap(e.playerTraps[1]),e.enemyTraps[1]||(t.playerTraps[0]=null),e.enemyTraps[0]||(t.playerTraps[1]=null);let a=e.playerHandCount;for(;t.enemyHand.length<a;)t.enemyHand.push({});for(;t.enemyHand.length>a;)t.enemyHand.pop();t.enemyKindlingPlayedThisTurn=e.playerKindlingPlayedThisTurn,t.enemyPyreCardPlayedThisTurn=e.playerPyreCardPlayedThisTurn,t.enemyPyreBurnUsed=e.playerPyreBurnUsed},sendGameAction(e,t={}){if(!this.isInMatch||!this.isMyTurn){console.warn("[MP] Cannot send - not in match or not our turn");return}let a={type:"action",matchId:this.matchId,playerId:this.playerId,action:{type:e,...t},state:this.serializeGameState()};console.log("[MP] Sending:",e),this.send(a)},handleOpponentAction(e){let{action:t,state:a}=e;t&&(console.log("[MP] Received:",t.type),this.processingOpponentAction=!0,this.animationQueue.push({action:t,state:a}),this.processAnimationQueue())},processAnimationQueue(){if(this.isPlayingAnimation||this.animationQueue.length===0)return;this.isPlayingAnimation=!0;let{action:e,state:t}=this.animationQueue.shift();t&&this.applyReceivedState(t),requestAnimationFrame(()=>{typeof renderAll=="function"&&renderAll(),setTimeout(()=>{this.playAnimation(e,()=>{requestAnimationFrame(()=>{typeof updateButtons=="function"&&updateButtons()}),e.type==="endPhase"&&this.handleOpponentEndTurn(),this.isPlayingAnimation=!1,this.processingOpponentAction=this.animationQueue.length>0,setTimeout(()=>this.processAnimationQueue(),50)})},50)})},playAnimation(e,t){let a={summon:800,attack:900,spell:1e3,death:900,evolve:1e3,trap:600,aura:1e3,message:800},n=p(()=>{try{t()}catch(r){console.error("[MP] Animation complete error:",r)}},"safeComplete");switch(e.type){case"summon":{showMessage("Opponent summoned "+(e.cardName||e.cardKey)+"!");let r=1-e.col,i=0,o=p(()=>{let s=document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${r}"][data-row="${e.row}"]`);s?(s.classList.add("summoning"),setTimeout(()=>s.classList.remove("summoning"),a.summon)):i<3&&(i++,setTimeout(o,50))},"findAndAnimate");o(),setTimeout(n,a.summon);break}case"attack":{let r=1-e.attackerCol,i=1-e.targetCol,o=document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${r}"][data-row="${e.attackerRow}"]`);o&&(o.classList.add("attacking-left"),setTimeout(()=>o.classList.remove("attacking-left"),a.attack)),setTimeout(()=>{let s=document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${i}"][data-row="${e.targetRow}"]`);s&&(s.classList.add("taking-damage"),setTimeout(()=>s.classList.remove("taking-damage"),400))},250),setTimeout(n,a.attack);break}case"burst":{if(showMessage("Opponent cast "+(e.cardName||e.cardKey)+"!"),e.targetCol!==void 0&&e.targetRow!==void 0){let r=1-e.targetCol,i=e.targetOwner==="player"?"enemy":"player",o=document.querySelector(`.cryptid-sprite[data-owner="${i}"][data-col="${r}"][data-row="${e.targetRow}"]`);o&&(o.classList.add("spell-target"),setTimeout(()=>o.classList.remove("spell-target"),a.spell))}setTimeout(n,a.spell);break}case"trap":{showMessage("Opponent set a trap!");let r=document.querySelector(`.trap-sprite[data-owner="enemy"][data-row="${e.row}"]`);r&&(r.classList.add("spawning"),setTimeout(()=>r.classList.remove("spawning"),a.trap)),setTimeout(n,a.trap);break}case"aura":{showMessage("Opponent cast "+(e.cardName||e.cardKey)+"!");let r=1-e.col,i=document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${r}"][data-row="${e.row}"]`);i&&(i.classList.add("aura-target"),setTimeout(()=>i.classList.remove("aura-target"),a.aura)),setTimeout(n,a.aura);break}case"pyre":showMessage("Opponent played "+(e.cardName||e.cardKey)+"!"),setTimeout(n,a.spell);break;case"evolve":{showMessage("Opponent evolved into "+(e.cardName||e.cardKey)+"!");let r=1-e.targetCol,i=document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${r}"][data-row="${e.targetRow}"]`);i&&(i.classList.add("evolving"),setTimeout(()=>i.classList.remove("evolving"),a.evolve)),setTimeout(n,a.evolve);break}case"pyreBurn":showMessage("Opponent used Pyre Burn!"),setTimeout(n,a.spell);break;case"ability":showMessage("Opponent activated "+(e.abilityName||"ability")+"!"),setTimeout(n,a.spell);break;case"turnStartSync":n();break;case"endPhase":n();break;case"gameOver":{this.onMatchEnd({winner:e.winner}),n();break}default:console.warn("[MP] Unknown action:",e.type),n()}},handleOpponentEndTurn(){console.log("[MP] Opponent ended turn"),this.turnTransitionLock=!0,this.stopTurnTimer();let e=window.game;GameEvents.emit("onTurnEnd",{owner:"enemy",turnNumber:e.turnNumber}),e.startTurn("player",!1),this.isMyTurn=!0,showMessage("Your turn!"),this.turnTimeRemaining=this.TURN_TIME,this.timerWarningShown=!1,this.startTurnTimer(!0),this.updateTimerDisplay(),requestAnimationFrame(()=>{typeof renderAll=="function"&&renderAll(),typeof updateButtons=="function"&&updateButtons()}),setTimeout(()=>{this.sendTurnStartSync(),this.turnTransitionLock=!1},100)},sendTurnStartSync(){if(!this.isInMatch||!this.isMyTurn)return;let e={type:"action",matchId:this.matchId,playerId:this.playerId,action:{type:"turnStartSync"},state:this.serializeGameState()};console.log("[MP] Sending turn start sync"),this.send(e)},sendKindlingSync(e){if(!this.isInMatch)return;let t=e.map(n=>({key:n.key,foil:n.foil||!1})),a={type:"kindlingSync",matchId:this.matchId,playerId:this.playerId,kindling:t};console.log("[MP] Sending kindling sync:",t.length,"cards"),this.send(a)},handleKindlingSync(e){let t=window.game;if(!t){console.log("[MP] Storing pending kindling sync (game not ready)"),this.pendingKindlingSync=e;return}let a=e.kindling||[];console.log("[MP] Received opponent kindling:",a.length,"cards"),t.enemyKindling=a.map(n=>{let r=CardRegistry.getKindling(n.key);return r?Object.assign({},r,{foil:n.foil,instanceId:Math.random().toString(36).substr(2,9)}):(console.warn("[MP] Unknown kindling:",n.key),null)}).filter(n=>n!==null),console.log("[MP] Enemy kindling pool set:",t.enemyKindling.length,"cards")},applyPendingKindlingSync(){this.pendingKindlingSync&&(console.log("[MP] Applying pending kindling sync"),this.handleKindlingSync(this.pendingKindlingSync),this.pendingKindlingSync=null)},handleMessage(e){switch(console.log("[MP] Received:",e.type),e.type){case"authenticated":this.playerId=e.playerId;break;case"matchFound":this.onMatchFound(e);break;case"opponentAction":this.handleOpponentAction(e);break;case"opponentDisconnected":this.onOpponentDisconnected();break;case"opponentReconnected":showMessage("Opponent reconnected!"),this.hideDisconnectOverlay();break;case"gameEnd":this.onGameEnd(e);break;case"matchEnd":this.onMatchEnd(e);break;case"kindlingSync":this.handleKindlingSync(e);break;case"error":console.error("[MP] Error:",e.message);break;case"rematch_requested":case"opponent_left_results":case"rematch_accepted":this.handleRematchMessage(e);break}},async startMatchmaking(e,t){if(!window.Auth?.isAuthenticated){showMessage("Please sign in to play multiplayer!",2e3),LoginScreen.show();return}this.mode=e,this.deckId=t;try{await this.connect(),this.isSearching=!0,this.send({type:"findMatch",mode:e,deckId:t,playerName:this.getPlayerName()});let a=document.getElementById("qp-status");a&&(a.textContent="Searching for opponent...")}catch(a){console.error("[MP] Matchmaking failed:",a);let n=document.getElementById("qp-status");n&&(n.innerHTML='<span class="error">Failed to connect</span>')}},findMatch(e,t){return this.startMatchmaking(e,t)},sendForcedSummon(e,t,a){!this.isInMatch||!this.isMyTurn||this.sendGameAction("summon",{cardKey:e,cardName:e,col:t,row:a,isKindling:!0,forced:!0})},actionActivateAbility(e,t,a,n){!this.isInMatch||!this.isMyTurn||this.processingOpponentAction||this.sendGameAction("ability",Object.assign({abilityName:e,col:t,row:a},n||{}))},cancelMatchmaking(){this.isSearching=!1,this.send({type:"cancelMatch"});let e=document.getElementById("qp-status");e&&(e.textContent="")},onMatchFound(e){console.log("[MP] Match found!",e),console.log("[MP] isRematch:",e.isRematch),this.isSearching=!1,this.isInMatch=!0,this.matchId=e.matchId,this.opponentId=e.opponentId,this.opponentName=e.opponentName||"Opponent",this.playerWins=0,this.opponentWins=0,this.currentGame=1,this.playerTimeouts=0,this.opponentTimeouts=0,this.turnTimeRemaining=this.TURN_TIME;let t=document.getElementById("qp-status");t&&(t.innerHTML='<span style="color:#80e080;">Match found!</span>'),e.isRematch&&typeof WinScreen<"u"&&WinScreen.isOpen&&(console.log("[MP] Closing WinScreen for rematch"),WinScreen.hide()),typeof HomeScreen<"u"&&HomeScreen.onMatchFound({matchId:e.matchId,opponentName:this.opponentName,mode:this.mode,goesFirst:e.goesFirst,isRematch:e.isRematch})},startTurnTimer(e){if(this.stopTurnTimer(),!e){this.updateTimerDisplay();return}this.turnTimer=setInterval(()=>{if(!this.isMyTurn){this.stopTurnTimer();return}this.turnTimeRemaining--,this.updateTimerDisplay(),this.turnTimeRemaining<=this.WARNING_TIME&&!this.timerWarningShown&&(this.timerWarningShown=!0,showMessage("30 seconds remaining!")),this.turnTimeRemaining<=0&&(this.stopTurnTimer(),this.handleTimeout())},1e3)},stopTurnTimer(){this.turnTimer&&(clearInterval(this.turnTimer),this.turnTimer=null)},updateTimerDisplay(){let e=document.getElementById("mp-turn-timer");if(e)if(this.isMyTurn){let t=Math.floor(this.turnTimeRemaining/60),a=this.turnTimeRemaining%60;e.textContent=t+":"+a.toString().padStart(2,"0"),e.classList.toggle("warning",this.turnTimeRemaining<=this.WARNING_TIME),e.classList.remove("waiting")}else e.textContent="Opponent's Turn",e.classList.remove("warning"),e.classList.add("waiting")},handleTimeout(){this.playerTimeouts++,showMessage("Time's up! ("+this.playerTimeouts+"/"+this.TIMEOUT_FORFEIT+")"),this.playerTimeouts>=this.TIMEOUT_FORFEIT?this.forfeitMatch("timeout"):(this.sendGameAction("endPhase"),this.isMyTurn=!1,window.game.currentTurn="enemy",window.game.phase="waiting",this.turnTimeRemaining=this.TURN_TIME,this.timerWarningShown=!1,this.startTurnTimer(!1))},onGameEnd(e){let t=e.winner===this.playerId;this.mode==="bo3"?(t?this.playerWins++:this.opponentWins++,this.playerWins>=2||this.opponentWins>=2?this.onMatchEnd({winner:t?this.playerId:this.opponentId}):(this.currentGame++,showMessage("Game over! Score: "+this.playerWins+"-"+this.opponentWins))):this.onMatchEnd(e)},onMatchEnd(e){let t=e.winner===this.playerId;this.stopTurnTimer(),this.isInMatch=!1,this.isMyTurn=!1;let a=window.game;if(a&&!a.gameOver){a.gameOver=!0;let r=Math.floor((Date.now()-(a.matchStats?.startTime||Date.now()))/1e3),i={isWin:t,isHuman:!0,isMultiplayer:!0,stats:{kills:a.enemyDeaths||0,playerDeaths:a.playerDeaths||0,damageDealt:a.matchStats?.damageDealt||0,turns:a.turnNumber||0,spellsCast:a.matchStats?.spellsCast||0,evolutions:a.matchStats?.evolutions||0,perfectWin:a.playerDeaths===0&&t},duration:r,deckName:"Battle Deck",opponentName:this.opponentName};typeof WinScreen<"u"&&WinScreen.show?WinScreen.show(i):a.endGame(t?"player":"enemy")}let n=this.mode==="bo3"?{win:30,lose:12,winXP:50,loseXP:25}:{win:15,lose:5,winXP:20,loseXP:10};typeof PlayerData<"u"&&(PlayerData.embers=(PlayerData.embers||0)+(t?n.win:n.lose),PlayerData.xp=(PlayerData.xp||0)+(t?n.winXP:n.loseXP),typeof PlayerData.save=="function"&&PlayerData.save())},onOpponentDisconnected(){showMessage("Opponent disconnected..."),this.showDisconnectOverlay(60)},sendRematchRequest(){if(console.log("[MP] sendRematchRequest called, matchId:",this.matchId),!this.matchId){console.error("[MP] Cannot send rematch request - no matchId!");return}let e={type:"rematch_request",matchId:this.matchId};console.log("[MP] Sending rematch request:",e),this.send(e)},leaveResultsScreen(){let e=this.matchId;e&&(this.send({type:"leave_results",matchId:e}),this.resetMatchState())},onRematchRequest(){},onOpponentLeftResults(){},onRematchAccepted(){},handleRematchMessage(e){switch(console.log("[MP] handleRematchMessage:",e.type),e.type){case"rematch_requested":console.log("[MP] Opponent requested rematch"),typeof this.onRematchRequest=="function"&&this.onRematchRequest();break;case"opponent_left_results":console.log("[MP] Opponent left results screen"),typeof this.onOpponentLeftResults=="function"&&this.onOpponentLeftResults();break;case"rematch_accepted":console.log("[MP] Rematch accepted! Server will send matchFound"),typeof this.onRematchAccepted=="function"&&this.onRematchAccepted();break}},forfeitMatch(e){this.isInMatch&&(this.send({type:"forfeit",matchId:this.matchId,reason:e||"manual"}),showMessage("Match forfeited"),this.resetMatchState())},resetMatchState(){this.isInMatch=!1,this.isSearching=!1,this.isMyTurn=!1,this.matchId=null,this.opponentId=null,this.stopTurnTimer(),this.hideMultiplayerUI(),window.game&&(window.game.isMultiplayer=!1),this.animationQueue=[],this.isPlayingAnimation=!1,this.processingOpponentAction=!1},showMultiplayerUI(){let e=document.getElementById("hud");if(e){if(!document.getElementById("mp-hud-center")){let t=document.createElement("div");t.id="mp-hud-center",t.className="mp-hud-center",t.innerHTML='<div class="mp-timer-compact"><span class="mp-turn-timer" id="mp-turn-timer">2:30</span></div><div class="mp-vs-info"><span class="mp-vs-label">VS</span><span class="mp-opponent-name" id="mp-opponent-name">'+this.opponentName+'</span></div><div class="mp-score" id="mp-score"></div><button class="mp-menu-btn" id="mp-options-btn">\u2630</button>';let a=e.querySelector(".player-info.player");a?a.after(t):e.appendChild(t)}if(!document.getElementById("mp-hybrid-menu")){let t=document.createElement("div");t.id="mp-hybrid-menu",t.className="mp-hybrid-menu",t.innerHTML='<div class="mp-hybrid-header"><span class="mp-hybrid-title">\u{1F4DC} Chronicle</span><button class="mp-hybrid-close" id="mp-hybrid-close">\u2715</button></div><div class="mp-hybrid-chronicle" id="mp-hybrid-chronicle"></div><div class="mp-hybrid-divider"></div><div class="mp-hybrid-actions"><button class="mp-hybrid-action forfeit" id="mp-forfeit-btn">\u{1F3F3}\uFE0F Forfeit</button></div>',document.body.appendChild(t);let a=document.createElement("div");a.id="mp-menu-backdrop",a.className="mp-menu-backdrop",document.body.appendChild(a)}if(!document.getElementById("mp-disconnect-overlay")){let t=document.createElement("div");t.id="mp-disconnect-overlay",t.className="mp-disconnect-overlay",t.innerHTML='<div class="mp-disconnect-content"><div class="mp-disconnect-icon">\u{1F4E1}</div><div class="mp-disconnect-title">Opponent Disconnected</div><div class="mp-disconnect-timer" id="mp-disconnect-timer">60</div></div>',document.body.appendChild(t)}if(document.getElementById("mp-options-btn")?.addEventListener("click",()=>this.toggleMenu()),document.getElementById("mp-hybrid-close")?.addEventListener("click",()=>this.hideMenu()),document.getElementById("mp-forfeit-btn")?.addEventListener("click",()=>{confirm("Forfeit match?")&&this.forfeitMatch("manual")}),document.getElementById("mp-menu-backdrop")?.addEventListener("click",()=>this.hideMenu()),document.getElementById("mp-hud-center")?.classList.add("visible"),document.body.classList.add("multiplayer-active"),this.mode==="bo3"){let t=document.getElementById("mp-score");t&&(t.textContent=this.playerWins+" - "+this.opponentWins)}}},hideMultiplayerUI(){document.getElementById("mp-hud-center")?.classList.remove("visible"),document.getElementById("mp-hybrid-menu")?.classList.remove("visible"),document.getElementById("mp-menu-backdrop")?.classList.remove("visible"),document.getElementById("mp-disconnect-overlay")?.classList.remove("visible"),document.body.classList.remove("multiplayer-active")},toggleMenu(){let e=document.getElementById("mp-hybrid-menu"),t=document.getElementById("mp-menu-backdrop");if(e?.classList.contains("visible"))this.hideMenu();else{let a=document.getElementById("event-log-entries"),n=document.getElementById("mp-hybrid-chronicle");a&&n&&(n.innerHTML=a.innerHTML,n.scrollTop=n.scrollHeight),e?.classList.add("visible"),t?.classList.add("visible")}},hideMenu(){document.getElementById("mp-hybrid-menu")?.classList.remove("visible"),document.getElementById("mp-menu-backdrop")?.classList.remove("visible")},showDisconnectOverlay(e){let t=document.getElementById("mp-disconnect-overlay");if(t){t.classList.add("visible");let a=document.getElementById("mp-disconnect-timer");a&&(a.textContent=e)}},hideDisconnectOverlay(){document.getElementById("mp-disconnect-overlay")?.classList.remove("visible")}};window.multiplayerHook={shouldSend(){return window.game?.isMultiplayer&&Multiplayer.isInMatch&&Multiplayer.isMyTurn&&!Multiplayer.processingOpponentAction},onSummon(e,t,a,n){!this.shouldSend()||t!=="player"||Multiplayer.sendGameAction("summon",{cardKey:e.key,cardName:e.name,col:a,row:n,isKindling:e.isKindling||!1})},onAttack(e,t,a,n){!this.shouldSend()||e.owner!=="player"||Multiplayer.sendGameAction("attack",{attackerCol:e.col,attackerRow:e.row,targetOwner:t,targetCol:a,targetRow:n})},onBurst(e,t,a,n){this.shouldSend()&&Multiplayer.sendGameAction("burst",{cardKey:e.key,cardName:e.name,targetOwner:t,targetCol:a,targetRow:n})},onTrap(e,t){this.shouldSend()&&Multiplayer.sendGameAction("trap",{cardKey:e.key,cardName:e.name,row:t})},onAura(e,t,a){this.shouldSend()&&Multiplayer.sendGameAction("aura",{cardKey:e.key,cardName:e.name,col:t,row:a})},onPyre(e){this.shouldSend()&&Multiplayer.sendGameAction("pyre",{cardKey:e.key,cardName:e.name})},onEvolve(e,t,a){this.shouldSend()&&Multiplayer.sendGameAction("evolve",{cardKey:e.key,cardName:e.name,targetCol:t,targetRow:a})},onPyreBurn(e){this.shouldSend()&&Multiplayer.sendGameAction("pyreBurn",{deathCount:e})},onActivateAbility(e,t,a,n){this.shouldSend()&&Multiplayer.sendGameAction("ability",Object.assign({abilityName:e,col:t,row:a},n||{}))},onEndPhase(){this.shouldSend()&&(Multiplayer.sendGameAction("endPhase"),Multiplayer.isMyTurn=!1,Multiplayer.stopTurnTimer(),window.game.currentTurn="enemy",window.game.phase="waiting",Multiplayer.turnTimeRemaining=Multiplayer.TURN_TIME,Multiplayer.timerWarningShown=!1,Multiplayer.startTurnTimer(!1))}};window.showMultiplayerCoinFlip=function(e,t,a){var n=document.getElementById("turn-order-overlay");if(!n){console.warn("[MP] Turn order overlay not found"),a&&a();return}var r=n.querySelectorAll(".contestant"),i=n.querySelector(".fate-decider"),o=n.querySelector(".fate-coin"),s=n.querySelector(".turn-order-result"),l=s?s.querySelector(".winner-name"):null,c=r[0]?r[0].querySelector(".contestant-label"):null,m=r[1]?r[1].querySelector(".contestant-label"):null;c&&(c.textContent="You"),m&&(m.textContent=t||"Opponent"),n.classList.add("active"),setTimeout(function(){r[0]&&r[0].classList.add("reveal")},400),setTimeout(function(){r[1]&&r[1].classList.add("reveal")},600),setTimeout(function(){i&&i.classList.add("active")},1e3),setTimeout(function(){o&&(o.classList.add("stopped"),o.style.transform=e?"rotateY(0deg)":"rotateY(180deg)")},2200),setTimeout(function(){e?(r[0]&&r[0].classList.add("winner"),r[1]&&r[1].classList.add("loser"),l&&(l.textContent="You")):(r[1]&&r[1].classList.add("winner"),r[0]&&r[0].classList.add("loser"),l&&(l.textContent=t||"Opponent")),s&&s.classList.add("show")},2600),setTimeout(function(){n.classList.remove("active"),setTimeout(function(){r.forEach(function(f){f&&f.classList.remove("reveal","winner","loser")}),i&&i.classList.remove("active"),o&&(o.classList.remove("stopped"),o.style.transform=""),s&&s.classList.remove("show"),c&&(c.textContent="Seeker"),m&&(m.textContent="Warden"),a&&a()},500)},4200)};window.startMultiplayerGame=function(e){console.log("[MP] Starting game:",e),console.log("[MP] Multiplayer.deckId:",Multiplayer.deckId),console.log("[MP] Multiplayer.mode:",Multiplayer.mode),typeof HomeScreen<"u"&&HomeScreen.close(),typeof WinScreen<"u"&&WinScreen.isOpen&&(console.log("[MP] Closing WinScreen"),WinScreen.hide()),document.getElementById("game-container").style.display="flex";var t=document.getElementById("main-menu");t&&t.classList.add("hidden"),window.showMultiplayerCoinFlip(e.goesFirst,e.opponentName,function(){ia(e)})};function ia(e){var t=PlayerData.decks.find(function(m){return m.id===Multiplayer.deckId});if(!t){console.error("[MP] Deck not found:",Multiplayer.deckId),showMessage("Deck not found!");return}console.log("[MP] Using deck:",t.name),document.getElementById("game-container").style.display="flex";var a=document.getElementById("main-menu");if(a&&a.classList.add("hidden"),typeof window.initMultiplayerGame=="function")window.initMultiplayerGame();else{console.error("[MP] initMultiplayerGame not found!");return}var n=window.game;if(!n){console.error("[MP] Game not initialized");return}var r=[],i=[];t.cards.forEach(function(m){var f=CardRegistry.getKindling(m.cardKey);if(f){i.push(Object.assign({},f,{foil:m.foil,instanceId:Math.random().toString(36).substr(2,9)}));return}var h=CardRegistry.getCryptid(m.cardKey)||CardRegistry.getBurst(m.cardKey)||CardRegistry.getTrap(m.cardKey)||CardRegistry.getAura(m.cardKey)||CardRegistry.getPyre(m.cardKey);h&&r.push(Object.assign({},h,{foil:m.foil,instanceId:Math.random().toString(36).substr(2,9)}))}),console.log("[MP] Deck:",r.length,"cards,",i.length,"kindling"),n.isMultiplayer=!0,n.multiplayerData=e,n.deck=r.slice();for(var o=n.deck.length-1;o>0;o--){var s=Math.floor(Math.random()*(o+1)),l=n.deck[o];n.deck[o]=n.deck[s],n.deck[s]=l}n.playerHand=[],n.enemyHand=[],n.playerField=[[null,null,null],[null,null,null]],n.enemyField=[[null,null,null],[null,null,null]],n.playerPyre=0,n.enemyPyre=0,n.playerTraps=[null,null],n.enemyTraps=[null,null],n.playerBurnPile=[],n.playerDiscardPile=[],n.enemyDeck=[],n.enemyBurnPile=[],n.enemyDiscardPile=[],i.length>0?(n.playerKindling=i,n.enemyKindling=[]):typeof DeckBuilder<"u"&&DeckBuilder.buildKindlingPool?(n.playerKindling=DeckBuilder.buildKindlingPool(),n.enemyKindling=[]):(n.playerKindling=[],n.enemyKindling=[]),Multiplayer.sendKindlingSync(i.length>0?i:n.playerKindling),n.playerDeaths=0,n.enemyDeaths=0,n.playerPyreBurnUsed=!1,n.enemyPyreBurnUsed=!1,n.currentTurn=e.goesFirst?"player":"enemy",n.phase=e.goesFirst?"conjure1":"waiting",n.turnNumber=1,e.goesFirst?(n.playerPyre=1,n.playerKindlingPlayedThisTurn=!1,n.playerPyreCardPlayedThisTurn=!1,GameEvents.emit("onTurnStart",{owner:"player",turnNumber:1}),GameEvents.emit("onPyreGained",{owner:"player",amount:1,source:"turnStart"})):(n.enemyPyre=1,n.enemyKindlingPlayedThisTurn=!1,n.enemyPyreCardPlayedThisTurn=!1),Multiplayer.isMyTurn=e.goesFirst;for(var o=0;o<7;o++)n.drawCard("player");var c=e.goesFirst?6:7;n.enemyHand=[];for(var o=0;o<c;o++)n.enemyHand.push({});Multiplayer.showMultiplayerUI(),Multiplayer.startTurnTimer(e.goesFirst),Multiplayer.updateTimerDisplay(),Multiplayer.applyPendingKindlingSync(),typeof renderAll=="function"&&renderAll(),typeof updateButtons=="function"&&updateButtons(),setTimeout(function(){typeof window.calculateTilePositions=="function"&&window.calculateTilePositions()},100),showMessage(e.goesFirst?"You go first!":(e.opponentName||"Opponent")+" goes first!"),console.log("[MP] Game started")}p(ia,"initializeMultiplayerMatch");console.log("[Multiplayer] System loaded");window.MultiplayerClient=window.Multiplayer});var xt=M(()=>{"use strict";var Ae={FADE_DURATION:400,PLAYER_STARTING_HAND:["pyre","dauntingPresence","terrify"],PLAYER_STARTING_KINDLING:["stormhawk","stormhawk","stormhawk"],ENEMY_TURN_1:[{action:"summon",card:"skinwalker",position:{col:"combat",row:1}}]},Te=[{id:"step_1",text:"Welcome to the world of Cryptid Fates. You are a conjurer. Summon nightmarish monsters and battle to the death.",type:"narrative",advance:"tap"},{id:"step_2",text:"The goal in Cryptid Fates is to kill 10 of the enemy's cryptids.",type:"narrative",advance:"tap"},{id:"step_3",text:"First, let us take a look at the battlefield.",type:"narrative",advance:"tap"},{id:"step_4",text:"This is the battlefield. You and your opponent will conjure monsters and traps here and manage them with spells.",type:"highlight",highlights:["#battlefield-area"],advance:"tap",position:"top"},{id:"step_5",text:"These columns closest to the center are the combat columns. Cryptids conjured to these columns are called Combatants.",type:"highlight",highlights:["#player-combat-col","#enemy-combat-col"],advance:"tap",position:"top"},{id:"step_6",text:"Cryptids in the Combat columns are able to use their Combat abilities written in orange.",type:"highlight",highlights:["#player-combat-col","#enemy-combat-col"],advance:"tap",position:"top"},{id:"step_7",text:"These columns behind the combat columns are the support columns. Cryptids conjured to these columns are called Supports.",type:"highlight",highlights:["#player-support-col","#enemy-support-col"],advance:"tap",position:"top"},{id:"step_8",text:"Cryptids in the Support columns are able to use their Support abilities written in green.",type:"highlight",highlights:["#player-support-col","#enemy-support-col"],advance:"tap",position:"top"},{id:"step_9",text:"These 2 slots at the back of each player's field are the trap slots. You may conjure a single trap to either slot which will automatically activate based on its activation conditions. The opposing player cannot see what traps you have played until they activate.",type:"highlight",highlights:["#player-trap-col","#enemy-trap-col"],advance:"tap",position:"top"},{id:"step_10",text:"Now, let's begin your turn.",type:"narrative",advance:"tap"},{id:"step_11",text:"At the beginning of the game, each player begins with 6 cards from their deck. During the draw phase, you draw 1 card and gain 1 default pyre.",type:"narrative",advance:"tap"},{id:"step_12",text:"Pyres are energy that allows you to play cryptid and spell cards from your hand.",type:"highlight",highlights:["#player-pyre"],advance:"tap",position:"top"},{id:"step_13",text:"The draw phase automatically occurs during a match. After that, you begin your first Conjuring Phase. During a conjuring phase, you may play cards from your hand if you can afford to. You may play 1 pyre card per turn. Pyre cards grant you even more pyres per turn to help you play stronger cards.",type:"narrative",advance:"tap"},{id:"step_14",text:"Go ahead and play the basic pyre from your hand. Click and drag the card from your hand and release it over the battlefield to use it.",type:"action",highlights:["#hand-container"],dragHighlights:["#battlefield-area"],allowedElements:["#hand-area","#battlefield-area"],allowedCardType:"pyre",requiredAction:{type:"playPyre"},advance:"action",position:"top"},{id:"step_15",text:"You started your turn with a default pyre. Now, you have another pyre from your basic pyre. You can spend these pyres on cards in your hand, but let's go ahead and save them for later.",type:"highlight",highlights:["#player-pyre"],advance:"tap",position:"top"},{id:"step_16",text:"You can save your pyres and still conjure a monster to your field by playing a Kindling Cryptid. Kindling Cryptids are special cryptids that are free to play, but you may only conjure 1 kindling cryptid per turn.",type:"narrative",advance:"tap"},{id:"step_17",text:"Keep in mind, Kindling cryptids are much weaker than other cryptids. They exist to keep you in the game. If your enemy attacks you and you have no cryptids on your side of the battlefield, a random kindling cryptid from your kindling hand will be played for you automatically at the enemy's choice of combat slot.",type:"narrative",advance:"tap"},{id:"step_18",text:"Now, click the combat menu button to pull up your combat options.",type:"action",highlights:["#hand-menu-btn"],allowedElements:["#hand-menu-btn"],requiredAction:{type:"openMenu"},advance:"action"},{id:"step_19",text:"Click the kindling button to bring up your kindling hand.",type:"action",highlights:["#menu-kindling-btn"],allowedElements:["#menu-kindling-btn","#hand-menu-panel",".menu-action-btn","#kindling-toggle-btn"],requiredAction:{type:"switchKindling"},advance:"action"},{id:"step_20",text:"These are your kindling cryptids. Notice they cost 0 pyres each. You must have 10 kindling cryptids in your deck to play, but you may have more.",type:"highlight",highlights:["#hand-container"],advance:"tap",position:"top"},{id:"step_21",text:"Click and drag a kindling cryptid from your hand and place it on one of the combat slots on your side of the battlefield.",type:"action",highlights:["#hand-container"],dragHighlights:["#player-combat-col"],allowedElements:["#hand-area","#player-combat-col",".game-card",".tile"],requiredAction:{type:"summon",position:"combat"},advance:"action",position:"top"},{id:"step_22",text:"Now, you are not defenseless! Now, click the next phase button to move on to the next phase, which is the combat phase.",type:"action",highlights:["#advance-phase-btn"],allowedElements:["#advance-phase-btn"],requiredAction:{type:"advancePhase"},advance:"action"},{id:"step_23",text:"During each player's first turn, your cryptids cannot attack. For now, let's click the phase button again to go on to Conjuring Phase II.",type:"action",highlights:["#advance-phase-btn"],allowedElements:["#advance-phase-btn"],requiredAction:{type:"advancePhase"},advance:"action"},{id:"step_24",text:"Conjuring Phase II is your last chance to play cards if you would like to. Let's go ahead and spend our pyres. First, play the aura card in your hand to permanently buff your Stormhawk.",type:"action",highlights:["#hand-container"],dragHighlights:["#player-combat-col"],allowedElements:["#hand-area","#player-combat-col",".tile",".cryptid-sprite"],allowedCardType:"aura",requiredAction:{type:"playAura"},advance:"action",position:"top",onShow:p(()=>{window.ui&&(ui.showingKindling=!1,typeof renderHand=="function"&&renderHand())},"onShow")},{id:"step_25",text:"Now, play the trap card in your hand by dragging it from your hand to one of your trap slots.",type:"action",highlights:["#hand-container"],dragHighlights:["#player-trap-col"],allowedElements:["#hand-area","#player-trap-col",".tile"],allowedCardType:"trap",requiredAction:{type:"playTrap"},advance:"action",position:"top"},{id:"step_26",text:"You're out of pyres. Now, click the phase button - If the phase is Conjuring Phase II, clicking the phase button will end your turn.",type:"action",highlights:["#advance-phase-btn"],allowedElements:["#advance-phase-btn"],requiredAction:{type:"endTurn"},advance:"action"},{id:"step_27",text:"The opponent has summoned a cryptid to the field. Let's take a look at its stats.",type:"highlight",highlights:["#enemy-combat-col"],advance:"tap",position:"bottom",onShow:p(()=>{setTimeout(()=>{ne.executeEnemyTurn()},300)},"onShow"),delay:1500},{id:"step_28",text:"The top number in red is the cryptid's attack power. It deals this much damage to any cryptid it attacks. The bottom number is its Health points. That's how much damage it can take before dying.",type:"highlight",highlights:["#enemy-combat-col"],advance:"tap",position:"bottom"},{id:"step_29",text:"The enemy cannot attack this turn as it is their first turn. So, they will pass their turn onto us now.",type:"narrative",advance:"tap",onShow:p(()=>{setTimeout(()=>{ne.endEnemyTurn()},500)},"onShow")}],W={dialogueElement:null,highlightElements:[],stylesInjected:!1,currentAllowedCardType:null,handObserver:null,init(){this.injectStyles(),this.createDialogue(),this.setupHandObserver()},setupHandObserver(){let e=document.getElementById("hand-container");e&&(this.handObserver=new MutationObserver(t=>{this.currentAllowedCardType&&t.some(n=>n.type==="childList"&&(n.addedNodes.length>0||n.removedNodes.length>0))&&(clearTimeout(this.blockingDebounce),this.blockingDebounce=setTimeout(()=>{this.applyCardBlocking()},50))}),this.handObserver.observe(e,{childList:!0,subtree:!0}))},injectStyles(){if(this.stylesInjected)return;this.stylesInjected=!0;let e=document.createElement("style");e.id="tutorial-styles",e.textContent=`
            .tutorial-highlight {
                position: absolute;
                border: 4px solid rgba(232, 169, 62, 0.9);
                border-radius: 12px;
                pointer-events: none;
                z-index: 10000;
                animation: tutorialHighlight 2s ease-in-out infinite;
                box-shadow:
                    0 0 30px 10px rgba(232, 169, 62, 0.4),
                    inset 0 0 20px rgba(232, 169, 62, 0.1);
            }

            @keyframes tutorialHighlight {
                0%, 100% {
                    border-color: rgba(232, 169, 62, 0.9);
                    box-shadow:
                        0 0 30px 10px rgba(232, 169, 62, 0.4),
                        inset 0 0 20px rgba(232, 169, 62, 0.1);
                }
                50% {
                    border-color: rgba(232, 169, 62, 1);
                    box-shadow:
                        0 0 50px 20px rgba(232, 169, 62, 0.6),
                        inset 0 0 30px rgba(232, 169, 62, 0.2);
                }
            }

            .tutorial-drag-highlight {
                position: absolute;
                border: 3px dashed rgba(100, 200, 100, 0.9);
                border-radius: 12px;
                background: rgba(100, 200, 100, 0.1);
                pointer-events: none;
                z-index: 10000;
                animation: dragHighlight 1.5s ease-in-out infinite;
            }

            @keyframes dragHighlight {
                0%, 100% {
                    border-color: rgba(100, 200, 100, 0.9);
                    box-shadow: 0 0 20px 5px rgba(100, 200, 100, 0.3);
                }
                50% {
                    border-color: rgba(100, 200, 100, 1);
                    box-shadow: 0 0 40px 10px rgba(100, 200, 100, 0.5);
                }
            }

            .tutorial-dialogue {
                position: fixed;
                left: 50%;
                transform: translateX(-50%);
                max-width: 650px;
                width: 90%;
                padding: 28px 36px;
                background: linear-gradient(180deg, rgba(20, 18, 25, 0.98) 0%, rgba(12, 10, 15, 0.98) 100%);
                border: 2px solid rgba(232, 169, 62, 0.6);
                border-radius: 12px;
                box-shadow:
                    0 10px 40px rgba(0, 0, 0, 0.6),
                    0 0 60px rgba(232, 169, 62, 0.1);
                z-index: 10001;
                opacity: 0;
                transition: opacity 0.4s ease;
            }

            .tutorial-dialogue.visible {
                opacity: 1;
            }

            .tutorial-dialogue.top { top: 60px; }
            .tutorial-dialogue.center { top: 50%; transform: translate(-50%, -50%); }
            .tutorial-dialogue.bottom { bottom: 200px; }

            .dialogue-text {
                color: #e8dcc8;
                font-family: 'EB Garamond', Georgia, serif;
                font-size: 19px;
                line-height: 1.7;
                text-align: center;
                margin-bottom: 20px;
            }

            .dialogue-prompt {
                color: rgba(232, 169, 62, 0.8);
                font-family: 'Cinzel', serif;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 3px;
                text-align: center;
            }

            .tutorial-skip-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(30, 25, 35, 0.95);
                border: 1px solid rgba(232, 169, 62, 0.3);
                color: rgba(232, 169, 62, 0.8);
                padding: 12px 24px;
                border-radius: 6px;
                font-family: 'Cinzel', serif;
                font-size: 11px;
                letter-spacing: 2px;
                text-transform: uppercase;
                cursor: pointer;
                z-index: 10002;
                transition: all 0.3s;
            }

            .tutorial-skip-btn:hover {
                background: rgba(232, 169, 62, 0.15);
                border-color: rgba(232, 169, 62, 0.6);
                color: rgba(232, 169, 62, 1);
            }

            /* Blocked cards during tutorial - cannot be interacted with */
            .tutorial-card-blocked {
                opacity: 0.35 !important;
                pointer-events: none !important;
                filter: grayscale(60%) !important;
                transform: scale(0.95) !important;
                transition: all 0.3s ease !important;
            }

            .tutorial-card-blocked::after {
                content: '';
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.3);
                border-radius: inherit;
                pointer-events: none;
            }

            /* Allowed cards during tutorial - visually highlighted */
            .tutorial-card-allowed {
                box-shadow: 0 0 20px rgba(232, 169, 62, 0.6) !important;
                border-color: rgba(232, 169, 62, 0.8) !important;
                animation: tutorialCardPulse 2s ease-in-out infinite !important;
            }

            @keyframes tutorialCardPulse {
                0%, 100% {
                    box-shadow: 0 0 20px rgba(232, 169, 62, 0.6);
                }
                50% {
                    box-shadow: 0 0 30px rgba(232, 169, 62, 0.8);
                }
            }
        `,document.head.appendChild(e)},createDialogue(){if(this.dialogueElement)return;let e=document.createElement("div");e.className="tutorial-dialogue center",e.innerHTML=`
            <div class="dialogue-text"></div>
            <div class="dialogue-prompt">Tap to continue</div>
        `,document.body.appendChild(e),this.dialogueElement=e;let t=document.createElement("button");t.className="tutorial-skip-btn",t.textContent="Skip Tutorial",t.onclick=a=>{a.stopPropagation(),bt.skip()},document.body.appendChild(t),this.skipBtn=t},showDialogue(e,t="center",a="Tap to continue"){let n=this.dialogueElement;n.className="tutorial-dialogue "+t,n.querySelector(".dialogue-text").textContent=e,n.querySelector(".dialogue-prompt").textContent=a,n.classList.add("visible")},hideDialogue(){this.dialogueElement?.classList.remove("visible")},addHighlight(e){let t=document.querySelector(e);if(!t){console.warn("[Tutorial] Highlight target not found:",e);return}let a=t.getBoundingClientRect(),n=8,r=document.createElement("div");r.className="tutorial-highlight",r.style.left=a.left-n+"px",r.style.top=a.top-n+"px",r.style.width=a.width+n*2+"px",r.style.height=a.height+n*2+"px",document.body.appendChild(r),this.highlightElements.push(r)},addDragHighlight(e){let t=document.querySelector(e);if(!t)return;let a=t.getBoundingClientRect(),n=8,r=document.createElement("div");r.className="tutorial-drag-highlight",r.style.left=a.left-n+"px",r.style.top=a.top-n+"px",r.style.width=a.width+n*2+"px",r.style.height=a.height+n*2+"px",document.body.appendChild(r),this.highlightElements.push(r)},clearHighlights(){this.highlightElements.forEach(e=>e.remove()),this.highlightElements=[]},blockAllCards(){this.currentAllowedCardType="__NONE__",requestAnimationFrame(()=>{this.applyCardBlocking()})},blockWrongCards(e){if(!e){this.blockAllCards();return}this.currentAllowedCardType=e,requestAnimationFrame(()=>{this.applyCardBlocking()})},applyCardBlocking(){let e=this.currentAllowedCardType;if(!e)return;document.querySelectorAll("#hand-container .game-card").forEach(n=>{if(e==="__NONE__"){n.classList.add("tutorial-card-blocked");return}let r=null;n.classList.contains("pyre-card")?r="pyre":n.classList.contains("aura-card")?r="aura":n.classList.contains("trap-card")?r="trap":n.classList.contains("burst-card")?r="burst":n.classList.contains("kindling-card")?r="kindling":n.classList.contains("cryptid-card")&&(r="cryptid");let i=!1;(e===r||e==="cryptid"&&(r==="kindling"||r==="cryptid"))&&(i=!0),!i&&r!==null?(n.classList.add("tutorial-card-blocked"),n.classList.remove("tutorial-card-allowed")):(n.classList.remove("tutorial-card-blocked"),n.classList.remove("unplayable"),n.classList.add("tutorial-card-allowed"))}),console.log("[Tutorial] Applied card blocking:",e==="__NONE__"?"ALL BLOCKED":e)},unblockAllCards(){document.querySelectorAll(".tutorial-card-blocked").forEach(e=>{e.classList.remove("tutorial-card-blocked")}),document.querySelectorAll(".tutorial-card-allowed").forEach(e=>{e.classList.remove("tutorial-card-allowed")}),this.currentAllowedCardType=null,console.log("[Tutorial] Unblocked all cards")},destroy(){this.clearHighlights(),this.unblockAllCards(),this.handObserver&&(this.handObserver.disconnect(),this.handObserver=null),clearTimeout(this.blockingDebounce),this.dialogueElement?.remove(),this.skipBtn?.remove(),document.getElementById("tutorial-styles")?.remove(),this.dialogueElement=null,this.stylesInjected=!1,this.currentAllowedCardType=null}},ne={setPlayerKindling(e){if(!window.game)return;let t=[],a=9e3;e.forEach(n=>{let r=CardRegistry.getKindling(n);r&&t.push({...r,key:n,id:a++,owner:"player"})}),game.playerKindling=t,console.log("[TutorialBattle] Set kindling:",t.map(n=>n.name))},setPlayerHand(e){if(!window.game)return;let t=[],a=9100;e.forEach(n=>{let r=CardRegistry.getPyre?.(n)||CardRegistry.getAura?.(n)||CardRegistry.getTrap?.(n)||CardRegistry.getBurst?.(n)||CardRegistry.getCryptid?.(n)||CardRegistry.getKindling?.(n);r?t.push({...r,key:n,id:a++,owner:"player"}):console.error("[TutorialBattle] Card not found:",n)}),game.playerHand=t,console.log("[TutorialBattle] Set hand:",t.map(n=>n.name)),typeof renderHand=="function"&&renderHand()},executeEnemyTurn(){console.log("[TutorialBattle] Executing enemy turn"),window.game&&Ae.ENEMY_TURN_1.forEach((e,t)=>{setTimeout(()=>{e.action==="summon"&&this.enemySummon(e.card,e.position)},t*800+500)})},enemySummon(e,t){if(console.log("[TutorialBattle] Enemy summoning:",e),!window.game)return;let a=CardRegistry.getKindling(e)||CardRegistry.getCryptid(e);if(!a){console.error("[TutorialBattle] Card not found:",e);return}let n=t.col==="combat"?game.getCombatCol("enemy"):game.getSupportCol("enemy"),r=t.row,i={...a,key:e,id:e+"_enemy_"+Date.now(),owner:"enemy",col:n,row:r,currentHp:a.hp,currentAtk:a.atk,maxHp:a.hp,tapped:!1,canAttack:!0};game.enemyField[n][r]=i,typeof renderField=="function"&&renderField(),i.onSummon&&i.onSummon(i,"enemy",game),GameEvents.emit("onSummon",{cryptid:i,owner:"enemy"}),console.log("[TutorialBattle] Enemy summoned:",i.name)},endEnemyTurn(){console.log("[TutorialBattle] Ending enemy turn"),window.game&&(game.startTurn("player"),typeof renderAll=="function"&&renderAll(),typeof updateButtons=="function"&&updateButtons())}},bt={isActive:!1,freePlayMode:!1,currentStepIndex:0,clickBlocker:null,actionCleanup:null,dragHandler:null,async start(){console.log("[TutorialManager] Starting tutorial..."),this.isActive=!0,this.freePlayMode=!1,this.currentStepIndex=0,W.init(),await this.initGame(),this.setupClickBlocker(),this.setupDragHandler(),this.showStep(0)},async initGame(){console.log("[TutorialManager] Initializing game..."),["main-menu","home-screen","login-screen","loading-screen","fullscreen-prompt"].forEach(t=>{let a=document.getElementById(t);a&&(a.style.display="none",a.classList.add("hidden"))});let e=document.getElementById("game-container");e&&(e.classList.remove("hidden"),e.style.cssText="display: flex !important; visibility: visible !important; opacity: 1 !important;"),window.playerGoesFirst=!0,window.isTutorial=!0,window.selectedPlayerDeck={name:"Tutorial Deck",series:"forests-of-fear",cards:[{key:"pyre",count:4},{key:"dauntingPresence",count:2},{key:"terrify",count:2},{key:"stormhawk",count:10}]},typeof window.initGame=="function"&&window.initGame(),await new Promise(t=>setTimeout(t,300)),window.game&&(ne.setPlayerKindling(Ae.PLAYER_STARTING_KINDLING),ne.setPlayerHand(Ae.PLAYER_STARTING_HAND),typeof renderHand=="function"&&renderHand(),typeof renderAll=="function"&&renderAll()),console.log("[TutorialManager] Game initialized")},setupClickBlocker(){this.clickBlocker=e=>{if(!this.isActive)return;let t=Te[this.currentStepIndex];if(!t||e.target.closest(".tutorial-skip-btn"))return;if(e.target.closest(".tutorial-dialogue")){t.advance==="tap"&&(e.type==="click"||e.type==="touchend")&&(e.preventDefault(),e.stopPropagation(),this.nextStep());return}if(e.target.closest(".tutorial-card-blocked")){e.preventDefault(),e.stopPropagation(),console.log("[Tutorial] Blocked interaction with non-allowed card");return}if((e.type==="mousedown"||e.type==="touchstart")&&t.dragHighlights){let n=e.target.closest(".game-card");n&&!n.classList.contains("tutorial-card-blocked")&&t.dragHighlights.forEach(r=>W.addDragHighlight(r))}if(t.advance==="tap"&&(e.type==="click"||e.type==="touchend")){e.preventDefault(),e.stopPropagation(),this.nextStep();return}t.advance==="action"&&t.allowedElements&&(t.allowedElements.some(r=>e.target.closest(r))||(e.preventDefault(),e.stopPropagation()))},this.dragEndHandler=()=>{document.querySelectorAll(".tutorial-drag-highlight").forEach(e=>e.remove())},document.addEventListener("mousedown",this.clickBlocker,!0),document.addEventListener("touchstart",this.clickBlocker,!0),document.addEventListener("click",this.clickBlocker,!0),document.addEventListener("touchend",this.clickBlocker,!0),document.addEventListener("mouseup",this.dragEndHandler,!0),document.addEventListener("touchend",this.dragEndHandler,!0)},setupDragHandler(){},showStep(e){if(this.actionCleanup&&(this.actionCleanup(),this.actionCleanup=null),e>=Te.length){this.complete();return}this.currentStepIndex=e;let t=Te[e];console.log("[TutorialManager] Step",e+1,":",t.id),W.clearHighlights(),t.onShow&&t.onShow();let a=p(()=>{t.highlights&&t.highlights.forEach(i=>W.addHighlight(i)),t.allowedCardType?W.blockWrongCards(t.allowedCardType):W.blockAllCards();let n=t.position||"center",r=t.advance==="action"?"Complete the action":"Tap to continue";W.showDialogue(t.text,n,r),t.advance==="action"&&this.waitForAction(t)},"showStepContent");t.delay?setTimeout(a,t.delay):a()},nextStep(){this.showStep(this.currentStepIndex+1)},waitForAction(e){let t=e.requiredAction,a=!1;if(console.log("[TutorialManager] Waiting for:",t),t.type==="openMenu"){let i=document.getElementById("hand-menu-btn"),o=p(()=>{a||(a=!0,i?.removeEventListener("click",o),setTimeout(()=>this.nextStep(),300))},"handler");i?.addEventListener("click",o),this.actionCleanup=()=>i?.removeEventListener("click",o);return}if(t.type==="switchKindling"){let i=document.getElementById("menu-kindling-btn"),o=document.getElementById("hand-menu-panel"),s=document.getElementById("hand-menu-btn"),c=!(ui?.showingKindling||!1),m=p(()=>{if(a)return;a=!0,o?.classList.remove("open"),s?.classList.remove("menu-open");let f=0,h=20,u=p(()=>{f++,console.log("[Tutorial] Checking kindling state, attempt:",f,"current:",ui?.showingKindling,"target:",c),ui?.showingKindling===c?(i?.removeEventListener("click",m),console.log("[Tutorial] Kindling switch complete, now showing:",ui.showingKindling),setTimeout(()=>this.nextStep(),100)):f>=h?(console.warn("[Tutorial] Kindling switch timed out, forcing next step"),i?.removeEventListener("click",m),setTimeout(()=>this.nextStep(),100)):setTimeout(u,50)},"checkState");setTimeout(u,350)},"handler");i?.addEventListener("click",m),this.actionCleanup=()=>i?.removeEventListener("click",m);return}if(t.type==="advancePhase"){let i=document.getElementById("advance-phase-btn"),o=p(()=>{a||(a=!0,i?.removeEventListener("click",o),setTimeout(()=>this.nextStep(),400))},"handler");i?.addEventListener("click",o),this.actionCleanup=()=>i?.removeEventListener("click",o);return}if(t.type==="endTurn"){let i=document.getElementById("advance-phase-btn"),o=p(()=>{a||(a=!0,i?.removeEventListener("click",o),setTimeout(()=>this.nextStep(),400))},"handler");i?.addEventListener("click",o),this.actionCleanup=()=>i?.removeEventListener("click",o);return}let n=p(i=>{if(a)return;let o=!1;t.type==="playPyre"&&(i.card?.type==="pyre"||i.type==="pyre")&&(o=!0),t.type==="playAura"&&(i.card?.type==="aura"||i.aura?.type==="aura")&&(o=!0),t.type==="playTrap"&&(i.card?.type==="trap"||i.trap?.type==="trap")&&(o=!0),t.type==="summon"&&i.cryptid&&i.owner==="player"&&(!t.position||t.position==="combat"&&!i.isSupport||t.position==="support"&&i.isSupport)&&(o=!0),o&&(a=!0,console.log("[TutorialManager] Action completed:",t.type),r(),setTimeout(()=>this.nextStep(),400))},"eventHandler");GameEvents.on("onPyreCardPlayed",n),GameEvents.on("onSummon",n),GameEvents.on("onAuraApplied",n),GameEvents.on("onTrapSet",n);let r=p(()=>{GameEvents.off("onPyreCardPlayed",n),GameEvents.off("onSummon",n),GameEvents.off("onAuraApplied",n),GameEvents.off("onTrapSet",n)},"cleanup");this.actionCleanup=r},skip(){this.complete()},complete(){console.log("[TutorialManager] Tutorial complete"),this.isActive=!1,this.clickBlocker&&(document.removeEventListener("mousedown",this.clickBlocker,!0),document.removeEventListener("touchstart",this.clickBlocker,!0),document.removeEventListener("click",this.clickBlocker,!0),document.removeEventListener("touchend",this.clickBlocker,!0)),this.dragEndHandler&&(document.removeEventListener("mouseup",this.dragEndHandler,!0),document.removeEventListener("touchend",this.dragEndHandler,!0)),this.actionCleanup&&this.actionCleanup(),W.destroy(),typeof MainMenu<"u"&&MainMenu.show&&MainMenu.show()}};window.TutorialManager=bt;window.TutorialBattle=ne;window.TutorialOverlay=W;console.log("[Tutorial] Module loaded")});var wt=M(()=>{"use strict";window.HomeScreen={isOpen:!1,init(){this.createHTML(),this.bindEvents(),PlayerData.init(),PlayerData.showWelcome?(this.showWelcomeScreen(),PlayerData.showWelcome=!1):this.open()},createHTML(){let e=document.createElement("div");e.id="home-screen",e.innerHTML=`
            <!-- Ember Particle Canvas -->
            <canvas id="ember-particles" class="ember-canvas"></canvas>
            
            <!-- Minimal Top Bar -->
            <div class="home-topbar">
                <div class="top-left">
                    <div class="profile-chip">
                        <img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="profile-avatar embers-img" alt="">
                        <span class="profile-name">Summoner</span>
                        <span class="profile-level" id="home-level">Lv.1</span>
                    </div>
                </div>
                <div class="top-right">
                    <div class="currency-chip embers" onclick="Shop.open()">
                        <img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="c-icon embers-img" alt=""><span class="c-val" id="home-embers">0</span>
                    </div>
                    <div class="currency-chip souls" onclick="Shop.open()">
                        <span class="c-icon">\u{1F49C}</span><span class="c-val" id="home-souls">0</span>
                    </div>
                    <div class="top-divider"></div>
                    <button class="icon-btn" id="btn-fullscreen" title="Fullscreen">\u26F6</button>
                    <button class="icon-btn" id="btn-settings" title="Settings">\u2699</button>
                </div>
            </div>
            
            <!-- Center: Logo -->
            <div class="home-center">
                <div class="logo-container">
                    <div class="logo-glow"></div>
                    <img src="https://f.playcode.io/p-2633929/v-1/019b6b76-7683-700d-ba87-187753d937e6/new-logo.png" alt="Cryptid Fates" class="logo-image">
                </div>
                
                <!-- Stats Row (subtle, under logo) -->
                <div class="stats-row">
                    <div class="stat"><span class="stat-val" id="home-wins">0</span><span class="stat-lbl">Wins</span></div>
                    <div class="stat-div"></div>
                    <div class="stat"><span class="stat-val" id="home-losses">0</span><span class="stat-lbl">Losses</span></div>
                    <div class="stat-div"></div>
                    <div class="stat"><span class="stat-val" id="home-winrate">0%</span><span class="stat-lbl">Rate</span></div>
                    <div class="streak-chip" id="streak-display"><img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img" alt=""><span id="home-streak">0</span></div>
                </div>
            </div>
            
            <!-- Bottom: Menu Bar -->
            <div class="home-menubar">
                <div class="menu-btn" id="tile-quickplay"></div>
                <div class="menu-btn" id="tile-decks"></div>
                <div class="menu-btn" id="tile-shop">
                    <span class="btn-badge" id="shop-badge"></span>
                </div>
                <div class="menu-btn" id="tile-collection"></div>
            </div>
            
            <!-- Footer -->
            <div class="home-footer">
                <span>v0.1 Beta</span>
                <span class="foot-link" id="btn-help">How to Play</span>
                <span class="foot-link" id="btn-credits">Credits</span>
            </div>
        `,document.body.appendChild(e),this.createQuickPlayModal(),this.createWelcomeScreen()},createQuickPlayModal(){let e=document.createElement("div");e.id="quickplay-modal",e.className="qp-modal",e.innerHTML=`
            <div class="qp-backdrop"></div>
            <div class="qp-content">
                <div class="qp-header">
                    <span class="qp-title">\u2694\uFE0F Battle</span>
                    <button class="qp-close" id="qp-close">\xD7</button>
                </div>
                
                <div class="qp-section">
                    <div class="qp-section-title">\u{1F916} Solo</div>
                    <div class="qp-mode" id="qp-ai">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">\u{1F9E0}</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Play vs AI</div>
                                <div class="qp-mode-desc">Practice against the Warden</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="qp-section">
                    <div class="qp-section-title">\u{1F465} Multiplayer</div>
                    <div class="qp-mode" id="qp-bo1">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">\u2694\uFE0F</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Quick Match</div>
                                <div class="qp-mode-desc">Best of 1 \u2022 ~8 minutes</div>
                            </div>
                        </div>
                        <div class="qp-mode-rewards">
                            <span class="reward-item"><img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img" alt=""> 15</span>
                            <span class="reward-item">\u2B50 20 XP</span>
                        </div>
                    </div>
                    <div class="qp-mode" id="qp-bo3">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">\u{1F3C6}</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Ranked Match</div>
                                <div class="qp-mode-desc">Best of 3 \u2022 ~20 minutes</div>
                            </div>
                        </div>
                        <div class="qp-mode-rewards">
                            <span class="reward-item"><img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img" alt=""> 30</span>
                            <span class="reward-item">\u2B50 50 XP</span>
                        </div>
                    </div>
                </div>
                
                <div class="qp-queue" id="qp-queue">
                    <div class="qp-queue-spinner"></div>
                    <div class="qp-queue-text">
                        <span id="qp-status">Searching for opponent...</span>
                        <span class="qp-queue-timer" id="qp-timer">0:00</span>
                    </div>
                    <button class="qp-btn cancel" id="qp-cancel">Cancel</button>
                </div>
            </div>
        `,document.body.appendChild(e)},createWelcomeScreen(){let e=document.createElement("div");e.id="welcome-screen",e.innerHTML=`
            <div class="welcome-content">
                <div class="welcome-logo">
                    <img src="https://f.playcode.io/p-2633929/v-1/019b6b76-7683-700d-ba87-187753d937e6/new-logo.png" alt="Cryptid Fates">
                </div>
                <h2 class="welcome-title">Welcome, Summoner</h2>
                <p class="welcome-text">Choose your starter deck to begin your journey.</p>
                
                <div class="starter-deck-selection" id="starter-decks">
                    <div class="starter-deck" data-deck="city-of-flesh">
                        <div class="starter-deck-icon">\u{1F3DA}\uFE0F</div>
                        <div class="starter-deck-name">City of Flesh</div>
                        <div class="starter-deck-desc">Vampires, gargoyles, and nightmares lurk in the shadows.</div>
                        <div class="starter-deck-theme">Blood & Steel \u2022 Status Effects</div>
                    </div>
                    <div class="starter-deck" data-deck="diabolical-desert">
                        <div class="starter-deck-icon">\u{1F3DC}\uFE0F</div>
                        <div class="starter-deck-name">Diabolical Desert</div>
                        <div class="starter-deck-desc">Ancient horrors rise from scorching sands and forgotten tombs.</div>
                        <div class="starter-deck-theme">Coming Soon</div>
                    </div>
                    <div class="starter-deck" data-deck="forests-of-fear">
                        <div class="starter-deck-icon">\u{1F332}</div>
                        <div class="starter-deck-name">Forests of Fear</div>
                        <div class="starter-deck-desc">Wendigos, werewolves, and forest spirits hunger for prey.</div>
                        <div class="starter-deck-theme">Nature & Blood \u2022 Evolution</div>
                    </div>
                </div>
                
                <button class="welcome-btn disabled" id="welcome-continue" disabled>Select a Deck</button>
            </div>
        `,document.body.appendChild(e)},selectedStarterDeck:null,showWelcomeScreen(){let e=document.getElementById("welcome-screen");e.classList.add("open"),setTimeout(()=>{document.querySelectorAll(".starter-deck").forEach((t,a)=>{setTimeout(()=>t.classList.add("show"),a*150)})},400),document.querySelectorAll(".starter-deck").forEach(t=>{t.onclick=()=>{document.querySelectorAll(".starter-deck").forEach(n=>n.classList.remove("selected")),t.classList.add("selected"),this.selectedStarterDeck=t.dataset.deck;let a=document.getElementById("welcome-continue");a.disabled=!1,a.classList.remove("disabled"),a.textContent="Begin with "+t.querySelector(".starter-deck-name").textContent}}),document.getElementById("welcome-continue").onclick=t=>{if(!this.selectedStarterDeck)return;let a=t.currentTarget;this.grantStarterDeck(this.selectedStarterDeck),a.style.transform="scale(0.95)",a.style.boxShadow="0 0 60px rgba(200, 200, 220, 0.4)",a.disabled=!0,setTimeout(()=>{a.style.transition="all 0.4s ease-out",a.style.opacity="0",a.style.transform="scale(1.05)",document.querySelectorAll(".starter-deck").forEach((n,r)=>{n.style.transition="all 0.5s ease-out",n.style.transitionDelay=`${r*.08}s`,n.style.opacity="0",n.style.transform="translateY(-40px) scale(0.8)"}),e.classList.add("transitioning")},100),setTimeout(()=>{document.getElementById("home-screen").classList.add("open"),document.getElementById("home-screen").classList.add("entering")},400),setTimeout(()=>{e.classList.remove("open"),e.classList.remove("transitioning"),document.getElementById("home-screen").classList.remove("entering"),this.isOpen=!0,this.updateDisplay()},900)}},grantStarterDeck(e){let a={"city-of-flesh":{cryptids:["rooftopGargoyle","libraryGargoyle","vampireInitiate","elderVampire","sewerAlligator","kuchisakeOnna","hellhound","mothman","bogeyman","theFlayer","mutatedRat"],kindling:["myling","shadowPerson","hellhoundPup","elDuende","boggart"],pyres:["pyre","freshKill","ratKing","nightfall"],traps:["crossroads","bloodCovenant","turnToStone"],bursts:["wakingNightmare","faceOff"],auras:["antiVampiricBlade"]},"forests-of-fear":{cryptids:["matureWendigo","primalWendigo","thunderbird","adultBigfoot","werewolf","lycanthrope","snipe","rogueRazorback","notDeer","jerseyDevil","babaYaga","skinwalker"],kindling:["newbornWendigo","stormhawk","adolescentBigfoot","cursedHybrid","deerWoman"],pyres:["burialGround","cursedWoods","animalPelts"],traps:["terrify","hunt"],bursts:["fullMoon"],auras:["dauntingPresence","sproutWings","weaponizedTree","insatiableHunger"]},"diabolical-desert":{cryptids:[],kindling:[],pyres:["pyre"],traps:[],bursts:[],auras:[]}}[e];if(!a)return;let n=p((r,i=2)=>{r.forEach(o=>{PlayerData.addToCollection(o,i)})},"grantCards");n(a.cryptids,2),n(a.kindling,3),n(a.pyres,4),n(a.traps,2),n(a.bursts,2),n(a.auras,2),PlayerData.decks.length===0&&PlayerData.createStarterDeck(e),PlayerData.starterDeck=e,PlayerData.save()},bindEvents(){console.log("[HomeScreen] Binding events..."),document.getElementById("tile-decks").onclick=r=>this.animatedPress(r.currentTarget,()=>this.openDeckBuilder()),document.getElementById("tile-shop").onclick=r=>this.animatedPress(r.currentTarget,()=>this.openShop()),document.getElementById("tile-collection").onclick=r=>this.animatedPress(r.currentTarget,()=>this.openCollection());let e=document.getElementById("tile-quickplay");console.log("[HomeScreen] Quick Play button:",e),e&&(e.onclick=r=>this.animatedPress(r.currentTarget,()=>this.openQuickPlay()));let t=document.getElementById("qp-close"),a=document.getElementById("qp-cancel"),n=document.querySelector(".qp-backdrop");t&&(t.onclick=()=>this.closeQuickPlay()),a&&(a.onclick=()=>this.cancelQueue()),n&&(n.onclick=r=>{this.queueTimer||this.closeQuickPlay()}),document.getElementById("qp-ai")?.addEventListener("click",()=>this.startAIGame()),document.getElementById("qp-bo1")?.addEventListener("click",()=>this.startQuickPlay("bo1")),document.getElementById("qp-bo3")?.addEventListener("click",()=>this.startQuickPlay("bo3")),document.getElementById("btn-settings").onclick=()=>this.openSettings(),document.getElementById("btn-help").onclick=()=>this.openHelp(),document.getElementById("btn-credits").onclick=()=>this.openCredits(),document.getElementById("btn-fullscreen").onclick=()=>this.toggleFullscreen(),console.log("[HomeScreen] Events bound successfully")},animatedPress(e,t){if(!e||e.classList.contains("pressing"))return;e.classList.add("pressing");let a=document.createElement("div");a.className="btn-burst",e.appendChild(a),setTimeout(()=>a.remove(),600),setTimeout(()=>{e.classList.remove("pressing"),t&&t()},250)},open(){this.isOpen=!0,this.updateDisplay(),document.getElementById("home-screen").classList.add("open"),this.initEmberParticles(),typeof MainMenu<"u"&&document.getElementById("main-menu")?.classList.add("hidden"),document.getElementById("game-container").style.display="none"},close(){this.isOpen=!1,document.getElementById("home-screen").classList.remove("open"),this.stopEmberParticles()},updateDisplay(){document.getElementById("home-level").textContent=`Lv.${PlayerData.level}`,document.getElementById("home-embers").textContent=(PlayerData.embers||0).toLocaleString(),document.getElementById("home-souls").textContent=(PlayerData.souls||0).toLocaleString(),document.getElementById("home-wins").textContent=PlayerData.stats.wins,document.getElementById("home-losses").textContent=PlayerData.stats.losses;let e=PlayerData.stats.gamesPlayed>0?Math.round(PlayerData.stats.wins/PlayerData.stats.gamesPlayed*100):0;document.getElementById("home-winrate").textContent=`${e}%`;let t=document.getElementById("streak-display"),a=document.getElementById("home-streak");PlayerData.stats.winStreak>0?(t.classList.add("active"),a.textContent=PlayerData.stats.winStreak):t.classList.remove("active");let n=document.getElementById("shop-badge");PlayerData.pendingBoosters>0?(n.classList.add("show"),n.textContent=PlayerData.pendingBoosters):n.classList.remove("show")},queueTimer:null,queueStartTime:null,openQuickPlay(){console.log("[QuickPlay] Opening modal..."),document.getElementById("qp-queue").classList.remove("active"),document.getElementById("qp-timer").textContent="0:00",document.getElementById("quickplay-modal").classList.add("open");let e=PlayerData.decks.find(t=>PlayerData.validateDeck(t).valid);document.getElementById("qp-ai").classList.remove("disabled"),e?(document.getElementById("qp-bo1").classList.remove("disabled"),document.getElementById("qp-bo3").classList.remove("disabled")):(document.getElementById("qp-bo1").classList.add("disabled"),document.getElementById("qp-bo3").classList.add("disabled"))},closeQuickPlay(){document.getElementById("quickplay-modal").classList.remove("open"),this.stopQueueTimer(),typeof window.Multiplayer<"u"&&window.Multiplayer.isSearching&&window.Multiplayer.cancelMatchmaking()},cancelQueue(){this.stopQueueTimer(),document.getElementById("qp-queue").classList.remove("active"),typeof window.Multiplayer<"u"&&window.Multiplayer.isSearching&&window.Multiplayer.cancelMatchmaking()},startQueueTimer(){this.queueStartTime=Date.now(),this.updateQueueTimer(),this.queueTimer=setInterval(()=>this.updateQueueTimer(),1e3)},stopQueueTimer(){this.queueTimer&&(clearInterval(this.queueTimer),this.queueTimer=null),this.queueStartTime=null},updateQueueTimer(){if(!this.queueStartTime)return;let e=Math.floor((Date.now()-this.queueStartTime)/1e3),t=Math.floor(e/60),a=e%60;document.getElementById("qp-timer").textContent=`${t}:${a.toString().padStart(2,"0")}`},startAIGame(){console.log("[QuickPlay] Starting AI game..."),this.closeQuickPlay(),this.close(),this.startGame()},startQuickPlay(e){console.log("[QuickPlay] Starting matchmaking, mode:",e);let t=PlayerData.decks.find(a=>PlayerData.validateDeck(a).valid);if(!t){showMessage("No valid deck found!");return}document.getElementById("qp-queue").classList.add("active"),document.getElementById("qp-status").textContent="Searching for opponent...",this.startQueueTimer(),typeof window.Multiplayer<"u"&&window.Multiplayer?window.Multiplayer.findMatch(e,t.id):(console.error("[QuickPlay] Multiplayer object not found!"),document.getElementById("qp-status").textContent="Multiplayer not available",setTimeout(()=>{this.cancelQueue()},2e3))},onMatchFound(e){this.stopQueueTimer(),this.closeQuickPlay(),this.close(),typeof startMultiplayerGame=="function"&&startMultiplayerGame(e)},toggleFullscreen(){if(!document.fullscreenElement&&!document.webkitFullscreenElement){let e=document.documentElement;e.requestFullscreen?e.requestFullscreen():e.webkitRequestFullscreen&&e.webkitRequestFullscreen()}else document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen&&document.webkitExitFullscreen()},openCredits(){alert(`Cryptid Fates

A card battler by the Summoner's Guild

Version 0.1 Beta`)},createDeckSelectionScreen(){let e=document.createElement("div");e.id="deck-selection-screen",e.innerHTML=`
            <div class="deck-select-content">
                <div class="deck-select-header">
                    <button class="deck-select-back" id="deck-select-back">\u2190 Back</button>
                    <h2 class="deck-select-title">Choose Your Deck</h2>
                    <div class="deck-select-spacer"></div>
                </div>
                <div class="deck-select-list" id="deck-select-list"></div>
                <div class="deck-select-footer">
                    <button class="deck-select-btn disabled" id="deck-select-play" disabled>Select a Deck to Play</button>
                </div>
            </div>
        `,document.body.appendChild(e),document.getElementById("deck-select-back").onclick=()=>this.closeDeckSelection()},selectedBattleDeck:null,openDeckSelection(){document.getElementById("deck-selection-screen")||this.createDeckSelectionScreen();let e=PlayerData.decks.filter(a=>PlayerData.validateDeck(a).valid),t=document.getElementById("deck-select-list");e.length===0?t.innerHTML=`
                <div class="deck-select-empty">
                    <div class="deck-select-empty-icon">\u{1F4DC}</div>
                    <div class="deck-select-empty-text">No ready decks found</div>
                    <div class="deck-select-empty-hint">Build a deck with 55-100 cards to battle!</div>
                    <div class="deck-select-empty-buttons">
                        <button class="deck-select-builder-btn" onclick="HomeScreen.closeDeckSelection(); HomeScreen.openDeckBuilder();">Open Deck Builder</button>
                        <button class="deck-select-test-btn" onclick="HomeScreen.startGameWithDeck(null);">Use Random Deck (Test)</button>
                    </div>
                </div>
            `:t.innerHTML=e.map((a,n)=>{let r=a.cards?.length||0,i=a.cards?.filter(o=>DeckBuilder?.getCard?.(o.cardKey)?.type==="cryptid").length||0;return`
                    <div class="deck-select-deck" data-deck-index="${n}" onclick="HomeScreen.selectBattleDeck(${n})">
                        <div class="deck-select-deck-icon">\u{1F4DC}</div>
                        <div class="deck-select-deck-info">
                            <div class="deck-select-deck-name">${a.name||"Unnamed Deck"}</div>
                            <div class="deck-select-deck-stats">${r} cards \u2022 ${i} cryptids</div>
                        </div>
                        <div class="deck-select-deck-check">\u2713</div>
                    </div>
                `}).join(""),this.selectedBattleDeck=null,document.getElementById("deck-selection-screen").classList.add("open"),document.getElementById("deck-select-play").onclick=()=>{this.selectedBattleDeck!==null&&this.startGameWithDeck(this.selectedBattleDeck)}},selectBattleDeck(e){let t=document.querySelectorAll(".deck-select-deck");t.forEach(n=>n.classList.remove("selected")),t[e]?.classList.add("selected"),this.selectedBattleDeck=e;let a=document.getElementById("deck-select-play");a.disabled=!1,a.classList.remove("disabled"),a.textContent="Battle!"},closeDeckSelection(){document.getElementById("deck-selection-screen")?.classList.remove("open"),this.open()},startGame(){this.close(),this.openDeckSelection()},startGameWithDeck(e){if(document.getElementById("deck-selection-screen")?.classList.remove("open"),this.close(),e!==null){let t=PlayerData.decks.filter(a=>PlayerData.validateDeck(a).valid);window.selectedPlayerDeck=t[e],window.testMode=!1}else window.testMode=!0;typeof MainMenu<"u"?MainMenu.showTurnOrderAnimation(()=>{document.getElementById("game-container").style.display="flex",typeof initGame=="function"&&initGame()}):(document.getElementById("game-container").style.display="flex",typeof initGame=="function"&&initGame())},openDeckBuilder(){typeof DeckBuilder<"u"&&DeckBuilder.open()},openShop(){this.close(),typeof Shop<"u"&&Shop.open()},openCollection(){this.close(),typeof Collection<"u"&&Collection.open()},openSettings(){alert("Settings coming soon!")},openHelp(){alert("Tutorial coming soon!")},emberParticles:[],emberAnimationId:null,initEmberParticles(){let e=document.getElementById("ember-particles");if(!e)return;let t=e.getContext("2d"),a=p(()=>{e.width=window.innerWidth,e.height=window.innerHeight},"resize");a(),window.addEventListener("resize",a);let n=[{r:255,g:100,b:20},{r:255,g:60,b:10},{r:255,g:180,b:50},{r:255,g:140,b:30},{r:200,g:50,b:20}];this.emberParticles=[];let r=Math.min(40,Math.floor(window.innerWidth/30));for(let o=0;o<r;o++)this.emberParticles.push(this.createEmber(e,n));let i=p(()=>{if(!this.isOpen){this.emberAnimationId=null;return}t.clearRect(0,0,e.width,e.height),this.emberParticles.forEach((o,s)=>{if(o.y-=o.speed,o.x+=Math.sin(o.wobble)*o.wobbleSpeed,o.wobble+=o.wobbleInc,o.life-=o.decay,o.size*=.9995,o.y<-20||o.life<=0||o.size<.5){this.emberParticles[s]=this.createEmber(e,n,!0);return}let l=o.life*o.baseAlpha,c=t.createRadialGradient(o.x,o.y,0,o.x,o.y,o.size*3);c.addColorStop(0,`rgba(${o.color.r}, ${o.color.g}, ${o.color.b}, ${l*.8})`),c.addColorStop(.4,`rgba(${o.color.r}, ${o.color.g}, ${o.color.b}, ${l*.3})`),c.addColorStop(1,`rgba(${o.color.r}, ${o.color.g}, ${o.color.b}, 0)`),t.beginPath(),t.arc(o.x,o.y,o.size*3,0,Math.PI*2),t.fillStyle=c,t.fill(),t.beginPath(),t.arc(o.x,o.y,o.size,0,Math.PI*2),t.fillStyle=`rgba(255, 240, 200, ${l})`,t.fill()}),this.emberAnimationId=requestAnimationFrame(i)},"animate");i()},createEmber(e,t,a=!1){let n=t[Math.floor(Math.random()*t.length)];return{x:Math.random()*e.width,y:a?e.height+20:Math.random()*e.height,size:Math.random()*3+1.5,speed:Math.random()*.8+.3,wobble:Math.random()*Math.PI*2,wobbleSpeed:Math.random()*.5-.25,wobbleInc:Math.random()*.02+.01,life:1,decay:Math.random()*.002+.001,baseAlpha:Math.random()*.4+.3,color:n}},stopEmberParticles(){this.emberAnimationId&&(cancelAnimationFrame(this.emberAnimationId),this.emberAnimationId=null),this.emberParticles=[]}};window.showGameOver=function(e,t={}){let a={isWin:e,isHuman:!1,stats:{kills:t.kills||window.game?.enemyDeaths||0,playerDeaths:t.playerDeaths||window.game?.playerDeaths||0,damageDealt:t.damageDealt||0,turns:t.turns||window.game?.turnNumber||0,spellsCast:t.spellsCast||0,evolutions:t.evolutions||0,perfectWin:(window.game?.playerDeaths||0)===0&&e},duration:t.duration||0,deckName:t.deckName||"Test Deck"};typeof WinScreen<"u"&&WinScreen.show(a)};console.log("Home Screen loaded")});var vt=M(()=>{"use strict";window.MainMenu={isFullscreen:!1,selectedMode:null,init(){this.injectStyles(),this.createMenuHTML(),this.bindEvents(),typeof HomeScreen<"u"?document.getElementById("main-menu")?.classList.add("hidden"):this.show()},injectStyles(){let e=document.createElement("style");e.id="main-menu-styles",e.textContent=`
            /* ==================== MAIN MENU ==================== */
            #main-menu {
                position: fixed;
                inset: 0;
                background: 
                    radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
                    radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
                    linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 20000;
                padding: 24px;
                opacity: 1;
                transition: opacity 0.6s ease;
            }
            
            #main-menu.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            #main-menu::before {
                content: '';
                position: absolute;
                inset: 0;
                background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
                pointer-events: none;
                mix-blend-mode: overlay;
            }
            
            .menu-content {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                max-width: 400px;
                width: 100%;
            }
            
            .menu-icon {
                font-size: clamp(60px, 18vw, 100px);
                margin-bottom: 16px;
                animation: menuFlameFlicker 3s infinite ease-in-out;
                filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
            }
            
            @keyframes menuFlameFlicker {
                0%, 100% { 
                    opacity: 1; 
                    transform: scale(1) translateY(0); 
                    filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
                }
                25% { 
                    opacity: 0.9; 
                    transform: scale(1.02) translateY(-2px); 
                }
                50% { 
                    opacity: 0.85; 
                    transform: scale(0.98) translateY(1px);
                    filter: drop-shadow(0 0 40px rgba(196, 92, 38, 0.6));
                }
                75% { 
                    opacity: 0.95; 
                    transform: scale(1.01) translateY(-1px); 
                }
            }
            
            .menu-title {
                font-family: 'Cinzel', serif;
                font-size: clamp(32px, 9vw, 56px);
                font-weight: 700;
                color: var(--parchment);
                text-align: center;
                letter-spacing: 6px;
                text-shadow: 
                    0 0 40px rgba(232, 169, 62, 0.4),
                    0 4px 8px rgba(0, 0, 0, 0.8);
                margin-bottom: 8px;
            }
            
            .menu-subtitle {
                font-family: 'Cinzel', serif;
                font-size: clamp(12px, 3vw, 16px);
                color: var(--bone);
                opacity: 0.6;
                letter-spacing: 4px;
                text-transform: uppercase;
                margin-bottom: 48px;
            }
            
            .menu-buttons {
                display: flex;
                flex-direction: column;
                gap: 16px;
                width: 100%;
                max-width: 280px;
            }
            
            .menu-btn {
                padding: 18px 32px;
                font-family: 'Cinzel', serif;
                font-size: clamp(14px, 4vw, 18px);
                font-weight: 700;
                border: 2px solid;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 3px;
                position: relative;
                overflow: hidden;
            }
            
            .menu-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 50%;
                background: linear-gradient(180deg, rgba(255,255,255,0.15), transparent);
                pointer-events: none;
            }
            
            .menu-btn.primary {
                background: linear-gradient(180deg, 
                    rgba(220, 220, 230, 0.95) 0%, 
                    rgba(180, 180, 195, 0.9) 20%,
                    rgba(140, 140, 155, 0.85) 50%,
                    rgba(100, 100, 115, 0.9) 80%,
                    rgba(70, 70, 85, 0.95) 100%);
                border-color: rgba(255, 255, 255, 0.4);
                color: #151518;
                box-shadow: 
                    0 0 60px rgba(200, 200, 220, 0.25),
                    0 0 30px rgba(255, 255, 255, 0.1),
                    0 4px 20px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.6),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.3);
                text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
            }
            
            .menu-btn.primary:hover {
                transform: translateY(-3px) scale(1.02);
                box-shadow: 
                    0 0 100px rgba(200, 200, 220, 0.4),
                    0 0 50px rgba(255, 255, 255, 0.2),
                    0 8px 30px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.7),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.3);
            }
            
            .menu-btn.secondary {
                background: linear-gradient(180deg, 
                    rgba(50, 48, 55, 0.9) 0%, 
                    rgba(35, 33, 40, 0.95) 50%,
                    rgba(25, 23, 28, 0.98) 100%);
                border-color: rgba(200, 200, 210, 0.15);
                color: #a0a0a8;
                box-shadow: 
                    0 4px 15px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.05);
            }
            
            .menu-btn.secondary:hover {
                transform: translateY(-2px);
                border-color: rgba(200, 200, 210, 0.3);
                color: #d0d0d8;
                box-shadow: 
                    0 0 30px rgba(200, 200, 220, 0.1),
                    0 6px 20px rgba(0, 0, 0, 0.5);
            }
            
            .menu-btn.tertiary {
                background: transparent;
                border-color: rgba(160, 144, 128, 0.3);
                color: #908070;
                box-shadow: none;
            }
            
            .menu-btn.tertiary:hover {
                transform: translateY(-2px);
                border-color: rgba(160, 144, 128, 0.5);
                color: #d4c4a0;
                background: rgba(160, 144, 128, 0.05);
            }
            
            .menu-btn.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .menu-btn.disabled:hover {
                transform: none;
            }
            
            .menu-btn .btn-subtitle {
                display: block;
                font-size: 10px;
                font-weight: 400;
                letter-spacing: 1px;
                opacity: 0.7;
                margin-top: 4px;
            }
            
            /* Tutorial Popup */
            .menu-popup {
                position: fixed;
                inset: 0;
                background: rgba(5, 5, 10, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 25000;
                opacity: 1;
                transition: opacity 0.3s ease;
            }
            
            .menu-popup.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            .popup-content {
                background: linear-gradient(180deg, rgba(25, 23, 30, 0.98) 0%, rgba(15, 13, 18, 0.98) 100%);
                border: 2px solid rgba(232, 169, 62, 0.4);
                border-radius: 16px;
                padding: 32px 40px;
                max-width: 360px;
                width: 90%;
                text-align: center;
                box-shadow: 0 0 60px rgba(232, 169, 62, 0.2);
            }
            
            .popup-content h3 {
                font-family: 'Cinzel', serif;
                font-size: 24px;
                color: #d4c4a0;
                margin: 0 0 12px;
                letter-spacing: 2px;
            }
            
            .popup-content p {
                color: #908070;
                font-size: 15px;
                margin: 0 0 8px;
            }
            
            .popup-subtext {
                font-size: 12px !important;
                color: #605040 !important;
                font-style: italic;
                margin-bottom: 20px !important;
            }
            
            .popup-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
                margin-top: 24px;
            }
            
            .popup-btn {
                padding: 12px 24px;
                font-family: 'Cinzel', serif;
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 2px;
                text-transform: uppercase;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .popup-btn.confirm {
                background: linear-gradient(180deg, 
                    rgba(220, 220, 230, 0.95) 0%, 
                    rgba(140, 140, 155, 0.85) 50%,
                    rgba(70, 70, 85, 0.95) 100%);
                border: 2px solid rgba(255, 255, 255, 0.4);
                color: #151518;
            }
            
            .popup-btn.confirm:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(200, 200, 220, 0.3);
            }
            
            .popup-btn.cancel {
                background: transparent;
                border: 1px solid rgba(160, 144, 128, 0.3);
                color: #706050;
            }
            
            .popup-btn.cancel:hover {
                border-color: rgba(160, 144, 128, 0.5);
                color: #908070;
            }
            
            .menu-footer {
                margin-top: 48px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }
            
            .fullscreen-toggle {
                padding: 10px 20px;
                font-family: var(--ui-font);
                font-size: 12px;
                font-weight: 600;
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(126, 184, 158, 0.3);
                border-radius: 4px;
                color: var(--rune-glow);
                cursor: pointer;
                transition: all 0.25s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .fullscreen-toggle:hover {
                background: rgba(126, 184, 158, 0.1);
                border-color: var(--rune-glow);
            }
            
            .menu-hint {
                font-size: 11px;
                color: var(--bone);
                opacity: 0.4;
            }
            
            /* ==================== TURN ORDER OVERLAY ==================== */
            #turn-order-overlay {
                position: fixed;
                inset: 0;
                background: rgba(10, 13, 18, 0.98);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 15000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s ease;
            }
            
            #turn-order-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            .turn-order-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                /* Fixed height container to prevent any layout shift */
                height: 320px;
                justify-content: space-between;
            }
            
            .turn-order-title {
                font-family: 'Cinzel', serif;
                font-size: clamp(16px, 4vw, 24px);
                color: var(--parchment);
                letter-spacing: 4px;
                text-transform: uppercase;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.5s ease;
            }
            
            #turn-order-overlay.active .turn-order-title {
                opacity: 0.7;
                transform: translateY(0);
            }
            
            .turn-order-contestants {
                display: flex;
                align-items: center;
                gap: clamp(40px, 10vw, 80px);
            }
            
            .contestant {
                display: flex;
                flex-direction: column;
                align-items: center;
                opacity: 0;
                transform: scale(0.8);
                transition: all 0.5s ease;
            }
            
            .contestant.reveal {
                opacity: 1;
                transform: scale(1);
            }
            
            .contestant.winner {
                transform: scale(1.15);
            }
            
            .contestant.loser {
                opacity: 0.4;
                transform: scale(0.9);
            }
            
            .contestant-icon {
                font-size: clamp(48px, 12vw, 72px);
                margin-bottom: 12px;
                filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8));
            }
            
            .contestant.player .contestant-icon {
                filter: drop-shadow(0 0 15px rgba(126, 184, 158, 0.5));
            }
            
            .contestant.enemy .contestant-icon {
                filter: drop-shadow(0 0 15px rgba(107, 28, 28, 0.5));
            }
            
            .contestant-name {
                font-family: 'Cinzel', serif;
                font-size: clamp(14px, 4vw, 20px);
                font-weight: 700;
                letter-spacing: 2px;
                text-transform: uppercase;
            }
            
            .contestant.player .contestant-name {
                color: var(--rune-glow);
                text-shadow: 0 0 10px rgba(126, 184, 158, 0.5);
            }
            
            .contestant.enemy .contestant-name {
                color: var(--dried-blood);
                text-shadow: 0 0 10px rgba(107, 28, 28, 0.5);
            }
            
            .turn-order-vs {
                font-family: 'Cinzel', serif;
                font-size: clamp(20px, 5vw, 32px);
                color: #c0c0c8;
                text-shadow: 0 0 20px rgba(200, 200, 220, 0.6);
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            
            #turn-order-overlay.active .turn-order-vs {
                opacity: 1;
                transition-delay: 0.3s;
            }
            
            .turn-order-result {
                font-family: 'Cinzel', serif;
                font-size: clamp(18px, 5vw, 28px);
                color: #d0d0d8;
                letter-spacing: 3px;
                opacity: 0;
                transition: opacity 0.5s ease;
                text-align: center;
                /* Reserve fixed space to prevent layout shift */
                min-height: 60px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            
            .turn-order-result.show {
                opacity: 1;
            }
            
            .turn-order-result .goes-first {
                display: block;
                font-size: clamp(12px, 3vw, 16px);
                color: var(--bone);
                opacity: 0.7;
                margin-top: 8px;
                letter-spacing: 2px;
            }
            
            /* Coin flip animation */
            .fate-decider {
                width: 80px;
                height: 80px;
                margin: 30px 0;
                perspective: 200px;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .fate-decider.active {
                opacity: 1;
            }
            
            .fate-coin {
                width: 100%;
                height: 100%;
                position: relative;
                transform-style: preserve-3d;
                animation: coinSpin 0.15s linear infinite;
            }
            
            .fate-coin.stopped {
                animation: none;
            }
            
            @keyframes coinSpin {
                0% { transform: rotateY(0deg); }
                100% { transform: rotateY(360deg); }
            }
            
            .coin-face {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 40px;
                backface-visibility: hidden;
                border: 3px solid;
            }
            
            .coin-face.player-side {
                background: linear-gradient(145deg, #5a9a7a, #3d7a5a);
                border-color: var(--rune-glow);
                box-shadow: inset 0 0 20px rgba(126, 184, 158, 0.4);
            }
            
            .coin-face.enemy-side {
                background: linear-gradient(145deg, #8a4a4a, #5a2a2a);
                border-color: var(--dried-blood);
                box-shadow: inset 0 0 20px rgba(107, 28, 28, 0.4);
                transform: rotateY(180deg);
            }
            
            /* ==================== LANDSCAPE MOBILE FIXES ==================== */
            @media (orientation: landscape) and (max-height: 500px) {
                #main-menu {
                    padding: 12px;
                    overflow-y: auto;
                }
                
                .menu-content {
                    flex-direction: row;
                    flex-wrap: wrap;
                    justify-content: center;
                    max-width: 90vw;
                    gap: 20px;
                }
                
                .menu-icon {
                    font-size: 48px;
                    margin-bottom: 0;
                }
                
                .menu-title {
                    font-size: clamp(24px, 6vw, 36px);
                    margin-bottom: 4px;
                }
                
                .menu-subtitle {
                    font-size: 11px;
                    margin-bottom: 16px;
                }
                
                .menu-buttons {
                    flex-direction: row;
                    gap: 12px;
                    max-width: none;
                    justify-content: center;
                }
                
                .menu-btn {
                    padding: 12px 20px;
                    font-size: 12px;
                }
                
                .menu-btn .btn-subtitle {
                    font-size: 9px;
                }
                
                .menu-footer {
                    margin-top: 16px;
                    flex-direction: row;
                    gap: 16px;
                }
                
                .fullscreen-toggle {
                    padding: 8px 16px;
                    font-size: 11px;
                }
                
                .menu-hint {
                    font-size: 10px;
                }
                
                /* Turn order overlay landscape */
                #turn-order-overlay {
                    padding: 12px;
                    overflow-y: auto;
                }
                
                .turn-order-title {
                    font-size: 14px;
                    margin-bottom: 16px;
                }
                
                .turn-order-contestants {
                    gap: 30px;
                    margin-bottom: 16px;
                }
                
                .contestant-icon {
                    font-size: 40px;
                    margin-bottom: 6px;
                }
                
                .contestant-name {
                    font-size: 12px;
                }
                
                .turn-order-vs {
                    font-size: 20px;
                }
                
                .fate-decider {
                    width: 60px;
                    height: 60px;
                    margin: 16px 0;
                }
                
                .coin-face {
                    font-size: 28px;
                }
                
                .turn-order-result {
                    font-size: 16px;
                }
                
                .turn-order-result .goes-first {
                    font-size: 11px;
                }
            }
        `,document.head.appendChild(e)},createMenuHTML(){let e=document.createElement("div");e.id="main-menu",e.innerHTML=`
            <div class="menu-content">
                <div class="menu-icon"><img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img' alt=''></div>
                <h1 class="menu-title">CRYPTID FATES</h1>
                <p class="menu-subtitle">A Game of Dark Summons</p>
                
                <div class="menu-buttons">
                    <button class="menu-btn primary" id="vs-ai-btn">
                        \u2694 VS AI
                        <span class="btn-subtitle">Battle the Warden</span>
                    </button>
                    <button class="menu-btn secondary" id="vs-human-btn">
                        \u{1F465} Quick Play
                        <span class="btn-subtitle">Play Online</span>
                    </button>
                    <button class="menu-btn tertiary" id="how-to-play-btn">
                        \u{1F4D6} How to Play
                        <span class="btn-subtitle">Learn the Basics</span>
                    </button>
                </div>
                
                <div class="menu-footer">
                    <button class="fullscreen-toggle" id="menu-fullscreen-btn">
                        \u26F6 Toggle Fullscreen
                    </button>
                    <p class="menu-hint">Fullscreen recommended for mobile</p>
                </div>
            </div>
        `,document.body.appendChild(e);let t=document.createElement("div");t.id="tutorial-replay-popup",t.className="menu-popup hidden",t.innerHTML=`
            <div class="popup-content">
                <h3>Tutorial Battle</h3>
                <p>Want to replay the tutorial?</p>
                <p class="popup-subtext">(Completion rewards already claimed)</p>
                <div class="popup-buttons">
                    <button class="popup-btn confirm" id="tutorial-yes-btn">Yes, teach me!</button>
                    <button class="popup-btn cancel" id="tutorial-no-btn">No thanks</button>
                </div>
            </div>
        `,document.body.appendChild(t);let a=document.createElement("div");a.id="turn-order-overlay",a.innerHTML=`
            <div class="turn-order-content">
                <div class="turn-order-title">Fate Decides...</div>
                
                <div class="turn-order-contestants">
                    <div class="contestant player">
                        <div class="contestant-icon">\u{1F33F}</div>
                        <div class="contestant-name">Seeker</div>
                    </div>
                    
                    <div class="turn-order-vs">\u26A1</div>
                    
                    <div class="contestant enemy">
                        <div class="contestant-icon">\u{1F480}</div>
                        <div class="contestant-name">Warden</div>
                    </div>
                </div>
                
                <div class="fate-decider">
                    <div class="fate-coin">
                        <div class="coin-face player-side">\u{1F33F}</div>
                        <div class="coin-face enemy-side">\u{1F480}</div>
                    </div>
                </div>
                
                <div class="turn-order-result">
                    <span class="winner-name"></span>
                    <span class="goes-first">Goes First</span>
                </div>
            </div>
        `,document.body.appendChild(a)},bindEvents(){document.getElementById("vs-ai-btn").addEventListener("click",()=>{this.startVsAI()}),document.getElementById("vs-human-btn").addEventListener("click",()=>{typeof HomeScreen<"u"&&(this.hide(),HomeScreen.open(),setTimeout(()=>HomeScreen.openQuickPlay(),100))}),document.getElementById("menu-fullscreen-btn").addEventListener("click",()=>{this.toggleFullscreen()}),document.getElementById("how-to-play-btn").addEventListener("click",()=>{this.showTutorialPopup()}),document.getElementById("tutorial-yes-btn").addEventListener("click",()=>{this.hideTutorialPopup(),this.hide(),typeof TutorialManager<"u"&&TutorialManager.start()}),document.getElementById("tutorial-no-btn").addEventListener("click",()=>{this.hideTutorialPopup()}),document.addEventListener("fullscreenchange",()=>this.updateFullscreenButton()),document.addEventListener("webkitfullscreenchange",()=>this.updateFullscreenButton())},showTutorialPopup(){let e=document.getElementById("tutorial-replay-popup"),t=e.querySelector(".popup-subtext");typeof PlayerData<"u"&&PlayerData.tutorialCompleted?t.style.display="block":t.style.display="none",e.classList.remove("hidden")},hideTutorialPopup(){document.getElementById("tutorial-replay-popup").classList.add("hidden")},show(){if(typeof HomeScreen<"u"&&HomeScreen.open){HomeScreen.open();return}document.getElementById("main-menu").classList.remove("hidden");let t=document.getElementById("fullscreen-prompt");t&&t.classList.add("hidden");let a=document.getElementById("game-container");a&&(a.style.display="none")},hide(){document.getElementById("main-menu").classList.add("hidden")},toggleFullscreen(){try{if(!document.fullscreenElement&&!document.webkitFullscreenElement){let e=document.documentElement;e.requestFullscreen?e.requestFullscreen().catch(t=>console.log("Fullscreen not available:",t.message)):e.webkitRequestFullscreen&&e.webkitRequestFullscreen(),this.isFullscreen=!0}else document.exitFullscreen?document.exitFullscreen().catch(e=>console.log("Exit fullscreen error:",e.message)):document.webkitExitFullscreen&&document.webkitExitFullscreen(),this.isFullscreen=!1}catch(e){console.log("Fullscreen not supported in this context:",e.message)}},updateFullscreenButton(){let e=document.getElementById("menu-fullscreen-btn");document.fullscreenElement||document.webkitFullscreenElement?(e.textContent="\u26F6 Exit Fullscreen",this.isFullscreen=!0):(e.textContent="\u26F6 Toggle Fullscreen",this.isFullscreen=!1)},startVsAI(){this.selectedMode="ai",window.testMode=!0,this.hide(),this.showTurnOrderAnimation(()=>{this.startGame()})},showTurnOrderAnimation(e){let t=document.getElementById("turn-order-overlay"),a=t.querySelectorAll(".contestant"),n=t.querySelector(".fate-decider"),r=t.querySelector(".fate-coin"),i=t.querySelector(".turn-order-result"),o=i.querySelector(".winner-name"),s=Math.random()<.5;window.playerGoesFirst=s,t.classList.add("active"),[{delay:400,action:p(()=>a[0].classList.add("reveal"),"action")},{delay:600,action:p(()=>a[1].classList.add("reveal"),"action")},{delay:1e3,action:p(()=>n.classList.add("active"),"action")},{delay:2200,action:p(()=>{r.classList.add("stopped"),r.style.transform=s?"rotateY(0deg)":"rotateY(180deg)"},"action")},{delay:2600,action:p(()=>{s?(a[0].classList.add("winner"),a[1].classList.add("loser"),o.textContent="Seeker",o.style.color="var(--rune-glow)"):(a[1].classList.add("winner"),a[0].classList.add("loser"),o.textContent="Warden",o.style.color="var(--dried-blood)"),i.classList.add("show")},"action")},{delay:4200,action:p(()=>{t.classList.remove("active"),setTimeout(()=>{a.forEach(c=>{c.classList.remove("reveal","winner","loser")}),n.classList.remove("active"),r.classList.remove("stopped"),r.style.transform="",i.classList.remove("show"),e?.()},500)},"action")}].forEach(({delay:c,action:m})=>{setTimeout(m,c)})},startGame(){let e=document.getElementById("game-container");e&&(e.style.display="flex"),typeof window.initGame=="function"&&window.initGame()}};console.log("Main Menu module loaded")});setTimeout(()=>Promise.resolve().then(()=>H(Se())),0);setTimeout(()=>Promise.resolve().then(()=>H(Pe())),0);setTimeout(()=>Promise.resolve().then(()=>H(De())),0);setTimeout(()=>Promise.resolve().then(()=>H(Me())),0);setTimeout(()=>Promise.resolve().then(()=>H(He())),0);setTimeout(()=>Promise.resolve().then(()=>H($e())),0);setTimeout(()=>Promise.resolve().then(()=>H(Re())),0);setTimeout(()=>Promise.resolve().then(()=>H(Fe())),0);setTimeout(()=>Promise.resolve().then(()=>H(ct())),0);setTimeout(()=>Promise.resolve().then(()=>H(pt())),0);setTimeout(()=>Promise.resolve().then(()=>H(mt())),0);setTimeout(()=>Promise.resolve().then(()=>H(ut())),0);setTimeout(()=>Promise.resolve().then(()=>H(gt())),0);setTimeout(()=>Promise.resolve().then(()=>H(ft())),0);setTimeout(()=>Promise.resolve().then(()=>H(ht())),0);setTimeout(()=>Promise.resolve().then(()=>H(yt())),0);setTimeout(()=>Promise.resolve().then(()=>H(xt())),0);setTimeout(()=>Promise.resolve().then(()=>H(wt())),0);setTimeout(()=>Promise.resolve().then(()=>H(vt())),0);})();
