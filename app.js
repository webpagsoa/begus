const firebaseConfig = {
    apiKey: "AIzaSyDnl23nvPG7hoMV0fE2NYJR7dWY-msEIcI",
    authDomain: "begus-4a593.firebaseapp.com",
    projectId: "begus-4a593",
    storageBucket: "begus-4a593.firebasestorage.app",
    messagingSenderId: "171755943273",
    appId: "1:171755943273:web:0a5fadb6978614eaeaf9f8",
    measurementId: "G-EQ9JV2DCC2"
};
const IMGBB_API_KEY = "3052862c887588cf31e3baec2a6eb3f0";
const TELEFONO_WHATSAPP = "5493725401808";
const CLAVE_ADMIN = "begus2712";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let esAdmin = false;
let productoEditandoId = null;
let carrito = [];

// DOM Elements
const btnAbrirAdmin = document.getElementById('btn-abrir-admin');
const btnCerrarAdmin = document.getElementById('btn-cerrar-admin');
const panelAdmin = document.getElementById('panel-admin');
const btnAgregar = document.getElementById('btn-agregar-producto');
const inputImagen = document.getElementById('img-file');
const inputTitulo = document.getElementById('input-titulo');
const inputPrecio = document.getElementById('input-precio');
const labelImagen = document.querySelector('.file-upload-label');
const gridProductos = document.getElementById('grid-productos');
const loadingSpinner = document.getElementById('loading-spinner');

// Carrito Elements
const btnCarritoFlotante = document.getElementById('btn-carrito-flotante');
const modalCarrito = document.getElementById('modal-carrito');
const btnCerrarCarrito = document.getElementById('btn-cerrar-carrito');
const cartItemsContainer = document.getElementById('cart-items');
const cartCountSpan = document.getElementById('cart-count');
const cartTotalPriceSpan = document.getElementById('cart-total-price');
const btnEnviarPedidoWA = document.getElementById('btn-enviar-pedido-wa');

// GESTIÓN ADMIN
btnAbrirAdmin.addEventListener('click', () => {
    if (!esAdmin) {
        const password = prompt("Ingrese la contraseña de administrador:");
        if (password === CLAVE_ADMIN) {
            esAdmin = true;
            btnAbrirAdmin.innerText = "⚙️ Panel";
            panelAdmin.classList.add('open');
            cargarProductos();
        } else if (password !== null) {
            alert("Contraseña incorrecta.");
        }
    } else {
        panelAdmin.classList.add('open');
    }
});

btnCerrarAdmin.addEventListener('click', () => {
    panelAdmin.classList.remove('open');
    resetearFormulario();
});

inputImagen.addEventListener('change', () => {
    if(inputImagen.files.length > 0) labelImagen.innerText = "✅ Foto seleccionada";
});

// ALTA Y EDICION
btnAgregar.addEventListener('click', async () => {
    const archivo = inputImagen.files[0];
    const titulo = inputTitulo.value.trim();
    const precio = inputPrecio.value.trim();

    if (!titulo || !precio) {
        alert("Completa el título y el precio.");
        return;
    }

    btnAgregar.innerText = "Procesando...";
    btnAgregar.disabled = true;

    try {
        let urlImagen = null;

        if (archivo) {
            const formData = new FormData();
            formData.append("image", archivo);
            const respuestaImg = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            const datosImg = await respuestaImg.json();
            if (datosImg.success) urlImagen = datosImg.data.url;
        }

        if (productoEditandoId) {
            const datosActualizar = { titulo: titulo, precio: Number(precio) };
            if (urlImagen) datosActualizar.imagenUrl = urlImagen;
            await db.collection("productos").doc(productoEditandoId).update(datosActualizar);
            alert("¡Producto actualizado!");
        } else {
            if (!urlImagen) {
                alert("Selecciona una imagen para el producto.");
                btnAgregar.innerText = "Agregar Producto";
                btnAgregar.disabled = false;
                return;
            }
            await db.collection("productos").add({
                titulo: titulo,
                precio: Number(precio),
                imagenUrl: urlImagen,
                fecha: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("¡Producto publicado!");
        }

        resetearFormulario();
        panelAdmin.classList.remove('open');
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btnAgregar.disabled = false;
    }
});

// CARGA DE CATALOGO CON SPINNER
function cargarProductos() {
    db.collection("productos").orderBy("fecha", "desc").onSnapshot((querySnapshot) => {
        loadingSpinner.style.display = "none";
        gridProductos.innerHTML = "";
        
        if (querySnapshot.empty) {
            gridProductos.innerHTML = "<p style='grid-column:1/-1; text-align:center;'>No hay productos disponibles.</p>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const p = doc.data();
            const id = doc.id;

            const accionesAdmin = esAdmin ? `
                <div class="admin-actions">
                    <button class="btn-share" onclick="compartirProducto('${p.titulo}', ${p.precio}, '${p.imagenUrl}')" title="Compartir en redes">🔗</button>
                    <button class="btn-edit" onclick="prepararEdicion('${id}', '${p.titulo}', ${p.precio})">✏️</button>
                    <button class="btn-del" onclick="eliminarProducto('${id}')">🗑️</button>
                </div>
            ` : '';

            const div = document.createElement('div');
            div.className = 'product-card';
            div.innerHTML = `
                ${accionesAdmin}
                <img src="${p.imagenUrl}" alt="${p.titulo}" class="product-img">
                <div class="product-info">
                    <h3 class="product-title">${p.titulo}</h3>
                    <p class="product-price">$${p.precio}</p>
                    <button class="btn-add-cart" onclick="agregarAlCarrito('${id}', '${p.titulo}', ${p.precio})">🛒 Agregar</button>
                </div>
            `;
            gridProductos.appendChild(div);
        });
    });
}

// CARRITO AGRUPADO CON CONTADORES
window.agregarAlCarrito = (id, titulo, precio) => {
    const existe = carrito.find(p => p.id === id);
    if (existe) {
        existe.cantidad += 1;
    } else {
        carrito.push({ id, titulo, precio, cantidad: 1 });
    }
    actualizarCarritoUI();
};

function actualizarCarritoUI() {
    let cantidadTotal = 0;
    let precioTotal = 0;
    cartItemsContainer.innerHTML = "";

    carrito.forEach((prod, index) => {
        cantidadTotal += prod.cantidad;
        precioTotal += prod.precio * prod.cantidad;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <div class="cart-item-info">
                <strong>${prod.titulo}</strong>
                <small>$${prod.precio} c/u</small>
            </div>
            <div class="cart-item-controls">
                <button class="btn-qty" onclick="cambiarCantidad(${index}, -1)">-</button>
                <span>${prod.cantidad}</span>
                <button class="btn-qty" onclick="cambiarCantidad(${index}, 1)">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemDiv);
    });

    cartCountSpan.innerText = cantidadTotal;
    cartTotalPriceSpan.innerText = precioTotal;
}

