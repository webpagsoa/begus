import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Configuración Pública
const firebaseConfig = {
    apiKey: "AIzaSyDnl23nvPG7hoMV0fE2NYJR7dWY-msEIcI",
    authDomain: "begus-4a593.firebaseapp.com",
    projectId: "begus-4a593",
    storageBucket: "begus-4a593.firebasestorage.app",
    messagingSenderId: "171755943273",
    appId: "1:171755943273:web:0a5fadb6978614eaeaf9f8"
};

const TELEFONO_WHATSAPP = "5493725641328";
const DOMINIO_INTERNO = "@begus.internal"; // Identidad sintáctica segura

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const productosRef = collection(db, "productos");

let esAdmin = false;
let productoEditandoId = null;
let carrito = [];

// DOM Elements
const panelAdmin = document.getElementById('panel-admin');
const gridProductos = document.getElementById('grid-productos');
const btnAbrirAdmin = document.getElementById('btn-abrir-admin');

// --- 1. AUTENTICACIÓN SEGURA Y REACTIVA (A01 & A07 Mitigados) ---
onAuthStateChanged(auth, (user) => {
    if (user && user.email.endsWith(DOMINIO_INTERNO)) {
        esAdmin = true;
        btnAbrirAdmin.innerText = "⚙️ Cerrar Sesión";
        panelAdmin.classList.add('open');
    } else {
        esAdmin = false;
        btnAbrirAdmin.innerText = "🔑 Admin";
        panelAdmin.classList.remove('open');
    }
    renderizarCatalogo(); // Re-renderiza para mostrar/ocultar botones edit/delete
});

btnAbrirAdmin.addEventListener('click', async () => {
    if (!esAdmin) {
        const telefono = prompt("Ingrese su celular de administración:");
        if (!telefono) return;
        const password = prompt("Ingrese la contraseña secreta:");
        if (!password) return;

        const emailSintetizado = `${telefono.replace(/\D/g, '')}${DOMINIO_INTERNO}`;
        
        try {
            await signInWithEmailAndPassword(auth, emailSintetizado, password);
        } catch (error) {
            console.error("Error Auth:", error);
            alert("Credenciales inválidas.");
        }
    } else {
        await signOut(auth);
        resetearFormulario();
    }
});

// --- 2. GESTIÓN DE PRODUCTOS Y STORAGE SEGURA ---
document.getElementById('btn-agregar-producto').addEventListener('click', async (e) => {
    const inputImagen = document.getElementById('img-file');
    const inputTitulo = document.getElementById('input-titulo');
    const inputPrecio = document.getElementById('input-precio');
    const btnSubmit = e.target;

    const titulo = inputTitulo.value.trim();
    const precio = Number(inputPrecio.value.trim());
    const archivo = inputImagen.files[0];

    if (!titulo || !precio) return alert("Completa el título y el precio.");

    btnSubmit.innerText = "Procesando...";
    btnSubmit.disabled = true;

    try {
        let urlImagen = null;

        // Subida a Firebase Storage en lugar de ImgBB
        if (archivo) {
            const fileName = `${Date.now()}_${archivo.name}`;
            const storageRef = ref(storage, `productos/${fileName}`);
            await uploadBytes(storageRef, archivo);
            urlImagen = await getDownloadURL(storageRef);
        }

        if (productoEditandoId) {
            const updateData = { titulo, precio };
            if (urlImagen) updateData.imagenUrl = urlImagen;
            await updateDoc(doc(db, "productos", productoEditandoId), updateData);
        } else {
            if (!urlImagen) throw new Error("Selecciona una imagen.");
            await addDoc(productosRef, {
                titulo,
                precio,
                imagenUrl: urlImagen,
                fecha: serverTimestamp()
            });
        }
        resetearFormulario();
        panelAdmin.classList.remove('open');
    } catch (error) {
        alert("Error de operación: Asegúrese de ser administrador.");
        console.error(error);
    } finally {
        btnSubmit.innerText = "Agregar Producto";
        btnSubmit.disabled = false;
    }
});

// --- 3. RENDERIZADO DEFENSIVO CONTRA XSS (A03 Mitigado) ---
let unsubscribeCatalogo = null;

