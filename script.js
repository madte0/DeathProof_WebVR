AFRAME.registerComponent('scroll-animation-scrub', {
  schema: {
    sensitivity: { type: 'number', default: 0.01 },
    lerp:        { type: 'number', default: 0.08  },
  },

  init() {
    this.duration     = 0;
    this.currentTime  = 0;
    this.targetTime   = 0;
    this.interpolants = [];  // { interpolant, prop, target }
    this.gltfCamera   = null;
    this.aframeCamera = null;
    this.sceneRoot    = null;
    this._wp          = new THREE.Vector3();
    this._wq          = new THREE.Quaternion();
    this._tickCount   = 0;

    this.el.addEventListener('model-loaded', (e) => {
      const gltf      = e.detail.model;
      this.sceneRoot  = gltf.scene || gltf;
      const clips     = gltf.animations || [];

      // ── Log everything so we can see what the new export contains ──
      console.log('[scrub] Total clips:', clips.length);
      clips.forEach((clip, ci) => {
        console.log(`  [${ci}] "${clip.name}"  ${clip.duration.toFixed(3)}s  ${clip.tracks.length} tracks`);
        clip.tracks.forEach(t => console.log('      ', t.name, '| keys:', t.times.length));
      });

      if (!clips.length) { console.warn('[scrub] No clips'); return; }

      this.duration = Math.max(...clips.map(c => c.duration));

      // Build one interpolant per track across ALL clips
      clips.forEach(clip => {
        clip.tracks.forEach(track => {
          const lastDot = track.name.lastIndexOf('.');
          const objName = track.name.slice(0, lastDot);
          const prop    = track.name.slice(lastDot + 1);  // position | quaternion | scale

          const target = this.sceneRoot.getObjectByName(objName);
          if (!target) {
            console.warn('[scrub] Object not found for track:', track.name);
            return;
          }

          // Ensure matrix recomputes when we set position/quaternion/scale manually.
          // A-Frame disables matrixAutoUpdate on GLTF nodes for performance — we re-enable
          // it only on objects we're animating so updateWorldMatrix picks up our changes.
          target.matrixAutoUpdate = true;

          const interpolant = track.createInterpolant(new Float32Array(track.getValueSize()));
          this.interpolants.push({ interpolant, prop, target, name: track.name });
        });
      });

      // Unique targets — used in tick to propagate transforms to children
      this.animatedTargets = [...new Set(this.interpolants.map(i => i.target))];

      console.log('[scrub] Interpolants ready:', this.interpolants.length);
      this.interpolants.forEach(i => console.log('  ready:', i.name));

      // Find Camera_Animated by exact name first, then fall back to any camera in scene
      this.gltfCamera = this.sceneRoot.getObjectByName('Camera_Animated');

      if (!this.gltfCamera) {
        this.sceneRoot.traverse(obj => {
          if (!this.gltfCamera && obj.isCamera) this.gltfCamera = obj;
        });
        if (this.gltfCamera)
          console.log('[scrub] Fell back to camera:', this.gltfCamera.name);
        else
          console.warn('[scrub] No camera found in scene');
      } else {
        console.log('[scrub] Camera_Animated found');
      }

      this.aframeCamera = document.querySelector('a-camera');

      if (this.aframeCamera) {
        this.aframeCamera.removeAttribute('look-controls');

        // Place the A-Frame camera immediately — tick() has a 1-frame delay
        if (this.gltfCamera) {
          this.gltfCamera.getWorldPosition(this._wp);
          this.gltfCamera.getWorldQuaternion(this._wq);
          this.aframeCamera.object3D.position.copy(this._wp);
          this.aframeCamera.object3D.quaternion.copy(this._wq);
          console.log('[scrub] Initial cam pos:',
            this._wp.x.toFixed(3), this._wp.y.toFixed(3), this._wp.z.toFixed(3));
        }
      }
    });

    this._onWheel = (e) => {
      if (!this.duration) return;
      this.targetTime = Math.max(
        0,
        Math.min(this.duration, this.targetTime + e.deltaY * this.data.sensitivity)
      );
    };

    window.addEventListener('wheel', this._onWheel);
  },

  tick() {
    if (!this.interpolants.length) return;

    this.currentTime += (this.targetTime - this.currentTime) * this.data.lerp;

    // Apply every track to its target object
    this.interpolants.forEach(({ interpolant, prop, target }) => {
      interpolant.evaluate(this.currentTime);
      const v = interpolant.resultBuffer;
      if      (prop === 'position')   target.position.set(v[0], v[1], v[2]);
      else if (prop === 'quaternion') target.quaternion.set(v[0], v[1], v[2], v[3]);
      else if (prop === 'scale')      target.scale.set(v[0], v[1], v[2]);
    });

    // Recompute each animated target's matrix then propagate to its children.
    // matrixAutoUpdate = true (set above) makes updateMatrix() run inside updateWorldMatrix,
    // picking up the new position/quaternion/scale values we just wrote.
    this.animatedTargets.forEach(t => t.updateWorldMatrix(false, true));

    // Copy Camera_Animated's updated world transform to the A-Frame camera
    if (this.gltfCamera && this.aframeCamera) {
      this.gltfCamera.getWorldPosition(this._wp);
      this.gltfCamera.getWorldQuaternion(this._wq);
      this.aframeCamera.object3D.position.copy(this._wp);
      this.aframeCamera.object3D.quaternion.copy(this._wq);
    }

    if (++this._tickCount % 60 === 0) {
      const vp = new THREE.Vector3();
      this.animatedTargets[0]?.getWorldPosition(vp);
      this.gltfCamera?.getWorldPosition(this._wp);
      console.log('[scrub] t:', this.currentTime.toFixed(3),
        '| visor world:', vp.x.toFixed(3), vp.y.toFixed(3), vp.z.toFixed(3),
        '| cam world:', this._wp.x.toFixed(3), this._wp.y.toFixed(3), this._wp.z.toFixed(3));
    }
  },

  remove() {
    window.removeEventListener('wheel', this._onWheel);
  },
});

