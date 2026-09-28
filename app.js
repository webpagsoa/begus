import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Configuración del proyecto Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDnl23nvPG7hoMV0fE2NYJR7dWY-msEIcI",
    authDomain: "begus-4a593.firebaseapp.com",
    projectId: "begus-4a593",
    storageBucket: "begus-4a593.firebasestorage.app",
    messagingSenderId: "171755943273",
    appId: "1:171755943273:web:0a5fadb6978614eaeaf9f8"
};

// 2. Constantes de Administración
const TELEFONO_ADMIN = "5493725401808";
const DOMINIO_INTERNO = "@begus.internal";

// 3. Inicialización de Servicios
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const productosRef = collection(db, "productos");

let esAdmin = false;
let productoEditandoId = null;

// --- ESTADO DE AUTENTICACIÓN Y RENDERIZADO ---
onAuthStateChanged(auth, (user) => {
    if (user && user.email === `${TELEFONO_ADMIN}${DOMINIO_INTERNO}`) {
        esAdmin = true;
        actualizarUIAdmin(true);
    } else {
        esAdmin = false;
        actualizarUIAdmin(false);
    }
    escucharProductos();
});

function actualizarUIAdmin(autenticado) {
    const btnAdmin = document.getElementById('btn-abrir-admin');
    const panelAdmin = document.getElementById('panel-admin');
    
    if (btnAdmin) {
        btnAdmin.innerText = autenticado ? "⚙️ Cerrar Sesión" : "🔑 Admin";
    }
    if (panelAdmin) {
        panelAdmin.classList.toggle('open', autenticado);
    }
}

// Botón de Inicio/Cierre de Sesión
document.getElementById('btn-abrir-admin')?.addEventListener('click', async () => {
    if (!esAdmin) {
        const telefonoInput = prompt("Ingrese su número de celular administrador:");
        if (!telefonoInput) return;
        
        const passwordInput = prompt("Ingrese su contraseña:");
        if (!passwordInput) return;

        // Sanitización del teléfono de entrada
        const telefonoLimpio = telefonoInput.replace(/\D/g, '');
        const emailSintetizado = `${telefonoLimpio}${DOMINIO_INTERNO}`;

        try {
            await signInWithEmailAndPassword(auth, emailSintetizado, passwordInput);
        } catch (error) {
            console.error("Error de acceso:", error.code);
            alert("Credenciales incorrectas o no autorizadas.");
        }
    } else {
        await signOut(auth);
    }
});

// --- LECTURA EN TIEMPO REAL DEL CATÁLOGO ---
function escucharProductos() {
    const q = query(productosRef, orderBy("creado", "desc"));
    onSnapshot(q, (snapshot) => {
        const contenedor = document.getElementById('catalogo-productos');
        if (!contenedor) return;
        contenedor.innerHTML = "";
        
        snapshot.forEach((docSnap) => {
            const p = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement('div');
            card.className = "producto-card";
            card.innerHTML = `
                <img src="${p.imagenUrl || 'https://via.placeholder.com/300'}" alt="${p.nombre}">
                <h3>${p.nombre}</h3>
                <p class="precio">$${p.precio}</p>
                ${esAdmin ? `
                    <div class="acciones-admin">
                        <button onclick="prepararEdicion('${id}', '${p.nombre}', ${p.precio}, '${p.imagenUrl}')">✏️ Editar</button>
                        <button onclick="eliminarProducto('${id}')">🗑️ Eliminar</button>
                    </div>
                ` : ''}
            `;
            contenedor.appendChild(card);
        });
    });
}

// --- GESTIÓN DE PRODUCTOS (CRUD) ---
document.getElementById('form-producto')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!esAdmin) return alert("Acceso denegado: No tienes permisos de administrador.");

    const nombre = document.getElementById('input-nombre').value.trim();
    const precio = parseFloat(document.getElementById('input-precio').value);
    const imagenUrl = document.getElementById('input-imagen-url').value.trim();

    try {
        if (productoEditandoId) {
            const docRef = doc(db, "productos", productoEditandoId);
            await updateDoc(docRef, { nombre, precio, imagenUrl });
            productoEditandoId = null;
        } else {
            await addDoc(productosRef, {
                nombre,
                precio,
                imagenUrl,
                creado: serverTimestamp()
            });
        }
        document.getElementById('form-producto').reset();
    } catch (error) {
        console.error("Error al guardar en Firestore:", error);
        alert("Error de escritura en la base de datos.");
    }
});

window.prepararEdicion = (id, nombre, precio, imagenUrl) => {
    productoEditandoId = id;
    document.getElementById('input-nombre').value = nombre;
    document.getElementById('input-precio').value = precio;
    document.getElementById('input-imagen-url').value = imagenUrl;
};

window.eliminarProducto = async (id) => {
    if (!esAdmin) return;
    if (confirm("¿Confirmas que deseas eliminar este producto?")) {
        try {
            await deleteDoc(doc(db, "productos", id));
        } catch (error) {
            console.error("Error al eliminar documento:", error);
        }
    }
};
