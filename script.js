import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const apiKey = ""; // API Key

class SaveManager {
    static dbName = 'PixelcraftDB';
    static version = 1;
    static db = null;

    static async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = e => { console.error("DB Error", e); resolve(); };
            request.onsuccess = e => {
                this.db = e.target.result;
                resolve();
            };
            request.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('player')) db.createObjectStore('player');
                if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
            };
        });
    }

    static async savePlayer(data) {
        if (!this.db) return;
        const tx = this.db.transaction(['player'], 'readwrite');
        tx.objectStore('player').put(data, 'main');
    }

    static async loadPlayer() {
        if (!this.db) return null;
        return new Promise(resolve => {
            const tx = this.db.transaction(['player'], 'readonly');
            const req = tx.objectStore('player').get('main');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    }

    static async saveChunk(key, data) {
        if (!this.db) return;
        const tx = this.db.transaction(['chunks'], 'readwrite');
        tx.objectStore('chunks').put(data, key);
    }

    static async loadChunk(key) {
        if (!this.db) return null;
        return new Promise(resolve => {
            const tx = this.db.transaction(['chunks'], 'readonly');
            const req = tx.objectStore('chunks').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    }

    static async loadAllChunks() {
        if (!this.db) return new Map();
        return new Promise(resolve => {
            const chunkMap = new Map();
            const tx = this.db.transaction(['chunks'], 'readonly');
            const store = tx.objectStore('chunks');
            const req = store.openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    chunkMap.set(cursor.key, cursor.value);
                    cursor.continue();
                } else {
                    resolve(chunkMap);
                }
            };
            req.onerror = () => resolve(chunkMap);
            tx.onerror = () => resolve(chunkMap);
        });
    }

    static resetWorld() {
        if (this.db) {
            this.db.close();
            const req = indexedDB.deleteDatabase(this.dbName);
            req.onsuccess = () => window.location.reload();
        } else {
            window.location.reload();
        }
    }
}


// --- MOB MATERIALS ---
const globalMobMats = (() => {
    const genTex = (color, type) => {
        const S = 4;
        const c = document.createElement('canvas');
        c.width = 64 * S;
        c.height = 64 * S;
        const cx = c.getContext('2d');

        cx.fillStyle = color;
        cx.fillRect(0, 0, 64 * S, 64 * S);

        const grad = cx.createLinearGradient(0, 0, 64 * S, 64 * S);
        grad.addColorStop(0, 'rgba(255,255,255,0.1)');
        grad.addColorStop(1, 'rgba(0,0,0,0.1)');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, 64 * S, 64 * S);

        const rect = (x, y, w, h, col) => {
            cx.fillStyle = col;
            cx.fillRect(x * S, y * S, w * S, h * S);
        };

        if (type === 'face') {
            rect(8, 20, 16, 12, 'white'); rect(40, 20, 16, 12, 'white');
            rect(14, 22, 6, 8, '#3E2723'); rect(46, 22, 6, 8, '#3E2723');
            rect(20, 48, 24, 6, '#8D6E63');
            rect(0, 0, 64, 12, '#3E2723'); rect(10, 12, 8, 6, '#3E2723'); rect(46, 12, 8, 6, '#3E2723');
        }
        if (type === 'zombie_face') {
            rect(8, 20, 16, 12, '#000'); rect(40, 20, 16, 12, '#000');
            rect(20, 48, 24, 6, '#1B5E20');
            rect(0, 0, 64, 12, '#1B5E20');
        }
        if (type === 'golem_face') {
            rect(0, 10, 64, 14, '#5D4037');
            const eyeL = cx.createRadialGradient(17 * S, 33 * S, 1 * S, 17 * S, 33 * S, 8 * S);
            eyeL.addColorStop(0, '#ff5555'); eyeL.addColorStop(1, '#550000');
            cx.fillStyle = eyeL; cx.fillRect(10 * S, 28 * S, 14 * S, 10 * S);
            const eyeR = cx.createRadialGradient(47 * S, 33 * S, 1 * S, 47 * S, 33 * S, 8 * S);
            eyeR.addColorStop(0, '#ff5555'); eyeR.addColorStop(1, '#550000');
            cx.fillStyle = eyeR; cx.fillRect(40 * S, 28 * S, 14 * S, 10 * S);
            cx.fillStyle = '#2d1e18';
            cx.fillRect(18 * S, 50 * S, 28 * S, 8 * S);
            cx.fillStyle = '#1a110e';
            cx.fillRect(20 * S, 52 * S, 24 * S, 4 * S);
        }
        if (type === 'shirt') {
            rect(28, 0, 8, 64, '#1565C0');
            rect(30, 10, 4, 4, '#E3F2FD'); rect(30, 30, 4, 4, '#E3F2FD');
        }

        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.LinearFilter;
        t.minFilter = THREE.LinearFilter;
        return new THREE.MeshLambertMaterial({ map: t });
    };

    // --- Ghost skin: translucent white-blue radial gradient ---
    const ghostSkin = (() => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const cx = c.getContext('2d');
        const grad = cx.createRadialGradient(32, 32, 4, 32, 32, 32);
        grad.addColorStop(0, 'rgba(220, 240, 255, 0.9)');
        grad.addColorStop(0.6, 'rgba(180, 210, 255, 0.5)');
        grad.addColorStop(1, 'rgba(150, 190, 255, 0.1)');
        cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.LinearFilter;
        return new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    })();

    // --- Revenant cloak: dark purple ---
    const revenantSkin = (() => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const cx = c.getContext('2d');
        const grad = cx.createLinearGradient(0, 0, 0, 64);
        grad.addColorStop(0, 'rgba(40, 10, 60, 0.95)');
        grad.addColorStop(1, 'rgba(10, 0, 20, 0.8)');
        cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.LinearFilter;
        return new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    })();

    // --- Revenant skull: bone + green glowing eyes + poison drips ---
    const revenantSkull = (() => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const cx = c.getContext('2d');
        cx.fillStyle = '#d4c98a'; cx.fillRect(0, 0, 64, 64);
        cx.strokeStyle = '#8a7a40'; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(32, 0); cx.lineTo(28, 20); cx.lineTo(35, 35); cx.stroke();
        cx.beginPath(); cx.moveTo(10, 10); cx.lineTo(20, 25); cx.stroke();
        const eyeL = cx.createRadialGradient(18, 28, 1, 18, 28, 9);
        eyeL.addColorStop(0, '#00ff44'); eyeL.addColorStop(0.5, '#00aa22'); eyeL.addColorStop(1, 'rgba(0,80,20,0)');
        cx.fillStyle = eyeL; cx.fillRect(8, 18, 20, 20);
        const eyeR = cx.createRadialGradient(46, 28, 1, 46, 28, 9);
        eyeR.addColorStop(0, '#00ff44'); eyeR.addColorStop(0.5, '#00aa22'); eyeR.addColorStop(1, 'rgba(0,80,20,0)');
        cx.fillStyle = eyeR; cx.fillRect(36, 18, 20, 20);
        cx.fillStyle = '#3a3020'; cx.fillRect(28, 34, 8, 6);
        cx.fillStyle = '#c8ba70';
        for (let i = 0; i < 5; i++) cx.fillRect(16 + i * 7, 48, 5, 10);
        cx.fillStyle = '#000';
        for (let i = 0; i < 4; i++) cx.fillRect(21 + i * 7, 48, 2, 10);
        cx.fillStyle = 'rgba(0, 220, 60, 0.9)';
        cx.beginPath(); cx.moveTo(20, 58); cx.lineTo(23, 64); cx.lineTo(17, 64); cx.fill();
        cx.beginPath(); cx.moveTo(35, 56); cx.lineTo(38, 64); cx.lineTo(32, 64); cx.fill();
        cx.beginPath(); cx.moveTo(48, 59); cx.lineTo(51, 64); cx.lineTo(45, 64); cx.fill();
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.LinearFilter;
        return new THREE.MeshLambertMaterial({ map: t });
    })();

    return {
        skin: genTex('#FFCCBC', 'skin'),
        face: genTex('#FFCCBC', 'face'),
        shirt: genTex('#1976D2', 'shirt'),
        pants: genTex('#283593', 'pants'),
        zombieSkin: genTex('#4CAF50', 'skin'),
        zombieFace: genTex('#4CAF50', 'zombie_face'),
        zombieShirt: genTex('#3E2723', 'shirt'),
        zombiePants: genTex('#1A237E', 'pants'),
        huskSkin: genTex('#D7CCC8', 'skin'),
        huskFace: genTex('#D7CCC8', 'zombie_face'),
        skeletonSkin: genTex('#E0E0E0', 'skin'),
        skeletonFace: genTex('#E0E0E0', 'zombie_face'),
        snowDefSkin: genTex('#E3F2FD', 'skin'),
        snowDefFace: genTex('#E3F2FD', 'face'),
        sandDefSkin: genTex('#dccfa3', 'skin'),
        sandDefFace: genTex('#dccfa3', 'golem_face'),
        ghostSkin,
        revenantSkin,
        revenantSkull,
    };
})();

let playerHealth = 10;
const maxHealth = 10;

// --- CREATIVE MODE ---
let isCreativeMode = false;
let isFlying = false;
let flySpeed = 15;
let flyUpDown = false;
let flyDownKey = false;
let commandHistory = [];
let commandHistoryIdx = -1;

// --- CONFIGURATION ---
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;
const DRAW_DISTANCE = 5;
const DAY_LENGTH = 1200;
let dayTime = 0;

async function callGemini(prompt, systemInstruction = "") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
    };
    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "The spirits remain silent...";
        } catch (e) {
            await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        }
    }
    return "Connection lost to the void.";
}

