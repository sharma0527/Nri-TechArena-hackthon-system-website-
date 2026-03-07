module.exports = {
    activeQR: 2,
    accounts: [
        {
            id: 2,
            name: "Siva Kotamma Challa",
            altName: "Siva Kotamma", // Covers the OCR splitting
            bankingName: "Siva Kotamma Challa", // In screenshot: "Banking Name : Siva Kotamma Challa"
            phone: "+91 97017 11338",
            upi: "sivakotamma@ybl",
            bank: "Axis Bank",
            qr: "/qr/qr2.png"
        },
        {
            id: 3,
            name: "Chilumuru Chandra Harsha Saraman",
            altName: "Chilumuru Chandra Harsha", // PhonePe cuts at "Harsha \n Saraman"
            bankingName: "Chilumuru Chan...sha Saraman", // Accurate reflection of PhonePe truncating long names
            phone: "+91 86880 11599",
            upi: "XXXXXX1599-e466@ybl", // In Screenshot
            bank: "SBI",
            qr: "/qr/qr3.png"
        }
    ]
};
