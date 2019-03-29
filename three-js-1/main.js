const enableShadow = true;
const lightType = 'pointLight'; // pointLight | spotLight | directionalLight | ambientLight | rectAreaLight
const enableFog = true;
const fogColor = 'white';
const objectType = 'grid'; // box | grid
const gridChildType = 'box'; // box | sphere
const objectAndPlaneColor = '#424242';
const lightsColor = 'white';
const randomGridBoxAnimations = true;
const backgroundColor = 'white';
const useNoise = false; // otherwise use sin
const shadowMapSize = 1024;
const planSize = 200;
const cameraType = 'perspective'; // perspective | orthographic
const useAnimationRig = false;
const useRayCasting = false;

function init() {

    /**
     *
     * @type {Clock}
     */
    var clock = new THREE.Clock();

    /**
     * scene is the space that we going to add items in it
     * @type {Scene}
     */
    var scene = new THREE.Scene();
    if (enableFog) {
        scene.fog = new THREE.FogExp2(fogColor, 0.09);
    }

    /**
     * creates gui to control some variables inside this class
     * @type {dat.GUI}
     */
    var gui = new dat.GUI();

    /**
     * an object
     * @type {Raycaster.params.Mesh|Mesh}
     */
    var sphere = getSphere(0.05, lightsColor);

    /**
     * light
     * @type {PointLight}
     */
    var pointLight = getPointLight(1);
    pointLight.position.y = 2;
    pointLight.add(sphere);
    pointLight.intensity = 2;


    /**
     * spotLight
     * @type {SpotLight}
     */
    var spotLight = getSpotLight(1);
    spotLight.position.y = 2;
    spotLight.add(sphere);
    spotLight.intensity = 2;

    /**
     * directionalLight
     * @type {DirectionalLight}
     */
    var directionalLight = getDirectionalLight(1);
    directionalLight.position.y = 2;
    directionalLight.add(sphere);
    directionalLight.intensity = 2;

    /**
     * ambientLight
     * @type {AmbientLight}
     */
    var ambientLight = getAmbientLight(0.001);
    ambientLight.position.y = 2;
    ambientLight.add(sphere);
    ambientLight.intensity = 2;

    /**
     * rectAreaLight
     * @type {RectAreaLight}
     */
    var rectAreaLight = getRectAreaLight(1, 10);
    rectAreaLight.position.y = 2;
    rectAreaLight.add(sphere);
    rectAreaLight.intensity = 2;


    /**
     * adds items to slider for controlling
     */
    gui.add(pointLight, 'intensity', 0, 10);
    if (lightType === 'pointLight') {
        gui.add(pointLight.position, 'z', 0, 5);
        gui.add(pointLight.position, 'y', 0, 5);
        gui.add(pointLight.position, 'x', 0, 5);
    } else if (lightType === 'spotLight') {
        gui.add(spotLight.position, 'z', 0, 20);
        gui.add(spotLight.position, 'y', 0, 20);
        gui.add(spotLight.position, 'x', 0, 20);
        gui.add(spotLight, 'penumbra', 0, 5);
    } else if (lightType === 'directionalLight') {
        gui.add(directionalLight.position, 'z', 0, 5);
        gui.add(directionalLight.position, 'y', 0, 5);
        gui.add(directionalLight.position, 'x', 0, 5);
    } else if (lightType === 'ambientLight') {
        gui.add(ambientLight.position, 'z', 0, 5);
        gui.add(ambientLight.position, 'y', 0, 5);
        gui.add(ambientLight.position, 'x', 0, 5);
    } else if (lightType === 'rectAreaLight') {
        gui.add(rectAreaLight.position, 'z', 0, 5);
        gui.add(rectAreaLight.position, 'y', 0, 5);
        gui.add(rectAreaLight.position, 'x', 0, 5);
    }


    /**
     * an object
     * @type {Raycaster.params.Mesh|Mesh}
     */
    var box = getBox(1, 1, 1);
    box.position.y = box.geometry.parameters.height / 2;


    /**
     * a grid of box objects
     * @type {Group}
     */
    var grid = getObjGrid(6, 2);
    grid.name = 'grid';

    /**
     * an object
     * @type {Raycaster.params.Mesh|Mesh}
     */
    var plane = getPlane(planSize);
    plane.name = 'plane-1';
    plane.rotation.x = Math.PI / 2;
    if (enableShadow) {
        box.receiveShadow = true;
    }
    // plane.add(box); we can also add the box inside the plane

    scene.add(plane);
    if (objectType === 'box') {
        scene.add(box);
    } else if (objectType === 'grid') {
        scene.add(grid);
    }

    if (lightType === 'pointLight') {
        scene.add(pointLight);
    } else if (lightType === 'spotLight') {
        scene.add(spotLight);
    } else if (lightType === 'directionalLight') {
        scene.add(directionalLight);
    } else if (lightType === 'ambientLight') {
        scene.add(ambientLight);
    } else if (lightType === 'rectAreaLight') {
        scene.add(rectAreaLight);
    }

    /**
     * camera is the view port that we can see whats happening in the scene
     * @type {PerspectiveCamera}
     */
    var camera;
    if (cameraType === 'perspective') {
        camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            1,
            1000
        );
    } else if (cameraType === 'orthographic') {
        camera = new THREE.OrthographicCamera(
            -15,
            15,
            15,
            -15,
            1,
            1000
        );
    }

    var cameraZPosition;
    var cameraYRotation;
    var cameraXRotation;

    if (useAnimationRig) {
        cameraYPosition = new THREE.Group();
        cameraZPosition = new THREE.Group();
        cameraYRotation = new THREE.Group();
        cameraXRotation = new THREE.Group();

        cameraYPosition.name = 'cameraYPosition';
        cameraZPosition.name = 'cameraZPosition';
        cameraYRotation.name = 'cameraYRotation';
        cameraXRotation.name = 'cameraXRotation';

        cameraYPosition.add(camera);
        cameraZPosition.add(cameraYPosition);
        cameraXRotation.add(cameraZPosition);
        cameraYRotation.add(cameraXRotation);

        cameraZPosition.position.y = 1;
        cameraZPosition.position.z = 13;
        cameraYRotation.rotation.y = -1;
        cameraXRotation.rotation.x = -0.5;

        scene.add(cameraYRotation);

        gui.add(cameraYPosition.position, 'y', 0, 100);
        gui.add(cameraZPosition.position, 'z', 0, 100);
        gui.add(cameraYRotation.rotation, 'y', -Math.PI, Math.PI);
        gui.add(cameraXRotation.rotation, 'x', -Math.PI, Math.PI);
    } else {
        camera.position.x = 6;
        camera.position.y = 6;
        camera.position.z = 13;
        camera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    /**
     * connects the scene and camera together
     * @type {WebGLRenderer}
     */
    var renderer = new THREE.WebGLRenderer();
    if (enableShadow) {
        renderer.shadowMap.enabled = true;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(backgroundColor);


    var raycaster = new THREE.Raycaster();

    var mouse = new THREE.Vector2();

    /**
     * appends renderer to html element
     */
    document.getElementById('webgl').appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);

    update(renderer, scene, camera, controls, clock, mouse, raycaster);

    return scene;
}

