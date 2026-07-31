const form = document.getElementById("addProductForm");

console.log("Form:", form);

form.addEventListener("submit", async (e) => {

    console.log("Submit fired");

    e.preventDefault();

    const formData = new FormData();

    formData.append("title", document.getElementById("prodName").value);
    formData.append("description", document.getElementById("prodDesc").value);
    formData.append("category", document.getElementById("prodCategory").value);
    formData.append("price", document.getElementById("prodPrice").value);
    formData.append("stock", document.getElementById("prodStock").value);

    if (window.uploadedImages.length > 0) {

        formData.append(
            "image",
            window.uploadedImages[0].file
        );

    }

    console.log("Sending request...");

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/admin/products",
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + localStorage.getItem("token")
                },
                body: formData
            }
        );

        console.log("Response:", response.status);

        const data = await response.json();

        console.log(data);

    } catch (err) {

        console.error("Fetch error:", err);

    }

});