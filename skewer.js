import * as THREE from "three";
import { OrbitControls } from "./libs/OrbitControls.js";
import { STLLoader } from "./libs/STLLoader.js";
import { STLExporter } from "./libs/STLExporter.js";

const FACE_CONFIG = {
  top: { axis: "y", anchor: "max", directions: ["x+", "x-", "z+", "z-"] },
  bottom: { axis: "y", anchor: "min", directions: ["x+", "x-", "z+", "z-"] },
  left: { axis: "x", anchor: "min", directions: ["y+", "y-", "z+", "z-"] },
  right: { axis: "x", anchor: "max", directions: ["y+", "y-", "z+", "z-"] },
  front: { axis: "z", anchor: "max", directions: ["x+", "x-", "y+", "y-"] },
  back: { axis: "z", anchor: "min", directions: ["x+", "x-", "y+", "y-"] }
};
const DIRECTION_LABELS = { "x+": "Right (+X)", "x-": "Left (-X)", "y+": "Up (+Y)", "y-": "Down (-Y)", "z+": "Forward (+Z)", "z-": "Back (-Z)" };
const state = { face: "bottom", direction: "x+", amount: 18, falloff: "linear", filename: "demo-wedge.stl", wireframe: false };
const elements = {
  viewer: document.querySelector("#viewer"), dropZone: document.querySelector("#drop-zone"), fileInput: document.querySelector("#file-input"),
  upload: document.querySelector("#upload-button"), fileName: document.querySelector("#file-name"), triangleCount: document.querySelector("#triangle-count"),
  faceGrid: document.querySelector("#face-grid"), direction: document.querySelector("#direction"), amount: document.querySelector("#amount"),
  amountNumber: document.querySelector("#amount-number"), falloff: document.querySelector("#falloff"), modelSize: document.querySelector("#model-size"),
  rangeMin: document.querySelector("#range-min"), rangeMax: document.querySelector("#range-max"), error: document.querySelector("#viewer-error")
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111411);
scene.fog = new THREE.Fog(0x111411, 280, 700);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 3000);
camera.position.set(90, 72, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
elements.viewer.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.HemisphereLight(0xe8f2df, 0x283129, 2.5));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(80, 120, 90);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xc8ff3d, 2.1);
rimLight.position.set(-100, 40, -80);
scene.add(rimLight);
const grid = new THREE.GridHelper(500, 25, 0x485147, 0x282d28);
grid.position.y = -20.01;
scene.add(grid);

const material = new THREE.MeshStandardMaterial({ color: 0xaeb8aa, roughness: 0.56, metalness: 0.04 });
let mesh;
let originalGeometry;
let originalBounds;

function makeDemoGeometry() {
  return new THREE.BoxGeometry(40, 40, 40, 5, 5, 5).toNonIndexed();
}

function setGeometry(geometry, filename = "model.stl") {
  if (!geometry?.attributes?.position?.count) throw new Error("This STL does not contain any triangles.");
  if (geometry.index) geometry = geometry.toNonIndexed();
  geometry.computeBoundingBox();
  geometry.center();
  geometry.computeVertexNormals();
  originalGeometry?.dispose();
  originalGeometry = geometry.clone();
  originalGeometry.computeBoundingBox();
  originalBounds = originalGeometry.boundingBox.clone();
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  state.filename = filename;
  elements.fileName.textContent = filename.replace(/\.stl$/i, "");
  elements.triangleCount.textContent = `${Math.floor(geometry.attributes.position.count / 3).toLocaleString()} triangles`;
  setAmountRange();
  applySkew();
  fitView();
  hideError();
}

function setAmountRange() {
  const size = originalBounds.getSize(new THREE.Vector3());
  const limit = Math.max(10, Math.ceil(Math.max(size.x, size.y, size.z) * 2));
  elements.amount.min = -limit;
  elements.amount.max = limit;
  elements.amountNumber.min = -limit;
  elements.amountNumber.max = limit;
  elements.rangeMin.textContent = `-${limit}`;
  elements.rangeMax.textContent = limit;
  state.amount = Math.min(Math.max(state.amount, -limit), limit);
  syncAmountInputs();
}

function eased(t) {
  if (state.falloff === "ease-in") return t * t;
  if (state.falloff === "ease-out") return 1 - (1 - t) * (1 - t);
  if (state.falloff === "smooth") return t * t * (3 - 2 * t);
  return t;
}

