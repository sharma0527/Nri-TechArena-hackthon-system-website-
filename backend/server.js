require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Tesseract = require("tesseract.js");
const rateLimit = require("express-rate-limit");
const { google } = require("googleapis");
const sharp = require("sharp");
const paymentConfig = require("./paymentConfig");

const app = express();
app.use(cors({
  origin: "*"
}));
app.use(express.json());

// ─── Health Checks ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Hackathon Registration Backend is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "hackathon-backend" });
});

// ─── Static Uploads ────────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Google API Setup (Sheets + Drive) ─────────────────────────────────────────
const SHEET_ID = "1LarTOmgXNCCmcQ0Lu-MRIlCY3fvrUDNzqoPiN__yCOQ";
let sheets, drive;

let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
  } catch (e) {
    console.log("⚠️  Failed to parse GOOGLE_CREDENTIALS env var:", e.message);
  }
} else {
  const serviceAccountPath = path.join(__dirname, "state-level-hackthon-ce0a3cadf7321.json");
  if (fs.existsSync(serviceAccountPath)) {
    auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
  } else {
    console.log("⚠️  Credentials file not found — Google Sheets/Drive disabled.");
    console.log("   Place your credentials JSON at:", serviceAccountPath);
  }
}

if (auth) {
  try {
    sheets = google.sheets({ version: "v4", auth });
    drive = google.drive({ version: "v3", auth });
    console.log("✅ Connected to Google Sheets + Drive API");
  } catch (error) {
    console.log("⚠️  Google API auth failed:", error.message);
  }
}

// ─── Google Sheets: Add Row ────────────────────────────────────────────────────
async function addToSheet(data) {
  if (!sheets) return;
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Sheet1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [data] }
    });
    console.log("✅ Row added to Google Sheet");
  } catch (error) {
    console.error("❌ Google Sheet error:", error.message);
  }
}

// ─── Google Drive: Upload Screenshot ───────────────────────────────────────────
async function uploadToDrive(filePath, fileName) {
  if (!drive) return null;
  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: "image/png"
      },
      media: {
        mimeType: "image/png",
        body: fs.createReadStream(filePath)
      },
      fields: "id, webViewLink"
    });
    // Make file viewable by anyone with link
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: "reader", type: "anyone" }
    });
    const viewLink = `https://drive.google.com/file/d/${response.data.id}/view`;
    console.log("✅ Screenshot uploaded to Drive:", viewLink);
    return viewLink;
  } catch (error) {
    console.error("❌ Drive upload error:", error.message);
    return null;
  }
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many verification attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many registration attempts. Try again later." },
});

// ─── Multer Config ─────────────────────────────────────────────────────────────
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPEG, and WebP images are allowed"), false);
  }
});

// ─── Payment Config ────────────────────────────────────────────────────────────
app.get("/api/payment-config", (req, res) => {
  const active = paymentConfig.accounts.find(a => a.id === paymentConfig.activeQR);
  res.json(active);
});

app.post("/api/change-qr", (req, res) => {
  const { qrId } = req.body;
  const exists = paymentConfig.accounts.find(a => a.id === qrId);
  if (!exists) {
    return res.status(400).json({ error: "Invalid QR" });
  }
  paymentConfig.activeQR = qrId;
  res.json({ success: true, activeQR: qrId });
});

// ─── Payment Status & Deadline ─────────────────────────────────────────────────
let appStatus = { paymentsStopped: false };
const statusPath = path.join(__dirname, "status.json");
if (fs.existsSync(statusPath)) {
  try {
    appStatus = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
  } catch (e) { }
}

const getPaymentState = () => {
  const deadline = new Date("2026-03-25T10:00:00+05:30");
  const now = new Date();
  const isPastDeadline = now > deadline;
  return {
    paymentsStopped: appStatus.paymentsStopped || isPastDeadline,
    deadline: deadline.toISOString()
  };
};

app.get("/api/payment-status", (req, res) => {
  res.json(getPaymentState());
});

app.post("/api/toggle-payment", (req, res) => {
  const adminKey = process.env.ADMIN_KEY || "supersecretadmin";
  if (req.headers.authorization !== adminKey) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  appStatus.paymentsStopped = !appStatus.paymentsStopped;
  fs.writeFileSync(statusPath, JSON.stringify(appStatus));
  res.json(getPaymentState());
});