/**
 * renders a box object
 * @param w
 * @param h
 * @param d
 * @returns {Raycaster.params.Mesh|Mesh}
 */
function getBox(w, h, d) {
    var geometry = new THREE.BoxGeometry(w, h, d);

    var material = new THREE.MeshPhongMaterial({
        color: objectAndPlaneColor
    });

    var mesh = new THREE.Mesh(
        geometry,
        material
    );
    if (enableShadow) {
        mesh.castShadow = true;
    }
    return mesh;
}

/**
 * creates a grid of boxes
 * @param amount
 * @param separationMultiplier
 */
function getObjGrid(amount, separationMultiplier) {
    var group = new THREE.Group();

    for (var i = 0; i < amount; i++) {
        var obj;
        if (gridChildType === 'sphere') {
            obj = getSphere(1, objectAndPlaneColor);
        } else if (gridChildType === 'box') {
            obj = getBox(1, 1, 1);
        }
        obj.position.x = i * separationMultiplier;
        obj.position.y = obj.geometry.parameters.height / 2;
        obj.name = 'i' + i;
        group.add(obj);
        for (var j = 1; j < amount; j++) {
            var obj;
            if (gridChildType === 'sphere') {
                obj = getSphere(1, objectAndPlaneColor);
            } else if (gridChildType === 'box') {
                obj = getBox(1, 1, 1);
            }
            obj.position.x = i * separationMultiplier;
            obj.position.y = obj.geometry.parameters.height / 2;
            obj.position.z = j * separationMultiplier;
            obj.name = 'j' + j;
            group.add(obj)
        }
    }
    group.position.x = -(separationMultiplier * (amount - 1)) / 2;
    group.position.z = -(separationMultiplier * (amount - 1)) / 2;
    return group;

}

/**
 * renders a box object
 * @param w
 * @param h
 * @param d
 * @returns {Raycaster.params.Mesh|Mesh}
 */
function getSphere(size, color = objectAndPlaneColor) {
    var geometry = new THREE.SphereGeometry(size, 24, 24);

    var material = new THREE.MeshBasicMaterial({
        color: color
    });

    var mesh = new THREE.Mesh(
        geometry,
        material
    );

    return mesh;
}

/**
 * renders a plane object
 * @param size
 * @returns {Raycaster.params.Mesh|Mesh}
 */
