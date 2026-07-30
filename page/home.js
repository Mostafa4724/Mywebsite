const productsContainer = document.getElementById("product-container");

async function loadProducts() {

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/products"
        );

        const data = await response.json();

        if (!data.success) {

            return;

        }

        productsContainer.innerHTML = "";

        data.products.forEach(product => {

            const image =
                product.image && product.image.trim() !== ""
                    ? product.image
                    : "https://picsum.photos/300/250?random=" + product.id;

            const card = document.createElement("div");

            card.className = "product-card";

            card.dataset.name = product.title;
            card.dataset.price = product.price;
            card.dataset.image = image;

            card.innerHTML = `
                <a href="product.html?id=${product.id}" class="product-card-link">

                    <img src="${image}" alt="${product.title}">

                    <h3>${product.title}</h3>

                    <p class="price">$${Number(product.price).toFixed(2)}</p>

                </a>

                <button
                    class="add-to-cart-btn"
                    data-id="${product.id}"
                    data-name="${product.title}"
                    data-price="${product.price}"
                    data-image="${image}"
                >
                    Add To Cart
                </button>
            `;

            productsContainer.appendChild(card);

        });
    }

    catch(err){

        console.log(err);

    }

}

loadProducts();