// --- TEXTURE ATLAS GENERATION ---
function createTextureAtlas() {
    const S = 2;
    const B = 32 * S;
    const canvas = document.createElement('canvas');
    canvas.width = 128 * S;
    canvas.height = 512 * S;
    const ctx = canvas.getContext('2d');

    const rect = (x, y, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * S, y * S, w * S, h * S);
    };

    const fill = (c, r, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(c * B, r * B, B, B);
    };

    const drawBlob = (ox, oy, size, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ox, oy, size, 0, Math.PI * 2);
        ctx.fill();
    };

    fill(0, 0, '#5b8731');
    ctx.fillStyle = '#7cbd42';
    for (let i = 0; i < 150; i++) {
        const x = Math.random() * B; const y = Math.random() * B; const h = 2 + Math.random() * 4;
        ctx.fillRect(x, y, 2, h);
    }

    fill(1, 0, '#7D7D7D');
    const sx = 1 * B; const sy = 0 * B;
    for (let i = 0; i < 15; i++) { const x = sx + Math.random() * B; const y = sy + Math.random() * B; drawBlob(x, y, 4 + Math.random() * 4, '#8c8c8c'); }
    for (let i = 0; i < 10; i++) { const x = sx + Math.random() * B; const y = sy + Math.random() * B; drawBlob(x, y, 3 + Math.random() * 3, '#696969'); }

    fill(2, 0, '#5C4033');
    const dx = 2 * B; const dy = 0 * B;
    for (let i = 0; i < 40; i++) { const x = dx + Math.random() * B; const y = dy + Math.random() * B; drawBlob(x, y, 2 + Math.random() * 3, '#452f25'); }

    fill(3, 0, '#6d5334');
    ctx.fillStyle = '#523e26';
    const lx = 3 * B;
    for (let i = 4; i < B; i += 8) {
        ctx.fillRect(lx + i, 0, 3, B);
        ctx.fillStyle = '#7e6140'; ctx.fillRect(lx + i + 1, 0, 1, B);
        ctx.fillStyle = '#523e26';
    }

    fill(0, 1, '#9c7746');
    ctx.strokeStyle = '#7e5f36'; ctx.lineWidth = 3;
    const tcx = 0.5 * B; const tcy = 1.5 * B;
    ctx.beginPath(); ctx.arc(tcx, tcy, 12 * S, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(tcx, tcy, 6 * S, 0, Math.PI * 2); ctx.stroke();
    drawBlob(tcx, tcy, 4, '#7e5f36');

    fill(1, 1, '#3a7a30');
    const lfx = 1 * B; const lfy = 1 * B;
    for (let i = 0; i < 30; i++) { const x = lfx + Math.random() * B; const y = lfy + Math.random() * B; drawBlob(x, y, 4, '#4e9c42'); }

    fill(2, 1, '#dccfa3');
    const sdx = 2 * B; const sdy = 1 * B;
    ctx.strokeStyle = '#c9bb8e'; ctx.lineWidth = 2;
    for (let y = 4; y < B; y += 8) {
        ctx.beginPath(); ctx.moveTo(sdx, sdy + y);
        for (let x = 0; x <= B; x += 5) ctx.lineTo(sdx + x, sdy + y + Math.sin(x / 5) * 3);
        ctx.stroke();
    }

    fill(3, 1, '#ffffff');
    const snx = 3 * B; const sny = 1 * B;
    drawBlob(snx + 10, sny + 10, 8, '#ecf4fa'); drawBlob(snx + 40, sny + 30, 12, '#ecf4fa');

    fill(0, 2, '#a27e53');
    const px = 0 * B; const py = 2 * B;
    ctx.fillStyle = '#7e6140';
    ctx.fillRect(px, py + 15, B, 2); ctx.fillRect(px, py + 31, B, 2); ctx.fillRect(px, py + 47, B, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 10; i++) ctx.fillRect(px + Math.random() * B, py + Math.random() * B, 10, 1);

    fill(1, 2, '#9c6a5e');
    const brx = 1 * B; const bry = 2 * B;
    ctx.fillStyle = '#d6c4b8';
    ctx.fillRect(brx, bry + 15, B, 2); ctx.fillRect(brx, bry + 31, B, 2); ctx.fillRect(brx, bry + 47, B, 2);
    ctx.fillRect(brx + 16, bry, 2, 15); ctx.fillRect(brx + 32, bry + 17, 2, 14); ctx.fillRect(brx + 48, bry, 2, 15);

    fill(2, 2, '#527d26');
    const cax = 2 * B; const cay = 2 * B;
    ctx.fillStyle = '#395c18';
    ctx.fillRect(cax + 10, cay, 4, B); ctx.fillRect(cax + 20, cay, 4, B); ctx.fillRect(cax + 30, cay, 4, B);
    ctx.fillStyle = '#000';
    for (let i = 0; i < 10; i++) ctx.fillRect(cax + Math.random() * B, cay + Math.random() * B, 2, 2);

    fill(3, 2, '#5C4033');
    ctx.fillStyle = '#5b8731';
    const gsx = 3 * B; const gsy = 2 * B;
    ctx.fillRect(gsx, gsy, B, 10);
    for (let i = 0; i < 12; i++) ctx.fillRect(gsx + i * 5, gsy + 10, 3, Math.random() * 8);

    fill(0, 3, '#606060');
    const cbx = 0 * B; const cby = 3 * B;
    ctx.strokeStyle = '#404040'; ctx.lineWidth = 2; ctx.fillStyle = '#757575';
    const drawStone = (x, y, w, h) => { ctx.fillRect(cbx + x, cby + y, w, h); ctx.strokeRect(cbx + x, cby + y, w, h); };
    drawStone(2, 2, 20, 20); drawStone(24, 4, 20, 20); drawStone(4, 26, 18, 18); drawStone(26, 28, 20, 18);

    fill(1, 3, '#6b5130');
    const ctxx = 1 * B; const ctxy = 3 * B;
    ctx.fillStyle = '#4a3822';
    ctx.fillRect(ctxx, ctxy, B, 4); ctx.fillRect(ctxx, ctxy, 4, B);
    ctx.fillRect(ctxx + B - 4, ctxy, 4, B); ctx.fillRect(ctxx, ctxy + B - 4, B, 4);
    ctx.fillStyle = '#333'; ctx.fillRect(ctxx + 16, ctxy + 16, 20, 6);
    ctx.fillStyle = '#888'; ctx.fillRect(ctxx + 20, ctxy + 22, 4, 10);

    fill(2, 3, '#a27e53');
    const cttx = 2 * B; const ctty = 3 * B;
    ctx.fillStyle = '#523e26'; ctx.fillRect(cttx + 10, ctty + 10, 44, 44);
    ctx.fillStyle = '#dccfa3';
    ctx.fillRect(cttx + 24, ctty + 10, 2, 44); ctx.fillRect(cttx + 38, ctty + 10, 2, 44);
    ctx.fillRect(cttx + 10, ctty + 24, 44, 2); ctx.fillRect(cttx + 10, ctty + 38, 44, 2);

    fill(3, 3, '#222');
    const bdx = 3 * B; const bdy = 3 * B;
    drawBlob(bdx + 10, bdy + 10, 10, '#000'); drawBlob(bdx + 40, bdy + 40, 15, '#000');

    fill(0, 4, '#59442b');
    const jlx = 0 * B; const jly = 4 * B;
    ctx.fillStyle = '#3e2f1f';
    for (let i = 0; i < 10; i++) ctx.fillRect(jlx + Math.random() * B, jly + Math.random() * B, 10, 4);

    fill(1, 4, '#1e6b1e');
    const jfx = 1 * B; const jfy = 4 * B;
    for (let i = 0; i < 20; i++) drawBlob(jfx + Math.random() * B, jfy + Math.random() * B, 6, '#134d13');

    fill(2, 4, '#8db33f');
    const mlx = 2 * B; const mly = 4 * B;
    ctx.fillStyle = '#4c6323';
    ctx.fillRect(mlx + 10, mly, 6, B); ctx.fillRect(mlx + 30, mly, 6, B); ctx.fillRect(mlx + 50, mly, 6, B);

    fill(3, 4, '#8db33f');
    const mtx = 3 * B; const mty = 4 * B;
    ctx.fillStyle = '#4c6323'; ctx.fillRect(mtx + 28, mty + 28, 8, 8);

    const drawItem = (cx, cy, type, materialColor) => {
        const ox = cx * 32 * S; const oy = cy * 32 * S;
        if (type === 'stick') {
            rect(ox / S + 6, oy / S + 22, 20, 4, '#5D4037');
        } else if (type === 'pickaxe') {
            ctx.fillStyle = materialColor;
            const hx = ox; const hy = oy;
            ctx.beginPath(); ctx.arc(hx + 16 * S, hy + 10 * S, 12 * S, Math.PI, 0); ctx.lineTo(hx + 16 * S, hy + 16 * S); ctx.fill();
            rect(ox / S + 14, oy / S + 12, 4, 16, '#5D4037');
        } else if (type === 'shovel') {
            rect(ox / S + 12, oy / S + 6, 8, 10, materialColor);
            rect(ox / S + 14, oy / S + 16, 4, 12, '#5D4037');
        }
    };
    drawItem(0, 5, 'stick');
    drawItem(1, 5, 'pickaxe', '#a27e53');
    drawItem(2, 5, 'pickaxe', '#7d7d7d');
    drawItem(3, 5, 'shovel', '#a27e53');
    drawItem(0, 6, 'shovel', '#7d7d7d');

    const drawOre = (cx, cy, color, count) => {
        const ox = cx * B; const oy = cy * B;
        ctx.fillStyle = '#7D7D7D'; ctx.fillRect(ox, oy, B, B);
        drawBlob(ox + 10, oy + 10, 5, '#696969'); drawBlob(ox + 40, oy + 40, 5, '#696969');
        ctx.fillStyle = color;
        for (let i = 0; i < count; i++) {
            const x = 10 + Math.random() * (B - 20); const y = 10 + Math.random() * (B - 20);
            ctx.beginPath(); ctx.moveTo(ox + x, oy + y - 4); ctx.lineTo(ox + x + 4, oy + y); ctx.lineTo(ox + x, oy + y + 4); ctx.lineTo(ox + x - 4, oy + y); ctx.fill();
        }
    };
    drawOre(0, 7, '#111', 10); drawOre(1, 7, '#d8af93', 8); drawOre(2, 7, '#fce14b', 8); drawOre(3, 7, '#5decf5', 6);

    fill(0, 8, '#a27e53');
    const chx = 0 * B; const chy = 8 * B;
    ctx.strokeStyle = '#7e6140'; ctx.lineWidth = 4;
    ctx.strokeRect(chx + 2, chy + 2, B - 4, B - 4);
    ctx.fillStyle = '#ccc'; ctx.fillRect(chx + 28, chy + 20, 8, 12);

    fill(1, 8, '#a27e53');
    const chtx = 1 * B; const chty = 8 * B;
    ctx.strokeRect(chtx + 2, chty + 2, B - 4, B - 4);

    fill(2, 8, '#dccfa3');
    const sbx = 2 * B; const sby = 8 * B;
    ctx.strokeStyle = '#c6b992'; ctx.lineWidth = 2;
    ctx.strokeRect(sbx + 2, sby + 2, B - 4, B - 4);
    ctx.beginPath(); ctx.moveTo(sbx, sby); ctx.lineTo(sbx + B, sby + B); ctx.stroke();

    fill(3, 8, '#666');
    const spx = 3 * B; const spy = 8 * B;
    ctx.fillStyle = '#999';
    ctx.beginPath(); ctx.moveTo(spx + B / 2, spy + 4); ctx.lineTo(spx + 4, spy + B - 4); ctx.lineTo(spx + B - 4, spy + B - 4); ctx.fill();

    fill(0, 9, '#757575');
    const ggx = 0 * B; const ggy = 9 * B;
    ctx.fillStyle = '#222'; ctx.fillRect(ggx + 10, ggy + 20, 16, 10);
    ctx.fillStyle = '#f00'; ctx.fillRect(ggx + 14, ggy + 22, 8, 6);
    ctx.fillStyle = '#222'; ctx.fillRect(ggx + 16, ggy + 45, 32, 6);

    fill(1, 9, '#db443c');
    const tnx = 1 * B; const tny = 9 * B;
    ctx.fillStyle = '#fff'; ctx.fillRect(tnx, tny + 20, B, 24);
    ctx.fillStyle = '#000'; ctx.font = 'bold 30px monospace'; ctx.fillText("TNT", tnx + 6, tny + 42);

    fill(2, 9, '#db443c');
    const tty = 9 * B; const ttx = 2 * B;
    ctx.fillStyle = '#fff'; ctx.fillRect(ttx + 28, tty + 28, 8, 8);

    fill(3, 9, 'rgba(255,255,255,0.1)');
    const cwx = 3 * B; const cwy = 9 * B;
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cwx, cwy); ctx.lineTo(cwx + B, cwy + B); ctx.moveTo(cwx + B, cwy); ctx.lineTo(cwx, cwy + B); ctx.stroke();

    fill(0, 10, '#606060');
    const fux = 0 * B; const fuy = 10 * B;
    ctx.fillStyle = '#111'; ctx.fillRect(fux + 10, fuy + 10, 44, 44);
    ctx.fillStyle = '#333'; ctx.fillRect(fux + 14, fuy + 14, 36, 36);
    ctx.fillStyle = '#888'; ctx.fillRect(fux + 20, fuy + 25, 6, 6);
    fill(1, 10, '#606060');

    fill(2, 10, '#00000000');
    const eyex = 2 * B; const eyey = 10 * B;
    ctx.fillStyle = '#dbe4eb';
    ctx.beginPath(); ctx.arc(eyex + 32, eyey + 32, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b73d36';
    ctx.beginPath(); ctx.arc(eyex + 32, eyey + 32, 12, 0, Math.PI * 2); ctx.fill();

    const drawSword = (cx, cy, col) => {
        const sx = cx * B; const sy = cy * B;
        rect(sx / S + 12, sy / S + 4, 4, 16, col);
        rect(sx / S + 8, sy / S + 20, 12, 2, '#444');
        rect(sx / S + 12, sy / S + 22, 4, 6, '#5D4037');
    };
    drawSword(0, 11, '#a27e53'); drawSword(1, 11, '#7d7d7d'); drawSword(2, 11, '#ccc'); drawSword(3, 11, '#fce14b'); drawSword(0, 12, '#5decf5');

    const drawIngot = (cx, cy, col) => {
        const ix = cx * B; const iy = cy * B;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(ix + 10, iy + 20); ctx.lineTo(ix + 54, iy + 20); ctx.lineTo(ix + 44, iy + 44); ctx.lineTo(ix + 20, iy + 44); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(ix + 20, iy + 24, 24, 4);
    };
    drawIngot(1, 12, '#ccc'); drawIngot(2, 12, '#fce14b'); drawIngot(3, 12, '#5decf5');

    // ═══ NULL DIMENSION TEXTURES ═══
    // (0,13) NULL_STONE — jet black with electric blue micro-cracks
    fill(0, 13, '#080810');
    { const nx = 0*B, ny = 13*B;
      ctx.strokeStyle = '#1a4aff'; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(nx + Math.random()*B, ny + Math.random()*B);
        ctx.lineTo(nx + Math.random()*B, ny + Math.random()*B); ctx.stroke();
      }
      ctx.strokeStyle = '#0a1a66'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(nx + Math.random()*B, ny + Math.random()*B);
        ctx.lineTo(nx + Math.random()*B, ny + Math.random()*B); ctx.stroke();
      }
    }

    // (1,13) NULL_SOIL — deep void earth, dark purple-black
    fill(1, 13, '#0d0818');
    { const nx = 1*B, ny = 13*B;
      for (let i = 0; i < 30; i++) drawBlob(nx + Math.random()*B, ny + Math.random()*B, 3 + Math.random()*3, '#1a0d2e');
      for (let i = 0; i < 10; i++) drawBlob(nx + Math.random()*B, ny + Math.random()*B, 2, '#2a0a4a');
    }

    // (2,13) NULL_WATER — glowing electric blue
    fill(2, 13, 'rgba(0, 60, 255, 0.75)');
    { const wx = 2*B, wy = 13*B;
      ctx.fillStyle = 'rgba(80, 160, 255, 0.5)';
      for (let y = 4; y < B; y += 6) {
        ctx.beginPath(); ctx.moveTo(wx, wy + y);
        for (let x = 0; x <= B; x += 4) ctx.lineTo(wx + x, wy + y + Math.sin(x/4 + y)*2.5);
        ctx.stroke();
      }
      // glow dots
      ctx.fillStyle = 'rgba(180, 220, 255, 0.6)';
      for (let i = 0; i < 8; i++) drawBlob(wx + Math.random()*B, wy + Math.random()*B, 2, 'rgba(180,220,255,0.7)');
    }

    // (3,13) NULL_ORE — black stone with void crystal veins
    fill(3, 13, '#090912');
    { const ox = 3*B, oy = 13*B;
      ctx.fillStyle = '#0d0d1a';
      for (let i = 0; i < 8; i++) drawBlob(ox + Math.random()*B, oy + Math.random()*B, 5, '#111122');
      // bright cyan-white crystal shards
      ctx.fillStyle = '#aaeeff';
      for (let i = 0; i < 6; i++) {
        const sx = ox + 8 + Math.random()*(B-16), sy = oy + 8 + Math.random()*(B-16);
        ctx.beginPath(); ctx.moveTo(sx, sy-6); ctx.lineTo(sx+4, sy); ctx.lineTo(sx, sy+6); ctx.lineTo(sx-4, sy); ctx.fill();
      }
      ctx.fillStyle = '#55ddff';
      for (let i = 0; i < 4; i++) drawBlob(ox + 8 + Math.random()*(B-16), oy + 8 + Math.random()*(B-16), 3, '#55ddff');
    }

    // (0,14) NULL_CRYSTAL — tall translucent deep-blue spire
    fill(0, 14, 'rgba(10,10,40,0.9)');
    { const cx2 = 0*B, cy2 = 14*B;
      ctx.fillStyle = 'rgba(20, 60, 200, 0.8)';
      // 3 crystal pillars
      const drawCrystal = (x, y, w, h) => {
        ctx.beginPath(); ctx.moveTo(x + w/2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill();
        ctx.fillStyle = 'rgba(100,180,255,0.5)'; ctx.fillRect(x + w/4, y + h*0.3, w/2, 4); ctx.fillStyle = 'rgba(20,60,200,0.8)';
      };
      drawCrystal(cx2 + 8, cy2 + 4, 16, 50); drawCrystal(cx2 + 30, cy2 + 16, 12, 40); drawCrystal(cx2 + 48, cy2 + 8, 14, 46);
    }

    // (1,14) NULL_BRICK — dark void bricks with blue mortar lines
    fill(1, 14, '#111120');
    { const bkx = 1*B, bky = 14*B;
      ctx.fillStyle = '#0a0a18';
      for (let y = 0; y < B; y += 16) {
        const offset = (Math.floor(y/16) % 2) * 16;
        for (let x = 0; x < B; x += 32) {
          ctx.fillRect(bkx + x + offset + 2, bky + y + 2, 28, 12);
        }
      }
      ctx.strokeStyle = '#1a1aff'; ctx.lineWidth = 1;
      for (let y = 0; y < B; y += 16) { ctx.beginPath(); ctx.moveTo(bkx, bky+y); ctx.lineTo(bkx+B, bky+y); ctx.stroke(); }
      for (let x = 0; x < B; x += 32) { ctx.beginPath(); ctx.moveTo(bkx+x, bky); ctx.lineTo(bkx+x, bky+B); ctx.stroke(); }
    }

    // (2,14) NULL_PORTAL — swirling void (animated appearance)
    fill(2, 14, '#000008');
    { const px2 = 2*B, py2 = 14*B;
      // concentric void rings with blue glow
      for (let r = 28; r > 4; r -= 5) {
        const alpha = (28 - r) / 28;
        ctx.strokeStyle = `rgba(${Math.floor(20 + alpha*100)}, ${Math.floor(alpha*80)}, 255, ${0.3 + alpha * 0.7})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px2 + 32, py2 + 32, r, 0, Math.PI * 2); ctx.stroke();
      }
      // spiral arms
      ctx.strokeStyle = 'rgba(80, 160, 255, 0.8)'; ctx.lineWidth = 2;
      for (let a = 0; a < Math.PI * 4; a += 0.15) {
        const r = a * 4; const x = px2 + 32 + Math.cos(a) * r; const y = py2 + 32 + Math.sin(a) * r;
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fillStyle = 'rgba(120,200,255,0.9)'; ctx.fill();
      }
      // bright core
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px2+32, py2+32, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(100,180,255,0.9)'; ctx.beginPath(); ctx.arc(px2+32, py2+32, 10, 0, Math.PI*2); ctx.fill();
    }

    // (3,14) NULL_INGOT — dark metal with blue sheen
    drawIngot(3, 14, '#1a1a3a');
    { const ix2 = 3*B, iy2 = 14*B;
      ctx.fillStyle = 'rgba(80,120,255,0.5)'; ctx.fillRect(ix2+20, iy2+24, 24, 3);
    }

    // (0,15) VOID_SHARD — jagged cyan-blue gem item
    fill(0, 15, 'rgba(0,0,0,0)');
    { const vx = 0*B, vy = 15*B;
      ctx.fillStyle = '#33aaff';
      ctx.beginPath(); ctx.moveTo(vx+32, vy+8); ctx.lineTo(vx+50, vy+28); ctx.lineTo(vx+40, vy+52); ctx.lineTo(vx+24, vy+52); ctx.lineTo(vx+14, vy+28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(180,240,255,0.8)'; ctx.fillRect(vx+26, vy+14, 6, 20);
      ctx.strokeStyle = '#0055cc'; ctx.lineWidth = 2; ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return { tex, canvas };
}

const { tex: textureAtlas, canvas: atlasCanvas } = createTextureAtlas();
const material = new THREE.MeshLambertMaterial({ map: textureAtlas, side: THREE.DoubleSide, alphaTest: 0.1, transparent: true, vertexColors: true });
let atlasURL = atlasCanvas.toDataURL();

// --- TEXTURE LOADING SYSTEM ---
const TEXTURE_MAP = [
    [0, 0, ['grass_block_top', 'grass_top']],
    [1, 0, ['stone']],
    [2, 0, ['dirt']],
    [3, 0, ['oak_log', 'log_oak']],
    [0, 1, ['oak_log_top', 'log_oak_top']],
    [1, 1, ['oak_leaves', 'leaves_oak']],
    [2, 1, ['sand']],
    [3, 1, ['snow']],
    [0, 2, ['oak_planks', 'planks_oak']],
    [1, 2, ['bricks', 'brick']],
    [2, 2, ['cactus_side']],
    [3, 2, ['grass_block_side', 'grass_side']],
    [0, 3, ['cobblestone']],
    [1, 3, ['crafting_table_side']],
    [2, 3, ['crafting_table_top']],
    [3, 3, ['bedrock']],
    [0, 4, ['jungle_log', 'log_jungle']],
    [1, 4, ['jungle_leaves', 'leaves_jungle']],
    [2, 4, ['melon_side']],
    [3, 4, ['melon_top']],
    [0, 5, ['stick']],
    [1, 5, ['wooden_pickaxe', 'wood_pickaxe']],
    [2, 5, ['stone_pickaxe']],
    [3, 5, ['wooden_shovel', 'wood_shovel']],
    [0, 6, ['stone_shovel']],
    [0, 7, ['coal_ore']],
    [1, 7, ['iron_ore']],
    [2, 7, ['gold_ore']],
    [3, 7, ['diamond_ore']],
    [0, 8, ['chest_side']],
    [1, 8, ['chest_top']],
    [2, 8, ['sandstone']],
    [1, 9, ['tnt_side']],
    [2, 9, ['tnt_top']],
    [3, 9, ['cobweb', 'web']],
    [0, 10, ['furnace_front_on', 'furnace_front']],
    [1, 10, ['furnace_side']],
    [2, 10, ['ender_eye']],
    [0, 11, ['wooden_sword', 'wood_sword']],
    [1, 11, ['stone_sword']],
    [2, 11, ['iron_sword']],
    [3, 11, ['golden_sword', 'gold_sword']],
    [0, 12, ['diamond_sword']],
    [1, 12, ['iron_ingot']],
    [2, 12, ['gold_ingot']],
    [3, 12, ['diamond', 'diamond_gem']],
];

function updateMobSkin(type, img) {
    const drawPart = (mat, sx, sy, sw, sh) => {
        if (!mat || !mat.map || !mat.map.image) return;
        const canvas = mat.map.image;
        const ctx = canvas.getContext('2d');
        const scale = img.width / 64;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx * scale, sy * scale, sw * scale, sh * scale, 0, 0, canvas.width, canvas.height);
        mat.map.needsUpdate = true;
    };
    const mats = globalMobMats;
    if (type === 'zombie') {
        drawPart(mats.zombieFace, 8, 8, 8, 8);
        drawPart(mats.zombieShirt, 20, 20, 8, 12);
        drawPart(mats.zombiePants, 4, 20, 4, 12);
        drawPart(mats.zombieSkin, 44, 20, 4, 12);
    } else if (type === 'skeleton') {
        drawPart(mats.skeletonFace, 8, 8, 8, 8);
        drawPart(mats.skeletonSkin, 44, 20, 4, 12);
    } else if (type === 'husk') {
        drawPart(mats.huskFace, 8, 8, 8, 8);
        drawPart(mats.huskSkin, 20, 20, 8, 12);
    }
}

function loadTexturePack(zip, tileSize = 64) {
    const ctx = atlasCanvas.getContext('2d');
    const B = 64; // atlas tile output size always 64x64
    const promises = [];

    // Always use NearestFilter on atlas to prevent tile bleeding between adjacent blocks
    textureAtlas.magFilter = THREE.NearestFilter;
    textureAtlas.minFilter = THREE.NearestFilter;
    textureAtlas.generateMipmaps = false;

    TEXTURE_MAP.forEach(mapping => {
        const [col, row, names] = mapping;
        let foundFile = null;
        for (const name of names) {
            const regex = new RegExp(`(?:^|/)${name}\\.png$`, 'i');
            const match = Object.keys(zip.files).find(path => regex.test(path) && !path.includes('__MACOSX'));
            if (match) { foundFile = zip.files[match]; break; }
        }
        if (foundFile) {
            const p = foundFile.async("blob").then(blob => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => {
                        ctx.clearRect(col * B, row * B, B, B);
                        const isFoliage = names.some(n => n.includes('grass_block_top') || n.includes('leaves') || n.includes('grass_top'));
                        if (isFoliage) {
                            const tC = document.createElement('canvas'); tC.width = B; tC.height = B;
                            const tCtx = tC.getContext('2d');
                            // Only use first tileSize×tileSize frame (animated textures have multiple frames stacked)
                            tCtx.imageSmoothingEnabled = tileSize > 16;
                            tCtx.drawImage(img, 0, 0, Math.min(img.width, img.height), Math.min(img.width, img.height), 0, 0, B, B);
                            tCtx.globalCompositeOperation = 'multiply';
                            tCtx.fillStyle = '#91BD59'; tCtx.fillRect(0, 0, B, B);
                            tCtx.globalCompositeOperation = 'destination-in';
                            tCtx.drawImage(img, 0, 0, Math.min(img.width, img.height), Math.min(img.width, img.height), 0, 0, B, B);
                            ctx.drawImage(tC, col * B, row * B);
                        } else {
                            // Use first square frame only (handles animated PNG strips)
                            const srcSize = Math.min(img.width, img.height);
                            ctx.imageSmoothingEnabled = tileSize > 16;
                            ctx.drawImage(img, 0, 0, srcSize, srcSize, col * B, row * B, B, B);
                        }
                        resolve();
                    };
                    img.src = URL.createObjectURL(blob);
                });
            });
            promises.push(p);
        }
    });

    const chestMatch = Object.keys(zip.files).find(path => path.includes('entity/chest/normal.png') || (path.includes('chest') && path.includes('normal.png') && !path.includes('double')));
    if (chestMatch) {
        const p = zip.files[chestMatch].async("blob").then(blob => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const scale = img.width / 64;
                    ctx.clearRect(1 * B, 8 * B, B, B);
                    ctx.drawImage(img, 14 * scale, 0 * scale, 14 * scale, 14 * scale, 1 * B, 8 * B, B, B);
                    ctx.clearRect(0 * B, 8 * B, B, B);
                    ctx.drawImage(img, 14 * scale, 14 * scale, 14 * scale, 5 * scale, 0 * B, 8 * B, B, 22);
                    ctx.drawImage(img, 14 * scale, 34 * scale, 14 * scale, 10 * scale, 0 * B, (8 * B) + 22, B, 42);
                    ctx.drawImage(img, 3 * scale, 1 * scale, 2 * scale, 4 * scale, (0 * B) + 28, (8 * B) + 18, 8, 14);
                    resolve();
                };
                img.src = URL.createObjectURL(blob);
            });
        });
        promises.push(p);
    }

    const MOB_SKINS = [
        { keys: ['zombie'], target: 'zombie' },
        { keys: ['skeleton'], target: 'skeleton' },
        { keys: ['husk'], target: 'husk' }
    ];
    MOB_SKINS.forEach(mob => {
        let mobFile = null;
        for (const k of mob.keys) {
            const regex = new RegExp(`(?:^|/)${k}\\.png$`, 'i');
            const match = Object.keys(zip.files).find(path => regex.test(path) && !path.includes('__MACOSX'));
            if (match) { mobFile = zip.files[match]; break; }
        }
        if (mobFile) {
            const p = mobFile.async("blob").then(blob => {
                const img = new Image();
                img.onload = () => updateMobSkin(mob.target, img);
                img.src = URL.createObjectURL(blob);
            });
            promises.push(p);
        }
    });

    return Promise.all(promises).then(() => {
        textureAtlas.needsUpdate = true;
        atlasURL = atlasCanvas.toDataURL();
        document.querySelectorAll('.slot-icon, .craft-icon').forEach(el => {
            el.style.backgroundImage = `url(${atlasURL})`;
        });
        console.log(`Texture Pack Loaded! (${tileSize}px tiles)`);
    });
}

// ============================================================
// TEXTURE PACK LOADERS
// ============================================================

function setTexStatus(msg, color = '#8bc34a') {
    const el = document.getElementById('tex-status');
    if (el) { el.innerText = msg; el.style.color = color; }
}

// --- DEFAULT MINECRAFT button (16x16 textures from 1.21.11-template (1).zip) ---
const btnMcDefault = document.getElementById('btn-mc-default');
if (btnMcDefault) {
    btnMcDefault.addEventListener('click', function(e) {
        e.stopPropagation();
        setTexStatus('⏳ Loading Default Minecraft textures...', '#ffd700');
        fetch('1.21.11-template (1).zip')
            .then(r => { if (!r.ok) throw new Error('File not found'); return r.blob(); })
            .then(JSZip.loadAsync)
            .then(zip => loadTexturePack(zip, 16))
            .then(() => setTexStatus('✅ Default Minecraft loaded!', '#8bc34a'))
            .catch(err => {
                console.warn('Default MC pack error:', err);
                setTexStatus('❌ Could not load — place "1.21.11-template (1).zip" next to index.html', '#f44336');
            });
    });
}

// --- FAITHFUL 64x button ---
const btnFaithful = document.getElementById('btn-faithful');
if (btnFaithful) {
    btnFaithful.addEventListener('click', function(e) {
        e.stopPropagation();
        setTexStatus('⏳ Loading Faithful 64x textures...', '#ffd700');
        fetch('Faithful 64x - December 2025 Release.zip')
            .then(r => { if (!r.ok) throw new Error('File not found'); return r.blob(); })
            .then(JSZip.loadAsync)
            .then(zip => loadTexturePack(zip, 64))
            .then(() => setTexStatus('✅ Faithful 64x loaded!', '#8bc34a'))
            .catch(err => {
                console.warn('Faithful pack error:', err);
                setTexStatus('❌ Could not load — place "Faithful 64x - December 2025 Release.zip" next to index.html', '#f44336');
            });
    });
}

// --- CUSTOM PACK button (manual file picker) ---
const texBtn = document.getElementById('texture-btn');
if (texBtn) {
    texBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('texture-input').click();
    });
}

const texInput = document.getElementById('texture-input');
if (texInput) {
    texInput.addEventListener('click', e => e.stopPropagation());
    texInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        setTexStatus('⏳ Loading custom pack...', '#ffd700');
        if (file.name.endsWith('.zip')) {
            JSZip.loadAsync(file).then(zip => {
                loadTexturePack(zip).then(() => setTexStatus('✅ Custom pack loaded!', '#8bc34a'));
            });
        } else {
            const reader = new FileReader();
            reader.onload = function(evt) {
                const img = new Image();
                img.onload = function() {
                    const ctx = atlasCanvas.getContext('2d');
                    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
                    ctx.drawImage(img, 0, 0, atlasCanvas.width, atlasCanvas.height);
                    textureAtlas.needsUpdate = true;
                    atlasURL = atlasCanvas.toDataURL();
                    document.querySelectorAll('.slot-icon, .craft-icon').forEach(el => el.style.backgroundImage = `url(${atlasURL})`);
                    setTexStatus('✅ Custom atlas loaded!', '#8bc34a');
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Auto-try Faithful on page load (silent fallback)
fetch('Faithful 64x - December 2025 Release.zip')
    .then(r => { if (r.ok) return r.blob(); throw new Error('no auto-pack'); })
    .then(JSZip.loadAsync)
    .then(zip => loadTexturePack(zip, 64))
    .then(() => setTexStatus('✅ Faithful 64x auto-loaded', '#8bc34a'))
    .catch(() => {});


const BLOCKS = {
    AIR: 0,
    GRASS: { id: 1, hardness: 0.6, toolClass: 'shovel' },
    DIRT: { id: 2, hardness: 0.5, toolClass: 'shovel' },
    STONE: { id: 3, hardness: 2.5, drop: 11, toolClass: 'pickaxe' },
    LOG: { id: 4, hardness: 1.5, toolClass: 'axe' },
    LEAVES: { id: 5, hardness: 0.2 },
    SAND: { id: 6, hardness: 0.5, toolClass: 'shovel' },
    SNOW: { id: 7, hardness: 0.3, toolClass: 'shovel' },
    CACTUS: { id: 8, hardness: 0.4 },
    PLANKS: { id: 9, hardness: 1.5, toolClass: 'axe' },
    BRICKS: { id: 10, hardness: 3.0, toolClass: 'pickaxe' },
    COBBLESTONE: { id: 11, hardness: 2.0, toolClass: 'pickaxe' },
    CRAFTING_TABLE: { id: 12, hardness: 2.0, toolClass: 'axe' },
    BEDROCK: { id: 13, hardness: 9999999 },
    SANDSTONE: { id: 14, hardness: 1.5, toolClass: 'pickaxe' },
    JUNGLE_LOG: { id: 15, hardness: 1.5, toolClass: 'axe' },
    JUNGLE_LEAVES: { id: 16, hardness: 0.2 },
    MELON: { id: 17, hardness: 1.0, toolClass: 'axe' },
    COAL_ORE: { id: 19, hardness: 3.0, toolClass: 'pickaxe' },
    IRON_ORE: { id: 25, hardness: 3.5, toolClass: 'pickaxe' },
    GOLD_ORE: { id: 26, hardness: 3.5, toolClass: 'pickaxe' },
    DIAMOND_ORE: { id: 27, hardness: 4.0, toolClass: 'pickaxe', drop: 43 },
    CHEST: { id: 28, hardness: 2.5, toolClass: 'axe' },
    SAND_BRICK: { id: 29, hardness: 2.0, toolClass: 'pickaxe' },
    SPIKE: { id: 30, hardness: 2.0, toolClass: 'pickaxe' },
    GARGOYLE: { id: 31, hardness: 2.0, toolClass: 'pickaxe' },
    TNT: { id: 32, hardness: 0, toolClass: 'none' },
    COBWEB: { id: 33, hardness: 0.1, toolClass: 'none' },
    FURNACE: { id: 34, hardness: 3.5, toolClass: 'pickaxe' },
    STICK: { id: 20, isItem: true },
    WOOD_PICK: { id: 21, isItem: true, toolType: 'pickaxe', multiplier: 2 },
    STONE_PICK: { id: 22, isItem: true, toolType: 'pickaxe', multiplier: 4 },
    WOOD_SHOVEL: { id: 23, isItem: true, toolType: 'shovel', multiplier: 2 },
    STONE_SHOVEL: { id: 24, isItem: true, toolType: 'shovel', multiplier: 4 },
    WOOD_SWORD: { id: 35, isItem: true, toolType: 'sword', damage: 4 },
    STONE_SWORD: { id: 36, isItem: true, toolType: 'sword', damage: 5 },
    IRON_SWORD: { id: 37, isItem: true, toolType: 'sword', damage: 6 },
    GOLD_SWORD: { id: 38, isItem: true, toolType: 'sword', damage: 4 },
    DIAMOND_SWORD: { id: 39, isItem: true, toolType: 'sword', damage: 8 },
    GOLEM_EYE: { id: 40, isItem: true },
    IRON_INGOT: { id: 41, isItem: true },
    GOLD_INGOT: { id: 42, isItem: true },
    DIAMOND: { id: 43, isItem: true },
    REVENANT_SHARD: { id: 44, isItem: true },

    // ═══ NULL DIMENSION BLOCKS ═══
    NULL_STONE:   { id: 50, hardness: 3.5, toolClass: 'pickaxe' },   // main null terrain
    NULL_SOIL:    { id: 51, hardness: 1.0, toolClass: 'shovel' },    // surface layer
    NULL_WATER:   { id: 52, hardness: 0, isFluid: true },            // electric blue lakes
    NULL_ORE:     { id: 53, hardness: 4.5, toolClass: 'pickaxe', drop: 58 }, // drops void shard
    NULL_CRYSTAL: { id: 54, hardness: 2.5, toolClass: 'pickaxe' },  // crystal formations
    NULL_BRICK:   { id: 55, hardness: 3.0, toolClass: 'pickaxe' },  // null ruins
    NULL_PORTAL:  { id: 56, hardness: 9999999 },                     // unbreakable portal frame
    NULL_INGOT:   { id: 57, isItem: true },                          // smelted from null ore
    VOID_SHARD:   { id: 58, isItem: true },                          // raw null ore drop
};

const getBlockProps = (id) => Object.values(BLOCKS).find(b => b.id === id) || { hardness: 0 };
const getBlockName = (id) => Object.keys(BLOCKS).find(key => BLOCKS[key].id === id) || 'Unknown';

const getBlockUVs = (id, faceDir) => {
    // Atlas: 4 cols × 16 rows, each tile 64px on a 256×1024 canvas
    // Half-pixel inset (0.5/256 and 0.5/1024) prevents bleeding between adjacent tiles
    const insetU = 0.5 / 256;
    const insetV = 0.5 / 1024;
    const mapQuad = (c, r) => {
        const u1 = c * 0.25 + insetU;       const u2 = u1 + 0.25 - insetU * 2;
        const v1 = 1 - (r + 1) * 0.0625 + insetV; const v2 = v1 + 0.0625 - insetV * 2;
        return [u1, v1, u2, v1, u2, v2, u1, v2];
    };
    if (id === 1) { if (faceDir === 'top') return mapQuad(0, 0); if (faceDir === 'bottom') return mapQuad(2, 0); return mapQuad(3, 2); }
    if (id === 2) return mapQuad(2, 0);
    if (id === 3) return mapQuad(1, 0);
    if (id === 4) return (faceDir === 'top' || faceDir === 'bottom') ? mapQuad(0, 1) : mapQuad(3, 0);
    if (id === 5) return mapQuad(1, 1);
    if (id === 6) return mapQuad(2, 1);
    if (id === 7) return mapQuad(3, 1);
    if (id === 8) return mapQuad(2, 2);
    if (id === 9) return mapQuad(0, 2);
    if (id === 10) return mapQuad(1, 2);
    if (id === 11) return mapQuad(0, 3);
    if (id === 12) { if (faceDir === 'top') return mapQuad(2, 3); if (faceDir === 'bottom') return mapQuad(0, 2); return mapQuad(1, 3); }
    if (id === 13) return mapQuad(3, 3);
    if (id === 14) return mapQuad(2, 1);
    if (id === 15) return (faceDir === 'top' || faceDir === 'bottom') ? mapQuad(0, 1) : mapQuad(0, 4);
    if (id === 16) return mapQuad(1, 4);
    if (id === 17) return (faceDir === 'top') ? mapQuad(3, 4) : mapQuad(2, 4);
    if (id === 19) return mapQuad(0, 7);
    if (id === 25) return mapQuad(1, 7);
    if (id === 26) return mapQuad(2, 7);
    if (id === 27) return mapQuad(3, 7);
    if (id === 28) return (faceDir === 'top' || faceDir === 'bottom') ? mapQuad(1, 8) : mapQuad(0, 8);
    if (id === 29) return mapQuad(2, 8);
    if (id === 30) return mapQuad(3, 8);
    if (id === 31) return mapQuad(0, 9);
    if (id === 32) return (faceDir === 'top' || faceDir === 'bottom') ? mapQuad(2, 9) : mapQuad(1, 9);
    if (id === 33) return mapQuad(3, 9);
    // ═══ NULL DIMENSION ═══
    if (id === 50) return mapQuad(0, 13); // NULL_STONE
    if (id === 51) return mapQuad(1, 13); // NULL_SOIL
    if (id === 52) return mapQuad(2, 13); // NULL_WATER
    if (id === 53) return mapQuad(3, 13); // NULL_ORE
    if (id === 54) return mapQuad(0, 14); // NULL_CRYSTAL
    if (id === 55) return mapQuad(1, 14); // NULL_BRICK
    if (id === 56) return mapQuad(2, 14); // NULL_PORTAL
    return mapQuad(0, 0);
};

const getBlockIconPos = (id) => {
    if (id === 1) return [3, 2]; if (id === 2) return [2, 0]; if (id === 3) return [1, 0];
    if (id === 4) return [3, 0]; if (id === 5) return [1, 1]; if (id === 6) return [2, 1];
    if (id === 7) return [3, 1]; if (id === 8) return [2, 2]; if (id === 9) return [0, 2];
    if (id === 10) return [1, 2]; if (id === 11) return [0, 3]; if (id === 12) return [1, 3];
    if (id === 13) return [3, 3]; if (id === 14) return [2, 1]; if (id === 15) return [0, 4];
    if (id === 16) return [1, 4]; if (id === 17) return [2, 4];
    if (id === 19) return [0, 7]; if (id === 25) return [1, 7];
    if (id === 26) return [2, 7]; if (id === 27) return [3, 7];
    if (id === 28) return [0, 8]; if (id === 29) return [2, 8]; if (id === 30) return [3, 8];
    if (id === 31) return [0, 9]; if (id === 32) return [1, 9]; if (id === 33) return [3, 9];
    if (id === 34) return [0, 10];
    if (id === 20) return [0, 5]; if (id === 21) return [1, 5]; if (id === 22) return [2, 5];
    if (id === 23) return [3, 5]; if (id === 24) return [0, 6];
    if (id === 35) return [0, 11]; if (id === 36) return [1, 11]; if (id === 37) return [2, 11];
    if (id === 38) return [3, 11]; if (id === 39) return [0, 12];
    if (id === 40) return [2, 10]; if (id === 41) return [1, 12]; if (id === 42) return [2, 12]; if (id === 43) return [3, 12];
    if (id === 44) return [2, 10]; // Revenant Shard reuses golem eye icon for now
    // Null Dimension
    if (id === 50) return [0, 13]; if (id === 51) return [1, 13];
    if (id === 52) return [2, 13]; if (id === 53) return [3, 13];
    if (id === 54) return [0, 14]; if (id === 55) return [1, 14];
    if (id === 56) return [2, 14]; if (id === 57) return [3, 14];
    if (id === 58) return [0, 15];
    return [0, 0];
};

class Mob {
    constructor(type, x, y, z, scene) {
        this.type = type;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.mesh = new THREE.Group();
        this.health = (type === 'human') ? 20 : 10;
        this.isHostile = false;
        this.target = null;
        this.cooldown = 0;
        this.dead = false;
        this.animTime = 0;

        if (type === 'pig') {
            const mat = new THREE.MeshLambertMaterial({ color: 0xFFB6C1 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.2), mat);
            body.position.y = 0.6; this.mesh.add(body);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
            head.position.set(0, 0.9, 0.7); this.mesh.add(head);
            this.pigLegs = [];
            const legGeo = new THREE.BoxGeometry(0.25, 0.4, 0.25);
            const pos = [[-0.25, 0.5], [0.25, 0.5], [-0.25, -0.5], [0.25, -0.5]];
            pos.forEach(p => {
                const grp = new THREE.Group(); grp.position.set(p[0], 0.4, p[1]);
                const leg = new THREE.Mesh(legGeo, mat); leg.position.y = -0.2;
                grp.add(leg); this.mesh.add(grp); this.pigLegs.push(grp);
            });

        } else if (type === 'ghost') {
            // ---- GHOST MOB ----
            this.health = 15;
            this.isHostile = true;
            this.flyHeight = 5 + Math.random() * 3;
            this.swoopCooldown = 0;
            this.isSwooping = false;

            const ghostMat = globalMobMats.ghostSkin.clone();

            // Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), ghostMat);
            body.position.y = 0.5; this.mesh.add(body);

            // Head
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.55), ghostMat);
            head.position.y = 1.1; this.mesh.add(head);

            // Wispy tail fins (3 tapered pieces)
            const tailMat = ghostMat.clone(); tailMat.opacity = 0.3;
            for (let i = 0; i < 3; i++) {
                const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.15), tailMat);
                tail.position.set((i - 1) * 0.25, -0.2, 0);
                tail.rotation.z = (i - 1) * 0.25;
                this.mesh.add(tail);
            }

            // Glowing blue eyes
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.9 });
            const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), eyeMat);
            eyeL.position.set(-0.15, 1.15, 0.28); this.mesh.add(eyeL);
            const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), eyeMat);
            eyeR.position.set(0.15, 1.15, 0.28); this.mesh.add(eyeR);

        } else if (type === 'revenant') {
            // ---- POISON REVENANT BOSS ----
            this.health = 150;
            this.maxHealth = 150;
            this.isHostile = true;
            this.phase = 1;
            this.poisonTimer = 0;
            this.summonCooldown = 0;
            this.swoopCooldown = 0;
            this.isSwooping = false;
            this.flyHeight = 4;
            this.tendrils = [];

            const cloakMat = globalMobMats.revenantSkin.clone();
            const skullMat = globalMobMats.revenantSkull.clone();

            // Skull head
            const skull = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skullMat);
            skull.position.y = 2.5; this.mesh.add(skull);
            this.skullMesh = skull;

            // Green glow aura around skull
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.15 });
            const glow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), glowMat);
            glow.position.y = 2.5; this.mesh.add(glow);
            this.glowMesh = glow;

            // Cloak body
            const cloakBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.6), cloakMat);
            cloakBody.position.y = 1.4; this.mesh.add(cloakBody);

            // Cloak lower (flares out wider)
            const cloakLow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.5), cloakMat);
            cloakLow.position.y = 0.5; this.mesh.add(cloakLow);

            // Tattered bottom tendrils
            const tendrilMat = cloakMat.clone(); tendrilMat.opacity = 0.5;
            for (let i = 0; i < 4; i++) {
                const t = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.2), tendrilMat);
                t.position.set(-0.55 + i * 0.37, -0.1, 0);
                this.mesh.add(t); this.tendrils.push(t);
            }

            // Scythe arm (right)
            this.rightArm = new THREE.Group();
            this.rightArm.position.set(0.8, 1.8, 0);
            const handleMat = new THREE.MeshLambertMaterial({ color: 0x1a0a00 });
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), handleMat);
            handle.position.y = -0.5; this.rightArm.add(handle);
            const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2a6020, emissive: new THREE.Color(0x00ff44), emissiveIntensity: 0.4 });
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.08), bladeMat);
            blade.position.set(0.4, 0.3, 0); blade.rotation.z = 0.5; this.rightArm.add(blade);
            const tip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.08), bladeMat);
            tip.position.set(0.75, 0.1, 0); tip.rotation.z = -0.8; this.rightArm.add(tip);
            this.mesh.add(this.rightArm);

            // Left arm (reaching out ominously)
            this.leftArm = new THREE.Group();
            this.leftArm.position.set(-0.8, 1.8, 0);
            const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), cloakMat);
            lHand.position.y = -0.3; this.leftArm.add(lHand);
            this.mesh.add(this.leftArm);

        } else if (type === 'sand_defender') {
            this.health = 50;
            this.isHostile = false;
            const mats = { skin: globalMobMats.sandDefSkin.clone(), face: globalMobMats.sandDefFace.clone() };
            const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), [mats.skin, mats.skin, mats.skin, mats.skin, mats.face, mats.skin]);
            headMesh.position.y = 2.1; this.mesh.add(headMesh);
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5), mats.skin);
            body.position.y = 1.3; this.mesh.add(body);
            this.leftArm = new THREE.Group(); this.leftArm.position.set(-0.65, 1.6, 0);
            const laMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), mats.skin);
            laMesh.position.y = -0.4; this.leftArm.add(laMesh); this.mesh.add(this.leftArm);
            this.rightArm = new THREE.Group(); this.rightArm.position.set(0.65, 1.6, 0);
            const raMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), mats.skin);
            raMesh.position.y = -0.4; this.rightArm.add(raMesh); this.mesh.add(this.rightArm);
            this.leftLeg = new THREE.Group(); this.leftLeg.position.set(-0.25, 0.8, 0);
            const llMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), mats.skin);
            llMesh.position.y = -0.4; this.leftLeg.add(llMesh); this.mesh.add(this.leftLeg);
            this.rightLeg = new THREE.Group(); this.rightLeg.position.set(0.25, 0.8, 0);
            const rlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), mats.skin);
            rlMesh.position.y = -0.4; this.rightLeg.add(rlMesh); this.mesh.add(this.rightLeg);

        } else {
            // Humanoid (Human, Zombie, Husk, Skeleton, Snow Defender)
            let mats;
            if (type === 'zombie') {
                mats = { skin: globalMobMats.zombieSkin.clone(), face: globalMobMats.zombieFace.clone(), shirt: globalMobMats.zombieShirt.clone(), pants: globalMobMats.zombiePants.clone() };
                this.health = 20; this.isHostile = true;
            } else if (type === 'husk') {
                mats = { skin: globalMobMats.huskSkin.clone(), face: globalMobMats.huskFace.clone(), shirt: globalMobMats.huskSkin.clone(), pants: globalMobMats.huskSkin.clone() };
                this.health = 20; this.isHostile = true;
            } else if (type === 'skeleton') {
                mats = { skin: globalMobMats.skeletonSkin.clone(), face: globalMobMats.skeletonFace.clone(), shirt: globalMobMats.skeletonSkin.clone(), pants: globalMobMats.skeletonSkin.clone() };
                this.health = 20; this.isHostile = true;
            } else if (type === 'snow_defender') {
                mats = { skin: globalMobMats.snowDefSkin.clone(), face: globalMobMats.snowDefFace.clone(), shirt: globalMobMats.snowDefSkin.clone(), pants: globalMobMats.snowDefSkin.clone() };
                this.health = 40; this.isHostile = false;
            } else {
                mats = { skin: globalMobMats.skin.clone(), face: globalMobMats.face.clone(), shirt: globalMobMats.shirt.clone(), pants: globalMobMats.pants.clone() };
            }

            const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), [mats.skin, mats.skin, mats.skin, mats.skin, mats.face, mats.skin]);
            headMesh.position.y = 1.75; this.mesh.add(headMesh);
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), mats.shirt);
            body.position.y = 1.125; this.mesh.add(body);
            this.leftArm = new THREE.Group(); this.leftArm.position.set(-0.35, 1.45, 0);
            const laMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), mats.skin);
            laMesh.position.y = -0.3; this.leftArm.add(laMesh); this.mesh.add(this.leftArm);
            this.rightArm = new THREE.Group(); this.rightArm.position.set(0.35, 1.45, 0);
            const raMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), mats.skin);
            raMesh.position.y = -0.3; this.rightArm.add(raMesh); this.mesh.add(this.rightArm);
            this.leftLeg = new THREE.Group(); this.leftLeg.position.set(-0.15, 0.75, 0);
            const llMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.24), mats.pants);
            llMesh.position.y = -0.375; this.leftLeg.add(llMesh); this.mesh.add(this.leftLeg);
            this.rightLeg = new THREE.Group(); this.rightLeg.position.set(0.15, 0.75, 0);
            const rlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.24), mats.pants);
            rlMesh.position.y = -0.375; this.rightLeg.add(rlMesh); this.mesh.add(this.rightLeg);

            if (type === 'zombie' || type === 'husk' || type === 'skeleton') {
                this.leftArm.rotation.x = -Math.PI / 2;
                this.rightArm.rotation.x = -Math.PI / 2;
            }
        }

        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
        this.state = 'wander';
        this.stateTimer = 0;
        this.moveDir = new THREE.Vector3();
    }

    update(delta, world, playerPos) {
        if (this.dead) return;

        // --- GHOST AI ---
        if (this.type === 'ghost') {
            this.animTime += delta;
            this.swoopCooldown -= delta;
            if (this.cooldown > 0) this.cooldown -= delta;

            const distToPlayer = this.position.distanceTo(playerPos);
            const desiredY = playerPos.y + this.flyHeight;

            if (!this.isSwooping) {
                // Hover and float
                this.position.y += (desiredY - this.position.y) * delta * 2;
                this.position.y += Math.sin(this.animTime * 1.5) * 0.02;

                if (distToPlayer < 20) {
                    this.moveDir.subVectors(playerPos, this.position).normalize();
                    this.moveDir.y = 0;
                    this.position.x += this.moveDir.x * 4 * delta;
                    this.position.z += this.moveDir.z * 4 * delta;
                }

                // Trigger swoop
                if (distToPlayer < 12 && this.swoopCooldown <= 0) {
                    this.isSwooping = true;
                    this.swoopCooldown = 5.0;
                    this.swoopTarget = playerPos.clone();
                }
            } else {
                // Swooping down at player
                const swoopDir = new THREE.Vector3().subVectors(this.swoopTarget, this.position).normalize();
                this.position.add(swoopDir.multiplyScalar(delta * 14));
                if (this.position.distanceTo(this.swoopTarget) < 1.5) {
                    if (this.cooldown <= 0) {
                        playerHealth -= 3;
                        const kbDir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
                        velocity.add(kbDir.multiplyScalar(8));
                        velocity.y = 6;
                        updateHealthUI(); showDamageOverlay();
                        this.cooldown = 0.5;
                    }
                    this.isSwooping = false;
                    this.position.y = playerPos.y + this.flyHeight;
                }
            }

            // Tail wave animation
            this.mesh.children.forEach((child, i) => {
                if (i >= 2 && i <= 4) child.rotation.z = Math.sin(this.animTime * 2 + i) * 0.25;
            });

            this.mesh.position.copy(this.position);
            const fd = new THREE.Vector3().subVectors(playerPos, this.position); fd.y = 0;
            if (fd.length() > 0.1) this.mesh.rotation.y = Math.atan2(fd.x, fd.z);
            return;
        }

        // --- REVENANT BOSS AI ---
        if (this.type === 'revenant') {
            this.animTime += delta;
            this.swoopCooldown -= delta;
            this.poisonTimer -= delta;
            this.summonCooldown -= delta;
            if (this.cooldown > 0) this.cooldown -= delta;

            const distToPlayer = this.position.distanceTo(playerPos);

            // Phase 2 at 50% HP - skull goes red
            if (this.health < 75 && this.phase === 1) {
                this.phase = 2;
                if (this.skullMesh) this.skullMesh.material.emissive = new THREE.Color(0xff0000);
                if (this.glowMesh) this.glowMesh.material.color.setHex(0xff2200);
            }

            // Float above player
            const desiredY = playerPos.y + this.flyHeight;
            this.position.y += (desiredY - this.position.y) * delta * 1.5;
            this.position.y += Math.sin(this.animTime * 0.8) * 0.03;

            // Animate tattered tendrils
            if (this.tendrils) this.tendrils.forEach((t, i) => {
                t.rotation.z = Math.sin(this.animTime * 2 + i * 0.8) * 0.3;
                t.position.y = -0.1 + Math.sin(this.animTime * 1.5 + i) * 0.1;
            });

            // Scythe swing animation
            if (this.rightArm) this.rightArm.rotation.x = Math.sin(this.animTime * 1.2) * 0.4 - 0.3;
            if (this.leftArm) this.leftArm.rotation.x = Math.sin(this.animTime * 1.2 + Math.PI) * 0.3;

            // Skull bob
            if (this.skullMesh) {
                this.skullMesh.rotation.y = Math.sin(this.animTime * 0.6) * 0.2;
                this.skullMesh.position.y = 2.5 + Math.sin(this.animTime) * 0.08;
            }

            // Glow pulse
            if (this.glowMesh) this.glowMesh.material.opacity = 0.1 + Math.sin(this.animTime * 2) * 0.08;

            // Chase player
            if (distToPlayer < 25) {
                this.moveDir.subVectors(playerPos, this.position).normalize();
                this.moveDir.y = 0;
                const spd = this.phase === 2 ? 4.5 : 3.0;
                this.position.x += this.moveDir.x * spd * delta;
                this.position.z += this.moveDir.z * spd * delta;
            }

            // Swoop attack
            if (distToPlayer < 15 && this.swoopCooldown <= 0 && !this.isSwooping) {
                this.isSwooping = true;
                this.swoopTarget = playerPos.clone();
                this.swoopCooldown = this.phase === 2 ? 3.0 : 5.0;
            }
            if (this.isSwooping) {
                const sd = new THREE.Vector3().subVectors(this.swoopTarget, this.position).normalize();
                this.position.add(sd.multiplyScalar(delta * 16));
                if (this.position.distanceTo(this.swoopTarget) < 2) {
                    if (this.cooldown <= 0) {
                        playerHealth -= this.phase === 2 ? 5 : 3;
                        const kbDir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
                        velocity.add(kbDir.multiplyScalar(12)); velocity.y = 8;
                        updateHealthUI(); showDamageOverlay();
                        this.cooldown = 0.3;
                    }
                    this.isSwooping = false;
                    this.position.y = playerPos.y + this.flyHeight;
                }
            }

            // Poison aura damage
            if (this.poisonTimer <= 0 && distToPlayer < 10) {
                playerHealth -= this.phase === 2 ? 3 : 2;
                updateHealthUI(); showDamageOverlay();
                this.poisonTimer = this.phase === 2 ? 4.0 : 8.0;
            }

            // Phase 2: summon skeleton minions
            if (this.phase === 2 && this.summonCooldown <= 0 && mobManager.mobs.length < 20) {
                for (let i = 0; i < 2; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    mobManager.mobs.push(new Mob('skeleton',
                        this.position.x + Math.cos(ang) * 3,
                        this.position.y,
                        this.position.z + Math.sin(ang) * 3, scene));
                }
                this.summonCooldown = 15.0;
            }

            // Death - drop loot
            if (this.health <= 0 && !this.dead) {
                this.dead = true;
                this.mesh.visible = false;
                addToInventory(BLOCKS.DIAMOND.id, 3 + Math.floor(Math.random() * 3));
                addToInventory(BLOCKS.GOLEM_EYE.id, 2);
                addToInventory(BLOCKS.REVENANT_SHARD.id, 1);
            }

            this.mesh.position.copy(this.position);
            const fd = new THREE.Vector3().subVectors(playerPos, this.position); fd.y = 0;
            if (fd.length() > 0.1) this.mesh.rotation.y = Math.atan2(fd.x, fd.z);
            return;
        }

        // --- SUNLIGHT BURNING (existing mobs) ---
        if (this.isHostile && this.type !== 'husk' && this.type !== 'sand_defender' && this.type !== 'snow_defender') {
            const timeProgress = (dayTime % DAY_LENGTH) / DAY_LENGTH;
            const isDay = timeProgress > 0.1 && timeProgress < 0.4;
            if (isDay) {
                const tx = Math.floor(this.position.x);
                const ty = Math.floor(this.position.y + 1);
                const tz = Math.floor(this.position.z);
                let exposed = true;
                for (let y = ty; y < CHUNK_HEIGHT; y++) {
                    if (world.getBlock(tx, y, tz) !== 0) { exposed = false; break; }
                }
                if (exposed) {
                    this.takeDamage(0.05);
                    if (Math.random() < 0.1) this.mesh.children[0].material.color.setHex(0xFF4500);
                }
            }
        }

        const distToPlayer = this.position.distanceTo(playerPos);

        if (this.isHostile) {
            const chaseRange = (this.type === 'zombie' || this.type === 'husk') ? 16 : 10;
            if (distToPlayer < chaseRange) {
                this.moveDir.subVectors(playerPos, this.position).normalize();
                this.moveDir.y = 0;
                if (distToPlayer < 1.5 && this.cooldown <= 0) {
                    playerHealth -= 2;
                    const kbDir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
                    if (this.type === 'sand_defender') {
                        velocity.add(kbDir.multiplyScalar(20)); velocity.y = 15; playerHealth -= 2;
                    } else {
                        velocity.add(kbDir.multiplyScalar(10)); velocity.y = 5;
                    }
                    updateHealthUI(); showDamageOverlay();
                    this.cooldown = 1.0;
                }
            } else if (this.type !== 'zombie' && this.type !== 'husk') {
                this.isHostile = false;
            } else {
                this.stateTimer -= delta;
                if (this.stateTimer <= 0) {
                    this.stateTimer = Math.random() * 3 + 2;
                    this.moveDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                }
            }
        } else {
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.stateTimer = Math.random() * 3 + 2;
                if (Math.random() > 0.5) this.moveDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                else this.moveDir.set(0, 0, 0);
            }
        }
        if (this.cooldown > 0) this.cooldown -= delta;

        const speed = (this.type === 'zombie' || this.type === 'husk') ? 2.0 : 3.0;
        this.velocity.x = this.moveDir.x * speed * delta;
        this.velocity.z = this.moveDir.z * speed * delta;
        this.velocity.y -= 30.0 * delta;

        this.position.x += this.velocity.x;
        if (this.checkCol(world)) this.position.x -= this.velocity.x;
        this.position.z += this.velocity.z;
        if (this.checkCol(world)) this.position.z -= this.velocity.z;
        this.position.y += this.velocity.y * delta;
        if (this.checkCol(world)) {
            this.position.y -= this.velocity.y * delta;
            this.velocity.y = 0;
            if (this.moveDir.length() > 0.1 && this.checkWall(world)) this.velocity.y = 8;
        }

        this.mesh.position.copy(this.position);
        if (this.moveDir.length() > 0.1) this.mesh.rotation.y = Math.atan2(this.moveDir.x, this.moveDir.z);

        if (this.type === 'human' || this.type === 'zombie' || this.type === 'husk' || this.type === 'skeleton' || this.type === 'sand_defender' || this.type === 'snow_defender') {
            if (this.moveDir.length() > 0.01) {
                this.animTime += delta * 10;
                this.leftLeg.rotation.x = Math.sin(this.animTime) * 0.5;
                this.rightLeg.rotation.x = Math.sin(this.animTime + Math.PI) * 0.5;
                if (this.type !== 'zombie' && this.type !== 'husk' && this.type !== 'skeleton') {
                    this.leftArm.rotation.x = Math.sin(this.animTime + Math.PI) * 0.5;
                    this.rightArm.rotation.x = Math.sin(this.animTime) * 0.5;
                } else {
                    this.leftArm.rotation.x = -Math.PI / 2 + Math.sin(this.animTime) * 0.1;
                    this.rightArm.rotation.x = -Math.PI / 2 + Math.sin(this.animTime + Math.PI) * 0.1;
                }
            } else {
                this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 10);
                this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 10);
                if (this.type !== 'zombie' && this.type !== 'husk' && this.type !== 'skeleton') {
                    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 10);
                    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 10);
                }
            }
        } else if (this.type === 'pig') {
            if (this.moveDir.length() > 0.01) {
                this.animTime += delta * 10;
                this.pigLegs[0].rotation.x = Math.sin(this.animTime) * 0.5;
                this.pigLegs[3].rotation.x = Math.sin(this.animTime) * 0.5;
                this.pigLegs[1].rotation.x = Math.sin(this.animTime + Math.PI) * 0.5;
                this.pigLegs[2].rotation.x = Math.sin(this.animTime + Math.PI) * 0.5;
            } else {
                this.pigLegs.forEach(l => l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0, delta * 10));
            }
        }
    }

    checkCol(world) {
        const x = Math.floor(this.position.x); const y = Math.floor(this.position.y); const z = Math.floor(this.position.z);
        const b = world.getBlock(x, y, z);
        return b !== 0 && b !== BLOCKS.COBWEB.id;
    }

    checkWall(world) {
        const fwd = this.position.clone().add(this.moveDir.clone().multiplyScalar(0.5));
        const x = Math.floor(fwd.x); const y = Math.floor(fwd.y + 0.5); const z = Math.floor(fwd.z);
        const b = world.getBlock(x, y, z);
        return b !== 0 && b !== BLOCKS.COBWEB.id;
    }

    takeDamage(amount) {
        this.health -= amount;

        const flash = (obj, isRed) => {
            if (obj.material && obj.material.color) {
                if (obj.userData.origColor === undefined) obj.userData.origColor = obj.material.color.getHex();
                if (isRed) obj.material.color.setHex(0xFF0000);
                else obj.material.color.setHex(obj.userData.origColor);
            }
            if (obj.children) obj.children.forEach(c => flash(c, isRed));
        };

        flash(this.mesh, true);
        setTimeout(() => { if (!this.dead) flash(this.mesh, false); }, 200);

        if (this.type === 'human' || this.type.includes('defender')) this.isHostile = true;
        if (this.type === 'husk' || this.type === 'sand_defender') alertDefenders(this.position);

        if (this.health <= 0) {
            this.dead = true;
            this.mesh.visible = false;
            if (this.type === 'snow_defender') {
                addToInventory(BLOCKS.SNOW.id, 10 + Math.floor(Math.random() * 6));
                addToInventory(BLOCKS.GOLEM_EYE.id, 1);
            } else if (this.type === 'sand_defender') {
                addToInventory(BLOCKS.SAND.id, 10 + Math.floor(Math.random() * 6));
                addToInventory(BLOCKS.GOLEM_EYE.id, 1);
            }
        }

        // Revenant boss spawn trigger: skeleton dies in a sand pit
        if (this.type === 'skeleton' && this.health <= 0) {
            checkRevenantSpawn(this);
        }
    }
}

// --- REVENANT SPAWN TRIGGER ---
function checkRevenantSpawn(mob) {
    if (mob.type !== 'skeleton') return;
    const x = Math.floor(mob.position.x);
    const y = Math.floor(mob.position.y);
    const z = Math.floor(mob.position.z);

    let sandCount = 0;
    const neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    neighbors.forEach(([ddx, ddz]) => {
        const b = world.getBlock(x + ddx, y, z + ddz);
        if (b === BLOCKS.SAND.id || b === BLOCKS.SANDSTONE.id || b === BLOCKS.SAND_BRICK.id) sandCount++;
    });
    const below = world.getBlock(x, y - 1, z);
    const isSandFloor = below === BLOCKS.SAND.id || below === BLOCKS.SANDSTONE.id;

    if (sandCount >= 3 && isSandFloor) {
        console.log('☠️ THE POISON REVENANT AWAKENS!');
        setTimeout(() => {
            mobManager.mobs.push(new Mob('revenant', x, y + 4, z, scene));
        }, 1500);
    }
}

// --- DEFENDER ALERT SYSTEM ---
function alertDefenders(position, radius = 25) {
    mobManager.mobs.forEach(m => {
        if (m.type === 'sand_defender' && !m.dead) {
            if (m.position.distanceTo(position) < radius) m.isHostile = true;
        }
    });
}

class MobManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.mobs = [];
        this.spawnTimer = 0;
    }

    update(delta, playerPos) {
        this.spawnTimer += delta;
        if (this.spawnTimer > 5.0 && this.mobs.length < 15) {
            this.spawnTimer = 0;
            this.spawnMob(playerPos);
        }
        this.mobs.forEach(mob => mob.update(delta, this.world, playerPos));
        this.mobs = this.mobs.filter(m => !m.dead);
    }

    spawnMob(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 20;
        const x = playerPos.x + Math.cos(angle) * dist;
        const z = playerPos.z + Math.sin(angle) * dist;
        let y = 100;
        for (let i = CHUNK_HEIGHT - 1; i > 0; i--) {
            if (this.world.getBlock(Math.floor(x), i, Math.floor(z)) !== 0) { y = i + 2; break; }
        }

        const bVal = biomeNoise.noise2D(x * 0.002, z * 0.002);
        let biome = 'PLAINS';
        if (bVal > 0.5) biome = 'DESERT';
        else if (bVal < -0.5) biome = 'SNOW';

        let mobType = 'pig';
        const r = Math.random();
        const timeProgress = (dayTime % DAY_LENGTH) / DAY_LENGTH;
        const isNight = timeProgress > 0.45 && timeProgress < 0.95;

        if (biome === 'DESERT') {
            if (r < 0.8) mobType = 'husk';
            else mobType = 'sand_defender';
        } else if (biome === 'SNOW') {
            if (r < 0.3) { if (isNight) mobType = 'zombie'; else return; }
            else if (r < 0.6) mobType = 'snow_defender';
            else if (r < 0.8) mobType = 'cow';
            else mobType = 'sheep';
        } else {
            if (r < 0.3) mobType = 'pig';
            else if (r < 0.5) mobType = 'cow';
            else if (r < 0.7) mobType = 'sheep';
            else if (r < 0.85) { if (isNight) mobType = 'zombie'; else mobType = 'pig'; }
            else { if (isNight) mobType = 'skeleton'; else return; }
        }

        // Ghost spawns at night in non-desert biomes
        if (isNight && Math.random() > 0.75 && biome !== 'DESERT') {
            mobType = 'ghost';
        }

        if (!isNight && (mobType === 'zombie' || mobType === 'skeleton')) return;

        this.mobs.push(new Mob(mobType, x, y, z, this.scene));
    }
}

const INVENTORY_SIZE = 36;
const CONTAINER_SIZE = 27;
const inventory = Array(INVENTORY_SIZE).fill().map(() => ({ type: 0, count: 0 }));
let currentContainer = null;
let currentContainerKey = null;
let selectedSlot = 0;
let isInventoryOpen = false;
let isCraftingTableOpen = false;
let isContainerOpen = false;
let isChatOpen = false;

const RECIPES = [
    { name: "Oak Planks", input: { type: 4, count: 1 }, output: { type: 9, count: 4 }, requiresTable: false },
    { name: "Jungle Planks", input: { type: 15, count: 1 }, output: { type: 9, count: 4 }, requiresTable: false },
    { name: "Stick", input: { type: 9, count: 2 }, output: { type: 20, count: 4 }, requiresTable: false },
    { name: "Crafting Table", input: { type: 9, count: 4 }, output: { type: 12, count: 1 }, requiresTable: false },
    { name: "Chest", input: { type: 9, count: 8 }, output: { type: 28, count: 1 }, requiresTable: true },
    { name: "Wood Pickaxe", input: { type: 9, count: 3 }, input2: { type: 20, count: 2 }, output: { type: 21, count: 1 }, requiresTable: true },
    { name: "Stone Pickaxe", input: { type: 11, count: 3 }, input2: { type: 20, count: 2 }, output: { type: 22, count: 1 }, requiresTable: true },
    { name: "Wood Shovel", input: { type: 9, count: 1 }, input2: { type: 20, count: 2 }, output: { type: 23, count: 1 }, requiresTable: true },
    { name: "Stone Shovel", input: { type: 11, count: 1 }, input2: { type: 20, count: 2 }, output: { type: 24, count: 1 }, requiresTable: true },
    { name: "Stone Bricks", input: { type: 11, count: 4 }, output: { type: 10, count: 4 }, requiresTable: true },
    { name: "Sandstone", input: { type: 6, count: 4 }, output: { type: 14, count: 1 }, requiresTable: true },
    { name: "Furnace", input: { type: 11, count: 8 }, output: { type: 34, count: 1 }, requiresTable: true },
    { name: "Wood Sword", input: { type: 9, count: 2 }, input2: { type: 20, count: 1 }, output: { type: 35, count: 1 }, requiresTable: true },
    { name: "Stone Sword", input: { type: 11, count: 2 }, input2: { type: 20, count: 1 }, output: { type: 36, count: 1 }, requiresTable: true },
    { name: "Iron Sword", input: { type: 41, count: 2 }, input2: { type: 20, count: 1 }, output: { type: 37, count: 1 }, requiresTable: true },
    { name: "Gold Sword", input: { type: 42, count: 2 }, input2: { type: 20, count: 1 }, output: { type: 38, count: 1 }, requiresTable: true },
    { name: "Diamond Sword", input: { type: 43, count: 2 }, input2: { type: 20, count: 1 }, output: { type: 39, count: 1 }, requiresTable: true },
    // ═══ NULL DIMENSION RECIPES ═══
    { name: "Null Bricks", input: { type: BLOCKS.NULL_STONE.id, count: 4 }, output: { type: BLOCKS.NULL_BRICK.id, count: 4 }, requiresTable: true },
    { name: "Void Sword", input: { type: BLOCKS.NULL_INGOT.id, count: 2 }, input2: { type: 20, count: 1 }, output: { type: BLOCKS.NULL_INGOT.id, count: 1 }, requiresTable: true }, // placeholder
    { name: "Null Stone (4)", input: { type: BLOCKS.NULL_SOIL.id, count: 2 }, output: { type: BLOCKS.NULL_STONE.id, count: 4 }, requiresTable: false },
];

function initUI() {
    const bar = document.getElementById('hotbar');
    bar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const el = document.createElement('div');
        el.className = 'slot'; el.id = `hotbar-${i}`;
        bar.appendChild(el);
    }
    const grid = document.getElementById('inv-grid');
    grid.innerHTML = '';
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'slot'; el.id = `inv-${i}`;
        el.onclick = (e) => handleInvClick(i);
        grid.appendChild(el);
    }
    const containerGrid = document.getElementById('chest-grid');
    for (let i = 0; i < CONTAINER_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'slot'; el.id = `chest-${i}`;
        el.onclick = () => handleContainerClick(i, 'chest');
        containerGrid.appendChild(el);
    }
    const containerPlayerGrid = document.getElementById('container-player-grid');
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'slot'; el.id = `cont-player-${i}`;
        el.onclick = () => handleContainerClick(i, 'player');
        containerPlayerGrid.appendChild(el);
    }
    const furnacePlayerGrid = document.getElementById('furnace-player-grid');
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'slot'; el.id = `furnace-player-${i}`;
        el.onclick = () => handleFurnaceInvClick(i);
        furnacePlayerGrid.appendChild(el);
    }
    updateUI();
    document.getElementById('chat-send').onclick = sendChatMessage;
    document.getElementById('chat-close').onclick = closeChat;
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
}

function handleInvClick(i) {
    document.querySelectorAll('#inv-grid .slot').forEach(s => s.style.borderColor = '#555');
    document.getElementById(`inv-${i}`).style.borderColor = 'white';
    if (i < 9) {
        selectedSlot = i;
    } else {
        const temp = inventory[selectedSlot];
        inventory[selectedSlot] = inventory[i];
        inventory[i] = temp;
    }
    updateUI();
    const item = inventory[i];
    const nameDisplay = document.getElementById('selected-item-name');
    const loreDisplay = document.getElementById('lore-text');
    const btn = document.getElementById('gemini-btn');
    if (item.type !== 0) {
        nameDisplay.innerText = getBlockName(item.type);
        loreDisplay.innerText = item.lore || "";
        btn.style.display = 'block';
        btn.onclick = async () => {
            btn.innerText = "Analyzing...";
            const itemName = getBlockName(item.type).replace('_', ' ');
            const lore = await callGemini(`Write a 1-sentence mysterious description for ${itemName}.`, "You are an ancient chronicle of a voxel world. Keep it short and cryptic.");
            item.lore = lore; loreDisplay.innerText = lore; btn.innerText = "✨ Analyze";
        };
    } else {
        nameDisplay.innerText = "Empty Slot"; loreDisplay.innerText = ""; btn.style.display = 'none';
    }
}

function handleContainerClick(idx, origin) {
    if (!currentContainer) return;
    if (origin === 'chest') {
        const item = currentContainer.items[idx];
        if (item.type !== 0) { addToInventory(item.type, item.count); item.type = 0; item.count = 0; updateUI(); updateContainerUI(); }
    } else {
        const item = inventory[idx];
        if (item.type !== 0) {
            let placed = false;
            for (let i = 0; i < CONTAINER_SIZE; i++) {
                if (currentContainer.items[i].type === item.type) { currentContainer.items[i].count += item.count; item.type = 0; item.count = 0; placed = true; break; }
            }
            if (!placed) {
                for (let i = 0; i < CONTAINER_SIZE; i++) {
                    if (currentContainer.items[i].type === 0) { currentContainer.items[i].type = item.type; currentContainer.items[i].count = item.count; item.type = 0; item.count = 0; placed = true; break; }
                }
            }
            updateUI(); updateContainerUI();
        }
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if (!text) return;
    const hist = document.getElementById('chat-history');
    hist.innerHTML += `<div class="chat-entry chat-player">You: ${text}</div>`;
    input.value = ''; hist.scrollTop = hist.scrollHeight;
    const response = await callGemini(text, "You are a confused survivor in a blocky voxel world. You are friendly but cautious. Keep answers under 2 sentences.");
    hist.innerHTML += `<div class="chat-entry chat-npc">Survivor: ${response}</div>`;
    hist.scrollTop = hist.scrollHeight;
}

function closeChat() {
    document.getElementById('chat-modal').style.display = 'none';
    isChatOpen = false; controls.lock();
}

function updateRecipeList() {
    const list = document.getElementById('recipe-list');
    list.innerHTML = '';
    const availableRecipes = RECIPES.filter(r => !r.requiresTable || (r.requiresTable && isCraftingTableOpen));
    if (availableRecipes.length === 0) {
        list.innerHTML = '<div style="color:#aaa; padding:10px;">Use a Crafting Table to see more recipes.</div>';
        return;
    }
    availableRecipes.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'craft-btn';
        const icon = document.createElement('div'); icon.className = 'craft-icon';
        icon.style.backgroundImage = `url(${atlasURL})`;
        const [c, row] = getBlockIconPos(r.output.type);
        icon.style.backgroundPosition = `-${c * 32}px -${row * 32}px`;
        const txt = document.createElement('span'); txt.innerText = `${r.name}`;
        const cost = document.createElement('span'); cost.style.fontSize = '12px'; cost.style.color = '#aaa';
        let costText = `${r.input.count} ${getBlockName(r.input.type)}`;
        if (r.input2) costText += `, ${r.input2.count} ${getBlockName(r.input2.type)}`;
        cost.innerText = costText;
        btn.appendChild(icon); btn.appendChild(txt); btn.appendChild(cost);
        btn.onclick = () => craftItem(r);
        list.appendChild(btn);
    });
}

function toggleInventory(forceState = null, withTable = false) {
    isInventoryOpen = forceState !== null ? forceState : !isInventoryOpen;
    if (isInventoryOpen) isContainerOpen = false;
    isCraftingTableOpen = withTable;
    const screen = document.getElementById('inventory-screen');
    const containerScreen = document.getElementById('container-screen');
    containerScreen.style.display = 'none';
    if (isInventoryOpen) {
        screen.style.display = 'flex';
        document.getElementById('crafting-title').innerText = withTable ? "Crafting Table" : "Crafting";
        updateRecipeList(); controls.unlock();
    } else {
        screen.style.display = 'none';
        suppressUnlockBlocker = true;
        controls.lock();
    }
}

function openContainer(key) {
    isContainerOpen = true; isInventoryOpen = false;
    document.getElementById('inventory-screen').style.display = 'none';
    document.getElementById('container-screen').style.display = 'flex';
    const aw = (typeof activeWorld === 'function') ? activeWorld() : world;
    if (!aw.chestData.has(key)) aw.chestData.set(key, Array(CONTAINER_SIZE).fill().map(() => ({ type: 0, count: 0 })));
    currentContainer = { key: key, items: aw.chestData.get(key) };
    currentContainerKey = key; // remember key for portal check on close
    updateContainerUI();
    suppressUnlockBlocker = false;
    controls.unlock();
}

// Called whenever container is closed — checks if this chest is a portal offering
function onContainerClose() {
    if (currentContainerKey) {
        const parts = currentContainerKey.split(',');
        const cx2 = parseInt(parts[0]), cy2 = parseInt(parts[1]), cz2 = parseInt(parts[2]);
        if (checkPortalOffering(cx2, cy2, cz2)) {
            setTimeout(() => spawnNullPortal(cx2, cy2, cz2), 300);
        }
        currentContainerKey = null;
    }
}

function craftItem(recipe) {
    const check = (req) => {
        if (!req) return true;
        let total = 0;
        for (let i = 0; i < INVENTORY_SIZE; i++) if (inventory[i].type === req.type) total += inventory[i].count;
        return total >= req.count;
    };
    const consume = (req) => {
        if (!req) return;
        let needed = req.count;
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            if (inventory[i].type === req.type) {
                const take = Math.min(inventory[i].count, needed);
                inventory[i].count -= take; needed -= take;
                if (inventory[i].count === 0) { inventory[i].type = 0; inventory[i].lore = null; }
                if (needed <= 0) return;
            }
        }
    };
    if (check(recipe.input) && check(recipe.input2)) {
        consume(recipe.input); consume(recipe.input2);
        addToInventory(recipe.output.type, recipe.output.count);
        updateUI();
    } else {
        alert("Missing materials!");
    }
}

function updateUI() {
    for (let i = 0; i < 9; i++) {
        const el = document.getElementById(`hotbar-${i}`);
        if (i === selectedSlot) el.classList.add('active'); else el.classList.remove('active');
        renderSlot(el, inventory[i]);
    }
    for (let i = 0; i < INVENTORY_SIZE; i++) { const el = document.getElementById(`inv-${i}`); renderSlot(el, inventory[i]); }
    if (isContainerOpen) {
        for (let i = 0; i < INVENTORY_SIZE; i++) { const el = document.getElementById(`cont-player-${i}`); renderSlot(el, inventory[i]); }
    }
}

function updateContainerUI() {
    if (!currentContainer) return;
    for (let i = 0; i < CONTAINER_SIZE; i++) { const el = document.getElementById(`chest-${i}`); renderSlot(el, currentContainer.items[i]); }
    updateUI();
}

function renderSlot(el, item) {
    el.innerHTML = '';
    if (item.type !== 0 && item.count > 0) {
        const icon = document.createElement('div');
        icon.className = 'slot-icon'; icon.style.display = 'block';
        icon.style.backgroundImage = `url(${atlasURL})`;
        const [c, row] = getBlockIconPos(item.type);
        icon.style.backgroundPosition = `-${c * 32}px -${row * 32}px`;
        el.appendChild(icon);
        const count = document.createElement('div');
        count.className = 'slot-count'; count.innerText = item.count;
        el.appendChild(count);
    }
}

function addToInventory(type, amount = 1) {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        if (inventory[i].type === type) { inventory[i].count += amount; updateUI(); return; }
    }
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        if (inventory[i].count === 0) { inventory[i].type = type; inventory[i].count = amount; updateUI(); return; }
    }
}

function generateLoot() {
    const items = Array(CONTAINER_SIZE).fill().map(() => ({ type: 0, count: 0 }));
    const lootTable = [
        { type: BLOCKS.DIAMOND.id, count: [1, 3] },
        { type: BLOCKS.GOLD_INGOT.id, count: [2, 5] },
        { type: BLOCKS.IRON_INGOT.id, count: [3, 8] },
        { type: BLOCKS.STICK.id, count: [5, 12] },
        { type: BLOCKS.MELON.id, count: [2, 6] },
        { type: BLOCKS.TNT.id, count: [1, 2] },
        { type: BLOCKS.COBBLESTONE.id, count: [5, 15] }
    ];
    const numSlots = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numSlots; i++) {
        const slot = Math.floor(Math.random() * CONTAINER_SIZE);
        const loot = lootTable[Math.floor(Math.random() * lootTable.length)];
        const count = loot.count[0] + Math.floor(Math.random() * (loot.count[1] - loot.count[0]));
        if (items[slot].type === 0) { items[slot].type = loot.type; items[slot].count = count; }
    }
    return items;
}

class SimpleNoise {
    constructor() {
        this.perm = new Uint8Array(512);
        this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
        for (let i = 0; i < 512; i++) this.perm[i] = Math.floor(Math.random() * 256);
    }
    dot(g, x, y) { return g[0] * x + g[1] * y; }
    noise2D(xin, yin) {
        let n0, n1, n2;
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0), G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        let s = (xin + yin) * F2;
        let i = Math.floor(xin + s), j = Math.floor(yin + s);
        let t = (i + j) * G2;
        let X0 = i - t, Y0 = j - t;
        let x0 = xin - X0, y0 = yin - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        let x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        let x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
        let ii = i & 255, jj = j & 255;
        let gi0 = this.perm[ii + this.perm[jj]] % 12;
        let gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
        let gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
        let t0 = 0.5 - x0*x0 - y0*y0;
        if (t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0*t0*this.dot(this.grad3[gi0], x0, y0); }
        let t1 = 0.5 - x1*x1 - y1*y1;
        if (t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1*t1*this.dot(this.grad3[gi1], x1, y1); }
        let t2 = 0.5 - x2*x2 - y2*y2;
        if (t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2*t2*this.dot(this.grad3[gi2], x2, y2); }
        return 70.0 * (n0 + n1 + n2);
    }
}
// --- 3D NOISE for caves ---
class SimpleNoise3D {
    constructor() {
        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.perm[i] = Math.floor(Math.random() * 256);
        this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    }
    dot3(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }
    noise3D(xin, yin, zin) {
        const F3 = 1/3, G3 = 1/6;
        let s = (xin+yin+zin)*F3;
        let i = Math.floor(xin+s), j = Math.floor(yin+s), k = Math.floor(zin+s);
        let t = (i+j+k)*G3;
        let x0=xin-(i-t), y0=yin-(j-t), z0=zin-(k-t);
        let i1,j1,k1,i2,j2,k2;
        if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1}}
        else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0}}
        let x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
        let x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
        let x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
        let ii=i&255,jj=j&255,kk=k&255;
        let gi0=this.perm[ii+this.perm[jj+this.perm[kk]]]%12;
        let gi1=this.perm[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]]%12;
        let gi2=this.perm[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]]%12;
        let gi3=this.perm[ii+1+this.perm[jj+1+this.perm[kk+1]]]%12;
        let n0,n1,n2,n3;
        let t0=0.6-x0*x0-y0*y0-z0*z0; if(t0<0)n0=0;else{t0*=t0;n0=t0*t0*this.dot3(this.grad3[gi0],x0,y0,z0);}
        let t1=0.6-x1*x1-y1*y1-z1*z1; if(t1<0)n1=0;else{t1*=t1;n1=t1*t1*this.dot3(this.grad3[gi1],x1,y1,z1);}
        let t2=0.6-x2*x2-y2*y2-z2*z2; if(t2<0)n2=0;else{t2*=t2;n2=t2*t2*this.dot3(this.grad3[gi2],x2,y2,z2);}
        let t3=0.6-x3*x3-y3*y3-z3*z3; if(t3<0)n3=0;else{t3*=t3;n3=t3*t3*this.dot3(this.grad3[gi3],x3,y3,z3);}
        return 32*(n0+n1+n2+n3);
    }
}

const noise = new SimpleNoise();
const biomeNoise = new SimpleNoise();
const caveNoise = new SimpleNoise3D();
const caveNoise2 = new SimpleNoise3D();

// --- UNDERGROUND LOOT TABLES ---
function generateMineshaftLoot() {
    const items = Array(CONTAINER_SIZE).fill().map(() => ({ type: 0, count: 0 }));
    const loot = [
        { type: BLOCKS.IRON_ORE.id, weight: 8, count: [2, 6] },
        { type: BLOCKS.GOLD_ORE.id, weight: 4, count: [1, 3] },
        { type: BLOCKS.COAL_ORE.id, weight: 10, count: [3, 8] },
        { type: BLOCKS.IRON_INGOT.id, weight: 5, count: [1, 4] },
        { type: BLOCKS.STICK.id, weight: 6, count: [4, 10] },
        { type: BLOCKS.WOOD_PICK.id, weight: 3, count: [1, 1] },
        { type: BLOCKS.PLANKS.id, weight: 6, count: [4, 12] },
        { type: BLOCKS.COBWEB.id, weight: 4, count: [1, 3] },
    ];
    for (let i = 0; i < 5 + Math.floor(Math.random() * 4); i++) {
        const totalW = loot.reduce((s, l) => s + l.weight, 0);
        let r = Math.random() * totalW, picked = loot[0];
        for (const l of loot) { r -= l.weight; if (r <= 0) { picked = l; break; } }
        const slot = Math.floor(Math.random() * CONTAINER_SIZE);
        if (items[slot].type === 0) {
            items[slot].type = picked.type;
            items[slot].count = picked.count[0] + Math.floor(Math.random() * (picked.count[1] - picked.count[0]));
        }
    }
    return items;
}

function generateDungeonLoot() {
    const items = Array(CONTAINER_SIZE).fill().map(() => ({ type: 0, count: 0 }));
    const loot = [
        { type: BLOCKS.DIAMOND.id, weight: 2, count: [1, 2] },
        { type: BLOCKS.GOLD_INGOT.id, weight: 5, count: [1, 4] },
        { type: BLOCKS.IRON_INGOT.id, weight: 6, count: [2, 6] },
        { type: BLOCKS.IRON_SWORD.id, weight: 3, count: [1, 1] },
        { type: BLOCKS.STONE_SWORD.id, weight: 4, count: [1, 1] },
        { type: BLOCKS.DIAMOND_ORE.id, weight: 2, count: [1, 2] },
        { type: BLOCKS.GOLEM_EYE.id, weight: 2, count: [1, 1] },
        { type: BLOCKS.BRICKS.id, weight: 5, count: [4, 12] },
        { type: BLOCKS.TNT.id, weight: 3, count: [1, 2] },
    ];
    for (let i = 0; i < 6 + Math.floor(Math.random() * 4); i++) {
        const totalW = loot.reduce((s, l) => s + l.weight, 0);
        let r = Math.random() * totalW, picked = loot[0];
        for (const l of loot) { r -= l.weight; if (r <= 0) { picked = l; break; } }
        const slot = Math.floor(Math.random() * CONTAINER_SIZE);
        if (items[slot].type === 0) {
            items[slot].type = picked.type;
            items[slot].count = picked.count[0] + Math.floor(Math.random() * (picked.count[1] - picked.count[0] + 1));
        }
    }
    return items;
}

function generateBuriedTreasureLoot() {
    const items = Array(CONTAINER_SIZE).fill().map(() => ({ type: 0, count: 0 }));
    const loot = [
        { type: BLOCKS.DIAMOND.id, weight: 5, count: [2, 5] },
        { type: BLOCKS.GOLD_INGOT.id, weight: 8, count: [3, 8] },
        { type: BLOCKS.IRON_INGOT.id, weight: 6, count: [4, 10] },
        { type: BLOCKS.DIAMOND_SWORD.id, weight: 2, count: [1, 1] },
        { type: BLOCKS.GOLD_SWORD.id, weight: 4, count: [1, 1] },
        { type: BLOCKS.GOLEM_EYE.id, weight: 5, count: [1, 3] },
        { type: BLOCKS.DIAMOND_ORE.id, weight: 3, count: [1, 3] },
    ];
    for (let i = 0; i < 7 + Math.floor(Math.random() * 5); i++) {
        const totalW = loot.reduce((s, l) => s + l.weight, 0);
        let r = Math.random() * totalW, picked = loot[0];
        for (const l of loot) { r -= l.weight; if (r <= 0) { picked = l; break; } }
        const slot = Math.floor(Math.random() * CONTAINER_SIZE);
        if (items[slot].type === 0) {
            items[slot].type = picked.type;
            items[slot].count = picked.count[0] + Math.floor(Math.random() * (picked.count[1] - picked.count[0] + 1));
        }
    }
    return items;
}

function generateNullRuinsLoot() {
    const items = Array(CONTAINER_SIZE).fill().map(() => ({ type: 0, count: 0 }));
    const loot = [
        { type: BLOCKS.VOID_SHARD.id, weight: 10, count: [3, 8] },
        { type: BLOCKS.NULL_INGOT.id, weight: 6, count: [1, 4] },
        { type: BLOCKS.NULL_ORE.id, weight: 8, count: [2, 6] },
        { type: BLOCKS.DIAMOND.id, weight: 3, count: [1, 3] },
        { type: BLOCKS.DIAMOND_SWORD.id, weight: 2, count: [1, 1] },
        { type: BLOCKS.GOLEM_EYE.id, weight: 4, count: [1, 2] },
        { type: BLOCKS.REVENANT_SHARD.id, weight: 3, count: [1, 2] },
        { type: BLOCKS.NULL_CRYSTAL.id, weight: 5, count: [2, 6] },
    ];
    for (let i = 0; i < 5 + Math.floor(Math.random() * 7); i++) {
        const totalW = loot.reduce((s, l) => s + l.weight, 0);
        let r2 = Math.random() * totalW, picked = loot[0];
        for (const l of loot) { r2 -= l.weight; if (r2 <= 0) { picked = l; break; } }
        const slot = Math.floor(Math.random() * CONTAINER_SIZE);
        if (items[slot].type === 0) {
            items[slot].type = picked.type;
            items[slot].count = picked.count[0] + Math.floor(Math.random() * (picked.count[1] - picked.count[0] + 1));
        }
    }
    return items;
}

class VoxelWorld {
    constructor(scene) {
        this.chunks = new Map();
        this.chunkData = new Map();
        this.chestData = new Map();
        this.dirtyChunks = new Set();
        this.scene = scene;
        this.cellSize = CHUNK_SIZE;
    }

    async loadMetadata() {
        const savedChunks = await SaveManager.loadAllChunks();
        savedChunks.forEach((v, k) => { if (v) this.chunkData.set(k, v); });
        console.log(`Loaded ${savedChunks.size} chunks from save.`);
    }

    getBlock(x, y, z) {
        if (y < 0 || y >= CHUNK_HEIGHT) return 0;
        const cx = Math.floor(x / this.cellSize); const cz = Math.floor(z / this.cellSize);
        const key = `${cx},${cz}`;
        if (!this.chunkData.has(key)) return 0;
        const data = this.chunkData.get(key);
        const lx = ((x % this.cellSize) + this.cellSize) % this.cellSize;
        const lz = ((z % this.cellSize) + this.cellSize) % this.cellSize;
        return data[lx + this.cellSize * (y + CHUNK_HEIGHT * lz)];
    }

    setBlock(x, y, z, type) {
        if (y < 0 || y >= CHUNK_HEIGHT) return;
        const cx = Math.floor(x / this.cellSize); const cz = Math.floor(z / this.cellSize);
        const key = `${cx},${cz}`;
        if (!this.chunkData.has(key)) return;
        const data = this.chunkData.get(key);
        const lx = ((x % this.cellSize) + this.cellSize) % this.cellSize;
        const lz = ((z % this.cellSize) + this.cellSize) % this.cellSize;
        const index = lx + this.cellSize * (y + CHUNK_HEIGHT * lz);
        if (data[index] === BLOCKS.CHEST.id && type === 0) this.chestData.delete(`${x},${y},${z}`);
        if (type === BLOCKS.CHEST.id) this.chestData.set(`${x},${y},${z}`, Array(CONTAINER_SIZE).fill().map(() => ({ type: 0, count: 0 })));
        if (data[index] !== type) {
            data[index] = type;
            this.dirtyChunks.add(key);
            this.updateChunkMesh(cx, cz);
            if (lx === 0) this.updateChunkMesh(cx - 1, cz);
            if (lx === this.cellSize - 1) this.updateChunkMesh(cx + 1, cz);
            if (lz === 0) this.updateChunkMesh(cx, cz - 1);
            if (lz === this.cellSize - 1) this.updateChunkMesh(cx, cz + 1);
        }
    }

    explode(x, y, z, radius) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx*dx + dy*dy + dz*dz <= radius*radius) {
                        if (this.getBlock(x+dx, y+dy, z+dz) !== BLOCKS.BEDROCK.id) this.setBlock(x+dx, y+dy, z+dz, 0);
                    }
                }
            }
        }
        const dist = Math.sqrt((camera.position.x-x)**2 + (camera.position.y-y)**2 + (camera.position.z-z)**2);
        if (dist < radius + 2) {
            playerHealth -= 5; updateHealthUI(); showDamageOverlay();
            const dir = camera.position.clone().sub(new THREE.Vector3(x, y, z)).normalize();
            velocity.add(dir.multiplyScalar(20));
        }
    }

    generateStructure(data, cx, cz, biome) {
        const pseudoRandom = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233));
        if (pseudoRandom > 0.05 && pseudoRandom < 0.25 && biome === 'PLAINS') {
        } else if (pseudoRandom > 0.05) { return; }

        const centerX = 8; const centerZ = 8;
        let groundY = 0;
        for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
            if (data[centerX + this.cellSize * (y + CHUNK_HEIGHT * centerZ)] !== 0) { groundY = y; break; }
        }
        if (groundY < 5 || groundY > CHUNK_HEIGHT - 20) return;

        const place = (x, y, z, id) => {
            if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < CHUNK_HEIGHT)
                data[x + this.cellSize * (y + CHUNK_HEIGHT * z)] = id;
        };
        const placeChest = (x, y, z) => {
            place(x, y, z, BLOCKS.CHEST.id);
            const gx = cx * 16 + x; const gz = cz * 16 + z;
            this.chestData.set(`${gx},${y},${gz}`, generateLoot());
        };

        const baseY = groundY + 1;

        if (biome === 'DESERT') {
            const baseSize = 10;
            for (let dx = -baseSize; dx <= baseSize; dx++) {
                for (let dz = -baseSize; dz <= baseSize; dz++) {
                    place(centerX + dx, baseY, centerZ + dz, BLOCKS.SANDSTONE.id);
                    if ((Math.abs(dx) + Math.abs(dz)) % 4 === 0 && Math.abs(dx) < 6) place(centerX + dx, baseY, centerZ + dz, BLOCKS.TNT.id);
                }
            }
            for (let i = 1; i <= 8; i++) {
                const s = baseSize - i;
                for (let dx = -s; dx <= s; dx++) {
                    for (let dz = -s; dz <= s; dz++) {
                        if (Math.abs(dx) === s || Math.abs(dz) === s) place(centerX + dx, baseY + i, centerZ + dz, BLOCKS.SAND_BRICK.id);
                        else place(centerX + dx, baseY + i, centerZ + dz, 0);
                    }
                }
            }
            for (let y = 1; y < 4; y++) { place(centerX, baseY + y, centerZ - baseSize + 1, 0); place(centerX - 1, baseY + y, centerZ - baseSize + 1, 0); place(centerX + 1, baseY + y, centerZ - baseSize + 1, 0); }
            place(centerX - baseSize, baseY + 1, centerZ - baseSize, BLOCKS.GARGOYLE.id);
            place(centerX + baseSize, baseY + 1, centerZ - baseSize, BLOCKS.GARGOYLE.id);
            place(centerX - baseSize, baseY + 1, centerZ + baseSize, BLOCKS.GARGOYLE.id);
            place(centerX + baseSize, baseY + 1, centerZ + baseSize, BLOCKS.GARGOYLE.id);
            placeChest(centerX, baseY + 1, centerZ);
            placeChest(centerX + 3, baseY + 1, centerZ + 3);
            placeChest(centerX - 3, baseY + 1, centerZ + 3);
        } else if (biome === 'PLAINS') {
            const w = 3;
            for (let dx = -w; dx <= w; dx++) for (let dz = -w; dz <= w; dz++) place(centerX + dx, baseY, centerZ + dz, BLOCKS.COBBLESTONE.id);
            for (let y = 1; y <= 4; y++) {
                for (let dx = -w; dx <= w; dx++) for (let dz = -w; dz <= w; dz++) {
                    if (Math.abs(dx) === w || Math.abs(dz) === w) { if (Math.random() > 0.1) place(centerX + dx, baseY + y, centerZ + dz, BLOCKS.PLANKS.id); }
                }
            }
            for (let i = 0; i <= w; i++) {
                const ry = baseY + 5 + i; const rad = w - i;
                for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) { if (Math.random() > 0.05) place(centerX + dx, ry, centerZ + dz, BLOCKS.COBBLESTONE.id); }
            }
            place(centerX - w + 1, baseY + 1, centerZ - w + 1, BLOCKS.COBWEB.id);
            place(centerX + w - 1, baseY + 3, centerZ + w - 1, BLOCKS.COBWEB.id);
            placeChest(centerX, baseY + 1, centerZ - w + 1);
            place(centerX, baseY + 1, centerZ + w, 0); place(centerX, baseY + 2, centerZ + w, 0);
        } else if (biome === 'JUNGLE') {
            place(centerX-2,baseY,centerZ-2,BLOCKS.JUNGLE_LOG.id); place(centerX+2,baseY,centerZ-2,BLOCKS.JUNGLE_LOG.id);
            place(centerX-2,baseY,centerZ+2,BLOCKS.JUNGLE_LOG.id); place(centerX+2,baseY,centerZ+2,BLOCKS.JUNGLE_LOG.id);
            place(centerX-2,baseY+1,centerZ-2,BLOCKS.JUNGLE_LOG.id); place(centerX+2,baseY+1,centerZ-2,BLOCKS.JUNGLE_LOG.id);
            place(centerX-2,baseY+1,centerZ+2,BLOCKS.JUNGLE_LOG.id); place(centerX+2,baseY+1,centerZ+2,BLOCKS.JUNGLE_LOG.id);
            for (let dx=-3;dx<=3;dx++) for (let dz=-3;dz<=3;dz++) place(centerX+dx,baseY+2,centerZ+dz,BLOCKS.PLANKS.id);
            for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) {
                if (Math.abs(dx)===2||Math.abs(dz)===2) place(centerX+dx,baseY+3,centerZ+dz,BLOCKS.PLANKS.id);
                place(centerX+dx,baseY+5,centerZ+dz,BLOCKS.PLANKS.id);
            }
            placeChest(centerX, baseY+3, centerZ);
        } else if (biome === 'SNOW') {
            for (let y=0;y<3;y++) { for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) { if (Math.abs(dx)===2||Math.abs(dz)===2) place(centerX+dx,baseY+y,centerZ+dz,BLOCKS.SNOW.id); } }
            for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++) place(centerX+dx,baseY+3,centerZ+dz,BLOCKS.SNOW.id);
            placeChest(centerX, baseY+1, centerZ-1);
        }
    }

    generateChunkData(cx, cz) {
        const data = new Uint8Array(this.cellSize * this.cellSize * CHUNK_HEIGHT);
        let centerBiome = 'PLAINS';
        const biomeCheck = biomeNoise.noise2D(cx * 16 * 0.002, cz * 16 * 0.002);
        const humidCheck = biomeNoise.noise2D(cx * 16 * 0.002 + 100, cz * 16 * 0.002 + 100);
        if (biomeCheck > 0.5) centerBiome = 'DESERT';
        else if (biomeCheck < -0.5) centerBiome = 'SNOW';
        else if (humidCheck > 0.3 && biomeCheck > -0.2 && biomeCheck < 0.3) centerBiome = 'JUNGLE';

        // Precompute surface heights for cave/ravine clamping
        const surfaceHeight = new Int32Array(this.cellSize * this.cellSize);

        for (let x = 0; x < this.cellSize; x++) {
            for (let z = 0; z < this.cellSize; z++) {
                const gx = cx * this.cellSize + x; const gz = cz * this.cellSize + z;
                let bVal = biomeNoise.noise2D(gx * 0.002, gz * 0.002);
                let humid = biomeNoise.noise2D(gx * 0.002 + 100, gz * 0.002 + 100);
                const n = noise.noise2D(gx * 0.02, gz * 0.02);
                const m = noise.noise2D(gx * 0.1, gz * 0.1);
                const baseHeight = 65;
                const hPlains = (n * 8) + (m * 2) + baseHeight + 5;
                const hDesert = (n * 5) + (m * 2) + baseHeight;
                const hSnow = (n * 15) + (m * 5) + baseHeight + 10;
                const hJungle = (n * 20) + (m * 10) + baseHeight + 10;
                let wDesert = 0, wSnow = 0, wJungle = 0;
                if (bVal > 0.2) wDesert = Math.min(1, (bVal - 0.2) * 2.5);
                if (bVal < -0.2) wSnow = Math.min(1, (-bVal - 0.2) * 2.5);
                if (humid > 0.2 && Math.abs(bVal) < 0.4) wJungle = Math.min(1, (humid - 0.2) * 2.5);
                let totalSpecial = wDesert + wSnow + wJungle;
                if (totalSpecial > 1) { wDesert /= totalSpecial; wSnow /= totalSpecial; wJungle /= totalSpecial; totalSpecial = 1; }
                const wPlains = 1 - totalSpecial;
                const height = Math.floor((hDesert * wDesert) + (hSnow * wSnow) + (hJungle * wJungle) + (hPlains * wPlains));
                surfaceHeight[x + this.cellSize * z] = height;
                let surfaceBlock = BLOCKS.GRASS.id; let subSurface = BLOCKS.DIRT.id;
                if (wDesert > 0.5) { surfaceBlock = BLOCKS.SAND.id; subSurface = BLOCKS.SAND.id; }
                else if (wSnow > 0.5) { surfaceBlock = BLOCKS.SNOW.id; }

                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let type = 0;
                    if (y === 0) type = BLOCKS.BEDROCK.id;
                    else if (y < height - 3) {
                        type = BLOCKS.STONE.id;
                        const r = Math.random();
                        if (r < 0.05) {
                            if (y < 15 && r < 0.008) type = BLOCKS.DIAMOND_ORE.id;
                            else if (y < 30 && r < 0.015) type = BLOCKS.GOLD_ORE.id;
                            else if (y < 50 && r < 0.03) type = BLOCKS.IRON_ORE.id;
                            else type = BLOCKS.COAL_ORE.id;
                        }
                    }
                    else if (y < height) type = subSurface;
                    else if (y === height) type = surfaceBlock;
                    data[x + this.cellSize * (y + CHUNK_HEIGHT * z)] = type;
                }
            }
        }

        // === CAVE CARVING (3D Perlin worm caves) ===
        for (let x = 0; x < this.cellSize; x++) {
            for (let z = 0; z < this.cellSize; z++) {
                const surf = surfaceHeight[x + this.cellSize * z];
                for (let y = 2; y < surf - 4; y++) {
                    const gx = cx * this.cellSize + x;
                    const gz = cz * this.cellSize + z;
                    const cn1 = caveNoise.noise3D(gx * 0.04, y * 0.04, gz * 0.04);
                    const cn2 = caveNoise2.noise3D(gx * 0.04, y * 0.04, gz * 0.04);
                    // Wider threshold = bigger caves
                    const thresh = y < 20 ? 0.15 : 0.18;
                    if (Math.abs(cn1) < thresh && Math.abs(cn2) < thresh) {
                        const idx = x + this.cellSize * (y + CHUNK_HEIGHT * z);
                        if (data[idx] !== BLOCKS.BEDROCK.id) data[idx] = 0;
                        // Also carve one block above for taller tunnels
                        if (y + 1 < surf - 3) {
                            const idx2 = x + this.cellSize * ((y+1) + CHUNK_HEIGHT * z);
                            if (data[idx2] !== BLOCKS.BEDROCK.id) data[idx2] = 0;
                        }
                    }
                    // Large cave chambers: looser threshold at specific depths
                    if (y > 25 && y < 55) {
                        const cn3 = caveNoise.noise3D(gx * 0.015, y * 0.015, gz * 0.015);
                        if (Math.abs(cn3) < 0.10) {
                            for (let dy = -2; dy <= 2; dy++) {
                                const iy = y + dy;
                                if (iy > 2 && iy < surf - 4) {
                                    const idxC = x + this.cellSize * (iy + CHUNK_HEIGHT * z);
                                    if (data[idxC] !== BLOCKS.BEDROCK.id) data[idxC] = 0;
                                }
                            }
                        }
                    }
                }
            }
        }

        // === RAVINES ===
        const ravSeed = Math.abs(Math.sin(cx * 73.1 + cz * 127.9) * 9999) % 1;
        if (ravSeed < 0.15) {
            const ravX = 3 + Math.floor((Math.abs(Math.sin(cx * 31.4)) * 9999) % 9);
            const ravZ = 3 + Math.floor((Math.abs(Math.cos(cz * 17.2)) * 9999) % 9);
            const ravWidth = 4 + Math.floor(ravSeed * 40);  // 4–8 blocks wide
            const ravDepth = 40 + Math.floor(ravSeed * 50); // 40–90 blocks deep
            const ravAngle = ravSeed * Math.PI;
            const ravLen = 12 + Math.floor(ravSeed * 12);   // longer

            for (let step = 0; step < ravLen; step++) {
                const rx = Math.round(ravX + Math.cos(ravAngle) * step * 2);
                const rz = Math.round(ravZ + Math.sin(ravAngle) * step * 2);
                for (let dx = -ravWidth; dx <= ravWidth; dx++) {
                    for (let dz = -ravWidth; dz <= ravWidth; dz++) {
                        if (dx * dx + dz * dz > ravWidth * ravWidth) continue;
                        const bx = rx + dx; const bz = rz + dz;
                        if (bx < 0 || bx >= 16 || bz < 0 || bz >= 16) continue;
                        const surf = surfaceHeight[bx + this.cellSize * bz];
                        const floorY = Math.max(2, surf - ravDepth);
                        for (let y = floorY; y < surf - 1; y++) {
                            const widen = Math.cos(((y - floorY) / (surf - floorY - 1)) * Math.PI * 0.5);
                            if (dx * dx + dz * dz <= (ravWidth * widen) * (ravWidth * widen)) {
                                const idx = bx + this.cellSize * (y + CHUNK_HEIGHT * bz);
                                if (data[idx] !== BLOCKS.BEDROCK.id) data[idx] = 0;
                            }
                        }
                    }
                }
            }
        }

        // === MINESHAFTS (greatly expanded) ===
        const mineSeed = Math.abs(Math.sin(cx * 53.7 + cz * 91.3) * 9999) % 1;
        if (mineSeed < 0.20) {
            const mineY = 20 + Math.floor(mineSeed * 25);
            const startX = Math.floor(mineSeed * 6) + 2;
            const startZ = Math.floor(mineSeed * 6) + 2;
            const numCorridors = 3 + Math.floor(mineSeed * 3); // 3–5 corridors
            const corridorLen = 10 + Math.floor(mineSeed * 10); // 10–20 steps long

            const set = (lx, ly, lz, id) => {
                if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || ly < 2 || ly >= CHUNK_HEIGHT) return;
                data[lx + this.cellSize * (ly + CHUNK_HEIGHT * lz)] = id;
            };

            const carve = (lx, ly, lz, w, h) => {
                for (let dx = -w; dx <= w; dx++) for (let dy = 0; dy < h; dy++) for (let dz = -w; dz <= w; dz++) {
                    const bx = lx+dx, bz=lz+dz, by=ly+dy;
                    if (bx<0||bx>=16||bz<0||bz>=16||by<2||by>=CHUNK_HEIGHT) continue;
                    const idx = bx + this.cellSize * (by + CHUNK_HEIGHT * bz);
                    if (data[idx] !== BLOCKS.BEDROCK.id) data[idx] = 0;
                }
            };

            const placeSupport = (lx, ly, lz, wide) => {
                const hw = wide;
                for (let dy = 0; dy < 4; dy++) {
                    set(lx - hw, ly + dy, lz, BLOCKS.LOG.id);
                    set(lx + hw, ly + dy, lz, BLOCKS.LOG.id);
                }
                for (let dx = -hw; dx <= hw; dx++) set(lx + dx, ly + 3, lz, BLOCKS.PLANKS.id);
            };

            const directions = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1]];
            const placeChest = (lx, ly, lz) => {
                if (lx<0||lx>=16||lz<0||lz>=16) return;
                set(lx, ly, lz, BLOCKS.CHEST.id);
                this.chestData.set(`${cx*16+lx},${ly},${cz*16+lz}`, generateMineshaftLoot());
            };

            for (let c = 0; c < numCorridors; c++) {
                const [dirX, dirZ] = directions[c % directions.length];
                const cStartX = startX + (c % 3) * 3;
                const cStartZ = startZ + Math.floor(c / 3) * 3;
                const cY = mineY - c * 3; // stagger vertical levels

                for (let i = 0; i < corridorLen; i++) {
                    const lx = Math.min(15, Math.max(0, cStartX + dirX * i * 2));
                    const lz = Math.min(15, Math.max(0, cStartZ + dirZ * i * 2));
                    carve(lx, cY, lz, 1, 4); // wider+taller tunnels
                    if (i % 4 === 0) placeSupport(lx, cY, lz, 1);
                    if (i % 6 === 3 && lx>=0&&lx<16&&lz>=0&&lz<16) set(lx, cY-1, lz, BLOCKS.COBWEB.id);
                }

                // Cross branch per corridor
                const midX = Math.min(15, Math.max(0, cStartX + dirX * (corridorLen/2) * 2));
                const midZ = Math.min(15, Math.max(0, cStartZ + dirZ * (corridorLen/2) * 2));
                for (let i = -5; i <= 5; i++) {
                    const bx = Math.min(15,Math.max(0, midX + dirZ*i*2));
                    const bz = Math.min(15,Math.max(0, midZ + dirX*i*2));
                    carve(bx, cY, bz, 1, 4);
                }

                // Treasure chest at end
                const eX = Math.min(15,Math.max(0, cStartX + dirX*(corridorLen-1)*2));
                const eZ = Math.min(15,Math.max(0, cStartZ + dirZ*(corridorLen-1)*2));
                placeChest(eX, cY+1, eZ);
            }
        }

        // === UNDERGROUND DUNGEON (massive stone brick fortress) ===
        const dungSeed = Math.abs(Math.sin(cx * 113.0 + cz * 67.5) * 9999) % 1;
        if (dungSeed < 0.10) {
            const dungY = 12 + Math.floor(dungSeed * 20);
            const dungX = 7; // center of chunk
            const dungZ = 7;
            const outerR = 7; // outer wall radius (was 4 — nearly 2x bigger)
            const innerR = 5; // hollow inside radius

            const set = (lx, ly, lz, id) => {
                if (lx<0||lx>=16||lz<0||lz>=16||ly<1||ly>=CHUNK_HEIGHT) return;
                data[lx + this.cellSize * (ly + CHUNK_HEIGHT * lz)] = id;
            };

            // Multi-floor dungeon: 3 floors, each 4 blocks tall
            for (let floor = 0; floor < 3; floor++) {
                const baseY = dungY + floor * 4;
                for (let dx = -outerR; dx <= outerR; dx++) {
                    for (let dz = -outerR; dz <= outerR; dz++) {
                        for (let dy = 0; dy <= 4; dy++) {
                            const bx = dungX+dx, bz = dungZ+dz, by = baseY+dy;
                            if (bx<0||bx>=16||bz<0||bz>=16||by<1||by>=CHUNK_HEIGHT) continue;
                            const isOuterWall = (Math.abs(dx)===outerR || Math.abs(dz)===outerR);
                            const isCeiling = dy===4;
                            const isFloor = dy===0;
                            const isCorner = (Math.abs(dx)===outerR && Math.abs(dz)===outerR);
                            const insideHollow = (Math.abs(dx)<innerR && Math.abs(dz)<innerR);

                            if (isOuterWall || isCeiling || isFloor) {
                                const blockType = isCorner ? BLOCKS.COBBLESTONE.id : BLOCKS.BRICKS.id;
                                set(bx, by, bz, blockType);
                            } else {
                                set(bx, by, bz, 0); // hollow
                            }
                        }
                    }
                }

                // Torch pillars inside on each floor
                for (let px2 = -2; px2 <= 2; px2 += 4) {
                    for (let pz2 = -2; pz2 <= 2; pz2 += 4) {
                        set(dungX+px2, baseY+1, dungZ+pz2, BLOCKS.COBBLESTONE.id);
                        set(dungX+px2, baseY+2, dungZ+pz2, BLOCKS.COBBLESTONE.id);
                    }
                }

                // Doorways on each wall side (2w x 3h)
                const doorSides = [[0,-outerR,'z'],[0,outerR,'z'],[-outerR,0,'x'],[outerR,0,'x']];
                doorSides.forEach(([ddx, ddz]) => {
                    for (let dw = -1; dw <= 1; dw++) for (let dh = 1; dh <= 3; dh++) {
                        const bx2 = dungX + ddx + (ddz===0 ? 0 : dw);
                        const bz2 = dungZ + ddz + (ddx===0 ? 0 : dw);
                        if (bx2>=0&&bx2<16&&bz2>=0&&bz2<16) set(bx2, baseY+dh, bz2, 0);
                    }
                });

                // Staircase between floors (inner corner ramp)
                if (floor < 2) {
                    for (let step = 0; step < 4; step++) {
                        set(dungX+innerR-2, baseY+step+1, dungZ-innerR+2+step, BLOCKS.COBBLESTONE.id);
                    }
                }

                // Chests: 2 per floor
                set(dungX-3, baseY+1, dungZ-3, BLOCKS.CHEST.id);
                this.chestData.set(`${cx*16+dungX-3},${baseY+1},${cz*16+dungZ-3}`, generateDungeonLoot());
                set(dungX+3, baseY+1, dungZ+3, BLOCKS.CHEST.id);
                this.chestData.set(`${cx*16+dungX+3},${baseY+1},${cz*16+dungZ+3}`, generateDungeonLoot());
            }

            // Cobweb dressing throughout
            for (let i = 0; i < 10; i++) {
                const cwx = dungX + Math.floor(Math.random()*innerR*2)-innerR;
                const cwz = dungZ + Math.floor(Math.random()*innerR*2)-innerR;
                const cwy = dungY + Math.floor(Math.random() * 10) + 2;
                if (cwx>=0&&cwx<16&&cwz>=0&&cwz<16&&cwy<CHUNK_HEIGHT) {
                    const idx = cwx+this.cellSize*(cwy+CHUNK_HEIGHT*cwz);
                    if (data[idx]===0) data[idx]=BLOCKS.COBWEB.id;
                }
            }

            // TNT traps on ground floor
            set(dungX+2, dungY+1, dungZ-2, BLOCKS.TNT.id);
            set(dungX-2, dungY+1, dungZ+2, BLOCKS.TNT.id);
        }

        // === BURIED TREASURE ===
        const treasSeed = Math.abs(Math.sin(cx * 41.3 + cz * 159.7) * 9999) % 1;
        if (treasSeed < 0.08) {
            const tx = 5 + Math.floor(treasSeed * 6);
            const tz = 5 + Math.floor(treasSeed * 6);
            const surf = surfaceHeight[tx + this.cellSize * tz];
            const ty = surf - 3 - Math.floor(treasSeed * 4);
            if (ty > 2 && ty < surf && tx >= 0 && tx < 16 && tz >= 0 && tz < 16) {
                // Buried chest room (3x3 sandstone box)
                for (let dx2=-1;dx2<=1;dx2++) for (let dz2=-1;dz2<=1;dz2++) for (let dy2=-1;dy2<=1;dy2++) {
                    const bx2=tx+dx2, bz2=tz+dz2, by2=ty+dy2;
                    if (bx2<0||bx2>=16||bz2<0||bz2>=16||by2<1||by2>=CHUNK_HEIGHT) continue;
                    const isWall=(Math.abs(dx2)===1||Math.abs(dz2)===1||Math.abs(dy2)===1);
                    data[bx2+this.cellSize*(by2+CHUNK_HEIGHT*bz2)] = isWall ? BLOCKS.SANDSTONE.id : 0;
                }
                data[tx + this.cellSize * (ty + CHUNK_HEIGHT * tz)] = BLOCKS.CHEST.id;
                this.chestData.set(`${cx*16+tx},${ty},${cz*16+tz}`, generateBuriedTreasureLoot());
                // Sandstone marker 1 block above surface
                const markerY = surf + 1;
                if (markerY < CHUNK_HEIGHT) data[tx+this.cellSize*(markerY+CHUNK_HEIGHT*tz)] = BLOCKS.SANDSTONE.id;
            }
        }

        this.generateStructure(data, cx, cz, centerBiome);

        for (let x = 0; x < this.cellSize; x++) {
            for (let z = 0; z < this.cellSize; z++) {
                let height = 0;
                for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                    const bid = data[x + this.cellSize * (y + CHUNK_HEIGHT * z)];
                    if (bid !== 0) { height = y; break; }
                }
                const groundBlock = data[x + this.cellSize * (height + CHUNK_HEIGHT * z)];
                if (groundBlock === BLOCKS.PLANKS.id || groundBlock === BLOCKS.COBBLESTONE.id || groundBlock === BLOCKS.SANDSTONE.id || groundBlock === BLOCKS.SAND_BRICK.id) continue;
                const gx = cx * this.cellSize + x; const gz = cz * this.cellSize + z;
                let bVal = biomeNoise.noise2D(gx * 0.002, gz * 0.002);
                let humid = biomeNoise.noise2D(gx * 0.002 + 100, gz * 0.002 + 100);
                let biome = 'PLAINS';
                if (bVal > 0.5) biome = 'DESERT';
                else if (bVal < -0.5) biome = 'SNOW';
                else if (humid > 0.3 && bVal > -0.2 && bVal < 0.3) biome = 'JUNGLE';

                if (x > 2 && x < 13 && z > 2 && z < 13) {
                    if (biome === 'PLAINS' && Math.random() < 0.01) {
                        const h = height + 1;
                        for (let i = 0; i < 4; i++) if (h + i < CHUNK_HEIGHT) data[x + this.cellSize * ((h + i) + CHUNK_HEIGHT * z)] = BLOCKS.LOG.id;
                        for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++) for (let ly = 3; ly <= 4; ly++) {
                            if (lx === 0 && lz === 0 && ly === 3) continue;
                            const idx = (x + lx) + this.cellSize * ((h + ly) + CHUNK_HEIGHT * (z + lz));
                            if (h + ly < CHUNK_HEIGHT && data[idx] === 0) data[idx] = BLOCKS.LEAVES.id;
                        }
                        if (h + 5 < CHUNK_HEIGHT) data[x + this.cellSize * ((h + 5) + CHUNK_HEIGHT * z)] = BLOCKS.LEAVES.id;
                    } else if (biome === 'DESERT' && Math.random() < 0.005) {
                        const h = height + 1;
                        for (let i = 0; i < 3; i++) if (h + i < CHUNK_HEIGHT) data[x + this.cellSize * ((h + i) + CHUNK_HEIGHT * z)] = BLOCKS.CACTUS.id;
                    } else if (biome === 'JUNGLE') {
                        if (Math.random() < 0.02) {
                            const h = height + 1;
                            const treeH = 8 + Math.floor(Math.random() * 5);
                            for (let i = 0; i < treeH; i++) if (h + i < CHUNK_HEIGHT) data[x + this.cellSize * ((h + i) + CHUNK_HEIGHT * z)] = BLOCKS.JUNGLE_LOG.id;
                            for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) {
                                const idx = (x + lx) + this.cellSize * ((h + treeH - 1) + CHUNK_HEIGHT * (z + lz));
                                if (h + treeH - 1 < CHUNK_HEIGHT && data[idx] === 0) data[idx] = BLOCKS.JUNGLE_LEAVES.id;
                            }
                            const topIdx = x + this.cellSize * ((h + treeH) + CHUNK_HEIGHT * z);
                            if (h + treeH < CHUNK_HEIGHT) data[topIdx] = BLOCKS.JUNGLE_LEAVES.id;
                        } else if (Math.random() < 0.01) {
                            const h = height + 1;
                            if (h < CHUNK_HEIGHT) data[x + this.cellSize * (h + CHUNK_HEIGHT * z)] = BLOCKS.MELON.id;
                        }
                    }
                }
            }
        }
        return data;
    }

    updateChunkMesh(cx, cz) {
        const key = `${cx},${cz}`;
        if (!this.chunkData.has(key)) this.chunkData.set(key, this.generateChunkData(cx, cz));
        const data = this.chunkData.get(key);
        if (this.chunks.has(key)) {
            const grp = this.chunks.get(key);
            this.scene.remove(grp); grp.children.forEach(c => c.geometry.dispose()); this.chunks.delete(key);
        }
        const positions = []; const normals = []; const uvs = []; const indices = []; const colors = [];
        const startX = cx * this.cellSize; const startZ = cz * this.cellSize;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < this.cellSize; z++) {
                for (let x = 0; x < this.cellSize; x++) {
                    const index = x + this.cellSize * (y + CHUNK_HEIGHT * z);
                    const type = data[index];
                    if (type === 0) continue;
                    const gx = startX + x; const gy = y; const gz = startZ + z;
                    const getUv = (face) => getBlockUVs(type, face);
                    const check = (ox, oy, oz) => {
                        const nb = this.getBlock(gx + ox, gy + oy, gz + oz);
                        return nb === 0 || nb === BLOCKS.LEAVES.id || nb === BLOCKS.CACTUS.id || nb === BLOCKS.JUNGLE_LEAVES.id || nb === BLOCKS.SPIKE.id || nb === BLOCKS.COBWEB.id || nb === BLOCKS.NULL_WATER.id;
                    };
                    let r = 1, g = 1, b = 1;
                    const isFoliage = (type === 1 || type === 5 || type === 16);
                    if (isFoliage) { r = 0.5; g = 0.8; b = 0.4; }
                    // Null water: deep blue tint
                    if (type === BLOCKS.NULL_WATER.id) { r = 0.1; g = 0.3; b = 1.0; }
                    // Null crystal: emissive cyan tint
                    if (type === BLOCKS.NULL_CRYSTAL.id) { r = 0.3; g = 0.7; b = 1.0; }
                    // Null portal: bright blue-white glow
                    if (type === BLOCKS.NULL_PORTAL.id) { r = 0.6; g = 0.8; b = 1.0; }

                    if (check(1,0,0)) {
                        const ndx = positions.length/3;
                        positions.push(x+1,y,z+1,x+1,y,z,x+1,y+1,z,x+1,y+1,z+1);
                        normals.push(1,0,0,1,0,0,1,0,0,1,0,0);
                        const uv=getUv('side'); uvs.push(...uv);
                        if (type===1) { for(let i=0;i<4;i++) colors.push(1,1,1); } else { for(let i=0;i<4;i++) colors.push(r,g,b); }
                        indices.push(ndx,ndx+1,ndx+2,ndx,ndx+2,ndx+3);
                    }
                    if (check(-1,0,0)) {
                        const ndx = positions.length/3;
                        positions.push(x,y,z,x,y,z+1,x,y+1,z+1,x,y+1,z);
                        normals.push(-1,0,0,-1,0,0,-1,0,0,-1,0,0);
                        const uv=getUv('side'); uvs.push(...uv);
                        if (type===1) { for(let i=0;i<4;i++) colors.push(1,1,1); } else { for(let i=0;i<4;i++) colors.push(r,g,b); }
                        indices.push(ndx,ndx+1,ndx+2,ndx,ndx+2,ndx+3);
                    }
                    if (check(0,1,0)) {
                        const ndx = positions.length/3;
                        positions.push(x,y+1,z+1,x+1,y+1,z+1,x+1,y+1,z,x,y+1,z);
                        normals.push(0,1,0,0,1,0,0,1,0,0,1,0);
                        const uv=getUv('top'); uvs.push(...uv);
                        for(let i=0;i<4;i++) colors.push(r,g,b);
                        indices.push(ndx,ndx+1,ndx+2,ndx,ndx+2,ndx+3);
                    }
                    if (check(0,-1,0)) {
                        const ndx = positions.length/3;
                        positions.push(x,y,z,x+1,y,z,x+1,y,z+1,x,y,z+1);
                        normals.push(0,-1,0,0,-1,0,0,-1,0,0,-1,0);
                        const uv=getUv('bottom'); uvs.push(...uv);
                        for(let i=0;i<4;i++) colors.push(1,1,1);
                        indices.push(ndx,ndx+1,ndx+2,ndx,ndx+2,ndx+3);
                    }
                    if (check(0,0,1)) {
                        const ndx = positions.length/3;
                        positions.push(x,y,z+1,x+1,y,z+1,x+1,y+1,z+1,x,y+1,z+1);
                        normals.push(0,0,1,0,0,1,0,0,1,0,0,1);
                        const uv=getUv('side'); uvs.push(...uv);
                        if (type===1) { for(let i=0;i<4;i++) colors.push(1,1,1); } else { for(let i=0;i<4;i++) colors.push(r,g,b); }
                        indices.push(ndx,ndx+1,ndx+2,ndx,ndx+2,ndx+3);
                    }
                    if (check(0,0,-1)) {
                        const ndx = positions.length/3;
                        positions.push(x+1,y,z,x,y,z,x,y+1,z,x+1,y+1,z);
                        normals.push(0,0,-1,0,0,-1,0,0,-1,0,0,-1);
                        const uv=getUv('side'); uvs.push(...uv);
                        if (type===1) { for(let i=0;i<4;i++) colors.push(1,1,1); } else { for(let i=0;i<4;i++) colors.push(r,g,b); }
                        indices.push(ndx,ndx+1,ndx+2,ndx,ndx+2,ndx+3);
                    }
                }
            }
        }

        const group = new THREE.Group();
        group.position.set(startX, 0, startZ);
        if (positions.length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geo.setIndex(indices);
            const mesh = new THREE.Mesh(geo, material);
            group.add(mesh);
        }
        this.scene.add(group);
        this.chunks.set(key, group);
    }

    update(playerPos) {
        const pcx = Math.floor(playerPos.x / this.cellSize);
        const pcz = Math.floor(playerPos.z / this.cellSize);
        const bVal = biomeNoise.noise2D(playerPos.x * 0.002, playerPos.z * 0.002);
        let biomeName = 'PLAINS';
        const humid = biomeNoise.noise2D(playerPos.x * 0.002 + 100, playerPos.z * 0.002 + 100);
        if (bVal > 0.5) biomeName = 'DESERT';
        else if (bVal < -0.5) biomeName = 'SNOW';
        else if (humid > 0.3 && bVal > -0.2 && bVal < 0.3) biomeName = 'JUNGLE';
        document.getElementById('debug').innerText = `Chunks: ${this.chunks.size} | Biome: ${biomeName} | Y: ${Math.floor(playerPos.y)}`;

        for (let x = -DRAW_DISTANCE; x <= DRAW_DISTANCE; x++) {
            for (let z = -DRAW_DISTANCE; z <= DRAW_DISTANCE; z++) {
                const key = `${pcx + x},${pcz + z}`;
                if (!this.chunks.has(key) && !this.chunkData.has(key)) {
                    this.chunkData.set(key, this.generateChunkData(pcx + x, pcz + z));
                    this.updateChunkMesh(pcx + x, pcz + z);
                } else if (!this.chunks.has(key) && this.chunkData.has(key)) {
                    this.updateChunkMesh(pcx + x, pcz + z);
                }
            }
        }
        for (const [key, grp] of this.chunks) {
            const [cx, cz] = key.split(',').map(Number);
            const dist = Math.sqrt((cx - pcx) ** 2 + (cz - pcz) ** 2);
            if (dist > DRAW_DISTANCE + 2) {
                this.scene.remove(grp); grp.children.forEach(c => c.geometry.dispose()); this.chunks.delete(key);
            }
        }
    }
}

// --- SMELTING SYSTEM ---
const SMELTING_RECIPES = [
    { input: BLOCKS.IRON_ORE.id, output: BLOCKS.IRON_INGOT.id },
    { input: BLOCKS.GOLD_ORE.id, output: BLOCKS.GOLD_INGOT.id },
    { input: BLOCKS.SAND.id, output: BLOCKS.SANDSTONE.id },
    { input: BLOCKS.COBBLESTONE.id, output: BLOCKS.STONE.id },
    { input: BLOCKS.LOG.id, output: BLOCKS.COAL_ORE.id },
    { input: BLOCKS.CACTUS.id, output: BLOCKS.GRASS.id },
    { input: BLOCKS.VOID_SHARD.id, output: BLOCKS.NULL_INGOT.id },  // smelt void shard → null ingot
    { input: BLOCKS.NULL_ORE.id, output: BLOCKS.NULL_INGOT.id },     // or smelt null ore directly
];

let furnaceState = { active: false, input: null, fuel: null, output: null, progress: 0, maxProgress: 100, burnTime: 0, maxBurnTime: 0 };

function openFurnace() {
    document.getElementById('furnace-screen').style.display = 'flex';
    document.exitPointerLock(); isInventoryOpen = true;
    updateFurnaceUI(); renderInventory('furnace-player-grid');
}

function closeFurnace() {
    document.getElementById('furnace-screen').style.display = 'none';
    document.body.requestPointerLock(); isInventoryOpen = false;
}

function updateFurnaceUI() {
    const slots = ['input', 'fuel', 'output'];
    slots.forEach(type => {
        const slotEl = document.getElementById(`furnace-${type}`);
        slotEl.innerHTML = '';
        const item = furnaceState[type];
        if (item && item.type !== 0) {
            const icon = document.createElement('div');
            icon.style.width = '32px'; icon.style.height = '32px';
            icon.style.backgroundImage = `url(${atlasCanvas.toDataURL()})`;
            icon.style.imageRendering = 'pixelated';
            const pos = getBlockIconPos(item.type);
            icon.style.backgroundPosition = `-${pos[0] * 32}px -${pos[1] * 32}px`;
            slotEl.appendChild(icon);
            if (item.count > 1) { const count = document.createElement('div'); count.className = 'count'; count.innerText = item.count; slotEl.appendChild(count); }
        }
        slotEl.onclick = (e) => handleFurnaceSlotClick(type, e);
    });
    const progressEl = document.getElementById('furnace-progress');
    if (furnaceState.burnTime > 0) progressEl.classList.add('active');
    else progressEl.classList.remove('active');
}

function handleFurnaceSlotClick(type, e) {
    if (furnaceState[type]) {
        addToInventory(furnaceState[type].type, furnaceState[type].count);
        furnaceState[type] = null;
        updateFurnaceUI(); renderInventory('furnace-player-grid'); updateUI();
    }
}

function handleFurnaceInvClick(index) {
    const item = inventory[index];
    if (!item || item.type === 0) return;
    const isFuel = item.type === BLOCKS.COAL_ORE.id || item.type === BLOCKS.LOG.id || item.type === BLOCKS.PLANKS.id || item.type === BLOCKS.STICK.id;
    if (isFuel && !furnaceState.fuel) { furnaceState.fuel = { ...item }; inventory[index] = { type: 0, count: 0 }; }
    else if (!furnaceState.input) { furnaceState.input = { ...item }; inventory[index] = { type: 0, count: 0 }; }
    else return;
    updateFurnaceUI(); renderInventory('furnace-player-grid'); updateUI();
}

function updateFurnace(delta) {
    if (furnaceState.burnTime > 0) { furnaceState.burnTime -= delta * 10; if (furnaceState.burnTime <= 0) furnaceState.burnTime = 0; }
    if (furnaceState.input && furnaceState.input.type !== 0) {
        const recipe = SMELTING_RECIPES.find(r => r.input === furnaceState.input.type);
        if (recipe) {
            if (furnaceState.burnTime <= 0 && furnaceState.fuel && furnaceState.fuel.type !== 0) {
                furnaceState.fuel.count--;
                if (furnaceState.fuel.count <= 0) furnaceState.fuel = null;
                furnaceState.maxBurnTime = 100; furnaceState.burnTime = 100;
                updateFurnaceUI();
            }
            if (furnaceState.burnTime > 0) {
                furnaceState.progress += delta * 20;
                if (furnaceState.progress >= furnaceState.maxProgress) {
                    furnaceState.input.count--;
                    if (furnaceState.input.count <= 0) furnaceState.input = null;
                    if (!furnaceState.output) furnaceState.output = { type: recipe.output, count: 0 };
                    else if (furnaceState.output.type === recipe.output) furnaceState.output.count++;
                    furnaceState.progress = 0; updateFurnaceUI();
                }
            } else { furnaceState.progress = 0; }
        }
    }
}

function renderInventory(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'slot'; el.id = `${gridId}-${i}`;
        const item = inventory[i];
        if (item.type !== 0) {
            const icon = document.createElement('div');
            icon.style.width = '32px'; icon.style.height = '32px';
            icon.style.backgroundImage = `url(${atlasCanvas.toDataURL()})`;
            icon.style.imageRendering = 'pixelated';
            const pos = getBlockIconPos(item.type);
            icon.style.backgroundPosition = `-${pos[0] * 32}px -${pos[1] * 32}px`;
            el.appendChild(icon);
            if (item.count > 1) { const count = document.createElement('div'); count.className = 'count'; count.innerText = item.count; el.appendChild(count); }
        }
        if (gridId === 'furnace-player-grid') el.onclick = () => handleFurnaceInvClick(i);
        else if (gridId === 'container-player-grid') el.onclick = () => handleContainerClick(i, 'player');
        grid.appendChild(el);
    }
}

// --- INIT ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 20, (DRAW_DISTANCE * CHUNK_SIZE) - 10);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

const world = new VoxelWorld(scene);
const controls = new PointerLockControls(camera, document.body);
const mobManager = new MobManager(scene, world);

// ═══════════════════════════════════════════════════════════════════
//  NULL DIMENSION
// ═══════════════════════════════════════════════════════════════════
let currentDimension = 'overworld'; // 'overworld' | 'null'
let returnPos = null; // where player was when they entered null dimension
let nullWorld = null; // VoxelWorld instance for null dim (lazy created)
let nullScene = null;

// Create null dimension scene
function createNullScene() {
    const ns = new THREE.Scene();
    ns.background = new THREE.Color(0x000308);
    ns.fog = new THREE.Fog(0x00040a, 15, 80);
    const al = new THREE.AmbientLight(0x1a2a6a, 0.8);
    ns.add(al);
    const dl = new THREE.DirectionalLight(0x2244ff, 0.4);
    dl.position.set(0, 100, 0);
    ns.add(dl);
    // Faint blue point lights scattered for atmosphere
    for (let i = 0; i < 3; i++) {
        const pl = new THREE.PointLight(0x2255ff, 1.5, 25);
        pl.position.set(Math.random()*40-20, 5, Math.random()*40-20);
        ns.add(pl);
    }
    return ns;
}

// Generate a chunk of null dimension terrain
function generateNullChunkData(cx, cz) {
    const ns2 = new SimpleNoise(); ns2.seed = 99999;
    const ns3 = new SimpleNoise(); ns3.seed = 12345;
    const caveN = new SimpleNoise(); caveN.seed = 77777;
    const data = new Uint8Array(16 * CHUNK_HEIGHT * 16);
    const set = (x, y, z, id) => {
        if (x<0||x>=16||z<0||z>=16||y<0||y>=CHUNK_HEIGHT) return;
        data[x + 16*(y + CHUNK_HEIGHT*z)] = id;
    };

    for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
            const gx = cx*16+x, gz = cz*16+z;
            const h1 = ns2.noise2D(gx*0.025, gz*0.025);
            const h2 = ns3.noise2D(gx*0.06, gz*0.06);
            const surf = Math.floor(60 + h1*16 + h2*6);

            // Bedrock floor
            set(x, 0, z, BLOCKS.NULL_STONE.id);

            for (let y = 1; y < surf; y++) {
                set(x, y, z, BLOCKS.NULL_STONE.id);
            }

            // Null soil surface layer (2 deep)
            set(x, surf, z, BLOCKS.NULL_SOIL.id);
            set(x, surf-1, z, BLOCKS.NULL_SOIL.id);

            // Null ore veins deep underground
            for (let y = 5; y < surf-8; y++) {
                const on = ns2.noise2D(gx*0.1+y*0.07, gz*0.1+y*0.07);
                if (on > 0.72) set(x, y, z, BLOCKS.NULL_ORE.id);
            }

            // 3D void caves (more dramatic than overworld)
            for (let y = 3; y < surf-2; y++) {
                const cn1 = caveN.noise2D(gx*0.05+y*0.04, gz*0.05);
                const cn2 = caveN.noise2D(gx*0.05, gz*0.05+y*0.04+50);
                if (Math.abs(cn1) < 0.12 && Math.abs(cn2) < 0.12) set(x, y, z, 0);
            }

            // Null water lakes in depressions
            const waterLevel = 48;
            for (let y = 1; y <= waterLevel; y++) {
                if (data[x + 16*(y + CHUNK_HEIGHT*z)] === 0) {
                    set(x, y, z, BLOCKS.NULL_WATER.id);
                }
            }

            // Crystal formations on surface (5% chance)
            const crystalSeed = Math.abs(Math.sin(gx*17.3+gz*31.7)*9999) % 1;
            if (crystalSeed < 0.05) {
                const crystalH = 2 + Math.floor(crystalSeed * 40);
                for (let cy = surf+1; cy <= surf+crystalH; cy++) {
                    set(x, cy, z, BLOCKS.NULL_CRYSTAL.id);
                }
            }
        }
    }

    // Null ruins — stone brick structures
    const ruinSeed = Math.abs(Math.sin(cx*113+cz*67)*9999) % 1;
    if (ruinSeed < 0.12) {
        const rx = 4 + Math.floor(ruinSeed*6), rz = 4 + Math.floor(ruinSeed*6);
        // Find surface at ruin center
        const gx2 = cx*16+rx, gz2 = cz*16+rz;
        const h1 = ns2.noise2D(gx2*0.025, gz2*0.025);
        const h2 = ns3.noise2D(gx2*0.06, gz2*0.06);
        const rSurf = Math.floor(60 + h1*16 + h2*6);
        const ruinR = 4 + Math.floor(ruinSeed*4);
        for (let dx=-ruinR;dx<=ruinR;dx++) for (let dz=-ruinR;dz<=ruinR;dz++) for (let dy=0;dy<=3;dy++) {
            const isWall = Math.abs(dx)===ruinR||Math.abs(dz)===ruinR;
            if (isWall) set(rx+dx, rSurf+1+dy, rz+dz, BLOCKS.NULL_BRICK.id);
        }
        // Ruined opening
        for (let dy=1;dy<=2;dy++) set(rx, rSurf+1+dy, rz-ruinR, 0);
        // Chest with null loot
        set(rx, rSurf+1, rz, BLOCKS.CHEST.id);
        // We'll register this chest in nullWorld.chestData when the world exists
        const chestKey = `${cx*16+rx},${rSurf+1},${cz*16+rz}`;
        if (nullWorld && nullWorld.chestData) {
            nullWorld.chestData.set(chestKey, generateNullRuinsLoot());
        }
    }

    return data;
}

// Lazy-init null world on first use
function getNullWorld() {
    if (!nullWorld) {
        if (!nullScene) nullScene = createNullScene();
        nullWorld = new VoxelWorld(nullScene);
        // Override generateChunkData to use null generator
        nullWorld.generateChunkData = generateNullChunkData;
    }
    return nullWorld;
}

// Enter the Null Dimension
function enterNullDimension(portalX, portalY, portalZ) {
    currentDimension = 'null';
    returnPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    // Swap scene
    renderer.render(scene, camera); // flush
    const nw = getNullWorld();

    // Teleport player to matching coordinates in null dim
    camera.position.set(portalX, 100, portalZ);
    velocity.set(0, 0, 0);

    // Update environment
    renderer._scene = nullScene;
    scene.fog = nullScene.fog; // temporarily override fog for the update loop hack
    scene.background = nullScene.background;
    ambientLight.color.setHex(0x1a2a6a);
    ambientLight.intensity = 0.8;
    dirLight.color.setHex(0x2244ff);
    scene.fog.near = 15; scene.fog.far = 80;
    scene.fog.color.setHex(0x00040a);

    // Copy null world chunks into main scene for rendering
    nw.update(camera.position);
    nw.chunks.forEach((grp, key) => {
        if (!scene.children.includes(grp)) scene.add(grp);
    });

    // Remove overworld chunks from scene
    world.chunks.forEach(grp => { if (scene.children.includes(grp)) scene.remove(grp); });

    showDimensionMessage('⬛ You have entered the NULL DIMENSION', '#3355ff');
}

// Exit back to overworld
function exitNullDimension() {
    currentDimension = 'overworld';

    // Remove null chunks from scene
    if (nullWorld) {
        nullWorld.chunks.forEach(grp => { if (scene.children.includes(grp)) scene.remove(grp); });
    }

    // Restore overworld chunks
    world.chunks.forEach(grp => { if (!scene.children.includes(grp)) scene.add(grp); });

    // Restore overworld environment
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog.near = 20; scene.fog.far = (DRAW_DISTANCE * 16) - 10;
    scene.fog.color.setHex(0x87CEEB);
    ambientLight.color.setHex(0xffffff);
    ambientLight.intensity = 0.7;
    dirLight.color.setHex(0xffffff);

    // Return player to overworld position
    if (returnPos) {
        camera.position.set(returnPos.x, returnPos.y + 2, returnPos.z);
        velocity.set(0, 0, 0);
    }

    showDimensionMessage('☀️ You have returned to the Overworld', '#88aaff');
}

function showDimensionMessage(msg, color) {
    const el = document.getElementById('cmd-feedback') || document.createElement('div');
    el.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        color:${color};font-size:28px;font-weight:bold;text-shadow:0 0 20px ${color};
        z-index:99;pointer-events:none;background:rgba(0,0,0,0.7);padding:20px 40px;border-radius:12px;
        border:2px solid ${color};`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
}

// ═══ PORTAL CREATION ═══
// Check if a chest on top of a wood block contains the offering
function checkPortalOffering(chestX, chestY, chestZ) {
    // Block below chest must be a wood log
    const below = world.getBlock(chestX, chestY - 1, chestZ);
    if (below !== BLOCKS.LOG.id && below !== BLOCKS.JUNGLE_LOG.id) return false;

    const chestKey = `${chestX},${chestY},${chestZ}`;
    const chestItems = world.chestData.get(chestKey);
    if (!chestItems) return false;

    // Count: 2 diamonds, 1 dirt, 5 gold ingots — EXACTLY these items, nothing else
    let diamonds = 0, dirt = 0, gold = 0, other = 0;
    chestItems.forEach(slot => {
        if (!slot || slot.type === 0) return;
        if (slot.type === BLOCKS.DIAMOND.id) diamonds += slot.count;
        else if (slot.type === BLOCKS.DIRT.id) dirt += slot.count;
        else if (slot.type === BLOCKS.GOLD_INGOT.id) gold += slot.count;
        else other += slot.count;
    });

    return diamonds >= 2 && dirt >= 1 && gold >= 5 && other === 0;
}

function spawnNullPortal(cx, cy, cz) {
    // The portal is a 3-tall 1-wide obsidian-like frame of NULL_PORTAL blocks (unbreakable)
    // Shape: 5x4 frame, 3 blocks wide, 4 tall, hollow inside (2x3 portal interior)
    //   Frame = NULL_PORTAL (unbreakable bedrock-hardness)
    //   Interior = NULL_PORTAL with portal texture
    const B = BLOCKS.NULL_PORTAL.id;

    // Remove the offering chest and wood
    world.setBlock(cx, cy, cz, 0);        // chest
    world.setBlock(cx, cy-1, cz, 0);      // log below

    // Build portal frame (3 wide, 5 tall)
    for (let dy = 0; dy <= 4; dy++) {
        world.setBlock(cx-1, cy+dy, cz, B); // left column
        world.setBlock(cx+1, cy+dy, cz, B); // right column
    }
    // Top and bottom bars
    for (let dx = -1; dx <= 1; dx++) {
        world.setBlock(cx+dx, cy-1, cz, B);  // bottom bar
        world.setBlock(cx+dx, cy+4, cz, B);  // top bar
    }
    // Portal interior fill
    for (let dy = 0; dy <= 3; dy++) {
        world.setBlock(cx, cy+dy, cz, B);
    }

    showDimensionMessage('🌀 The NULL PORTAL has opened!', '#2255ff');
    return true;
}

// ─── helper: returns the world for the current dimension ───
function activeWorld() { return (currentDimension === 'null' && nullWorld) ? nullWorld : world; }

function tryActivatePortal(bx, by, bz) {
    if (activeWorld().getBlock(bx, by, bz) === BLOCKS.NULL_PORTAL.id) {
        if (currentDimension === 'overworld') {
            enterNullDimension(bx, by, bz);
        } else {
            exitNullDimension();
        }
        return true;
    }
    return false;
}

// Furnace recipes for null items
// null ore → null ingot (via furnace in overworld or null dim)

function updateHealthUI() {
    const hearts = document.querySelectorAll('.heart');
    hearts.forEach((h, i) => { if (i < playerHealth) h.classList.remove('dead'); else h.classList.add('dead'); });
    if (playerHealth <= 0) {
        camera.position.set(0, 100, 0); playerHealth = maxHealth; updateHealthUI(); velocity.set(0, 0, 0);
    }
}

function showDamageOverlay() {
    const ov = document.getElementById('damage-overlay');
    ov.style.opacity = 0.5;
    setTimeout(() => ov.style.opacity = 0, 200);
}

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, sprint = false;
let canJump = false;
let isMining = false;
let mineTimer = 0;
let targetBlock = null;

const blocker = document.getElementById('blocker');

blocker.addEventListener('click', () => { controls.lock(); });

controls.addEventListener('lock', () => {
    prevTime = performance.now();
    blocker.style.display = 'none'; // hide home/pause screen when game starts
    isInventoryOpen = false; isContainerOpen = false;
    document.getElementById('inventory-screen').style.display = 'none';
    document.getElementById('container-screen').style.display = 'none';
    isChatOpen = false;
    document.getElementById('chat-modal').style.display = 'none';
});

let suppressUnlockBlocker = false;
controls.addEventListener('unlock', () => {
    if (suppressUnlockBlocker) { suppressUnlockBlocker = false; return; }
    // Show the home/pause screen and update save status
    blocker.style.display = 'flex';
    saveGame(); // auto-save whenever the player pauses
    const resumeEl = document.getElementById('resume-status');
    if (resumeEl && camera) {
        resumeEl.innerText = `✅ Auto-saved — X:${camera.position.x.toFixed(0)} Z:${camera.position.z.toFixed(0)} | Click to Resume`;
    }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

document.addEventListener('mousedown', (e) => {
    if (isInventoryOpen || isChatOpen || isContainerOpen) return;
    if (!controls.isLocked) return;
    if (e.button === 0) {
        raycaster.setFromCamera(mouse, camera);
        const mobMeshes = [];
        mobManager.mobs.forEach(m => mobMeshes.push(m.mesh));
        const hits = raycaster.intersectObjects(mobMeshes, true);
        if (hits.length > 0 && hits[0].distance < 4) {
            const hitObj = hits[0].object;
            let targetMob = null; let curr = hitObj;
            while (curr) {
                const m = mobManager.mobs.find(mob => mob.mesh === curr);
                if (m) { targetMob = m; break; }
                curr = curr.parent;
            }
            if (targetMob) {
                const heldItem = inventory[selectedSlot];
                const toolInfo = getBlockProps(heldItem.type);
                let damage = 1;
                if (toolInfo.isItem && toolInfo.toolType === 'sword') damage = toolInfo.damage;
                targetMob.takeDamage(damage);
                const dir = targetMob.position.clone().sub(camera.position).normalize();
                targetMob.velocity.add(dir.multiplyScalar(10));
                targetMob.velocity.y += 5;
                return;
            }
        }
        isMining = true; mineTimer = 0;
    } else if (e.button === 2) {
        const hit = getTarget();
        raycaster.setFromCamera(mouse, camera);
        const mobMeshes = [];
        mobManager.mobs.forEach(m => mobMeshes.push(m.mesh));
        const mobHits = raycaster.intersectObjects(mobMeshes, true);
        if (mobHits.length > 0 && mobHits[0].distance < 4) {
            let hitObj = mobHits[0].object; let targetMob = null;
            while (hitObj) {
                const m = mobManager.mobs.find(mob => mob.mesh === hitObj);
                if (m) { targetMob = m; break; }
                hitObj = hitObj.parent;
            }
            if (targetMob && targetMob.type === 'human') {
                isChatOpen = true;
                document.getElementById('chat-modal').style.display = 'flex';
                controls.unlock(); return;
            }
        }
        if (hit) {
            const p = hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.1));
            const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
            const id = activeWorld().getBlock(bx, by, bz);
            if (tryActivatePortal(bx, by, bz)) return; // null portal activation
            if (id === BLOCKS.CRAFTING_TABLE.id) { toggleInventory(true, true); return; }
            if (id === BLOCKS.CHEST.id) { openContainer(`${bx},${by},${bz}`); return; }
            if (id === BLOCKS.FURNACE.id) { openFurnace(); return; }
        }
        placeBlock();
    }
});

document.addEventListener('mouseup', () => {
    isMining = false; mineTimer = 0;
    document.getElementById('mining-progress').style.width = '0px';
    targetBlock = null;
});

function getTarget() {
    raycaster.setFromCamera(mouse, camera);
    let objects = [];
    const aw = activeWorld();
    for (const grp of aw.chunks.values()) objects.push(...grp.children);
    const intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0 && intersects[0].distance < 6) return intersects[0];
    return null;
}

function placeBlock() {
    const hit = getTarget();
    if (!hit) return;
    const item = inventory[selectedSlot];
    if (item.type === 0 || item.count <= 0) return;
    if (BLOCKS[Object.keys(BLOCKS).find(k => BLOCKS[k].id === item.type)].isItem) return;
    const p = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.1));
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const px = Math.floor(camera.position.x), py = Math.floor(camera.position.y), pz = Math.floor(camera.position.z);
    if (!(bx === px && bz === pz && (by === py || by === py - 1))) {
        activeWorld().setBlock(bx, by, bz, item.type);
        item.count--; if (item.count === 0) item.type = 0;
        updateUI();
    }
}


