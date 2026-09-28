/**
 * Módulo de Control de Administración y Catálogo - Begus Web App
 * Cumplimiento: OWASP A01, A03, A07 (Security by Design)
 * Sin dependencias de pago / 100% Free Tier (GitHub Pages + Firebase Auth + Firestore)
 */

// 1. Configuración Pública de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDnl23nvPG7hoMV0fE2NYJR7dWY-msEIcI",
    authDomain: "begus-4a593.firebaseapp.com",
    projectId: "begus-4a593",
    storageBucket: "begus-4a593.firebasestorage.app",
    messagingSenderId: "171755943273",
    appId: "1:171755943273:web:0a5fadb6978614eacaf9f8",
    measurementId: "G-EQ9JV2DCC2"
};

// Inicialización de Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Identificador del Admin en Firebase Auth
const ADMIN_EMAIL = "5493725401808@begus.internal";

// API Key de ImgBB para cargas directas desde el navegador (Gratuito)
const IMGBB_API_KEY = "3052862c887588cf31c3baec2a6eb3f0";

let esAdmin = false;

// Referencias al DOM
const btnAbrirAdmin = document.getElementById('btn-abrir-admin');
const btnCerrarAdmin = document.getElementById('btn-cerrar-admin');
const panelAdmin = document.getElementById('panel-admin');
const formProducto = document.getElementById('form-producto');

/**
 * Prevención de inyecciones XSS sanitizando entradas en el cliente (OWASP A03)
 */
function sanitizarHTML(cadena) {
    const div = document.createElement('div');
    div.textContent = cadena;
    return div.innerHTML;
}

/**
 * Escuchador de estado de sesión oficial de Firebase Auth (OWASP A07)
 */
auth.onAuthStateChanged((user) => {
    if (user && user.email === ADMIN_EMAIL) {
        esAdmin = true;
        if (btnAbrirAdmin) btnAbrirAdmin.textContent = "⚙️ Admin Activo";
        panelAdmin?.classList.remove('hidden');
    } else {
        esAdmin = false;
        if (btnAbrirAdmin) btnAbrirAdmin.textContent = "🔑 Iniciar Sesión";
        panelAdmin?.classList.add('hidden');
    }
});

/**
 * Autenticación segura mediante el backend oficial de Firebase
 */
async function gestionarAccesoAdmin() {
    if (esAdmin) {
        panelAdmin?.classList.remove('hidden');
        return;
    }

    const passwordIngresada = prompt("Ingrese la contraseña de administración:");
    if (!passwordIngresada) return;

    try {
        // Autenticación oficial contra Firebase Auth usando la cuenta registrada
        await auth.signInWithEmailAndPassword(ADMIN_EMAIL, passwordIngresada);
        alert("Acceso concedido.");
    } catch (error) {
        console.error("Error de autenticación:", error.message);
        alert("Contraseña incorrecta o acceso no autorizado.");
    }
}

/**
 * Subida directa de imagen a ImgBB mediante FormData (Conserva flujo original sin Storage)
 */
async function subirImagenImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    if (data.success) {
        return data.data.url;
    } else {
        throw new Error("Error al subir la imagen a ImgBB");
    }
}

/**
 * Manejo del formulario para guardar un nuevo producto en Firestore DB
 */
formProducto?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!esAdmin) {
        alert("Operación no permitida. Debe iniciar sesión como administrador.");
        return;
    }

    const inputNombre = document.getElementById('input-nombre');
    const inputPrecio = document.getElementById('input-precio');
    const inputImagen = document.getElementById('input-imagen-file'); // <input type="file" capture="environment">

    const nombreLimpio = sanitizarHTML(inputNombre.value.trim());
    const precio = parseFloat(inputPrecio.value);
    const archivoImagen = inputImagen?.files[0];

    if (!nombreLimpio || isNaN(precio) || !archivoImagen) {
        alert("Por favor completa los campos y captura/selecciona una imagen.");
        return;
    }

    try {
        // 1. Subida directa de la captura desde la cámara/dispositivo a ImgBB
        const urlImagen = await subirImagenImgBB(archivoImagen);

        // 2. Registro del documento en la base de datos Firestore
        await db.collection('productos').add({
            nombre: nombreLimpio,
            precio: precio,
            imagenUrl: urlImagen,
            creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Producto publicado exitosamente.");
        formProducto.reset();
        panelAdmin?.classList.add('hidden');
    } catch (error) {
        console.error("Error en la publicación:", error);
        alert("Error al procesar la publicación.");
    }
});

// Asignación de eventos de interfaz
btnAbrirAdmin?.addEventListener('click', gestionarAccesoAdmin);
btnCerrarAdmin?.addEventListener('click', () => panelAdmin?.classList.add('hidden'));
