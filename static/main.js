// Location data categories
const LOCATIONS = {
    "earth": [
        { name: "Warsaw", lat: 52.23, lon: 21.01, info: "Capital of Poland", category: "bases" }
    ],
    "mars": [
        { name: "Olympus Mons", lat: 18.65, lon: 226.2, info: "Largest volcano in the Solar System", category: "volcanoes" }
    ],
    "moon": [
        { name: "Sea of Tranquility", lat: 0.67, lon: 23.47, info: "Apollo 11 landing site", category: "missions" }
    ]
};

// Scene, Camera & Renderer setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Mouse controls with zoom limits
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.minDistance = 1.1;
controls.maxDistance = 10;
camera.position.z = 3;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(5, 3, 5);
scene.add(pointLight);

// Main Planet Sphere
// Main Planet: grupa, do której trafia model Ziemi (lub kula dla Marsa/Księżyca)
const textureLoader = new THREE.TextureLoader();
const planet = new THREE.Group();
scene.add(planet);

// Kalibracja modelu (w stopniach) - dobierzcie eksperymentalnie
const MODEL_ROTATION_Y = 0; // przesunięcie południka zerowego
const MODEL_ROTATION_X = 0; // jeśli model ma oś Z jako "górę", ustawcie -90
let earthModel = null;

// Kula zapasowa dla Marsa i Księżyca (na razie bez tekstury)
const fallbackSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshStandardMaterial()
);
fallbackSphere.visible = false;
planet.add(fallbackSphere);

new THREE.GLTFLoader().load(
    './static/models/earth.glb',
    (gltf) => {
        const model = gltf.scene;

        // wyśrodkowanie i przeskalowanie do promienia 1
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        const holder = new THREE.Group();
        holder.add(model);
        holder.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
        holder.rotation.x = THREE.MathUtils.degToRad(MODEL_ROTATION_X);
        holder.rotation.y = THREE.MathUtils.degToRad(MODEL_ROTATION_Y);

        planet.add(holder);
        earthModel = holder;
        earthModel.visible = (currentPlanet === 'earth');
    },
    undefined,
    (err) => console.error('Nie udało się wczytać modelu:', err)
);