initUI();
world.update(new THREE.Vector3(0, 0, 0));
// NOTE: camera position and loading screen are controlled by the SaveManager init block at the bottom

const velocity = new THREE.Vector3();
let prevTime = performance.now();
const playerWidth = 0.6, playerHeight = 1.8;
let spikeTimer = 0;

function checkCollision(x, y, z) {
    const minX = Math.floor(x - playerWidth / 2), maxX = Math.floor(x + playerWidth / 2);
    const minY = Math.floor(y - playerHeight + 0.5), maxY = Math.floor(y + 0.5);
    const minZ = Math.floor(z - playerWidth / 2), maxZ = Math.floor(z + playerWidth / 2);
    const aw = activeWorld();
    for (let ix = minX; ix <= maxX; ix++) {
        for (let iy = minY; iy <= maxY; iy++) {
            for (let iz = minZ; iz <= maxZ; iz++) {
                const b = aw.getBlock(ix, iy, iz);
                if (b === BLOCKS.TNT.id) { aw.explode(ix, iy, iz, 5); return false; }
                // NULL_WATER and NULL_PORTAL are not solid for movement
                if (b !== 0 && b !== BLOCKS.SPIKE.id && b !== BLOCKS.TNT.id && b !== BLOCKS.COBWEB.id
                    && b !== BLOCKS.NULL_WATER.id && b !== BLOCKS.NULL_PORTAL.id) return true;
            }
        }
    }
    return false;
}

