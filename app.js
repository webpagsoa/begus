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
const IMGBB_API_KEY = "8b1e7ee85535999790ddf28a341c8927"; 
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

// Subida Gratuita de Fotos a ImgBB
async function subirFotoImgBB(file) {
    const maxMB = 10;
    if (file.size > maxMB * 1024 * 1024) {
        throw new Error(`La foto es muy pesada. Intenta con una de menos de ${maxMB} MB.`);
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', IMGBB_API_KEY); 

    try {
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            return result.data.url;
        } else {
            throw new Error(result.error?.message || "Respuesta rechazada por la API");
        }
    } catch (err) {
        console.error("[ImgBB Upload Error]:", err);
        throw new Error(err.message || "Error de red al conectar con ImgBB.");
    }
}

// Cargar Catálogo desde Firestore
async function cargarCatalogo() {
    alternarCargando(true);
    const grid = document.getElementById('grid-productos');

    try {
        const snapshot = await db.collection('productos').orderBy('creadoEn', 'desc').get();
        if (!grid) return;

        grid.innerHTML = '';

        if (snapshot.empty) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 2rem;">No hay productos publicados.</p>';
        } else {
            snapshot.forEach(doc => {
                const item = doc.data();
                const tarjeta = document.createElement('article');
                tarjeta.className = 'product-card';
                
                // Botonera de administrador (Estilo de capsula blanca arriba a la derecha)
                let botoneraAdmin = esAdmin 
                    ? `<div class="admin-actions" style="position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.9); padding: 5px 10px; border-radius: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: flex; gap: 10px;">
                            <button onclick="compartirProducto('${sanitizarHTML(item.nombre)}', ${item.precio}, '${sanitizarHTML(item.imagenUrl)}')" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Compartir en Redes">🔗</button>
                            <button onclick="abrirModalEditar('${doc.id}', '${sanitizarHTML(item.nombre)}', ${item.precio}, '${sanitizarHTML(item.imagenUrl)}')" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Editar">✏️</button>
                            <button onclick="eliminarProducto('${doc.id}')" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Eliminar">🗑️</button>
                       </div>` 
                    : '';

                tarjeta.innerHTML = `
                    <div style="position: relative;">
                        <img src="${sanitizarHTML(item.imagenUrl)}" alt="${sanitizarHTML(item.nombre)}" class="product-img" loading="lazy">
                        ${botoneraAdmin}
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
    } finally {
        alternarCargando(false);
    }
}

// -------------------------------------------------------------
// FUNCIONES DE ADMINISTRACIÓN: COMPARTIR, EDITAR Y ELIMINAR
// -------------------------------------------------------------

// Función Mágica para Compartir en Estados, Grupos, Historias o WhatsApp
async function compartirProducto(nombre, precio, imagenUrl) {
    const urlCatalogo = window.location.href.split('#')[0]; 
    const textoConsulta = `Hola! Quiero consultar por: ${nombre}`;
    const linkWhatsApp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(textoConsulta)}`;
    
    // El texto que acompañará la publicación
    const textoFijo = `¡Mirá este producto en Begus!\n\n🛍️ ${nombre}\n💰 $${precio.toLocaleString('es-AR')}\n\n📲 Consultá acá: ${linkWhatsApp}\n🌐 Catálogo: ${urlCatalogo}`;

    if (navigator.share) {
        try {
            // Intentamos descargar la imagen para que se adjunte visualmente en Estados de WA o IG
            const response = await fetch(imagenUrl);
            const blob = await response.blob();
            const file = new File([blob], 'producto.jpg', { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Begus - ' + nombre,
                    text: textoFijo,
                    files: [file]
                });
                return;
            }
        } catch (err) {
            console.warn("CORS evitó descargar la imagen. Compartiendo enlace...");
        }

        // Si falla la descarga visual, igual abre las redes pero manda el link de la foto
        try {
            await navigator.share({
                title: 'Begus - ' + nombre,
                text: textoFijo + `\n🖼️ Imagen: ${imagenUrl}`
            });
        } catch (e) {
            console.log("Se canceló compartir");
        }
    } else {
        // En PC copia todo al portapapeles
        navigator.clipboard.writeText(textoFijo + `\n🖼️ Imagen: ${imagenUrl}`);
        alert("Texto y enlaces copiados al portapapeles. Pégalos en tu Muro o WhatsApp Web.");
    }
}

// Preparar y abrir el modal de Edición
function abrirModalEditar(id, nombre, precio, imagenUrl) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-input-nombre').value = nombre;
    document.getElementById('edit-input-precio').value = precio;
    document.getElementById('edit-imagen-actual').value = imagenUrl;
    document.getElementById('edit-preview-img').src = imagenUrl;
    
    document.getElementById('edit-label-imagen').textContent = "📸 Cambiar foto (opcional)";
    document.getElementById('edit-input-imagen').value = ""; // Limpiar el input file
    
    document.getElementById('modal-editar').classList.add('open');
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

// -------------------------------------------------------------
// LÓGICA DEL CARRITO Y AUTH (Mantenida igual)
// -------------------------------------------------------------

function agregarAlCarrito(id, nombre, precio) {
    const existe = carrito.find(item => item.id === id);
    if (existe) existe.cantidad += 1;
    else carrito.push({ id, nombre, precio, cantidad: 1 });
    actualizarCarritoUI();
}

function cambiarCantidad(id, cambio) {
    const item = carrito.find(i => i.id === id);
    if (!item) return;
    item.cantidad += cambio;
    if (item.cantidad <= 0) carrito = carrito.filter(i => i.id !== id);
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
    if (carrito.length === 0) return alert("El carrito está vacío.");
    let mensaje = "Hola! Quisiera realizar el siguiente pedido:\n\n";
    let total = 0;
    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `• ${item.nombre} x${item.cantidad} - $${subtotal.toLocaleString('es-AR')}\n`;
    });
    mensaje += `\n*Total: $${total.toLocaleString('es-AR')}*`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

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
        alert("Credenciales inválidas.");
    } finally {
        alternarCargando(false);
    }
}

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
    document.getElementById('btn-abrir-admin')?.addEventListener('click', solicitarAccesoAdmin);
    document.getElementById('btn-cerrar-admin')?.addEventListener('click', () => document.getElementById('panel-admin').classList.remove('open'));
    document.getElementById('btn-carrito-flotante')?.addEventListener('click', () => document.getElementById('modal-carrito').classList.add('open'));
    document.getElementById('btn-cerrar-carrito')?.addEventListener('click', () => document.getElementById('modal-carrito').classList.remove('open'));
    document.getElementById('btn-enviar-pedido-wa')?.addEventListener('click', enviarPedidoWhatsApp);
    
    // Cierre del modal de edición
    document.getElementById('btn-cerrar-editar')?.addEventListener('click', () => document.getElementById('modal-editar').classList.remove('open'));

    document.getElementById('btn-cerrar-sesion')?.addEventListener('click', () => {
        auth.signOut().then(() => alert("Sesión cerrada."));
    });

    // Etiquetas de fotos (Nuevo producto)
    const inputImagen = document.getElementById('input-imagen-file');
    const labelImagen = document.getElementById('label-imagen');
    inputImagen?.addEventListener('change', (e) => {
        if (e.target.files[0] && labelImagen) labelImagen.textContent = `📷 ${e.target.files[0].name}`;
    });

    // Etiquetas de fotos (Editar producto)
    const editInputImagen = document.getElementById('edit-input-imagen');
    const editLabelImagen = document.getElementById('edit-label-imagen');
    editInputImagen?.addEventListener('change', (e) => {
        if (e.target.files[0] && editLabelImagen) editLabelImagen.textContent = `📷 ${e.target.files[0].name}`;
    });

    // Formulario de Agregar
    document.getElementById('form-producto')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!esAdmin) return alert("Debes iniciar sesión.");
        
        const nombre = document.getElementById('input-nombre').value.trim();
        const precio = parseFloat(document.getElementById('input-precio').value);
        const archivo = document.getElementById('input-imagen-file').files[0];

        if (!nombre || isNaN(precio) || !archivo) return alert("Completa todos los campos.");

        try {
            alternarCargando(true);
            const urlImagen = await subirFotoImgBB(archivo);
            await db.collection('productos').add({
                nombre: nombre,
                precio: precio,
                imagenUrl: urlImagen,
                creadoEn: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("¡Producto publicado!");
            e.target.reset();
            if (labelImagen) labelImagen.textContent = "📸 Seleccionar foto";
            document.getElementById('panel-admin').classList.remove('open');
            await cargarCatalogo();
        } catch (err) {
            alert("Error al guardar: " + err.message);
        } finally {
            alternarCargando(false);
        }
    });

    // Formulario de Editar
    document.getElementById('form-editar-producto')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!esAdmin) return;
        
        const id = document.getElementById('edit-id').value;
        const nombre = document.getElementById('edit-input-nombre').value.trim();
        const precio = parseFloat(document.getElementById('edit-input-precio').value);
        const archivo = document.getElementById('edit-input-imagen').files[0];
        const imagenActual = document.getElementById('edit-imagen-actual').value;

        try {
            alternarCargando(true);
            let urlImagen = imagenActual;

            // Si seleccionó una foto nueva, la sube a ImgBB reemplazando la vieja
            if (archivo) {
                urlImagen = await subirFotoImgBB(archivo);
            }

            // Actualiza en base de datos
            await db.collection('productos').doc(id).update({
                nombre: nombre,
                precio: precio,
                imagenUrl: urlImagen
            });

            alert("¡Producto actualizado!");
            document.getElementById('modal-editar').classList.remove('open');
            await cargarCatalogo();
        } catch (err) {
            alert("Error al editar: " + err.message);
        } finally {
            alternarCargando(false);
        }
    });
});
