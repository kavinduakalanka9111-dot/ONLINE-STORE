// Mobile Menu Toggle
const mobileMenuButton = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuButton && mobileMenu) {
  mobileMenuButton.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });
}

// --- Price Formatter Helper ---
const USD_RATE = 300;
function formatPrice(lkrAmt) {
    const usd = Number(lkrAmt) / USD_RATE;
    return `LKR ${Number(lkrAmt).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span class="text-sm font-bold text-gray-500 ml-1">($${usd.toFixed(2)})</span>`;
}
function formatPriceText(lkrAmt) {
    return `LKR ${Number(lkrAmt).toFixed(2)} ($${(Number(lkrAmt) / USD_RATE).toFixed(2)})`;
}

function initStoreLogo(firebaseLogoData = null) {
    const logoData = firebaseLogoData || localStorage.getItem('storeLogo');
    if(logoData) {
        document.querySelectorAll('nav a').forEach(a => {
            if(a.innerText.includes('ONLINE STORE')) {
                const iconDiv = a.querySelector('div');
                if(iconDiv && iconDiv.id !== 'admin-logo-preview') {
                    iconDiv.innerHTML = `<img src="${logoData}" class="w-full h-full object-cover rounded-full" onerror="this.style.display='none'">`;
                    iconDiv.className = 'w-10 h-10 border-2 border-emerald-500 p-[2px] rounded-full shadow-sm bg-white flex items-center justify-center flex-shrink-0';
                }
            }
        });
    }
    const preview = document.getElementById('admin-logo-preview');
    if(preview && logoData) {
        preview.innerHTML = `<img src="${logoData}" class="w-full h-full object-cover">`;
    }
}

// --- Product Management Logic (Firebase Connected) ---
let storeProducts = []; // Memory cache