// =====================================================
// MODAL SYSTEM
// =====================================================

const modal = document.getElementById("modal");
const modalImage = document.getElementById("modalImage");
const youtubeFrame = document.getElementById("youtubeFrame");
const closeModal = document.getElementById("closeModal");

function openImage(src) {

    modal.style.display = "block";

    modalImage.style.display = "block";

    youtubeFrame.style.display = "none";

    youtubeFrame.src = "";

    modalImage.src = src;
}

function openVideo(url) {

    modal.style.display = "block";

    modalImage.style.display = "none";

    youtubeFrame.style.display = "block";

    youtubeFrame.src = url;
}

closeModal.addEventListener("click", () => {

    modal.style.display = "none";

    youtubeFrame.src = "";
});

modal.addEventListener("click", (e) => {

    if (e.target === modal) {

        modal.style.display = "none";

        youtubeFrame.src = "";
    }
});

function createHotspots(visor) {

  // RED - Tarantino
  const leftMaterial =
      new THREE.MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
      });

  // GREEN - The Girls
  const centerMaterial =
      new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
      });

  // BLUE - Video
  const rightMaterial =
      new THREE.MeshBasicMaterial({
          color: 0x0000ff,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
      });

  // =========================
  // LEFT HOTSPOT
  // =========================

  const leftMesh =
      new THREE.Mesh(
          new THREE.PlaneGeometry(
            0.26,
            0.24
          ),
          leftMaterial
      );

      leftMesh.position.set(
        0.02,
        -0.01,
        0.25
    );

  leftMesh.name = "leftHotspot";

  visor.add(leftMesh);

  // =========================
  // CENTER HOTSPOT
  // =========================

  const centerMesh =
      new THREE.Mesh(
          new THREE.PlaneGeometry(
            0.26,
            0.24
          ),
          centerMaterial
      );

      centerMesh.position.set(
        0.27,
        -0.01,
        0.25
    );

  centerMesh.name = "centerHotspot";

  visor.add(centerMesh);

  // =========================
  // RIGHT HOTSPOT
  // =========================

  const rightMesh =
      new THREE.Mesh(
          new THREE.PlaneGeometry(
            0.26,
            0.24
          ),
          rightMaterial
      );

      rightMesh.position.set(
        0.52,
        -0.01,
        0.25
    );

  rightMesh.name = "rightHotspot";

  visor.add(rightMesh);

  console.log("Colored hotspots created");

  setupRaycaster(
      leftMesh,
      centerMesh,
      rightMesh
  );
}

// =====================================================
// FIND VISOR AND CREATE HOTSPOTS
// =====================================================

window.addEventListener("load", () => {

  const modelEntity =
      document.querySelector("#deathProofModel");

  modelEntity.addEventListener("model-loaded", () => {

      const root =
          modelEntity.getObject3D("mesh");

      if (!root) {

          console.error(
              "GLTF root not found"
          );

          return;
      }

      const visor =
          root.getObjectByName(
              "visorvisor_fotos_GRP"
          );

      if (!visor) {

          console.error(
              "visorvisor_fotos_GRP not found"
          );

          return;
      }

      console.log(
          "visor found",
          visor
      );

      createHotspots(
          visor
      );

  });

});

// =====================================================
// RAYCASTER
// =====================================================

function setupRaycaster(
  leftMesh,
  centerMesh,
  rightMesh
) {

  const raycaster =
      new THREE.Raycaster();

  const mouse =
      new THREE.Vector2();

  window.addEventListener(
      "click",
      (event) => {

          mouse.x =
              (event.clientX / window.innerWidth) * 2 - 1;

          mouse.y =
              -(event.clientY / window.innerHeight) * 2 + 1;

          const cameraEl =
              document.querySelector(
                  "a-camera"
              );

          const camera =
              cameraEl.getObject3D(
                  "camera"
              );

          if (!camera) return;

          raycaster.setFromCamera(
              mouse,
              camera
          );

          const hits =
              raycaster.intersectObjects(
                  [
                      leftMesh,
                      centerMesh,
                      rightMesh
                  ],
                  true
              );

          if (!hits.length)
              return;

          const object =
              hits[0].object;

          console.log(
              "Clicked:",
              object.name
          );

          if (
              object.name ===
              "leftHotspot"
          ) {

              openImage(
                  "./assets/chevy_nova_scene_webpTextures_glb/photo1.webp"
              );
          }

          if (
              object.name ===
              "centerHotspot"
          ) {

              openImage(
                  "./assets/chevy_nova_scene_webpTextures_glb/photo2.webp"
              );
          }

          if (
              object.name ===
              "rightHotspot"
          ) {

              openVideo(
                  "https://www.youtube.com/embed/EAPy76vxF5s?autoplay=1"
              );
          }
      }
  );
}