window.cambiarCantidad = (index, cambio) => {
    carrito[index].cantidad += cambio;
    if (carrito[index].cantidad <= 0) {
        carrito.splice(index, 1);
    }
    actualizarCarritoUI();
};

btnCarritoFlotante.addEventListener('click', () => modalCarrito.classList.add('open'));
btnCerrarCarrito.addEventListener('click', () => modalCarrito.classList.remove('open'));

btnEnviarPedidoWA.addEventListener('click', () => {
    if (carrito.length === 0) {
        alert("El carrito está vacío.");
        return;
    }
    let texto = "Hola, me gustaría encargar los siguientes productos:\n\n";
    let total = 0;
    carrito.forEach(p => {
        const subtotal = p.precio * p.cantidad;
        texto += `- ${p.titulo} x${p.cantidad}: $${subtotal}\n`;
        total += subtotal;
    });
    texto += `\n*Total: $${total}*`;

    const urlWA = `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(texto)}`;
    window.open(urlWA, '_blank');
});

// EDICION Y BORRADO
window.prepararEdicion = (id, titulo, precio) => {
    productoEditandoId = id;
    inputTitulo.value = titulo;
    inputPrecio.value = precio;
    labelImagen.innerText = "📷 Cambiar foto (opcional)";
    btnAgregar.innerText = "Guardar Cambios";
    panelAdmin.classList.add('open');
};

window.eliminarProducto = async (id) => {
    if (confirm("¿Estás seguro de eliminar esta publicación?")) {
        await db.collection("productos").doc(id).delete();
    }
};

function resetearFormulario() {
    productoEditandoId = null;
    inputImagen.value = "";
    inputTitulo.value = "";
    inputPrecio.value = "";
    labelImagen.innerText = "📸 Seleccionar foto";
    btnAgregar.innerText = "Agregar Producto";
}

// FUNCIONALIDAD COMPARTIR CON FOTO Y ENLACE LIMPIO
window.compartirProducto = async (titulo, precio, imagenUrl) => {
    const urlTienda = window.location.href;
    const textoCompartir = `✨ ¡Mirá este producto en Begus!\n📌 ${titulo} - $${precio}\n👉 Catálogo completo acá: ${urlTienda}`;

    try {
        const response = await fetch(imagenUrl);
        const blob = await response.blob();
        const file = new File([blob], 'producto.jpg', { type: blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `${titulo} - Begus`,
                text: textoCompartir,
                files: [file]
            });
            return;
        }
    } catch (error) {
        console.log("No se pudo adjuntar la foto, enviando solo texto...", error);
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: `${titulo} - Begus`,
                text: textoCompartir,
                url: urlTienda
            });
        } catch (err) {
            console.log("Compartir cancelado.");
        }
    } else {
        navigator.clipboard.writeText(textoCompartir);
        alert("¡Enlace y texto copiados al portapapeles!");
    }
};

cargarProductos();