const defaultProducts = [
    {id: 'p1', name: 'Premium Cotton Shirt', cat: 'Clothing', price: 29.99, img: 'https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?w=500', sale: false, desc: 'A comfortable and breathable cotton shirt suitable for any casual occasion.', sizes: ['M', 'L', 'XL'], colors: 'White, Blue'},
    {id: 'p2', name: 'Sony Wireless Headphones', cat: 'Electronics', price: 89.99, img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', sale: false, desc: 'Noise-cancelling wireless headphones with 30-hour battery life.'},
    {id: 'p3', name: 'Luxury Analog Watch', cat: 'Watches', price: 149.99, img: 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=500', sale: true, desc: 'Premium crafted analog watch showcasing timeless elegance and precision engineering.'},
    {id: 'p4', name: 'Jumbo Plush Teddy', cat: 'Toys', price: 34.99, img: 'https://images.unsplash.com/photo-1570458436416-b8eecfcbf1e3?w=500', sale: false, desc: 'Incredibly soft and huggable giant teddy bear.'},
    {id: 'p5', name: 'Minimalist Desk Clock', cat: 'Household', price: 45.00, img: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=500', sale: false, desc: 'A sleek, modern desk clock designed to complement contemporary workspaces.'},
    {id: 'p6', name: 'Modern Smartphone', cat: 'Electronics', price: 799.99, img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500', sale: false, desc: 'Next-generation smartphone with pro-grade camera and stunning display features.'},
    {id: 'p7', name: 'Elegant Sommer Dress', cat: 'Clothing', price: 59.99, img: 'https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=500', sale: false, desc: 'Lightweight and flowy dress, perfect for warm summer days.', sizes: ['S', 'M'], colors: 'Red, Yellow'},
    {id: 'p8', name: 'Ceramic Coffee Mug', cat: 'Household', price: 14.50, img: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500', sale: true, desc: 'Handcrafted ceramic mug that keeps your coffee warm longer.'}
];

let db = null;
const firebaseConfig = {
  apiKey: "AIzaSyBfgj5yDZSmF7JpQWELknKWc3z0CW9Re4E",
  authDomain: "online-store-30b44.firebaseapp.com",
  projectId: "online-store-30b44",
  storageBucket: "online-store-30b44.firebasestorage.app",
  messagingSenderId: "233184633801",
  appId: "1:233184633801:web:4dd0f3ca24f5dbc8ac3e18"
};

function loadFirebaseAndInit() {
    const fsApp = document.createElement('script');
    fsApp.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";
    document.head.appendChild(fsApp);
    
    fsApp.onload = () => {
        const fsDb = document.createElement('script');
        fsDb.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js";
        document.head.appendChild(fsDb);
        
        fsDb.onload = () => {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            
            // Sync products from firestore instead of localStorage
            db.collection("products").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
                storeProducts = [];
                snapshot.forEach((doc) => {
                    storeProducts.push({ id: doc.id, ...doc.data() });
                });
                
                // If empty, the store will now correctly show as empty instead of locking default items
                // Removed defaultProducts fallback
                
                // Re-render UI elements automatically when DB changes
                renderProductsToContainer('all-products-container');
                renderProductsToContainer('featured-products-container', 4);
                renderManageProducts();
                
                if(typeof renderDashboard === 'function') renderDashboard();
            });

            // Sync settings (Profile Photo)
            db.collection("settings").doc("storeProfile").onSnapshot((doc) => {
                if(doc.exists && doc.data().logoData) {
                    initStoreLogo(doc.data().logoData);
                }
            });
        };
    };
}

function getProducts() {
    return storeProducts;
}

// --- Image Compression & Multi-Upload Logic ---
let uploadedImages = [];
let selectedCoverIndex = 0;

function compressImageWebP(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxSize = 800; // aggressively shrink to save Firestore space
                if (width > height && width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/webp', 0.6));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    const grid = document.getElementById('preview-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    uploadedImages.forEach((b64, index) => {
        const isCover = index === selectedCoverIndex;
        grid.innerHTML += `
        <div class="snap-center shrink-0 relative cursor-pointer group" onclick="selectedCoverIndex=${index}; renderImagePreviews();">
            <img src="${b64}" class="w-24 h-24 object-cover rounded-xl border-4 ${isCover ? 'border-admin shadow-md' : 'border-transparent opacity-70 group-hover:opacity-100'} transition duration-300">
            ${isCover ? '<div class="absolute -top-2 -right-2 bg-admin text-white text-[10px] font-black px-2 py-1 rounded-full shadow-sm">COVER</div>' : ''}
        </div>`;
    });
}

window.handleImageFilesSelection = function(e) {
    const files = Array.from(e.target.files);
    if(files.length === 0) return;
    
    if(files.length > 10) {
        alert("Please select up to 10 images max.");
        return;
    }
    
    const previewContainer = document.getElementById('image-previews-container');
    const grid = document.getElementById('preview-grid');
    if(!previewContainer || !grid) return;
    
    previewContainer.classList.remove('hidden');
    grid.innerHTML = '<div class="text-sm text-gray-500 py-4 font-bold">Compressing images... Please wait.</div>';
    
    uploadedImages = [];
    selectedCoverIndex = 0;
    
    Promise.all(files.map(f => compressImageWebP(f))).then(base64Arr => {
        uploadedImages = base64Arr;
        renderImagePreviews();
    });
};

// Save logic handling both Device File and URL into Firebase
function addProduct(event) {
    event.preventDefault();
    if(!db) {
        alert("Firebase is connecting... Please wait a second and try again.");
        return;
    }
    
        const name = document.getElementById('item-name').value;
        const cat = document.getElementById('item-cat').value;
        const price = document.getElementById('item-price').value;
        const sale = document.getElementById('item-sale')?.checked;
        const desc = document.getElementById('item-desc')?.value.trim() || '';
        
        let sizes = [];
        let colors = '';
        if(cat === 'Clothing') {
            document.querySelectorAll('.size-cb:checked').forEach(cb => sizes.push(cb.value));
            colors = document.getElementById('item-colors')?.value.trim() || '';
        }
        
        const id = 'p' + Date.now(); 
        
        let finalImages = [];
        let finalCover = '';
        
        const urlInput = document.getElementById('item-img-url');
        
        if (uploadedImages.length > 0) {
            finalImages = uploadedImages;
            finalCover = uploadedImages[selectedCoverIndex] || uploadedImages[0];
        } else if (urlInput && urlInput.value) {
            finalImages = urlInput.value.split(',').map(u => u.trim()).filter(u => u);
            finalCover = finalImages[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500';
        } else {
            finalImages = ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'];
            finalCover = finalImages[0];
        }
        
        // Estimate total payload size
        const totalSize = JSON.stringify(finalImages).length;
        if(totalSize > 950000) {
            alert("Images are too large! Try uploading slightly fewer photos to stay under Database storage limits.");
            return;
        }
        
        const docData = { name, cat, price: parseFloat(price), img: finalCover, images: finalImages, sale, desc, sizes, colors, timestamp: Date.now() };
        
        // Push to Firebase directly
        db.collection("products").doc(id).set(docData).then(() => {
            showToast('Item successfully published to Live Store!');
            document.getElementById('add-item-form').reset();
            const clothDiv = document.getElementById('clothing-options');
            if(clothDiv) clothDiv.style.display = 'block';
            
            // Reset image states
            uploadedImages = [];
            const prevCont = document.getElementById('image-previews-container');
            if(prevCont) prevCont.classList.add('hidden');
        }).catch(e => {
            console.error(e);
            alert("Upload Failed! Check your internet connection.");
        });
}

function deleteProduct(id) {
    if(!db) return;
    if(confirm("Are you sure you want to delete this item completely from the live database?")) {
        db.collection("products").doc(id).delete().then(() => {
            showToast('Item deleted successfully from Live Store!');
        });
    }
}

// Modal view logic
function showProductModal(id) {
    let p = getProducts().find(prod => prod.id === id);
    if(!p) return;
    
    let modal = document.getElementById('product-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'product-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md opacity-0 pointer-events-none transition duration-500';
        document.body.appendChild(modal);
    }
    
    // Badges array for sizes
    let sizesHtml = '';
    if (p.sizes && p.sizes.length > 0) {
        sizesHtml = `
            <div class="mb-5">
                <h4 class="font-bold text-gray-700 mb-2 uppercase text-xs tracking-widest">Available Sizes</h4>
                <div class="flex flex-wrap gap-2">
                    ${p.sizes.map(s => `<span class="bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl text-sm font-black text-gray-800 shadow-sm">${s}</span>`).join('')}
                </div>
            </div>`;
    }
    
    let colorsHtml = '';
    if (p.colors) {
        let cols = p.colors.split(',').filter(c=>c.trim());
        if(cols.length > 0) {
             colorsHtml = `
                <div class="mb-5">
                    <h4 class="font-bold text-gray-700 mb-2 uppercase text-xs tracking-widest">Available Colors</h4>
                    <div class="flex flex-wrap gap-2">
                        ${cols.map(c => `<span class="bg-blue-50 text-accent px-4 py-2 rounded-xl text-sm font-bold shadow-sm">${c.trim()}</span>`).join('')}
                    </div>
                </div>`;
        }
    }
    
    const safeName = p.name.replace(/'/g, "\\'");
    
    let carouselHtml = '';
    const imagesToDisplay = (p.images && p.images.length > 0) ? p.images : [p.img];
    
    if (imagesToDisplay.length === 1) {
        carouselHtml = `<img src="${imagesToDisplay[0]}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/500'">`;
    } else {
        let imgsHtml = '';
        let dotsHtml = '';
        imagesToDisplay.forEach((img, i) => {
            imgsHtml += `<div class="w-full h-full shrink-0 snap-center relative">
                            <img src="${img}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/500'">
                         </div>`;
            dotsHtml += `<div class="w-2 h-2 rounded-full shadow-sm bg-white/50"></div>`;
        });
        carouselHtml = `
            <div class="w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar" style="scrollbar-width: none;">
                ${imgsHtml}
            </div>
            <div class="absolute bottom-4 left-0 right-0 flex justify-center gap-2 pointer-events-none">${dotsHtml}</div>
            <div class="absolute top-1/2 left-4 bg-white/60 backdrop-blur w-8 h-8 flex items-center justify-center rounded-full pointer-events-none shadow-md text-gray-700 hidden md:flex"><i class="fa-solid fa-chevron-left text-xs"></i></div>
            <div class="absolute top-1/2 right-4 bg-white/60 backdrop-blur w-8 h-8 flex items-center justify-center rounded-full pointer-events-none shadow-md text-gray-700 hidden md:flex"><i class="fa-solid fa-chevron-right text-xs"></i></div>
        `;
    }

    modal.innerHTML = `
        <div class="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden mx-4 transform scale-95 transition-transform duration-500" id="modal-content">
            <div class="grid grid-cols-1 md:grid-cols-2 relative">
                <button onclick="closeProductModal()" class="absolute z-20 top-4 right-4 bg-white/90 hover:bg-red-50 hover:text-red-500 backdrop-blur-md w-12 h-12 rounded-full flex items-center justify-center text-gray-800 shadow-lg transition duration-300 md:hidden"><i class="fa-solid fa-xmark text-xl"></i></button>
                <div class="h-72 md:h-[600px] relative bg-gray-100 group">
                    ${carouselHtml}
                    ${p.sale ? '<div class="absolute top-4 left-4 z-10 bg-red-500 text-white text-sm font-black px-4 py-2 rounded-full shadow-xl tracking-wider">SALE</div>' : ''}
                </div>
                <div class="p-8 md:p-12 flex flex-col max-h-[600px] overflow-y-auto">
                    <div class="flex justify-between items-start mb-4">
                        <div class="text-xs text-accent font-bold uppercase tracking-widest flex items-center gap-2"><div class="w-4 h-0.5 bg-accent"></div> ${p.cat}</div>
                        <button onclick="closeProductModal()" class="hidden md:flex bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-500 w-10 h-10 rounded-full items-center justify-center transition duration-300"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <h2 class="text-3xl md:text-4xl font-black text-gray-900 mb-2 leading-tight">${p.name}</h2>
                    <div class="text-3xl md:text-4xl font-black text-brand mb-8 border-b border-gray-100 pb-8">${formatPrice(p.price)}</div>
                    
                    <div class="mb-4">
                        <h4 class="font-bold text-gray-700 mb-2 uppercase text-xs tracking-widest">Description</h4>
                        <p class="text-gray-600 leading-relaxed text-lg">${p.desc || 'A premium selection from our curated catalogue.'}</p>
                    </div>
                    
                    ${sizesHtml}
                    ${colorsHtml}
                    
                    <div class="mt-10 pt-4">
                        <button onclick="addToCart('${p.id}', '${safeName}', ${p.price}, '${p.img}'); showToast('Added to Cart!');" class="w-full bg-brand hover:bg-accent text-white py-5 rounded-2xl font-bold text-xl transition duration-300 shadow-[0_10px_30px_rgba(15,23,42,0.2)] hover:shadow-[0_15px_40px_rgba(59,130,246,0.3)] transform hover:-translate-y-1 flex items-center justify-center gap-3">
                            Add to Cart <i class="fa-solid fa-cart-arrow-down"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        document.getElementById('modal-content').classList.remove('scale-95');
    }, 10);
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if(modal) {
        document.getElementById('modal-content').classList.add('scale-95');
        modal.classList.add('opacity-0', 'pointer-events-none');
    }
}

// Render Products Grid
function renderProductsToContainer(containerId, maxItems = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const products = getProducts();
    let displayProducts = maxItems ? products.slice(0, maxItems) : products;
    
    if (displayProducts.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm"><i class="fa-solid fa-box-open text-7xl text-gray-200 mb-6 block"></i><p class="text-gray-500 font-medium text-xl">Inventory empty. <br><a href="manage.html" class="inline-block mt-4 bg-accent text-white px-8 py-3 rounded-full hover:bg-blue-600 transition shadow-lg">Manage Items</a></p></div>`;
        return;
    }
    
    let html = '';
    displayProducts.forEach(p => {
        html += `
        <div class="product-card bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col relative group cursor-pointer" onclick="showProductModal('${p.id}')">
            ${p.sale ? '<div class="absolute top-4 left-4 z-20 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-md tracking-wide px-4">SALE</div>' : ''}
            <div class="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm w-10 h-10 rounded-full flex items-center justify-center shadow-lg text-gray-400 hover:text-brand hover:scale-110 transition duration-300 border border-gray-100">
                <i class="fa-solid fa-eye"></i>
            </div>
            <div class="relative h-72 overflow-hidden bg-gray-100 flex items-center justify-center z-10">
                <img src="${p.img}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-110 transition duration-700" onerror="this.src='https://via.placeholder.com/500'">
            </div>
            <div class="p-6 flex-1 flex flex-col relative bg-white z-20">
                <div class="text-xs text-accent font-black uppercase tracking-widest mb-2">${p.cat}</div>
                <h3 class="text-xl font-bold text-gray-900 mb-3 line-clamp-2" title="${p.name}">${p.name}</h3>
                <div class="flex items-center gap-1 text-yellow-400 text-sm mb-4">
                    <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star-half-stroke"></i>
                </div>
                <div class="mt-auto flex justify-between items-center pt-4 border-t border-gray-100">
                    <span class="text-xl font-black text-brand leading-none">${formatPrice(p.price)}</span>
                    <button onclick="event.stopPropagation(); addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.img}')" class="bg-gray-900 hover:bg-accent text-white w-12 h-12 rounded-full flex items-center justify-center transition duration-300 shadow-md hover:shadow-xl transform hover:-translate-y-1">
                        <i class="fa-solid fa-cart-plus font-bold"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;
}

// Admin / Manage Page specific
function renderManageProducts() {
    const tbody = document.getElementById('manage-products-tbody');
    if(!tbody) return;
    
    const products = getProducts();
    let html = '';
    products.forEach(p => {
        let extraTags = '';
        if(p.sizes && p.sizes.length > 0) extraTags += `<span class="bg-gray-100 border border-gray-200 text-gray-600 text-xs px-2 py-1 rounded ml-1 font-bold">Sizes: ${p.sizes.join(', ')}</span>`;
        if(p.colors) extraTags += `<span class="bg-gray-100 border border-gray-200 text-gray-600 text-xs px-2 py-1 rounded ml-1 font-bold">Colors: ${p.colors.split(',').length}</span>`;
        
        html += `
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                <td class="p-4 flex justify-center"><img src="${p.img}" class="w-16 h-16 rounded-xl shadow-sm object-cover border border-gray-200" onerror="this.src='https://via.placeholder.com/150'"></td>
                <td class="p-4">
                    <div class="font-bold text-gray-800 text-lg mb-1">${p.name}</div>
                    <div class="text-gray-500 text-sm line-clamp-1">${p.desc || 'No description'}</div>
                </td>
                <td class="p-4">
                    <div class="mb-2"><span class="bg-blue-50 text-accent px-3 py-1 rounded-full text-sm font-black tracking-wide">${p.cat}</span></div>
                    <div class="flex flex-wrap gap-1">${extraTags}</div>
                </td>
                <td class="p-4 font-black text-brand text-xl">${formatPrice(p.price)}</td>
                <td class="p-4 text-center">
                    <button onclick="deleteProduct('${p.id}')" class="bg-white border border-red-100 text-red-500 hover:bg-red-500 hover:text-white w-10 h-10 rounded-full shadow-sm transition transform hover:scale-110"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// --- Cart Logic ---
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  badges.forEach(badge => {
    badge.innerText = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });
}

function addToCart(id, name, price, image) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, name, price, image, quantity: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  showToast(`Added ${name} to cart!`);
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if(!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'fixed bottom-5 right-5 bg-gray-900 border border-gray-700 text-white px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-500 translate-y-20 opacity-0 z-50 flex items-center gap-3 backdrop-blur-md bg-opacity-90';
      document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 text-xl"></i> <span class="font-bold tracking-wide">${message}</span>`;
  
  setTimeout(() => { toast.classList.remove('translate-y-20', 'opacity-0'); }, 10);
  setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

function renderCart() {
  const cartContainer = document.getElementById('cart-items-container');
  const cartTotalAmount = document.getElementById('cart-total-amount');
  const cartSummary = document.getElementById('cart-summary');
  if (!cartContainer) return;
  
  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="text-center py-16 bg-white rounded-3xl shadow-sm border border-gray-100">
        <i class="fa-solid fa-bag-shopping text-7xl text-gray-200 mb-6 block fade-in"></i>
        <h3 class="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h3>
        <p class="text-gray-500 mb-8 max-w-sm mx-auto">Looks like you haven't added any premium products to your cart yet.</p>
        <a href="products.html" class="inline-flex items-center gap-2 bg-accent text-white px-8 py-4 rounded-full font-semibold hover:bg-blue-600 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1">Start Shopping</a>
      </div>`;
    if (cartTotalAmount) cartTotalAmount.innerText = '$0.00';
    if (cartSummary) cartSummary.style.display = 'none';
    return;
  }
  
  if (cartSummary) cartSummary.style.display = 'block';
  let html = '';
  let total = 0;
  
  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    html += `
      <div class="flex flex-col sm:flex-row items-center bg-white p-4 rounded-2xl border border-gray-100 mb-4 gap-6 relative group transition duration-300 hover:shadow-md">
        <img src="${item.image}" alt="${item.name}" class="w-28 h-28 object-cover rounded-xl shadow-sm" onerror="this.src='https://via.placeholder.com/150'">
        <div class="flex-1 text-center sm:text-left">
            <h4 class="text-xl font-bold text-gray-800 mb-1">${item.name}</h4>
            <p class="text-blue-500 font-medium mb-3">${formatPrice(item.price)}</p>
        </div>
        <div class="flex items-center border border-gray-200 rounded-full bg-gray-50 p-1 shadow-inner">
            <button onclick="updateQuantity(${index}, -1)" class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-white hover:shadow transition">-</button>
            <span class="px-4 font-bold text-gray-800 w-12 text-center select-none">${item.quantity}</span>
            <button onclick="updateQuantity(${index}, 1)" class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-white hover:shadow transition">+</button>
        </div>
        <div class="font-black text-xl text-gray-900 w-auto text-right">${formatPrice(itemTotal)}</div>
        <button onclick="removeItem(${index})" class="absolute sm:relative -top-3 -right-3 sm:top-0 sm:right-0 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white sm:bg-transparent sm:hover:bg-red-50 w-10 h-10 rounded-full flex items-center justify-center transition duration-300"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  });
  
  cartContainer.innerHTML = html;
  
  const subtotalElem = document.getElementById('cart-subtotal');
  const taxElem = document.getElementById('cart-tax');
  if(subtotalElem) subtotalElem.innerHTML = formatPrice(total);
  if(taxElem) taxElem.innerHTML = formatPrice(total * 0.05);
  if(cartTotalAmount) cartTotalAmount.innerHTML = formatPrice(total * 1.05);
}

function updateQuantity(index, change) {
    if (cart[index].quantity + change > 0) cart[index].quantity += change;
    else cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    renderCart();
}

function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    renderCart();
}

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
    initStoreLogo();
    
    // Load Firebase logic! This will automatically fetch real-time items from Cloud and render them
    loadFirebaseAndInit();
    
    updateCartBadge();
    renderCart();
    
    // Attach form submission if on manage page
    const addForm = document.getElementById('add-item-form');
    if(addForm) {
        addForm.addEventListener('submit', addProduct);
    }
    
    // Attach Multi-Image compress listener
    const itemFileInput = document.getElementById('item-file');
    if(itemFileInput) itemFileInput.addEventListener('change', window.handleImageFilesSelection);
    
    // Store Logo Upload event
    const logoInput = document.getElementById('store-logo-input');
    if(logoInput) {
        logoInput.addEventListener('change', function(e) {
            if(e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    try {
                        localStorage.setItem('storeLogo', ev.target.result); // local fallback
                        initStoreLogo();
                        
                        // Push to Firebase Live Store Logo
                        if(db) {
                            db.collection("settings").doc("storeProfile").set({
                                logoData: ev.target.result
                            }).then(() => {
                                showToast('Store Profile Photo Updated Live!');
                            }).catch(err => {
                                alert("Failed to upload Profile Photo. Image might be too large.");
                            });
                        } else {
                            showToast('Updated locally (Firebase linking...)');
                        }
                    } catch(err) {
                        alert("Image is too large to save! Please use a smaller profile picture (under 1MB).");
                    }
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
});

// --- Reports & Dashboard Logic ---
function getSales() {
    return JSON.parse(localStorage.getItem('storeSales')) || [];
}

function addSale(event) {
    event.preventDefault();
    const itemId = document.getElementById('sale-item').value;
    const qty = parseInt(document.getElementById('sale-qty').value);
    const amount = parseFloat(document.getElementById('sale-amount').value);
    const cname = document.getElementById('sale-customer').value || 'Guest';
    const date = document.getElementById('sale-date').value || new Date().toISOString().split('T')[0];
    
    const products = getProducts();
    const product = products.find(p => p.id === itemId);
    const itemName = product ? product.name : 'Unknown Item';
    const cat = product ? product.cat : 'Unknown';
    
    let sales = getSales();
    sales.push({
        id: 's' + Date.now(),
        date: date,
        itemId: itemId,
        itemName: itemName,
        cat: cat,
        qty: qty,
        amount: amount,
        customer: cname,
        timestamp: Date.now()
    });
    
    localStorage.setItem('storeSales', JSON.stringify(sales));
    showToast('Sale logged successfully! Analytics Updated.');
    
    document.getElementById('log-sale-form').reset();
    document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
    
    renderDashboard();
}

function deleteSale(id) {
    if(confirm('Are you sure you want to delete this sales record?')) {
        let sales = getSales();
        sales = sales.filter(s => s.id !== id);
        localStorage.setItem('storeSales', JSON.stringify(sales));
        renderDashboard();
    }
}

let revenueChartInstance = null;
let categoryChartInstance = null;

function renderDashboard() {
    const tableBody = document.getElementById('sales-table-body');
    const itemSelect = document.getElementById('sale-item');
    if(!tableBody || !itemSelect) return;
    
    // Populate dropdown
    const products = getProducts();
    if(itemSelect.options.length <= 0) {
        itemSelect.innerHTML = '<option value="" disabled selected>Select an item...</option>';
        products.forEach(p => {
            itemSelect.innerHTML += `<option value="${p.id}" data-price="${p.price}">${p.name} - ${formatPriceText(p.price)}</option>`;
        });
        
        itemSelect.addEventListener('change', function() {
            const price = this.options[this.selectedIndex].getAttribute('data-price');
            const qty = document.getElementById('sale-qty').value || 1;
            if(price) document.getElementById('sale-amount').value = (parseFloat(price) * parseInt(qty)).toFixed(2);
        });
        
        document.getElementById('sale-qty').addEventListener('input', function() {
            const price = itemSelect.options[itemSelect.selectedIndex]?.getAttribute('data-price');
            const qty = this.value || 1;
            if(price) document.getElementById('sale-amount').value = (parseFloat(price) * parseInt(qty)).toFixed(2);
        });
    }
    
    const sales = getSales();
    sales.sort((a,b) => b.timestamp - a.timestamp);
    
    let html = '';
    let totalRevenue = 0;
    let totalItemsSold = 0;
    
    sales.forEach(s => {
        totalRevenue += s.amount;
        totalItemsSold += s.qty;
        html += `
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                <td class="p-4 font-bold text-gray-700">${new Date(s.date).toLocaleDateString()}</td>
                <td class="p-4 font-medium">${s.customer}</td>
                <td class="p-4"><span class="font-bold text-gray-800">${s.itemName}</span> <span class="bg-blue-50 text-accent text-xs px-2 py-1 rounded-full ml-1 font-black">x${s.qty}</span></td>
                <td class="p-4 font-black text-brand text-right">${formatPrice(s.amount)}</td>
                <td class="p-4 text-center">
                    <button onclick="deleteSale('${s.id}')" class="text-red-400 hover:text-red-500 hover:scale-110 transition bg-red-50 w-8 h-8 rounded-full"><i class="fa-solid fa-trash text-sm"></i></button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html || `<tr><td colspan="5" class="text-center p-10 text-gray-400 font-medium">No sales logged yet. When you receive WhatsApp orders, add them here to see your Reports!</td></tr>`;
    
    document.getElementById('stat-revenue').innerHTML = formatPrice(totalRevenue);
    document.getElementById('stat-orders').innerText = sales.length;
    document.getElementById('stat-items').innerText = totalItemsSold;

    renderCharts(sales);
}

function renderCharts(sales) {
    if(!document.getElementById('revenueChart')) return;

    const last7Days = [];
    const revenueData = [];
    for(let i=6; i>=0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        let dStr = d.toISOString().split('T')[0];
        last7Days.push(d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'}));
        
        let dailyRev = sales.filter(s => s.date === dStr).reduce((acc, val) => acc + val.amount, 0);
        revenueData.push(dailyRev);
    }
    
    if(revenueChartInstance) revenueChartInstance.destroy();
    
    const ctx1 = document.getElementById('revenueChart').getContext('2d');
    revenueChartInstance = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Daily Revenue (LKR)',
                data: revenueData,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 4,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#8b5cf6',
                pointRadius: 4
            }]
        },
        options: { responsive: true, plugins: { legend: {display: false} }, maintainAspectRatio: false }
    });
    
    let catCounts = {};
    sales.forEach(s => {
        catCounts[s.cat] = (catCounts[s.cat] || 0) + s.qty;
    });
    
    if(categoryChartInstance) categoryChartInstance.destroy();
    
    const ctx2 = document.getElementById('categoryChart').getContext('2d');
    categoryChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catCounts),
            datasets: [{
                data: Object.values(catCounts),
                backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: { responsive: true, cutout: '75%', plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }
    });
}

// --- WhatsApp Checkout Logic ---
function checkoutWhatsApp() {
    if(!cart || cart.length === 0) return;
    
    // Replace with the Store Admin's WhatsApp Phone Number (with Country Code, no + sigh)
    // E.g., for Sri Lanka: 94771234567
    const phoneNumber = "94701234567"; 
    
    let text = "🛍️ *New Order from ONLINE STORE*\n\n";
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        text += `${index + 1}. *${item.name}*\n`;
        text += `   Price: ${formatPriceText(item.price)}\n`;
        text += `   Quantity: ${item.quantity}\n`;
        text += `   Total: ${formatPriceText(itemTotal)}\n\n`;
    });
    
    const finalTotal = total * 1.05; // including 5% tax
    text += `*Subtotal:* ${formatPriceText(total)}\n`;
    text += `*Tax (5%):* ${formatPriceText(total * 0.05)}\n`;
    text += `*Grand Total: ${formatPriceText(finalTotal)}*\n\n`;
    text += `Please reply to confirm my order!`;
    
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');
}