const keyState = {};
let lastSpaceTime = 0;

document.addEventListener('keydown', (e) => {
    keyState[e.code] = true;

    // E = inventory / close any open screen
    if (e.code === 'KeyE') {
        if (isContainerOpen) {
            isContainerOpen = false;
            document.getElementById('container-screen').style.display = 'none';
            onContainerClose(); // check portal offering
            suppressUnlockBlocker = true;
            controls.lock();
            return;
        }
        const furnaceScreen = document.getElementById('furnace-screen');
        if (furnaceScreen && furnaceScreen.style.display !== 'none') {
            furnaceScreen.style.display = 'none';
            isInventoryOpen = false;
            suppressUnlockBlocker = true;
            controls.lock();
            return;
        }
        if (controls.isLocked || isInventoryOpen) toggleInventory(null, false);
        return;
    }

    // Escape = close open UI, or if nothing open → save + go to home/pause screen
    if (e.code === 'Escape') {
        if (isInventoryOpen) { toggleInventory(false); return; }
        if (isContainerOpen) {
            isContainerOpen = false;
            document.getElementById('container-screen').style.display = 'none';
            onContainerClose(); // check portal offering
            suppressUnlockBlocker = true;
            controls.lock(); return;
        }
        const furnaceScreen = document.getElementById('furnace-screen');
        if (furnaceScreen && furnaceScreen.style.display !== 'none') {
            furnaceScreen.style.display = 'none';
            isInventoryOpen = false;
            suppressUnlockBlocker = true;
            controls.lock(); return;
        }
        // Nothing open — save and go to home/pause screen
        if (controls.isLocked) {
            saveGame();
            suppressUnlockBlocker = false; // allow the unlock listener to show the blocker
            controls.unlock();
        }
        return;
    }

    // T = open command console
    if (e.code === 'KeyT' && controls.isLocked) {
        openCommandConsole();
        return;
    }

    // F3 = toggle creative mode
    if (e.code === 'F3') {
        e.preventDefault();
        toggleCreativeMode();
        return;
    }

    // Double-tap SPACE = toggle fly (creative only)
    if (e.code === 'Space' && isCreativeMode) {
        const now = performance.now();
        if (now - lastSpaceTime < 300) {
            isFlying = !isFlying;
            velocity.y = 0;
            showCommandFeedback(isFlying ? '✈ Flying ON' : '🚶 Flying OFF');
        }
        lastSpaceTime = now;
    }

    // Space = jump (survival) or fly up (creative flying)
    if (e.code === 'Space') {
        if (!isCreativeMode && canJump) { velocity.y = 12; canJump = false; keyState['Space'] = false; }
        if (isCreativeMode && isFlying) flyUpDown = true;
    }

    // Hotbar
    if (e.key >= '1' && e.key <= '9') { selectedSlot = parseInt(e.key) - 1; updateUI(); }
});