// ─── Email Transport ───────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// ─── In-Memory Stores ──────────────────────────────────────────────────────────
const registrationsDB = {};
const usedUTRs = new Set();
const usedImageHashes = new Set();

// Load existing UTRs and Hashes from Databases on startup to strictly block duplicates globally
const excelDBPath = path.join(__dirname, "registrations.xlsx");
const backupDBPath = path.join(__dirname, "registrations_testing_backup.xlsx");

[excelDBPath, backupDBPath].forEach(dbPath => {
  if (fs.existsSync(dbPath)) {
    try {
      const wb = xlsx.readFile(dbPath);
      if (wb.Sheets["Registrations"]) {
        const data = xlsx.utils.sheet_to_json(wb.Sheets["Registrations"]);
        data.forEach(row => {
          if (row.UTR) usedUTRs.add(row.UTR.toString().replace(/\s/g, "").trim());
          if (row.ScreenshotHash) usedImageHashes.add(row.ScreenshotHash);
        });
      }
    } catch (e) {
      console.error(`Error loading DB: ${dbPath}`, e);
    }
  }
});
console.log(`✅ Locked ${usedUTRs.size} previously successful UTRs and ${usedImageHashes.size} hashes from all databases.`);

// ─── Dynamic Fee Calculator ────────────────────────────────────────────────────
function calculateFee(memberCount) {
  if (memberCount === 3) return 600;
  if (memberCount === 4) return 800;
  if (memberCount === 5) return 1000;
  return 500;
}

// ─── Image Hash ────────────────────────────────────────────────────────────────
function computeImageHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

