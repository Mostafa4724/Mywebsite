

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

            

            form.reset();

            window.location.href = "admin_product.html";

        } else {

            alert(result.message);

        }

    } catch (error) {

        console.error(error);

        alert("Cannot connect to Flask server.");

    }

