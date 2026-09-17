let scene, camera, renderer, controls, loader, mesh;
let skewFactor = 1; // Default skew factor (no skew)

document.addEventListener("DOMContentLoaded", () => {
  initScene();
  setupEventListeners();
  animate();
});

function initScene() {
  // Create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera(
    45,
    800 / 600,
    0.1,
    1000
  );
  camera.position.set(0, 0, 50);

  // Create renderer
  const viewer = document.getElementById("viewer");
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(800, 600);
  viewer.appendChild(renderer.domElement);

  // Create OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);

  // Add lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 10);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x444444));

  // Initialize STL loader
  loader = new THREE.STLLoader();

  // Check if STLExporter is loaded
  console.log("STLExporter loaded:", typeof THREE.STLExporter !== "undefined");
}


let originalGeometry = null;

function setupEventListeners() {
  console.log("setupEventListeners called!"); // Debug log
  const fileLoader = document.getElementById("fileLoader");
  fileLoader.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const geometry = loader.parse(e.target.result);
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        mesh = new THREE.Mesh(geometry, material);

        // Store the original geometry for resetting
        originalGeometry = geometry.clone();

        scene.add(mesh);
        console.log("Mesh loaded:", mesh); // Debug log for successful load
      };
      reader.readAsArrayBuffer(file);
      console.log("FileReader started"); // Debug log
    }
  });

  const skewSlider = document.getElementById("skewSlider");
  skewSlider.addEventListener("input", (event) => {
    const value = event.target.value;
    applySkew(value);
    console.log("Slider input event:", value); // Debug log
  });

  const resetButton = document.getElementById("resetButton");
  resetButton.addEventListener("click", resetObject);

  const saveButton = document.getElementById("saveButton");
  saveButton.addEventListener("click", saveObject);

  const faceSelector = document.getElementById("faceSelector");
  faceSelector.addEventListener("change", () => {
    applySkew(document.getElementById("skewSlider").value);
    console.log("Face selector changed:", faceSelector.value); // Debug log
  });
}




function applySkew(value) {
  if (!mesh || !originalGeometry) return;

  // Reset the geometry to the original state before applying new transformations
  mesh.geometry = originalGeometry.clone();

  // Compute the bounding box of the geometry
  mesh.geometry.computeBoundingBox();
  const bbox = mesh.geometry.boundingBox;

  // Get the min and max for each axis
  const minX = bbox.min.x, maxX = bbox.max.x;
  const minY = bbox.min.y, maxY = bbox.max.y;
  const minZ = bbox.min.z, maxZ = bbox.max.z;
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());

  // Map slider value (0 to 200) to a very subtle alpha range
  const alpha = value <= 100
    ? 1 + (value - 100) / 50
    : 1 + (value - 100) / 25;

  // Determine the axis and direction for the transformation
  const face = document.getElementById("faceSelector").value;
  let axis, direction;
  switch (face) {
    case "top": axis = "y"; direction = maxY; break;
    case "bottom": axis = "y"; direction = minY; break;
    case "left": axis = "x"; direction = minX; break;
    case "right": axis = "x"; direction = maxX; break;
    case "front": axis = "z"; direction = maxZ; break;
    case "back": axis = "z"; direction = minZ; break;
  }

  // Access the position attribute of the geometry
  const positionAttribute = mesh.geometry.attributes.position;
  const vertex = new THREE.Vector3();

  // Iterate over all vertices
  for (let i = 0; i < positionAttribute.count; i++) {
    // Get the current vertex position
    vertex.fromBufferAttribute(positionAttribute, i);

    // Determine how far the vertex is along the selected axis
    const t = (vertex[axis] - direction) / size[axis];

    // Calculate the scale factor
    const scaleFactor = 1.0 + t * (alpha - 1.0);

    // Apply the scaling symmetrically around the center
    vertex.x = (vertex.x - center.x) * scaleFactor + center.x;
    vertex.y = (vertex.y - center.y) * scaleFactor + center.y;
    vertex.z = (vertex.z - center.z) * scaleFactor + center.z;

    // Update the vertex position
    positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  // Mark the geometry as updated
  positionAttribute.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}



function resetObject() {
  if (!mesh || !originalGeometry) return;

  // Restore the original geometry
  mesh.geometry = originalGeometry.clone();

  // Reset the slider to its neutral position
  const skewSlider = document.getElementById("skewSlider");
  skewSlider.value = 100;

  // Reapply the neutral transformation
  applySkew(100);
}


// Event listener for the reset button
document.getElementById("resetButton").addEventListener("click", resetObject);

function saveObject() {
  if (!mesh) {
    console.error("No mesh loaded. Cannot save.");
    alert("Please load an STL file before saving!");
    return;
  }

  if (!mesh.geometry) {
    console.error("Mesh has no geometry. Cannot save.");
    alert("Something went wrong. The mesh has no geometry to save.");
    return;
  }

  try {
    // Use STLExporter to export the mesh geometry only
    const exporter = new THREE.STLExporter();
    const stlString = exporter.parse(mesh); // Pass the `mesh`, not `scene`

    console.log("STL string generated:", stlString.length, "characters");

    // Create a Blob from the STL string
    const blob = new Blob([stlString], { type: "text/plain" });

    // Create a temporary download link
    const link = document.createElement("a");
    link.style.display = "none";
    document.body.appendChild(link);

    // Set the Blob URL and filename
    link.href = URL.createObjectURL(blob);
    link.download = `skewed_model_${Date.now()}.stl`;
    link.click();

    // Clean up the temporary link
    document.body.removeChild(link);
    console.log("STL file saved successfully.");
  } catch (error) {
    console.error("Error saving STL:", error);
    alert("An error occurred while saving the STL file. Check the console for details.");
  }
}






function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
