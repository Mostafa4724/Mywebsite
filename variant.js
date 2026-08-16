/* Variant UI shared by admin add/edit, product details and cart.
   It deliberately uses the existing products.tags field through backend/variant.py. */
(function () {
  "use strict";

  const API = "http://127.0.0.1:5000";
  let adminVariants = [];
  let selectedVariant = null;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  function newVariant() {
    return { id: "v_" + Math.random().toString(36).slice(2, 11), color: "", image: "", stock: 0, sizes: [{size:"",price:0}], _file:null };
  }

  function normalize(v) {
    return (Array.isArray(v) ? v : []).map(x => ({
      id: x.id || ("v_"+Math.random().toString(36).slice(2,11)),
      color: x.color || "",
      image: x.image || "",
      stock: Number(x.stock) || 0,
      sizes: Array.isArray(x.sizes) && x.sizes.length
        ? x.sizes.slice(0,7).map(s => ({size:s.size || "", price:Number(s.price)||0}))
        : [{size:"",price:0}],
      _file:null
    }));
  }

  function renderAdmin() {
    const box = document.getElementById("variantsList");
    if (!box) return;
    box.innerHTML = `
      <div class="variant-new-help">Add each color separately. Each color can have 1–7 sizes with its own price.</div>
      <button type="button" class="variant-add-color" id="variantAddColor">+ Add Color</button>
    `;
    adminVariants.forEach((v, vi) => {
      const row = document.createElement("div");
      row.className = "variant-card";
      row.dataset.index = vi;
      row.innerHTML = `
        <div class="variant-card-head"><strong>Color ${vi+1}</strong>
          <button type="button" class="variant-delete-color">Remove</button>
        </div>
        <div class="variant-color-row">
          <div class="variant-field"><label>Color</label><input class="variant-color" value="${esc(v.color)}" placeholder="e.g. Red"></div>
          <div class="variant-field variant-image-field"><label>Color Image</label>
            <input type="file" class="variant-image" accept="image/png,image/jpeg,image/webp">
            <div class="variant-image-preview">${v.image ? `<img src="${API}/uploads/products/${esc(v.image)}">` : `<span>No image</span>`}</div>
          </div>
          <div class="variant-field variant-stock-field"><label>Stock Quantity</label><input type="number" min="0" class="variant-stock" value="${Number(v.stock)||0}"></div>
        </div>
        <div class="variant-size-head"><label>Number of sizes</label>
          <select class="variant-size-count">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${v.sizes.length===n?"selected":""}>${n}</option>`).join("")}</select>
        </div>
        <div class="variant-sizes"></div>
      `;
      const sizes = row.querySelector(".variant-sizes");
      v.sizes.forEach((sz, si) => {
        const sr = document.createElement("div");
        sr.className = "variant-size-row";
        sr.innerHTML = `<div class="variant-field"><label>Size ${si+1}</label><input class="variant-size" value="${esc(sz.size)}" placeholder="e.g. M"></div>
                        <div class="variant-field"><label>Price</label><input type="number" min="0" step="0.01" class="variant-price" value="${Number(sz.price)||0}"></div>`;
        sizes.appendChild(sr);
      });
      box.appendChild(row);
    });
    box.querySelector("#variantAddColor").onclick = () => { adminVariants.push(newVariant()); renderAdmin(); };
    box.querySelectorAll(".variant-delete-color").forEach((b,i)=>b.onclick=()=>{adminVariants.splice(i,1);renderAdmin();});
    box.querySelectorAll(".variant-color").forEach((e,i)=>e.oninput=()=>adminVariants[i].color=e.value);
    box.querySelectorAll(".variant-stock").forEach((e,i)=>e.oninput=()=>adminVariants[i].stock=Math.max(0,Number(e.value)||0));
    box.querySelectorAll(".variant-size-count").forEach((e,i)=>e.onchange=()=>{
      const n=Number(e.value), old=adminVariants[i].sizes||[];
      adminVariants[i].sizes=Array.from({length:n},(_,j)=>old[j]||{size:"",price:0}); renderAdmin();
    });
    box.querySelectorAll(".variant-size").forEach(e=>e.oninput=()=>{
      const card=e.closest(".variant-card"), vi=Number(card.dataset.index), si=[...card.querySelectorAll(".variant-size")].indexOf(e);
      adminVariants[vi].sizes[si].size=e.value;
    });
    box.querySelectorAll(".variant-price").forEach(e=>e.oninput=()=>{
      const card=e.closest(".variant-card"), vi=Number(card.dataset.index), si=[...card.querySelectorAll(".variant-price")].indexOf(e);
      adminVariants[vi].sizes[si].price=Number(e.value)||0;
    });
    box.querySelectorAll(".variant-image").forEach((e,i)=>{
      e.onchange=()=>{
        const file=e.files[0]; if(!file)return;
        adminVariants[i]._file=file;
        const p=e.closest(".variant-image-field").querySelector(".variant-image-preview");
        p.innerHTML=""; const img=document.createElement("img"); img.src=URL.createObjectURL(file); p.appendChild(img);
      };
    });
  }

  function getCleanVariants() {
    return adminVariants.map((v,i)=>({
      id:v.id,color:v.color.trim(),image:v.image||"",stock:Number(v.stock)||0,
      sizes:v.sizes.map(s=>({size:String(s.size||"").trim(),price:Number(s.price)||0})),
      ...(v._file ? {image_key:"variant_image_"+i} : {})
    })).filter(v=>v.color);
  }

  window.VariantUI = {
    initAdmin(initial) {
      adminVariants = normalize(initial);
      if (!adminVariants.length) adminVariants = [];
      renderAdmin();
    },
    getFormData(fd) {
      const clean=getCleanVariants();
      fd.append("variants", JSON.stringify(clean));
      adminVariants.forEach((v,i)=>{ if(v._file) fd.append("variant_image_"+i,v._file,v._file.name); });
      return fd;
    },
    loadProductVariants(v) { adminVariants=normalize(v); renderAdmin(); },
    getSelected() { return selectedVariant; },
    selectProductVariant(v, size) {
      selectedVariant = v ? {
        id:v.id,color:v.color,size:size || (v.sizes[0]&&v.sizes[0].size)||"",
        price:size ? Number((v.sizes.find(s=>String(s.size).toLowerCase()===String(size).toLowerCase())||{}).price||0) : Number((v.sizes[0]||{}).price||0),
        image:v.image||"",stock:Number(v.stock)||0
      } : null;
      return selectedVariant;
    }
  };

  function initProduct(product) {
    const variants=normalize(product && product.variants);
    const host=document.querySelector(".about-section");
    if(!host || !variants.length) return;
    let ui=document.getElementById("productVariants");
    if(!ui){ ui=document.createElement("div"); ui.id="productVariants"; ui.className="product-variants"; host.appendChild(ui); }
    let current=variants[0];
    let currentSize=current.sizes[0]||null;
    function render(){
      ui.innerHTML=`
        <h3>Variants</h3>
        <div class="variant-label">Colors</div>
        <div class="product-color-options">${variants.map((v,i)=>`<button type="button" class="product-color-option ${v===current?"selected":""}" data-i="${i}">${esc(v.color)}</button>`).join("")}</div>
        <div class="variant-selected-image">${current.image?`<img src="${API}/uploads/products/${esc(current.image)}" alt="${esc(current.color)}">`:""}</div>
        <div class="variant-label">Sizes</div>
        <div class="product-size-options">${current.sizes.map((s,i)=>`<button type="button" class="product-size-option ${s===currentSize?"selected":""}" data-i="${i}">${esc(s.size)} — $${Number(s.price).toFixed(2)}</button>`).join("")}</div>
        <div class="variant-stock-text">${current.stock>0?`Stock: ${current.stock}`:"Out of stock"}</div>`;
      ui.querySelectorAll(".product-color-option").forEach(b=>b.onclick=()=>{
        current=variants[Number(b.dataset.i)]; currentSize=current.sizes[0]||null; apply(); render();
      });
      ui.querySelectorAll(".product-size-option").forEach(b=>b.onclick=()=>{
        currentSize=current.sizes[Number(b.dataset.i)]; apply(); render();
      });
    }
    function apply(){
      const selected=window.VariantUI.selectProductVariant(current,currentSize&&currentSize.size);
      const img=document.getElementById("product-image");
      const price=document.getElementById("product-price");
      if(selected && selected.image && img) img.src=API+"/uploads/products/"+selected.image;
      if(selected && price) price.textContent="$"+selected.price.toFixed(2);
      if(selected && selected.stock<=0) document.getElementById("availability-text").textContent="Out of Stock";
    }
    apply(); render();
  }
  window.VariantUI.initProduct=initProduct;

  // Make the existing addToCart function automatically carry the selected variant.
  function wrapAddToCart(){
    if(typeof window.addToCart!=="function" || window.addToCart.__variantWrapped) return;
    const original=window.addToCart;
    const wrapped=function(name,price,image,productId){
      const v=window.VariantUI.getSelected();
      if(v && productId!=null){
        const variantId=productId+"_"+v.id+"_"+encodeURIComponent(v.size);
        const cart=typeof window.getCart==="function"?window.getCart():[];
        const existing=cart.find(x=>String(x.id)===String(variantId));
        if(existing){ existing.quantity+=1; if(typeof window.saveCart==="function")window.saveCart(cart); return cart; }
        const item={id:variantId,name,price:Number(v.price)||0,image:v.image?API+"/uploads/products/"+v.image:image,quantity:1,productId:Number(productId),
          variant:{id:v.id,color:v.color,size:v.size,price:Number(v.price)||0,image:v.image||"",stock:Number(v.stock)||0}};
        cart.push(item); if(typeof window.saveCart==="function")window.saveCart(cart); return cart;
      }
      return original.apply(this,arguments);
    };
    wrapped.__variantWrapped=true; window.addToCart=wrapped;
  }
  setTimeout(wrapAddToCart,0);
  document.addEventListener("DOMContentLoaded",wrapAddToCart);
  window.addEventListener("load",wrapAddToCart);
  document.addEventListener("DOMContentLoaded", function(){
    if(document.getElementById("addProductForm") || document.getElementById("editProductForm")){
      window.VariantUI.initAdmin([]);
    }
  });
})();