function getPlane(size) {
    var geometry = new THREE.PlaneGeometry(size, size);

    var material = new THREE.MeshPhongMaterial({
        color: objectAndPlaneColor,
        side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(
        geometry,
        material
    );

    if (enableShadow) {
        mesh.receiveShadow = true;
    }

    return mesh;
}

/**
 * renders a point light
 * @param intensity
 * @returns {PointLight}
 */
function getPointLight(intensity) {
    var light = new THREE.PointLight(lightsColor, intensity)

    if (enableShadow) {
        light.castShadow = true;
        light.shadow.bias = 0.001;
        light.shadow.mapSize.width = shadowMapSize;
        light.shadow.mapSize.height = shadowMapSize;
    }
    return light;
}

/**
 * renders a spotlight
 * @param intensity
 * @returns {SpotLight}
 */
function getSpotLight(intensity) {
    var light = new THREE.SpotLight(lightsColor, intensity)

    if (enableShadow) {
        light.castShadow = true;
        light.shadow.bias = 0.001;
        light.shadow.mapSize.width = shadowMapSize;
        light.shadow.mapSize.height = shadowMapSize;
    }
    return light;
}

/**
 * returns a directional light
 * @param intensity
 * @param shadowResolution
 * @returns {DirectionalLight}
 */
function getDirectionalLight(intensity) {
    var light = new THREE.DirectionalLight(lightsColor, intensity);

    if (enableShadow) {
        light.castShadow = true;
        light.shadow.bias = 0.001;
        light.shadow.mapSize.width = shadowMapSize;
        light.shadow.mapSize.height = shadowMapSize;
    }
    return light;
}

/**
 * returns an ambient light
 * @param intensity
 * @returns {AmbientLight}
 */
function getAmbientLight(intensity) {
    var light = new THREE.AmbientLight(lightsColor, intensity);

    if (enableShadow) {
        light.castShadow = true;
    }
    return light;
}

/**
 *
 * @param intensity
 * @param size
 * @returns {RectAreaLight}
 */
function getRectAreaLight(intensity, size) {
    var light = new THREE.RectAreaLight(lightsColor, intensity, size, size);

    if (enableShadow) {
        light.castShadow = true;
    }
    light.lookAt(0, 0, 0);

    return light;
}


/**
 * this function recursively renders 60fps scene so after defining the scene and camera we must call this function
 * so this function called 60 times/sec
 * @param renderer
 * @param scene
 * @param camera
 * @param controls
 */
function update(renderer, scene, camera, controls, clock, mouse, raycaster) {
    renderer.render(
        scene,
        camera
    );

    var timeElapsed = clock.getElapsedTime();

    var grid = scene.getObjectByName('grid');

    raycaster.setFromCamera(mouse, camera);

    changeGridChildsSize(grid, timeElapsed, 1, raycaster);


    if (useAnimationRig) {
        var cameraYPosition = scene.getObjectByName('cameraYPosition');
        var cameraZPosition = scene.getObjectByName('cameraZPosition');
        var cameraXRotation = scene.getObjectByName('cameraXRotation');
        var cameraYRotation = scene.getObjectByName('cameraYRotation');


            cameraYRotation.rotation.y -= 0.01;

    }

    controls.update();

    requestAnimationFrame(function () {
        update(renderer, scene, camera, controls, clock, mouse, raycaster);
    })
}

/**
 *
 * @param Grid
 * @param timeElapsed
 * @param multiPlier
 */
function changeGridChildsSize(Grid, timeElapsed, multiPlier, rayCaster) {
    var intersects = rayCaster.intersectObjects(Grid.children);

    Grid.children.forEach(function (child, index) {
        // intersects[ index ].object.translateY(1);
        if (intersects[0] && useRayCasting) {
            if (intersects[0].object.name !== child.name) {
                var x = randomGridBoxAnimations ? timeElapsed + index : timeElapsed * multiPlier;
                child.scale.y = Math.abs(useNoise ? noise.simplex2(x, x) + 0.001 : Math.sin(x));
                if (gridChildType === 'sphere') {
                    child.scale.x = Math.abs(useNoise ? noise.simplex2(x, x) + 0.001 : Math.sin(x));
                    child.scale.z = Math.abs(useNoise ? noise.simplex2(x, x) + 0.001 : Math.sin(x));
                }
                child.position.y = child.scale.y / 2;
            }
        } else {
            var x = randomGridBoxAnimations ? timeElapsed + index : timeElapsed * multiPlier;
            child.scale.y = Math.abs(useNoise ? noise.simplex2(x, x) + 0.001 : Math.sin(x));
            if (gridChildType === 'sphere') {
                child.scale.x = Math.abs(useNoise ? noise.simplex2(x, x) + 0.001 : Math.sin(x));
                child.scale.z = Math.abs(useNoise ? noise.simplex2(x, x) + 0.001 : Math.sin(x));
            }
            child.position.y = child.scale.y / 2;
        }
    });
}

/**
 * rotates plane by giving the speed value
 * @param plane
 * @param speed
 */
function rotatePlane(plane, speed) {
    plane.rotation.y += speed;
    plane.rotation.z += speed;

}

var scene = init();