function renderizarCatalogo() {
    const q = query(productosRef, orderBy("fecha", "desc"));
    
    if (unsubscribeCatalogo) unsubscribeCatalogo(); // Limpiar listener anterior

    unsubscribeCatalogo = onSnapshot(q, (snapshot) => {
        document.getElementById('loading-spinner').style.display = "none";
        gridProductos.innerHTML = "";

        if (snapshot.empty) {
            gridProductos.innerHTML = "<p style='text-align:center; grid-column:1/-1;'>Catálogo vacío.</p>";
            return;
        }

        snapshot.forEach((documento) => {
            const p = documento.data();
            const id = documento.id;

            const card = document.createElement('div');
            card.className = 'product-card';

            // Construcción defensiva del DOM (No se usa innerHTML para datos del usuario)
            const img = document.createElement('img');
            img.src = p.imagenUrl || '';
            img.alt = p.titulo;
            img.className = 'product-img';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'product-info';

            const titleH3 = document.createElement('h3');
            titleH3.className = 'product-title';
            titleH3.textContent = p.titulo; // Prevención de XSS

            const priceP = document.createElement('p');
            priceP.className = 'product-price';
            priceP.textContent = `$${p.precio}`;

            const btnAdd = document.createElement('button');
            btnAdd.className = 'btn-add-cart';
            btnAdd.textContent = '🛒 Agregar';
            btnAdd.onclick = () => agregarAlCarrito(id, p.titulo, p.precio);

            infoDiv.append(titleH3, priceP, btnAdd);
            card.append(img, infoDiv);

            // Controles de Administrador
            if (esAdmin) {
                const adminDiv = document.createElement('div');
                adminDiv.className = 'admin-actions';
                
                const btnEdit = document.createElement('button');
                btnEdit.className = 'btn-edit';
                btnEdit.textContent = '✏️';
                btnEdit.onclick = () => prepararEdicion(id, p.titulo, p.precio);

                const btnDel = document.createElement('button');
                btnDel.className = 'btn-del';
                btnDel.textContent = '🗑️';
                btnDel.onclick = async () => {
                    if (confirm("¿Eliminar publicación?")) await deleteDoc(doc(db, "productos", id));
                };

                adminDiv.append(btnEdit, btnDel);
                card.prepend(adminDiv);
            }
            gridProductos.appendChild(card);
        });
    });
}

// --- 4. LÓGICA DE CARRITO Y WHATSAPP (Mantenida e integrada) ---
window.agregarAlCarrito = (id, titulo, precio) => {
    const existe = carrito.find(p => p.id === id);
    if (existe) existe.cantidad += 1;
    else carrito.push({ id, titulo, precio, cantidad: 1 });
    actualizarCarritoUI();
};

function actualizarCarritoUI() {
    let cantidadTotal = 0;
    let precioTotal = 0;
    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = "";

    carrito.forEach((prod, index) => {
        cantidadTotal += prod.cantidad;
        precioTotal += prod.precio * prod.cantidad;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        
        const titleSpan = document.createElement('strong');
        titleSpan.textContent = prod.titulo;
        
        itemDiv.innerHTML = `
            <div class="cart-item-info">
                <div class="safe-title"></div>
                <small>$${prod.precio} c/u</small>
            </div>
            <div class="cart-item-controls">
                <button class="btn-qty" onclick="cambiarCantidad(${index}, -1)">-</button>
                <span>${prod.cantidad}</span>
                <button class="btn-qty" onclick="cambiarCantidad(${index}, 1)">+</button>
            </div>
        `;
        // Inserción segura en un innerHTML mixto
        itemDiv.querySelector('.safe-title').appendChild(titleSpan); 
        cartItemsContainer.appendChild(itemDiv);
    });

    document.getElementById('cart-count').innerText = cantidadTotal;
    document.getElementById('cart-total-price').innerText = precioTotal;
}

window.cambiarCantidad = (index, cambio) => {
    carrito[index].cantidad += cambio;
    if (carrito[index].cantidad <= 0) carrito.splice(index, 1);
    actualizarCarritoUI();
};

// Eventos de interfaz
document.getElementById('btn-carrito-flotante').addEventListener('click', () => document.getElementById('modal-carrito').classList.add('open'));
document.getElementById('btn-cerrar-carrito').addEventListener('click', () => document.getElementById('modal-carrito').classList.remove('open'));
document.getElementById('btn-cerrar-admin').addEventListener('click', () => {
    document.getElementById('panel-admin').classList.remove('open');
    resetearFormulario();
});

document.getElementById('btn-enviar-pedido-wa').addEventListener('click', () => {
    if (carrito.length === 0) return alert("Carrito vacío.");
    let texto = "Hola, me gustaría encargar los siguientes productos:\n\n";
    let total = 0;
    carrito.forEach(p => {
        texto += `- ${p.titulo} x${p.cantidad}: $${p.precio * p.cantidad}\n`;
        total += p.precio * p.cantidad;
    });
    texto += `\n*Total: $${total}*`;
    window.open(`https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(texto)}`, '_blank');
});

function prepararEdicion(id, titulo, precio) {
    productoEditandoId = id;
    document.getElementById('input-titulo').value = titulo;
    document.getElementById('input-precio').value = precio;
    document.getElementById('btn-agregar-producto').innerText = "Guardar Cambios";
    panelAdmin.classList.add('open');
}

function resetearFormulario() {
    productoEditandoId = null;
    document.getElementById('img-file').value = "";
    document.getElementById('input-titulo').value = "";
    document.getElementById('input-precio').value = "";
    document.getElementById('btn-agregar-producto').innerText = "Agregar Producto";
}

// UI Setup inicial
document.getElementById('img-file').addEventListener('change', (e) => {
    const lbl = document.querySelector('.file-upload-label');
    lbl.innerText = e.target.files.length > 0 ? "✅ Foto seleccionada" : "📸 Seleccionar foto";
});

renderizarCatalogo();