// ─── OCR Verification ──────────────────────────────────────────────────────────
async function verifyPayment(imagePath, expectedAmount, utr) {
  // 9. Image Metadata Validation (Blocks low-res edited templates)
  const meta = await sharp(imagePath).metadata();
  const isValidMetadata = meta.width >= 500 && meta.height >= 500;

  // Preprocess the image to improve OCR accuracy on dark UI (IN MEMORY for speed)
  const preprocessedBuffer = await sharp(imagePath)
    .resize({ width: 1200 }) // Reduced width for 50%+ faster processing
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();

  const result = await Tesseract.recognize(preprocessedBuffer, "eng", {
    tessedit_pageseg_mode: 6,
    tessedit_ocr_engine_mode: 1
  });

  let rawText = result.data.text.toLowerCase();
  const text = rawText.replace(/\\n/g, " ");
  const confidence = result.data.confidence;

  console.log("\n════ OCR TEXT DETECTED ════\n");
  console.log(result.data.text);
  console.log("\n═══════════════════════════\n");

  // 1️⃣ Get Current Date Automatically
  const today = new Date();
  const formattedDate1 = today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toLowerCase();
  const formattedDate2 = today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toLowerCase();
  const formattedDate3 = today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toLowerCase();

  // 3️⃣ Exact Receiver Validation (Matches EXACTLY as per active QR & PhonePe formatting)
  const activeAccount = paymentConfig.accounts.find(a => a.id === paymentConfig.activeQR);

  // Create an array of acceptable names (Main name + PhonePe truncated name format)
  const validReceiverNames = [
    activeAccount.name.toLowerCase().replace(/\s+/g, ""),
    activeAccount.altName ? activeAccount.altName.toLowerCase().replace(/\s+/g, "") : "",
    activeAccount.bankingName ? activeAccount.bankingName.toLowerCase().replace(/\s+/g, "") : ""
  ].filter(Boolean); // removes empty strings

  const exactUpi = activeAccount.upi.toLowerCase().replace(/\s+/g, "");

  const cleanOCRText = text.replace(/\s+/g, "");

  // Exact match required to be perfectly accurate: ONE of the receiver name structures OR UPI must match identically
  const nameCheck = validReceiverNames.some(name => cleanOCRText.includes(name)) || cleanOCRText.includes(exactUpi);

  // 4️⃣ Amount Validation (₹600 / ₹800 / ₹1000)
  const allowedAmounts = ["600", "800", "1000", "₹600", "₹800", "₹1000"];
  const cleanTextNum = text.replace(/,| /g, '');
  const amountStr = expectedAmount.toString();
  // It has to be an accepted hackathon amount, AND explicitly match the dynamic team member checkout fee:
  const isAllowedHackathonFee = allowedAmounts.some(amt => cleanTextNum.includes(amt.replace('₹', '')));
  const amountCheck = isAllowedHackathonFee && cleanTextNum.includes(amountStr);

  // 5️⃣ Payment Status Detection
  const successKeywords = [
    "transactionsuccessful",
    "paymentsuccessful",
    "paidsuccessfully",
    "transactioncompleted",
    "success",
    "paidto",
    "completed"
  ];
  const statusCheck = successKeywords.some(word => cleanOCRText.includes(word));

  // 6️⃣ UTR Pattern Exact Verification
  // Ensure that the user-submitted UTR exact string is found in the screenshot
  const utrCheck = utr ? cleanOCRText.includes(utr.toLowerCase()) : false;

  // 7️⃣ Current Date Validation
  // Includes month fallback or today/now for messy OCR
  // Adding exact PhonePe Transaction ID date parsing (e.g. tYYMMDD -> t260307)
  const currentMonthShort = today.toLocaleDateString("en-US", { month: "short" }).toLowerCase();

  const yy = today.getFullYear().toString().slice(-2);
  const mm = (today.getMonth() + 1).toString().padStart(2, '0');
  const dd = today.getDate().toString().padStart(2, '0');
  const phonepeTxnPrefix = `t${yy}${mm}${dd}`; // e.g. t260307
  const paytmTxnPrefix = `${today.getFullYear()}${mm}${dd}`; // e.g. 20260307

  const dateCheck = cleanOCRText.includes(formattedDate1.replace(/\s+/g, "")) ||
    cleanOCRText.includes(formattedDate2.replace(/\s+/g, "")) ||
    cleanOCRText.includes(formattedDate3.replace(/\s+/g, "")) ||
    cleanOCRText.includes(currentMonthShort) ||
    cleanOCRText.includes("today") ||
    cleanOCRText.includes("now") ||
    cleanOCRText.includes(phonepeTxnPrefix) ||
    cleanOCRText.includes(paytmTxnPrefix);

  // Fraud detection (Metadata and Editor keywords)
  const suspiciousWords = ["photoshop", "edited", "fake", "screenshot editor"];
  const isSuspicious = suspiciousWords.some(w => text.includes(w));

  if (isSuspicious) {
    return { success: false, reason: "Suspicious metadata/words detected (Photoshop/Fake)", confidence, score: 0 };
  }
  if (!isValidMetadata) {
    return { success: false, reason: "Invalid screenshot resolution (suspicious metadata)", confidence, score: 0 };
  }

  // 8️⃣ Final Secure Verification Logic
  if (nameCheck && statusCheck && amountCheck && utrCheck && dateCheck) {
    return { success: true, confidence, score: 100 };
  } else {
    // Collect the exact reason for the admin review logs
    let missingInfo = [];
    if (!nameCheck) missingInfo.push(`Exact Receiver Name / UPI (${activeAccount.name})`);
    if (!statusCheck) missingInfo.push("Success Status");
    if (!amountCheck) missingInfo.push(`Expected Amount ₹${expectedAmount}`);
    if (!utrCheck) missingInfo.push(`UTR (${utr})`);
    if (!dateCheck) missingInfo.push(`Date Context (${formattedDate1})`);

    return {
      success: false,
      reason: `Missing critical constraints: ${missingInfo.join(" | ")}`,
      confidence,
      score: 0
    };
  }
}