document.addEventListener('keyup', (e) => {
    keyState[e.code] = false;
    if (e.code === 'Space') flyUpDown = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') flyDownKey = false;
});

// Fly down with Shift in creative fly mode
document.addEventListener('keydown', (e) => {
    if (e.code === 'ShiftLeft' && isCreativeMode && isFlying) flyDownKey = true;
});

controls.addEventListener('lock', () => { prevTime = performance.now(); blocker.style.display = 'none'; });

function updateInputs() {
    moveForward = !!keyState['KeyW']; moveBackward = !!keyState['KeyS'];
    moveLeft = !!keyState['KeyA']; moveRight = !!keyState['KeyD'];
    sprint = !!keyState['ShiftLeft'];
    if (isCreativeMode && isFlying) {
        flyUpDown = !!keyState['Space'];
        flyDownKey = !!keyState['ShiftLeft'];
        sprint = !!keyState['ControlLeft']; // Ctrl = fast fly
    } else {
        flyUpDown = false; flyDownKey = false;
        if (keyState['Space']) { if (canJump) { velocity.y = 12; canJump = false; keyState['Space'] = false; } }
    }
}

const oldRender = renderer.render;
renderer.render = function (s, c) { updateInputs(); oldRender.apply(this, arguments); };

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);
    prevTime = time;

    dayTime += delta;
    if (dayTime > DAY_LENGTH) dayTime = 0;
    const timeProgress = dayTime / DAY_LENGTH;

    dirLight.position.set(Math.cos(timeProgress * Math.PI * 2) * 100, Math.sin(timeProgress * Math.PI * 2) * 100, 20);

    let skyColor = new THREE.Color(0x87CEEB);
    if (timeProgress < 0.1) { skyColor.setHSL(0.05, 1, 0.6); skyColor.lerp(new THREE.Color(0x87CEEB), timeProgress * 10); }
    else if (timeProgress > 0.4 && timeProgress < 0.5) { skyColor.setHSL(0.02, 1, 0.5); }
    else if (timeProgress >= 0.5) { skyColor.setHex(0x000000); skyColor.lerp(new THREE.Color(0x050510), 0.5); }

    scene.background = skyColor; scene.fog.color = skyColor;
    const sunIntensity = Math.max(0, Math.sin(timeProgress * Math.PI * 2));
    dirLight.intensity = sunIntensity * 0.8;
    ambientLight.intensity = 0.2 + (sunIntensity * 0.5);

    if (controls.isLocked) {
        camera.fov = sprint ? 85 : 75;
        camera.updateProjectionMatrix();

        const bx = Math.floor(camera.position.x);
        const by = Math.floor(camera.position.y);
        const bz = Math.floor(camera.position.z);
        const bBelow = activeWorld().getBlock(bx, by - 1, bz);
        const bIn = activeWorld().getBlock(bx, by, bz);

        if (!isCreativeMode && (bBelow === BLOCKS.SPIKE.id || bIn === BLOCKS.SPIKE.id)) {
            spikeTimer += delta;
            if (spikeTimer > 0.5) { playerHealth -= 1; updateHealthUI(); showDamageOverlay(); spikeTimer = 0; }
        } else { spikeTimer = 0; }

        let moveSpeedMultiplier = 1.0;
        if (bIn === BLOCKS.COBWEB.id) moveSpeedMultiplier = 0.3;

        if (isMining) {
            const hit = getTarget();
            if (hit) {
                const p = hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.1));
                const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
                const aw = activeWorld();
                const blockId = aw.getBlock(bx, by, bz);
                if (!targetBlock || targetBlock.x !== bx || targetBlock.y !== by || targetBlock.z !== bz) {
                    targetBlock = { x: bx, y: by, z: bz, id: blockId }; mineTimer = 0;
                }
                if (blockId === BLOCKS.TNT.id) { aw.explode(bx, by, bz, 5); isMining = false; mineTimer = 0; return; }
                if (blockId !== 0 && blockId !== BLOCKS.BEDROCK.id && blockId !== BLOCKS.NULL_PORTAL.id) {
                    const props = getBlockProps(blockId);
                    let speed = 1.0;
                    const heldItem = inventory[selectedSlot];
                    const toolInfo = getBlockProps(heldItem.type);
                    if (toolInfo.isItem && toolInfo.toolType === props.toolClass) speed = toolInfo.multiplier;
                    if (isCreativeMode) speed = 999; // Instant mine in creative
                    mineTimer += delta * speed;
                    const pct = Math.min(100, (mineTimer / props.hardness) * 100);
                    document.getElementById('mining-progress').style.width = pct + 'px';
                    if (mineTimer >= props.hardness) {
                        aw.setBlock(bx, by, bz, 0);
                        if (blockId === BLOCKS.SAND.id) alertDefenders(camera.position);
                        const drop = props.drop ? props.drop : blockId;
                        addToInventory(drop); mineTimer = 0;
                        document.getElementById('mining-progress').style.width = '0px';
                    }
                }
            } else { mineTimer = 0; document.getElementById('mining-progress').style.width = '0px'; }
        }

        if (isFlying && isCreativeMode) {
            // --- CREATIVE FLY PHYSICS ---
            const flyMoveSpeed = sprint ? flySpeed * 2.5 : flySpeed;
            velocity.x -= velocity.x * 15.0 * delta;
            velocity.z -= velocity.z * 15.0 * delta;
            velocity.y -= velocity.y * 15.0 * delta;

            const direction = new THREE.Vector3();
            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize();
            if (moveForward || moveBackward) velocity.z -= direction.z * (flyMoveSpeed * 10.0) * delta;
            if (moveLeft || moveRight) velocity.x -= direction.x * (flyMoveSpeed * 10.0) * delta;
            if (flyUpDown) velocity.y += flyMoveSpeed * 10.0 * delta;
            if (flyDownKey) velocity.y -= flyMoveSpeed * 10.0 * delta;

            controls.moveRight(-velocity.x * delta);
            controls.moveForward(-velocity.z * delta);
            camera.position.y += velocity.y * delta;
        } else {
            // --- SURVIVAL PHYSICS ---
            const baseSpeed = sprint ? 10.0 : 5.0;
            const speed = baseSpeed * moveSpeedMultiplier;
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;
            velocity.y -= 30.0 * delta;

            const direction = new THREE.Vector3();
            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize();

            if (moveForward || moveBackward) velocity.z -= direction.z * (speed * 10.0) * delta;
            if (moveLeft || moveRight) velocity.x -= direction.x * (speed * 10.0) * delta;

            controls.moveRight(-velocity.x * delta);
            if (checkCollision(camera.position.x, camera.position.y, camera.position.z)) { controls.moveRight(velocity.x * delta); velocity.x = 0; }
            controls.moveForward(-velocity.z * delta);
            if (checkCollision(camera.position.x, camera.position.y, camera.position.z)) { controls.moveForward(velocity.z * delta); velocity.z = 0; }
            camera.position.y += velocity.y * delta;
            if (checkCollision(camera.position.x, camera.position.y, camera.position.z)) {
                camera.position.y -= velocity.y * delta;
                if (velocity.y < 0) canJump = true;
                velocity.y = 0;
            }

            if (camera.position.y < -30) { playerHealth = 0; updateHealthUI(); }
        }

        mobManager.update(delta, camera.position);
        updateFurnace(delta);
    }

    world.update(camera.position);

    // Null dimension: update its world chunks and swap into scene
    if (currentDimension === 'null' && nullWorld) {
        nullWorld.update(camera.position);
        // Add any new null chunks to main scene, remove old overworld ones
        nullWorld.chunks.forEach((grp, key) => {
            if (!scene.children.includes(grp)) scene.add(grp);
        });
        world.chunks.forEach(grp => { if (scene.children.includes(grp)) scene.remove(grp); });
        // Subtle portal pulsing: animate null portal light
        const t2 = performance.now() * 0.001;
        scene.children.forEach(obj => {
            if (obj.isPointLight) obj.intensity = 1.2 + Math.sin(t2 * 2) * 0.5;
        });
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// CREATIVE MODE
// ============================================================

function toggleCreativeMode() {
    isCreativeMode = !isCreativeMode;
    if (!isCreativeMode) { isFlying = false; velocity.y = 0; }
    updateCreativeModeUI();
    showCommandFeedback(isCreativeMode ? '🎨 Creative Mode ON  (F3 to toggle)' : '⚔️ Survival Mode ON  (F3 to toggle)');
    // Show/hide creative hotbar extras
    const bar = document.getElementById('hotbar');
    bar.style.borderColor = isCreativeMode ? '#ffd700' : '#333';
}

// Called from the blocker menu buttons
function setGamemodeFromMenu(mode) {
    isCreativeMode = mode === 'creative';
    isFlying = false;
    velocity.y = 0;
    const btnS = document.getElementById('btn-survival');
    const btnC = document.getElementById('btn-creative');
    if (btnS && btnC) {
        btnS.style.background = isCreativeMode ? '#333' : '#4a90d9';
        btnS.style.color = isCreativeMode ? '#aaa' : 'white';
        btnS.style.borderColor = isCreativeMode ? '#555' : '#fff';
        btnC.style.background = isCreativeMode ? '#c8a000' : '#333';
        btnC.style.color = isCreativeMode ? '#000' : '#aaa';
        btnC.style.borderColor = isCreativeMode ? '#fff' : '#555';
    }
}

function updateCreativeModeUI() {
    let badge = document.getElementById('creative-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'creative-badge';
        badge.style.cssText = `position:fixed;top:10px;right:10px;background:rgba(255,215,0,0.85);
            color:#000;font-weight:bold;padding:6px 14px;border-radius:20px;font-size:14px;
            z-index:100;pointer-events:none;transition:opacity 0.3s;`;
        document.body.appendChild(badge);
    }
    if (isCreativeMode) {
        badge.innerHTML = '🎨 CREATIVE' + (isFlying ? ' ✈' : '');
        badge.style.opacity = '1';
    } else {
        badge.style.opacity = '0';
    }
}

function showCommandFeedback(msg, isError = false) {
    let fb = document.getElementById('cmd-feedback');
    if (!fb) {
        fb = document.createElement('div');
        fb.id = 'cmd-feedback';
        fb.style.cssText = `position:fixed;bottom:140px;left:50%;transform:translateX(-50%);
            background:rgba(0,0,0,0.8);color:white;padding:8px 18px;border-radius:6px;
            font-size:14px;z-index:200;pointer-events:none;transition:opacity 0.5s;border-left:4px solid #4caf50;`;
        document.body.appendChild(fb);
    }
    fb.innerText = msg;
    fb.style.borderLeftColor = isError ? '#f44336' : '#4caf50';
    fb.style.opacity = '1';
    clearTimeout(fb._t);
    fb._t = setTimeout(() => fb.style.opacity = '0', 3000);
}

// ============================================================
// COMMAND CONSOLE
// ============================================================

function openCommandConsole() {
    if (document.getElementById('cmd-console')) return;
    controls.unlock();

    const overlay = document.createElement('div');
    overlay.id = 'cmd-console';
    overlay.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        width:600px;z-index:300;display:flex;flex-direction:column;gap:0;`;

    const output = document.createElement('div');
    output.id = 'cmd-output';
    output.style.cssText = `background:rgba(0,0,0,0.85);color:#aef;font-family:monospace;
        font-size:13px;padding:8px 12px;max-height:160px;overflow-y:auto;
        border:1px solid #555;border-bottom:none;border-radius:6px 6px 0 0;`;
    output.innerHTML = '<div style="color:#ffd700">💬 Command Console — type /help for commands</div>';

    const row = document.createElement('div');
    row.style.cssText = `display:flex;`;

    const prefix = document.createElement('span');
    prefix.innerText = '/';
    prefix.style.cssText = `background:#222;color:#ffd700;padding:8px 6px 8px 12px;
        font-family:monospace;font-size:15px;border:1px solid #555;border-right:none;border-radius:0 0 0 6px;`;

    const input = document.createElement('input');
    input.id = 'cmd-input';
    input.placeholder = 'help';
    input.style.cssText = `flex:1;background:#111;color:#fff;border:1px solid #555;
        border-left:none;border-right:none;padding:8px;font-family:monospace;font-size:15px;outline:none;`;

    const btn = document.createElement('button');
    btn.innerText = 'Run';
    btn.style.cssText = `background:#2a6020;color:white;border:1px solid #555;
        padding:8px 16px;cursor:pointer;font-size:14px;border-radius:0 0 6px 0;`;

    row.appendChild(prefix); row.appendChild(input); row.appendChild(btn);
    overlay.appendChild(output); overlay.appendChild(row);
    document.body.appendChild(overlay);

    const close = () => {
        overlay.remove();
        controls.lock();
    };

    btn.onclick = () => runCommand(input.value.trim(), output, input);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { runCommand(input.value.trim(), output, input); }
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowUp') {
            commandHistoryIdx = Math.min(commandHistoryIdx + 1, commandHistory.length - 1);
            if (commandHistory[commandHistoryIdx]) input.value = commandHistory[commandHistoryIdx];
        }
        if (e.key === 'ArrowDown') {
            commandHistoryIdx = Math.max(commandHistoryIdx - 1, -1);
            input.value = commandHistoryIdx >= 0 ? commandHistory[commandHistoryIdx] : '';
        }
        e.stopPropagation();
    });

    setTimeout(() => input.focus(), 50);
}

