/**
 * Begus Web App - Catálogo con Firestore + ImgBB
 */

// 1. Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDnl23nvPG7hoMV0fE2NYJR7dWY-msEIcI",
    authDomain: "begus-4a593.firebaseapp.com",
    projectId: "begus-4a593",
    storageBucket: "begus-4a593.firebasestorage.app",
    messagingSenderId: "171755943273",
    appId: "1:171755943273:web:0a5fadb6978614eacaf9f8",
    measurementId: "G-EQ9JV2DCC2"
};

// 2. Inicialización de Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// Constantes
const ADMIN_EMAIL = "5493725401808@begus.internal";
const IMGBB_API_KEY = "8b1e7ee85535999790ddf28a341c8927"; // Nueva clave insertada
const WHATSAPP_NUMBER = "5493725401808";

let esAdmin = false;
let carrito = [];

// Sanitización contra XSS
function sanitizarHTML(cadena) {
    if (typeof cadena !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = cadena;
    return div.innerHTML;
}

// Control del Spinner de Carga
function alternarCargando(mostrar) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = mostrar ? 'flex' : 'none';
    }
}

// Cargar Catálogo desde Firestore
async function cargarCatalogo() {
    alternarCargando(true);
    const grid = document.getElementById('grid-productos');

    try {
        const snapshot = await db.collection('productos').get();
        if (!grid) return;

        grid.innerHTML = '';

        if (snapshot.empty) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 2rem;">No hay productos publicados en el catálogo.</p>';
        } else {
            snapshot.forEach(doc => {
                const item = doc.data();
                const tarjeta = document.createElement('article');
                tarjeta.className = 'product-card';
                
                let botonBorrar = esAdmin 
                    ? `<button class="btn-del" onclick="eliminarProducto('${doc.id}')" title="Eliminar">🗑️</button>` 
                    : '';

                tarjeta.innerHTML = `
                    <div style="position: relative;">
                        <img src="${sanitizarHTML(item.imagenUrl)}" alt="${sanitizarHTML(item.nombre)}" class="product-img" loading="lazy">
                        ${botonBorrar ? `<div class="admin-actions">${botonBorrar}</div>` : ''}
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${sanitizarHTML(item.nombre)}</h3>
                        <p class="product-price">$${Number(item.precio || 0).toLocaleString('es-AR')}</p>
                        <button class="btn-add-cart" onclick="agregarAlCarrito('${doc.id}', '${sanitizarHTML(item.nombre)}', ${item.precio})">🛒 Agregar al Carrito</button>
                    </div>
                `;
                grid.appendChild(tarjeta);
            });
        }
    } catch (error) {
        console.error("Error al cargar productos:", error);
        if (grid) {
            grid.innerHTML = `<p style="grid-column: 1/-1; color: #ff4d4d; text-align: center;">Error al cargar el catálogo: ${error.message}</p>`;
        }
    } finally {
        alternarCargando(false);
    }
}

// Autenticación de Administrador
async function solicitarAccesoAdmin() {
    if (esAdmin) {
        document.getElementById('panel-admin')?.classList.add('open');
        return;
    }

    const claveIngresada = prompt("Ingrese la contraseña de administración:");
    if (!claveIngresada) return;

    try {
        alternarCargando(true);
        await auth.signInWithEmailAndPassword(ADMIN_EMAIL, claveIngresada.trim());
        alert("Autenticación exitosa.");
    } catch (error) {
        console.error("Error Auth:", error);
        alert("Credenciales inválidas o error de conexión.");
    } finally {
        alternarCargando(false);
    }
}

// Subida Gratuita de Fotos a ImgBB con control de errores detallado
async function subirFotoImgBB(file) {
    // 1. Validar tamaño máximo (ImgBB acepta hasta 32 MB en API, pero limitamos a 10 MB por rendimiento)
    const maxMB = 10;
    if (file.size > maxMB * 1024 * 1024) {
        throw new Error(`La foto es muy pesada (${(file.size / (1024 * 1024)).toFixed(1)} MB). Intenta con una de menos de ${maxMB} MB.`);
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', IMGBB_API_KEY); // Añadimos la clave directamente al formulario

    try {
        // Hacemos el POST sin parámetros raros en la URL
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            return result.data.url;
        } else {
            const detalle = result.error?.message || "Respuesta rechazada por la API";
            throw new Error(`ImgBB rechazó la imagen: ${detalle}`);
        }
    } catch (err) {
        console.error("[ImgBB Upload Error]:", err);
        throw new Error(err.message || "Error de red al conectar con ImgBB.");
    }
}

// Eliminar producto
async function eliminarProducto(id) {
    if (!esAdmin) return;
    if (confirm("¿Seguro que deseas eliminar este producto?")) {
        try {
            alternarCargando(true);
            await db.collection('productos').doc(id).delete();
            await cargarCatalogo();
        } catch (err) {
            alert("Error al eliminar: " + err.message);
        } finally {
            alternarCargando(false);
        }
    }
}

// Lógica del Carrito
function agregarAlCarrito(id, nombre, precio) {
    const existe = carrito.find(item => item.id === id);
    if (existe) {
        existe.cantidad += 1;
    } else {
        carrito.push({ id, nombre, precio, cantidad: 1 });
    }
    actualizarCarritoUI();
}

