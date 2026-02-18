/**
 * viewer-3d.js — Three.js 3D visualization of PCF components (vanilla JS)
 * Ported from 3Dmodelgeneratorforpcf_Viewer.jsx (React/R3F) to raw Three.js.
 *
 * Exports:
 *   PcfViewer3D class
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Color palette ──────────────────────────────────────────────────
const COLORS = {
    PIPE: 0x1e90ff,  // Dodger Blue
    FLANGE: 0xff4500,  // Orange Red
    VALVE: 0x32cd32,  // Lime Green
    TEE: 0xffd700,  // Gold
    ELBOW: 0x8a2be2,  // Blue Violet
    SUPPORT: 0x808080,  // Grey
    BEND: 0x8a2be2,
    REDUCER: 0xff69b4,  // Hot Pink
    UNKNOWN: 0xd3d3d3,  // Light Grey
};

// ── Coordinate mapping (PCF → Three.js) ────────────────────────────
// PCF: X=East, Y=North, Z=Up
// Three: X=right, Y=up, Z=towards viewer
const mapCoord = (p) => {
    if (!p) return null;
    return new THREE.Vector3(-p.y, p.z, -p.x);
};

// ── Cylinder helper ────────────────────────────────────────────────
function createCylinder(startVec, endVec, radius, color) {
    const diff = new THREE.Vector3().subVectors(endVec, startVec);
    const length = diff.length();
    if (length < 0.1) return null;

    const mid = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const axis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(axis, diff.clone().normalize());

    const geo = new THREE.CylinderGeometry(radius, radius, length, 16);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.quaternion.copy(quat);
    return mesh;
}

function createSphere(pos, radius, color) {
    const geo = new THREE.SphereGeometry(radius, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    return mesh;
}

// ── Main class ─────────────────────────────────────────────────────

export class PcfViewer3D {
    /**
     * @param {HTMLElement} containerEl — DOM element to render into
     */
    constructor(containerEl) {
        this.container = containerEl;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this._animId = null;
        this._componentGroup = null;

        this._init();
    }

    /** @private */
    _init() {
        const w = this.container.clientWidth || 800;
        const h = this.container.clientHeight || 600;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1c2030);

        // Camera — Orthographic
        const aspect = w / h;
        const frustum = 5000;
        this.camera = new THREE.OrthographicCamera(
            -frustum * aspect, frustum * aspect,
            frustum, -frustum,
            -50000, 50000
        );
        this.camera.position.set(5000, 5000, 5000);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Controls (OrbitControls loaded via importmap)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const point = new THREE.PointLight(0xffffff, 0.8);
        point.position.set(2000, 4000, 2000);
        this.scene.add(point);

        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(-1000, 5000, -2000);
        this.scene.add(dir);

        // Grid + Axes
        const grid = new THREE.GridHelper(10000, 20, 0x3a4255, 0x252a3a);
        grid.position.y = -500;
        this.scene.add(grid);

        const axes = new THREE.AxesHelper(1000);
        this.scene.add(axes);

        // Resize handler
        this._onResize = () => {
            const nw = this.container.clientWidth;
            const nh = this.container.clientHeight;
            const nAspect = nw / nh;
            this.camera.left = -frustum * nAspect;
            this.camera.right = frustum * nAspect;
            this.camera.top = frustum;
            this.camera.bottom = -frustum;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', this._onResize);

        // Start render loop
        this._animate();
    }

    /** @private */
    _animate() {
        this._animId = requestAnimationFrame(() => this._animate());
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Clear old components and render new ones.
     * @param {object[]} components — from stitcher output
     */
    render(components) {
        // Remove old component group
        if (this._componentGroup) {
            this.scene.remove(this._componentGroup);
            this._componentGroup.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        }

        this._componentGroup = new THREE.Group();

        for (const comp of components) {
            const meshes = this._buildComponent(comp);
            meshes.forEach(m => { if (m) this._componentGroup.add(m); });
        }

        this.scene.add(this._componentGroup);

        // Auto-fit camera if components exist
        if (components.length > 0) this._fitCamera();
    }

    /** @private */
    _buildComponent(comp) {
        const { type, points, centrePoint, branch1Point, bore, coOrds } = comp;
        const radius = (bore || 50) / 2;
        const color = COLORS[type] ?? COLORS.UNKNOWN;

        switch (type) {
            case 'PIPE':
                return this._buildPipe(points, radius, color);
            case 'ELBOW':
            case 'BEND':
                return this._buildElbow(points, centrePoint, radius, color);
            case 'TEE':
                return this._buildTee(points, centrePoint, branch1Point, radius, color);
            case 'SUPPORT': {
                // SUPPORT uses CO-ORDS (single point), not END-POINT
                const pt = coOrds || (points && points[0]);
                if (!pt) return [];
                const pos = mapCoord(pt);
                const sphere = createSphere(pos, radius * 1.2, color);
                return sphere ? [sphere] : [];
            }
            default:
                return this._buildGeneric(points, radius, color, type);
        }
    }

    /** @private */
    _buildPipe(points, radius, color) {
        if (!points || points.length < 2) return [];
        const s = mapCoord(points[0]);
        const e = mapCoord(points[1]);
        const cyl = createCylinder(s, e, radius, color);
        return cyl ? [cyl] : [];
    }

    /** @private */
    _buildElbow(points, centrePoint, radius, color) {
        if (!points || points.length < 2) return [];
        const p1 = mapCoord(points[0]);
        const p2 = mapCoord(points[1]);

        if (centrePoint) {
            const c = mapCoord(centrePoint);
            const meshes = [];
            const leg1 = createCylinder(p1, c, radius, color);
            const leg2 = createCylinder(c, p2, radius, color);
            const sphere = createSphere(c, radius, color);
            if (leg1) meshes.push(leg1);
            if (leg2) meshes.push(leg2);
            if (sphere) meshes.push(sphere);
            return meshes;
        }

        // Fallback: straight line
        const cyl = createCylinder(p1, p2, radius, color);
        return cyl ? [cyl] : [];
    }

    /** @private */
    _buildTee(points, centrePoint, branch1Point, radius, color) {
        if (!centrePoint) return this._buildGeneric(points, radius, color, 'TEE');
        const c = mapCoord(centrePoint);
        const meshes = [];

        if (points && points[0]) {
            const p1 = mapCoord(points[0]);
            const leg = createCylinder(p1, c, radius, color);
            if (leg) meshes.push(leg);
        }
        if (points && points[1]) {
            const p2 = mapCoord(points[1]);
            const leg = createCylinder(c, p2, radius, color);
            if (leg) meshes.push(leg);
        }
        if (branch1Point) {
            const b = mapCoord(branch1Point);
            const leg = createCylinder(c, b, radius * 0.8, color);
            if (leg) meshes.push(leg);
        }

        // Sphere at junction
        meshes.push(createSphere(c, radius * 1.2, color));
        return meshes;
    }

    /** @private */
    _buildGeneric(points, radius, color, type) {
        if (!points || points.length < 2) return [];
        const s = mapCoord(points[0]);
        const e = mapCoord(points[1]);
        const r = type === 'FLANGE' ? radius * 1.4 : radius;
        const cyl = createCylinder(s, e, r, color);
        return cyl ? [cyl] : [];
    }

    /** @private — auto-fit camera to scene bounds */
    _fitCamera() {
        const box = new THREE.Box3().setFromObject(this._componentGroup);
        if (box.isEmpty()) return;

        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        // Update orthographic frustum
        const aspect = this.container.clientWidth / (this.container.clientHeight || 1);
        const half = maxDim * 0.8;
        this.camera.left = -half * aspect;
        this.camera.right = half * aspect;
        this.camera.top = half;
        this.camera.bottom = -half;
        this.camera.near = -maxDim * 10;
        this.camera.far = maxDim * 10;
        this.camera.position.set(
            centre.x + maxDim,
            centre.y + maxDim,
            centre.z + maxDim
        );
        this.camera.lookAt(centre);
        this.camera.updateProjectionMatrix();

        if (this.controls) {
            this.controls.target.copy(centre);
            this.controls.update();
        }
    }

    /** Tear down — clean up all resources */
    dispose() {
        if (this._animId) cancelAnimationFrame(this._animId);
        window.removeEventListener('resize', this._onResize);
        if (this.controls) this.controls.dispose();

        // Dispose all geometries/materials
        this.scene.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement?.parentNode === this.container) {
                this.container.removeChild(this.renderer.domElement);
            }
        }
    }
}