function cmdLog(output, msg, color = '#aef') {
    const line = document.createElement('div');
    line.style.color = color;
    line.innerText = msg;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

function runCommand(raw, output, input) {
    if (!raw) return;
    commandHistory.unshift(raw);
    commandHistoryIdx = -1;
    const full = raw.startsWith('/') ? raw.slice(1) : raw;
    cmdLog(output, '> /' + full, '#ffd700');
    input.value = '';

    const parts = full.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
        case 'help':
            cmdLog(output, '── Commands ──────────────────────────────', '#888');
            cmdLog(output, '/creative          Toggle creative mode');
            cmdLog(output, '/fly               Toggle flying');
            cmdLog(output, '/give [id] [amt]   Give item (use block ID or name)');
            cmdLog(output, '/give all          Give all items');
            cmdLog(output, '/find [cave/dungeon/treasure]  Locate nearby underground feature');
            cmdLog(output, '/summon [mob name]  Supports multi-word: ghost, revenant, snow defender, etc');
            cmdLog(output, '/kill [mob/all]    Kill nearby mobs (or all)');
            cmdLog(output, '/place [id] [x y z] Place a block at coords');
            cmdLog(output, '/tp [x] [y] [z]   Teleport to coords');
            cmdLog(output, '/tpblock           Teleport to top of current column');
            cmdLog(output, '/time [day/night/0-1200]  Set time');
            cmdLog(output, '/heal              Restore full health');
            cmdLog(output, '/clear             Clear inventory');
            cmdLog(output, '/explode [r]       Explode at current position');
            cmdLog(output, '/fill [id] [r]     Fill a sphere with block');
            cmdLog(output, '/killme            Instant death');
            cmdLog(output, '/list              List all block IDs');
            cmdLog(output, '/pos               Show your current position');
            cmdLog(output, '/speed [n]         Set fly/move speed multiplier');
            cmdLog(output, '/weather [clear/storm]  Change fog/sky');
            break;

        case 'creative':
            toggleCreativeMode();
            cmdLog(output, isCreativeMode ? '✅ Creative mode ON' : '✅ Survival mode ON', '#4caf50');
            break;

        case 'fly':
            if (!isCreativeMode) { cmdLog(output, '❌ Enable creative mode first (/creative)', '#f44336'); break; }
            isFlying = !isFlying;
            velocity.y = 0;
            updateCreativeModeUI();
            cmdLog(output, isFlying ? '✈ Flying ON — Space=up, Shift=down, Ctrl=fast' : '🚶 Flying OFF', '#4caf50');
            break;

        case 'give': {
            if (args[0] === 'all') {
                // Give all blocks and items
                const allIds = Object.values(BLOCKS).filter(b => b && b.id).map(b => b.id);
                allIds.forEach(id => addToInventory(id, 64));
                cmdLog(output, `✅ Gave all ${allIds.length} items (x64 each)`, '#4caf50');
                break;
            }
            const itemArg = args[0];
            const amt = parseInt(args[1]) || 1;
            // Try by ID first, then by name
            let blockId = parseInt(itemArg);
            if (isNaN(blockId)) {
                const key = Object.keys(BLOCKS).find(k => k.toLowerCase() === itemArg.toLowerCase());
                if (key && BLOCKS[key].id) blockId = BLOCKS[key].id;
            }
            if (!blockId || isNaN(blockId)) { cmdLog(output, `❌ Unknown item: ${itemArg}`, '#f44336'); break; }
            addToInventory(blockId, amt);
            cmdLog(output, `✅ Gave ${amt}x ${getBlockName(blockId)}`, '#4caf50');
            break;
        }

        case 'find': {
            const findArg = (args[0] || '').toLowerCase();
            const px = Math.floor(camera.position.x), pz = Math.floor(camera.position.z);
            let found = false;
            // Scan nearby chunks for features
            for (let r = 0; r <= 8 && !found; r++) {
                for (let dcx = -r; dcx <= r && !found; dcx++) {
                    for (let dcz = -r; dcz <= r && !found; dcz++) {
                        if (Math.abs(dcx) !== r && Math.abs(dcz) !== r) continue;
                        const cx2 = Math.floor(px / 16) + dcx;
                        const cz2 = Math.floor(pz / 16) + dcz;
                        const mineSeed = Math.abs(Math.sin(cx2 * 53.7 + cz2 * 91.3) * 9999) % 1;
                        const dungSeed = Math.abs(Math.sin(cx2 * 113.0 + cz2 * 67.5) * 9999) % 1;
                        const treasSeed = Math.abs(Math.sin(cx2 * 41.3 + cz2 * 159.7) * 9999) % 1;
                        if ((findArg === 'mine' || findArg === 'mineshaft' || findArg === '') && mineSeed < 0.20) {
                            const wx = cx2 * 16 + 8, wz = cz2 * 16 + 8;
                            cmdLog(output, `⛏ Mineshaft near ${wx}, ?, ${wz}  (${Math.round(Math.hypot(wx-px, wz-pz))} blocks away)`, '#ffd700');
                            found = true;
                        } else if ((findArg === 'dungeon' || findArg === '') && dungSeed < 0.10) {
                            const wx = cx2 * 16 + 8, wz = cz2 * 16 + 8;
                            cmdLog(output, `🏛 Dungeon near ${wx}, ?, ${wz}  (${Math.round(Math.hypot(wx-px, wz-pz))} blocks away)`, '#ff9944');
                            found = true;
                        } else if ((findArg === 'treasure' || findArg === '') && treasSeed < 0.08) {
                            const wx = cx2 * 16 + 8, wz = cz2 * 16 + 8;
                            cmdLog(output, `💎 Buried Treasure near ${wx}, ?, ${wz}  (${Math.round(Math.hypot(wx-px, wz-pz))} blocks away)`, '#00eeff');
                            found = true;
                        }
                    }
                }
            }
            if (!found) cmdLog(output, `Nothing found nearby. Try exploring further!`, '#aaa');
            break;
        }

        case 'summon': {
            // Join all args so "/summon poison revenant" or "/summon snow defender" works
            const rawMobArg = args.join(' ').toLowerCase().trim() || 'pig';
            // Normalize: replace spaces/underscores, map aliases
            const aliasMap = {
                'poison revenant': 'revenant', 'poison_revenant': 'revenant',
                'snow defender': 'snow_defender', 'sand defender': 'sand_defender',
                'snow golem': 'snow_defender', 'sand golem': 'sand_defender',
            };
            const normalizedArg = aliasMap[rawMobArg] || rawMobArg.replace(/\s+/g, '_');
            const validMobs = ['pig', 'zombie', 'skeleton', 'husk', 'snow_defender', 'sand_defender', 'ghost', 'revenant', 'human'];
            const mobName = validMobs.find(m => m === normalizedArg || m.startsWith(normalizedArg)) || normalizedArg;
            const sx = camera.position.x + (Math.random() - 0.5) * 4;
            const sz = camera.position.z + (Math.random() - 0.5) * 4;
            const sy = camera.position.y + 1;
            mobManager.mobs.push(new Mob(mobName, sx, sy, sz, scene));
            cmdLog(output, `✅ Spawned ${mobName}`, '#4caf50');
            break;
        }

        case 'kill': {
            const killArg = (args[0] || 'all').toLowerCase();
            let count = 0;
            if (killArg === 'all') {
                count = mobManager.mobs.length;
                mobManager.mobs.forEach(m => { m.dead = true; m.mesh.visible = false; });
                mobManager.mobs = [];
            } else {
                const before = mobManager.mobs.length;
                mobManager.mobs.forEach(m => {
                    if (m.type.toLowerCase().includes(killArg)) { m.dead = true; m.mesh.visible = false; count++; }
                });
                mobManager.mobs = mobManager.mobs.filter(m => !m.dead);
            }
            cmdLog(output, `✅ Killed ${count} mob(s)`, '#4caf50');
            break;
        }

        case 'tp': {
            const tx = parseFloat(args[0]), ty = parseFloat(args[1]), tz = parseFloat(args[2]);
            if (isNaN(tx) || isNaN(ty) || isNaN(tz)) { cmdLog(output, '❌ Usage: /tp <x> <y> <z>', '#f44336'); break; }
            camera.position.set(tx, ty, tz);
            velocity.set(0, 0, 0);
            cmdLog(output, `✅ Teleported to ${tx}, ${ty}, ${tz}`, '#4caf50');
            break;
        }

        case 'tpblock': {
            const cx = Math.floor(camera.position.x), cz = Math.floor(camera.position.z);
            let topY = 0;
            for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
                if (world.getBlock(cx, y, cz) !== 0) { topY = y + 2; break; }
            }
            camera.position.y = topY;
            velocity.set(0, 0, 0);
            cmdLog(output, `✅ Teleported to surface at Y=${topY}`, '#4caf50');
            break;
        }

        case 'place': {
            const placeId = parseInt(args[0]);
            const px = args[1] !== undefined ? parseInt(args[1]) : Math.floor(camera.position.x);
            const py = args[2] !== undefined ? parseInt(args[2]) : Math.floor(camera.position.y);
            const pz = args[3] !== undefined ? parseInt(args[3]) : Math.floor(camera.position.z);
            if (isNaN(placeId)) { cmdLog(output, '❌ Usage: /place <blockId> [x y z]', '#f44336'); break; }
            world.setBlock(px, py, pz, placeId);
            cmdLog(output, `✅ Placed ${getBlockName(placeId)} at ${px},${py},${pz}`, '#4caf50');
            break;
        }

        case 'time': {
            const timeArg = args[0];
            if (!timeArg) { cmdLog(output, `Current time: ${Math.floor(dayTime)} / ${DAY_LENGTH} (${(dayTime/DAY_LENGTH*100).toFixed(1)}%)`, '#aef'); break; }
            if (timeArg === 'day') { dayTime = DAY_LENGTH * 0.05; cmdLog(output, '✅ Set to day', '#4caf50'); }
            else if (timeArg === 'night') { dayTime = DAY_LENGTH * 0.55; cmdLog(output, '✅ Set to night', '#4caf50'); }
            else if (timeArg === 'noon') { dayTime = DAY_LENGTH * 0.25; cmdLog(output, '✅ Set to noon', '#4caf50'); }
            else if (timeArg === 'sunset') { dayTime = DAY_LENGTH * 0.45; cmdLog(output, '✅ Set to sunset', '#4caf50'); }
            else {
                const t = parseFloat(timeArg);
                if (!isNaN(t)) { dayTime = Math.max(0, Math.min(DAY_LENGTH, t)); cmdLog(output, `✅ Time set to ${dayTime}`, '#4caf50'); }
                else cmdLog(output, '❌ Usage: /time day|night|noon|sunset|0-1200', '#f44336');
            }
            break;
        }

        case 'heal':
            playerHealth = maxHealth;
            updateHealthUI();
            cmdLog(output, '✅ Full health restored', '#4caf50');
            break;

        case 'clear':
            for (let i = 0; i < INVENTORY_SIZE; i++) { inventory[i].type = 0; inventory[i].count = 0; }
            updateUI();
            cmdLog(output, '✅ Inventory cleared', '#4caf50');
            break;

        case 'explode': {
            const rad = parseInt(args[0]) || 5;
            world.explode(Math.floor(camera.position.x), Math.floor(camera.position.y - 2), Math.floor(camera.position.z), rad);
            cmdLog(output, `✅ Exploded (radius ${rad})`, '#4caf50');
            break;
        }

        case 'fill': {
            const fillId = parseInt(args[0]);
            const fillR = parseInt(args[1]) || 3;
            if (isNaN(fillId)) { cmdLog(output, '❌ Usage: /fill <blockId> [radius]', '#f44336'); break; }
            const fx = Math.floor(camera.position.x), fy = Math.floor(camera.position.y - 1), fz = Math.floor(camera.position.z);
            let filled = 0;
            for (let dx = -fillR; dx <= fillR; dx++) for (let dy = -fillR; dy <= fillR; dy++) for (let dz = -fillR; dz <= fillR; dz++) {
                if (dx*dx+dy*dy+dz*dz <= fillR*fillR) { world.setBlock(fx+dx, fy+dy, fz+dz, fillId); filled++; }
            }
            cmdLog(output, `✅ Filled ${filled} blocks with ${getBlockName(fillId)}`, '#4caf50');
            break;
        }

        case 'killme':
            playerHealth = 0;
            updateHealthUI();
            cmdLog(output, '💀 You died.', '#f44336');
            break;

        case 'pos':
            cmdLog(output, `📍 Position: X=${camera.position.x.toFixed(1)}, Y=${camera.position.y.toFixed(1)}, Z=${camera.position.z.toFixed(1)}`);
            break;

        case 'speed': {
            const spd = parseFloat(args[0]);
            if (isNaN(spd) || spd <= 0) { cmdLog(output, '❌ Usage: /speed <number>  (default: 15)', '#f44336'); break; }
            flySpeed = spd;
            cmdLog(output, `✅ Fly/move speed set to ${spd}`, '#4caf50');
            break;
        }

        case 'list': {
            cmdLog(output, '── Block IDs ──', '#888');
            Object.entries(BLOCKS).forEach(([name, val]) => {
                if (val && val.id) cmdLog(output, `  ${val.id.toString().padStart(3)} — ${name}`);
            });
            break;
        }

        case 'weather': {
            const w = (args[0] || '').toLowerCase();
            if (w === 'storm') {
                scene.fog.near = 5; scene.fog.far = 30;
                ambientLight.intensity = 0.15;
                cmdLog(output, '🌩 Storm weather set', '#4caf50');
            } else {
                scene.fog.near = 20; scene.fog.far = (DRAW_DISTANCE * CHUNK_SIZE) - 10;
                cmdLog(output, '☀️ Clear weather set', '#4caf50');
            }
            break;
        }

        default:
            cmdLog(output, `❌ Unknown command: /${cmd}  — type /help`, '#f44336');
    }
}
function saveGame() {
    if (typeof SaveManager === 'undefined' || typeof world === 'undefined') return;
    if (!SaveManager.db) return; // DB not ready yet

    // Save player state
    const pData = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        rx: camera.rotation.x,
        ry: camera.rotation.y,
        health: typeof playerHealth !== 'undefined' ? playerHealth : 10,
        inventory: typeof inventory !== 'undefined' ? JSON.parse(JSON.stringify(inventory)) : [],
        chests: Array.from(world.chestData.entries())
    };
    SaveManager.savePlayer(pData);

    // Save ALL loaded chunks — not just dirty ones — so world is always fully preserved
    world.chunkData.forEach((data, key) => {
        SaveManager.saveChunk(key, data);
    });
    world.dirtyChunks.clear();

    // Update save status
    const ss = document.getElementById('save-status');
    if (ss) {
        const t = new Date();
        ss.innerText = `💾 Saved ${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
    }
}

const saveBtn = document.getElementById('save-btn');
if (saveBtn) { saveBtn.onclick = (e) => { e.stopPropagation(); saveGame(); }; }

const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
    resetBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm("Reset World? ALL progress, blocks, and items will be permanently deleted!")) {
            SaveManager.resetWorld();
        }
    };
}

if (blocker) {
    blocker.onclick = (e) => { if (e.target === blocker && typeof controls !== 'undefined') controls.lock(); };
}

function hideLoadingAndStart() {
    const loadEl = document.getElementById('loading');
    if (loadEl) loadEl.style.display = 'none';
    animate();
}

if (typeof SaveManager !== 'undefined') {
    const loadTimeout = setTimeout(hideLoadingAndStart, 8000);
    SaveManager.init()
        .then(async () => {
            try {
                // Load ALL saved chunks first — restores every block the player ever placed/broke
                if (typeof world !== 'undefined') await world.loadMetadata();

                const pData = await SaveManager.loadPlayer();
                if (pData) {
                    // Exact X and Z, always Y=100 so player never spawns inside terrain
                    const spawnX = typeof pData.x === 'number' ? pData.x : 0;
                    const spawnZ = typeof pData.z === 'number' ? pData.z : 0;
                    const spawnY = 100;

                    camera.position.set(spawnX, spawnY, spawnZ);
                    camera.rotation.set(pData.rx || 0, pData.ry || 0, 0);

                    if (typeof playerHealth !== 'undefined') playerHealth = Math.max(1, pData.health || 10);
                    if (typeof updateHealthUI === 'function') updateHealthUI();

                    if (pData.inventory && typeof inventory !== 'undefined') {
                        for (let i = 0; i < INVENTORY_SIZE; i++) {
                            if (pData.inventory[i]) inventory[i] = pData.inventory[i];
                        }
                    }
                    if (typeof updateUI === 'function') updateUI();

                    if (pData.chests && typeof world !== 'undefined') {
                        pData.chests.forEach(([k, v]) => world.chestData.set(k, v));
                    }

                    const resumeEl = document.getElementById('resume-status');
                    if (resumeEl) {
                        resumeEl.innerText = `✅ World restored — X:${spawnX.toFixed(0)} Z:${spawnZ.toFixed(0)} | Click to Play`;
                    }
                } else {
                    // Fresh new game
                    camera.position.set(0, 100, 0);
                    const resumeEl = document.getElementById('resume-status');
                    if (resumeEl) resumeEl.innerText = '🌍 New world — Click to Play';
                }
            } catch (e) {
                console.warn('Load/save init error, starting fresh:', e);
                if (typeof camera !== 'undefined') camera.position.set(0, 100, 0);
                const resumeEl = document.getElementById('resume-status');
                if (resumeEl) resumeEl.innerText = '🌍 New world — Click to Play';
            }
            clearTimeout(loadTimeout);
            hideLoadingAndStart();
        })
        .catch((e) => {
            console.warn('SaveManager.init failed, starting anyway:', e);
            clearTimeout(loadTimeout);
            hideLoadingAndStart();
        });
} else {
    animate();
}

// Auto-save every 10 seconds in background
setInterval(() => { if (typeof saveGame === 'function') saveGame(); }, 10000);
// Hard save on tab close / reload
window.addEventListener('beforeunload', () => { if (typeof saveGame === 'function') saveGame(); });
