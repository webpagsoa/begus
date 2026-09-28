/**
 * Módulo Principal - Begus Web App
 * Arquitectura: Single Page Application (SPA) Vanilla JS + Firebase 10+ (Compat CDN)
 * Estándares: OWASP A03 (XSS), OWASP A07 (Auth) & Clean Code (Try-Catch-Finally)
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

// 2. Inicialización Segura de Servicios
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// Constantes de Integración
const ADMIN_EMAIL = "5493725401808@begus.internal";
const IMGBB_API_KEY = "3052862c887588cf31c3baec2a6eb3f0";

let esAdmin = false;

/**
 * Sanitización estricta para prevenir Inyección XSS (OWASP A03)
 */
function sanitizarHTML(cadena) {
    if (typeof cadena !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = cadena;
    return div.innerHTML;
}

/**
 * Control Centralizado del Spinner / Loader (Evita congelamientos en la UI)
 */
function alternarCargando(mostrar) {
    // Buscar cualquier loader existente por ID o Clase
    const loaders = document.querySelectorAll('#loading-overlay, #loader-catalogo, .loading-spinner, .spinner');
    loaders.forEach(loader => {
        loader.style.display = mostrar ? 'flex' : 'none';
    });

    // Si hay un contenedor de texto "Cargando catálogo...", ocultarlo/mostrarlo
    const textoCargando = Array.from(document.querySelectorAll('div, p')).find(el => el.textContent.includes('Cargando catálogo...'));
    if (textoCargando && !mostrar) {
        textoCargando.style.display = 'none';
    }
}

/**
 * Carga e Inyección del Catálogo desde Firestore (Con Manejo de Excepciones)
 */
async function cargarCatalogo() {
    alternarCargando(true);
    const contenedor = document.getElementById('catalogo-productos') || document.querySelector('.catalogo') || document.querySelector('main');

    try {
        const snapshot = await db.collection('productos').get();
        
        if (contenedor) {
            // No sobrescribir la estructura principal si es la raíz
            const grid = document.getElementById('grid-productos') || contenedor;
            grid.innerHTML = '';

            if (snapshot.empty) {
                grid.innerHTML = '<p class="estado-vacio" style="text-align:center; padding: 2rem;">No hay productos publicados en el catálogo.</p>';
            } else {
                snapshot.forEach(doc => {
                    const item = doc.data();
                    const tarjeta = document.createElement('article');
                    tarjeta.className = 'card-producto';
                    tarjeta.innerHTML = `
                        <div class="card-img-container">
                            <img src="${sanitizarHTML(item.imagenUrl)}" alt="${sanitizarHTML(item.nombre)}" loading="lazy" style="max-width:100%; height:auto;">
                        </div>
                        <div class="card-body">
                            <h3>${sanitizarHTML(item.nombre)}</h3>
                            <p class="precio">$${Number(item.precio || 0).toLocaleString('es-AR')}</p>
                        </div>
                    `;
                    grid.appendChild(tarjeta);
                });
            }
        }
    } catch (error) {
        console.error("[Begus Engine] Error crítico al obtener Firestore:", error);
        if (contenedor) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-banner';
            errorDiv.style.cssText = 'color: #ff4d4d; text-align: center; padding: 1rem;';
            errorDiv.innerHTML = `<p>⚠️ No se pudo conectar con el catálogo. Verifique su conexión.</p>`;
            contenedor.appendChild(errorDiv);
        }
    } finally {
        // GARANTÍA: El loader SIEMPRE se apaga sin importar si hubo éxito o error
        alternarCargando(false);
    }
}

/**
 * Gestión de Autenticación de Administrador
 */
async function solicitarAccesoAdmin() {
    if (esAdmin) {
        const panelAdmin = document.getElementById('panel-admin');
        panelAdmin?.classList.remove('hidden');
        return;
    }

    const claveIngresada = prompt("Ingrese la contraseña de administración:");
    if (!claveIngresada) return;

    try {
        alternarCargando(true);
        await auth.signInWithEmailAndPassword(ADMIN_EMAIL, claveIngresada.trim());
        alert("Autenticación exitosa.");
    } catch (error) {
        console.error("[Begus Auth Error]:", error.code, error.message);
        
        if (error.code === 'auth/operation-not-allowed') {
            alert("Error de Configuración: Debes habilitar 'Correo electrónico/Contraseña' en Firebase Console > Authentication > Sign-in method.");
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            alert("Credenciales inválidas. Verifique la contraseña ingresada.");
        } else {
            alert("Error al iniciar sesión: " + error.message);
        }
    } finally {
        alternarCargando(false);
    }
}

/**
 * Subida de fotos directamente desde la cámara/galería a ImgBB (Gratuito)
 */
async function subirFotoImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (result.success) {
        return result.data.url;
    } else {
        throw new Error("No se pudo subir la imagen al servidor externo.");
    }
}

/**
 * Escuchador de estado de Sesión Firebase
 */
auth.onAuthStateChanged((user) => {
    const btnAbrirAdmin = document.getElementById('btn-abrir-admin');
    const panelAdmin = document.getElementById('panel-admin');

    if (user && user.email === ADMIN_EMAIL) {
        esAdmin = true;
        if (btnAbrirAdmin) btnAbrirAdmin.textContent = "⚙️ Panel Admin";
        panelAdmin?.classList.remove('hidden');
    } else {
        esAdmin = false;
        if (btnAbrirAdmin) btnAbrirAdmin.textContent = "🔑 Iniciar Sesión";
        panelAdmin?.classList.add('hidden');
    }
});

/**
 * Inicialización Segura del DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Vincular eventos de forma defensiva (evita Runtime Exceptions que rompen el Header)
    const btnAbrirAdmin = document.getElementById('btn-abrir-admin');
    const btnCerrarAdmin = document.getElementById('btn-cerrar-admin');
    const panelAdmin = document.getElementById('panel-admin');
    const formProducto = document.getElementById('form-producto');

    btnAbrirAdmin?.addEventListener('click', solicitarAccesoAdmin);
    btnCerrarAdmin?.addEventListener('click', () => panelAdmin?.classList.add('hidden'));

    // 2. Evento del Formulario de Productos
    formProducto?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!esAdmin) {
            alert("Acceso denegado.");
            return;
        }

        const inputNombre = document.getElementById('input-nombre');
        const inputPrecio = document.getElementById('input-precio');
        const inputImagen = document.getElementById('input-imagen-file');

        const nombre = sanitizarHTML(inputNombre?.value.trim());
        const precio = parseFloat(inputPrecio?.value);
        const archivo = inputImagen?.files[0];

        if (!nombre || isNaN(precio) || !archivo) {
            alert("Por favor completa el nombre, precio y selecciona o toma una foto.");
            return;
        }

        try {
            alternarCargando(true);
            // 1. Subir imagen
            const urlImagen = await subirFotoImgBB(archivo);

            // 2. Guardar en Firestore
            await db.collection('productos').add({
                nombre: nombre,
                precio: precio,
                imagenUrl: urlImagen,
                creadoEn: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("¡Producto publicado correctamente!");
            formProducto.reset();
            panelAdmin?.classList.add('hidden');
            await cargarCatalogo(); // Recargar cuadrícula
        } catch (err) {
            console.error("Error al publicar:", err);
            alert("Error al guardar el producto: " + err.message);
        } finally {
            alternarCargando(false);
        }
    });

    // 3. Cargar catálogo inicial
    cargarCatalogo();
});