// --- LATITUDE & LONGITUDE GRID OVERLAY ---
function createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;

    const stepsLat = 12;
    const stepsLon = 24;

    for (let i = 1; i < stepsLat; i++) {
        const y = (canvas.height / stepsLat) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    for (let i = 0; i < stepsLon; i++) {
        const x = (canvas.width / stepsLon) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

const gridGeometry = new THREE.SphereGeometry(1.003, 64, 64);
const gridMaterial = new THREE.MeshBasicMaterial({
    map: createGridTexture(),
    transparent: true,
    opacity: 0.8
});
const planetGrid = new THREE.Mesh(gridGeometry, gridMaterial);
planet.add(planetGrid);
let currentPlanet = 'earth';
// Function to switch planets
function changePlanet(planetName) {
    currentPlanet = planetName; // wcześniej brakowało tej linii

    if (earthModel) earthModel.visible = (planetName === 'earth');
    fallbackSphere.visible = (planetName !== 'earth');

    if (planetName !== 'earth') {
        fallbackSphere.material.map = textureLoader.load(`./static/textures/${planetName}.jpg`);
        fallbackSphere.material.needsUpdate = true;
    }

    savedPoints.forEach(point => {
        point.mesh.visible = (point.planet === planetName);
    });
    renderSavedPoints();
}
    
    const currentData = LOCATIONS[planetName] || [];
    console.log(`Loaded points for ${planetName}:`, currentData);
}

// Category selection handler from left sidebar
function selectCategory(categoryName) {
    console.log("Selected category:", categoryName);
}

// Rotation state variable
let isRotating = true;

function toggleRotation() {
    isRotating = !isRotating;
    const btn = document.getElementById('rotBtn');
    if (btn) {
        btn.textContent = isRotating ? "Pause Rotation" : "Resume Rotation";
    }
}

// --- PRECISE GEO-COORDINATES & SAVED POINTS LOGIC ---
const LONGITUDE_OFFSET = 0; 
let savedPoints = [];

function latLonToVector3(lat, lon, radius) {
    const adjustedLon = lon + LONGITUDE_OFFSET;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (adjustedLon + 180) * (Math.PI / 180); 

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
}

function vector3ToLatLon(vector) {
    const normalized = vector.clone().normalize();
    const lat = 90 - (Math.acos(normalized.y) * 180 / Math.PI);
    let lon = (Math.atan2(normalized.z, -normalized.x) * 180 / Math.PI) - 180;

    lon -= LONGITUDE_OFFSET;

    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;

    return { 
        lat: parseFloat(lat.toFixed(2)), 
        lon: parseFloat(lon.toFixed(2)) 
    };
}

function createMarkerMesh(lat, lon) {
    const markerGeometry = new THREE.SphereGeometry(0.015, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);

    const position = latLonToVector3(lat, lon, 1.005);
    markerMesh.position.copy(position);

    planet.add(markerMesh);
    return markerMesh;
}

// Raycasting: Click on the planet to place a point
// zamiast: const intersects = raycaster.intersectObject(planet);
const target = (currentPlanet === 'earth') ? earthModel : fallbackSphere;
if (!target) return;
const intersects = raycaster.intersectObject(target, true);
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    if (event.target.closest('#sidebar') || event.target.closest('#right-sidebar') || event.target.closest('#ui')) {
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(planet);

    if (intersects.length > 0) {
        const intersectPoint = intersects[0].point;
        planet.worldToLocal(intersectPoint);
        
        const coords = vector3ToLatLon(intersectPoint);

        const pointName = prompt(`Enter name for location (Lat: ${coords.lat}, Lon: ${coords.lon}):`, "My Point");
        if (!pointName) return;

        const markerMesh = createMarkerMesh(coords.lat, coords.lon);

        const newPoint = {
            id: Date.now(),
            name: pointName,
            lat: coords.lat,
            lon: coords.lon,
            planet: currentPlanet,
            mesh: markerMesh
        };

        savedPoints.push(newPoint);
        renderSavedPoints();
    }
});

// Add point manually via right sidebar form
function addNewPoint() {
    const nameInput = document.getElementById('pointName');
    const latInput = document.getElementById('pointLat');
    const lonInput = document.getElementById('pointLon');

    const name = nameInput.value.trim();
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);

    if (!name || isNaN(lat) || isNaN(lon)) {
        alert("Please fill in all fields with valid values!");
        return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        alert("Latitude must be between -90 and 90, Longitude between -180 and 180.");
        return;
    }

    const markerMesh = createMarkerMesh(lat, lon);

    const newPoint = {
        id: Date.now(),
        name: name,
        lat: lat,
        lon: lon,
        planet: currentPlanet,
        mesh: markerMesh
    };

    savedPoints.push(newPoint);
    renderSavedPoints();

    nameInput.value = '';
    latInput.value = '';
    lonInput.value = '';
}

// Delete saved point
function deletePoint(id) {
    const pointToDelete = savedPoints.find(point => point.id === id);
    
    if (pointToDelete && pointToDelete.mesh) {
        planet.remove(pointToDelete.mesh);
        pointToDelete.mesh.geometry.dispose();
        pointToDelete.mesh.material.dispose();
    }

    savedPoints = savedPoints.filter(point => point.id !== id);
    renderSavedPoints();
}

// Render HTML list in right sidebar
function renderSavedPoints() {
    const listContainer = document.getElementById('saved-points-list');
    listContainer.innerHTML = '';

    savedPoints
        .filter(point => point.planet === currentPlanet)
        .forEach(point => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span><strong>${point.name}</strong><br><small>Lat: ${point.lat}, Lon: ${point.lon}</small></span>
                <button class="delete-btn" onclick="deletePoint(${point.id})">Delete</button>
            `;
            listContainer.appendChild(li);
        });
}

// --- ANIMATION & RESIZE ---
function animate() {
    requestAnimationFrame(animate);
    
    if (isRotating) {
        planet.rotation.y += 0.001;
        planetGrid.rotation.y += 0.001;
    }
    
    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