function cambiarCantidad(id, cambio) {
    const item = carrito.find(i => i.id === id);
    if (!item) return;

    item.cantidad += cambio;
    if (item.cantidad <= 0) {
        carrito = carrito.filter(i => i.id !== id);
    }
    actualizarCarritoUI();
}

function actualizarCarritoUI() {
    const countEl = document.getElementById('cart-count');
    const itemsEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-price');

    const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    const totalPrecio = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    if (countEl) countEl.textContent = totalItems;
    if (totalEl) totalEl.textContent = totalPrecio.toLocaleString('es-AR');

    if (itemsEl) {
        itemsEl.innerHTML = '';
        if (carrito.length === 0) {
            itemsEl.innerHTML = '<p style="text-align:center; padding:1rem;">El carrito está vacío.</p>';
        } else {
            carrito.forEach(item => {
                const div = document.createElement('div');
                div.className = 'cart-item';
                div.innerHTML = `
                    <div>
                        <strong>${sanitizarHTML(item.nombre)}</strong>
                        <div>$${(item.precio * item.cantidad).toLocaleString('es-AR')}</div>
                    </div>
                    <div class="cart-item-controls">
                        <button class="btn-qty" onclick="cambiarCantidad('${item.id}', -1)">-</button>
                        <span>${item.cantidad}</span>
                        <button class="btn-qty" onclick="cambiarCantidad('${item.id}', 1)">+</button>
                    </div>
                `;
                itemsEl.appendChild(div);
            });
        }
    }
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        alert("El carrito está vacío.");
        return;
    }

    let mensaje = "Hola! Quisiera realizar el siguiente pedido:\n\n";
    let total = 0;

    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `• ${item.nombre} x${item.cantidad} - $${subtotal.toLocaleString('es-AR')}\n`;
    });

    mensaje += `\n*Total: $${total.toLocaleString('es-AR')}*`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// Estado de Sesión en Firebase
auth.onAuthStateChanged((user) => {
    const btnAbrirAdmin = document.getElementById('btn-abrir-admin');
    const panelAdmin = document.getElementById('panel-admin');

    if (user && user.email === ADMIN_EMAIL) {
        esAdmin = true;
        if (btnAbrirAdmin) btnAbrirAdmin.textContent = "⚙️ Panel Admin";
        panelAdmin?.classList.add('open');
    } else {
        esAdmin = false;
        if (btnAbrirAdmin) btnAbrirAdmin.textContent = "🔑 Admin";
        panelAdmin?.classList.remove('open');
    }
    cargarCatalogo();
});

// Inicialización de Eventos DOM
document.addEventListener('DOMContentLoaded', () => {
    const btnAbrirAdmin = document.getElementById('btn-abrir-admin');
    const btnCerrarAdmin = document.getElementById('btn-cerrar-admin');
    const panelAdmin = document.getElementById('panel-admin');
    const formProducto = document.getElementById('form-producto');
    const inputImagen = document.getElementById('input-imagen-file');
    const labelImagen = document.getElementById('label-imagen');

    const btnCarrito = document.getElementById('btn-carrito-flotante');
    const btnCerrarCarrito = document.getElementById('btn-cerrar-carrito');
    const modalCarrito = document.getElementById('modal-carrito');
    const btnEnviarWA = document.getElementById('btn-enviar-pedido-wa');
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

    btnAbrirAdmin?.addEventListener('click', solicitarAccesoAdmin);
    btnCerrarAdmin?.addEventListener('click', () => panelAdmin?.classList.remove('open'));

    btnCarrito?.addEventListener('click', () => modalCarrito?.classList.add('open'));
    btnCerrarCarrito?.addEventListener('click', () => modalCarrito?.classList.remove('open'));
    btnEnviarWA?.addEventListener('click', enviarPedidoWhatsApp);

    // Evento para cerrar la sesión de administrador
    btnCerrarSesion?.addEventListener('click', () => {
        auth.signOut().then(() => {
            alert("Sesión de administrador cerrada exitosamente.");
        }).catch((error) => {
            console.error("Error al cerrar sesión:", error);
        });
    });

    inputImagen?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && labelImagen) {
            labelImagen.textContent = `📷 ${file.name}`;
        }
    });

    formProducto?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!esAdmin) {
            alert("Debes iniciar sesión como administrador.");
            return;
        }

        const inputNombre = document.getElementById('input-nombre');
        const inputPrecio = document.getElementById('input-precio');

        const nombre = inputNombre?.value.trim();
        const precio = parseFloat(inputPrecio?.value);
        const archivo = inputImagen?.files[0];

        if (!nombre || isNaN(precio) || !archivo) {
            alert("Por favor completa el nombre, el precio y selecciona una imagen.");
            return;
        }

        try {
            alternarCargando(true);
            const urlImagen = await subirFotoImgBB(archivo);

            await db.collection('productos').add({
                nombre: nombre,
                precio: precio,
                imagenUrl: urlImagen,
                creadoEn: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("¡Producto publicado correctamente!");
            formProducto.reset();
            if (labelImagen) labelImagen.textContent = "📸 Seleccionar foto";
            panelAdmin?.classList.remove('open');
            await cargarCatalogo();
        } catch (err) {
            console.error("Error al publicar:", err);
            alert("Error al guardar el producto: " + err.message);
        } finally {
            alternarCargando(false);
        }
    });
});