// ─── Send Confirmation Email ───────────────────────────────────────────────────
async function sendConfirmationEmail(to, name, teamName, domain, utr) {
  const mailOptions = {
    from: process.env.EMAIL,
    to: to,
    subject: "Hackathon Registration Confirmed",
    html: `
  <h2>Hackathon Registration Confirmed</h2>

  <p>Dear ${name},</p>

  <p>Your team <b>${teamName}</b> registration has been successfully verified.</p>

  <h3>Accommodation Contact</h3>

  <p>Surya : +91 97017 11338</p>
  <p>Vijay : +91 93927 57990</p>
  <p>Sai : +91 72075 94604</p>
  <p>Sharma : +91 8688011599</p>

  <h3>Terms & Conditions</h3>

  <ul>
  <li>Accommodation is only for outside registered participants.</li>
  <li>Carry your college ID and registration confirmation.</li>
  <li>Follow all instructions provided by organizers.</li>
  <li>Misconduct or rule violations may lead to disqualification.</li>
  <li>Accommodation is subject to availability.</li>
  </ul>

  <p>We look forward to your participation.</p>

  <p>
  Regards <br>
  NRI Institute of Technology
  </p>
  `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
  } catch (e) {
    console.error(`❌ Failed to send email to ${to}:`, e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════
//  EXISTING EMAIL ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════════

app.post("/send-mails", upload.single("file"), async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    const emails = data.map(row => row.email).filter(Boolean);

    let success = [];
    let failed = [];

    for (let email of emails) {
      try {
        await transporter.sendMail({ from: process.env.EMAIL, to: email, subject, text: message });
        success.push(email);
      } catch (err) { failed.push(email); }
    }

    res.json({ total: emails.length, success, failed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/send-single-mail", async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    if (!email || !subject || !message) return res.status(400).json({ error: "Missing required fields" });

    await transporter.sendMail({ from: process.env.EMAIL, to: email, subject, text: message });
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════
//  HACKATHON REGISTRATION
// ═════════════════════════════════════════════════════════════════════════════════

app.post("/api/register", registerLimiter, (req, res) => {
  const { teamName, domain, department, branch, teamLeadName, teamLeadEmail, teamLeadPhone, members } = req.body;

  if (!teamName || !teamLeadName || !teamLeadEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Duplicate email check
  const allEmails = [teamLeadEmail, ...(members || []).map(m => m.email).filter(Boolean)];
  const uniqueEmails = new Set(allEmails.map(e => e.toLowerCase().trim()));
  if (uniqueEmails.size !== allEmails.filter(Boolean).length) {
    return res.status(400).json({ error: "Duplicate email addresses detected in team" });
  }

  // Team size validation (4-5 total including lead)
  const totalMembers = (members || []).length + 1;
  if (totalMembers < 4 || totalMembers > 5) {
    return res.status(400).json({ error: "Team must have 4-5 members (including team lead)" });
  }

  const orderId = "order_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  registrationsDB[orderId] = {
    orderId, teamName, domain, department, branch,
    teamLeadName, teamLeadEmail, teamLeadPhone,
    members,
    status: "Pending Payment",
    attempts: 0,
    createdAt: new Date(),
  };

  const fee = calculateFee(totalMembers);
  res.json({ orderId, fee, message: "Order created successfully" });
});

// ═════════════════════════════════════════════════════════════════════════════════
//  PAYMENT VERIFICATION PIPELINE
// ═════════════════════════════════════════════════════════════════════════════════

app.post("/api/verify-payment", verifyLimiter, upload.single("screenshot"), async (req, res) => {
  const { paymentsStopped } = getPaymentState();
  if (paymentsStopped) {
    return res.status(403).json({ success: false, message: "Payments have officially been closed." });
  }

  try {
    const { orderId, utr } = req.body;

    // Input validation
    if (!req.file) return res.status(400).json({ success: false, message: "Screenshot is required" });
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    // Step 1: Secure UTR Format Validation (12-22 Alphanumeric)
    const normalizedUTR = utr ? utr.replace(/\\s/g, "").trim() : "";
    const utrRegex = /^[A-Za-z0-9]{12,22}$/;
    if (!utrRegex.test(normalizedUTR)) {
      return res.status(400).json({ success: false, message: "Invalid UTR sequence. Must be 12-22 characters." });
    }

    const reg = registrationsDB[orderId];
    if (!reg) return res.status(404).json({ success: false, message: "Order not found" });

    // Anti-abuse: max 5 attempts
    reg.attempts = (reg.attempts || 0) + 1;
    if (reg.attempts > 5) {
      return res.status(429).json({ success: false, message: "Maximum attempts exceeded. Contact support." });
    }

    // ── FRAUD CHECK 1: Duplicate UTR ──
    if (usedUTRs.has(normalizedUTR)) {
      return res.status(400).json({
        success: false,
        message: `Duplicate payment reference: UTR ${normalizedUTR} has already been verified for another team.`,
      });
    }

    // ── FRAUD CHECK 2: Duplicate Screenshot (SHA256 hash) ──
    const imageHash = computeImageHash(req.file.path);
    if (usedImageHashes.has(imageHash)) {
      return res.status(400).json({
        success: false,
        message: "This screenshot has already been used. Each registration requires a unique payment.",
      });
    }

    // ── Calculate Dynamic Fee ──
    const totalMembers = (reg.members || []).length + 1;
    const amount = calculateFee(totalMembers);

    // ── OCR + Fraud Verification ──
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  Payment Verification - ${orderId}`);
    console.log(`  Team: ${reg.teamName} | Members: ${totalMembers} | Fee: ₹${amount}`);
    console.log(`${"═".repeat(50)}`);

    const verification = await verifyPayment(req.file.path, amount, normalizedUTR);

    console.log(`  OCR Confidence: ${verification.confidence?.toFixed(1)}%`);
    console.log(`  Result: ${verification.success ? "APPROVED" : "REJECTED"} | Reason: ${verification.reason || "N/A"}`);
    console.log(`${"═".repeat(50)}\n`);

    // ── DECISION: Strict Verfication ──
    if (!verification.success) {
      // ═══ PAYMENT REJECTED ═══
      reg.status = "Payment Failed";
      return res.status(400).json({
        success: false,
        message: `Verification failed: ${verification.reason}`,
      });
    }

    usedUTRs.add(normalizedUTR);
    usedImageHashes.add(imageHash);
    reg.status = "Payment Confirmed";
    reg.utr = normalizedUTR;

    // Save screenshot permanently on server
    const ext = path.extname(req.file.originalname) || ".png";
    const newFilename = `${orderId}_${Date.now()}${ext}`;
    const permanentPath = path.join(__dirname, "uploads", newFilename);
    fs.renameSync(req.file.path, permanentPath);
    const localImageUrl = `/uploads/${newFilename}`;

    // 1. Upload screenshot to Google Drive first to get permanent URL
    let screenshotUrl = "";
    try {
      const driveUrl = await uploadToDrive(permanentPath, newFilename);
      const backendUrl = process.env.NODE_ENV === "production"
        ? "https://nri-techarena-hackthon-system-website-wry4.onrender.com"
        : "http://localhost:5000";
      screenshotUrl = driveUrl || `${backendUrl}${localImageUrl}`;
    } catch (e) {
      screenshotUrl = `http://localhost:5000${localImageUrl}`;
    }

    const members = reg.members || [];
    const activeAccount = paymentConfig.accounts.find(a => a.id === paymentConfig.activeQR);

    // ── Save to Excel ──
    const excelPath = path.join(__dirname, "registrations.xlsx");
    const excelRow = {
      OrderID: reg.orderId,
      TeamName: reg.teamName,
      Department: reg.department || "",
      Domain: reg.domain || "",
      Branch: reg.branch || "",
      LeadName: reg.teamLeadName,
      LeadEmail: reg.teamLeadEmail,
      LeadPhone: reg.teamLeadPhone || "",
      Members: totalMembers,
      UTR: normalizedUTR,
      Amount: amount,
      Receiver: activeAccount ? activeAccount.name : "Unknown",
      QR_ID: activeAccount ? activeAccount.id : 0,
      ScreenshotHash: imageHash,
      Screenshot: screenshotUrl, // Fixed to use actual URL
      VerificationScore: verification.score || 0,
      Status: "Confirmed",
      Date: new Date().toLocaleString()
    };

    let workbook;
    if (fs.existsSync(excelPath)) {
      workbook = xlsx.readFile(excelPath);
      if (!workbook.Sheets["Registrations"]) {
        xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([]), "Registrations");
      }
      const data = xlsx.utils.sheet_to_json(workbook.Sheets["Registrations"]);
      data.push(excelRow);
      workbook.Sheets["Registrations"] = xlsx.utils.json_to_sheet(data);
    } else {
      workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([excelRow]), "Registrations");
    }
    xlsx.writeFile(workbook, excelPath);
    console.log("✅ Saved to Local Excel");

    // ── Immediate Response (Fast Verify) ──
    res.json({
      success: true,
      message: "Payment verified and registration confirmed!",
    });

    // ── BACKGROUND TASKS (DO NOT BLOCK RESPONSE) ──
    (async () => {
      console.log(`⏳ Starting background tasks for ${orderId}...`);

      try {
        // 2. Google Sheets Append
        await addToSheet([
          reg.orderId,
          reg.teamName,
          reg.department || "",
          reg.domain || "",
          totalMembers.toString(),
          reg.teamLeadName,
          reg.teamLeadEmail,
          reg.teamLeadPhone || "",
          normalizedUTR,
          amount.toString(),
          imageHash,
          screenshotUrl,
          (verification.score || 0).toString(),
          "Confirmed",
          new Date().toLocaleString(),
          activeAccount ? activeAccount.name : "Unknown",
          activeAccount ? activeAccount.id.toString() : "0"
        ]);

        // 3. Send Confirmation Emails
        const emailList = [{ name: reg.teamLeadName, email: reg.teamLeadEmail }];
        const validMembers = members.filter(m => m.email && m.email.trim() !== "");
        validMembers.forEach(m => emailList.push({ name: m.name || "Participant", email: m.email.trim() }));

        // Execute email sending in parallel
        await Promise.allSettled(
          emailList.map(member =>
            sendConfirmationEmail(member.email, member.name, reg.teamName, reg.domain, normalizedUTR)
          )
        );
        console.log(`✅ Completed background tasks for ${orderId}`);
      } catch (err) {
        console.error(`❌ Background tasks failed for ${orderId}:`, err);
      }
    })();

  } catch (error) {
    console.error("❌ Verification Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Admin: Fetch All Registrations (from Excel) ───────────────────────────────
app.get("/admin/registrations", (req, res) => {
  try {
    const excelPath = path.join(__dirname, "registrations.xlsx");
    if (!fs.existsSync(excelPath)) {
      return res.json([]);
    }
    const workbook = xlsx.readFile(excelPath);
    if (!workbook.Sheets["Registrations"]) {
      return res.json([]);
    }
    const data = xlsx.utils.sheet_to_json(workbook.Sheets["Registrations"]);
    // Return newest first
    res.json(data.reverse());
  } catch (error) {
    console.error("Admin fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Fetch Backup/Testing Registrations ─────────────────────────────────
app.get("/admin/backups", (req, res) => {
  try {
    const backupPath = path.join(__dirname, "registrations_testing_backup.xlsx");
    if (!fs.existsSync(backupPath)) {
      return res.json([]);
    }
    const workbook = xlsx.readFile(backupPath);
    if (!workbook.Sheets["Registrations"]) {
      return res.json([]);
    }
    const data = xlsx.utils.sheet_to_json(workbook.Sheets["Registrations"]);
    res.json(data.reverse());
  } catch (error) {
    console.error("Backup fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Backend – Delete Registration ─────────────────────────────────────────────
app.delete("/api/delete-registration/:orderId", async (req, res) => {
  try {
    // Security Recommendation: Admin Protection
    const adminKey = process.env.ADMIN_KEY || "supersecretadmin";
    if (req.headers.authorization !== adminKey) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { orderId } = req.params;

    // 1. Delete from Excel (Local DB) so the dashboard updates correctly
    const excelPath = path.join(__dirname, "registrations.xlsx");
    if (fs.existsSync(excelPath)) {
      const workbook = xlsx.readFile(excelPath);
      if (workbook.Sheets["Registrations"]) {
        let data = xlsx.utils.sheet_to_json(workbook.Sheets["Registrations"]);
        // Keep rows that do not match the orderId
        data = data.filter(row => row.OrderID !== orderId);
        workbook.Sheets["Registrations"] = xlsx.utils.json_to_sheet(data);
        xlsx.writeFile(workbook, excelPath);
      }
    }

    // 2. Delete from Google Sheets (if connected)
    if (sheets) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "Sheet1!A2:L",
      });

      const rows = response.data.values;
      let rowIndex = -1;
      if (rows) {
        rowIndex = rows.findIndex(row => row[0] === orderId);
      }

      if (rowIndex !== -1) {
        const deleteRow = rowIndex + 2;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: "ROWS",
                    startIndex: deleteRow - 1,
                    endIndex: deleteRow
                  }
                }
              }
            ]
          }
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Hackathon Registration Server`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Email: ${process.env.EMAIL}`);
  console.log(`  Google Sheets: ${sheets ? "Connected" : "Disabled"}`);
  console.log(`  Google Drive: ${drive ? "Connected" : "Disabled"}`);
  console.log(`${"═".repeat(50)}\n`);
});
