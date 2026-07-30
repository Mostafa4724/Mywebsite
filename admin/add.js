const form = document.getElementById("addProductForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const product = {

        title: document.getElementById("prodName").value.trim(),

        description: document.getElementById("prodDesc").value.trim(),

        category: document.getElementById("prodCategory").value,

        price: parseFloat(document.getElementById("prodPrice").value),

        stock: parseInt(document.getElementById("prodStock").value),

        image: ""

    };

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/admin/products",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(product)
            }
        );

        const result = await response.json();

        console.log(result);

        if (result.success) {

            alert("✅ Product Published Successfully!");

            form.reset();

            window.location.href = "admin_product.html";

        } else {

            alert(result.message);

        }

    } catch (error) {

        console.error(error);

        alert("Cannot connect to Flask server.");

    }

});