function applySkew() {
  if (!mesh || !originalGeometry) return;
  const config = FACE_CONFIG[state.face];
  const [moveAxis, sign] = state.direction.split("");
  const position = mesh.geometry.attributes.position;
  const source = originalGeometry.attributes.position;
  const min = originalBounds.min[config.axis];
  const max = originalBounds.max[config.axis];
  const span = max - min || 1;
  for (let i = 0; i < position.count; i += 1) {
    const x = source.getX(i), y = source.getY(i), z = source.getZ(i);
    const coordinate = config.axis === "x" ? x : config.axis === "y" ? y : z;
    const linearT = config.anchor === "min" ? (coordinate - min) / span : (max - coordinate) / span;
    const offset = eased(THREE.MathUtils.clamp(linearT, 0, 1)) * state.amount * (sign === "+" ? 1 : -1);
    position.setXYZ(i, x + (moveAxis === "x" ? offset : 0), y + (moveAxis === "y" ? offset : 0), z + (moveAxis === "z" ? offset : 0));
  }
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  updateMeasurements();
}

function updateMeasurements() {
  const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
  elements.modelSize.textContent = `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`;
}

function updateDirections() {
  const choices = FACE_CONFIG[state.face].directions;
  if (!choices.includes(state.direction)) state.direction = choices[0];
  elements.direction.replaceChildren(...choices.map(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = DIRECTION_LABELS[value];
    option.selected = value === state.direction;
    return option;
  }));
}

function syncAmountInputs() { elements.amount.value = state.amount; elements.amountNumber.value = state.amount; }
function setAmount(rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return;
  state.amount = THREE.MathUtils.clamp(value, Number(elements.amount.min), Number(elements.amount.max));
  syncAmountInputs();
  applySkew();
}

function fitView() {
  if (!mesh) return;
  const box = new THREE.Box3().setFromObject(mesh);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  const direction = new THREE.Vector3(1, 0.72, 1).normalize();
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(direction, distance * 1.15);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.update();
  grid.position.y = box.min.y - Math.max(sphere.radius * 0.015, 0.1);
}

async function loadFile(file) {
  if (!file || !file.name.toLowerCase().endsWith(".stl")) return showError("Choose a file with the .stl extension.");
  try {
    setGeometry(new STLLoader().parse(await file.arrayBuffer()), file.name);
  } catch (error) {
    console.error(error);
    showError("That STL could not be read. It may be damaged or use an unsupported format.");
  } finally { elements.fileInput.value = ""; }
}

function exportStl() {
  if (!mesh) return;
  const data = new STLExporter().parse(mesh, { binary: true });
  const url = URL.createObjectURL(new Blob([data], { type: "model/stl" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.filename.replace(/\.stl$/i, "")}-askew.stl`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showError(message) { elements.error.textContent = message; elements.error.classList.add("visible"); }
function hideError() { elements.error.classList.remove("visible"); }

elements.upload.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", event => loadFile(event.target.files[0]));
elements.faceGrid.addEventListener("click", event => {
  const button = event.target.closest("button[data-face]");
  if (!button) return;
  state.face = button.dataset.face;
  elements.faceGrid.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
  updateDirections();
  applySkew();
});
elements.direction.addEventListener("change", event => { state.direction = event.target.value; applySkew(); });
elements.amount.addEventListener("input", event => setAmount(event.target.value));
elements.amountNumber.addEventListener("change", event => setAmount(event.target.value));
elements.falloff.addEventListener("change", event => { state.falloff = event.target.value; applySkew(); });
document.querySelector("#reset-skew").addEventListener("click", () => setAmount(0));
document.querySelector("#export-button").addEventListener("click", exportStl);
document.querySelector("#fit-view").addEventListener("click", fitView);
document.querySelector("#toggle-wireframe").addEventListener("click", event => { state.wireframe = !state.wireframe; material.wireframe = state.wireframe; event.currentTarget.classList.toggle("active", state.wireframe); });
for (const type of ["dragenter", "dragover"]) elements.dropZone.addEventListener(type, event => { event.preventDefault(); elements.dropZone.classList.add("dragging"); });
for (const type of ["dragleave", "drop"]) elements.dropZone.addEventListener(type, event => { event.preventDefault(); elements.dropZone.classList.remove("dragging"); });
elements.dropZone.addEventListener("drop", event => loadFile(event.dataTransfer.files[0]));

function resize() {
  const { clientWidth, clientHeight } = elements.viewer;
  if (!clientWidth || !clientHeight) return;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(elements.viewer);
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }

updateDirections();
setGeometry(makeDemoGeometry(), "demo-wedge.stl");
resize();
animate();
